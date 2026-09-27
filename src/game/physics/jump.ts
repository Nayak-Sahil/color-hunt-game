import { GRAVITY, JUMP_HEIGHT } from '../map/constants'

export interface JumpState {
  /** Absolute height of the feet. */
  y: number
  /** Vertical velocity, positive upward. */
  vy: number
}

const LANDING_EPSILON = 0.001

/** Grounded means resting on the surface below (open ground or the top of a low obstacle). */
export function isGrounded(state: JumpState, ground = 0): boolean {
  if (state.y > ground + LANDING_EPSILON) return false
  if (state.vy > 0) return false
  return true
}

/**
 * Advances a simple ballistic hop. A jump only starts from the ground. `ground` is the
 * height of whatever is under the player right now, so walking off a car makes them fall.
 */
export function stepJump(state: JumpState, wantJump: boolean, dt: number, ground = 0): JumpState {
  let { y, vy } = state
  const grounded = isGrounded(state, ground)

  if (grounded && !wantJump) {
    return { y: ground, vy: 0 }
  }
  if (grounded) {
    vy = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT)
  }

  vy -= GRAVITY * dt
  y += vy * dt
  if (y <= ground && vy <= 0) {
    return { y: ground, vy: 0 }
  }
  return { y, vy }
}
