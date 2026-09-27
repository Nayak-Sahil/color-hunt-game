import { lazy, Suspense, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { Session } from '@supabase/supabase-js'
import { leaveSession } from '../../lib/api'
import { useGameChannel } from '../../game/net/useGameChannel'
import { findPlayer, useGameStore } from '../../game/state/gameStore'
import { LobbyPanel } from './LobbyPanel'
import { LazyShowcase } from '../../ui/LazyShowcase'
import { GlassPanel } from '../../ui/GlassPanel'
import { GameButton } from '../../ui/GameButton'

// The 3D engine only loads when a game actually starts (or is prefetched from the home screen).
const GameView = lazy(() => import('../../game/GameView'))

interface Props {
  session: Session
}

export function SessionPage({ session }: Props) {
  const { sessionId } = useParams<{ sessionId: string }>()
  if (!sessionId) return null
  return <SessionView sessionId={sessionId} userId={session.user.id} />
}

function SessionView({ sessionId, userId }: { sessionId: string; userId: string }) {
  const navigate = useNavigate()
  const { error } = useGameChannel(sessionId, userId)
  const game = useGameStore((s) => s.session)
  const me = useGameStore((s) => findPlayer(s.players, userId))

  const onLeave = useCallback(async () => {
    try {
      await leaveSession(sessionId)
    } finally {
      navigate('/')
    }
  }, [navigate, sessionId])

  const home = <GameButton onClick={() => navigate('/')}>⟵ Back home</GameButton>

  if (error !== null) {
    return (
      <CenteredMessage icon="🚧" title="Cannot open this session" detail={error}>
        {home}
      </CenteredMessage>
    )
  }

  if (game === null || me === null) {
    return <CenteredMessage icon="🛰️" title="Joining session…" detail="Connecting to the neighborhood." plain />
  }

  if (me.status === 'left') {
    return (
      <CenteredMessage icon="🚪" title="You left this session" detail="Join again with the code if the game has not started yet.">
        {home}
      </CenteredMessage>
    )
  }

  if (game.status === 'lobby') {
    return <LobbyPanel userId={userId} onLeave={onLeave} />
  }

  if (game.status === 'finished') {
    return (
      <CenteredMessage icon="🏁" title="Game over" detail="The session ended because fewer than two players remain.">
        {home}
      </CenteredMessage>
    )
  }

  return (
    <Suspense fallback={<CenteredMessage icon="🏘️" title="Loading the neighborhood…" detail="Warming up the 3D engine." plain />}>
      <GameView userId={userId} onLeave={onLeave} />
    </Suspense>
  )
}

interface MessageProps {
  icon: string
  title: string
  detail: string
  /** Skip the 3D backdrop for short transitional screens. */
  plain?: boolean
  children?: React.ReactNode
}

function CenteredMessage({ icon, title, detail, plain = false, children }: MessageProps) {
  return (
    <div className="relative isolate flex min-h-full items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,_#1e293b,_#0b1120_60%)] p-6">
      {!plain && <LazyShowcase />}
      <GlassPanel className="max-w-md p-8 text-center animate-pop">
        <div className="text-5xl animate-float">{icon}</div>
        <h1 className="mt-3 font-display text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-slate-300">{detail}</p>
        {children && <div className="mt-5">{children}</div>}
      </GlassPanel>
    </div>
  )
}
