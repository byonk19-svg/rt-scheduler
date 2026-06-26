#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'

const repoRoot = process.cwd()
const workbookPath = process.env.TEAMWISE_TRACKER_WORKBOOK
  ? path.resolve(repoRoot, process.env.TEAMWISE_TRACKER_WORKBOOK)
  : path.join(repoRoot, 'docs', 'teamwise-feature-user-story-tracker.xlsx')

if (!existsSync(workbookPath)) {
  fail([`Workbook not found: ${path.relative(repoRoot, workbookPath)}`])
}

const trackedFiles = gitTrackedFiles()
const workbook = readWorkbook(workbookPath)

const errors = []
const warnings = []

expectWorkbookShape(workbook, errors, warnings)
if (errors.length > 0) {
  fail(errors, warnings)
}

const routeRows = rowsByHeader(workbook, 'Route Inventory')
const testRows = rowsByHeader(workbook, 'Test Mapping')
const storyRows = rowsByHeader(workbook, 'User Stories')
const summaryRows = rowsByHeader(workbook, 'Summary')

const trackedRouteFiles = trackedFiles.filter(isTrackedRouteInventoryFile)
const trackedTestFiles = trackedFiles.filter(isTrackedTestFile)

const routeInventoryFiles = uniqueValues(routeRows, 'Source File')
const testMappingFiles = uniqueValues(testRows, 'Test File')

expectNoDuplicateValues({
  label: 'Route Inventory',
  rows: routeRows,
  column: 'Source File',
  errors,
})

expectNoDuplicateValues({
  label: 'Test Mapping',
  rows: testRows,
  column: 'Test File',
  errors,
})

compareInventory({
  label: 'Route Inventory',
  currentFiles: trackedRouteFiles,
  workbookFiles: routeInventoryFiles,
  trackedFileSet: new Set(trackedFiles),
  missingMessage: 'current src/app files missing from Route Inventory',
  staleMessage: 'Route Inventory rows for files no longer tracked by git',
  errors,
  warnings,
})

compareInventory({
  label: 'Test Mapping',
  currentFiles: trackedTestFiles,
  workbookFiles: testMappingFiles,
  trackedFileSet: new Set(trackedFiles),
  missingMessage: 'current test files missing from Test Mapping',
  staleMessage: 'Test Mapping rows for files no longer tracked by git',
  errors,
  warnings,
})

const summary = new Map(
  summaryRows
    .filter((row) => row.Field)
    .map((row) => [String(row.Field).trim(), normalizeCell(row.Value)])
)

expectSummaryCount({
  summary,
  field: 'Story count',
  expected: storyRows.length,
  errors,
})
expectSummaryCount({
  summary,
  field: 'Route/source entries',
  expected: routeRows.length,
  errors,
})
expectSummaryCount({
  summary,
  field: 'Automated test files indexed',
  expected: testMappingFiles.length,
  errors,
})

if (errors.length > 0) {
  fail(errors, warnings)
}

console.log('Teamwise tracker validation passed.')
printWarnings(warnings)
console.log(`Stories: ${storyRows.length}`)
console.log(`Route/source entries: ${routeRows.length}`)
console.log(`Automated test files indexed: ${testMappingFiles.length}`)

function requiredWorkbookHeaders() {
  return new Map([
    [
      'User Stories',
      [
        'Story ID',
        'Epic',
        'Feature',
        'Persona',
        'Route/API Surface',
        'User Story',
        'Expected Behavior',
        'Source Evidence',
        'Priority',
        'Story Status',
        'Verification Status',
        'Manual Test Status',
        'Automated Coverage',
        'Defect IDs',
        'Notes',
      ],
    ],
    [
      'Route Inventory',
      ['Source File', 'Route/API Surface', 'File Kind', 'Mapped Story ID', 'Notes'],
    ],
    ['Test Mapping', ['Test File', 'Mapped Story ID', 'Coverage Type', 'Review Status']],
    [
      'Defects',
      [
        'Defect ID',
        'Story ID',
        'Severity',
        'Status',
        'Route/API Surface',
        'Observed Behavior',
        'Expected Behavior',
        'Repro Steps',
        'Evidence',
        'Owner/Notes',
        'Fix Commit',
        'Retest Result',
      ],
    ],
    [
      'Test Runs',
      [
        'Run ID',
        'Date',
        'Scope',
        'Command/Browser Path',
        'Environment',
        'Result',
        'Stories Covered',
        'Artifacts',
        'Notes',
      ],
    ],
    ['Summary', ['Field', 'Value']],
  ])
}

function expectWorkbookShape(workbook, errors, warnings) {
  const requiredSheets = requiredWorkbookHeaders()

  for (const [sheetName, requiredHeaders] of requiredSheets) {
    const rows = workbook.sheets.get(sheetName)
    if (!rows) {
      errors.push(`Missing workbook sheet: ${sheetName}`)
      continue
    }

    const headers = readHeaderRow(rows)
    expectHeaderShape({
      sheetName,
      headers,
      requiredHeaders,
      errors,
      warnings,
    })
  }
}

function readHeaderRow(rows) {
  const [headerRow] = rows
  return (headerRow ?? []).map((value) => normalizeCell(value))
}

function expectHeaderShape({ sheetName, headers, requiredHeaders, errors, warnings }) {
  const required = new Set(requiredHeaders)
  const seen = new Set()
  const duplicates = new Set()
  const blanks = []

  headers.forEach((header, index) => {
    if (!header) {
      blanks.push(index + 1)
      return
    }
    if (seen.has(header)) duplicates.add(header)
    seen.add(header)
  })

  if (headers.length === 0) {
    errors.push(`${sheetName}: missing header row`)
    return
  }

  if (blanks.length > 0) {
    errors.push(`${sheetName}: blank header cells at positions ${blanks.join(', ')}`)
  }

  if (duplicates.size > 0) {
    errors.push(`${sheetName}: duplicate headers:\n${formatList([...duplicates].sort())}`)
  }

  const missing = requiredHeaders.filter((header) => !seen.has(header))
  if (missing.length > 0) {
    errors.push(`${sheetName}: missing required headers:\n${formatList(missing)}`)
  }

  const unexpected = headers.filter((header) => header && !required.has(header))
  if (unexpected.length > 0) {
    warnings.push(
      `${sheetName}: unexpected headers:\n${formatList([...new Set(unexpected)].sort())}`
    )
  }
}

function gitTrackedFiles() {
  return execFileSync('git', ['ls-files'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean)
    .map(normalizePath)
}

function isTrackedRouteInventoryFile(file) {
  if (!file.startsWith('src/app/')) return false
  return new Set([
    'actions.ts',
    'actions.tsx',
    'error.ts',
    'error.tsx',
    'layout.ts',
    'layout.tsx',
    'loading.ts',
    'loading.tsx',
    'not-found.ts',
    'not-found.tsx',
    'page.ts',
    'page.tsx',
    'route.ts',
    'route.tsx',
  ]).has(path.basename(file))
}

function isTrackedTestFile(file) {
  if (file.startsWith('e2e/') && file.endsWith('.spec.ts')) return true
  if (!file.startsWith('src/')) return false
  return /\.(test|spec)\.(ts|tsx)$/.test(file)
}

function compareInventory({
  label,
  currentFiles,
  workbookFiles,
  trackedFileSet,
  missingMessage,
  staleMessage,
  errors,
  warnings,
}) {
  const current = new Set(currentFiles)
  const workbook = new Set(workbookFiles)
  const missing = currentFiles.filter((file) => !workbook.has(file))
  const stale = workbookFiles.filter((file) => !trackedFileSet.has(file))

  if (missing.length > 0) {
    errors.push(`${label}: ${missingMessage}:\n${formatList(missing)}`)
  }

  if (stale.length > 0) {
    warnings.push(`${label}: ${staleMessage}:\n${formatList(stale)}`)
  }
}

function expectSummaryCount({ summary, field, expected, errors }) {
  const actual = Number(summary.get(field))
  if (!Number.isFinite(actual)) {
    errors.push(`Summary: "${field}" is missing or not numeric`)
    return
  }

  if (actual !== expected) {
    errors.push(`Summary: "${field}" is ${actual}, expected ${expected}`)
  }
}

function expectNoDuplicateValues({ label, rows, column, errors }) {
  const seen = new Set()
  const duplicates = new Set()

  for (const row of rows) {
    const value = normalizePath(row[column])
    if (!value) continue
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }

  if (duplicates.size > 0) {
    errors.push(label + ': duplicate ' + column + ' values:\n' + formatList([...duplicates].sort()))
  }
}

function rowsByHeader(workbook, sheetName) {
  const rows = workbook.sheets.get(sheetName)
  if (!rows) {
    fail([`Missing workbook sheet: ${sheetName}`])
  }

  const [headerRow, ...dataRows] = rows
  const headers = headerRow.map((value) => normalizeCell(value))
  return dataRows
    .map((row) => {
      const record = {}
      headers.forEach((header, index) => {
        if (header) record[header] = normalizeCell(row[index])
      })
      return record
    })
    .filter((row) => Object.values(row).some((value) => value !== ''))
}

function uniqueValues(rows, column) {
  return [...new Set(rows.map((row) => normalizePath(row[column])).filter(Boolean))].sort()
}

function readWorkbook(filePath) {
  const archive = readZip(filePath)
  const sharedStrings = readSharedStrings(archive)
  const workbookXml = getZipText(archive, 'xl/workbook.xml')
  const relsXml = getZipText(archive, 'xl/_rels/workbook.xml.rels')
  const rels = readWorkbookRelationships(relsXml)
  const sheets = new Map()

  for (const sheet of readWorkbookSheets(workbookXml)) {
    const target = rels.get(sheet.relationshipId)
    if (!target) continue
    const worksheetPath = resolveWorkbookTarget(target)
    const worksheetXml = getZipText(archive, worksheetPath)
    sheets.set(sheet.name, readWorksheetRows(worksheetXml, sharedStrings))
  }

  return { sheets }
}

function readZip(filePath) {
  const buffer = readFileSync(filePath)
  const eocdOffset = findEndOfCentralDirectory(buffer)
  const entryCount = buffer.readUInt16LE(eocdOffset + 10)
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16)
  const entries = new Map()
  let offset = centralDirectoryOffset

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid XLSX central directory')
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const fileNameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8')

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize)
    const data =
      compressionMethod === 0
        ? compressedData
        : compressionMethod === 8
          ? inflateRawSync(compressedData)
          : null

    if (data) entries.set(normalizeZipPath(fileName), data)

    offset += 46 + fileNameLength + extraLength + commentLength
  }

  return entries
}

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset
  }
  throw new Error('Invalid XLSX archive: end of central directory not found')
}

function getZipText(archive, filePath) {
  const data = archive.get(normalizeZipPath(filePath))
  if (!data) {
    throw new Error(`Missing XLSX part: ${filePath}`)
  }
  return data.toString('utf8')
}

function readSharedStrings(archive) {
  const data = archive.get('xl/sharedStrings.xml')
  if (!data) return []
  const xml = data.toString('utf8')
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXml(
      [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((textMatch) => textMatch[1]).join('')
    )
  )
}

function readWorkbookRelationships(xml) {
  const rels = new Map()
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const attrs = readAttributes(match[1])
    if (attrs.Id && attrs.Target) rels.set(attrs.Id, attrs.Target)
  }
  return rels
}

function readWorkbookSheets(xml) {
  return [...xml.matchAll(/<sheet\b([^>]*)\/>/g)].map((match) => {
    const attrs = readAttributes(match[1])
    return {
      name: attrs.name,
      relationshipId: attrs['r:id'],
    }
  })
}

function readWorksheetRows(xml, sharedStrings) {
  const rows = []
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = []
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = readAttributes(cellMatch[1])
      const columnIndex = columnNameToIndex(attrs.r?.match(/^[A-Z]+/)?.[0] ?? 'A')
      row[columnIndex] = readCellValue(cellMatch[2], attrs, sharedStrings)
    }
    rows.push(row)
  }
  return rows
}

function readCellValue(cellXml, attrs, sharedStrings) {
  if (attrs.t === 'inlineStr') {
    return decodeXml(
      [...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => match[1]).join('')
    )
  }

  const value = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? ''
  if (attrs.t === 's') return sharedStrings[Number(value)] ?? ''
  return decodeXml(value)
}

function readAttributes(attributeSource) {
  const attrs = {}
  for (const match of attributeSource.matchAll(/([A-Za-z_:][\w:.-]*)="([^"]*)"/g)) {
    attrs[match[1]] = decodeXml(match[2])
  }
  return attrs
}

function columnNameToIndex(columnName) {
  let index = 0
  for (const char of columnName) {
    index = index * 26 + char.charCodeAt(0) - 64
  }
  return index - 1
}

function decodeXml(value) {
  return String(value)
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}

function normalizeCell(value) {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function normalizePath(value) {
  return normalizeCell(value).replaceAll('\\', '/')
}

function normalizeZipPath(value) {
  return value.replaceAll('\\', '/').replace(/^\/+/, '').replace('/../', '/')
}

function resolveWorkbookTarget(target) {
  const normalizedTarget = normalizeZipPath(target)
  return normalizedTarget.startsWith('xl/') ? normalizedTarget : normalizeZipPath(`xl/${target}`)
}

function formatList(items) {
  return items.map((item) => `  - ${item}`).join('\n')
}

function printWarnings(warnings) {
  if (warnings.length === 0) return
  console.warn('\nWarnings:')
  for (const warning of warnings) {
    console.warn(`\n${warning}`)
  }
}

function fail(errors, warnings = []) {
  console.error('Teamwise tracker validation failed.')
  for (const error of errors) {
    console.error(`\n${error}`)
  }
  printWarnings(warnings)
  process.exit(1)
}
