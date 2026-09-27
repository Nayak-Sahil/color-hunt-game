import { GameCanvas } from './scene/GameCanvas'
import { HUD } from './ui/HUD'

interface Props {
  userId: string
  onLeave: () => void
}

/**
 * The in-game screen: 3D canvas plus HUD. Loaded lazily so the 3D engine
 * lives in its own chunk and the menus start fast.
 */
export default function GameView({ userId, onLeave }: Props) {
  return (
    <div className="vignette relative h-full w-full overflow-hidden">
      <GameCanvas userId={userId} />
      <HUD userId={userId} onLeave={onLeave} />
    </div>
  )
}
