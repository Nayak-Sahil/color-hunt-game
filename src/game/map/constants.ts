/** World layout constants shared by the map generator, physics and UI. */
export const BLOCK_SIZE = 30
export const ROAD_WIDTH = 8
export const GRID = 4
export const MAP_SIZE = GRID * BLOCK_SIZE + (GRID + 1) * ROAD_WIDTH
export const MAP_HALF = MAP_SIZE / 2
export const MAP_SEED = 20260927

export const PLAYER_RADIUS = 0.45
export const PLAYER_FORWARD_SPEED = 7.5
export const PLAYER_BACKWARD_SPEED = 4
export const PLAYER_TURN_SPEED = 3.2
/** Speed multiplier while Alt is held. */
export const PLAYER_SPRINT_MULTIPLIER = 1.65
/** Horizontal speed multiplier while airborne, so a jump covers extra ground. */
export const PLAYER_JUMP_BOOST = 1.45
/** Peak height of a jump in world units. Low props (cars, mailboxes, hedges) are below this. */
export const JUMP_HEIGHT = 1.75
export const GRAVITY = 26

/** Distance within which a player may interact with a colorable object. */
export const INTERACT_RANGE = 3.5
/** Distance at which the hunter is considered to have touched a player. */
export const CATCH_RANGE = 1.6
/** Radius in which the hunter receives directional indicators for unsafe players. */
export const HUNTER_DETECT_RANGE = 32
/** Minimum distance between any player and the hidden object when it is chosen. */
export const MIN_OBJECT_DISTANCE = 18

export const ROUND_DURATION_SECONDS = 180
/** Start countdown shown to everyone after the color is announced. */
export const COUNTDOWN_SECONDS = 3
/** Seconds before the end at which the timer starts warning players. */
export const WARNING_SECONDS = 30
/** Seconds before the end at which everyone is shown the object's shape. */
export const HINT_SECONDS = 20

/** Screen-space origin of a block, given its grid index. */
export function blockOrigin(index: number): number {
  return -MAP_HALF + ROAD_WIDTH + index * (BLOCK_SIZE + ROAD_WIDTH)
}

/** Center coordinate of the road line with the given index (0 to GRID). */
export function roadCenter(index: number): number {
  return -MAP_HALF + ROAD_WIDTH / 2 + index * (BLOCK_SIZE + ROAD_WIDTH)
}
