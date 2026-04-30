import { createClient } from '@/lib/supabase/client'

export function createPublicAuthClient(unavailableMessage: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(unavailableMessage)
  }

  return createClient()
}
