import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const folderArg = process.argv[2] || 'public/rive/CreepyCafetorium_74774'
const folderPath = path.isAbsolute(folderArg) ? folderArg : path.join(repoRoot, folderArg)
const transcriptArg = process.argv[3] || ''
const transcriptPath = transcriptArg
  ? path.isAbsolute(transcriptArg)
    ? transcriptArg
    : path.join(repoRoot, transcriptArg)
  : findTranscriptPath(folderPath)
const manifestPath = path.join(folderPath, 'word-hotspots', 'word-hotspots.json')
const manifestDir = path.dirname(manifestPath)

function readJson(filePath) {
  let text = fs.readFileSync(filePath, 'utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  return JSON.parse(text)
}

function findTranscriptPath(bookFolderPath) {
  const candidates = fs
    .readdirSync(bookFolderPath)
    .filter((name) => /transcript\.json$/i.test(name))
    .sort()
  if (!candidates.length) {
    throw new Error(`No transcript JSON found in ${bookFolderPath}`)
  }
  return path.join(bookFolderPath, candidates[0])
}

function cleanToken(value) {
  return String(value || '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^A-Za-z0-9]+/g, '')
    .trim()
    .toLowerCase()
}

function splitTokens(value) {
  return String(value || '')
    .split(/[-\u2010-\u2015]+/)
    .map(cleanToken)
    .filter(Boolean)
}

function isNoiseToken(token) {
  return /^\d+$/.test(token) || token === 'epic'
}

function addCount(counts, token) {
  if (!token || isNoiseToken(token)) return
  counts.set(token, (counts.get(token) || 0) + 1)
}

function countTokens(tokens) {
  const counts = new Map()
  for (const token of tokens) addCount(counts, token)
  return counts
}

function sumCounts(counts) {
  return Array.from(counts.values()).reduce((total, count) => total + count, 0)
}

function diffCounts(expected, actual) {
  const missing = []
  const extra = []
  for (const [word, expectedCount] of expected) {
    const actualCount = actual.get(word) || 0
    if (actualCount < expectedCount) {
      missing.push({ word, count: expectedCount - actualCount, expected: expectedCount, actual: actualCount })
    }
  }
  for (const [word, actualCount] of actual) {
    const expectedCount = expected.get(word) || 0
    if (actualCount > expectedCount) {
      extra.push({ word, count: actualCount - expectedCount, expected: expectedCount, actual: actualCount })
    }
  }
  return { extra, missing }
}

function getOcrPath(file) {
  const explicitOcr = String(file.ocr || '').trim()
  if (explicitOcr) return path.join(manifestDir, explicitOcr)

  const fileName = String(file.file || '')
  if (!fileName) return null

  return path.join(manifestDir, `${path.basename(fileName, path.extname(fileName))}.ocr.json`)
}

function getOcrWords(file) {
  const ocrPath = getOcrPath(file)
  if (!ocrPath || !fs.existsSync(ocrPath)) return []

  const ocr = readJson(ocrPath)
  return Array.isArray(ocr.words) ? ocr.words : []
}

const transcript = readJson(transcriptPath)
const manifest = readJson(manifestPath)
const transcriptPages = new Map((transcript.pages || []).map((page) => [Number(page.page), page]))
const report = []
let totalExpected = 0
let totalActual = 0
let totalMissing = 0
let totalExtra = 0

for (const file of manifest.files || []) {
  const spreadPages = (file.pages || []).map(Number).filter(Number.isFinite)
  const expectedTokens = []
  for (const pageNumber of spreadPages) {
    const page = transcriptPages.get(pageNumber)
    for (const word of page?.words || []) expectedTokens.push(...splitTokens(word.text))
  }

  const hotspotTokens = []
  for (const word of getOcrWords(file)) hotspotTokens.push(...splitTokens(word.text))

  const expected = countTokens(expectedTokens)
  const actual = countTokens(hotspotTokens)
  const { extra, missing } = diffCounts(expected, actual)
  const expectedCount = sumCounts(expected)
  const actualCount = sumCounts(actual)
  const missingCount = missing.reduce((total, item) => total + item.count, 0)
  const extraCount = extra.reduce((total, item) => total + item.count, 0)

  totalExpected += expectedCount
  totalActual += actualCount
  totalMissing += missingCount
  totalExtra += extraCount
  report.push({
    actual: actualCount,
    expected: expectedCount,
    extra,
    extraCount,
    file: file.file,
    missing,
    missingCount,
    pages: spreadPages,
  })
}

const worst = report
  .filter((item) => item.missingCount || item.extraCount)
  .sort((first, second) => second.missingCount + second.extraCount - (first.missingCount + first.extraCount))
  .slice(0, 12)

const summary = {
  bookFolder: path.relative(repoRoot, folderPath).replace(/\\/g, '/'),
  generatedAt: manifest.generatedAt || null,
  manifest: path.relative(repoRoot, manifestPath).replace(/\\/g, '/'),
  spreadCount: report.length,
  totalActual,
  totalExpected,
  totalExtra,
  totalMissing,
  transcript: path.relative(repoRoot, transcriptPath).replace(/\\/g, '/'),
  worst,
}

console.log(JSON.stringify({ report, summary }, null, 2))
