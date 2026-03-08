import { NextResponse } from 'next/server'

import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  if (error) {
    return NextResponse.json({ error: 'Could not mark notifications as read' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
