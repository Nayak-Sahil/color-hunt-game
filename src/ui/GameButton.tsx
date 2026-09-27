import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { sfx, unlockAudio } from '../game/ui/sound'
import { haptics } from '../game/ui/haptics'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'text-slate-950 bg-gradient-to-br from-cyan-300 via-cyan-400 to-sky-500 shadow-[0_6px_0_#0e7490,0_12px_24px_rgba(34,211,238,0.35)] hover:brightness-110 active:translate-y-[4px] active:shadow-[0_2px_0_#0e7490]',
  secondary:
    'text-white bg-white/10 border border-white/20 backdrop-blur shadow-[0_4px_0_rgba(0,0,0,0.35)] hover:bg-white/15 active:translate-y-[3px] active:shadow-none',
  danger:
    'text-white bg-gradient-to-br from-rose-400 to-pink-600 shadow-[0_6px_0_#9f1239,0_12px_24px_rgba(244,63,94,0.35)] hover:brightness-110 active:translate-y-[4px] active:shadow-[0_2px_0_#9f1239]',
  ghost: 'text-slate-200 hover:bg-white/10 active:scale-95',
}

const SIZE_CLASS = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-base rounded-xl',
  lg: 'px-7 py-3.5 text-lg rounded-2xl',
}

/** Chunky arcade-style button with press animation, hover blip and click sound. */
export function GameButton({ variant = 'primary', size = 'md', className = '', children, onMouseEnter, onClick, ...rest }: Props) {
  return (
    <button
      {...rest}
      onMouseEnter={(e) => {
        if (!rest.disabled) sfx.hover()
        onMouseEnter?.(e)
      }}
      onClick={(e) => {
        unlockAudio()
        if (!rest.disabled) {
          sfx.click()
          haptics.tap()
        }
        onClick?.(e)
      }}
      className={`font-display inline-flex items-center justify-center gap-2 font-bold tracking-wide transition-all duration-100 select-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
    >
      {children}
    </button>
  )
}
