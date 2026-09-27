import { memo, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { PropKind, PropSpec } from '../map/types'
import { getMap } from '../map/generateMap'

/** Neutral base colors per kind and variant. Only the hidden object gets the vivid announced color. */
const BASE_COLORS: Record<PropKind, string[]> = {
  car: ['#9aa3ad', '#d9dde2', '#3b4046', '#b9b2a4', '#6f7a86'],
  bench: ['#8d6e4f', '#6f5a45'],
  mailbox: ['#4c525a', '#6b6f75'],
  hydrant: ['#8b8f94'],
  trashcan: ['#4a4e54', '#5f6870'],
  sign: ['#e8e8e8', '#dfe3e6', '#cfd4d8'],
  flowerpot: ['#a3765a', '#8f6b55'],
  door: ['#6b4b34', '#4e5a66', '#7b6a58'],
  busstop: ['#7d8791'],
  planter: ['#8a8077', '#7d7a74'],
}

const DARK = '#2a2f36'
const GLASS = '#2b3a4a'
const FOLIAGE = '#4c8a3f'

interface PropMeshProps {
  spec: PropSpec
  color: string
  highlighted: boolean
}

/** Geometry for one prop kind. Also used by the end-of-round hint preview. */
export function PropMesh({ spec, color, highlighted }: PropMeshProps) {
  const emissive = highlighted ? color : '#000000'
  const emissiveIntensity = highlighted ? 0.25 : 0
  const main = <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} />

  if (spec.kind === 'car') {
    return (
      <group>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 0.7, 4.4]} />
          {main}
        </mesh>
        <mesh position={[0, 1.08, -0.2]} castShadow>
          <boxGeometry args={[1.7, 0.55, 2.1]} />
          <meshStandardMaterial color={GLASS} />
        </mesh>
        {[-0.85, 0.85].map((x) =>
          [-1.4, 1.4].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 0.32, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.32, 0.32, 0.3, 12]} />
              <meshStandardMaterial color={DARK} />
            </mesh>
          )),
        )}
      </group>
    )
  }

  if (spec.kind === 'bench') {
    return (
      <group>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1.8, 0.1, 0.55]} />
          {main}
        </mesh>
        <mesh position={[0, 0.78, -0.24]} castShadow>
          <boxGeometry args={[1.8, 0.45, 0.08]} />
          {main}
        </mesh>
        {[-0.75, 0.75].map((x) => (
          <mesh key={x} position={[x, 0.25, 0]}>
            <boxGeometry args={[0.1, 0.5, 0.45]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
        ))}
      </group>
    )
  }

  if (spec.kind === 'mailbox') {
    return (
      <group>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.1, 1.0, 0.1]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow>
          <boxGeometry args={[0.36, 0.34, 0.55]} />
          {main}
        </mesh>
      </group>
    )
  }

  if (spec.kind === 'hydrant') {
    return (
      <group>
        <mesh position={[0, 0.36, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.2, 0.72, 10]} />
          {main}
        </mesh>
        <mesh position={[0, 0.76, 0]}>
          <sphereGeometry args={[0.17, 10, 8]} />
          {main}
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.5, 0.12, 0.14]} />
          {main}
        </mesh>
      </group>
    )
  }

  if (spec.kind === 'trashcan') {
    return (
      <group>
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.27, 0.84, 12]} />
          {main}
        </mesh>
        <mesh position={[0, 0.88, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.08, 12]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
      </group>
    )
  }

  if (spec.kind === 'sign') {
    const wide = spec.variant === 1
    return (
      <group>
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[0.08, 2.2, 0.08]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
        <mesh position={[0, 2.0, 0]} castShadow>
          <boxGeometry args={[wide ? 1.0 : 0.7, wide ? 0.4 : 0.6, 0.06]} />
          {main}
        </mesh>
      </group>
    )
  }

  if (spec.kind === 'flowerpot') {
    return (
      <group>
        <mesh position={[0, 0.23, 0]} castShadow>
          <cylinderGeometry args={[0.36, 0.26, 0.46, 12]} />
          {main}
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.36, 10, 8]} />
          <meshStandardMaterial color={FOLIAGE} />
        </mesh>
      </group>
    )
  }

  if (spec.kind === 'door') {
    return (
      <group>
        <mesh position={[0, 1.02, 0]}>
          <boxGeometry args={[1.0, 2.04, 0.14]} />
          {main}
        </mesh>
        <mesh position={[0.32, 1.0, -0.1]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshStandardMaterial color="#d4af37" />
        </mesh>
      </group>
    )
  }

  if (spec.kind === 'busstop') {
    return (
      <group>
        {[-1.6, 1.6].map((x) => (
          <mesh key={x} position={[x, 1.2, 0.5]}>
            <boxGeometry args={[0.1, 2.4, 0.1]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
        ))}
        <mesh position={[0, 2.42, 0]} castShadow>
          <boxGeometry args={[3.6, 0.12, 1.3]} />
          {main}
        </mesh>
        <mesh position={[0, 1.4, 0.58]}>
          <boxGeometry args={[3.4, 1.6, 0.06]} />
          <meshStandardMaterial color={GLASS} transparent opacity={0.6} />
        </mesh>
        <mesh position={[0, 0.5, 0.2]}>
          <boxGeometry args={[2.6, 0.1, 0.5]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
      </group>
    )
  }

  // planter
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.6, 2.2]} />
        {main}
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[1.9, 0.5, 1.9]} />
        <meshStandardMaterial color={FOLIAGE} />
      </mesh>
    </group>
  )
}

interface ColorablePropProps {
  spec: PropSpec
  highlightColor: string | null
  onInteract: (spec: PropSpec) => void
}

const ColorableProp = memo(function ColorableProp({ spec, highlightColor, onInteract }: ColorablePropProps) {
  const base = BASE_COLORS[spec.kind][spec.variant % BASE_COLORS[spec.kind].length]
  const color = highlightColor ?? base

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onInteract(spec)
  }

  return (
    <group
      position={[spec.x, 0, spec.z]}
      rotation={[0, spec.rot, 0]}
      onClick={onClick}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      <PropMesh spec={spec} color={color} highlighted={highlightColor !== null} />
    </group>
  )
})

interface PropsLayerProps {
  hiddenObjectId: string | null
  colorHex: string | null
  onInteract: (spec: PropSpec) => void
}

/** All colorable props in the world. Exactly one may carry the announced color. */
export function PropsLayer({ hiddenObjectId, colorHex, onInteract }: PropsLayerProps) {
  const props = useMemo(() => getMap().props, [])
  return (
    <group>
      {props.map((spec) => (
        <ColorableProp
          key={spec.id}
          spec={spec}
          highlightColor={spec.id === hiddenObjectId ? colorHex : null}
          onInteract={onInteract}
        />
      ))}
    </group>
  )
}
