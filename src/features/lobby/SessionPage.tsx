import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { Session } from '@supabase/supabase-js'
import { leaveSession } from '../../lib/api'
import { useGameChannel } from '../../game/net/useGameChannel'
import { findPlayer, useGameStore } from '../../game/state/gameStore'
import { GameCanvas } from '../../game/scene/GameCanvas'
import { HUD } from '../../game/ui/HUD'
import { LobbyPanel } from './LobbyPanel'

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

  if (error !== null) {
    return (
      <CenteredMessage title="Cannot open this session" detail={error}>
        <button type="button" onClick={() => navigate('/')} className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950">
          Back home
        </button>
      </CenteredMessage>
    )
  }

  if (game === null || me === null) {
    return <CenteredMessage title="Joining session…" detail="Connecting to the neighborhood." />
  }

  if (me.status === 'left') {
    return (
      <CenteredMessage title="You left this session" detail="Join again with the code if the game has not started yet.">
        <button type="button" onClick={() => navigate('/')} className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950">
          Back home
        </button>
      </CenteredMessage>
    )
  }

  if (game.status === 'lobby') {
    return <LobbyPanel userId={userId} onLeave={onLeave} />
  }

  if (game.status === 'finished') {
    return (
      <CenteredMessage title="Game over" detail="The session ended because fewer than two players remain.">
        <button type="button" onClick={() => navigate('/')} className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950">
          Back home
        </button>
      </CenteredMessage>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GameCanvas userId={userId} />
      <HUD userId={userId} onLeave={onLeave} />
    </div>
  )
}

function CenteredMessage({ title, detail, children }: { title: string; detail: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_#1e293b,_#0f172a_60%)] p-6">
      <div className="max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-8 text-center shadow-2xl">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{detail}</p>
        {children && <div className="mt-5">{children}</div>}
      </div>
    </div>
  )
}
