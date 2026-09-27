import type { MapData } from '../map/types'
import { BLOCK_SIZE } from '../map/constants'

export interface MapMarker {
  x: number
  z: number
  color: string
  /** Facing rotation, drawn as a heading triangle when provided. */
  rot?: number
  label?: string
  kind: 'self' | 'target' | 'hunter'
}

export interface DrawOptions {
  centerX: number
  centerZ: number
  /** World units spanned by the shorter canvas side. */
  unitsAcross: number
  markers: MapMarker[]
}

const PALETTE = {
  ground: '#3f5a3a',
  block: '#5f8f52',
  park: '#4f9a4a',
  plaza: '#8d867b',
  sidewalk: '#a8a196',
  road: '#2f333a',
  house: '#c9bfae',
  hedge: '#2e6b2e',
  water: '#4aa3c9',
  roadLine: '#6d7280',
}

/** Draws the neighborhood onto a 2D canvas, north up, centered on a world point. */
export function drawMap(ctx: CanvasRenderingContext2D, map: MapData, options: DrawOptions): void {
  const { width, height } = ctx.canvas
  const scale = Math.min(width, height) / options.unitsAcross
  const toX = (x: number) => width / 2 + (x - options.centerX) * scale
  const toY = (z: number) => height / 2 + (z - options.centerZ) * scale

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = PALETTE.ground
  ctx.fillRect(0, 0, width, height)

  const rect = (x: number, z: number, w: number, d: number, fill: string) => {
    ctx.fillStyle = fill
    ctx.fillRect(toX(x - w / 2), toY(z - d / 2), w * scale, d * scale)
  }

  for (const block of map.blocks) {
    rect(block.rect.x, block.rect.z, BLOCK_SIZE + 2.4, BLOCK_SIZE + 2.4, PALETTE.sidewalk)
    const fill = block.type === 'park' ? PALETTE.park : block.type === 'plaza' ? PALETTE.plaza : PALETTE.block
    rect(block.rect.x, block.rect.z, BLOCK_SIZE, BLOCK_SIZE, fill)
  }
  for (const road of map.roads) {
    rect(road.x, road.z, road.w, road.d, PALETTE.road)
  }
  for (const decor of map.decor) {
    if (decor.kind === 'lane') rect(decor.x, decor.z, decor.w, decor.d, PALETTE.road)
    if (decor.kind === 'alley') rect(decor.x, decor.z, decor.w, decor.d, PALETTE.sidewalk)
    if (decor.kind === 'fountain') rect(decor.x, decor.z, decor.w, decor.d, PALETTE.water)
  }
  for (const hedge of map.hedges) {
    rect(hedge.x, hedge.z, hedge.w, hedge.d, PALETTE.hedge)
  }
  for (const house of map.houses) {
    const swap = Math.abs(Math.abs(house.rot) - Math.PI / 2) < 0.01
    rect(house.x, house.z, swap ? house.d : house.w, swap ? house.w : house.d, PALETTE.house)
  }

  for (const marker of options.markers) {
    const px = toX(marker.x)
    const py = toY(marker.z)
    if (marker.kind === 'hunter') {
      // Crosshair so the Hunter is unmistakable at a glance.
      const r = Math.max(5, scale * 1.6)
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fillStyle = marker.color
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(px - r * 1.5, py)
      ctx.lineTo(px + r * 1.5, py)
      ctx.moveTo(px, py - r * 1.5)
      ctx.lineTo(px, py + r * 1.5)
      ctx.lineWidth = 1.5
      ctx.stroke()
      continue
    }
    if (marker.kind === 'target') {
      ctx.beginPath()
      ctx.arc(px, py, Math.max(3.5, scale * 1.2), 0, Math.PI * 2)
      ctx.fillStyle = marker.color
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      continue
    }

    // Self: heading triangle. rot 0 faces north (up on the canvas), rot increases counter clockwise.
    const r = Math.max(5, scale * 1.4)
    const heading = -(marker.rot ?? 0)
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(heading)
    ctx.beginPath()
    ctx.moveTo(0, -r * 1.4)
    ctx.lineTo(r * 0.9, r * 0.9)
    ctx.lineTo(0, r * 0.3)
    ctx.lineTo(-r * 0.9, r * 0.9)
    ctx.closePath()
    ctx.fillStyle = marker.color
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
    ctx.restore()
  }

  if (options.markers.some((m) => m.label)) {
    ctx.font = `${Math.max(10, Math.round(scale * 2.6))}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    for (const marker of options.markers) {
      if (!marker.label) continue
      ctx.fillText(marker.label, toX(marker.x), toY(marker.z) - Math.max(8, scale * 2))
    }
  }
}
