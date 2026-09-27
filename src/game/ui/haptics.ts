/** Vibration feedback where the device supports it (phones, some laptops). Silent elsewhere. */
export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator === 'undefined') return
    if (typeof navigator.vibrate !== 'function') return
    navigator.vibrate(pattern)
  } catch {
    // ignore
  }
}

export const haptics = {
  tap: () => vibrate(15),
  wrong: () => vibrate([60, 40, 90]),
  safe: () => vibrate([40, 30, 40, 30, 120]),
  caught: () => vibrate([200, 60, 200]),
  go: () => vibrate(80),
  tick: () => vibrate(20),
  land: () => vibrate(12),
}
