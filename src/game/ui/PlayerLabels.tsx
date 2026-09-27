import { useGameStore } from '../state/gameStore'
import { playerColor, type PlayerStatus } from '../state/types'
import { registerLabel } from './labelRegistry'

function badgeFor(status: PlayerStatus): string | null {
  if (status === 'hunter') return '🎯 Hunter'
  if (status === 'safe') return '✅ Safe'
  if (status === 'eliminated') return '💀 Caught'
  return null
}

/** Name tags above every character. Positions are written by HudProjector each frame. */
export function PlayerLabels({ userId }: { userId: string }) {
  const players = useGameStore((s) => s.players)
  return (
    <>
      {players
        .filter((p) => p.status !== 'left')
        .map((p) => {
          const color = playerColor(p.color_index)
          const badge = badgeFor(p.status)
          const suffix = p.user_id === userId ? ' (you)' : ''
          return (
            <div
              key={p.user_id}
              ref={(el) => registerLabel(p.user_id, el)}
              className="absolute top-0 left-0 flex flex-col items-center whitespace-nowrap will-change-transform"
              style={{ display: 'none' }}
            >
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow"
                style={{ background: 'rgba(15, 23, 42, 0.75)', border: `1.5px solid ${color}` }}
              >
                {p.display_name}
                {suffix}
              </span>
              {badge && <span className="mt-0.5 text-[10px] font-medium text-white drop-shadow">{badge}</span>}
            </div>
          )
        })}
    </>
  )
}
