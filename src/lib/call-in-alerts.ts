function formatShortDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function shouldCreateCallInAlert(params: {
  published: boolean
  nextStatus: 'scheduled' | 'on_call' | 'cancelled' | 'call_in' | 'left_early'
}): boolean {
  return params.published && params.nextStatus === 'call_in'
}

export function buildCallInAlertMessage(params: { date: string; shiftType: 'day' | 'night' }) {
  return `Call-in help needed for the ${params.shiftType === 'day' ? 'Day' : 'Night'} shift on ${formatShortDate(params.date)}.`
}
