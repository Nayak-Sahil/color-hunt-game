import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { createSession, friendlyError, joinSession } from '../../lib/api'
import { displayNameOf } from '../auth/useAuth'

interface Props {
  session: Session
}

export function HomePage({ session }: Props) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onCreate = async () => {
    setError(null)
    setBusy('create')
    try {
      const created = await createSession()
      navigate(`/play/${created.id}`)
    } catch (e) {
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
      navigate(`/play/${joined.id}`)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_#1e293b,_#0f172a_60%)] p-6">
      <div className="w-full max-w-3xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Color Hunt</h1>
            <p className="text-sm text-slate-400">Signed in as {displayNameOf(session)}</p>
          </div>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
          >
            Sign out
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold">Host a game</h2>
            <p className="mt-1 text-sm text-slate-400">Create a session and share the 6 letter code. Up to 5 players.</p>
            <button
              type="button"
              onClick={onCreate}
              disabled={busy !== null}
              className="mt-4 w-full rounded-lg bg-cyan-500 py-2 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {busy === 'create' ? 'Creating…' : 'Create session'}
            </button>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold">Join a game</h2>
            <p className="mt-1 text-sm text-slate-400">Enter the code your host shared.</p>
            <form onSubmit={onJoin} className="mt-4 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 font-mono text-lg tracking-[0.3em] uppercase outline-none focus:border-cyan-400"
                required
              />
              <button
                type="submit"
                disabled={busy !== null || code.length < 6}
                className="rounded-lg bg-pink-500 px-4 font-semibold text-slate-950 hover:bg-pink-400 disabled:opacity-50"
              >
                {busy === 'join' ? '…' : 'Join'}
              </button>
            </form>
          </section>
        </div>

        {error && <p className="mt-4 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-300">{error}</p>}

        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
          <h3 className="font-semibold text-slate-100">How to play</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>One player is the Hunter and announces a color.</li>
            <li>Somewhere in the neighborhood, one object secretly turns that color.</li>
            <li>Find it and click it to become Safe. The Hunter chases anyone still searching.</li>
            <li>Get tagged by the Hunter and the round ends. You are the next Hunter.</li>
          </ol>
          <p className="mt-3 text-slate-400">Controls: arrow keys to walk and turn, hold Alt to sprint, Space to hop over small objects, E, Enter or click to inspect an object, M for the full map.</p>
        </section>
      </div>
    </div>
  )
}
