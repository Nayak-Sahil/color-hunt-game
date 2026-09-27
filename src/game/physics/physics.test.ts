import { describe, expect, it } from 'vitest'
import { aabbFromCenter, circleOverlapsAabb, groundHeightAt, resolveMovement } from './aabb'
import { facingVector, tankStep } from './tank'
import { GRAVITY, JUMP_HEIGHT, PLAYER_FORWARD_SPEED, PLAYER_SPRINT_MULTIPLIER, PLAYER_TURN_SPEED } from '../map/constants'
import { stepJump } from './jump'

describe('circleOverlapsAabb', () => {
  const box = aabbFromCenter(0, 0, 2, 2)

  it('detects a circle touching the box edge', () => {
    expect(circleOverlapsAabb(1.3, 0, 0.5, box)).toBe(true)
  })

  it('ignores a circle clear of the box', () => {
    expect(circleOverlapsAabb(1.6, 0, 0.5, box)).toBe(false)
  })

  it('handles the diagonal corner correctly', () => {
    expect(circleOverlapsAabb(1.4, 1.4, 0.5, box)).toBe(false)
    expect(circleOverlapsAabb(1.3, 1.3, 0.5, box)).toBe(true)
  })
})

describe('resolveMovement', () => {
  const wall = aabbFromCenter(5, 0, 1, 20)

  it('moves freely when nothing is in the way', () => {
    const next = resolveMovement({ x: 0, z: 0 }, 1, 1, 0.5, [wall])
    expect(next).toEqual({ x: 1, z: 1 })
  })

  it('stops at the wall on the blocked axis but keeps sliding on the other', () => {
    const next = resolveMovement({ x: 4, z: 0 }, 1, 1, 0.5, [wall])
    expect(next.x).toBe(4)
    expect(next.z).toBe(1)
  })
})

describe('tankStep', () => {
  it('faces north at rotation zero', () => {
    const f = facingVector(0)
    expect(f.x).toBeCloseTo(0)
    expect(f.z).toBeCloseTo(-1)
  })

  it('walks forward along the facing direction', () => {
    const step = tankStep({ x: 0, z: 0, rot: 0 }, { forward: 1, turn: 0 }, 0.5)
    expect(step.dx).toBeCloseTo(0)
    expect(step.dz).toBeCloseTo(-PLAYER_FORWARD_SPEED * 0.5)
    expect(step.moving).toBe(true)
  })

  it('turning left rotates counter clockwise seen from above (north to west)', () => {
    const step = tankStep({ x: 0, z: 0, rot: 0 }, { forward: 1, turn: 1 }, (Math.PI / 2) / PLAYER_TURN_SPEED)
    expect(step.rot).toBeCloseTo(Math.PI / 2)
    expect(step.dx).toBeLessThan(0)
    expect(step.dz).toBeCloseTo(0)
  })

  it('sprints faster with the sprint flag', () => {
    const walk = tankStep({ x: 0, z: 0, rot: 0 }, { forward: 1, turn: 0 }, 0.5)
    const sprint = tankStep({ x: 0, z: 0, rot: 0 }, { forward: 1, turn: 0, sprint: true }, 0.5)
    expect(sprint.dz / walk.dz).toBeCloseTo(PLAYER_SPRINT_MULTIPLIER)
  })

  it('does not move without forward input', () => {
    const step = tankStep({ x: 3, z: 3, rot: 1 }, { forward: 0, turn: -1 }, 0.1)
    expect(step.dx).toBe(0)
    expect(step.dz).toBe(0)
    expect(step.moving).toBe(false)
  })
})

describe('low obstacles', () => {
  const car = { ...aabbFromCenter(5, 0, 2, 4.4), height: 1.36 }
  const house = aabbFromCenter(-5, 0, 8, 7)

  it('blocks a walking player but not a player above its top', () => {
    expect(resolveMovement({ x: 3.5, z: 0 }, 1, 0, 0.45, [car], 0).x).toBe(3.5)
    expect(resolveMovement({ x: 3.5, z: 0 }, 1, 0, 0.45, [car], 1.5).x).toBe(4.5)
  })

  it('never lets a player pass through a building, however high they jump', () => {
    expect(resolveMovement({ x: -0.5, z: 0 }, -1, 0, 0.45, [house], 5).x).toBe(-0.5)
  })

  it('reports the obstacle top as the ground when standing over it', () => {
    expect(groundHeightAt(5, 0, 0.3, [car, house])).toBe(1.36)
    expect(groundHeightAt(0, 0, 0.3, [car, house])).toBe(0)
  })

  it('lands on top of a low obstacle and falls off open ground again', () => {
    let state = stepJump({ y: 2, vy: -1 }, false, 0.5, 1.36)
    expect(state).toEqual({ y: 1.36, vy: 0 })
    state = stepJump(state, false, 0.05, 0)
    expect(state.y).toBeLessThan(1.36)
    expect(state.y).toBeGreaterThan(0)
  })
})

describe('stepJump', () => {
  it('stays on the ground without a jump request', () => {
    expect(stepJump({ y: 0, vy: 0 }, false, 0.016)).toEqual({ y: 0, vy: 0 })
  })

  it('reaches roughly the configured height and lands again', () => {
    let state = stepJump({ y: 0, vy: 0 }, true, 0.001)
    let peak = 0
    let steps = 0
    while ((state.y > 0 || state.vy > 0) && steps < 1000) {
      state = stepJump(state, false, 0.01)
      peak = Math.max(peak, state.y)
      steps++
    }
    expect(peak).toBeGreaterThan(JUMP_HEIGHT * 0.9)
    expect(peak).toBeLessThan(JUMP_HEIGHT * 1.1)
    expect(state.y).toBe(0)
    expect(state.vy).toBe(0)
    // Total air time should be about 2 * sqrt(2h/g).
    expect(steps * 0.01).toBeCloseTo(2 * Math.sqrt((2 * JUMP_HEIGHT) / GRAVITY), 1)
  })

  it('ignores a jump request while airborne', () => {
    const mid = { y: 0.8, vy: 2 }
    const next = stepJump(mid, true, 0.01)
    expect(next.vy).toBeLessThan(2)
  })
})
