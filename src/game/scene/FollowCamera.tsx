import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { DirectionalLight, PerspectiveCamera, Vector3 } from 'three'
import { localPosition } from '../net/positionStore'

const CAMERA_OFFSET = new Vector3(0, 27, 17)
const LOOK_AHEAD = new Vector3(0, 0.5, -2)
const FOV_NORMAL = 42
const FOV_SPRINT = 49

/** Top-down, slightly angled camera that follows the local player with north up. */
export function FollowCamera() {
  const camera = useThree((s) => s.camera)
  const desired = useRef(new Vector3())
  const target = useRef(new Vector3())
  const snapped = useRef(false)

  useFrame((_, dt) => {
    desired.current.set(localPosition.x, 0, localPosition.z).add(CAMERA_OFFSET)
    target.current.set(localPosition.x, 0, localPosition.z).add(LOOK_AHEAD)

    if (!snapped.current) {
      camera.position.copy(desired.current)
      snapped.current = true
    } else {
      const k = 1 - Math.exp(-dt * 7)
      camera.position.lerp(desired.current, k)
    }
    camera.lookAt(target.current)

    // A wider field of view sells the speed while sprinting.
    if (camera instanceof PerspectiveCamera) {
      const wanted = localPosition.sprinting && localPosition.moving ? FOV_SPRINT : FOV_NORMAL
      const next = camera.fov + (wanted - camera.fov) * Math.min(1, dt * 5)
      if (Math.abs(next - camera.fov) > 0.01) {
        camera.fov = next
        camera.updateProjectionMatrix()
      }
    }
  })

  return null
}

/** Sun light that travels with the player so shadows stay crisp across the whole map. */
export function FollowLight() {
  const light = useRef<DirectionalLight>(null)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const l = light.current
    if (l === null) return
    scene.add(l.target)
    return () => {
      scene.remove(l.target)
    }
  }, [scene])

  useFrame(() => {
    const l = light.current
    if (l === null) return
    l.position.set(localPosition.x + 30, 55, localPosition.z + 18)
    l.target.position.set(localPosition.x, 0, localPosition.z)
    l.target.updateMatrixWorld()
  })

  return (
    <directionalLight
      ref={light}
      intensity={2.1}
      color="#fff4e0"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-55}
      shadow-camera-right={55}
      shadow-camera-top={55}
      shadow-camera-bottom={-55}
      shadow-camera-near={5}
      shadow-camera-far={160}
      shadow-bias={-0.0004}
    />
  )
}
