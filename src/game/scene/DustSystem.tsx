import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { InstancedMesh, Object3D } from 'three'

interface Puff {
  x: number
  y: number
  z: number
  age: number
  life: number
  size: number
  driftX: number
  driftZ: number
}

const POOL = 48
const puffs: Puff[] = []

/** Spawns a few dust puffs at a world position. Called from players when sprinting or landing. */
export function emitDust(x: number, z: number, count: number, size = 0.32): void {
  for (let i = 0; i < count; i++) {
    if (puffs.length >= POOL) puffs.shift()
    puffs.push({
      x: x + (Math.random() - 0.5) * 0.5,
      y: 0.08,
      z: z + (Math.random() - 0.5) * 0.5,
      age: 0,
      life: 0.45 + Math.random() * 0.25,
      size: size * (0.7 + Math.random() * 0.6),
      driftX: (Math.random() - 0.5) * 1.2,
      driftZ: (Math.random() - 0.5) * 1.2,
    })
  }
}

/** Soft dust clouds that rise and dissolve. One instanced mesh for all of them. */
export function DustSystem() {
  const mesh = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  useFrame((_, dt) => {
    const m = mesh.current
    if (m === null) return
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]
      p.age += dt
      if (p.age >= p.life) {
        puffs.splice(i, 1)
        continue
      }
      p.x += p.driftX * dt
      p.z += p.driftZ * dt
      p.y += dt * 0.9
    }
    for (let i = 0; i < POOL; i++) {
      const p = puffs[i]
      if (p === undefined) {
        dummy.position.set(0, -10, 0)
        dummy.scale.setScalar(0.001)
      } else {
        const t = p.age / p.life
        const s = p.size * (0.6 + t * 1.6)
        dummy.position.set(p.x, p.y, p.z)
        dummy.scale.setScalar(s)
      }
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, POOL]} frustumCulled={false}>
      <sphereGeometry args={[1, 7, 6]} />
      <meshStandardMaterial color="#e6dfd0" transparent opacity={0.42} depthWrite={false} roughness={1} />
    </instancedMesh>
  )
}
