import { NextResponse } from 'next/server'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { createClient } from '@/lib/supabase/server'

async function requireManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), supabase }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !can(parseRole(profile?.role), 'manage_schedule', {
      isActive: profile?.is_active !== false,
      archivedAt: profile?.archived_at ?? null,
    })
  ) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), supabase }
  }

  return { error: null, supabase }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutationRequest(_request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const { error, supabase } = await requireManager()
  if (error) return error

  const { id } = await params
  const { error: deleteError } = await supabase.from('cycle_templates').delete().eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
