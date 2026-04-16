import { createClient } from '@/lib/supabase/server'
import { isTrustedMutationRequest } from '@/lib/security/request-origin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

function toSafeRedirectPath(path: string | null): string {
  if (!path) return '/'
  if (!path.startsWith('/')) return '/'
  if (path.startsWith('//')) return '/'
  return path
}

async function clearSupabaseAuthCookies(response: NextResponse) {
  const cookieStore = await cookies()
  for (const cookie of cookieStore.getAll()) {
    if (!cookie.name.startsWith('sb-')) continue
    response.cookies.set({
      name: cookie.name,
      value: '',
      path: '/',
      expires: new Date(0),
    })
  }
}

export async function GET(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const supabase = await createClient()
  await supabase.auth.signOut()

  const url = new URL(request.url)
  const response = NextResponse.redirect(
    new URL(toSafeRedirectPath(url.searchParams.get('next')), request.url),
    {
      status: 303,
    }
  )
  await clearSupabaseAuthCookies(response)
  return response
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  const response = NextResponse.redirect(new URL('/', request.url), { status: 303 })
  await clearSupabaseAuthCookies(response)
  return response
}
