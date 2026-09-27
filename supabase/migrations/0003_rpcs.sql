-- Color Hunt: game logic as security definer RPCs. Postgres is the authority for every transition.

-- ---------------------------------------------------------------------------
-- Internal helpers (not meant to be called from clients)
-- ---------------------------------------------------------------------------
create function public.generate_session_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  i integer;
begin
  for i in 1..6 loop
    v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::integer, 1);
  end loop;
  return v_code;
end;
$$;

create function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return v_user;
end;
$$;

create function public.lock_session(p_session_id uuid)
returns public.game_sessions
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_session public.game_sessions;
begin
  select * into v_session from public.game_sessions where id = p_session_id for update;
  if not found then
    raise exception 'session_not_found';
  end if;
  return v_session;
end;
$$;

create function public.active_player_count(p_session_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.session_players
  where session_id = p_session_id and status <> 'left';
$$;

create function public.pick_random_active_player(p_session_id uuid, p_exclude uuid default null)
returns uuid
language sql
stable
set search_path = ''
as $$
  select user_id
  from public.session_players
  where session_id = p_session_id
    and status <> 'left'
    and (p_exclude is null or user_id <> p_exclude)
  order by random()
  limit 1;
$$;

-- Picks the hidden object: far from every player, avoiding recently used objects and kinds.
-- Constraints relax step by step if the candidate pool empties.
create function public.pick_hidden_object(p_session_id uuid, p_positions jsonb)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_min_distance constant double precision := 18;
  v_recent_ids text[];
  v_recent_kinds text[];
  v_object_id text;
begin
  select coalesce(array_agg(hidden_object_id), '{}')
    into v_recent_ids
  from (
    select hidden_object_id from public.rounds
    where session_id = p_session_id
    order by round_number desc limit 3
  ) recent;

  select coalesce(array_agg(m.kind), '{}')
    into v_recent_kinds
  from (
    select hidden_object_id from public.rounds
    where session_id = p_session_id
    order by round_number desc limit 2
  ) recent
  join public.map_objects m on m.id = recent.hidden_object_id;

  create temp table if not exists tmp_candidates (id text, kind text, weight double precision) on commit drop;
  delete from tmp_candidates;

  insert into tmp_candidates (id, kind, weight)
  select m.id, m.kind, m.weight
  from public.map_objects m
  where not exists (
    select 1
    from jsonb_array_elements(coalesce(p_positions, '[]'::jsonb)) p
    where sqrt(power(m.x - (p ->> 'x')::double precision, 2) + power(m.z - (p ->> 'z')::double precision, 2)) < v_min_distance
  );

  -- Level 1: fresh object and fresh kind.
  select id into v_object_id from tmp_candidates
  where not (id = any(v_recent_ids)) and not (kind = any(v_recent_kinds))
  order by power(random(), 1.0 / greatest(weight, 0.05)) desc limit 1;
  if v_object_id is not null then return v_object_id; end if;

  -- Level 2: fresh object only.
  select id into v_object_id from tmp_candidates
  where not (id = any(v_recent_ids))
  order by power(random(), 1.0 / greatest(weight, 0.05)) desc limit 1;
  if v_object_id is not null then return v_object_id; end if;

  -- Level 3: anything far enough from players.
  select id into v_object_id from tmp_candidates
  order by power(random(), 1.0 / greatest(weight, 0.05)) desc limit 1;
  if v_object_id is not null then return v_object_id; end if;

  -- Level 4: any object at all (only when the map is tiny relative to the player spread).
  select id into v_object_id from public.map_objects
  order by power(random(), 1.0 / greatest(weight, 0.05)) desc limit 1;
  if v_object_id is null then
    raise exception 'map_objects_empty';
  end if;
  return v_object_id;
end;
$$;

create function public.end_round(
  p_session_id uuid,
  p_reason public.round_end_reason,
  p_caught_player_id uuid,
  p_next_hunter_id uuid
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_session public.game_sessions;
begin
  select * into v_session from public.game_sessions where id = p_session_id;

  update public.rounds
  set ended_at = now(),
      end_reason = p_reason,
      caught_player_id = p_caught_player_id,
      next_hunter_id = p_next_hunter_id
  where id = v_session.current_round_id;

  update public.game_sessions
  set status = 'round_over',
      hunter_id = p_next_hunter_id,
      updated_at = now()
  where id = p_session_id;
end;
$$;

create function public.transfer_host_if_needed(p_session_id uuid)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_session public.game_sessions;
  v_new_host uuid;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if exists (
    select 1 from public.session_players
    where session_id = p_session_id and user_id = v_session.host_id and status <> 'left'
  ) then
    return;
  end if;

  select user_id into v_new_host
  from public.session_players
  where session_id = p_session_id and status <> 'left'
  order by joined_at asc limit 1;

  if v_new_host is not null then
    update public.game_sessions set host_id = v_new_host, updated_at = now() where id = p_session_id;
  end if;
end;
$$;

-- Removes a player from a session and repairs the game state around the gap.
create function public.remove_player(p_session_id uuid, p_user_id uuid)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_session public.game_sessions;
  v_player public.session_players;
  v_active integer;
  v_new_hunter uuid;
begin
  v_session := public.lock_session(p_session_id);

  select * into v_player from public.session_players
  where session_id = p_session_id and user_id = p_user_id;
  if not found then return; end if;
  if v_player.status = 'left' then return; end if;

  update public.session_players
  set status = 'left'
  where session_id = p_session_id and user_id = p_user_id;

  if v_session.status = 'finished' then
    return;
  end if;

  perform public.transfer_host_if_needed(p_session_id);

  if v_session.status = 'lobby' then
    if public.active_player_count(p_session_id) = 0 then
      update public.game_sessions set status = 'finished', updated_at = now() where id = p_session_id;
    end if;
    return;
  end if;

  v_active := public.active_player_count(p_session_id);
  if v_active < 2 then
    update public.game_sessions set status = 'finished', updated_at = now() where id = p_session_id;
    return;
  end if;

  if v_session.hunter_id = p_user_id then
    v_new_hunter := public.pick_random_active_player(p_session_id, p_user_id);
    if v_session.status = 'hunting' then
      perform public.end_round(p_session_id, 'hunter_left', null, v_new_hunter);
      return;
    end if;
    -- choosing_color or round_over: hand the role over directly.
    update public.game_sessions set hunter_id = v_new_hunter, updated_at = now() where id = p_session_id;
    if v_session.status = 'choosing_color' then
      update public.session_players set status = 'hunter'
      where session_id = p_session_id and user_id = v_new_hunter;
    end if;
    return;
  end if;

  -- A searching player left during a hunt: if nobody is left to catch, the round ends.
  if v_session.status = 'hunting' and not exists (
    select 1 from public.session_players
    where session_id = p_session_id and status = 'searching'
  ) then
    perform public.end_round(p_session_id, 'all_safe', null, v_session.hunter_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------
create function public.create_session()
returns public.game_sessions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_name text;
  v_code text;
  v_session public.game_sessions;
  v_membership record;
begin
  -- A player can only be in one live session at a time.
  for v_membership in
    select sp.session_id from public.session_players sp
    join public.game_sessions gs on gs.id = sp.session_id
    where sp.user_id = v_user and sp.status <> 'left' and gs.status <> 'finished'
  loop
    perform public.remove_player(v_membership.session_id, v_user);
  end loop;

  select display_name into v_name from public.profiles where id = v_user;

  loop
    v_code := public.generate_session_code();
    exit when not exists (select 1 from public.game_sessions where code = v_code and status <> 'finished');
  end loop;

  insert into public.game_sessions (code, host_id)
  values (v_code, v_user)
  returning * into v_session;

  insert into public.session_players (session_id, user_id, display_name, color_index, status)
  values (v_session.id, v_user, coalesce(v_name, 'Player'), 0, 'waiting');

  return v_session;
end;
$$;

create function public.join_session(p_code text)
returns public.game_sessions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_name text;
  v_session public.game_sessions;
  v_existing public.session_players;
  v_color integer;
  v_membership record;
begin
  select * into v_session from public.game_sessions
  where code = upper(trim(p_code)) and status <> 'finished'
  order by created_at desc limit 1
  for update;
  if not found then
    raise exception 'session_not_found';
  end if;

  select * into v_existing from public.session_players
  where session_id = v_session.id and user_id = v_user;

  if found and v_existing.status <> 'left' then
    -- Already a member: simply return the session (reconnect).
    update public.session_players set last_seen_at = now()
    where session_id = v_session.id and user_id = v_user;
    return v_session;
  end if;

  if v_session.status <> 'lobby' then
    raise exception 'game_already_started';
  end if;

  if public.active_player_count(v_session.id) >= v_session.max_players then
    raise exception 'session_full';
  end if;

  for v_membership in
    select sp.session_id from public.session_players sp
    join public.game_sessions gs on gs.id = sp.session_id
    where sp.user_id = v_user and sp.status <> 'left' and gs.status <> 'finished' and sp.session_id <> v_session.id
  loop
    perform public.remove_player(v_membership.session_id, v_user);
  end loop;

  select display_name into v_name from public.profiles where id = v_user;

  select min(candidate) into v_color
  from generate_series(0, v_session.max_players - 1) candidate
  where candidate not in (
    select color_index from public.session_players
    where session_id = v_session.id and status <> 'left'
  );

  if v_existing.user_id is not null then
    update public.session_players
    set status = 'waiting', color_index = v_color, last_seen_at = now(), joined_at = now()
    where session_id = v_session.id and user_id = v_user;
  else
    insert into public.session_players (session_id, user_id, display_name, color_index, status)
    values (v_session.id, v_user, coalesce(v_name, 'Player'), v_color, 'waiting');
  end if;

  update public.game_sessions set updated_at = now() where id = v_session.id;
  return v_session;
end;
$$;

create function public.leave_session(p_session_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  perform public.remove_player(p_session_id, v_user);
end;
$$;

create function public.start_game(p_session_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_session public.game_sessions;
  v_hunter uuid;
begin
  v_session := public.lock_session(p_session_id);
  if v_session.host_id <> v_user then
    raise exception 'only_host_can_start';
  end if;
  if v_session.status <> 'lobby' then
    raise exception 'game_already_started';
  end if;
  if public.active_player_count(p_session_id) < 2 then
    raise exception 'need_at_least_two_players';
  end if;

  v_hunter := public.pick_random_active_player(p_session_id);

  update public.session_players
  set status = case when user_id = v_hunter then 'hunter'::public.player_status else 'searching'::public.player_status end
  where session_id = p_session_id and status <> 'left';

  update public.game_sessions
  set status = 'choosing_color', hunter_id = v_hunter, round_number = 0, updated_at = now()
  where id = p_session_id;
end;
$$;

create function public.announce_color(
  p_session_id uuid,
  p_color_name text,
  p_color_hex text,
  p_positions jsonb
)
returns public.rounds
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_session public.game_sessions;
  v_object_id text;
  v_round public.rounds;
begin
  v_session := public.lock_session(p_session_id);
  if v_session.status <> 'choosing_color' then
    raise exception 'not_choosing_color';
  end if;
  if v_session.hunter_id <> v_user then
    raise exception 'only_hunter_can_announce';
  end if;
  if p_color_hex !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'invalid_color';
  end if;
  if char_length(trim(p_color_name)) not between 1 and 20 then
    raise exception 'invalid_color';
  end if;

  v_object_id := public.pick_hidden_object(p_session_id, p_positions);

  insert into public.rounds (session_id, round_number, hunter_id, color_name, color_hex, hidden_object_id, ends_at)
  values (p_session_id, v_session.round_number + 1, v_user, trim(p_color_name), lower(p_color_hex), v_object_id, now() + interval '180 seconds')
  returning * into v_round;

  update public.session_players
  set status = case when user_id = v_user then 'hunter'::public.player_status else 'searching'::public.player_status end
  where session_id = p_session_id and status <> 'left';

  update public.game_sessions
  set status = 'hunting',
      round_number = v_round.round_number,
      current_round_id = v_round.id,
      updated_at = now()
  where id = p_session_id;

  return v_round;
end;
$$;

create function public.claim_safe(p_session_id uuid, p_object_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_session public.game_sessions;
  v_player public.session_players;
  v_round public.rounds;
  v_all_safe boolean;
begin
  v_session := public.lock_session(p_session_id);
  if v_session.status <> 'hunting' then
    raise exception 'round_not_active';
  end if;

  select * into v_player from public.session_players
  where session_id = p_session_id and user_id = v_user;
  if not found then
    raise exception 'not_a_member';
  end if;
  if v_player.status <> 'searching' then
    return jsonb_build_object('ok', false, 'reason', 'not_searching');
  end if;

  select * into v_round from public.rounds where id = v_session.current_round_id;
  if v_round.hidden_object_id <> p_object_id then
    return jsonb_build_object('ok', false, 'reason', 'wrong_object');
  end if;

  update public.session_players set status = 'safe'
  where session_id = p_session_id and user_id = v_user;

  v_all_safe := not exists (
    select 1 from public.session_players
    where session_id = p_session_id and status = 'searching'
  );

  if v_all_safe then
    perform public.end_round(p_session_id, 'all_safe', null, v_session.hunter_id);
  end if;

  return jsonb_build_object('ok', true, 'all_safe', v_all_safe);
end;
$$;

create function public.catch_player(p_session_id uuid, p_target_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_session public.game_sessions;
  v_target public.session_players;
begin
  v_session := public.lock_session(p_session_id);
  if v_session.status <> 'hunting' then
    return jsonb_build_object('ok', false, 'reason', 'round_not_active');
  end if;
  if v_session.hunter_id <> v_user then
    raise exception 'only_hunter_can_catch';
  end if;

  select * into v_target from public.session_players
  where session_id = p_session_id and user_id = p_target_id;
  if not found then
    raise exception 'target_not_a_member';
  end if;
  if v_target.status <> 'searching' then
    return jsonb_build_object('ok', false, 'reason', 'target_not_catchable');
  end if;

  update public.session_players set status = 'eliminated'
  where session_id = p_session_id and user_id = p_target_id;

  perform public.end_round(p_session_id, 'caught', p_target_id, p_target_id);
  return jsonb_build_object('ok', true);
end;
$$;

create function public.expire_round(p_session_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_session public.game_sessions;
  v_round public.rounds;
begin
  v_session := public.lock_session(p_session_id);
  if not public.is_session_member(p_session_id) then
    raise exception 'not_a_member';
  end if;
  if v_session.status <> 'hunting' then
    return false;
  end if;
  select * into v_round from public.rounds where id = v_session.current_round_id;
  if now() < v_round.ends_at then
    return false;
  end if;
  perform public.end_round(p_session_id, 'timeout', null, v_session.hunter_id);
  return true;
end;
$$;

create function public.next_round(p_session_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_session public.game_sessions;
begin
  v_session := public.lock_session(p_session_id);
  if not public.is_session_member(p_session_id) then
    raise exception 'not_a_member';
  end if;
  if v_session.status <> 'round_over' then
    return;
  end if;

  if public.active_player_count(p_session_id) < 2 then
    update public.game_sessions set status = 'finished', updated_at = now() where id = p_session_id;
    return;
  end if;

  if v_session.hunter_id is null or not exists (
    select 1 from public.session_players
    where session_id = p_session_id and user_id = v_session.hunter_id and status <> 'left'
  ) then
    v_session.hunter_id := public.pick_random_active_player(p_session_id);
  end if;

  update public.session_players
  set status = case when user_id = v_session.hunter_id then 'hunter'::public.player_status else 'searching'::public.player_status end
  where session_id = p_session_id and status <> 'left';

  update public.game_sessions
  set status = 'choosing_color', hunter_id = v_session.hunter_id, current_round_id = null, updated_at = now()
  where id = p_session_id;
end;
$$;

create function public.heartbeat(p_session_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
begin
  update public.session_players set last_seen_at = now()
  where session_id = p_session_id and user_id = v_user and status <> 'left';
end;
$$;

create function public.mark_stale_players(p_session_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_stale record;
  v_count integer := 0;
begin
  if not public.is_session_member(p_session_id) then
    raise exception 'not_a_member';
  end if;
  for v_stale in
    select user_id from public.session_players
    where session_id = p_session_id
      and status <> 'left'
      and user_id <> v_user
      and last_seen_at < now() - interval '25 seconds'
  loop
    perform public.remove_player(p_session_id, v_stale.user_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.get_session_snapshot(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.require_user();
  v_session public.game_sessions;
begin
  if not public.is_session_member(p_session_id) then
    raise exception 'not_a_member';
  end if;
  select * into v_session from public.game_sessions where id = p_session_id;
  return jsonb_build_object(
    'session', to_jsonb(v_session),
    'players', coalesce((
      select jsonb_agg(to_jsonb(sp) order by sp.joined_at)
      from public.session_players sp
      where sp.session_id = p_session_id
    ), '[]'::jsonb),
    'round', (
      select to_jsonb(r) from public.rounds r where r.id = v_session.current_round_id
    ),
    'server_time', to_jsonb(now())
  );
end;
$$;

-- Lock down the internal helpers so clients cannot call them directly.
revoke execute on function public.pick_hidden_object(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.end_round(uuid, public.round_end_reason, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.remove_player(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.transfer_host_if_needed(uuid) from public, anon, authenticated;
revoke execute on function public.lock_session(uuid) from public, anon, authenticated;
revoke execute on function public.pick_random_active_player(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.generate_session_code() from public, anon, authenticated;
revoke execute on function public.broadcast_game_change() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
