import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { Character, type MotionState } from './Character'
import { emitDust } from './DustSystem'
import { getMap } from '../map/generateMap'
import { CATCH_RANGE, INTERACT_RANGE, PLAYER_RADIUS } from '../map/constants'
import type { PropSpec } from '../map/types'
import { groundHeightAt, resolveMovement } from '../physics/aabb'
import { tankStep, type TankInput } from '../physics/tank'
import { isGrounded, stepJump, type JumpState } from '../physics/jump'
import { getRemote, isOnline, localPosition, setLocalPosition } from '../net/positionStore'
import { sendPosition } from '../net/useGameChannel'
import { findPlayer, useGameStore } from '../state/gameStore'
import { hunterTargets, isMovementFrozen } from '../state/rules'
import { playerColor } from '../state/types'
import { attemptCatch } from '../interaction'
import { sfx, unlockAudio } from '../ui/sound'
import { haptics } from '../ui/haptics'

interface Props {
  userId: string
  onInteract: (spec: PropSpec) => void
}

interface Keys {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  /** Alt held: sprint. */
  alt: boolean
  /** A fresh Space press waiting to become a jump. */
  jumpQueued: boolean
}

const IDLE_KEYS: Keys = { up: false, down: false, left: false, right: false, alt: false, jumpQueued: false }

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.tagName === 'INPUT') return true
  if (target.tagName === 'TEXTAREA') return true
  return target.isContentEditable
}

/** The character controlled by this client: tank controls, sprint, jumps, collision, networking, catching. */
export function LocalPlayer({ userId, onInteract }: Props) {
  const map = useMemo(() => getMap(), [])
  const group = useRef<Group>(null)
  const keys = useRef<Keys>({ ...IDLE_KEYS })
  const motion = useRef<MotionState>({ moving: false, sprinting: false, airborne: false })
  const pose = useRef({ x: 0, z: 0, rot: 0 })
  const jump = useRef<JumpState>({ y: 0, vy: 0 })
  /** Direction held at take-off, carried through the air so a hop always travels somewhere. */
  const airForward = useRef<-1 | 0 | 1>(1)
  const lastRoundNumber = useRef<number | null>(null)
  const idleSendTimer = useRef(0)
  const stepDistance = useRef(0)
  const dustTimer = useRef(0)
  const wasAirborne = useRef(false)

  const me = useGameStore((s) => findPlayer(s.players, userId))
  const session = useGameStore((s) => s.session)
  const status = me?.status ?? 'searching'
  const colorIndex = me?.color_index ?? 0

  // Spawn on first mount and whenever a new round begins.
  const roundNumber = session?.round_number ?? 0
  const sessionStatus = session?.status ?? 'lobby'
  useEffect(() => {
    if (sessionStatus !== 'choosing_color' && lastRoundNumber.current !== null) return
    if (lastRoundNumber.current === roundNumber) return
    lastRoundNumber.current = roundNumber
    const spawn = map.spawnPoints[colorIndex % map.spawnPoints.length]
    pose.current = { x: spawn.x, z: spawn.z, rot: spawn.rot }
    jump.current = { y: 0, vy: 0 }
    setLocalPosition(spawn.x, spawn.z, 0, spawn.rot, false, false)
    sendPosition(spawn.x, spawn.z, 0, spawn.rot, false, false, true)
  }, [map, colorIndex, roundNumber, sessionStatus])

  useEffect(() => {
    const onKey = (event: KeyboardEvent, pressed: boolean) => {
      if (isTypingTarget(event.target)) return
      if (pressed) unlockAudio()
      const k = keys.current
      // Alt combined with arrows would otherwise trigger browser history navigation.
      k.alt = event.altKey
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          k.up = pressed
          break
        case 'ArrowDown':
        case 'KeyS':
          k.down = pressed
          break
        case 'ArrowLeft':
        case 'KeyA':
          k.left = pressed
          break
        case 'ArrowRight':
        case 'KeyD':
          k.right = pressed
          break
        case 'AltLeft':
        case 'AltRight':
          k.alt = pressed
          break
        case 'Space':
          if (pressed && !event.repeat) k.jumpQueued = true
          break
        default:
          return
      }
      event.preventDefault()
    }
    const onDown = (e: KeyboardEvent) => onKey(e, true)
    const onUp = (e: KeyboardEvent) => onKey(e, false)
    const onBlur = () => {
      keys.current = { ...IDLE_KEYS }
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  // E or Enter interacts with the nearest colorable object in range.
  useEffect(() => {
    const onInteractKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' && event.code !== 'Enter' && event.code !== 'NumpadEnter') return
      if (isTypingTarget(event.target)) return
      // Enter belongs to the color picker while the hunter is choosing.
      if (useGameStore.getState().session?.status === 'choosing_color') return
      let best: PropSpec | null = null
      let bestDistance = INTERACT_RANGE
      for (const prop of map.props) {
        const d = Math.hypot(prop.x - localPosition.x, prop.z - localPosition.z)
        if (d > bestDistance) continue
        best = prop
        bestDistance = d
      }
      if (best === null) {
        sfx.click()
        useGameStore.getState().showToast('Nothing to inspect here.', 'info')
        return
      }
      onInteract(best)
    }
    window.addEventListener('keydown', onInteractKey)
    return () => window.removeEventListener('keydown', onInteractKey)
  }, [map, onInteract])

  useFrame((_, rawDt) => {
    // Clamp so a stalled tab cannot teleport, but allow low frame rates to keep full speed.
    const dt = Math.min(rawDt, 0.1)
    const state = useGameStore.getState()
    const frozen = isMovementFrozen(state.session, state.round, state.serverOffsetMs)

    const k = keys.current
    let forward: -1 | 0 | 1 = frozen ? 0 : k.up && !k.down ? 1 : k.down && !k.up ? -1 : 0
    const turn: -1 | 0 | 1 = frozen ? 0 : k.left && !k.right ? 1 : k.right && !k.left ? -1 : 0

    // Whatever low obstacle is under the player becomes the floor (car roof, hedge, bench).
    const ground = groundHeightAt(pose.current.x, pose.current.z, PLAYER_RADIUS, map.colliders)
    const wantJump = k.jumpQueued && !frozen
    k.jumpQueued = false
    const grounded = isGrounded(jump.current, ground)
    if (wantJump && grounded) {
      airForward.current = forward === 0 ? 1 : forward
      sfx.jump()
      emitDust(pose.current.x, pose.current.z, 3, 0.26)
    }
    jump.current = stepJump(jump.current, wantJump, dt, ground)
    const airborne = !isGrounded(jump.current, ground)
    if (airborne && forward === 0) {
      forward = airForward.current
    }
    if (wasAirborne.current && !airborne) {
      sfx.land()
      haptics.land()
      emitDust(pose.current.x, pose.current.z, 5)
    }
    wasAirborne.current = airborne

    const sprinting = k.alt && !frozen
    const input: TankInput = { forward, turn, sprint: sprinting, airborne }
    const step = tankStep(pose.current, input, dt)
    const next = resolveMovement(pose.current, step.dx, step.dz, PLAYER_RADIUS, map.colliders, jump.current.y)
    const travelled = Math.hypot(next.x - pose.current.x, next.z - pose.current.z)
    pose.current = { x: next.x, z: next.z, rot: step.rot }
    const moving = step.moving && travelled > 0.0005
    motion.current.moving = moving && !airborne
    motion.current.sprinting = sprinting && moving
    motion.current.airborne = airborne

    // Footsteps and sprint dust.
    if (moving && !airborne) {
      stepDistance.current += travelled
      const stride = sprinting ? 1.35 : 1.15
      if (stepDistance.current >= stride) {
        stepDistance.current = 0
        sfx.footstep(sprinting)
      }
      if (sprinting) {
        dustTimer.current += dt
        if (dustTimer.current > 0.09) {
          dustTimer.current = 0
          emitDust(next.x, next.z, 1)
        }
      }
    }

    const y = jump.current.y
    if (group.current) {
      group.current.position.set(next.x, y, next.z)
      group.current.rotation.y = step.rot
    }
    setLocalPosition(next.x, next.z, y, step.rot, moving, sprinting && moving)

    // Send while moving, turning or jumping, plus a slow keepalive while idle.
    idleSendTimer.current += dt
    const active = moving || input.turn !== 0 || airborne
    if (active || idleSendTimer.current > 1) {
      idleSendTimer.current = 0
      sendPosition(next.x, next.z, y, step.rot, moving, sprinting && moving)
    }

    // Hunter: touching a searching player catches them.
    const session = state.session
    if (session === null) return
    if (session.status !== 'hunting') return
    if (session.hunter_id !== userId) return
    for (const target of hunterTargets(state.players, userId)) {
      if (!isOnline(target.user_id)) continue
      const remote = getRemote(target.user_id)
      if (remote === undefined) continue
      const d = Math.hypot(remote.x - next.x, remote.z - next.z)
      if (d > CATCH_RANGE) continue
      void attemptCatch(target.user_id)
      break
    }
  })

  return (
    <group ref={group}>
      <Character color={playerColor(colorIndex)} status={status} isSelf motion={motion} />
    </group>
  )
}
