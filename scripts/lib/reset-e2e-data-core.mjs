import fs from 'node:fs'
import path from 'node:path'

const IDENTIFIER_PATTERN = '[A-Za-z_][A-Za-z0-9_$]*'

/**
 * @typedef {{ name: string, sql: string }} MigrationSql
 * @typedef {{ name: string, firstColumn: string, references: string[] }} ResetTablePlan
 * @typedef {{ tables: ResetTablePlan[], deleteOrder: string[] }} ResetSchemaPlan
 * @typedef {{ id: string, email?: string | null }} AuthUserLike
 * @typedef {{ user: AuthUserLike, email: string }} AuthDeletionMatch
 */

function normalizeIdentifier(value) {
  return String(value ?? '').replace(/^"+|"+$/g, '')
}

function buildQualifiedTablePattern(schemaName = 'public') {
  return `(?:\"${schemaName}\"|${schemaName})\\s*\\.\\s*(?:\"([^\"]+)\"|(${IDENTIFIER_PATTERN}))`
}

function readMigrationSqlFiles(migrationsDir) {
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({
      name,
      sql: fs.readFileSync(path.join(migrationsDir, name), 'utf8'),
    }))
}

function scanBalancedSection(source, startIndex, openChar = '(', closeChar = ')') {
  let depth = 1
  let i = startIndex
  let inSingleQuote = false
  let inDoubleQuote = false
  let inDollarQuote = null
  let inLineComment = false
  let inBlockComment = false

  while (i < source.length) {
    const char = source[i]
    const next = source[i + 1] ?? ''

    if (inLineComment) {
      if (char === '\n') inLineComment = false
      i += 1
      continue
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        i += 2
        continue
      }
      i += 1
      continue
    }

    if (inDollarQuote) {
      if (source.startsWith(inDollarQuote, i)) {
        i += inDollarQuote.length
        inDollarQuote = null
        continue
      }
      i += 1
      continue
    }

    if (inSingleQuote) {
      if (char === "'" && next === "'") {
        i += 2
        continue
      }
      if (char === "'") inSingleQuote = false
      i += 1
      continue
    }

    if (inDoubleQuote) {
      if (char === '"') inDoubleQuote = false
      i += 1
      continue
    }

    if (char === '-' && next === '-') {
      inLineComment = true
      i += 2
      continue
    }

    if (char === '/' && next === '*') {
      inBlockComment = true
      i += 2
      continue
    }

    if (char === '$') {
      const dollarMatch = source.slice(i).match(/^\$[A-Za-z0-9_]*\$/)
      if (dollarMatch) {
        inDollarQuote = dollarMatch[0]
        i += inDollarQuote.length
        continue
      }
    }

    if (char === "'") {
      inSingleQuote = true
      i += 1
      continue
    }

    if (char === '"') {
      inDoubleQuote = true
      i += 1
      continue
    }

    if (char === openChar) {
      depth += 1
      i += 1
      continue
    }

    if (char === closeChar) {
      depth -= 1
      if (depth === 0) {
        return {
          body: source.slice(startIndex, i),
          endIndex: i,
        }
      }
      i += 1
      continue
    }

    i += 1
  }

  throw new Error(`Unbalanced ${openChar}${closeChar} section while parsing migrations.`)
}

function splitTopLevelCommaSections(body) {
  const sections = []
  let start = 0
  let depth = 0
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let i = 0; i < body.length; i += 1) {
    const char = body[i]
    const next = body[i + 1] ?? ''

    if (inSingleQuote) {
      if (char === "'" && next === "'") {
        i += 1
        continue
      }
      if (char === "'") inSingleQuote = false
      continue
    }

    if (inDoubleQuote) {
      if (char === '"') inDoubleQuote = false
      continue
    }

    if (char === "'") {
      inSingleQuote = true
      continue
    }

    if (char === '"') {
      inDoubleQuote = true
      continue
    }

    if (char === '(') {
      depth += 1
      continue
    }

    if (char === ')') {
      depth -= 1
      continue
    }

    if (char === ',' && depth === 0) {
      sections.push(body.slice(start, i))
      start = i + 1
    }
  }

  sections.push(body.slice(start))
  return sections
}

function parsePublicReferences(fragment) {
  const refs = []
  const refPattern = new RegExp(`references\\s+${buildQualifiedTablePattern('public')}`, 'gi')

  for (const match of fragment.matchAll(refPattern)) {
    refs.push(normalizeIdentifier(match[1] ?? match[2]))
  }

  return refs
}

function parseCreateTableDefinitions(migrationSqlFiles) {
  /** @type {Map<string, { firstColumn: string, references: Set<string> }>} */
  const tables = new Map()
  const createTablePattern = new RegExp(
    `create\\s+table\\s+if\\s+not\\s+exists\\s+${buildQualifiedTablePattern('public')}\\s*\\(`,
    'gi'
  )

  for (const { sql } of migrationSqlFiles) {
    for (const match of sql.matchAll(createTablePattern)) {
      const tableName = normalizeIdentifier(match[1] ?? match[2])
      const openIndex = match.index + match[0].length
      const { body } = scanBalancedSection(sql, openIndex)
      const entries = splitTopLevelCommaSections(body)
      const columns = []
      const references = new Set()

      for (const entry of entries) {
        const trimmed = entry.trim()
        if (!trimmed) continue
        if (/^(constraint|primary\s+key|unique|check|foreign\s+key)\b/i.test(trimmed)) {
          for (const ref of parsePublicReferences(trimmed)) references.add(ref)
          continue
        }

        const columnMatch = trimmed.match(
          new RegExp(`^(?:\"([^\"]+)\"|(${IDENTIFIER_PATTERN}))(?:\\s|$)`, 'i')
        )
        if (!columnMatch) continue

        const columnName = normalizeIdentifier(columnMatch[1] ?? columnMatch[2])
        columns.push(columnName)
        for (const ref of parsePublicReferences(trimmed)) references.add(ref)
      }

      if (columns.length === 0) {
        throw new Error(`Unable to derive columns for public.${tableName} from migrations.`)
      }

      tables.set(tableName, {
        firstColumn: columns[0],
        references,
      })
    }
  }

  return tables
}

function parseAlterTableReferences(migrationSqlFiles, tables) {
  const alterStatementPattern = new RegExp(
    `alter\\s+table(?:\\s+only)?\\s+${buildQualifiedTablePattern('public')}[\\s\\S]*?;`,
    'gi'
  )

  for (const { sql } of migrationSqlFiles) {
    for (const match of sql.matchAll(alterStatementPattern)) {
      const tableName = normalizeIdentifier(match[1] ?? match[2])
      if (!tables.has(tableName)) continue
      const statement = match[0]
      for (const ref of parsePublicReferences(statement)) {
        tables.get(tableName)?.references.add(ref)
      }
    }
  }
}

function buildDeleteOrder(tableNames, childToParents) {
  /** @type {Map<string, Set<string>>} */
  const parentToChildren = new Map(tableNames.map((name) => [name, new Set()]))
  /** @type {Map<string, number>} */
  const indegree = new Map(tableNames.map((name) => [name, 0]))

  for (const [child, parents] of childToParents.entries()) {
    for (const parent of parents) {
      if (!parentToChildren.has(parent)) parentToChildren.set(parent, new Set())
      parentToChildren.get(parent)?.add(child)
      indegree.set(child, (indegree.get(child) ?? 0) + 1)
    }
  }

  const queue = tableNames.filter((name) => (indegree.get(name) ?? 0) === 0).sort()
  const topo = []

  while (queue.length > 0) {
    const current = queue.shift()
    topo.push(current)

    for (const child of [...(parentToChildren.get(current) ?? [])].sort()) {
      const nextDegree = (indegree.get(child) ?? 0) - 1
      indegree.set(child, nextDegree)
      if (nextDegree === 0) {
        queue.push(child)
        queue.sort()
      }
    }
  }

  if (topo.length !== tableNames.length) {
    const unresolved = tableNames.filter((name) => !topo.includes(name)).sort()
    throw new Error(
      `Could not derive a dependency-safe delete order from the current public schema. Unresolved tables: ${unresolved.join(', ')}`
    )
  }

  return topo.reverse()
}

/**
 * @param {string} migrationsDir
 * @returns {ResetSchemaPlan}
 */
export function loadResetSchemaPlan(migrationsDir) {
  const migrationSqlFiles = readMigrationSqlFiles(migrationsDir)
  const tables = parseCreateTableDefinitions(migrationSqlFiles)
  parseAlterTableReferences(migrationSqlFiles, tables)

  const tablePlans = [...tables.entries()]
    .map(([name, details]) => ({
      name,
      firstColumn: details.firstColumn,
      references: [...details.references].filter((ref) => tables.has(ref) && ref !== name).sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const childToParents = new Map(tablePlans.map((table) => [table.name, new Set(table.references)]))

  return {
    tables: tablePlans,
    deleteOrder: buildDeleteOrder(
      tablePlans.map((table) => table.name),
      childToParents
    ),
  }
}

function normalizeEmail(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

/**
 * Only Auth users in @teamwise.test are eligible for the fresh-auth delete path.
 *
 * @param {AuthUserLike[]} users
 * @returns {{ matches: AuthDeletionMatch[], skipped: AuthUserLike[], summary: { total: number, matched: number, skipped: number } }}
 */
export function buildTeamwiseTestAuthDeletionPlan(users) {
  const matches = []
  const skipped = []

  for (const user of users) {
    const email = normalizeEmail(user.email)
    if (email.endsWith('@teamwise.test')) {
      matches.push({ user, email })
      continue
    }
    skipped.push(user)
  }

  matches.sort((left, right) => left.email.localeCompare(right.email))

  return {
    matches,
    skipped,
    summary: {
      total: users.length,
      matched: matches.length,
      skipped: skipped.length,
    },
  }
}
