-- Realtime: private channel per session, topic "game:<session uuid>".
-- Clients broadcast positions and presence on it; the database broadcasts row changes to it.
-- Note: realtime.messages already has RLS enabled. Never ALTER that table (the migration would abort).

create function public.session_id_from_topic(p_topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic ~ '^game:[0-9a-fA-F-]{36}$' then substring(p_topic from 6)::uuid
    else null
  end;
$$;

create policy "session members can receive game channel messages"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.is_session_member(public.session_id_from_topic((select realtime.topic())))
  );

create policy "session members can send game channel messages"
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.is_session_member(public.session_id_from_topic((select realtime.topic())))
  );

-- Broadcast every change of the three game tables to the session topic.
create function public.broadcast_game_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
begin
  if tg_table_name = 'game_sessions' then
    v_session_id := coalesce(new.id, old.id);
  else
    v_session_id := coalesce(new.session_id, old.session_id);
  end if;

  perform realtime.broadcast_changes(
    'game:' || v_session_id::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

create trigger game_sessions_broadcast
  after insert or update or delete on public.game_sessions
  for each row execute function public.broadcast_game_change();

create trigger session_players_broadcast
  after insert or update or delete on public.session_players
  for each row execute function public.broadcast_game_change();

create trigger rounds_broadcast
  after insert or update or delete on public.rounds
  for each row execute function public.broadcast_game_change();
