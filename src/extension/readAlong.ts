import type { ExtensionContext, WordTimingData, WordTimingEntry } from './types'
import { getEpicTribeBookConfig, type ReadAlongSuppressedTimingRange } from './bookConfig'
import { cleanWordHotspotText } from './wordHotspotText'

interface ReadAlongRuntimeDeps {
  getNumberParam(name: string, fallback: number): number
  getStringParam(name: string): string | null
  shouldUseReadAlong(): boolean
  getExtensionScriptUrl(): string
  getHotspotSearchRoots?(): Array<Document | ShadowRoot>
}

let readAlongRuntimeDeps: ReadAlongRuntimeDeps = {
  getNumberParam: (_name, fallback) => fallback,
  getStringParam: () => null,
  shouldUseReadAlong: () => false,
  getExtensionScriptUrl: () => window.location.href,
  getHotspotSearchRoots: () => [document],
}

export function configureReadAlong(deps: ReadAlongRuntimeDeps): void {
  readAlongRuntimeDeps = deps
}

function getNumberParam(name: string, fallback: number): number {
  return readAlongRuntimeDeps.getNumberParam(name, fallback)
}

function getStringParam(name: string): string | null {
  return readAlongRuntimeDeps.getStringParam(name)
}

function shouldUseReadAlong(): boolean {
  return readAlongRuntimeDeps.shouldUseReadAlong()
}

function getReadAlongExtensionScriptUrl(): string {
  return readAlongRuntimeDeps.getExtensionScriptUrl()
}

function getReadAlongHotspotSearchRoots(): Array<Document | ShadowRoot> {
  const roots = readAlongRuntimeDeps.getHotspotSearchRoots?.() || [document]
  return roots.length ? roots : [document]
}

interface TribeReadAlongSnapshot {
  activeButtonWord: string | null
  audioElementFound: boolean
  audioPaused: boolean | null
  currentTime: number | null
  hasMatch: boolean
  message: string
  page: number | null
  timingCount: number
  timingIndex: number
  updatedAt: number
  word: string | null
}

let tribeReadAlongSnapshot: TribeReadAlongSnapshot = {
  activeButtonWord: null,
  audioElementFound: false,
  audioPaused: null,
  currentTime: null,
  hasMatch: false,
  message: 'Read-along status not initialized.',
  page: null,
  timingCount: 0,
  timingIndex: -1,
  updatedAt: Date.now(),
  word: null,
}
let tribeReadAlongLastTimingSet: ReadAlongTimingSet | null = null
let tribeReadAlongLastProbe: Record<string, unknown> | null = null
let tribeReadAlongLastAudioProbe: Record<string, unknown> | null = null
let tribeReadAlongLastAudioUrlProbe: Record<string, unknown> | null = null
let tribeReadAlongLastAudioAlignmentProbe: Record<string, unknown> | null = null
let tribeReadAlongLastTimePreview: Record<string, unknown> | null = null
let tribeReadAlongLastTranscriptExport: Record<string, unknown> | null = null
let tribeReadAlongPlaybackAudio: HTMLAudioElement | null = null
let tribeReadAlongPlaybackCleanup: (() => void) | null = null
let tribeReadAlongLastPlaybackStatus: Record<string, unknown> | null = null
let tribeReadAlongLastTranscriptAudit: Record<string, unknown> | null = null
let tribeEpicPlaybackFollowing = false
let tribeEpicMediaProbeCleanup: (() => void) | null = null
let tribeEpicMediaProbeInstalled = false
let tribeEpicObservedMediaElements = new Set<HTMLMediaElement>()
let tribeEpicObservedMediaCleanups = new Map<HTMLMediaElement, () => void>()
let tribeEpicObservedMediaElement: HTMLMediaElement | null = null
let tribeEpicLastPlaybackStatus: Record<string, unknown> | null = null
let tribeReadAlongActiveHighlightButton: HTMLButtonElement | null = null
let tribeReadAlongTimingSetsByPage = new Map<number, ReadAlongTimingSet>()
let tribeEpicPlaybackPollTimer: number | null = null
let tribeEpicPlaybackPollMedia: HTMLMediaElement | null = null
let tribeEpicLookupPauseToken = 0
let tribeEpicLookupPausedMedia: HTMLMediaElement | null = null
let tribeEpicLookupShouldResume = false
let tribeEpicLookupLastStatus: Record<string, unknown> | null = null

export function updateTribeReadAlongSnapshot(update: Partial<TribeReadAlongSnapshot>) {
  tribeReadAlongSnapshot = {
    ...tribeReadAlongSnapshot,
    ...update,
    updatedAt: Date.now(),
  }
}

export function getTribeReadAlongSnapshot() {
  return tribeReadAlongSnapshot
}

interface ReadAlongWordTiming {
  duration: number
  endTime: number
  nativeIndex: number
  nativeText: string
  raw: WordTimingEntry
  splitCount: number
  splitIndex: number
  text: string
  time: number
  word: string
}

interface ReadAlongTimingSet {
  page: number
  timings: ReadAlongWordTiming[]
  wordData: WordTimingData | null
}

interface ReadAlongHyphenSegment {
  layoutOffsetUnits: number
  layoutUnits: number
  spokenOffsetUnits: number
  spokenUnits: number
  text: string
  totalLayoutUnits: number
  totalSpokenUnits: number
}

interface ReadAlongBounds {
  height: number
  width: number
  x: number
  y: number
}

interface ReadAlongCoordsTransform {
  anchorCount: number
  heightScale: number
  offsetX: number
  offsetY: number
  scaleX: number
  scaleY: number
  widthScale: number
}

const READ_ALONG_NATIVE_COORDS_WIDTH = 800
const READ_ALONG_NATIVE_COORDS_HEIGHT = 1144

interface ReadAlongTranscriptWord {
  bbox: WordTimingEntry['bbox'] | null
  coords: WordTimingEntry['coords'] | null
  duration: number
  endTime: number
  lookupPayload: string
  nativeIndex: number
  nativeText: string
  splitCount: number
  splitIndex: number
  text: string
  time: number
  word: string
}

interface ReadAlongNativeTranscriptWord {
  bbox: WordTimingEntry['bbox'] | null
  coords: WordTimingEntry['coords'] | null
  duration: number | null
  durationFallbackUsed: boolean
  endTime: number | null
  issue: string | null
  nativeIndex: number
  raw: WordTimingEntry
  text: string
  time: number | null
  usable: boolean
  word: string
}

interface ReadAlongLookupCommand {
  command: 'lookup_word'
  duration: number
  endTime: number
  lookupAlias: string
  nativeIndex: number
  nativeText: string
  page: number
  payload: string
  splitCount: number
  splitIndex: number
  time: number
}

interface ReadAlongTranscriptNativeRowSummary {
  issue: string | null
  nativeIndex: number
  text: string
  time: number | null
  word: string
}

interface ReadAlongTranscriptSplitRowSummary {
  callableWords: string[]
  nativeIndex: number
  text: string
  word: string
}

interface ReadAlongTranscriptPageAudit {
  callableRows: number
  coverageOk: boolean
  firstMissingCallableNativeRows: ReadAlongTranscriptNativeRowSummary[]
  firstNonCallableNativeRows: ReadAlongTranscriptNativeRowSummary[]
  firstSplitNativeRows: ReadAlongTranscriptSplitRowSummary[]
  missingCallableNativeRows: ReadAlongTranscriptNativeRowSummary[]
  missingCallableNativeRowsCount: number
  nativeCallableRows: number
  nativeRows: number
  nonCallableNativeRows: ReadAlongTranscriptNativeRowSummary[]
  nonCallableNativeRowsCount: number
  page: number
  rawCount: number
  splitNativeRows: ReadAlongTranscriptSplitRowSummary[]
  splitNativeRowsCount: number
}

interface ReadAlongTranscriptPage {
  audit: ReadAlongTranscriptPageAudit
  audioUrl: string | null
  error?: string
  found: boolean
  lookupCommands: ReadAlongLookupCommand[]
  nativeText: string
  nativeWords: ReadAlongNativeTranscriptWord[]
  page: number
  rawCount: number
  text: string
  usableCount: number
  words: ReadAlongTranscriptWord[]
}

function parseReadAlongSeconds(value: unknown): number {
  const numericValue = Number(value)
  if (Number.isFinite(numericValue)) return numericValue

  const text = String(value ?? '').trim()
  if (!text) return Number.NaN

  const secondsValue = Number(text.replace(/s$/i, ''))
  if (Number.isFinite(secondsValue)) return secondsValue

  const parts = text.split(':').map((part) => Number(part))
  if (parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return Number.NaN

  return parts.reduce((total, part) => total * 60 + part, 0)
}

function getReadAlongNativeTranscriptWords(wordData: WordTimingData | null | undefined): ReadAlongNativeTranscriptWord[] {
  const entries = Array.isArray(wordData?.word_data) ? wordData.word_data : []
  return entries.map((entry, nativeIndex): ReadAlongNativeTranscriptWord => {
    const text = String(entry.text || '').trim()
    const word = normalizeReadAlongWordAlias(text)
    const time = parseReadAlongSeconds(entry.time)
    const duration = parseReadAlongSeconds(entry.duration)
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0.18
    const hasUsableTime = Number.isFinite(time) && time >= 0
    const issue = !text
      ? 'empty-text'
      : !word
        ? 'empty-lookup-word'
        : !hasUsableTime
          ? 'invalid-time'
          : null

    return {
      bbox: entry.bbox || null,
      coords: entry.coords || null,
      duration: Number.isFinite(duration) && duration > 0 ? duration : null,
      durationFallbackUsed: hasUsableTime && !(Number.isFinite(duration) && duration > 0),
      endTime: hasUsableTime ? time + safeDuration : null,
      issue,
      nativeIndex,
      raw: entry,
      text,
      time: hasUsableTime ? time : null,
      usable: issue === null,
      word,
    }
  })
}

function normalizeReadAlongWordTiming(wordData: WordTimingData | null | undefined): ReadAlongWordTiming[] {
  const entries = Array.isArray(wordData?.word_data) ? wordData.word_data : []
  return entries
    .flatMap((entry, nativeIndex): ReadAlongWordTiming[] => {
      const text = String(entry.text || '').trim()
      const word = normalizeReadAlongWordAlias(text)
      const time = parseReadAlongSeconds(entry.time)
      const duration = parseReadAlongSeconds(entry.duration)
      if (!text || !word || !Number.isFinite(time) || time < 0) return []

      const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0.18
      const hyphenSegments = getReadAlongHyphenSegments(text)
      if (!hyphenSegments.length) {
        return [
          {
            duration: safeDuration,
            endTime: time + safeDuration,
            nativeIndex,
            nativeText: text,
            raw: entry,
            splitCount: 1,
            splitIndex: 0,
            text,
            time,
            word,
          },
        ]
      }

      return hyphenSegments.map((segment, splitIndex): ReadAlongWordTiming => {
        const segmentDuration = safeDuration * (segment.spokenUnits / segment.totalSpokenUnits)
        const segmentTime = time + safeDuration * (segment.spokenOffsetUnits / segment.totalSpokenUnits)
        const segmentRaw: WordTimingEntry = {
          ...entry,
          bbox: splitReadAlongBboxForSegment(entry.bbox, segment),
          coords: splitReadAlongCoordsForSegment(entry.coords, segment),
          duration: segmentDuration,
          text: segment.text,
          time: segmentTime,
          word: segment.text,
        }
        return {
          duration: segmentDuration,
          endTime: segmentTime + segmentDuration,
          nativeIndex,
          nativeText: text,
          raw: segmentRaw,
          splitCount: hyphenSegments.length,
          splitIndex,
          text: segment.text,
          time: segmentTime,
          word: normalizeReadAlongWordAlias(segment.text),
        }
      })
    })
    .sort((first, second) => first.time - second.time)
}

function summarizeReadAlongNativeTranscriptWord(
  word: ReadAlongNativeTranscriptWord,
): ReadAlongTranscriptNativeRowSummary {
  return {
    issue: word.issue,
    nativeIndex: word.nativeIndex,
    text: word.text,
    time: word.time,
    word: word.word,
  }
}

function createReadAlongLookupCommands(page: number, timings: ReadAlongWordTiming[]): ReadAlongLookupCommand[] {
  return timings.map(
    (timing): ReadAlongLookupCommand => ({
      command: 'lookup_word',
      duration: timing.duration,
      endTime: timing.endTime,
      lookupAlias: timing.word,
      nativeIndex: timing.nativeIndex,
      nativeText: timing.nativeText,
      page,
      payload: timing.text,
      splitCount: timing.splitCount,
      splitIndex: timing.splitIndex,
      time: timing.time,
    }),
  )
}

function auditReadAlongTranscriptPage(
  page: number,
  nativeWords: ReadAlongNativeTranscriptWord[],
  timings: ReadAlongWordTiming[],
  rawCount: number,
): ReadAlongTranscriptPageAudit {
  const timingsByNativeIndex = new Map<number, ReadAlongWordTiming[]>()
  for (const timing of timings) {
    const items = timingsByNativeIndex.get(timing.nativeIndex) || []
    items.push(timing)
    timingsByNativeIndex.set(timing.nativeIndex, items)
  }

  const missingCallableNativeRows = nativeWords
    .filter((word) => word.usable && !timingsByNativeIndex.has(word.nativeIndex))
    .map(summarizeReadAlongNativeTranscriptWord)
  const nonCallableNativeRows = nativeWords
    .filter((word) => !word.usable)
    .map(summarizeReadAlongNativeTranscriptWord)
  const splitNativeRows = nativeWords.flatMap((word): ReadAlongTranscriptSplitRowSummary[] => {
    const splitTimings = timingsByNativeIndex.get(word.nativeIndex) || []
    if (splitTimings.length <= 1) return []

    return [
      {
        callableWords: splitTimings.map((timing) => timing.text),
        nativeIndex: word.nativeIndex,
        text: word.text,
        word: word.word,
      },
    ]
  })

  return {
    callableRows: timings.length,
    coverageOk: missingCallableNativeRows.length === 0,
    firstMissingCallableNativeRows: missingCallableNativeRows.slice(0, 20),
    firstNonCallableNativeRows: nonCallableNativeRows.slice(0, 20),
    firstSplitNativeRows: splitNativeRows.slice(0, 20),
    missingCallableNativeRows,
    missingCallableNativeRowsCount: missingCallableNativeRows.length,
    nativeCallableRows: nativeWords.filter((word) => word.usable).length,
    nativeRows: nativeWords.length,
    nonCallableNativeRows,
    nonCallableNativeRowsCount: nonCallableNativeRows.length,
    page,
    rawCount,
    splitNativeRows,
    splitNativeRowsCount: splitNativeRows.length,
  }
}

function getReadAlongTranscriptAudit(pages: ReadAlongTranscriptPage[]): Record<string, unknown> {
  const pageAudits = pages.map((page) => page.audit)
  const missingCallableNativeRows = pageAudits.flatMap((audit) =>
    audit.missingCallableNativeRows.map((row) => ({ page: audit.page, ...row })),
  )
  const nonCallableNativeRows = pageAudits.flatMap((audit) =>
    audit.nonCallableNativeRows.map((row) => ({ page: audit.page, ...row })),
  )
  const splitNativeRows = pageAudits.flatMap((audit) =>
    audit.splitNativeRows.map((row) => ({ page: audit.page, ...row })),
  )
  const totalNativeRows = pageAudits.reduce((total, audit) => total + audit.nativeRows, 0)
  const totalNativeCallableRows = pageAudits.reduce((total, audit) => total + audit.nativeCallableRows, 0)
  const totalCallableRows = pageAudits.reduce((total, audit) => total + audit.callableRows, 0)
  const pagesWithMissingCallableRows = pageAudits
    .filter((audit) => audit.missingCallableNativeRowsCount > 0)
    .map((audit) => audit.page)
  const pagesWithNonCallableRows = pageAudits
    .filter((audit) => audit.nonCallableNativeRowsCount > 0)
    .map((audit) => audit.page)
  const pagesWithSplitRows = pageAudits
    .filter((audit) => audit.splitNativeRowsCount > 0)
    .map((audit) => audit.page)
  const summaryRows = pageAudits.map((audit) => ({
    callableRows: audit.callableRows,
    coverageOk: audit.coverageOk,
    missing: audit.missingCallableNativeRowsCount,
    nativeCallableRows: audit.nativeCallableRows,
    nativeRows: audit.nativeRows,
    nonCallable: audit.nonCallableNativeRowsCount,
    page: audit.page,
    split: audit.splitNativeRowsCount,
  }))
  const summaryText = [
    `readAlongCoverage=${missingCallableNativeRows.length === 0 ? 'ok' : 'missing'}`,
    `nativeRows=${totalNativeRows}`,
    `nativeCallableRows=${totalNativeCallableRows}`,
    `callableRows=${totalCallableRows}`,
    `missingCallableNativeRows=${missingCallableNativeRows.length}`,
    `nonCallableNativeRows=${nonCallableNativeRows.length}`,
    `splitNativeRows=${splitNativeRows.length}`,
    `pagesWithMissingCallableRows=${pagesWithMissingCallableRows.length ? pagesWithMissingCallableRows.join(',') : 'none'}`,
  ].join('\n')

  return {
    coverageOk: missingCallableNativeRows.length === 0,
    firstMissingCallableNativeRows: missingCallableNativeRows.slice(0, 50),
    firstNonCallableNativeRows: nonCallableNativeRows.slice(0, 50),
    firstSplitNativeRows: splitNativeRows.slice(0, 50),
    missingCallableNativeRows,
    missingCallableNativeRowsCount: missingCallableNativeRows.length,
    nonCallableNativeRows,
    nonCallableNativeRowsCount: nonCallableNativeRows.length,
    pageAudits,
    pagesWithMissingCallableRows,
    pagesWithNonCallableRows,
    pagesWithSplitRows,
    splitNativeRows,
    splitNativeRowsCount: splitNativeRows.length,
    summaryRows,
    summaryText,
    totalCallableRows,
    totalNativeCallableRows,
    totalNativeRows,
  }
}

function getOrderedReadAlongTimingPageCandidates(
  page: number,
  maxPage: number | null,
  preferredPages: number[] = [],
): number[] {
  const basePage = Number(page)
  if (!Number.isFinite(basePage)) return []

  const normalizedPage = Math.trunc(basePage)
  const boundedMaxPage = Number.isFinite(maxPage) && Number(maxPage) >= 0 ? Math.trunc(Number(maxPage)) : null
  const candidates = new Set<number>()
  const addPage = (candidate: number) => {
    if (!Number.isFinite(candidate)) return

    const normalized = Math.trunc(candidate)
    if (normalized < 0) return
    if (boundedMaxPage !== null && normalized > boundedMaxPage) return

    candidates.add(normalized)
  }

  addPage(normalizedPage)
  preferredPages.forEach(addPage)

  const isLeftPage = normalizedPage % 2 === 0
  const nearbyPages = isLeftPage
    ? [normalizedPage + 1, normalizedPage - 1, normalizedPage + 2, normalizedPage - 2, normalizedPage + 3, normalizedPage - 3]
    : [normalizedPage - 1, normalizedPage + 1, normalizedPage - 2, normalizedPage + 2, normalizedPage - 3, normalizedPage + 3]
  nearbyPages.forEach(addPage)

  return Array.from(candidates)
}

function findReadAlongTimingIndexAtTime(
  timings: ReadAlongWordTiming[],
  currentTime: number,
  lingerSeconds: number,
): number {
  if (!Number.isFinite(currentTime) || currentTime < 0) return -1

  let activeIndex = -1
  let activeStartTime = Number.NEGATIVE_INFINITY
  let lingeringIndex = -1
  let lingeringEndTime = Number.NEGATIVE_INFINITY

  for (let index = 0; index < timings.length; index += 1) {
    const timing = timings[index]
    if (currentTime < timing.time) continue

    if (currentTime <= timing.endTime) {
      if (timing.time >= activeStartTime) {
        activeIndex = index
        activeStartTime = timing.time
      }
      continue
    }

    if (currentTime <= timing.endTime + lingerSeconds && timing.endTime >= lingeringEndTime) {
      lingeringIndex = index
      lingeringEndTime = timing.endTime
    }
  }

  return activeIndex >= 0 ? activeIndex : lingeringIndex
}

function getReadAlongSuppressedTimingRange(
  context: ExtensionContext,
  timingSet: ReadAlongTimingSet | null,
  currentTime: number,
): ReadAlongSuppressedTimingRange | null {
  if (!timingSet || !Number.isFinite(currentTime)) return null

  const ranges = getEpicTribeBookConfig(context.data.getBookId())?.readAlongSuppressedTimingRanges || []
  return (
    ranges.find((range) => {
      const page = Number(range.page)
      if (!Number.isFinite(page) || Math.trunc(page) !== timingSet.page) return false

      const startTime = Number(range.startTime)
      if (!Number.isFinite(startTime) || currentTime < startTime) return false

      const endTime = range.endTime === undefined ? Number.POSITIVE_INFINITY : Number(range.endTime)
      return !Number.isFinite(endTime) || currentTime <= endTime
    }) || null
  )
}

function summarizeReadAlongSuppression(range: ReadAlongSuppressedTimingRange | null): Record<string, unknown> | null {
  if (!range) return null

  return {
    endTime: range.endTime ?? null,
    page: range.page,
    reason: range.reason || null,
    startTime: range.startTime,
  }
}

function getReadAlongTimingOccurrenceIndex(timings: ReadAlongWordTiming[], timingIndex: number): number {
  const target = timings[timingIndex]
  if (!target) return 0

  let occurrence = 0
  for (let index = 0; index < timingIndex; index += 1) {
    if (timings[index]?.word === target.word) occurrence += 1
  }

  return occurrence
}

function getReadAlongTimingAliasOccurrenceIndex(
  timings: ReadAlongWordTiming[],
  timingIndex: number,
  targetAliases: Set<string>,
): number {
  let occurrence = 0
  for (let index = 0; index < timingIndex; index += 1) {
    const timing = timings[index]
    if (!timing) continue

    const aliases = [
      ...getReadAlongWordAliasVariants(timing.word),
      ...getReadAlongWordAliasVariants(timing.text),
      ...getReadAlongWordAliasVariants(timing.nativeText),
    ]
    if (aliases.some((alias) => targetAliases.has(alias))) occurrence += 1
  }

  return occurrence
}

export function clearReadAlongButtonHighlight(): void {
  if (tribeReadAlongActiveHighlightButton) {
    tribeReadAlongActiveHighlightButton.classList.remove('is-read-along-active')
    tribeReadAlongActiveHighlightButton = null
  }

  document
    .querySelectorAll<HTMLButtonElement>(
      '.tribe-word-hotspot-button.is-read-along-active, .tribe-standalone-word-hotspot-button.is-read-along-active',
    )
    .forEach((button) => button.classList.remove('is-read-along-active'))
}

function normalizeReadAlongWordAlias(value: string): string {
  return cleanWordHotspotText(
    value
      .replace(/\u00e2\u20ac\u2122/g, "'")
      .replace(/\u00e2\u20ac\u02dc/g, "'")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u2010-\u2015]/g, '-'),
  ).toLowerCase()
}

function getReadAlongWordAliasVariants(value: string): string[] {
  const aliases = new Set<string>()
  const alias = normalizeReadAlongWordAlias(value)
  if (!alias) return []

  aliases.add(alias)
  const apostropheFreeAlias = alias.replace(/'/g, '')
  if (apostropheFreeAlias) aliases.add(apostropheFreeAlias)
  return Array.from(aliases)
}

function getReadAlongHyphenSegments(value: string): ReadAlongHyphenSegment[] {
  const source = String(value || '')
  if (!/[-\u2010-\u2015]/.test(source)) return []

  const tokens = source.match(/[^-\u2010-\u2015]+|[-\u2010-\u2015]+/g) || []
  const totalLayoutUnits = tokens.reduce((total, token) => total + Math.max(1, token.length), 0)
  const totalSpokenUnits = tokens.reduce(
    (total, token) => total + (/^[-\u2010-\u2015]+$/.test(token) ? 0 : Math.max(1, token.length)),
    0,
  )
  if (tokens.length < 3 || totalLayoutUnits <= 0 || totalSpokenUnits <= 0) return []

  const segments: ReadAlongHyphenSegment[] = []
  let layoutOffsetUnits = 0
  let spokenOffsetUnits = 0
  for (const token of tokens) {
    const tokenUnits = Math.max(1, token.length)
    if (!/^[-\u2010-\u2015]+$/.test(token)) {
      const text = cleanWordHotspotText(token)
      if (text) {
        segments.push({
          layoutOffsetUnits,
          layoutUnits: tokenUnits,
          spokenOffsetUnits,
          spokenUnits: tokenUnits,
          text,
          totalLayoutUnits,
          totalSpokenUnits,
        })
      }
      spokenOffsetUnits += tokenUnits
    }
    layoutOffsetUnits += tokenUnits
  }

  return segments.length > 1 ? segments : []
}

function splitReadAlongBboxForSegment(
  bbox: WordTimingEntry['bbox'] | undefined,
  segment: ReadAlongHyphenSegment,
): WordTimingEntry['bbox'] | undefined {
  const x1 = Number(bbox?.x1)
  const x2 = Number(bbox?.x2)
  if (!bbox || !Number.isFinite(x1) || !Number.isFinite(x2)) return bbox

  const left = Math.min(x1, x2)
  const right = Math.max(x1, x2)
  const width = right - left
  if (width <= 0) return bbox

  const segmentLeft = left + width * (segment.layoutOffsetUnits / segment.totalLayoutUnits)
  const segmentRight = left + width * ((segment.layoutOffsetUnits + segment.layoutUnits) / segment.totalLayoutUnits)
  return {
    ...bbox,
    x1: segmentLeft,
    x2: segmentRight,
    width: Math.max(0, segmentRight - segmentLeft),
  }
}

function splitReadAlongCoordsForSegment(
  coords: WordTimingEntry['coords'] | undefined,
  segment: ReadAlongHyphenSegment,
): WordTimingEntry['coords'] | undefined {
  if (!Array.isArray(coords) || coords.length < 4) return coords

  const x = Number(coords[0])
  const y = Number(coords[1])
  const width = Number(coords[2])
  const height = Number(coords[3])
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0) {
    return coords
  }

  const segmentX = x + width * (segment.layoutOffsetUnits / segment.totalLayoutUnits)
  const segmentWidth = width * (segment.layoutUnits / segment.totalLayoutUnits)
  return [Math.round(segmentX), Math.round(y), Math.max(1, Math.round(segmentWidth)), Math.round(height)]
}

function getReadAlongButtonWord(button: HTMLButtonElement): string {
  return normalizeReadAlongWordAlias(button.dataset.lookupWord || button.dataset.sourceWord || button.textContent || '')
}

export function getReadAlongButtonWordAliases(button: HTMLButtonElement): string[] {
  const aliases = new Set<string>()
  const addAlias = (value: string) => {
    getReadAlongWordAliasVariants(value).forEach((alias) => aliases.add(alias))
  }
  const sourceText = button.dataset.sourceWord || button.dataset.lookupWord || button.textContent || ''

  addAlias(button.dataset.lookupWord || '')
  addAlias(sourceText)

  if (/[-\u2010-\u2015]/.test(sourceText)) {
    sourceText.split(/[-\u2010-\u2015]+/).forEach(addAlias)
    addAlias(sourceText.replace(/[-\u2010-\u2015]+/g, ''))
  }

  return Array.from(aliases)
}

function getReadAlongButtonPage(button: HTMLButtonElement): number | null {
  const page = Number(button.dataset.hotspotPage)
  return Number.isFinite(page) ? Math.trunc(page) : null
}

function getReadAlongButtonPages(button: HTMLButtonElement): number[] {
  return String(button.dataset.hotspotPages || '')
    .split(',')
    .map((page) => Number(page.trim()))
    .filter((page) => Number.isFinite(page))
    .map((page) => Math.trunc(page))
}

function getReadAlongButtonSourceBounds(button: HTMLButtonElement): ReadAlongBounds | null {
  const x = Number(button.dataset.sourceX)
  const y = Number(button.dataset.sourceY)
  const width = Number(button.dataset.sourceWidth)
  const height = Number(button.dataset.sourceHeight)
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null
  }

  return { height, width, x, y }
}

function getReadAlongHotspotButtons(): HTMLButtonElement[] {
  return getReadAlongHotspotSearchRoots().flatMap((root) =>
    Array.from(
      root.querySelectorAll<HTMLButtonElement>('.tribe-word-hotspot-button, .tribe-standalone-word-hotspot-button'),
    ),
  )
}

function normalizeReadAlongBoundsUnit(value: number, scale: number): number {
  if (!Number.isFinite(value)) return Number.NaN
  return Math.max(0, Math.min(1, value / scale))
}

function getReadAlongTimingRawCoordsBounds(timing: ReadAlongWordTiming): ReadAlongBounds | null {
  const coords = timing.raw.coords
  if (!Array.isArray(coords) || coords.length < 4) return null

  const x = Number(coords[0])
  const y = Number(coords[1])
  const width = Number(coords[2])
  const height = Number(coords[3])
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null
  }

  return { height, width, x, y }
}

function clampReadAlongBoundsToUnit(bounds: ReadAlongBounds): ReadAlongBounds | null {
  const left = Math.max(0, Math.min(1, bounds.x))
  const top = Math.max(0, Math.min(1, bounds.y))
  const right = Math.max(left, Math.min(1, bounds.x + bounds.width))
  const bottom = Math.max(top, Math.min(1, bounds.y + bounds.height))
  const width = right - left
  const height = bottom - top
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null

  return { height, width, x: left, y: top }
}

function getReadAlongTimingPageBounds(timing: ReadAlongWordTiming): ReadAlongBounds | null {
  const bbox = timing.raw.bbox
  const x1 = Number(bbox?.x1)
  const y1 = Number(bbox?.y1)
  const x2 = Number(bbox?.x2)
  const y2 = Number(bbox?.y2)
  if (!bbox || !Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
    return null
  }

  const scale = Math.max(Math.abs(x1), Math.abs(y1), Math.abs(x2), Math.abs(y2)) > 1 ? 100 : 1
  const left = normalizeReadAlongBoundsUnit(Math.min(x1, x2), scale)
  const rawTop = normalizeReadAlongBoundsUnit(Math.min(y1, y2), scale)
  const right = normalizeReadAlongBoundsUnit(Math.max(x1, x2), scale)
  const rawBottom = normalizeReadAlongBoundsUnit(Math.max(y1, y2), scale)
  const top = 1 - rawBottom
  const bottom = 1 - rawTop
  const width = right - left
  const height = bottom - top
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null

  return {
    height,
    width,
    x: left,
    y: top,
  }
}

function getDefaultReadAlongCoordsTransform(button: HTMLButtonElement): ReadAlongCoordsTransform | null {
  const buttonPage = getReadAlongButtonPage(button)
  const pages = getReadAlongButtonPages(button)
  const pageIndex = buttonPage === null ? -1 : pages.indexOf(buttonPage)
  const pageCount = Math.max(1, pages.length)
  if (pages.length > 1 && pageIndex < 0) return null

  return {
    anchorCount: 0,
    heightScale: 1 / READ_ALONG_NATIVE_COORDS_HEIGHT,
    offsetX: pages.length > 1 ? pageIndex / pageCount : 0,
    offsetY: 0,
    scaleX: 1 / (READ_ALONG_NATIVE_COORDS_WIDTH * pageCount),
    scaleY: 1 / READ_ALONG_NATIVE_COORDS_HEIGHT,
    widthScale: 1 / (READ_ALONG_NATIVE_COORDS_WIDTH * pageCount),
  }
}

function projectReadAlongRawCoordsBounds(
  rawBounds: ReadAlongBounds,
  transform: ReadAlongCoordsTransform,
): ReadAlongBounds | null {
  const centerX = rawBounds.x + rawBounds.width / 2
  const centerY = rawBounds.y + rawBounds.height / 2
  const width = rawBounds.width * transform.widthScale
  const height = rawBounds.height * transform.heightScale
  return clampReadAlongBoundsToUnit({
    height,
    width,
    x: centerX * transform.scaleX + transform.offsetX - width / 2,
    y: centerY * transform.scaleY + transform.offsetY - height / 2,
  })
}

function projectReadAlongTimingCoordsBounds(
  timing: ReadAlongWordTiming,
  transform: ReadAlongCoordsTransform,
): ReadAlongBounds | null {
  const rawBounds = getReadAlongTimingRawCoordsBounds(timing)
  return rawBounds ? projectReadAlongRawCoordsBounds(rawBounds, transform) : null
}

function projectReadAlongTimingBoundsForButton(
  timing: ReadAlongWordTiming,
  button: HTMLButtonElement,
  coordsTransform: ReadAlongCoordsTransform | null = null,
): ReadAlongBounds | null {
  const defaultCoordsTransform = getDefaultReadAlongCoordsTransform(button)
  const projectedCoordsBounds =
    (coordsTransform ? projectReadAlongTimingCoordsBounds(timing, coordsTransform) : null) ||
    (defaultCoordsTransform ? projectReadAlongTimingCoordsBounds(timing, defaultCoordsTransform) : null)
  if (projectedCoordsBounds) return projectedCoordsBounds

  const timingBounds = getReadAlongTimingPageBounds(timing)
  if (!timingBounds) return null

  const buttonPage = getReadAlongButtonPage(button)
  const pages = getReadAlongButtonPages(button)
  const pageIndex = buttonPage === null ? -1 : pages.indexOf(buttonPage)
  if (pages.length > 1 && pageIndex >= 0) {
    const pageCount = pages.length
    return {
      height: timingBounds.height,
      width: timingBounds.width / pageCount,
      x: (pageIndex + timingBounds.x) / pageCount,
      y: timingBounds.y,
    }
  }

  return timingBounds
}

function getReadAlongBoundsCenter(bounds: ReadAlongBounds): { x: number; y: number } {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
}

function getReadAlongMedian(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).slice().sort((first, second) => first - second)
  if (!sorted.length) return null

  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function fitReadAlongCoordsAxis(
  anchors: Array<{ buttonBounds: ReadAlongBounds; rawBounds: ReadAlongBounds }>,
  getRawValue: (anchor: { buttonBounds: ReadAlongBounds; rawBounds: ReadAlongBounds }) => number,
  getButtonValue: (anchor: { buttonBounds: ReadAlongBounds; rawBounds: ReadAlongBounds }) => number,
): { offset: number; scale: number } | null {
  if (anchors.length < 2) return null

  const rawMean = anchors.reduce((total, anchor) => total + getRawValue(anchor), 0) / anchors.length
  const buttonMean = anchors.reduce((total, anchor) => total + getButtonValue(anchor), 0) / anchors.length
  let numerator = 0
  let denominator = 0
  for (const anchor of anchors) {
    const rawDelta = getRawValue(anchor) - rawMean
    numerator += rawDelta * (getButtonValue(anchor) - buttonMean)
    denominator += rawDelta * rawDelta
  }
  if (Math.abs(denominator) < 0.0001) return null

  const scale = numerator / denominator
  const offset = buttonMean - scale * rawMean
  if (!Number.isFinite(scale) || !Number.isFinite(offset) || scale <= 0) return null

  return { offset, scale }
}

function fitReadAlongCoordsTransform(
  anchors: Array<{ buttonBounds: ReadAlongBounds; rawBounds: ReadAlongBounds }>,
): ReadAlongCoordsTransform | null {
  if (anchors.length < 3) return null

  const xAxis = fitReadAlongCoordsAxis(
    anchors,
    (anchor) => getReadAlongBoundsCenter(anchor.rawBounds).x,
    (anchor) => getReadAlongBoundsCenter(anchor.buttonBounds).x,
  )
  const yAxis = fitReadAlongCoordsAxis(
    anchors,
    (anchor) => getReadAlongBoundsCenter(anchor.rawBounds).y,
    (anchor) => getReadAlongBoundsCenter(anchor.buttonBounds).y,
  )
  if (!xAxis || !yAxis) return null

  const widthScale = getReadAlongMedian(anchors.map((anchor) => anchor.buttonBounds.width / anchor.rawBounds.width))
  const heightScale = getReadAlongMedian(anchors.map((anchor) => anchor.buttonBounds.height / anchor.rawBounds.height))
  if (!widthScale || !heightScale || widthScale <= 0 || heightScale <= 0) return null

  return {
    anchorCount: anchors.length,
    heightScale,
    offsetX: xAxis.offset,
    offsetY: yAxis.offset,
    scaleX: xAxis.scale,
    scaleY: yAxis.scale,
    widthScale,
  }
}

function getReadAlongCoordsTransformResidual(
  anchor: { buttonBounds: ReadAlongBounds; rawBounds: ReadAlongBounds },
  transform: ReadAlongCoordsTransform,
): number {
  const projected = projectReadAlongRawCoordsBounds(anchor.rawBounds, transform)
  if (!projected) return Number.POSITIVE_INFINITY

  const projectedCenter = getReadAlongBoundsCenter(projected)
  const buttonCenter = getReadAlongBoundsCenter(anchor.buttonBounds)
  return Math.abs(projectedCenter.x - buttonCenter.x) + Math.abs(projectedCenter.y - buttonCenter.y)
}

function createReadAlongCoordsTransform(
  timingSet: ReadAlongTimingSet,
  buttons: HTMLButtonElement[],
): ReadAlongCoordsTransform | null {
  const timingsByWord = new Map<string, ReadAlongWordTiming[]>()
  for (const timing of timingSet.timings) {
    if (!getReadAlongTimingRawCoordsBounds(timing)) continue
    const timingAliases = new Set([
      ...getReadAlongWordAliasVariants(timing.word),
      ...getReadAlongWordAliasVariants(timing.text),
      ...getReadAlongWordAliasVariants(timing.nativeText),
    ])
    for (const alias of timingAliases) {
      const group = timingsByWord.get(alias) || []
      if (!group.includes(timing)) group.push(timing)
      timingsByWord.set(alias, group)
    }
  }

  const buttonsByWord = new Map<string, HTMLButtonElement[]>()
  for (const button of buttons) {
    if (getReadAlongButtonPage(button) !== timingSet.page || !getReadAlongButtonSourceBounds(button)) continue
    for (const alias of getReadAlongButtonWordAliases(button)) {
      const group = buttonsByWord.get(alias) || []
      if (!group.includes(button)) group.push(button)
      buttonsByWord.set(alias, group)
    }
  }

  let anchors: Array<{ buttonBounds: ReadAlongBounds; rawBounds: ReadAlongBounds }> = []
  for (const [word, timings] of timingsByWord) {
    const matchingButtons = buttonsByWord.get(word) || []
    if (timings.length !== 1 || matchingButtons.length !== 1) continue

    const rawBounds = getReadAlongTimingRawCoordsBounds(timings[0])
    const buttonBounds = getReadAlongButtonSourceBounds(matchingButtons[0])
    if (!rawBounds || !buttonBounds) continue

    const defaultTransform = getDefaultReadAlongCoordsTransform(matchingButtons[0])
    const defaultBounds = defaultTransform ? projectReadAlongTimingCoordsBounds(timings[0], defaultTransform) : null
    if (defaultBounds) {
      const defaultCenter = getReadAlongBoundsCenter(defaultBounds)
      const buttonCenter = getReadAlongBoundsCenter(buttonBounds)
      const defaultDistance = Math.abs(defaultCenter.x - buttonCenter.x) + Math.abs(defaultCenter.y - buttonCenter.y)
      if (defaultDistance > 0.2) continue
    }

    anchors.push({ buttonBounds, rawBounds })
  }

  let transform = fitReadAlongCoordsTransform(anchors)
  if (!transform) return null

  for (let pass = 0; pass < 2; pass += 1) {
    const residuals = anchors.map((anchor) => getReadAlongCoordsTransformResidual(anchor, transform))
    const medianResidual = getReadAlongMedian(residuals) || 0
    const medianDeviation = getReadAlongMedian(residuals.map((residual) => Math.abs(residual - medianResidual))) || 0
    const threshold = Math.max(0.04, medianResidual + medianDeviation * 2.5)
    const filteredAnchors = anchors.filter((anchor) => getReadAlongCoordsTransformResidual(anchor, transform) <= threshold)
    if (filteredAnchors.length < 3 || filteredAnchors.length === anchors.length) break

    anchors = filteredAnchors
    const nextTransform = fitReadAlongCoordsTransform(anchors)
    if (!nextTransform) break
    transform = nextTransform
  }

  return transform
}

function getReadAlongButtonGeometryScore(
  timing: ReadAlongWordTiming,
  button: HTMLButtonElement,
  coordsTransform: ReadAlongCoordsTransform | null = null,
): number | null {
  const timingBounds = projectReadAlongTimingBoundsForButton(timing, button, coordsTransform)
  const buttonBounds = getReadAlongButtonSourceBounds(button)
  if (!timingBounds || !buttonBounds) return null

  const timingCenter = getReadAlongBoundsCenter(timingBounds)
  const buttonCenter = getReadAlongBoundsCenter(buttonBounds)
  const centerDistance =
    Math.abs(timingCenter.x - buttonCenter.x) + Math.abs(timingCenter.y - buttonCenter.y)
  const sizeDistance =
    Math.abs(timingBounds.width - buttonBounds.width) + Math.abs(timingBounds.height - buttonBounds.height)

  return centerDistance + sizeDistance * 0.15
}

type ReadAlongButtonGeometryMatch = {
  button: HTMLButtonElement
  index: number
  score: number
}

function findReadAlongOccurrenceMatch(
  timingSet: ReadAlongTimingSet,
  timingIndex: number,
  timingAliases: Set<string>,
  preferredButtons: HTMLButtonElement[],
  geometryMatches: ReadAlongButtonGeometryMatch[],
  maxGeometryScore: number,
  maxScoreDelta: number,
): ReadAlongButtonGeometryMatch | null {
  const occurrenceButton = findReadAlongOrderedOccurrenceButton(timingSet, timingIndex, timingAliases, preferredButtons)
  if (!occurrenceButton) return null

  const bestScore = geometryMatches[0]?.score
  if (bestScore === undefined) return null

  const occurrenceMatch = geometryMatches.find((match) => match.button === occurrenceButton)
  if (!occurrenceMatch || occurrenceMatch.score > maxGeometryScore) return null
  if (occurrenceMatch.score - bestScore > maxScoreDelta) return null

  return occurrenceMatch
}

function doesReadAlongButtonMatchAliases(button: HTMLButtonElement, timingAliases: Set<string>): boolean {
  return (
    timingAliases.has(getReadAlongButtonWord(button)) ||
    getReadAlongButtonWordAliases(button).some((alias) => timingAliases.has(alias))
  )
}

function getReadAlongTimingAliases(timing: ReadAlongWordTiming): Set<string> {
  return new Set([
    ...getReadAlongWordAliasVariants(timing.word),
    ...getReadAlongWordAliasVariants(timing.text),
    ...getReadAlongWordAliasVariants(timing.nativeText),
  ])
}

function doReadAlongAliasSetsIntersect(first: Set<string>, second: Set<string>): boolean {
  for (const alias of first) {
    if (second.has(alias)) return true
  }

  return false
}

function getReadAlongButtonAliases(button: HTMLButtonElement): Set<string> {
  return new Set(getReadAlongButtonWordAliases(button))
}

function getReadAlongOrderedCandidateButtons(
  timingSet: ReadAlongTimingSet,
  buttons: HTMLButtonElement[],
): HTMLButtonElement[] {
  const pageButtons = buttons.filter((button) => getReadAlongButtonPage(button) === timingSet.page)
  if (pageButtons.length) return pageButtons

  const spreadButtons = buttons.filter((button) => getReadAlongButtonPages(button).includes(timingSet.page))
  return spreadButtons.length ? spreadButtons : buttons
}

function findReadAlongSequenceAlignedButton(
  timingSet: ReadAlongTimingSet,
  timingIndex: number,
  timingAliases: Set<string>,
  orderedButtons: HTMLButtonElement[],
): HTMLButtonElement | null {
  const timingCount = timingSet.timings.length
  const buttonCount = orderedButtons.length
  if (buttonCount < 3 || timingCount < 3) return null

  const timingAliasesByIndex = timingSet.timings.map(getReadAlongTimingAliases)
  const buttonAliasesByIndex = orderedButtons.map((button) => new Set(getReadAlongButtonWordAliases(button)))
  const doesIndexMatch = (buttonIndex: number, timingWordIndex: number) => {
    const buttonAliases = buttonAliasesByIndex[buttonIndex]
    const wordAliases = timingAliasesByIndex[timingWordIndex]
    if (!buttonAliases || !wordAliases) return false

    for (const alias of buttonAliases) {
      if (wordAliases.has(alias)) return true
    }
    return false
  }

  const columnCount = timingCount + 1
  const scores = new Uint16Array((buttonCount + 1) * columnCount)
  const getScore = (buttonIndex: number, timingWordIndex: number) => scores[buttonIndex * columnCount + timingWordIndex]
  const setScore = (buttonIndex: number, timingWordIndex: number, value: number) => {
    scores[buttonIndex * columnCount + timingWordIndex] = value
  }

  for (let buttonIndex = 1; buttonIndex <= buttonCount; buttonIndex += 1) {
    for (let timingWordIndex = 1; timingWordIndex <= timingCount; timingWordIndex += 1) {
      if (doesIndexMatch(buttonIndex - 1, timingWordIndex - 1)) {
        setScore(buttonIndex, timingWordIndex, getScore(buttonIndex - 1, timingWordIndex - 1) + 1)
      } else {
        setScore(
          buttonIndex,
          timingWordIndex,
          Math.max(getScore(buttonIndex - 1, timingWordIndex), getScore(buttonIndex, timingWordIndex - 1)),
        )
      }
    }
  }

  const matchCount = getScore(buttonCount, timingCount)
  const minMatchRatio = Math.max(0, Math.min(1, getNumberParam('tribeReadAlongSequenceMinMatchRatio', 0.72)))
  const requiredMatches = Math.max(3, Math.ceil(Math.min(buttonCount, timingCount) * minMatchRatio))
  if (matchCount < requiredMatches) return null

  const timingToButton = new Map<number, number>()
  let buttonIndex = buttonCount
  let timingWordIndex = timingCount
  while (buttonIndex > 0 && timingWordIndex > 0) {
    if (
      doesIndexMatch(buttonIndex - 1, timingWordIndex - 1) &&
      getScore(buttonIndex, timingWordIndex) === getScore(buttonIndex - 1, timingWordIndex - 1) + 1
    ) {
      timingToButton.set(timingWordIndex - 1, buttonIndex - 1)
      buttonIndex -= 1
      timingWordIndex -= 1
      continue
    }

    if (getScore(buttonIndex - 1, timingWordIndex) >= getScore(buttonIndex, timingWordIndex - 1)) {
      buttonIndex -= 1
    } else {
      timingWordIndex -= 1
    }
  }

  const matchedButtonIndex = timingToButton.get(timingIndex)
  if (matchedButtonIndex === undefined) return null

  const button = orderedButtons[matchedButtonIndex]
  if (!button || !doesReadAlongButtonMatchAliases(button, timingAliases)) return null

  return button
}

type ReadAlongContextButtonMatch = {
  button: HTMLButtonElement
  contextMatches: number
  score: number
}

function findReadAlongContextMatchedButton(
  timingSet: ReadAlongTimingSet,
  timingIndex: number,
  timingAliases: Set<string>,
  orderedButtons: HTMLButtonElement[],
): HTMLButtonElement | null {
  if (!orderedButtons.length) return null

  const timingAliasesByIndex = timingSet.timings.map(getReadAlongTimingAliases)
  const buttonAliasesByIndex = orderedButtons.map(getReadAlongButtonAliases)
  const matchingButtonIndexes = buttonAliasesByIndex
    .map((buttonAliases, index) => (doReadAlongAliasSetsIntersect(buttonAliases, timingAliases) ? index : -1))
    .filter((index) => index >= 0)

  if (!matchingButtonIndexes.length) return null
  if (matchingButtonIndexes.length === 1) return orderedButtons[matchingButtonIndexes[0]] || null

  const windowSize = Math.max(1, Math.min(8, Math.trunc(getNumberParam('tribeReadAlongContextWindowWords', 4))))
  const gapTolerance = Math.max(0, Math.min(4, Math.trunc(getNumberParam('tribeReadAlongContextGapWords', 2))))
  const scoreNeighbor = (candidateIndex: number, direction: -1 | 1, distance: number) => {
    const timingNeighborIndex = timingIndex + direction * distance
    if (timingNeighborIndex < 0 || timingNeighborIndex >= timingAliasesByIndex.length) return 0

    const timingNeighborAliases = timingAliasesByIndex[timingNeighborIndex]
    let bestScore = 0
    const minButtonDistance = Math.max(1, distance - gapTolerance)
    const maxButtonDistance = distance + gapTolerance
    for (let buttonDistance = minButtonDistance; buttonDistance <= maxButtonDistance; buttonDistance += 1) {
      const buttonNeighborIndex = candidateIndex + direction * buttonDistance
      if (buttonNeighborIndex < 0 || buttonNeighborIndex >= buttonAliasesByIndex.length) continue
      if (!doReadAlongAliasSetsIntersect(buttonAliasesByIndex[buttonNeighborIndex], timingNeighborAliases)) continue

      const gapPenalty = Math.abs(buttonDistance - distance)
      const distanceWeight = windowSize - distance + 1
      bestScore = Math.max(bestScore, distanceWeight * 2 - gapPenalty)
    }

    return Math.max(0, bestScore)
  }

  const scoredMatches: ReadAlongContextButtonMatch[] = matchingButtonIndexes
    .map((candidateIndex) => {
      let score = 12
      let contextMatches = 0
      for (let distance = 1; distance <= windowSize; distance += 1) {
        const previousScore = scoreNeighbor(candidateIndex, -1, distance)
        const nextScore = scoreNeighbor(candidateIndex, 1, distance)
        if (previousScore > 0) {
          contextMatches += 1
          score += previousScore
        }
        if (nextScore > 0) {
          contextMatches += 1
          score += nextScore
        }
      }

      return {
        button: orderedButtons[candidateIndex],
        contextMatches,
        score,
      }
    })
    .filter((match): match is ReadAlongContextButtonMatch => Boolean(match.button))
    .sort((first, second) => second.score - first.score || second.contextMatches - first.contextMatches)

  const [bestMatch, nextMatch] = scoredMatches
  if (!bestMatch) return null

  const minContextMatches = Math.max(1, Math.min(4, Math.trunc(getNumberParam('tribeReadAlongContextMinMatches', 1))))
  if (bestMatch.contextMatches < minContextMatches) return null

  const minLead = Math.max(0, getNumberParam('tribeReadAlongContextMinScoreLead', 2))
  if (nextMatch && bestMatch.score - nextMatch.score < minLead && bestMatch.contextMatches <= nextMatch.contextMatches) {
    return null
  }

  return bestMatch.button
}

function findReadAlongOrderedOccurrenceButton(
  timingSet: ReadAlongTimingSet,
  timingIndex: number,
  timingAliases: Set<string>,
  preferredButtons: HTMLButtonElement[],
): HTMLButtonElement | null {
  const occurrenceIndex = getReadAlongTimingAliasOccurrenceIndex(timingSet.timings, timingIndex, timingAliases)
  const orderedMatchingButtons = preferredButtons.filter((button) =>
    getReadAlongButtonWordAliases(button).some((alias) => timingAliases.has(alias)),
  )

  return orderedMatchingButtons[occurrenceIndex] || null
}

type WordHotspotMagnifierButton = HTMLButtonElement & {
  tribeRefreshMagnifier?: () => void
}

function refreshReadAlongButtonMagnifier(button: HTMLButtonElement | null): void {
  const refresh = (button as WordHotspotMagnifierButton | null)?.tribeRefreshMagnifier
  if (typeof refresh !== 'function') return

  refresh()
  window.requestAnimationFrame(refresh)
}

function findReadAlongButtonForTiming(timingSet: ReadAlongTimingSet, timingIndex: number): HTMLButtonElement | null {
  const timing = timingSet.timings[timingIndex]
  if (!timing) return null

  const buttons = getReadAlongHotspotButtons()
  if (!buttons.length) return null

  const timingAliases = getReadAlongTimingAliases(timing)
  const matchingButtons = buttons.filter(
    (button) => doesReadAlongButtonMatchAliases(button, timingAliases),
  )
  const orderedButtons = getReadAlongOrderedCandidateButtons(timingSet, buttons)
  const contextButton = findReadAlongContextMatchedButton(timingSet, timingIndex, timingAliases, orderedButtons)
  if (contextButton) return contextButton

  const orderedSequenceButton = findReadAlongSequenceAlignedButton(
    timingSet,
    timingIndex,
    timingAliases,
    orderedButtons,
  )
  if (orderedSequenceButton) return orderedSequenceButton

  const pageMatchingButtons = matchingButtons.filter((button) => getReadAlongButtonPage(button) === timingSet.page)

  const preferredButtons = pageMatchingButtons.length ? pageMatchingButtons : matchingButtons
  const orderedOccurrenceButton = pageMatchingButtons.length
    ? findReadAlongOrderedOccurrenceButton(timingSet, timingIndex, timingAliases, pageMatchingButtons)
    : null
  const coordsTransform = createReadAlongCoordsTransform(timingSet, buttons)
  const geometryMatches = preferredButtons
    .map((button, index) => ({
      button,
      index,
      score: getReadAlongButtonGeometryScore(timing, button, coordsTransform),
    }))
    .filter((item): item is { button: HTMLButtonElement; index: number; score: number } => item.score !== null)
    .sort((first, second) => first.score - second.score || first.index - second.index)

  if (geometryMatches.length) {
    const maxGeometryScore = Math.max(0.01, getNumberParam('tribeReadAlongGeometryMaxScore', 0.08))
    const minScoreGap = Math.max(0, getNumberParam('tribeReadAlongGeometryMinScoreGap', 0.018))
    const [bestMatch, nextBestMatch] = geometryMatches
    if (bestMatch.score > maxGeometryScore) return orderedOccurrenceButton
    if (nextBestMatch && nextBestMatch.score - bestMatch.score < minScoreGap) {
      const occurrenceMatch = findReadAlongOccurrenceMatch(
        timingSet,
        timingIndex,
        timingAliases,
        preferredButtons,
        geometryMatches,
        maxGeometryScore,
        minScoreGap,
      )
      return occurrenceMatch?.button || orderedOccurrenceButton
    }

    return bestMatch.button
  }

  return orderedOccurrenceButton
}

function applyReadAlongButtonHighlight(timingSet: ReadAlongTimingSet | null, timingIndex: number): HTMLButtonElement | null {
  if (!timingSet || timingIndex < 0) {
    clearReadAlongButtonHighlight()
    return null
  }

  const button = findReadAlongButtonForTiming(timingSet, timingIndex)
  if (!button) {
    clearReadAlongButtonHighlight()
    return null
  }

  const alreadyActive = tribeReadAlongActiveHighlightButton === button && button.classList.contains('is-read-along-active')
  clearReadAlongButtonHighlight()
  tribeReadAlongActiveHighlightButton = button
  button.classList.add('is-read-along-active')
  if (!alreadyActive) refreshReadAlongButtonMagnifier(button)
  return button
}

function getReadAlongTimingEndTime(timingSet: ReadAlongTimingSet | null): number {
  if (!timingSet?.timings.length) return 0

  return timingSet.timings.reduce((endTime, timing) => Math.max(endTime, timing.endTime), 0)
}

function doesReadAlongMediaCoverTimingSet(media: HTMLMediaElement | null, timingSet: ReadAlongTimingSet | null): boolean {
  if (!media || !timingSet) return true

  const expectedEndTime = getReadAlongTimingEndTime(timingSet)
  if (expectedEndTime <= 0) return true

  const duration = Number(media.duration)
  if (!Number.isFinite(duration) || duration <= 0) return true

  const toleranceSeconds = Math.max(0, getNumberParam('tribeReadAlongAudioDurationToleranceMs', 350) / 1000)
  return duration + toleranceSeconds >= expectedEndTime
}

function getReadAlongProbePage(context: ExtensionContext, page?: number): number {
  const explicitPage = Number(page)
  if (Number.isFinite(explicitPage)) return Math.max(0, Math.trunc(explicitPage))

  const currentPage = Number(context.data.getCurrentPage())
  if (Number.isFinite(currentPage)) return Math.max(0, Math.trunc(currentPage))

  const paramPage = getStringParam('tribeReadAlongPage')
  if (paramPage !== null) {
    const value = Number(paramPage)
    if (Number.isFinite(value)) return Math.max(0, Math.trunc(value))
  }

  return 0
}

export async function probeReadAlongTimingData(context: ExtensionContext, page?: number): Promise<Record<string, unknown>> {
  const currentPage = context.data.getCurrentPage()
  const requestedPage = getReadAlongProbePage(context, page)
  const resultBase = {
    currentPage,
    enabled: shouldUseReadAlong(),
    mode: 'timing-probe',
    pageUrl: window.location.href,
    requestedPage,
    scriptUrl: getReadAlongExtensionScriptUrl(),
  }

  if (!shouldUseReadAlong()) {
    const result: Record<string, unknown> = {
      ...resultBase,
      attempts: [],
      candidates: [],
      found: false,
      message: 'Read-along timing probe is installed but disabled. Add tribeReadAlong=1 to enable it.',
      timingCount: 0,
    }
    tribeReadAlongLastTimingSet = null
    tribeReadAlongTimingSetsByPage.clear()
    tribeReadAlongLastProbe = result
    updateTribeReadAlongSnapshot({
      hasMatch: false,
      message: String(result.message),
      page: requestedPage,
      timingCount: 0,
      timingIndex: -1,
      word: null,
    })
    return result
  }

  if (!context.data.getWordTimingData) {
    const result: Record<string, unknown> = {
      ...resultBase,
      attempts: [],
      candidates: [],
      found: false,
      message: 'Epic did not expose getWordTimingData() on this page.',
      timingCount: 0,
    }
    tribeReadAlongLastTimingSet = null
    tribeReadAlongTimingSetsByPage.clear()
    tribeReadAlongLastProbe = result
    updateTribeReadAlongSnapshot({
      hasMatch: false,
      message: String(result.message),
      page: requestedPage,
      timingCount: 0,
      timingIndex: -1,
      word: null,
    })
    return result
  }

  const bookData = context.data.getBookData()
  const maxPageValue = Number(bookData?.numPages)
  const maxPage = Number.isFinite(maxPageValue) ? maxPageValue : null
  const candidates = getOrderedReadAlongTimingPageCandidates(requestedPage, maxPage)
  const attempts: Array<Record<string, unknown>> = []
  let selected: ReadAlongTimingSet | null = null
  const timingSets: ReadAlongTimingSet[] = []
  candidates.forEach((candidate) => tribeReadAlongTimingSetsByPage.delete(candidate))

  for (const candidate of candidates) {
    try {
      const wordData = await context.data.getWordTimingData(candidate)
      const rawCount = Array.isArray(wordData?.word_data) ? wordData.word_data.length : 0
      const timings = normalizeReadAlongWordTiming(wordData)
      attempts.push({
        page: candidate,
        rawCount,
        usableCount: timings.length,
      })

      if (timings.length) {
        const timingSet = {
          page: candidate,
          timings,
          wordData,
        }
        timingSets.push(timingSet)
        tribeReadAlongTimingSetsByPage.set(candidate, timingSet)
        if (!selected) selected = timingSet
      }
    } catch (error) {
      attempts.push({
        error: String(error),
        page: candidate,
        rawCount: 0,
        usableCount: 0,
      })
    }
  }

  const firstWords =
    selected?.timings.slice(0, 8).map((timing) => ({
      duration: timing.duration,
      text: timing.text,
      time: timing.time,
      word: timing.word,
    })) || []
  const message = selected
    ? `Read-along timing probe found ${selected.timings.length} usable timing rows on page ${selected.page}.`
    : 'Read-along timing probe did not find usable timing rows for the checked pages.'
  const result: Record<string, unknown> = {
    ...resultBase,
    attempts,
    candidates,
    firstWords,
    found: Boolean(selected),
    message,
    page: selected?.page ?? requestedPage,
    timingCount: selected?.timings.length ?? 0,
    timingPages: timingSets.map((timingSet) => timingSet.page),
  }

  tribeReadAlongLastTimingSet = selected
  tribeReadAlongLastProbe = result
  updateTribeReadAlongSnapshot({
    hasMatch: Boolean(selected),
    message,
    page: selected?.page ?? requestedPage,
    timingCount: selected?.timings.length ?? 0,
    timingIndex: -1,
    word: null,
  })

  return result
}

export async function exportReadAlongTranscript(
  context: ExtensionContext,
  startPage?: number,
  endPage?: number,
): Promise<Record<string, unknown>> {
  const currentPage = context.data.getCurrentPage()
  const bookData = context.data.getBookData()
  const pageCount = Number(bookData?.numPages)
  const maxPageIndex = Number.isFinite(pageCount) && pageCount > 0 ? Math.max(0, Math.trunc(pageCount) - 1) : currentPage
  const requestedStart = Number(startPage)
  const requestedEnd = Number(endPage)
  const rawStart = Number.isFinite(requestedStart) ? Math.trunc(requestedStart) : 0
  const rawEnd = Number.isFinite(requestedEnd) ? Math.trunc(requestedEnd) : maxPageIndex
  const start = Math.max(0, Math.min(rawStart, rawEnd, maxPageIndex))
  const end = Math.max(0, Math.min(Math.max(rawStart, rawEnd), maxPageIndex))
  const resultBase = {
    bookId: context.data.getBookId(),
    currentPage,
    enabled: shouldUseReadAlong(),
    exportedAt: new Date().toISOString(),
    mode: 'transcript-export',
    numPages: Number.isFinite(pageCount) ? Math.trunc(pageCount) : null,
    pageUrl: window.location.href,
    requestedEndPage: Number.isFinite(requestedEnd) ? rawEnd : null,
    requestedStartPage: Number.isFinite(requestedStart) ? rawStart : null,
    scriptUrl: getReadAlongExtensionScriptUrl(),
    startPage: start,
    endPage: end,
  }

  if (!context.data.getWordTimingData) {
    const audit = getReadAlongTranscriptAudit([])
    const result: Record<string, unknown> = {
      ...resultBase,
      audit,
      errorPages: [],
      found: false,
      fullText: '',
      message: 'Epic did not expose getWordTimingData() on this page.',
      missingPages: [],
      nativeFullText: '',
      pages: [],
      pagesChecked: 0,
      pagesWithTiming: 0,
      totalCallableWords: 0,
      totalNativeWords: 0,
      totalWords: 0,
    }
    tribeReadAlongLastTranscriptExport = result
    return result
  }

  const pages: ReadAlongTranscriptPage[] = []
  const missingPages: number[] = []
  const errorPages: Array<{ error: string; page: number }> = []

  for (let page = start; page <= end; page += 1) {
    const audioUrl =
      typeof context.data.getPageAudioUrl === 'function' ? context.data.getPageAudioUrl(page) || null : null

    try {
      const wordData = await context.data.getWordTimingData(page)
      const rawCount = Array.isArray(wordData?.word_data) ? wordData.word_data.length : 0
      const nativeWords = getReadAlongNativeTranscriptWords(wordData)
      const timings = normalizeReadAlongWordTiming(wordData)
      const lookupCommands = createReadAlongLookupCommands(page, timings)
      const audit = auditReadAlongTranscriptPage(page, nativeWords, timings, rawCount)
      const words = timings.map(
        (timing): ReadAlongTranscriptWord => ({
          bbox: timing.raw.bbox || null,
          coords: timing.raw.coords || null,
          duration: timing.duration,
          endTime: timing.endTime,
          lookupPayload: timing.text,
          nativeIndex: timing.nativeIndex,
          nativeText: timing.nativeText,
          splitCount: timing.splitCount,
          splitIndex: timing.splitIndex,
          text: timing.text,
          time: timing.time,
          word: timing.word,
        }),
      )
      const text = words.map((word) => word.text).join(' ')
      const nativeText = nativeWords
        .map((word) => word.text)
        .filter(Boolean)
        .join(' ')

      if (timings.length) {
        tribeReadAlongTimingSetsByPage.set(page, {
          page,
          timings,
          wordData,
        })
      } else {
        missingPages.push(page)
      }

      pages.push({
        audit,
        audioUrl,
        found: timings.length > 0,
        lookupCommands,
        nativeText,
        nativeWords,
        page,
        rawCount,
        text,
        usableCount: timings.length,
        words,
      })
    } catch (error) {
      const errorMessage = String(error)
      missingPages.push(page)
      errorPages.push({ error: errorMessage, page })
      const audit = auditReadAlongTranscriptPage(page, [], [], 0)
      pages.push({
        audit,
        audioUrl,
        error: errorMessage,
        found: false,
        lookupCommands: [],
        nativeText: '',
        nativeWords: [],
        page,
        rawCount: 0,
        text: '',
        usableCount: 0,
        words: [],
      })
    }
  }

  const pagesWithTiming = pages.filter((page) => page.usableCount > 0)
  const totalWords = pagesWithTiming.reduce((total, page) => total + page.usableCount, 0)
  const totalNativeWords = pages.reduce((total, page) => total + page.nativeWords.length, 0)
  const fullText = pages
    .filter((page) => page.text)
    .map((page) => page.text)
    .join('\n\n')
  const nativeFullText = pages
    .filter((page) => page.nativeText)
    .map((page) => page.nativeText)
    .join('\n\n')
  const audit = getReadAlongTranscriptAudit(pages)
  const message = pagesWithTiming.length
    ? `Read-along transcript export found ${totalWords} words across ${pagesWithTiming.length} page${pagesWithTiming.length === 1 ? '' : 's'}.`
    : 'Read-along transcript export did not find usable word timing rows.'
  const result: Record<string, unknown> = {
    ...resultBase,
    audit,
    errorPages,
    found: pagesWithTiming.length > 0,
    fullText,
    message,
    missingPages,
    nativeFullText,
    pages,
    pagesChecked: pages.length,
    pagesWithTiming: pagesWithTiming.length,
    timingPages: pagesWithTiming.map((page) => page.page),
    totalCallableWords: totalWords,
    totalNativeWords,
    totalWords,
  }

  tribeReadAlongLastTranscriptExport = result
  updateTribeReadAlongSnapshot({
    hasMatch: pagesWithTiming.length > 0,
    message,
    page: pagesWithTiming[0]?.page ?? start,
    timingCount: totalWords,
    timingIndex: -1,
    word: null,
  })

  return result
}

export async function auditReadAlongWords(
  context: ExtensionContext,
  startPage?: number,
  endPage?: number,
): Promise<Record<string, unknown>> {
  const transcript = await exportReadAlongTranscript(context, startPage, endPage)
  const audit = transcript.audit && typeof transcript.audit === 'object' ? transcript.audit : null
  const found = Boolean(transcript.found)
  const coverageOk = found && Boolean((audit as Record<string, unknown> | null)?.coverageOk)
  const result: Record<string, unknown> = {
    audit,
    bookId: transcript.bookId,
    coverageOk,
    currentPage: transcript.currentPage,
    endPage: transcript.endPage,
    exportedAt: transcript.exportedAt,
    found,
    message: !found
      ? 'Read-along word audit did not find native Epic timing rows to audit.'
      : coverageOk
        ? 'Read-along word audit found a callable lookup_word payload for every native Epic timing row.'
        : 'Read-along word audit found native Epic timing rows without callable lookup_word payloads.',
    mode: 'read-along-word-audit',
    pageUrl: transcript.pageUrl,
    pagesChecked: transcript.pagesChecked,
    scriptUrl: transcript.scriptUrl,
    startPage: transcript.startPage,
    totalCallableWords: transcript.totalCallableWords,
    totalNativeWords: transcript.totalNativeWords,
    transcript,
  }

  tribeReadAlongLastTranscriptAudit = result
  updateTribeReadAlongSnapshot({
    hasMatch: Boolean(transcript.found),
    message: String(result.message),
    page: Number(transcript.startPage),
    timingCount: Number(transcript.totalCallableWords) || 0,
    timingIndex: -1,
    word: null,
  })

  return result
}

export async function previewReadAlongAtTime(
  context: ExtensionContext,
  time?: number,
  page?: number,
): Promise<Record<string, unknown>> {
  const requestedPage = getReadAlongProbePage(context, page)
  const currentTime = Number(time)
  const safeTime = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0

  const cachedRequestedPage = Number(tribeReadAlongLastProbe?.requestedPage)
  if (
    !tribeReadAlongLastTimingSet ||
    tribeReadAlongLastTimingSet.timings.length === 0 ||
    !Number.isFinite(cachedRequestedPage) ||
    cachedRequestedPage !== requestedPage
  ) {
    await probeReadAlongTimingData(context, requestedPage)
  }

  const timingSet = tribeReadAlongLastTimingSet
  if (!timingSet || !timingSet.timings.length) {
    const result: Record<string, unknown> = {
      currentPage: context.data.getCurrentPage(),
      currentTime: safeTime,
      found: false,
      message: 'Read-along time preview has no timing rows. Run tribeProbeReadAlongTimings() first.',
      mode: 'time-preview',
      pageUrl: window.location.href,
      requestedPage,
      scriptUrl: getReadAlongExtensionScriptUrl(),
      timingCount: 0,
      timingIndex: -1,
      timingPage: null,
      word: null,
    }
    tribeReadAlongLastTimePreview = result
    updateTribeReadAlongSnapshot({
      currentTime: safeTime,
      hasMatch: false,
      message: String(result.message),
      timingCount: 0,
      timingIndex: -1,
      word: null,
    })
    return result
  }

  const lingerSeconds = Math.max(0, getNumberParam('tribeReadAlongPreviewLingerMs', 120) / 1000)
  const timingIndex = findReadAlongTimingIndexAtTime(timingSet.timings, safeTime, lingerSeconds)
  const candidateTiming = timingSet.timings[timingIndex] || null
  const suppressedRange = candidateTiming ? getReadAlongSuppressedTimingRange(context, timingSet, safeTime) : null
  const timing = suppressedRange ? null : candidateTiming
  const message = suppressedRange && candidateTiming
    ? `Read-along time preview suppressed "${candidateTiming.text}" at ${safeTime.toFixed(2)}s.`
    : timing
      ? `Read-along time preview matched "${timing.text}" at ${safeTime.toFixed(2)}s.`
      : `Read-along time preview found no word at ${safeTime.toFixed(2)}s.`
  const result: Record<string, unknown> = {
    currentPage: context.data.getCurrentPage(),
    currentTime: safeTime,
    found: Boolean(timing),
    lingerSeconds,
    message,
    mode: 'time-preview',
    nextWord:
      timingIndex >= 0 && timingSet.timings[timingIndex + 1]
        ? {
            text: timingSet.timings[timingIndex + 1].text,
            time: timingSet.timings[timingIndex + 1].time,
            word: timingSet.timings[timingIndex + 1].word,
          }
        : null,
    occurrenceIndex: timing ? getReadAlongTimingOccurrenceIndex(timingSet.timings, timingIndex) : -1,
    pageUrl: window.location.href,
    previousWord:
      timingIndex > 0 && timingSet.timings[timingIndex - 1]
        ? {
            text: timingSet.timings[timingIndex - 1].text,
            time: timingSet.timings[timingIndex - 1].time,
            word: timingSet.timings[timingIndex - 1].word,
          }
        : null,
    requestedPage,
    scriptUrl: getReadAlongExtensionScriptUrl(),
    suppressedTiming: suppressedRange && candidateTiming
      ? {
          duration: candidateTiming.duration,
          endTime: candidateTiming.endTime,
          text: candidateTiming.text,
          time: candidateTiming.time,
          word: candidateTiming.word,
        }
      : null,
    suppression: summarizeReadAlongSuppression(suppressedRange),
    timing: timing
      ? {
          duration: timing.duration,
          endTime: timing.endTime,
          text: timing.text,
          time: timing.time,
          word: timing.word,
        }
      : null,
    timingCount: timingSet.timings.length,
    timingIndex: timing ? timingIndex : -1,
    timingPage: timingSet.page,
    word: timing?.word ?? null,
  }

  tribeReadAlongLastTimePreview = result
  updateTribeReadAlongSnapshot({
    currentTime: safeTime,
    hasMatch: Boolean(timing),
    message,
    page: timingSet.page,
    timingCount: timingSet.timings.length,
    timingIndex: timing ? timingIndex : -1,
    word: timing?.word ?? null,
  })

  return result
}

function getReadAlongAudioSourceCandidates(media: HTMLMediaElement): string[] {
  return [
    media.currentSrc,
    media.src,
    ...Array.from(media.querySelectorAll('source')).map((source) => source.src),
  ].filter(Boolean)
}

function normalizeReadAlongAudioUrl(value: string): string {
  const text = String(value || '').trim()
  if (!text) return ''

  try {
    const url = new URL(text, window.location.href)
    return `${url.origin}${url.pathname}`
  } catch {
    return text.split('?')[0]
  }
}

function collectReadAlongMediaElementsFromRoot(root: Document | ShadowRoot): HTMLMediaElement[] {
  const roots: Array<Document | ShadowRoot> = [root]
  const seenRoots = new Set<Document | ShadowRoot>(roots)
  const mediaElements: HTMLMediaElement[] = []
  const seenMediaElements = new Set<HTMLMediaElement>()

  for (let index = 0; index < roots.length; index += 1) {
    const currentRoot = roots[index]

    for (const media of Array.from(currentRoot.querySelectorAll<HTMLMediaElement>('audio, video'))) {
      if (seenMediaElements.has(media)) continue

      seenMediaElements.add(media)
      mediaElements.push(media)
    }

    for (const element of Array.from(currentRoot.querySelectorAll<HTMLElement>('*'))) {
      if (!element.shadowRoot || seenRoots.has(element.shadowRoot)) continue

      seenRoots.add(element.shadowRoot)
      roots.push(element.shadowRoot)
    }
  }

  return mediaElements
}

function getExpectedReadAlongAudioUrls(context: ExtensionContext): string[] {
  return getReadAlongPageAudioUrlCandidates(context)
    .map((entry) => (entry.url ? normalizeReadAlongAudioUrl(entry.url) : ''))
    .filter(Boolean)
}

function getReadAlongAudioPageForMedia(context: ExtensionContext, media: HTMLMediaElement | null): number | null {
  if (!media) return null

  const sources = getReadAlongAudioSourceCandidates(media).map(normalizeReadAlongAudioUrl).filter(Boolean)
  if (!sources.length) return null

  const match = getReadAlongPageAudioUrlCandidates(context).find((entry) => {
    if (!entry.url) return false

    const audioUrl = normalizeReadAlongAudioUrl(entry.url)
    return Boolean(audioUrl && sources.includes(audioUrl))
  })

  return typeof match?.page === 'number' && Number.isFinite(match.page) ? match.page : null
}

function getEpicObservedMediaScore(context: ExtensionContext, media: HTMLMediaElement): number {
  const sources = getReadAlongAudioSourceCandidates(media).map(normalizeReadAlongAudioUrl).filter(Boolean)
  const expectedUrls = getExpectedReadAlongAudioUrls(context)
  const matchesExpectedUrl = sources.some((source) => expectedUrls.includes(source))
  const audioPage = getReadAlongAudioPageForMedia(context, media)
  const timingSet =
    (audioPage !== null ? tribeReadAlongTimingSetsByPage.get(audioPage) || null : null) ||
    tribeReadAlongLastTimingSet
  const coversTiming = doesReadAlongMediaCoverTimingSet(media, timingSet)
  if (!media.paused && !media.ended && matchesExpectedUrl && coversTiming) return 0
  if (!media.paused && !media.ended && coversTiming) return 1
  if (!media.paused && !media.ended && matchesExpectedUrl) return 2
  if (!media.paused && !media.ended) return 3
  if (matchesExpectedUrl && !media.ended && coversTiming) return 4
  if (matchesExpectedUrl && !media.ended) return 5
  if (!media.ended && coversTiming) return 6
  if (!media.ended) return 7
  return 8
}

function getBestEpicObservedMediaElement(context: ExtensionContext): HTMLMediaElement | null {
  const mediaElements = Array.from(tribeEpicObservedMediaElements).filter((media) => {
    if (media.ended) return false
    return Boolean(media.currentSrc || media.src || media.readyState > 0 || !media.paused)
  })

  return (
    mediaElements
      .slice()
      .sort((first, second) => getEpicObservedMediaScore(context, first) - getEpicObservedMediaScore(context, second))[0] ||
    null
  )
}

function clearEpicPlaybackPoll(): void {
  if (tribeEpicPlaybackPollTimer !== null) {
    window.clearTimeout(tribeEpicPlaybackPollTimer)
    tribeEpicPlaybackPollTimer = null
  }
  tribeEpicPlaybackPollMedia = null
}

function scheduleEpicPlaybackPoll(context: ExtensionContext, media: HTMLMediaElement): void {
  if (!tribeEpicPlaybackFollowing || media.paused || media.ended) {
    if (tribeEpicPlaybackPollMedia === media) clearEpicPlaybackPoll()
    return
  }

  if (tribeEpicPlaybackPollTimer !== null && tribeEpicPlaybackPollMedia === media) return

  clearEpicPlaybackPoll()
  tribeEpicPlaybackPollMedia = media

  const pollMs = Math.max(16, Math.min(120, getNumberParam('tribeReadAlongPollMs', 33)))
  tribeEpicPlaybackPollTimer = window.setTimeout(() => {
    tribeEpicPlaybackPollTimer = null
    if (!tribeEpicPlaybackFollowing) {
      tribeEpicPlaybackPollMedia = null
      return
    }

    const activeMedia = getBestEpicObservedMediaElement(context) || media
    updateEpicPlaybackStatus(context, activeMedia, 'playback-poll')
  }, pollMs)
}

function updateEpicPlaybackStatus(
  context: ExtensionContext,
  media: HTMLMediaElement | null,
  reason: string,
): Record<string, unknown> {
  const audioPage = getReadAlongAudioPageForMedia(context, media)
  const candidateTimingSet =
    (audioPage !== null ? tribeReadAlongTimingSetsByPage.get(audioPage) || null : null) ||
    tribeReadAlongLastTimingSet
  const mediaCoversTiming = doesReadAlongMediaCoverTimingSet(media, candidateTimingSet)
  const timingSet = mediaCoversTiming ? candidateTimingSet : null
  const hasCurrentTime = Boolean(media && Number.isFinite(media.currentTime))
  const currentTime = hasCurrentTime && media ? media.currentTime : null
  const numericTime = hasCurrentTime ? Number(currentTime) : Number.NaN
  const lingerSeconds = Math.max(0, getNumberParam('tribeReadAlongPreviewLingerMs', 120) / 1000)
  const timingIndex =
    timingSet && Number.isFinite(numericTime)
      ? findReadAlongTimingIndexAtTime(timingSet.timings, numericTime, lingerSeconds)
      : -1
  const candidateTiming = timingSet?.timings[timingIndex] || null
  const suppressedRange =
    candidateTiming && Number.isFinite(numericTime)
      ? getReadAlongSuppressedTimingRange(context, timingSet, numericTime)
      : null
  const timing = suppressedRange ? null : candidateTiming
  const shouldShowActiveWord = Boolean(media && !media.paused && !media.ended && timing)
  const activeButton = tribeEpicPlaybackFollowing
    ? shouldShowActiveWord
      ? applyReadAlongButtonHighlight(timingSet, timingIndex)
      : (clearReadAlongButtonHighlight(), null)
    : tribeReadAlongActiveHighlightButton
  const activeTiming = shouldShowActiveWord ? timing : null
  const mediaSnapshot = media ? summarizeReadAlongMediaElement(media, 0) : null
  const status: Record<string, unknown> = {
    activeButtonWord: activeButton?.dataset.lookupWord || activeButton?.dataset.sourceWord || null,
    audioElementFound: Boolean(media),
    audioPage,
    currentPage: context.data.getCurrentPage(),
    currentTime,
    found: Boolean(activeTiming),
    hasButtonMatch: Boolean(activeButton),
    lingerSeconds,
    media: mediaSnapshot,
    mediaCoversTiming,
    message: media
      ? suppressedRange && candidateTiming
        ? `Epic playback suppressed "${candidateTiming.text}" at ${Number(numericTime).toFixed(2)}s.`
        : activeTiming
          ? `Epic playback matched "${activeTiming.text}" at ${Number(numericTime).toFixed(2)}s.`
        : !mediaCoversTiming
          ? 'Epic playback media is shorter than the selected timing rows; waiting for the matching audio.'
        : media.paused
          ? 'Epic playback media is paused.'
          : 'Epic playback media is active; no timing word matched yet.'
      : 'No Epic playback media has been observed yet.',
    mode: 'epic-playback-follow',
    observedCount: tribeEpicObservedMediaElements.size,
    paused: media ? media.paused : null,
    pollActive: Boolean(tribeEpicPlaybackPollTimer || (media && !media.paused && !media.ended)),
    reason,
    suppressedTiming: suppressedRange && candidateTiming
      ? {
          duration: candidateTiming.duration,
          endTime: candidateTiming.endTime,
          text: candidateTiming.text,
          time: candidateTiming.time,
          word: candidateTiming.word,
        }
      : null,
    suppression: summarizeReadAlongSuppression(suppressedRange),
    timingCount: timingSet?.timings.length || 0,
    timingIndex: activeTiming ? timingIndex : -1,
    timingPage: timingSet?.page ?? null,
    timingPages: Array.from(tribeReadAlongTimingSetsByPage.keys()),
    word: activeTiming?.word ?? null,
  }

  tribeEpicLastPlaybackStatus = status

  if (tribeEpicPlaybackFollowing) {
    updateTribeReadAlongSnapshot({
      activeButtonWord: activeButton?.dataset.lookupWord || activeButton?.dataset.sourceWord || null,
      audioElementFound: Boolean(media),
      audioPaused: media ? media.paused : null,
      currentTime,
      hasMatch: Boolean(activeTiming),
      message: String(status.message),
      page: timingSet?.page ?? context.data.getCurrentPage(),
      timingCount: timingSet?.timings.length || 0,
      timingIndex: activeTiming ? timingIndex : -1,
      word: activeTiming?.word ?? null,
    })
  }

  if (media && !media.paused && !media.ended && tribeEpicPlaybackFollowing) {
    scheduleEpicPlaybackPoll(context, media)
  } else if (!media || media === tribeEpicPlaybackPollMedia) {
    clearEpicPlaybackPoll()
  }

  return status
}

function observeEpicPlaybackMediaElement(context: ExtensionContext, media: HTMLMediaElement, reason: string): void {
  tribeEpicObservedMediaElement = media

  if (tribeEpicObservedMediaElements.has(media)) {
    updateEpicPlaybackStatus(context, media, reason)
    return
  }

  tribeEpicObservedMediaElements.add(media)
  const events: Array<keyof HTMLMediaElementEventMap> = [
    'abort',
    'durationchange',
    'ended',
    'error',
    'loadedmetadata',
    'pause',
    'play',
    'playing',
    'seeked',
    'timeupdate',
  ]
  const onMediaEvent = (event: Event) => {
    updateEpicPlaybackStatus(context, media, event.type)
  }

  events.forEach((eventName) => media.addEventListener(eventName, onMediaEvent))
  tribeEpicObservedMediaCleanups.set(media, () => {
    events.forEach((eventName) => media.removeEventListener(eventName, onMediaEvent))
  })
  updateEpicPlaybackStatus(context, media, reason)
}

function scanEpicPlaybackMediaElements(context: ExtensionContext, reason: string): HTMLMediaElement[] {
  let readingRoot: ShadowRoot | null = null
  try {
    readingRoot = context.slots.get('reading-area')
  } catch {
    readingRoot = null
  }

  const mediaElements = collectReadAlongMediaElements(readingRoot)
  mediaElements.forEach((media) => observeEpicPlaybackMediaElement(context, media, reason))
  return mediaElements
}

function installEpicPlaybackMediaProbe(context: ExtensionContext): () => void {
  if (tribeEpicMediaProbeInstalled && tribeEpicMediaProbeCleanup) return tribeEpicMediaProbeCleanup

  const prototype = HTMLMediaElement.prototype
  const originalPlay = prototype.play
  const originalPause = prototype.pause
  const capturedEvents: Array<keyof HTMLMediaElementEventMap> = ['play', 'playing', 'pause', 'timeupdate', 'ended']

  const onCapturedMediaEvent = (event: Event) => {
    if (event.target instanceof HTMLMediaElement) {
      observeEpicPlaybackMediaElement(context, event.target, `captured ${event.type}`)
    }
  }
  const wrappedPlay: HTMLMediaElement['play'] = function (this: HTMLMediaElement) {
    observeEpicPlaybackMediaElement(context, this, 'HTMLMediaElement.play()')
    return originalPlay.apply(this)
  }
  const wrappedPause: HTMLMediaElement['pause'] = function (this: HTMLMediaElement) {
    observeEpicPlaybackMediaElement(context, this, 'HTMLMediaElement.pause()')
    return originalPause.apply(this)
  }

  prototype.play = wrappedPlay
  prototype.pause = wrappedPause
  capturedEvents.forEach((eventName) => window.addEventListener(eventName, onCapturedMediaEvent, true))
  scanEpicPlaybackMediaElements(context, 'initial scan')

  const cleanup = () => {
    if (prototype.play === wrappedPlay) prototype.play = originalPlay
    if (prototype.pause === wrappedPause) prototype.pause = originalPause
    capturedEvents.forEach((eventName) => window.removeEventListener(eventName, onCapturedMediaEvent, true))
    for (const cleanupMedia of tribeEpicObservedMediaCleanups.values()) {
      cleanupMedia()
    }
    tribeEpicObservedMediaCleanups.clear()
    tribeEpicObservedMediaElements.clear()
    tribeEpicObservedMediaElement = null
    tribeEpicMediaProbeInstalled = false
    tribeEpicMediaProbeCleanup = null
    tribeEpicPlaybackFollowing = false
    clearEpicPlaybackPoll()
    clearReadAlongButtonHighlight()
  }

  tribeEpicMediaProbeInstalled = true
  tribeEpicMediaProbeCleanup = cleanup
  return cleanup
}

export async function ensureEpicPlaybackFollowForCurrentPage(
  context: ExtensionContext,
  reason: string,
): Promise<Record<string, unknown>> {
  if (!shouldUseReadAlong()) {
    const status: Record<string, unknown> = {
      following: false,
      message: 'Epic playback follow is disabled because read-along is disabled.',
      mode: 'epic-playback-follow',
      reason,
    }
    tribeEpicLastPlaybackStatus = status
    return status
  }

  const requestedPage = getReadAlongProbePage(context)
  const cachedRequestedPage = Number(tribeReadAlongLastProbe?.requestedPage)
  if (
    !tribeReadAlongLastTimingSet ||
    tribeReadAlongLastTimingSet.timings.length === 0 ||
    !Number.isFinite(cachedRequestedPage) ||
    cachedRequestedPage !== requestedPage
  ) {
    await probeReadAlongTimingData(context, requestedPage)
  }

  installEpicPlaybackMediaProbe(context)
  tribeEpicPlaybackFollowing = true
  scanEpicPlaybackMediaElements(context, reason)
  const media = getBestEpicObservedMediaElement(context) || tribeEpicObservedMediaElement
  const status = updateEpicPlaybackStatus(context, media, reason)
  return {
    ...status,
    following: true,
    requestedPage,
  }
}

export function probeEpicPlaybackState(context: ExtensionContext): Record<string, unknown> {
  installEpicPlaybackMediaProbe(context)
  scanEpicPlaybackMediaElements(context, 'manual probe scan')
  const media = getBestEpicObservedMediaElement(context) || tribeEpicObservedMediaElement
  const status = updateEpicPlaybackStatus(context, media, 'manual probe')
  return {
    ...status,
    observedMedia: Array.from(tribeEpicObservedMediaElements).map((item, index) =>
      summarizeReadAlongMediaElement(item, index),
    ),
    probeInstalled: tribeEpicMediaProbeInstalled,
  }
}

export function pauseEpicPlaybackForWordLookup(context: ExtensionContext, reason: string): Record<string, unknown> {
  installEpicPlaybackMediaProbe(context)
  scanEpicPlaybackMediaElements(context, reason)

  const media = getBestEpicObservedMediaElement(context) || tribeEpicObservedMediaElement
  const token = tribeEpicLookupPauseToken + 1
  tribeEpicLookupPauseToken = token
  tribeEpicLookupPausedMedia = null
  tribeEpicLookupShouldResume = false

  const shouldPause = Boolean(media && !media.paused && !media.ended)
  let pauseError: string | null = null

  if (media && shouldPause) {
    tribeEpicLookupPausedMedia = media
    tribeEpicLookupShouldResume = true
    try {
      media.pause()
      clearReadAlongButtonHighlight()
      updateEpicPlaybackStatus(context, media, reason)
    } catch (error) {
      pauseError = String(error)
      tribeEpicLookupPausedMedia = null
      tribeEpicLookupShouldResume = false
    }
  }

  const status: Record<string, unknown> = {
    audioElementFound: Boolean(media),
    currentPage: context.data.getCurrentPage(),
    currentTime: media && Number.isFinite(media.currentTime) ? media.currentTime : null,
    error: pauseError,
    message: pauseError
      ? `Unable to pause Epic playback for word lookup: ${pauseError}`
      : shouldPause
        ? 'Paused Epic playback while the word lookup is open.'
        : 'No active Epic playback needed to pause for word lookup.',
    mode: 'epic-playback-lookup-pause',
    paused: shouldPause && !pauseError,
    reason,
    shouldResume: shouldPause && !pauseError,
    token,
  }

  tribeEpicLookupLastStatus = status
  return status
}

export function resumeEpicPlaybackAfterWordLookup(
  context: ExtensionContext,
  token: number,
  reason: string,
): Record<string, unknown> {
  const tokenMatches = token === tribeEpicLookupPauseToken
  const media = tokenMatches ? tribeEpicLookupPausedMedia : null
  const shouldResume = tokenMatches && tribeEpicLookupShouldResume

  if (tokenMatches) {
    tribeEpicLookupPausedMedia = null
    tribeEpicLookupShouldResume = false
  }

  const status: Record<string, unknown> = {
    audioElementFound: Boolean(media),
    currentPage: context.data.getCurrentPage(),
    currentTime: media && Number.isFinite(media.currentTime) ? media.currentTime : null,
    message: !tokenMatches
      ? 'Skipped word lookup playback resume because a newer lookup is active.'
      : !shouldResume
        ? 'No paused Epic playback needs to resume after word lookup.'
        : !media
          ? 'No paused Epic playback media was available to resume after word lookup.'
          : media.ended
            ? 'Skipped word lookup playback resume because Epic playback already ended.'
            : !media.paused
              ? 'Skipped word lookup playback resume because Epic playback is already active.'
              : 'Resuming Epic playback after word lookup closed.',
    mode: 'epic-playback-lookup-resume',
    reason,
    resumed: false,
    shouldResume,
    token,
    tokenMatches,
  }

  if (shouldResume && media && !media.ended && media.paused) {
    try {
      const playResult = media.play()
      status.resumed = true
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch((error: unknown) => {
          tribeEpicLookupLastStatus = {
            ...status,
            error: String(error),
            message: `Unable to resume Epic playback after word lookup: ${String(error)}`,
            resumed: false,
          }
          updateEpicPlaybackStatus(context, media, `${reason}: resume failed`)
        })
      }
      updateEpicPlaybackStatus(context, media, reason)
    } catch (error) {
      status.error = String(error)
      status.message = `Unable to resume Epic playback after word lookup: ${String(error)}`
      status.resumed = false
      updateEpicPlaybackStatus(context, media, `${reason}: resume failed`)
    }
  }

  tribeEpicLookupLastStatus = status
  return status
}

export async function startFollowingEpicPlayback(context: ExtensionContext, page?: number): Promise<Record<string, unknown>> {
  const requestedPage = getReadAlongProbePage(context, page)
  await probeReadAlongTimingData(context, requestedPage)
  installEpicPlaybackMediaProbe(context)
  tribeEpicPlaybackFollowing = true
  scanEpicPlaybackMediaElements(context, 'follow start scan')
  const media = getBestEpicObservedMediaElement(context) || tribeEpicObservedMediaElement
  const status = updateEpicPlaybackStatus(context, media, 'follow start')
  return {
    ...status,
    following: true,
    observedMedia: Array.from(tribeEpicObservedMediaElements).map((item, index) =>
      summarizeReadAlongMediaElement(item, index),
    ),
    requestedPage,
  }
}

export function stopFollowingEpicPlayback(): Record<string, unknown> {
  tribeEpicPlaybackFollowing = false
  clearEpicPlaybackPoll()
  clearReadAlongButtonHighlight()
  const status: Record<string, unknown> = {
    following: false,
    message: 'Stopped following Epic playback state.',
    mode: 'epic-playback-follow',
    observedCount: tribeEpicObservedMediaElements.size,
  }
  tribeEpicLastPlaybackStatus = status
  updateTribeReadAlongSnapshot({
    audioElementFound: Boolean(tribeEpicObservedMediaElement),
    activeButtonWord: null,
    audioPaused: tribeEpicObservedMediaElement ? tribeEpicObservedMediaElement.paused : null,
    message: String(status.message),
  })
  return status
}

function collectReadAlongMediaElements(readingRoot: ShadowRoot | null): HTMLMediaElement[] {
  const roots: Array<Document | ShadowRoot> = readingRoot ? [readingRoot, document] : [document]
  const seen = new Set<HTMLMediaElement>()
  const mediaElements: HTMLMediaElement[] = []

  for (const root of roots) {
    for (const media of collectReadAlongMediaElementsFromRoot(root)) {
      if (seen.has(media)) continue

      seen.add(media)
      mediaElements.push(media)
    }
  }

  return mediaElements
}

function summarizeReadAlongMediaElement(media: HTMLMediaElement, index: number): Record<string, unknown> {
  const sources = getReadAlongAudioSourceCandidates(media)
  return {
    currentSrc: media.currentSrc || null,
    currentTime: Number.isFinite(media.currentTime) ? media.currentTime : null,
    duration: Number.isFinite(media.duration) ? media.duration : null,
    ended: media.ended,
    index,
    muted: media.muted,
    networkState: media.networkState,
    paused: media.paused,
    readyState: media.readyState,
    sourceCount: sources.length,
    sources,
    src: media.src || null,
    tagName: media.tagName.toLowerCase(),
  }
}

function getReadAlongAudioPageCandidates(context: ExtensionContext, page?: number): number[] {
  const requestedPage = getReadAlongProbePage(context, page)
  const timingPage = Number(tribeReadAlongLastProbe?.page)
  const currentPage = context.data.getCurrentPage()
  const maxPageValue = Number(context.data.getBookData()?.numPages)
  const maxPage = Number.isFinite(maxPageValue) ? maxPageValue : null
  const preferredPages = [
    currentPage,
    requestedPage,
    Number.isFinite(timingPage) ? timingPage : null,
    ...tribeReadAlongTimingSetsByPage.keys(),
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  return getOrderedReadAlongTimingPageCandidates(
    Number.isFinite(requestedPage) ? requestedPage : currentPage,
    maxPage,
    preferredPages,
  )
}

function getReadAlongPageAudioUrlCandidates(context: ExtensionContext, page?: number): Array<{
  page: number
  url: string | null
  urlPresent: boolean
}> {
  return getReadAlongAudioPageCandidates(context, page).map((audioPage) => {
    const audioUrl = typeof context.data.getPageAudioUrl === 'function' ? context.data.getPageAudioUrl(audioPage) || '' : ''
    return {
      page: audioPage,
      url: audioUrl || null,
      urlPresent: Boolean(audioUrl),
    }
  })
}

export function probeReadAlongAudio(context: ExtensionContext, page?: number): Record<string, unknown> {
  const requestedPage = getReadAlongProbePage(context, page)
  const timingPage = Number(tribeReadAlongLastProbe?.page)
  const pageAudioUrls = getReadAlongPageAudioUrlCandidates(context, page)

  let readingRoot: ShadowRoot | null = null
  try {
    readingRoot = context.slots.get('reading-area')
  } catch {
    readingRoot = null
  }

  const mediaElements = collectReadAlongMediaElements(readingRoot)
  const media = mediaElements.map(summarizeReadAlongMediaElement)
  const selected =
    mediaElements.find((element) => !element.paused && !element.ended) ||
    mediaElements.find((element) => Boolean(element.currentSrc || element.src)) ||
    mediaElements[0] ||
    null
  const selectedMedia = selected ? summarizeReadAlongMediaElement(selected, mediaElements.indexOf(selected)) : null
  const selectedTime = selected && Number.isFinite(selected.currentTime) ? selected.currentTime : null
  const message = selected
    ? `Read-along audio probe found ${mediaElements.length} media element${mediaElements.length === 1 ? '' : 's'}.`
    : pageAudioUrls.some((entry) => entry.urlPresent)
      ? 'Read-along audio probe found page audio URL data, but no live media element.'
      : 'Read-along audio probe did not find page audio URL data or live media elements.'
  const result: Record<string, unknown> = {
    audioElementFound: Boolean(selected),
    currentPage: context.data.getCurrentPage(),
    enabled: shouldUseReadAlong(),
    media,
    mediaCount: mediaElements.length,
    message,
    mode: 'audio-probe',
    pageAudioUrls,
    pageUrl: window.location.href,
    requestedPage,
    scriptUrl: getReadAlongExtensionScriptUrl(),
    selectedMedia,
    timingPage: Number.isFinite(timingPage) ? timingPage : null,
  }

  tribeReadAlongLastAudioProbe = result
  updateTribeReadAlongSnapshot({
    audioElementFound: Boolean(selected),
    audioPaused: selected ? selected.paused : null,
    currentTime: selectedTime,
    message,
    page: Number.isFinite(timingPage) ? timingPage : requestedPage,
  })

  return result
}

function summarizeReadAlongMediaError(error: MediaError | null): Record<string, unknown> | null {
  if (!error) return null

  return {
    code: error.code,
    message: error.message || null,
  }
}

function probeReadAlongAudioUrlMetadata(
  entry: { page: number; url: string | null; urlPresent: boolean },
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  if (!entry.url) {
    return Promise.resolve({
      error: null,
      metadataLoaded: false,
      message: 'No audio URL was available for this page.',
      page: entry.page,
      timedOut: false,
      url: null,
      urlPresent: false,
    })
  }
  const url = entry.url

  return new Promise((resolve) => {
    const audio = new Audio()
    let timeoutId: number | null = null
    let settled = false

    const finish = (status: Record<string, unknown>) => {
      if (settled) return
      settled = true

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }

      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('abort', onAbort)

      const result: Record<string, unknown> = {
        currentSrc: audio.currentSrc || null,
        currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : null,
        duration: Number.isFinite(audio.duration) ? audio.duration : null,
        error: summarizeReadAlongMediaError(audio.error),
        networkState: audio.networkState,
        page: entry.page,
        paused: audio.paused,
        readyState: audio.readyState,
        url: entry.url,
        urlPresent: true,
        ...status,
      }

      audio.removeAttribute('src')
      try {
        audio.load()
      } catch {
        // The probe is already settled; this only attempts to stop the metadata request.
      }

      resolve(result)
    }

    const onLoadedMetadata = () => {
      finish({
        metadataLoaded: true,
        message: 'Audio URL metadata loaded without starting playback.',
        timedOut: false,
      })
    }
    const onError = () => {
      finish({
        metadataLoaded: false,
        message: 'Audio URL metadata failed to load.',
        timedOut: false,
      })
    }
    const onAbort = () => {
      finish({
        metadataLoaded: false,
        message: 'Audio URL metadata load was aborted.',
        timedOut: false,
      })
    }

    audio.preload = 'metadata'
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('error', onError)
    audio.addEventListener('abort', onAbort)
    timeoutId = window.setTimeout(() => {
      finish({
        metadataLoaded: false,
        message: 'Audio URL metadata load timed out.',
        timedOut: true,
      })
    }, timeoutMs)

    try {
      audio.src = url
      audio.load()
    } catch (error) {
      finish({
        metadataLoaded: false,
        message: `Audio URL metadata probe threw: ${String(error)}`,
        timedOut: false,
      })
    }
  })
}

export async function probeReadAlongAudioUrl(context: ExtensionContext, page?: number): Promise<Record<string, unknown>> {
  const requestedPage = getReadAlongProbePage(context, page)
  const timingPage = Number(tribeReadAlongLastProbe?.page)
  const pageAudioUrls = getReadAlongPageAudioUrlCandidates(context, page)
  const attempts: Array<Record<string, unknown>> = []

  for (const entry of pageAudioUrls) {
    attempts.push(await probeReadAlongAudioUrlMetadata(entry, 4500))
  }

  const selected = attempts.find((attempt) => attempt.metadataLoaded === true) || null
  const selectedPage = Number(selected?.page)
  const resolvedPage = Number.isFinite(selectedPage)
    ? selectedPage
    : Number.isFinite(timingPage)
      ? timingPage
      : requestedPage
  const message = selected
    ? `Read-along audio URL metadata loaded for page ${selected.page}.`
    : attempts.some((attempt) => attempt.urlPresent)
      ? 'Read-along audio URL metadata did not load for any checked page URL.'
      : 'Read-along audio URL metadata probe did not find any page audio URL data.'
  const result: Record<string, unknown> = {
    attempts,
    currentPage: context.data.getCurrentPage(),
    enabled: shouldUseReadAlong(),
    message,
    metadataLoaded: Boolean(selected),
    mode: 'audio-url-probe',
    page: resolvedPage,
    pageAudioUrls,
    pageUrl: window.location.href,
    requestedPage,
    scriptUrl: getReadAlongExtensionScriptUrl(),
    selected,
    timingPage: Number.isFinite(timingPage) ? timingPage : null,
  }

  tribeReadAlongLastAudioUrlProbe = result
  updateTribeReadAlongSnapshot({
    audioElementFound: false,
    audioPaused: selected ? true : null,
    currentTime: selected ? 0 : null,
    message,
    page: resolvedPage,
  })

  return result
}

async function resolveReadAlongAudioForTiming(
  context: ExtensionContext,
  page: number,
  timingSet: ReadAlongTimingSet | null,
): Promise<Record<string, unknown>> {
  const pageAudioUrls = getReadAlongPageAudioUrlCandidates(context, page)
  const attempts: Array<Record<string, unknown>> = []

  for (const entry of pageAudioUrls) {
    attempts.push(await probeReadAlongAudioUrlMetadata(entry, 4500))
  }

  const expectedTimingEnd = getReadAlongTimingEndTime(timingSet)
  const toleranceSeconds = Math.max(0, getNumberParam('tribeReadAlongAudioDurationToleranceMs', 350) / 1000)
  const loadedAttempts = attempts.filter(
    (attempt) => attempt.metadataLoaded === true && typeof attempt.url === 'string' && attempt.url,
  )
  const coveringAttempts = loadedAttempts.filter((attempt) => {
    const duration = Number(attempt.duration)
    return Number.isFinite(duration) && (expectedTimingEnd <= 0 || duration + toleranceSeconds >= expectedTimingEnd)
  })
  const timingPage = timingSet?.page ?? null
  const samePageCoveringAttempt =
    timingPage === null
      ? null
      : coveringAttempts.find((attempt) => Number(attempt.page) === timingPage) || null
  const longestLoadedAttempt =
    loadedAttempts
      .slice()
      .sort((first, second) => Number(second.duration || 0) - Number(first.duration || 0))[0] || null
  const selected = samePageCoveringAttempt || coveringAttempts[0] || longestLoadedAttempt || null
  const selectedDuration = Number(selected?.duration)
  const selectedCoversTiming =
    Boolean(selected) &&
    Number.isFinite(selectedDuration) &&
    (expectedTimingEnd <= 0 || selectedDuration + toleranceSeconds >= expectedTimingEnd)
  const message = selected
    ? selectedCoversTiming
      ? `Read-along audio alignment selected page ${selected.page}; duration covers timing rows.`
      : `Read-along audio alignment selected page ${selected.page}; no candidate fully covered timing rows.`
    : 'Read-along audio alignment found no loadable audio URL.'
  const result: Record<string, unknown> = {
    attempts,
    currentPage: context.data.getCurrentPage(),
    expectedTimingEnd,
    message,
    mode: 'audio-alignment-probe',
    pageAudioUrls,
    pageUrl: window.location.href,
    requestedPage: page,
    scriptUrl: getReadAlongExtensionScriptUrl(),
    selected,
    selectedCoversTiming,
    timingCount: timingSet?.timings.length || 0,
    timingPage,
    toleranceSeconds,
  }

  tribeReadAlongLastAudioAlignmentProbe = result
  return result
}

export async function probeReadAlongAudioAlignment(context: ExtensionContext, page?: number): Promise<Record<string, unknown>> {
  const requestedPage = getReadAlongProbePage(context, page)
  const cachedRequestedPage = Number(tribeReadAlongLastProbe?.requestedPage)
  if (
    !tribeReadAlongLastTimingSet ||
    tribeReadAlongLastTimingSet.timings.length === 0 ||
    !Number.isFinite(cachedRequestedPage) ||
    cachedRequestedPage !== requestedPage
  ) {
    await probeReadAlongTimingData(context, requestedPage)
  }

  const result = await resolveReadAlongAudioForTiming(context, requestedPage, tribeReadAlongLastTimingSet)
  const selected = result.selected && typeof result.selected === 'object' ? (result.selected as Record<string, unknown>) : null
  const selectedPage = Number(selected?.page)
  updateTribeReadAlongSnapshot({
    audioElementFound: false,
    audioPaused: true,
    currentTime: selected ? 0 : null,
    message: String(result.message),
    page: Number.isFinite(selectedPage) ? selectedPage : tribeReadAlongLastTimingSet?.page ?? requestedPage,
    timingCount: tribeReadAlongLastTimingSet?.timings.length || 0,
  })

  return result
}

function updateReadAlongPlaybackStatus(
  context: ExtensionContext,
  audio: HTMLAudioElement,
  audioPage: number,
  timingSet: ReadAlongTimingSet | null,
  reason: string,
): Record<string, unknown> {
  const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
  const lingerSeconds = Math.max(0, getNumberParam('tribeReadAlongPreviewLingerMs', 120) / 1000)
  const timingIndex = timingSet ? findReadAlongTimingIndexAtTime(timingSet.timings, currentTime, lingerSeconds) : -1
  const candidateTiming = timingSet?.timings[timingIndex] || null
  const suppressedRange = candidateTiming ? getReadAlongSuppressedTimingRange(context, timingSet, currentTime) : null
  const timing = suppressedRange ? null : candidateTiming
  const message = suppressedRange && candidateTiming
    ? `Read-along playback suppressed "${candidateTiming.text}" at ${currentTime.toFixed(2)}s.`
    : timing
      ? `Read-along playback matched "${timing.text}" at ${currentTime.toFixed(2)}s.`
      : `Read-along playback ${audio.paused ? 'paused' : 'active'} at ${currentTime.toFixed(2)}s.`
  const status: Record<string, unknown> = {
    audioPage,
    audioUrl: audio.currentSrc || audio.src || null,
    currentPage: context.data.getCurrentPage(),
    currentTime,
    duration: Number.isFinite(audio.duration) ? audio.duration : null,
    ended: audio.ended,
    found: Boolean(timing),
    lingerSeconds,
    message,
    mode: 'playback-status',
    muted: audio.muted,
    networkState: audio.networkState,
    paused: audio.paused,
    readyState: audio.readyState,
    reason,
    suppressedTiming: suppressedRange && candidateTiming
      ? {
          duration: candidateTiming.duration,
          endTime: candidateTiming.endTime,
          text: candidateTiming.text,
          time: candidateTiming.time,
          word: candidateTiming.word,
        }
      : null,
    suppression: summarizeReadAlongSuppression(suppressedRange),
    timing: timing
      ? {
          duration: timing.duration,
          endTime: timing.endTime,
          text: timing.text,
          time: timing.time,
          word: timing.word,
        }
      : null,
    timingCount: timingSet?.timings.length || 0,
    timingIndex: timing ? timingIndex : -1,
    timingPage: timingSet?.page ?? null,
    word: timing?.word ?? null,
  }

  tribeReadAlongLastPlaybackStatus = status
  updateTribeReadAlongSnapshot({
    activeButtonWord: null,
    audioElementFound: true,
    audioPaused: audio.paused,
    currentTime,
    hasMatch: Boolean(timing),
    message,
    page: timingSet?.page ?? audioPage,
    timingCount: timingSet?.timings.length || 0,
    timingIndex: timing ? timingIndex : -1,
    word: timing?.word ?? null,
  })

  return status
}

export function pauseReadAlongPlayback(): Record<string, unknown> {
  const audio = tribeReadAlongPlaybackAudio
  if (!audio) {
    return {
      message: 'No read-along playback audio is active.',
      mode: 'playback-status',
      paused: true,
    }
  }

  audio.pause()
  return {
    ...tribeReadAlongLastPlaybackStatus,
    currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : null,
    message: 'Read-along playback paused.',
    mode: 'playback-status',
    paused: true,
  }
}

export function stopReadAlongPlayback(): Record<string, unknown> {
  const audio = tribeReadAlongPlaybackAudio
  const currentTime = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : null

  if (tribeReadAlongPlaybackCleanup) {
    tribeReadAlongPlaybackCleanup()
  }

  tribeReadAlongPlaybackAudio = null
  tribeReadAlongPlaybackCleanup = null
  const status: Record<string, unknown> = {
    currentTime,
    message: 'Read-along playback stopped.',
    mode: 'playback-status',
    paused: true,
    stopped: true,
  }
  tribeReadAlongLastPlaybackStatus = status
  updateTribeReadAlongSnapshot({
    audioElementFound: false,
    audioPaused: true,
    currentTime,
    hasMatch: false,
    message: String(status.message),
    timingIndex: -1,
    word: null,
  })
  return status
}

export async function startReadAlongPlayback(context: ExtensionContext, page?: number): Promise<Record<string, unknown>> {
  if (!shouldUseReadAlong()) {
    return {
      message: 'Read-along playback is disabled. Add tribeReadAlong=1 to enable it.',
      mode: 'playback-status',
      playStarted: false,
    }
  }

  stopReadAlongPlayback()

  const requestedPage = getReadAlongProbePage(context, page)
  await probeReadAlongTimingData(context, requestedPage)
  const timingSet = tribeReadAlongLastTimingSet
  const cachedAlignment = tribeReadAlongLastAudioAlignmentProbe
  const cachedAlignmentMatches =
    Number(cachedAlignment?.requestedPage) === requestedPage &&
    Number(cachedAlignment?.timingPage) === (timingSet?.page ?? Number.NaN)
  const alignment = cachedAlignmentMatches && cachedAlignment
    ? cachedAlignment
    : await resolveReadAlongAudioForTiming(context, requestedPage, timingSet)
  const pageAudioUrls = Array.isArray(alignment.pageAudioUrls) ? alignment.pageAudioUrls : []
  const selectedAudio =
    alignment.selected && typeof alignment.selected === 'object'
      ? (alignment.selected as Record<string, unknown>)
      : null
  const selectedAudioUrl = typeof selectedAudio?.url === 'string' ? selectedAudio.url : ''
  const selectedAudioPage = Number(selectedAudio?.page)
  if (!selectedAudioUrl || !Number.isFinite(selectedAudioPage)) {
    const result: Record<string, unknown> = {
      audioAlignment: alignment,
      currentPage: context.data.getCurrentPage(),
      message: 'Read-along playback could not start because no page audio URL was available.',
      mode: 'playback-status',
      pageAudioUrls,
      playStarted: false,
      requestedPage,
    }
    tribeReadAlongLastPlaybackStatus = result
    updateTribeReadAlongSnapshot({
      audioElementFound: false,
      audioPaused: null,
      currentTime: null,
      hasMatch: false,
      message: String(result.message),
      page: timingSet?.page ?? requestedPage,
      timingCount: timingSet?.timings.length || 0,
      timingIndex: -1,
      word: null,
    })
    return result
  }

  const audio = new Audio()
  audio.preload = 'auto'
  audio.src = selectedAudioUrl
  tribeReadAlongPlaybackAudio = audio

  const update = (reason: string) => updateReadAlongPlaybackStatus(context, audio, selectedAudioPage, timingSet, reason)
  const onLoadedMetadata = () => update('loadedmetadata')
  const onTimeUpdate = () => update('timeupdate')
  const onPlay = () => update('play')
  const onPause = () => update('pause')
  const onEnded = () => update('ended')
  const onError = () => {
    const status = update('error')
    tribeReadAlongLastPlaybackStatus = {
      ...status,
      error: summarizeReadAlongMediaError(audio.error),
      message: 'Read-along playback audio reported an error.',
      playStarted: false,
    }
    updateTribeReadAlongSnapshot({
      audioPaused: audio.paused,
      message: 'Read-along playback audio reported an error.',
    })
  }

  audio.addEventListener('loadedmetadata', onLoadedMetadata)
  audio.addEventListener('timeupdate', onTimeUpdate)
  audio.addEventListener('play', onPlay)
  audio.addEventListener('pause', onPause)
  audio.addEventListener('ended', onEnded)
  audio.addEventListener('error', onError)
  tribeReadAlongPlaybackCleanup = () => {
    audio.removeEventListener('loadedmetadata', onLoadedMetadata)
    audio.removeEventListener('timeupdate', onTimeUpdate)
    audio.removeEventListener('play', onPlay)
    audio.removeEventListener('pause', onPause)
    audio.removeEventListener('ended', onEnded)
    audio.removeEventListener('error', onError)
    audio.pause()
    audio.removeAttribute('src')
    try {
      audio.load()
    } catch {
      // Best-effort cleanup for the detached probe audio element.
    }
  }

  update('start')

  try {
    await audio.play()
    return {
      ...update('play-started'),
      audioAlignment: alignment,
      pageAudioUrls,
      playStarted: true,
      requestedPage,
    }
  } catch (error) {
    const status = update('play-blocked')
    const result: Record<string, unknown> = {
      ...status,
      audioAlignment: alignment,
      error: String(error),
      message: 'Read-along playback did not start. The browser may require a direct user gesture.',
      pageAudioUrls,
      playStarted: false,
      requestedPage,
    }
    tribeReadAlongLastPlaybackStatus = result
    updateTribeReadAlongSnapshot({
      audioPaused: true,
      message: String(result.message),
    })
    return result
  }
}

export function resetReadAlongDebugState(context: ExtensionContext): void {
  tribeReadAlongLastTimingSet = null
  tribeReadAlongLastProbe = null
  tribeReadAlongLastAudioProbe = null
  tribeReadAlongLastAudioUrlProbe = null
  tribeReadAlongLastAudioAlignmentProbe = null
  tribeReadAlongLastTimePreview = null
  tribeReadAlongLastTranscriptExport = null
  tribeReadAlongLastTranscriptAudit = null
  tribeReadAlongLastPlaybackStatus = null
  tribeEpicLastPlaybackStatus = null
  tribeEpicPlaybackFollowing = false
  tribeReadAlongTimingSetsByPage.clear()
  clearEpicPlaybackPoll()
  stopReadAlongPlayback()
  if (tribeEpicMediaProbeCleanup) {
    tribeEpicMediaProbeCleanup()
  }
  installEpicPlaybackMediaProbe(context)
  updateTribeReadAlongSnapshot({
    audioElementFound: false,
    audioPaused: null,
    currentTime: null,
    hasMatch: false,
    message: shouldUseReadAlong()
      ? 'Read-along status is enabled; timing/audio integration is not active yet.'
      : 'Read-along status is installed but disabled. Add tribeReadAlong=1 to enable the next integration step.',
    page: context.data.getCurrentPage(),
    timingCount: 0,
    timingIndex: -1,
    word: null,
  })
}

export function getReadAlongDebugStatus(
  context: ExtensionContext,
  extensionScriptUrl: string,
): Record<string, unknown> {
  const lastTranscriptExportSummary = tribeReadAlongLastTranscriptExport
    ? {
        audit: tribeReadAlongLastTranscriptExport.audit,
        endPage: tribeReadAlongLastTranscriptExport.endPage,
        exportedAt: tribeReadAlongLastTranscriptExport.exportedAt,
        found: tribeReadAlongLastTranscriptExport.found,
        missingPages: tribeReadAlongLastTranscriptExport.missingPages,
        nativeFullTextLength:
          typeof tribeReadAlongLastTranscriptExport.nativeFullText === 'string'
            ? tribeReadAlongLastTranscriptExport.nativeFullText.length
            : 0,
        pagesChecked: tribeReadAlongLastTranscriptExport.pagesChecked,
        pagesWithTiming: tribeReadAlongLastTranscriptExport.pagesWithTiming,
        startPage: tribeReadAlongLastTranscriptExport.startPage,
        totalCallableWords: tribeReadAlongLastTranscriptExport.totalCallableWords,
        totalNativeWords: tribeReadAlongLastTranscriptExport.totalNativeWords,
        totalWords: tribeReadAlongLastTranscriptExport.totalWords,
      }
    : null
  const lastTranscriptAuditSummary = tribeReadAlongLastTranscriptAudit
    ? {
        audit: tribeReadAlongLastTranscriptAudit.audit,
        coverageOk: tribeReadAlongLastTranscriptAudit.coverageOk,
        endPage: tribeReadAlongLastTranscriptAudit.endPage,
        exportedAt: tribeReadAlongLastTranscriptAudit.exportedAt,
        message: tribeReadAlongLastTranscriptAudit.message,
        pagesChecked: tribeReadAlongLastTranscriptAudit.pagesChecked,
        startPage: tribeReadAlongLastTranscriptAudit.startPage,
        totalCallableWords: tribeReadAlongLastTranscriptAudit.totalCallableWords,
        totalNativeWords: tribeReadAlongLastTranscriptAudit.totalNativeWords,
      }
    : null

  return {
    ...getTribeReadAlongSnapshot(),
    currentPage: context.data.getCurrentPage(),
    enabled: shouldUseReadAlong(),
    epicMediaProbeInstalled: tribeEpicMediaProbeInstalled,
    epicObservedMediaCount: tribeEpicObservedMediaElements.size,
    epicPlaybackPollActive: Boolean(tribeEpicPlaybackPollTimer),
    epicPlaybackFollowing: tribeEpicPlaybackFollowing,
    lastEpicPlaybackStatus: tribeEpicLastPlaybackStatus,
    lastAudioProbe: tribeReadAlongLastAudioProbe,
    lastAudioAlignmentProbe: tribeReadAlongLastAudioAlignmentProbe,
    lastAudioUrlProbe: tribeReadAlongLastAudioUrlProbe,
    lastLookupPlaybackStatus: tribeEpicLookupLastStatus,
    lastPlaybackStatus: tribeReadAlongLastPlaybackStatus,
    lastProbe: tribeReadAlongLastProbe,
    lastTimePreview: tribeReadAlongLastTimePreview,
    lastTranscriptAudit: lastTranscriptAuditSummary,
    lastTranscriptExport: lastTranscriptExportSummary,
    mode: tribeEpicLastPlaybackStatus
      ? 'epic-playback-follow'
      : tribeReadAlongLastTranscriptAudit
        ? 'read-along-word-audit'
      : tribeReadAlongLastPlaybackStatus
        ? 'playback-status'
        : tribeReadAlongLastTimePreview
          ? 'time-preview'
          : tribeReadAlongLastAudioUrlProbe
            ? 'audio-url-probe'
            : tribeReadAlongLastAudioProbe
              ? 'audio-probe'
              : tribeReadAlongLastProbe
                ? 'timing-probe'
                : 'status-only',
    pageUrl: window.location.href,
    scriptUrl: extensionScriptUrl,
  }
}

export function cleanupReadAlongDebugState(): void {
  stopReadAlongPlayback()
  if (tribeEpicMediaProbeCleanup) {
    tribeEpicMediaProbeCleanup()
  }
}
