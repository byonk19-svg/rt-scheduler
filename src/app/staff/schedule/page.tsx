import { redirect } from 'next/navigation'

export default function StaffLegacyScheduleRoute() {
  redirect('/coverage?view=week')
}
