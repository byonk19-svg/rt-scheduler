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

function normalizeForComparison(value) {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase()
}

export function buildLocalArtifactCleanupPlan({
  rootEntries,
  worktreeHelperPaths = [],
  registeredWorktreePaths = [],
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

  const registered = new Set(registeredWorktreePaths.map(normalizeForComparison))
  const staleWorktrees = worktreeHelperPaths
    .filter((worktreePath) => !registered.has(normalizeForComparison(worktreePath)))
    .sort((left, right) => left.localeCompare(right))

  return {
    directories,
    files,
    staleWorktrees,
    targets: [...directories, ...files, ...staleWorktrees],
  }
}
