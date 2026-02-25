'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'
import type { AssignmentStatus, ShiftRole, ShiftStatus } from '@/app/schedule/types'

type UiStatus = 'active' | 'oncall' | 'leave_early' | 'cancelled'
type DayStatus = 'published' | 'draft' | 'override' | 'missing_lead'
type ShiftTab = 'Day' | 'Night'

type ShiftLog = { from: string; to: UiStatus; toLabel: string; time: string }
type ShiftItem = { id: string; name: string; status: UiStatus; log: ShiftLog[] }
type DayItem = {
  id: string
  isoDate: string
  date: number
  label: string
  dayStatus: DayStatus
  leadShift: ShiftItem | null
  staffShifts: ShiftItem[]
}

type CycleRow = { id: string; start_date: string; end_date: string }
type ShiftRow = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  assignment_status: AssignmentStatus | null
  role: ShiftRole
  profiles: { full_name: string } | { full_name: string }[] | null
}

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const SHIFT_STATUSES: Record<UiStatus, { label: string; color: string; bg: string; border: string }> = {
  active: { label: 'Active', color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
  oncall: { label: 'On Call', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  leave_early: { label: 'Leave Early', color: '#2563eb', bg: '#f9fafb', border: '#e5e7eb' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function toUiStatus(assignment: AssignmentStatus | null, status: ShiftStatus): UiStatus {
  if (assignment === 'on_call') return 'oncall'
  if (assignment === 'left_early') return 'leave_early'
  if (assignment === 'call_in' || assignment === 'cancelled') return 'cancelled'
  if (assignment === 'scheduled') return 'active'
  if (status === 'on_call') return 'oncall'
  if (status === 'sick' || status === 'called_off') return 'cancelled'
  return 'active'
}

function toAssignment(value: UiStatus): AssignmentStatus {
  if (value === 'oncall') return 'on_call'
  if (value === 'leave_early') return 'left_early'
  if (value === 'cancelled') return 'cancelled'
  return 'scheduled'
}

function toShiftStatus(value: UiStatus): ShiftStatus {
  if (value === 'oncall') return 'on_call'
  if (value === 'cancelled') return 'called_off'
  return 'scheduled'
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dateRange(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return []
  const out: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${d}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function timestamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function flatten(day: DayItem): Array<ShiftItem & { isLead: boolean }> {
  const lead = day.leadShift ? [{ ...day.leadShift, isLead: true }] : []
  return [...lead, ...day.staffShifts.map((row) => ({ ...row, isLead: false }))]
}

function countBy(day: DayItem, status: UiStatus): number {
  return flatten(day).filter((row) => row.status === status).length
}

function countActive(day: DayItem): number {
  return flatten(day).filter((row) => row.status !== 'cancelled').length
}

function Avatar({ name, status, size = 18 }: { name: string; status: UiStatus; size?: number }) {
  const bg = status === 'cancelled' ? '#ef4444' : status === 'oncall' ? '#ea580c' : '#d97706'
  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: bg,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: size * 0.38,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </span>
  )
}

export default function CoveragePage() {
  const router = useRouter()
  const search = useSearchParams()
  const cycleFromUrl = search.get('cycle')
  const supabase = useMemo(() => createClient(), [])
  const [shiftTab, setShiftTab] = useState<ShiftTab>('Day')
  const [dayDays, setDayDays] = useState<DayItem[]>([])
  const [nightDays, setNightDays] = useState<DayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null)
  const [error, setError] = useState<string>('')
  const days = shiftTab === 'Day' ? dayDays : nightDays
  const setDays = shiftTab === 'Day' ? setDayDays : setNightDays

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')

      try {
        const today = new Date()
        const fallbackStartDate = toIsoDate(today)
        const fallbackEndDate = toIsoDate(addDays(today, 42))
        let cycleStartDate = fallbackStartDate
        let cycleEndDate = fallbackEndDate
        let cycleId: string | null = null

        const { data: cyclesData, error: cyclesError } = await supabase
          .from('schedule_cycles')
          .select('id, start_date, end_date')
          .order('start_date', { ascending: false })

        if (!active) return
        if (cyclesError) {
          console.error('Could not load cycles for coverage; falling back to a 6-week window:', cyclesError)
        } else {
          const cycles = (cyclesData ?? []) as CycleRow[]
          const todayKey = toIsoDate(today)
          const cycle =
            cycles.find((row) => row.id === cycleFromUrl) ??
            cycles.find((row) => row.start_date <= todayKey && row.end_date >= todayKey) ??
            cycles[0] ??
            null
          if (cycle) {
            cycleId = cycle.id
            cycleStartDate = cycle.start_date
            cycleEndDate = cycle.end_date
          }
        }

        let shiftsQuery = supabase
          .from('shifts')
          .select('id,date,shift_type,status,assignment_status,role,profiles:profiles!shifts_user_id_fkey(full_name)')
          .gte('date', cycleStartDate)
          .lte('date', cycleEndDate)
          .order('date', { ascending: true })

        if (cycleId) {
          shiftsQuery = shiftsQuery.eq('cycle_id', cycleId)
        }

        const { data: shiftsData, error: shiftsError } = await shiftsQuery

        if (!active) return
        if (shiftsError) {
          setError(shiftsError.message || 'Could not load shifts.')
          setDayDays([])
          setNightDays([])
          return
        }

        const rows = (shiftsData ?? []) as ShiftRow[]
        const mapByShiftType = (shiftType: ShiftRow['shift_type']): DayItem[] => {
          const byDate = new Map<string, ShiftRow[]>()
          for (const row of rows) {
            if (row.shift_type !== shiftType) continue
            const bucket = byDate.get(row.date) ?? []
            bucket.push(row)
            byDate.set(row.date, bucket)
          }

          return dateRange(cycleStartDate, cycleEndDate).map((isoDate) => {
            const slot = (byDate.get(isoDate) ?? []).slice().sort((a, b) => {
              if (a.role !== b.role) return a.role === 'lead' ? -1 : 1
              return (getOne(a.profiles)?.full_name ?? '').localeCompare(getOne(b.profiles)?.full_name ?? '')
            })
            const lead = slot.find((row) => row.role === 'lead') ?? null
            const leadShift =
              lead === null
                ? null
                : {
                    id: lead.id,
                    name: getOne(lead.profiles)?.full_name ?? 'Unknown',
                    status: toUiStatus(lead.assignment_status, lead.status),
                    log: [],
                  }
            const staffShifts = slot
              .filter((row) => row.id !== lead?.id)
              .map((row) => ({
                id: row.id,
                name: getOne(row.profiles)?.full_name ?? 'Unknown',
                status: toUiStatus(row.assignment_status, row.status),
                log: [],
              }))
            const hasOverride = slot.some((row) => row.status === 'called_off')
            const hasDraft = slot.some((row) => row.status === 'sick')
            const dayStatus: DayStatus = !leadShift ? 'missing_lead' : hasOverride ? 'override' : hasDraft ? 'draft' : 'published'
            const date = new Date(`${isoDate}T00:00:00`)
            return {
              id: isoDate,
              isoDate,
              date: date.getDate(),
              label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              dayStatus,
              leadShift,
              staffShifts,
            } satisfies DayItem
          })
        }

        setDayDays(mapByShiftType('day'))
        setNightDays(mapByShiftType('night'))
      } catch (loadError) {
        console.error('Could not load coverage calendar data:', loadError)
        setError('Could not load coverage schedule.')
        setDayDays([])
        setNightDays([])
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [cycleFromUrl, supabase])

  const selectedDayBase = days.find((row) => row.id === selectedId) ?? null
  const selectedDay = selectedDayBase ? { ...selectedDayBase, shiftType: shiftTab } : null

  const handleTabSwitch = (tab: ShiftTab) => {
    setShiftTab(tab)
    setExpandedShiftId(null)
    setSelectedId(null)
  }

  const handleSelect = (id: string) => {
    setExpandedShiftId(null)
    setSelectedId((prev) => (prev === id ? null : id))
  }
  const handleClose = () => {
    setExpandedShiftId(null)
    setSelectedId(null)
  }
  const publishRoute = cycleFromUrl ? `/coverage?view=week&cycle=${cycleFromUrl}` : '/coverage?view=week'

  const handleChangeStatus = useCallback(
    async (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => {
      // Keep callback aligned with the active shift tab setter.
      void shiftTab
      const targetDay = days.find((day) => day.id === dayId)
      const targetShift = isLead
        ? targetDay?.leadShift
        : targetDay?.staffShifts.find((shift) => shift.id === shiftId)

      if (!targetShift?.id) {
        console.error('Could not find shift row id for status update.', { dayId, shiftId, isLead })
        return
      }

      if (targetShift.status === nextStatus) {
        return
      }

      const previousDays = days
      const previousStatus = targetShift.status
      const changeTime = timestamp()
      setError('')

      setDays((current) =>
        current.map((day) => {
          if (day.id !== dayId) return day
          const updateShift = (shift: ShiftItem | null): ShiftItem | null => {
            if (!shift || shift.id !== shiftId || shift.status === nextStatus) return shift
            return {
              ...shift,
              status: nextStatus,
              log: [
                ...shift.log,
                {
                  from: SHIFT_STATUSES[previousStatus].label,
                  to: nextStatus,
                  toLabel: SHIFT_STATUSES[nextStatus].label,
                  time: changeTime,
                },
              ],
            }
          }
          return {
            ...day,
            leadShift: isLead ? updateShift(day.leadShift) : day.leadShift,
            staffShifts: isLead ? day.staffShifts : day.staffShifts.map((shift) => updateShift(shift) as ShiftItem),
          }
        })
      )

      const { error: updateError } = await supabase
        .from('shifts')
        .update({
          assignment_status: toAssignment(nextStatus),
          status: toShiftStatus(nextStatus),
        })
        .eq('id', targetShift.id)

      if (!updateError) return

      console.error('Failed to persist coverage status change:', updateError)
      setDays(previousDays)
      setError('Could not save status update. Changes were rolled back.')
      if (typeof window !== 'undefined') {
        window.alert('Could not save status change. Please try again.')
      }
    },
    [days, setDays, shiftTab, supabase]
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-7 py-6">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Coverage</h1>
            <p className="mt-1 text-sm text-slate-500">Click a day to edit therapist statuses</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Auto-draft</button>
            <button
              type="button"
              onClick={() => router.push(publishRoute)}
              className="rounded-md bg-amber-600 px-4 py-1.5 text-xs font-bold text-white"
            >
              Publish
            </button>
          </div>
        </div>
        {error && <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {(['Day', 'Night'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabSwitch(tab)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 20px',
                borderRadius: 7,
                border: `1px solid ${shiftTab === tab ? '#d97706' : '#e5e7eb'}`,
                background: shiftTab === tab ? '#d97706' : '#fff',
                color: shiftTab === tab ? '#fff' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab} Shift
            </button>
          ))}
          <span
            style={{
              fontSize: 12,
              color: '#9ca3af',
              alignSelf: 'center',
              marginLeft: 8,
              fontWeight: 500,
            }}
          >
            {shiftTab === 'Day' ? 'Day shift staff' : 'Night shift staff'}
          </span>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1.5">
          {DOW.map((day) => (
            <div key={day} className="text-center text-[10px] font-extrabold tracking-[0.07em] text-slate-400">{day}</div>
          ))}
        </div>
        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500">
            Loading schedule...
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((day) => {
            const activeCount = countActive(day)
            const totalCount = flatten(day).length
            const missingLead = !day.leadShift
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => handleSelect(day.id)}
                className="rounded-lg border border-slate-200 bg-white p-2 text-left hover:border-amber-600"
                style={selectedId === day.id ? { borderColor: '#d97706', boxShadow: '0 0 0 3px rgba(217,119,6,0.15)' } : undefined}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-slate-900">{day.date}</span>
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ color: missingLead ? '#dc2626' : '#047857', background: missingLead ? '#fee2e2' : '#ecfdf5' }}>
                    {activeCount}/{totalCount}
                  </span>
                </div>
                <div className="mb-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                  {day.leadShift ? `Lead: ${day.leadShift.name.split(' ')[0]}` : 'No lead'}
                </div>
                <div className="flex flex-wrap gap-1">
                  {day.staffShifts.map((shift) => {
                    const tone =
                      shift.status === 'cancelled'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : shift.status === 'oncall'
                          ? 'border-orange-200 bg-orange-50 text-orange-700'
                          : shift.status === 'leave_early'
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                    return (
                      <span
                        key={shift.id}
                        className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}
                      >
                        <Avatar name={shift.name} status={shift.status} size={14} />
                        <span className={shift.status === 'cancelled' ? 'line-through' : ''}>
                          {shift.name.split(' ')[0]}
                        </span>
                        {shift.status === 'oncall' && <span className="font-extrabold">OC</span>}
                        {shift.status === 'leave_early' && <span className="font-extrabold">LE</span>}
                        {shift.status === 'cancelled' && <span className="font-extrabold">X</span>}
                      </span>
                    )
                  })}
                </div>
              </button>
            )
            })}
          </div>
        )}
      </div>

      <div className="fixed inset-0 z-40 bg-black/10 transition-opacity" style={{ opacity: selectedDay ? 1 : 0, pointerEvents: selectedDay ? 'auto' : 'none' }} onClick={handleClose} />
      <aside className="fixed bottom-0 right-0 top-0 z-50 w-[360px] bg-white shadow-2xl transition-transform" style={{ transform: selectedDay ? 'translateX(0)' : 'translateX(100%)' }}>
        {selectedDay && (
          <div className="flex h-full flex-col">
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-4">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="text-lg font-extrabold text-stone-900">{selectedDay.label}</p>
                  <p className="text-xs font-medium text-amber-800">{selectedDay.shiftType || 'Day'} Shift</p>
                </div>
                <button type="button" onClick={handleClose} aria-label="Close details panel" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-500 shadow-sm">
                  &times;
                </button>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-bold">
                <span className="text-emerald-700">OK {countActive(selectedDay)} active</span>
                <span className="text-orange-700">OC {countBy(selectedDay, 'oncall')}</span>
                <span className="text-blue-700">LE {countBy(selectedDay, 'leave_early')}</span>
                <span className="text-red-700">X {countBy(selectedDay, 'cancelled')}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {flatten(selectedDay).map((shift) => {
                const expanded = expandedShiftId === shift.id
                return (
                  <div key={shift.id} className="mb-2 overflow-hidden rounded-lg border border-slate-200">
                    <button type="button" onClick={() => setExpandedShiftId((prev) => (prev === shift.id ? null : shift.id))} className="flex w-full items-center gap-2 px-3 py-2 text-left">
                      <Avatar name={shift.name} status={shift.status} size={expanded ? 34 : 28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{shift.name}</p>
                        <p className="text-xs font-semibold" style={{ color: SHIFT_STATUSES[shift.status].color }}>{SHIFT_STATUSES[shift.status].label}</p>
                      </div>
                      {shift.isLead && <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">Lead</span>}
                    </button>
                    {expanded && (
                      <div className="border-t border-slate-100 px-3 py-3">
                        <div className="mb-2 flex flex-wrap gap-1">
                          {(Object.keys(SHIFT_STATUSES) as UiStatus[]).map((statusKey) => {
                            const activeStatus = shift.status === statusKey
                            return (
                              <button
                                key={`${shift.id}-${statusKey}`}
                                type="button"
                                disabled={activeStatus}
                                onClick={() => handleChangeStatus(selectedDay.id, shift.id, shift.isLead, statusKey)}
                                className="flex-1 rounded-md border px-2 py-1 text-xs font-bold disabled:cursor-default"
                                style={{ borderColor: activeStatus ? SHIFT_STATUSES[statusKey].border : '#e5e7eb', background: activeStatus ? SHIFT_STATUSES[statusKey].bg : '#fff', color: activeStatus ? SHIFT_STATUSES[statusKey].color : '#9ca3af' }}
                              >
                                {SHIFT_STATUSES[statusKey].label}
                              </button>
                            )
                          })}
                        </div>
                        {shift.log.length > 0 && (
                          <div className="space-y-1 border-t border-slate-100 pt-2">
                            <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Changes</p>
                            {shift.log.map((entry, index) => (
                              <div key={`${shift.id}-log-${index}`} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                <span className="font-semibold text-slate-700">{entry.from}</span>
                                <span>-&gt;</span>
                                <span className="font-bold" style={{ color: SHIFT_STATUSES[entry.to].color }}>{entry.toLabel}</span>
                                <span className="ml-auto">{entry.time}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
