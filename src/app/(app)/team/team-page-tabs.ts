import type { TeamWorkspaceTab } from '@/components/team/TeamWorkspaceClient'

export type TeamSearchParams = {
  tab?: string | string[]
}

export function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export function getInitialTeamTab(params?: TeamSearchParams): TeamWorkspaceTab {
  return getSearchParam(params?.tab) === 'roster' ? 'roster' : 'directory'
}
