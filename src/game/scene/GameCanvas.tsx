import { Suspense, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { World } from './World'
import { PropsLayer } from './Props'
import { LocalPlayer } from './LocalPlayer'
import { RemotePlayers } from './RemotePlayers'
import { FollowCamera, FollowLight } from './FollowCamera'
import { HudProjector } from './HudProjector'
import { useGameStore } from '../state/gameStore'
import { attemptInteract } from '../interaction'
import type { PropSpec } from '../map/types'
import { getMap } from '../map/generateMap'

interface Props {
  userId: string
}

export function GameCanvas({ userId }: Props) {
  const round = useGameStore((s) => s.round)
  const status = useGameStore((s) => s.session?.status)

  const showHidden = status === 'hunting' || status === 'round_over'
  const hiddenObjectId = showHidden && round !== null ? round.hidden_object_id : null
  const colorHex = showHidden && round !== null ? round.color_hex : null

  const onInteract = useCallback(
    (spec: PropSpec) => {
      void attemptInteract(spec, userId)
    },
    [userId],
  )

  // Dev only: lets automated browser tests trigger an interaction by object id.
  if (import.meta.env.DEV) {
    ;(window as unknown as { __colorHuntInteract?: (id: string) => void }).__colorHuntInteract = (id) => {
      const spec = getMap().props.find((p) => p.id === id)
      if (spec !== undefined) onInteract(spec)
    }
  }

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ fov: 42, near: 1, far: 260, position: [0, 27, 17] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      className="h-full w-full"
    >
      <color attach="background" args={['#a9d6ea']} />
      <fog attach="fog" args={['#a9d6ea', 95, 190]} />
      <hemisphereLight args={['#dbeafe', '#3f6b3a', 0.55]} />
      <ambientLight intensity={0.25} />
      <FollowLight />
      <Suspense fallback={null}>
        <World />
        <PropsLayer hiddenObjectId={hiddenObjectId} colorHex={colorHex} onInteract={onInteract} />
        <LocalPlayer userId={userId} onInteract={onInteract} />
        <RemotePlayers userId={userId} />
      </Suspense>
      <FollowCamera />
      <HudProjector userId={userId} />
    </Canvas>
  )
}
