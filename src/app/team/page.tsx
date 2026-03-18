import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Shield, User } from 'lucide-react'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

type ProfileRow = {
  id: string
  full_name: string | null
  role: string | null
  shift_type: 'day' | 'night' | null
  employment_type: 'full_time' | 'part_time' | 'prn' | null
  is_lead_eligible: boolean | null
  is_active: boolean | null
  on_fmla: boolean | null
}

function initials(name: string | null): string {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function employmentLabel(type: string | null): string {
  if (type === 'full_time') return 'Full-time'
  if (type === 'part_time') return 'Part-time'
  if (type === 'prn') return 'PRN'
  return ''
}

function TherapistCard({ profile }: { profile: ProfileRow }) {
  const isLead = profile.is_lead_eligible === true
  const emp = employmentLabel(profile.employment_type)
  const shift = profile.shift_type === 'night' ? 'Night' : 'Day'

  return (
    <Link
      href={`/directory?focus=${profile.id}`}
      className={cn(
        'group flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all hover:shadow-md hover:border-primary/20'
      )}
    >
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold',
          isLead
            ? 'border border-primary/20 bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {initials(profile.full_name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-sm font-semibold text-foreground">
            {profile.full_name ?? 'Unknown'}
          </h3>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              isLead ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            )}
          >
            {isLead ? <Shield className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
            {isLead ? 'Lead' : 'Staff'}
          </span>
          {profile.on_fmla && (
            <span className="inline-flex items-center rounded-full bg-[var(--warning-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning-text)]">
              FMLA
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{shift} shift</span>
          {emp && (
            <>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>{emp}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

export default async function TeamPage() {
  const supabase = await createClient()

  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (!can(parseRole(profileData?.role), 'access_manager_ui')) {
    redirect('/dashboard/staff')
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'id, full_name, role, shift_type, employment_type, is_lead_eligible, is_active, on_fmla'
    )
    .in('role', ['therapist', 'staff', 'manager'])
    .order('full_name', { ascending: true })

  const allProfiles = (profiles ?? []) as ProfileRow[]
  const activeProfiles = allProfiles.filter((p) => p.is_active !== false)

  const leads = activeProfiles.filter((p) => p.is_lead_eligible === true)
  const staff = activeProfiles.filter((p) => p.is_lead_eligible !== true)

  return (
    <div className="px-8 py-6 max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeProfiles.length} therapists · {leads.length} leads, {staff.length} staff
          </p>
        </div>
        <Link
          href="/directory"
          className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
        >
          Edit directory
        </Link>
      </div>

      {leads.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Lead Therapists
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {leads.map((p) => (
              <TherapistCard key={p.id} profile={p} />
            ))}
          </div>
        </section>
      )}

      {staff.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Staff Therapists
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {staff.map((p) => (
              <TherapistCard key={p.id} profile={p} />
            ))}
          </div>
        </section>
      )}

      {activeProfiles.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">No active team members found.</p>
          <Link
            href="/directory"
            className="mt-2 inline-block text-xs text-primary hover:underline"
          >
            Add team members in the directory
          </Link>
        </div>
      )}
    </div>
  )
}
