import { createClient } from '@supabase/supabase-js'

import { requireEnv } from '@/lib/server-env'
import type { Database } from '@/lib/supabase/database.types'

export function createAdminClient() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
