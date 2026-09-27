import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { HUNTER_DETECT_RANGE } from '../map/constants'
import { getRemote, isOnline, localPosition } from '../net/positionStore'
import { useGameStore } from '../state/gameStore'
import { hunterTargets, nearestOf, projectToScreenEdge, type Located } from '../state/rules'
import { useHudStore, type IndicatorInfo, type NearestInfo } from '../ui/hudStore'
import { getLabelElements } from '../ui/labelRegistry'

const EDGE_MARGIN = 44
const UPDATE_INTERVAL = 0.08
const LABEL_HEIGHT = 2.5

/**
 * Runs inside the canvas so it can use the camera. Every frame it positions the DOM
 * name labels. About 12 times a second it computes the nearest-player panel data and,
 * for the hunter only, screen-edge indicators for unsafe players.
 */
export function HudProjector({ userId }: { userId: string }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const elapsed = useRef(0)
  const scratch = useRef(new Vector3())

  const positionLabels = (): void => {
    for (const [id, element] of getLabelElements()) {
      let x: number
      let z: number
      if (id === userId) {
        x = localPosition.x
        z = localPosition.z
      } else {
        const remote = getRemote(id)
        if (remote === undefined || !isOnline(id)) {
          element.style.display = 'none'
          continue
        }
        x = remote.x
        z = remote.z
      }
      const v = scratch.current.set(x, LABEL_HEIGHT, z).project(camera)
      const offScreen = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1
      if (offScreen) {
        element.style.display = 'none'
        continue
      }
      const px = ((v.x + 1) / 2) * size.width
      const py = ((1 - v.y) / 2) * size.height
      element.style.display = 'flex'
      element.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -100%)`
    }
  }

  useFrame((_, dt) => {
    positionLabels()

    elapsed.current += dt
    if (elapsed.current < UPDATE_INTERVAL) return
    elapsed.current = 0

    const { session, players } = useGameStore.getState()
    if (session === null) return
    const isHunter = session.hunter_id === userId && session.status === 'hunting'

    const others = players.filter((p) => p.user_id !== userId && p.status !== 'left')
    const located: Located[] = []
    for (const p of others) {
      if (!isOnline(p.user_id)) continue
      const remote = getRemote(p.user_id)
      if (remote === undefined) continue
      located.push({ userId: p.user_id, x: remote.x, z: remote.z })
    }

    const origin = { x: localPosition.x, z: localPosition.z }
    const nameOf = (id: string) => players.find((p) => p.user_id === id)?.display_name ?? 'Player'

    let nearest: NearestInfo | null = null
    const indicators: IndicatorInfo[] = []

    if (isHunter) {
      const targetIds = new Set(hunterTargets(players, userId).map((p) => p.user_id))
      const targets = located.filter((l) => targetIds.has(l.userId))
      const inRange = targets.filter((t) => Math.hypot(t.x - origin.x, t.z - origin.z) <= HUNTER_DETECT_RANGE)
      const near = nearestOf(origin, inRange)
      if (near !== null) {
        nearest = { ...near, name: nameOf(near.userId) }
      }
      for (const t of inRange) {
        const v = scratch.current.set(t.x, 1, t.z).project(camera)
        const behind = v.z > 1
        const edge = projectToScreenEdge(v.x, v.y, behind, size.width, size.height, EDGE_MARGIN)
        if (edge === null) continue
        indicators.push({
          userId: t.userId,
          name: nameOf(t.userId),
          x: edge.x,
          y: edge.y,
          angle: edge.angle,
          distance: Math.hypot(t.x - origin.x, t.z - origin.z),
        })
      }
    } else {
      const near = nearestOf(origin, located)
      if (near !== null) {
        nearest = { ...near, name: nameOf(near.userId) }
      }
    }

    useHudStore.getState().setHud(indicators, nearest)
  })

  return null
}
