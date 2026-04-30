import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  completeStaffOnboardingAction,
  loadStaffOnboardingContext,
} from '@/app/(app)/onboarding/actions'
import { FeedbackToast } from '@/components/feedback-toast'
import { FormSubmitButton } from '@/components/form-submit-button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { StaffOnboardingStepStatus } from '@/lib/staff-onboarding'

type OnboardingSearchParams = Record<string, string | string[] | undefined>

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getOnboardingFeedback(
  params?: OnboardingSearchParams
): { message: string; variant: 'error' } | null {
  const error = getSearchParam(params?.error)
  if (error === 'incomplete') {
    return {
      message: 'Finish setup is only available after the required steps are complete.',
      variant: 'error',
    }
  }

  if (error === 'complete_failed') {
    return {
      message: 'We could not finish setup. Please try again.',
      variant: 'error',
    }
  }

  return null
}

function StepStatusBadge({ complete }: { complete: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        complete
          ? 'bg-[var(--success-subtle)] text-[var(--success-text)]'
          : 'bg-secondary text-secondary-foreground'
      }`}
    >
      {complete ? 'Complete' : 'Required'}
    </span>
  )
}

function OnboardingStepCard({
  title,
  description,
  step,
}: {
  title: string
  description: string
  step: StaffOnboardingStepStatus
}) {
  return (
    <Card className="border-border/90">
      <CardHeader className="gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <CardAction>
          <StepStatusBadge complete={step.complete} />
        </CardAction>
      </CardHeader>
      <CardFooter className="justify-between gap-3 border-t border-border/70">
        <p className="text-sm text-muted-foreground">
          {step.complete
            ? 'This step is ready. You can reopen it any time.'
            : 'Complete this step before you finish setup.'}
        </p>
        <Link
          href={step.href}
          className="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-secondary/30"
        >
          {step.complete ? 'Review step' : 'Open step'}
        </Link>
      </CardFooter>
    </Card>
  )
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<OnboardingSearchParams>
}) {
  const context = await loadStaffOnboardingContext()
  const params = searchParams ? await searchParams : undefined
  const feedback = getOnboardingFeedback(params)

  if (!context.status.isRequired) {
    redirect('/dashboard')
  }

  if (context.status.hasRecordedCompletion) {
    redirect('/dashboard?success=onboarding_complete')
  }

  return (
    <div className="space-y-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <Card className="border-border/90">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">Setup your account</CardTitle>
          <CardDescription>
            Before you use Teamwise, tell us your normal schedule and the defaults you want us to
            use.
          </CardDescription>
        </CardHeader>
      </Card>

      <OnboardingStepCard
        title="Set your normal schedule"
        description="Save the repeating schedule you normally work so the rest of the app starts from the right baseline."
        step={context.status.steps.schedule}
      />
      <OnboardingStepCard
        title="Choose schedule preferences"
        description="Confirm your preferred work-day defaults and schedule-view preferences."
        step={context.status.steps.preferences}
      />
      <OnboardingStepCard
        title="Choose notifications and appearance"
        description="Pick your notification defaults and confirm the theme you want to use."
        step={context.status.steps.notificationsAppearance}
      />

      {context.status.shouldRecommendAvailability ? (
        <Card className="border-border/90">
          <CardHeader>
            <CardTitle>Review Future Availability</CardTitle>
            <CardDescription>
              This is recommended next, but you can finish setup without it.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-end border-t border-border/70">
            <Link
              href="/therapist/availability"
              className="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-secondary/30"
            >
              Open Future Availability
            </Link>
          </CardFooter>
        </Card>
      ) : null}

      <Card className="border-border/90">
        <CardHeader>
          <CardTitle>Finish setup</CardTitle>
          <CardDescription>
            {context.status.isComplete
              ? 'All required steps are complete. Finish setup to continue into the app.'
              : 'Finish setup becomes available after the three required steps are complete.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={completeStaffOnboardingAction}>
            <FormSubmitButton
              type="submit"
              pendingText="Finishing setup..."
              disabled={!context.status.isComplete}
            >
              Finish setup
            </FormSubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
