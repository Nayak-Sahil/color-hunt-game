export type SessionStatus = 'lobby' | 'choosing_color' | 'hunting' | 'round_over' | 'finished'
export type PlayerStatus = 'waiting' | 'searching' | 'safe' | 'hunter' | 'eliminated' | 'left'
export type RoundEndReason = 'caught' | 'all_safe' | 'timeout' | 'hunter_left'

export interface SessionRow {
  id: string
  code: string
  host_id: string
  status: SessionStatus
  hunter_id: string | null
  round_number: number
  current_round_id: string | null
  max_players: number
  created_at: string
  updated_at: string
}

export interface PlayerRow {
  session_id: string
  user_id: string
  display_name: string
  color_index: number
  status: PlayerStatus
  last_seen_at: string
  joined_at: string
}

export interface RoundRow {
  id: string
  session_id: string
  round_number: number
  hunter_id: string
  color_name: string
  color_hex: string
  hidden_object_id: string
  started_at: string
  ends_at: string
  ended_at: string | null
  end_reason: RoundEndReason | null
  caught_player_id: string | null
  next_hunter_id: string | null
}

export interface SessionSnapshot {
  session: SessionRow
  players: PlayerRow[]
  round: RoundRow | null
  server_time: string
}

export interface AnnounceColor {
  name: string
  hex: string
}

/** Colors the hunter can announce. Vivid so they stand out against the muted city. */
export const ANNOUNCE_COLORS: AnnounceColor[] = [
  { name: 'Red', hex: '#e53935' },
  { name: 'Blue', hex: '#1e88e5' },
  { name: 'Green', hex: '#43a047' },
  { name: 'Yellow', hex: '#fdd835' },
  { name: 'Orange', hex: '#fb8c00' },
  { name: 'Purple', hex: '#8e24aa' },
  { name: 'Pink', hex: '#ec407a' },
  { name: 'Cyan', hex: '#00acc1' },
]

/** Body colors for the five player slots. */
export const PLAYER_COLORS = ['#ff7043', '#42a5f5', '#9ccc65', '#ffca28', '#ba68c8']

export function playerColor(colorIndex: number): string {
  return PLAYER_COLORS[((colorIndex % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length]
}
