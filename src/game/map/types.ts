/** Axis-aligned bounding box on the ground plane (x east, z south). */
export interface Aabb {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  /** Top of the obstacle. Omitted means it is too tall to jump over. */
  height?: number
}

/** Center-based rectangle on the ground plane, used for rendering. */
export interface Rect {
  x: number
  z: number
  w: number
  d: number
}

export type BlockType =
  | 'houses'
  | 'alley-ns'
  | 'alley-ew'
  | 'dead-end-w'
  | 'dead-end-s'
  | 'dead-end-n'
  | 'park'
  | 'plaza'

export interface BlockInfo {
  rect: Rect
  type: BlockType
}

export interface HouseSpec {
  id: string
  x: number
  z: number
  w: number
  d: number
  h: number
  /** Rotation around Y in radians. 0 means the door faces north (negative z). */
  rot: number
  wallColor: string
  roofColor: string
}

export interface TreeSpec {
  x: number
  z: number
  radius: number
  height: number
  shade: string
}

/** Kinds of objects the game may secretly color. Every prop is in the catalog. */
export type PropKind =
  | 'car'
  | 'bench'
  | 'mailbox'
  | 'hydrant'
  | 'trashcan'
  | 'sign'
  | 'flowerpot'
  | 'door'
  | 'busstop'
  | 'planter'

export interface PropSpec {
  id: string
  kind: PropKind
  x: number
  z: number
  rot: number
  /** Selection weight for the hidden object picker; lower for very common kinds. */
  weight: number
  /** Kind specific variant index, used for base colors. */
  variant: number
}

export type DecorKind = 'fountain' | 'kiosk' | 'lamppost' | 'path' | 'alley' | 'crosswalk' | 'lane'

export interface DecorSpec {
  kind: DecorKind
  x: number
  z: number
  w: number
  d: number
  rot: number
}

export interface SpawnPoint {
  x: number
  z: number
  rot: number
}

export interface MapData {
  size: number
  half: number
  roads: Rect[]
  blocks: BlockInfo[]
  houses: HouseSpec[]
  trees: TreeSpec[]
  hedges: Rect[]
  props: PropSpec[]
  decor: DecorSpec[]
  colliders: Aabb[]
  spawnPoints: SpawnPoint[]
}
