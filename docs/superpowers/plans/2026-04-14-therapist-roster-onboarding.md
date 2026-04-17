# Therapist Roster Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the therapist roster with the supplied name-and-phone list, preserve the demo manager, archive stale therapist/lead accounts, and keep real-email signup working through roster name matching.

**Architecture:** Add a dedicated therapist-roster replacement path on top of the existing `employee_roster` + signup-match model instead of precreating auth users. Extend roster persistence to store phone numbers, keep therapist status management in the team roster UI, and archive stale therapist/lead profiles during replacement while preserving managers.

**Tech Stack:** Next.js App Router, Supabase Auth/Postgres, server actions, Vitest, SQL migrations

---

### Task 1: Add a dedicated therapist roster source parser

**Files:**

- Create: `src/lib/therapist-roster-source.ts`
- Create: `src/lib/therapist-roster-source.test.ts`
- Modify: `src/lib/employee-roster-bulk.ts`
- Test: `src/lib/therapist-roster-source.test.ts`

- [ ] **Step 1: Write the failing parser tests**

```ts
import { describe, expect, it } from 'vitest'

import {
  normalizeTherapistRosterPhone,
  parseTherapistRosterSource,
} from '@/lib/therapist-roster-source'

describe('normalizeTherapistRosterPhone', () => {
  it('formats 10-digit numbers for storage', () => {
    expect(normalizeTherapistRosterPhone('903-217-7833')).toBe('(903) 217-7833')
  })
})

describe('parseTherapistRosterSource', () => {
  it('parses last-name-first rows with phones into therapist defaults', () => {
    const parsed = parseTherapistRosterSource(
      'Brooks, Tannie 903-217-7833\nWallace-Carr, Audbriana 806-729-1363'
    )

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    expect(parsed.rows).toEqual([
      {
        full_name: 'Tannie Brooks',
        normalized_full_name: 'tannie brooks',
        phone_number: '(903) 217-7833',
        role: 'therapist',
        shift_type: 'day',
        employment_type: 'full_time',
        max_work_days_per_week: 3,
        is_lead_eligible: false,
        is_active: true,
      },
      {
        full_name: 'Audbriana Wallace-Carr',
        normalized_full_name: 'audbriana wallace-carr',
        phone_number: '(806) 729-1363',
        role: 'therapist',
        shift_type: 'day',
        employment_type: 'full_time',
        max_work_days_per_week: 3,
        is_lead_eligible: false,
        is_active: true,
      },
    ])
  })

  it('rejects duplicate normalized names inside the source payload', () => {
    const parsed = parseTherapistRosterSource(
      'Brooks, Tannie 903-217-7833\nTannie Brooks 903-217-7833'
    )

    expect(parsed.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run the parser tests to verify they fail**

Run: `npx vitest run src/lib/therapist-roster-source.test.ts`

Expected: FAIL because `src/lib/therapist-roster-source.ts` does not exist yet.

- [ ] **Step 3: Implement the parser and shared phone support**

```ts
import type { BulkEmployeeRosterRow } from '@/lib/employee-roster-bulk'
import { normalizeRosterFullName } from '@/lib/employee-roster-bulk'

export type TherapistRosterSourceRow = BulkEmployeeRosterRow & {
  phone_number: string | null
}

export function normalizeTherapistRosterPhone(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 10) return null
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function toDisplayName(rawName: string): string {
  const cleaned = rawName.replace(/\s+/g, ' ').trim()
  if (!cleaned.includes(',')) return cleaned
  const [lastName, firstName] = cleaned.split(',', 2).map((part) => part.trim())
  return [firstName, lastName].filter(Boolean).join(' ')
}

export function parseTherapistRosterSource(text: string) {
  const lines = text.split(/\r?\n/)
  const byNorm = new Map<string, TherapistRosterSourceRow>()

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]?.trim() ?? ''
    if (!raw) continue

    const match = raw.match(/^(.*?)\s+(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})$/)
    if (!match) {
      return {
        ok: false as const,
        line: index + 1,
        message: 'Expected name followed by phone number.',
      }
    }

    const full_name = toDisplayName(match[1] ?? '')
    const normalized_full_name = normalizeRosterFullName(full_name)
    const phone_number = normalizeTherapistRosterPhone(match[2] ?? '')

    if (!normalized_full_name || !phone_number) {
      return { ok: false as const, line: index + 1, message: 'Could not normalize roster row.' }
    }

    if (byNorm.has(normalized_full_name)) {
      return {
        ok: false as const,
        line: index + 1,
        message: 'Duplicate therapist name in source list.',
      }
    }

    byNorm.set(normalized_full_name, {
      full_name,
      normalized_full_name,
      phone_number,
      role: 'therapist',
      shift_type: 'day',
      employment_type: 'full_time',
      max_work_days_per_week: 3,
      is_lead_eligible: false,
      is_active: true,
    })
  }

  return { ok: true as const, rows: [...byNorm.values()] }
}
```

- [ ] **Step 4: Run the parser tests to verify they pass**

Run: `npx vitest run src/lib/therapist-roster-source.test.ts src/lib/employee-roster-bulk.test.ts`

Expected: PASS with the new parser green and the existing bulk roster parser still green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/therapist-roster-source.ts src/lib/therapist-roster-source.test.ts src/lib/employee-roster-bulk.ts
git commit -m "Parse the therapist source list into roster-ready rows" -m "Add a dedicated parser for the pasted therapist roster source so replacement imports can keep the existing employee_roster defaults while preserving phone numbers and duplicate detection.

Constraint: The source input provides names and phones but no emails
Rejected: Reuse the generic bulk roster parser directly | source format is narrower and needs last-name-first phone parsing
Confidence: high
Scope-risk: narrow
Reversibility: clean
Directive: Keep therapist source parsing separate from the generic roster bulk format unless the two formats truly converge
Tested: npx vitest run src/lib/therapist-roster-source.test.ts src/lib/employee-roster-bulk.test.ts
Not-tested: No browser or database verification in this commit"
```

### Task 2: Persist roster phone numbers and keep signup fallback aligned

**Files:**

- Create: `supabase/migrations/20260414163000_add_employee_roster_phone_and_signup_fallback.sql`
- Create: `src/lib/employee-roster-signup-fallback.test.ts`
- Test: `src/lib/employee-roster-signup-fallback.test.ts`

- [ ] **Step 1: Write the failing migration contract test**

```ts
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260414163000_add_employee_roster_phone_and_signup_fallback.sql'
)

describe('employee roster signup fallback migration', () => {
  it('adds roster phone storage and applies it during handle_new_user()', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)

    const sql = fs.readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('alter table public.employee_roster')
    expect(sql).toContain('add column if not exists phone_number text')
    expect(sql).toContain('create or replace function public.handle_new_user()')
    expect(sql).toContain(
      "coalesce(nullif(new.raw_user_meta_data->>'phone_number', ''), roster_match.phone_number)"
    )
  })
})
```

- [ ] **Step 2: Run the migration contract test to verify it fails**

Run: `npx vitest run src/lib/employee-roster-signup-fallback.test.ts`

Expected: FAIL because the migration file does not exist yet.

- [ ] **Step 3: Add the migration**

```sql
alter table public.employee_roster
add column if not exists phone_number text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  requested_shift text;
  first_name text;
  last_name text;
  computed_full_name text;
  normalized_name text;
  roster_match public.employee_roster%rowtype;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data->>'role', ''));
  requested_shift := lower(coalesce(new.raw_user_meta_data->>'shift_type', ''));
  first_name := nullif(new.raw_user_meta_data->>'first_name', '');
  last_name := nullif(new.raw_user_meta_data->>'last_name', '');
  computed_full_name := nullif(trim(concat_ws(' ', first_name, last_name)), '');
  normalized_name := lower(regexp_replace(coalesce(computed_full_name, nullif(new.raw_user_meta_data->>'full_name', ''), ''), '\s+', ' ', 'g'));

  select *
    into roster_match
  from public.employee_roster
  where is_active = true
    and normalized_full_name = normalized_name
    and matched_profile_id is null
  order by created_at asc
  limit 1
  for update skip locked;

  insert into public.profiles (
    id,
    full_name,
    email,
    phone_number,
    role,
    shift_type,
    employment_type,
    max_work_days_per_week,
    is_lead_eligible,
    is_active
  )
  values (
    new.id,
    coalesce(computed_full_name, nullif(new.raw_user_meta_data->>'full_name', ''), 'New User'),
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data->>'phone_number', ''), roster_match.phone_number),
    case
      when roster_match.id is not null then roster_match.role
      when requested_role in ('manager', 'therapist', 'lead') then requested_role
      else null
    end,
    case
      when roster_match.id is not null then roster_match.shift_type
      when requested_shift in ('day', 'night') then requested_shift
      else 'day'
    end,
    coalesce(roster_match.employment_type, 'full_time'),
    coalesce(roster_match.max_work_days_per_week, 3),
    coalesce(roster_match.is_lead_eligible, false),
    coalesce(roster_match.is_active, true)
  )
  on conflict (id) do nothing;

  if roster_match.id is not null then
    update public.employee_roster
    set
      matched_profile_id = new.id,
      matched_email = coalesce(new.email, ''),
      matched_at = now()
    where id = roster_match.id;
  end if;

  return new;
end;
$$;
```

- [ ] **Step 4: Run the migration contract test to verify it passes**

Run: `npx vitest run src/lib/employee-roster-signup-fallback.test.ts`

Expected: PASS and confirm the migration text contains the phone fallback behavior.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260414163000_add_employee_roster_phone_and_signup_fallback.sql src/lib/employee-roster-signup-fallback.test.ts
git commit -m "Keep roster phone data available through signup matching" -m "Add employee_roster phone storage and recreate handle_new_user() so roster-backed signups carry phone data when the signup form leaves it blank.

Constraint: Signup ownership must stay with real-email account creation
Rejected: Move phone fallback into client-side signup code | the profile is created in the auth trigger, not in the page component
Confidence: high
Scope-risk: moderate
Reversibility: clean
Directive: Any future signup changes must keep handle_new_user() aligned with employee_roster columns
Tested: npx vitest run src/lib/employee-roster-signup-fallback.test.ts
Not-tested: Migration execution against a live Supabase instance in this commit"
```

### Task 3: Implement therapist roster replacement and archival rules in server actions

**Files:**

- Create: `src/app/team/actions.test.ts`
- Modify: `src/app/team/actions.ts`
- Modify: `src/app/team/page.tsx`
- Test: `src/app/team/actions.test.ts`

- [ ] **Step 1: Write the failing server-action tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, revalidatePathMock, createClientMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  revalidatePathMock: vi.fn(),
  createClientMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

import { replaceTherapistRosterAction } from '@/app/team/actions'

describe('replaceTherapistRosterAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('replaces therapist roster rows and archives stale therapist and lead profiles', async () => {
    const formData = new FormData()
    formData.set(
      'therapist_roster_source',
      'Brooks, Tannie 903-217-7833\nCooper, Julie 281-684-0287'
    )

    const supabase = createTeamSupabaseMock({
      managerUserId: 'manager-1',
      profiles: [
        {
          id: 'demo-manager',
          full_name: 'Demo Manager',
          role: 'manager',
          is_active: true,
          archived_at: null,
        },
        {
          id: 'ther-1',
          full_name: 'Old Therapist',
          role: 'therapist',
          is_active: true,
          archived_at: null,
        },
        { id: 'lead-1', full_name: 'Old Lead', role: 'lead', is_active: true, archived_at: null },
      ],
      rosterRows: [],
    })
    createClientMock.mockResolvedValue(supabase)

    await expect(replaceTherapistRosterAction(formData)).rejects.toThrow(
      'REDIRECT:/team?success=therapist_roster_replaced&roster_bulk_count=2'
    )

    expect(supabase.__state.archivedProfileIds).toEqual(['ther-1', 'lead-1'])
    expect(supabase.__state.deletedRosterRoles).toEqual(['therapist', 'lead'])
    expect(supabase.__state.insertedRosterNames).toEqual(['Tannie Brooks', 'Julie Cooper'])
    expect(revalidatePathMock).toHaveBeenCalledWith('/team')
  })

  it('rejects non-manager users', async () => {
    createClientMock.mockResolvedValue(createTeamSupabaseMock({ managerRole: 'therapist' }))

    const formData = new FormData()
    formData.set('therapist_roster_source', 'Brooks, Tannie 903-217-7833')

    await expect(replaceTherapistRosterAction(formData)).rejects.toThrow(
      'REDIRECT:/dashboard/staff'
    )
  })
})
```

- [ ] **Step 2: Run the action tests to verify they fail**

Run: `npx vitest run src/app/team/actions.test.ts`

Expected: FAIL because `replaceTherapistRosterAction` and its mocks do not exist yet.

- [ ] **Step 3: Implement the replacement action and new feedback branch**

```ts
export async function replaceTherapistRosterAction(formData: FormData) {
  const { supabase, userId } = await requireManager()

  const sourceText = String(formData.get('therapist_roster_source') ?? '')
  const parsed = parseTherapistRosterSource(sourceText)
  if (!parsed.ok) {
    redirect(buildTeamUrl({ error: 'therapist_roster_invalid', bulk_line: String(parsed.line) }))
  }

  if (parsed.rows.length === 0) {
    redirect(buildTeamUrl({ error: 'therapist_roster_empty' }))
  }

  const { data: existingProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, role, is_active, archived_at')
    .in('role', ['therapist', 'lead'])
    .is('archived_at', null)

  if (profilesError) {
    redirect(buildTeamUrl({ error: 'therapist_roster_replace_failed' }))
  }

  const staleProfileIds = (existingProfiles ?? []).map((profile) => profile.id).filter(Boolean)

  if (staleProfileIds.length > 0) {
    const archivedAt = new Date().toISOString()
    const { error: archiveError } = await supabase
      .from('profiles')
      .update({ is_active: false, archived_at: archivedAt, archived_by: userId })
      .in('id', staleProfileIds)

    if (archiveError) {
      redirect(buildTeamUrl({ error: 'therapist_roster_replace_failed' }))
    }
  }

  const { error: deleteRosterError } = await supabase
    .from('employee_roster')
    .delete()
    .in('role', ['therapist', 'lead'])

  if (deleteRosterError) {
    redirect(buildTeamUrl({ error: 'therapist_roster_replace_failed' }))
  }

  const { error: insertRosterError } = await supabase.from('employee_roster').insert(
    parsed.rows.map((row) => ({
      ...row,
      created_by: userId,
      updated_by: userId,
    }))
  )

  if (insertRosterError) {
    redirect(buildTeamUrl({ error: 'therapist_roster_replace_failed' }))
  }

  revalidatePath('/team')
  revalidatePath('/dashboard/manager')
  revalidatePath('/availability')
  redirect(
    buildTeamUrl({
      success: 'therapist_roster_replaced',
      roster_bulk_count: String(parsed.rows.length),
    })
  )
}
```

- [ ] **Step 4: Run the action tests to verify they pass**

Run: `npx vitest run src/app/team/actions.test.ts`

Expected: PASS and confirm the replacement action preserves manager access while archiving stale therapist/lead profiles.

- [ ] **Step 5: Commit**

```bash
git add src/app/team/actions.ts src/app/team/actions.test.ts src/app/team/page.tsx
git commit -m "Replace therapist roster through a manager-only server action" -m "Add a dedicated team action that parses the therapist source list, clears stale therapist and lead roster rows, archives active therapist and lead profiles, and preserves manager access while revalidating the manager surfaces.

Constraint: The demo manager must survive the replacement path
Rejected: Overload the additive bulk roster action | replacement semantics and archival rules are materially different
Confidence: medium
Scope-risk: moderate
Reversibility: clean
Directive: Keep replacement behavior scoped to therapist and lead records unless a future product decision explicitly expands manager deletion
Tested: npx vitest run src/app/team/actions.test.ts
Not-tested: No live Supabase run against production-like data in this commit"
```

### Task 4: Add manager-facing roster workflows for phone, role status, and replacement imports

**Files:**

- Create: `src/components/team/EmployeeRosterPanel.test.ts`
- Modify: `src/components/team/EmployeeRosterPanel.tsx`
- Modify: `src/app/team/page.tsx`
- Modify: `src/app/team/actions.ts`
- Test: `src/components/team/EmployeeRosterPanel.test.ts`

- [ ] **Step 1: Write the failing UI contract tests**

```ts
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const panelSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/team/EmployeeRosterPanel.tsx'),
  'utf8'
)

describe('EmployeeRosterPanel roster-management contract', () => {
  it('collects phone numbers and exposes roster replacement copy', () => {
    expect(panelSource).toContain('name="phone_number"')
    expect(panelSource).toContain('Replace therapist roster')
    expect(panelSource).toContain('therapist_roster_source')
  })

  it('keeps employment and lead controls visible for roster maintenance', () => {
    expect(panelSource).toContain('name="employment_type"')
    expect(panelSource).toContain('name="is_lead_eligible"')
    expect(panelSource).toContain('Signed up')
  })
})
```

- [ ] **Step 2: Run the UI contract tests to verify they fail**

Run: `npx vitest run src/components/team/EmployeeRosterPanel.test.ts`

Expected: FAIL because the panel does not yet expose phone capture or a replacement import form.

- [ ] **Step 3: Update the panel and wire the new action**

```tsx
type EmployeeRosterRow = {
  id: string
  full_name: string
  role: 'manager' | 'therapist' | 'lead'
  shift_type: 'day' | 'night'
  employment_type: 'full_time' | 'part_time' | 'prn'
  max_work_days_per_week: number
  is_lead_eligible: boolean
  phone_number: string | null
  matched_profile_id: string | null
  matched_at: string | null
}

type EmployeeRosterPanelProps = {
  roster: EmployeeRosterRow[]
  upsertEmployeeRosterEntryAction: (formData: FormData) => void | Promise<void>
  bulkUpsertEmployeeRosterAction: (formData: FormData) => void | Promise<void>
  replaceTherapistRosterAction: (formData: FormData) => void | Promise<void>
  deleteEmployeeRosterEntryAction: (formData: FormData) => void | Promise<void>
}

<div className="grid gap-1.5">
  <Label htmlFor="roster-phone-number">Phone number</Label>
  <Input id="roster-phone-number" name="phone_number" inputMode="tel" placeholder="(903) 217-7833" />
</div>

<form action={replaceTherapistRosterAction} className="mt-4 grid gap-2 rounded-xl border p-4">
  <div className="grid gap-1.5">
    <Label htmlFor="therapist-roster-source">Replace therapist roster</Label>
    <textarea
      id="therapist-roster-source"
      name="therapist_roster_source"
      rows={8}
      placeholder={'Brooks, Tannie 903-217-7833\nCooper, Julie 281-684-0287'}
      className="min-h-[160px] w-full rounded-lg border bg-[var(--input-background)] px-3 py-2 text-base md:text-sm"
    />
    <p className="text-xs text-muted-foreground">
      Replaces all therapist and lead roster rows. Existing therapist and lead profiles are archived; managers are preserved.
    </p>
  </div>
  <div className="flex justify-end">
    <FormSubmitButton variant="secondary" className="h-9 px-4 text-sm">
      Replace therapist roster
    </FormSubmitButton>
  </div>
</form>
```

- [ ] **Step 4: Run the UI contract tests to verify they pass**

Run: `npx vitest run src/components/team/EmployeeRosterPanel.test.ts src/components/team/TeamDirectory.test.ts`

Expected: PASS and confirm the manager UI still exposes status controls while adding the replacement flow.

- [ ] **Step 5: Commit**

```bash
git add src/components/team/EmployeeRosterPanel.tsx src/components/team/EmployeeRosterPanel.test.ts src/app/team/page.tsx src/app/team/actions.ts
git commit -m "Expose therapist roster replacement and phone capture in the team UI" -m "Extend the employee roster panel so managers can replace the therapist list from the supplied source format, store phone numbers, and keep lead and employment controls visible in the same workflow.

Constraint: The status workflow must stay on the existing /team manager surface
Rejected: Build a separate therapist import page | duplicates roster management and increases operator overhead
Confidence: medium
Scope-risk: narrow
Reversibility: clean
Directive: Keep roster replacement copy explicit that therapist and lead records are replaced while managers stay preserved
Tested: npx vitest run src/components/team/EmployeeRosterPanel.test.ts src/components/team/TeamDirectory.test.ts
Not-tested: No browser verification of form submissions in this commit"
```

### Task 5: Run the focused verification set and normalize the plan delta

**Files:**

- Modify: `src/lib/employee-roster-bulk.test.ts`
- Modify: `src/lib/therapist-roster-source.test.ts`
- Modify: `src/app/team/actions.test.ts`
- Modify: `src/components/team/EmployeeRosterPanel.test.ts`
- Test: `src/lib/therapist-roster-source.test.ts`
- Test: `src/lib/employee-roster-signup-fallback.test.ts`
- Test: `src/app/team/actions.test.ts`
- Test: `src/components/team/EmployeeRosterPanel.test.ts`

- [ ] **Step 1: Run the targeted unit and contract suite**

Run: `npx vitest run src/lib/therapist-roster-source.test.ts src/lib/employee-roster-bulk.test.ts src/lib/employee-roster-signup-fallback.test.ts src/app/team/actions.test.ts src/components/team/EmployeeRosterPanel.test.ts src/components/team/TeamDirectory.test.ts`

Expected: PASS across parser, migration-contract, server-action, and UI-contract coverage.

- [ ] **Step 2: Run lint on touched files**

Run: `npx eslint src/lib/therapist-roster-source.ts src/lib/therapist-roster-source.test.ts src/lib/employee-roster-signup-fallback.test.ts src/app/team/actions.ts src/app/team/actions.test.ts src/components/team/EmployeeRosterPanel.tsx src/components/team/EmployeeRosterPanel.test.ts`

Expected: PASS with no new lint errors.

- [ ] **Step 3: Run the full unit suite if the targeted set is green**

Run: `npm run test:unit`

Expected: PASS, or only pre-existing failures unrelated to roster onboarding.

- [ ] **Step 4: Inspect the final diff before handoff**

Run: `git diff --stat`

Expected: Diff is limited to roster parsing, migration, team actions/UI, and tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260414163000_add_employee_roster_phone_and_signup_fallback.sql src/lib/therapist-roster-source.ts src/lib/therapist-roster-source.test.ts src/lib/employee-roster-signup-fallback.test.ts src/app/team/actions.ts src/app/team/actions.test.ts src/components/team/EmployeeRosterPanel.tsx src/components/team/EmployeeRosterPanel.test.ts src/app/team/page.tsx src/lib/employee-roster-bulk.ts src/lib/employee-roster-bulk.test.ts
git commit -m "Finish roster-first therapist onboarding replacement" -m "Complete the roster-first import path by persisting therapist phones, replacing stale therapist and lead records, preserving managers, and keeping the team UI aligned with lead and employment workflows.

Constraint: Real-email signup must continue to own account creation
Rejected: Placeholder auth accounts for imported therapists | conflicts with the existing signup contract and future real-email onboarding
Confidence: medium
Scope-risk: moderate
Reversibility: clean
Directive: Do not reintroduce placeholder-auth imports without replacing the signup-match architecture end-to-end
Tested: npx vitest run src/lib/therapist-roster-source.test.ts src/lib/employee-roster-bulk.test.ts src/lib/employee-roster-signup-fallback.test.ts src/app/team/actions.test.ts src/components/team/EmployeeRosterPanel.test.ts src/components/team/TeamDirectory.test.ts; npx eslint src/lib/therapist-roster-source.ts src/lib/therapist-roster-source.test.ts src/lib/employee-roster-signup-fallback.test.ts src/app/team/actions.ts src/app/team/actions.test.ts src/components/team/EmployeeRosterPanel.tsx src/components/team/EmployeeRosterPanel.test.ts; npm run test:unit
Not-tested: No manual browser walkthrough or live Supabase migration run in this commit"
```

## Spec Coverage Check

- Replace therapist and lead roster with the supplied list: covered by Tasks 1, 3, and 4.
- Preserve the demo manager: covered by Task 3 archival scope and replacement rules.
- Remove stale therapist and lead records from active use: covered by Task 3.
- Support lead and `full_time` / `prn` workflows: covered by Task 4.
- Keep real-email signup attached to roster matches: covered by Task 2.
- Store and propagate phone numbers: covered by Tasks 1, 2, and 4.

## Placeholder Scan

- No `TODO`, `TBD`, or deferred “add validation later” steps remain.
- Every code-changing step includes concrete code or SQL.
- Every verification step has an exact command and an expected outcome.

## Type Consistency Check

- `phone_number` is used consistently in roster rows, migration SQL, and panel props.
- `employment_type` remains `full_time | part_time | prn`.
- Lead workflow continues to use `is_lead_eligible` without changing permission-bearing roles by default.
