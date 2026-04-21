'use client'

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ClipboardList,
  Users,
} from 'lucide-react'

import { PageIntro } from '@/components/shell/PageIntro'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import type {
  LotteryHistoryItem,
  LotteryPageSnapshot,
  LotteryRecommendationActionView,
  LotteryShiftType,
} from '@/lib/lottery/service'

function formatDateLabel(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function recommendationStateVariant(state: LotteryPageSnapshot['recommendation'] extends infer T
  ? T extends { state: infer U }
    ? U
    : never
  : never) {
  if (state === 'applied') return 'success'
  if (state === 'stale') return 'warning'
  return 'info'
}

function actionStatusVariant(status: LotteryRecommendationActionView['status']) {
  return status === 'cancelled' ? 'error' : 'info'
}

function sameActions(
  left: LotteryRecommendationActionView[],
  right: Array<{ therapistId: string; status: 'cancelled' | 'on_call' }>
): boolean {
  if (left.length !== right.length) return false
  const leftSignature = JSON.stringify(
    left
      .map((item) => ({ therapistId: item.therapistId, status: item.status }))
      .sort((a, b) => a.status.localeCompare(b.status) || a.therapistId.localeCompare(b.therapistId))
  )
  const rightSignature = JSON.stringify(
    right
      .slice()
      .sort((a, b) => a.status.localeCompare(b.status) || a.therapistId.localeCompare(b.therapistId))
  )
  return leftSignature === rightSignature
}

export default function LotteryClientPage({
  initialSnapshot,
}: {
  initialSnapshot: LotteryPageSnapshot
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [selectedDate, setSelectedDate] = useState(initialSnapshot.selectedDate ?? '')
  const [selectedShift, setSelectedShift] = useState<LotteryShiftType>(initialSnapshot.selectedShift)
  const [keepToWorkInput, setKeepToWorkInput] = useState(
    initialSnapshot.keepToWork == null ? '' : String(initialSnapshot.keepToWork)
  )
  const deferredKeepToWork = useDeferredValue(keepToWorkInput)
  const [requestTab, setRequestTab] = useState<'slot' | 'mine'>('slot')
  const [mobileSection, setMobileSection] = useState<'requests' | 'list'>('requests')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyTitle, setHistoryTitle] = useState('Lottery history')
  const [historyItems, setHistoryItems] = useState<LotteryHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [managerAddTherapistId, setManagerAddTherapistId] = useState('')
  const [managerTimestamp, setManagerTimestamp] = useState('')
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideSelections, setOverrideSelections] = useState<Record<string, 'working' | 'cancelled' | 'on_call'>>({})

  useEffect(() => {
    if (!selectedDate) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        date: selectedDate,
        shift: selectedShift,
      })
      if (deferredKeepToWork.trim() !== '') params.set('keepToWork', deferredKeepToWork.trim())
      const response = await fetch(`/api/lottery/snapshot?${params.toString()}`, { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as { snapshot?: LotteryPageSnapshot; error?: string } | null
      if (cancelled) return
      if (!response.ok || !payload?.snapshot) {
        setError(payload?.error ?? 'Could not load the Lottery workspace.')
        setLoading(false)
        return
      }
      startTransition(() => {
        setSnapshot(payload.snapshot as LotteryPageSnapshot)
        setLoading(false)
      })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [deferredKeepToWork, selectedDate, selectedShift])

  const recommendation = snapshot.recommendation
  const managerSelectedTherapistId =
    managerAddTherapistId &&
    snapshot.requestableTherapists.some((person) => person.therapistId === managerAddTherapistId)
      ? managerAddTherapistId
      : (snapshot.requestableTherapists[0]?.therapistId ?? '')
  const recommendedSelections = useMemo(() => {
    const next: Record<string, 'working' | 'cancelled' | 'on_call'> = {}
    for (const candidate of snapshot.recommendationCandidates) {
      next[candidate.therapistId] = 'working'
    }
    for (const action of recommendation?.actions ?? []) {
      next[action.therapistId] = action.status
    }
    return next
  }, [recommendation?.actions, snapshot.recommendationCandidates])

  async function reloadSnapshot(nextKeepToWork = keepToWorkInput) {
    const params = new URLSearchParams({
      date: selectedDate,
      shift: selectedShift,
    })
    if (nextKeepToWork.trim() !== '') params.set('keepToWork', nextKeepToWork.trim())
    const response = await fetch(`/api/lottery/snapshot?${params.toString()}`, { cache: 'no-store' })
    const payload = (await response.json().catch(() => null)) as { snapshot?: LotteryPageSnapshot; error?: string } | null
    if (!response.ok || !payload?.snapshot) {
      setError(payload?.error ?? 'Could not refresh the Lottery workspace.')
      return false
    }
    setSnapshot(payload.snapshot)
    return true
  }

  async function postJson(url: string, body: Record<string, unknown>) {
    setError(null)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    if (!response.ok) {
      setError(payload?.error ?? 'That Lottery action could not be saved.')
      return false
    }
    await reloadSnapshot()
    return true
  }

  async function handleViewHistory(therapistId: string, therapistName: string) {
    setHistoryOpen(true)
    setHistoryLoading(true)
    setHistoryItems([])
    setHistoryTitle(`${therapistName} history`)
    const params = new URLSearchParams({
      therapistId,
      shift: selectedShift,
    })
    const response = await fetch(`/api/lottery/history?${params.toString()}`, { cache: 'no-store' })
    const payload = (await response.json().catch(() => null)) as { history?: LotteryHistoryItem[]; error?: string } | null
    if (!response.ok || !payload?.history) {
      setError(payload?.error ?? 'Could not load Lottery history.')
      setHistoryLoading(false)
      return
    }
    setHistoryItems(payload.history)
    setHistoryLoading(false)
  }

  async function handleAddOwnRequest() {
    if (!selectedDate) return
    await postJson('/api/lottery/request', {
      action: 'add',
      shiftDate: selectedDate,
      shiftType: selectedShift,
    })
  }

  async function handleRemoveRequest(
    therapistId: string,
    shiftDate = selectedDate,
    shiftType = selectedShift
  ) {
    if (!shiftDate) return
    await postJson('/api/lottery/request', {
      action: 'remove',
      therapistId,
      shiftDate,
      shiftType,
    })
  }

  async function handleManagerAddRequest() {
    if (!selectedDate || !managerSelectedTherapistId) return
    await postJson('/api/lottery/request', {
      action: 'add',
      therapistId: managerSelectedTherapistId,
      shiftDate: selectedDate,
      shiftType: selectedShift,
      requestedAt: managerTimestamp ? new Date(managerTimestamp).toISOString() : null,
    })
    setManagerTimestamp('')
  }

  async function handleAddMissingListEntry(therapistId: string) {
    await postJson('/api/lottery/list', {
      action: 'add',
      therapistId,
      shiftType: selectedShift,
    })
  }

  async function handleMoveList(entryId: string, direction: 'move_up' | 'move_down') {
    await postJson('/api/lottery/list', {
      action: direction,
      entryId,
      shiftType: selectedShift,
    })
  }

  async function handleApply(actions: Array<{ therapistId: string; status: 'cancelled' | 'on_call' }>) {
    if (!recommendation || !selectedDate) return
    const ok = await postJson('/api/lottery/apply', {
      shiftDate: selectedDate,
      shiftType: selectedShift,
      keepToWork: recommendation.keepToWork,
      contextSignature: recommendation.contextSignature,
      actions,
    })
    if (ok) {
      setOverrideOpen(false)
    }
  }

  const overrideActionSummary = useMemo(() => {
    const actions = Object.entries(overrideSelections)
      .filter(([, status]) => status !== 'working')
      .map(([therapistId, status]) => ({
        therapistId,
        status,
      })) as Array<{ therapistId: string; status: 'cancelled' | 'on_call' }>
    return actions
  }, [overrideSelections])

  const overrideValidationError = useMemo(() => {
    if (!recommendation) return 'Generate a recommendation before applying an override.'
    if (overrideActionSummary.length !== recommendation.reductionsNeeded) {
      return `Select exactly ${recommendation.reductionsNeeded} therapist${recommendation.reductionsNeeded === 1 ? '' : 's'} to reduce.`
    }
    const onCallCount = overrideActionSummary.filter((item) => item.status === 'on_call').length
    const cancelledCount = overrideActionSummary.filter((item) => item.status === 'cancelled').length
    if (overrideActionSummary.length === 1 && onCallCount !== 1) {
      return 'A single reduction must be recorded as on call.'
    }
    if (overrideActionSummary.length > 1 && (onCallCount !== 1 || cancelledCount !== overrideActionSummary.length - 1)) {
      return 'Multi-person reductions must have exactly one on-call therapist and cancel everyone else.'
    }
    return null
  }, [overrideActionSummary, recommendation])

  const isRecommendedOverride = recommendation
    ? sameActions(recommendation.actions, overrideActionSummary)
    : false

  function renderRequestList() {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={requestTab === 'slot' ? 'default' : 'outline'}
            onClick={() => setRequestTab('slot')}
          >
            Shift requests
          </Button>
          <Button
            type="button"
            size="sm"
            variant={requestTab === 'mine' ? 'default' : 'outline'}
            onClick={() => setRequestTab('mine')}
          >
            My requests
          </Button>
        </div>

        {requestTab === 'slot' ? (
          <>
            <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-3 text-sm">
              <p className="font-medium text-foreground">
                {snapshot.canCurrentUserRequest
                  ? 'You are scheduled and can volunteer for this shift.'
                  : snapshot.currentUserHasRequest
                    ? 'You already requested this shift.'
                    : 'Only full-time therapists currently scheduled on this shift can request it.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleAddOwnRequest()}
                  disabled={!snapshot.canCurrentUserRequest}
                >
                  Request this shift off
                </Button>
              </div>
            </div>

            {snapshot.actor.canManageList && snapshot.requestableTherapists.length > 0 ? (
              <div className="rounded-lg border border-border/70 bg-card px-3 py-3">
                <p className="text-sm font-medium text-foreground">Add on behalf of a therapist</p>
                <div className="mt-3 grid gap-3">
                  <select
                    className="min-h-11 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={managerSelectedTherapistId}
                    onChange={(event) => setManagerAddTherapistId(event.target.value)}
                  >
                    {snapshot.requestableTherapists.map((person) => (
                      <option key={person.therapistId} value={person.therapistId}>
                        {person.therapistName}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="datetime-local"
                    value={managerTimestamp}
                    onChange={(event) => setManagerTimestamp(event.target.value)}
                    aria-label="Manager timestamp"
                  />
                  <Button type="button" size="sm" onClick={() => void handleManagerAddRequest()}>
                    Add request
                  </Button>
                </div>
              </div>
            ) : null}

            {snapshot.requestList.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
                No active requests for this shift yet.
              </div>
            ) : (
              <div className="space-y-2">
                {snapshot.requestList.map((request) => {
                  const canRemove =
                    snapshot.actor.canManageList || request.therapistId === snapshot.actor.userId
                  return (
                    <div
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-3"
                    >
                      <div>
                        <p className="font-medium text-foreground">{request.therapistName}</p>
                        <p className="text-xs text-muted-foreground">
                          Signed up {formatDateTime(request.requestedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {request.therapistId === snapshot.actor.userId ? (
                          <Badge variant="outline">You</Badge>
                        ) : null}
                        {canRemove ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleRemoveRequest(request.therapistId)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : snapshot.myRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
            No upcoming Lottery requests yet.
          </div>
        ) : (
          <div className="space-y-2">
            {snapshot.myRequests.map((request) => (
              <div
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-3"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {formatDateLabel(request.shiftDate)} · {request.shiftType === 'night' ? 'Night' : 'Day'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested {formatDateTime(request.requestedAt)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void handleRemoveRequest(
                      snapshot.actor.userId,
                      request.shiftDate,
                      request.shiftType
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderLotteryList() {
    return (
      <div className="space-y-4">
        {snapshot.missingListEntries.length > 0 ? (
          <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-3">
            <p className="text-sm font-medium text-[var(--warning-text)]">
              Scheduled full-time therapists are missing from the fixed Lottery order.
            </p>
            <div className="mt-3 space-y-2">
              {snapshot.missingListEntries.map((entry) => (
                <div key={entry.therapistId} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--warning-text)]">{entry.therapistName}</span>
                  {snapshot.actor.canManageList ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleAddMissingListEntry(entry.therapistId)}
                    >
                      Add to list
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {snapshot.lotteryList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
            No fixed Lottery order is set for the {selectedShift} shift yet.
          </div>
        ) : (
          <div className="space-y-2">
            {snapshot.lotteryList.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-3"
              >
                <div>
                  <p className="font-medium text-foreground">{entry.therapistName}</p>
                  <p className="text-xs text-muted-foreground">
                    Last lotteried:{' '}
                    {entry.lastLotteriedDate ? formatDateLabel(entry.lastLotteriedDate) : ' '}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleViewHistory(entry.therapistId, entry.therapistName)}
                  >
                    History
                  </Button>
                  {snapshot.actor.canManageList ? (
                    <>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => void handleMoveList(entry.id, 'move_up')}
                        aria-label={`Move ${entry.therapistName} up`}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => void handleMoveList(entry.id, 'move_down')}
                        aria-label={`Move ${entry.therapistName} down`}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-5">
      <PageIntro
        title="Lottery"
        subtitle="Preview low-census reductions, track request order, and apply the result against the live published schedule."
        summary={
          <>
            <Badge variant="outline">
              <CalendarDays className="h-3 w-3" />
              {snapshot.selectedDate ? formatDateLabel(snapshot.selectedDate) : 'No date selected'}
            </Badge>
            <Badge variant="outline">
              <Users className="h-3 w-3" />
              {selectedShift === 'night' ? 'Night shift' : 'Day shift'}
            </Badge>
            <Badge variant="outline">
              <ClipboardList className="h-3 w-3" />
              {snapshot.workingScheduledCount} working
            </Badge>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
          <CardDescription>Pick the date, shift, and keep-to-work count before reviewing the recommendation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Date</span>
            <select
              className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            >
              {snapshot.availableDates.map((date) => (
                <option key={date} value={date}>
                  {formatDateLabel(date)}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Shift</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={selectedShift === 'day' ? 'default' : 'outline'}
                onClick={() => setSelectedShift('day')}
              >
                Day
              </Button>
              <Button
                type="button"
                variant={selectedShift === 'night' ? 'default' : 'outline'}
                onClick={() => setSelectedShift('night')}
              >
                Night
              </Button>
            </div>
          </div>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Keep working</span>
            <Input
              type="number"
              min={0}
              max={snapshot.workingScheduledCount}
              value={keepToWorkInput}
              onChange={(event) => setKeepToWorkInput(event.target.value)}
            />
          </label>
        </CardContent>
      </Card>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm text-[var(--error-text)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="lg:order-1">
          <CardHeader>
            <CardTitle>Recommendation</CardTitle>
            <CardDescription>
              Preview the exact people who should be notified before anything is applied.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="rounded-lg border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
                Loading Lottery data…
              </div>
            ) : snapshot.recommendationError ? (
              <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-4 py-4 text-sm text-[var(--warning-text)]">
                {snapshot.recommendationError}
              </div>
            ) : !recommendation ? (
              <div className="rounded-lg border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
                Enter a keep-to-work number to generate the recommendation.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge variant={recommendationStateVariant(recommendation.state)}>
                    {recommendation.state === 'applied'
                      ? 'Applied'
                      : recommendation.state === 'stale'
                        ? 'Outdated'
                        : 'Preview'}
                  </StatusBadge>
                  <Badge variant="outline">
                    Keep working: {recommendation.keepToWork}
                  </Badge>
                  <Badge variant="outline">
                    Reduce: {recommendation.reductionsNeeded}
                  </Badge>
                  {recommendation.overrideApplied ? <Badge variant="outline">Override on file</Badge> : null}
                </div>

                <div className="space-y-2">
                  {recommendation.actions.length === 0 ? (
                    <div className="rounded-lg border border-border/70 px-3 py-3 text-sm text-muted-foreground">
                      Everyone stays working on this shift.
                    </div>
                  ) : (
                    recommendation.actions.map((action) => (
                      <div
                        key={`${action.therapistId}-${action.status}`}
                        className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-3"
                      >
                        <div>
                          <p className="font-medium text-foreground">{action.therapistName}</p>
                          <p className="text-xs text-muted-foreground">Notify this therapist now.</p>
                        </div>
                        <StatusBadge variant={actionStatusVariant(action.status)}>
                          {action.status === 'cancelled' ? 'Cancelled' : 'On Call'}
                        </StatusBadge>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2 rounded-lg border border-border/70 bg-muted/15 px-3 py-3 text-sm">
                  {recommendation.explanation.map((line) => (
                    <p key={line} className="text-muted-foreground">
                      {line}
                    </p>
                  ))}
                  {recommendation.latestAppliedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Last applied {formatDateTime(recommendation.latestAppliedAt)}
                      {recommendation.latestAppliedBy ? ` by ${recommendation.latestAppliedBy}` : ''}.
                    </p>
                  ) : null}
                </div>

                {snapshot.actor.canApply ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() =>
                        void handleApply(
                          recommendation.actions.map((action) => ({
                            therapistId: action.therapistId,
                            status: action.status,
                          }))
                        )
                      }
                    >
                      {recommendation.state === 'applied' ? 'Reapply result' : 'Apply result'}
                    </Button>
                    {snapshot.actor.role === 'manager' ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setOverrideSelections(recommendedSelections)
                          setOverrideOpen(true)
                        }}
                      >
                        Manager override
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:order-2">
          <CardHeader>
            <CardTitle>Request List</CardTitle>
            <CardDescription>
              Volunteers are shown in stored sign-up order for the selected date and shift.
            </CardDescription>
          </CardHeader>
          <CardContent className="hidden lg:block">{renderRequestList()}</CardContent>
          <CardContent className="lg:hidden">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mobileSection === 'requests' ? 'default' : 'outline'}
                onClick={() => setMobileSection('requests')}
              >
                Requests
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mobileSection === 'list' ? 'default' : 'outline'}
                onClick={() => setMobileSection('list')}
              >
                Lottery list
              </Button>
            </div>
            <div className="mt-4">{mobileSection === 'requests' ? renderRequestList() : renderLotteryList()}</div>
          </CardContent>
        </Card>

        <Card className="hidden lg:flex lg:order-3">
          <CardHeader>
            <CardTitle>Lottery List</CardTitle>
            <CardDescription>
              Fixed full-time order for {selectedShift === 'night' ? 'night' : 'day'} shift, with the latest counted Lottery date.
            </CardDescription>
          </CardHeader>
          <CardContent>{renderLotteryList()}</CardContent>
        </Card>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{historyTitle}</DialogTitle>
            <DialogDescription>
              Full Lottery history, including overrides, invalidations, and restored requests.
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="rounded-lg border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
              Loading history…
            </div>
          ) : historyItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
              No Lottery history found for this therapist and shift.
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {historyItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/70 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge variant={actionStatusVariant(item.appliedStatus)}>
                      {item.appliedStatus === 'cancelled' ? 'Cancelled' : 'On Call'}
                    </StatusBadge>
                    <Badge variant="outline">{formatDateLabel(item.shiftDate)}</Badge>
                    {item.overrideApplied ? <Badge variant="outline">Override</Badge> : null}
                    {item.requestRestored ? <Badge variant="outline">Request restored</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Recorded {formatDateTime(item.createdAt)}
                    {item.createdByName ? ` by ${item.createdByName}` : ''}.
                  </p>
                  {item.invalidatedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Invalidated {formatDateTime(item.invalidatedAt)}
                      {item.invalidatedReason ? ` (${item.invalidatedReason.replace('_', ' ')})` : ''}.
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manager override</DialogTitle>
            <DialogDescription>
              Override the recommended set as one confirmed action. The final applied statuses will be logged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {snapshot.recommendationCandidates.map((candidate) => (
              <div
                key={candidate.therapistId}
                className="grid gap-2 rounded-lg border border-border/70 px-3 py-3 md:grid-cols-[minmax(0,1fr)_180px]"
              >
                <div>
                  <p className="font-medium text-foreground">{candidate.therapistName}</p>
                  <p className="text-xs text-muted-foreground">
                    {candidate.employmentType === 'prn'
                      ? 'PRN'
                      : candidate.employmentType === 'part_time'
                        ? 'Part-time'
                        : 'Full-time'}
                  </p>
                </div>
                <select
                  className="min-h-11 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={overrideSelections[candidate.therapistId] ?? 'working'}
                  onChange={(event) =>
                    setOverrideSelections((current) => ({
                      ...current,
                      [candidate.therapistId]: event.target.value as 'working' | 'cancelled' | 'on_call',
                    }))
                  }
                >
                  <option value="working">Keep working</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="on_call">On Call</option>
                </select>
              </div>
            ))}
            {overrideValidationError ? (
              <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-3 text-sm text-[var(--warning-text)]">
                {overrideValidationError}
              </div>
            ) : isRecommendedOverride ? (
              <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-3 text-sm text-muted-foreground">
                These selections match the current recommendation.
              </div>
            ) : (
              <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-3 text-sm text-muted-foreground">
                This override will replace the recommended people for this shift.
              </div>
            )}
          </div>
          <DialogFooter showCloseButton={false}>
            <Button
              type="button"
              onClick={() => void handleApply(overrideActionSummary)}
              disabled={Boolean(overrideValidationError)}
            >
              Confirm override
            </Button>
            <Button type="button" variant="outline" onClick={() => setOverrideOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
