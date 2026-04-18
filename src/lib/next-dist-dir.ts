type ResolveNextDistDirOptions = {
  cwd?: string
  envDistDir?: string | undefined
  localAppData?: string | undefined
  nodeEnv?: string | undefined
  platform?: NodeJS.Platform
  tempDir?: string
}

function isWindowsOneDriveWorkspace(cwd: string, platform: NodeJS.Platform) {
  if (platform !== 'win32') return false

  return cwd.replaceAll('/', '\\').toLowerCase().includes('\\onedrive\\')
}

function shouldExternalizeWindowsDevArtifacts({
  cwd,
  nodeEnv,
  platform,
}: {
  cwd: string
  nodeEnv: string | undefined
  platform: NodeJS.Platform
}) {
  return nodeEnv === 'development' && isWindowsOneDriveWorkspace(cwd, platform)
}

export function resolveNextDistDir({
  cwd,
  envDistDir,
  nodeEnv,
  platform,
}: ResolveNextDistDirOptions = {}) {
  const resolvedCwd = cwd ?? process.cwd()
  const resolvedEnvDistDir = envDistDir ?? process.env.NEXT_DIST_DIR
  const resolvedNodeEnv = nodeEnv ?? process.env.NODE_ENV
  const resolvedPlatform = platform ?? process.platform

  if (resolvedEnvDistDir) return resolvedEnvDistDir

  if (
    shouldExternalizeWindowsDevArtifacts({
      cwd: resolvedCwd,
      nodeEnv: resolvedNodeEnv,
      platform: resolvedPlatform,
    })
  ) {
    return '.next-dev'
  }

  return '.next'
}
