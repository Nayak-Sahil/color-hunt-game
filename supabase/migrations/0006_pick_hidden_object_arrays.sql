-- The API connection runs with safe-update protection, which rejects DELETE without WHERE.
-- Rewrite the picker to work on arrays instead of a temp table.
create or replace function public.pick_hidden_object(p_session_id uuid, p_positions jsonb)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_min_distance constant double precision := 18;
  v_recent_ids text[];
  v_recent_kinds text[];
  v_candidates text[];
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

  -- Objects far enough from every reported player position.
  select coalesce(array_agg(m.id), '{}')
    into v_candidates
  from public.map_objects m
  where not exists (
    select 1
    from jsonb_array_elements(coalesce(p_positions, '[]'::jsonb)) p
    where sqrt(power(m.x - (p ->> 'x')::double precision, 2) + power(m.z - (p ->> 'z')::double precision, 2)) < v_min_distance
  );

  -- Level 1: fresh object and fresh kind.
  select id into v_object_id from public.map_objects
  where id = any(v_candidates) and not (id = any(v_recent_ids)) and not (kind = any(v_recent_kinds))
  order by power(random(), 1.0 / greatest(weight, 0.05)) desc limit 1;
  if v_object_id is not null then return v_object_id; end if;

  -- Level 2: fresh object only.
  select id into v_object_id from public.map_objects
  where id = any(v_candidates) and not (id = any(v_recent_ids))
  order by power(random(), 1.0 / greatest(weight, 0.05)) desc limit 1;
  if v_object_id is not null then return v_object_id; end if;

  -- Level 3: anything far enough from players.
  select id into v_object_id from public.map_objects
  where id = any(v_candidates)
  order by power(random(), 1.0 / greatest(weight, 0.05)) desc limit 1;
  if v_object_id is not null then return v_object_id; end if;

  -- Level 4: any object at all.
  select id into v_object_id from public.map_objects
  order by power(random(), 1.0 / greatest(weight, 0.05)) desc limit 1;
  if v_object_id is null then
    raise exception 'map_objects_empty';
  end if;
  return v_object_id;
end;
$$;
