import { readFileSync } from 'node:fs'
import path from 'node:path'

const LEGACY_BUILD_INFO_FILES = ['tsconfig.tsbuildinfo']

function isWindowsDrivePath(value) {
  return /^[a-zA-Z]:[\\/]/.test(String(value ?? ''))
}

function selectPathApi(...values) {
  return values.some(isWindowsDrivePath) ? path.win32 : path
}

function normalizeRelativePath(value) {
  return String(value ?? '').replace(/\\/g, '/')
}

function isSafeRepoLocalPath(repoRootPath, candidatePath) {
  const pathApi = selectPathApi(repoRootPath, candidatePath)
  const relative = pathApi.relative(repoRootPath, candidatePath)
  return Boolean(relative) && !relative.startsWith('..') && !pathApi.isAbsolute(relative)
}

function readTsBuildInfoFile(tsconfigPath) {
  try {
    const raw = readFileSync(tsconfigPath, 'utf8')
    const parsed = JSON.parse(raw)
    const tsBuildInfoFile = parsed?.compilerOptions?.tsBuildInfoFile
    return typeof tsBuildInfoFile === 'string' ? tsBuildInfoFile.trim() : ''
  } catch {
    return ''
  }
}

export function resolveTypecheckArtifactTargets({ repoRootPath, tsconfigPath }) {
  const pathApi = selectPathApi(repoRootPath)
  const targets = new Set(
    LEGACY_BUILD_INFO_FILES.map((relativePath) => pathApi.resolve(repoRootPath, relativePath))
  )

  const tsBuildInfoFile = readTsBuildInfoFile(tsconfigPath)
  if (tsBuildInfoFile) {
    targets.add(pathApi.resolve(repoRootPath, tsBuildInfoFile))
  }

  return [...targets]
    .filter((candidatePath) => isSafeRepoLocalPath(repoRootPath, candidatePath))
    .sort((left, right) =>
      normalizeRelativePath(pathApi.relative(repoRootPath, left)).localeCompare(
        normalizeRelativePath(pathApi.relative(repoRootPath, right))
      )
    )
}
