import { BLOCK_SIZE, GRID, MAP_HALF, MAP_SEED, MAP_SIZE, PLAYER_RADIUS, ROAD_WIDTH, blockOrigin, roadCenter } from './constants'
import { createRng, type Rng } from './random'
import type {
  Aabb,
  BlockInfo,
  BlockType,
  DecorSpec,
  HouseSpec,
  MapData,
  PropKind,
  PropSpec,
  Rect,
  SpawnPoint,
  TreeSpec,
} from './types'
import { aabbFromCenter, circleOverlapsAny, rectToAabb } from '../physics/aabb'

const WALL_COLORS = ['#e7e0d3', '#d9d2c5', '#cfd6dc', '#e3d5c2', '#d8dcd0', '#e0d9cc']
const ROOF_COLORS = ['#6b5b53', '#5a5f66', '#7a6a5c', '#4f5d6b', '#66605a']
const TREE_SHADES = ['#3f7a48', '#4a8a4f', '#35703f', '#47804a']

const BLOCK_LAYOUT: BlockType[][] = [
  ['houses', 'houses', 'park', 'houses'],
  ['alley-ns', 'plaza', 'houses', 'dead-end-w'],
  ['houses', 'alley-ew', 'houses', 'dead-end-s'],
  ['dead-end-n', 'houses', 'houses', 'park'],
]

/** Footprint (w along x, d along z at rot 0) for props that block movement. */
const PROP_FOOTPRINT: Record<PropKind, { w: number; d: number } | null> = {
  car: { w: 2.0, d: 4.4 },
  bench: { w: 1.8, d: 0.6 },
  mailbox: { w: 0.4, d: 0.4 },
  hydrant: { w: 0.5, d: 0.5 },
  trashcan: { w: 0.7, d: 0.7 },
  sign: { w: 0.3, d: 0.3 },
  flowerpot: { w: 0.8, d: 0.8 },
  door: null,
  busstop: { w: 3.5, d: 1.2 },
  planter: { w: 2.2, d: 2.2 },
}

const PROP_WEIGHT: Record<PropKind, number> = {
  car: 0.8,
  bench: 1.0,
  mailbox: 0.5,
  hydrant: 1.0,
  trashcan: 1.0,
  sign: 0.9,
  flowerpot: 1.0,
  door: 0.5,
  busstop: 0.7,
  planter: 0.8,
}

/** Top height of each prop, so players can jump onto and over the small ones. */
const PROP_HEIGHT: Record<PropKind, number | undefined> = {
  car: 1.36,
  bench: 1.0,
  mailbox: 1.32,
  hydrant: 0.95,
  trashcan: 0.92,
  sign: 2.3,
  flowerpot: 1.0,
  door: undefined,
  busstop: 2.5,
  planter: 1.1,
}

const HEDGE_HEIGHT = 1.2
const FOUNTAIN_HEIGHT = 0.62

const PROP_VARIANTS: Record<PropKind, number> = {
  car: 5,
  bench: 2,
  mailbox: 2,
  hydrant: 1,
  trashcan: 2,
  sign: 3,
  flowerpot: 2,
  door: 3,
  busstop: 1,
  planter: 2,
}

export function propFootprint(kind: PropKind): { w: number; d: number } | null {
  return PROP_FOOTPRINT[kind]
}

interface Builder {
  rng: Rng
  roads: Rect[]
  blocks: BlockInfo[]
  houses: HouseSpec[]
  trees: TreeSpec[]
  hedges: Rect[]
  props: PropSpec[]
  decor: DecorSpec[]
  colliders: Aabb[]
  spawnPoints: SpawnPoint[]
  counters: Map<string, number>
}

let cachedMap: MapData | null = null

/** Returns the shared, deterministic map. Safe to call many times. */
export function getMap(): MapData {
  if (cachedMap === null) {
    cachedMap = generateMap(MAP_SEED)
  }
  return cachedMap
}

export function generateMap(seed: number): MapData {
  const b: Builder = {
    rng: createRng(seed),
    roads: [],
    blocks: [],
    houses: [],
    trees: [],
    hedges: [],
    props: [],
    decor: [],
    colliders: [],
    spawnPoints: [],
    counters: new Map(),
  }

  buildRoads(b)
  buildBlocks(b)
  buildStreetFurniture(b)
  buildParkedCars(b)
  buildBoundary(b)
  buildSpawnPoints(b)

  return {
    size: MAP_SIZE,
    half: MAP_HALF,
    roads: b.roads,
    blocks: b.blocks,
    houses: b.houses,
    trees: b.trees,
    hedges: b.hedges,
    props: b.props,
    decor: b.decor,
    colliders: b.colliders,
    spawnPoints: b.spawnPoints,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextId(b: Builder, kind: string): string {
  const count = (b.counters.get(kind) ?? 0) + 1
  b.counters.set(kind, count)
  return `${kind}-${count}`
}

function isRightAngle(rot: number): boolean {
  const quarter = Math.abs(((rot % Math.PI) + Math.PI) % Math.PI)
  return Math.abs(quarter - Math.PI / 2) < 0.01
}

export function footprintAabb(x: number, z: number, w: number, d: number, rot: number): Aabb {
  if (isRightAngle(rot)) {
    return aabbFromCenter(x, z, d, w)
  }
  return aabbFromCenter(x, z, w, d)
}

function addProp(b: Builder, kind: PropKind, x: number, z: number, rot: number): PropSpec {
  const prop: PropSpec = {
    id: nextId(b, kind),
    kind,
    x: round2(x),
    z: round2(z),
    rot: round2(rot),
    weight: PROP_WEIGHT[kind],
    variant: b.rng.int(0, PROP_VARIANTS[kind] - 1),
  }
  b.props.push(prop)
  const footprint = PROP_FOOTPRINT[kind]
  if (footprint !== null) {
    b.colliders.push({ ...footprintAabb(prop.x, prop.z, footprint.w, footprint.d, prop.rot), height: PROP_HEIGHT[kind] })
  }
  return prop
}

function addHouse(b: Builder, x: number, z: number, rot: number): HouseSpec {
  const w = b.rng.range(7.5, 9)
  const d = b.rng.range(6.5, 7.5)
  const h = b.rng.chance(0.35) ? b.rng.range(5.6, 6.4) : b.rng.range(3.6, 4.2)
  const house: HouseSpec = {
    id: nextId(b, 'house'),
    x: round2(x),
    z: round2(z),
    w: round2(w),
    d: round2(d),
    h: round2(h),
    rot,
    wallColor: b.rng.pick(WALL_COLORS),
    roofColor: b.rng.pick(ROOF_COLORS),
  }
  b.houses.push(house)
  b.colliders.push(footprintAabb(house.x, house.z, house.w, house.d, house.rot))

  // The door sits on the front face. At rot 0 the front is the north face (negative z).
  const front = rotateOffset(w * 0.2, -d / 2, rot)
  addProp(b, 'door', house.x + front.x, house.z + front.z, rot)
  return house
}

function addTree(b: Builder, x: number, z: number): void {
  const tree: TreeSpec = {
    x: round2(x),
    z: round2(z),
    radius: round2(b.rng.range(1.4, 2.2)),
    height: round2(b.rng.range(3.5, 5.5)),
    shade: b.rng.pick(TREE_SHADES),
  }
  b.trees.push(tree)
  b.colliders.push(aabbFromCenter(tree.x, tree.z, 1.0, 1.0))
}

function addHedge(b: Builder, x: number, z: number, w: number, d: number): void {
  const hedge: Rect = { x: round2(x), z: round2(z), w: round2(w), d: round2(d) }
  b.hedges.push(hedge)
  b.colliders.push({ ...rectToAabb(hedge), height: HEDGE_HEIGHT })
}

function addDecor(b: Builder, kind: DecorSpec['kind'], x: number, z: number, w: number, d: number, rot = 0): void {
  b.decor.push({ kind, x: round2(x), z: round2(z), w: round2(w), d: round2(d), rot })
}

function addLamppost(b: Builder, x: number, z: number): void {
  addDecor(b, 'lamppost', x, z, 0.35, 0.35)
  b.colliders.push(aabbFromCenter(x, z, 0.35, 0.35))
}

/** Rotates an offset (ox, oz) by rot using the three.js rotation.y convention. */
function rotateOffset(ox: number, oz: number, rot: number): { x: number; z: number } {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return { x: ox * c + oz * s, z: -ox * s + oz * c }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// ---------------------------------------------------------------------------
// Roads
// ---------------------------------------------------------------------------

function buildRoads(b: Builder): void {
  for (let k = 0; k <= GRID; k++) {
    const c = roadCenter(k)
    b.roads.push({ x: 0, z: c, w: MAP_SIZE, d: ROAD_WIDTH })
    b.roads.push({ x: c, z: 0, w: ROAD_WIDTH, d: MAP_SIZE })
  }

  // Crosswalks on the inner intersections add visual rhythm to the roads.
  for (let i = 1; i < GRID; i++) {
    for (let j = 1; j < GRID; j++) {
      const cx = roadCenter(i)
      const cz = roadCenter(j)
      const off = ROAD_WIDTH / 2 + 1
      addDecor(b, 'crosswalk', cx, cz - off, ROAD_WIDTH - 1, 1.6)
      addDecor(b, 'crosswalk', cx, cz + off, ROAD_WIDTH - 1, 1.6)
      addDecor(b, 'crosswalk', cx - off, cz, 1.6, ROAD_WIDTH - 1)
      addDecor(b, 'crosswalk', cx + off, cz, 1.6, ROAD_WIDTH - 1)
    }
  }
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

function buildBlocks(b: Builder): void {
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const type = BLOCK_LAYOUT[j][i]
      const x0 = blockOrigin(i)
      const z0 = blockOrigin(j)
      const rect: Rect = { x: x0 + BLOCK_SIZE / 2, z: z0 + BLOCK_SIZE / 2, w: BLOCK_SIZE, d: BLOCK_SIZE }
      b.blocks.push({ rect, type })
      buildBlock(b, type, rect)
    }
  }
}

function buildBlock(b: Builder, type: BlockType, rect: Rect): void {
  if (type === 'houses') {
    buildHouseBlock(b, rect, 'none')
    return
  }
  if (type === 'alley-ns') {
    buildHouseBlock(b, rect, 'ns')
    return
  }
  if (type === 'alley-ew') {
    buildHouseBlock(b, rect, 'ew')
    return
  }
  if (type === 'park') {
    buildPark(b, rect)
    return
  }
  if (type === 'plaza') {
    buildPlaza(b, rect)
    return
  }
  if (type === 'dead-end-w') {
    buildDeadEnd(b, rect, 0)
    return
  }
  if (type === 'dead-end-n') {
    buildDeadEnd(b, rect, Math.PI / 2)
    return
  }
  buildDeadEnd(b, rect, -Math.PI / 2)
}

type AlleyMode = 'none' | 'ns' | 'ew'

function buildHouseBlock(b: Builder, rect: Rect, alley: AlleyMode): void {
  const cx = rect.x
  const cz = rect.z
  const lot = BLOCK_SIZE / 2
  const quarter = lot / 2

  // Lots are addressed by their sign relative to the block center.
  const lots: Array<{ sx: number; sz: number }> = [
    { sx: -1, sz: -1 },
    { sx: 1, sz: -1 },
    { sx: -1, sz: 1 },
    { sx: 1, sz: 1 },
  ]

  for (const { sx, sz } of lots) {
    const lotX = cx + sx * quarter
    const lotZ = cz + sz * quarter

    // Push houses slightly away from an alley so the strip stays walkable,
    // while keeping the front face well inside the block for the mailbox.
    const alleyShiftX = alley === 'ns' ? sx * 1.5 : 0
    const alleyShiftZ = alley === 'ew' ? sz * 0.8 : 0
    const frontShift = alley === 'ew' ? 0.8 : 1.5

    // Houses face the nearest east-west road, so the north lots face north.
    const rot = sz < 0 ? 0 : Math.PI
    const houseX = lotX + alleyShiftX + b.rng.range(-0.6, 0.6)
    const houseZ = lotZ + alleyShiftZ + sz * frontShift
    const house = addHouse(b, houseX, houseZ, rot)

    // Mailbox near the road edge in front of the house.
    const frontEdgeZ = cz + sz * (lot - 1.2)
    addProp(b, 'mailbox', house.x - sx * 3.2, frontEdgeZ, rot)

    // A tree in the back corner of each lot, and sometimes a flower pot by the door.
    const backZ = cz + sz * b.rng.range(2.5, 4.5)
    const treeX = lotX + sx * b.rng.range(3.5, 5.5)
    addTree(b, treeX, backZ)

    if (b.rng.chance(0.4)) {
      const potOffset = rotateOffset(-house.w * 0.3, -house.d / 2 - 0.9, rot)
      addProp(b, 'flowerpot', house.x + potOffset.x, house.z + potOffset.z, 0)
    }
  }

  const inset = 3
  const gap = 3.6
  const span = BLOCK_SIZE - inset * 2

  if (alley === 'none') {
    // Cross hedges with a gap in the middle create shortcuts through the block.
    const half = (span - gap) / 2
    addHedge(b, cx, cz - gap / 2 - half / 2, 0.8, half)
    addHedge(b, cx, cz + gap / 2 + half / 2, 0.8, half)
    addHedge(b, cx - gap / 2 - half / 2, cz, half, 0.8)
    addHedge(b, cx + gap / 2 + half / 2, cz, half, 0.8)
    return
  }

  const alleyWidth = 4.4
  if (alley === 'ns') {
    addDecor(b, 'alley', cx, cz, alleyWidth, BLOCK_SIZE)
    for (const side of [-1, 1]) {
      const hx = cx + side * (alleyWidth / 2 + 0.4)
      const segment = (span - gap) / 2
      addHedge(b, hx, cz - gap / 2 - segment / 2, 0.8, segment)
      addHedge(b, hx, cz + gap / 2 + segment / 2, 0.8, segment)
    }
    return
  }

  addDecor(b, 'alley', cx, cz, BLOCK_SIZE, alleyWidth)
  for (const side of [-1, 1]) {
    const hz = cz + side * (alleyWidth / 2 + 0.4)
    const segment = (span - gap) / 2
    addHedge(b, cx - gap / 2 - segment / 2, hz, segment, 0.8)
    addHedge(b, cx + gap / 2 + segment / 2, hz, segment, 0.8)
  }
}

/**
 * A pocket of four houses around a lane that enters from one side and stops.
 * Built in local coordinates where the lane enters from the west, then rotated.
 */
function buildDeadEnd(b: Builder, rect: Rect, angle: number): void {
  const cx = rect.x
  const cz = rect.z
  const toWorld = (lx: number, lz: number): { x: number; z: number } => {
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    return { x: cx + lx * c - lz * s, z: cz + lx * s + lz * c }
  }
  const worldRot = (localRot: number): number => localRot - angle
  const swap = isRightAngle(angle)

  const laneLength = 21
  const laneWidth = 6
  const laneStartX = -BLOCK_SIZE / 2
  const laneCenterX = laneStartX + laneLength / 2

  const laneCenter = toWorld(laneCenterX, 0)
  addDecor(b, 'lane', laneCenter.x, laneCenter.z, swap ? laneWidth : laneLength, swap ? laneLength : laneWidth)

  // Two houses on each side of the lane, facing the lane.
  for (const side of [-1, 1]) {
    for (const slot of [0, 1]) {
      const lx = laneStartX + 6 + slot * 9.5 + b.rng.range(-0.4, 0.4)
      const lz = side * (laneWidth / 2 + 5.5)
      const p = toWorld(lx, lz)
      // Local rot 0 faces north (negative local z), so the south houses use 0.
      const localRot = side > 0 ? 0 : Math.PI
      addHouse(b, p.x, p.z, worldRot(localRot))

      const mb = toWorld(lx - 3, side * (laneWidth / 2 + 1))
      addProp(b, 'mailbox', mb.x, mb.z, worldRot(localRot))
    }
  }

  // Enclosing hedges: along both long edges (inset so corner furniture stays
  // outside) and across the far end, so the only way out is back down the lane.
  const edgeLen = laneLength + 0.5
  const hedgeInset = 1.9
  for (const side of [-1, 1]) {
    const p = toWorld(laneStartX + edgeLen / 2, side * (BLOCK_SIZE / 2 - hedgeInset))
    addHedge(b, p.x, p.z, swap ? 0.8 : edgeLen, swap ? edgeLen : 0.8)
  }
  const endX = laneStartX + edgeLen
  const end = toWorld(endX, 0)
  const endLen = BLOCK_SIZE - hedgeInset * 2 + 0.8
  addHedge(b, end.x, end.z, swap ? endLen : 0.8, swap ? 0.8 : endLen)

  // The far strip behind the hedge gets a house facing the outer road and trees.
  const outerX = BLOCK_SIZE / 2 - 4.0
  const outer = toWorld(outerX, 0)
  addHouse(b, outer.x, outer.z, worldRot(-Math.PI / 2))
  for (const lz of [-11, 11]) {
    const t = toWorld(outerX + b.rng.range(-1, 1), lz)
    addTree(b, t.x, t.z)
  }

  // Street furniture inside the pocket: hydrant at the lane end, trash cans.
  const hydrant = toWorld(endX - 1.5, laneWidth / 2 + 0.8)
  addProp(b, 'hydrant', hydrant.x, hydrant.z, 0)
  const can = toWorld(laneStartX + 8, -(laneWidth / 2 + 0.9))
  addProp(b, 'trashcan', can.x, can.z, 0)
  const sign = toWorld(laneStartX + 1.2, laneWidth / 2 + 0.9)
  addProp(b, 'sign', sign.x, sign.z, worldRot(0))
}

function buildPark(b: Builder, rect: Rect): void {
  const cx = rect.x
  const cz = rect.z
  const half = BLOCK_SIZE / 2

  // Fountain in the middle with benches facing it.
  addDecor(b, 'fountain', cx, cz, 6, 6)
  b.colliders.push({ ...aabbFromCenter(cx, cz, 5.6, 5.6), height: FOUNTAIN_HEIGHT })
  addDecor(b, 'path', cx, cz, BLOCK_SIZE - 4, 3)
  addDecor(b, 'path', cx, cz, 3, BLOCK_SIZE - 4)

  const benchDistance = 6
  addProp(b, 'bench', cx, cz - benchDistance, Math.PI)
  addProp(b, 'bench', cx, cz + benchDistance, 0)
  addProp(b, 'bench', cx - benchDistance, cz, -Math.PI / 2)
  addProp(b, 'bench', cx + benchDistance, cz, Math.PI / 2)

  // Ring of trees with a gap in the middle of each side for entrances.
  const inset = 2.6
  const step = 4.2
  for (let t = -half + inset; t <= half - inset + 0.01; t += step) {
    if (Math.abs(t) < 3.5) continue
    addTree(b, cx + t, cz - half + inset)
    addTree(b, cx + t, cz + half - inset)
    addTree(b, cx - half + inset, cz + t)
    addTree(b, cx + half - inset, cz + t)
  }

  // Scattered inner trees away from paths and the fountain.
  let placed = 0
  let attempts = 0
  while (placed < 6 && attempts < 60) {
    attempts++
    const x = cx + b.rng.range(-half + 6, half - 6)
    const z = cz + b.rng.range(-half + 6, half - 6)
    if (Math.abs(x - cx) < 3) continue
    if (Math.abs(z - cz) < 3) continue
    if (Math.hypot(x - cx, z - cz) < 8.5) continue
    if (circleOverlapsAny(x, z, 2.2, b.colliders)) continue
    addTree(b, x, z)
    placed++
  }

  // Lamp posts on the diagonals, flower pots at entrances, trash cans by paths.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addLamppost(b, cx + sx * 7.5, cz + sz * 7.5)
    }
  }
  addProp(b, 'flowerpot', cx - 2.4, cz - half + 1.6, 0)
  addProp(b, 'flowerpot', cx + 2.4, cz + half - 1.6, 0)
  addProp(b, 'flowerpot', cx - half + 1.6, cz + 2.4, 0)
  addProp(b, 'flowerpot', cx + half - 1.6, cz - 2.4, 0)
  addProp(b, 'trashcan', cx + 2.4, cz - 10.5, 0)
  addProp(b, 'trashcan', cx - 2.4, cz + 10.5, 0)
  addProp(b, 'sign', cx - 2.2, cz - half + 3.4, 0)
}

function buildPlaza(b: Builder, rect: Rect): void {
  const cx = rect.x
  const cz = rect.z
  const half = BLOCK_SIZE / 2

  addDecor(b, 'path', cx, cz, BLOCK_SIZE, BLOCK_SIZE)

  // Kiosk (blocking) offset from the center, bus stop by the south edge.
  addDecor(b, 'kiosk', cx - 6, cz - 4, 5, 3.5)
  b.colliders.push(aabbFromCenter(cx - 6, cz - 4, 5, 3.5))
  addProp(b, 'busstop', cx + 4, cz + half - 1.4, 0)

  // Planters at the four inner corners with benches beside them.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = cx + sx * 8.5
      const pz = cz + sz * 8.5
      addProp(b, 'planter', px, pz, 0)
      addProp(b, 'bench', px - sx * 2.6, pz, sx > 0 ? -Math.PI / 2 : Math.PI / 2)
      addTree(b, cx + sx * (half - 2.4), cz + sz * (half - 2.4))
    }
  }

  addProp(b, 'bench', cx + 5, cz - 1.5, Math.PI)
  addProp(b, 'bench', cx + 5, cz + 1.5, 0)
  addProp(b, 'sign', cx - 2.5, cz + half - 2, 0)
  addProp(b, 'sign', cx + half - 2, cz - 2.5, 0)
  addProp(b, 'trashcan', cx + 1.5, cz + half - 2.2, 0)
  addProp(b, 'trashcan', cx - 9.5, cz - 1.2, 0)
  addProp(b, 'trashcan', cx + half - 2.2, cz + 3, 0)
  addProp(b, 'flowerpot', cx - 3.2, cz - 6.2, 0)
  addProp(b, 'flowerpot', cx + 8.5, cz - 4.5, 0)
  addLamppost(b, cx, cz - 6)
  addLamppost(b, cx, cz + 6)
}

// ---------------------------------------------------------------------------
// Street furniture at block corners
// ---------------------------------------------------------------------------

function buildStreetFurniture(b: Builder): void {
  for (const block of b.blocks) {
    const { x, z } = block.rect
    const half = BLOCK_SIZE / 2
    const inset = 0.9
    addLamppost(b, x - half + inset, z - half + inset)
    addLamppost(b, x + half - inset, z + half - inset)

    if (b.rng.chance(0.45)) {
      addProp(b, 'hydrant', x + half - inset, z - half + inset, 0)
    }
    if (b.rng.chance(0.5)) {
      addProp(b, 'sign', x - half + inset, z + half - inset, b.rng.pick([0, Math.PI / 2]))
    }
    if (b.rng.chance(0.35)) {
      addProp(b, 'trashcan', x - half + inset + 1.1, z - half + inset, 0)
    }
  }
}

// ---------------------------------------------------------------------------
// Parked cars along road segments
// ---------------------------------------------------------------------------

function buildParkedCars(b: Builder): void {
  const edgeOffset = ROAD_WIDTH / 2 - 1.5
  for (let k = 0; k <= GRID; k++) {
    const c = roadCenter(k)
    for (let seg = 0; seg < GRID; seg++) {
      const start = blockOrigin(seg) + 5
      const end = blockOrigin(seg) + BLOCK_SIZE - 5
      for (const side of [-1, 1]) {
        if (!b.rng.chance(0.55)) continue
        const t = b.rng.range(start, end)
        // Horizontal road: cars are parallel to x, so rotate a quarter turn.
        addProp(b, 'car', t, c + side * edgeOffset, Math.PI / 2)
      }
      for (const side of [-1, 1]) {
        if (!b.rng.chance(0.55)) continue
        const t = b.rng.range(start, end)
        addProp(b, 'car', c + side * edgeOffset, t, 0)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Boundary and spawns
// ---------------------------------------------------------------------------

function buildBoundary(b: Builder): void {
  const h = MAP_HALF
  const thick = 4
  b.colliders.push({ minX: -h - thick, maxX: h + thick, minZ: -h - thick, maxZ: -h })
  b.colliders.push({ minX: -h - thick, maxX: h + thick, minZ: h, maxZ: h + thick })
  b.colliders.push({ minX: -h - thick, maxX: -h, minZ: -h, maxZ: h })
  b.colliders.push({ minX: h, maxX: h + thick, minZ: -h, maxZ: h })
}

function buildSpawnPoints(b: Builder): void {
  const picks: Array<[number, number, number]> = [
    [1, 1, Math.PI],
    [3, 3, 0],
    [1, 3, 0],
    [3, 1, Math.PI],
    [2, 2, Math.PI / 2],
    [2, 0, Math.PI],
    [0, 2, -Math.PI / 2],
    [4, 2, Math.PI / 2],
  ]
  for (const [i, j, rot] of picks) {
    const x = roadCenter(i)
    const z = roadCenter(j)
    if (circleOverlapsAny(x, z, PLAYER_RADIUS + 0.5, b.colliders)) {
      throw new Error(`Spawn point ${i},${j} is blocked`)
    }
    b.spawnPoints.push({ x, z, rot })
  }
}
