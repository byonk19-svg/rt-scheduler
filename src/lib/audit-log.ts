type AuditLogParams = {
  userId: string
  action: string
  targetType: string
  targetId: string
}

type AuditLogClient = {
  from: (table: 'audit_log') => {
    insert: (row: {
      user_id: string
      action: string
      target_type: string
      target_id: string
    }) => PromiseLike<{ error: { message?: string } | null }>
  }
}

export async function writeAuditLog(
  supabase: AuditLogClient,
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
