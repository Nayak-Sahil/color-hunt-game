import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { LazyShowcase } from '../../ui/LazyShowcase'
import { GlassPanel, KeyCap, Logo } from '../../ui/GlassPanel'
import { GameButton } from '../../ui/GameButton'
import { sfx } from '../../game/ui/sound'

type Mode = 'sign-in' | 'sign-up'

const INPUT =
  'mt-1 w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-2.5 text-base outline-none transition focus:border-cyan-300 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.25)]'

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const switchMode = (next: Mode) => {
    if (next === mode) return
    sfx.click()
    setMode(next)
    setError(null)
    setNotice(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'sign-in') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          sfx.wrong()
          setError(signInError.message)
          return
        }
        sfx.select()
        return
      }

      const trimmed = displayName.trim()
      if (trimmed.length < 2 || trimmed.length > 24) {
        sfx.wrong()
        setError('Display name must be between 2 and 24 characters.')
        return
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: trimmed } },
      })
      if (signUpError) {
        sfx.wrong()
        setError(signUpError.message)
        return
      }
      sfx.select()
      if (data.session === null) {
        setNotice('Account created. Check your inbox to confirm your email, then sign in.')
        setMode('sign-in')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative isolate flex min-h-full items-center justify-center overflow-hidden p-6">
      <LazyShowcase />
      <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-[1.1fr_1fr]">
        <div className="hidden md:block animate-fade-up">
          <Logo />
          <p className="mt-6 max-w-md text-lg text-slate-200">
            A neighborhood. One Hunter. One secretly colored object. Find it before you get tagged.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-3"><span className="text-xl">🎯</span> The Hunter announces a color.</li>
            <li className="flex items-center gap-3"><span className="text-xl">🔎</span> Search the streets, parks and yards for it.</li>
            <li className="flex items-center gap-3"><span className="text-xl">✅</span> Click it to become Safe. Get tagged and you hunt next.</li>
          </ul>
          <p className="mt-6 flex items-center gap-2 text-xs text-slate-400">
            <KeyCap>↑</KeyCap><KeyCap>↓</KeyCap><KeyCap>←</KeyCap><KeyCap>→</KeyCap> move · <KeyCap>Alt</KeyCap> sprint · <KeyCap>Space</KeyCap> jump
          </p>
        </div>

        <GlassPanel className="w-full p-8 animate-pop">
          <div className="mb-6 md:hidden">
            <Logo size="sm" />
          </div>
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-950/60 p-1 font-display text-sm font-bold">
            {(['sign-in', 'sign-up'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`rounded-lg py-2 transition ${mode === m ? 'bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                {m === 'sign-in' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'sign-up' && (
              <label className="block text-sm">
                <span className="font-semibold text-slate-300">Player name</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={INPUT}
                  placeholder="How others will see you"
                  maxLength={24}
                  required
                />
              </label>
            )}
            <label className="block text-sm">
              <span className="font-semibold text-slate-300">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} autoComplete="email" required />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-slate-300">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT}
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                minLength={6}
                required
              />
            </label>

            {error && <p className="rounded-xl bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-200 animate-shake">{error}</p>}
            {notice && <p className="rounded-xl bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-200">{notice}</p>}

            <GameButton type="submit" size="lg" disabled={busy} className="mt-2 w-full">
              {busy ? 'Please wait…' : mode === 'sign-in' ? '▶ Play' : 'Create account'}
            </GameButton>
          </form>
        </GlassPanel>
      </div>
    </div>
  )
}
