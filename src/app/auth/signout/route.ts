import { createClient } from '@/lib/supabase/server'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { NextResponse } from 'next/server'

function toSafeRedirectPath(path: string | null): string {
  if (!path) return '/'
  if (!path.startsWith('/')) return '/'
  if (path.startsWith('//')) return '/'
  return path
}

export async function GET(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const url = new URL(request.url)
  return NextResponse.redirect(
    new URL(toSafeRedirectPath(url.searchParams.get('next')), request.url),
    {
      status: 303,
    }
  )
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', request.url), { status: 303 })
}
