import { catchPlayer, claimSafe, friendlyError } from '../lib/api'
import { INTERACT_RANGE } from './map/constants'
import type { PropSpec } from './map/types'
import { localPosition } from './net/positionStore'
import { findPlayer, useGameStore } from './state/gameStore'
import { distance2d } from './physics/aabb'
import { beep } from './ui/sound'

let interactBusy = false
let lastCatchAttemptAt = 0
const CATCH_COOLDOWN_MS = 1500

/** Player clicked, or pressed E or Enter, on a colorable object. */
export async function attemptInteract(prop: PropSpec, userId: string): Promise<void> {
  const { session, round, players, showToast } = useGameStore.getState()
  if (session === null) return
  const me = findPlayer(players, userId)
  if (me === null) return

  if (session.status !== 'hunting') {
    showToast('No hunt is running right now.', 'info')
    return
  }
  if (me.status === 'hunter') {
    showToast('The Hunter cannot claim the object. Go catch someone!', 'warning')
    return
  }
  if (me.status === 'safe') {
    showToast('You are already Safe.', 'info')
    return
  }
  if (me.status !== 'searching') {
    showToast('You cannot claim objects right now.', 'info')
    return
  }

  // Every wrong pick gets loud, immediate feedback.
  const isHiddenObject = round !== null && round.hidden_object_id === prop.id
  if (!isHiddenObject) {
    beep(180, 160)
    showToast('❌ Not this one. Keep looking!', 'wrong')
    return
  }

  if (distance2d(localPosition, prop) > INTERACT_RANGE) {
    showToast('That looks right! Get closer to claim it.', 'info')
    return
  }
  if (interactBusy) return

  interactBusy = true
  try {
    const result = await claimSafe(session.id, prop.id)
    if (result.ok) {
      beep(880, 120)
      setTimeout(() => beep(1320, 220), 130)
      showToast('✅ You found it! You are Safe for this round.', 'success')
      return
    }
    showToast('Could not claim that object.', 'warning')
  } catch (e) {
    showToast(friendlyError(e), 'error')
  } finally {
    interactBusy = false
  }
}

/** Hunter touched a searching player. The database validates everything again. */
export async function attemptCatch(targetId: string): Promise<void> {
  const now = performance.now()
  if (now - lastCatchAttemptAt < CATCH_COOLDOWN_MS) return
  lastCatchAttemptAt = now

  const { session, showToast } = useGameStore.getState()
  if (session === null) return
  if (session.status !== 'hunting') return

  try {
    const result = await catchPlayer(session.id, targetId)
    if (!result.ok) return
    showToast('Caught! Round over.', 'success')
  } catch (e) {
    showToast(friendlyError(e), 'error')
  }
}
