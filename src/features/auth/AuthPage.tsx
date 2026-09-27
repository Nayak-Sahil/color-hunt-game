import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

type Mode = 'sign-in' | 'sign-up'

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'sign-in') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) setError(signInError.message)
        return
      }

      const trimmed = displayName.trim()
      if (trimmed.length < 2 || trimmed.length > 24) {
        setError('Display name must be between 2 and 24 characters.')
        return
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: trimmed } },
      })
      if (signUpError) {
        setError(signUpError.message)
        return
      }
      if (data.session === null) {
        setNotice('Account created. Check your inbox to confirm your email, then sign in.')
        setMode('sign-in')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_#1e293b,_#0f172a_60%)] p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 via-amber-400 to-cyan-400 text-2xl">
            🎯
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Color Hunt</h1>
          <p className="mt-1 text-sm text-slate-400">Find the color. Dodge the hunter.</p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-800 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode('sign-in')}
            className={`rounded-md py-1.5 transition ${mode === 'sign-in' ? 'bg-slate-600 font-semibold' : 'text-slate-400'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('sign-up')}
            className={`rounded-md py-1.5 transition ${mode === 'sign-up' ? 'bg-slate-600 font-semibold' : 'text-slate-400'}`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'sign-up' && (
            <label className="block text-sm">
              <span className="text-slate-300">Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 outline-none focus:border-cyan-400"
                placeholder="Your name in game"
                maxLength={24}
                required
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="text-slate-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 outline-none focus:border-cyan-400"
              autoComplete="email"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 outline-none focus:border-cyan-400"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </label>

          {error && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-300">{error}</p>}
          {notice && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-lg bg-cyan-500 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
          >
            {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
