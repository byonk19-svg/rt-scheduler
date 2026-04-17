import { redirect } from 'next/navigation'

import { ImportWizard } from '@/components/team/ImportWizard'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

import { bulkImportRosterAction } from './actions'

export default async function TeamImportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!can(parseRole(profileData?.role), 'access_manager_ui')) {
    redirect('/dashboard/staff')
  }

  return (
    <div className="max-w-5xl space-y-6 py-6">
      <ManagerWorkspaceHeader
        title="Import roster"
        subtitle="Map CSV columns from legacy exports and import only the valid rows."
        className="px-0"
      />
      <ImportWizard bulkImportRosterAction={bulkImportRosterAction} />
    </div>
  )
}
