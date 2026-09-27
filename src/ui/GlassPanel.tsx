import type { HTMLAttributes, ReactNode } from 'react'

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  glow?: 'cyan' | 'pink' | 'amber' | 'none'
}

const GLOW: Record<NonNullable<Props['glow']>, string> = {
  cyan: 'shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_24px_60px_rgba(2,6,23,0.7),0_0_40px_rgba(34,211,238,0.15)]',
  pink: 'shadow-[0_0_0_1px_rgba(244,114,182,0.35),0_24px_60px_rgba(2,6,23,0.7),0_0_40px_rgba(244,114,182,0.15)]',
  amber: 'shadow-[0_0_0_1px_rgba(251,191,36,0.35),0_24px_60px_rgba(2,6,23,0.7),0_0_40px_rgba(251,191,36,0.15)]',
  none: 'shadow-[0_24px_60px_rgba(2,6,23,0.6)]',
}

/** Frosted panel used for menus and dialogs. */
export function GlassPanel({ children, glow = 'cyan', className = '', ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`rounded-3xl border border-white/15 bg-slate-900/75 backdrop-blur-xl ${GLOW[glow]} ${className}`}
    >
      {children}
    </div>
  )
}

export function KeyCap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded-md border border-white/25 bg-slate-800/90 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-100 shadow-[0_2px_0_rgba(0,0,0,0.5)]">
      {children}
    </kbd>
  )
}

export function Logo({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const dots = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#ec407a']
  return (
    <div className={`flex items-center gap-3 ${size === 'lg' ? '' : 'scale-75 origin-left'}`}>
      <div className="relative h-14 w-14">
        {dots.map((c, i) => (
          <span
            key={c}
            className="absolute h-5 w-5 rounded-full shadow-lg animate-orbit"
            style={{ background: c, animationDelay: `${i * -1.6}s` }}
          />
        ))}
        <span className="absolute inset-0 flex items-center justify-center text-2xl drop-shadow">🎯</span>
      </div>
      <div>
        <h1 className="font-display text-4xl font-bold leading-none tracking-tight text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]">
          Color <span className="bg-gradient-to-r from-cyan-300 via-pink-300 to-amber-300 bg-clip-text text-transparent">Hunt</span>
        </h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">Find it. Or run.</p>
      </div>
    </div>
  )
}
