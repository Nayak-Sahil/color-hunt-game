import { memo, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { PropKind, PropSpec } from '../map/types'
import { getMap } from '../map/generateMap'

/** Neutral base colors per kind and variant. Only the hidden object gets the vivid announced color. */
const BASE_COLORS: Record<PropKind, string[]> = {
  car: ['#c9ccd1', '#f2f2f0', '#2b2f36', '#d8cfbf', '#5f6770'],
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
        {/* Lower body */}
        <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 0.55, 4.4]} />
          {main}
        </mesh>
        {/* Hood and trunk shoulders */}
        <mesh position={[0, 0.88, 1.35]} castShadow>
          <boxGeometry args={[1.9, 0.14, 1.5]} />
          {main}
        </mesh>
        <mesh position={[0, 0.88, -1.5]} castShadow>
          <boxGeometry args={[1.9, 0.14, 1.2]} />
          {main}
        </mesh>
        {/* Cabin */}
        <mesh position={[0, 1.12, -0.15]} castShadow>
          <boxGeometry args={[1.75, 0.5, 2.2]} />
          {main}
        </mesh>
        {/* Windows */}
        <mesh position={[0, 1.14, 0.97]}>
          <boxGeometry args={[1.6, 0.4, 0.06]} />
          <meshStandardMaterial color={GLASS} metalness={0.5} roughness={0.15} />
        </mesh>
        <mesh position={[0, 1.14, -1.27]}>
          <boxGeometry args={[1.6, 0.4, 0.06]} />
          <meshStandardMaterial color={GLASS} metalness={0.5} roughness={0.15} />
        </mesh>
        {[-0.9, 0.9].map((x) => (
          <mesh key={x} position={[x, 1.14, -0.15]}>
            <boxGeometry args={[0.06, 0.36, 1.9]} />
            <meshStandardMaterial color={GLASS} metalness={0.5} roughness={0.15} />
          </mesh>
        ))}
        {/* Lights and bumpers */}
        {[-0.65, 0.65].map((x) => (
          <mesh key={`h${x}`} position={[x, 0.62, 2.21]}>
            <boxGeometry args={[0.36, 0.18, 0.05]} />
            <meshStandardMaterial color="#fff6c8" emissive="#ffe9a3" emissiveIntensity={0.5} />
          </mesh>
        ))}
        {[-0.65, 0.65].map((x) => (
          <mesh key={`t${x}`} position={[x, 0.62, -2.21]}>
            <boxGeometry args={[0.36, 0.14, 0.05]} />
            <meshStandardMaterial color="#b3261e" emissive="#7f1d1d" emissiveIntensity={0.4} />
          </mesh>
        ))}
        {[2.22, -2.22].map((z) => (
          <mesh key={z} position={[0, 0.36, z]}>
            <boxGeometry args={[2.05, 0.2, 0.12]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
        ))}
        {/* Wheels with hubcaps */}
        {[-0.92, 0.92].map((x) =>
          [-1.4, 1.4].map((z) => (
            <group key={`${x}-${z}`} position={[x, 0.34, z]} rotation={[0, 0, Math.PI / 2]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.34, 0.34, 0.28, 14]} />
                <meshStandardMaterial color={DARK} roughness={0.9} />
              </mesh>
              <mesh position={[0, x > 0 ? 0.15 : -0.15, 0]}>
                <cylinderGeometry args={[0.17, 0.17, 0.02, 10]} />
                <meshStandardMaterial color="#c7cbd1" metalness={0.7} roughness={0.3} />
              </mesh>
            </group>
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
