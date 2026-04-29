import { readFileSync } from 'node:fs'
import path from 'node:path'

const LEGACY_BUILD_INFO_FILES = ['tsconfig.tsbuildinfo']

function normalizeRelativePath(value) {
  return String(value ?? '').replace(/\\/g, '/')
}

function isSafeRepoLocalPath(repoRootPath, candidatePath) {
  const relative = path.relative(repoRootPath, candidatePath)
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative)
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
  const targets = new Set(
    LEGACY_BUILD_INFO_FILES.map((relativePath) => path.resolve(repoRootPath, relativePath))
  )

  const tsBuildInfoFile = readTsBuildInfoFile(tsconfigPath)
  if (tsBuildInfoFile) {
    targets.add(path.resolve(repoRootPath, tsBuildInfoFile))
  }

  return [...targets]
    .filter((candidatePath) => isSafeRepoLocalPath(repoRootPath, candidatePath))
    .sort((left, right) =>
      normalizeRelativePath(path.relative(repoRootPath, left)).localeCompare(
        normalizeRelativePath(path.relative(repoRootPath, right))
      )
    )
}
