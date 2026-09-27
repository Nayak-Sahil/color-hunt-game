-- Heartbeats only touch last_seen_at; they should not make every client refetch the snapshot.
create or replace function public.broadcast_game_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
begin
  if tg_table_name = 'session_players' and tg_op = 'UPDATE' then
    if new.status = old.status and new.color_index = old.color_index and new.display_name = old.display_name then
      -- Only the heartbeat column changed.
      return null;
    end if;
  end if;

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
