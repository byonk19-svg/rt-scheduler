import { redirect } from 'next/navigation'

/** Canonical staff schedule UI lives on `/coverage` (permission-gated actions). */
export default function TherapistSchedulePage() {
  redirect('/coverage?view=week')
}
