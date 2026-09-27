/**
 * Small seeded PRNG (mulberry32) so the map is identical on every client
 * and in the database seed script.
 */
export interface Rng {
  next: () => number
  range: (min: number, max: number) => number
  int: (min: number, maxInclusive: number) => number
  pick: <T>(items: readonly T[]) => T
  chance: (probability: number) => boolean
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const range = (min: number, max: number): number => min + (max - min) * next()

  const int = (min: number, maxInclusive: number): number => Math.floor(range(min, maxInclusive + 1))

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new Error('pick() called with an empty list')
    }
    return items[Math.min(items.length - 1, Math.floor(next() * items.length))]
  }

  const chance = (probability: number): boolean => next() < probability

  return { next, range, int, pick, chance }
}
