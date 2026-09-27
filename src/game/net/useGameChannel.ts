import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { friendlyError, getSessionSnapshot, heartbeat, markStalePlayers } from '../../lib/api'
import { useGameStore } from '../state/gameStore'
import { clearRemote, getAllRemotes, receiveRemotePosition, resetPositions, setOnline } from './positionStore'

interface PositionPayload {
  id: string
  x: number
  z: number
  y: number
  rot: number
  moving: boolean
}

const POSITION_INTERVAL_MS = 66
const HEARTBEAT_INTERVAL_MS = 5000
const STALE_CHECK_INTERVAL_MS = 12000

let activeChannel: RealtimeChannel | null = null
let activeUserId: string | null = null
let lastPositionSentAt = 0

/** Broadcasts the local position to the session channel, throttled to about 15 Hz. */
export function sendPosition(x: number, z: number, y: number, rot: number, moving: boolean, force = false): void {
  if (activeChannel === null) return
  if (activeUserId === null) return
  const now = performance.now()
  if (!force && now - lastPositionSentAt < POSITION_INTERVAL_MS) return
  lastPositionSentAt = now
  const payload: PositionPayload = { id: activeUserId, x, z, y, rot, moving }
  void activeChannel.send({ type: 'broadcast', event: 'pos', payload })
}

/**
 * Connects to the private realtime channel for a session:
 * position broadcasts, presence, and database change notifications.
 */
export function useGameChannel(sessionId: string, userId: string): { error: string | null } {
  const [error, setError] = useState<string | null>(null)
  const refetchTimer = useRef<number | null>(null)

  useEffect(() => {
    let disposed = false
    let channel: RealtimeChannel | null = null
    const store = useGameStore.getState()

    const refetchNow = async () => {
      try {
        const snapshot = await getSessionSnapshot(sessionId)
        if (disposed) return
        useGameStore.getState().applySnapshot(snapshot)
        setError(null)
      } catch (e) {
        if (disposed) return
        setError(friendlyError(e))
      }
    }

    const scheduleRefetch = () => {
      if (refetchTimer.current !== null) return
      refetchTimer.current = window.setTimeout(() => {
        refetchTimer.current = null
        void refetchNow()
      }, 40)
    }

    const connect = async () => {
      await refetchNow()
      if (disposed) return

      await supabase.realtime.setAuth()
      if (disposed) return

      channel = supabase.channel(`game:${sessionId}`, {
        config: {
          private: true,
          presence: { key: userId },
          broadcast: { self: false, ack: false },
        },
      })

      channel
        .on('broadcast', { event: 'pos' }, ({ payload }) => {
          const p = payload as PositionPayload
          if (p.id === userId) return
          receiveRemotePosition(p.id, { x: p.x, z: p.z, y: p.y ?? 0, rot: p.rot, moving: p.moving })
        })
        .on('broadcast', { event: 'INSERT' }, scheduleRefetch)
        .on('broadcast', { event: 'UPDATE' }, scheduleRefetch)
        .on('broadcast', { event: 'DELETE' }, scheduleRefetch)
        .on('presence', { event: 'sync' }, () => {
          if (channel === null) return
          const state = channel.presenceState()
          const ids = Object.keys(state)
          setOnline(ids)
          for (const id of getAllRemotes().keys()) {
            if (!ids.includes(id)) clearRemote(id)
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            useGameStore.getState().setConnected(true)
            if (channel !== null) {
              await channel.track({ user_id: userId, online_at: new Date().toISOString() })
            }
            // Realtime may have missed events while connecting; refresh once more.
            scheduleRefetch()
            return
          }
          useGameStore.getState().setConnected(false)
        })

      activeChannel = channel
      activeUserId = userId
    }

    void connect()

    const heartbeatTimer = window.setInterval(() => {
      heartbeat(sessionId).catch(() => undefined)
    }, HEARTBEAT_INTERVAL_MS)

    const staleTimer = window.setInterval(() => {
      markStalePlayers(sessionId).catch(() => undefined)
    }, STALE_CHECK_INTERVAL_MS)

    return () => {
      disposed = true
      window.clearInterval(heartbeatTimer)
      window.clearInterval(staleTimer)
      if (refetchTimer.current !== null) {
        window.clearTimeout(refetchTimer.current)
        refetchTimer.current = null
      }
      if (channel !== null) {
        void supabase.removeChannel(channel)
      }
      if (activeChannel === channel) {
        activeChannel = null
        activeUserId = null
      }
      resetPositions()
      store.reset()
    }
  }, [sessionId, userId])

  return { error }
}
