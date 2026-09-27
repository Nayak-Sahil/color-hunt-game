import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { getMap } from '../map/generateMap'
import type { PropKind, PropSpec } from '../map/types'
import { PropMesh } from '../scene/Props'

const KIND_LABEL: Record<PropKind, string> = {
  car: 'a parked car',
  bench: 'a bench',
  mailbox: 'a mailbox',
  hydrant: 'a fire hydrant',
  trashcan: 'a trash can',
  sign: 'a street sign',
  flowerpot: 'a flower pot',
  door: 'a house door',
  busstop: 'the bus stop',
  planter: 'a planter box',
}

/** Scale and vertical offset so each kind fills the small preview. */
const PREVIEW_FIT: Record<PropKind, { scale: number; lift: number }> = {
  car: { scale: 0.4, lift: -0.5 },
  bench: { scale: 1.1, lift: -0.5 },
  mailbox: { scale: 1.0, lift: -0.7 },
  hydrant: { scale: 1.6, lift: -0.5 },
  trashcan: { scale: 1.4, lift: -0.5 },
  sign: { scale: 0.75, lift: -1.2 },
  flowerpot: { scale: 1.6, lift: -0.45 },
  door: { scale: 0.75, lift: -1.05 },
  busstop: { scale: 0.5, lift: -1.3 },
  planter: { scale: 0.75, lift: -0.55 },
}

export function kindLabel(kind: PropKind): string {
  return KIND_LABEL[kind]
}

function Spinning({ spec, color }: { spec: PropSpec; color: string }) {
  const group = useRef<Group>(null)
  const fit = PREVIEW_FIT[spec.kind]
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.9
  })
  return (
    <group ref={group} position={[0, fit.lift * fit.scale, 0]} scale={fit.scale}>
      <PropMesh spec={spec} color={color} highlighted />
    </group>
  )
}

interface Props {
  hiddenObjectId: string
  colorHex: string
  colorName: string
}

/** Shows the shape of the hidden object in the announced color. Never its location. */
export function HintCard({ hiddenObjectId, colorHex, colorName }: Props) {
  const spec = useMemo(() => getMap().props.find((p) => p.id === hiddenObjectId) ?? null, [hiddenObjectId])
  if (spec === null) return null

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-300/40 bg-slate-900/85 px-3 py-2 shadow-lg backdrop-blur">
      <div className="h-20 w-24 overflow-hidden rounded-lg bg-slate-800/80">
        <Canvas camera={{ position: [2.6, 1.9, 2.8], fov: 34 }} gl={{ alpha: true, antialias: true }} dpr={[1, 2]}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[3, 5, 2]} intensity={1.3} />
          <Spinning spec={spec} color={colorHex} />
        </Canvas>
      </div>
      <div className="text-sm">
        <p className="text-[10px] uppercase tracking-widest text-amber-300">Hint</p>
        <p className="font-semibold text-slate-100">
          The {colorName} object is {kindLabel(spec.kind)}.
        </p>
        <p className="text-xs text-slate-400">Where it is stays a secret.</p>
      </div>
    </div>
  )
}
