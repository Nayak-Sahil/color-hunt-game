import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { Character, type MotionState } from './Character'
import { emitDust } from './DustSystem'
import { getRemote } from '../net/positionStore'
import { useGameStore } from '../state/gameStore'
import { normalizeAngle } from '../physics/tank'
import { playerColor, type PlayerRow } from '../state/types'

interface Props {
  userId: string
}

function RemotePlayer({ player }: { player: PlayerRow }) {
  const group = useRef<Group>(null)
  const motion = useRef<MotionState>({ moving: false, sprinting: false, airborne: false })
  const initialized = useRef(false)
  const dustTimer = useRef(0)
  const wasAirborne = useRef(false)

  useFrame((_, dt) => {
    const remote = getRemote(player.user_id)
    const g = group.current
    if (g === null) return
    if (remote === undefined) {
      g.visible = false
      return
    }
    g.visible = true

    if (!initialized.current) {
      remote.x = remote.target.x
      remote.z = remote.target.z
      remote.y = remote.target.y
      remote.rot = remote.target.rot
      initialized.current = true
    }

    // Exponential smoothing toward the latest network snapshot.
    const k = 1 - Math.exp(-dt * 14)
    remote.x += (remote.target.x - remote.x) * k
    remote.z += (remote.target.z - remote.z) * k
    remote.y += (remote.target.y - remote.y) * k
    const delta = normalizeAngle(remote.target.rot - remote.rot)
    remote.rot = normalizeAngle(remote.rot + delta * k)

    // Consider a remote player moving if the network says so or they are still catching up.
    const catchingUp = Math.hypot(remote.target.x - remote.x, remote.target.z - remote.z) > 0.08
    const airborne = remote.target.y > 0.05 || remote.y > 0.08
    motion.current.moving = remote.target.moving || catchingUp
    motion.current.sprinting = remote.target.sprinting
    motion.current.airborne = airborne

    if (motion.current.sprinting && motion.current.moving && !airborne) {
      dustTimer.current += dt
      if (dustTimer.current > 0.11) {
        dustTimer.current = 0
        emitDust(remote.x, remote.z, 1)
      }
    }
    if (wasAirborne.current && !airborne) emitDust(remote.x, remote.z, 4)
    wasAirborne.current = airborne

    g.position.set(remote.x, remote.y, remote.z)
    g.rotation.y = remote.rot
  })

  return (
    <group ref={group} visible={false}>
      <Character color={playerColor(player.color_index)} status={player.status} isSelf={false} motion={motion} />
    </group>
  )
}

/** Every other active player in the session. Hidden until a position arrives. */
export function RemotePlayers({ userId }: Props) {
  const players = useGameStore((s) => s.players)
  return (
    <group>
      {players
        .filter((p) => p.user_id !== userId)
        .filter((p) => p.status !== 'left')
        .map((p) => (
          <RemotePlayer key={p.user_id} player={p} />
        ))}
    </group>
  )
}
