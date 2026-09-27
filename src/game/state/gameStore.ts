import { create } from 'zustand'
import type { PlayerRow, RoundRow, SessionRow, SessionSnapshot } from './types'

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'success' | 'warning' | 'error' | 'wrong'
}

interface GameState {
  session: SessionRow | null
  players: PlayerRow[]
  round: RoundRow | null
  /** Difference between the server clock and the local clock, in milliseconds. */
  serverOffsetMs: number
  connected: boolean
  toasts: Toast[]
  fullMapOpen: boolean
  applySnapshot: (snapshot: SessionSnapshot) => void
  setConnected: (connected: boolean) => void
  showToast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
  setFullMapOpen: (open: boolean) => void
  reset: () => void
}

let toastCounter = 0

export const useGameStore = create<GameState>((set) => ({
  session: null,
  players: [],
  round: null,
  serverOffsetMs: 0,
  connected: false,
  toasts: [],
  fullMapOpen: false,

  applySnapshot: (snapshot) =>
    set({
      session: snapshot.session,
      players: snapshot.players,
      round: snapshot.round,
      serverOffsetMs: new Date(snapshot.server_time).getTime() - Date.now(),
    }),

  setConnected: (connected) => set({ connected }),

  showToast: (text, tone = 'info') => {
    toastCounter += 1
    const id = toastCounter
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, text, tone }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 3200)
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  setFullMapOpen: (open) => set({ fullMapOpen: open }),

  reset: () => set({ session: null, players: [], round: null, connected: false, toasts: [], fullMapOpen: false }),
}))

/** Active players are everyone who has not left the session. */
export function activePlayers(players: PlayerRow[]): PlayerRow[] {
  return players.filter((p) => p.status !== 'left')
}

export function findPlayer(players: PlayerRow[], userId: string | null | undefined): PlayerRow | null {
  if (!userId) return null
  return players.find((p) => p.user_id === userId) ?? null
}
