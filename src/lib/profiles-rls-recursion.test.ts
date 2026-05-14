import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260514005018_fix_profiles_rls_recursion.sql'),
  'utf8'
)

function policyBody(policyName: string) {
  const escapedPolicyName = policyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = migrationSource.match(
    new RegExp(`create policy "${escapedPolicyName}"[\\s\\S]*?;`, 'i')
  )
  if (!match) {
    throw new Error(`Missing policy ${policyName}`)
  }

  return match[0]
}

describe('profiles RLS recursion migration', () => {
  it('uses a private security-definer helper instead of recursive profile policy reads', () => {
    expect(migrationSource).toContain('create schema if not exists private')
    expect(migrationSource).toContain('create or replace function private.current_profile_role()')
    expect(migrationSource).toContain('security definer')
    expect(migrationSource).toContain("set search_path = ''")
    expect(migrationSource).toContain('from public.profiles as profile')
    expect(migrationSource).toContain('where profile.id = (select auth.uid())')
    expect(migrationSource).toContain(
      'grant execute on function private.current_profile_role() to authenticated, service_role'
    )
  })

  it('lets staff onboarding update the current user profile without triggering profiles recursion', () => {
    const updatePolicy = policyBody('Authenticated users can update allowed profiles')

    expect(updatePolicy).toContain('(select auth.uid()) = id')
    expect(updatePolicy).toContain("(select private.current_profile_role()) = 'manager'::text")
    expect(updatePolicy).not.toContain('from public.profiles')
    expect(updatePolicy).not.toContain('manager_profile')
  })

  it('lets manager team quick edit use manager role checks without querying profiles recursively', () => {
    const updatePolicy = policyBody('Authenticated users can update allowed profiles')

    expect(updatePolicy).toContain('for update')
    expect(updatePolicy).toContain('with check')
    expect(updatePolicy.match(/private\.current_profile_role\(\)/g)?.length).toBe(2)
    expect(updatePolicy).not.toContain('exists (')
  })

  it('preserves profile access role boundaries for self, managers, and leads', () => {
    const readPolicy = policyBody('Authenticated users can read allowed profiles')
    const updatePolicy = policyBody('Authenticated users can update allowed profiles')

    expect(readPolicy).toContain('to authenticated')
    expect(readPolicy).toContain('(select auth.uid()) = id')
    expect(readPolicy).toContain(
      "(select private.current_profile_role()) = any (array['manager'::text, 'lead'::text])"
    )
    expect(readPolicy).not.toContain("'therapist'::text")
    expect(readPolicy).not.toContain("'staff'::text")

    expect(updatePolicy).toContain("(select private.current_profile_role()) = 'manager'::text")
    expect(updatePolicy).not.toContain("'lead'::text")
  })
})
