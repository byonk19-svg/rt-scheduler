import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    // Git worktrees may live under repo root; never lint their build output (avoids ENOENT on partial .next).
    '.worktrees/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.tmp_lovable_import_*/**',
    '.reference/**',
    // Local Cursor skills / tooling (not app source)
    '.cursor/**',
  ]),
])

export default eslintConfig
