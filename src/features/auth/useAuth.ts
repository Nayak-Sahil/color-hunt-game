import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export interface AuthState {
  session: Session | null
  loading: boolean
}

/** Tracks the Supabase auth session for the whole app. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setState({ session: data.session, loading: false })
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  return state
}

export function displayNameOf(session: Session | null): string {
  const meta = session?.user.user_metadata as { display_name?: string } | undefined
  const name = meta?.display_name
  if (name && name.trim().length > 0) return name
  return session?.user.email?.split('@')[0] ?? 'Player'
}
