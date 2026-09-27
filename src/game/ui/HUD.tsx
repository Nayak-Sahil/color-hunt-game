import { useEffect, useRef, useState } from 'react'
import { announceColor, expireRound, friendlyError, nextRound } from '../../lib/api'
import { HINT_SECONDS, HUNTER_DETECT_RANGE, WARNING_SECONDS } from '../map/constants'
import { getAllRemotes, localPosition } from '../net/positionStore'
import { activePlayers, findPlayer, useGameStore } from '../state/gameStore'
import { compassName, countdownRemaining, formatDistance, type Compass } from '../state/rules'
import { ANNOUNCE_COLORS, playerColor, type PlayerStatus } from '../state/types'
import { useHudStore } from './hudStore'
import { Minimap } from './Minimap'
import { FullMapOverlay } from './FullMapOverlay'
import { PlayerLabels } from './PlayerLabels'
import { HintCard } from './HintCard'
import { isMuted, setMuted, sfx } from './sound'
import { haptics } from './haptics'
import { GameButton } from '../../ui/GameButton'
import { GlassPanel, KeyCap } from '../../ui/GlassPanel'

interface Props {
  userId: string
  onLeave: () => void
}

const STATUS_LABEL: Record<PlayerStatus, { text: string; className: string; icon: string }> = {
  waiting: { text: 'Waiting', className: 'bg-slate-600', icon: '⏳' },
  searching: { text: 'Searching', className: 'bg-amber-400 text-slate-950', icon: '🔎' },
  safe: { text: 'Safe', className: 'bg-emerald-400 text-slate-950', icon: '✅' },
  hunter: { text: 'Hunter', className: 'bg-rose-500', icon: '🎯' },
  eliminated: { text: 'Caught', className: 'bg-slate-500', icon: '💀' },
  left: { text: 'Left', className: 'bg-slate-700', icon: '🚪' },
}

const COMPASS_ANGLE: Record<Compass, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 }

export function HUD({ userId, onLeave }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 select-none font-sans">
      <PlayerLabels userId={userId} />
      <TopBar userId={userId} />
      <NearestPlayerPanel userId={userId} />
      <HunterIndicators userId={userId} />
      <Minimap userId={userId} />
      <ControlsHint />
      <TopLeftControls onLeave={onLeave} />
      <ConnectionBadge />
      <WaitingOverlay userId={userId} />
      <ColorPickerModal userId={userId} />
      <CountdownOverlay />
      <RoundOverBanner userId={userId} />
      <EndgameAlert />
      <RoundTimerDriver />
      <GameSoundDriver userId={userId} />
      <FullMapOverlay userId={userId} />
      <Toasts />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timer helpers
// ---------------------------------------------------------------------------

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

/** Plays sounds for game state transitions so every client hears the same beats. */
function GameSoundDriver({ userId }: { userId: string }) {
  const status = useGameStore((s) => s.session?.status)
  const hunterId = useGameStore((s) => s.session?.hunter_id)
  const endReason = useGameStore((s) => s.round?.end_reason ?? null)
  const caughtId = useGameStore((s) => s.round?.caught_player_id ?? null)
  const playerCount = useGameStore((s) => activePlayers(s.players).length)
  const prevStatus = useRef(status)
  const prevCount = useRef(playerCount)

  useEffect(() => {
    const prev = prevStatus.current
    prevStatus.current = status
    if (prev === status) return
    if (prev === undefined) return
    if (status === 'choosing_color' && prev === 'lobby') sfx.gameStart()
    if (status === 'hunting') sfx.announce()
    if (status !== 'round_over') return
    if (endReason === 'caught') {
      if (caughtId === userId) {
        sfx.caught()
        haptics.caught()
        return
      }
      if (hunterId === caughtId) {
        // hunter_id already points at the next hunter; the catcher is the previous one.
        sfx.tag()
        return
      }
      sfx.caught()
      return
    }
    if (endReason === 'all_safe') sfx.safe()
    if (endReason === 'timeout') sfx.timeUp()
  }, [status, endReason, caughtId, hunterId, userId])

  useEffect(() => {
    const prev = prevCount.current
    prevCount.current = playerCount
    if (playerCount > prev && status === 'lobby') sfx.playerJoined()
  }, [playerCount, status])

  return null
}

// ---------------------------------------------------------------------------
// Top bar, side panels, controls
// ---------------------------------------------------------------------------

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
    <div className="absolute top-3 left-1/2 flex -translate-x-1/2 items-stretch overflow-hidden rounded-2xl border border-white/15 bg-slate-950/70 shadow-[0_10px_30px_rgba(2,6,23,0.6)] backdrop-blur-xl animate-fade-up">
      <div className="flex flex-col items-center justify-center bg-white/5 px-4 py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Round</span>
        <span className="font-display text-xl font-bold leading-none">{Math.max(session.round_number, 1)}</span>
      </div>
      <div className="flex items-center gap-3 px-4 py-1.5">
        {showColor && round !== null ? (
          <>
            <span className="orb h-8 w-8" style={{ background: round.color_hex }} />
            <div className="leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Find</p>
              <p className="font-display text-lg font-bold">{round.color_name}</p>
            </div>
          </>
        ) : (
          <p className="text-sm font-semibold text-slate-300">
            Waiting for the color<span className="animated-dots" />
          </p>
        )}
      </div>
      <div className="flex items-center px-3">
        <span className={`rounded-full px-3 py-1 font-display text-xs font-bold uppercase tracking-wider ${status.className}`}>
          {status.icon} {status.text}
        </span>
      </div>
      {remaining !== null && (
        <div className={`flex items-center gap-1.5 px-4 font-mono text-lg font-bold tabular-nums ${urgent ? 'animate-pulse bg-rose-500/30 text-rose-100' : 'bg-white/5 text-slate-100'}`}>
          <span className="text-base">⏱</span>
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
      )}
    </div>
  )
}

function NearestPlayerPanel({ userId }: { userId: string }) {
  const nearest = useHudStore((s) => s.nearest)
  const session = useGameStore((s) => s.session)
  const isHunter = session?.hunter_id === userId && session?.status === 'hunting'

  return (
    <div className="absolute top-3 right-3 w-52 rounded-2xl border border-white/15 bg-slate-950/70 px-3 py-2.5 shadow-lg backdrop-blur-xl animate-fade-up">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">{isHunter ? '🎯 Nearest target' : '📡 Nearest player'}</p>
      {nearest === null ? (
        <p className="mt-1 text-sm text-slate-300">{isHunter ? `Nobody within ${HUNTER_DETECT_RANGE}m` : 'Nobody nearby'}</p>
      ) : (
        <div className="mt-1 flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5"
            style={{ transform: `rotate(${COMPASS_ANGLE[nearest.direction]}deg)` }}
            title={compassName(nearest.direction)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isHunter ? '#fb7185' : '#67e8f9'} aria-hidden>
              <path d="M12 2 19 21 12 16 5 21z" />
            </svg>
          </div>
          <div className="leading-tight">
            <p className="font-display text-base font-bold text-slate-100">{nearest.name}</p>
            <p className="text-xs text-slate-300">
              {formatDistance(nearest.distance)} · {compassName(nearest.direction)}
            </p>
          </div>
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
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-rose-500/60 animate-ring" />
            <div
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg ring-2 ring-white/80"
              style={{ transform: `rotate(${ind.angle}rad)` }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2 20 20 12 15 4 20z" />
              </svg>
            </div>
          </div>
          <span className="mt-1 rounded-full bg-slate-950/85 px-2 py-0.5 font-display text-[11px] font-bold text-rose-100">
            {ind.name} · {formatDistance(ind.distance)}
          </span>
        </div>
      ))}
    </>
  )
}

function ControlsHint() {
  return (
    <div className="absolute right-3 bottom-4 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 rounded-xl bg-slate-950/60 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
      <span className="flex items-center gap-1"><KeyCap>↑</KeyCap><KeyCap>↓</KeyCap> walk</span>
      <span className="flex items-center gap-1"><KeyCap>←</KeyCap><KeyCap>→</KeyCap> turn</span>
      <span className="flex items-center gap-1"><KeyCap>Alt</KeyCap> sprint</span>
      <span className="flex items-center gap-1"><KeyCap>Space</KeyCap> jump</span>
      <span className="flex items-center gap-1"><KeyCap>E</KeyCap> inspect</span>
      <span className="flex items-center gap-1"><KeyCap>M</KeyCap> map</span>
    </div>
  )
}

function TopLeftControls({ onLeave }: { onLeave: () => void }) {
  const [muted, setMutedState] = useState(isMuted())
  const toggle = () => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }
  return (
    <div className="pointer-events-auto absolute top-3 left-3 flex gap-2">
      <GameButton variant="secondary" size="sm" onClick={onLeave}>
        ⟵ Leave
      </GameButton>
      <GameButton variant="secondary" size="sm" onClick={toggle} title={muted ? 'Unmute' : 'Mute'}>
        {muted ? '🔇' : '🔊'}
      </GameButton>
    </div>
  )
}

function ConnectionBadge() {
  const connected = useGameStore((s) => s.connected)
  if (connected) return null
  return (
    <div className="absolute top-14 left-3 rounded-lg bg-amber-400/95 px-3 py-1 text-xs font-bold text-slate-950 animate-pulse">
      Reconnecting to realtime…
    </div>
  )
}

// ---------------------------------------------------------------------------
// Phase overlays
// ---------------------------------------------------------------------------

/** Non-hunters are frozen and blurred out while the Hunter picks. */
function WaitingOverlay({ userId }: { userId: string }) {
  const session = useGameStore((s) => s.session)
  const players = useGameStore((s) => s.players)
  if (session === null) return null
  if (session.status !== 'choosing_color') return null
  if (session.hunter_id === userId) return null
  const hunter = findPlayer(players, session.hunter_id)
  const color = hunter ? playerColor(hunter.color_index) : '#f43f5e'

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-slate-950/55 backdrop-blur-md">
      <GlassPanel glow="pink" className="w-full max-w-md px-8 py-8 text-center animate-pop">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl shadow-lg animate-float" style={{ background: color }}>
          🎯
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.3em] text-rose-300">Hold still</p>
        <h2 className="mt-1 font-display text-3xl font-bold">
          {hunter?.display_name ?? 'The Hunter'} is choosing a color<span className="animated-dots" />
        </h2>
        <p className="mt-3 text-sm text-slate-300">
          Everyone is frozen until the color is announced. Then a countdown, then run!
        </p>
        <div className="mt-5 flex justify-center gap-2">
          {ANNOUNCE_COLORS.map((c, i) => (
            <span key={c.name} className="orb h-5 w-5 animate-float" style={{ background: c.hex, animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </GlassPanel>
    </div>
  )
}

/** 3, 2, 1, GO shown to everyone in sync once the color is announced. */
function CountdownOverlay() {
  const round = useGameStore((s) => s.round)
  const status = useGameStore((s) => s.session?.status)
  const offset = useGameStore((s) => s.serverOffsetMs)
  const [shown, setShown] = useState<number | null>(null)
  const lastShown = useRef<number | null>(null)
  const roundId = round?.id ?? null
  const startedAt = round?.started_at ?? null

  useEffect(() => {
    if (status !== 'hunting' || startedAt === null) {
      setShown(null)
      lastShown.current = null
      return
    }
    const tick = () => {
      const current = useGameStore.getState().round
      const remaining = countdownRemaining(current, offset)
      const elapsed = (Date.now() + offset - new Date(startedAt).getTime()) / 1000
      let next: number | null = null
      if (remaining > 0) next = Math.ceil(remaining)
      else if (elapsed < 3.9) next = 0
      if (next !== lastShown.current) {
        lastShown.current = next
        setShown(next)
        if (next !== null) {
          sfx.countdown(next)
          if (next === 0) haptics.go()
          else haptics.tick()
        }
      }
    }
    tick()
    const timer = window.setInterval(tick, 50)
    return () => window.clearInterval(timer)
  }, [status, roundId, startedAt, offset])

  if (shown === null) return null
  const go = shown === 0

  return (
    <div className={`absolute inset-0 z-20 flex items-center justify-center ${go ? '' : 'bg-slate-950/35'}`}>
      <div key={shown} className="flex flex-col items-center animate-countdown">
        <span
          className={`font-display font-bold leading-none drop-shadow-[0_8px_0_rgba(0,0,0,0.45)] ${go ? 'text-[9rem] text-emerald-300' : 'text-[11rem] text-white'}`}
        >
          {go ? 'GO!' : shown}
        </span>
        {!go && <span className="mt-2 text-lg font-bold uppercase tracking-[0.4em] text-slate-200">Get ready</span>}
      </div>
    </div>
  )
}

/** Warns everyone as the round runs out and, in the last seconds, reveals the object's shape. */
function EndgameAlert() {
  const remaining = useRemainingSeconds()
  const round = useGameStore((s) => s.round)
  const status = useGameStore((s) => s.session?.status)
  const lastTickAt = useRef<number | null>(null)

  useEffect(() => {
    if (remaining === null) return
    if (remaining > 10) return
    if (lastTickAt.current === remaining) return
    lastTickAt.current = remaining
    if (remaining === 0) return
    sfx.tick()
    haptics.tick()
  }, [remaining])

  if (status !== 'hunting' || round === null || remaining === null) return null
  if (remaining > WARNING_SECONDS) return null

  const showHint = remaining <= HINT_SECONDS

  return (
    <div className="absolute top-20 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="animate-pulse rounded-full border border-rose-300/70 bg-rose-600/90 px-5 py-1.5 font-display text-base font-bold text-white shadow-lg">
        ⚠ Round ends in {remaining}s
      </div>
      {showHint && (
        <div className="animate-pop">
          <HintCard hiddenObjectId={round.hidden_object_id} colorHex={round.color_hex} colorName={round.color_name} />
        </div>
      )}
    </div>
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
    sfx.select()
    haptics.tap()
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
    const moveTo = (update: (i: number) => number) => {
      setSelected((i) => update(i))
      sfx.move()
    }
    const onKey = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowLeft':
          moveTo((i) => (i + total - 1) % total)
          break
        case 'ArrowRight':
          moveTo((i) => (i + 1) % total)
          break
        case 'ArrowUp':
        case 'ArrowDown':
          moveTo((i) => (i + columns) % total)
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
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-slate-950/55 backdrop-blur-md">
      <GlassPanel glow="cyan" className="w-full max-w-lg px-8 py-7 text-center animate-pop">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-rose-300">🎯 You are the Hunter</p>
        <h2 className="mt-1 font-display text-3xl font-bold">Announce a color</h2>
        <p className="mt-2 text-sm text-slate-300">
          One object somewhere in the neighborhood will turn this color. Not even you will know where.
        </p>
        <div className="mt-6 grid grid-cols-4 gap-4">
          {ANNOUNCE_COLORS.map((c, index) => {
            const active = index === selected
            return (
              <button
                key={c.name}
                type="button"
                disabled={busy}
                onMouseEnter={() => {
                  if (!active) sfx.hover()
                  setSelected(index)
                }}
                onFocus={() => setSelected(index)}
                onClick={() => pick(index)}
                className={`group relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all duration-150 disabled:opacity-50 ${
                  active ? 'scale-110 border-white/70 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                {active && <span className="absolute inset-0 rounded-2xl ring-2 ring-white/70 animate-ring" />}
                <span className="orb h-14 w-14" style={{ background: c.hex }} />
                <span className="font-display text-sm font-bold">{c.name}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400">
          <KeyCap>←</KeyCap><KeyCap>→</KeyCap> choose · <KeyCap>Enter</KeyCap> announce · or click
        </p>
        {busy && <p className="mt-2 text-sm font-semibold text-cyan-300 animate-pulse">Hiding the object…</p>}
      </GlassPanel>
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
  const nextHunter = findPlayer(players, nextHunterId)

  let icon = '🏁'
  let headline = 'Round over'
  let detail = ''
  if (reason === 'caught') {
    icon = '💥'
    headline = `${hunterName} caught ${nameOf(round?.caught_player_id ?? null)}!`
    detail = `${nextHunterName} is the Hunter next round.`
  } else if (reason === 'all_safe') {
    icon = '🎉'
    headline = `Everyone found the ${round?.color_name ?? ''} object!`
    detail = `${hunterName} stays the Hunter.`
  } else if (reason === 'timeout') {
    icon = '⏰'
    headline = "Time's up! Nobody was caught."
    detail = `${hunterName} stays the Hunter.`
  } else if (reason === 'hunter_left') {
    icon = '🚪'
    headline = 'The Hunter left the game.'
    detail = `${nextHunterName} takes over as the Hunter.`
  }

  const isMeNext = nextHunterId === userId

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm">
      <GlassPanel glow="amber" className="max-w-lg px-10 py-8 text-center animate-pop">
        <div className="text-5xl animate-float">{icon}</div>
        <h2 className="mt-3 font-display text-3xl font-bold">{headline}</h2>
        <p className="mt-2 text-slate-300">{detail}</p>
        {isMeNext && (
          <p className="mt-2 rounded-full bg-rose-500/20 px-3 py-1 font-display text-sm font-bold text-rose-200">
            You will be the Hunter. Get ready to pick a color.
          </p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          {activePlayers(players).map((p) => (
            <span key={p.user_id} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs">
              <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: playerColor(p.color_index) }} />
              <span className="font-semibold">{p.display_name}</span>
              <span className="text-slate-400">{STATUS_LABEL[p.status].icon}</span>
            </span>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-center gap-3 text-sm text-slate-400">
          {nextHunter && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs" style={{ background: playerColor(nextHunter.color_index) }}>
              🎯
            </span>
          )}
          Next round in <span className="font-display text-lg font-bold text-white">{countdown}</span>s
        </div>
      </GlassPanel>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

const TOAST_STYLE: Record<string, string> = {
  info: 'bg-slate-900/90 text-slate-100 border-white/15',
  success: 'bg-emerald-400 text-slate-950 border-emerald-200',
  warning: 'bg-amber-400 text-slate-950 border-amber-200',
  error: 'bg-rose-500 text-white border-rose-300',
  wrong: 'bg-rose-600 text-white border-rose-200 text-lg px-7 py-3.5 animate-shake',
}

const TOAST_ICON: Record<string, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '⛔',
  wrong: '❌',
}

function Toasts() {
  const toasts = useGameStore((s) => s.toasts)
  return (
    <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 rounded-full border px-5 py-2 font-display text-sm font-bold shadow-xl animate-fade-up ${TOAST_STYLE[t.tone]}`}
        >
          <span>{TOAST_ICON[t.tone]}</span>
          <span>{t.text.replace(/^[❌✅]\s*/, '')}</span>
        </div>
      ))}
    </div>
  )
}
