import { describe, expect, it } from 'vitest'
import { compassDirection, hunterTargets, nearestOf, projectToScreenEdge } from './rules'
import type { PlayerRow } from './types'

describe('compassDirection', () => {
  it('treats negative z as north and positive x as east', () => {
    expect(compassDirection(0, -1)).toBe('N')
    expect(compassDirection(1, 0)).toBe('E')
    expect(compassDirection(0, 1)).toBe('S')
    expect(compassDirection(-1, 0)).toBe('W')
  })

  it('resolves diagonals', () => {
    expect(compassDirection(1, -1)).toBe('NE')
    expect(compassDirection(-1, 1)).toBe('SW')
  })
})

describe('nearestOf', () => {
  it('returns the closest candidate with distance and direction', () => {
    const result = nearestOf({ x: 0, z: 0 }, [
      { userId: 'far', x: 30, z: 0 },
      { userId: 'near', x: 0, z: -5 },
    ])
    expect(result?.userId).toBe('near')
    expect(result?.distance).toBeCloseTo(5)
    expect(result?.direction).toBe('N')
  })

  it('returns null with no candidates', () => {
    expect(nearestOf({ x: 0, z: 0 }, [])).toBeNull()
  })
})

describe('hunterTargets', () => {
  const base: Omit<PlayerRow, 'user_id' | 'status'> = {
    session_id: 's',
    display_name: 'x',
    color_index: 0,
    last_seen_at: '',
    joined_at: '',
  }
  const players: PlayerRow[] = [
    { ...base, user_id: 'h', status: 'hunter' },
    { ...base, user_id: 'a', status: 'searching' },
    { ...base, user_id: 'b', status: 'safe' },
    { ...base, user_id: 'c', status: 'left' },
  ]

  it('only includes searching players other than the hunter', () => {
    expect(hunterTargets(players, 'h').map((p) => p.user_id)).toEqual(['a'])
  })
})

describe('projectToScreenEdge', () => {
  it('returns null for points inside the view', () => {
    expect(projectToScreenEdge(0.2, -0.3, false, 800, 600, 20)).toBeNull()
  })

  it('pins a point above the view to the top edge pointing up', () => {
    const r = projectToScreenEdge(0, 3, false, 800, 600, 20)
    expect(r).not.toBeNull()
    expect(r?.x).toBeCloseTo(400)
    expect(r?.y).toBeCloseTo(20)
    expect(r?.angle).toBeCloseTo(0)
  })

  it('pins a point to the right of the view to the right edge pointing right', () => {
    const r = projectToScreenEdge(4, 0, false, 800, 600, 20)
    expect(r?.x).toBeCloseTo(780)
    expect(r?.y).toBeCloseTo(300)
    expect(r?.angle).toBeCloseTo(Math.PI / 2)
  })

  it('flips points that are behind the camera', () => {
    const r = projectToScreenEdge(0, 0.5, true, 800, 600, 20)
    expect(r?.y).toBeCloseTo(580)
  })
})
