import { supabase } from './supabase'
import type { Json } from './database.types'
import type { RoundRow, SessionRow, SessionSnapshot } from '../game/state/types'

const FRIENDLY_ERRORS: Record<string, string> = {
  not_authenticated: 'Please sign in again.',
  session_not_found: 'No open session with that code.',
  game_already_started: 'That game has already started.',
  session_full: 'That session is full (5 players max).',
  only_host_can_start: 'Only the host can start the game.',
  need_at_least_two_players: 'You need at least 2 players to start.',
  not_choosing_color: 'The color has already been announced.',
  only_hunter_can_announce: 'Only the Hunter announces the color.',
  invalid_color: 'That color is not allowed.',
  round_not_active: 'No hunt is running right now.',
  not_a_member: 'You are not part of this session.',
  only_hunter_can_catch: 'Only the Hunter can catch players.',
}

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  for (const key of Object.keys(FRIENDLY_ERRORS)) {
    if (message.includes(key)) return FRIENDLY_ERRORS[key]
  }
  return message
}

function fail(error: { message: string }): never {
  throw new Error(error.message)
}

export async function createSession(): Promise<SessionRow> {
  const { data, error } = await supabase.rpc('create_session')
  if (error) fail(error)
  return data as SessionRow
}

export async function joinSession(code: string): Promise<SessionRow> {
  const { data, error } = await supabase.rpc('join_session', { p_code: code })
  if (error) fail(error)
  return data as SessionRow
}

export async function leaveSession(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_session', { p_session_id: sessionId })
  if (error) fail(error)
}

export async function startGame(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('start_game', { p_session_id: sessionId })
  if (error) fail(error)
}

export interface PlayerPosition {
  x: number
  z: number
}

export async function announceColor(
  sessionId: string,
  colorName: string,
  colorHex: string,
  positions: PlayerPosition[],
): Promise<RoundRow> {
  const { data, error } = await supabase.rpc('announce_color', {
    p_session_id: sessionId,
    p_color_name: colorName,
    p_color_hex: colorHex,
    p_positions: positions as unknown as Json,
  })
  if (error) fail(error)
  return data as RoundRow
}

export interface ClaimResult {
  ok: boolean
  reason?: string
  all_safe?: boolean
}

export async function claimSafe(sessionId: string, objectId: string): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc('claim_safe', { p_session_id: sessionId, p_object_id: objectId })
  if (error) fail(error)
  return data as unknown as ClaimResult
}

export async function catchPlayer(sessionId: string, targetId: string): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc('catch_player', { p_session_id: sessionId, p_target_id: targetId })
  if (error) fail(error)
  return data as unknown as ClaimResult
}

export async function expireRound(sessionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('expire_round', { p_session_id: sessionId })
  if (error) fail(error)
  return data === true
}

export async function nextRound(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('next_round', { p_session_id: sessionId })
  if (error) fail(error)
}

export async function heartbeat(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('heartbeat', { p_session_id: sessionId })
  if (error) fail(error)
}

export async function markStalePlayers(sessionId: string): Promise<number> {
  const { data, error } = await supabase.rpc('mark_stale_players', { p_session_id: sessionId })
  if (error) fail(error)
  return data ?? 0
}

export async function getSessionSnapshot(sessionId: string): Promise<SessionSnapshot> {
  const { data, error } = await supabase.rpc('get_session_snapshot', { p_session_id: sessionId })
  if (error) fail(error)
  return data as unknown as SessionSnapshot
}
