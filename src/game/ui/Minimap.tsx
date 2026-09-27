import { useEffect, useRef } from 'react'
import { getMap } from '../map/generateMap'
import { HUNTER_DETECT_RANGE, MAP_SIZE } from '../map/constants'
import { getRemote, isOnline, localPosition } from '../net/positionStore'
import { useGameStore } from '../state/gameStore'
import { hunterTargets } from '../state/rules'
import { drawMap, type MapMarker } from './mapDrawing'

interface Props {
  userId: string
  /** Full map view of the entire neighborhood instead of a zoomed window. */
  full?: boolean
  size: number
  onClick?: () => void
}

/** Collects markers allowed by the visibility rules for the given viewer. */
function visibleMarkers(userId: string, full: boolean): MapMarker[] {
  const { session, players } = useGameStore.getState()
  const markers: MapMarker[] = [
    { x: localPosition.x, z: localPosition.z, rot: localPosition.rot, color: '#22d3ee', kind: 'self', label: full ? 'You' : undefined },
  ]
  if (session === null) return markers
  const isHunter = session.hunter_id === userId && session.status === 'hunting'

  // Everyone can always see where the Hunter is.
  if (!isHunter && session.hunter_id !== null && session.hunter_id !== userId) {
    const hunterRemote = getRemote(session.hunter_id)
    if (hunterRemote !== undefined && isOnline(session.hunter_id)) {
      markers.push({ x: hunterRemote.x, z: hunterRemote.z, color: '#ef4444', kind: 'hunter', label: full ? 'Hunter' : undefined })
    }
  }
  if (!isHunter) return markers

  for (const target of hunterTargets(players, userId)) {
    if (!isOnline(target.user_id)) continue
    const remote = getRemote(target.user_id)
    if (remote === undefined) continue
    const d = Math.hypot(remote.x - localPosition.x, remote.z - localPosition.z)
    if (d > HUNTER_DETECT_RANGE) continue
    markers.push({ x: remote.x, z: remote.z, color: '#f43f5e', kind: 'target', label: full ? target.display_name : undefined })
  }
  return markers
}

export function MapCanvas({ userId, full = false, size, onClick }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const map = getMap()
    let frame = 0
    const render = () => {
      const c = canvas.current
      if (c !== null) {
        const ctx = c.getContext('2d')
        if (ctx !== null) {
          drawMap(ctx, map, {
            centerX: full ? 0 : localPosition.x,
            centerZ: full ? 0 : localPosition.z,
            unitsAcross: full ? MAP_SIZE + 4 : 64,
            markers: visibleMarkers(userId, full),
          })
        }
      }
      frame = window.requestAnimationFrame(render)
    }
    frame = window.requestAnimationFrame(render)
    return () => window.cancelAnimationFrame(frame)
  }, [userId, full])

  return (
    <canvas
      ref={canvas}
      width={size}
      height={size}
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : undefined}
      style={{ width: size, height: size }}
    />
  )
}

export function Minimap({ userId }: { userId: string }) {
  const setFullMapOpen = useGameStore((s) => s.setFullMapOpen)
  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 overflow-hidden rounded-xl border border-white/15 bg-slate-900/70 shadow-lg backdrop-blur">
      <MapCanvas userId={userId} size={176} onClick={() => setFullMapOpen(true)} />
      <div className="flex items-center justify-between px-2 py-1 text-[10px] text-slate-300">
        <span>N ↑</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-rose-500" /> Hunter · M full map</span>
      </div>
    </div>
  )
}
