-- Game RPCs are for signed in players only. Default grants to PUBLIC are removed.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_session()',
    'public.join_session(text)',
    'public.leave_session(uuid)',
    'public.start_game(uuid)',
    'public.announce_color(uuid, text, text, jsonb)',
    'public.claim_safe(uuid, text)',
    'public.catch_player(uuid, uuid)',
    'public.expire_round(uuid)',
    'public.next_round(uuid)',
    'public.heartbeat(uuid)',
    'public.mark_stale_players(uuid)',
    'public.get_session_snapshot(uuid)',
    'public.is_session_member(uuid)',
    'public.session_id_from_topic(text)',
    'public.require_user()'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end;
$$;
revoke execute on function public.active_player_count(uuid) from public, anon, authenticated;
