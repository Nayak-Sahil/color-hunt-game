import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { PlayerStatus } from '../state/types'

export interface MotionState {
  moving: boolean
}

interface Props {
  color: string
  status: PlayerStatus
  isSelf: boolean
  motion: RefObject<MotionState>
}

const SKIN = '#f1c9a5'
const DARK = '#1f2937'

/**
 * Blocky low-poly character with a simple procedural walk cycle.
 * Name labels are DOM overlays positioned by HudProjector (see PlayerLabels).
 */
export function Character({ color, status, isSelf, motion }: Props) {
  const leftLeg = useRef<Group>(null)
  const rightLeg = useRef<Group>(null)
  const leftArm = useRef<Group>(null)
  const rightArm = useRef<Group>(null)
  const body = useRef<Group>(null)
  const phase = useRef(0)

  useFrame((_, dt) => {
    const moving = motion.current?.moving ?? false
    if (moving) {
      phase.current += dt * 11
    } else {
      phase.current = 0
    }
    const swing = moving ? Math.sin(phase.current) * 0.7 : 0
    if (leftLeg.current) leftLeg.current.rotation.x = swing
    if (rightLeg.current) rightLeg.current.rotation.x = -swing
    if (leftArm.current) leftArm.current.rotation.x = -swing
    if (rightArm.current) rightArm.current.rotation.x = swing
    if (body.current) body.current.position.y = moving ? Math.abs(Math.sin(phase.current * 2)) * 0.05 : 0
  })

  const dimmed = status === 'eliminated'
  const bodyColor = dimmed ? '#7b8794' : color

  return (
    <group>
      <group ref={body}>
        {/* Torso */}
        <mesh position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={[0.7, 0.8, 0.42]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.66, 0]} castShadow>
          <boxGeometry args={[0.52, 0.5, 0.5]} />
          <meshStandardMaterial color={SKIN} />
        </mesh>
        {/* Hair cap */}
        <mesh position={[0, 1.94, 0]}>
          <boxGeometry args={[0.54, 0.12, 0.52]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
        {/* Eyes on the front face (negative z) */}
        <mesh position={[-0.12, 1.7, -0.26]}>
          <boxGeometry args={[0.08, 0.1, 0.02]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
        <mesh position={[0.12, 1.7, -0.26]}>
          <boxGeometry args={[0.08, 0.1, 0.02]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
        {/* Arms pivot at the shoulder */}
        <group ref={leftArm} position={[-0.47, 1.35, 0]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <boxGeometry args={[0.2, 0.64, 0.2]} />
            <meshStandardMaterial color={bodyColor} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.47, 1.35, 0]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <boxGeometry args={[0.2, 0.64, 0.2]} />
            <meshStandardMaterial color={bodyColor} />
          </mesh>
        </group>
      </group>
      {/* Legs pivot at the hip */}
      <group ref={leftLeg} position={[-0.17, 0.6, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.24, 0.6, 0.26]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.17, 0.6, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.24, 0.6, 0.26]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
      </group>

      {status === 'hunter' && (
        <mesh position={[0, 2.45, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.22, 0.4, 4]} />
          <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" emissiveIntensity={0.6} />
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
