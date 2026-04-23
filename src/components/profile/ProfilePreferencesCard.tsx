'use client'

import { FormSubmitButton } from '@/components/form-submit-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ProfilePreferencesCard({
  defaultCalendarView,
  defaultLandingPage,
  defaultScheduleView,
  savePreferencesAction,
}: {
  defaultCalendarView: 'day' | 'night'
  defaultLandingPage: 'dashboard' | 'coverage'
  defaultScheduleView: 'week' | 'roster'
  savePreferencesAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <Card className="border-border/90">
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>
          Set your default calendar view and where you land after sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={savePreferencesAction} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label
                htmlFor="default_calendar_view"
                className="text-sm font-medium text-foreground"
              >
                Default calendar view
              </label>
              <select
                id="default_calendar_view"
                name="default_calendar_view"
                defaultValue={defaultCalendarView}
                className="h-9 w-full rounded-md border border-border bg-[var(--input-background)] px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="day">Day</option>
                <option value="night">Night</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Default Day/Night tab when you open Coverage. Does not change your profile shift
                assignment.
              </p>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="default_schedule_view"
                className="text-sm font-medium text-foreground"
              >
                Default schedule layout
              </label>
              <select
                id="default_schedule_view"
                name="default_schedule_view"
                defaultValue={defaultScheduleView}
                className="h-9 w-full rounded-md border border-border bg-[var(--input-background)] px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="week">Grid</option>
                <option value="roster">Roster</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Grid vs roster view on Coverage only. Other pages (for example My shifts) are
                unchanged.
              </p>
            </div>
            <div className="space-y-1">
              <label htmlFor="default_landing_page" className="text-sm font-medium text-foreground">
                Default landing page
              </label>
              <select
                id="default_landing_page"
                name="default_landing_page"
                defaultValue={defaultLandingPage}
                className="h-9 w-full rounded-md border border-border bg-[var(--input-background)] px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="dashboard">Dashboard</option>
                <option value="coverage">Coverage</option>
              </select>
              <p className="text-xs text-muted-foreground">
                First screen after sign-in. Managers and therapists both use this; it does not grant
                extra permissions.
              </p>
            </div>
          </div>
          <FormSubmitButton type="submit" pendingText="Saving...">
            Save preferences
          </FormSubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
