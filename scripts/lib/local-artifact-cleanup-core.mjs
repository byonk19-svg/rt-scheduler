import path from 'node:path'

const GENERATED_DIRECTORY_NAMES = new Set([
  '.next',
  '.next-dev',
  '.tmp',
  'artifacts',
  'playwright-report',
  'shots',
  'test-results',
])

const ROOT_FILE_PATTERNS = [
  /^\.codex-.*\.(?:log|err\.log|out\.log)$/i,
  /^\.tmp-.*\.(?:json|log|html|txt)$/i,
  /\.tsbuildinfo$/i,
]

function isWindowsDrivePath(value) {
  return /^[a-zA-Z]:[\\/]/.test(String(value ?? ''))
}

function selectPathApi(...values) {
  return values.some(isWindowsDrivePath) ? path.win32 : path
}

function normalizeForComparison(value) {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase()
}

function resolveRepoLocalPath(repoRootPath, candidatePath) {
  if (!repoRootPath || !candidatePath) {
    return normalizeForComparison(candidatePath)
  }

  const pathApi = selectPathApi(repoRootPath, candidatePath)
  if (pathApi.isAbsolute(candidatePath)) {
    return normalizeForComparison(candidatePath)
  }

  return normalizeForComparison(pathApi.resolve(repoRootPath, candidatePath))
}

export function buildLocalArtifactCleanupPlan({
  rootEntries,
  worktreeHelperPaths = [],
  registeredWorktreePaths = [],
  repoRootPath = null,
}) {
  const directories = rootEntries
    .filter((entry) => entry.kind === 'directory' && GENERATED_DIRECTORY_NAMES.has(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  const files = rootEntries
    .filter(
      (entry) =>
        entry.kind === 'file' && ROOT_FILE_PATTERNS.some((pattern) => pattern.test(entry.name))
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  const registered = new Set(
    registeredWorktreePaths.map((registeredPath) =>
      resolveRepoLocalPath(repoRootPath, registeredPath)
    )
  )
  const staleWorktrees = worktreeHelperPaths
    .filter((worktreePath) => !registered.has(resolveRepoLocalPath(repoRootPath, worktreePath)))
    .sort((left, right) => left.localeCompare(right))

  return {
    directories,
    files,
    staleWorktrees,
    targets: [...directories, ...files, ...staleWorktrees],
  }
}
