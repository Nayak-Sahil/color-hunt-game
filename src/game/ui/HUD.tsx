import { useEffect, useRef, useState } from 'react'
import { announceColor, expireRound, friendlyError, nextRound } from '../../lib/api'
import { HINT_SECONDS, HUNTER_DETECT_RANGE, WARNING_SECONDS } from '../map/constants'
import { getAllRemotes, localPosition } from '../net/positionStore'
import { activePlayers, findPlayer, useGameStore } from '../state/gameStore'
import { compassName, formatDistance } from '../state/rules'
import { ANNOUNCE_COLORS, playerColor, type PlayerStatus } from '../state/types'
import { useHudStore } from './hudStore'
import { Minimap } from './Minimap'
import { FullMapOverlay } from './FullMapOverlay'
import { PlayerLabels } from './PlayerLabels'
import { HintCard } from './HintCard'
import { beep } from './sound'

interface Props {
  userId: string
  onLeave: () => void
}

const STATUS_LABEL: Record<PlayerStatus, { text: string; className: string }> = {
  waiting: { text: 'Waiting', className: 'bg-slate-600' },
  searching: { text: 'Searching', className: 'bg-amber-500 text-slate-950' },
  safe: { text: 'Safe', className: 'bg-emerald-500 text-slate-950' },
  hunter: { text: 'Hunter', className: 'bg-rose-500' },
  eliminated: { text: 'Caught', className: 'bg-slate-500' },
  left: { text: 'Left', className: 'bg-slate-700' },
}

export function HUD({ userId, onLeave }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <PlayerLabels userId={userId} />
      <TopBar userId={userId} />
      <NearestPlayerPanel userId={userId} />
      <HunterIndicators userId={userId} />
      <Minimap userId={userId} />
      <ControlsHint />
      <LeaveButton onLeave={onLeave} />
      <ConnectionBadge />
      <ColorPickerModal userId={userId} />
      <WaitingBanner userId={userId} />
      <RoundOverBanner userId={userId} />
      <EndgameAlert />
      <RoundTimerDriver />
      <FullMapOverlay userId={userId} />
      <Toasts />
    </div>
  )
}

function useRemainingSeconds(): number | null {
  const round = useGameStore((s) => s.round)
  const status = useGameStore((s) => s.session?.status)
  const offset = useGameStore((s) => s.serverOffsetMs)
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (status !== 'hunting' || round === null) {
      setRemaining(null)
      return
    }
    const endsAt = new Date(round.ends_at).getTime()
    const tick = () => {
      const serverNow = Date.now() + offset
      setRemaining(Math.max(0, Math.ceil((endsAt - serverNow) / 1000)))
    }
    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [round, status, offset])

  return remaining
}

/** Asks the server to end the round once the timer runs out (server re-validates the time). */
function RoundTimerDriver() {
  const remaining = useRemainingSeconds()
  const round = useGameStore((s) => s.round)
  const session = useGameStore((s) => s.session)
  const requested = useRef<string | null>(null)

  useEffect(() => {
    if (remaining !== 0) return
    if (session === null || round === null) return
    if (session.status !== 'hunting') return
    if (requested.current === round.id) return
    requested.current = round.id
    // Small random delay so five clients do not all fire at once.
    const timer = window.setTimeout(() => {
      expireRound(session.id).catch(() => undefined)
    }, Math.random() * 600)
    return () => window.clearTimeout(timer)
  }, [remaining, round, session])

  return null
}

function TopBar({ userId }: { userId: string }) {
  const session = useGameStore((s) => s.session)
  const round = useGameStore((s) => s.round)
  const me = useGameStore((s) => findPlayer(s.players, userId))
  const remaining = useRemainingSeconds()
  if (session === null || me === null) return null

  const status = STATUS_LABEL[me.status]
  const showColor = session.status === 'hunting' || session.status === 'round_over'
  const minutes = remaining !== null ? Math.floor(remaining / 60) : 0
  const seconds = remaining !== null ? remaining % 60 : 0
  const urgent = remaining !== null && remaining <= WARNING_SECONDS

  return (
    <div className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/15 bg-slate-900/75 px-4 py-2 shadow-lg backdrop-blur">
      <div className="text-sm">
        <span className="text-slate-400">Round</span> <span className="font-semibold">{Math.max(session.round_number, 1)}</span>
      </div>
      <div className="h-6 w-px bg-white/15" />
      {showColor && round !== null ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Find</span>
          <span className="h-5 w-5 rounded-full ring-2 ring-white/40" style={{ background: round.color_hex }} />
          <span className="font-semibold">{round.color_name}</span>
        </div>
      ) : (
        <div className="text-sm text-slate-300">Waiting for the color…</div>
      )}
      <div className="h-6 w-px bg-white/15" />
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${status.className}`}>{status.text}</span>
      {remaining !== null && (
        <>
          <div className="h-6 w-px bg-white/15" />
          <span
            className={`font-mono text-sm tabular-nums ${
              urgent ? 'animate-pulse rounded-md bg-rose-500/25 px-1.5 font-bold text-rose-200' : 'text-slate-200'
            }`}
          >
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </>
      )}
    </div>
  )
}

/** Warns everyone as the round runs out and, in the last seconds, reveals the object's shape. */
function EndgameAlert() {
  const remaining = useRemainingSeconds()
  const round = useGameStore((s) => s.round)
  const status = useGameStore((s) => s.session?.status)
  const lastBeepAt = useRef<number | null>(null)

  useEffect(() => {
    if (remaining === null) return
    if (remaining > 10) return
    if (lastBeepAt.current === remaining) return
    lastBeepAt.current = remaining
    beep(remaining === 0 ? 220 : 880, remaining === 0 ? 500 : 120)
  }, [remaining])

  if (status !== 'hunting' || round === null || remaining === null) return null
  if (remaining > WARNING_SECONDS) return null

  const showHint = remaining <= HINT_SECONDS

  return (
    <div className="absolute top-16 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="animate-pulse rounded-full border border-rose-400/60 bg-rose-600/85 px-4 py-1.5 text-sm font-bold text-white shadow-lg">
        ⚠ Round ends in {remaining}s
      </div>
      {showHint && (
        <HintCard hiddenObjectId={round.hidden_object_id} colorHex={round.color_hex} colorName={round.color_name} />
      )}
    </div>
  )
}

function NearestPlayerPanel({ userId }: { userId: string }) {
  const nearest = useHudStore((s) => s.nearest)
  const session = useGameStore((s) => s.session)
  const isHunter = session?.hunter_id === userId && session?.status === 'hunting'

  return (
    <div className="absolute top-3 right-3 w-44 rounded-xl border border-white/15 bg-slate-900/75 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="text-[10px] uppercase tracking-widest text-slate-400">{isHunter ? 'Nearest target' : 'Nearest player'}</p>
      {nearest === null ? (
        <p className="mt-1 text-slate-300">{isHunter ? `No unsafe player within ${HUNTER_DETECT_RANGE}m` : 'Nobody nearby'}</p>
      ) : (
        <div className="mt-1 space-y-0.5">
          <p className="font-semibold text-slate-100">{nearest.name}</p>
          <p className="text-slate-300">Distance: {formatDistance(nearest.distance)}</p>
          <p className="text-slate-300">Direction: {compassName(nearest.direction)}</p>
        </div>
      )}
    </div>
  )
}

function HunterIndicators({ userId }: { userId: string }) {
  const indicators = useHudStore((s) => s.indicators)
  const session = useGameStore((s) => s.session)
  if (session?.hunter_id !== userId) return null
  if (session.status !== 'hunting') return null

  return (
    <>
      {indicators.map((ind) => (
        <div
          key={ind.userId}
          className="absolute flex flex-col items-center"
          style={{ left: ind.x, top: ind.y, transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/90 text-white shadow-lg ring-2 ring-white/70"
            style={{ transform: `rotate(${ind.angle}rad)` }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2 20 20 12 15 4 20z" />
            </svg>
          </div>
          <span className="mt-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-rose-100">
            {ind.name} · {formatDistance(ind.distance)}
          </span>
        </div>
      ))}
    </>
  )
}

function ColorPickerModal({ userId }: { userId: string }) {
  const session = useGameStore((s) => s.session)
  const showToast = useGameStore((s) => s.showToast)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState(0)
  const busyRef = useRef(false)
  const selectedRef = useRef(0)
  selectedRef.current = selected

  const sessionId = session?.id ?? null
  const open = session?.status === 'choosing_color' && session.hunter_id === userId

  const pick = async (index: number) => {
    if (sessionId === null) return
    if (busyRef.current) return
    const choice = ANNOUNCE_COLORS[index]
    busyRef.current = true
    setBusy(true)
    try {
      const positions = [{ x: localPosition.x, z: localPosition.z }]
      for (const remote of getAllRemotes().values()) {
        positions.push({ x: remote.target.x, z: remote.target.z })
      }
      await announceColor(sessionId, choice.name, choice.hex, positions)
    } catch (e) {
      showToast(friendlyError(e), 'error')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  const pickRef = useRef(pick)
  pickRef.current = pick

  // Arrow keys move the highlight across the 4 by 2 grid; Enter announces it.
  useEffect(() => {
    if (!open) return
    const columns = 4
    const total = ANNOUNCE_COLORS.length
    const onKey = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowLeft':
          setSelected((i) => (i + total - 1) % total)
          break
        case 'ArrowRight':
          setSelected((i) => (i + 1) % total)
          break
        case 'ArrowUp':
        case 'ArrowDown':
          setSelected((i) => (i + columns) % total)
          break
        case 'Enter':
        case 'NumpadEnter':
          void pickRef.current(selectedRef.current)
          break
        default:
          return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900/95 p-6 text-center shadow-2xl">
        <p className="text-xs uppercase tracking-widest text-rose-300">You are the Hunter</p>
        <h2 className="mt-1 text-2xl font-bold">Announce a color</h2>
        <p className="mt-1 text-sm text-slate-400">
          One object somewhere in the neighborhood will turn this color. You will not be told where.
        </p>
        <div className="mt-5 grid grid-cols-4 gap-3">
          {ANNOUNCE_COLORS.map((c, index) => {
            const active = index === selected
            return (
              <button
                key={c.name}
                type="button"
                disabled={busy}
                onMouseEnter={() => setSelected(index)}
                onFocus={() => setSelected(index)}
                onClick={() => pick(index)}
                className={`group flex flex-col items-center gap-1 rounded-xl border bg-slate-800 p-2 transition disabled:opacity-50 ${
                  active ? 'border-white/80 bg-slate-700 ring-2 ring-white/60' : 'border-white/10 hover:border-white/40'
                }`}
              >
                <span
                  className={`h-10 w-10 rounded-full ring-2 ring-white/30 transition ${active ? 'scale-110' : ''}`}
                  style={{ background: c.hex }}
                />
                <span className="text-xs">{c.name}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-4 text-xs text-slate-400">
          {busy ? 'Hiding the object…' : 'Click a color, or use the arrow keys and press Enter.'}
        </p>
      </div>
    </div>
  )
}

function WaitingBanner({ userId }: { userId: string }) {
  const session = useGameStore((s) => s.session)
  const players = useGameStore((s) => s.players)
  if (session === null) return null
  if (session.status !== 'choosing_color') return null
  if (session.hunter_id === userId) return null
  const hunter = findPlayer(players, session.hunter_id)

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 rounded-full border border-rose-400/40 bg-slate-900/80 px-4 py-2 text-sm shadow backdrop-blur">
      <span className="text-rose-300">🎯 {hunter?.display_name ?? 'The Hunter'}</span> is choosing a color. Spread out!
    </div>
  )
}

const ROUND_OVER_SECONDS = 6

function RoundOverBanner({ userId }: { userId: string }) {
  const session = useGameStore((s) => s.session)
  const round = useGameStore((s) => s.round)
  const players = useGameStore((s) => s.players)
  const [countdown, setCountdown] = useState(ROUND_OVER_SECONDS)
  const advanced = useRef<string | null>(null)

  // Only primitives go into the effect below: snapshot refreshes replace the session
  // object several times per round, and the countdown must not restart each time.
  const isRoundOver = session?.status === 'round_over'
  const sessionId = session?.id ?? null
  const roundId = round?.id ?? null
  const nextHunterId = session?.hunter_id ?? null

  useEffect(() => {
    if (!isRoundOver || sessionId === null) return
    setCountdown(ROUND_OVER_SECONDS)
    const started = Date.now()
    const timer = window.setInterval(() => {
      setCountdown(Math.max(0, ROUND_OVER_SECONDS - Math.floor((Date.now() - started) / 1000)))
    }, 250)

    // The next hunter's client advances the round; everyone else is a late fallback.
    const isNextHunter = nextHunterId === userId
    const delay = isNextHunter ? ROUND_OVER_SECONDS * 1000 : ROUND_OVER_SECONDS * 1000 + 3000
    const advance = window.setTimeout(() => {
      if (advanced.current === roundId) return
      advanced.current = roundId
      nextRound(sessionId).catch(() => undefined)
    }, delay)

    return () => {
      window.clearInterval(timer)
      window.clearTimeout(advance)
    }
  }, [isRoundOver, roundId, nextHunterId, userId, sessionId])

  if (!isRoundOver || session === null) return null

  const nameOf = (id: string | null) => findPlayer(players, id)?.display_name ?? 'Someone'
  const reason = round?.end_reason ?? null
  const hunterName = nameOf(round?.hunter_id ?? null)
  const nextHunterName = nameOf(nextHunterId)

  let headline = 'Round over'
  let detail = ''
  if (reason === 'caught') {
    headline = `${hunterName} caught ${nameOf(round?.caught_player_id ?? null)}!`
    detail = `${nextHunterName} is the Hunter next round.`
  } else if (reason === 'all_safe') {
    headline = `Everyone found the ${round?.color_name ?? ''} object!`
    detail = `${hunterName} stays the Hunter.`
  } else if (reason === 'timeout') {
    headline = "Time's up! Nobody was caught."
    detail = `${hunterName} stays the Hunter.`
  } else if (reason === 'hunter_left') {
    headline = 'The Hunter left the game.'
    detail = `${nextHunterName} takes over as the Hunter.`
  }

  const isMeNext = nextHunterId === userId

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/40">
      <div className="rounded-2xl border border-white/15 bg-slate-900/95 px-8 py-6 text-center shadow-2xl">
        <h2 className="text-2xl font-bold">{headline}</h2>
        <p className="mt-2 text-slate-300">{detail}</p>
        {isMeNext && <p className="mt-1 font-semibold text-rose-300">You will be the Hunter. Get ready to pick a color.</p>}
        <p className="mt-4 text-sm text-slate-400">Next round in {countdown}s</p>
        <div className="mt-3 flex justify-center gap-2">
          {activePlayers(players).map((p) => (
            <span key={p.user_id} className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs">
              <i className="inline-block h-2 w-2 rounded-full" style={{ background: playerColor(p.color_index) }} />
              {p.display_name}
              <span className="text-slate-400">· {STATUS_LABEL[p.status].text}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ControlsHint() {
  return (
    <div className="absolute right-3 bottom-4 rounded-lg bg-slate-900/60 px-3 py-1.5 text-[11px] text-slate-300 backdrop-blur">
      ↑ ↓ walk · ← → turn · Alt sprint · Space jump · E, Enter or click inspect · M map
    </div>
  )
}

function LeaveButton({ onLeave }: { onLeave: () => void }) {
  return (
    <button
      type="button"
      onClick={onLeave}
      className="pointer-events-auto absolute top-3 left-3 rounded-lg border border-white/15 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-200 backdrop-blur hover:bg-slate-800"
    >
      ← Leave game
    </button>
  )
}

function ConnectionBadge() {
  const connected = useGameStore((s) => s.connected)
  if (connected) return null
  return (
    <div className="absolute top-14 left-3 rounded-lg bg-amber-500/90 px-3 py-1 text-xs font-semibold text-slate-950">
      Reconnecting to realtime…
    </div>
  )
}

const TOAST_STYLE: Record<string, string> = {
  info: 'bg-slate-800 text-slate-100 border-white/15',
  success: 'bg-emerald-500 text-slate-950 border-emerald-300',
  warning: 'bg-amber-500 text-slate-950 border-amber-300',
  error: 'bg-rose-500 text-white border-rose-300',
  wrong: 'bg-rose-600 text-white border-rose-200 text-base px-6 py-3 font-bold animate-pulse',
}

function Toasts() {
  const toasts = useGameStore((s) => s.toasts)
  return (
    <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`rounded-full border px-4 py-2 text-sm font-medium shadow-lg ${TOAST_STYLE[t.tone]}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}
