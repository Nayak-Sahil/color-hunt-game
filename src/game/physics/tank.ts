import {
  PLAYER_BACKWARD_SPEED,
  PLAYER_FORWARD_SPEED,
  PLAYER_JUMP_BOOST,
  PLAYER_SPRINT_MULTIPLIER,
  PLAYER_TURN_SPEED,
} from '../map/constants'

export interface TankInput {
  /** 1 forward, -1 backward, 0 idle. */
  forward: -1 | 0 | 1
  /** 1 turn left (counter clockwise seen from above), -1 turn right, 0 idle. */
  turn: -1 | 0 | 1
  /** Alt held: move faster. */
  sprint?: boolean
  /** In the air after a jump: small horizontal boost. */
  airborne?: boolean
}

export interface TankState {
  x: number
  z: number
  /** Rotation around Y, matching three.js Object3D.rotation.y. 0 faces north (negative z). */
  rot: number
}

export interface TankStep {
  rot: number
  dx: number
  dz: number
  moving: boolean
}

/** Facing vector for a rotation, using the three.js convention for rotation.y. */
export function facingVector(rot: number): { x: number; z: number } {
  return { x: -Math.sin(rot), z: -Math.cos(rot) }
}

/** Computes the desired displacement for one frame. Collision is resolved separately. */
export function tankStep(state: TankState, input: TankInput, dt: number): TankStep {
  const rot = normalizeAngle(state.rot + input.turn * PLAYER_TURN_SPEED * dt)

  if (input.forward === 0) {
    return { rot, dx: 0, dz: 0, moving: false }
  }

  let speed = input.forward > 0 ? PLAYER_FORWARD_SPEED : PLAYER_BACKWARD_SPEED
  if (input.sprint === true) speed *= PLAYER_SPRINT_MULTIPLIER
  if (input.airborne === true) speed *= PLAYER_JUMP_BOOST
  const facing = facingVector(rot)
  const distance = speed * dt * input.forward
  return { rot, dx: facing.x * distance, dz: facing.z * distance, moving: true }
}

export function normalizeAngle(angle: number): number {
  let a = angle
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}
