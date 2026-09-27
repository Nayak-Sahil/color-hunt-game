import { lazy, Suspense } from 'react'

const LITE_KEY = 'colorhunt-lite'

/** `?lite` in the URL (remembered for the tab) replaces the 3D backdrop with a gradient for weak machines. */
export function isLiteMode(): boolean {
  try {
    if (new URLSearchParams(window.location.search).has('lite')) {
      sessionStorage.setItem(LITE_KEY, '1')
    }
    return sessionStorage.getItem(LITE_KEY) === '1'
  } catch {
    return false
  }
}

const Showcase = lazy(() => import('./ShowcaseBackground'))

function GradientBackdrop() {
  return <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_#1e3a5f,_#0b1120_65%)]" />
}

/**
 * Menu backdrop. The 3D neighborhood (and the whole 3D engine) is fetched on demand,
 * so the first paint of the login screen does not wait for it.
 */
export function LazyShowcase() {
  if (isLiteMode()) return <GradientBackdrop />
  return (
    <Suspense fallback={<GradientBackdrop />}>
      <Showcase />
    </Suspense>
  )
}

/** Warms the game chunk in the background so entering a session feels instant. */
export function prefetchGame(): void {
  const load = () => {
    void import('../game/GameView')
    void import('./ShowcaseBackground')
  }
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(load, { timeout: 3000 })
    return
  }
  window.setTimeout(load, 800)
}
