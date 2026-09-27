import { useState } from 'react'
import { friendlyError, startGame } from '../../lib/api'
import { activePlayers, useGameStore } from '../../game/state/gameStore'
import { playerColor } from '../../game/state/types'

interface Props {
  userId: string
  onLeave: () => void
}

export function LobbyPanel({ userId, onLeave }: Props) {
  const session = useGameStore((s) => s.session)
  const players = useGameStore((s) => s.players)
  const connected = useGameStore((s) => s.connected)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (session === null) return null

  const active = activePlayers(players)
  const isHost = session.host_id === userId
  const canStart = isHost && active.length >= 2

  const onStart = async () => {
    setError(null)
    setBusy(true)
    try {
      await startGame(session.id)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(session.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_#1e293b,_#0f172a_60%)] p-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-slate-400">Session code</p>
          <button
            type="button"
            onClick={copyCode}
            title="Copy code"
            className="mt-1 font-mono text-4xl font-bold tracking-[0.35em] text-cyan-300 hover:text-cyan-200"
          >
            {session.code}
          </button>
          <p className="mt-1 h-4 text-xs text-slate-500">{copied ? 'Copied!' : 'Click to copy and share'}</p>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>Players</span>
            <span>
              {active.length} / {session.max_players}
            </span>
          </div>
          <ul className="mt-2 space-y-2">
            {active.map((p) => (
              <li key={p.user_id} className="flex items-center gap-3 rounded-lg bg-slate-800/80 px-3 py-2">
                <span className="h-4 w-4 rounded-full ring-2 ring-white/20" style={{ background: playerColor(p.color_index) }} />
                <span className="font-medium">{p.display_name}</span>
                {p.user_id === session.host_id && <span className="text-xs text-amber-300">Host</span>}
                {p.user_id === userId && <span className="text-xs text-slate-400">(you)</span>}
              </li>
            ))}
          </ul>
        </div>

        {error && <p className="mt-4 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-300">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onLeave}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Leave
          </button>
          {isHost ? (
            <button
              type="button"
              onClick={onStart}
              disabled={!canStart || busy}
              className="flex-1 rounded-lg bg-cyan-500 py-2 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {busy ? 'Starting…' : active.length < 2 ? 'Waiting for players…' : 'Start game'}
            </button>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg bg-slate-800 text-sm text-slate-300">
              Waiting for the host to start…
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          {connected ? 'Connected to realtime' : 'Connecting…'}
        </p>
      </div>
    </div>
  )
}
