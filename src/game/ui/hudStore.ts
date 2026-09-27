import { create } from 'zustand'
import type { Compass } from '../state/rules'

export interface IndicatorInfo {
  userId: string
  name: string
  x: number
  y: number
  angle: number
  distance: number
}

export interface NearestInfo {
  userId: string
  name: string
  distance: number
  direction: Compass
}

interface HudState {
  indicators: IndicatorInfo[]
  nearest: NearestInfo | null
  setHud: (indicators: IndicatorInfo[], nearest: NearestInfo | null) => void
}

/** Low frequency (about 12 Hz) HUD data derived from the 3D scene. */
export const useHudStore = create<HudState>((set) => ({
  indicators: [],
  nearest: null,
  setHud: (indicators, nearest) => set({ indicators, nearest }),
}))
