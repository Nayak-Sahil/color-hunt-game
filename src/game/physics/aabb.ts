import type { Aabb, Rect } from '../map/types'

/** A player can step onto an obstacle whose top is at most this far above their feet. */
export const STEP_TOLERANCE = 0.35

export function rectToAabb(rect: Rect): Aabb {
  return {
    minX: rect.x - rect.w / 2,
    maxX: rect.x + rect.w / 2,
    minZ: rect.z - rect.d / 2,
    maxZ: rect.z + rect.d / 2,
  }
}

export function aabbFromCenter(x: number, z: number, w: number, d: number): Aabb {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }
}

export function pointInAabb(x: number, z: number, box: Aabb): boolean {
  if (x < box.minX) return false
  if (x > box.maxX) return false
  if (z < box.minZ) return false
  if (z > box.maxZ) return false
  return true
}

/** True when a circle of the given radius overlaps the box footprint. */
export function circleOverlapsAabb(x: number, z: number, radius: number, box: Aabb): boolean {
  const closestX = Math.min(Math.max(x, box.minX), box.maxX)
  const closestZ = Math.min(Math.max(z, box.minZ), box.maxZ)
  const dx = x - closestX
  const dz = z - closestZ
  return dx * dx + dz * dz < radius * radius
}

/** An obstacle blocks a player whose feet are below its top (minus a small step). */
export function blocksAtHeight(box: Aabb, feetY: number): boolean {
  if (box.height === undefined) return true
  return box.height > feetY + STEP_TOLERANCE
}

export function circleOverlapsAny(x: number, z: number, radius: number, boxes: readonly Aabb[], feetY = 0): boolean {
  for (const box of boxes) {
    if (!blocksAtHeight(box, feetY)) continue
    if (circleOverlapsAabb(x, z, radius, box)) return true
  }
  return false
}

export interface Position {
  x: number
  z: number
}

/**
 * Moves a circle by (dx, dz) against static boxes, resolving each axis separately
 * so the player slides along walls instead of sticking to them. Obstacles lower
 * than the player's feet (while jumping or standing on something) are ignored.
 */
export function resolveMovement(
  from: Position,
  dx: number,
  dz: number,
  radius: number,
  colliders: readonly Aabb[],
  feetY = 0,
): Position {
  let x = from.x
  let z = from.z

  const candidateX = x + dx
  if (!circleOverlapsAny(candidateX, z, radius, colliders, feetY)) {
    x = candidateX
  }

  const candidateZ = z + dz
  if (!circleOverlapsAny(x, candidateZ, radius, colliders, feetY)) {
    z = candidateZ
  }

  return { x, z }
}

/** Height of the highest low obstacle under the player, or 0 for open ground. */
export function groundHeightAt(x: number, z: number, radius: number, boxes: readonly Aabb[]): number {
  let ground = 0
  for (const box of boxes) {
    if (box.height === undefined) continue
    if (box.height <= ground) continue
    if (!circleOverlapsAabb(x, z, radius, box)) continue
    ground = box.height
  }
  return ground
}

export function distance2d(a: Position, b: Position): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}
