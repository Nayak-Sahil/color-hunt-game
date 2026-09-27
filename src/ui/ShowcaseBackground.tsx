import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { Vector3 } from 'three'
import { ACESFilmicToneMapping } from 'three'
import { World } from '../game/scene/World'
import { PropsLayer } from '../game/scene/Props'
import { ANNOUNCE_COLORS } from '../game/state/types'
import { getMap } from '../game/map/generateMap'

const SHOWCASE_FPS = 24

/** Slowly circles the neighborhood at a low angle, like an attract mode. */
function OrbitingCamera() {
  const camera = useThree((s) => s.camera)
  const target = useRef(new Vector3(0, 0, 0))
  const angle = useRef(Math.random() * Math.PI * 2)

  useFrame((_, dt) => {
    angle.current += Math.min(dt, 0.1) * 0.06
    const radius = 62
    camera.position.set(Math.cos(angle.current) * radius, 30, Math.sin(angle.current) * radius)
    target.current.set(Math.cos(angle.current + 1.2) * 12, 0, Math.sin(angle.current + 1.2) * 12)
    camera.lookAt(target.current)
  })
  return null
}

/** Renders on demand at a modest rate so the menus stay cheap. */
function FrameThrottle() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const timer = window.setInterval(() => invalidate(), 1000 / SHOWCASE_FPS)
    return () => window.clearInterval(timer)
  }, [invalidate])
  return null
}

const SHOWCASE_OBJECT = getMap().props.find((p) => p.kind === 'car')?.id ?? null
const SHOWCASE_COLOR = ANNOUNCE_COLORS[0].hex

/** Live 3D neighborhood behind the menus so every screen feels like the game. */
export default function ShowcaseBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      <Canvas
        dpr={[0.75, 1]}
        frameloop="demand"
        camera={{ fov: 40, near: 1, far: 300, position: [60, 30, 0] }}
        gl={{ antialias: false, powerPreference: 'low-power', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={['#9ccce6']} />
        <fog attach="fog" args={['#a9d6ea', 80, 200]} />
        <Sky sunPosition={[40, 35, 20]} turbidity={5} rayleigh={1.4} />
        <hemisphereLight args={['#dbeafe', '#3f6b3a', 0.6]} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[40, 55, 20]} intensity={2.0} color="#fff4e0" />
        <Suspense fallback={null}>
          <World />
          <PropsLayer hiddenObjectId={SHOWCASE_OBJECT} colorHex={SHOWCASE_COLOR} onInteract={() => undefined} />
        </Suspense>
        <OrbitingCamera />
        <FrameThrottle />
      </Canvas>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(2,6,23,0.25)_0%,_rgba(2,6,23,0.75)_100%)]" />
    </div>
  )
}
