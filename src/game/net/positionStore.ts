/**
 * High frequency position data lives outside React state so the render loop
 * can read and write it every frame without re-rendering the UI.
 */
export interface PositionSnapshot {
  x: number
  z: number
  /** Height above the ground while jumping. */
  y: number
  rot: number
  /** Local receive time in milliseconds. */
  t: number
  moving: boolean
}

export interface RemoteState {
  /** Latest snapshot received from the network. */
  target: PositionSnapshot
  /** Smoothed position used for rendering. */
  x: number
  z: number
  y: number
  rot: number
}

const remotes = new Map<string, RemoteState>()
const online = new Set<string>()

export const localPosition: PositionSnapshot = { x: 0, z: 0, y: 0, rot: 0, t: 0, moving: false }

// Dev only: lets automated browser tests read the local position.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __colorHuntPosition?: PositionSnapshot }).__colorHuntPosition = localPosition
}

export function setLocalPosition(x: number, z: number, y: number, rot: number, moving: boolean): void {
  localPosition.x = x
  localPosition.z = z
  localPosition.y = y
  localPosition.rot = rot
  localPosition.moving = moving
  localPosition.t = performance.now()
}

export function receiveRemotePosition(userId: string, snap: Omit<PositionSnapshot, 't'>): void {
  const existing = remotes.get(userId)
  const target: PositionSnapshot = { ...snap, t: performance.now() }
  if (existing === undefined) {
    remotes.set(userId, { target, x: snap.x, z: snap.z, y: snap.y, rot: snap.rot })
    return
  }
  existing.target = target
}

export function getRemote(userId: string): RemoteState | undefined {
  return remotes.get(userId)
}

export function getAllRemotes(): ReadonlyMap<string, RemoteState> {
  return remotes
}

export function clearRemote(userId: string): void {
  remotes.delete(userId)
}

export function setOnline(userIds: Iterable<string>): void {
  online.clear()
  for (const id of userIds) online.add(id)
}

export function isOnline(userId: string): boolean {
  return online.has(userId)
}

export function resetPositions(): void {
  remotes.clear()
  online.clear()
}

/** Returns the current world position of a player, local or remote, or null when unknown. */
export function positionOf(userId: string, localUserId: string | null): { x: number; z: number } | null {
  if (userId === localUserId) {
    return { x: localPosition.x, z: localPosition.z }
  }
  const remote = remotes.get(userId)
  if (remote === undefined) return null
  return { x: remote.x, z: remote.z }
}
