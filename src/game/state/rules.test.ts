import { describe, expect, it } from 'vitest'
import { compassDirection, countdownRemaining, hunterTargets, isMovementFrozen, nearestOf, projectToScreenEdge } from './rules'
import type { PlayerRow, RoundRow, SessionRow } from './types'

const sessionBase: SessionRow = {
  id: 's',
  code: 'ABCDEF',
  host_id: 'h',
  status: 'hunting',
  hunter_id: 'h',
  round_number: 1,
  current_round_id: 'r',
  max_players: 5,
  created_at: '',
  updated_at: '',
}

function roundStartedSecondsAgo(seconds: number, now: number): RoundRow {
  return {
    id: 'r',
    session_id: 's',
    round_number: 1,
    hunter_id: 'h',
    color_name: 'Red',
    color_hex: '#ff0000',
    hidden_object_id: 'car-1',
    started_at: new Date(now - seconds * 1000).toISOString(),
    ends_at: new Date(now + 100000).toISOString(),
    ended_at: null,
    end_reason: null,
    caught_player_id: null,
    next_hunter_id: null,
  }
}

describe('movement freeze and countdown', () => {
  const now = 1_800_000_000_000

  it('freezes everyone while the hunter is choosing and after the round', () => {
    expect(isMovementFrozen({ ...sessionBase, status: 'choosing_color' }, null, 0, now)).toBe(true)
    expect(isMovementFrozen({ ...sessionBase, status: 'round_over' }, null, 0, now)).toBe(true)
  })

  it('freezes during the countdown and releases once it ends', () => {
    expect(countdownRemaining(roundStartedSecondsAgo(1, now), 0, now)).toBeCloseTo(2)
    expect(isMovementFrozen(sessionBase, roundStartedSecondsAgo(1, now), 0, now)).toBe(true)
    expect(countdownRemaining(roundStartedSecondsAgo(4, now), 0, now)).toBe(0)
    expect(isMovementFrozen(sessionBase, roundStartedSecondsAgo(4, now), 0, now)).toBe(false)
  })

  it('uses the server clock offset', () => {
    // Local clock is 2 s behind the server: the countdown is further along than it looks.
    expect(countdownRemaining(roundStartedSecondsAgo(0, now), 2000, now)).toBeCloseTo(1)
  })
})

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
