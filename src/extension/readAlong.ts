import type { ExtensionContext, WordTimingData, WordTimingEntry } from './types'
import { cleanWordHotspotText } from './wordHotspotText'

interface ReadAlongRuntimeDeps {
  getNumberParam(name: string, fallback: number): number
  getStringParam(name: string): string | null
  shouldUseReadAlong(): boolean
  getExtensionScriptUrl(): string
}

let readAlongRuntimeDeps: ReadAlongRuntimeDeps = {
  getNumberParam: (_name, fallback) => fallback,
  getStringParam: () => null,
  shouldUseReadAlong: () => false,
  getExtensionScriptUrl: () => window.location.href,
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
let tribeReadAlongPlaybackAudio: HTMLAudioElement | null = null
let tribeReadAlongPlaybackCleanup: (() => void) | null = null
let tribeReadAlongLastPlaybackStatus: Record<string, unknown> | null = null
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
  raw: WordTimingEntry
  text: string
  time: number
  word: string
}

interface ReadAlongTimingSet {
  page: number
  timings: ReadAlongWordTiming[]
  wordData: WordTimingData | null
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

function normalizeReadAlongWordTiming(wordData: WordTimingData | null | undefined): ReadAlongWordTiming[] {
  const entries = Array.isArray(wordData?.word_data) ? wordData.word_data : []
  return entries
    .map((entry): ReadAlongWordTiming | null => {
      const text = String(entry.text || '').trim()
      const word = normalizeReadAlongWordAlias(text)
      const time = parseReadAlongSeconds(entry.time)
      const duration = parseReadAlongSeconds(entry.duration)
      if (!text || !word || !Number.isFinite(time) || time < 0) return null

      const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0.18
      return {
        duration: safeDuration,
        endTime: time + safeDuration,
        raw: entry,
        text,
        time,
        word,
      }
    })
    .filter((entry): entry is ReadAlongWordTiming => Boolean(entry))
    .sort((first, second) => first.time - second.time)
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

  for (let index = 0; index < timings.length; index += 1) {
    const timing = timings[index]
    if (currentTime >= timing.time && currentTime <= timing.endTime + lingerSeconds) return index
  }

  return -1
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
  return cleanWordHotspotText(value.replace(/[\u2010-\u2015]/g, '-')).toLowerCase()
}

function getReadAlongButtonWord(button: HTMLButtonElement): string {
  return normalizeReadAlongWordAlias(button.dataset.lookupWord || button.dataset.sourceWord || button.textContent || '')
}

export function getReadAlongButtonWordAliases(button: HTMLButtonElement): string[] {
  const aliases = new Set<string>()
  const addAlias = (value: string) => {
    const alias = normalizeReadAlongWordAlias(value)
    if (alias) aliases.add(alias)
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

  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.tribe-word-hotspot-button, .tribe-standalone-word-hotspot-button'),
  )
  if (!buttons.length) return null

  const occurrenceIndex = getReadAlongTimingOccurrenceIndex(timingSet.timings, timingIndex)
  const exactMatchingButtons = buttons.filter((button) => getReadAlongButtonWord(button) === timing.word)
  const matchingButtons = exactMatchingButtons.length
    ? exactMatchingButtons
    : buttons.filter((button) => getReadAlongButtonWordAliases(button).includes(timing.word))
  const pageMatchingButtons = matchingButtons.filter((button) => getReadAlongButtonPage(button) === timingSet.page)
  const hasPagedButtons = matchingButtons.some((button) => getReadAlongButtonPage(button) !== null)
  if (hasPagedButtons && !pageMatchingButtons.length) return null

  const preferredButtons = pageMatchingButtons.length ? pageMatchingButtons : matchingButtons

  return preferredButtons[occurrenceIndex] || preferredButtons[0] || null
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
  const timing = timingSet.timings[timingIndex] || null
  const message = timing
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
    timingIndex,
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
    timingIndex,
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
  const timing = timingSet?.timings[timingIndex] || null
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
      ? activeTiming
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
      audio.src = entry.url
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
    page: selected?.page ?? (Number.isFinite(timingPage) ? timingPage : requestedPage),
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
    page: selected?.page ?? (Number.isFinite(timingPage) ? timingPage : requestedPage),
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
  const timing = timingSet?.timings[timingIndex] || null
  const message = timing
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
    timingIndex,
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
    timingIndex,
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
  const alignment = cachedAlignmentMatches
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
    mode: tribeEpicLastPlaybackStatus
      ? 'epic-playback-follow'
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
