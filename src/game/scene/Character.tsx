import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { PlayerStatus } from '../state/types'

export interface MotionState {
  moving: boolean
  sprinting: boolean
  airborne: boolean
}

interface Props {
  color: string
  status: PlayerStatus
  isSelf: boolean
  motion: RefObject<MotionState>
}

const SKIN = '#f0c4a0'
const HAIR = '#2f2320'
const PANTS = '#2f3a4f'
const SHOES = '#1c1c1c'

/**
 * Stylized human: rounded limbs, a real head with hair and eyes, a walk cycle,
 * a forward lean while sprinting and a tuck while airborne.
 * Name labels are DOM overlays positioned by HudProjector (see PlayerLabels).
 */
export function Character({ color, status, isSelf, motion }: Props) {
  const root = useRef<Group>(null)
  const leftLeg = useRef<Group>(null)
  const rightLeg = useRef<Group>(null)
  const leftArm = useRef<Group>(null)
  const rightArm = useRef<Group>(null)
  const upper = useRef<Group>(null)
  const phase = useRef(0)
  const lean = useRef(0)

  useFrame((state, dt) => {
    const m = motion.current ?? { moving: false, sprinting: false, airborne: false }
    const rate = m.sprinting ? 15 : 10.5
    if (m.moving) {
      phase.current += dt * rate
    } else {
      phase.current = 0
    }
    const amplitude = m.airborne ? 0.35 : m.sprinting ? 1.05 : 0.75
    const swing = m.moving || m.airborne ? Math.sin(phase.current) * amplitude : 0
    if (leftLeg.current) leftLeg.current.rotation.x = m.airborne ? -0.5 : swing
    if (rightLeg.current) rightLeg.current.rotation.x = m.airborne ? 0.4 : -swing
    if (leftArm.current) leftArm.current.rotation.x = m.airborne ? -1.2 : -swing * 0.9
    if (rightArm.current) rightArm.current.rotation.x = m.airborne ? -1.2 : swing * 0.9

    // Lean into a sprint, tuck slightly in the air, breathe while idle.
    const targetLean = m.airborne ? 0.15 : m.sprinting && m.moving ? 0.32 : 0
    lean.current += (targetLean - lean.current) * Math.min(1, dt * 8)
    if (root.current) {
      root.current.rotation.x = lean.current
      const bob = m.moving && !m.airborne ? Math.abs(Math.sin(phase.current)) * 0.06 : 0
      root.current.position.y = bob
    }
    if (upper.current) {
      const breathe = m.moving ? 0 : Math.sin(state.clock.elapsedTime * 2) * 0.012
      upper.current.scale.set(1, 1 + breathe, 1)
    }
  })

  const dimmed = status === 'eliminated'
  const shirt = dimmed ? '#7b8794' : color

  return (
    <group>
      <group ref={root}>
        {/* Legs pivot at the hip */}
        {[-0.14, 0.14].map((x, i) => (
          <group key={x} ref={i === 0 ? leftLeg : rightLeg} position={[x, 0.82, 0]}>
            <mesh position={[0, -0.36, 0]} castShadow>
              <capsuleGeometry args={[0.12, 0.5, 4, 10]} />
              <meshStandardMaterial color={PANTS} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.74, -0.05]} castShadow>
              <boxGeometry args={[0.24, 0.14, 0.38]} />
              <meshStandardMaterial color={SHOES} roughness={0.7} />
            </mesh>
          </group>
        ))}
        {/* Hips */}
        <mesh position={[0, 0.86, 0]} castShadow>
          <boxGeometry args={[0.48, 0.24, 0.32]} />
          <meshStandardMaterial color={PANTS} roughness={0.9} />
        </mesh>
        <group ref={upper}>
          {/* Torso */}
          <mesh position={[0, 1.22, 0]} castShadow>
            <capsuleGeometry args={[0.27, 0.42, 4, 12]} />
            <meshStandardMaterial color={shirt} roughness={0.8} />
          </mesh>
          {/* Neck and head */}
          <mesh position={[0, 1.55, 0]}>
            <cylinderGeometry args={[0.08, 0.09, 0.12, 8]} />
            <meshStandardMaterial color={SKIN} />
          </mesh>
          <mesh position={[0, 1.78, 0]} castShadow>
            <sphereGeometry args={[0.23, 16, 14]} />
            <meshStandardMaterial color={SKIN} roughness={0.7} />
          </mesh>
          <mesh position={[0, 1.86, 0.02]} scale={[1, 0.72, 1]}>
            <sphereGeometry args={[0.245, 16, 12]} />
            <meshStandardMaterial color={HAIR} roughness={0.9} />
          </mesh>
          {/* Face (front is negative z) */}
          {[-0.08, 0.08].map((x) => (
            <mesh key={x} position={[x, 1.8, -0.2]}>
              <sphereGeometry args={[0.032, 8, 8]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          ))}
          <mesh position={[0, 1.7, -0.215]}>
            <boxGeometry args={[0.08, 0.02, 0.02]} />
            <meshStandardMaterial color="#8c4a3c" />
          </mesh>
          {/* Arms pivot at the shoulder */}
          {[-0.36, 0.36].map((x, i) => (
            <group key={x} ref={i === 0 ? leftArm : rightArm} position={[x, 1.42, 0]}>
              <mesh position={[0, -0.14, 0]} castShadow>
                <capsuleGeometry args={[0.1, 0.16, 4, 10]} />
                <meshStandardMaterial color={shirt} roughness={0.8} />
              </mesh>
              <mesh position={[0, -0.4, 0]} castShadow>
                <capsuleGeometry args={[0.08, 0.24, 4, 10]} />
                <meshStandardMaterial color={SKIN} roughness={0.7} />
              </mesh>
              <mesh position={[0, -0.6, 0]}>
                <sphereGeometry args={[0.09, 10, 8]} />
                <meshStandardMaterial color={SKIN} roughness={0.7} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {status === 'hunter' && (
        <mesh position={[0, 2.55, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.22, 0.4, 4]} />
          <meshStandardMaterial color="#ef4444" emissive="#b91c1c" emissiveIntensity={0.8} />
        </mesh>
      )}
      {status === 'safe' && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.75, 24]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.85} />
        </mesh>
      )}
      {isSelf && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 0.9, 24]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  )
}
