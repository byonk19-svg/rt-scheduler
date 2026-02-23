import type { createClient } from '@/lib/supabase/server'

type AuditLogParams = {
  userId: string
  action: string
  targetType: string
  targetId: string
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function writeAuditLog(
  supabase: ServerSupabaseClient,
  params: AuditLogParams
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    user_id: params.userId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
  })

  if (error) {
    console.error('Failed to write audit log:', error.message)
  }
}
