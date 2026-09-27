import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { createSession, friendlyError, joinSession } from '../../lib/api'
import { displayNameOf } from '../auth/useAuth'
import { LazyShowcase, prefetchGame } from '../../ui/LazyShowcase'
import { GlassPanel, KeyCap, Logo } from '../../ui/GlassPanel'
import { GameButton } from '../../ui/GameButton'
import { sfx } from '../../game/ui/sound'

interface Props {
  session: Session
}

const STEPS = [
  { icon: '🎯', title: 'Hunter picks', text: 'One player announces a color.' },
  { icon: '🎨', title: 'Object hides', text: 'One object in the neighborhood turns that color.' },
  { icon: '🔎', title: 'Search', text: 'Find it and click it to become Safe.' },
  { icon: '🏃', title: 'Run', text: 'Get tagged by the Hunter and you hunt next.' },
]

export function HomePage({ session }: Props) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Warm the 3D chunk while the player reads the home screen.
  useEffect(() => {
    prefetchGame()
  }, [])

  const onCreate = async () => {
    setError(null)
    setBusy('create')
    try {
      const created = await createSession()
      sfx.select()
      navigate(`/play/${created.id}`)
    } catch (e) {
      sfx.wrong()
      setError(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  const onJoin = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy('join')
    try {
      const joined = await joinSession(code)
      sfx.select()
      navigate(`/play/${joined.id}`)
    } catch (e) {
      sfx.wrong()
      setError(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative isolate flex min-h-full items-center justify-center overflow-hidden p-6">
      <LazyShowcase />
      <div className="w-full max-w-4xl">
        <header className="mb-6 flex items-center justify-between animate-fade-up">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-white/15 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-200 sm:inline">
              👋 {displayNameOf(session)}
            </span>
            <GameButton variant="secondary" size="sm" onClick={() => supabase.auth.signOut()}>
              Sign out
            </GameButton>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <GlassPanel glow="cyan" className="p-6 animate-pop">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Host</p>
            <h2 className="mt-1 font-display text-2xl font-bold">Create a session</h2>
            <p className="mt-1 text-sm text-slate-300">Get a 6 letter code and invite up to 4 friends.</p>
            <GameButton size="lg" onClick={onCreate} disabled={busy !== null} className="mt-5 w-full">
              {busy === 'create' ? 'Creating…' : '🏠 Create session'}
            </GameButton>
          </GlassPanel>

          <GlassPanel glow="pink" className="p-6 animate-pop" style={{ animationDelay: '0.08s' }}>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-pink-300">Join</p>
            <h2 className="mt-1 font-display text-2xl font-bold">Enter a code</h2>
            <p className="mt-1 text-sm text-slate-300">Ask the host for their session code.</p>
            <form onSubmit={onJoin} className="mt-5 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="ABC123"
                maxLength={6}
                className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-2 text-center font-mono text-2xl font-bold tracking-[0.4em] uppercase outline-none transition focus:border-pink-300 focus:shadow-[0_0_0_3px_rgba(244,114,182,0.25)]"
                required
              />
              <GameButton type="submit" variant="danger" disabled={busy !== null || code.length < 6}>
                {busy === 'join' ? '…' : 'Join'}
              </GameButton>
            </form>
          </GlassPanel>
        </div>

        {error && <p className="mt-4 rounded-xl bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-200 animate-shake">{error}</p>}

        <GlassPanel glow="none" className="mt-4 p-5 animate-fade-up" style={{ animationDelay: '0.16s' }}>
          <div className="grid gap-3 sm:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.title} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{step.icon}</span>
                  <span className="font-display text-xs font-bold text-slate-400">STEP {i + 1}</span>
                </div>
                <p className="mt-1 font-display font-bold">{step.title}</p>
                <p className="text-xs text-slate-300">{step.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="flex items-center gap-1"><KeyCap>↑</KeyCap><KeyCap>↓</KeyCap> walk</span>
            <span className="flex items-center gap-1"><KeyCap>←</KeyCap><KeyCap>→</KeyCap> turn</span>
            <span className="flex items-center gap-1"><KeyCap>Alt</KeyCap> sprint</span>
            <span className="flex items-center gap-1"><KeyCap>Space</KeyCap> hop over cars and hedges</span>
            <span className="flex items-center gap-1"><KeyCap>E</KeyCap> inspect</span>
            <span className="flex items-center gap-1"><KeyCap>M</KeyCap> map</span>
          </p>
        </GlassPanel>
      </div>
    </div>
  )
}
