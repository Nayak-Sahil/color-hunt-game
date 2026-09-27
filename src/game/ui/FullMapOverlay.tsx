import { useEffect } from 'react'
import { useGameStore } from '../state/gameStore'
import { MapCanvas } from './Minimap'

export function FullMapOverlay({ userId }: { userId: string }) {
  const open = useGameStore((s) => s.fullMapOpen)
  const setFullMapOpen = useGameStore((s) => s.setFullMapOpen)
  const session = useGameStore((s) => s.session)
  const isHunter = session?.hunter_id === userId && session?.status === 'hunting'

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.code === 'KeyM') {
        setFullMapOpen(!useGameStore.getState().fullMapOpen)
        return
      }
      if (event.code === 'Escape') setFullMapOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setFullMapOpen])

  if (!open) return null

  const size = Math.min(640, Math.min(window.innerWidth, window.innerHeight) - 120)

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
      onClick={() => setFullMapOpen(false)}
    >
      <div
        className="rounded-2xl border border-white/15 bg-slate-900/95 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Neighborhood map</h2>
            <p className="text-xs text-slate-400">
              {isHunter ? 'Unsafe players within your detection range are shown in red.' : 'Your position and the Hunter are shown.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFullMapOpen(false)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Close (Esc)
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/10">
          <MapCanvas userId={userId} full size={size} />
        </div>
        <div className="mt-3 flex gap-4 text-xs text-slate-300">
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400" /> You</span>
          {isHunter && <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" /> Unsafe player nearby</span>}
          {!isHunter && <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500 ring-1 ring-white" /> Hunter</span>}
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#4f9a4a]" /> Park</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#8d867b]" /> Plaza</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#c9bfae]" /> House</span>
        </div>
      </div>
    </div>
  )
}
