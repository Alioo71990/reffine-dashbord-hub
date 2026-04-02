import { createClient } from '@supabase/supabase-js'

// We create the client lazily based on admin config
export function getSupabase(url: string, key: string) {
  return createClient(url, key)
}
