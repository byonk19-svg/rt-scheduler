'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { EmployeeEmploymentType, EmployeeShiftType } from '@/lib/employee-directory'
import { createClient } from '@/lib/supabase/client'

type DirectoryEmployee = {
  id: string
  name: string
  email: string
  shift: 'Day' | 'Night'
  type: 'Full-time' | 'Part-time' | 'PRN'
  isLead: boolean
  fmla: boolean
  inactive: boolean
}

type DirectoryProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  role: 'manager' | 'therapist' | null
  shift_type: EmployeeShiftType | null
  employment_type: EmployeeEmploymentType | null
  is_lead_eligible: boolean | null
  on_fmla: boolean | null
  is_active: boolean | null
}

type ShiftTab = 'All' | 'Day' | 'Night'
type SortCol = 'name' | 'shift' | 'type'
type SortDir = 'asc' | 'desc'

function initials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function mapShiftLabel(value: EmployeeShiftType | null): 'Day' | 'Night' {
  return value === 'night' ? 'Night' : 'Day'
}

function mapEmploymentLabel(value: EmployeeEmploymentType | null): 'Full-time' | 'Part-time' | 'PRN' {
  if (value === 'prn') return 'PRN'
  if (value === 'part_time') return 'Part-time'
  return 'Full-time'
}

export default function TeamPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [employees, setEmployees] = useState<DirectoryEmployee[]>([])
  const [shiftTab, setShiftTab] = useState<ShiftTab>('All')
  const [search, setSearch] = useState('')
  const [filterLead, setFilterLead] = useState(false)
  const [filterFmla, setFilterFmla] = useState(false)
  const [filterInactive, setFilterInactive] = useState(false)
  const [sortCol, setSortCol] = useState<SortCol>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadEmployees() {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active) return

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return

      if ((currentProfile as { role?: string } | null)?.role !== 'manager') {
        router.replace('/dashboard/staff')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, shift_type, employment_type, is_lead_eligible, on_fmla, is_active')
        .eq('role', 'therapist')
        .order('shift_type', { ascending: true })
        .order('full_name', { ascending: true })

      if (!active) return

      if (error) {
        console.error('Failed to load directory employees:', error)
        setEmployees([])
        setLoading(false)
        return
      }

      const mapped = ((data ?? []) as DirectoryProfileRow[]).map((row) => {
        const name = row.full_name?.trim() || row.email?.trim() || 'Unknown employee'
        const email = row.email?.trim() || 'No email'

        return {
          id: row.id,
          name,
          email,
          shift: mapShiftLabel(row.shift_type),
          type: mapEmploymentLabel(row.employment_type),
          isLead: row.is_lead_eligible === true,
          fmla: row.on_fmla === true,
          inactive: row.is_active === false,
        } satisfies DirectoryEmployee
      })

      setEmployees(mapped)
      setLoading(false)
    }

    void loadEmployees()

    return () => {
      active = false
    }
  }, [router, supabase])

  const filtered = employees
    .filter((employee) => shiftTab === 'All' || employee.shift === shiftTab)
    .filter((employee) => !filterLead || employee.isLead)
    .filter((employee) => !filterFmla || employee.fmla)
    .filter((employee) => filterInactive || !employee.inactive)
    .filter(
      (employee) =>
        search === '' ||
        employee.name.toLowerCase().includes(search.toLowerCase()) ||
        employee.email.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const av = a[sortCol].toLowerCase()
      const bv = b[sortCol].toLowerCase()
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : av < bv ? 1 : -1
    })

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ col }: { col: SortCol }) => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 4, opacity: sortCol === col ? 1 : 0.3 }}>
      <path d="M5 1l2.5 3h-5L5 1zM5 9L2.5 6h5L5 9z" fill={sortCol === col ? '#d97706' : '#9ca3af'} />
    </svg>
  )

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', padding: '32px 28px' }}>
      <div className="fade-up" style={{ marginBottom: 6 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          Team Directory
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Manage staffing details for your team.</p>
      </div>

      <div className="fade-up" style={{ animationDelay: '0.04s', marginTop: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Employee Directory</h2>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
          Search, filter, and maintain active staffing profiles in one place.
        </p>
      </div>

      <div className="fade-up" style={{ animationDelay: '0.06s', display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['All', 'Day', 'Night'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setShiftTab(tab)}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '5px 16px',
              borderRadius: 7,
              border: `1px solid ${shiftTab === tab ? '#d97706' : '#e5e7eb'}`,
              background: shiftTab === tab ? '#d97706' : '#fff',
              color: shiftTab === tab ? '#fff' : '#64748b',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="fade-up" style={{ animationDelay: '0.08s', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="6" cy="6" r="4" stroke="#9ca3af" strokeWidth="1.5" />
            <path d="M9.5 9.5l2.5 2.5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
            style={{
              width: '100%',
              padding: '7px 10px 7px 30px',
              border: '1px solid #e5e7eb',
              borderRadius: 7,
              fontSize: 12,
              color: '#374151',
              outline: 'none',
              background: '#fff',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Filters:</span>
          {[
            { label: 'Lead', val: filterLead, set: setFilterLead },
            { label: 'FMLA', val: filterFmla, set: setFilterFmla },
            { label: 'Include inactive', val: filterInactive, set: setFilterInactive },
          ].map(({ label, val, set }) => (
            <label
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
                fontSize: 12,
                color: '#374151',
                fontWeight: val ? 700 : 400,
              }}
            >
              <input
                type="checkbox"
                checked={val}
                onChange={(event) => set(event.target.checked)}
                style={{ accentColor: '#d97706', width: 13, height: 13, cursor: 'pointer' }}
              />
              {label}
            </label>
          ))}
        </div>
        <button
          type="button"
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: '7px 16px',
            borderRadius: 7,
            border: 'none',
            background: '#d97706',
            color: '#fff',
            marginLeft: 'auto',
            cursor: 'pointer',
          }}
        >
          + Add employee
        </button>
      </div>

      <p className="fade-up" style={{ animationDelay: '0.09s', fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
        {loading ? 'Loading...' : `${filtered.length} employee${filtered.length !== 1 ? 's' : ''}`}
      </p>

      <div className="fade-up" style={{ animationDelay: '0.1s', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
              {[
                { label: 'Employee', col: 'name' as const, width: '35%' },
                { label: 'Shift', col: 'shift' as const, width: '15%' },
                { label: 'Type', col: 'type' as const, width: '15%' },
                { label: 'Tags', col: null, width: '25%' },
                { label: 'Actions', col: null, width: '10%' },
              ].map(({ label, col, width }) => (
                <th
                  key={label}
                  onClick={col ? () => toggleSort(col) : undefined}
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 800,
                    color: sortCol === col ? '#d97706' : '#6b7280',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    cursor: col ? 'pointer' : 'default',
                    width,
                    userSelect: 'none',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {label}
                    {col && <SortIcon col={col} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((employee, index) => (
              <tr key={employee.id} style={{ borderBottom: index < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: '#1c1917',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24' }}>{initials(employee.name)}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{employee.name}</p>
                      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{employee.email}</p>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#374151',
                      background: '#f1f5f9',
                      border: '1px solid #e5e7eb',
                      padding: '2px 10px',
                      borderRadius: 20,
                    }}
                  >
                    {employee.shift}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: employee.type === 'PRN' ? '#6d28d9' : '#374151',
                      background: employee.type === 'PRN' ? '#f5f3ff' : '#f8fafc',
                      border: `1px solid ${employee.type === 'PRN' ? '#ddd6fe' : '#e5e7eb'}`,
                      padding: '2px 10px',
                      borderRadius: 20,
                    }}
                  >
                    {employee.type}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {employee.isLead && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#b45309',
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          padding: '2px 9px',
                          borderRadius: 20,
                        }}
                      >
                        Lead
                      </span>
                    )}
                    {employee.fmla && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#dc2626',
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          padding: '2px 9px',
                          borderRadius: 20,
                        }}
                      >
                        FMLA
                      </span>
                    )}
                    {!employee.isLead && !employee.fmla && <span style={{ fontSize: 11, color: '#d1d5db' }}>-</span>}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 16,
                      color: '#9ca3af',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    ...
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && !loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            No employees match your filters.
          </div>
        )}
      </div>
    </div>
  )
}
