import { useState } from 'react'
import { friendlyError, startGame } from '../../lib/api'
import { activePlayers, useGameStore } from '../../game/state/gameStore'
import { playerColor } from '../../game/state/types'
import { ShowcaseBackground } from '../../ui/ShowcaseBackground'
import { GlassPanel, Logo } from '../../ui/GlassPanel'
import { GameButton } from '../../ui/GameButton'
import { sfx } from '../../game/ui/sound'

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
  const emptySlots = Math.max(0, session.max_players - active.length)

  const onStart = async () => {
    setError(null)
    setBusy(true)
    try {
      await startGame(session.id)
    } catch (e) {
      sfx.wrong()
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(session.code)
      sfx.select()
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="relative isolate flex min-h-full items-center justify-center overflow-hidden p-6">
      <ShowcaseBackground />
      <div className="w-full max-w-2xl">
        <div className="mb-5 flex items-center justify-between animate-fade-up">
          <Logo size="sm" />
          <span className="flex items-center gap-2 text-xs text-slate-300">
            <i className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-amber-400 animate-pulse'}`} />
            {connected ? 'Connected' : 'Connecting…'}
          </span>
        </div>

        <GlassPanel className="p-8 animate-pop">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Session code · click to copy</p>
            <button type="button" onClick={copyCode} title="Copy code" className="mt-3 inline-flex gap-2">
              {session.code.split('').map((ch, i) => (
                <span
                  key={i}
                  className="flex h-14 w-11 items-center justify-center rounded-xl border border-cyan-300/40 bg-slate-950/70 font-mono text-3xl font-bold text-cyan-200 shadow-[0_4px_0_rgba(8,145,178,0.5)] transition hover:-translate-y-0.5"
                >
                  {ch}
                </span>
              ))}
            </button>
            <p className="mt-2 h-4 text-xs font-semibold text-emerald-300">{copied ? 'Copied to clipboard!' : ''}</p>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="font-display font-bold text-slate-200">Players</span>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold">
                {active.length} / {session.max_players}
              </span>
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {active.map((p, i) => (
                <li
                  key={p.user_id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 animate-fade-up"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full font-display text-lg font-bold text-slate-950 shadow-lg ring-2 ring-white/30"
                    style={{ background: playerColor(p.color_index) }}
                  >
                    {p.display_name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="leading-tight">
                    <p className="font-display font-bold">
                      {p.display_name}
                      {p.user_id === userId && <span className="ml-1 text-xs font-normal text-slate-400">(you)</span>}
                    </p>
                    {p.user_id === session.host_id && <p className="text-xs font-semibold text-amber-300">👑 Host</p>}
                  </div>
                </li>
              ))}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <li key={`empty-${i}`} className="flex items-center gap-3 rounded-2xl border border-dashed border-white/15 px-3 py-2.5 text-slate-500">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/20 text-lg">?</span>
                  <span className="text-sm">
                    Waiting for a player<span className="animated-dots" />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {error && <p className="mt-4 rounded-xl bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-200 animate-shake">{error}</p>}

          <div className="mt-6 flex gap-3">
            <GameButton variant="secondary" onClick={onLeave}>
              ⟵ Leave
            </GameButton>
            {isHost ? (
              <GameButton size="lg" onClick={onStart} disabled={!canStart || busy} className="flex-1">
                {busy ? 'Starting…' : active.length < 2 ? 'Need one more player…' : '▶ Start game'}
              </GameButton>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-display text-sm font-bold text-slate-300">
                Waiting for the host to start<span className="animated-dots" />
              </div>
            )}
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
