import { COUNTDOWN_SECONDS } from '../map/constants'
import type { PlayerRow, RoundRow, SessionRow } from './types'

/** Seconds of the start countdown still left for a round, 0 once the hunt is on. */
export function countdownRemaining(round: RoundRow | null, serverOffsetMs: number, now = Date.now()): number {
  if (round === null) return 0
  const startedAt = new Date(round.started_at).getTime()
  const serverNow = now + serverOffsetMs
  const remaining = COUNTDOWN_SECONDS - (serverNow - startedAt) / 1000
  return remaining > 0 ? remaining : 0
}

/**
 * Nobody moves while the Hunter picks a color, during the start countdown,
 * or once the round is over.
 */
export function isMovementFrozen(session: SessionRow | null, round: RoundRow | null, serverOffsetMs: number, now = Date.now()): boolean {
  if (session === null) return true
  if (session.status === 'choosing_color') return true
  if (session.status === 'round_over') return true
  if (session.status === 'finished') return true
  if (session.status === 'hunting' && countdownRemaining(round, serverOffsetMs, now) > 0) return true
  return false
}

export type Compass = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

const COMPASS_NAMES: Record<Compass, string> = {
  N: 'North',
  NE: 'Northeast',
  E: 'East',
  SE: 'Southeast',
  S: 'South',
  SW: 'Southwest',
  W: 'West',
  NW: 'Northwest',
}

/** Compass direction of an offset. North is negative z, east is positive x. */
export function compassDirection(dx: number, dz: number): Compass {
  // Angle measured clockwise from north, in degrees.
  const angle = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360
  const sector = Math.round(angle / 45) % 8
  const order: Compass[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return order[sector]
}

export function compassName(direction: Compass): string {
  return COMPASS_NAMES[direction]
}

export interface Located {
  userId: string
  x: number
  z: number
}

export interface NearestResult {
  userId: string
  distance: number
  direction: Compass
}

/** Finds the nearest of the candidates to the origin, or null when there are none. */
export function nearestOf(origin: { x: number; z: number }, candidates: Located[]): NearestResult | null {
  let best: NearestResult | null = null
  for (const c of candidates) {
    const dx = c.x - origin.x
    const dz = c.z - origin.z
    const distance = Math.hypot(dx, dz)
    if (best !== null && distance >= best.distance) continue
    best = { userId: c.userId, distance, direction: compassDirection(dx, dz) }
  }
  return best
}

/** Players the hunter is allowed to track: connected, still searching, not the hunter. */
export function hunterTargets(players: PlayerRow[], hunterId: string): PlayerRow[] {
  return players.filter((p) => {
    if (p.user_id === hunterId) return false
    if (p.status !== 'searching') return false
    return true
  })
}

export interface EdgeIndicator {
  /** Pixel position on screen. */
  x: number
  y: number
  /** Direction the arrow points, in radians, 0 pointing up and increasing clockwise. */
  angle: number
}

/**
 * Projects a normalized device coordinate (x and y in -1..1, y up) of a point
 * to the screen edge when it is off screen. Returns null when it is visible.
 * `behind` is true when the point is behind the camera, which flips the NDC.
 */
export function projectToScreenEdge(
  ndcX: number,
  ndcY: number,
  behind: boolean,
  width: number,
  height: number,
  margin: number,
): EdgeIndicator | null {
  let x = ndcX
  let y = ndcY
  if (behind) {
    x = -x
    y = -y
  }

  const onScreen = !behind && Math.abs(x) <= 1 && Math.abs(y) <= 1
  if (onScreen) return null

  // Scale the direction vector so it touches the unit square boundary.
  const scale = 1 / Math.max(Math.abs(x), Math.abs(y), 1e-6)
  const ex = x * scale
  const ey = y * scale

  const halfW = width / 2 - margin
  const halfH = height / 2 - margin
  const px = width / 2 + ex * halfW
  const py = height / 2 - ey * halfH
  const angle = Math.atan2(ex, ey)
  return { x: px, y: py, angle }
}

export function formatDistance(distance: number): string {
  return `${Math.round(distance)}m`
}
