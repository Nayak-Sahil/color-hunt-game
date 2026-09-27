import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url) {
  throw new Error('VITE_SUPABASE_URL is missing. Copy .env.example to .env.local.')
}
if (!key) {
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is missing. Copy .env.example to .env.local.')
}

export const supabase = createClient<Database>(url, key, {
  realtime: {
    params: {
      // Position broadcasts are sent at 15 Hz per player; allow headroom for 5 players.
      eventsPerSecond: 120,
    },
  },
})
