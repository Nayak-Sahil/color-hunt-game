import { useMemo } from 'react'
import { Instance, Instances } from '@react-three/drei'
import { getMap } from '../map/generateMap'
import { BLOCK_SIZE, MAP_SIZE } from '../map/constants'
import type { BlockInfo, DecorSpec, HouseSpec } from '../map/types'

const COLORS = {
  grass: '#79b26a',
  grassDark: '#6aa05c',
  park: '#6fb35f',
  sidewalk: '#cfcabf',
  road: '#4b5058',
  roadLine: '#d8d3c4',
  crosswalk: '#e9e6dc',
  alley: '#a09a8f',
  path: '#c7beae',
  lane: '#5a5f67',
  trunk: '#6b4f3a',
  hedge: '#3d7a3a',
  lamp: '#3b3f46',
  lampHead: '#fff2c2',
  water: '#5ab4d6',
  stone: '#b9b3a8',
  kiosk: '#d9c9a6',
  kioskRoof: '#8a3b3b',
  window: '#9ec5e6',
}

function House({ house }: { house: HouseSpec }) {
  const roofHeight = house.h > 5 ? 2.2 : 1.8
  const overhang = 0.9
  return (
    <group position={[house.x, 0, house.z]} rotation={[0, house.rot, 0]}>
      <mesh position={[0, house.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[house.w, house.h, house.d]} />
        <meshStandardMaterial color={house.wallColor} />
      </mesh>
      {/* Hip roof: a four sided cone scaled to the footprint. */}
      <mesh
        position={[0, house.h + roofHeight / 2, 0]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[(house.w + overhang) / Math.SQRT2, roofHeight, (house.d + overhang) / Math.SQRT2]}
        castShadow
      >
        <coneGeometry args={[1, 1, 4]} />
        <meshStandardMaterial color={house.roofColor} flatShading />
      </mesh>
      {/* Windows on the front (negative z) and back faces */}
      {[-house.d / 2 - 0.02, house.d / 2 + 0.02].map((z) =>
        [-house.w * 0.3, house.w * 0.3].map((x) => (
          <mesh key={`${z}-${x}`} position={[x, house.h * 0.55, z]}>
            <boxGeometry args={[1.1, 1.0, 0.04]} />
            <meshStandardMaterial color={COLORS.window} />
          </mesh>
        )),
      )}
      {house.h > 5 && (
        <mesh position={[-house.w * 0.3, house.h * 0.25, -house.d / 2 - 0.02]}>
          <boxGeometry args={[1.1, 1.0, 0.04]} />
          <meshStandardMaterial color={COLORS.window} />
        </mesh>
      )}
    </group>
  )
}

function Decor({ decor }: { decor: DecorSpec }) {
  if (decor.kind === 'fountain') {
    return (
      <group position={[decor.x, 0, decor.z]}>
        <mesh position={[0, 0.3, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[3, 3.2, 0.6, 24]} />
          <meshStandardMaterial color={COLORS.stone} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[2.6, 2.6, 0.05, 24]} />
          <meshStandardMaterial color={COLORS.water} />
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
          <meshStandardMaterial color={COLORS.kiosk} />
        </mesh>
        <mesh position={[0, 2.95, 0]} castShadow>
          <boxGeometry args={[decor.w + 1, 0.3, decor.d + 1]} />
          <meshStandardMaterial color={COLORS.kioskRoof} />
        </mesh>
        <mesh position={[0, 1.5, decor.d / 2 + 0.03]}>
          <boxGeometry args={[decor.w - 1.2, 1.2, 0.04]} />
          <meshStandardMaterial color={COLORS.window} />
        </mesh>
      </group>
    )
  }
  if (decor.kind === 'lamppost') {
    return null
  }
  const y = decor.kind === 'crosswalk' ? 0.06 : 0.045
  const color =
    decor.kind === 'crosswalk'
      ? COLORS.crosswalk
      : decor.kind === 'alley'
        ? COLORS.alley
        : decor.kind === 'lane'
          ? COLORS.lane
          : COLORS.path
  return (
    <mesh position={[decor.x, y, decor.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[decor.w, decor.d]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function Block({ block }: { block: BlockInfo }) {
  const isPark = block.type === 'park'
  const grass = isPark ? COLORS.park : COLORS.grass
  return (
    <group position={[block.rect.x, 0, block.rect.z]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BLOCK_SIZE + 2.4, BLOCK_SIZE + 2.4]} />
        <meshStandardMaterial color={COLORS.sidewalk} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BLOCK_SIZE, BLOCK_SIZE]} />
        <meshStandardMaterial color={grass} />
      </mesh>
    </group>
  )
}

/** Static neighborhood geometry. Props with gameplay meaning live in PropsLayer. */
export function World() {
  const map = useMemo(() => getMap(), [])
  const lampposts = useMemo(() => map.decor.filter((d) => d.kind === 'lamppost'), [map])

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP_SIZE + 40, MAP_SIZE + 40]} />
        <meshStandardMaterial color={COLORS.grassDark} />
      </mesh>

      {/* Roads */}
      {map.roads.map((road, i) => (
        <mesh key={i} position={[road.x, 0.01, road.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[road.w, road.d]} />
          <meshStandardMaterial color={COLORS.road} />
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

      {/* Trees: instanced trunks and crowns */}
      <Instances limit={map.trees.length} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.28, 1, 8]} />
        <meshStandardMaterial color={COLORS.trunk} />
        {map.trees.map((tree, i) => (
          <Instance key={i} position={[tree.x, 0.6, tree.z]} scale={[1, 1.2, 1]} />
        ))}
      </Instances>
      <Instances limit={map.trees.length} castShadow>
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial flatShading />
        {map.trees.map((tree, i) => (
          <Instance
            key={i}
            color={tree.shade}
            position={[tree.x, 1.0 + tree.height / 2, tree.z]}
            scale={[tree.radius, tree.height, tree.radius]}
          />
        ))}
      </Instances>

      {/* Hedges */}
      <Instances limit={map.hedges.length} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.hedge} />
        {map.hedges.map((hedge, i) => (
          <Instance key={i} position={[hedge.x, 0.6, hedge.z]} scale={[hedge.w, 1.2, hedge.d]} />
        ))}
      </Instances>

      {/* Lamp posts */}
      <Instances limit={lampposts.length} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 1, 6]} />
        <meshStandardMaterial color={COLORS.lamp} />
        {lampposts.map((lamp, i) => (
          <Instance key={i} position={[lamp.x, 1.9, lamp.z]} scale={[1, 3.8, 1]} />
        ))}
      </Instances>
      <Instances limit={lampposts.length}>
        <boxGeometry args={[0.45, 0.3, 0.45]} />
        <meshStandardMaterial color={COLORS.lampHead} emissive={COLORS.lampHead} emissiveIntensity={0.5} />
        {lampposts.map((lamp, i) => (
          <Instance key={i} position={[lamp.x, 3.85, lamp.z]} />
        ))}
      </Instances>

      {/* Road center lines: instanced dashes along each road */}
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
      <meshStandardMaterial color={COLORS.roadLine} />
      {dashes.map((d, i) => (
        <Instance key={i} position={[d.x, 0.035, d.z]} rotation={[-Math.PI / 2, 0, d.rot]} />
      ))}
    </Instances>
  )
}
