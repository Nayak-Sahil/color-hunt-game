let context: AudioContext | null = null

function getContext(): AudioContext | null {
  try {
    if (context === null) context = new AudioContext()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

/** Short synthesized tone. Silent when the browser blocks audio. */
export function beep(frequency: number, durationMs: number, volume = 0.08): void {
  const ctx = getContext()
  if (ctx === null) return
  try {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.value = volume
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime
    oscillator.start(now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000)
    oscillator.stop(now + durationMs / 1000)
  } catch {
    // Audio is a nicety; never let it break the game.
  }
}
