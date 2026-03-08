import { createClient } from '@/lib/supabase/server'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login?success=signed_out', request.url), { status: 303 })
}
