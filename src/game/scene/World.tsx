import { useMemo } from 'react'
import { Instance, Instances } from '@react-three/drei'
import { getMap } from '../map/generateMap'
import { BLOCK_SIZE, MAP_SIZE } from '../map/constants'
import type { BlockInfo, DecorSpec, HouseSpec } from '../map/types'
import { asphaltTexture, grassTexture, leafTexture, pavingTexture, plasterTexture, shingleTexture, sidewalkTexture } from './textures'

const COLORS = {
  park: '#79b86a',
  roadLine: '#d8d3c4',
  crosswalk: '#e9e6dc',
  alleyTint: '#9e988c',
  laneTint: '#8b8f96',
  trunk: '#6b4f3a',
  hedge: '#3d7a3a',
  lamp: '#3b3f46',
  lampHead: '#fff2c2',
  water: '#5ab4d6',
  stone: '#b9b3a8',
  kiosk: '#d9c9a6',
  kioskRoof: '#8a3b3b',
  window: '#9ec5e6',
  frame: '#f4f1ea',
  chimney: '#8c6d5f',
  path: '#c9c2b5',
}

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

function House({ house }: { house: HouseSpec }) {
  const plaster = useMemo(() => plasterTexture(), [])
  const shingles = useMemo(() => shingleTexture(), [])
  const hash = hashId(house.id)
  const roofHeight = house.h > 5 ? 2.3 : 1.9
  const overhang = 1.0
  const hasChimney = hash % 3 !== 0
  const chimneyX = (hash % 2 === 0 ? 1 : -1) * house.w * 0.28
  const doorX = house.w * 0.2
  const frontZ = -house.d / 2

  return (
    <group position={[house.x, 0, house.z]} rotation={[0, house.rot, 0]}>
      {/* Foundation band */}
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[house.w + 0.2, 0.3, house.d + 0.2]} />
        <meshStandardMaterial color="#8d8478" roughness={0.9} />
      </mesh>
      {/* Walls */}
      <mesh position={[0, house.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[house.w, house.h, house.d]} />
        <meshStandardMaterial color={house.wallColor} map={plaster} roughness={0.85} />
      </mesh>
      {/* Hip roof: a four sided cone scaled to the footprint. */}
      <mesh
        position={[0, house.h + roofHeight / 2, 0]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[(house.w + overhang) / Math.SQRT2, roofHeight, (house.d + overhang) / Math.SQRT2]}
        castShadow
      >
        <coneGeometry args={[1, 1, 4]} />
        <meshStandardMaterial color={house.roofColor} map={shingles} flatShading roughness={0.9} />
      </mesh>
      {/* Eaves board under the roof edge */}
      <mesh position={[0, house.h + 0.08, 0]}>
        <boxGeometry args={[house.w + overhang * 0.6, 0.16, house.d + overhang * 0.6]} />
        <meshStandardMaterial color="#efe9df" />
      </mesh>
      {hasChimney && (
        <mesh position={[chimneyX, house.h + roofHeight * 0.55, house.d * 0.15]} castShadow>
          <boxGeometry args={[0.6, roofHeight * 0.9, 0.6]} />
          <meshStandardMaterial color={COLORS.chimney} roughness={0.95} />
        </mesh>
      )}
      {/* Windows with frames on the front and back faces */}
      {[frontZ - 0.02, house.d / 2 + 0.02].map((z) =>
        [-house.w * 0.3, house.w * 0.3].map((x) => {
          // Skip the front window that would overlap the door.
          if (z < 0 && Math.abs(x - doorX) < 1.2) return null
          return (
            <group key={`${z}-${x}`} position={[x, house.h * 0.55, z]}>
              <mesh>
                <boxGeometry args={[1.3, 1.2, 0.06]} />
                <meshStandardMaterial color={COLORS.frame} />
              </mesh>
              <mesh position={[0, 0, z < 0 ? -0.02 : 0.02]}>
                <boxGeometry args={[1.1, 1.0, 0.06]} />
                <meshStandardMaterial color={COLORS.window} metalness={0.4} roughness={0.15} />
              </mesh>
              <mesh position={[0, -0.62, z < 0 ? -0.08 : 0.08]}>
                <boxGeometry args={[1.4, 0.08, 0.2]} />
                <meshStandardMaterial color={COLORS.frame} />
              </mesh>
            </group>
          )
        }),
      )}
      {house.h > 5 && (
        <group position={[-house.w * 0.3, house.h * 0.22, frontZ - 0.02]}>
          <mesh>
            <boxGeometry args={[1.3, 1.2, 0.06]} />
            <meshStandardMaterial color={COLORS.frame} />
          </mesh>
          <mesh position={[0, 0, -0.02]}>
            <boxGeometry args={[1.1, 1.0, 0.06]} />
            <meshStandardMaterial color={COLORS.window} metalness={0.4} roughness={0.15} />
          </mesh>
        </group>
      )}
      {/* Door frame, porch step and a path to the street */}
      <mesh position={[doorX, 1.1, frontZ - 0.03]}>
        <boxGeometry args={[1.3, 2.25, 0.08]} />
        <meshStandardMaterial color={COLORS.frame} />
      </mesh>
      <mesh position={[doorX, 0.1, frontZ - 0.6]} receiveShadow>
        <boxGeometry args={[1.6, 0.2, 1.0]} />
        <meshStandardMaterial color="#a39b8f" />
      </mesh>
      <mesh position={[doorX, 0.045, frontZ - 3.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.2, 4.4]} />
        <meshStandardMaterial color={COLORS.path} />
      </mesh>
    </group>
  )
}

function Decor({ decor }: { decor: DecorSpec }) {
  const paving = useMemo(() => pavingTexture(), [])
  const asphalt = useMemo(() => asphaltTexture(), [])
  if (decor.kind === 'fountain') {
    return (
      <group position={[decor.x, 0, decor.z]}>
        <mesh position={[0, 0.3, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[3, 3.2, 0.6, 24]} />
          <meshStandardMaterial color={COLORS.stone} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[2.6, 2.6, 0.05, 24]} />
          <meshStandardMaterial color={COLORS.water} metalness={0.3} roughness={0.2} />
        </mesh>
        <mesh position={[0, 1.2, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.5, 1.6, 12]} />
          <meshStandardMaterial color={COLORS.stone} />
        </mesh>
        <mesh position={[0, 2.0, 0]}>
          <cylinderGeometry args={[1.0, 1.0, 0.25, 16]} />
          <meshStandardMaterial color={COLORS.stone} />
        </mesh>
      </group>
    )
  }
  if (decor.kind === 'kiosk') {
    return (
      <group position={[decor.x, 0, decor.z]}>
        <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[decor.w, 2.8, decor.d]} />
          <meshStandardMaterial color={COLORS.kiosk} roughness={0.8} />
        </mesh>
        <mesh position={[0, 2.95, 0]} castShadow>
          <boxGeometry args={[decor.w + 1, 0.3, decor.d + 1]} />
          <meshStandardMaterial color={COLORS.kioskRoof} />
        </mesh>
        <mesh position={[0, 1.5, decor.d / 2 + 0.03]}>
          <boxGeometry args={[decor.w - 1.2, 1.2, 0.04]} />
          <meshStandardMaterial color={COLORS.window} metalness={0.4} roughness={0.15} />
        </mesh>
      </group>
    )
  }
  if (decor.kind === 'lamppost') {
    return null
  }
  if (decor.kind === 'crosswalk') {
    return (
      <mesh position={[decor.x, 0.06, decor.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[decor.w, decor.d]} />
        <meshStandardMaterial color={COLORS.crosswalk} roughness={0.9} />
      </mesh>
    )
  }
  if (decor.kind === 'lane') {
    return (
      <mesh position={[decor.x, 0.045, decor.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[decor.w, decor.d]} />
        <meshStandardMaterial color={COLORS.laneTint} map={asphalt} roughness={0.95} />
      </mesh>
    )
  }
  const tint = decor.kind === 'alley' ? COLORS.alleyTint : '#d8d0c2'
  return (
    <mesh position={[decor.x, 0.045, decor.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[decor.w, decor.d]} />
      <meshStandardMaterial color={tint} map={paving} roughness={0.9} />
    </mesh>
  )
}

function Block({ block }: { block: BlockInfo }) {
  const grass = useMemo(() => grassTexture(), [])
  const sidewalk = useMemo(() => sidewalkTexture(), [])
  const isPark = block.type === 'park'
  return (
    <group position={[block.rect.x, 0, block.rect.z]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BLOCK_SIZE + 2.4, BLOCK_SIZE + 2.4]} />
        <meshStandardMaterial map={sidewalk} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BLOCK_SIZE, BLOCK_SIZE]} />
        <meshStandardMaterial map={grass} color={isPark ? COLORS.park : '#ffffff'} roughness={1} />
      </mesh>
    </group>
  )
}

/** Static neighborhood geometry. Props with gameplay meaning live in PropsLayer. */
export function World() {
  const map = useMemo(() => getMap(), [])
  const lampposts = useMemo(() => map.decor.filter((d) => d.kind === 'lamppost'), [map])
  const grass = useMemo(() => grassTexture(), [])
  const asphalt = useMemo(() => asphaltTexture(), [])
  const leaves = useMemo(() => leafTexture(), [])
  const deciduous = useMemo(() => map.trees.filter((_, i) => i % 3 !== 2), [map])
  const conifers = useMemo(() => map.trees.filter((_, i) => i % 3 === 2), [map])

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP_SIZE + 60, MAP_SIZE + 60]} />
        <meshStandardMaterial map={grass} color="#cfe0c8" roughness={1} />
      </mesh>

      {/* Roads */}
      {map.roads.map((road, i) => (
        <mesh key={i} position={[road.x, 0.01, road.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[road.w, road.d]} />
          <meshStandardMaterial map={asphalt} roughness={0.95} />
        </mesh>
      ))}

      {map.blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}

      {map.decor.map((decor, i) => (
        <Decor key={i} decor={decor} />
      ))}

      {map.houses.map((house) => (
        <House key={house.id} house={house} />
      ))}

      {/* Tree trunks */}
      <Instances limit={map.trees.length} castShadow receiveShadow>
        <cylinderGeometry args={[0.18, 0.3, 1, 8]} />
        <meshStandardMaterial color={COLORS.trunk} roughness={0.95} />
        {map.trees.map((tree, i) => (
          <Instance key={i} position={[tree.x, 0.8, tree.z]} scale={[1, 1.6, 1]} />
        ))}
      </Instances>
      {/* Round, leafy canopies */}
      <Instances limit={deciduous.length} castShadow>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial map={leaves} flatShading roughness={0.9} />
        {deciduous.map((tree, i) => (
          <Instance
            key={i}
            color={tree.shade}
            position={[tree.x, 1.3 + tree.height * 0.45, tree.z]}
            scale={[tree.radius * 1.15, tree.height * 0.55, tree.radius * 1.15]}
            rotation={[0, i * 0.7, 0]}
          />
        ))}
      </Instances>
      <Instances limit={deciduous.length} castShadow>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial map={leaves} flatShading roughness={0.9} />
        {deciduous.map((tree, i) => (
          <Instance
            key={i}
            color={tree.shade}
            position={[tree.x + 0.4, 1.3 + tree.height * 0.8, tree.z - 0.3]}
            scale={[tree.radius * 0.7, tree.height * 0.32, tree.radius * 0.7]}
            rotation={[0, i * 1.3, 0]}
          />
        ))}
      </Instances>
      {/* Conifers: two stacked cones */}
      <Instances limit={conifers.length} castShadow>
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial map={leaves} flatShading roughness={0.9} />
        {conifers.map((tree, i) => (
          <Instance
            key={i}
            color={tree.shade}
            position={[tree.x, 1.0 + tree.height * 0.3, tree.z]}
            scale={[tree.radius, tree.height * 0.6, tree.radius]}
          />
        ))}
      </Instances>
      <Instances limit={conifers.length} castShadow>
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial map={leaves} flatShading roughness={0.9} />
        {conifers.map((tree, i) => (
          <Instance
            key={i}
            color={tree.shade}
            position={[tree.x, 1.0 + tree.height * 0.72, tree.z]}
            scale={[tree.radius * 0.7, tree.height * 0.55, tree.radius * 0.7]}
          />
        ))}
      </Instances>

      {/* Hedges */}
      <Instances limit={map.hedges.length} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.hedge} map={leaves} roughness={1} />
        {map.hedges.map((hedge, i) => (
          <Instance key={i} position={[hedge.x, 0.6, hedge.z]} scale={[hedge.w, 1.2, hedge.d]} />
        ))}
      </Instances>

      {/* Lamp posts */}
      <Instances limit={lampposts.length} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 1, 6]} />
        <meshStandardMaterial color={COLORS.lamp} metalness={0.5} roughness={0.5} />
        {lampposts.map((lamp, i) => (
          <Instance key={i} position={[lamp.x, 1.9, lamp.z]} scale={[1, 3.8, 1]} />
        ))}
      </Instances>
      <Instances limit={lampposts.length}>
        <boxGeometry args={[0.45, 0.3, 0.45]} />
        <meshStandardMaterial color={COLORS.lampHead} emissive={COLORS.lampHead} emissiveIntensity={0.6} />
        {lampposts.map((lamp, i) => (
          <Instance key={i} position={[lamp.x, 3.85, lamp.z]} />
        ))}
      </Instances>

      <RoadLines />
    </group>
  )
}

function RoadLines() {
  const map = useMemo(() => getMap(), [])
  const dashes = useMemo(() => {
    const items: Array<{ x: number; z: number; rot: number }> = []
    for (const road of map.roads) {
      const horizontal = road.w > road.d
      const length = horizontal ? road.w : road.d
      for (let t = -length / 2 + 3; t < length / 2 - 3; t += 6) {
        if (horizontal) {
          items.push({ x: road.x + t, z: road.z, rot: 0 })
        } else {
          items.push({ x: road.x, z: road.z + t, rot: Math.PI / 2 })
        }
      }
    }
    return items
  }, [map])

  return (
    <Instances limit={dashes.length}>
      <planeGeometry args={[3, 0.25]} />
      <meshStandardMaterial color={COLORS.roadLine} roughness={0.9} />
      {dashes.map((d, i) => (
        <Instance key={i} position={[d.x, 0.035, d.z]} rotation={[-Math.PI / 2, 0, d.rot]} />
      ))}
    </Instances>
  )
}
