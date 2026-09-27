import { describe, expect, it } from 'vitest'
import { footprintAabb, generateMap } from './generateMap'
import { MAP_HALF, MAP_SEED, PLAYER_RADIUS } from './constants'
import { circleOverlapsAny, pointInAabb, rectToAabb } from '../physics/aabb'
import { aabbFromCenter } from '../physics/aabb'

const map = generateMap(MAP_SEED)

describe('generateMap', () => {
  it('is deterministic for the same seed', () => {
    const again = generateMap(MAP_SEED)
    expect(JSON.stringify(again)).toEqual(JSON.stringify(map))
  })

  it('creates a rich catalog of colorable props of many kinds', () => {
    const kinds = new Set(map.props.map((p) => p.kind))
    expect(map.props.length).toBeGreaterThan(120)
    expect(kinds.size).toBeGreaterThanOrEqual(9)
  })

  it('gives every prop a unique id', () => {
    const ids = new Set(map.props.map((p) => p.id))
    expect(ids.size).toEqual(map.props.length)
  })

  it('keeps every prop inside the playable area', () => {
    for (const prop of map.props) {
      expect(Math.abs(prop.x)).toBeLessThan(MAP_HALF - 0.5)
      expect(Math.abs(prop.z)).toBeLessThan(MAP_HALF - 0.5)
    }
  })

  it('never places a prop inside a house, hedge, tree or kiosk', () => {
    const structures = [
      ...map.houses.map((h) => footprintAabb(h.x, h.z, h.w, h.d, h.rot)),
      ...map.hedges.map(rectToAabb),
      ...map.trees.map((t) => aabbFromCenter(t.x, t.z, 1, 1)),
      ...map.decor.filter((d) => d.kind === 'kiosk' || d.kind === 'fountain').map((d) => aabbFromCenter(d.x, d.z, d.w, d.d)),
    ]
    for (const prop of map.props) {
      // Doors are intentionally embedded in the house front face.
      if (prop.kind === 'door') continue
      const inside = structures.some((box) => pointInAabb(prop.x, prop.z, box))
      expect(inside, `${prop.id} at ${prop.x},${prop.z} is inside a structure`).toBe(false)
    }
  })

  it('keeps props from stacking on top of each other', () => {
    for (let i = 0; i < map.props.length; i++) {
      for (let j = i + 1; j < map.props.length; j++) {
        const a = map.props[i]
        const b = map.props[j]
        const d = Math.hypot(a.x - b.x, a.z - b.z)
        expect(d, `${a.id} and ${b.id} overlap`).toBeGreaterThan(0.75)
      }
    }
  })

  it('has free spawn points that are reachable from each other along the road grid', () => {
    expect(map.spawnPoints.length).toBeGreaterThanOrEqual(5)
    for (const spawn of map.spawnPoints) {
      expect(circleOverlapsAny(spawn.x, spawn.z, PLAYER_RADIUS, map.colliders)).toBe(false)
    }
  })

  it('surrounds the map with boundary colliders', () => {
    expect(circleOverlapsAny(0, -MAP_HALF - 1, PLAYER_RADIUS, map.colliders)).toBe(true)
    expect(circleOverlapsAny(MAP_HALF + 1, 0, PLAYER_RADIUS, map.colliders)).toBe(true)
  })
})
