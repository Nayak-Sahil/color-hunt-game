/**
 * Synthesized sound effects. No audio files: everything is built from oscillators and
 * filtered noise so the game stays a single bundle. Silent when the browser blocks audio.
 */
let context: AudioContext | null = null
let master: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
let muted = false

function getContext(): AudioContext | null {
  try {
    if (context === null) {
      context = new AudioContext()
      master = context.createGain()
      master.gain.value = 0.6
      master.connect(context.destination)
    }
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

/** Browsers only start audio after a user gesture; call this from pointer and key handlers. */
export function unlockAudio(): void {
  getContext()
}

export function setMuted(value: boolean): void {
  muted = value
  if (master !== null) master.gain.value = value ? 0 : 0.6
}

export function isMuted(): boolean {
  return muted
}

function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer !== null) return noiseBuffer
  const length = ctx.sampleRate * 1
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  noiseBuffer = buffer
  return buffer
}

interface ToneOptions {
  freq: number
  duration: number
  type?: OscillatorType
  volume?: number
  slideTo?: number
  delay?: number
  attack?: number
}

function tone(options: ToneOptions): void {
  const ctx = getContext()
  if (ctx === null || master === null) return
  try {
    const { freq, duration, type = 'sine', volume = 0.12, slideTo, delay = 0, attack = 0.005 } = options
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    const start = ctx.currentTime + delay
    osc.frequency.setValueAtTime(freq, start)
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(gain)
    gain.connect(master)
    osc.start(start)
    osc.stop(start + duration + 0.02)
  } catch {
    // Audio is a nicety; never let it break the game.
  }
}

interface NoiseOptions {
  duration: number
  volume?: number
  filterFreq?: number
  filterType?: BiquadFilterType
  delay?: number
  slideTo?: number
}

function noise(options: NoiseOptions): void {
  const ctx = getContext()
  if (ctx === null || master === null) return
  try {
    const { duration, volume = 0.1, filterFreq = 1200, filterType = 'lowpass', delay = 0, slideTo } = options
    const source = ctx.createBufferSource()
    source.buffer = getNoise(ctx)
    const filter = ctx.createBiquadFilter()
    filter.type = filterType
    const start = ctx.currentTime + delay
    filter.frequency.setValueAtTime(filterFreq, start)
    if (slideTo !== undefined) filter.frequency.exponentialRampToValueAtTime(slideTo, start + duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    source.start(start)
    source.stop(start + duration + 0.02)
  } catch {
    // ignore
  }
}

let stepToggle = false

export const sfx = {
  /** Light UI hover blip. */
  hover(): void {
    tone({ freq: 1400, duration: 0.04, volume: 0.03, type: 'triangle' })
  },
  /** UI click. */
  click(): void {
    tone({ freq: 700, duration: 0.06, volume: 0.08, type: 'triangle', slideTo: 500 })
  },
  /** UI confirm (Enter, submit). */
  select(): void {
    tone({ freq: 660, duration: 0.09, volume: 0.09, type: 'triangle' })
    tone({ freq: 990, duration: 0.14, volume: 0.09, type: 'triangle', delay: 0.07 })
  },
  /** Moving the highlight in a menu. */
  move(): void {
    tone({ freq: 520, duration: 0.05, volume: 0.05, type: 'square' })
  },
  footstep(sprinting: boolean): void {
    stepToggle = !stepToggle
    const base = sprinting ? 900 : 700
    noise({ duration: sprinting ? 0.07 : 0.09, volume: sprinting ? 0.06 : 0.045, filterFreq: base + (stepToggle ? 150 : -100) })
  },
  jump(): void {
    tone({ freq: 320, duration: 0.18, volume: 0.09, type: 'triangle', slideTo: 760 })
    noise({ duration: 0.16, volume: 0.03, filterFreq: 600, slideTo: 2500, filterType: 'bandpass' })
  },
  land(): void {
    noise({ duration: 0.12, volume: 0.09, filterFreq: 400 })
    tone({ freq: 140, duration: 0.1, volume: 0.06, type: 'sine', slideTo: 70 })
  },
  wrong(): void {
    tone({ freq: 330, duration: 0.12, volume: 0.1, type: 'square' })
    tone({ freq: 220, duration: 0.22, volume: 0.1, type: 'square', delay: 0.12 })
  },
  safe(): void {
    const notes = [523, 659, 784, 1047]
    notes.forEach((f, i) => tone({ freq: f, duration: 0.18, volume: 0.1, type: 'triangle', delay: i * 0.09 }))
    tone({ freq: 1568, duration: 0.4, volume: 0.07, type: 'sine', delay: 0.36 })
  },
  caught(): void {
    tone({ freq: 440, duration: 0.25, volume: 0.12, type: 'sawtooth', slideTo: 110 })
    noise({ duration: 0.3, volume: 0.08, filterFreq: 900, slideTo: 200 })
  },
  /** Hunter tagged someone (played for the hunter). */
  tag(): void {
    tone({ freq: 880, duration: 0.08, volume: 0.1, type: 'square' })
    tone({ freq: 1320, duration: 0.18, volume: 0.1, type: 'square', delay: 0.08 })
  },
  /** Color announced: short fanfare. */
  announce(): void {
    const notes = [392, 523, 659, 784]
    notes.forEach((f, i) => tone({ freq: f, duration: 0.22, volume: 0.1, type: 'triangle', delay: i * 0.11 }))
  },
  countdown(number: number): void {
    if (number <= 0) {
      tone({ freq: 880, duration: 0.5, volume: 0.14, type: 'triangle' })
      tone({ freq: 1320, duration: 0.5, volume: 0.1, type: 'triangle', delay: 0.02 })
      return
    }
    tone({ freq: 660, duration: 0.16, volume: 0.12, type: 'triangle' })
  },
  tick(): void {
    tone({ freq: 880, duration: 0.09, volume: 0.09, type: 'square' })
  },
  timeUp(): void {
    tone({ freq: 220, duration: 0.6, volume: 0.12, type: 'sawtooth', slideTo: 110 })
  },
  playerJoined(): void {
    tone({ freq: 587, duration: 0.1, volume: 0.07, type: 'triangle' })
    tone({ freq: 880, duration: 0.16, volume: 0.07, type: 'triangle', delay: 0.09 })
  },
  gameStart(): void {
    const notes = [523, 659, 784]
    notes.forEach((f, i) => tone({ freq: f, duration: 0.16, volume: 0.1, type: 'triangle', delay: i * 0.1 }))
  },
  whoosh(): void {
    noise({ duration: 0.25, volume: 0.05, filterFreq: 300, slideTo: 3000, filterType: 'bandpass' })
  },
}

/** Kept for the older call sites: simple beep. */
export function beep(frequency: number, durationMs: number, volume = 0.08): void {
  tone({ freq: frequency, duration: durationMs / 1000, volume })
}
