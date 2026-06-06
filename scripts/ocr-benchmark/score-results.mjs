import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_MANIFEST = 'scripts/ocr-benchmark/manifest.local.json'
const DEFAULT_RESULTS = [
  'output/ocr-benchmark/current-openai.json',
  'output/ocr-benchmark/paddleocr.json',
]
const DEFAULT_JSON_OUTPUT = 'output/ocr-benchmark/summary.json'
const DEFAULT_MARKDOWN_OUTPUT = 'output/ocr-benchmark/summary.md'

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    results: [],
    jsonOutput: DEFAULT_JSON_OUTPUT,
    markdownOutput: DEFAULT_MARKDOWN_OUTPUT,
    selfTest: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--manifest' && next) {
      args.manifest = next
      index += 1
    } else if (arg === '--results' && next) {
      args.results.push(next)
      index += 1
    } else if (arg === '--json-output' && next) {
      args.jsonOutput = next
      index += 1
    } else if (arg === '--markdown-output' && next) {
      args.markdownOutput = next
      index += 1
    } else if (arg === '--self-test') {
      args.selfTest = true
    } else if (arg === '--help' || arg === '-h') {
      args.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (args.results.length === 0) {
    args.results = DEFAULT_RESULTS
  }

  return args
}

function printHelp() {
  console.log(`Usage:
  node scripts/ocr-benchmark/score-results.mjs \\
    --manifest scripts/ocr-benchmark/manifest.local.json \\
    --results output/ocr-benchmark/current-openai.json \\
    --results output/ocr-benchmark/paddleocr.json`)
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeMarkdown(value) {
  return String(value ?? '').replace(/\|/g, '\\|')
}

function datePatterns(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return [isoDate]

  const [, year, monthRaw, dayRaw] = match
  const month = String(Number(monthRaw))
  const day = String(Number(dayRaw))
  const shortYear = year.slice(2)
  const monthNames = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ]
  const monthName = monthNames[Number(monthRaw) - 1]

  return [
    `${year}-${monthRaw}-${dayRaw}`,
    `${month}/${day}/${year}`,
    `${month}/${day}/${shortYear}`,
    `${month}/${day}`,
    `${monthRaw}/${dayRaw}`,
    `${monthRaw}/${dayRaw}/${year}`,
    `${monthName} ${day}`,
    `${monthName}. ${day}`,
  ]
}

function hasDate(text, isoDate) {
  const normalizedText = normalize(text)
  return datePatterns(isoDate).some((pattern) => normalizedText.includes(normalize(pattern)))
}

function hasRequestType(text, requestType) {
  const normalizedText = normalize(text)
  if (requestType === 'force_off') {
    return /\b(need off|off|pto|vacation|cannot work|can not work|unavailable)\b/.test(
      normalizedText
    )
  }
  if (requestType === 'force_on') {
    return /\b(force on|can work|available|wants work|want work|work)\b/.test(normalizedText)
  }
  return normalizedText.includes(normalize(requestType))
}

function tokenRecall(text, expected) {
  const expectedTokens = normalize(expected)
    .split(' ')
    .filter((token) => token.length >= 3)

  if (expectedTokens.length === 0) return 1

  const normalizedText = normalize(text)
  const matched = expectedTokens.filter((token) => normalizedText.includes(token)).length
  return matched / expectedTokens.length
}

function nameScore(text, expectedName) {
  if (!expectedName) return { passed: true, score: 1 }
  const recall = tokenRecall(text, expectedName)
  return { passed: recall >= 0.8, score: recall }
}

function scoreCase(expectedCase, resultCase) {
  const text = resultCase?.text ?? ''
  const expected = expectedCase.expected ?? {}
  const expectedRequests = Array.isArray(expected.requests) ? expected.requests : []

  const employee = nameScore(text, expected.employeeName)
  const requestScores = expectedRequests.map((request) => {
    const datePassed = request.date ? hasDate(text, request.date) : true
    const typePassed = request.type ? hasRequestType(text, request.type) : true
    const noteRecall = tokenRecall(text, request.note)

    return {
      date: request.date,
      type: request.type,
      note: request.note,
      datePassed,
      typePassed,
      noteScore: noteRecall,
      passed: datePassed && typePassed && noteRecall >= 0.5,
    }
  })

  const dateRecall =
    requestScores.length === 0
      ? 1
      : requestScores.filter((request) => request.datePassed).length / requestScores.length
  const typeAccuracy =
    requestScores.length === 0
      ? 1
      : requestScores.filter((request) => request.typePassed).length / requestScores.length
  const noteScore =
    requestScores.length === 0
      ? 1
      : requestScores.reduce((sum, request) => sum + request.noteScore, 0) / requestScores.length

  const safeAutoApplyCandidate =
    resultCase?.status === 'completed' &&
    employee.passed &&
    requestScores.length > 0 &&
    requestScores.every((request) => request.passed)
  const expectedReadyToApply = expected.reviewExpectation === 'ready_to_apply'
  const reviewExpectationPassed = safeAutoApplyCandidate === expectedReadyToApply

  const weightedScore =
    employee.score * 0.25 +
    dateRecall * 0.35 +
    typeAccuracy * 0.2 +
    noteScore * 0.1 +
    (reviewExpectationPassed ? 1 : 0) * 0.1

  return {
    id: expectedCase.id,
    filename: expectedCase.filename,
    provider: resultCase?.provider ?? 'missing',
    status: resultCase?.status ?? 'missing',
    durationMs: resultCase?.durationMs ?? null,
    model: resultCase?.model ?? null,
    error: resultCase?.error ?? null,
    textLength: text.length,
    employeeName: employee,
    dateRecall,
    typeAccuracy,
    noteScore,
    safeAutoApplyCandidate,
    reviewExpectationPassed,
    requestScores,
    weightedScore: Number(weightedScore.toFixed(4)),
  }
}

function summarizeProvider(caseScores) {
  if (caseScores.length === 0) {
    return {
      caseCount: 0,
      averageWeightedScore: 0,
      averageDateRecall: 0,
      averageTypeAccuracy: 0,
      averageNoteScore: 0,
      reviewExpectationAccuracy: 0,
    }
  }

  return {
    caseCount: caseScores.length,
    averageWeightedScore: average(caseScores.map((score) => score.weightedScore)),
    averageDateRecall: average(caseScores.map((score) => score.dateRecall)),
    averageTypeAccuracy: average(caseScores.map((score) => score.typeAccuracy)),
    averageNoteScore: average(caseScores.map((score) => score.noteScore)),
    reviewExpectationAccuracy: average(
      caseScores.map((score) => (score.reviewExpectationPassed ? 1 : 0))
    ),
  }
}

function average(values) {
  if (values.length === 0) return 0
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
}

function buildMarkdown(summary) {
  const lines = [
    '# OCR Benchmark Summary',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    '## Provider Summary',
    '',
    '| Provider | Cases | Weighted | Date Recall | Type Accuracy | Note Score | Review Match |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ]

  for (const provider of summary.providers) {
    lines.push(
      `| ${escapeMarkdown(provider.provider)} | ${provider.caseCount} | ${provider.averageWeightedScore} | ${provider.averageDateRecall} | ${provider.averageTypeAccuracy} | ${provider.averageNoteScore} | ${provider.reviewExpectationAccuracy} |`
    )
  }

  lines.push('', '## Case Scores', '')
  lines.push(
    '| Provider | Case | Status | Weighted | Dates | Types | Notes | Safe Auto Apply | Error |'
  )
  lines.push('| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |')

  for (const score of summary.caseScores) {
    lines.push(
      `| ${escapeMarkdown(score.provider)} | ${escapeMarkdown(score.id)} | ${escapeMarkdown(score.status)} | ${score.weightedScore} | ${score.dateRecall} | ${score.typeAccuracy} | ${score.noteScore.toFixed(4)} | ${score.safeAutoApplyCandidate ? 'yes' : 'no'} | ${escapeMarkdown(score.error ?? '')} |`
    )
  }

  lines.push('')
  return `${lines.join('\n')}\n`
}

async function loadInputs(args) {
  const repoRoot = process.cwd()
  const manifestPath = path.resolve(repoRoot, args.manifest)
  const manifest = await readJson(manifestPath)

  if (!Array.isArray(manifest.cases)) {
    throw new Error('Manifest must contain a cases array.')
  }

  const resultSets = []
  for (const resultPathInput of args.results) {
    const resultPath = path.resolve(repoRoot, resultPathInput)
    if (!existsSync(resultPath)) {
      console.warn(`Skipping missing result file: ${path.relative(repoRoot, resultPath)}`)
      continue
    }
    resultSets.push(await readJson(resultPath))
  }

  return { manifest, resultSets }
}

function scoreInputs(manifest, resultSets) {
  const expectedCases = new Map(manifest.cases.map((testCase) => [testCase.id, testCase]))
  const caseScores = []

  for (const resultSet of resultSets) {
    const resultCases = Array.isArray(resultSet.cases) ? resultSet.cases : []
    const provider = resultSet.provider ?? resultCases[0]?.provider ?? 'unknown'
    const resultByCase = new Map(resultCases.map((testCase) => [testCase.id, testCase]))

    for (const expectedCase of expectedCases.values()) {
      const resultCase = resultByCase.get(expectedCase.id)
      caseScores.push(scoreCase(expectedCase, resultCase ? { ...resultCase, provider } : null))
    }
  }

  const providers = Array.from(new Set(caseScores.map((score) => score.provider))).map(
    (provider) => ({
      provider,
      ...summarizeProvider(caseScores.filter((score) => score.provider === provider)),
    })
  )

  return {
    generatedAt: new Date().toISOString(),
    providers,
    caseScores,
  }
}

async function runSelfTest() {
  const manifest = {
    cases: [
      {
        id: 'self-test',
        filename: 'self-test.pdf',
        expected: {
          employeeName: 'Jane Smith',
          requests: [{ date: '2026-06-12', type: 'force_off', note: 'PTO' }],
          reviewExpectation: 'ready_to_apply',
        },
      },
    ],
  }
  const resultSets = [
    {
      provider: 'synthetic',
      cases: [
        {
          id: 'self-test',
          provider: 'synthetic',
          status: 'completed',
          text: 'Employee Name: Jane Smith\n6/12/26 PTO need off',
        },
      ],
    },
  ]
  const summary = scoreInputs(manifest, resultSets)
  const score = summary.caseScores[0]

  if (!score || score.weightedScore < 0.99) {
    throw new Error(`Self-test failed with score ${score?.weightedScore ?? 'missing'}`)
  }

  console.log('OCR benchmark scorer self-test passed.')
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  if (args.selfTest) {
    await runSelfTest()
    return
  }

  const repoRoot = process.cwd()
  const { manifest, resultSets } = await loadInputs(args)
  const summary = scoreInputs(manifest, resultSets)
  const jsonOutputPath = path.resolve(repoRoot, args.jsonOutput)
  const markdownOutputPath = path.resolve(repoRoot, args.markdownOutput)

  await mkdir(path.dirname(jsonOutputPath), { recursive: true })
  await mkdir(path.dirname(markdownOutputPath), { recursive: true })
  await writeFile(jsonOutputPath, `${JSON.stringify(summary, null, 2)}\n`)
  await writeFile(markdownOutputPath, buildMarkdown(summary))

  console.log(`Wrote benchmark summary to ${path.relative(repoRoot, jsonOutputPath)}`)
  console.log(`Wrote benchmark report to ${path.relative(repoRoot, markdownOutputPath)}`)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
