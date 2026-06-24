import {
  Alignment,
  EventType,
  Fit,
  Layout,
  Rive,
  RuntimeLoader,
  type Event as RiveRuntimeEvent,
  type ViewModelInstance,
} from '@rive-app/canvas'
import type { Extension, ExtensionContext, FlipBookRect } from './types'
import { commandHarnessStyles, drawerStyles, simpleOverlayStyles, standaloneWordHotspotStyles, styles } from './styles'
import {
  EPIC_WORD_HOTSPOT_TEST_DEFAULTS,
  SAMPLE_SPREADS,
  TRIBE_SPREADS,
  getEpicReaderBookIdFromUrl,
  getEpicTribeBookConfig,
  getSupportedTribeRiveFolders,
  isEpicReaderHost,
  type CommandHarnessPreviewFile,
  type EpicTribeBookConfig,
  type SpreadConfig,
} from './bookConfig'
import {
  cleanWordHotspotText,
  getWordHotspotLogicalPage,
  getWordHotspotTextSegments,
  isSuspectWordHotspotText,
  normalizeWordHotspotFileName,
  type WordHotspotBounds,
  type WordHotspotTextSegment,
} from './wordHotspotText'
import {
  cleanLookupWord,
  getCommand,
  getEpicPageNavigationCommand,
  getLookupWordPayload,
  getModalSize,
  getPageNavigationDirection,
  isPageNavigationCommand,
  type EpicPageNavigationCommand,
  type ReaderCommand,
  type RiveAction,
} from './readerCommands'
import {
  auditReadAlongWords,
  cleanupReadAlongDebugState,
  clearReadAlongButtonHighlight,
  configureReadAlong,
  ensureEpicPlaybackFollowForCurrentPage,
  exportReadAlongTranscript,
  getReadAlongDebugStatus,
  getReadAlongButtonWordAliases,
  getTribeReadAlongSnapshot,
  pauseEpicPlaybackForWordLookup,
  pauseReadAlongPlayback,
  previewReadAlongAtTime,
  probeEpicPlaybackState,
  probeReadAlongAudio,
  probeReadAlongAudioAlignment,
  probeReadAlongAudioUrl,
  probeReadAlongTimingData,
  resetReadAlongDebugState,
  resumeEpicPlaybackAfterWordLookup,
  startFollowingEpicPlayback,
  startReadAlongPlayback,
  stopFollowingEpicPlayback,
  stopReadAlongPlayback,
  updateTribeReadAlongSnapshot,
} from './readAlong'
import {
  configureSimpleRiveFiles,
  expandPageRange,
  filterSimpleRiveFilesForBook,
  getFirstSimpleRivePage,
  getNavigationDirectionFromClick,
  getNavigationDirectionFromPayload,
  getNavigationSourceFromPayload,
  getReaderPageFromPayload,
  getRiveAnimationInputNameCandidates,
  getSimpleRiveAnimationEntry,
  getSimpleRiveAnimationNames,
  getSimpleRiveBookIdFromContext,
  getSimpleRiveFileForPage,
  getSimpleRiveFileSource,
  getSimpleRiveLastPage,
  getSimpleRiveStateMachineEntry,
  inferSimpleRivePage,
  isExactRiveAnimationNameMatch,
  listSimpleRiveAnimations,
  listSimpleRiveStateMachines,
  loadSimpleRiveFiles,
  normalizeRiveNameForMatch,
  parseSimpleRivePages,
  type SimpleRiveAnimationEntry,
  type SimpleRiveContents,
  type SimpleRiveFile,
  type SimpleRiveStateMachineEntry,
} from './simpleRiveFiles'

declare const __EXTENSION_GLOBAL_NAME__: string
declare const __EXTENSION_ENTRY_FILE__: string
const EPIC_EXTENSION_REGISTRATION_NAME = __EXTENSION_ENTRY_FILE__.replace(/-main\.js$/i, '')

type CommandHarnessTransitionDirection = 1 | -1 | null
type CommandHarnessEdgeDirection = 'back' | 'next'

interface CommandHarnessStateMachineInput {
  name: string
  type?: number
  value?: boolean
  fire?: () => void
}

interface CommandHarnessPreviewLayer {
  canvas: HTMLCanvasElement
  file: CommandHarnessPreviewFile
  index: number
  initialPlaybackMode: 'stateMachine' | 'idle'
  initialStateMachineStarted: boolean
  loaded: boolean
  renderSize: WordHotspotRenderSize | null
  rive: Rive | null
  role: 'active' | 'next' | 'previous' | 'preload'
}

type CommandHarnessPendingTurn = {
  direction: 'next' | 'back'
  targetIndex: number
  targetPage: number
}

interface CommandHarnessAnimationResolution {
  animation: string
  artboard?: string
  candidates: string[]
  found: boolean
}

interface CommandHarnessStateMachineResolution {
  artboard?: string
  stateMachine: string
}

interface SimpleRiveViewModelPropertyPath {
  path: string
  name: string
  type: string
  depth: number
}

interface SimpleRiveInteractionBinding {
  rive: Rive
  canvas: HTMLCanvasElement
  cleanup: Array<() => void>
}

interface SimpleRiveUnderlay {
  file: SimpleRiveFile
  index: number
  page: number
  direction: number
  readerPageLabel: string
  playbackKey: string
  rive: Rive
  canvas: HTMLCanvasElement
  requestedArtboard: string | null
  animation: string | null
  animationEntry: SimpleRiveAnimationEntry | null
  stateMachine: string | null
  stateMachineEntry: SimpleRiveStateMachineEntry | null
  backRevealPrepared?: boolean
}

interface SimpleRiveLoadOptions {
  stackUnderCurrent?: boolean
  pagePrevUnderCurrent?: boolean
}

interface ReaderCompletionDebug {
  currentPage: number
  bookDataId: unknown
  numPages: unknown
  suspectedCompletionFields: Record<string, unknown>
  labsDataPresent: boolean
}

interface RiveRuntimeConfig {
  autoBind: boolean
  autoStateMachine: boolean
  autoplay: boolean
  disableListeners: boolean
  load: boolean
  maxCanvasPixels: number
  pixelRatio: number
  preventDefaultAnimation: boolean
  useOffscreenRenderer: boolean
  spreads: SpreadConfig[]
}

interface TribeDebugApi {
  lookupWord(word: string): boolean
}

type TribeDebugWindow = Window &
  typeof globalThis & {
    TribeDebug?: TribeDebugApi
    tribeActiveHotspotPageAudit?: () => Record<string, unknown>
    tribeCommandHarnessNextPage?: () => boolean
    tribeCommandHarnessPreviousPage?: () => boolean
    tribeCommandHarnessCompletionDebug?: () => Record<string, unknown>
    tribeCommandHarnessReleaseForCompletion?: (reason?: string) => Record<string, unknown>
    tribeCommandHarnessRestoreOverlay?: (reason?: string) => Record<string, unknown>
    tribeCommandHarnessSetCanvasBleed?: (xPct?: number, yPct?: number) => Record<string, unknown>
    tribeCommandHarnessSetPreviewFit?: (fit?: string) => Record<string, unknown>
    tribeCheckEpicPageLayout?: (startPage?: number, endPage?: number) => Promise<Record<string, unknown>>
    tribeDebugStatus?: () => Record<string, unknown>
    tribeLookupWord?: (word: string) => boolean
    tribeClickWordHotspot?: (word?: string) => boolean
    tribeCloseModal?: () => boolean
    tribeArmWordLookupDismiss?: (word?: string) => boolean
    tribeNextPage?: () => boolean
    tribePreviousPage?: () => boolean
    tribeProbeReadAlongAudio?: (page?: number) => Record<string, unknown>
    tribeProbeReadAlongAudioAlignment?: (page?: number) => Promise<Record<string, unknown>>
    tribeProbeReadAlongAudioUrl?: (page?: number) => Promise<Record<string, unknown>>
    tribeProbeReadAlongTimings?: (page?: number) => Promise<Record<string, unknown>>
    tribeAuditReadAlongWords?: (startPage?: number, endPage?: number) => Promise<Record<string, unknown>>
    tribeExportReadAlongTranscript?: (startPage?: number, endPage?: number) => Promise<Record<string, unknown>>
    tribeExportFullReadAlongTranscript?: (startPage?: number, endPage?: number) => Promise<Record<string, unknown>>
    tribePreviewReadAlongAtTime?: (time?: number, page?: number) => Promise<Record<string, unknown>>
    tribeStartReadAlongAudio?: (page?: number) => Promise<Record<string, unknown>>
    tribePauseReadAlongAudio?: () => Record<string, unknown>
    tribeStopReadAlongAudio?: () => Record<string, unknown>
    tribeProbeEpicPlayback?: () => Record<string, unknown>
    tribeStartEpicPlaybackFollow?: (page?: number) => Promise<Record<string, unknown>>
    tribeStopEpicPlaybackFollow?: () => Record<string, unknown>
    tribeReadAlongStatus?: () => Record<string, unknown>
    tribeForceWordHotspotPage?: (page?: number) => boolean
    tribeEpicNativePassthroughDebug?: () => Record<string, unknown>
    tribeReaderNavGutterDebug?: () => Record<string, unknown>
    tribeWordHotspotDebug?: () => Record<string, unknown>
    tribeWordHotspots?: ActiveWordHotspot[]
  }

type TransitionDirection = 'forward' | 'backward'

interface TransitionRivePlayer {
  animation: string
  artboard: string | null
  canvas: HTMLCanvasElement
  direction: TransitionDirection
  ready: boolean
  rive: Rive
  url: string
}

interface WordHotspotManifest {
  files?: WordHotspotFile[]
  render?: {
    contentBounds?: WordHotspotBounds
    contentBoundsByPage?: Record<string, WordHotspotBounds>
    width?: number
    height?: number
  }
}

interface WordHotspotFile {
  contentBounds?: WordHotspotBounds
  contentBoundsByPage?: Record<string, WordHotspotBounds>
  file: string
  ocr?: string
  pages?: number[] | number
  render?: {
    contentBounds?: WordHotspotBounds
    contentBoundsByPage?: Record<string, WordHotspotBounds>
    width?: number
    height?: number
  }
  source?: string
  sourceDetail?: Record<string, unknown>
  text?: string
  words?: WordHotspotWord[]
}

interface WordHotspotRenderSize {
  width: number
  height: number
}

interface WordHotspotWord {
  text?: string
  normalized?: WordHotspotBounds
}

interface WordHotspotOcrFile {
  height?: number
  text?: string
  width?: number
  words?: WordHotspotOcrWord[]
}

interface WordHotspotOcrWord {
  bbox?: {
    height?: number
    width?: number
    x?: number
    y?: number
  } | null
  height?: number
  text?: string
  width?: number
  x?: number
  y?: number
}

interface ActiveWordHotspot {
  fileName: string
  height: number
  page: number
  reason: string
  sourceHeight?: number
  sourceWord: string
  sourceWidth?: number
  sourceX?: number
  sourceY?: number
  width: number
  word: string
  x: number
  y: number
}

interface WordLookupDismissGuard {
  arm(word: string, source: string, event?: Event): void
  cleanup(): void
  getDebugState(): Record<string, unknown>
}

let extension: Extension
let sharedWordLookupDismissGuard: WordLookupDismissGuard | null = null
let sharedWordLookupDismissGuardRefs = 0

function getCurrentScriptUrl(): string | null {
  if (document.currentScript instanceof HTMLScriptElement && document.currentScript.src) {
    return document.currentScript.src
  }

  return null
}

function getSearchParamsFromUrl(url: string | null): URLSearchParams {
  if (!url) return new URLSearchParams()

  try {
    return new URL(url, window.location.href).searchParams
  } catch {
    return new URLSearchParams()
  }
}

function hasAnyFlag(params: URLSearchParams, names: string[]): boolean {
  return names.some((name) => {
    const value = params.get(name)
    return value === '1' || value === 'true'
  })
}

function handleEmergencyDisable(): boolean {
  const pageParams = new URLSearchParams(window.location.search)
  const scriptParams = getSearchParamsFromUrl(getCurrentScriptUrl())
  const disableKeys = ['tribeOff', 'disableTribe']
  const killKeys = ['tribeKill', 'tribePanic']
  const shouldKill = hasAnyFlag(pageParams, killKeys) || hasAnyFlag(scriptParams, killKeys)
  const shouldDisable = shouldKill || hasAnyFlag(pageParams, disableKeys) || hasAnyFlag(scriptParams, disableKeys)

  if (!shouldDisable) return false

  try {
    if (shouldKill) {
      window.localStorage.removeItem('epic_debug_plugin')
    }
  } catch {
    // Even if storage is blocked, keep this script harmless for the current page load.
  }

  console.info(
    shouldKill
      ? '[1Tribe] Removed epic_debug_plugin and skipped extension startup.'
      : '[1Tribe] Skipped extension startup for this page.',
  )
  return true
}

function shouldShowBootBadge(): boolean {
  const pageParams = new URLSearchParams(window.location.search)
  const scriptParams = getSearchParamsFromUrl(getCurrentScriptUrl())

  return hasAnyFlag(pageParams, ['tribeBootBadge']) || hasAnyFlag(scriptParams, ['tribeBootBadge'])
}

function updateBootBadge(message: string): void {
  let badge = document.getElementById('1tribe-boot-badge')
  if (!badge) {
    badge = document.createElement('div')
    badge.id = '1tribe-boot-badge'
    badge.style.cssText = [
      'position:fixed',
      'right:12px',
      'bottom:12px',
      'z-index:2147483647',
      'max-width:min(360px,calc(100vw - 24px))',
      'padding:10px 12px',
      'border-radius:8px',
      'background:#0f766e',
      'color:#fff',
      'font:700 12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'box-shadow:0 8px 24px rgba(0,0,0,.2)',
      'pointer-events:none',
    ].join(';')
    document.documentElement.append(badge)
  }

  badge.textContent = message
}

const showBootBadge = shouldShowBootBadge()
if (showBootBadge) {
  window.setTimeout(() => updateBootBadge('1Tribe script loaded'), 0)
}

if (handleEmergencyDisable()) {
  extension = {
    activate: () => () => {},
  }
} else {
function getStoredDebugPluginUrl(): string | null {
  try {
    return window.localStorage.getItem('epic_debug_plugin')
  } catch {
    return null
  }
}

function getExtensionScriptUrl(): string {
  const currentScriptUrl = getCurrentScriptUrl()
  if (currentScriptUrl) return currentScriptUrl

  const script = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]')).find((item) =>
    item.src.includes(__EXTENSION_ENTRY_FILE__),
  )
  if (script?.src) return script.src

  return getStoredDebugPluginUrl() || window.location.href
}

const extensionScriptUrl = getExtensionScriptUrl()
const RIVE_WASM_SOURCE = new URL('rive/rive.wasm', extensionScriptUrl).href
const RIVE_WASM_FALLBACK_SOURCE = new URL('rive/rive_fallback.wasm', extensionScriptUrl).href
const urlParams = new URL(extensionScriptUrl).searchParams
const pageUrlParams = new URLSearchParams(window.location.search)
const STATIC_PREVIEW_ANIMATION = '__1tribe_static_preview__'
const COMMAND_HARNESS_DEBUG_BUILD_LABEL = 'creepy-overlap-readalong-20260620-01'
function getStableEpicDefaultParam(name: string): string | null {
  const isDisabled =
    urlParams.get('tribeStablePreset') === '0' ||
    urlParams.get('tribeStablePreset') === 'false' ||
    pageUrlParams.get('tribeStablePreset') === '0' ||
    pageUrlParams.get('tribeStablePreset') === 'false'
  const bookId = getEpicReaderBookIdFromUrl()
  if (isDisabled || !bookId || !isEpicReaderHost()) return null
  const bookConfig = getEpicTribeBookConfig(bookId)
  if (!bookConfig) return null

  if (name === 'riveFolder') {
    return bookConfig.riveFolder
  }

  if (name === 'riveWordHotspotFolder') {
    return bookConfig.wordHotspotFolder
  }

  if (bookConfig.defaultParams[name] !== undefined) {
    return bookConfig.defaultParams[name]
  }

  if (EPIC_WORD_HOTSPOT_TEST_DEFAULTS[name] !== undefined) {
    return EPIC_WORD_HOTSPOT_TEST_DEFAULTS[name]
  }

  const shouldUseWordHotspotTest =
    ['1', 'true'].includes(
      (pageUrlParams.get('tribeWordHotspotTest') ?? urlParams.get('tribeWordHotspotTest') ?? '').toLowerCase(),
    )
  const shouldUseCommandHarnessWordFinderDefaults =
    ['1', 'true'].includes(
      (pageUrlParams.get('tribeCommandHarnessWordFinder') ??
        urlParams.get('tribeCommandHarnessWordFinder') ??
        '').toLowerCase(),
    )
  if (
    (shouldUseWordHotspotTest || shouldUseCommandHarnessWordFinderDefaults) &&
    EPIC_WORD_HOTSPOT_TEST_DEFAULTS[name] !== undefined
  ) {
    return EPIC_WORD_HOTSPOT_TEST_DEFAULTS[name]
  }

  return null
}

function getStoredDebugParam(name: string): string | null {
  let rawValue: string | null = null

  try {
    rawValue =
      window.localStorage.getItem('tribeDebugParams') ||
      window.localStorage.getItem('tribeExtensionParams')
  } catch {
    return null
  }

  if (!rawValue) return null

  try {
    const params = rawValue.includes('?')
      ? new URL(rawValue, window.location.href).searchParams
      : new URLSearchParams(rawValue.replace(/^\?/, ''))
    return params.get(name)
  } catch {
    return null
  }
}

function getStringParam(name: string): string | null {
  return urlParams.get(name) ?? pageUrlParams.get(name) ?? getStoredDebugParam(name) ?? getStableEpicDefaultParam(name)
}

function getBooleanParam(name: string, fallback: boolean): boolean {
  const value = getStringParam(name)
  if (value === null) return fallback
  return value === '1' || value === 'true'
}

function shouldUseCommandHarness(): boolean {
  return getBooleanParam('tribeCommandHarness', false)
}

function shouldUseReadAlong(): boolean {
  return getBooleanParam('tribeReadAlong', false) || getBooleanParam('riveReadAlong', false)
}

function shouldUseCommandHarnessWordFinder(): boolean {
  const explicitValue = getStringParam('tribeCommandHarnessWordFinder')
  if (explicitValue !== null) {
    return explicitValue === '1' || explicitValue === 'true'
  }

  return (
    shouldUseStandaloneWordHotspots() ||
    getBooleanParam('tribeWordHotspotTest', false) ||
    getBooleanParam('wordHotspots', false) ||
    getBooleanParam('riveWordHotspots', false)
  )
}

function getNumberParam(name: string, fallback: number): number {
  const value = Number(getStringParam(name))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function getNonNegativeNumberParam(name: string, fallback: number): number {
  const value = Number(getStringParam(name))
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function getSignedNumberParam(name: string, fallback: number): number {
  const rawValue = getStringParam(name)
  if (rawValue === null) return fallback

  const value = Number(rawValue)
  return Number.isFinite(value) ? value : fallback
}

const readAlongHotspotRoots = new Set<ShadowRoot>()

function getReadAlongHotspotSearchRoots(): Array<Document | ShadowRoot> {
  return [document, ...Array.from(readAlongHotspotRoots)]
}

configureReadAlong({
  getNumberParam,
  getStringParam,
  shouldUseReadAlong,
  getExtensionScriptUrl: () => extensionScriptUrl,
  getHotspotSearchRoots: getReadAlongHotspotSearchRoots,
})
configureSimpleRiveFiles({
  getBooleanParam,
  getStringParam,
  getExtensionScriptUrl: () => extensionScriptUrl,
})

function stopWordLookupDismissEvent(event: Event): void {
  event.preventDefault()
  event.stopPropagation()
  if ('stopImmediatePropagation' in event) {
    event.stopImmediatePropagation()
  }
}

function setWordLookupPassthroughMode(isActive: boolean): void {
  document.documentElement.classList.toggle('tribe-word-lookup-passthrough', isActive)
}

function createWordLookupDismissGuard(context: ExtensionContext): WordLookupDismissGuard {
  let modalRoot: ShadowRoot | null = null
  try {
    modalRoot = context.slots.get('modal')
  } catch {
    modalRoot = null
  }

  let modalOpen = false
  let modalOpenedAt = 0
  let lookupArmedAt = 0
  let modalExpectedUntil = 0
  let openingEventTarget: EventTarget | null = null
  let openingEventUntil = 0
  let dismissCount = 0
  let passthroughUntil = 0
  let passthroughTimer: number | null = null
  let lastWord = ''
  let lastSource = ''
  let lastDismissReason = ''
  let lastDismissAt = 0
  let lookupClosedAt = 0
  let modalContentObserver: MutationObserver | null = null
  let readAlongLookupPauseToken = 0
  let shouldResumeReadAlongAfterLookup = false
  let lastReadAlongLookupPauseStatus: Record<string, unknown> | null = null
  let lastReadAlongLookupResumeStatus: Record<string, unknown> | null = null

  const getOpeningEventSuppressMs = () => Math.max(100, getNumberParam('riveModalOpeningEventSuppressMs', 650))
  const getTtlMs = () => Math.max(500, getNumberParam('riveWordLookupDismissTtlMs', 12000))
  const getSuppressMs = () => Math.max(100, getNumberParam('riveWordLookupDismissSuppressMs', 650))

  const clearPassthroughTimer = () => {
    if (passthroughTimer === null) return
    window.clearTimeout(passthroughTimer)
    passthroughTimer = null
  }

  const resumeReadAlongAfterLookup = (reason: string) => {
    if (!shouldResumeReadAlongAfterLookup) return

    shouldResumeReadAlongAfterLookup = false
    lastReadAlongLookupResumeStatus = resumeEpicPlaybackAfterWordLookup(context, readAlongLookupPauseToken, reason)
  }

  const setGuardPassthroughMode = (isActive: boolean, reason: string) => {
    setWordLookupPassthroughMode(isActive)
    if (!isActive) resumeReadAlongAfterLookup(reason)
  }

  const setPassthroughUntil = (timestamp: number) => {
    passthroughUntil = timestamp
    setGuardPassthroughMode(Date.now() <= timestamp, 'lookup passthrough ended')
    clearPassthroughTimer()
    const delay = timestamp - Date.now()
    if (delay <= 0) {
      setGuardPassthroughMode(false, 'lookup passthrough expired')
      return
    }

    passthroughTimer = window.setTimeout(() => {
      passthroughTimer = null
      if (!isModalOpenNow() && Date.now() >= passthroughUntil) {
        setGuardPassthroughMode(false, 'lookup passthrough timer')
      }
    }, delay)
  }

  const hasVisibleModalContent = () => {
    if (!modalRoot) return false
    if (modalRoot.childElementCount === 0) return false

    return Array.from(modalRoot.children).some((child) => {
      if (!(child instanceof HTMLElement)) return true
      if (child.hidden || child.getAttribute('aria-hidden') === 'true') return false

      const style = window.getComputedStyle(child)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.02) {
        return false
      }

      return true
    })
  }

  const isActualModalOpen = () => {
    const actualOpen = modalOpen || hasVisibleModalContent()
    if (actualOpen && !modalOpenedAt) modalOpenedAt = Date.now()
    return actualOpen
  }

  const isLookupModalExpected = () => Boolean(lastWord && modalExpectedUntil && Date.now() <= modalExpectedUntil)

  const isModalOpenNow = () => isActualModalOpen() || isLookupModalExpected()

  const completeLookupIfModalClosed = (reason: string) => {
    if (!lastWord || lookupClosedAt) return
    if (!modalOpenedAt) return
    if (Date.now() <= openingEventUntil) return
    if (isActualModalOpen()) return

    lookupClosedAt = Date.now()
    modalOpen = false
    modalExpectedUntil = 0
    setPassthroughUntil(lookupClosedAt + getSuppressMs())
    resumeReadAlongAfterLookup(reason)
  }

  const updateModalOpen = (payload?: unknown) => {
    const state = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
    const value = [state.mounted, state.open, state.isOpen, state.visible].find(
      (candidate): candidate is boolean => typeof candidate === 'boolean',
    )

    if (typeof value !== 'boolean') return

    modalOpen = value
    if (value) {
      modalOpenedAt = Date.now()
    }
    window.setTimeout(() => completeLookupIfModalClosed(`modal-state-${value ? 'open' : 'closed'}`), 0)
  }

  const isEventInsideModal = (event: Event): boolean => {
    const path = event.composedPath()
    if (modalRoot) {
      if (path.includes(modalRoot)) return true
      if (modalRoot.host && path.includes(modalRoot.host)) return true
      if (event.target instanceof Node && modalRoot.contains(event.target)) return true
    }

    return path.some((item) => {
      if (!(item instanceof Element)) return false
      return Boolean(
        item.closest(
          'dialog,[role="dialog"],[aria-modal="true"],[data-testid*="modal" i],[data-test-id*="modal" i],[class*="modal" i],[class*="dialog" i],[class*="dictionary" i],[class*="definition" i]',
        ),
      )
    })
  }

  const releaseOutsideClickToEpic = (event: Event, reason: string) => {
    const now = Date.now()
    modalOpen = false
    modalExpectedUntil = 0
    dismissCount += 1
    lastDismissReason = reason
    lastDismissAt = now
    setPassthroughUntil(now + getSuppressMs())

    context.analytics.log('1tribe_word_lookup_outside_click_passthrough', {
      bookId: context.data.getBookId(),
      page: context.data.getCurrentPage(),
      word: lastWord,
      source: lastSource,
      reason,
    })
    console.info('[1Tribe word lookup] Released outside click to Epic native modal handler.', {
      word: lastWord,
      source: lastSource,
      reason,
    })
    window.setTimeout(() => completeLookupIfModalClosed(reason), getSuppressMs())
  }

  const isOpeningEvent = (event: Event): boolean => {
    if (Date.now() > openingEventUntil) return false
    if (!openingEventTarget || event.type !== 'click') return false

    return event.composedPath().includes(openingEventTarget)
  }

  const onDismissEvent = (event: Event) => {
    if (!isModalOpenNow()) return
    if (isOpeningEvent(event)) return

    if (event.type === 'pointerup') return
    if (event instanceof PointerEvent && event.button !== 0) return
    if (isEventInsideModal(event)) return

    releaseOutsideClickToEpic(event, `outside-modal-${event.type}`)
  }

  const modalStateCleanup = context.events.on('modalStateChange', updateModalOpen)
  if (modalRoot) {
    modalContentObserver = new MutationObserver(() => completeLookupIfModalClosed('modal-content-changed'))
    modalContentObserver.observe(modalRoot, {
      attributes: true,
      childList: true,
      subtree: true,
    })
  }
  document.addEventListener('pointerdown', onDismissEvent, true)
  document.addEventListener('pointerup', onDismissEvent, true)
  document.addEventListener('click', onDismissEvent, true)

  return {
    arm(word, source, event) {
      lastWord = word
      lastSource = source
      lookupArmedAt = Date.now()
      lookupClosedAt = 0
      modalOpenedAt = 0
      modalExpectedUntil = lookupArmedAt + getTtlMs()
      openingEventTarget = event?.target || null
      openingEventUntil = lookupArmedAt + getOpeningEventSuppressMs()
      lastReadAlongLookupPauseStatus = pauseEpicPlaybackForWordLookup(context, `word lookup opened: ${source}`)
      lastReadAlongLookupResumeStatus = null
      readAlongLookupPauseToken = Number(lastReadAlongLookupPauseStatus.token) || 0
      shouldResumeReadAlongAfterLookup = Boolean(lastReadAlongLookupPauseStatus.shouldResume)
      setPassthroughUntil(modalExpectedUntil)
      console.info('[1Tribe word lookup] Extension hit layers are in passthrough until Epic closes the lookup modal.', {
        word,
        source,
        modalExpectedUntil,
        openingEventUntil,
      })
    },
    cleanup() {
      modalStateCleanup()
      modalContentObserver?.disconnect()
      modalContentObserver = null
      clearPassthroughTimer()
      setGuardPassthroughMode(false, 'lookup guard cleanup')
      document.removeEventListener('pointerdown', onDismissEvent, true)
      document.removeEventListener('pointerup', onDismissEvent, true)
      document.removeEventListener('click', onDismissEvent, true)
    },
    getDebugState() {
      return {
        installed: true,
        armed: isModalOpenNow(),
        modalOpen: isModalOpenNow(),
        modalStateOpen: modalOpen,
        lookupModalExpected: isLookupModalExpected(),
        modalRootAvailable: Boolean(modalRoot),
        modalRootChildCount: modalRoot?.childElementCount || 0,
        lookupArmedAt,
        modalOpenedAt,
        modalExpectedUntil,
        openingEventUntil,
        passthroughActive: document.documentElement.classList.contains('tribe-word-lookup-passthrough'),
        passthroughUntil,
        dismissCount,
        lastWord,
        lastSource,
        lastDismissAt,
        lastDismissReason,
        lookupClosedAt,
        readAlongLookupPausePending: shouldResumeReadAlongAfterLookup,
        readAlongLookupPauseToken,
        lastReadAlongLookupPauseStatus,
        lastReadAlongLookupResumeStatus,
      }
    },
  }
}

function installWordLookupDismissGuard(context: ExtensionContext): () => void {
  if (!sharedWordLookupDismissGuard) {
    sharedWordLookupDismissGuard = createWordLookupDismissGuard(context)
  }
  sharedWordLookupDismissGuardRefs += 1

  return () => {
    sharedWordLookupDismissGuardRefs = Math.max(0, sharedWordLookupDismissGuardRefs - 1)
    if (sharedWordLookupDismissGuardRefs > 0) return

    sharedWordLookupDismissGuard?.cleanup()
    sharedWordLookupDismissGuard = null
  }
}

function armWordLookupDismissGuard(word: string, source: string, event?: Event): void {
  sharedWordLookupDismissGuard?.arm(word, source, event)
}

function getWordLookupDismissGuardDebugState(): Record<string, unknown> {
  return sharedWordLookupDismissGuard?.getDebugState() || {
    armed: false,
    installed: false,
  }
}

function getActiveWordHotspotPageAudit(
  activeWordHotspots: ActiveWordHotspot[] = [],
  buttons: HTMLButtonElement[] = [],
): Record<string, unknown> {
  const pageCounts: Record<string, number> = {}
  const sampleByPage: Record<string, Array<Record<string, unknown>>> = {}

  for (const hotspot of activeWordHotspots) {
    const pageKey = String(hotspot.page)
    pageCounts[pageKey] = (pageCounts[pageKey] || 0) + 1
    const pageSample = sampleByPage[pageKey] || []
    if (pageSample.length < 12) {
      pageSample.push({
        fileName: hotspot.fileName,
        height: Number(hotspot.height.toFixed(5)),
        reason: hotspot.reason,
        sourceWord: hotspot.sourceWord,
        width: Number(hotspot.width.toFixed(5)),
        word: hotspot.word,
        x: Number(hotspot.x.toFixed(5)),
        y: Number(hotspot.y.toFixed(5)),
      })
      sampleByPage[pageKey] = pageSample
    }
  }

  const buttonPageCounts: Record<string, number> = {}
  const buttonSampleByPage: Record<string, Array<Record<string, unknown>>> = {}
  let buttonsWithoutPage = 0
  for (const button of buttons) {
    const pageKey = button.dataset.hotspotPage || 'missing'
    buttonPageCounts[pageKey] = (buttonPageCounts[pageKey] || 0) + 1
    if (pageKey === 'missing') buttonsWithoutPage += 1

    const pageSample = buttonSampleByPage[pageKey] || []
    if (pageSample.length < 12) {
      pageSample.push({
        aliases: button.dataset.lookupAliases || null,
        lookupWord: button.dataset.lookupWord || null,
        sourceWord: button.dataset.sourceWord || null,
        spreadPage: button.dataset.hotspotSpreadPage || null,
        pages: button.dataset.hotspotPages || null,
      })
      buttonSampleByPage[pageKey] = pageSample
    }
  }

  return {
    activeCount: activeWordHotspots.length,
    buttonCount: buttons.length,
    buttonsWithoutPage,
    buttonPageCounts,
    buttonSampleByPage,
    pageCounts,
    sampleByPage,
  }
}

function getSmallestActiveWordHotspotAtPoint(
  activeWordHotspots: ActiveWordHotspot[],
  x: number,
  y: number,
): ActiveWordHotspot | null {
  let bestHotspot: ActiveWordHotspot | null = null
  let bestArea = Number.POSITIVE_INFINITY

  for (const hotspot of activeWordHotspots) {
    if (x < hotspot.x || x > hotspot.x + hotspot.width || y < hotspot.y || y > hotspot.y + hotspot.height) {
      continue
    }

    const area = hotspot.width * hotspot.height
    if (area < bestArea) {
      bestArea = area
      bestHotspot = hotspot
    }
  }

  return bestHotspot
}

function getDebugWordHotspotButtons(context: ExtensionContext): HTMLButtonElement[] {
  const readingRoot = context.slots.get('reading-area')
  const roots: Array<Document | ShadowRoot> = readingRoot ? [readingRoot, document] : [document]
  const seen = new Set<HTMLButtonElement>()
  const buttons: HTMLButtonElement[] = []

  for (const root of roots) {
    for (const button of Array.from(
      root.querySelectorAll<HTMLButtonElement>('.tribe-word-hotspot-button, .tribe-standalone-word-hotspot-button'),
    )) {
      if (seen.has(button)) continue
      seen.add(button)
      buttons.push(button)
    }
  }

  return buttons
}

function getDebugEpicTribeBookConfig(context: ExtensionContext): EpicTribeBookConfig | null {
  const requestedBookId = Number(getStringParam('tribeCommandHarnessBookId'))
  return (
    getEpicTribeBookConfig(Number.isFinite(requestedBookId) ? requestedBookId : null) ||
    getEpicTribeBookConfig(context.data.getBookId()) ||
    getEpicTribeBookConfig()
  )
}

function getPreviewFilePages(file: CommandHarnessPreviewFile): number[] {
  const start = Math.trunc(Number(file.readerStart))
  const end = Math.trunc(Number(file.readerEnd))
  if (!Number.isFinite(start) || !Number.isFinite(end)) return []

  const first = Math.min(start, end)
  const last = Math.max(start, end)
  return Array.from({ length: last - first + 1 }, (_item, index) => first + index)
}

function getExactPreviewFilesForPage(
  previewFiles: CommandHarnessPreviewFile[],
  page: number,
): Array<CommandHarnessPreviewFile & { index: number }> {
  return previewFiles
    .map((file, index) => ({ ...file, index }))
    .filter((file) => page >= file.readerStart && page <= file.readerEnd)
}

function getFallbackPreviewFileForPage(
  previewFiles: CommandHarnessPreviewFile[],
  page: number,
): (CommandHarnessPreviewFile & { index: number }) | null {
  const exactMatches = getExactPreviewFilesForPage(previewFiles, page)
  if (exactMatches.length) return exactMatches[0]
  if (!previewFiles.length) return null

  const firstFile = previewFiles[0]
  if (page < firstFile.readerStart) return { ...firstFile, index: 0 }

  let fallbackIndex = -1
  previewFiles.forEach((file, index) => {
    if (page >= file.readerStart) fallbackIndex = index
  })
  if (fallbackIndex < 0) return null

  return { ...previewFiles[fallbackIndex], index: fallbackIndex }
}

async function checkEpicPageLayout(
  context: ExtensionContext,
  startPage?: number,
  endPage?: number,
): Promise<Record<string, unknown>> {
  const bookData = context.data.getBookData()
  const bookId = context.data.getBookId()
  const currentPage = context.data.getCurrentPage()
  const activeBookConfig = getDebugEpicTribeBookConfig(context)
  const previewFiles = activeBookConfig?.previewFiles || []
  const pageCount = Number(bookData?.numPages)
  const configuredMaxPage = previewFiles.reduce(
    (maxPage, file) => Math.max(maxPage, Number(file.readerEnd), Number(file.readerStart)),
    0,
  )
  const maxBookPage =
    Number.isFinite(pageCount) && pageCount > 0 ? Math.max(0, Math.trunc(pageCount) - 1) : configuredMaxPage
  const layoutMaxPage = Math.max(maxBookPage, configuredMaxPage)
  const requestedStart = Number(startPage)
  const requestedEnd = Number(endPage)
  const rawStart = Number.isFinite(requestedStart) ? Math.trunc(requestedStart) : 0
  const rawEnd = Number.isFinite(requestedEnd) ? Math.trunc(requestedEnd) : layoutMaxPage
  const probeStart = Math.max(0, Math.min(rawStart, rawEnd, layoutMaxPage))
  const probeEnd = Math.max(0, Math.min(Math.max(rawStart, rawEnd), layoutMaxPage))

  const coverage = new Map<number, Array<CommandHarnessPreviewFile & { index: number }>>()
  previewFiles.forEach((file, index) => {
    for (const page of getPreviewFilePages(file)) {
      const pageFiles = coverage.get(page) || []
      pageFiles.push({ ...file, index })
      coverage.set(page, pageFiles)
    }
  })
  const debugWindow = window as TribeDebugWindow
  const activeHotspotAudit = getActiveWordHotspotPageAudit(
    debugWindow.tribeWordHotspots || [],
    getDebugWordHotspotButtons(context),
  )
  const activeHotspotPageCounts =
    activeHotspotAudit.pageCounts && typeof activeHotspotAudit.pageCounts === 'object'
      ? (activeHotspotAudit.pageCounts as Record<string, number>)
      : {}
  const activeHotspotSamplesByPage =
    activeHotspotAudit.sampleByPage && typeof activeHotspotAudit.sampleByPage === 'object'
      ? (activeHotspotAudit.sampleByPage as Record<string, Array<Record<string, unknown>>>)
      : {}

  const gaps: number[] = []
  const overlaps: Array<{ files: string[]; page: number }> = []
  for (let page = 0; page <= layoutMaxPage; page += 1) {
    const pageFiles = coverage.get(page) || []
    if (!pageFiles.length) gaps.push(page)
    if (pageFiles.length > 1) {
      overlaps.push({
        page,
        files: pageFiles.map((file) => file.file),
      })
    }
  }

  const rangeIssues = previewFiles.flatMap((file, index) => {
    const previous = previewFiles[index - 1]
    if (!previous) return []

    if (file.readerStart > previous.readerEnd + 1) {
      return [
        {
          issue: 'gap-between-files',
          previousFile: previous.file,
          previousReaderEnd: previous.readerEnd,
          file: file.file,
          readerStart: file.readerStart,
          missingPages: getPreviewFilePages({
            ...file,
            readerStart: previous.readerEnd + 1,
            readerEnd: file.readerStart - 1,
          }),
        },
      ]
    }

    if (file.readerStart <= previous.readerEnd) {
      return [
        {
          issue: 'overlap-between-files',
          previousFile: previous.file,
          previousReaderEnd: previous.readerEnd,
          file: file.file,
          readerStart: file.readerStart,
        },
      ]
    }

    return []
  })

  const pageProbes: Array<Record<string, unknown>> = []
  for (let page = probeStart; page <= probeEnd; page += 1) {
    const exactFiles = getExactPreviewFilesForPage(previewFiles, page)
    const fallbackFile = getFallbackPreviewFileForPage(previewFiles, page)
    const audioUrl =
      typeof context.data.getPageAudioUrl === 'function' ? context.data.getPageAudioUrl(page) || null : null
    let timingWordCount: number | null = null
    let timingFirstWords: string[] = []
    let timingError: string | null = null

    if (typeof context.data.getWordTimingData === 'function') {
      try {
        const wordData = await context.data.getWordTimingData(page)
        const wordRows = Array.isArray(wordData?.word_data) ? wordData.word_data : []
        timingWordCount = wordRows.length
        timingFirstWords = wordRows
          .slice(0, 8)
          .map((word) => String(word.text || word.word || '').trim())
          .filter(Boolean)
      } catch (error) {
        timingError = String(error)
      }
    }

    pageProbes.push({
      page,
      parity: page % 2 === 0 ? 'even' : 'odd',
      activeHotspotCount: activeHotspotPageCounts[String(page)] || 0,
      activeHotspotFirstWords: (activeHotspotSamplesByPage[String(page)] || [])
        .map((item) => String(item.word || ''))
        .filter(Boolean)
        .slice(0, 8),
      exactFileCount: exactFiles.length,
      expectedFile: exactFiles[0]?.file || null,
      expectedIndex: exactFiles[0]?.index ?? null,
      expectedLabel: exactFiles[0]?.label || null,
      expectedReaderRange: exactFiles[0] ? [exactFiles[0].readerStart, exactFiles[0].readerEnd] : null,
      fallbackFile: fallbackFile?.file || null,
      fallbackIndex: fallbackFile?.index ?? null,
      hasAudio: Boolean(audioUrl),
      audioUrl,
      timingWordCount,
      timingFirstWords,
      timingError,
      issue: !exactFiles.length
        ? 'unmapped-page'
        : exactFiles.length > 1
          ? 'overlapped-page'
          : timingError
            ? 'timing-error'
            : null,
    })
  }

  const pagesWithAudio = pageProbes
    .filter((probe) => Boolean(probe.hasAudio))
    .map((probe) => Number(probe.page))
    .filter((page) => Number.isFinite(page))
  const pagesWithTiming = pageProbes
    .filter((probe) => Number(probe.timingWordCount) > 0)
    .map((probe) => Number(probe.page))
    .filter((page) => Number.isFinite(page))
  const mappedPagesMissingTiming = pageProbes
    .filter((probe) => probe.expectedFile && !(Number(probe.timingWordCount) > 0))
    .map((probe) => Number(probe.page))
    .filter((page) => Number.isFinite(page))
  const unmappedPagesWithTiming = pageProbes
    .filter((probe) => !probe.expectedFile && Number(probe.timingWordCount) > 0)
    .map((probe) => Number(probe.page))
    .filter((page) => Number.isFinite(page))
  const summaryRows = pageProbes.map((probe) => {
    const page = String(probe.page).padStart(2, '0')
    const timingWordCount = Number(probe.timingWordCount)
    const timingText = Number.isFinite(timingWordCount) ? String(timingWordCount).padStart(3, ' ') : '  ?'
    const firstWords = Array.isArray(probe.timingFirstWords)
      ? probe.timingFirstWords.filter(Boolean).slice(0, 6).join(' ')
      : ''
    return [
      `p${page}`,
      `${probe.parity}`,
      `file=${probe.expectedFile || 'UNMAPPED'}`,
      `range=${Array.isArray(probe.expectedReaderRange) ? probe.expectedReaderRange.join('-') : '-'}`,
      `audio=${probe.hasAudio ? 'Y' : 'N'}`,
      `timing=${timingText}`,
      `hotspots=${probe.activeHotspotCount ?? 0}`,
      firstWords ? `words="${firstWords}"` : '',
      probe.issue ? `issue=${probe.issue}` : '',
    ]
      .filter(Boolean)
      .join(' | ')
  })
  const summaryText = [
    `1Tribe page layout audit for book ${bookId ?? 'unknown'} (${activeBookConfig?.title || bookData?.title || 'untitled'})`,
    `currentPage=${currentPage}; configuredFiles=${previewFiles.length}; probeRange=${probeStart}-${probeEnd}`,
    `gaps=${gaps.length ? gaps.join(',') : 'none'}`,
    `overlaps=${overlaps.length ? overlaps.map((overlap) => overlap.page).join(',') : 'none'}`,
    `pagesWithAudio=${pagesWithAudio.length ? pagesWithAudio.join(',') : 'none'}`,
    `pagesWithTiming=${pagesWithTiming.length ? pagesWithTiming.join(',') : 'none'}`,
    `mappedPagesMissingTiming=${mappedPagesMissingTiming.length ? mappedPagesMissingTiming.join(',') : 'none'}`,
    `unmappedPagesWithTiming=${unmappedPagesWithTiming.length ? unmappedPagesWithTiming.join(',') : 'none'}`,
    '',
    ...summaryRows,
  ].join('\n')

  const currentExactFiles = getExactPreviewFilesForPage(previewFiles, currentPage)
  const currentFallbackFile = getFallbackPreviewFileForPage(previewFiles, currentPage)
  const report = {
    activeBookConfig: activeBookConfig
      ? {
          bookId: activeBookConfig.bookId,
          title: activeBookConfig.title,
          riveFolder: activeBookConfig.riveFolder,
          wordHotspotFolder: activeBookConfig.wordHotspotFolder,
        }
      : null,
    bookData: {
      id: bookData?.id,
      title: bookData?.title,
      numPages: Number.isFinite(pageCount) ? Math.trunc(pageCount) : null,
      aspectRatio: bookData?.aspectRatio ?? null,
    },
    bookId,
    currentPage,
    currentMapping: {
      exactFiles: currentExactFiles.map((file) => ({
        file: file.file,
        index: file.index,
        label: file.label,
        readerRange: [file.readerStart, file.readerEnd],
        stateMachine: file.stateMachine,
      })),
      fallbackFile: currentFallbackFile
        ? {
            file: currentFallbackFile.file,
            index: currentFallbackFile.index,
            label: currentFallbackFile.label,
            readerRange: [currentFallbackFile.readerStart, currentFallbackFile.readerEnd],
            stateMachine: currentFallbackFile.stateMachine,
          }
        : null,
    },
    activeHotspotAudit,
    gaps,
    mappedPagesMissingTiming,
    overlaps,
    pageProbes,
    pagesWithAudio,
    pagesWithTiming,
    probeRange: [probeStart, probeEnd],
    rangeIssues,
    scriptUrl: extensionScriptUrl,
    summaryRows,
    summaryText,
    unmappedPagesWithTiming,
    pageUrl: window.location.href,
    previewFiles: previewFiles.map((file, index) => ({
      file: file.file,
      index,
      label: file.label,
      pages: getPreviewFilePages(file),
      readerEnd: file.readerEnd,
      readerStart: file.readerStart,
      stateMachine: file.stateMachine,
    })),
  }

  console.info('[1Tribe page layout] Epic/Rive page layout audit.', report)
  console.info(summaryText)
  console.table(pageProbes)
  return report
}

function isLocalDebugExtensionScript(): boolean {
  try {
    const url = new URL(extensionScriptUrl, window.location.href)
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  } catch {
    return false
  }
}

function shouldExposeDebugGlobals(): boolean {
  // Production builds only expose console helpers when an explicit debug flag is present.
  // The localhost exception keeps QA/dev bundles usable without shipping globals by default.
  return getBooleanParam('tribeDebugCommands', false) || getBooleanParam('tribeDebug', false) || isLocalDebugExtensionScript()
}

function installDebugCommands(context: ExtensionContext): () => void {
  if (!shouldExposeDebugGlobals()) return () => {}

  const debugWindow = window as TribeDebugWindow
  const debugApi: TribeDebugApi = {
    lookupWord(value: string) {
      const word = cleanLookupWord(value)
      if (!word) {
        console.info('[1Tribe debug] lookupWord ignored empty word.', value)
        return false
      }

      armWordLookupDismissGuard(word, 'debug-console-helper')
      context.commands.execute('lookup_word', word)
      context.analytics.log('1tribe_debug_lookup_word', {
        bookId: context.data.getBookId(),
        page: context.data.getCurrentPage(),
        word,
      })
      console.info(`[1Tribe debug] lookup_word: ${word}`)
      return true
    },
  }

  debugWindow.TribeDebug = debugApi
  debugWindow.tribeLookupWord = debugApi.lookupWord
  debugWindow.tribeCloseModal = () => {
    try {
      context.commands.execute('closeModal')
      console.info('[1Tribe debug] closeModal')
      return true
    } catch (error) {
      console.warn(`[1Tribe debug] closeModal failed: ${String(error)}`)
      return false
    }
  }
  debugWindow.tribeArmWordLookupDismiss = (word = 'debug') => {
    armWordLookupDismissGuard(word, 'debug-manual-arm')
    return true
  }
  debugWindow.tribeNextPage = () => {
    context.commands.execute('nextPage')
    console.info('[1Tribe debug] nextPage')
    return true
  }
  debugWindow.tribePreviousPage = () => {
    context.commands.execute('previousPage')
    console.info('[1Tribe debug] previousPage')
    return true
  }
  debugWindow.tribeWordHotspots = debugWindow.tribeWordHotspots || []
  resetReadAlongDebugState(context)

  const readAlongTimingProbe = (page?: number) => probeReadAlongTimingData(context, page)
  const readAlongAudioProbe = (page?: number) => probeReadAlongAudio(context, page)
  const readAlongAudioUrlProbe = (page?: number) => probeReadAlongAudioUrl(context, page)
  const readAlongAudioAlignmentProbe = (page?: number) => probeReadAlongAudioAlignment(context, page)
  const readAlongTranscriptExport = (startPage?: number, endPage?: number) =>
    exportReadAlongTranscript(context, startPage, endPage)
  const readAlongWordAudit = async (startPage?: number, endPage?: number) => {
    const result = await auditReadAlongWords(context, startPage, endPage)
    const audit = result.audit && typeof result.audit === 'object' ? (result.audit as Record<string, unknown>) : null
    const summaryRowsValue = audit?.summaryRows
    const summaryRows = Array.isArray(summaryRowsValue) ? summaryRowsValue : []

    console.info('[1Tribe read-along] Native transcript and callable word audit.', result)
    if (summaryRows.length) console.table(summaryRows)

    return result
  }
  const readAlongTimePreview = (time?: number, page?: number) => previewReadAlongAtTime(context, time, page)
  const readAlongPlaybackStart = (page?: number) => startReadAlongPlayback(context, page)
  const readAlongPlaybackPause = () => pauseReadAlongPlayback()
  const readAlongPlaybackStop = () => stopReadAlongPlayback()
  const epicPlaybackProbe = () => probeEpicPlaybackState(context)
  const epicPlaybackFollowStart = (page?: number) => startFollowingEpicPlayback(context, page)
  const epicPlaybackFollowStop = () => stopFollowingEpicPlayback()
  const readAlongStatusTracker = () => getReadAlongDebugStatus(context, extensionScriptUrl)
  const epicPageLayoutCheck = (startPage?: number, endPage?: number) =>
    checkEpicPageLayout(context, startPage, endPage)
  const activeHotspotPageAudit = () =>
    getActiveWordHotspotPageAudit(debugWindow.tribeWordHotspots || [], getDebugWordHotspotButtons(context))

  const fallbackClickWordHotspot = (word = '') => {
    console.warn('[1Tribe debug] No active word hotspots are registered yet.', {
      requestedWord: word,
      pageUrl: window.location.href,
      scriptUrl: extensionScriptUrl,
    })
    return false
  }
  const fallbackForceWordHotspotPage = (page = 4) => {
    console.warn('[1Tribe debug] The word hotspot layer is not active, so no page can be forced yet.', {
      requestedPage: page,
      pageUrl: window.location.href,
      scriptUrl: extensionScriptUrl,
    })
    return false
  }
  const fallbackWordHotspotDebug = () => ({
    enabled: false,
    mode: 'debug-fallback',
    message:
      'No word hotspot layer is active on this page. Add tribeWordHotspotTest=1&tribeStandaloneWordHotspots=1 to enable the standalone hotspot test layer.',
    activeCount: debugWindow.tribeWordHotspots?.length || 0,
    currentPage: context.data.getCurrentPage(),
    pageUrl: window.location.href,
    scriptUrl: extensionScriptUrl,
    pageAudit: activeHotspotPageAudit(),
    simpleRiveOverlay: getBooleanParam('simpleRiveOverlay', false),
    standaloneWordHotspots: shouldUseStandaloneWordHotspots(),
    wordHotspotTest: getBooleanParam('tribeWordHotspotTest', false),
    riveFolder: getStringParam('riveFolder'),
    riveWordHotspots: getBooleanParam('riveWordHotspots', false) || getBooleanParam('wordHotspots', false),
  })

  debugWindow.tribeClickWordHotspot = debugWindow.tribeClickWordHotspot || fallbackClickWordHotspot
  debugWindow.tribeActiveHotspotPageAudit =
    debugWindow.tribeActiveHotspotPageAudit || activeHotspotPageAudit
  debugWindow.tribeForceWordHotspotPage =
    debugWindow.tribeForceWordHotspotPage || fallbackForceWordHotspotPage
  debugWindow.tribeWordHotspotDebug = debugWindow.tribeWordHotspotDebug || fallbackWordHotspotDebug
  debugWindow.tribeProbeReadAlongAudio = debugWindow.tribeProbeReadAlongAudio || readAlongAudioProbe
  debugWindow.tribeProbeReadAlongAudioAlignment =
    debugWindow.tribeProbeReadAlongAudioAlignment || readAlongAudioAlignmentProbe
  debugWindow.tribeProbeReadAlongAudioUrl =
    debugWindow.tribeProbeReadAlongAudioUrl || readAlongAudioUrlProbe
  debugWindow.tribeProbeReadAlongTimings = debugWindow.tribeProbeReadAlongTimings || readAlongTimingProbe
  debugWindow.tribeAuditReadAlongWords =
    debugWindow.tribeAuditReadAlongWords || readAlongWordAudit
  debugWindow.tribeExportReadAlongTranscript =
    debugWindow.tribeExportReadAlongTranscript || readAlongTranscriptExport
  debugWindow.tribeExportFullReadAlongTranscript =
    debugWindow.tribeExportFullReadAlongTranscript || readAlongTranscriptExport
  debugWindow.tribePreviewReadAlongAtTime =
    debugWindow.tribePreviewReadAlongAtTime || readAlongTimePreview
  debugWindow.tribeStartReadAlongAudio = debugWindow.tribeStartReadAlongAudio || readAlongPlaybackStart
  debugWindow.tribePauseReadAlongAudio = debugWindow.tribePauseReadAlongAudio || readAlongPlaybackPause
  debugWindow.tribeStopReadAlongAudio = debugWindow.tribeStopReadAlongAudio || readAlongPlaybackStop
  debugWindow.tribeProbeEpicPlayback = debugWindow.tribeProbeEpicPlayback || epicPlaybackProbe
  debugWindow.tribeStartEpicPlaybackFollow =
    debugWindow.tribeStartEpicPlaybackFollow || epicPlaybackFollowStart
  debugWindow.tribeStopEpicPlaybackFollow =
    debugWindow.tribeStopEpicPlaybackFollow || epicPlaybackFollowStop
  debugWindow.tribeReadAlongStatus = debugWindow.tribeReadAlongStatus || readAlongStatusTracker
  debugWindow.tribeCheckEpicPageLayout = debugWindow.tribeCheckEpicPageLayout || epicPageLayoutCheck
  debugWindow.tribeDebugStatus = () => ({
    bookId: context.data.getBookId(),
    currentPage: context.data.getCurrentPage(),
    pageUrl: window.location.href,
    scriptUrl: extensionScriptUrl,
    simpleRiveOverlay: getBooleanParam('simpleRiveOverlay', false),
    wordHotspotTest: getBooleanParam('tribeWordHotspotTest', false),
    riveFolder: getStringParam('riveFolder'),
    riveWordHotspots: getBooleanParam('riveWordHotspots', false) || getBooleanParam('wordHotspots', false),
    activeWordHotspots: debugWindow.tribeWordHotspots?.length || 0,
    activeHotspotPageAudit: debugWindow.tribeActiveHotspotPageAudit?.(),
    readAlong: debugWindow.tribeReadAlongStatus?.(),
    wordLookupDismissGuard: getWordLookupDismissGuardDebugState(),
  })
  console.info(
    '[1Tribe debug] Console helpers enabled: tribeLookupWord("doorbell"), tribeNextPage(), tribePreviousPage(), tribeWordHotspotDebug(), tribeActiveHotspotPageAudit(), tribeCheckEpicPageLayout(), tribeProbeReadAlongTimings(), tribeExportFullReadAlongTranscript(), tribeAuditReadAlongWords(), tribeProbeEpicPlayback(), tribeStartEpicPlaybackFollow(), tribeStopEpicPlaybackFollow(), tribeReadAlongStatus(), tribeDebugStatus()',
  )
  return () => {
    if (debugWindow.TribeDebug === debugApi) {
      delete debugWindow.TribeDebug
    }
    if (debugWindow.tribeLookupWord === debugApi.lookupWord) {
      delete debugWindow.tribeLookupWord
    }
    delete debugWindow.tribeCloseModal
    delete debugWindow.tribeArmWordLookupDismiss
    delete debugWindow.tribeNextPage
    delete debugWindow.tribePreviousPage
    if (debugWindow.tribeClickWordHotspot === fallbackClickWordHotspot) {
      delete debugWindow.tribeClickWordHotspot
    }
    if (debugWindow.tribeActiveHotspotPageAudit === activeHotspotPageAudit) {
      delete debugWindow.tribeActiveHotspotPageAudit
    }
    if (debugWindow.tribeForceWordHotspotPage === fallbackForceWordHotspotPage) {
      delete debugWindow.tribeForceWordHotspotPage
    }
    if (debugWindow.tribeWordHotspotDebug === fallbackWordHotspotDebug) {
      delete debugWindow.tribeWordHotspotDebug
    }
    if (debugWindow.tribeProbeReadAlongAudio === readAlongAudioProbe) {
      delete debugWindow.tribeProbeReadAlongAudio
    }
    if (debugWindow.tribeProbeReadAlongAudioAlignment === readAlongAudioAlignmentProbe) {
      delete debugWindow.tribeProbeReadAlongAudioAlignment
    }
    if (debugWindow.tribeProbeReadAlongAudioUrl === readAlongAudioUrlProbe) {
      delete debugWindow.tribeProbeReadAlongAudioUrl
    }
    if (debugWindow.tribeProbeReadAlongTimings === readAlongTimingProbe) {
      delete debugWindow.tribeProbeReadAlongTimings
    }
    if (debugWindow.tribeAuditReadAlongWords === readAlongWordAudit) {
      delete debugWindow.tribeAuditReadAlongWords
    }
    if (debugWindow.tribeExportReadAlongTranscript === readAlongTranscriptExport) {
      delete debugWindow.tribeExportReadAlongTranscript
    }
    if (debugWindow.tribeExportFullReadAlongTranscript === readAlongTranscriptExport) {
      delete debugWindow.tribeExportFullReadAlongTranscript
    }
    if (debugWindow.tribePreviewReadAlongAtTime === readAlongTimePreview) {
      delete debugWindow.tribePreviewReadAlongAtTime
    }
    if (debugWindow.tribeStartReadAlongAudio === readAlongPlaybackStart) {
      delete debugWindow.tribeStartReadAlongAudio
    }
    if (debugWindow.tribePauseReadAlongAudio === readAlongPlaybackPause) {
      delete debugWindow.tribePauseReadAlongAudio
    }
    if (debugWindow.tribeStopReadAlongAudio === readAlongPlaybackStop) {
      delete debugWindow.tribeStopReadAlongAudio
    }
    if (debugWindow.tribeProbeEpicPlayback === epicPlaybackProbe) {
      delete debugWindow.tribeProbeEpicPlayback
    }
    if (debugWindow.tribeStartEpicPlaybackFollow === epicPlaybackFollowStart) {
      delete debugWindow.tribeStartEpicPlaybackFollow
    }
    if (debugWindow.tribeStopEpicPlaybackFollow === epicPlaybackFollowStop) {
      delete debugWindow.tribeStopEpicPlaybackFollow
    }
    if (debugWindow.tribeReadAlongStatus === readAlongStatusTracker) {
      delete debugWindow.tribeReadAlongStatus
    }
    if (debugWindow.tribeCheckEpicPageLayout === epicPageLayoutCheck) {
      delete debugWindow.tribeCheckEpicPageLayout
    }
    cleanupReadAlongDebugState()
    delete debugWindow.tribeDebugStatus
  }
}

function installReadAlongPlaybackFollow(context: ExtensionContext): () => void {
  if (!shouldUseReadAlong()) return () => {}

  void ensureEpicPlaybackFollowForCurrentPage(context, 'initial follow')

  const cleanupPageChange = context.events.on('pageChange', () => {
    if (shouldUseReadAlong()) {
      void ensureEpicPlaybackFollowForCurrentPage(context, 'pageChange')
    }
  })

  return () => {
    cleanupPageChange()
    stopFollowingEpicPlayback()
    cleanupReadAlongDebugState()
  }
}

function getCssPropertyParam(name: string, property: string): string | null {
  const value = getStringParam(name)?.trim()
  if (!value) return null

  return window.CSS?.supports?.(property, value) ? value : null
}

function getCssBackgroundParam(name: string, fallback: string): string {
  return getCssPropertyParam(name, 'background') || fallback
}

const disableRiveRuntime = getBooleanParam('disableRive', false)

function shouldUseSimpleRiveOverlay(): boolean {
  const explicitValue = getStringParam('simpleRiveOverlay')
  if (explicitValue !== null) {
    return explicitValue === '1' || explicitValue === 'true'
  }

  return false
}

function shouldUseStandaloneWordHotspots(): boolean {
  const explicitValue = getStringParam('tribeStandaloneWordHotspots')
  if (explicitValue !== null) {
    return explicitValue === '1' || explicitValue === 'true'
  }

  if (getBooleanParam('tribeWordHotspotTest', false)) return true

  const folder = (getStringParam('riveWordHotspotFolder') || getStringParam('riveFolder') || '').trim()
  return isLocalDebugExtensionScript() && ['Test_June2_4-5', ...getSupportedTribeRiveFolders()].includes(folder)
}

function getRuntimeConfig(): RiveRuntimeConfig {
  const requestedSet = getStringParam('riveSet')
  const forcedFile = getStringParam('riveFile')?.trim()
  const isSampleSet = requestedSet === 'sample'
  const spreads = forcedFile
    ? [
        {
          pages: [1, Number.MAX_SAFE_INTEGER] as [number, number],
          file: forcedFile,
          label: getStringParam('riveLabel')?.trim() || forcedFile,
        },
      ]
    : isSampleSet
      ? SAMPLE_SPREADS
      : TRIBE_SPREADS

  return {
    autoBind: getBooleanParam('riveAutoBind', true),
    autoStateMachine: getBooleanParam('riveAutoStateMachine', false),
    autoplay: getBooleanParam('riveAutoplay', isSampleSet),
    disableListeners: !getBooleanParam('riveListeners', false),
    load: getBooleanParam('riveLoad', isSampleSet || Boolean(forcedFile)),
    maxCanvasPixels: getNumberParam('riveMaxPixels', isSampleSet ? 2_000_000 : 900_000),
    pixelRatio: getNumberParam('riveDpr', isSampleSet ? window.devicePixelRatio || 1 : 1),
    preventDefaultAnimation: getBooleanParam('rivePreventDefaultAnimation', !isSampleSet),
    useOffscreenRenderer: getBooleanParam('riveOffscreen', false),
    spreads,
  }
}

function suppressStaticPreviewWarning(): () => void {
  const originalError: typeof console.error = console.error
  const patchedError: typeof console.error = (...args: Parameters<typeof console.error>) => {
    if (
      typeof args[0] === 'string' &&
      args[0] === `Animation with name ${STATIC_PREVIEW_ANIMATION} not found.`
    ) {
      return
    }

    originalError(...args)
  }

  console.error = patchedError

  return () => {
    if (console.error === patchedError) {
      console.error = originalError
    }
  }
}

const runtimeConfig = getRuntimeConfig()
const SPREADS = runtimeConfig.spreads

RuntimeLoader.setWasmUrl(RIVE_WASM_SOURCE)
RuntimeLoader.setWasmFallbackUrl(RIVE_WASM_FALLBACK_SOURCE)






function injectStyle(root: ShadowRoot, css: string, id: string): HTMLStyleElement {
  const existing = root.getElementById(id)
  if (existing instanceof HTMLStyleElement) {
    return existing
  }

  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  root.prepend(style)
  return style
}

function activateCommandHarness(context: ExtensionContext): () => void {
  const readingRoot = context.slots.get('reading-area')
  const requestedBookId = Number(getStringParam('tribeCommandHarnessBookId'))
  const activeBookConfig =
    getEpicTribeBookConfig(Number.isFinite(requestedBookId) ? requestedBookId : null) ||
    getEpicTribeBookConfig(context.data.getBookId()) ||
    getEpicTribeBookConfig()
  if (!activeBookConfig) {
    console.warn('[1Tribe reader integration] No configured book integration is available for this Epic book.', {
      bookId: context.data.getBookId(),
      pageUrl: window.location.href,
    })
    return () => {}
  }

  injectStyle(readingRoot, commandHarnessStyles, 'tribe-command-harness-styles')

  const root = document.createElement('div')
  const title = document.createElement('p')
  const controls = document.createElement('div')
  const backButton = document.createElement('button')
  const nextButton = document.createElement('button')
  const previewStage = document.createElement('div')
  const previewCanvas = document.createElement('canvas')
  const previewCanvasAlt = document.createElement('canvas')
  const previewCanvasPreload = document.createElement('canvas')
  const edgeBackGutter = document.createElement('button')
  const edgeNextGutter = document.createElement('button')
  const previewLoading = document.createElement('div')
  const previewLoadingSpinner = document.createElement('span')
  const previewLoadingText = document.createElement('span')
  const previewDebugBadge = document.createElement('div')
  const previewStatus = document.createElement('p')
  const status = document.createElement('p')
  let previewRive: Rive | null = null
  let previewStateMachine: string | null = null
  let previewLoadSerial = 0
  let previewLoadingFadeTimer: number | null = null
  let previewSwapHoldUntil = 0
  let pendingPreviewSwapTimer: number | null = null
  const shouldUseTakeover = getBooleanParam('tribeCommandHarnessTakeover', false)
  const isPreviewEnabled = shouldUseTakeover || getBooleanParam('tribeCommandHarnessRive', false)
  const shouldUseOwnBookFrame =
    isPreviewEnabled && getBooleanParam('tribeCommandHarnessUseOwnBookFrame', false)
  const shouldFitToEpicBookFrame =
    isPreviewEnabled && !shouldUseOwnBookFrame && getBooleanParam('tribeCommandHarnessUseEpicBookFrame', false)
  const shouldUsePageEdgeFrame =
    isPreviewEnabled && getBooleanParam('tribeCommandHarnessUsePageEdgeFrame', false)
  const ownBookFrameBorder = getCssPropertyParam('tribeCommandHarnessBookFrameBorder', 'border')
  const ownBookFrameShadow = getCssPropertyParam('tribeCommandHarnessBookFrameShadow', 'box-shadow')
  const ownBookFrameAspectParam = getStringParam('tribeCommandHarnessOwnBookFrameAspect')
  const ownBookFrameAspect = ownBookFrameAspectParam === null ? null : getNumberParam('tribeCommandHarnessOwnBookFrameAspect', 1216 / 837)
  const requestedEpicBookFrameInsetPx = Number(getStringParam('tribeCommandHarnessEpicBookFrameInsetPx'))
  const epicBookFrameInsetPx = Number.isFinite(requestedEpicBookFrameInsetPx)
    ? Math.max(0, requestedEpicBookFrameInsetPx)
    : 1
  const isEpicDebugSkipPageRenderEnabled = window.localStorage.getItem('epic_debug_skip_page_render') === '1'
  const shouldUseEpicNativeShell =
    shouldFitToEpicBookFrame &&
    getBooleanParam('tribeCommandHarnessUseEpicNativeShell', isEpicDebugSkipPageRenderEnabled)
  const shouldPreloadForwardNeighbor =
    isPreviewEnabled && getBooleanParam('tribeCommandHarnessForwardPreload', false)
  const shouldPlayPreviewPageIn = getBooleanParam('tribeCommandHarnessPageIn', isPreviewEnabled)
  const previewPageInAnimation = getStringParam('tribeCommandHarnessPageInAnimation') || 'Page_in'
  const shouldPlayPreviewPageOut = getBooleanParam('tribeCommandHarnessPageOut', isPreviewEnabled)
  const previewPageOutAnimation = getStringParam('tribeCommandHarnessPageOutAnimation') || 'Page_next'
  const shouldPlayPreviewPageBack = getBooleanParam('tribeCommandHarnessPageBack', isPreviewEnabled)
  const previewPageBackAnimation = getStringParam('tribeCommandHarnessPageBackAnimation') || 'Page_go back'
  const previewBackIdleAnimation = getStringParam('tribeCommandHarnessBackIdleAnimation') || 'Page_idle'
  const getCommandHarnessPreviewFit = (value: string | null): Fit => {
    switch ((value || '').trim().toLowerCase()) {
      case 'cover':
        return Fit.Cover
      case 'fill':
        return Fit.Fill
      case 'fitheight':
      case 'fit-height':
      case 'fit_height':
        return Fit.FitHeight
      case 'fitwidth':
      case 'fit-width':
      case 'fit_width':
        return Fit.FitWidth
      case 'none':
        return Fit.None
      case 'scaledown':
      case 'scale-down':
      case 'scale_down':
        return Fit.ScaleDown
      case 'contain':
      default:
        return Fit.Contain
    }
  }
  let previewFit = getCommandHarnessPreviewFit(getStringParam('tribeCommandHarnessPreviewFit'))
  const shouldKeepSpread02OnPageIn = getBooleanParam('tribeCommandHarnessSpread02StayOnPageIn', false)
  const shouldRunPreviewIdleAfterPageInAllSpreads = getBooleanParam('tribeCommandHarnessIdleAfterPageIn', false)
  const shouldResumeStateMachineAfterPageIdle = getBooleanParam(
    'tribeCommandHarnessResumeStateMachineAfterIdle',
    false,
  )
  const shouldRunSpread02IdleAfterPageIn = getBooleanParam('tribeCommandHarnessSpread02IdleAfterPageIn', false)
  const previewAnimationHoldMs = Math.max(2200, getNumberParam('tribeCommandHarnessAnimationHoldMs', 2600))
  const previewIdleAfterPageInFallbackMs = Math.max(
    0,
    getNumberParam(
      'tribeCommandHarnessIdleAfterPageInFallbackMs',
      getNumberParam('tribeCommandHarnessSpread02IdleAfterPageInFallbackMs', previewAnimationHoldMs),
    ),
  )
  const previewStateMachineAfterPageIdleMs = Math.max(
    0,
    getNumberParam('tribeCommandHarnessResumeStateMachineAfterIdleMs', 120),
  )
  const previewInputResetMs = getNumberParam('tribeCommandHarnessInputResetMs', previewAnimationHoldMs)
  const edgeNavRatio = Math.max(0, Math.min(24, getNumberParam('tribeCommandHarnessEdgeNavPct', 5))) / 100
  const shouldShowCommandHarnessDebugBadge =
    isPreviewEnabled && getBooleanParam('tribeCommandHarnessDebugBadge', false)
  const clampCommandHarnessCanvasBleedPct = (value: number, fallback = 0) =>
    Number.isFinite(value) ? Math.max(0, Math.min(40, value)) : fallback
  const initialCanvasBleedXPct = clampCommandHarnessCanvasBleedPct(
    getNumberParam('tribeCommandHarnessCanvasBleedXPct', 0),
  )
  const initialCanvasBleedYPct =
    getStringParam('tribeCommandHarnessCanvasBleedYPct') === null
      ? initialCanvasBleedXPct
      : clampCommandHarnessCanvasBleedPct(getNumberParam('tribeCommandHarnessCanvasBleedYPct', 0))
  let canvasBleedXPct = initialCanvasBleedXPct
  let canvasBleedYPct = initialCanvasBleedYPct
  const shouldShowCommandHarnessControls = getBooleanParam('tribeCommandHarnessShowControls', false)
  const shouldUseCompletionNativePassthrough = getBooleanParam(
    'tribeCommandHarnessCompletionNativePassthrough',
    getBooleanParam('tribeCommandHarnessCompletionRiveUnderlay', true),
  )
  let armedEdgeGutterDirection: CommandHarnessEdgeDirection | null = null
  let lastEdgeGutterNavigationAt = 0
  let lastEdgeGutterNavigation: Record<string, unknown> | null = null
  const previewFiles = activeBookConfig.previewFiles.map((file) => ({ ...file })) satisfies CommandHarnessPreviewFile[]
  const lastPreviewFile = previewFiles[previewFiles.length - 1] || null
  const lastPreviewReaderStart = lastPreviewFile?.readerStart ?? 24
  const lastPreviewReaderEnd = lastPreviewFile?.readerEnd ?? 25
  const nativePassthroughLeftPages = activeBookConfig.nativePassthroughLeftPages || [0]
  const nativePassthroughRightPages = activeBookConfig.nativePassthroughRightPages || [lastPreviewReaderEnd]
  let commandHarnessCompletionHandoff = false
  let commandHarnessCompletionReason: string | null = null
  let commandHarnessCompletionSince: number | null = null
  let commandHarnessCompletionCheckTimer: number | null = null
  let commandHarnessCompletionObserver: MutationObserver | null = null
  let commandHarnessCompletionRiveReleased = false
  let commandHarnessReadAgainRestorePending = false
  let commandHarnessReadAgainRestoreSince: number | null = null
  let commandHarnessReadAgainRestoreAttempt = 0
  let commandHarnessReadAgainRestoreTimer: number | null = null
  let commandHarnessReadAgainRestoreTarget: Record<string, unknown> | null = null
  let previewActiveLayer: CommandHarnessPreviewLayer | null = null
  let previewNextLayer: CommandHarnessPreviewLayer | null = null
  let previewPreloadLayer: CommandHarnessPreviewLayer | null = null
  let previewSettleTimer: number | null = null
  let pendingPreviewTurn: CommandHarnessPendingTurn | null = null
  let pendingPreviewEpicCommand: EpicPageNavigationCommand | null = null
  let deferredPreviewEpicCommand: EpicPageNavigationCommand | null = null
  let deferredPreviewEpicTargetPage: number | null = null
  let deferredPreviewEpicUseGoToPage = false
  let previewAnimatingTurn: CommandHarnessPendingTurn | null = null
  let lastForwardPreloadDebug: Record<string, unknown> | null = null
  let previewIdleAfterPageInCleanup: (() => void) | null = null
  let previewIdleAfterPageInLayer: CommandHarnessPreviewLayer | null = null
  let previewIdleAfterPageInTimer: number | null = null
  let previewStateMachineAfterIdleLayer: CommandHarnessPreviewLayer | null = null
  let previewStateMachineAfterIdleTimer: number | null = null
  let previewLayerLoadSerial = 0
  let commandHarnessSliderSettleTimer: number | null = null
  let commandHarnessSliderTarget:
    | {
        direction: CommandHarnessTransitionDirection
        page: number
        reason: string
      }
    | null = null
  const commandHarnessSliderSettleMs = Math.max(
    80,
    getNumberParam('tribeCommandHarnessSliderSettleMs', 320),
  )
  let commandHarnessFrameResizeObserver: ResizeObserver | null = null
  let commandHarnessFrameResizeObservedHost: Element | null = null
  let commandHarnessFrameResizeObservedReader: Element | null = null
  let commandHarnessFrameResizeTimers: number[] = []
  const getPreviewIndexForReaderPage = (page: number) => {
    const readerPage = Number.isFinite(page) ? page : 0
    const exactIndex = previewFiles.findIndex((file) => readerPage >= file.readerStart && readerPage <= file.readerEnd)
    if (exactIndex >= 0) return exactIndex
    if (readerPage < previewFiles[0].readerStart) return 0

    const previousIndex = previewFiles.findLastIndex((file) => readerPage >= file.readerStart)
    return Math.max(0, Math.min(previewFiles.length - 1, previousIndex))
  }
  const getPreviewNavigationTarget = (direction: 1 | -1) => {
    const currentPage = context.data.getCurrentPage()
    const activeIndex = previewActiveLayer?.index ?? previewIndex
    const targetIndex = Math.max(0, Math.min(previewFiles.length - 1, activeIndex + direction))
    const targetFile = previewFiles[targetIndex]
    const targetPage =
      targetFile?.readerStart ??
      Math.max(0, currentPage + direction)
    return { currentPage, targetIndex, targetPage }
  }
  const initialReaderPage = context.data.getCurrentPage()
  let previewIndex = getPreviewIndexForReaderPage(initialReaderPage)
  let lastReaderPage = initialReaderPage
  type CommandHarnessNativePassthroughSide = 'left' | 'right'

  const getCommandHarnessNativePassthroughSides = () => {
    const activeFile = previewActiveLayer?.file || previewFiles[previewIndex] || null
    const visiblePages = new Set<number>()
    if (activeFile) {
      visiblePages.add(activeFile.readerStart)
      visiblePages.add(activeFile.readerEnd)
    }

    const sides = new Set<CommandHarnessNativePassthroughSide>()
    if (nativePassthroughLeftPages.some((page) => visiblePages.has(page))) sides.add('left')
    if (nativePassthroughRightPages.some((page) => visiblePages.has(page))) sides.add('right')
    return sides
  }

  const shouldSuspendCommandHarnessNativePassthrough = () =>
    !commandHarnessCompletionHandoff && (previewAnimatingTurn !== null || previewSettleTimer !== null)

  const shouldKeepCommandHarnessCompletionRiveVisible = () =>
    shouldUseCompletionNativePassthrough && !commandHarnessCompletionRiveReleased

  const syncCommandHarnessNativePassthroughState = () => {
    if (commandHarnessCompletionHandoff) {
      root.classList.add('is-completion-handoff')
      root.classList.remove('is-native-passthrough-suspended')
      previewStage.classList.remove('is-native-passthrough-suspended')
      root.classList.add('is-epic-native-passthrough', 'is-epic-native-passthrough-left', 'is-epic-native-passthrough-right')
      root.dataset.epicPassthroughSides = 'left,right'

      if (!shouldUseCompletionNativePassthrough) {
        previewStage.classList.add('is-completion-handoff')
        previewStage.classList.remove('is-completion-native-passthrough')
        previewStage.classList.remove('is-completion-rive-released')
        previewStage.classList.add('is-epic-native-passthrough', 'is-epic-native-passthrough-left', 'is-epic-native-passthrough-right')
        previewStage.dataset.epicPassthroughSides = 'left,right'
        return new Set<CommandHarnessNativePassthroughSide>(['left', 'right'])
      }

      const activeSides = getCommandHarnessNativePassthroughSides()
      const hasLeft = activeSides.has('left')
      const hasRight = activeSides.has('right')
      previewStage.classList.remove('is-completion-handoff')
      previewStage.classList.add('is-completion-native-passthrough')
      previewStage.classList.toggle('is-completion-rive-released', commandHarnessCompletionRiveReleased)
      previewStage.classList.toggle('is-epic-native-passthrough', activeSides.size > 0)
      previewStage.classList.toggle('is-epic-native-passthrough-left', hasLeft)
      previewStage.classList.toggle('is-epic-native-passthrough-right', hasRight)
      previewStage.dataset.epicPassthroughSuspended = 'false'
      if (activeSides.size > 0) {
        previewStage.dataset.epicPassthroughSides = Array.from(activeSides).join(',')
      } else {
        delete previewStage.dataset.epicPassthroughSides
      }
      return activeSides
    }

    root.classList.remove('is-completion-handoff')
    previewStage.classList.remove('is-completion-handoff')
    previewStage.classList.remove('is-completion-native-passthrough')
    previewStage.classList.remove('is-completion-rive-released')

    const isPassthroughSuspended = shouldSuspendCommandHarnessNativePassthrough()
    const activeSides = isPassthroughSuspended
      ? new Set<CommandHarnessNativePassthroughSide>()
      : getCommandHarnessNativePassthroughSides()
    const isActive = activeSides.size > 0
    const hasLeft = activeSides.has('left')
    const hasRight = activeSides.has('right')

    root.classList.toggle('is-epic-native-passthrough', isActive)
    root.classList.toggle('is-epic-native-passthrough-left', hasLeft)
    root.classList.toggle('is-epic-native-passthrough-right', hasRight)
    previewStage.classList.toggle('is-epic-native-passthrough', isActive)
    previewStage.classList.toggle('is-epic-native-passthrough-left', hasLeft)
    previewStage.classList.toggle('is-epic-native-passthrough-right', hasRight)
    previewStage.classList.toggle('is-native-passthrough-suspended', isPassthroughSuspended)
    root.classList.toggle('is-native-passthrough-suspended', isPassthroughSuspended)

    if (isActive) {
      const sideText = Array.from(activeSides).join(',')
      previewStage.dataset.epicPassthroughSides = sideText
      root.dataset.epicPassthroughSides = sideText
    } else {
      delete previewStage.dataset.epicPassthroughSides
      delete root.dataset.epicPassthroughSides
    }
    previewStage.dataset.epicPassthroughSuspended = isPassthroughSuspended ? 'true' : 'false'
    root.dataset.epicPassthroughSuspended = isPassthroughSuspended ? 'true' : 'false'

    return activeSides
  }

  const getCommandHarnessCanvasPointerEvents = (
    role: CommandHarnessPreviewLayer['role'] | null,
    activeSides = getCommandHarnessNativePassthroughSides(),
  ) => (activeSides.size > 1 ? 'none' : role === 'active' ? 'auto' : 'none')

  const syncCommandHarnessPreviewPointerEvents = () => {
    const activeSides = syncCommandHarnessNativePassthroughState()
    for (const layer of [previewActiveLayer, previewNextLayer]) {
      if (!layer) continue
      layer.canvas.style.pointerEvents = getCommandHarnessCanvasPointerEvents(layer.role, activeSides)
    }
    return activeSides
  }

  const applyCommandHarnessCanvasBleed = (canvas: HTMLCanvasElement) => {
    canvas.style.left = `${-canvasBleedXPct}%`
    canvas.style.top = `${-canvasBleedYPct}%`
    canvas.style.right = 'auto'
    canvas.style.bottom = 'auto'
    canvas.style.width = `${100 + canvasBleedXPct * 2}%`
    canvas.style.height = `${100 + canvasBleedYPct * 2}%`
    canvas.dataset.commandHarnessCanvasBleedX = String(canvasBleedXPct)
    canvas.dataset.commandHarnessCanvasBleedY = String(canvasBleedYPct)
  }

  const getCommandHarnessCanvasBleedDebug = () => ({
    canvasBleedXPct,
    canvasBleedYPct,
    canvases: [previewCanvas, previewCanvasAlt, previewCanvasPreload].map((canvas) => {
      const rect = canvas.getBoundingClientRect()
      return {
        ariaLabel: canvas.getAttribute('aria-label'),
        height: rect.height,
        left: canvas.style.left,
        top: canvas.style.top,
        width: rect.width,
        x: rect.x,
        y: rect.y,
      }
    }),
  })

  const setCommandHarnessCanvasBleed = (xPct = canvasBleedXPct, yPct = xPct) => {
    canvasBleedXPct = clampCommandHarnessCanvasBleedPct(Number(xPct), canvasBleedXPct)
    canvasBleedYPct = clampCommandHarnessCanvasBleedPct(Number(yPct), canvasBleedYPct)
    for (const canvas of [previewCanvas, previewCanvasAlt, previewCanvasPreload]) {
      applyCommandHarnessCanvasBleed(canvas)
    }
    resizePreview()
    return getCommandHarnessCanvasBleedDebug()
  }

  const createCommandHarnessPreviewLayout = () =>
    new Layout({
      fit: previewFit,
      alignment: Alignment.Center,
    })

  const setCommandHarnessPreviewFit = (fit = String(previewFit)) => {
    previewFit = getCommandHarnessPreviewFit(fit)
    for (const layer of [previewActiveLayer, previewNextLayer, previewPreloadLayer]) {
      if (!layer?.rive) continue
      layer.rive.layout = createCommandHarnessPreviewLayout()
      layer.rive.resizeDrawingSurfaceToCanvas(getEffectivePixelRatio(previewStage))
    }
    if (previewRive) {
      previewRive.layout = createCommandHarnessPreviewLayout()
      previewRive.resizeDrawingSurfaceToCanvas(getEffectivePixelRatio(previewStage))
    }
    resizePreview()
    return getCommandHarnessNativePassthroughDebug()
  }

  const getCommandHarnessNavigationState = () => {
    const activeIndex = previewActiveLayer?.index ?? previewIndex
    const activeLoaded = !isPreviewEnabled || Boolean(previewActiveLayer?.loaded)
    const busy = previewSettleTimer !== null || pendingPreviewTurn !== null
    const nextIndex = activeIndex + 1
    const nextLayerReady =
      !isPreviewEnabled ||
      activeIndex >= previewFiles.length - 1 ||
      Boolean(previewNextLayer?.index === nextIndex && previewNextLayer.loaded)
    return {
      activeIndex,
      activeLoaded,
      busy,
      nextIndex: activeIndex < previewFiles.length - 1 ? nextIndex : null,
      nextLayerReady,
      queuedLayer: previewNextLayer
        ? {
            file: previewNextLayer.file.file,
            index: previewNextLayer.index,
            loaded: previewNextLayer.loaded,
            renderSize: previewNextLayer.renderSize,
            role: previewNextLayer.role,
          }
        : null,
      canGoBack: !busy && activeLoaded && activeIndex > 0,
      canGoNext: !busy && activeLoaded && activeIndex < previewFiles.length - 1 && nextLayerReady,
      pendingDirection: pendingPreviewTurn?.direction || null,
    }
  }

  const hideCommandHarnessEdgeGutters = () => {
    edgeBackGutter.hidden = true
    edgeBackGutter.disabled = true
    edgeNextGutter.hidden = true
    edgeNextGutter.disabled = true
  }

  const getCommandHarnessVisibleElementRect = (element: Element | null): DOMRect | null => {
    if (!(element instanceof HTMLElement)) return null
    if (!document.documentElement.contains(element)) return null

    const styles = window.getComputedStyle(element)
    if (element.hidden || styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
      return null
    }

    const rect = element.getBoundingClientRect()
    return rect.width > 1 && rect.height > 1 ? rect : null
  }

  const describeCommandHarnessPageEdgeElement = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const styles = window.getComputedStyle(element)
    return {
      className: element.className,
      display: styles.display,
      height: rect.height,
      hidden: element.hidden || element.hasAttribute('hidden'),
      opacity: styles.opacity,
      pointerEvents: styles.pointerEvents,
      visibility: styles.visibility,
      width: rect.width,
      x: rect.x,
      y: rect.y,
      zIndex: styles.zIndex,
    }
  }

  const serializeCommandHarnessRect = (rect: DOMRect | null) =>
    rect
      ? {
          height: rect.height,
          width: rect.width,
          x: rect.x,
          y: rect.y,
        }
      : null

  const getCommandHarnessPageEdgeFrameRect = (sourceRect: DOMRect): DOMRect | null => {
    const edgeElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        '#read-flip-book > .page-edge, #read-flip-book .page-edge',
      ),
    )
    const edgeRects = edgeElements
      .map((element) => ({
        element,
        rect: getCommandHarnessVisibleElementRect(element),
      }))
      .filter((item): item is { element: HTMLElement; rect: DOMRect } => {
        if (!item.rect) return false
        const verticalOverlap =
          Math.min(item.rect.bottom, sourceRect.bottom) - Math.max(item.rect.top, sourceRect.top)
        return verticalOverlap > Math.min(sourceRect.height, item.rect.height) * 0.4
      })

    if (edgeRects.length < 2) return null

    const leftEdges = edgeRects.filter(({ element }) => element.classList.contains('left'))
    const rightEdges = edgeRects.filter(({ element }) => element.classList.contains('right'))
    const sourceCenterX = sourceRect.left + sourceRect.width / 2
    const leftEdge =
      leftEdges
        .filter(({ rect }) => rect.left < sourceCenterX)
        .sort((a, b) => b.rect.right - a.rect.right)[0] ||
      edgeRects.filter(({ rect }) => rect.left < sourceCenterX).sort((a, b) => b.rect.right - a.rect.right)[0]
    const rightEdge =
      rightEdges
        .filter(({ rect }) => rect.right > sourceCenterX)
        .sort((a, b) => a.rect.left - b.rect.left)[0] ||
      edgeRects.filter(({ rect }) => rect.right > sourceCenterX).sort((a, b) => a.rect.left - b.rect.left)[0]

    if (!leftEdge || !rightEdge) return null

    const left = Math.max(sourceRect.left, leftEdge.rect.right)
    const right = Math.min(sourceRect.right, rightEdge.rect.left)
    const top = Math.max(sourceRect.top, Math.min(leftEdge.rect.top, rightEdge.rect.top))
    const bottom = Math.min(sourceRect.bottom, Math.max(leftEdge.rect.bottom, rightEdge.rect.bottom))
    if (right - left <= sourceRect.width * 0.4 || bottom - top <= sourceRect.height * 0.4) return null

    return new DOMRect(left, top, right - left, bottom - top)
  }

  const getCommandHarnessEpicPageEdgesDebug = () => {
    const edges = Array.from(document.querySelectorAll<HTMLElement>('#read-flip-book > .page-edge')).map(
      describeCommandHarnessPageEdgeElement,
    )
    const flipBookRect = context.data.getFlipBookRect()
    const sourceRect = flipBookRect
      ? new DOMRect(flipBookRect.x, flipBookRect.y, flipBookRect.width, flipBookRect.height)
      : null
    return {
      count: edges.length,
      edges,
      pageEdgeFrameEnabled: shouldUsePageEdgeFrame,
      pageEdgeFrameRect: sourceRect ? serializeCommandHarnessRect(getCommandHarnessPageEdgeFrameRect(sourceRect)) : null,
      nativeShellEnabled: shouldUseEpicNativeShell,
      skipPageRenderEnabled: isEpicDebugSkipPageRenderEnabled,
    }
  }

  const getInsetCommandHarnessRect = (
    rect: DOMRect,
    inset: { bottom: number; left: number; right: number; top: number },
  ): DOMRect => {
    const left = Math.max(0, inset.left)
    const right = Math.max(0, inset.right)
    const top = Math.max(0, inset.top)
    const bottom = Math.max(0, inset.bottom)
    const width = Math.max(1, rect.width - left - right)
    const height = Math.max(1, rect.height - top - bottom)
    return new DOMRect(rect.x + left, rect.y + top, width, height)
  }

  const getCommandHarnessEpicFrameContentRect = (element: HTMLElement): DOMRect | null => {
    const rect = getCommandHarnessVisibleElementRect(element)
    if (!rect) return null

    const styles = window.getComputedStyle(element)
    const borderLeft = Number.parseFloat(styles.borderLeftWidth) || 0
    const borderRight = Number.parseFloat(styles.borderRightWidth) || 0
    const borderTop = Number.parseFloat(styles.borderTopWidth) || 0
    const borderBottom = Number.parseFloat(styles.borderBottomWidth) || 0
    return getInsetCommandHarnessRect(rect, {
      bottom: Math.max(borderBottom, epicBookFrameInsetPx),
      left: Math.max(borderLeft, epicBookFrameInsetPx),
      right: Math.max(borderRight, epicBookFrameInsetPx),
      top: Math.max(borderTop, epicBookFrameInsetPx),
    })
  }

  const getCommandHarnessEpicBookFrameRect = (): DOMRect | null => {
    if (!shouldFitToEpicBookFrame) return null

    const directElement = document.querySelector('#read-flip-book')
    const directRect =
      directElement instanceof HTMLElement ? getCommandHarnessEpicFrameContentRect(directElement) : null
    if (directRect) return directRect

    const wrapperRects = Array.from(
      document.querySelectorAll<HTMLElement>(
        'epic-flip-book-page-wrapper.book-bordering, .flip-book-page-wrapper.book-bordering',
      ),
    )
      .map(getCommandHarnessVisibleElementRect)
      .filter((rect): rect is DOMRect => Boolean(rect))
    if (!wrapperRects.length) return null

    const left = Math.min(...wrapperRects.map((rect) => rect.left))
    const top = Math.min(...wrapperRects.map((rect) => rect.top))
    const right = Math.max(...wrapperRects.map((rect) => rect.right))
    const bottom = Math.max(...wrapperRects.map((rect) => rect.bottom))
    return getInsetCommandHarnessRect(new DOMRect(left, top, right - left, bottom - top), {
      bottom: epicBookFrameInsetPx,
      left: epicBookFrameInsetPx,
      right: epicBookFrameInsetPx,
      top: epicBookFrameInsetPx,
    })
  }

  const getCommandHarnessContainedRectForAspect = (rect: DOMRect, aspect: number): DOMRect => {
    if (!Number.isFinite(aspect) || aspect <= 0 || rect.width <= 0 || rect.height <= 0) return rect

    const rectAspect = rect.width / rect.height
    if (rectAspect > aspect) {
      const width = rect.height * aspect
      return new DOMRect(rect.x + (rect.width - width) / 2, rect.y, width, rect.height)
    }

    const height = rect.width / aspect
    return new DOMRect(rect.x, rect.y + (rect.height - height) / 2, rect.width, height)
  }

  const getCommandHarnessOwnBookFrameRect = (): DOMRect | null => {
    if (!shouldUseOwnBookFrame) return null

    const flipBookRect = context.data.getFlipBookRect()
    const host = readingRoot.host
    const hostRect = host instanceof HTMLElement ? host.getBoundingClientRect() : null
    const sourceRect = flipBookRect || hostRect
    if (!sourceRect || sourceRect.width <= 1 || sourceRect.height <= 1) return null

    const rect = new DOMRect(sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height)
    const pageEdgeFrameRect = shouldUsePageEdgeFrame ? getCommandHarnessPageEdgeFrameRect(rect) : null
    if (pageEdgeFrameRect) return pageEdgeFrameRect

    return ownBookFrameAspect ? getCommandHarnessContainedRectForAspect(rect, ownBookFrameAspect) : rect
  }

  const getCommandHarnessOwnBookFrameSource = () => {
    if (!shouldUseOwnBookFrame) return null

    const flipBookRect = context.data.getFlipBookRect()
    const host = readingRoot.host
    const hostRect = host instanceof HTMLElement ? host.getBoundingClientRect() : null
    const sourceRect = flipBookRect || hostRect
    if (!sourceRect || sourceRect.width <= 1 || sourceRect.height <= 1) return null

    const rect = new DOMRect(sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height)
    if (shouldUsePageEdgeFrame && getCommandHarnessPageEdgeFrameRect(rect)) return 'page-edge-frame'
    return ownBookFrameAspect ? 'own-book-frame-aspect' : 'own-book-frame'
  }

  const getCommandHarnessReaderFrameRect = () =>
    getCommandHarnessOwnBookFrameRect() || getCommandHarnessEpicBookFrameRect() || context.data.getFlipBookRect()

  const getCommandHarnessReaderFrameSource = () => {
    const ownBookFrameSource = getCommandHarnessOwnBookFrameSource()
    if (ownBookFrameSource) return ownBookFrameSource
    if (getCommandHarnessEpicBookFrameRect()) return 'epic-book-frame'
    return context.data.getFlipBookRect() ? 'flip-book-rect' : null
  }

  const positionCommandHarnessPreviewStage = () => {
    if (
      !isPreviewEnabled ||
      (!shouldUseOwnBookFrame && !shouldFitToEpicBookFrame) ||
      (commandHarnessCompletionHandoff && !shouldUseCompletionNativePassthrough)
    ) {
      previewStage.style.removeProperty('left')
      previewStage.style.removeProperty('top')
      previewStage.style.removeProperty('right')
      previewStage.style.removeProperty('bottom')
      previewStage.style.removeProperty('width')
      previewStage.style.removeProperty('height')
      return null
    }

    const rect = getCommandHarnessReaderFrameRect()
    const host = readingRoot.host
    if (!rect || !(host instanceof HTMLElement)) return null

    const hostRect = host.getBoundingClientRect()
    previewStage.style.left = `${rect.x - hostRect.x}px`
    previewStage.style.top = `${rect.y - hostRect.y}px`
    previewStage.style.right = 'auto'
    previewStage.style.bottom = 'auto'
    previewStage.style.width = `${rect.width}px`
    previewStage.style.height = `${rect.height}px`
    return rect
  }

  const positionCommandHarnessEdgeGutters = () => {
    const activeSides = syncCommandHarnessNativePassthroughState()
    if (commandHarnessCompletionHandoff) {
      if (shouldUseCompletionNativePassthrough) {
        positionCommandHarnessPreviewStage()
        if (commandHarnessCompletionRiveReleased) {
          hideCommandHarnessEdgeGutters()
          return
        }
      } else {
        hideCommandHarnessEdgeGutters()
        return
      }
    }

    positionCommandHarnessPreviewStage()
    const rect = getCommandHarnessReaderFrameRect()
    const host = readingRoot.host
    if (!isPreviewEnabled || edgeNavRatio <= 0 || !rect || !(host instanceof HTMLElement)) {
      hideCommandHarnessEdgeGutters()
      return
    }

    const hostRect = host.getBoundingClientRect()
    const left = rect.x - hostRect.x
    const top = rect.y - hostRect.y
    const width = Math.max(1, rect.width * edgeNavRatio)
    const height = Math.max(1, rect.height)
    const nextLeft = left + Math.max(0, rect.width - width)
    const navigationState = getCommandHarnessNavigationState()
    const shouldHideBack = activeSides.has('left') || !navigationState.canGoBack
    const shouldHideNext = activeSides.has('right') || !navigationState.canGoNext

    edgeBackGutter.hidden = shouldHideBack
    edgeBackGutter.disabled = shouldHideBack
    if (!shouldHideBack) {
      edgeBackGutter.style.cssText = [
        'position:absolute',
        `left:${left}px`,
        `top:${top}px`,
        `width:${width}px`,
        `height:${height}px`,
        'pointer-events:auto',
      ].join(';')
    }

    edgeNextGutter.hidden = shouldHideNext
    edgeNextGutter.disabled = shouldHideNext
    if (!shouldHideNext) {
      edgeNextGutter.style.cssText = [
        'position:absolute',
        `left:${nextLeft}px`,
        `top:${top}px`,
        `width:${width}px`,
        `height:${height}px`,
        'pointer-events:auto',
      ].join(';')
    }
  }

  const getCommandHarnessElementSummary = (element: Element | null) => {
    if (!element) return null
    const htmlElement = element instanceof HTMLElement ? element : null
    const rect = htmlElement?.getBoundingClientRect()
    return {
      ariaLabel: element.getAttribute('aria-label'),
      className: typeof element.className === 'string' ? element.className : '',
      hidden: htmlElement?.hidden || element.hasAttribute('hidden') || false,
      id: element.id || null,
      rect: rect
        ? {
            height: rect.height,
            width: rect.width,
            x: rect.x,
            y: rect.y,
          }
        : null,
      tagName: element.tagName.toLowerCase(),
      text: (element.textContent || '').trim().slice(0, 80),
    }
  }

  const isElementVisiblyExposed = (element: Element | null): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false
    if (!document.documentElement.contains(element)) return false

    let current: HTMLElement | null = element
    while (current) {
      if (current.hidden || current.hasAttribute('hidden') || current.getAttribute('aria-hidden') === 'true') {
        return false
      }
      const styles = window.getComputedStyle(current)
      if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
        return false
      }
      current = current.parentElement
    }

    const rect = element.getBoundingClientRect()
    return rect.width > 1 && rect.height > 1
  }

  const findVisibleEpicCompletionElement = () => {
    const selectors = [
      'epic-book-completion-page .book-completion-page-container:not([hidden])',
      'epic-book-completion-page .book-completion-finish-container',
      'epic-book-completion-page .almost-done-container',
      'epic-book-completion-page .book-finish-stats',
      'epic-book-completion-page .show-draw-cta',
      'epic-book-completion-page .recommendation-loader',
      'epic-book-precompletion-page',
      'epic-book-completion-page',
      '.book-completion-page-container:not([hidden])',
    ]

    for (const selector of selectors) {
      for (const element of Array.from(document.querySelectorAll(selector))) {
        if (isElementVisiblyExposed(element)) return element
      }
    }

    return null
  }

  const isCommandHarnessPrecompletionElement = (element: Element | null) =>
    Boolean(
      element?.closest(
        [
          'epic-book-precompletion-page',
          '.book-precompletion-page-container',
          '.almost-done-container',
          '.almost-done',
        ].join(','),
      ),
    )

  const isCommandHarnessCompletionEligible = () => {
    const currentPage = context.data.getCurrentPage()
    return currentPage >= lastPreviewReaderStart
  }

  const getCommandHarnessSliderCompletionReleaseThreshold = () => {
    const bookData = context.data.getBookData() || {}
    const numPages = Number((bookData as { numPages?: unknown }).numPages)
    const firstPageAfterLastRive = lastPreviewReaderEnd + 1
    const candidates = [
      firstPageAfterLastRive,
      ...nativePassthroughRightPages.map((page) => page + 1),
      Number.isFinite(numPages) ? numPages - 1 : Number.NaN,
    ].filter((page) => Number.isFinite(page) && page > lastPreviewReaderEnd)

    return candidates.length ? Math.min(...candidates) : firstPageAfterLastRive
  }

  const isCommandHarnessSliderCompletionReleasePage = (page: number) =>
    Number.isFinite(page) && page >= getCommandHarnessSliderCompletionReleaseThreshold()

  const isCommandHarnessBeforeSliderCompletionReleasePage = (page: number) =>
    Number.isFinite(page) && page < getCommandHarnessSliderCompletionReleaseThreshold()

  const canReleaseCommandHarnessForSliderCompletion = () =>
    commandHarnessCompletionHandoff || commandHarnessCompletionRiveReleased || Boolean(findVisibleEpicCompletionElement())

  const getCommandHarnessCompletionDebug = () => {
    const visibleElement = findVisibleEpicCompletionElement()
    return {
      active: commandHarnessCompletionHandoff,
      activeFile: previewActiveLayer
        ? {
            file: previewActiveLayer.file.file,
            label: previewActiveLayer.file.label,
            readerEnd: previewActiveLayer.file.readerEnd,
            readerStart: previewActiveLayer.file.readerStart,
          }
        : null,
      completionEligible: isCommandHarnessCompletionEligible(),
      completionNativePassthroughEnabled: shouldUseCompletionNativePassthrough,
      completionRiveReleased: commandHarnessCompletionRiveReleased,
      completionRiveVisible: commandHarnessCompletionHandoff && shouldKeepCommandHarnessCompletionRiveVisible(),
      currentPage: context.data.getCurrentPage(),
      lastPreviewReaderEnd,
      lastPreviewReaderStart,
      reason: commandHarnessCompletionReason,
      readAgainRestore: {
        attempt: commandHarnessReadAgainRestoreAttempt,
        pending: commandHarnessReadAgainRestorePending,
        since: commandHarnessReadAgainRestoreSince,
        target: commandHarnessReadAgainRestoreTarget,
      },
      sliderCompletionReleaseThreshold: getCommandHarnessSliderCompletionReleaseThreshold(),
      since: commandHarnessCompletionSince,
      visibleElement: getCommandHarnessElementSummary(visibleElement),
    }
  }

  const isCommandHarnessFinalRiveSpreadTransitionInFlight = () => {
    if (!isPreviewEnabled || commandHarnessCompletionHandoff || commandHarnessCompletionRiveReleased) return false

    const finalIndex = previewFiles.length - 1
    const activeIndex = previewActiveLayer?.index ?? previewIndex
    const currentPageTargetIndex = getPreviewIndexForReaderPage(context.data.getCurrentPage())
    return (
      pendingPreviewTurn?.targetIndex === finalIndex ||
      previewAnimatingTurn?.targetIndex === finalIndex ||
      (previewSettleTimer !== null && previewAnimatingTurn?.targetIndex === finalIndex) ||
      (currentPageTargetIndex === finalIndex && activeIndex < finalIndex)
    )
  }

  const updateCommandHarnessCompletionPresentation = () => {
    const keepCompletionRiveVisible = commandHarnessCompletionHandoff && shouldKeepCommandHarnessCompletionRiveVisible()
    const useCompletionNativePassthrough = commandHarnessCompletionHandoff && shouldUseCompletionNativePassthrough

    root.classList.toggle('is-completion-handoff', commandHarnessCompletionHandoff)
    previewStage.classList.toggle('is-completion-handoff', commandHarnessCompletionHandoff && !useCompletionNativePassthrough)
    previewStage.classList.toggle('is-completion-native-passthrough', useCompletionNativePassthrough)
    previewStage.classList.toggle(
      'is-completion-rive-released',
      useCompletionNativePassthrough && commandHarnessCompletionRiveReleased,
    )

    if (commandHarnessCompletionHandoff) {
      status.textContent = 'Epic completion handoff is active.'
      previewStatus.textContent = keepCompletionRiveVisible
        ? 'Epic completion handoff is active; final Rive spread remains on the native Rive side.'
        : commandHarnessCompletionRiveReleased
          ? 'Epic completion action clicked; final Rive spread removed.'
          : 'Epic completion handoff is active; Rive overlay hidden.'
    } else {
      status.textContent = `Restored Rive overlay at page ${context.data.getCurrentPage()}.`
    }

    syncCommandHarnessPreviewPointerEvents()
    positionCommandHarnessEdgeGutters()
    updateCommandButtons()
  }

  const setCommandHarnessCompletionHandoff = (
    active: boolean,
    reason: string,
    details: Record<string, unknown> = {},
  ) => {
    if (!active) {
      commandHarnessCompletionRiveReleased = false
    }

    if (commandHarnessCompletionHandoff === active) {
      commandHarnessCompletionReason = active ? reason : null
      updateCommandHarnessCompletionPresentation()
      return getCommandHarnessCompletionDebug()
    }

    commandHarnessCompletionHandoff = active
    commandHarnessCompletionReason = active ? reason : null
    commandHarnessCompletionSince = active ? Date.now() : null
    updateCommandHarnessCompletionPresentation()
    context.analytics.log(active ? '1tribe_command_harness_completion_handoff' : '1tribe_command_harness_completion_restore', {
      bookId: context.data.getBookId(),
      completionRiveReleased: commandHarnessCompletionRiveReleased,
      completionRiveVisible: active && shouldKeepCommandHarnessCompletionRiveVisible(),
      currentPage: context.data.getCurrentPage(),
      lastPreviewReaderEnd,
      lastPreviewReaderStart,
      reason,
      ...details,
    })
    console.info(active ? '[1Tribe command harness] Epic completion handoff active.' : '[1Tribe command harness] Rive overlay restored.', {
      reason,
      ...details,
    })
    return getCommandHarnessCompletionDebug()
  }

  const checkCommandHarnessCompletionHandoff = (reason: string) => {
    const currentPage = context.data.getCurrentPage()
    if (commandHarnessReadAgainRestorePending) {
      return !tryFinishCommandHarnessReadAgainRestore(reason)
    }

    if (!isCommandHarnessCompletionEligible()) {
      if (commandHarnessCompletionHandoff) {
        setCommandHarnessCompletionHandoff(false, reason, {
          currentPage,
          trigger: 'returned-before-last-rive-spread',
        })
      }
      return false
    }

    if (isCommandHarnessSliderCompletionReleasePage(currentPage)) {
      releaseCommandHarnessForSliderCompletion(currentPage, `${reason}: terminal page invariant`, null)
      return true
    }

    if (isCommandHarnessFinalRiveSpreadTransitionInFlight()) {
      scheduleCommandHarnessCompletionCheck(`${reason}: waiting for final Rive transition`, 120)
      return false
    }

    const visibleCompletionElement = findVisibleEpicCompletionElement()
    if (
      visibleCompletionElement &&
      (commandHarnessCompletionHandoff || !isCommandHarnessPrecompletionElement(visibleCompletionElement))
    ) {
      setCommandHarnessCompletionHandoff(true, reason, {
        visibleElement: getCommandHarnessElementSummary(visibleCompletionElement),
        trigger: commandHarnessCompletionHandoff ? 'completion-visible-refresh' : 'completion-visible',
      })
      return true
    }

    if (currentPage > lastPreviewReaderEnd) {
      setCommandHarnessCompletionHandoff(true, reason, {
        currentPage,
        trigger: 'page-beyond-last-rive',
      })
      return true
    }

    if (commandHarnessCompletionHandoff && isCommandHarnessBeforeSliderCompletionReleasePage(currentPage)) {
      setCommandHarnessCompletionHandoff(false, reason, {
        currentPage,
        sliderCompletionReleaseThreshold: getCommandHarnessSliderCompletionReleaseThreshold(),
        trigger: 'returned-before-completion-release-page',
      })
      return false
    }

    if (commandHarnessCompletionHandoff && currentPage < lastPreviewReaderStart) {
      setCommandHarnessCompletionHandoff(false, reason, {
        currentPage,
        trigger: 'returned-before-last-rive-spread',
      })
    }

    return false
  }

  const scheduleCommandHarnessCompletionCheck = (reason: string, delayMs = 120) => {
    if (commandHarnessCompletionCheckTimer !== null) {
      window.clearTimeout(commandHarnessCompletionCheckTimer)
    }
    commandHarnessCompletionCheckTimer = window.setTimeout(() => {
      commandHarnessCompletionCheckTimer = null
      checkCommandHarnessCompletionHandoff(reason)
    }, Math.max(0, delayMs))
  }

  const isCommandHarnessCompletionClickTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false
    const lastSpreadActive = (previewActiveLayer?.index ?? previewIndex) >= previewFiles.length - 1
    const currentPage = context.data.getCurrentPage()
    const nearBookEnd = lastSpreadActive || currentPage >= lastPreviewReaderStart
    if (!nearBookEnd) return false

    return Boolean(
      target.closest(
        [
          'epic-book-completion-page',
          'epic-book-precompletion-page',
          '.book-completion-page-container',
          '.book-completion-finish-container',
          '.finish-button',
          '.tap-to-finish',
          '.action-button',
        ].join(','),
      ),
    )
  }

  const isCommandHarnessReadAgainClickTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false
    const classMatch = target.closest('.read-again-btn-container,.read-again-btn,[class*="read-again"]')
    if (classMatch) return true

    let current: Element | null = target
    for (let depth = 0; current && depth < 5; depth += 1) {
      const className = typeof current.className === 'string' ? current.className : ''
      const role = current.getAttribute('role') || ''
      const isClickable =
        current instanceof HTMLButtonElement ||
        current instanceof HTMLAnchorElement ||
        role === 'button' ||
        current.hasAttribute('tabindex') ||
        /btn|button/i.test(className)
      if (isClickable) {
        const label = `${current.getAttribute('aria-label') || ''} ${current.textContent || ''}`
        if (/read\s*again/i.test(label)) return true
      }
      current = current.parentElement
    }

    return false
  }

  const clearCommandHarnessReadAgainRestoreTimer = () => {
    if (commandHarnessReadAgainRestoreTimer === null) return
    window.clearTimeout(commandHarnessReadAgainRestoreTimer)
    commandHarnessReadAgainRestoreTimer = null
  }

  const scheduleCommandHarnessReadAgainRestoreCheck = (reason: string, delayMs?: number) => {
    if (!commandHarnessReadAgainRestorePending) return

    clearCommandHarnessReadAgainRestoreTimer()
    const retryDelays = [0, 80, 180, 350, 650, 1000, 1500, 2200, 3200]
    const nextDelay =
      typeof delayMs === 'number'
        ? Math.max(0, delayMs)
        : retryDelays[Math.min(commandHarnessReadAgainRestoreAttempt, retryDelays.length - 1)]
    commandHarnessReadAgainRestoreTimer = window.setTimeout(() => {
      commandHarnessReadAgainRestoreTimer = null
      tryFinishCommandHarnessReadAgainRestore(reason)
    }, nextDelay)
  }

  const finishCommandHarnessReadAgainRestore = (reason: string, details: Record<string, unknown>) => {
    clearCommandHarnessReadAgainRestoreTimer()
    const since = commandHarnessReadAgainRestoreSince
    const attempts = commandHarnessReadAgainRestoreAttempt
    const target = commandHarnessReadAgainRestoreTarget
    commandHarnessReadAgainRestorePending = false
    commandHarnessReadAgainRestoreSince = null
    commandHarnessReadAgainRestoreAttempt = 0
    commandHarnessReadAgainRestoreTarget = null

    setCommandHarnessCompletionHandoff(false, reason, {
      attempts,
      currentPage: context.data.getCurrentPage(),
      elapsedMs: since ? Date.now() - since : null,
      target,
      trigger: 'read-again',
      ...details,
    })
    if (isPreviewEnabled) {
      resizeTwoLayerPreview()
      scheduleCommandHarnessFrameResizeSync('read-again restore ready')
    }
  }

  const tryFinishCommandHarnessReadAgainRestore = (reason: string) => {
    if (!commandHarnessReadAgainRestorePending) return true

    commandHarnessReadAgainRestoreAttempt += 1
    const currentPage = context.data.getCurrentPage()
    const openingFile = previewFiles[0] || null
    const targetIndex = getPreviewIndexForReaderPage(currentPage)
    const isOpeningSpread =
      targetIndex === 0 &&
      Boolean(openingFile) &&
      currentPage >= openingFile.readerStart &&
      currentPage <= openingFile.readerEnd

    if (!isOpeningSpread) {
      setCommandHarnessCompletionHandoff(true, 'Epic read again reset pending', {
        currentPage,
        reason,
        targetIndex,
        trigger: 'waiting-for-opening-page',
      })
      previewStatus.textContent = `Waiting for Epic Read Again to return to the opening spread (page ${currentPage}).`
      scheduleCommandHarnessReadAgainRestoreCheck('waiting for opening spread')
      return false
    }

    if (isPreviewEnabled) {
      alignTwoLayerPreviewToReaderPage(currentPage, `read-again restore: ${reason}`, null)
      const activeReady = previewActiveLayer?.index === 0 && previewActiveLayer.loaded
      if (!activeReady) {
        setCommandHarnessCompletionHandoff(true, 'Epic read again reset loading spread 01', {
          activeFile: previewActiveLayer?.file.file || null,
          activeIndex: previewActiveLayer?.index ?? null,
          currentPage,
          reason,
          trigger: 'waiting-for-first-rive-spread',
        })
        previewStatus.textContent = 'Loading spread 01 before restoring the Rive overlay.'
        scheduleCommandHarnessReadAgainRestoreCheck('waiting for spread 01 load')
        return false
      }
    }

    finishCommandHarnessReadAgainRestore('Epic read again restore ready', {
      activeFile: previewActiveLayer?.file.file || null,
      currentPage,
      reason,
    })
    return true
  }

  const startCommandHarnessReadAgainRestore = (target: Element | null) => {
    commandHarnessReadAgainRestorePending = true
    commandHarnessReadAgainRestoreSince = Date.now()
    commandHarnessReadAgainRestoreAttempt = 0
    commandHarnessReadAgainRestoreTarget = getCommandHarnessElementSummary(target) as Record<string, unknown> | null
    commandHarnessCompletionRiveReleased = true
    setCommandHarnessCompletionHandoff(true, 'Epic read again reset pending', {
      currentPage: context.data.getCurrentPage(),
      target: commandHarnessReadAgainRestoreTarget,
      trigger: 'read-again',
    })
    previewStatus.textContent = 'Read Again clicked; holding Rive overlay until spread 01 is ready.'
    scheduleCommandHarnessReadAgainRestoreCheck('read-again click', 0)
  }

  const handleCommandHarnessCompletionClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null
    if (isCommandHarnessReadAgainClickTarget(event.target)) {
      startCommandHarnessReadAgainRestore(target)
      return
    }

    if (!isCommandHarnessCompletionClickTarget(event.target)) return
    clearCommandHarnessSliderSettle()
    cancelCommandHarnessSliderTransitionState()
    window.setTimeout(() => {
      commandHarnessCompletionRiveReleased = true
      setCommandHarnessCompletionHandoff(true, 'Epic completion UI click', {
        finalRiveReleased: true,
        target: getCommandHarnessElementSummary(target),
        trigger: 'completion-click',
      })
    }, 0)
    scheduleCommandHarnessCompletionCheck('post-completion-click check', 500)
  }

  const releaseCommandHarnessForSliderCompletion = (
    page: number,
    reason: string,
    direction: CommandHarnessTransitionDirection,
  ) => {
    clearCommandHarnessSliderSettle()
    cancelCommandHarnessSliderTransitionState()
    commandHarnessCompletionRiveReleased = true
    setCommandHarnessCompletionHandoff(true, reason, {
      currentPage: page,
      direction,
      finalRiveReleased: true,
      sliderCompletionReleaseThreshold: getCommandHarnessSliderCompletionReleaseThreshold(),
      trigger: 'slider-final-page',
    })
    previewStatus.textContent = 'Slider reached the final Epic page; final Rive spread removed.'
    scheduleCommandHarnessFrameResizeSync(`${reason}: final slider handoff`)
  }

  const enforceCommandHarnessTerminalPageInvariant = (reason: string) => {
    const currentPage = context.data.getCurrentPage()
    if (commandHarnessReadAgainRestorePending || !isCommandHarnessSliderCompletionReleasePage(currentPage)) {
      return false
    }
    if (commandHarnessCompletionHandoff && commandHarnessCompletionRiveReleased) return true

    releaseCommandHarnessForSliderCompletion(currentPage, reason, null)
    return true
  }

  const startCommandHarnessCompletionObserver = () => {
    if (commandHarnessCompletionObserver || !document.body) return
    commandHarnessCompletionObserver = new MutationObserver(() => {
      scheduleCommandHarnessCompletionCheck('Epic completion DOM mutation')
    })
    commandHarnessCompletionObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style', 'aria-hidden'],
      childList: true,
      subtree: true,
    })
  }

  const describeCommandHarnessDebugElement = (element: Element | null) => {
    if (!element) return null
    const htmlElement = element instanceof HTMLElement ? element : null
    const styles = htmlElement ? window.getComputedStyle(htmlElement) : null
    return {
      ariaLabel: element.getAttribute('aria-label'),
      className: typeof element.className === 'string' ? element.className : '',
      dataTestId: element.getAttribute('data-testid'),
      display: styles?.display || null,
      id: element.id || null,
      pointerEvents: styles?.pointerEvents || null,
      tagName: element.tagName.toLowerCase(),
      title: element.getAttribute('title'),
      visibility: styles?.visibility || null,
      zIndex: styles?.zIndex || null,
    }
  }

  const getCommandHarnessDebugPointStack = (x: number, y: number) =>
    document.elementsFromPoint(x, y).slice(0, 8).map((element) => describeCommandHarnessDebugElement(element))

  const getCommandHarnessNativePassthroughDebug = () => {
    const activeSides = syncCommandHarnessPreviewPointerEvents()
    const frameRect = positionCommandHarnessPreviewStage()
    positionCommandHarnessEdgeGutters()
    const stageRect = previewStage.getBoundingClientRect()
    const backGutterRect = edgeBackGutter.getBoundingClientRect()
    const nextGutterRect = edgeNextGutter.getBoundingClientRect()
    const leftX = stageRect.left + stageRect.width * 0.25
    const rightX = stageRect.left + stageRect.width * 0.75
    const centerY = stageRect.top + stageRect.height * 0.5

    return {
      activeFile: previewActiveLayer
        ? {
            file: previewActiveLayer.file.file,
            label: previewActiveLayer.file.label,
            loaded: previewActiveLayer.loaded,
            readerEnd: previewActiveLayer.file.readerEnd,
            readerStart: previewActiveLayer.file.readerStart,
            renderSize: previewActiveLayer.renderSize,
            role: previewActiveLayer.role,
          }
        : null,
      activeSides: Array.from(activeSides),
      completionHandoff: getCommandHarnessCompletionDebug(),
      currentPage: context.data.getCurrentPage(),
      edgeGutters: {
        backHidden: edgeBackGutter.hidden,
        nextHidden: edgeNextGutter.hidden,
        percent: edgeNavRatio * 100,
        armedDirection: armedEdgeGutterDirection,
        lastNavigation: lastEdgeGutterNavigation,
        navigationState: getCommandHarnessNavigationState(),
        backRect: {
          height: backGutterRect.height,
          width: backGutterRect.width,
          x: backGutterRect.x,
          y: backGutterRect.y,
        },
        nextRect: {
          height: nextGutterRect.height,
          width: nextGutterRect.width,
          x: nextGutterRect.x,
          y: nextGutterRect.y,
        },
      },
      epicPageEdges: getCommandHarnessEpicPageEdgesDebug(),
      forwardPreload: {
        debug: lastForwardPreloadDebug,
        enabled: shouldPreloadForwardNeighbor,
        layer: previewPreloadLayer
          ? {
              file: previewPreloadLayer.file.file,
              label: previewPreloadLayer.file.label,
              loaded: previewPreloadLayer.loaded,
              readerEnd: previewPreloadLayer.file.readerEnd,
              readerStart: previewPreloadLayer.file.readerStart,
              renderSize: previewPreloadLayer.renderSize,
              role: previewPreloadLayer.role,
            }
          : null,
      },
      mode: shouldUseTakeover ? 'command-harness-takeover' : 'command-harness',
      nativePassthroughSuspended: shouldSuspendCommandHarnessNativePassthrough(),
      previewIndex,
      previewFit,
      root: {
        className: root.className,
        dataset: {
          epicPassthroughSides: root.dataset.epicPassthroughSides || null,
        },
      },
      stage: {
        canvasBleed: getCommandHarnessCanvasBleedDebug(),
        className: previewStage.className,
        clipPath: window.getComputedStyle(previewStage).clipPath,
        dataset: {
          epicPassthroughSides: previewStage.dataset.epicPassthroughSides || null,
        },
        frameFit: {
          enabled: shouldUseOwnBookFrame || shouldFitToEpicBookFrame,
          mode: shouldUseOwnBookFrame ? 'own-book-frame' : shouldFitToEpicBookFrame ? 'epic-book-frame' : 'off',
          border: ownBookFrameBorder,
          canvasBleedXPct,
          canvasBleedYPct,
          epicFrameInsetPx: shouldFitToEpicBookFrame ? epicBookFrameInsetPx : null,
          epicNativeShell: shouldUseEpicNativeShell,
          ownFrameAspect: ownBookFrameAspect,
          shadow: ownBookFrameShadow,
          resolvedRect: frameRect
            ? {
                height: frameRect.height,
                width: frameRect.width,
                x: frameRect.x,
                y: frameRect.y,
              }
            : null,
          source: getCommandHarnessReaderFrameSource(),
        },
        pointerEvents: window.getComputedStyle(previewStage).pointerEvents,
        rect: {
          height: stageRect.height,
          width: stageRect.width,
          x: stageRect.x,
          y: stageRect.y,
        },
      },
      takeover: shouldUseTakeover,
      deferredEpicCommand: deferredPreviewEpicCommand,
      deferredEpicTargetPage: deferredPreviewEpicTargetPage,
      deferredEpicUseGoToPage: deferredPreviewEpicUseGoToPage,
      leftPointStack: getCommandHarnessDebugPointStack(leftX, centerY),
      rightPointStack: getCommandHarnessDebugPointStack(rightX, centerY),
    }
  }

  root.className = 'tribe-command-harness'
  root.classList.toggle('is-own-book-frame', shouldUseOwnBookFrame)
  root.classList.toggle('is-epic-book-frame-fit', shouldFitToEpicBookFrame)
  root.setAttribute('data-reader-navigation-ignore', 'true')
  title.className = 'tribe-command-harness__title'
  title.textContent = `Command harness: ${activeBookConfig.title}`
  controls.className = 'tribe-command-harness__controls'
  backButton.className = 'tribe-command-harness__button'
  backButton.type = 'button'
  backButton.textContent = 'Back Page'
  nextButton.className = 'tribe-command-harness__button'
  nextButton.type = 'button'
  nextButton.textContent = 'Next Page'
  previewStage.className = 'tribe-command-harness__stage'
  previewStage.classList.toggle('is-reader-overlay', isPreviewEnabled)
  previewStage.classList.toggle('is-takeover', shouldUseTakeover)
  previewStage.classList.toggle('is-own-book-frame', shouldUseOwnBookFrame)
  previewStage.classList.toggle('is-epic-book-frame-fit', shouldFitToEpicBookFrame)
  previewStage.classList.toggle('is-epic-native-shell', shouldUseEpicNativeShell)
  previewStage.dataset.ownBookFrame = shouldUseOwnBookFrame ? 'true' : 'false'
  previewStage.dataset.epicBookFrameFit = shouldFitToEpicBookFrame ? 'true' : 'false'
  previewStage.dataset.epicNativeShell = shouldUseEpicNativeShell ? 'true' : 'false'
  if (ownBookFrameBorder !== null) {
    previewStage.style.setProperty('--tribe-command-harness-book-frame-border', ownBookFrameBorder)
  }
  if (ownBookFrameShadow !== null) {
    previewStage.style.setProperty('--tribe-command-harness-book-frame-shadow', ownBookFrameShadow)
  }
  previewStage.setAttribute('data-reader-navigation-ignore', 'true')
  previewCanvas.className = 'tribe-command-harness__canvas'
  previewCanvasAlt.className = 'tribe-command-harness__canvas'
  previewCanvasPreload.className = 'tribe-command-harness__canvas'
  applyCommandHarnessCanvasBleed(previewCanvas)
  applyCommandHarnessCanvasBleed(previewCanvasAlt)
  applyCommandHarnessCanvasBleed(previewCanvasPreload)
  previewCanvas.setAttribute('aria-label', 'Rive preview layer A')
  previewCanvasAlt.setAttribute('aria-label', 'Rive preview layer B')
  previewCanvasPreload.setAttribute('aria-label', 'Rive preview preload layer')
  previewLoading.className = 'tribe-command-harness__loading'
  previewLoading.hidden = true
  previewLoading.setAttribute('role', 'status')
  previewLoading.setAttribute('aria-live', 'polite')
  previewLoading.setAttribute('data-reader-navigation-ignore', 'true')
  previewLoadingSpinner.className = 'tribe-command-harness__loading-spinner'
  previewLoadingSpinner.setAttribute('aria-hidden', 'true')
  previewLoadingText.className = 'tribe-command-harness__loading-text'
  previewLoadingText.textContent = 'Loading Interactive Pages'
  previewLoading.append(previewLoadingSpinner, previewLoadingText)
  previewDebugBadge.className = 'tribe-command-harness__debug-badge'
  previewDebugBadge.hidden = !shouldShowCommandHarnessDebugBadge
  previewDebugBadge.textContent = `1Tribe ${COMMAND_HARNESS_DEBUG_BUILD_LABEL}`
  previewDebugBadge.setAttribute('data-reader-navigation-ignore', 'true')
  edgeBackGutter.className = 'tribe-command-harness__edge-gutter tribe-command-harness__edge-gutter--back'
  edgeBackGutter.type = 'button'
  edgeBackGutter.hidden = true
  edgeBackGutter.setAttribute('aria-label', 'Back Page')
  edgeBackGutter.setAttribute('data-reader-navigation-ignore', 'true')
  edgeNextGutter.className = 'tribe-command-harness__edge-gutter tribe-command-harness__edge-gutter--next'
  edgeNextGutter.type = 'button'
  edgeNextGutter.hidden = true
  edgeNextGutter.setAttribute('aria-label', 'Next Page')
  edgeNextGutter.setAttribute('data-reader-navigation-ignore', 'true')
  previewStatus.className = 'tribe-command-harness__status'
  previewStatus.textContent = 'Rive preview is off.'
  status.className = 'tribe-command-harness__status'
  status.textContent = `Ready on page ${context.data.getCurrentPage()}: previousPage / nextPage`

  const setCommandHarnessLoadingIndicator = (isLoading: boolean) => {
    previewStage.classList.toggle('is-loading', isLoading)
    previewLoadingText.textContent = 'Loading Interactive Pages'

    if (isLoading) {
      if (previewLoadingFadeTimer !== null) {
        window.clearTimeout(previewLoadingFadeTimer)
        previewLoadingFadeTimer = null
      }
      previewLoading.classList.remove('is-fading')
      previewLoading.hidden = false
      return
    }

    if (previewLoading.hidden || previewLoadingFadeTimer !== null) return
    previewLoading.classList.add('is-fading')
    previewLoadingFadeTimer = window.setTimeout(() => {
      previewLoading.hidden = true
      previewLoading.classList.remove('is-fading')
      previewLoadingFadeTimer = null
    }, 1000)
  }

  const syncCommandHarnessLoadingIndicator = () => {
    if (!isPreviewEnabled) {
      setCommandHarnessLoadingIndicator(false)
      return
    }

    const activeLayerReady = Boolean(previewActiveLayer?.loaded && previewActiveLayer.initialStateMachineStarted)
    setCommandHarnessLoadingIndicator(!activeLayerReady && !previewRive)
  }

  const setCommandHarnessDebugBadge = (message: string) => {
    if (!shouldShowCommandHarnessDebugBadge) return
    previewDebugBadge.hidden = false
    previewDebugBadge.textContent = `1Tribe ${COMMAND_HARNESS_DEBUG_BUILD_LABEL} - ${message}`
  }

  const setStatusForPageChange = (payload: unknown, source: string) => {
    const page = getReaderPageFromPayload(payload, context.data.getCurrentPage())
    const payloadDirection = getNavigationDirectionFromPayload(payload)
    const payloadSource = getNavigationSourceFromPayload(payload)
    const eventSource = payloadSource ? `${source}:${payloadSource}` : source
    const inferredDirection = page > lastReaderPage ? 1 : page < lastReaderPage ? -1 : null
    const direction = payloadDirection ?? inferredDirection
    lastReaderPage = page
    const directionLabel = direction === 1 ? 'forward' : direction === -1 ? 'back' : 'same'
    status.textContent = `Epic page ${page} (${directionLabel}, ${eventSource}).`
    console.info('[1Tribe command harness] pageChange', {
      payload,
      page,
      direction,
      source: eventSource,
    })

    const pagePreviewIndex = getPreviewIndexForReaderPage(page)
    const pageIsBeforeFinalRiveSpread = pagePreviewIndex < previewFiles.length - 1
    if (
      commandHarnessCompletionHandoff &&
      !commandHarnessReadAgainRestorePending &&
      (pageIsBeforeFinalRiveSpread || isCommandHarnessBeforeSliderCompletionReleasePage(page))
    ) {
      setCommandHarnessCompletionHandoff(false, `${eventSource}: pageChange returned to Rive spread`, {
        page,
        previewIndex: pagePreviewIndex,
        trigger: 'rive-page-change',
      })
    } else {
      checkCommandHarnessCompletionHandoff(`${eventSource}: pageChange`)
      if (commandHarnessCompletionHandoff) return
    }

    if (payloadSource === 'slider') {
      if (isPreviewEnabled) {
        if (isCommandHarnessSliderCompletionReleasePage(page) && canReleaseCommandHarnessForSliderCompletion()) {
          releaseCommandHarnessForSliderCompletion(page, `${eventSource}: final page`, direction)
          return
        }
        scheduleCommandHarnessSliderAlignment(page, eventSource, direction)
        scheduleCommandHarnessFrameResizeSync(`${eventSource}: slider pageChange`)
      }
      return
    }

    clearCommandHarnessSliderSettle()

    if (isPreviewEnabled) {
      alignTwoLayerPreviewToReaderPage(page, eventSource, direction)
      scheduleCommandHarnessFrameResizeSync(`${eventSource}: pageChange`)
    }
  }

  const executeEpicNavigation = (command: EpicPageNavigationCommand) => {
    context.commands.execute(command)
    context.analytics.log(
      command === 'nextPage' ? '1tribe_command_harness_next_page' : '1tribe_command_harness_previous_page',
      {
        bookId: context.data.getBookId(),
        page: context.data.getCurrentPage(),
        previewPageBackAnimation: command === 'previousPage' && shouldPlayPreviewPageBack ? previewPageBackAnimation : null,
        previewPageOutAnimation: command === 'nextPage' && shouldPlayPreviewPageOut ? previewPageOutAnimation : null,
      },
    )
    status.textContent = `Fired ${command} at ${new Date().toLocaleTimeString()}.`
    console.info(`[1Tribe command harness] context.commands.execute("${command}")`)
  }

  const executeEpicGoToPage = (page: number, reason: string) => {
    context.commands.execute('goToPage', page)
    context.analytics.log('1tribe_command_harness_go_to_page', {
      bookId: context.data.getBookId(),
      page,
      reason,
    })
    status.textContent = `Synced Epic to page ${page} at ${new Date().toLocaleTimeString()}.`
    console.info('[1Tribe command harness] context.commands.execute("goToPage")', {
      page,
      reason,
    })
  }

  const shouldDeferEpicNavigationUntilPreviewSettle = (command: EpicPageNavigationCommand) => {
    if (!isPreviewEnabled || !previewAnimatingTurn) return false

    const outgoingFile = previewActiveLayer?.file || previewFiles[previewIndex] || null
    const targetFile = previewFiles[previewAnimatingTurn.targetIndex] || null
    const outgoingIncludesEpicPageZero = Boolean(
      outgoingFile && outgoingFile.readerStart <= 0 && outgoingFile.readerEnd >= 0,
    )
    const incomingIncludesEpicPageZero = Boolean(
      targetFile && targetFile.readerStart <= 0 && targetFile.readerEnd >= 0,
    )

    return (
      (command === 'nextPage' && previewAnimatingTurn.direction === 'next' && outgoingIncludesEpicPageZero) ||
      (command === 'previousPage' && previewAnimatingTurn.direction === 'back' && incomingIncludesEpicPageZero)
    )
  }

  const runOrDeferEpicNavigation = (command: EpicPageNavigationCommand, reason: string) => {
    if (shouldDeferEpicNavigationUntilPreviewSettle(command)) {
      const outgoingFile = previewActiveLayer?.file || previewFiles[previewIndex] || null
      const targetFile = previewAnimatingTurn ? previewFiles[previewAnimatingTurn.targetIndex] || null : null
      const targetPage = previewAnimatingTurn?.targetPage ?? null
      const outgoingIncludesEpicPageZero = Boolean(
        outgoingFile && outgoingFile.readerStart <= 0 && outgoingFile.readerEnd >= 0,
      )
      const incomingIncludesEpicPageZero = Boolean(
        targetFile && targetFile.readerStart <= 0 && targetFile.readerEnd >= 0,
      )
      const shouldSyncWithGoToPage =
        Number.isFinite(targetPage) &&
        ((command === 'nextPage' && outgoingIncludesEpicPageZero) ||
          (command === 'previousPage' && incomingIncludesEpicPageZero))
      const shouldSyncBackToEpicPageZeroEarly =
        command === 'previousPage' && incomingIncludesEpicPageZero && Number.isFinite(targetPage)
      if (shouldSyncBackToEpicPageZeroEarly) {
        executeEpicGoToPage(Number(targetPage), `${reason}; early deferred ${command} sync`)
        console.info('[1Tribe command harness] Synced Epic early during Rive back animation.', {
          command,
          currentPage: context.data.getCurrentPage(),
          incomingFile: targetFile?.file || null,
          outgoingFile: outgoingFile?.file || null,
          previewAnimatingTurn,
          reason,
          targetPage,
        })
        updateCommandButtons()
        return true
      }

      deferredPreviewEpicCommand = command
      deferredPreviewEpicTargetPage = shouldSyncWithGoToPage ? targetPage : null
      deferredPreviewEpicUseGoToPage = shouldSyncWithGoToPage
      status.textContent = `Holding Epic ${command} until Rive settles (${reason}).`
      console.info('[1Tribe command harness] Holding Epic navigation until Rive settles.', {
        command,
        currentPage: context.data.getCurrentPage(),
        deferredTargetPage: deferredPreviewEpicTargetPage,
        deferredUseGoToPage: deferredPreviewEpicUseGoToPage,
        incomingFile: targetFile?.file || null,
        outgoingFile: outgoingFile?.file || null,
        previewAnimatingTurn,
        reason,
      })
      updateCommandButtons()
      return true
    }

    executeEpicNavigation(command)
    return true
  }

  const flushDeferredEpicNavigation = (reason: string) => {
    if (!deferredPreviewEpicCommand) return false
    const command = deferredPreviewEpicCommand
    const targetPage = deferredPreviewEpicTargetPage
    const shouldUseGoToPage = deferredPreviewEpicUseGoToPage && Number.isFinite(targetPage)
    deferredPreviewEpicCommand = null
    deferredPreviewEpicTargetPage = null
    deferredPreviewEpicUseGoToPage = false
    console.info('[1Tribe command harness] Releasing delayed Epic navigation.', {
      command,
      currentPage: context.data.getCurrentPage(),
      targetPage,
      useGoToPage: shouldUseGoToPage,
      reason,
    })
    if (shouldUseGoToPage) {
      executeEpicGoToPage(Number(targetPage), `${reason}; deferred ${command}`)
      return true
    }

    executeEpicNavigation(command)
    return true
  }

  const dispatchCommandHarnessTurnEvent = (
    type: 'tribeCommandHarnessTurnStart' | 'tribeCommandHarnessTurnSettle',
    detail: Record<string, unknown>,
  ) => {
    document.dispatchEvent(
      new CustomEvent(type, {
        detail: {
          activeFile: previewActiveLayer?.file.file || null,
          currentPage: context.data.getCurrentPage(),
          previewIndex,
          ...detail,
        },
      }),
    )
  }

  const dispatchCommandHarnessSliderSettle = (page: number, reason: string) => {
    syncCommandHarnessPreviewPointerEvents()
    dispatchCommandHarnessTurnEvent('tribeCommandHarnessTurnSettle', {
      activeFile: previewActiveLayer?.file.file || null,
      direction: 'slider',
      interactionRefresh: true,
      source: 'slider',
      targetIndex: previewActiveLayer?.index ?? previewIndex,
      targetPage: page,
      reason,
    })
  }

  const runPreviousPage = () => {
    const didStartPreviewTurn = !isPreviewEnabled || !shouldPlayPreviewPageBack || runPreviewBackTurn()
    if (!didStartPreviewTurn) {
      if (pendingPreviewTurn?.direction === 'back') pendingPreviewEpicCommand = 'previousPage'
      return false
    }
    runOrDeferEpicNavigation('previousPage', 'previous page')
    return true
  }

  const runNextPage = () => {
    const didStartPreviewTurn = !isPreviewEnabled || !shouldPlayPreviewPageOut || runPreviewNextTurn()
    if (!didStartPreviewTurn) {
      if (pendingPreviewTurn?.direction === 'next') pendingPreviewEpicCommand = 'nextPage'
      return false
    }
    runOrDeferEpicNavigation('nextPage', 'next page')
    return true
  }

  const stopCommandHarnessEdgeGutterEvent = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }

  const runCommandHarnessEdgeGutterNavigation = (direction: CommandHarnessEdgeDirection, source: string) => {
    const navigationState = getCommandHarnessNavigationState()
    const isAllowed = direction === 'back' ? navigationState.canGoBack : navigationState.canGoNext
    if (!isAllowed) {
      lastEdgeGutterNavigationAt = Date.now()
      lastEdgeGutterNavigation = {
        at: lastEdgeGutterNavigationAt,
        blocked: true,
        currentPage: context.data.getCurrentPage(),
        direction,
        navigationState,
        result: false,
        source,
      }
      return false
    }

    const result = direction === 'back' ? runPreviousPage() : runNextPage()
    lastEdgeGutterNavigationAt = Date.now()
    lastEdgeGutterNavigation = {
      at: lastEdgeGutterNavigationAt,
      currentPage: context.data.getCurrentPage(),
      direction,
      result,
      source,
    }
    return result
  }

  const handleCommandHarnessEdgeGutterPointerDown =
    (direction: CommandHarnessEdgeDirection) => (event: PointerEvent) => {
      if (!event.isPrimary) return
      stopCommandHarnessEdgeGutterEvent(event)
      armedEdgeGutterDirection = direction
    }

  const handleCommandHarnessEdgeGutterPointerUp =
    (direction: CommandHarnessEdgeDirection) => (event: PointerEvent) => {
      if (!event.isPrimary) return
      stopCommandHarnessEdgeGutterEvent(event)
      const shouldRun = armedEdgeGutterDirection === direction
      armedEdgeGutterDirection = null
      if (shouldRun) {
        runCommandHarnessEdgeGutterNavigation(direction, 'edge-gutter-pointerup')
      }
    }

  const handleCommandHarnessEdgeGutterPointerCancel = (event: PointerEvent) => {
    if (!event.isPrimary) return
    stopCommandHarnessEdgeGutterEvent(event)
    armedEdgeGutterDirection = null
  }

  const handleCommandHarnessEdgeGutterClick =
    (direction: CommandHarnessEdgeDirection) => (event: MouseEvent) => {
      stopCommandHarnessEdgeGutterEvent(event)
      if (Date.now() - lastEdgeGutterNavigationAt < 500) return
      runCommandHarnessEdgeGutterNavigation(direction, 'edge-gutter-click')
    }

  const handleCommandHarnessEdgeGutterSuppressedEvent = (event: Event) => {
    stopCommandHarnessEdgeGutterEvent(event)
  }

  const addCommandHarnessEdgeGutterListeners = (button: HTMLButtonElement, direction: CommandHarnessEdgeDirection) => {
    const pointerDown = handleCommandHarnessEdgeGutterPointerDown(direction)
    const pointerUp = handleCommandHarnessEdgeGutterPointerUp(direction)
    const click = handleCommandHarnessEdgeGutterClick(direction)

    button.addEventListener('pointerdown', pointerDown, true)
    button.addEventListener('pointerup', pointerUp, true)
    button.addEventListener('pointercancel', handleCommandHarnessEdgeGutterPointerCancel, true)
    button.addEventListener('click', click, true)
    button.addEventListener('dblclick', handleCommandHarnessEdgeGutterSuppressedEvent, true)
    button.addEventListener('contextmenu', handleCommandHarnessEdgeGutterSuppressedEvent, true)

    return () => {
      button.removeEventListener('pointerdown', pointerDown, true)
      button.removeEventListener('pointerup', pointerUp, true)
      button.removeEventListener('pointercancel', handleCommandHarnessEdgeGutterPointerCancel, true)
      button.removeEventListener('click', click, true)
      button.removeEventListener('dblclick', handleCommandHarnessEdgeGutterSuppressedEvent, true)
      button.removeEventListener('contextmenu', handleCommandHarnessEdgeGutterSuppressedEvent, true)
    }
  }

  backButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    runPreviousPage()
  })

  nextButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    runNextPage()
  })

  const cleanupBackEdgeGutterListeners = addCommandHarnessEdgeGutterListeners(edgeBackGutter, 'back')
  const cleanupNextEdgeGutterListeners = addCommandHarnessEdgeGutterListeners(edgeNextGutter, 'next')

  controls.append(backButton, nextButton)
  if (shouldShowCommandHarnessControls) {
    root.append(title, controls)
  }
  if (isPreviewEnabled) {
    if (shouldPreloadForwardNeighbor) {
      previewStage.append(previewCanvasPreload)
    }
    previewStage.append(previewCanvasAlt, previewCanvas, previewDebugBadge)
    setCommandHarnessDebugBadge(`boot p${context.data.getCurrentPage()}`)
    previewStatus.textContent = 'Rive overlay is loading.'
    setCommandHarnessLoadingIndicator(true)
    if (shouldShowCommandHarnessControls) {
      root.append(previewStatus)
    }
    readingRoot.append(previewStage, previewLoading)
    readingRoot.append(edgeBackGutter, edgeNextGutter)
  }
  if (shouldShowCommandHarnessControls) {
    root.append(status)
    readingRoot.append(root)
  }
  positionCommandHarnessPreviewStage()
  syncCommandHarnessPreviewPointerEvents()
  positionCommandHarnessEdgeGutters()

  const updateCommandButtons = () => {
    positionCommandHarnessPreviewStage()
    syncCommandHarnessPreviewPointerEvents()
    positionCommandHarnessEdgeGutters()
    if (!isPreviewEnabled) {
      backButton.disabled = false
      nextButton.disabled = false
      return
    }

    const navigationState = getCommandHarnessNavigationState()
    backButton.disabled = !navigationState.canGoBack
    nextButton.disabled = !navigationState.canGoNext
  }

  const resizeTwoLayerPreview = () => {
    if (!isPreviewEnabled) return
    positionCommandHarnessPreviewStage()
    const ratio = getEffectivePixelRatio(previewStage)
    for (const canvas of getCommandHarnessPreviewCanvases()) {
      resizeCanvasToOwnBounds(canvas, ratio)
    }
    previewActiveLayer?.rive?.resizeDrawingSurfaceToCanvas(ratio)
    previewNextLayer?.rive?.resizeDrawingSurfaceToCanvas(ratio)
    previewPreloadLayer?.rive?.resizeDrawingSurfaceToCanvas(ratio)
    if (previewActiveLayer) syncCommandHarnessLayerRenderSize(previewActiveLayer)
    if (previewNextLayer) syncCommandHarnessLayerRenderSize(previewNextLayer)
    if (previewPreloadLayer) syncCommandHarnessLayerRenderSize(previewPreloadLayer)
    syncCommandHarnessPreviewPointerEvents()
    positionCommandHarnessEdgeGutters()
  }

  const syncCommandHarnessFrameResizeObserver = () => {
    if (!isPreviewEnabled || typeof ResizeObserver !== 'function') return

    if (!commandHarnessFrameResizeObserver) {
      commandHarnessFrameResizeObserver = new ResizeObserver(() => {
        scheduleCommandHarnessFrameResizeSync('resize observer')
      })
    }

    const host = readingRoot.host instanceof Element ? readingRoot.host : null
    if (host && host !== commandHarnessFrameResizeObservedHost) {
      if (commandHarnessFrameResizeObservedHost) {
        commandHarnessFrameResizeObserver.unobserve(commandHarnessFrameResizeObservedHost)
      }
      commandHarnessFrameResizeObserver.observe(host)
      commandHarnessFrameResizeObservedHost = host
    }

    const reader = document.querySelector('#read-flip-book')
    if (reader && reader !== commandHarnessFrameResizeObservedReader) {
      if (commandHarnessFrameResizeObservedReader) {
        commandHarnessFrameResizeObserver.unobserve(commandHarnessFrameResizeObservedReader)
      }
      commandHarnessFrameResizeObserver.observe(reader)
      commandHarnessFrameResizeObservedReader = reader
    }
  }

  const clearCommandHarnessFrameResizeTimers = () => {
    for (const timer of commandHarnessFrameResizeTimers) {
      window.clearTimeout(timer)
    }
    commandHarnessFrameResizeTimers = []
  }

  const scheduleCommandHarnessFrameResizeSync = (reason: string) => {
    if (!isPreviewEnabled) return

    clearCommandHarnessFrameResizeTimers()
    for (const delayMs of [0, 40, 120, 300, 700]) {
      const timer = window.setTimeout(() => {
        commandHarnessFrameResizeTimers = commandHarnessFrameResizeTimers.filter((item) => item !== timer)
        if (enforceCommandHarnessTerminalPageInvariant(`${reason}: frame resize terminal guard`)) return
        syncCommandHarnessFrameResizeObserver()
        resizeTwoLayerPreview()
        console.info('[1Tribe command harness] Synced Rive overlay to Epic frame.', {
          reason,
          delayMs,
          frameSource: getCommandHarnessReaderFrameSource(),
          rect: getCommandHarnessReaderFrameRect(),
        })
      }, delayMs)
      commandHarnessFrameResizeTimers.push(timer)
    }
  }

  const getCommandHarnessPreviewCanvases = () =>
    shouldPreloadForwardNeighbor ? [previewCanvas, previewCanvasAlt, previewCanvasPreload] : [previewCanvas, previewCanvasAlt]

  const getAvailablePreviewCanvas = () =>
    getCommandHarnessPreviewCanvases().find(
      (canvas) =>
        canvas !== previewActiveLayer?.canvas &&
        canvas !== previewNextLayer?.canvas &&
        canvas !== previewPreloadLayer?.canvas,
    ) || null

  const getSparePreviewCanvas = () => {
    const availableCanvas = getAvailablePreviewCanvas()
    if (availableCanvas) return availableCanvas
    if (!previewActiveLayer) return previewCanvasAlt
    return previewActiveLayer.canvas === previewCanvas ? previewCanvasAlt : previewCanvas
  }

  const setPreviewCanvasRole = (layer: CommandHarnessPreviewLayer, role: CommandHarnessPreviewLayer['role']) => {
    layer.role = role
    layer.canvas.style.opacity = role === 'active' ? '1' : '0'
    layer.canvas.style.pointerEvents = getCommandHarnessCanvasPointerEvents(role)
    layer.canvas.style.zIndex = role === 'active' ? '2' : '0'
    syncCommandHarnessPreviewPointerEvents()
  }

  const clearPreviewIdleAfterPageIn = (layer: CommandHarnessPreviewLayer | null = null) => {
    if (layer && previewIdleAfterPageInLayer && layer !== previewIdleAfterPageInLayer) return

    if (previewIdleAfterPageInTimer !== null) {
      window.clearTimeout(previewIdleAfterPageInTimer)
      previewIdleAfterPageInTimer = null
    }
    previewIdleAfterPageInCleanup?.()
    previewIdleAfterPageInCleanup = null
    previewIdleAfterPageInLayer = null
  }

  const clearPreviewStateMachineAfterIdle = (layer: CommandHarnessPreviewLayer | null = null) => {
    if (layer && previewStateMachineAfterIdleLayer && layer !== previewStateMachineAfterIdleLayer) return

    if (previewStateMachineAfterIdleTimer !== null) {
      window.clearTimeout(previewStateMachineAfterIdleTimer)
      previewStateMachineAfterIdleTimer = null
    }
    previewStateMachineAfterIdleLayer = null
  }

  const cleanupPreviewLayer = (layer: CommandHarnessPreviewLayer | null) => {
    if (!layer) return
    clearPreviewIdleAfterPageIn(layer)
    clearPreviewStateMachineAfterIdle(layer)
    layer.rive?.cleanup()
    layer.rive = null
    layer.initialStateMachineStarted = false
    layer.loaded = false
    layer.renderSize = null
    layer.canvas.getContext('2d')?.clearRect(0, 0, layer.canvas.width, layer.canvas.height)
    layer.canvas.style.opacity = '0'
    layer.canvas.style.pointerEvents = 'none'
    layer.canvas.style.zIndex = '0'
    delete layer.canvas.dataset.riveRenderAspect
    delete layer.canvas.dataset.riveRenderHeight
    delete layer.canvas.dataset.riveRenderWidth
  }

  const resolveCommandHarnessAnimation = (
    instance: Rive | null,
    requestedName: string,
    aliases: string[],
  ): CommandHarnessAnimationResolution => {
    const candidates = [requestedName, ...aliases]
    const candidateKeys = candidates.map(normalizeRiveNameForMatch)
    const artboards = instance?.contents?.artboards || []

    for (let index = 0; index < candidates.length; index += 1) {
      const key = candidateKeys[index]
      for (const artboard of artboards) {
        const animation = (artboard.animations || []).find((name) => normalizeRiveNameForMatch(name) === key)
        if (animation) {
          return {
            animation,
            artboard: artboard.name,
            candidates,
            found: true,
          }
        }
      }
    }

    return {
      animation: requestedName,
      candidates,
      found: false,
    }
  }

  const resolveCommandHarnessStateMachine = (
    instance: Rive | null,
    file: CommandHarnessPreviewFile,
  ): CommandHarnessStateMachineResolution => {
    const artboards = instance?.contents?.artboards || []
    const entries = artboards.flatMap((artboard) =>
      (artboard.stateMachines || []).map((stateMachine) => ({
        artboard: artboard.name,
        stateMachine: stateMachine.name,
      })),
    )
    const addCandidate = (candidates: string[], value: string | null | undefined) => {
      const candidate = String(value || '').trim()
      if (candidate && !candidates.includes(candidate)) candidates.push(candidate)
    }
    const fileBaseName = (() => {
      try {
        return decodeURIComponent(file.file).split(/[\\/]/).pop()?.replace(/\.riv$/i, '') || ''
      } catch {
        return file.file.split(/[\\/]/).pop()?.replace(/\.riv$/i, '') || ''
      }
    })()
    const start = String(file.readerStart).padStart(2, '0')
    const end = String(file.readerEnd).padStart(2, '0')
    const candidates: string[] = []

    addCandidate(candidates, file.stateMachine)
    addCandidate(candidates, fileBaseName)
    addCandidate(candidates, fileBaseName.replace(/^creepy_cafetorium_/i, 'Creepy_Cafetorium_'))
    addCandidate(candidates, fileBaseName.replace(/^hummingbird_/i, 'HummingBird_'))
    addCandidate(candidates, fileBaseName.replace(/^hummingbird_/i, 'Hummingbird_'))
    addCandidate(candidates, `Creepy_Cafetorium_spread_${start}`)
    addCandidate(candidates, `HummingBird_spread_${start}`)
    addCandidate(candidates, `Hummingbird_spread_${start}`)
    addCandidate(candidates, `Page_${start}`)
    if (file.readerStart !== file.readerEnd) {
      addCandidate(candidates, `Creepy_Cafetorium_spread_${start}&${end}`)
      addCandidate(candidates, `Creepy_Cafetorium_spread_${start}_${end}`)
      addCandidate(candidates, `Creepy_Cafetorium_spread_${start}-${end}`)
      addCandidate(candidates, `HummingBird_spread_${start}&${end}`)
      addCandidate(candidates, `HummingBird_spread_${start}_${end}`)
      addCandidate(candidates, `Hummingbird_spread_${start}&${end}`)
      addCandidate(candidates, `Hummingbird_spread_${start}_${end}`)
      addCandidate(candidates, `Page_${start}_${end}`)
      addCandidate(candidates, `Page_${start}&${end}`)
      addCandidate(candidates, `Page_${start}-${end}`)
    }

    const candidateKeys = candidates.map(normalizeRiveNameForMatch)
    for (const key of candidateKeys) {
      const exact = entries.find((entry) => normalizeRiveNameForMatch(entry.stateMachine) === key)
      if (exact) return exact
    }

    const matchingPagePair = entries.find((entry) => {
      const key = normalizeRiveNameForMatch(`${entry.artboard} ${entry.stateMachine}`)
      return key.includes(start) && (file.readerStart === file.readerEnd || key.includes(end))
    })
    if (matchingPagePair) return matchingPagePair

    const matchingStartPage = entries.find((entry) => {
      const key = normalizeRiveNameForMatch(`${entry.artboard} ${entry.stateMachine}`)
      return key.includes(start)
    })
    if (matchingStartPage) return matchingStartPage

    if (entries[0]) {
      return entries[0]
    }

    return {
      stateMachine: file.stateMachine,
    }
  }

  const getCommandHarnessStateMachineDebugNames = (instance: Rive | null): string[] => {
    const artboards = instance?.contents?.artboards || []
    return artboards.flatMap((artboard) =>
      (artboard.stateMachines || []).map((stateMachine) => `${artboard.name} / ${stateMachine.name}`),
    )
  }

  const startCommandHarnessStateMachine = (layer: CommandHarnessPreviewLayer, label: string) => {
    const entry = resolveCommandHarnessStateMachine(layer.rive, layer.file)
    console.info('[1Tribe command harness] start state machine request', {
      label,
      requestedStateMachine: layer.file.stateMachine,
      resolvedStateMachine: entry.stateMachine,
      artboard: entry.artboard || '(current/default)',
      file: layer.file.file,
      availableStateMachines: getCommandHarnessStateMachineDebugNames(layer.rive),
    })

    if (!layer.rive) return entry

    layer.rive.reset({
      artboard: entry.artboard,
      stateMachines: entry.stateMachine,
      autoplay: true,
      autoBind: true,
    })
    layer.rive.resizeDrawingSurfaceToCanvas(getEffectivePixelRatio(previewStage))
    layer.rive.play(entry.stateMachine)
    return entry
  }

  const startCommandHarnessStateMachineWithoutReset = (layer: CommandHarnessPreviewLayer, label: string) => {
    const entry = resolveCommandHarnessStateMachine(layer.rive, layer.file)
    console.info('[1Tribe command harness] start state machine without reset request', {
      label,
      requestedStateMachine: layer.file.stateMachine,
      resolvedStateMachine: entry.stateMachine,
      artboard: entry.artboard || '(current/default)',
      file: layer.file.file,
      playingAnimationsBefore: layer.rive?.playingAnimationNames || [],
      playingStateMachinesBefore: layer.rive?.playingStateMachineNames || [],
      availableStateMachines: getCommandHarnessStateMachineDebugNames(layer.rive),
    })

    if (!layer.rive) return entry

    layer.rive.resizeDrawingSurfaceToCanvas(getEffectivePixelRatio(previewStage))
    layer.rive.play(entry.stateMachine)
    console.info('[1Tribe command harness] started state machine without reset', {
      file: layer.file.file,
      spread: layer.file.label,
      stateMachine: entry.stateMachine,
      playingAnimationsAfter: layer.rive.playingAnimationNames || [],
      playingStateMachinesAfter: layer.rive.playingStateMachineNames || [],
    })
    return entry
  }

  const startCommandHarnessInitialStateMachine = (layer: CommandHarnessPreviewLayer, label: string) => {
    if (!layer.rive) return null

    try {
      if (layer.initialPlaybackMode === 'idle' && layer.role === 'active') {
        const idleEntry = startCommandHarnessAnimation(
          layer,
          previewBackIdleAnimation,
          ['Page_idle', 'Page_Idle', 'Page idle', 'PageIdle', 'idle', 'Idle'],
          `${label} slider idle`,
        )
        const stateMachineAfterIdle = schedulePreviewStateMachineAfterIdle(layer, idleEntry)
        if (!stateMachineAfterIdle && !idleEntry.found) {
          return startCommandHarnessStateMachine(layer, `${label} slider idle fallback`)
        }
        if (stateMachineAfterIdle) {
          console.info('[1Tribe command harness] Slider-loaded idle will resume state machine.', {
            file: layer.file.file,
            spread: layer.file.label,
            idleAnimation: idleEntry.animation,
            stateMachineAfterIdle,
          })
        }
        return idleEntry
      }

      if (layer.role === 'active') {
        return startCommandHarnessStateMachine(layer, label)
      }

      return startCommandHarnessStateMachineWithoutReset(layer, label)
    } catch (error) {
      console.warn('[1Tribe command harness] Could not start initial state machine after file load.', {
        file: layer.file.file,
        label,
        requestedStateMachine: layer.file.stateMachine,
        availableStateMachines: getCommandHarnessStateMachineDebugNames(layer.rive),
        error,
      })
      return null
    }
  }

  const startCommandHarnessAnimation = (
    layer: CommandHarnessPreviewLayer,
    requestedName: string,
    aliases: string[],
    label: string,
  ) => {
    const entry = resolveCommandHarnessAnimation(layer.rive, requestedName, aliases)
    console.info('[1Tribe command harness] start animation request', {
      label,
      requestedName,
      resolvedAnimation: entry.animation,
      artboard: entry.artboard || '(current/default)',
      found: entry.found,
      candidates: entry.candidates,
      file: layer.file.file,
      playingAnimationsBefore: layer.rive?.playingAnimationNames || [],
      playingStateMachinesBefore: layer.rive?.playingStateMachineNames || [],
    })

    if (!entry.found || !layer.rive) return entry

    layer.rive.reset({
      artboard: entry.artboard,
      animations: entry.animation,
      autoplay: true,
      autoBind: true,
    })
    layer.rive.resizeDrawingSurfaceToCanvas(getEffectivePixelRatio(previewStage))
    layer.rive.play(entry.animation)
    return entry
  }

  const getCommandHarnessStoppedAnimationNames = (event: RiveRuntimeEvent): string[] =>
    Array.isArray(event.data)
      ? event.data.filter((item): item is string => typeof item === 'string')
      : typeof event.data === 'string'
        ? [event.data]
        : []

  const shouldRunPreviewIdleAfterPageInForLayer = (layer: CommandHarnessPreviewLayer) =>
    shouldRunPreviewIdleAfterPageInAllSpreads ||
    (shouldRunSpread02IdleAfterPageIn && layer.file.label === 'spread 02')

  const schedulePreviewStateMachineAfterIdle = (
    layer: CommandHarnessPreviewLayer,
    idleEntry: CommandHarnessAnimationResolution,
  ) => {
    if (!shouldResumeStateMachineAfterPageIdle || !layer.rive || !idleEntry.found) return null

    clearPreviewStateMachineAfterIdle()

    const rive = layer.rive
    const runStateMachine = () => {
      previewStateMachineAfterIdleTimer = null
      previewStateMachineAfterIdleLayer = null
      if (layer.rive !== rive) return null

      const entry = startCommandHarnessStateMachineWithoutReset(
        layer,
        `after ${idleEntry.animation} settled on ${layer.file.label}`,
      )
      console.info('[1Tribe command harness] state machine resumed after Page_idle.', {
        file: layer.file.file,
        spread: layer.file.label,
        idleAnimation: idleEntry.animation,
        delayMs: previewStateMachineAfterPageIdleMs,
        stateMachine: entry.stateMachine,
      })
      return entry
    }

    previewStateMachineAfterIdleLayer = layer
    if (previewStateMachineAfterPageIdleMs <= 0) {
      return {
        delayMs: 0,
        scheduled: false,
        stateMachine: runStateMachine()?.stateMachine || null,
      }
    }

    previewStateMachineAfterIdleTimer = window.setTimeout(runStateMachine, previewStateMachineAfterPageIdleMs)
    return {
      delayMs: previewStateMachineAfterPageIdleMs,
      scheduled: true,
      stateMachine: layer.file.stateMachine,
    }
  }

  const schedulePreviewIdleAfterPageIn = (
    layer: CommandHarnessPreviewLayer,
    pageInEntry: CommandHarnessAnimationResolution,
  ) => {
    if (!shouldRunPreviewIdleAfterPageInForLayer(layer) || !layer.rive || !pageInEntry.found) {
      return null
    }

    clearPreviewIdleAfterPageIn()
    clearPreviewStateMachineAfterIdle()

    const rive = layer.rive
    let didRunIdle = false
    let idleEntry: CommandHarnessAnimationResolution | null = null

    const runIdle = (reason: string) => {
      if (didRunIdle) return idleEntry
      didRunIdle = true
      if (previewIdleAfterPageInTimer !== null) {
        window.clearTimeout(previewIdleAfterPageInTimer)
        previewIdleAfterPageInTimer = null
      }
      previewIdleAfterPageInCleanup?.()
      previewIdleAfterPageInCleanup = null
      previewIdleAfterPageInLayer = null
      if (layer.rive !== rive) return idleEntry

      idleEntry = startCommandHarnessAnimation(
        layer,
        previewBackIdleAnimation,
        ['Page_idle', 'Page_Idle', 'Page idle', 'PageIdle', 'idle', 'Idle'],
        `incoming ${layer.file.label} idle after Page_in test (${reason})`,
      )
      console.info('[1Tribe command harness] Page_idle after Page_in ran.', {
        file: layer.file.file,
        spread: layer.file.label,
        idleAnimation: idleEntry.animation,
        idleFound: idleEntry.found,
        pageInAnimation: pageInEntry.animation,
        reason,
      })
      const stateMachineAfterIdle = schedulePreviewStateMachineAfterIdle(layer, idleEntry)
      if (stateMachineAfterIdle) {
        console.info('[1Tribe command harness] state machine resume scheduled after Page_idle.', {
          file: layer.file.file,
          spread: layer.file.label,
          idleAnimation: idleEntry.animation,
          stateMachineAfterIdle,
        })
      }
      return idleEntry
    }

    const onStop = (event: RiveRuntimeEvent) => {
      if (!getCommandHarnessStoppedAnimationNames(event).includes(pageInEntry.animation)) return
      runIdle('Page_in stop')
    }

    previewIdleAfterPageInLayer = layer
    previewIdleAfterPageInCleanup = () => rive.off(EventType.Stop, onStop)
    rive.on(EventType.Stop, onStop)
    if (previewIdleAfterPageInFallbackMs > 0) {
      previewIdleAfterPageInTimer = window.setTimeout(() => {
        previewIdleAfterPageInTimer = null
        runIdle('fallback')
      }, previewIdleAfterPageInFallbackMs)
    }

    return {
      fallbackMs: previewIdleAfterPageInFallbackMs,
      pageInAnimation: pageInEntry.animation,
      scheduled: true,
    }
  }

  const getCommandHarnessRiveRenderSize = (instance: Rive | null): WordHotspotRenderSize | null => {
    if (!instance) return null

    const bounds = instance.bounds
    const boundsWidth = Number(bounds?.maxX) - Number(bounds?.minX)
    const boundsHeight = Number(bounds?.maxY) - Number(bounds?.minY)
    if (Number.isFinite(boundsWidth) && boundsWidth > 0 && Number.isFinite(boundsHeight) && boundsHeight > 0) {
      return { width: boundsWidth, height: boundsHeight }
    }

    const artboardWidth = Number(instance.artboardWidth)
    const artboardHeight = Number(instance.artboardHeight)
    if (Number.isFinite(artboardWidth) && artboardWidth > 0 && Number.isFinite(artboardHeight) && artboardHeight > 0) {
      return { width: artboardWidth, height: artboardHeight }
    }

    return null
  }

  const syncCommandHarnessLayerRenderSize = (layer: CommandHarnessPreviewLayer) => {
    const renderSize = getCommandHarnessRiveRenderSize(layer.rive)
    layer.renderSize = renderSize

    if (renderSize) {
      layer.canvas.dataset.riveRenderWidth = String(renderSize.width)
      layer.canvas.dataset.riveRenderHeight = String(renderSize.height)
      layer.canvas.dataset.riveRenderAspect = String(renderSize.width / renderSize.height)
    } else {
      delete layer.canvas.dataset.riveRenderWidth
      delete layer.canvas.dataset.riveRenderHeight
      delete layer.canvas.dataset.riveRenderAspect
    }

    return renderSize
  }

  const isCommandHarnessLayerCurrent = (layer: CommandHarnessPreviewLayer) =>
    layer === previewActiveLayer || layer === previewNextLayer || layer === previewPreloadLayer

  const scheduleCommandHarnessInitialStateMachineStart = (
    layer: CommandHarnessPreviewLayer,
    label: string,
  ) => {
    if (!isPreviewEnabled || !layer.rive || layer.initialStateMachineStarted) return

    const rive = layer.rive
    const delays = [0, 32, 80, 160, 320, 640]
    const run = (attempt: number) => {
      if (enforceCommandHarnessTerminalPageInvariant(`${label}: initial start terminal guard`)) return
      if (layer.rive !== rive || !isCommandHarnessLayerCurrent(layer) || layer.initialStateMachineStarted) return

      positionCommandHarnessPreviewStage()
      const ratio = getEffectivePixelRatio(previewStage)
      resizeCanvasToOwnBounds(layer.canvas, ratio)

      const stageRect = previewStage.getBoundingClientRect()
      const canvasRect = layer.canvas.getBoundingClientRect()
      const hasStableFrame =
        stageRect.width >= 32 &&
        stageRect.height >= 32 &&
        canvasRect.width >= 32 &&
        canvasRect.height >= 32 &&
        layer.canvas.width >= 32 &&
        layer.canvas.height >= 32

      if (!hasStableFrame && attempt < delays.length - 1) {
        if (layer.role === 'active') {
          setCommandHarnessDebugBadge(`waiting for canvas ${layer.file.label} ${attempt + 1}`)
        }
        window.setTimeout(() => run(attempt + 1), delays[attempt + 1])
        return
      }

      layer.initialStateMachineStarted = true
      resizeTwoLayerPreview()
      const entry = startCommandHarnessInitialStateMachine(layer, label)
      rive.resizeDrawingSurfaceToCanvas(getEffectivePixelRatio(previewStage))
      rive.drawFrame()
      syncCommandHarnessLayerRenderSize(layer)

      if (layer.role === 'active') {
        syncCommandHarnessLoadingIndicator()
        setCommandHarnessDebugBadge(`started ${layer.file.label} ${entry?.stateMachine || 'state-machine'}`)
      }
      console.info('[1Tribe command harness] Initial Rive start after stable canvas.', {
        attempt,
        canvas: {
          cssHeight: canvasRect.height,
          cssWidth: canvasRect.width,
          height: layer.canvas.height,
          width: layer.canvas.width,
        },
        file: layer.file.file,
        label,
        role: layer.role,
        stage: {
          height: stageRect.height,
          width: stageRect.width,
        },
        stateMachine: entry?.stateMachine || null,
      })
    }

    window.setTimeout(() => run(0), delays[0])
  }

  const markPreviewLayerLoaded = (layer: CommandHarnessPreviewLayer, label: string, serial: number) => {
    if (enforceCommandHarnessTerminalPageInvariant(`${label}: layer load terminal guard`)) return

    if (
      serial !== previewLayerLoadSerial &&
      layer !== previewActiveLayer &&
      layer !== previewNextLayer &&
      layer !== previewPreloadLayer
    ) {
      return
    }
    layer.loaded = true
    const renderSize = syncCommandHarnessLayerRenderSize(layer)
    resizeTwoLayerPreview()
    console.info('[1Tribe command harness] Rive layer loaded.', {
      label,
      file: layer.file.file,
      index: layer.index,
      renderSize,
      stateMachine: layer.file.stateMachine,
      contents: listSimpleRiveAnimations(layer.rive?.contents || {}),
    })
    if (layer === previewPreloadLayer) {
      lastForwardPreloadDebug = {
        ...(lastForwardPreloadDebug || {}),
        file: layer.file.file,
        index: layer.index,
        loaded: true,
        loadedAt: Date.now(),
      }
    }

    if (previewActiveLayer?.loaded && previewNextLayer?.loaded) {
      const queuedLabel = previewNextLayer.role === 'previous' ? 'previous' : 'next'
      previewStatus.textContent = `Ready. Active ${previewActiveLayer.file.label}; ${queuedLabel} ${previewNextLayer.file.label}.`
    }
    syncCommandHarnessLoadingIndicator()
    updateCommandButtons()

    if (
      layer === previewActiveLayer &&
      layer.initialPlaybackMode === 'idle' &&
      getPreviewIndexForReaderPage(context.data.getCurrentPage()) === layer.index &&
      !isCommandHarnessSliderCompletionReleasePage(context.data.getCurrentPage())
    ) {
      dispatchCommandHarnessSliderSettle(context.data.getCurrentPage(), `${label}: slider idle layer loaded`)
    }

    if (commandHarnessReadAgainRestorePending && layer.index === 0) {
      window.setTimeout(() => {
        tryFinishCommandHarnessReadAgainRestore('spread 01 Rive layer loaded')
      }, 0)
    }

    if (pendingPreviewTurn && layer === previewNextLayer && layer.index === pendingPreviewTurn.targetIndex) {
      const turn = pendingPreviewTurn
      pendingPreviewTurn = null
      window.setTimeout(() => {
        let didStartTurn = false
        if (turn.direction === 'back') {
          didStartTurn = startPreviewBackTurnToTarget(turn.targetIndex, turn.targetPage, 'queued Rive layer loaded')
        } else {
          didStartTurn = startPreviewNextTurnToTarget(turn.targetIndex, turn.targetPage, 'queued Rive layer loaded')
        }
        if (didStartTurn && pendingPreviewEpicCommand) {
          const command = pendingPreviewEpicCommand
          pendingPreviewEpicCommand = null
          runOrDeferEpicNavigation(command, 'queued Rive layer loaded')
        }
      }, 0)
    }
  }

  const createPreviewLayer = (
    index: number,
    canvas: HTMLCanvasElement,
    role: CommandHarnessPreviewLayer['role'],
    options: { initialPlaybackMode?: CommandHarnessPreviewLayer['initialPlaybackMode'] } = {},
  ): CommandHarnessPreviewLayer | null => {
    const file = previewFiles[index]
    if (!file) return null

    const layer: CommandHarnessPreviewLayer = {
      canvas,
      file,
      index,
      initialPlaybackMode: options.initialPlaybackMode || 'stateMachine',
      initialStateMachineStarted: false,
      loaded: false,
      renderSize: null,
      rive: null,
      role,
    }
    const serial = ++previewLayerLoadSerial
    setPreviewCanvasRole(layer, role)
    resizeCanvasToOwnBounds(canvas, getEffectivePixelRatio(previewStage))
    if (role === 'active' && !previewActiveLayer?.loaded) {
      setCommandHarnessLoadingIndicator(true)
    }

    try {
      layer.rive = new Rive({
        src: new URL(file.file, extensionScriptUrl).href,
        canvas,
        autoplay: false,
        autoBind: true,
        automaticallyHandleEvents: true,
        enableRiveAssetCDN: false,
        layout: createCommandHarnessPreviewLayout(),
        onLoad() {
          markPreviewLayerLoaded(layer, `${role} ${file.label}`, serial)
          scheduleCommandHarnessInitialStateMachineStart(layer, `${role} ${file.label} loaded`)
        },
        onLoadError(event) {
          previewStatus.textContent = `Failed to load ${file.label}: ${String(event?.data || 'unknown error')}`
          if (role === 'active') setCommandHarnessLoadingIndicator(true)
          console.warn('[1Tribe command harness] Rive layer failed.', {
            file: file.file,
            index,
            role,
            event,
          })
          updateCommandButtons()
        },
        onPlay(event) {
          console.info('[1Tribe command harness] onPlay', { label: `${role} ${file.label}`, data: event?.data })
        },
        onStop(event) {
          console.info('[1Tribe command harness] onStop', { label: `${role} ${file.label}`, data: event?.data })
        },
        onStateChange(event) {
          console.info('[1Tribe command harness] onStateChange', { label: `${role} ${file.label}`, data: event?.data })
        },
      })
    } catch (error) {
      previewStatus.textContent = `Failed to create ${file.label}: ${String(error)}`
      console.warn('[1Tribe command harness] Could not create Rive layer.', {
        file: file.file,
        index,
        role,
        error,
      })
      return layer
    }

    return layer
  }

  const queuePreviewLayer = (index: number, role: 'next' | 'previous') => {
    if (index < 0 || index >= previewFiles.length) {
      previewNextLayer = null
      updateCommandButtons()
      return null
    }

    if (role === 'previous') {
      cleanupForwardPreloadLayer()
    }

    if (role === 'next' && previewPreloadLayer?.index === index) {
      const layer = previewPreloadLayer
      previewPreloadLayer = null
      if (previewNextLayer && previewNextLayer !== previewActiveLayer && previewNextLayer !== layer) {
        cleanupPreviewLayer(previewNextLayer)
      }
      setPreviewCanvasRole(layer, role)
      previewNextLayer = layer
      lastForwardPreloadDebug = {
        consumedAt: Date.now(),
        file: layer.file.file,
        index,
        loaded: layer.loaded,
        source: 'queuePreviewLayer',
      }
      updateCommandButtons()
      return layer
    }

    if (previewNextLayer && previewNextLayer !== previewActiveLayer) {
      cleanupPreviewLayer(previewNextLayer)
    }

    const canvas = getSparePreviewCanvas()
    previewNextLayer = createPreviewLayer(index, canvas, role)
    updateCommandButtons()
    return previewNextLayer
  }

  const cleanupForwardPreloadLayer = () => {
    cleanupPreviewLayer(previewPreloadLayer)
    previewPreloadLayer = null
  }

  const queueForwardPreloadLayer = (index: number, source: string) => {
    if (!shouldPreloadForwardNeighbor) return null
    if (index < 0 || index >= previewFiles.length) {
      lastForwardPreloadDebug = {
        index,
        skipped: 'out-of-range',
        source,
        updatedAt: Date.now(),
      }
      cleanupForwardPreloadLayer()
      return null
    }
    if (previewActiveLayer?.index === index || previewNextLayer?.index === index) {
      lastForwardPreloadDebug = {
        index,
        skipped: 'already-active-or-next',
        source,
        updatedAt: Date.now(),
      }
      return null
    }
    if (previewPreloadLayer?.index === index) {
      lastForwardPreloadDebug = {
        file: previewPreloadLayer.file.file,
        index,
        loaded: previewPreloadLayer.loaded,
        reused: true,
        source,
        updatedAt: Date.now(),
      }
      return previewPreloadLayer
    }

    cleanupForwardPreloadLayer()
    const canvas = getAvailablePreviewCanvas()
    if (!canvas) {
      lastForwardPreloadDebug = {
        index,
        skipped: 'no-spare-canvas',
        source,
        updatedAt: Date.now(),
      }
      return null
    }

    previewPreloadLayer = createPreviewLayer(index, canvas, 'preload')
    lastForwardPreloadDebug = {
      file: previewPreloadLayer?.file.file || null,
      index,
      startedAt: Date.now(),
      source,
    }
    return previewPreloadLayer
  }

  const promoteForwardPreloadLayer = (index: number, source: string) => {
    if (!shouldPreloadForwardNeighbor || previewPreloadLayer?.index !== index) return null
    const layer = previewPreloadLayer
    previewPreloadLayer = null
    if (previewNextLayer && previewNextLayer !== previewActiveLayer && previewNextLayer !== layer) {
      cleanupPreviewLayer(previewNextLayer)
    }
    setPreviewCanvasRole(layer, 'next')
    previewNextLayer = layer
    lastForwardPreloadDebug = {
      consumedAt: Date.now(),
      file: layer.file.file,
      index,
      loaded: layer.loaded,
      source,
    }
    return layer
  }

  const queueForwardPreviewLayer = (spareCanvas: HTMLCanvasElement) => {
    const nextIndex = (previewActiveLayer?.index ?? previewIndex) + 1
    if (nextIndex >= previewFiles.length) {
      previewNextLayer = null
      previewStatus.textContent = `Turn done. ${previewActiveLayer?.file.label || 'current spread'} is visible. End of sequence.`
      updateCommandButtons()
      return null
    }

    const preloadedLayer = promoteForwardPreloadLayer(nextIndex, 'queueForwardPreviewLayer')
    if (preloadedLayer) {
      updateCommandButtons()
      return preloadedLayer
    }

    previewNextLayer = createPreviewLayer(nextIndex, spareCanvas, 'next')
    updateCommandButtons()
    return previewNextLayer
  }

  const cancelPreviewTurnState = () => {
    if (previewSettleTimer !== null) window.clearTimeout(previewSettleTimer)
    previewSettleTimer = null
    if (pendingPreviewSwapTimer !== null) window.clearTimeout(pendingPreviewSwapTimer)
    pendingPreviewSwapTimer = null
    pendingPreviewTurn = null
    pendingPreviewEpicCommand = null
    deferredPreviewEpicCommand = null
    deferredPreviewEpicTargetPage = null
    deferredPreviewEpicUseGoToPage = false
    previewAnimatingTurn = null
    clearPreviewIdleAfterPageIn()
    clearPreviewStateMachineAfterIdle()
  }

  const clearCommandHarnessSliderSettle = () => {
    if (commandHarnessSliderSettleTimer !== null) {
      window.clearTimeout(commandHarnessSliderSettleTimer)
      commandHarnessSliderSettleTimer = null
    }
    commandHarnessSliderTarget = null
  }

  const cancelCommandHarnessSliderTransitionState = () => {
    cancelPreviewTurnState()
    cleanupPreviewLayer(previewNextLayer)
    previewNextLayer = null
    cleanupForwardPreloadLayer()
    previewLayerLoadSerial += 1
  }

  const startCommandHarnessSliderIdle = (
    layer: CommandHarnessPreviewLayer | null,
    page: number,
    reason: string,
  ) => {
    if (!layer) return null

    layer.initialPlaybackMode = 'idle'
    clearPreviewIdleAfterPageIn(layer)
    clearPreviewStateMachineAfterIdle(layer)

    if (!layer.loaded || !layer.rive) return null

    layer.initialStateMachineStarted = true
    const entry = startCommandHarnessAnimation(
      layer,
      previewBackIdleAnimation,
      ['Page_idle', 'Page_Idle', 'Page idle', 'PageIdle', 'idle', 'Idle'],
      `slider settled page ${page}: ${reason}`,
    )
    if (entry.found) {
      const stateMachineAfterIdle = schedulePreviewStateMachineAfterIdle(layer, entry)
      if (stateMachineAfterIdle) {
        console.info('[1Tribe command harness] Slider idle scheduled state-machine resume.', {
          file: layer.file.file,
          page,
          reason,
          spread: layer.file.label,
          stateMachineAfterIdle,
        })
      }
    } else {
      layer.rive.resizeDrawingSurfaceToCanvas(getEffectivePixelRatio(previewStage))
      layer.rive.drawFrame()
      startCommandHarnessStateMachine(layer, `slider idle missing; resumed state machine for page ${page}`)
    }
    return entry
  }

  const queueForwardNeighborForActive = (spareCanvas: HTMLCanvasElement | null = null) => {
    if (!previewActiveLayer) return null
    const nextIndex = previewActiveLayer.index + 1
    if (nextIndex >= previewFiles.length) {
      previewNextLayer = null
      cleanupForwardPreloadLayer()
      return null
    }

    const preloadedLayer = promoteForwardPreloadLayer(nextIndex, 'queueForwardNeighborForActive')
    if (preloadedLayer) return preloadedLayer

    previewNextLayer = createPreviewLayer(nextIndex, spareCanvas || getSparePreviewCanvas(), 'next')
    return previewNextLayer
  }

  const alignTwoLayerPreviewToReaderPageWithoutAnimation = (page: number, reason: string) => {
    if (!isPreviewEnabled) return

    const currentPage = context.data.getCurrentPage()
    if (page !== currentPage || isCommandHarnessSliderCompletionReleasePage(currentPage)) {
      if (enforceCommandHarnessTerminalPageInvariant(`${reason}: stale slider target terminal guard`)) return
      if (page !== context.data.getCurrentPage()) {
        previewStatus.textContent = `Skipped stale slider target ${page}; Epic is on page ${context.data.getCurrentPage()}.`
        console.info('[1Tribe command harness] Skipped stale slider target before direct Rive alignment.', {
          currentPage: context.data.getCurrentPage(),
          page,
          reason,
        })
        return
      }
    }

    const targetIndex = getPreviewIndexForReaderPage(page)
    const targetFile = previewFiles[targetIndex]
    if (!targetFile) return

    cancelCommandHarnessSliderTransitionState()

    if (previewActiveLayer?.index === targetIndex) {
      previewIndex = targetIndex
      setPreviewCanvasRole(previewActiveLayer, 'active')
      startCommandHarnessSliderIdle(previewActiveLayer, page, reason)
      queueForwardNeighborForActive(getSparePreviewCanvas())
      previewStatus.textContent = `Slider settled on ${targetFile.label}; kept active Rive page in idle.`
      console.info('[1Tribe command harness] Slider settled on active Rive layer without page-turn animation.', {
        activeFile: targetFile.file,
        page,
        reason,
        targetIndex,
      })
      updateCommandButtons()
      dispatchCommandHarnessSliderSettle(page, reason)
      return
    }

    const previousActiveLayer = previewActiveLayer
    const activeCanvas = previousActiveLayer?.canvas || previewCanvas
    cleanupPreviewLayer(previousActiveLayer)
    previewActiveLayer = null
    previewIndex = targetIndex
    previewActiveLayer = createPreviewLayer(targetIndex, activeCanvas, 'active', {
      initialPlaybackMode: 'idle',
    })
    queueForwardNeighborForActive(getSparePreviewCanvas())
    previewStatus.textContent = `Slider settled on ${targetFile.label}; loading target Rive page in idle.`
    console.info('[1Tribe command harness] Slider rebuilt active Rive layer without page-turn animation.', {
      activeFile: targetFile.file,
      page,
      reason,
      targetIndex,
    })
    updateCommandButtons()
    if (previewActiveLayer?.loaded) {
      dispatchCommandHarnessSliderSettle(page, reason)
    }
  }

  const scheduleCommandHarnessSliderAlignment = (
    page: number,
    reason: string,
    direction: CommandHarnessTransitionDirection,
  ) => {
    if (!isPreviewEnabled) return

    cancelCommandHarnessSliderTransitionState()
    commandHarnessSliderTarget = { direction, page, reason }
    previewStatus.textContent = `Slider moving to reader page ${page}; waiting for final target.`
    console.info('[1Tribe command harness] Slider pageChange queued for direct idle alignment.', {
      activeFile: previewActiveLayer?.file.file || null,
      direction,
      page,
      reason,
      settleMs: commandHarnessSliderSettleMs,
    })
    if (commandHarnessSliderSettleTimer !== null) {
      window.clearTimeout(commandHarnessSliderSettleTimer)
    }
    commandHarnessSliderSettleTimer = window.setTimeout(() => {
      const target = commandHarnessSliderTarget
      commandHarnessSliderSettleTimer = null
      commandHarnessSliderTarget = null
      if (!target) return
      if (target.page !== context.data.getCurrentPage()) {
        if (enforceCommandHarnessTerminalPageInvariant(`${target.reason}: stale slider settle terminal guard`)) return
        previewStatus.textContent = `Skipped stale slider settle ${target.page}; Epic is on page ${context.data.getCurrentPage()}.`
        console.info('[1Tribe command harness] Skipped stale slider settle target.', {
          currentPage: context.data.getCurrentPage(),
          target,
        })
        return
      }

      alignTwoLayerPreviewToReaderPageWithoutAnimation(target.page, target.reason)
      scheduleCommandHarnessFrameResizeSync(`${target.reason}: slider settled`)
    }, commandHarnessSliderSettleMs)
    updateCommandButtons()
  }

  const alignTwoLayerPreviewToReaderPage = (
    page: number,
    reason: string,
    direction: CommandHarnessTransitionDirection = null,
  ) => {
    if (!isPreviewEnabled) return

    const targetIndex = getPreviewIndexForReaderPage(page)
    const targetFile = previewFiles[targetIndex]
    if (!targetFile) return

    if (previewSettleTimer !== null && previewAnimatingTurn?.targetIndex === targetIndex) {
      previewStatus.textContent = `Epic page ${page}; finishing animation into ${targetFile.label}.`
      console.info('[1Tribe command harness] Epic page changed while Rive animation is in progress; keeping settle timer.', {
        activeFile: previewActiveLayer?.file.file || null,
        direction,
        incomingFile: previewNextLayer?.file.file || null,
        page,
        reason,
        targetFile: targetFile.file,
        targetIndex,
        turn: previewAnimatingTurn,
      })
      updateCommandButtons()
      return
    }

    if (previewActiveLayer?.index === targetIndex) {
      cancelPreviewTurnState()
      previewIndex = targetIndex
      setPreviewCanvasRole(previewActiveLayer, 'active')

      const expectedNextIndex = targetIndex + 1
      if (previewNextLayer) {
        setPreviewCanvasRole(previewNextLayer, 'next')
      }
      if (expectedNextIndex >= previewFiles.length) {
        cleanupPreviewLayer(previewNextLayer)
        previewNextLayer = null
        cleanupForwardPreloadLayer()
      } else if (previewNextLayer?.index !== expectedNextIndex) {
        const preloadedLayer = promoteForwardPreloadLayer(expectedNextIndex, 'active-page-realign')
        if (!preloadedLayer) {
          const spareCanvas = previewNextLayer?.canvas || getSparePreviewCanvas()
          cleanupPreviewLayer(previewNextLayer)
          previewNextLayer = createPreviewLayer(expectedNextIndex, spareCanvas, 'next')
        }
      }

      previewStatus.textContent = `Rive active ${targetFile.label}; Epic page ${page}.`
      console.info('[1Tribe command harness] Rive already aligned to Epic page.', {
        activeFile: targetFile.file,
        direction,
        page,
        reason,
        targetIndex,
      })
      updateCommandButtons()
      return
    }

    const activeIndex = previewActiveLayer?.index ?? previewIndex
    if (direction === 1 && targetIndex > activeIndex) {
      const didStartTurn = startPreviewNextTurnToTarget(targetIndex, page, `Epic pageChange: ${reason}`)
      if (didStartTurn || pendingPreviewTurn?.targetIndex === targetIndex) return
    }
    if (direction === -1 && targetIndex < activeIndex) {
      const didStartTurn = startPreviewBackTurnToTarget(targetIndex, page, `Epic pageChange: ${reason}`)
      if (didStartTurn || pendingPreviewTurn?.targetIndex === targetIndex) return
    }

    if (previewNextLayer?.index === targetIndex) {
      const outgoingLayer = previewActiveLayer
      const incomingLayer = previewNextLayer
      cancelPreviewTurnState()
      setPreviewCanvasRole(incomingLayer, 'active')
      previewActiveLayer = incomingLayer
      previewIndex = targetIndex
      previewNextLayer = null

      let spareCanvas: HTMLCanvasElement | null = null
      if (outgoingLayer && outgoingLayer !== incomingLayer) {
        spareCanvas = outgoingLayer.canvas
        cleanupPreviewLayer(outgoingLayer)
      }
      const queued = queueForwardNeighborForActive(spareCanvas)
      previewStatus.textContent = queued
        ? `Rive active ${targetFile.label}; Epic page ${page}. Loading ${queued.file.label} next.`
        : `Rive active ${targetFile.label}; Epic page ${page}.`
      console.info('[1Tribe command harness] Promoted queued Rive layer to match Epic page.', {
        activeFile: targetFile.file,
        direction,
        page,
        queuedNextFile: queued?.file.file || null,
        reason,
        targetIndex,
      })
      updateCommandButtons()
      return
    }

    cancelPreviewTurnState()
    cleanupPreviewLayer(previewActiveLayer)
    cleanupPreviewLayer(previewNextLayer)
    cleanupForwardPreloadLayer()
    previewIndex = targetIndex
    previewActiveLayer = createPreviewLayer(targetIndex, previewCanvas, 'active')
    previewNextLayer = null
    queueForwardNeighborForActive(previewCanvasAlt)
    previewStatus.textContent = `Syncing Rive to ${targetFile.label} for Epic page ${page}.`
    console.info('[1Tribe command harness] Rebuilt Rive layers to match Epic page.', {
      activeFile: targetFile.file,
      direction,
      page,
      reason,
      targetIndex,
    })
    updateCommandButtons()
  }

  function settlePreviewNextTurn() {
    previewSettleTimer = null
    previewAnimatingTurn = null
    const outgoingLayer = previewActiveLayer
    const incomingLayer = previewNextLayer
    if (!incomingLayer) return

    incomingLayer.role = 'active'
    incomingLayer.canvas.style.opacity = '1'
    incomingLayer.canvas.style.zIndex = '2'
    incomingLayer.canvas.style.pointerEvents = getCommandHarnessCanvasPointerEvents(incomingLayer.role)
    if (outgoingLayer) {
      outgoingLayer.canvas.style.opacity = '0'
      outgoingLayer.canvas.style.zIndex = '0'
      outgoingLayer.canvas.style.pointerEvents = 'none'
    }

    const shouldUsePageInToIdle = shouldRunPreviewIdleAfterPageInForLayer(incomingLayer)
    const shouldStayOnPageIn = shouldKeepSpread02OnPageIn && incomingLayer.file.label === 'spread 02'
    const shouldSkipStateMachineAfterPageIn = shouldStayOnPageIn || shouldUsePageInToIdle
    const entry = shouldSkipStateMachineAfterPageIn ? null : startCommandHarnessStateMachine(incomingLayer, 'after Page_in')
    previewActiveLayer = incomingLayer
    previewIndex = incomingLayer.index
    previewNextLayer = null

    if (outgoingLayer) {
      const spareCanvas = outgoingLayer.canvas
      cleanupPreviewLayer(outgoingLayer)
      const queued = queueForwardPreviewLayer(spareCanvas)
      if (shouldStayOnPageIn) {
        previewStatus.textContent = queued
          ? `Turn done. ${previewActiveLayer.file.label} remains on ${previewPageInAnimation}. Loading ${queued.file.label} next.`
          : `Turn done. ${previewActiveLayer.file.label} remains on ${previewPageInAnimation}.`
        console.info('[1Tribe command harness] spread 02 stay-on-Page_in test skipped state-machine reset.', {
          file: previewActiveLayer.file.file,
          pageInAnimation: previewPageInAnimation,
          queuedNextFile: queued?.file.file || null,
        })
      } else if (shouldUsePageInToIdle) {
        previewStatus.textContent = queued
          ? `Turn done. ${previewActiveLayer.file.label} is waiting for ${previewBackIdleAnimation} after ${previewPageInAnimation}. Loading ${queued.file.label} next.`
          : `Turn done. ${previewActiveLayer.file.label} is waiting for ${previewBackIdleAnimation} after ${previewPageInAnimation}.`
        console.info('[1Tribe command harness] Page_in-to-idle skipped state-machine reset.', {
          file: previewActiveLayer.file.file,
          spread: previewActiveLayer.file.label,
          idleAnimation: previewBackIdleAnimation,
          pageInAnimation: previewPageInAnimation,
          queuedNextFile: queued?.file.file || null,
        })
      } else {
        previewStatus.textContent = queued
          ? `Turn done. ${previewActiveLayer.file.label} is running ${entry?.stateMachine}. Loading ${queued.file.label} next.`
          : `Turn done. ${previewActiveLayer.file.label} is running ${entry?.stateMachine}.`
      }
    }
    updateCommandButtons()
    dispatchCommandHarnessTurnEvent('tribeCommandHarnessTurnSettle', {
      activeFile: previewActiveLayer.file.file,
      direction: 'next',
      targetIndex: previewActiveLayer.index,
      targetPage: previewActiveLayer.file.readerStart,
    })
    flushDeferredEpicNavigation('after Page_in settle')
  }

  function settlePreviewBackTurn() {
    previewSettleTimer = null
    previewAnimatingTurn = null
    const outgoingLayer = previewActiveLayer
    const incomingLayer = previewNextLayer
    if (!incomingLayer) return

    incomingLayer.role = 'active'
    incomingLayer.canvas.style.opacity = '1'
    incomingLayer.canvas.style.zIndex = '2'
    incomingLayer.canvas.style.pointerEvents = getCommandHarnessCanvasPointerEvents(incomingLayer.role)
    if (outgoingLayer) {
      outgoingLayer.canvas.style.opacity = '0'
      outgoingLayer.canvas.style.zIndex = '0'
      outgoingLayer.canvas.style.pointerEvents = 'none'
    }

    const entry = startCommandHarnessStateMachine(incomingLayer, 'after Page Back')
    previewActiveLayer = incomingLayer
    previewIndex = incomingLayer.index
    previewNextLayer = null

    if (outgoingLayer) {
      const spareCanvas = outgoingLayer.canvas
      cleanupPreviewLayer(outgoingLayer)
      const queued = queueForwardPreviewLayer(spareCanvas)
      previewStatus.textContent = queued
        ? `Back done. ${previewActiveLayer.file.label} is running ${entry.stateMachine}. Loading ${queued.file.label} next.`
        : `Back done. ${previewActiveLayer.file.label} is running ${entry.stateMachine}.`
    }
    updateCommandButtons()
    dispatchCommandHarnessTurnEvent('tribeCommandHarnessTurnSettle', {
      activeFile: previewActiveLayer.file.file,
      direction: 'back',
      targetIndex: previewActiveLayer.index,
      targetPage: previewActiveLayer.file.readerStart,
    })
    flushDeferredEpicNavigation('after Page Back settle')
  }

  function startPreviewNextTurnToTarget(targetIndex: number, targetPage: number, source: string): boolean {
    const activeIndex = previewActiveLayer?.index ?? previewIndex
    if (targetIndex === activeIndex) {
      const activeFile = previewFiles[activeIndex]
      previewStatus.textContent = `Page Next keeps ${activeFile?.label || 'current spread'} for Epic page ${targetPage}.`
      console.info('[1Tribe command harness] Page Next stays on current Rive file.', {
        activeFile: activeFile?.file || null,
        activeIndex,
        source,
        targetIndex,
        targetPage,
      })
      updateCommandButtons()
      return true
    }

    if (targetIndex >= previewFiles.length) {
      previewStatus.textContent = `Page Next clicked, but ${previewActiveLayer?.file.label || 'the current spread'} is the last file.`
      updateCommandButtons()
      return false
    }

    if (previewNextLayer?.index !== targetIndex) {
      pendingPreviewTurn = { direction: 'next', targetIndex, targetPage }
      queuePreviewLayer(targetIndex, 'next')
      previewStatus.textContent = `Loading ${previewFiles[targetIndex].label} for Page Next...`
      updateCommandButtons()
      return false
    }

    if (!previewActiveLayer?.loaded || !previewNextLayer?.loaded) {
      pendingPreviewTurn = { direction: 'next', targetIndex, targetPage }
      previewStatus.textContent = `Page Next clicked, but layers are not ready yet.`
      updateCommandButtons()
      return false
    }

    if (previewSettleTimer !== null) window.clearTimeout(previewSettleTimer)
    pendingPreviewTurn = null

    const outgoingLayer = previewActiveLayer
    const incomingLayer = previewNextLayer
    outgoingLayer.canvas.style.opacity = '1'
    incomingLayer.canvas.style.opacity = '1'
    incomingLayer.canvas.style.zIndex = '3'
    outgoingLayer.canvas.style.zIndex = '2'

    const frontEntry = startCommandHarnessAnimation(
      outgoingLayer,
      previewPageOutAnimation,
      ['Page_next', 'Page_Next', 'Page Next', 'PageNext', 'Page_out', 'Page_Out', 'Page Out', 'PageOut'],
      `outgoing ${outgoingLayer.file.label}`,
    )
    const backEntry = startCommandHarnessAnimation(
      incomingLayer,
      previewPageInAnimation,
      ['Page_in', 'Page_In', 'Page In', 'PageIn'],
      `incoming ${incomingLayer.file.label}`,
    )
    const shouldStayOnPageIn = shouldKeepSpread02OnPageIn && incomingLayer.file.label === 'spread 02'
    const idleAfterPageIn = shouldStayOnPageIn
      ? null
      : schedulePreviewIdleAfterPageIn(incomingLayer, backEntry)
    const forwardPreloadLayer = queueForwardPreloadLayer(targetIndex + 1, 'during Page Next animation')

    previewStatus.textContent = shouldStayOnPageIn
      ? `Playing ${outgoingLayer.file.label} ${frontEntry.animation}; ${incomingLayer.file.label} ${backEntry.animation}; will stay on Page_in.`
      : idleAfterPageIn
      ? `Playing ${outgoingLayer.file.label} ${frontEntry.animation}; ${incomingLayer.file.label} ${backEntry.animation}; idle scheduled after Page_in.`
      : `Playing ${outgoingLayer.file.label} ${frontEntry.animation}; ${incomingLayer.file.label} ${backEntry.animation}.`
    previewAnimatingTurn = { direction: 'next', targetIndex, targetPage }
    dispatchCommandHarnessTurnEvent('tribeCommandHarnessTurnStart', {
      direction: 'next',
      incomingFile: incomingLayer.file.file,
      outgoingFile: outgoingLayer.file.file,
      source,
      targetIndex,
      targetPage,
    })
    console.info('[1Tribe command harness] played page next animations', {
      frontAnimation: frontEntry.animation,
      frontFound: frontEntry.found,
      backAnimation: backEntry.animation,
      backFound: backEntry.found,
      stayOnPageIn: shouldStayOnPageIn,
      idleAfterPageIn,
      outgoing: outgoingLayer.file.label,
      incoming: incomingLayer.file.label,
      preload: forwardPreloadLayer
        ? {
            file: forwardPreloadLayer.file.file,
            index: forwardPreloadLayer.index,
            loaded: forwardPreloadLayer.loaded,
          }
        : null,
      source,
      targetPage,
      holdMs: previewAnimationHoldMs,
    })
    previewSettleTimer = window.setTimeout(settlePreviewNextTurn, previewAnimationHoldMs)
    updateCommandButtons()
    return true
  }

  function runPreviewNextTurn(): boolean {
    const { targetIndex, targetPage } = getPreviewNavigationTarget(1)
    return startPreviewNextTurnToTarget(targetIndex, targetPage, 'command harness next')
  }

  function startPreviewBackTurnToTarget(targetIndex: number, targetPage: number, source: string): boolean {
    const activeIndex = previewActiveLayer?.index ?? previewIndex
    if (targetIndex === activeIndex) {
      const activeFile = previewFiles[activeIndex]
      previewStatus.textContent = `Back Page keeps ${activeFile?.label || 'current spread'} for Epic page ${targetPage}.`
      console.info('[1Tribe command harness] Back Page stays on current Rive file.', {
        activeFile: activeFile?.file || null,
        activeIndex,
        source,
        targetIndex,
        targetPage,
      })
      updateCommandButtons()
      return true
    }

    if (targetIndex < 0) {
      previewStatus.textContent = `Page Back clicked, but ${previewActiveLayer?.file.label || 'the current spread'} is the first file.`
      updateCommandButtons()
      return false
    }

    if (previewNextLayer?.index !== targetIndex) {
      pendingPreviewTurn = { direction: 'back', targetIndex, targetPage }
      queuePreviewLayer(targetIndex, 'previous')
      previewStatus.textContent = `Loading ${previewFiles[targetIndex].label} for Page Back...`
      updateCommandButtons()
      return false
    }

    if (!previewActiveLayer?.loaded || !previewNextLayer?.loaded) {
      pendingPreviewTurn = { direction: 'back', targetIndex, targetPage }
      previewStatus.textContent = `Page Back clicked, but layers are not ready yet.`
      updateCommandButtons()
      return false
    }

    if (previewSettleTimer !== null) window.clearTimeout(previewSettleTimer)
    pendingPreviewTurn = null

    const outgoingLayer = previewActiveLayer
    const incomingLayer = previewNextLayer
    cleanupForwardPreloadLayer()
    outgoingLayer.canvas.style.opacity = '1'
    incomingLayer.canvas.style.opacity = '1'
    incomingLayer.canvas.style.zIndex = '1'
    outgoingLayer.canvas.style.zIndex = '3'

    const outgoingEntry = startCommandHarnessAnimation(
      outgoingLayer,
      previewPageBackAnimation,
      [
        'Page_go back',
        'Page_go_back',
        'Page_Go_Back',
        'Page Go Back',
        'Page_back',
        'Page_Back',
        'PageBack',
        'Page_prev',
        'Page_Prev',
        'Page_Prev02',
        'Page_Prev_02',
        'PagePrev02',
      ],
      `back outgoing ${outgoingLayer.file.label}`,
    )
    const incomingEntry = startCommandHarnessStateMachine(incomingLayer, `back incoming idle ${incomingLayer.file.label}`)

    previewAnimatingTurn = { direction: 'back', targetIndex, targetPage }
    dispatchCommandHarnessTurnEvent('tribeCommandHarnessTurnStart', {
      direction: 'back',
      incomingFile: incomingLayer.file.file,
      outgoingFile: outgoingLayer.file.file,
      source,
      targetIndex,
      targetPage,
    })
    previewStatus.textContent = `Playing back: ${outgoingLayer.file.label} ${
      outgoingEntry.found ? outgoingEntry.animation : 'no matched animation'
    }; ${incomingLayer.file.label} restarted ${incomingEntry.stateMachine}.`
    console.info('[1Tribe command harness] played page back animation and restarted incoming state machine', {
      outgoingAnimation: outgoingEntry.animation,
      outgoingFound: outgoingEntry.found,
      incomingStateMachine: incomingEntry.stateMachine,
      outgoing: outgoingLayer.file.label,
      incoming: incomingLayer.file.label,
      source,
      targetPage,
      holdMs: previewAnimationHoldMs,
    })
    previewSettleTimer = window.setTimeout(settlePreviewBackTurn, previewAnimationHoldMs)
    updateCommandButtons()
    return true
  }

  function runPreviewBackTurn(): boolean {
    const { targetIndex, targetPage } = getPreviewNavigationTarget(-1)
    return startPreviewBackTurnToTarget(targetIndex, targetPage, 'command harness back')
  }

  const initializeTwoLayerPreview = () => {
    if (!isPreviewEnabled) return

    cleanupPreviewLayer(previewActiveLayer)
    cleanupPreviewLayer(previewNextLayer)
    cleanupForwardPreloadLayer()
    previewActiveLayer = createPreviewLayer(previewIndex, previewCanvas, 'active')
    previewNextLayer = null
    queueForwardPreviewLayer(previewCanvasAlt)
    previewStatus.textContent = `Loading active ${previewFiles[previewIndex]?.label || 'spread'}...`
    updateCommandButtons()
  }

  const resizePreview = () => {
    scheduleCommandHarnessFrameResizeSync('window resize')
  }

  const getPreviewAnimationName = (instance: Rive, requestedName: string, aliases: string[]): string | null => {
    const candidates = [requestedName, ...aliases]
    const candidateKeys = candidates.map(normalizeRiveNameForMatch)
    const artboards = instance.contents?.artboards || []
    for (const artboard of artboards) {
      const animation = (artboard.animations || []).find((name) => candidateKeys.includes(normalizeRiveNameForMatch(name)))
      if (animation) return animation
    }
    return null
  }

  const getPreviewStateMachineInput = (
    requestedName: string,
    aliases: string[],
  ): { input: CommandHarnessStateMachineInput | null; inputs: CommandHarnessStateMachineInput[] } => {
    if (!previewRive || !previewStateMachine) return { input: null, inputs: [] }

    let inputs: CommandHarnessStateMachineInput[] = []
    try {
      inputs = (previewRive.stateMachineInputs(previewStateMachine) || []) as CommandHarnessStateMachineInput[]
    } catch (error) {
      console.info('[1Tribe command harness] Could not read preview state machine inputs.', {
        error,
        previewStateMachine,
        requestedName,
      })
      return { input: null, inputs: [] }
    }

    const candidates = Array.from(
      new Set([
        requestedName,
        ...aliases,
        ...getRiveAnimationInputNameCandidates(requestedName),
        ...aliases.flatMap((alias) => getRiveAnimationInputNameCandidates(alias)),
      ]),
    )
    const candidateKeys = candidates.map(normalizeRiveNameForMatch)
    const input = inputs.find((item) => candidateKeys.includes(normalizeRiveNameForMatch(item.name))) || null
    return { input, inputs }
  }

  const firePreviewStateMachineInput = (requestedName: string, aliases: string[], label: string): string | null => {
    const { input, inputs } = getPreviewStateMachineInput(requestedName, aliases)
    if (!input) {
      console.info('[1Tribe command harness] Preview state machine input was not found.', {
        requestedName,
        aliases,
        availableInputs: inputs.map((item) => ({ name: item.name, type: item.type })),
        label,
        previewStateMachine,
      })
      return null
    }

    if ((input.type === 2 || typeof input.fire === 'function') && typeof input.fire === 'function') {
      input.fire()
      console.info('[1Tribe command harness] Preview state machine trigger fired.', {
        input: input.name,
        label,
        previewStateMachine,
      })
      return input.name
    }

    if (input.type === 1 || typeof input.value === 'boolean') {
      input.value = true
      window.setTimeout(() => {
        input.value = false
      }, previewInputResetMs)
      console.info('[1Tribe command harness] Preview state machine boolean pulsed.', {
        input: input.name,
        label,
        resetMs: previewInputResetMs,
        previewStateMachine,
      })
      return input.name
    }

    console.info('[1Tribe command harness] Preview state machine input was not trigger/boolean.', {
      input: input.name,
      inputType: input.type,
      label,
      previewStateMachine,
    })
    return null
  }

  const bindPreviewViewModelInstance = (instance: Rive): boolean => {
    if (instance.viewModelInstance) return true

    try {
      const viewModelInstance = instance.defaultViewModel()?.defaultInstance()
      if (viewModelInstance) {
        instance.bindViewModelInstance(viewModelInstance)
      }
    } catch (error) {
      console.info('[1Tribe command harness] Could not bind default ViewModel instance.', {
        error,
      })
    }

    return Boolean(instance.viewModelInstance)
  }

  const getPreviewViewModelPropertyPaths = (
    viewModelInstance: ViewModelInstance | null | undefined,
    maxDepth = 4,
  ): SimpleRiveViewModelPropertyPath[] => {
    const paths: SimpleRiveViewModelPropertyPath[] = []

    const visit = (instance: ViewModelInstance, prefix: string, depth: number) => {
      for (const property of instance.properties || []) {
        const name = typeof property.name === 'string' ? property.name : ''
        if (!name) continue

        const path = prefix ? `${prefix}/${name}` : name
        const type = typeof property.type === 'string' ? property.type : String(property.type || '')
        paths.push({ path, name, type, depth })

        if (depth >= maxDepth) continue

        try {
          const child = instance.viewModel(name)
          if (child) visit(child, path, depth + 1)
        } catch {
          // Non-view-model properties throw/null here; keep walking siblings.
        }
      }
    }

    if (viewModelInstance) visit(viewModelInstance, '', 0)
    return paths
  }

  const getPreviewViewModelPathLeafName = (propertyPath: string) =>
    propertyPath.split('/').filter(Boolean).at(-1) || propertyPath

  const firePreviewViewModelInput = (requestedName: string, aliases: string[], label: string): string | null => {
    if (!previewRive || !bindPreviewViewModelInstance(previewRive) || !previewRive.viewModelInstance) {
      console.info('[1Tribe command harness] Preview ViewModel input skipped: no ViewModel instance is bound.', {
        requestedName,
        aliases,
        label,
      })
      return null
    }

    const candidates = Array.from(
      new Set([
        requestedName,
        ...aliases,
        ...getRiveAnimationInputNameCandidates(requestedName),
        ...aliases.flatMap((alias) => getRiveAnimationInputNameCandidates(alias)),
      ]),
    )
    const candidateKeys = candidates.map(normalizeRiveNameForMatch)
    const wantsNext = candidateKeys.some((key) =>
      ['pagenext', 'next', 'pageforward', 'forward', 'pageout'].includes(key),
    )
    const wantsBack = candidateKeys.some((key) =>
      ['pageprev', 'prev', 'pageprevious', 'previous', 'pageback', 'back', 'pagegoback', 'goback'].includes(key),
    )
    const wantsIn = candidateKeys.some((key) => ['pagein', 'in'].includes(key))
    const properties = getPreviewViewModelPropertyPaths(previewRive.viewModelInstance)
    const matches = properties.filter((property) => {
      const leaf = getPreviewViewModelPathLeafName(property.path)
      const leafKey = normalizeRiveNameForMatch(leaf)
      const pathKey = normalizeRiveNameForMatch(property.path)
      if (candidateKeys.includes(leafKey) || candidateKeys.includes(pathKey)) return true
      if (wantsNext && leafKey.startsWith('next')) return true
      if (wantsBack && (leafKey.startsWith('back') || leafKey.startsWith('prev'))) return true
      if (wantsIn && (leafKey === 'pagein' || leafKey === 'in')) return true
      return false
    })

    console.info('[1Tribe command harness] Checked preview ViewModel inputs.', {
      requestedName,
      aliases,
      candidates,
      label,
      matchedPaths: matches.map((property) => `${property.path}:${property.type}`),
      availablePaths: properties.map((property) => `${property.path}:${property.type}`),
    })

    const firedPaths: string[] = []
    for (const property of matches) {
      try {
        const trigger = previewRive.viewModelInstance.trigger(property.path)
        if (trigger) {
          trigger.trigger()
          firedPaths.push(`${property.path}:trigger`)
          continue
        }
      } catch {
        // Try boolean fallback for this path.
      }

      try {
        const booleanValue = previewRive.viewModelInstance.boolean(property.path)
        if (booleanValue) {
          booleanValue.value = true
          window.setTimeout(() => {
            try {
              booleanValue.value = false
            } catch {
              // Ignore stale bindings after a preview swap.
            }
          }, previewInputResetMs)
          firedPaths.push(`${property.path}:boolean`)
        }
      } catch {
        // Not a boolean path.
      }
    }

    if (!firedPaths.length) return null

    console.info('[1Tribe command harness] Preview ViewModel inputs fired.', {
      firedPaths,
      label,
      requestedName,
      resetMs: previewInputResetMs,
    })
    return firedPaths.join(', ')
  }

  const playCurrentPreviewAnimation = (requestedName: string, aliases: string[], label: string): string | null => {
    if (!previewRive) {
      console.info('[1Tribe command harness] Preview animation skipped: no preview Rive is loaded.', {
        requestedName,
        label,
      })
      return null
    }

    const firedInput = firePreviewStateMachineInput(requestedName, aliases, label)
    if (firedInput) {
      previewStatus.textContent = `Fired ${firedInput} on ${previewFiles[previewIndex]?.label || 'preview'}.`
      return firedInput
    }

    const firedViewModelInput = firePreviewViewModelInput(requestedName, aliases, label)
    if (firedViewModelInput) {
      previewStatus.textContent = `Fired ${firedViewModelInput} on ${previewFiles[previewIndex]?.label || 'preview'}.`
      return firedViewModelInput
    }

    const animation = getPreviewAnimationName(previewRive, requestedName, aliases)
    if (!animation) {
      console.info('[1Tribe command harness] Preview animation was not found.', {
        requestedName,
        aliases,
        label,
        availableAnimations: listSimpleRiveAnimations(previewRive.contents || {}),
        stateMachine: previewStateMachine,
      })
      return null
    }

    previewRive.play(animation)
    previewStatus.textContent = `Played ${animation} on ${previewFiles[previewIndex]?.label || 'preview'}.`
    console.info('[1Tribe command harness] Preview animation played.', {
      requestedName,
      animation,
      label,
      previewIndex,
      file: previewFiles[previewIndex]?.file || null,
    })
    return animation
  }

  const loadPreviewAtIndex = (
    requestedIndex: number,
    reason: string,
    direction: CommandHarnessTransitionDirection = null,
  ) => {
    if (!isPreviewEnabled) return

    const nextIndex = Math.max(0, Math.min(previewFiles.length - 1, requestedIndex))
    const previewFile = previewFiles[nextIndex]
    const serial = ++previewLoadSerial
    previewIndex = nextIndex
    previewRive?.cleanup()
    previewRive = null
    previewStateMachine = null
    previewCanvas.getContext('2d')?.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
    previewStatus.textContent = `Loading ${previewFile.label}...`
    setCommandHarnessLoadingIndicator(true)
    resizeCanvasToOwnBounds(previewCanvas, getEffectivePixelRatio(previewStage))

    try {
      const instance = new Rive({
        src: new URL(previewFile.file, extensionScriptUrl).href,
        canvas: previewCanvas,
        autoplay: false,
        autoBind: true,
        automaticallyHandleEvents: false,
        enableRiveAssetCDN: false,
        layout: createCommandHarnessPreviewLayout(),
        onLoad() {
          if (serial !== previewLoadSerial) return
          previewRive = instance
          resizePreview()
          bindPreviewViewModelInstance(instance)
          const stateMachineEntry = resolveCommandHarnessStateMachine(instance, previewFile)
          const stateMachineNames = getCommandHarnessStateMachineDebugNames(instance)
          const stateMachine = stateMachineEntry.stateMachine || null
          if (stateMachine) instance.play(stateMachine)
          previewStateMachine = stateMachine
          const pageInInput =
            shouldPlayPreviewPageIn && reason !== 'initial' && direction !== -1
              ? playCurrentPreviewAnimation(previewPageInAnimation, ['Page_in', 'Page_In', 'Page In', 'PageIn'], 'incoming page in')
              : null
          const pageInAnimation = pageInInput
            ? null
            : shouldPlayPreviewPageIn && reason !== 'initial' && direction !== -1
              ? getPreviewAnimationName(instance, previewPageInAnimation, ['Page_in', 'Page_In', 'Page In', 'PageIn'])
              : null
          const backIdleAnimation =
            direction === -1
              ? getPreviewAnimationName(instance, previewBackIdleAnimation, [
                  'Page_idle',
                  'Page_Idle',
                  'Page idle',
                  'PageIdle',
                  'idle',
                  'Idle',
                ])
              : null
          if (pageInAnimation) {
            instance.play(pageInAnimation)
          } else if (backIdleAnimation) {
            instance.play(backIdleAnimation)
          }
          previewStatus.textContent = pageInInput
            ? `Showing ${previewFile.label}; fired ${pageInInput}.`
            : pageInAnimation
            ? `Showing ${previewFile.label}; played ${pageInAnimation}.`
            : backIdleAnimation
              ? `Showing ${previewFile.label}; played ${backIdleAnimation}.`
              : `Showing ${previewFile.label}.`
          setCommandHarnessLoadingIndicator(false)
          console.info('[1Tribe command harness] Rive preview loaded.', {
            file: previewFile.file,
            index: previewIndex,
            reason,
            direction,
            requestedStateMachine: previewFile.stateMachine,
            stateMachine,
            stateMachineNames,
            stateMachineEntry,
            requestedPageInAnimation: previewPageInAnimation,
            pageInInput,
            pageInAnimation,
            requestedBackIdleAnimation: previewBackIdleAnimation,
            backIdleAnimation,
          })
        },
        onLoadError(event) {
          previewStatus.textContent = `Rive preview failed: ${String(event?.data || 'unknown error')}`
          setCommandHarnessLoadingIndicator(true)
          console.warn('[1Tribe command harness] Rive preview failed.', {
            file: previewFile.file,
            index: previewIndex,
            reason,
            direction,
            stateMachine: previewFile.stateMachine,
            event,
          })
        },
      })
      previewRive = instance
    } catch (error) {
      previewStatus.textContent = `Rive preview failed: ${String(error)}`
      setCommandHarnessLoadingIndicator(true)
      console.warn('[1Tribe command harness] Could not create passive Rive preview.', error)
    }
  }

  const loadPreviewForReaderPage = (
    page: number,
    reason: string,
    direction: CommandHarnessTransitionDirection = null,
  ) => {
    const nextIndex = getPreviewIndexForReaderPage(page)
    if (previewRive && nextIndex === previewIndex) {
      const previewFile = previewFiles[previewIndex]
      previewStatus.textContent = `Showing ${previewFile.label} for Epic page ${page}.`
      console.info('[1Tribe command harness] Rive preview already aligned.', {
        file: previewFile.file,
        index: previewIndex,
        page,
        reason,
        direction,
      })
      return
    }

    loadPreviewAtIndex(nextIndex, `${reason}; reader page ${page}`, direction)
  }

  const clearPendingPreviewSwapTimer = () => {
    if (pendingPreviewSwapTimer === null) return
    window.clearTimeout(pendingPreviewSwapTimer)
    pendingPreviewSwapTimer = null
  }

  const schedulePreviewForReaderPage = (
    page: number,
    reason: string,
    direction: CommandHarnessTransitionDirection = null,
  ) => {
    clearPendingPreviewSwapTimer()
    const delayMs = Math.max(0, previewSwapHoldUntil - Date.now())
    if (delayMs > 0) {
      previewStatus.textContent = `Holding ${previewFiles[previewIndex]?.label || 'preview'} for animation...`
      pendingPreviewSwapTimer = window.setTimeout(() => {
        pendingPreviewSwapTimer = null
        loadPreviewForReaderPage(page, `${reason}; delayed ${Math.round(delayMs)}ms for animation`, direction)
      }, delayMs)
      console.info('[1Tribe command harness] Delayed preview swap for outgoing animation.', {
        page,
        reason,
        direction,
        delayMs,
        currentFile: previewFiles[previewIndex]?.file || null,
      })
      return
    }

    loadPreviewForReaderPage(page, reason, direction)
  }

  if (isPreviewEnabled) {
    initializeTwoLayerPreview()
    scheduleCommandHarnessFrameResizeSync('initial mount')
  }
  window.addEventListener('resize', resizePreview)

  const debugWindow = window as TribeDebugWindow
  const shouldExposeCommandHarnessDebugGlobals = shouldExposeDebugGlobals()
  const releaseCommandHarnessForCompletion = (reason = 'manual completion release') => {
    commandHarnessCompletionRiveReleased = true
    return setCommandHarnessCompletionHandoff(true, reason, {
      finalRiveReleased: true,
      trigger: 'manual',
    })
  }
  const restoreCommandHarnessOverlay = (reason = 'manual restore') =>
    setCommandHarnessCompletionHandoff(false, reason, { trigger: 'manual' })
  if (shouldExposeCommandHarnessDebugGlobals) {
    debugWindow.tribeCommandHarnessNextPage = runNextPage
    debugWindow.tribeCommandHarnessPreviousPage = runPreviousPage
    debugWindow.tribeCommandHarnessSetCanvasBleed = setCommandHarnessCanvasBleed
    debugWindow.tribeCommandHarnessSetPreviewFit = setCommandHarnessPreviewFit
    debugWindow.tribeEpicNativePassthroughDebug = getCommandHarnessNativePassthroughDebug
    debugWindow.tribeCommandHarnessCompletionDebug = getCommandHarnessCompletionDebug
    debugWindow.tribeCommandHarnessReleaseForCompletion = releaseCommandHarnessForCompletion
    debugWindow.tribeCommandHarnessRestoreOverlay = restoreCommandHarnessOverlay
  }
  document.addEventListener('click', handleCommandHarnessCompletionClick, true)
  startCommandHarnessCompletionObserver()
  scheduleCommandHarnessCompletionCheck('initial completion scan', 500)
  const cleanupPageChange = context.events.on('pageChange', (payload) => {
    setStatusForPageChange(payload, 'pageChange')
  })

  context.analytics.log('1tribe_command_harness_activated', {
    activeBookId: activeBookConfig.bookId,
    activeBookTitle: activeBookConfig.title,
    bookId: context.data.getBookId(),
    page: context.data.getCurrentPage(),
    previewFileCount: previewFiles.length,
  })
  console.info(
    shouldExposeCommandHarnessDebugGlobals
      ? '[1Tribe command harness] Ready. Run tribeCommandHarnessNextPage(), tribeCommandHarnessPreviousPage(), or click a button.'
      : '[1Tribe command harness] Ready.',
    {
      activeBookId: activeBookConfig.bookId,
      activeBookTitle: activeBookConfig.title,
      previewFileCount: previewFiles.length,
    },
  )

  return () => {
    if (debugWindow.tribeCommandHarnessNextPage === runNextPage) {
      delete debugWindow.tribeCommandHarnessNextPage
    }
    if (debugWindow.tribeCommandHarnessPreviousPage === runPreviousPage) {
      delete debugWindow.tribeCommandHarnessPreviousPage
    }
    if (debugWindow.tribeCommandHarnessSetCanvasBleed === setCommandHarnessCanvasBleed) {
      delete debugWindow.tribeCommandHarnessSetCanvasBleed
    }
    if (debugWindow.tribeCommandHarnessSetPreviewFit === setCommandHarnessPreviewFit) {
      delete debugWindow.tribeCommandHarnessSetPreviewFit
    }
    if (debugWindow.tribeEpicNativePassthroughDebug === getCommandHarnessNativePassthroughDebug) {
      delete debugWindow.tribeEpicNativePassthroughDebug
    }
    if (debugWindow.tribeCommandHarnessCompletionDebug === getCommandHarnessCompletionDebug) {
      delete debugWindow.tribeCommandHarnessCompletionDebug
    }
    if (debugWindow.tribeCommandHarnessReleaseForCompletion === releaseCommandHarnessForCompletion) {
      delete debugWindow.tribeCommandHarnessReleaseForCompletion
    }
    if (debugWindow.tribeCommandHarnessRestoreOverlay === restoreCommandHarnessOverlay) {
      delete debugWindow.tribeCommandHarnessRestoreOverlay
    }
    document.removeEventListener('click', handleCommandHarnessCompletionClick, true)
    if (commandHarnessCompletionCheckTimer !== null) {
      window.clearTimeout(commandHarnessCompletionCheckTimer)
      commandHarnessCompletionCheckTimer = null
    }
    commandHarnessCompletionObserver?.disconnect()
    commandHarnessCompletionObserver = null
    clearCommandHarnessReadAgainRestoreTimer()
    commandHarnessReadAgainRestorePending = false
    commandHarnessReadAgainRestoreTarget = null
    clearCommandHarnessFrameResizeTimers()
    commandHarnessFrameResizeObserver?.disconnect()
    commandHarnessFrameResizeObserver = null
    commandHarnessFrameResizeObservedHost = null
    commandHarnessFrameResizeObservedReader = null
    window.removeEventListener('resize', resizePreview)
    cleanupBackEdgeGutterListeners()
    cleanupNextEdgeGutterListeners()
    clearPendingPreviewSwapTimer()
    clearCommandHarnessSliderSettle()
    if (previewLoadingFadeTimer !== null) window.clearTimeout(previewLoadingFadeTimer)
    previewLoadingFadeTimer = null
    if (previewSettleTimer !== null) window.clearTimeout(previewSettleTimer)
    previewSettleTimer = null
    pendingPreviewTurn = null
    pendingPreviewEpicCommand = null
    deferredPreviewEpicCommand = null
    deferredPreviewEpicTargetPage = null
    deferredPreviewEpicUseGoToPage = false
    clearPreviewIdleAfterPageIn()
    clearPreviewStateMachineAfterIdle()
    cleanupPreviewLayer(previewActiveLayer)
    cleanupPreviewLayer(previewNextLayer)
    cleanupForwardPreloadLayer()
    previewActiveLayer = null
    previewNextLayer = null
    previewRive?.cleanup()
    previewStateMachine = null
    cleanupPageChange()
    edgeBackGutter.remove()
    edgeNextGutter.remove()
    previewLoading.remove()
    previewStage.remove()
    root.remove()
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function fetchRiveBuffer(
  url: string,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number | null) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading ${url}`)
  }

  const totalHeader = response.headers.get('Content-Length')
  const total = totalHeader ? Number(totalHeader) : null

  if (!response.body) {
    const buffer = await response.arrayBuffer()
    onProgress(buffer.byteLength, buffer.byteLength)
    return buffer
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    chunks.push(value)
    loaded += value.byteLength
    onProgress(loaded, total)
  }

  const bytes = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return bytes.buffer
}

function getSpreadForPage(page: number): SpreadConfig {
  return SPREADS.find((spread) => page >= spread.pages[0] && page <= spread.pages[1]) || SPREADS[0]
}

function getSpreadSource(spread: SpreadConfig): string {
  return new URL(spread.file, extensionScriptUrl).href
}

function syncReaderInputs(rive: Rive, stateMachineName: string | null, context: ExtensionContext): void {
  if (!stateMachineName) return

  const inputs = rive.stateMachineInputs(stateMachineName)
  for (const input of inputs) {
    if (input.name === 'page' || input.name === 'currentPage' || input.name === 'bookPage') {
      input.value = context.data.getCurrentPage()
    }

    if (input.name === 'bookId') {
      input.value = context.data.getBookId() || 0
    }
  }
}

function getReaderCompletionDebug(context: ExtensionContext, currentPage: number): ReaderCompletionDebug {
  const bookData = context.data.getBookData() || {}
  const suspectedCompletionFields: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(bookData)) {
    if (/(complete|completion|progress|finish|finished|last|read|current|page)/i.test(key)) {
      suspectedCompletionFields[key] = value
    }
  }

  return {
    currentPage,
    bookDataId: bookData.id,
    numPages: bookData.numPages,
    suspectedCompletionFields,
    labsDataPresent: Boolean(context.data.getLabsData()),
  }
}

function logPageMappingDebug(
  context: ExtensionContext,
  details: {
    readerPage: number
    reason: string
    matchedFile?: SimpleRiveFile | null
    playbackTriggered: boolean
    animation?: string | null
    stateMachine?: string | null
    artboard?: string | null
    note?: string
  },
): void {
  console.info('[1Tribe page map]', {
    bookId: context.data.getBookId(),
    mappedBookId: getSimpleRiveBookIdFromContext(context),
    readerPage: details.readerPage,
    reason: details.reason,
    matchedRiveFile: details.matchedFile?.name || null,
    matchedRiveUrl: details.matchedFile?.url || null,
    mappedReaderPages: details.matchedFile?.readerPages || null,
    rivePages: details.matchedFile?.pages || null,
    animation: details.animation ?? details.matchedFile?.animation ?? null,
    stateMachine: details.stateMachine ?? details.matchedFile?.stateMachine ?? null,
    artboard: details.artboard ?? details.matchedFile?.artboard ?? null,
    playbackTriggered: details.playbackTriggered,
    readerCompletion: getReaderCompletionDebug(context, details.readerPage),
    note: details.note,
  })
}

function positionFrame(frame: HTMLElement, rect: FlipBookRect | null, readingRoot: ShadowRoot): void {
  const host = readingRoot.host
  if (!rect || !(host instanceof HTMLElement)) {
    frame.style.cssText = 'position:absolute;inset:0;pointer-events:auto;'
    return
  }

  const hostRect = host.getBoundingClientRect()
  frame.style.cssText = [
    'position:absolute',
    `left:${rect.x - hostRect.x}px`,
    `top:${rect.y - hostRect.y}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    'pointer-events:auto',
  ].join(';')
}

function getEffectivePixelRatio(frame: HTMLElement): number {
  const rect = frame.getBoundingClientRect()
  const baseRatio = Math.max(0.1, runtimeConfig.pixelRatio)
  const maxPixels = runtimeConfig.maxCanvasPixels
  const cssPixels = Math.max(1, rect.width * rect.height)
  const maxRatio = Math.sqrt(maxPixels / cssPixels)

  return Math.max(0.1, Math.min(baseRatio, maxRatio))
}

function resizeCanvasToFrame(canvas: HTMLCanvasElement, frame: HTMLElement, pixelRatio: number): void {
  const rect = frame.getBoundingClientRect()
  const ratio = Math.max(0.1, pixelRatio)
  const width = Math.max(1, Math.round(rect.width * ratio))
  const height = Math.max(1, Math.round(rect.height * ratio))

  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
}

function resizeCanvasToOwnBounds(canvas: HTMLCanvasElement, pixelRatio: number): void {
  const rect = canvas.getBoundingClientRect()
  const ratio = Math.max(0.1, pixelRatio)
  const width = Math.max(1, Math.round(rect.width * ratio))
  const height = Math.max(1, Math.round(rect.height * ratio))

  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
}

function getWordHotspotOcrUrl(hotspotFile: WordHotspotFile, manifestUrl: string): string | null {
  const ocrPath =
    hotspotFile.ocr ||
    (hotspotFile.file ? `${normalizeWordHotspotFileName(hotspotFile.file).replace(/\.riv$/i, '')}.ocr.json` : '')
  if (!ocrPath) return null

  try {
    return new URL(normalizeWordHotspotFileName(ocrPath), manifestUrl).href
  } catch {
    return null
  }
}

function normalizeWordHotspotPages(pages: WordHotspotFile['pages']): number[] {
  const values = Array.isArray(pages) ? pages : pages === undefined || pages === null ? [] : [pages]

  return Array.from(
    new Set(
      values
        .map((page) => Number(page))
        .filter((page) => Number.isFinite(page))
        .map((page) => Math.trunc(page)),
    ),
  ).sort((first, second) => first - second)
}

function convertOcrToWordHotspotFile(
  ocr: WordHotspotOcrFile,
  hotspotFile: WordHotspotFile,
  manifest: WordHotspotManifest,
): WordHotspotFile | null {
  const width = Number(ocr.width || manifest.render?.width)
  const height = Number(ocr.height || manifest.render?.height)
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null

  const words = (ocr.words || [])
    .map((word): WordHotspotWord | null => {
      const text = String(word.text || '').trim()
      const x = Number(word.x ?? word.bbox?.x)
      const y = Number(word.y ?? word.bbox?.y)
      const wordWidth = Number(word.width ?? word.bbox?.width)
      const wordHeight = Number(word.height ?? word.bbox?.height)
      if (!text) return null
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(wordWidth) ||
        !Number.isFinite(wordHeight) ||
        wordWidth <= 0 ||
        wordHeight <= 0
      ) {
        return null
      }

      return {
        text,
        normalized: {
          x: x / width,
          y: y / height,
          width: wordWidth / width,
          height: wordHeight / height,
        },
      }
    })
    .filter((word): word is WordHotspotWord => Boolean(word))

  if (!words.length) return null

  return {
    ...hotspotFile,
    source: 'ocr-sidecar',
    sourceDetail: {
      height,
      width,
      words: words.length,
    },
    text: ocr.text || words.map((word) => word.text).filter(Boolean).join(' '),
    words,
  }
}

async function getWordHotspotFileWithOcrSidecar(
  hotspotFile: WordHotspotFile,
  manifest: WordHotspotManifest,
  manifestUrl: string,
  signal: AbortSignal,
): Promise<WordHotspotFile | null> {
  const ocrUrl = getWordHotspotOcrUrl(hotspotFile, manifestUrl)
  if (!ocrUrl) return null

  try {
    const response = await fetch(`${ocrUrl}${ocrUrl.includes('?') ? '&' : '?'}ts=${Date.now()}`, {
      cache: 'no-store',
      signal,
    })
    if (!response.ok) {
      console.info(`[1Tribe word hotspots] OCR sidecar not available: ${ocrUrl} HTTP ${response.status}`)
      return null
    }

    const ocr = (await response.json()) as WordHotspotOcrFile
    const ocrHotspotFile = convertOcrToWordHotspotFile(ocr, hotspotFile, manifest)
    if (!ocrHotspotFile) return null

    console.info('[1Tribe word hotspots] Using OCR sidecar for word hotspots.', {
      file: hotspotFile.file,
      ocrUrl,
      words: ocrHotspotFile.words?.length || 0,
    })
    return ocrHotspotFile
  } catch (error) {
    if (!signal.aborted) {
      console.warn(`[1Tribe word hotspots] Unable to load OCR sidecar ${ocrUrl}: ${String(error)}`)
    }
    return null
  }
}

function getPageRange(startPage: number, endPage: number): number[] {
  const start = Math.trunc(Math.min(startPage, endPage))
  const end = Math.trunc(Math.max(startPage, endPage))
  const pages: number[] = []
  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }
  return pages
}

function getManifestFileByName(manifest: WordHotspotManifest, fileName: string): WordHotspotFile | null {
  const normalizedFileName = normalizeWordHotspotFileName(fileName)
  return (
    manifest.files?.find((file) => normalizeWordHotspotFileName(String(file.file || '')) === normalizedFileName) ||
    null
  )
}

function getConfiguredWordHotspotFileForPage(
  context: ExtensionContext,
  page: number,
  manifest: WordHotspotManifest,
): WordHotspotFile | null {
  const bookConfig = getEpicTribeBookConfig(context.data.getBookId())
  const previewFile = bookConfig?.previewFiles.find((file) => page >= file.readerStart && page <= file.readerEnd)
  if (!previewFile) return null

  const fileName = normalizeWordHotspotFileName(previewFile.file)
  const manifestFile = getManifestFileByName(manifest, fileName)
  const manifestPages = normalizeWordHotspotPages(manifestFile?.pages)
  return {
    ...(manifestFile || {}),
    file: fileName,
    pages: manifestPages.length ? manifestPages : getPageRange(previewFile.readerStart, previewFile.readerEnd),
    render: manifestFile?.render || manifest.render,
  }
}

function getFiniteWordHotspotBounds(bounds: WordHotspotBounds | undefined): Required<WordHotspotBounds> | null {
  const x = Number(bounds?.x)
  const y = Number(bounds?.y)
  const width = Number(bounds?.width)
  const height = Number(bounds?.height)
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

  return { x, y, width, height }
}

function getAdjustedWordHotspotBounds(
  bounds: WordHotspotBounds | undefined,
  contentBounds: WordHotspotBounds | undefined,
): Required<WordHotspotBounds> | null {
  const x = Number(bounds?.x)
  const y = Number(bounds?.y)
  const width = Number(bounds?.width)
  const height = Number(bounds?.height)
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null
  }

  const contentX = Number(contentBounds?.x)
  const contentY = Number(contentBounds?.y)
  const contentWidth = Number(contentBounds?.width)
  const contentHeight = Number(contentBounds?.height)
  if (
    !Number.isFinite(contentX) ||
    !Number.isFinite(contentY) ||
    !Number.isFinite(contentWidth) ||
    !Number.isFinite(contentHeight) ||
    contentWidth <= 0 ||
    contentHeight <= 0
  ) {
    return { x, y, width, height }
  }

  return {
    x: (x - contentX) / contentWidth,
    y: (y - contentY) / contentHeight,
    width: width / contentWidth,
    height: height / contentHeight,
  }
}

function clampWordHotspotBoundsToUnitFrame(bounds: Required<WordHotspotBounds>): Required<WordHotspotBounds> | null {
  const left = Math.max(0, Number(bounds.x))
  const top = Math.max(0, Number(bounds.y))
  const right = Math.min(1, Number(bounds.x) + Number(bounds.width))
  const bottom = Math.min(1, Number(bounds.y) + Number(bounds.height))
  const width = right - left
  const height = bottom - top
  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null
  }

  return { x: left, y: top, width, height }
}

function transformWordHotspotBounds(
  bounds: Required<WordHotspotBounds>,
  transform: {
    offsetX: number
    offsetY: number
    frameScaleX: number
    frameScaleY: number
    scaleX: number
    scaleY: number
  },
): Required<WordHotspotBounds> | null {
  const frameScaleX = Number.isFinite(transform.frameScaleX) && transform.frameScaleX > 0 ? transform.frameScaleX : 1
  const frameScaleY = Number.isFinite(transform.frameScaleY) && transform.frameScaleY > 0 ? transform.frameScaleY : 1
  const scaleX = Number.isFinite(transform.scaleX) && transform.scaleX > 0 ? transform.scaleX : 1
  const scaleY = Number.isFinite(transform.scaleY) && transform.scaleY > 0 ? transform.scaleY : 1
  const offsetX = Number.isFinite(transform.offsetX) ? transform.offsetX : 0
  const offsetY = Number.isFinite(transform.offsetY) ? transform.offsetY : 0
  const frameScaledBounds = clampWordHotspotBoundsToUnitFrame({
    x: 0.5 + (bounds.x - 0.5) * frameScaleX + offsetX,
    y: 0.5 + (bounds.y - 0.5) * frameScaleY + offsetY,
    width: bounds.width * frameScaleX,
    height: bounds.height * frameScaleY,
  })
  if (!frameScaledBounds) return null

  const centerX = frameScaledBounds.x + frameScaledBounds.width / 2
  const centerY = frameScaledBounds.y + frameScaledBounds.height / 2
  const width = frameScaledBounds.width * scaleX
  const height = frameScaledBounds.height * scaleY

  return clampWordHotspotBoundsToUnitFrame({
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  })
}

function isLargeWordHotspotBounds(bounds: Required<WordHotspotBounds>): boolean {
  return bounds.width >= 0.18 || bounds.height >= 0.08
}

function getWordHotspotContentBoundsForPage(
  hotspotFile: WordHotspotFile,
  manifest: WordHotspotManifest,
  page: number,
): WordHotspotBounds | undefined {
  const pageKey = String(Math.trunc(page))
  return (
    hotspotFile.contentBoundsByPage?.[pageKey] ||
    hotspotFile.render?.contentBoundsByPage?.[pageKey] ||
    manifest.render?.contentBoundsByPage?.[pageKey] ||
    hotspotFile.contentBounds ||
    hotspotFile.render?.contentBounds ||
    manifest.render?.contentBounds
  )
}

function getWordHotspotRenderSize(
  manifest: WordHotspotManifest | null | undefined,
  hotspotFile: WordHotspotFile | null | undefined,
  fallback: WordHotspotRenderSize,
): WordHotspotRenderSize {
  const fileWidth = Number(hotspotFile?.render?.width)
  const fileHeight = Number(hotspotFile?.render?.height)
  if (Number.isFinite(fileWidth) && fileWidth > 0 && Number.isFinite(fileHeight) && fileHeight > 0) {
    return { width: fileWidth, height: fileHeight }
  }

  const manifestWidth = Number(manifest?.render?.width)
  const manifestHeight = Number(manifest?.render?.height)
  if (Number.isFinite(manifestWidth) && manifestWidth > 0 && Number.isFinite(manifestHeight) && manifestHeight > 0) {
    return { width: manifestWidth, height: manifestHeight }
  }

  return fallback
}

function getContainedRectForRenderSize(
  frameRect: DOMRect,
  renderSize: WordHotspotRenderSize,
): { x: number; y: number; width: number; height: number } {
  const renderWidth = Number(renderSize.width)
  const renderHeight = Number(renderSize.height)
  if (
    !Number.isFinite(renderWidth) ||
    !Number.isFinite(renderHeight) ||
    renderWidth <= 0 ||
    renderHeight <= 0 ||
    frameRect.width <= 0 ||
    frameRect.height <= 0
  ) {
    return {
      x: frameRect.x,
      y: frameRect.y,
      width: frameRect.width,
      height: frameRect.height,
    }
  }

  const renderAspect = renderWidth / renderHeight
  const frameAspect = frameRect.width / frameRect.height
  if (frameAspect > renderAspect) {
    const containedWidth = frameRect.height * renderAspect
    return {
      x: frameRect.x + (frameRect.width - containedWidth) / 2,
      y: frameRect.y,
      width: containedWidth,
      height: frameRect.height,
    }
  }

  const containedHeight = frameRect.width / renderAspect
  return {
    x: frameRect.x,
    y: frameRect.y + (frameRect.height - containedHeight) / 2,
    width: frameRect.width,
    height: containedHeight,
  }
}

function getCoveredRectForRenderSize(
  frameRect: DOMRect,
  renderSize: WordHotspotRenderSize,
): { x: number; y: number; width: number; height: number } {
  const renderWidth = Number(renderSize.width)
  const renderHeight = Number(renderSize.height)
  if (
    !Number.isFinite(renderWidth) ||
    !Number.isFinite(renderHeight) ||
    renderWidth <= 0 ||
    renderHeight <= 0 ||
    frameRect.width <= 0 ||
    frameRect.height <= 0
  ) {
    return {
      x: frameRect.x,
      y: frameRect.y,
      width: frameRect.width,
      height: frameRect.height,
    }
  }

  const renderAspect = renderWidth / renderHeight
  const frameAspect = frameRect.width / frameRect.height
  if (frameAspect > renderAspect) {
    const coveredHeight = frameRect.width / renderAspect
    return {
      x: frameRect.x,
      y: frameRect.y + (frameRect.height - coveredHeight) / 2,
      width: frameRect.width,
      height: coveredHeight,
    }
  }

  const coveredWidth = frameRect.height * renderAspect
  return {
    x: frameRect.x + (frameRect.width - coveredWidth) / 2,
    y: frameRect.y,
    width: coveredWidth,
    height: frameRect.height,
  }
}

function getFittedRectForRenderSize(
  frameRect: DOMRect,
  renderSize: WordHotspotRenderSize,
  fit: string | null | undefined,
): { x: number; y: number; width: number; height: number } {
  switch ((fit || '').trim().toLowerCase()) {
    case 'cover':
      return getCoveredRectForRenderSize(frameRect, renderSize)
    case 'fill':
      return {
        x: frameRect.x,
        y: frameRect.y,
        width: frameRect.width,
        height: frameRect.height,
      }
    case 'fitwidth':
    case 'fit-width':
    case 'fit_width': {
      const renderWidth = Number(renderSize.width)
      const renderHeight = Number(renderSize.height)
      const renderAspect = renderWidth / renderHeight
      if (!Number.isFinite(renderAspect) || renderAspect <= 0 || frameRect.width <= 0) {
        return getContainedRectForRenderSize(frameRect, renderSize)
      }
      const height = frameRect.width / renderAspect
      return {
        x: frameRect.x,
        y: frameRect.y + (frameRect.height - height) / 2,
        width: frameRect.width,
        height,
      }
    }
    case 'fitheight':
    case 'fit-height':
    case 'fit_height': {
      const renderWidth = Number(renderSize.width)
      const renderHeight = Number(renderSize.height)
      const renderAspect = renderWidth / renderHeight
      if (!Number.isFinite(renderAspect) || renderAspect <= 0 || frameRect.height <= 0) {
        return getContainedRectForRenderSize(frameRect, renderSize)
      }
      const width = frameRect.height * renderAspect
      return {
        x: frameRect.x + (frameRect.width - width) / 2,
        y: frameRect.y,
        width,
        height: frameRect.height,
      }
    }
    case 'contain':
    case 'scaledown':
    case 'scale-down':
    case 'scale_down':
    default:
      return getContainedRectForRenderSize(frameRect, renderSize)
  }
}

function projectWordHotspotBoundsThroughContainedRenderSpace(
  bounds: Required<WordHotspotBounds>,
  sourceFrameSize: WordHotspotRenderSize,
  targetRenderSize: WordHotspotRenderSize,
): Required<WordHotspotBounds> {
  const sourceWidth = Number(sourceFrameSize.width)
  const sourceHeight = Number(sourceFrameSize.height)
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    return bounds
  }

  const containedTargetRect = getContainedRectForRenderSize(
    new DOMRect(0, 0, sourceWidth, sourceHeight),
    targetRenderSize,
  )
  if (containedTargetRect.width <= 0 || containedTargetRect.height <= 0) return bounds

  const sourceX = bounds.x * sourceWidth
  const sourceY = bounds.y * sourceHeight
  const sourceBoxWidth = bounds.width * sourceWidth
  const sourceBoxHeight = bounds.height * sourceHeight
  return {
    x: (sourceX - containedTargetRect.x) / containedTargetRect.width,
    y: (sourceY - containedTargetRect.y) / containedTargetRect.height,
    width: sourceBoxWidth / containedTargetRect.width,
    height: sourceBoxHeight / containedTargetRect.height,
  }
}

function getRectOverlapArea(first: DOMRect, second: DOMRect): number {
  const left = Math.max(first.left, second.left)
  const right = Math.min(first.right, second.right)
  const top = Math.max(first.top, second.top)
  const bottom = Math.min(first.bottom, second.bottom)
  return Math.max(0, right - left) * Math.max(0, bottom - top)
}

function isUsableWordHotspotSourceCanvas(canvas: HTMLCanvasElement): boolean {
  if (
    canvas.classList.contains('tribe-word-hotspot-magnifier') ||
    canvas.classList.contains('tribe-standalone-word-hotspot-magnifier')
  ) {
    return false
  }

  if (canvas.width <= 0 || canvas.height <= 0) return false

  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false

  const style = window.getComputedStyle(canvas)
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.02) return false

  return true
}

function findWordHotspotSourceCanvas(readingRoot: ShadowRoot | null, overlayFrame: HTMLElement): HTMLCanvasElement | null {
  const frameRect = overlayFrame.getBoundingClientRect()
  const roots: Array<Document | ShadowRoot> = readingRoot ? [readingRoot, document] : [document]
  const seen = new Set<HTMLCanvasElement>()
  let bestCanvas: HTMLCanvasElement | null = null
  let bestScore = 0

  for (const root of roots) {
    for (const canvas of Array.from(root.querySelectorAll<HTMLCanvasElement>('canvas'))) {
      if (seen.has(canvas) || !isUsableWordHotspotSourceCanvas(canvas)) continue
      seen.add(canvas)

      const rect = canvas.getBoundingClientRect()
      const overlap = frameRect.width > 0 && frameRect.height > 0 ? getRectOverlapArea(rect, frameRect) : rect.width * rect.height
      if (overlap <= 0) continue

      const activeBonus = canvas.classList.contains('tribe-simple-active-canvas') ? overlap * 2 : 0
      const loadingPenalty = canvas.classList.contains('tribe-simple-loading-canvas') ? overlap : 0
      const score = overlap + activeBonus - loadingPenalty
      if (score > bestScore) {
        bestScore = score
        bestCanvas = canvas
      }
    }
  }

  return bestCanvas
}

function drawWordHotspotMagnifier(
  button: HTMLElement,
  magnifier: HTMLCanvasElement,
  sourceCanvas: HTMLCanvasElement | null,
  renderPixelScale = 1,
): boolean {
  if (!sourceCanvas || !isUsableWordHotspotSourceCanvas(sourceCanvas)) return false

  const sourceRect = sourceCanvas.getBoundingClientRect()
  const buttonRect = button.getBoundingClientRect()
  if (sourceRect.width <= 0 || sourceRect.height <= 0 || buttonRect.width <= 0 || buttonRect.height <= 0) return false
  const sourceBounds = getWordHotspotSourceBoundsFromButton(button)
  const parentRect = sourceBounds ? button.parentElement?.getBoundingClientRect() || null : null
  const cropRect =
    sourceBounds && parentRect && parentRect.width > 0 && parentRect.height > 0
      ? {
          left: parentRect.left + sourceBounds.x * parentRect.width,
          top: parentRect.top + sourceBounds.y * parentRect.height,
          width: sourceBounds.width * parentRect.width,
          height: sourceBounds.height * parentRect.height,
        }
      : {
          left: buttonRect.left,
          top: buttonRect.top,
          width: buttonRect.width,
          height: buttonRect.height,
        }
  if (cropRect.width <= 0 || cropRect.height <= 0) return false

  const pixelScale = Math.max(1, Math.min(3, renderPixelScale))
  const targetRatio = Math.max(1, Math.min(6, (window.devicePixelRatio || 1) * pixelScale))
  const targetWidth = Math.max(1, Math.round(buttonRect.width * targetRatio))
  const targetHeight = Math.max(1, Math.round(buttonRect.height * targetRatio))
  if (magnifier.width !== targetWidth) magnifier.width = targetWidth
  if (magnifier.height !== targetHeight) magnifier.height = targetHeight

  const sourceScaleX = sourceCanvas.width / sourceRect.width
  const sourceScaleY = sourceCanvas.height / sourceRect.height
  const sourceX = (cropRect.left - sourceRect.left) * sourceScaleX
  const sourceY = (cropRect.top - sourceRect.top) * sourceScaleY
  const sourceWidth = cropRect.width * sourceScaleX
  const sourceHeight = cropRect.height * sourceScaleY
  const clampedX = Math.max(0, Math.min(sourceCanvas.width - 1, sourceX))
  const clampedY = Math.max(0, Math.min(sourceCanvas.height - 1, sourceY))
  const clampedWidth = Math.max(1, Math.min(sourceCanvas.width - clampedX, sourceWidth))
  const clampedHeight = Math.max(1, Math.min(sourceCanvas.height - clampedY, sourceHeight))
  const targetCropWidth = Math.max(1, Math.round(cropRect.width * targetRatio))
  const targetCropHeight = Math.max(1, Math.round(cropRect.height * targetRatio))
  const targetCropX = Math.round((targetWidth - targetCropWidth) / 2)
  const targetCropY = Math.round((targetHeight - targetCropHeight) / 2)
  const context = magnifier.getContext('2d')
  if (!context) return false

  try {
    context.clearRect(0, 0, targetWidth, targetHeight)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      sourceCanvas,
      clampedX,
      clampedY,
      clampedWidth,
      clampedHeight,
      targetCropX,
      targetCropY,
      targetCropWidth,
      targetCropHeight,
    )
    return true
  } catch (error) {
    console.warn('[1Tribe word hotspots] Unable to draw word magnifier.', error)
    return false
  }
}

function getWordHotspotSourceBoundsFromButton(button: HTMLElement): Required<WordHotspotBounds> | null {
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

  return { x, y, width, height }
}

function setWordHotspotSourceBounds(button: HTMLButtonElement, bounds: Required<WordHotspotBounds>): void {
  button.dataset.sourceX = String(bounds.x)
  button.dataset.sourceY = String(bounds.y)
  button.dataset.sourceWidth = String(bounds.width)
  button.dataset.sourceHeight = String(bounds.height)
}

function attachWordHotspotMagnifier(
  button: HTMLButtonElement,
  magnifier: HTMLCanvasElement,
  getSourceCanvas: () => HTMLCanvasElement | null,
  renderPixelScale = 1,
): void {
  magnifier.style.visibility = 'hidden'
  const refresh = () => {
    magnifier.style.visibility = drawWordHotspotMagnifier(button, magnifier, getSourceCanvas(), renderPixelScale)
      ? 'visible'
      : 'hidden'
  }

  button.addEventListener('pointerenter', refresh)
  button.addEventListener('pointerdown', refresh)
  button.addEventListener('focus', refresh)
  const magnifierButton = button as WordHotspotMagnifierButton
  magnifierButton.tribeRefreshMagnifier = refresh
}

function activateStandaloneWordHotspotOverlay(context: ExtensionContext): () => void {
  const readingRoot = context.slots.get('reading-area')
  const root = document.createElement('div')
  const frame = document.createElement('div')
  const status = document.createElement('div')
  const fetchController = new AbortController()
  const paddingRatio = getNumberParam('riveWordHotspotPaddingPct', 0.01)
  const paddingXRatio = getNumberParam('riveWordHotspotPaddingXPct', paddingRatio)
  const paddingYRatio = getNumberParam('riveWordHotspotPaddingYPct', paddingRatio)
  const strokeWidthPx = Math.max(1, getNumberParam('riveWordHotspotStrokePx', 3))
  const magnifyScale = Math.max(1, getNumberParam('riveWordHotspotMagnifyScale', 1.16))
  const magnifierPixelScale = Math.max(
    1,
    Math.min(3, getNumberParam('riveWordHotspotMagnifierPixelScale', magnifyScale)),
  )
  const outlineScaleX = Math.max(1, getNumberParam('riveWordHotspotOutlineScaleX', 1.16))
  const outlineScaleY = Math.max(1, getNumberParam('riveWordHotspotOutlineScaleY', 1.2))
  const shadowXPx = getNonNegativeNumberParam('riveWordHotspotShadowXPx', 5)
  const shadowYPx = getNonNegativeNumberParam('riveWordHotspotShadowYPx', 5)
  const boundsTransform = {
    offsetX: getSignedNumberParam(
      'riveWordHotspotBoundsOffsetXPct',
      getSignedNumberParam(
        'riveWordHotspotOffsetXPct',
        getSignedNumberParam('tribeWordHotspotBoundsOffsetXPct', 0),
      ),
    ),
    offsetY: getSignedNumberParam(
      'riveWordHotspotBoundsOffsetYPct',
      getSignedNumberParam(
        'riveWordHotspotOffsetYPct',
        getSignedNumberParam('tribeWordHotspotBoundsOffsetYPct', 0),
      ),
    ),
    frameScaleX: getNumberParam(
      'riveWordHotspotFrameScaleX',
      getNumberParam('tribeWordHotspotFrameScaleX', 1),
    ),
    frameScaleY: getNumberParam(
      'riveWordHotspotFrameScaleY',
      getNumberParam('tribeWordHotspotFrameScaleY', 1),
    ),
    scaleX: getNumberParam(
      'riveWordHotspotBoundsScaleX',
      getNumberParam('riveWordHotspotScaleX', getNumberParam('tribeWordHotspotBoundsScaleX', 1)),
    ),
    scaleY: getNumberParam(
      'riveWordHotspotBoundsScaleY',
      getNumberParam('riveWordHotspotScaleY', getNumberParam('tribeWordHotspotBoundsScaleY', 1)),
    ),
  }
  const shouldUseWordHotspotMagnifier = magnifyScale > 1.001
  const shouldHideSuspect = getBooleanParam('riveWordHotspotHideSuspect', false)
  const shouldShowWordHotspotBoxes = getBooleanParam('riveWordHotspotShowBoxes', false)
  const shouldShowWordHotspotStatus = getBooleanParam('tribeCommandHarnessShowControls', false)
  const defaultWordHotspotFrameMode = 'rive-artboard'
  const requestedWordHotspotFrameMode =
    (getStringParam('tribeWordHotspotFrameMode') || getStringParam('riveWordHotspotFrameMode') || defaultWordHotspotFrameMode)
      .trim()
      .toLowerCase()
  const wordHotspotFrameFit =
    getStringParam('tribeWordHotspotFrameFit') ||
    getStringParam('riveWordHotspotFrameFit') ||
    getStringParam('tribeCommandHarnessPreviewFit') ||
    'contain'
  const wordHotspotFrameMode =
    requestedWordHotspotFrameMode === 'canvas' || requestedWordHotspotFrameMode === 'contain'
      ? requestedWordHotspotFrameMode
      : 'rive-artboard'
  const debugWindow = window as TribeDebugWindow
  let activeWordHotspots: ActiveWordHotspot[] = []
  let isDisposed = false
  let lastLookupKey = ''
  let lastLookupAt = 0
  let lastRenderedPage: number | null = null
  let lastObservedContextPage: number | null = null
  let forcedPage: number | null = null
  let renderSerial = 0
  let manifestPromise: Promise<WordHotspotManifest | null> | null = null
  let activeRenderSize: WordHotspotRenderSize = { width: 1216, height: 837 }
  let lastFrameRect: Record<string, number> | null = null
  let lastFrameSource = 'unknown'
  let lastSourceCanvasRect: Record<string, number> | null = null
  let lastSourceStageRect: Record<string, number> | null = null
  let lastSourceRiveRenderSize: WordHotspotRenderSize | null = null
  let lastSourceRenderSize: WordHotspotRenderSize | null = null
  let lastFrameProjectionKey = ''
  let lastFrameProjectionMode = 'unknown'
  let lastRenderedProjectionKey = ''
  let completionSuppressed = false
  let harnessPageOverride: number | null = null
  let lastHarnessPageOverrideReason: string | null = null
  let lastHarnessPageOverrideDetail: Record<string, unknown> | null = null
  let completionSuppressionObserver: MutationObserver | null = null
  let completionSuppressionTimer: number | null = null
  let lastCompletionElementSummary: Record<string, unknown> | null = null
  let lastDebug: Record<string, unknown> = {
    enabled: true,
    mode: 'standalone',
    message: 'Standalone word hotspots are booting.',
  }
  const shouldExposeStandaloneDebugGlobals = shouldExposeDebugGlobals()

  injectStyle(readingRoot, standaloneWordHotspotStyles, 'tribe-standalone-word-hotspot-styles')

  root.className = 'tribe-standalone-word-hotspot-root'
  root.setAttribute('data-reader-navigation-ignore', 'true')
  frame.className = 'tribe-standalone-word-hotspot-frame'
  frame.classList.toggle('is-debug-visible', shouldShowWordHotspotBoxes)
  frame.setAttribute('data-reader-navigation-ignore', 'true')
  status.className = 'tribe-standalone-word-hotspot-status'
  status.textContent = 'Word hotspots: loading'
  if (shouldShowWordHotspotStatus) {
    frame.append(status)
  }
  root.append(frame)
  readingRoot.append(root)

  const setStatus = (message: string) => {
    status.textContent = message
  }

  const getManifestUrl = (): string | null => {
    try {
      const manifestParam = getStringParam('riveWordHotspotManifest')?.trim()
      if (manifestParam) return new URL(manifestParam, extensionScriptUrl).href

      const folder =
        getStringParam('riveWordHotspotFolder')?.trim() ||
        getStringParam('riveFolder')?.trim() ||
        getEpicTribeBookConfig(context.data.getBookId())?.wordHotspotFolder?.trim()
      if (!folder) return null

      return new URL(`rive/${folder}/word-hotspots/word-hotspots.json`, extensionScriptUrl).href
    } catch (error) {
      console.warn(`[1Tribe word hotspots] Unable to create standalone manifest URL: ${String(error)}`)
      return null
    }
  }

  const loadManifest = (manifestUrl: string) => {
    if (manifestPromise) return manifestPromise

    manifestPromise = fetch(manifestUrl, {
      cache: 'no-store',
      signal: fetchController.signal,
    })
      .then(async (response): Promise<WordHotspotManifest | null> => {
        if (!response.ok) {
          console.warn(`[1Tribe word hotspots] Unable to load ${manifestUrl}: HTTP ${response.status}`)
          return null
        }

        return (await response.json()) as WordHotspotManifest
      })
      .catch((error): WordHotspotManifest | null => {
        if (!fetchController.signal.aborted) {
          console.warn(`[1Tribe word hotspots] Unable to load ${manifestUrl}: ${String(error)}`)
        }
        return null
      })

    return manifestPromise
  }

  const getRequestedPage = (manifest: WordHotspotManifest): number => {
    const explicitWordHotspotPage = getStringParam('riveWordHotspotPage')
    if (
      explicitWordHotspotPage !== null &&
      explicitWordHotspotPage !== undefined &&
      explicitWordHotspotPage.trim() !== ''
    ) {
      const explicitPage = Number(explicitWordHotspotPage)
      if (Number.isFinite(explicitPage)) return explicitPage
    }

    const contextPage = context.data.getCurrentPage()
    const hasContextPage = manifest.files?.some((file) => normalizeWordHotspotPages(file.pages).includes(contextPage))
    if (Number.isFinite(contextPage) && hasContextPage) return contextPage

    const livePageValue = new URLSearchParams(window.location.search).get('page')
    if (livePageValue !== null && livePageValue.trim() !== '') {
      const livePage = Number(livePageValue)
      if (Number.isFinite(livePage)) return livePage
    }

    const firstPage = normalizeWordHotspotPages(manifest.files?.find((file) => normalizeWordHotspotPages(file.pages).length)?.pages)[0]
    return typeof firstPage === 'number' && Number.isFinite(firstPage) ? firstPage : contextPage
  }

  const findManifestFile = (manifest: WordHotspotManifest, page: number): WordHotspotFile | null => {
    const requestedFileName = getStringParam('riveWordHotspotFile')?.trim()
    if (requestedFileName) {
      const normalizedRequestedFile = normalizeWordHotspotFileName(requestedFileName)
      const requestedFile =
        manifest.files?.find((file) => normalizeWordHotspotFileName(file.file || '') === normalizedRequestedFile) ||
        null
      if (requestedFile) return requestedFile
    }

    return (
      manifest.files?.find((file) => normalizeWordHotspotPages(file.pages).includes(page)) ||
      null
    )
  }

  const getVisibleCommandHarnessCanvas = (): HTMLCanvasElement | null => {
    const roots: Array<Document | ShadowRoot> = readingRoot ? [readingRoot, document] : [document]
    let bestCanvas: HTMLCanvasElement | null = null
    let bestScore = 0

    for (const searchRoot of roots) {
      for (const canvas of Array.from(searchRoot.querySelectorAll<HTMLCanvasElement>('.tribe-command-harness__canvas'))) {
        if (!isUsableWordHotspotSourceCanvas(canvas)) continue

        const rect = canvas.getBoundingClientRect()
        const style = window.getComputedStyle(canvas)
        const opacity = Number(style.opacity)
        const zIndex = Number(style.zIndex)
        const score =
          rect.width * rect.height * Math.max(0.05, Number.isFinite(opacity) ? opacity : 1) +
          (Number.isFinite(zIndex) ? Math.max(0, zIndex) * 100 : 0)
        if (score > bestScore) {
          bestScore = score
          bestCanvas = canvas
        }
      }
    }

    return bestCanvas
  }

  const getCommandHarnessCanvasRiveRenderSize = (canvas: HTMLCanvasElement | null): WordHotspotRenderSize | null => {
    const width = Number(canvas?.dataset.riveRenderWidth)
    const height = Number(canvas?.dataset.riveRenderHeight)
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      return { width, height }
    }

    return null
  }

  const getCommandHarnessStageForCanvas = (canvas: HTMLCanvasElement | null): HTMLElement | null => {
    const stage = canvas?.closest('.tribe-command-harness__stage')
    return stage instanceof HTMLElement ? stage : null
  }

  const serializeWordHotspotDomRect = (rect: DOMRect | null): Record<string, number> | null =>
    rect
      ? {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
      : null

  const getStandaloneElementSummary = (element: Element | null): Record<string, unknown> | null => {
    if (!element) return null
    const htmlElement = element instanceof HTMLElement ? element : null
    const rect = htmlElement?.getBoundingClientRect()
    return {
      ariaLabel: element.getAttribute('aria-label'),
      className: typeof element.className === 'string' ? element.className : '',
      hidden: htmlElement?.hidden || element.hasAttribute('hidden') || false,
      id: element.id || null,
      rect: rect
        ? {
            height: rect.height,
            width: rect.width,
            x: rect.x,
            y: rect.y,
          }
        : null,
      tagName: element.tagName.toLowerCase(),
      text: (element.textContent || '').trim().slice(0, 80),
    }
  }

  const isStandaloneElementVisiblyExposed = (element: Element | null): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false
    if (!document.documentElement.contains(element)) return false

    let current: HTMLElement | null = element
    while (current) {
      if (current.hidden || current.hasAttribute('hidden') || current.getAttribute('aria-hidden') === 'true') {
        return false
      }
      const styles = window.getComputedStyle(current)
      if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
        return false
      }
      current = current.parentElement
    }

    const rect = element.getBoundingClientRect()
    const overlapsViewport =
      rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight
    return rect.width > 1 && rect.height > 1 && overlapsViewport
  }

  const findVisibleStandaloneEpicCompletionElement = () => {
    const selectors = [
      'epic-book-completion-page .book-completion-page-container:not([hidden])',
      'epic-book-completion-page .book-completion-finish-container',
      'epic-book-completion-page .almost-done-container',
      'epic-book-completion-page .book-finish-stats',
      'epic-book-completion-page .show-draw-cta',
      'epic-book-completion-page .recommendation-loader',
      'epic-book-completion-page .read-again-btn-container',
      'epic-book-completion-page [class*="read-again"]',
      '.book-completion-page-container:not([hidden])',
      '.book-completion-finish-container',
      '.read-again-btn-container',
    ]

    for (const selector of selectors) {
      for (const element of Array.from(document.querySelectorAll(selector))) {
        if (!isStandaloneElementVisiblyExposed(element)) continue

        const text = (element.textContent || '').trim()
        const className = typeof element.className === 'string' ? element.className : ''
        const isExplicitCompletionUi =
          /book complete|read again|more like this|points earned|reading time/i.test(text) ||
          /read-again|recommendation/i.test(className)
        if (isExplicitCompletionUi) return element
      }
    }

    return null
  }

  const positionHotspotFrame = () => {
    if (syncStandaloneWordHotspotCompletionSuppression('position hotspot frame')) return

    const commandHarnessCanvas = getVisibleCommandHarnessCanvas()
    const commandHarnessCanvasRect = commandHarnessCanvas?.getBoundingClientRect() || null
    const commandHarnessStage = getCommandHarnessStageForCanvas(commandHarnessCanvas)
    const commandHarnessStageRect = commandHarnessStage?.getBoundingClientRect() || null
    const commandHarnessSourceRect =
      wordHotspotFrameMode === 'contain' && commandHarnessStageRect
        ? commandHarnessStageRect
        : commandHarnessCanvasRect
    const commandHarnessRiveRenderSize = getCommandHarnessCanvasRiveRenderSize(commandHarnessCanvas)
    const shouldProjectThroughRiveArtboard =
      wordHotspotFrameMode === 'rive-artboard' && Boolean(commandHarnessSourceRect && commandHarnessRiveRenderSize)
    const commandHarnessRenderSize =
      shouldProjectThroughRiveArtboard && commandHarnessRiveRenderSize ? commandHarnessRiveRenderSize : activeRenderSize
    const alignedCanvasRect = commandHarnessSourceRect
      ? wordHotspotFrameMode === 'canvas'
        ? commandHarnessSourceRect
        : getFittedRectForRenderSize(commandHarnessSourceRect, commandHarnessRenderSize, wordHotspotFrameFit)
      : null
    const flipBookRect = context.data.getFlipBookRect()
    const fallbackRect =
      !flipBookRect && readingRoot.host instanceof HTMLElement ? readingRoot.host.getBoundingClientRect() : null
    const rect = alignedCanvasRect || flipBookRect || fallbackRect
    lastFrameProjectionMode = shouldProjectThroughRiveArtboard
      ? 'rive-artboard'
      : alignedCanvasRect
        ? wordHotspotFrameMode
        : flipBookRect
          ? 'epic-flipbook'
          : fallbackRect
            ? 'reading-root-host'
            : 'viewport-fallback'
    lastFrameProjectionKey = [
      lastFrameProjectionMode,
      Math.round(commandHarnessSourceRect?.x || 0),
      Math.round(commandHarnessSourceRect?.y || 0),
      Math.round(commandHarnessSourceRect?.width || 0),
      Math.round(commandHarnessSourceRect?.height || 0),
      Math.round(commandHarnessRenderSize.width),
      Math.round(commandHarnessRenderSize.height),
      Math.round(activeRenderSize.width),
      Math.round(activeRenderSize.height),
      wordHotspotFrameFit,
    ].join('|')
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      frame.style.cssText = 'position:absolute;inset:0;pointer-events:none;'
      lastFrameSource = 'viewport-fallback'
      lastSourceCanvasRect = null
      lastSourceStageRect = null
      lastSourceRiveRenderSize = null
      lastSourceRenderSize = null
      lastFrameRect = {
        x: 0,
        y: 0,
        width: Math.round(window.innerWidth),
        height: Math.round(window.innerHeight),
      }
      return
    }

    frame.style.cssText = [
      'position:absolute',
      `left:${rect.x}px`,
      `top:${rect.y}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      'pointer-events:none',
    ].join(';')
    const frameRect = frame.getBoundingClientRect()
    lastFrameSource = alignedCanvasRect
      ? `command-harness-${wordHotspotFrameMode === 'contain' && commandHarnessStageRect ? 'stage' : 'canvas'}-${lastFrameProjectionMode}`
      : flipBookRect
        ? 'epic-flipbook'
        : 'reading-root-host'
    lastSourceCanvasRect = serializeWordHotspotDomRect(commandHarnessCanvasRect)
    lastSourceStageRect = serializeWordHotspotDomRect(commandHarnessStageRect)
    lastSourceRiveRenderSize = commandHarnessSourceRect ? commandHarnessRiveRenderSize : null
    lastSourceRenderSize = commandHarnessSourceRect ? commandHarnessRenderSize : null
    lastFrameRect = {
      x: Math.round(frameRect.x),
      y: Math.round(frameRect.y),
      width: Math.round(frameRect.width),
      height: Math.round(frameRect.height),
    }
  }

  const executeLookup = (hotspot: ActiveWordHotspot, source: string, event?: Event) => {
    event?.preventDefault()
    event?.stopPropagation()

    const now = Date.now()
    const key = `${hotspot.fileName}|${hotspot.page}|${hotspot.word}`
    if (key === lastLookupKey && now - lastLookupAt < 500) return true
    lastLookupKey = key
    lastLookupAt = now

    console.info(`[1Tribe word hotspots] lookup_word "${hotspot.word}" from ${source}.`, {
      file: hotspot.fileName,
      page: hotspot.page,
      sourceWord: hotspot.sourceWord,
    })

    try {
      armWordLookupDismissGuard(hotspot.word, source, event)
      context.commands.execute('lookup_word', hotspot.word)
      context.analytics.log('1tribe_word_hotspot_lookup', {
        bookId: context.data.getBookId(),
        eventSource: source,
        file: hotspot.fileName,
        mode: 'standalone',
        page: hotspot.page,
        sourceWord: hotspot.sourceWord,
        word: hotspot.word,
      })
      setStatus(`lookup_word: ${hotspot.word}`)
      return true
    } catch (error) {
      console.warn(`[1Tribe word hotspots] lookup_word failed: ${String(error)}`)
      setStatus(`lookup_word failed: ${hotspot.word}`)
      return false
    }
  }

  const projectWordHotspotBoundsForCurrentFrame = (
    bounds: Required<WordHotspotBounds>,
  ): Required<WordHotspotBounds> => {
    if (lastFrameProjectionMode !== 'rive-artboard' || !lastSourceRiveRenderSize) return bounds

    return projectWordHotspotBoundsThroughContainedRenderSpace(bounds, activeRenderSize, lastSourceRiveRenderSize)
  }

  const syncDebugHelpers = () => {
    if (!shouldExposeStandaloneDebugGlobals) return

    debugWindow.tribeWordHotspots = activeWordHotspots.slice()
    debugWindow.tribeWordHotspotDebug = () => ({
      enabled: true,
      mode: 'standalone',
      activeCount: activeWordHotspots.length,
      buttonCount: frame.querySelectorAll('.tribe-standalone-word-hotspot-button').length,
      pageAudit: getActiveWordHotspotPageAudit(
        activeWordHotspots,
        Array.from(frame.querySelectorAll<HTMLButtonElement>('.tribe-standalone-word-hotspot-button')),
      ),
      contextCurrentPage: context.data.getCurrentPage(),
      completionSuppressed,
      showBoxes: shouldShowWordHotspotBoxes,
      visibleCompletionElement: getStandaloneElementSummary(findVisibleStandaloneEpicCompletionElement()),
      forcedPage,
      frameMode: wordHotspotFrameMode,
      frameFit: wordHotspotFrameFit,
      boundsTransform,
      geometrySource: 'rive-ocr-sidecar',
      frameProjectionKey: lastFrameProjectionKey,
      frameProjectionMode: lastFrameProjectionMode,
      frameSource: lastFrameSource,
      frameRect: lastFrameRect,
      last: lastDebug,
      lastCompletionElement: lastCompletionElementSummary,
      harnessPageOverride: {
        detail: lastHarnessPageOverrideDetail,
        page: harnessPageOverride,
        reason: lastHarnessPageOverrideReason,
      },
      lastRenderedPage,
      manifestUrl: getManifestUrl(),
      renderSize: activeRenderSize,
      rootAttached: root.isConnected,
      sourceCanvasRect: lastSourceCanvasRect,
      sourceStageRect: lastSourceStageRect,
      sourceRiveRenderSize: lastSourceRiveRenderSize,
      sourceRenderSize: lastSourceRenderSize,
      wordLookupDismissGuard: getWordLookupDismissGuardDebugState(),
    })
    debugWindow.tribeClickWordHotspot = (word = '') => {
      const normalizedWord = word.trim().toLowerCase()
      const hotspot =
        activeWordHotspots.find((item) => item.word.toLowerCase() === normalizedWord) ||
        activeWordHotspots[0] ||
        null
      if (!hotspot) {
        console.warn('[1Tribe word hotspots] No standalone hotspot is available for console lookup.', {
          requestedWord: word,
        })
        return false
      }

      return executeLookup(hotspot, 'standalone-console-helper')
    }
    debugWindow.tribeForceWordHotspotPage = (page = 4) => {
      const targetPage = Number(page)
      if (!Number.isFinite(targetPage)) return false

      forcedPage = targetPage
      void renderForPage('console force standalone word hotspot page')
      return true
    }
  }

  function clearButtons() {
    clearReadAlongButtonHighlight()
    frame.querySelectorAll('.tribe-standalone-word-hotspot-button').forEach((item) => item.remove())
  }

  function applyHarnessPageOverride(page: number, reason: string, detail: Record<string, unknown> | null = null) {
    if (!Number.isFinite(page)) return

    renderSerial += 1
    forcedPage = page
    harnessPageOverride = page
    lastHarnessPageOverrideReason = reason
    lastHarnessPageOverrideDetail = detail
    clearButtons()
    activeWordHotspots = []
    lastRenderedPage = null
    frame.hidden = false
    lastDebug = {
      detail,
      enabled: true,
      message: 'Standalone word hotspots following command harness target page.',
      mode: 'standalone-harness-page-override',
      page,
      reason,
    }
    setStatus(`Word hotspots: switching to page ${page}`)
    syncDebugHelpers()
    void renderForPage(reason)
  }

  function clearHarnessPageOverride(reason: string) {
    if (harnessPageOverride === null && forcedPage === null) return

    harnessPageOverride = null
    lastHarnessPageOverrideReason = reason
    lastHarnessPageOverrideDetail = null
    forcedPage = null
  }

  function setStandaloneWordHotspotCompletionSuppression(
    active: boolean,
    reason: string,
    visibleElement: Element | null,
  ) {
    if (completionSuppressed === active) {
      if (active) {
        lastCompletionElementSummary = getStandaloneElementSummary(visibleElement)
      }
      return
    }

    completionSuppressed = active
    root.classList.toggle('is-epic-completion-visible', active)
    frame.hidden = active
    lastCompletionElementSummary = active ? getStandaloneElementSummary(visibleElement) : null

    if (active) {
      clearButtons()
      activeWordHotspots = []
      lastRenderedPage = null
      lastDebug = {
        enabled: true,
        message: 'Standalone word hotspots suppressed while Epic completion UI is visible.',
        mode: 'standalone-completion-suppressed',
        reason,
        visibleElement: lastCompletionElementSummary,
      }
      setStatus('Word hotspots: hidden for Epic completion')
    } else {
      lastRenderedPage = null
      lastDebug = {
        enabled: true,
        message: 'Standalone word hotspots restoring after Epic completion UI disappeared.',
        mode: 'standalone',
        reason,
      }
      setStatus('Word hotspots: restoring')
    }

    syncDebugHelpers()
  }

  function syncStandaloneWordHotspotCompletionSuppression(reason: string) {
    const visibleElement = findVisibleStandaloneEpicCompletionElement()
    if (visibleElement) {
      setStandaloneWordHotspotCompletionSuppression(true, reason, visibleElement)
      return true
    }

    if (completionSuppressed) {
      setStandaloneWordHotspotCompletionSuppression(false, reason, null)
    }

    return false
  }

  const scheduleStandaloneCompletionSuppressionCheck = (reason: string, delayMs = 80) => {
    if (completionSuppressionTimer !== null) {
      window.clearTimeout(completionSuppressionTimer)
    }
    completionSuppressionTimer = window.setTimeout(() => {
      completionSuppressionTimer = null
      refresh(reason)
    }, Math.max(0, delayMs))
  }

  const startStandaloneCompletionSuppressionObserver = () => {
    if (completionSuppressionObserver || !document.body) return
    completionSuppressionObserver = new MutationObserver(() => {
      scheduleStandaloneCompletionSuppressionCheck('Epic completion DOM mutation')
    })
    completionSuppressionObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style', 'aria-hidden'],
      childList: true,
      subtree: true,
    })
  }

  const renderForPage = async (reason: string) => {
    if (syncStandaloneWordHotspotCompletionSuppression(reason)) return

    const manifestUrl = getManifestUrl()
    if (!manifestUrl) {
      activeWordHotspots = []
      clearButtons()
      lastDebug = {
        enabled: true,
        mode: 'standalone',
        message: 'No standalone word hotspot manifest URL could be inferred.',
        reason,
      }
      setStatus('Word hotspots: no manifest URL')
      syncDebugHelpers()
      return
    }

    const serial = ++renderSerial
    lastDebug = {
      enabled: true,
      mode: 'standalone',
      manifestUrl,
      message: 'Loading standalone word hotspot manifest.',
      reason,
    }
    setStatus('Word hotspots: loading')
    syncDebugHelpers()

    const manifest = await loadManifest(manifestUrl)
    if (isDisposed || serial !== renderSerial) return

    if (!manifest) {
      activeWordHotspots = []
      clearButtons()
      lastDebug = {
        enabled: true,
        mode: 'standalone',
        manifestUrl,
        message: 'Standalone word hotspot manifest did not load.',
        reason,
      }
      setStatus('Word hotspots: manifest failed')
      syncDebugHelpers()
      return
    }

    const page = forcedPage ?? getRequestedPage(manifest)
    const configuredHotspotFile = getConfiguredWordHotspotFileForPage(context, page, manifest)
    const manifestHotspotFile = configuredHotspotFile ? null : findManifestFile(manifest, page)
    const hotspotFileMappingSource = configuredHotspotFile ? 'book-config' : 'manifest-page'
    let hotspotFile = configuredHotspotFile || manifestHotspotFile
    if (!hotspotFile) {
      activeWordHotspots = []
      clearButtons()
      lastRenderedPage = page
      lastDebug = {
        availableFiles: manifest.files?.map((file) => ({ file: file.file, pages: file.pages })) || [],
        enabled: true,
        manifestUrl,
        message: 'Manifest loaded, but no file entry matched this page.',
        mode: 'standalone',
        page,
        reason,
      }
      setStatus(`Word hotspots: 0 for page ${page}`)
      syncDebugHelpers()
      return
    }
    const ocrHotspotFile = await getWordHotspotFileWithOcrSidecar(
      hotspotFile,
      manifest,
      manifestUrl,
      fetchController.signal,
    )
    if (!ocrHotspotFile) {
      activeWordHotspots = []
      clearButtons()
      lastRenderedPage = page
      lastDebug = {
        enabled: true,
        file: hotspotFile.file,
        geometrySource: 'rive-ocr-sidecar',
        manifestUrl,
        message: 'No valid Rive OCR sidecar geometry was available for this page.',
        mode: 'standalone',
        page,
        reason,
      }
      setStatus(`Word hotspots: no OCR geometry for page ${page}`)
      syncDebugHelpers()
      return
    }
    hotspotFile = ocrHotspotFile
    if (isDisposed || serial !== renderSerial) return
    activeRenderSize = getWordHotspotRenderSize(manifest, hotspotFile, activeRenderSize)
    positionHotspotFrame()

    const words = (hotspotFile.words || []).filter((word) => {
      const text = String(word.text || '')
      return text && (!shouldHideSuspect || !isSuspectWordHotspotText(text))
    })

    clearButtons()
    activeWordHotspots = []
    lastRenderedPage = page
    lastRenderedProjectionKey = lastFrameProjectionKey

    const hotspotPages = normalizeWordHotspotPages(hotspotFile.pages)
    for (const word of words) {
      const sourceWord = String(word.text || '')
      const rawBounds = getFiniteWordHotspotBounds(word.normalized)
      if (!rawBounds) continue

      const rawHotspotPage = getWordHotspotLogicalPage(page, hotspotPages, rawBounds)
      const contentBounds = getWordHotspotContentBoundsForPage(hotspotFile, manifest, rawHotspotPage)
      const adjustedBounds = getAdjustedWordHotspotBounds(rawBounds, contentBounds)
      if (!adjustedBounds) continue

      for (const segment of getWordHotspotTextSegments(sourceWord, adjustedBounds)) {
        const { lookupWord } = segment
        if (!lookupWord) continue

        const projectedBounds = projectWordHotspotBoundsForCurrentFrame(segment.bounds)
        const calibratedBounds = transformWordHotspotBounds(projectedBounds, boundsTransform)
        if (!calibratedBounds) continue

        const isLargeHotspot = isLargeWordHotspotBounds(calibratedBounds)
        const paddedBounds = clampWordHotspotBoundsToUnitFrame({
          x: calibratedBounds.x - paddingXRatio,
          y: calibratedBounds.y - paddingYRatio,
          width: calibratedBounds.width + paddingXRatio * 2,
          height: calibratedBounds.height + paddingYRatio * 2,
        })
        if (!paddedBounds) continue
        const displayBounds = shouldShowWordHotspotBoxes ? calibratedBounds : paddedBounds

        const hotspotPage = getWordHotspotLogicalPage(page, hotspotPages, segment.bounds)
        const hotspot: ActiveWordHotspot = {
          fileName: hotspotFile.file,
          height: displayBounds.height,
          page: hotspotPage,
          reason,
          sourceHeight: calibratedBounds.height,
          sourceWord: segment.sourceWord,
          sourceWidth: calibratedBounds.width,
          sourceX: calibratedBounds.x,
          sourceY: calibratedBounds.y,
          width: displayBounds.width,
          word: lookupWord,
          x: displayBounds.x,
          y: displayBounds.y,
        }
        activeWordHotspots.push(hotspot)

        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'tribe-standalone-word-hotspot-button'
        button.classList.toggle('is-large-hotspot', isLargeHotspot)
        button.classList.toggle('is-suspect', isSuspectWordHotspotText(segment.sourceWord))
        button.style.left = `${hotspot.x * 100}%`
        button.style.top = `${hotspot.y * 100}%`
        button.style.width = `${hotspot.width * 100}%`
        button.style.height = `${hotspot.height * 100}%`
        button.style.setProperty('--tribe-word-hotspot-stroke', `${strokeWidthPx}px`)
        button.style.setProperty('--tribe-word-hotspot-word-scale', String(isLargeHotspot ? 1 : magnifyScale))
        button.style.setProperty(
          '--tribe-word-hotspot-outline-scale-x',
          String(shouldShowWordHotspotBoxes || isLargeHotspot ? 1 : outlineScaleX),
        )
        button.style.setProperty(
          '--tribe-word-hotspot-outline-scale-y',
          String(shouldShowWordHotspotBoxes || isLargeHotspot ? 1 : outlineScaleY),
        )
        button.style.setProperty('--tribe-word-hotspot-shadow-x', `${shouldShowWordHotspotBoxes ? 0 : shadowXPx}px`)
        button.style.setProperty('--tribe-word-hotspot-shadow-y', `${shouldShowWordHotspotBoxes ? 0 : shadowYPx}px`)
        setWordHotspotSourceBounds(button, calibratedBounds)
        button.setAttribute('aria-label', `Look up ${lookupWord}`)
        button.setAttribute('data-reader-navigation-ignore', 'true')
        button.dataset.lookupWord = lookupWord
        button.dataset.sourceWord = segment.sourceWord
        if (segment.sourcePhrase) button.dataset.sourcePhrase = segment.sourcePhrase
        if (segment.segmentCount > 1) {
          button.dataset.hyphenSegmentIndex = String(segment.segmentIndex)
          button.dataset.hyphenSegmentCount = String(segment.segmentCount)
        }
        button.dataset.hotspotPage = String(hotspotPage)
        button.dataset.hotspotSpreadPage = String(page)
        button.dataset.hotspotPages = hotspotPages.join(',')
        button.dataset.lookupAliases = getReadAlongButtonWordAliases(button).join(',')

        if (shouldUseWordHotspotMagnifier && !isLargeHotspot) {
          const magnifier = document.createElement('canvas')
          magnifier.className = 'tribe-standalone-word-hotspot-magnifier'
          button.append(magnifier)
          attachWordHotspotMagnifier(
            button,
            magnifier,
            () => findWordHotspotSourceCanvas(readingRoot, frame),
            magnifierPixelScale,
          )
        }

        button.addEventListener('pointerdown', (event) => {
          event.preventDefault()
          event.stopPropagation()
        })
        button.addEventListener('pointerup', (event) => {
          executeLookup(hotspot, 'standalone-button-pointerup', event)
        })
        button.addEventListener('click', (event) => {
          executeLookup(hotspot, 'standalone-button-click', event)
        })

        frame.append(button)
      }
    }

    lastDebug = {
      activeCount: activeWordHotspots.length,
      enabled: true,
      manifestFile: hotspotFile.file,
      manifestPages: hotspotFile.pages || null,
      manifestUrl,
      message: 'Standalone word hotspots rendered.',
      mode: 'standalone',
      page,
      reason,
      geometrySource: 'rive-ocr-sidecar',
      boundsTransform,
      source: hotspotFile.source || hotspotFileMappingSource,
      sourceDetail: {
        ...(hotspotFile.sourceDetail || {}),
        mappingSource: hotspotFileMappingSource,
      },
      showBoxes: shouldShowWordHotspotBoxes,
    }
    setStatus(`Word hotspots: ${activeWordHotspots.length} (${hotspotFile.file})`)
    syncDebugHelpers()
    context.analytics.log('1tribe_word_hotspots_rendered', {
      bookId: context.data.getBookId(),
      count: activeWordHotspots.length,
      file: hotspotFile.file,
      manifestUrl,
      mode: 'standalone',
      page,
      reason,
    })
  }

  const refresh = (reason: string) => {
    if (syncStandaloneWordHotspotCompletionSuppression(reason)) return

    positionHotspotFrame()
    const contextPage = context.data.getCurrentPage()
    const projectionChanged = lastRenderedProjectionKey !== lastFrameProjectionKey
    const shouldRender =
      lastRenderedPage === null ||
      (forcedPage !== null && forcedPage !== lastRenderedPage) ||
      (Number.isFinite(contextPage) && contextPage !== lastObservedContextPage) ||
      projectionChanged
    lastObservedContextPage = Number.isFinite(contextPage) ? contextPage : lastObservedContextPage
    if (shouldRender) {
      void renderForPage(reason)
    }
  }

  const onResize = () => positionHotspotFrame()
  const onPageChange = () => {
    clearHarnessPageOverride('standalone pageChange')
    lastObservedContextPage = context.data.getCurrentPage()
    if (syncStandaloneWordHotspotCompletionSuppression('standalone pageChange')) return
    void renderForPage('standalone pageChange')
    positionHotspotFrame()
  }
  const onCommandHarnessTurnStart = (event: Event) => {
    const detail = event instanceof CustomEvent && typeof event.detail === 'object' ? event.detail as Record<string, unknown> : null
    const direction = String(detail?.direction || '')
    const currentPage = Number(detail?.currentPage)
    const targetPage = Number(detail?.targetPage)
    const isFirstForwardSpreadTransition =
      direction === 'next' &&
      Number.isFinite(currentPage) &&
      currentPage <= 1 &&
      Number.isFinite(targetPage) &&
      targetPage === 2
    if (isFirstForwardSpreadTransition) {
      applyHarnessPageOverride(targetPage, 'command harness first forward target page', detail)
    }
  }
  const onCommandHarnessTurnSettle = (event: Event) => {
    const detail = event instanceof CustomEvent && typeof event.detail === 'object' ? event.detail as Record<string, unknown> : null
    lastHarnessPageOverrideDetail = detail
    if (detail?.interactionRefresh || detail?.source === 'slider') {
      if (syncStandaloneWordHotspotCompletionSuppression('command harness slider settle')) return
      void renderForPage('command harness slider settle')
      positionHotspotFrame()
    }
  }
  const pageChangeCleanup = context.events.on('pageChange', onPageChange)
  const interval = window.setInterval(() => refresh('standalone interval refresh'), 750)

  startStandaloneCompletionSuppressionObserver()
  window.addEventListener('resize', onResize)
  document.addEventListener('tribeCommandHarnessTurnStart', onCommandHarnessTurnStart)
  document.addEventListener('tribeCommandHarnessTurnSettle', onCommandHarnessTurnSettle)
  positionHotspotFrame()
  void renderForPage('standalone initial load')
  syncDebugHelpers()
  console.info('[1Tribe word hotspots] Standalone word hotspot overlay activated.', {
    manifestUrl: getManifestUrl(),
    page: context.data.getCurrentPage(),
  })

  return () => {
    isDisposed = true
    fetchController.abort()
    window.clearInterval(interval)
    if (completionSuppressionTimer !== null) window.clearTimeout(completionSuppressionTimer)
    completionSuppressionObserver?.disconnect()
    window.removeEventListener('resize', onResize)
    document.removeEventListener('tribeCommandHarnessTurnStart', onCommandHarnessTurnStart)
    document.removeEventListener('tribeCommandHarnessTurnSettle', onCommandHarnessTurnSettle)
    pageChangeCleanup()
    root.remove()
    activeWordHotspots = []
    if (shouldExposeStandaloneDebugGlobals) {
      debugWindow.tribeWordHotspots = []
      delete debugWindow.tribeClickWordHotspot
      delete debugWindow.tribeForceWordHotspotPage
      delete debugWindow.tribeWordHotspotDebug
    }
  }
}

function renderDrawer(context: ExtensionContext, action: RiveAction | null): HTMLElement {
  const drawerRoot = context.slots.get('drawer')
  injectStyle(drawerRoot, drawerStyles, 'tribe-extension-drawer-styles')

  const existing = drawerRoot.querySelector('.tribe-drawer')
  existing?.remove()

  const book = context.data.getBookData()
  const panel = document.createElement('section')
  panel.className = 'tribe-drawer'

  const title = document.createElement('h2')
  title.textContent = '1 Tribe Rive Interaction'

  const intro = document.createElement('p')
  intro.textContent = action
    ? `Rive sent "${action.name}" from ${action.source}.`
    : 'The drawer opened from the Rive extension.'

  const meta = document.createElement('div')
  meta.className = 'tribe-meta'

  const rows = [
    ['Book', book.title || `ID ${context.data.getBookId() || 'Unknown'}`],
    ['Page', String(context.data.getCurrentPage())],
    ['Action', action?.name || 'openDrawer'],
  ]

  for (const [label, value] of rows) {
    const row = document.createElement('div')
    row.className = 'tribe-meta-row'

    const labelEl = document.createElement('strong')
    labelEl.textContent = label

    const valueEl = document.createElement('span')
    valueEl.textContent = value

    row.append(labelEl, valueEl)
    meta.append(row)
  }

  const closeButton = document.createElement('button')
  closeButton.className = 'tribe-close'
  closeButton.type = 'button'
  closeButton.textContent = 'Close'
  closeButton.addEventListener('click', () => {
    context.commands.execute('closeDrawer')
    context.analytics.log('1tribe_drawer_closed', {
      bookId: context.data.getBookId(),
      page: context.data.getCurrentPage(),
    })
  })

  panel.append(title, intro, meta, closeButton)
  drawerRoot.append(panel)

  return panel
}

function activateSimpleRiveOverlay(context: ExtensionContext): () => void {
  const readingRoot = context.slots.get('reading-area')
  const root = document.createElement('div')
  const frame = document.createElement('div')
  const canvas = document.createElement('canvas')
  const wordHotspotLayer = document.createElement('div')
  const readingAreaMask = document.createElement('div')
  const completionPage = document.createElement('div')
  const navBackGutter = document.createElement('div')
  const navNextGutter = document.createElement('div')
  const status = document.createElement('div')
  const startButton = document.createElement('button')
  const sequentialControls = document.createElement('div')
  const sequentialBackButton = document.createElement('button')
  const sequentialNextButton = document.createElement('button')
  const stateMachineControls = document.createElement('div')
  const cleanupCallbacks: Array<() => void> = []
  const fetchController = new AbortController()
  const shouldExposeSimpleDebugGlobals = shouldExposeDebugGlobals()
  const pageSwapDelayMs = getNumberParam('rivePageSwapDelayMs', 0)
  const initialLoadDelayMs = getNumberParam('riveInitialLoadDelayMs', 0)
  const pageFlipMs = getNumberParam('rivePageFlipMs', 520)
  const pageTurnStartDelayMs = getNumberParam('rivePageTurnStartDelayMs', 0)
  const transitionDurationMs = getNumberParam('riveTransitionDurationMs', 700)
  const pageInFallbackPollMs = getNumberParam('rivePageInFallbackPollMs', 120)
  const shouldDisableRiveAnimations =
    getBooleanParam('riveDisableAnimations', false) || getBooleanParam('riveNoAnimations', false)
  const shouldUseStateMachineIdleOnly = getBooleanParam('riveStateMachineIdleOnly', false)
  const shouldDisableTimelineAnimations = shouldDisableRiveAnimations || shouldUseStateMachineIdleOnly
  const shouldUseStateMachinePageActions = getBooleanParam('riveStateMachinePageActions', shouldUseStateMachineIdleOnly)
  const shouldUseSpreadTransitionAnimations = !shouldDisableTimelineAnimations && getBooleanParam('riveSpreadTransitions', true)
  const shouldDisablePageOutAnimation = getBooleanParam('riveDisablePageOut', false)
  const shouldDisableForwardPageOutAnimation = getBooleanParam('riveDisableForwardPageOut', false)
  const shouldDeferOutgoingPageTurn = getBooleanParam('riveDeferOutgoingPageTurn', false)
  const shouldPlaceForwardIncomingOnTop = getBooleanParam('riveForwardIncomingOnTop', false)
  const shouldUseSnapshotBackdrop = getBooleanParam('riveSnapshotBackdrop', false)
  const replacementBackdrop = getCssBackgroundParam('riveDebugBackdrop', '#ffffff')
  const pageTurnForwardOutAnimation = getStringParam('rivePageTurnForwardOutAnimation')?.trim() || 'Page_out'
  const pageTurnBackOutAnimation = getStringParam('rivePageTurnBackOutAnimation')?.trim() || 'Page_go back'
  const pageTurnInAnimation = getStringParam('rivePageTurnInAnimation')?.trim() || 'Page_in'
  const pageTurnIdleAnimation = getStringParam('rivePageTurnIdleAnimation')?.trim() || 'Page_idle'
  const shouldRunIdleAfterPageIn = getBooleanParam('riveRunIdleAfterPageIn', true)
  const shouldStartIdleOnLoad = getBooleanParam('riveStartIdleOnLoad', false)
  const shouldUseNativePageFlip = getBooleanParam('riveNativePageFlip', false)
  const shouldUseTransitionFiles = getBooleanParam('riveTransitionFiles', false)
  const shouldStackTransitionPages = getBooleanParam('riveStackTransitionPages', true)
  const shouldStackPageFiles = getBooleanParam('riveStackPageFiles', true)
  const isRiveInteractive = getBooleanParam('riveInteractive', false)
  const shouldUseSequentialFiles = getBooleanParam('riveSequential', false)
  const shouldPreloadAdjacentUnderlay =
    !shouldDisableTimelineAnimations && getBooleanParam('rivePreloadAdjacentUnderlay', true)
  const shouldPreloadAdjacentOnInitialLoad = getBooleanParam('rivePreloadAdjacentOnInitialLoad', false)
  const shouldCaptureRivePointer = getBooleanParam('rivePointer', false)
  const shouldAutomaticallyHandleRiveEvents = getBooleanParam('riveAutoEvents', false)
  const shouldInspectRiveContents = getBooleanParam('riveInspect', false)
  const shouldOfferManualStart = getBooleanParam('riveManualStart', true)
  const shouldStartStateMachineOnInitialLoad =
    !shouldDisableRiveAnimations && (shouldUseStateMachineIdleOnly || getBooleanParam('riveStartOnInitial', true))
  const shouldStartStateMachineOnPageTurn =
    !shouldDisableRiveAnimations && (shouldUseStateMachineIdleOnly || getBooleanParam('riveStartOnPageTurn', true))
  const shouldShowCompletionPage = getBooleanParam('riveCompletionPage', true)
  const shouldReplaceReadingArea = getBooleanParam('riveReplaceReadingArea', false)
  const shouldPreserveReaderChrome = getBooleanParam('rivePreserveReaderChrome', true)
  const shouldShowStateMachineControls = getBooleanParam('riveStateMachineControls', false)
  const shouldUseWordHotspots =
    !shouldUseStandaloneWordHotspots() &&
    (getBooleanParam('riveWordHotspots', false) || getBooleanParam('wordHotspots', false))
  const shouldHideSuspectWordHotspots = getBooleanParam('riveWordHotspotHideSuspect', false)
  const wordHotspotPaddingRatio = getNumberParam('riveWordHotspotPaddingPct', 0)
  const wordHotspotPaddingXRatio = getNumberParam('riveWordHotspotPaddingXPct', wordHotspotPaddingRatio)
  const wordHotspotPaddingYRatio = getNumberParam('riveWordHotspotPaddingYPct', wordHotspotPaddingRatio)
  const wordHotspotStrokeWidthPx = Math.max(1, getNumberParam('riveWordHotspotStrokePx', 3))
  const wordHotspotMagnifyScale = Math.max(1, getNumberParam('riveWordHotspotMagnifyScale', 1.16))
  const wordHotspotMagnifierPixelScale = Math.max(
    1,
    Math.min(3, getNumberParam('riveWordHotspotMagnifierPixelScale', wordHotspotMagnifyScale)),
  )
  const wordHotspotOutlineScaleX = Math.max(1, getNumberParam('riveWordHotspotOutlineScaleX', 1.16))
  const wordHotspotOutlineScaleY = Math.max(1, getNumberParam('riveWordHotspotOutlineScaleY', 1.2))
  const wordHotspotShadowXPx = getNonNegativeNumberParam('riveWordHotspotShadowXPx', 5)
  const wordHotspotShadowYPx = getNonNegativeNumberParam('riveWordHotspotShadowYPx', 5)
  const shouldUseWordHotspotMagnifier = wordHotspotMagnifyScale > 1.001
  const shouldShowWordHotspotBoxes = getBooleanParam('riveWordHotspotShowBoxes', false)
  const wordHotspotManifestParam = getStringParam('riveWordHotspotManifest')?.trim() || null
  const wordHotspotFolderParam = getStringParam('riveWordHotspotFolder')?.trim() || null
  const focusedRiveFolder = (getStringParam('riveFolder') || wordHotspotFolderParam || '').trim()
  const shouldUseFocusedDirectReplacement =
    focusedRiveFolder === 'Test_June2_4-5' && !shouldUseSpreadTransitionAnimations && !shouldStackPageFiles
  const replacementSelector = getStringParam('riveReplaceSelector')?.trim() || null
  const hideSelector = getStringParam('riveHideSelector')?.trim() || replacementSelector
  const frameSelector = getStringParam('riveFrameSelector')?.trim() || replacementSelector
  const harnessAnimationEventName = 'tribeHarnessAnimation'
  const harnessAvailableAnimationsEventName = 'tribeHarnessAvailableAnimations'
  const shouldReplaceSelectedContent = Boolean(hideSelector || frameSelector)
  const navGutterParam = getStringParam('riveNavGutterPct')
  const navGutterValue = navGutterParam === null ? Number.NaN : Number(navGutterParam)
  const requestedInteractiveAnimation = getStringParam('riveAnimation')?.trim() || null
  const requestedInteractiveStateMachine = getStringParam('riveStateMachine')?.trim() || null
  const requestedInteractiveArtboard = getStringParam('riveArtboard')?.trim() || null
  const requestedTransitionAnimation = getStringParam('riveTransitionAnimation')?.trim() || null
  const requestedTransitionArtboard = getStringParam('riveTransitionArtboard')?.trim() || null
  const activeBookId = getSimpleRiveBookIdFromContext(context)
  const activeBookConfig =
    getEpicTribeBookConfig(activeBookId) ||
    getEpicTribeBookConfig(context.data.getBookId()) ||
    getEpicTribeBookConfig()
  const shouldAutoSelectAnimation = requestedInteractiveAnimation?.toLowerCase() === 'auto'
  const shouldAutoSelectStateMachine = requestedInteractiveStateMachine?.toLowerCase() === 'auto'
  const shouldUseStateMachine = (isRiveInteractive || shouldUseStateMachineIdleOnly) && Boolean(requestedInteractiveStateMachine)
  let isRivePointerCaptureEnabled = shouldCaptureRivePointer || (shouldUseStateMachine && runtimeConfig.autoplay)
  const navGutterRatio =
    Number.isFinite(navGutterValue) && navGutterValue >= 0 ? navGutterValue / 100 : 0.02
  const shouldUseReaderNavGutters = getBooleanParam('riveNavGutters', shouldPreserveReaderChrome)
  const areRiveListenersEnabled = getBooleanParam('riveListeners', shouldUseStateMachine)
  let files: SimpleRiveFile[] = []
  let displayedPage = context.data.getCurrentPage()
  let displayedFileIndex = -1
  let activeFileUrl: string | null = null
  let pendingFileUrl: string | null = null
  let pendingPlaybackKey: string | null = null
  let activeCanvas = canvas
  let rive: Rive | null = null
  let pendingRive: Rive | null = null
  let pendingCanvas: HTMLCanvasElement | null = null
  let interactionBindings: SimpleRiveInteractionBinding[] = []
  const transitionPlayers: Partial<Record<TransitionDirection, TransitionRivePlayer>> = {}
  let activeTransitionDirection: TransitionDirection | null = null
  let transitionCleanupTimer: number | null = null
  let activeAnimation: string | null = null
  let activeAnimationEntry: SimpleRiveAnimationEntry | null = null
  let activeStateMachine: string | null = null
  let activeStateMachineEntry: SimpleRiveStateMachineEntry | null = null
  let activePlaybackKey: string | null = null
  let activeSpreadIncomingPageInHandled = false
  let preloadedUnderlay: SimpleRiveUnderlay | null = null
  let retainedBackUnderlays: SimpleRiveUnderlay[] = []
  let pendingUnderlayRive: Rive | null = null
  let pendingUnderlayCanvas: HTMLCanvasElement | null = null
  let pendingUnderlayFileUrl: string | null = null
  let pendingUnderlayPlaybackKey: string | null = null
  let underlayLoadSerial = 0
  let isDisposed = false
  let loadSerial = 0
  let pendingNavigationDirection: number | null = null
  let pendingNavigationReason = ''
  let pendingNavigationStartedSpreadTransition = false
  let pendingIncomingPageTurnAnimation: { animation: string; direction: number; reason: string } | null = null
  let pendingOutgoingPageTurnAnimation: { animation: string; label: string } | null = null
  let isSimpleRivePageTurnBusy = false
  let simpleRivePageTurnBusyTimer: number | null = null
  let pendingPageOutOffloadReleaseAttempts = 0
  const maxPageOutOffloadReleaseAttempts = 12
  let queuedRapidPageChange: { page: number; direction: number; reason: string } | null = null
  let pendingPageOutOffload:
    | {
        instance: Rive
        animation: string
        artboard: string
        activeFile: string | null
        didStop: boolean
        offload: (() => void) | null
        afterOffload: (() => void) | null
        cleanup: () => void
      }
      | null = null
  let rapidPageChangeCatchUpTimer: number | null = null
  let frameBackdropSnapshotUrl: string | null = null
  let frameBackdropSnapshotTimer: number | null = null
  let pendingNavigationTimer: number | null = null
  let pageLoadTimer: number | null = null
  let pageFlipTimer: number | null = null
  let wordHotspotSerial = 0
  let activeWordHotspots: ActiveWordHotspot[] = []
  let lastWordHotspotLookupAt = 0
  let lastWordHotspotLookupKey = ''
  let lastWordHotspotDebug: Record<string, unknown> = {
    enabled: shouldUseWordHotspots,
    message: shouldUseWordHotspots ? 'Word hotspots enabled; waiting for a mapped Rive file.' : 'Word hotspots disabled.',
  }
  let pageTurnStartTimer: number | null = null
  let readerNavGuttersEnabled = false
  let readerNavGutterWidthPx = 0
  let postPageInRenderTimer: number | null = null
  let postPageInRenderCleanup: (() => void) | null = null
  let postPageInRenderFrame: number | null = null
  let backPageIdleTimer: number | null = null
  let backPageIdleCleanup: (() => void) | null = null
  let lastRivePointerInteractionAt = 0
  let lastReaderNavigationAt = 0
  let lastReaderNavigationCommand: ReaderCommand | null = null
  let replacementObserver: MutationObserver | null = null
  const hiddenReadingAreaChildren: Array<{
    element: HTMLElement
    visibility: string
    pointerEvents: string
    ariaHidden: string | null
  }> = []
  const hiddenSelectedElements: Array<{
    element: HTMLElement
    visibility: string
    pointerEvents: string
    ariaHidden: string | null
  }> = []
  type EpicNativePointerPassthroughSide = 'left' | 'right'
  let hasWarnedAboutReplacementSelector = false
  const wordHotspotManifestPromises = new Map<string, Promise<WordHotspotManifest | null>>()

  const getActiveSimpleRiveFileForPassthrough = () =>
    getSimpleRiveFileForPage(files, displayedPage)?.file ||
    getSimpleRiveFileForPage(files, context.data.getCurrentPage())?.file ||
    (activeFileUrl ? files.find((file) => file.url === activeFileUrl) || null : null)

  const getLastReaderPageForNativePassthrough = () => {
    const bookPageCount = Number(context.data.getBookData()?.numPages)
    if (Number.isFinite(bookPageCount) && bookPageCount > 0) return Math.max(0, Math.trunc(bookPageCount) - 1)

    return getSimpleRiveLastPage(files)
  }

  const getEpicNativePointerPassthroughRules = (): Array<{
    pages: number[]
    side: EpicNativePointerPassthroughSide
  }> => {
    const fallbackLastPage = getLastReaderPageForNativePassthrough()
    const leftPages = activeBookConfig?.nativePassthroughLeftPages ?? [0]
    const rightPages =
      activeBookConfig?.nativePassthroughRightPages ?? (fallbackLastPage === null ? [] : [fallbackLastPage])

    return [
      { pages: leftPages, side: 'left' as const },
      { pages: rightPages, side: 'right' as const },
    ].filter((rule) => rule.pages.length > 0)
  }

  const doesSimpleRiveFileCoverReaderPage = (file: SimpleRiveFile | null, page: number): boolean => {
    if (!file) return false
    if (file.readerPages?.includes(page)) return true
    if (!file.pages) return false

    const [startPage, endPage] = file.pages
    return Number.isFinite(startPage) && Number.isFinite(endPage) && page >= startPage && page <= endPage
  }

  const getActiveEpicNativePointerPassthroughRules = () => {
    const activeFile = getActiveSimpleRiveFileForPassthrough()
    const currentPage = context.data.getCurrentPage()
    const epicNativePointerPassthroughRules = getEpicNativePointerPassthroughRules()
    return epicNativePointerPassthroughRules.filter((rule) => {
      if (rule.pages.includes(displayedPage) || rule.pages.includes(currentPage)) return true
      return rule.pages.some((page) => doesSimpleRiveFileCoverReaderPage(activeFile, page))
    })
  }

  const getActiveEpicNativePointerPassthroughSides = () =>
    new Set(getActiveEpicNativePointerPassthroughRules().map((rule) => rule.side))

  const syncEpicNativePointerPassthroughState = () => {
    const activeRules = getActiveEpicNativePointerPassthroughRules()
    const activeSides = new Set(activeRules.map((rule) => rule.side))
    const isActive = activeSides.size > 0

    root.classList.toggle('is-epic-native-passthrough', isActive)
    root.classList.toggle('is-epic-native-passthrough-left', activeSides.has('left'))
    root.classList.toggle('is-epic-native-passthrough-right', activeSides.has('right'))

    if (isActive) {
      root.dataset.epicPassthroughSides = Array.from(activeSides).join(',')
      root.dataset.epicPassthroughPages = activeRules.map((rule) => `${rule.pages.join('+')}:${rule.side}`).join(',')
    } else {
      delete root.dataset.epicPassthroughSides
      delete root.dataset.epicPassthroughPages
    }

    return activeSides
  }

  const getEffectiveRivePointerEvents = (activeSides = getActiveEpicNativePointerPassthroughSides()) =>
    isRivePointerCaptureEnabled && activeSides.size < 2 ? 'auto' : 'none'

  const applyRivePointerCaptureStyles = (activeSides = syncEpicNativePointerPassthroughState()) => {
    const shouldAllowRivePointerEvents = isRivePointerCaptureEnabled && activeSides.size < 2
    const pointerEvents = shouldAllowRivePointerEvents ? 'auto' : 'none'

    root.classList.toggle('is-rive-interactive', shouldAllowRivePointerEvents)
    frame.style.pointerEvents = pointerEvents
    activeCanvas.style.pointerEvents = pointerEvents
    for (const binding of interactionBindings) {
      binding.canvas.style.pointerEvents = pointerEvents
    }
  }

  const describeDebugElement = (element: Element | null) => {
    if (!element) return null
    const htmlElement = element instanceof HTMLElement ? element : null
    const styles = htmlElement ? window.getComputedStyle(htmlElement) : null
    return {
      ariaLabel: element.getAttribute('aria-label'),
      className: typeof element.className === 'string' ? element.className : '',
      dataTestId: element.getAttribute('data-testid'),
      display: styles?.display || null,
      id: element.id || null,
      pointerEvents: styles?.pointerEvents || null,
      tagName: element.tagName.toLowerCase(),
      title: element.getAttribute('title'),
      visibility: styles?.visibility || null,
      zIndex: styles?.zIndex || null,
    }
  }

  const getDebugPointStack = (x: number, y: number) =>
    document.elementsFromPoint(x, y).slice(0, 8).map((element) => describeDebugElement(element))

  const getEpicNativePassthroughDebug = () => {
    const activeFile = getActiveSimpleRiveFileForPassthrough()
    const activeRules = getActiveEpicNativePointerPassthroughRules()
    const activeSides = syncEpicNativePointerPassthroughState()
    const frameRect = frame.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    const leftX = frameRect.left + frameRect.width * 0.25
    const rightX = frameRect.left + frameRect.width * 0.75
    const centerY = frameRect.top + frameRect.height * 0.5

    return {
      activeFile: activeFile
        ? {
            name: activeFile.name,
            pages: activeFile.pages,
            readerPages: activeFile.readerPages,
            url: activeFile.url,
          }
        : null,
      activeRules: activeRules.map((rule) => ({ pages: rule.pages, side: rule.side })),
      activeSides: Array.from(activeSides),
      currentPage: context.data.getCurrentPage(),
      displayedPage,
      frame: {
        className: frame.className,
        clipPath: window.getComputedStyle(frame).clipPath,
        pointerEvents: window.getComputedStyle(frame).pointerEvents,
        rect: {
          height: frameRect.height,
          width: frameRect.width,
          x: frameRect.x,
          y: frameRect.y,
        },
      },
      leftPointStack: getDebugPointStack(leftX, centerY),
      maskHidden: readingAreaMask.hidden,
      navBackHidden: navBackGutter.hidden,
      navNextHidden: navNextGutter.hidden,
      rightPointStack: getDebugPointStack(rightX, centerY),
      root: {
        className: root.className,
        dataset: {
          epicPassthroughPages: root.dataset.epicPassthroughPages || null,
          epicPassthroughSides: root.dataset.epicPassthroughSides || null,
        },
        pointerEvents: window.getComputedStyle(root).pointerEvents,
        rect: {
          height: rootRect.height,
          width: rootRect.width,
          x: rootRect.x,
          y: rootRect.y,
        },
      },
    }
  }

  injectStyle(readingRoot, simpleOverlayStyles, 'tribe-simple-overlay-styles')

  root.className = 'tribe-simple-overlay-root'
  root.classList.toggle('is-reading-area-replacement', shouldReplaceReadingArea)
  root.classList.toggle('is-hiding-reader-content', shouldReplaceReadingArea && !shouldPreserveReaderChrome)
  root.style.setProperty('--tribe-rive-replacement-backdrop', replacementBackdrop)
  readingAreaMask.className = 'tribe-simple-reading-mask'
  readingAreaMask.hidden = !shouldReplaceReadingArea
  frame.className = 'tribe-simple-rive-frame'
  canvas.className = 'tribe-simple-rive-canvas'
  navBackGutter.className = 'tribe-simple-nav-gutter tribe-simple-nav-gutter--back'
  navBackGutter.hidden = true
  navBackGutter.setAttribute('aria-hidden', 'true')
  navBackGutter.setAttribute('data-reader-navigation-ignore', 'true')
  navNextGutter.className = 'tribe-simple-nav-gutter tribe-simple-nav-gutter--next'
  navNextGutter.hidden = true
  navNextGutter.setAttribute('aria-hidden', 'true')
  navNextGutter.setAttribute('data-reader-navigation-ignore', 'true')
  wordHotspotLayer.className = 'tribe-word-hotspot-layer'
  wordHotspotLayer.classList.toggle('is-debug-visible', shouldShowWordHotspotBoxes)
  wordHotspotLayer.hidden = true
  wordHotspotLayer.setAttribute('data-reader-navigation-ignore', 'true')
  completionPage.className = 'book-completion-page-container tribe-simple-completion-page'
  completionPage.hidden = true
  status.className = 'tribe-simple-rive-status'
  status.textContent = 'Loading Rive file list...'
  startButton.className = 'tribe-simple-rive-start'
  startButton.type = 'button'
  startButton.textContent = 'Start Rive'
  startButton.hidden = true
  sequentialControls.className = 'tribe-simple-sequential-controls'
  sequentialControls.hidden = !shouldUseSequentialFiles
  sequentialBackButton.type = 'button'
  sequentialBackButton.textContent = 'Back'
  sequentialNextButton.type = 'button'
  sequentialNextButton.textContent = 'Next'
  sequentialControls.append(sequentialBackButton, sequentialNextButton)
  stateMachineControls.className = 'tribe-simple-state-controls'
  stateMachineControls.hidden = true
  frame.style.setProperty('--tribe-page-flip-ms', `${pageFlipMs}ms`)

  const precompletionPage = document.createElement('epic-book-precompletion-page')
  const precompletionContainer = document.createElement('div')
  const almostDoneImage = document.createElement('img')
  precompletionPage.className = 'tribe-simple-precompletion-page'
  precompletionContainer.className = 'book-precompletion-page-container'
  almostDoneImage.className = 'almost-done'
  almostDoneImage.src = '/assets/app/read/almost-done-book.svg'
  almostDoneImage.alt = ''
  precompletionContainer.append(almostDoneImage)
  precompletionPage.append(precompletionContainer)
  completionPage.append(precompletionPage)

  frame.append(canvas, completionPage, wordHotspotLayer)
  root.append(
    readingAreaMask,
    frame,
    navBackGutter,
    navNextGutter,
    status,
    startButton,
    sequentialControls,
    stateMachineControls,
  )
  readingRoot.append(root)
  applyRivePointerCaptureStyles()
  const debugWindow = window as TribeDebugWindow
  if (shouldExposeSimpleDebugGlobals) {
    debugWindow.tribeEpicNativePassthroughDebug = getEpicNativePassthroughDebug
    cleanupCallbacks.push(() => {
      if (debugWindow.tribeEpicNativePassthroughDebug === getEpicNativePassthroughDebug) {
        delete debugWindow.tribeEpicNativePassthroughDebug
      }
    })
  }

  const setStatus = (message: string) => {
    status.textContent = message
    console.info(`[1Tribe simple overlay] ${message}`)
  }

  const enableRivePointerCapture = () => {
    isRivePointerCaptureEnabled = true
    applyRivePointerCaptureStyles()
  }

  const disableRivePointerCapture = () => {
    if (shouldCaptureRivePointer) return
    if (runtimeConfig.autoplay) return

    isRivePointerCaptureEnabled = false
    applyRivePointerCaptureStyles()
  }

  const hideManualStart = () => {
    startButton.hidden = true
  }

  const showManualStart = (fileName: string, stateMachineName: string) => {
    if (!shouldOfferManualStart) return

    startButton.textContent = `Start ${stateMachineName}`
    startButton.hidden = false
    setStatus(`Loaded ${fileName} with ${stateMachineName}. Click Start when the reader is stable.`)
  }

  const normalizeWordHotspotFileName = (value: string) => {
    const normalized = value.replace(/\\/g, '/')
    return normalized.split('/').filter(Boolean).at(-1) || normalized
  }

  const cleanWordHotspotWord = (value: string) => value.replace(/[^A-Za-z0-9'-]+/g, '').trim()

  const isSuspectWordHotspot = (value: string) => {
    const clean = cleanWordHotspotWord(value)
    if (clean.length <= 1) return true
    if (/^\d+$/.test(clean)) return true
    return clean !== value.trim()
  }

  const getWordHotspotManifestUrl = (file: SimpleRiveFile) => {
    if (wordHotspotManifestParam) {
      return new URL(wordHotspotManifestParam, extensionScriptUrl).href
    }

    const folder = wordHotspotFolderParam || file.folder
    if (!folder) return null

    return new URL(`rive/${folder}/word-hotspots/word-hotspots.json`, extensionScriptUrl).href
  }

  const loadWordHotspotManifest = (manifestUrl: string) => {
    const cached = wordHotspotManifestPromises.get(manifestUrl)
    if (cached) return cached

    const promise = fetch(manifestUrl, {
      cache: 'no-store',
      signal: fetchController.signal,
    })
      .then(async (response): Promise<WordHotspotManifest | null> => {
        if (!response.ok) {
          console.warn(`[1Tribe word hotspots] Unable to load ${manifestUrl}: HTTP ${response.status}`)
          return null
        }

        return (await response.json()) as WordHotspotManifest
      })
      .catch((error): WordHotspotManifest | null => {
        if (!fetchController.signal.aborted) {
          console.warn(`[1Tribe word hotspots] Unable to load ${manifestUrl}: ${String(error)}`)
        }
        return null
      })

    wordHotspotManifestPromises.set(manifestUrl, promise)
    return promise
  }

  function getReaderNavGutterDebugState(): Record<string, unknown> {
    const backRect = navBackGutter.getBoundingClientRect()
    const nextRect = navNextGutter.getBoundingClientRect()
    return {
      requested: shouldUseReaderNavGutters,
      enabled: readerNavGuttersEnabled,
      navGutterPct: navGutterRatio * 100,
      widthPx: readerNavGutterWidthPx,
      backHidden: navBackGutter.hidden,
      nextHidden: navNextGutter.hidden,
      backRect: {
        x: backRect.x,
        y: backRect.y,
        width: backRect.width,
        height: backRect.height,
      },
      nextRect: {
        x: nextRect.x,
        y: nextRect.y,
        width: nextRect.width,
        height: nextRect.height,
      },
    }
  }

  function syncWordHotspotDebugHelpers() {
    if (!shouldExposeSimpleDebugGlobals) return

    const debugWindow = window as TribeDebugWindow
    debugWindow.tribeWordHotspots = activeWordHotspots.slice()
    debugWindow.tribeReaderNavGutterDebug = getReaderNavGutterDebugState
    debugWindow.tribeWordHotspotDebug = () => {
      const activeFile = getActiveSimpleRiveFile()
      const activeFileManifestUrl = activeFile ? getWordHotspotManifestUrl(activeFile) : null
      return {
        enabled: shouldUseWordHotspots,
        activeCount: activeWordHotspots.length,
        layerHidden: wordHotspotLayer.hidden,
        layerFile: wordHotspotLayer.dataset.file || null,
        layerCount: wordHotspotLayer.dataset.count || null,
        pageAudit: getActiveWordHotspotPageAudit(
          activeWordHotspots,
          Array.from(wordHotspotLayer.querySelectorAll<HTMLButtonElement>('.tribe-word-hotspot-button')),
        ),
        displayedPage,
        contextCurrentPage: context.data.getCurrentPage(),
        activeFile: activeFile?.name || null,
        activeFileUrl,
        activeFileManifestUrl,
        geometrySource: 'rive-ocr-sidecar',
        requestedFolder: getStringParam('riveFolder'),
        showBoxes: shouldShowWordHotspotBoxes,
        wordHotspotTest: getBooleanParam('tribeWordHotspotTest', false),
        mappedFiles: files.map((item) => ({
          name: item.name,
          folder: item.folder,
          pages: item.pages,
          readerPages: item.readerPages,
        })),
        cachedManifestUrls: Array.from(wordHotspotManifestPromises.keys()),
        readerNavGutters: getReaderNavGutterDebugState(),
        wordLookupDismissGuard: getWordLookupDismissGuardDebugState(),
        last: lastWordHotspotDebug,
      }
    }
    debugWindow.tribeClickWordHotspot = (word = '') => {
      const normalizedWord = word.trim().toLowerCase()
      const hotspot =
        activeWordHotspots.find((item) => item.word.toLowerCase() === normalizedWord) ||
        activeWordHotspots[0] ||
        null
      if (!hotspot) {
        console.warn('[1Tribe word hotspots] No active hotspot is available for console lookup.', {
          requestedWord: word,
        })
        return false
      }

      executeWordHotspotLookup(hotspot, 'console-helper')
      return true
    }
    debugWindow.tribeForceWordHotspotPage = (page = 4) => {
      const targetPage = Number(page)
      if (!Number.isFinite(targetPage)) return false

      const match = getSimpleRiveFileForPage(files, targetPage)
      console.info('[1Tribe word hotspots] Force word hotspot page.', {
        targetPage,
        match: match?.file.name || null,
        files: files.map((item) => ({ name: item.name, pages: item.pages, readerPages: item.readerPages })),
      })
      if (!match) return false

      displayedPage = targetPage
      loadFileForPage(targetPage, 'console force word hotspot page')
      return true
    }
  }

  const clearWordHotspots = () => {
    wordHotspotSerial += 1
    activeWordHotspots = []
    lastWordHotspotDebug = {
      enabled: shouldUseWordHotspots,
      message: 'Word hotspots were cleared.',
      displayedPage,
      contextCurrentPage: context.data.getCurrentPage(),
      activeFile: getActiveSimpleRiveFile()?.name || null,
    }
    wordHotspotLayer.textContent = ''
    wordHotspotLayer.hidden = true
    delete wordHotspotLayer.dataset.file
    delete wordHotspotLayer.dataset.count
    syncWordHotspotDebugHelpers()
  }

  const findWordHotspotFile = (manifest: WordHotspotManifest, file: SimpleRiveFile) => {
    const activeName = normalizeWordHotspotFileName(file.name)
    return (
      manifest.files?.find((candidate) => normalizeWordHotspotFileName(candidate.file || '') === activeName) || null
    )
  }

  const executeWordHotspotLookup = (hotspot: ActiveWordHotspot, source: string, event?: Event) => {
    event?.preventDefault()
    event?.stopPropagation()

    const now = Date.now()
    const key = `${hotspot.fileName}|${hotspot.page}|${hotspot.word}`
    if (key === lastWordHotspotLookupKey && now - lastWordHotspotLookupAt < 500) return
    lastWordHotspotLookupKey = key
    lastWordHotspotLookupAt = now

    console.info(`[1Tribe word hotspots] lookup_word "${hotspot.word}" from ${source}.`, {
      file: hotspot.fileName,
      page: hotspot.page,
      reason: hotspot.reason,
      sourceWord: hotspot.sourceWord,
    })
    armWordLookupDismissGuard(hotspot.word, source, event)
    context.commands.execute('lookup_word', hotspot.word)
    context.analytics.log('1tribe_word_hotspot_lookup', {
      bookId: context.data.getBookId(),
      file: hotspot.fileName,
      page: hotspot.page,
      reason: hotspot.reason,
      eventSource: source,
      sourceWord: hotspot.sourceWord,
      word: hotspot.word,
    })
    setStatus(`Word hotspot lookup_word: ${hotspot.word}.`)
  }

  const getWordHotspotAtPointer = (event: PointerEvent): ActiveWordHotspot | null => {
    if (!activeWordHotspots.length) return null

    const rect = frame.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null

    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height

    return getSmallestActiveWordHotspotAtPoint(activeWordHotspots, x, y)
  }

  const onWordHotspotFramePointerUp = (event: PointerEvent) => {
    if (!shouldUseWordHotspots || event.button !== 0) return
    const hotspot = getWordHotspotAtPointer(event)
    if (!hotspot) return

    executeWordHotspotLookup(hotspot, 'frame-pointerup', event)
  }

  frame.addEventListener('pointerup', onWordHotspotFramePointerUp, true)
  cleanupCallbacks.push(() => frame.removeEventListener('pointerup', onWordHotspotFramePointerUp, true))
  cleanupCallbacks.push(() => {
    if (!shouldExposeSimpleDebugGlobals) return

    const debugWindow = window as TribeDebugWindow
    delete debugWindow.tribeWordHotspots
    delete debugWindow.tribeClickWordHotspot
    delete debugWindow.tribeForceWordHotspotPage
    delete debugWindow.tribeReaderNavGutterDebug
    delete debugWindow.tribeWordHotspotDebug
  })

  const renderWordHotspotsForFile = async (file: SimpleRiveFile, page: number, reason: string) => {
    if (!shouldUseWordHotspots || isDisposed) return

    const manifestUrl = getWordHotspotManifestUrl(file)
    if (!manifestUrl) {
      clearWordHotspots()
      lastWordHotspotDebug = {
        enabled: shouldUseWordHotspots,
        message: 'No word hotspot manifest URL could be inferred for the active file.',
        file: file.name,
        page,
        reason,
      }
      syncWordHotspotDebugHelpers()
      return
    }

    const serial = ++wordHotspotSerial
    lastWordHotspotDebug = {
      enabled: shouldUseWordHotspots,
      message: 'Loading word hotspot manifest.',
      file: file.name,
      page,
      reason,
      manifestUrl,
    }
    syncWordHotspotDebugHelpers()
    const manifest = await loadWordHotspotManifest(manifestUrl)
    if (isDisposed || serial !== wordHotspotSerial) return
    if (!manifest) {
      lastWordHotspotDebug = {
        enabled: shouldUseWordHotspots,
        message: 'Word hotspot manifest did not load.',
        file: file.name,
        page,
        reason,
        manifestUrl,
      }
      syncWordHotspotDebugHelpers()
      return
    }

    let hotspotFile = getConfiguredWordHotspotFileForPage(context, page, manifest) || findWordHotspotFile(manifest, file)
    if (!hotspotFile) {
      wordHotspotLayer.textContent = ''
      wordHotspotLayer.hidden = true
      wordHotspotLayer.dataset.file = file.name
      wordHotspotLayer.dataset.count = '0'
      activeWordHotspots = []
      lastWordHotspotDebug = {
        enabled: shouldUseWordHotspots,
        message: 'Manifest loaded, but no manifest file entry matched the active Rive file.',
        file: file.name,
        page,
        reason,
        manifestUrl,
        availableFiles: manifest.files?.map((candidate) => candidate.file) || [],
      }
      syncWordHotspotDebugHelpers()
      console.info(`[1Tribe word hotspots] No hotspot file matched ${file.name}.`, {
        manifestUrl,
        availableFiles: manifest.files?.map((candidate) => candidate.file) || [],
      })
      return
    }
    const ocrHotspotFile = await getWordHotspotFileWithOcrSidecar(
      hotspotFile,
      manifest,
      manifestUrl,
      fetchController.signal,
    )
    if (!ocrHotspotFile) {
      wordHotspotLayer.textContent = ''
      wordHotspotLayer.hidden = true
      wordHotspotLayer.dataset.file = file.name
      wordHotspotLayer.dataset.count = '0'
      activeWordHotspots = []
      lastWordHotspotDebug = {
        enabled: shouldUseWordHotspots,
        file: file.name,
        geometrySource: 'rive-ocr-sidecar',
        manifestUrl,
        message: 'No valid Rive OCR sidecar geometry was available for the active Rive file.',
        page,
        reason,
      }
      syncWordHotspotDebugHelpers()
      return
    }
    hotspotFile = ocrHotspotFile
    if (isDisposed || serial !== wordHotspotSerial) return

    const words = (hotspotFile.words || []).filter((word) => {
      const text = String(word.text || '')
      return text && (!shouldHideSuspectWordHotspots || !isSuspectWordHotspot(text))
    })

    wordHotspotLayer.textContent = ''
    wordHotspotLayer.hidden = words.length === 0
    wordHotspotLayer.dataset.file = file.name
    wordHotspotLayer.dataset.count = String(words.length)
    activeWordHotspots = []

    const hotspotPages = normalizeWordHotspotPages(hotspotFile.pages)
    for (const word of words) {
      const sourceWord = String(word.text || '')
      const rawBounds = getFiniteWordHotspotBounds(word.normalized)
      if (!rawBounds) continue

      const rawHotspotPage = getWordHotspotLogicalPage(page, hotspotPages, rawBounds)
      const contentBounds = getWordHotspotContentBoundsForPage(hotspotFile, manifest, rawHotspotPage)
      const adjustedBounds = getAdjustedWordHotspotBounds(rawBounds, contentBounds)
      if (!adjustedBounds) continue

      for (const segment of getWordHotspotTextSegments(sourceWord, adjustedBounds)) {
        const { lookupWord } = segment
        if (!lookupWord) continue

        const isLargeHotspot = isLargeWordHotspotBounds(segment.bounds)
        const paddedBounds = clampWordHotspotBoundsToUnitFrame({
          x: segment.bounds.x - wordHotspotPaddingXRatio,
          y: segment.bounds.y - wordHotspotPaddingYRatio,
          width: segment.bounds.width + wordHotspotPaddingXRatio * 2,
          height: segment.bounds.height + wordHotspotPaddingYRatio * 2,
        })
        if (!paddedBounds) continue
        const displayBounds = shouldShowWordHotspotBoxes ? segment.bounds : paddedBounds

        const hotspotPage = getWordHotspotLogicalPage(page, hotspotPages, segment.bounds)
        const hotspot: ActiveWordHotspot = {
          fileName: file.name,
          height: displayBounds.height,
          page: hotspotPage,
          reason,
          sourceHeight: segment.bounds.height,
          sourceWord: segment.sourceWord,
          sourceWidth: segment.bounds.width,
          sourceX: segment.bounds.x,
          sourceY: segment.bounds.y,
          width: displayBounds.width,
          word: lookupWord,
          x: displayBounds.x,
          y: displayBounds.y,
        }
        activeWordHotspots.push(hotspot)

        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'tribe-word-hotspot-button'
        button.classList.toggle('is-large-hotspot', isLargeHotspot)
        button.classList.toggle('is-suspect', isSuspectWordHotspot(segment.sourceWord))
        button.style.left = `${hotspot.x * 100}%`
        button.style.top = `${hotspot.y * 100}%`
        button.style.width = `${hotspot.width * 100}%`
        button.style.height = `${hotspot.height * 100}%`
        button.style.setProperty('--tribe-word-hotspot-stroke', `${wordHotspotStrokeWidthPx}px`)
        button.style.setProperty('--tribe-word-hotspot-word-scale', String(isLargeHotspot ? 1 : wordHotspotMagnifyScale))
        button.style.setProperty(
          '--tribe-word-hotspot-outline-scale-x',
          String(shouldShowWordHotspotBoxes || isLargeHotspot ? 1 : wordHotspotOutlineScaleX),
        )
        button.style.setProperty(
          '--tribe-word-hotspot-outline-scale-y',
          String(shouldShowWordHotspotBoxes || isLargeHotspot ? 1 : wordHotspotOutlineScaleY),
        )
        button.style.setProperty(
          '--tribe-word-hotspot-shadow-x',
          `${shouldShowWordHotspotBoxes ? 0 : wordHotspotShadowXPx}px`,
        )
        button.style.setProperty(
          '--tribe-word-hotspot-shadow-y',
          `${shouldShowWordHotspotBoxes ? 0 : wordHotspotShadowYPx}px`,
        )
        setWordHotspotSourceBounds(button, segment.bounds)
        button.setAttribute('aria-label', `Look up ${lookupWord}`)
        button.setAttribute('data-reader-navigation-ignore', 'true')
        button.dataset.lookupWord = lookupWord
        button.dataset.sourceWord = segment.sourceWord
        if (segment.sourcePhrase) button.dataset.sourcePhrase = segment.sourcePhrase
        if (segment.segmentCount > 1) {
          button.dataset.hyphenSegmentIndex = String(segment.segmentIndex)
          button.dataset.hyphenSegmentCount = String(segment.segmentCount)
        }
        button.dataset.hotspotPage = String(hotspotPage)
        button.dataset.hotspotSpreadPage = String(page)
        button.dataset.hotspotPages = hotspotPages.join(',')
        button.dataset.lookupAliases = getReadAlongButtonWordAliases(button).join(',')

        if (shouldUseWordHotspotMagnifier && !isLargeHotspot) {
          const magnifier = document.createElement('canvas')
          magnifier.className = 'tribe-word-hotspot-magnifier'
          button.append(magnifier)
          attachWordHotspotMagnifier(
            button,
            magnifier,
            () => activeCanvas || findWordHotspotSourceCanvas(readingRoot, frame),
            wordHotspotMagnifierPixelScale,
          )
        }

        button.addEventListener('pointerdown', (event) => {
          event.preventDefault()
          event.stopPropagation()
        })
        button.addEventListener('pointerup', (event) => {
          executeWordHotspotLookup(hotspot, 'button-pointerup', event)
        })
        button.addEventListener('click', (event) => {
          executeWordHotspotLookup(hotspot, 'button-click', event)
        })

        wordHotspotLayer.append(button)
      }
    }
    lastWordHotspotDebug = {
      enabled: shouldUseWordHotspots,
      message: 'Word hotspots rendered.',
      file: file.name,
      page,
      reason,
      manifestUrl,
      activeCount: activeWordHotspots.length,
      buttonCount: wordHotspotLayer.childElementCount,
      geometrySource: 'rive-ocr-sidecar',
      showBoxes: shouldShowWordHotspotBoxes,
    }
    syncWordHotspotDebugHelpers()

    context.analytics.log('1tribe_word_hotspots_rendered', {
      bookId: context.data.getBookId(),
      file: file.name,
      page,
      reason,
      count: wordHotspotLayer.childElementCount,
      manifestUrl,
    })
    setStatus(`Loaded ${wordHotspotLayer.childElementCount} word hotspots for ${file.name}.`)
  }

  const getPlaybackKey = (file: SimpleRiveFile) =>
    [
      file.url,
      file.artboard || requestedInteractiveArtboard || '',
      file.stateMachine || requestedInteractiveStateMachine || '',
      file.animation || requestedInteractiveAnimation || '',
      runtimeConfig.autoplay ? 'autoplay' : 'paused',
    ].join('|')

  const shouldStartStateMachineForReason = (reason: string) =>
    (/^initial\b/i.test(reason)
      ? shouldStartStateMachineOnInitialLoad
      : shouldStartStateMachineOnPageTurn && /\b(next|back|previous|forward|control|button|page)\b/i.test(reason))

  const isBackwardPageTurnReason = (reason: string) =>
    /\b(back|previous|prev|backward)\b/i.test(reason)

  const isForwardPageTurnReason = (reason: string) =>
    /\b(next|forward)\b/i.test(reason)

  const getViewModelPropertyPaths = (
    viewModelInstance: ViewModelInstance | null | undefined,
    maxDepth = 4,
  ): SimpleRiveViewModelPropertyPath[] => {
    const paths: SimpleRiveViewModelPropertyPath[] = []

    const visit = (instance: ViewModelInstance, prefix: string, depth: number) => {
      for (const property of instance.properties || []) {
        const name = typeof property.name === 'string' ? property.name : ''
        if (!name) continue

        const path = prefix ? `${prefix}/${name}` : name
        const type = typeof property.type === 'string' ? property.type : String(property.type || '')
        paths.push({ path, name, type, depth })

        if (depth >= maxDepth) continue

        try {
          const child = instance.viewModel(name)
          if (child) visit(child, path, depth + 1)
        } catch {
          // Non-view-model properties throw/null here; keep walking siblings.
        }
      }
    }

    if (viewModelInstance) visit(viewModelInstance, '', 0)
    return paths
  }

  const getViewModelPathLeafName = (propertyPath: string) => propertyPath.split('/').filter(Boolean).at(-1) || propertyPath

  const getStateMachineRuntimeSummary = (instance: Rive, entry: SimpleRiveStateMachineEntry) => {
    const inputs = instance
      .stateMachineInputs(entry.stateMachine)
      .map((input) => `${input.name}:${input.type}`)
      .join(', ')
    const dataBindings = getViewModelPropertyPaths(instance.viewModelInstance)
      .map((property) => property.path)
      .join(', ')

    return `Inputs: ${inputs || 'none'} | Data: ${dataBindings || 'none'}`
  }

  type SimpleRiveRuntimeInput = {
    name: string
    type: number | string
    value?: unknown
    fire?: () => void
  }

  const getResolvedStateMachineEntry = (
    instance: Rive,
    requestedEntry: SimpleRiveStateMachineEntry,
  ): SimpleRiveStateMachineEntry => {
    const requestedStateMachine = normalizeRiveNameForMatch(requestedEntry.stateMachine)
    const requestedArtboard = requestedEntry.artboard ? normalizeRiveNameForMatch(requestedEntry.artboard) : ''
    const artboards = instance.contents?.artboards || []

    for (const artboard of artboards) {
      if (requestedArtboard && normalizeRiveNameForMatch(artboard.name) !== requestedArtboard) continue

      for (const stateMachine of artboard.stateMachines || []) {
        if (normalizeRiveNameForMatch(stateMachine.name) === requestedStateMachine) {
          return {
            artboard: artboard.name,
            stateMachine: stateMachine.name,
          }
        }
      }
    }

    for (const artboard of artboards) {
      for (const stateMachine of artboard.stateMachines || []) {
        if (normalizeRiveNameForMatch(stateMachine.name) === requestedStateMachine) {
          return {
            artboard: artboard.name,
            stateMachine: stateMachine.name,
          }
        }
      }
    }

    return requestedEntry
  }

  const getStateMachineEntriesForAnimation = (instance: Rive, entry: SimpleRiveAnimationEntry): SimpleRiveStateMachineEntry[] => {
    const entries: SimpleRiveStateMachineEntry[] = []
    const artboards = instance.contents?.artboards || []
    const addEntry = (artboardName: string, stateMachineName: string) => {
      if (entries.some((candidate) => candidate.artboard === artboardName && candidate.stateMachine === stateMachineName)) return
      entries.push({
        artboard: artboardName,
        stateMachine: stateMachineName,
      })
    }

    for (const artboard of artboards) {
      if (artboard.name !== entry.artboard) continue
      for (const stateMachine of artboard.stateMachines || []) {
        addEntry(artboard.name, stateMachine.name)
      }
    }

    for (const artboard of artboards) {
      for (const stateMachine of artboard.stateMachines || []) {
        addEntry(artboard.name, stateMachine.name)
      }
    }

    return entries
  }

  const getStateMachineInputsSafe = (instance: Rive, stateMachineName: string): SimpleRiveRuntimeInput[] => {
    try {
      return instance.stateMachineInputs(stateMachineName) as SimpleRiveRuntimeInput[]
    } catch (error) {
      console.warn('[1Tribe simple overlay] Could not read state-machine inputs.', {
        stateMachine: stateMachineName,
        error: String(error),
      })
      return []
    }
  }

  const pulseStateMachineInput = (
    input: SimpleRiveRuntimeInput,
    stateMachineName: string,
    animationName: string,
    label: string,
  ): string | null => {
    const type = Number(input.type)
    const typeText = String(input.type || '').toLowerCase()
    const isTrigger = type === 2 || typeText.includes('trigger')
    const isBoolean = type === 1 || typeText.includes('bool') || typeof input.value === 'boolean'

    if (isTrigger && typeof input.fire === 'function') {
      input.fire()
      console.info('[1Tribe simple overlay] Fired trigger input for page-turn animation.', {
        animation: animationName,
        input: input.name,
        stateMachine: stateMachineName,
        type: input.type,
        label,
      })
      return 'trigger'
    }

    if (isBoolean) {
      input.value = true
      window.setTimeout(() => {
        input.value = false
        console.info('[1Tribe simple overlay] Reset boolean input after page-turn pulse.', {
          animation: animationName,
          input: input.name,
          stateMachine: stateMachineName,
          label,
        })
      }, 100)
      console.info('[1Tribe simple overlay] Pulsed boolean input for page-turn animation.', {
        animation: animationName,
        input: input.name,
        stateMachine: stateMachineName,
        type: input.type,
        label,
      })
      return 'boolean'
    }

    if (typeof input.fire === 'function') {
      input.fire()
      console.info('[1Tribe simple overlay] Fired input via fallback fire() for page-turn animation.', {
        animation: animationName,
        input: input.name,
        stateMachine: stateMachineName,
        type: input.type,
        label,
      })
      return 'fire-fallback'
    }

    return null
  }

  const pulseViewModelInputForAnimation = (
    instance: Rive,
    entry: SimpleRiveAnimationEntry,
    label: string,
    inputCandidates: string[],
  ): { fired: boolean; firedAs: string | null; input: string | null; stateMachine: string | null } | null => {
    const viewModelInstance = instance.viewModelInstance
    if (!viewModelInstance) {
      console.warn('[1Tribe simple overlay] No bound ViewModel instance for page-turn animation input fallback.', {
        animation: entry.animation,
        label,
      })
      return null
    }

    const inputKeys = inputCandidates.map(normalizeRiveNameForMatch)
    const properties = getViewModelPropertyPaths(viewModelInstance)
    const property = properties.find((candidate) => {
      const leaf = getViewModelPathLeafName(candidate.path)
      return inputKeys.includes(normalizeRiveNameForMatch(leaf)) || inputKeys.includes(normalizeRiveNameForMatch(candidate.path))
    })

    console.info('[1Tribe simple overlay] Checked ViewModel inputs for page-turn animation.', {
      animation: entry.animation,
      label,
      candidates: inputCandidates,
      properties: properties.map((candidate) => `${candidate.path}:${candidate.type}`),
      matchedPath: property?.path || null,
    })

    if (!property) return null

    try {
      const trigger = viewModelInstance.trigger(property.path)
      if (trigger) {
        trigger.trigger()
        console.info('[1Tribe simple overlay] Fired ViewModel trigger for page-turn animation.', {
          animation: entry.animation,
          label,
          path: property.path,
        })
        return {
          fired: true,
          firedAs: 'view-model-trigger',
          input: property.path,
          stateMachine: null,
        }
      }
    } catch {
      // Continue to boolean fallback.
    }

    try {
      const booleanValue = viewModelInstance.boolean(property.path)
      if (booleanValue) {
        booleanValue.value = true
        window.setTimeout(() => {
          booleanValue.value = false
          console.info('[1Tribe simple overlay] Reset ViewModel boolean after page-turn pulse.', {
            animation: entry.animation,
            label,
            path: property.path,
          })
        }, 100)
        console.info('[1Tribe simple overlay] Pulsed ViewModel boolean for page-turn animation.', {
          animation: entry.animation,
          label,
          path: property.path,
        })
        return {
          fired: true,
          firedAs: 'view-model-boolean',
          input: property.path,
          stateMachine: null,
        }
      }
    } catch {
      // Not a boolean path.
    }

    return null
  }

  const fireStateMachineInputForAnimation = (
    instance: Rive,
    entry: SimpleRiveAnimationEntry,
    label: string,
  ): { fired: boolean; firedAs: string | null; input: string | null; stateMachine: string | null } => {
    const inputCandidates = getRiveAnimationInputNameCandidates(entry.animation)
    const inputKeys = inputCandidates.map(normalizeRiveNameForMatch)
    const stateMachines = getStateMachineEntriesForAnimation(instance, entry)

    for (const stateMachine of stateMachines) {
      try {
        instance.play(stateMachine.stateMachine)
      } catch (error) {
        console.warn('[1Tribe simple overlay] Could not start state machine before firing input.', {
          animation: entry.animation,
          label,
          stateMachine: stateMachine.stateMachine,
          error: String(error),
        })
      }
      const inputs = getStateMachineInputsSafe(instance, stateMachine.stateMachine)
      const input = inputs.find((candidate) => inputKeys.includes(normalizeRiveNameForMatch(candidate.name)))
      console.info('[1Tribe simple overlay] Checked state-machine inputs for page-turn animation.', {
        animation: entry.animation,
        label,
        stateMachine: stateMachine.stateMachine,
        candidates: inputCandidates,
        inputs: inputs.map((candidate) => `${candidate.name}:${candidate.type}`),
        matchedInput: input?.name || null,
      })

      if (!input) continue

      const firedAs = pulseStateMachineInput(input, stateMachine.stateMachine, entry.animation, label)
      if (firedAs) {
        return {
          fired: true,
          firedAs,
          input: input.name,
          stateMachine: stateMachine.stateMachine,
        }
      }
    }

    const viewModelPulse = pulseViewModelInputForAnimation(instance, entry, label, inputCandidates)
    if (viewModelPulse?.fired) return viewModelPulse

    console.warn('[1Tribe simple overlay] No state-machine input matched page-turn animation request.', {
      animation: entry.animation,
      label,
      candidates: inputCandidates,
      stateMachines: stateMachines.map((stateMachine) => stateMachine.stateMachine),
      availableAnimations: listSimpleRiveAnimations(instance.contents || {}),
      availableStateMachines: listSimpleRiveStateMachines(instance.contents || {}),
    })
    return {
      fired: false,
      firedAs: null,
      input: null,
      stateMachine: null,
    }
  }

  const startAnimation = (instance: Rive, entry: SimpleRiveAnimationEntry, label: string) => {
    if (shouldDisableTimelineAnimations) {
      setStatus(`Loaded ${entry.artboard}; animation calls are disabled for this test.`)
      context.analytics.log('1tribe_simple_rive_animation_blocked', {
        animation: entry.animation,
        artboard: entry.artboard,
        label,
        reason: shouldDisableRiveAnimations ? 'riveDisableAnimations' : 'riveStateMachineIdleOnly',
        activeFile: getActiveSimpleRiveFile()?.name || null,
        bookId: context.data.getBookId(),
        page: context.data.getCurrentPage(),
      })
      return
    }

    hideManualStart()
    const fired = fireStateMachineInputForAnimation(instance, entry, label)
    instance.resizeDrawingSurfaceToCanvas(getEffectivePixelRatio(frame))
    setStatus(
      fired.fired
        ? `Fired ${entry.artboard} / ${entry.animation}${label ? ` (${label})` : ''} via ${fired.input}.`
        : `Did not find a state-machine input for ${entry.artboard} / ${entry.animation}${label ? ` (${label})` : ''}.`,
    )
    context.analytics.log('1tribe_simple_rive_animation_started', {
      animation: entry.animation,
      artboard: entry.artboard,
      label,
      firedInput: fired.input,
      firedInputType: fired.firedAs,
      firedStateMachine: fired.stateMachine,
      success: fired.fired,
      activeFile: getActiveSimpleRiveFile()?.name || null,
      bookId: context.data.getBookId(),
      page: context.data.getCurrentPage(),
    })
  }

  const getExactAnimationEntry = (
    instance: Rive,
    animationName: string,
    requestedArtboard: string | null,
  ): SimpleRiveAnimationEntry | null => {
    const artboards = instance.contents?.artboards || []

    const findOnArtboard = (artboardName: string | null): SimpleRiveAnimationEntry | null => {
      for (const artboard of artboards) {
        if (artboardName && artboard.name !== artboardName) continue

        for (const animation of artboard.animations || []) {
          if (isExactRiveAnimationNameMatch(animation, animationName)) {
            return {
              artboard: artboard.name,
              animation,
            }
          }
        }
      }

      return null
    }

    if (requestedArtboard) {
      const requestedMatch = findOnArtboard(requestedArtboard)
      if (requestedMatch) return requestedMatch
    }

    for (const artboard of artboards) {
      for (const animation of artboard.animations || []) {
        if (isExactRiveAnimationNameMatch(animation, animationName)) {
          return {
            artboard: artboard.name,
            animation,
          }
        }
      }
    }

    const findAliasOnArtboard = (artboardName: string | null): SimpleRiveAnimationEntry | null => {
      for (const artboard of artboards) {
        if (artboardName && artboard.name !== artboardName) continue

        for (const animation of artboard.animations || []) {
          if (isRiveAnimationNameMatch(animation, animationName)) {
            return {
              artboard: artboard.name,
              animation,
            }
          }
        }
      }

      return null
    }

    if (requestedArtboard) {
      const requestedAliasMatch = findAliasOnArtboard(requestedArtboard)
      if (requestedAliasMatch) return requestedAliasMatch
    }

    for (const artboard of artboards) {
      for (const animation of artboard.animations || []) {
        if (isRiveAnimationNameMatch(animation, animationName)) {
          return {
            artboard: artboard.name,
            animation,
          }
        }
      }
    }

    return null
  }

  const startCurrentPageIdle = (
    instance: Rive,
    file: SimpleRiveFile,
    page: number,
    reason: string,
    requestedArtboard: string | null,
    note: string,
  ): boolean => {
    const idleEntry = getExactAnimationEntry(instance, pageTurnIdleAnimation, requestedArtboard)
    if (!idleEntry) {
      console.info(`[1Tribe simple overlay] Current page idle animation "${pageTurnIdleAnimation}" was not found.`, {
        file: file.name,
        requestedArtboard,
        availableAnimations: listSimpleRiveAnimations(instance.contents || {}),
      })
      logPageMappingDebug(context, {
        readerPage: page,
        reason,
        matchedFile: file,
        playbackTriggered: false,
        animation: pageTurnIdleAnimation,
        artboard: requestedArtboard,
        note: `${note} Idle animation was requested but not found.`,
      })
      return false
    }

    startAnimation(instance, idleEntry, 'current page idle')
    logPageMappingDebug(context, {
      readerPage: page,
      reason,
      matchedFile: file,
      playbackTriggered: true,
      animation: idleEntry.animation,
      artboard: idleEntry.artboard,
      note,
    })
    return true
  }

  const clearPostPageInRenderPump = () => {
    if (postPageInRenderTimer !== null) window.clearTimeout(postPageInRenderTimer)
    postPageInRenderTimer = null
    if (postPageInRenderFrame !== null) window.cancelAnimationFrame(postPageInRenderFrame)
    postPageInRenderFrame = null
    postPageInRenderCleanup?.()
    postPageInRenderCleanup = null
  }

  const getActiveSimpleRiveFile = () => (activeFileUrl ? files.find((file) => file.url === activeFileUrl) || null : null)
  syncWordHotspotDebugHelpers()

  const emitHarnessAvailableAnimations = (
    instance: Rive | null,
    file: SimpleRiveFile | null,
    page: number | null,
    reason: string,
  ) => {
    window.dispatchEvent(
      new CustomEvent(harnessAvailableAnimationsEventName, {
        detail: {
          animations: instance ? getSimpleRiveAnimationNames(instance.contents || {}) : [],
          file: file?.name || null,
          page,
          reason,
        },
      }),
    )
  }

  const releaseSimpleRivePageTurnBusy = (reason: string, options: { forcePendingOffload?: boolean } = {}) => {
    if (simpleRivePageTurnBusyTimer !== null) window.clearTimeout(simpleRivePageTurnBusyTimer)
    simpleRivePageTurnBusyTimer = null
    if (rapidPageChangeCatchUpTimer !== null) window.clearTimeout(rapidPageChangeCatchUpTimer)
    rapidPageChangeCatchUpTimer = null

    if (pendingPageOutOffload && !pendingPageOutOffload.offload) {
      console.info('[1Tribe simple overlay] Clearing Page_out watcher without registered offload.', {
        animation: pendingPageOutOffload.animation,
        artboard: pendingPageOutOffload.artboard,
        activeFile: pendingPageOutOffload.activeFile,
        reason,
      })
      clearPendingPageOutOffload()
    }

    if (pendingPageOutOffload && options.forcePendingOffload) {
      console.warn('[1Tribe simple overlay] Forcing pending Page_out offload so a queued reader page can catch up.', {
        animation: pendingPageOutOffload.animation,
        artboard: pendingPageOutOffload.artboard,
        activeFile: pendingPageOutOffload.activeFile,
        reason,
      })
      runPendingPageOutOffload('rapid page-change catch-up')
      return
    }

    if (pendingPageOutOffload) {
      pendingPageOutOffloadReleaseAttempts += 1
      if (pendingPageOutOffloadReleaseAttempts > maxPageOutOffloadReleaseAttempts) {
        console.warn('[1Tribe simple overlay] Page_out offload did not run in time; forcing release of page-turn busy state.', {
          animation: pendingPageOutOffload.animation,
          artboard: pendingPageOutOffload.artboard,
          activeFile: pendingPageOutOffload.activeFile,
          reason,
          attempts: pendingPageOutOffloadReleaseAttempts,
        })
        runPendingPageOutOffload('Page_out release timeout')
        return
      }

      simpleRivePageTurnBusyTimer = window.setTimeout(() => {
        releaseSimpleRivePageTurnBusy('waiting for Page_out offload')
      }, 160)
      return
    }

    pendingPageOutOffloadReleaseAttempts = 0
    isSimpleRivePageTurnBusy = false

    const queued = queuedRapidPageChange
    queuedRapidPageChange = null
    if (!queued || isDisposed) return

    const livePage = context.data.getCurrentPage()
    const targetPage = livePage !== displayedPage ? livePage : queued.page
    context.analytics.log('1tribe_simple_rive_page_change_replayed', {
      bookId: context.data.getBookId(),
      page: targetPage,
      queuedPage: queued.page,
      direction: queued.direction > 0 ? 'forward' : 'backward',
      reason: queued.reason,
      releaseReason: reason,
    })
    setStatus(`Catching up to reader page ${targetPage} after rapid page turns.`)
    displayedPage = targetPage
    scheduleFileForPage(targetPage, `${queued.reason} rapid catch-up`, pageSwapDelayMs)
  }

  const markSimpleRivePageTurnBusy = (label: string) => {
    isSimpleRivePageTurnBusy = true
    if (simpleRivePageTurnBusyTimer !== null) window.clearTimeout(simpleRivePageTurnBusyTimer)
    simpleRivePageTurnBusyTimer = window.setTimeout(() => {
      releaseSimpleRivePageTurnBusy(`${label} settle timer`)
    }, transitionDurationMs + pageTurnStartDelayMs + 320)
  }

  const queueRapidSimpleRivePageChange = (page: number, direction: number, reason: string) => {
    queuedRapidPageChange = { page, direction, reason }
    if (rapidPageChangeCatchUpTimer !== null) window.clearTimeout(rapidPageChangeCatchUpTimer)
    rapidPageChangeCatchUpTimer = window.setTimeout(() => {
      rapidPageChangeCatchUpTimer = null
      if (!queuedRapidPageChange || isDisposed) return

      console.warn('[1Tribe simple overlay] Forcing rapid page-change catch-up after busy page-turn timeout.', {
        page: queuedRapidPageChange.page,
        direction: queuedRapidPageChange.direction,
        reason: queuedRapidPageChange.reason,
        displayedPage,
        livePage: context.data.getCurrentPage(),
        pendingPageOutOffload: pendingPageOutOffload
          ? {
              animation: pendingPageOutOffload.animation,
              artboard: pendingPageOutOffload.artboard,
              activeFile: pendingPageOutOffload.activeFile,
            }
          : null,
      })
      releaseSimpleRivePageTurnBusy('rapid page-change catch-up timeout', { forcePendingOffload: true })
    }, transitionDurationMs + pageTurnStartDelayMs + 900)
    context.analytics.log('1tribe_simple_rive_page_change_queued', {
      bookId: context.data.getBookId(),
      page,
      displayedPage,
      direction: direction > 0 ? 'forward' : 'backward',
      reason,
      activeFile: getActiveSimpleRiveFile()?.name || null,
    })
    setStatus(`Queued reader page ${page} until the current Rive page turn settles.`)
  }

  const playPageTurnAnimation = (
    instance: Rive,
    animationName: string,
    label: string,
    requestedArtboard: string | null,
  ): SimpleRiveAnimationEntry | null => {
    if (shouldDisableTimelineAnimations) {
      context.analytics.log('1tribe_simple_rive_animation_blocked', {
        animation: animationName,
        artboard: requestedArtboard,
        label,
        reason: shouldDisableRiveAnimations ? 'riveDisableAnimations' : 'riveStateMachineIdleOnly',
        activeFile: getActiveSimpleRiveFile()?.name || null,
        bookId: context.data.getBookId(),
        page: context.data.getCurrentPage(),
      })
      return null
    }

    const entry = getExactAnimationEntry(instance, animationName, requestedArtboard)
    if (!entry) {
      console.info(`[1Tribe simple overlay] Page-turn animation "${animationName}" was not found.`, {
        requestedArtboard,
        availableAnimations: listSimpleRiveAnimations(instance.contents || {}),
      })
      return null
    }

    startAnimation(instance, entry, label)
    markSimpleRivePageTurnBusy(label)
    context.analytics.log('1tribe_simple_rive_page_turn_animation', {
      animation: entry.animation,
      requestedAnimation: animationName,
      artboard: entry.artboard,
      label,
      activeFile: getActiveSimpleRiveFile()?.name || null,
      bookId: context.data.getBookId(),
      page: context.data.getCurrentPage(),
    })
    return entry
  }

  const getStoppedAnimationNames = (event: RiveRuntimeEvent): string[] =>
    Array.isArray(event.data)
      ? event.data.filter((item): item is string => typeof item === 'string')
      : typeof event.data === 'string'
        ? [event.data]
        : []

  const clearPendingPageOutOffload = () => {
    pendingPageOutOffload?.cleanup()
    pendingPageOutOffload = null
    pendingPageOutOffloadReleaseAttempts = 0
  }

  const runPendingPageOutOffload = (reason: string) => {
    const pending = pendingPageOutOffload
    if (!pending) return

    if (!pending?.offload) {
      pendingPageOutOffload = null
      pendingPageOutOffloadReleaseAttempts = 0
      return
    }

    const offload = pending.offload
    const afterOffload = pending.afterOffload
    pending.offload = null
    pending.afterOffload = null
    pending.cleanup()
    pendingPageOutOffload = null
    pendingPageOutOffloadReleaseAttempts = 0
    try {
      offload()
      context.analytics.log('1tribe_simple_rive_artboard_offloaded', {
        animation: pending.animation,
        artboard: pending.artboard,
        activeFile: pending.activeFile,
        reason,
        bookId: context.data.getBookId(),
        page: context.data.getCurrentPage(),
      })
      afterOffload?.()
    } catch (error) {
      console.info('[1Tribe simple overlay] Failed while offloading outgoing Page_out canvas.', {
        animation: pending.animation,
        artboard: pending.artboard,
        activeFile: pending.activeFile,
        reason,
        error: String(error),
      })
      setStatus(`Could not offload ${pending.artboard}; continuing on fallback state.`)
    } finally {
      releaseSimpleRivePageTurnBusy(reason)
    }
  }

  const watchPageOutForOffload = (instance: Rive, entry: SimpleRiveAnimationEntry) => {
    clearPendingPageOutOffload()

    const pending = {
      instance,
      animation: entry.animation,
      artboard: entry.artboard,
      activeFile: getActiveSimpleRiveFile()?.name || null,
      didStop: false,
      offload: null as (() => void) | null,
      afterOffload: null as (() => void) | null,
      cleanup: () => {},
    }

    const onStop = (event: RiveRuntimeEvent) => {
      if (pendingPageOutOffload !== pending) return
      if (!getStoppedAnimationNames(event).includes(entry.animation)) return

      pending.didStop = true
      pending.cleanup()
      pending.cleanup = () => {}
      context.analytics.log('1tribe_simple_rive_animation_completed', {
        animation: entry.animation,
        artboard: entry.artboard,
        activeFile: pending.activeFile,
        label: 'page out',
        bookId: context.data.getBookId(),
        page: context.data.getCurrentPage(),
      })
      runPendingPageOutOffload('Page_out stop')
    }

    pending.cleanup = () => instance.off(EventType.Stop, onStop)
    pendingPageOutOffload = pending
    instance.on(EventType.Stop, onStop)
  }

  const registerPageOutUnderlayOffload = (
    outgoingRive: Rive | null,
    outgoingCanvas: HTMLCanvasElement,
    underlayCanvas: HTMLCanvasElement,
    afterOffload?: () => void,
    retainAsBackUnderlay?: {
      file: SimpleRiveFile
      index: number
      page: number
      readerPageLabel: string
      playbackKey: string
      requestedArtboard: string | null
      animation: string | null
      animationEntry: SimpleRiveAnimationEntry | null
      stateMachine: string | null
      stateMachineEntry: SimpleRiveStateMachineEntry | null
      reason: string
    },
  ): boolean => {
    const pending = pendingPageOutOffload
    if (!outgoingRive || !pending || pending.instance !== outgoingRive) return false

    pending.afterOffload = afterOffload || null
    pending.offload = () => {
      if (retainAsBackUnderlay) {
        clearPreloadedUnderlay()
        startPreloadedUnderlayIdle(
          outgoingRive,
          retainAsBackUnderlay.file,
          retainAsBackUnderlay.page,
          `${retainAsBackUnderlay.reason} retain back underlay`,
          retainAsBackUnderlay.requestedArtboard,
          -1,
        )
        outgoingCanvas.classList.remove('tribe-simple-active-canvas', 'tribe-simple-loading-canvas')
        outgoingCanvas.style.opacity = '1'
        outgoingCanvas.style.pointerEvents = 'none'
        outgoingCanvas.style.zIndex = '1'
        const retainedUnderlay: SimpleRiveUnderlay = {
          file: retainAsBackUnderlay.file,
          index: retainAsBackUnderlay.index,
          page: retainAsBackUnderlay.page,
          direction: -1,
          readerPageLabel: retainAsBackUnderlay.readerPageLabel,
          playbackKey: retainAsBackUnderlay.playbackKey,
          rive: outgoingRive,
          canvas: outgoingCanvas,
          requestedArtboard: retainAsBackUnderlay.requestedArtboard,
          animation: retainAsBackUnderlay.animation,
          animationEntry: retainAsBackUnderlay.animationEntry,
          stateMachine: retainAsBackUnderlay.stateMachine,
          stateMachineEntry: retainAsBackUnderlay.stateMachineEntry,
        }
        storeRetainedBackUnderlay(retainedUnderlay)
        startBackwardRevealUnderlay(
          retainedUnderlay,
          retainAsBackUnderlay.page,
          `${retainAsBackUnderlay.reason} prepare back underlay`,
          null,
          true,
        )
      } else {
        outgoingRive.cleanup()
        if (outgoingCanvas !== activeCanvas) {
          cleanupCanvas(outgoingCanvas)
        }
      }
      if (activeCanvas === underlayCanvas) {
        underlayCanvas.style.zIndex = '2'
      }
      setStatus(
        retainAsBackUnderlay
          ? `Held ${retainAsBackUnderlay.file.name} underneath for Back after ${pending.animation} completed.`
          : `Offloaded ${pending.artboard} after ${pending.animation} completed.`,
      )
    }

    if (pending.didStop) {
      runPendingPageOutOffload('Page_out already stopped')
    } else {
      window.setTimeout(() => {
        if (pendingPageOutOffload === pending && pending.offload) {
          console.info('[1Tribe simple overlay] Page_out stop was not observed; offloading by fallback timer.', {
            animation: pending.animation,
            artboard: pending.artboard,
          })
          runPendingPageOutOffload('Page_out fallback timeout')
        }
      }, transitionDurationMs + 350)
    }

    return true
  }

  const clearBackPageIdle = () => {
    if (backPageIdleTimer !== null) window.clearTimeout(backPageIdleTimer)
    backPageIdleTimer = null
    backPageIdleCleanup?.()
    backPageIdleCleanup = null
  }

  const scheduleBackPageIdle = (
    instance: Rive,
    completedAnimation: SimpleRiveAnimationEntry,
    requestedArtboard: string | null,
  ) => {
    clearBackPageIdle()

    const idleEntry = getExactAnimationEntry(instance, pageTurnIdleAnimation, requestedArtboard || completedAnimation.artboard)
    if (!idleEntry) {
      console.info(`[1Tribe simple overlay] Page idle animation "${pageTurnIdleAnimation}" was not found.`, {
        requestedArtboard: requestedArtboard || completedAnimation.artboard,
        afterAnimation: completedAnimation.animation,
        availableAnimations: listSimpleRiveAnimations(instance.contents || {}),
      })
      return
    }

    let didStartIdle = false
    const startIdle = (label: string) => {
      if (didStartIdle) return
      didStartIdle = true
      clearBackPageIdle()

      if (isDisposed) return

      console.info(`[1Tribe simple overlay] Running "${idleEntry.animation}" after "${completedAnimation.animation}".`, {
        artboard: idleEntry.artboard,
        reason: label,
      })
      startAnimation(instance, idleEntry, 'page idle after back')
    }

    const onStop = (event: RiveRuntimeEvent) => {
      const stopped = Array.isArray(event.data)
        ? event.data
        : typeof event.data === 'string'
          ? [event.data]
          : []
      if (!stopped.includes(completedAnimation.animation)) return

      startIdle('page go back stop')
    }

    backPageIdleCleanup = () => instance.off(EventType.Stop, onStop)
    instance.on(EventType.Stop, onStop)
    backPageIdleTimer = window.setTimeout(() => startIdle('page go back fallback'), transitionDurationMs)
  }

  const schedulePostPageInRenderPump = (
    instance: Rive,
    pageInEntry: SimpleRiveAnimationEntry,
    file: SimpleRiveFile,
    page: number,
    reason: string,
  ) => {
    clearPostPageInRenderPump()

    const idleEntry = getExactAnimationEntry(instance, pageTurnIdleAnimation, pageInEntry.artboard)
    let didHandlePageInComplete = false
    let didObservePageInStop = false
    const waitForPageInStop = (label: string) => {
      if (postPageInRenderTimer !== null) window.clearTimeout(postPageInRenderTimer)
      postPageInRenderTimer = window.setTimeout(() => {
        postPageInRenderTimer = null
        startIdleOrRenderPump(label)
      }, pageInFallbackPollMs)
    }

    const startIdleOrRenderPump = (label: string) => {
      if (didHandlePageInComplete) return
      if (isDisposed || rive !== instance) return

      if (!didObservePageInStop && instance.isPlaying) {
        waitForPageInStop(label)
        return
      }

      didHandlePageInComplete = true

      if (idleEntry) {
        clearPostPageInRenderPump()
        console.info(`[1Tribe simple overlay] Running "${idleEntry.animation}" after "${pageInEntry.animation}".`, {
          artboard: idleEntry.artboard,
          reason: label,
          requestedIdleAfterPageIn: shouldRunIdleAfterPageIn,
        })
        startAnimation(instance, idleEntry, 'current page idle')
        logPageMappingDebug(context, {
          readerPage: page,
          reason,
          matchedFile: file,
          playbackTriggered: true,
          animation: idleEntry.animation,
          artboard: idleEntry.artboard,
          note: `Current page settled from Page_in (${label}); started configured idle animation.`,
        })
        return
      }

      if (instance.isPlaying) {
        if (postPageInRenderTimer !== null) window.clearTimeout(postPageInRenderTimer)
        postPageInRenderTimer = window.setTimeout(() => {
          didHandlePageInComplete = false
          startIdleOrRenderPump(label)
        }, 120)
        return
      }

      clearPostPageInRenderPump()

      let lastPumpTime: number | null = null
      const pumpFrame = () => {
        if (isDisposed || rive !== instance) {
          postPageInRenderFrame = null
          return
        }

        const currentTimelineTime =
          typeof document.timeline?.currentTime === 'number' ? document.timeline.currentTime : performance.now()
        // Rive resets lastRenderTime when no root animation is active; keep elapsed time moving for nested artboards.
        ;(instance as Rive & { lastRenderTime?: number }).lastRenderTime = lastPumpTime ?? currentTimelineTime
        lastPumpTime = currentTimelineTime
        instance.drawFrame()
        postPageInRenderFrame = window.requestAnimationFrame(pumpFrame)
      }

      postPageInRenderFrame = window.requestAnimationFrame(pumpFrame)
      setStatus(`Completed ${pageInEntry.artboard} / ${pageInEntry.animation}; rendering nested page idle.`)
      logPageMappingDebug(context, {
        readerPage: page,
        reason,
        matchedFile: file,
        playbackTriggered: true,
        animation: pageInEntry.animation,
        artboard: pageInEntry.artboard,
        note: `Page-in animation completed (${label}); configured idle animation was not found, so nested-page render pump started.`,
      })
    }

    const onStop = (event: RiveRuntimeEvent) => {
      const stopped = Array.isArray(event.data)
        ? event.data
        : typeof event.data === 'string'
          ? [event.data]
          : []
      if (!stopped.includes(pageInEntry.animation)) return

      didObservePageInStop = true
      startIdleOrRenderPump('page in stop')
    }

    postPageInRenderCleanup = () => instance.off(EventType.Stop, onStop)
    instance.on(EventType.Stop, onStop)
    postPageInRenderTimer = window.setTimeout(() => startIdleOrRenderPump('page in fallback'), transitionDurationMs)
  }

  const playActivePageTurnAnimation = (animationName: string, label: string, shouldRunIdleAfterStop = false): boolean => {
    const activeFile = getActiveSimpleRiveFile()
    if (!rive || !activeFile) return false
    const requestedPageTurnArtboard = activeFile.artboard && activeFile.artboard !== 'auto' ? activeFile.artboard : null
    const activeRive = rive

    const entry = playPageTurnAnimation(
      activeRive,
      animationName,
      label,
      requestedPageTurnArtboard,
    )
    if (!entry) return false

    if (isRiveAnimationNameMatch(entry.animation, pageTurnForwardOutAnimation) && /\bpage out\b/i.test(label)) {
      watchPageOutForOffload(activeRive, entry)
    }

    if (shouldRunIdleAfterStop) {
      scheduleBackPageIdle(activeRive, entry, requestedPageTurnArtboard)
    }

    return true
  }

  const onHarnessAnimationRequest = (event: Event) => {
    if (!(event instanceof CustomEvent)) return

    const detail = event.detail as Record<string, unknown> | null
    const requestedAnimation = typeof detail?.animation === 'string' ? detail.animation.trim() : ''
    const source = typeof detail?.source === 'string' ? detail.source : 'harness'
    if (!requestedAnimation) return

    const activeFile = getActiveSimpleRiveFile()
    if (!rive || !activeFile) {
      setStatus(`Cannot run ${requestedAnimation}: no active Rive file is loaded yet.`)
      context.analytics.log('1tribe_simple_rive_manual_animation', {
        animation: requestedAnimation,
        source,
        success: false,
        reason: 'no-active-rive',
        bookId: context.data.getBookId(),
        page: context.data.getCurrentPage(),
      })
      return
    }

    const requestedArtboard = activeFile.artboard && activeFile.artboard !== 'auto' ? activeFile.artboard : null
    const entry = getExactAnimationEntry(rive, requestedAnimation, requestedArtboard)
    if (!entry) {
      console.info(`[1Tribe simple overlay] Harness animation "${requestedAnimation}" was not found.`, {
        requestedArtboard,
        activeFile: activeFile.name,
        availableAnimations: listSimpleRiveAnimations(rive.contents || {}),
      })
      setStatus(`Animation ${requestedAnimation} was not found on ${activeFile.name}.`)
      context.analytics.log('1tribe_simple_rive_manual_animation', {
        animation: requestedAnimation,
        source,
        success: false,
        reason: 'animation-not-found',
        activeFile: activeFile.name,
        bookId: context.data.getBookId(),
        page: context.data.getCurrentPage(),
      })
      return
    }

    startAnimation(rive, entry, `harness ${source}`)
    context.analytics.log('1tribe_simple_rive_manual_animation', {
      animation: entry.animation,
      requestedAnimation,
      artboard: entry.artboard,
      source,
      success: true,
      activeFile: activeFile.name,
      bookId: context.data.getBookId(),
      page: context.data.getCurrentPage(),
    })
  }

  const takeIncomingPageTurnAnimation = (reason: string) => {
    if (!pendingIncomingPageTurnAnimation || /^initial\b/i.test(reason)) return null

    const pending = pendingIncomingPageTurnAnimation
    if (!isForwardPageTurnReason(reason) || isBackwardPageTurnReason(reason)) {
      pendingIncomingPageTurnAnimation = null
      console.info('[1Tribe simple overlay] Ignored queued incoming page-turn: direction did not match a forward page-turn request.', {
        reason,
        queuedDirection: pending.direction,
      })
      return null
    }

    if (pending.direction <= 0) {
      pendingIncomingPageTurnAnimation = null
      console.info('[1Tribe simple overlay] Ignored queued incoming page-turn: expected forward direction but got stale backward queued direction.', {
        reason,
        queuedDirection: pending.direction,
      })
      return null
    }

    pendingIncomingPageTurnAnimation = null
    return pending
  }

  const startStateMachine = (instance: Rive, entry: SimpleRiveStateMachineEntry, label: string) => {
    if (shouldDisableRiveAnimations) {
      setStatus(`Loaded ${entry.artboard}; state-machine playback is disabled for this test.`)
      context.analytics.log('1tribe_simple_rive_animation_blocked', {
        stateMachine: entry.stateMachine,
        artboard: entry.artboard,
        label,
        reason: 'riveDisableAnimations',
        activeFile: getActiveSimpleRiveFile()?.name || null,
        bookId: context.data.getBookId(),
        page: context.data.getCurrentPage(),
      })
      return
    }

    hideManualStart()
    enableRivePointerCapture()
    const resolvedEntry = getResolvedStateMachineEntry(instance, entry)
    instance.resizeDrawingSurfaceToCanvas(getEffectivePixelRatio(frame))
    instance.play(resolvedEntry.stateMachine)
    const runtimeSummary = getStateMachineRuntimeSummary(instance, resolvedEntry)
    console.info('[1Tribe simple overlay] Started state machine without reset.', {
      requestedStateMachine: entry.stateMachine,
      resolvedStateMachine: resolvedEntry.stateMachine,
      requestedArtboard: entry.artboard,
      resolvedArtboard: resolvedEntry.artboard,
      label,
      runtimeSummary,
    })
    setStatus(`Running ${resolvedEntry.artboard} / ${resolvedEntry.stateMachine}${label ? ` (${label})` : ''}. ${runtimeSummary}`)
    renderStateMachineControls(instance, resolvedEntry)
    return resolvedEntry
  }

  const scheduleStateMachineStart = (instance: Rive, entry: SimpleRiveStateMachineEntry, label: string) => {
    if (pageTurnStartTimer !== null) window.clearTimeout(pageTurnStartTimer)
    pageTurnStartTimer = window.setTimeout(() => {
      pageTurnStartTimer = null
      if (isDisposed || rive !== instance) return

      startStateMachine(instance, entry, label)
    }, pageTurnStartDelayMs)
  }

  const scheduleAnimationStart = (instance: Rive, entry: SimpleRiveAnimationEntry, label: string) => {
    if (pageTurnStartTimer !== null) window.clearTimeout(pageTurnStartTimer)
    pageTurnStartTimer = window.setTimeout(() => {
      pageTurnStartTimer = null
      if (isDisposed || rive !== instance) return

      startAnimation(instance, entry, label)
    }, pageTurnStartDelayMs)
  }

  const clearStateMachineControls = () => {
    stateMachineControls.textContent = ''
    stateMachineControls.hidden = true
  }

  const createStateMachineControlButton = (
    label: string,
    onClick: (button: HTMLButtonElement) => void,
    className = '',
    isDisabled = false,
  ) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.disabled = isDisabled
    if (className) button.className = className
    button.addEventListener('click', () => onClick(button))
    return button
  }

  const getViewModelPropertyAccessor = (
    instance: Rive,
    propertyPath: string,
  ): {
    kind: string
    label: string
    run: (button: HTMLButtonElement) => void
  } | null => {
    const viewModelInstance = instance.viewModelInstance
    if (!viewModelInstance) return null
    const propertyName = getViewModelPathLeafName(propertyPath)

    try {
      const trigger = viewModelInstance.trigger(propertyPath)
      if (trigger) {
        const navigationCommand = getCommand({ name: propertyName, source: 'rive-event' })
        const isNavigationTrigger = navigationCommand ? isPageNavigationCommand(navigationCommand) : false
        return {
          kind: 'trigger',
          label: isNavigationTrigger ? `Epic ${propertyPath}` : `Fire ${propertyPath}`,
          run: () => {
            markRivePointerInteraction()
            trigger.trigger()
            if (isNavigationTrigger) {
              runSimpleRiveAction({
                name: propertyName,
                properties: { via: 'state-machine-control' },
                source: 'rive-event',
              })
              return
            }
            setStatus(`Triggered data binding ${propertyPath}.`)
          },
        }
      }
    } catch {
      // Try the next property type; the runtime returns null or throws for mismatches.
    }

    try {
      const booleanValue = viewModelInstance.boolean(propertyPath)
      if (booleanValue) {
        const navigationCommand = getCommand({ name: propertyName, source: 'rive-event' })
        const isNavigationBoolean = navigationCommand ? isPageNavigationCommand(navigationCommand) : false
        return {
          kind: 'boolean',
          label: `${isNavigationBoolean ? 'Epic ' : ''}${propertyPath}: ${booleanValue.value ? 'true' : 'false'}`,
          run: (button) => {
            markRivePointerInteraction()
            const nextValue = !booleanValue.value
            booleanValue.value = nextValue
            button.textContent = `${isNavigationBoolean ? 'Epic ' : ''}${propertyPath}: ${booleanValue.value ? 'true' : 'false'}`
            if (isNavigationBoolean && nextValue) {
              runSimpleRiveAction({
                name: propertyName,
                properties: { via: 'state-machine-control' },
                source: 'rive-event',
              })
              return
            }
            setStatus(`Set data binding ${propertyPath}=${booleanValue.value}.`)
          },
        }
      }
    } catch {
      // Try the next property type.
    }

    try {
      const numberValue = viewModelInstance.number(propertyPath)
      if (numberValue) {
        return {
          kind: 'number',
          label: `${propertyPath}: ${numberValue.value}`,
          run: (button) => {
            numberValue.value = (Number(numberValue.value) || 0) + 1
            button.textContent = `${propertyPath}: ${numberValue.value}`
            setStatus(`Set data binding ${propertyPath}=${numberValue.value}.`)
          },
        }
      }
    } catch {
      // Try the next property type.
    }

    return null
  }

  const renderStateMachineControls = (instance: Rive, entry: SimpleRiveStateMachineEntry | null) => {
    clearStateMachineControls()
    if (!shouldShowStateMachineControls || !entry) return

    const title = document.createElement('strong')
    title.textContent = 'State-machine test controls'

    const note = document.createElement('small')
    note.textContent = 'Data buttons fire the bound state-machine controls. Animation buttons play the raw animations for comparison.'

    const dataRow = document.createElement('div')
    dataRow.className = 'tribe-simple-state-control-row'

    const resetButton = createStateMachineControlButton(
      `Reset ${entry.stateMachine}`,
      () => {
        if (rive !== instance) {
          setStatus('This Rive instance is no longer active.')
          return
        }
        startStateMachine(instance, entry, 'test reset')
      },
      'secondary',
    )
    dataRow.append(resetButton)

    const viewModelInstance = instance.viewModelInstance
    const properties = getViewModelPropertyPaths(viewModelInstance)
    let actionablePropertyCount = 0

    for (const property of properties) {
      const propertyPath = property.path
      const propertyName = getViewModelPathLeafName(propertyPath)
      if (!propertyPath) continue

      const accessor = getViewModelPropertyAccessor(instance, propertyPath)
      if (!accessor) {
        dataRow.append(createStateMachineControlButton(propertyPath, () => {}, 'secondary', true))
        continue
      }

      actionablePropertyCount += 1
      dataRow.append(
        createStateMachineControlButton(
          accessor.label,
          (button) => {
            if (rive !== instance) {
              setStatus('This Rive instance is no longer active.')
              return
            }

            const navigationCommand = getCommand({ name: propertyName, source: 'rive-event' })
            if (navigationCommand && isPageNavigationCommand(navigationCommand)) {
              markRivePointerInteraction()
              runSimpleRiveAction({
                name: propertyName,
                properties: { via: 'state-machine-control' },
                source: 'rive-event',
              })
              return
            }

            const playingStateMachineNames = instance.playingStateMachineNames || []
            if (!playingStateMachineNames.includes(entry.stateMachine)) {
              startStateMachine(instance, entry, 'control reset')
            }

            const liveAccessor = getViewModelPropertyAccessor(instance, propertyPath)
            if (!liveAccessor) {
              setStatus(`Data binding ${propertyPath} is not callable on the active instance.`)
              return
            }
            liveAccessor.run(button)
          },
          'secondary',
        ),
      )
    }

    if (!properties.length) {
      dataRow.append(createStateMachineControlButton('No data bindings', () => {}, 'secondary', true))
    } else if (!actionablePropertyCount) {
      dataRow.append(createStateMachineControlButton('No callable data bindings', () => {}, 'secondary', true))
    }

    const animationRow = document.createElement('div')
    animationRow.className = 'tribe-simple-state-control-row'
    const activeArtboard = (instance.contents?.artboards || []).find((artboard) => artboard.name === entry.artboard)
    const animations = activeArtboard?.animations || []

    if (!animations.length) {
      animationRow.append(createStateMachineControlButton('No direct animations', () => {}, '', true))
    }

    for (const animation of animations) {
      animationRow.append(
        createStateMachineControlButton(animation, () => {
          if (rive !== instance) {
            setStatus('This Rive instance is no longer active.')
            return
          }
          startAnimation(instance, { artboard: entry.artboard, animation }, 'direct test')
        }),
      )
    }

    stateMachineControls.append(title, note, dataRow, animationRow)
    stateMachineControls.hidden = false
  }

  startButton.addEventListener('click', () => {
    if (!rive) {
      setStatus('Rive is not loaded yet.')
      return
    }

    if (activeStateMachineEntry) {
      startStateMachine(rive, activeStateMachineEntry, 'manual start')
      return
    }

    if (activeAnimationEntry) {
      startAnimation(rive, activeAnimationEntry, 'manual start')
      return
    }

    hideManualStart()
    enableRivePointerCapture()
    rive.play(activeStateMachine || activeAnimation || undefined)
    setStatus(activeStateMachine || activeAnimation ? `Started ${activeStateMachine || activeAnimation}.` : 'Started Rive.')
  })

  const shouldKeepReadingAreaChild = (element: Element) =>
    element === root ||
    element.id === 'tribe-simple-overlay-styles' ||
    element.tagName === 'STYLE' ||
    element.tagName === 'LINK' ||
    element.tagName === 'SCRIPT'

  const getReaderChromeLabel = (element: Element): string =>
    [
      element.id,
      element.className,
      element.getAttribute('role'),
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('data-testid'),
      element.textContent,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ')

  const isReaderNavigationChrome = (element: Element): boolean => {
    if (!shouldPreserveReaderChrome || !(element instanceof HTMLElement)) return false

    const candidates = [
      element,
      ...Array.from(element.querySelectorAll('button, [role="button"], a, [aria-label], [title], [data-testid]')),
    ]

    return candidates.some((candidate) => getNavigationDirectionFromText(getReaderChromeLabel(candidate)) !== null)
  }

  const queryReadingAreaElements = (selector: string | null): HTMLElement[] => {
    if (!selector) return []

    try {
      return Array.from(readingRoot.querySelectorAll(selector)).filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement &&
          !root.contains(element) &&
          !shouldKeepReadingAreaChild(element) &&
          !isReaderNavigationChrome(element),
      )
    } catch (error) {
      console.warn(`[1Tribe simple overlay] Invalid replacement selector "${selector}".`, error)
      setStatus(`Invalid replacement selector: ${selector}`)
      return []
    }
  }

  const hideSelectedContent = () => {
    if (!hideSelector) return

    for (const element of queryReadingAreaElements(hideSelector)) {
      if (!hiddenSelectedElements.some((item) => item.element === element)) {
        hiddenSelectedElements.push({
          element,
          visibility: element.style.visibility,
          pointerEvents: element.style.pointerEvents,
          ariaHidden: element.getAttribute('aria-hidden'),
        })
      }

      element.style.visibility = 'hidden'
      element.style.pointerEvents = 'none'
      element.setAttribute('aria-hidden', 'true')
    }
  }

  const hideReadingAreaContent = () => {
    if (!shouldReplaceReadingArea) return

    for (const child of Array.from(readingRoot.children)) {
      if (shouldKeepReadingAreaChild(child) || isReaderNavigationChrome(child) || !(child instanceof HTMLElement)) continue

      if (!hiddenReadingAreaChildren.some((item) => item.element === child)) {
        hiddenReadingAreaChildren.push({
          element: child,
          visibility: child.style.visibility,
          pointerEvents: child.style.pointerEvents,
          ariaHidden: child.getAttribute('aria-hidden'),
        })
      }

      child.style.visibility = 'hidden'
      child.style.pointerEvents = 'none'
      child.setAttribute('aria-hidden', 'true')
    }
  }

  const restoreReadingAreaContent = () => {
    for (const item of hiddenReadingAreaChildren) {
      item.element.style.visibility = item.visibility
      item.element.style.pointerEvents = item.pointerEvents
      if (item.ariaHidden === null) {
        item.element.removeAttribute('aria-hidden')
      } else {
        item.element.setAttribute('aria-hidden', item.ariaHidden)
      }
    }

    hiddenReadingAreaChildren.length = 0
  }

  const restoreSelectedContent = () => {
    for (const item of hiddenSelectedElements) {
      item.element.style.visibility = item.visibility
      item.element.style.pointerEvents = item.pointerEvents
      if (item.ariaHidden === null) {
        item.element.removeAttribute('aria-hidden')
      } else {
        item.element.setAttribute('aria-hidden', item.ariaHidden)
      }
    }

    hiddenSelectedElements.length = 0
  }

  const applyReplacementVisibility = () => {
    const activePassthroughSides = syncEpicNativePointerPassthroughState()
    applyRivePointerCaptureStyles(activePassthroughSides)
    if (activePassthroughSides.size > 0) {
      restoreReadingAreaContent()
      restoreSelectedContent()
      return
    }

    hideReadingAreaContent()
    hideSelectedContent()
  }

  const positionReadingAreaMask = (rect: FlipBookRect | null) => {
    if (!shouldReplaceReadingArea || getActiveEpicNativePointerPassthroughSides().size > 0) {
      readingAreaMask.hidden = true
      return
    }

    readingAreaMask.hidden = false
    if (!rect) {
      readingAreaMask.style.cssText = [
        'position:absolute',
        'inset:0',
        'z-index:0',
        `background:${replacementBackdrop}`,
        'pointer-events:none',
      ].join(';')
      return
    }

    readingAreaMask.style.cssText = [
      'position:fixed',
      `left:${rect.x}px`,
      `top:${rect.y}px`,
      `width:${Math.max(1, rect.width)}px`,
      `height:${Math.max(1, rect.height)}px`,
      'z-index:0',
      `background:${replacementBackdrop}`,
      'pointer-events:none',
    ].join(';')
  }

  const hideReaderNavGutters = () => {
    navBackGutter.hidden = true
    navNextGutter.hidden = true
    readerNavGuttersEnabled = false
    readerNavGutterWidthPx = 0
  }

  const getReaderNavGutterWidth = (rect: FlipBookRect | null): number => {
    if (!shouldUseReaderNavGutters || !rect || navGutterRatio <= 0) return 0
    return Math.max(1, Math.min(rect.width * navGutterRatio, rect.width * 0.24))
  }

  const positionReaderNavGutters = (rect: FlipBookRect | null) => {
    const host = readingRoot.host
    const gutter = getReaderNavGutterWidth(rect)
    if (!rect || !(host instanceof HTMLElement) || gutter <= 0) {
      hideReaderNavGutters()
      return
    }

    const hostRect = host.getBoundingClientRect()
    const left = rect.x - hostRect.x
    const top = rect.y - hostRect.y
    const width = Math.max(1, gutter)
    const height = Math.max(1, rect.height)
    const nextLeft = left + Math.max(0, rect.width - width)
    const activePassthroughSides = getActiveEpicNativePointerPassthroughSides()
    const shouldHideBackGutter = activePassthroughSides.has('left')
    const shouldHideNextGutter = activePassthroughSides.has('right')

    navBackGutter.hidden = shouldHideBackGutter
    if (!shouldHideBackGutter) {
      navBackGutter.style.cssText = [
        'position:absolute',
        `left:${left}px`,
        `top:${top}px`,
        `width:${width}px`,
        `height:${height}px`,
        'pointer-events:auto',
      ].join(';')
    } else {
      navBackGutter.style.pointerEvents = 'none'
    }

    navNextGutter.hidden = shouldHideNextGutter
    if (!shouldHideNextGutter) {
      navNextGutter.style.cssText = [
        'position:absolute',
        `left:${nextLeft}px`,
        `top:${top}px`,
        `width:${width}px`,
        `height:${height}px`,
        'pointer-events:auto',
      ].join(';')
    } else {
      navNextGutter.style.pointerEvents = 'none'
    }

    readerNavGuttersEnabled = !shouldHideBackGutter || !shouldHideNextGutter
    readerNavGutterWidthPx = readerNavGuttersEnabled ? width : 0
  }

  const applyFrameBackdropStyle = () => {
    frame.style.backgroundColor = replacementBackdrop
    if (!frameBackdropSnapshotUrl) {
      frame.style.removeProperty('background-image')
      frame.style.removeProperty('background-size')
      frame.style.removeProperty('background-position')
      frame.style.removeProperty('background-repeat')
      return
    }

    frame.style.backgroundImage = `url(${frameBackdropSnapshotUrl})`
    frame.style.backgroundSize = '100% 100%'
    frame.style.backgroundPosition = 'center'
    frame.style.backgroundRepeat = 'no-repeat'
  }

  const clearFrameBackdropSnapshot = () => {
    if (frameBackdropSnapshotTimer !== null) window.clearTimeout(frameBackdropSnapshotTimer)
    frameBackdropSnapshotTimer = null
    frameBackdropSnapshotUrl = null
    applyFrameBackdropStyle()
  }

  const captureFrameBackdropSnapshot = (reason: string) => {
    if (!shouldUseSnapshotBackdrop || !activeCanvas || frame.hidden) return

    try {
      const snapshotCanvas = document.createElement('canvas')
      snapshotCanvas.width = Math.max(1, activeCanvas.width)
      snapshotCanvas.height = Math.max(1, activeCanvas.height)

      const context2d = snapshotCanvas.getContext('2d')
      if (!context2d) return

      context2d.fillStyle = replacementBackdrop
      context2d.fillRect(0, 0, snapshotCanvas.width, snapshotCanvas.height)
      context2d.drawImage(activeCanvas, 0, 0, snapshotCanvas.width, snapshotCanvas.height)

      if (frameBackdropSnapshotTimer !== null) window.clearTimeout(frameBackdropSnapshotTimer)
      frameBackdropSnapshotUrl = snapshotCanvas.toDataURL('image/png')
      applyFrameBackdropStyle()
      frameBackdropSnapshotTimer = window.setTimeout(clearFrameBackdropSnapshot, transitionDurationMs + 180)

      console.info('[1Tribe simple overlay] Captured frame snapshot backdrop for page turn.', {
        reason,
        width: snapshotCanvas.width,
        height: snapshotCanvas.height,
      })
    } catch (error) {
      console.warn('[1Tribe simple overlay] Unable to capture frame snapshot backdrop.', error)
    }
  }

  if (shouldReplaceReadingArea || shouldReplaceSelectedContent) {
    applyReplacementVisibility()
    replacementObserver = new MutationObserver(() => {
      applyReplacementVisibility()
      window.setTimeout(resizeRive, 0)
    })
    replacementObserver.observe(readingRoot, { childList: true, subtree: shouldReplaceSelectedContent })
  }

  const positionSimpleFrame = () => {
    applyReplacementVisibility()
    const rect = context.data.getFlipBookRect()
    const host = readingRoot.host
    const activePassthroughSides = syncEpicNativePointerPassthroughState()
    const pointerEvents = getEffectiveRivePointerEvents(activePassthroughSides)
    positionReadingAreaMask(rect)
    positionReaderNavGutters(rect)

    if (frameSelector && host instanceof HTMLElement) {
      const target = queryReadingAreaElements(frameSelector).find((element) => {
        const targetRect = element.getBoundingClientRect()
        return targetRect.width > 0 && targetRect.height > 0
      })

      if (target) {
        const hostRect = host.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        frame.style.cssText = [
          'position:absolute',
          `left:${targetRect.x - hostRect.x}px`,
          `top:${targetRect.y - hostRect.y}px`,
          `width:${Math.max(1, targetRect.width)}px`,
          `height:${Math.max(1, targetRect.height)}px`,
          `pointer-events:${pointerEvents}`,
        ].join(';')
        applyFrameBackdropStyle()
        applyRivePointerCaptureStyles(activePassthroughSides)
        return
      }

      if (!hasWarnedAboutReplacementSelector) {
        hasWarnedAboutReplacementSelector = true
        console.warn(`[1Tribe simple overlay] No visible element found for riveFrameSelector "${frameSelector}".`)
      }
    }

    if (!rect || !(host instanceof HTMLElement)) {
      frame.style.cssText = `position:absolute;inset:0;pointer-events:${pointerEvents};`
      applyFrameBackdropStyle()
      applyRivePointerCaptureStyles(activePassthroughSides)
      return
    }

    const hostRect = host.getBoundingClientRect()
    const gutter = shouldReplaceReadingArea ? 0 : Math.min(rect.width * navGutterRatio, rect.width * 0.24)

    frame.style.cssText = [
      'position:absolute',
      `left:${rect.x - hostRect.x + gutter}px`,
      `top:${rect.y - hostRect.y}px`,
      `width:${Math.max(1, rect.width - gutter * 2)}px`,
      `height:${Math.max(1, rect.height)}px`,
      `pointer-events:${pointerEvents}`,
    ].join(';')
    applyFrameBackdropStyle()
    applyRivePointerCaptureStyles(activePassthroughSides)
  }

  const resizeRive = () => {
    positionSimpleFrame()
    const pixelRatio = getEffectivePixelRatio(frame)
    for (const riveCanvas of Array.from(frame.querySelectorAll<HTMLCanvasElement>('.tribe-simple-rive-canvas'))) {
      if (riveCanvas.classList.contains('tribe-simple-interaction-canvas')) {
        resizeCanvasToOwnBounds(riveCanvas, pixelRatio)
      } else {
        resizeCanvasToFrame(riveCanvas, frame, pixelRatio)
      }
    }
    rive?.resizeDrawingSurfaceToCanvas(pixelRatio)
    pendingRive?.resizeDrawingSurfaceToCanvas(pixelRatio)
    preloadedUnderlay?.rive.resizeDrawingSurfaceToCanvas(pixelRatio)
    pendingUnderlayRive?.resizeDrawingSurfaceToCanvas(pixelRatio)
    for (const binding of interactionBindings) {
      binding.rive.resizeDrawingSurfaceToCanvas(pixelRatio)
    }
    for (const player of Object.values(transitionPlayers)) {
      if (!player) continue
      resizeCanvasToFrame(player.canvas, frame, pixelRatio)
      player.rive.resizeDrawingSurfaceToCanvas(pixelRatio)
    }
  }

  const cleanupCanvas = (targetCanvas: HTMLCanvasElement) => {
    const context2d = targetCanvas.getContext('2d')
    context2d?.clearRect(0, 0, targetCanvas.width, targetCanvas.height)
    targetCanvas.remove()
  }

  const createRiveCanvas = (isLoading = false) => {
    const nextCanvas = document.createElement('canvas')
    nextCanvas.className = `tribe-simple-rive-canvas ${
      isLoading ? 'tribe-simple-loading-canvas' : 'tribe-simple-active-canvas'
    }`
    nextCanvas.style.opacity = isLoading ? '0' : '1'
    nextCanvas.style.pointerEvents = isLoading ? 'none' : getEffectiveRivePointerEvents()
    nextCanvas.style.zIndex = isLoading ? '2' : '1'
    frame.append(nextCanvas)
    resizeRive()
    applyRivePointerCaptureStyles()
    return nextCanvas
  }

  const getTransitionDirection = (direction: number | null): TransitionDirection | null => {
    if (!direction) return null
    return direction < 0 ? 'backward' : 'forward'
  }

  const getTransitionAnimationName = (direction: TransitionDirection): string => {
    const directionParam =
      direction === 'backward'
        ? getStringParam('riveTransitionBackwardAnimation')?.trim()
        : getStringParam('riveTransitionForwardAnimation')?.trim()

    return directionParam || requestedTransitionAnimation || 'animation'
  }

  const getTransitionFileUrl = (direction: TransitionDirection): string | null => {
    if (!shouldUseTransitionFiles || !files.length) return null

    const directionFile =
      direction === 'backward'
        ? getStringParam('riveTransitionBackwardFile')?.trim()
        : getStringParam('riveTransitionForwardFile')?.trim()
    const sharedFile = getStringParam('riveTransitionFile')?.trim()
    if (directionFile || sharedFile) {
      return new URL(directionFile || sharedFile || '', extensionScriptUrl).href
    }

    const folder = files[Math.max(0, displayedFileIndex)]?.folder || files[0]?.folder
    if (!folder) return null

    const fileName = direction === 'backward' ? 'booktransition-backward.riv' : 'booktransition-forward.riv'
    return new URL(`rive/${folder}/${fileName}`, extensionScriptUrl).href
  }

  const hideTransitionRives = () => {
    if (transitionCleanupTimer !== null) window.clearTimeout(transitionCleanupTimer)
    transitionCleanupTimer = null

    for (const player of Object.values(transitionPlayers)) {
      if (!player) continue
      player.canvas.style.opacity = '0'
      try {
        player.rive.pause(player.animation)
      } catch {
        // Some runtimes tolerate pause() differently; hiding the canvas is enough for the page turn.
      }
    }
    activeTransitionDirection = null
  }

  const cleanupTransitionRives = () => {
    hideTransitionRives()
    for (const direction of ['forward', 'backward'] as const) {
      const player = transitionPlayers[direction]
      if (!player) continue
      player.rive.cleanup()
      player.canvas.remove()
      delete transitionPlayers[direction]
    }
  }

  const preloadTransitionRive = (direction: TransitionDirection) => {
    const transitionUrl = getTransitionFileUrl(direction)
    if (!transitionUrl) return
    const transitionAnimation = getTransitionAnimationName(direction)

    const cached = transitionPlayers[direction]
    if (
      cached?.url === transitionUrl &&
      cached.animation === transitionAnimation &&
      cached.artboard === requestedTransitionArtboard
    ) {
      return
    }

    if (cached) {
      cached.rive.cleanup()
      cached.canvas.remove()
      delete transitionPlayers[direction]
    }

    const nextTransitionCanvas = document.createElement('canvas')
    nextTransitionCanvas.className = 'tribe-simple-transition-canvas'
    nextTransitionCanvas.style.opacity = '0'
    frame.append(nextTransitionCanvas)
    resizeCanvasToFrame(nextTransitionCanvas, frame, getEffectivePixelRatio(frame))

    const player: TransitionRivePlayer = {
      animation: transitionAnimation,
      artboard: requestedTransitionArtboard,
      canvas: nextTransitionCanvas,
      direction,
      ready: false,
      rive: null as unknown as Rive,
      url: transitionUrl,
    }

    const instance = new Rive({
      src: transitionUrl,
      canvas: nextTransitionCanvas,
      artboard: requestedTransitionArtboard || undefined,
      animations: transitionAnimation,
      autoplay: false,
      autoBind: runtimeConfig.autoBind,
      automaticallyHandleEvents: false,
      enableRiveAssetCDN: false,
      shouldDisableRiveListeners: true,
      isTouchScrollEnabled: true,
      useOffscreenRenderer: runtimeConfig.useOffscreenRenderer,
      layout: new Layout({
        fit: Fit.Contain,
        alignment: Alignment.Center,
      }),
      onLoad() {
        if (isDisposed || transitionPlayers[direction] !== player) return
        player.ready = true
        resizeCanvasToFrame(nextTransitionCanvas, frame, getEffectivePixelRatio(frame))
        instance.resizeDrawingSurfaceToCanvas(getEffectivePixelRatio(frame))
        console.info(`[1Tribe simple overlay] Preloaded ${direction} transition Rive.`)
      },
      onLoadError(event) {
        console.warn(`[1Tribe simple overlay] Transition Rive failed: ${String(event.data || 'unknown error')}`)
        if (transitionPlayers[direction] === player) {
          instance.cleanup()
          nextTransitionCanvas.remove()
          delete transitionPlayers[direction]
        }
      },
    })

    player.rive = instance
    transitionPlayers[direction] = player
  }

  const preloadTransitionRives = () => {
    if (!shouldUseTransitionFiles || !files.length) return

    preloadTransitionRive('forward')
    preloadTransitionRive('backward')
  }

  const playTransitionRive = (directionValue: number | null) => {
    const direction = getTransitionDirection(directionValue)
    if (!direction || frame.hidden) return

    const player = transitionPlayers[direction]
    if (!player?.ready) {
      preloadTransitionRive(direction)
      console.info(`[1Tribe simple overlay] ${direction} transition Rive is not ready yet.`)
      return
    }
    if (transitionCleanupTimer !== null && activeTransitionDirection === direction) return

    hideTransitionRives()
    activeTransitionDirection = direction
    player.canvas.style.opacity = '1'
    resizeCanvasToFrame(player.canvas, frame, getEffectivePixelRatio(frame))
    player.rive.resizeDrawingSurfaceToCanvas(getEffectivePixelRatio(frame))
    player.rive.reset({
      artboard: player.artboard || undefined,
      animations: player.animation,
      autoplay: true,
      autoBind: runtimeConfig.autoBind,
    })
    player.rive.play(player.animation)
    transitionCleanupTimer = window.setTimeout(hideTransitionRives, transitionDurationMs)
  }

  const clearPageFlip = () => {
    if (pageFlipTimer !== null) window.clearTimeout(pageFlipTimer)
    pageFlipTimer = null
    frame.classList.remove('is-flipping-next', 'is-flipping-back')
  }

  const startPageFlip = (direction: number | null) => {
    playTransitionRive(direction)
    if (shouldUseNativePageFlip) return
    if (!direction || frame.hidden) return

    clearPageFlip()
    frame.classList.add(direction < 0 ? 'is-flipping-back' : 'is-flipping-next')
    pageFlipTimer = window.setTimeout(clearPageFlip, pageFlipMs + 80)
  }

  const markRivePointerInteraction = () => {
    lastRivePointerInteractionAt = performance.now()
  }

  const canRunRiveStateNavigation = () => performance.now() - lastRivePointerInteractionAt <= 4000

  const runSimpleRiveAction = (action: RiveAction): boolean => {
    const command = getCommand(action)
    if (!command) return false

    if (isPageNavigationCommand(command)) {
      if (action.source === 'rive-state' && !canRunRiveStateNavigation()) {
        console.info('[1Tribe simple overlay] Ignored passive Rive navigation state.', action)
        return false
      }

      const direction = getPageNavigationDirection(command)
      if (!direction) return false

      const now = performance.now()
      if (lastReaderNavigationCommand === command && now - lastReaderNavigationAt < 650) {
        return true
      }
      lastReaderNavigationCommand = command
      lastReaderNavigationAt = now

      const reason = direction < 0 ? 'rive page back' : 'rive page forward'
      const epicCommand = getEpicPageNavigationCommand(command)
      if (!epicCommand) return false
      queueNavigationCycle(direction, reason)
      context.commands.execute(epicCommand, {
        source: action.source,
        action: action.name,
        direction,
        page: displayedPage,
        properties: action.properties,
      })
      context.analytics.log('1tribe_rive_reader_navigation', {
        action: action.name,
        source: action.source,
        command,
        epicCommand,
        direction,
        bookId: context.data.getBookId(),
        page: displayedPage,
        ...action.properties,
      })
      setStatus(`Rive ${action.name}: turning ${direction < 0 ? 'back' : 'forward'}.`)
      return true
    }

    context.analytics.log('1tribe_simple_rive_action', {
      action: action.name,
      source: action.source,
      command,
      bookId: context.data.getBookId(),
      page: context.data.getCurrentPage(),
      ...action.properties,
    })

    if (command === 'openModal') {
      context.commands.execute(command, getModalSize(action.properties))
      return true
    }

    if (command === 'lookup_word') {
      const word = getLookupWordPayload(action)
      if (!word) {
        console.info('[1Tribe simple overlay] Ignored lookup_word action without a word payload.', action)
        setStatus('Rive lookup_word action did not include a word.')
        return false
      }

      armWordLookupDismissGuard(word, `simple-rive-${action.source}`)
      context.commands.execute(command, word)
      setStatus(`Rive lookup_word: ${word}.`)
      return true
    }

    context.commands.execute(command, {
      source: action.source,
      action: action.name,
      properties: action.properties,
    })
    return true
  }

  const runReaderNavGutterAction = (event: MouseEvent, command: 'previousPage' | 'nextPage') => {
    event.preventDefault()
    event.stopPropagation()
    runSimpleRiveAction({
      name: command,
      source: 'nav-gutter',
      properties: {
        direction: command === 'previousPage' ? -1 : 1,
        gutterWidth: readerNavGutterWidthPx,
      },
    })
  }

  const onReaderNavBackGutterClick = (event: MouseEvent) => runReaderNavGutterAction(event, 'previousPage')
  const onReaderNavNextGutterClick = (event: MouseEvent) => runReaderNavGutterAction(event, 'nextPage')

  const getVisibleRiveBooleanBindingPaths = (propertyName: string): string[] => {
    if (!rive?.viewModelInstance) return []

    const normalizedName = propertyName.toLowerCase()
    return getViewModelPropertyPaths(rive.viewModelInstance)
      .filter((property) => property.name.toLowerCase() === normalizedName && property.type === 'boolean')
      .map((property) => property.path)
  }

  const setVisibleRiveBooleanBinding = (propertyName: string, value: boolean, source: string): boolean => {
    if (!rive?.viewModelInstance) return false

    const matchingPaths = getVisibleRiveBooleanBindingPaths(propertyName)
    if (!matchingPaths.length) return false

    for (const path of matchingPaths) {
      try {
        const booleanValue = rive.viewModelInstance.boolean(path)
        if (booleanValue) booleanValue.value = value
      } catch {
        // Keep setting any sibling binding paths that are valid.
      }
    }

    setStatus(`Rive button ${source}: set ${propertyName}=${value}.`)
    return true
  }

  const pulseVisibleRiveBooleanBinding = (propertyName: string, source: string): boolean => {
    if (!rive?.viewModelInstance) return false

    const matchingPaths = getVisibleRiveBooleanBindingPaths(propertyName)

    if (!matchingPaths.length) return false

    for (const path of matchingPaths) {
      try {
        const booleanValue = rive.viewModelInstance.boolean(path)
        if (booleanValue) booleanValue.value = true
      } catch {
        // Keep pulsing any sibling binding paths that are valid.
      }
    }

    window.setTimeout(() => {
      if (!rive?.viewModelInstance) return

      for (const path of matchingPaths) {
        try {
          const booleanValue = rive.viewModelInstance.boolean(path)
          if (booleanValue) booleanValue.value = false
        } catch {
          // Ignore stale bindings after a page swap.
        }
      }
    }, 120)

    setStatus(`Rive button ${source}: pulsed ${matchingPaths.join(', ')}.`)
    return true
  }

  const pulseVisibleRivePageAction = (direction: number, reason: string): boolean => {
    if (!shouldUseStateMachinePageActions || !direction) return false

    const propertyName = direction < 0 ? 'Prev' : 'Next'
    const activeFile = getActiveSimpleRiveFile()
    const didPulse = pulseVisibleRiveBooleanBinding(propertyName, `${reason} page action`)
    context.analytics.log('1tribe_simple_rive_state_machine_page_action', {
      bookId: context.data.getBookId(),
      page: context.data.getCurrentPage(),
      displayedPage,
      activeFile: activeFile?.name || null,
      direction: direction < 0 ? 'previous' : 'next',
      propertyName,
      reason,
      success: didPulse,
    })
    if (!didPulse) {
      console.info(`[1Tribe simple overlay] Could not pulse state-machine page action "${propertyName}".`, {
        reason,
        activeFile: activeFile?.name || null,
        hasViewModelInstance: Boolean(rive?.viewModelInstance),
        availableProperties: getViewModelPropertyPaths(rive?.viewModelInstance).map((property) => property.path),
      })
    }
    return didPulse
  }

  const getSimpleRivePageInteractionEntries = (
    contents: SimpleRiveContents,
    file: SimpleRiveFile,
    currentPage: number,
  ): SimpleRiveStateMachineEntry[] => {
    const artboards = contents.artboards || []
    const siblingPage =
      file.pages && currentPage === file.pages[0]
        ? file.pages[1]
        : file.pages && currentPage === file.pages[1]
          ? file.pages[0]
          : null
    const pageNumbers = Array.from(
      new Set([
        currentPage,
        siblingPage,
        ...(file.pages || []),
      ]),
    ).filter((pageNumber): pageNumber is number => typeof pageNumber === 'number' && Number.isFinite(pageNumber) && pageNumber >= 0)
    const entries: SimpleRiveStateMachineEntry[] = []

    for (const pageNumber of pageNumbers) {
      const page = String(pageNumber).padStart(2, '0')
      const pageArtboardCandidates = [`Page_${page}`, `Page_${pageNumber}`]
      const artboard = pageArtboardCandidates
        .map((candidate) => artboards.find((item) => item.name.toLowerCase() === candidate.toLowerCase()))
        .find(Boolean)
      if (!artboard?.stateMachines?.length) continue

      const stateMachineCandidates = ['animation', 'Click', 'click', `Page_${page}`, `Page_${pageNumber}`]
      const stateMachine =
        stateMachineCandidates
          .map((candidate) => artboard.stateMachines?.find((item) => item.name.toLowerCase() === candidate.toLowerCase()))
          .find(Boolean) || artboard.stateMachines[0]
      if (!stateMachine) continue

      entries.push({
        artboard: artboard.name,
        stateMachine: stateMachine.name,
      })
    }

    return entries.filter(
      (entry, index, list) =>
        list.findIndex((candidate) => candidate.artboard === entry.artboard && candidate.stateMachine === entry.stateMachine) === index,
    )
  }

  const applyInteractionCanvasPlacement = (
    nextInteractionCanvas: HTMLCanvasElement,
    _entry: SimpleRiveStateMachineEntry,
    _file: SimpleRiveFile,
  ) => {
    nextInteractionCanvas.style.top = '0'
    nextInteractionCanvas.style.bottom = '0'
    nextInteractionCanvas.style.right = '0'
    nextInteractionCanvas.style.left = '0'
    nextInteractionCanvas.style.width = '100%'
    nextInteractionCanvas.style.height = '100%'
  }

  const isRiveClickBindingName = (name: string) => /^(?:.+_)?click(?:_\d+)?$/i.test(name)
  const isRiveHoverBindingName = (name: string) => /^(?:.+_)?hover(?:_\d+)?$/i.test(name)

  const attachInteractionDataBridge = (interactionInstance: Rive, binding: SimpleRiveInteractionBinding) => {
    const viewModelInstance = interactionInstance.viewModelInstance
    if (!viewModelInstance) return

    for (const property of getViewModelPropertyPaths(viewModelInstance)) {
      const isClickBinding = isRiveClickBindingName(property.name)
      const isHoverBinding = isRiveHoverBindingName(property.name)
      if ((!isClickBinding && !isHoverBinding) || property.type !== 'boolean') continue

      try {
        const booleanValue = viewModelInstance.boolean(property.path)
        if (!booleanValue) continue

        const onButtonBindingChange = (value: boolean) => {
          markRivePointerInteraction()
          if (isClickBinding) {
            if (value && !pulseVisibleRiveBooleanBinding(property.name, property.path)) {
              pulseVisibleRiveBooleanBinding('Click', property.path)
            }
            return
          }

          if (!setVisibleRiveBooleanBinding(property.name, value, property.path)) {
            setVisibleRiveBooleanBinding('Hover', value, property.path)
          }
        }
        booleanValue.on(onButtonBindingChange)
        binding.cleanup.push(() => booleanValue.off(onButtonBindingChange))
      } catch {
        // Try the next button binding path.
      }
    }
  }

  const onSimpleRiveEvent = (event: RiveRuntimeEvent) => {
    const payload = getRiveEventPayload(event)
    const eventName = payload.name || 'unnamed event'
    console.info('[1Tribe simple overlay] Rive event', payload)

    if (payload.name) {
      const handled = runSimpleRiveAction({
        name: payload.name,
        properties: payload.properties,
        source: 'rive-event',
      })
      if (handled) return
    }

    setStatus(`Rive event: ${eventName}`)
  }

  const onSimpleStateChange = (event: RiveRuntimeEvent) => {
    const stateNames = Array.isArray(event.data)
      ? event.data.filter((item): item is string => typeof item === 'string')
      : typeof event.data === 'string'
        ? [event.data]
        : []
    const states = stateNames.join(', ')
    console.info('[1Tribe simple overlay] Rive state change', event.data)

    const handled = stateNames.some((stateName) =>
      runSimpleRiveAction({
        name: stateName,
        source: 'rive-state',
      }),
    )
    if (!handled && states) setStatus(`Rive state: ${states}`)
  }

  const cleanupInteractionRive = () => {
    for (const binding of interactionBindings) {
      for (const cleanup of binding.cleanup) cleanup()
      binding.rive.cleanup()
      cleanupCanvas(binding.canvas)
    }
    interactionBindings = []
  }

  const startInteractionStateMachines = (
    file: SimpleRiveFile,
    entries: SimpleRiveStateMachineEntry[],
    page: number,
    reason: string,
  ) => {
    cleanupInteractionRive()

    for (const entry of entries) {
      const nextInteractionCanvas = document.createElement('canvas')
      nextInteractionCanvas.className = 'tribe-simple-rive-canvas tribe-simple-interaction-canvas'
      nextInteractionCanvas.style.opacity = '0'
      nextInteractionCanvas.style.pointerEvents = getEffectiveRivePointerEvents()
      nextInteractionCanvas.style.zIndex = '3'
      applyInteractionCanvasPlacement(nextInteractionCanvas, entry, file)
      frame.append(nextInteractionCanvas)
      resizeRive()

      const binding: SimpleRiveInteractionBinding = {
        rive: null as unknown as Rive,
        canvas: nextInteractionCanvas,
        cleanup: [],
      }

      const onInteractionStateChange = (event: RiveRuntimeEvent) => {
        onSimpleStateChange(event)
        const stateNames = Array.isArray(event.data)
          ? event.data.filter((item): item is string => typeof item === 'string')
          : typeof event.data === 'string'
            ? [event.data]
            : []
        if (stateNames.some((stateName) => /^animation$/i.test(stateName))) {
          pulseVisibleRiveBooleanBinding('Click', `${entry.artboard}/${entry.stateMachine}`)
        }
      }
      const interactionInstance = new Rive({
        src: file.url,
        canvas: nextInteractionCanvas,
        artboard: entry.artboard,
        stateMachines: entry.stateMachine,
        autoplay: true,
        automaticallyHandleEvents: shouldAutomaticallyHandleRiveEvents,
        autoBind: runtimeConfig.autoBind,
        enableRiveAssetCDN: false,
        shouldDisableRiveListeners: !areRiveListenersEnabled,
        isTouchScrollEnabled: true,
        useOffscreenRenderer: runtimeConfig.useOffscreenRenderer,
        layout: new Layout({
          fit: Fit.Contain,
          alignment: Alignment.Center,
        }),
        onLoad() {
          if (isDisposed || !interactionBindings.includes(binding)) {
            return
          }

          enableRivePointerCapture()
          resizeRive()
          attachInteractionDataBridge(interactionInstance, binding)
          const runtimeSummary = getStateMachineRuntimeSummary(interactionInstance, entry)
          setStatus(`Running ${entry.artboard} / Page_in (page in). Interactions: ${entry.stateMachine}. ${runtimeSummary}`)
          logPageMappingDebug(context, {
            readerPage: page,
            reason,
            matchedFile: file,
            playbackTriggered: true,
            stateMachine: entry.stateMachine,
            artboard: entry.artboard,
            note: 'Page-level interaction state machine is active above the visible Page_in animation and mirrors Click data to the visible spread.',
          })
          renderStateMachineControls(interactionInstance, entry)
        },
        onLoadError(event) {
          if (!interactionBindings.includes(binding)) return

          console.warn('[1Tribe simple overlay] Failed to load interaction state machine.', event.data)
          cleanupInteractionRive()
        },
      })

      binding.rive = interactionInstance
      interactionBindings.push(binding)
      interactionInstance.on(EventType.RiveEvent, onSimpleRiveEvent)
      interactionInstance.on(EventType.StateChange, onInteractionStateChange)
      binding.cleanup.push(() => interactionInstance.off(EventType.RiveEvent, onSimpleRiveEvent))
      binding.cleanup.push(() => interactionInstance.off(EventType.StateChange, onInteractionStateChange))
    }
  }

  const getReaderPageLabelForFile = (file: SimpleRiveFile) =>
    file.readerPages?.length ? file.readerPages.join(',') : file.pages ? `${file.pages[0]}-${file.pages[1]}` : 'all pages'

  const getFirstReaderPageForFile = (file: SimpleRiveFile, fallback: number) =>
    file.readerPages?.[0] ?? file.pages?.[0] ?? fallback

  const getRetainedBackUnderlayIndex = (file: SimpleRiveFile, playbackKey: string) =>
    retainedBackUnderlays.findIndex(
      (underlay) =>
        underlay.direction < 0 &&
        underlay.file.url === file.url &&
        underlay.playbackKey === playbackKey,
    )

  const hasRetainedBackUnderlayForFile = (file: SimpleRiveFile, playbackKey: string) =>
    getRetainedBackUnderlayIndex(file, playbackKey) >= 0

  const storeRetainedBackUnderlay = (underlay: SimpleRiveUnderlay) => {
    const existingIndex = getRetainedBackUnderlayIndex(underlay.file, underlay.playbackKey)
    if (existingIndex >= 0) {
      const existing = retainedBackUnderlays.splice(existingIndex, 1)[0]
      existing.rive.cleanup()
      if (existing.canvas !== activeCanvas) {
        cleanupCanvas(existing.canvas)
      }
    }

    retainedBackUnderlays.push(underlay)
    syncRetainedBackUnderlayVisibility(getActiveSimpleRiveFile(), displayedFileIndex)
  }

  const clearRetainedBackUnderlays = () => {
    for (const underlay of retainedBackUnderlays) {
      underlay.rive.cleanup()
      if (underlay.canvas !== activeCanvas) {
        cleanupCanvas(underlay.canvas)
      }
    }
    retainedBackUnderlays = []
  }

  const getAdjacentDistinctRiveFile = (currentFile: SimpleRiveFile, currentIndex: number, direction: number) => {
    const currentPlaybackKey = getPlaybackKey(currentFile)
    const resolvedCurrentIndex =
      currentIndex >= 0
        ? currentIndex
        : Math.max(
            0,
            files.findIndex((file) => file.url === currentFile.url && getPlaybackKey(file) === currentPlaybackKey),
          )
    const step = direction < 0 ? -1 : 1
    const startIndex = resolvedCurrentIndex + step

    for (let index = startIndex; index >= 0 && index < files.length; index += step) {
      const file = files[index]
      if (!file || getPlaybackKey(file) === currentPlaybackKey) continue

      return {
        file,
        index,
        page: getFirstReaderPageForFile(file, index),
      }
    }

    return null
  }

  const getNextDistinctRiveFile = (currentFile: SimpleRiveFile, currentIndex: number) =>
    getAdjacentDistinctRiveFile(currentFile, currentIndex, 1)

  const getPreviousDistinctRiveFile = (currentFile: SimpleRiveFile, currentIndex: number) =>
    getAdjacentDistinctRiveFile(currentFile, currentIndex, -1)

  function syncRetainedBackUnderlayVisibility(currentFile: SimpleRiveFile | null, currentIndex: number) {
    const previousMatch = currentFile ? getPreviousDistinctRiveFile(currentFile, currentIndex) : null
    const previousPlaybackKey = previousMatch ? getPlaybackKey(previousMatch.file) : null

    for (const underlay of retainedBackUnderlays) {
      const shouldShow =
        previousMatch &&
        underlay.file.url === previousMatch.file.url &&
        underlay.playbackKey === previousPlaybackKey

      underlay.canvas.classList.remove('tribe-simple-active-canvas', 'tribe-simple-loading-canvas')
      underlay.canvas.style.opacity = shouldShow ? '1' : '0'
      underlay.canvas.style.pointerEvents = 'none'
      underlay.canvas.style.zIndex = shouldShow ? '1' : '0'
    }
  }

  const getRuntimeSelectionForFile = (instance: Rive, file: SimpleRiveFile) => {
    const mappedArtboard = file.artboard && file.artboard !== 'auto' ? file.artboard : null
    const mappedStateMachine = file.stateMachine?.trim() || null
    const mappedAnimationName = file.animation?.trim() || null
    const requestedStateMachineForFile =
      mappedStateMachine && mappedStateMachine !== 'auto' ? mappedStateMachine : requestedInteractiveStateMachine
    const requestedAnimationForFile =
      mappedAnimationName && mappedAnimationName !== 'auto' ? mappedAnimationName : requestedInteractiveAnimation
    const shouldAutoSelectStateMachineForFile = mappedStateMachine === 'auto' || shouldAutoSelectStateMachine
    const shouldAutoSelectAnimationForFile = mappedAnimationName === 'auto' || shouldAutoSelectAnimation
    const requestedArtboardForFile = mappedArtboard || requestedInteractiveArtboard
    const shouldUseStateMachineForFile = (isRiveInteractive || shouldUseStateMachineIdleOnly) && Boolean(requestedStateMachineForFile)
    const stateMachineEntry = shouldUseStateMachineForFile
      ? getSimpleRiveStateMachineEntry(
          instance.contents || {},
          file,
          requestedStateMachineForFile,
          shouldAutoSelectStateMachineForFile,
          requestedArtboardForFile,
        )
      : null
    const shouldUseAnimationForFile =
      !shouldDisableTimelineAnimations &&
      !stateMachineEntry &&
      Boolean(requestedAnimationForFile || shouldAutoSelectAnimationForFile)
    const animationEntry = shouldUseAnimationForFile
      ? getSimpleRiveAnimationEntry(
          instance.contents || {},
          file,
          requestedAnimationForFile,
          shouldAutoSelectAnimationForFile,
          requestedArtboardForFile,
        )
      : null

    return {
      requestedArtboardForFile,
      animation: animationEntry?.animation || null,
      animationEntry,
      stateMachine: stateMachineEntry?.stateMachine || null,
      stateMachineEntry,
    }
  }

  const clearPreloadedUnderlay = () => {
    underlayLoadSerial += 1

    if (preloadedUnderlay) {
      preloadedUnderlay.rive.cleanup()
      if (preloadedUnderlay.canvas !== activeCanvas) {
        cleanupCanvas(preloadedUnderlay.canvas)
      }
      preloadedUnderlay = null
    }

    pendingUnderlayRive?.cleanup()
    pendingUnderlayRive = null
    if (pendingUnderlayCanvas) {
      cleanupCanvas(pendingUnderlayCanvas)
    }
    pendingUnderlayCanvas = null
    pendingUnderlayFileUrl = null
    pendingUnderlayPlaybackKey = null
  }

  const startPreloadedUnderlayIdle = (
    instance: Rive,
    file: SimpleRiveFile,
    targetPage: number,
    reason: string,
    requestedArtboard: string | null,
    direction: number,
  ) => {
    const idleEntry = getExactAnimationEntry(instance, pageTurnIdleAnimation, requestedArtboard)
    if (!idleEntry) {
      console.info(`[1Tribe simple overlay] Underlay idle animation "${pageTurnIdleAnimation}" was not found.`, {
        file: file.name,
        requestedArtboard,
        direction,
        availableAnimations: listSimpleRiveAnimations(instance.contents || {}),
      })
      return null
    }

    instance.reset({
      artboard: idleEntry.artboard,
      animations: idleEntry.animation,
      autoplay: false,
      autoBind: runtimeConfig.autoBind,
    })
    instance.resizeDrawingSurfaceToCanvas(getEffectivePixelRatio(frame))
    instance.drawFrame()
    logPageMappingDebug(context, {
      readerPage: targetPage,
      reason,
      matchedFile: file,
      playbackTriggered: false,
      animation: idleEntry.animation,
      artboard: idleEntry.artboard,
      note:
        direction < 0
          ? 'Previous spread preloaded underneath the current spread and was set to the configured idle frame.'
          : 'Next spread preloaded underneath the current spread and was set to the configured idle frame.',
    })
    return idleEntry
  }

  const preloadAdjacentSpreadUnderCurrent = (
    currentFile: SimpleRiveFile,
    currentIndex: number,
    page: number,
    reason: string,
    direction: number,
    force = false,
  ) => {
    if (
      (!shouldPreloadAdjacentUnderlay && !force) ||
      !shouldStackPageFiles ||
      shouldUseSequentialFiles ||
      !rive ||
      !activeCanvas ||
      isDisposed
    ) {
      return
    }

    const adjacentMatch =
      direction < 0
        ? getPreviousDistinctRiveFile(currentFile, currentIndex)
        : getNextDistinctRiveFile(currentFile, currentIndex)
    if (!adjacentMatch) return

    const { file, index } = adjacentMatch
    const playbackKey = getPlaybackKey(file)
    if (preloadedUnderlay?.file.url === file.url && preloadedUnderlay.playbackKey === playbackKey) return
    if (pendingUnderlayFileUrl === file.url && pendingUnderlayPlaybackKey === playbackKey && pendingUnderlayRive) return

    clearPreloadedUnderlay()

    const currentSerial = ++underlayLoadSerial
    const nextCanvas = createRiveCanvas(true)
    nextCanvas.classList.remove('tribe-simple-active-canvas')
    nextCanvas.classList.add('tribe-simple-loading-canvas')
    nextCanvas.style.opacity = direction < 0 ? '1' : '0'
    nextCanvas.style.pointerEvents = 'none'
    nextCanvas.style.zIndex = '1'
    activeCanvas.style.opacity = '1'
    activeCanvas.style.zIndex = '2'

    const targetPage = adjacentMatch.page
    const readerPageLabel = getReaderPageLabelForFile(file)
    const pageRange = file.pages ? `${file.pages[0]}-${file.pages[1]}` : 'all pages'
    const mappedArtboard = file.artboard && file.artboard !== 'auto' ? file.artboard : null
    const adjacentLabel = direction < 0 ? 'previous' : 'next'

    pendingUnderlayCanvas = nextCanvas
    pendingUnderlayFileUrl = file.url
    pendingUnderlayPlaybackKey = playbackKey
    setStatus(`Loading ${adjacentLabel} spread ${file.name} underneath current spread...`)
    logPageMappingDebug(context, {
      readerPage: targetPage,
      reason,
      matchedFile: file,
      playbackTriggered: false,
      artboard: file.artboard || null,
      note: `Preloading ${adjacentLabel} spread underneath current page ${page}.`,
    })

    const instance = new Rive({
      src: file.url,
      canvas: nextCanvas,
      artboard: mappedArtboard || requestedInteractiveArtboard || undefined,
      autoplay: false,
      automaticallyHandleEvents: shouldAutomaticallyHandleRiveEvents,
      autoBind: runtimeConfig.autoBind,
      enableRiveAssetCDN: false,
      shouldDisableRiveListeners: !areRiveListenersEnabled,
      isTouchScrollEnabled: true,
      useOffscreenRenderer: runtimeConfig.useOffscreenRenderer,
      layout: new Layout({
        fit: Fit.Contain,
        alignment: Alignment.Center,
      }),
      onLoad() {
        if (
          isDisposed ||
          currentSerial !== underlayLoadSerial ||
          pendingUnderlayRive !== instance ||
          pendingUnderlayCanvas !== nextCanvas
        ) {
          return
        }

        resizeRive()
        const selection = getRuntimeSelectionForFile(instance, file)
        const idleEntry = startPreloadedUnderlayIdle(
          instance,
          file,
          targetPage,
          `${reason} preload underlay`,
          selection.requestedArtboardForFile,
          direction,
        )
        preloadedUnderlay = {
          file,
          index,
          page: targetPage,
          direction,
          readerPageLabel,
          playbackKey,
          rive: instance,
          canvas: nextCanvas,
          requestedArtboard: selection.requestedArtboardForFile,
          animation: selection.animation,
          animationEntry: selection.animationEntry,
          stateMachine: selection.stateMachine,
          stateMachineEntry: selection.stateMachineEntry,
        }
        pendingUnderlayRive = null
        pendingUnderlayCanvas = null
        pendingUnderlayFileUrl = null
        pendingUnderlayPlaybackKey = null
        nextCanvas.classList.remove('tribe-simple-loading-canvas')
        nextCanvas.style.opacity = direction < 0 ? '1' : '0'
        nextCanvas.style.pointerEvents = 'none'
        nextCanvas.style.zIndex = '1'
        setStatus(`Loaded ${adjacentLabel} spread ${file.name} underneath current spread.`)
        logPageMappingDebug(context, {
          readerPage: targetPage,
          reason,
          matchedFile: file,
          playbackTriggered: Boolean(idleEntry),
          stateMachine: selection.stateMachine,
          animation: idleEntry?.animation || selection.animation,
          artboard: idleEntry?.artboard || selection.stateMachineEntry?.artboard || selection.animationEntry?.artboard || null,
          note:
            direction < 0
              ? 'Previous spread is loaded underneath in idle and waiting for Page_prev to reveal it.'
              : 'Next spread is loaded underneath and waiting for the spread-boundary Page_out.',
        })
        context.analytics.log('1tribe_simple_rive_loaded', {
          bookId: context.data.getBookId(),
          mappedBookId: activeBookId,
          riveBookId: file.bookId,
          page: targetPage,
          file: file.name,
          index,
          pageRange,
          reason: `${reason} preload ${adjacentLabel} underlay`,
          animation: idleEntry?.animation || selection.animation,
          stateMachine: selection.stateMachine,
          artboard: idleEntry?.artboard || selection.stateMachineEntry?.artboard || selection.animationEntry?.artboard || null,
          stackedUnderCurrent: true,
          preloadedUnderlay: true,
          underlayDirection: direction < 0 ? 'previous' : 'next',
        })
      },
      onLoadError(event) {
        if (isDisposed || currentSerial !== underlayLoadSerial) return

        pendingUnderlayRive?.cleanup()
        pendingUnderlayRive = null
        if (pendingUnderlayCanvas) cleanupCanvas(pendingUnderlayCanvas)
        pendingUnderlayCanvas = null
        pendingUnderlayFileUrl = null
        pendingUnderlayPlaybackKey = null
        setStatus(`Failed to preload ${file.name}: ${String(event.data || 'unknown error')}`)
      },
    })

    if (areRiveListenersEnabled) {
      instance.on(EventType.RiveEvent, onSimpleRiveEvent)
      instance.on(EventType.StateChange, onSimpleStateChange)
    }

    pendingUnderlayRive = instance
  }

  const preloadNextSpreadUnderCurrent = (currentFile: SimpleRiveFile, currentIndex: number, page: number, reason: string, force = false) =>
    preloadAdjacentSpreadUnderCurrent(currentFile, currentIndex, page, reason, 1, force)

  const preloadPreviousSpreadUnderCurrent = (currentFile: SimpleRiveFile, currentIndex: number, page: number, reason: string, force = false) =>
    preloadAdjacentSpreadUnderCurrent(currentFile, currentIndex, page, reason, -1, force)

  const preloadPreferredAdjacentSpreadUnderCurrent = (
    currentFile: SimpleRiveFile,
    currentIndex: number,
    page: number,
    reason: string,
  ) => {
    if (getNextDistinctRiveFile(currentFile, currentIndex)) {
      preloadNextSpreadUnderCurrent(currentFile, currentIndex, page, reason)
      return
    }

    preloadPreviousSpreadUnderCurrent(currentFile, currentIndex, page, reason)
  }

  const promotePreloadedUnderlayForPage = (page: number, reason: string): boolean => {
    const targetMatch = getSimpleRiveFileForPage(files, page)
    if (!targetMatch || !preloadedUnderlay) return false
    if (
      preloadedUnderlay.file.url !== targetMatch.file.url ||
      preloadedUnderlay.playbackKey !== getPlaybackKey(targetMatch.file)
    ) {
      return false
    }

    const underlay = preloadedUnderlay
    preloadedUnderlay = null
    underlayLoadSerial += 1

    const previousRive = rive
    const previousCanvas = activeCanvas
    const previousFile = getActiveSimpleRiveFile()
    cleanupInteractionRive()

    rive = underlay.rive
    activeCanvas = underlay.canvas
    activeFileUrl = underlay.file.url
    activePlaybackKey = underlay.playbackKey
    activeAnimation = underlay.animation
    activeAnimationEntry = underlay.animationEntry
    activeStateMachine = underlay.stateMachine
    activeStateMachineEntry = underlay.stateMachineEntry
    displayedFileIndex = underlay.index
    activeSpreadIncomingPageInHandled = true
    syncRetainedBackUnderlayVisibility(underlay.file, underlay.index)
    emitHarnessAvailableAnimations(underlay.rive, underlay.file, page, reason)
    void renderWordHotspotsForFile(underlay.file, page, reason)

    previousCanvas.classList.remove('tribe-simple-active-canvas')
    underlay.canvas.classList.remove('tribe-simple-loading-canvas')
    underlay.canvas.classList.add('tribe-simple-active-canvas')
    underlay.canvas.style.opacity = '1'
    underlay.canvas.style.pointerEvents = isRivePointerCaptureEnabled ? 'auto' : 'none'
    underlay.canvas.style.zIndex = shouldPlaceForwardIncomingOnTop ? '3' : '1'
    previousCanvas.style.opacity = '1'
    previousCanvas.style.zIndex = '2'

    const pageInEntry = playPageTurnAnimation(
      underlay.rive,
      pageTurnInAnimation,
      'page in after page out',
      underlay.requestedArtboard,
    )

    if (pageInEntry) {
      logPageMappingDebug(context, {
        readerPage: page,
        reason,
        matchedFile: underlay.file,
        playbackTriggered: true,
        animation: pageInEntry.animation,
        artboard: pageInEntry.artboard,
        note: shouldPlaceForwardIncomingOnTop
          ? 'Promoted preloaded spread above the outgoing spread and ran Page_in before offloading the outgoing spread.'
          : 'Promoted preloaded underlay and ran Page_in before offloading the outgoing spread.',
      })
      schedulePostPageInRenderPump(underlay.rive, pageInEntry, underlay.file, page, reason)
      if (areRiveListenersEnabled) {
        const pageInteractionEntries = underlay.stateMachineEntry
          ? [underlay.stateMachineEntry]
          : getSimpleRivePageInteractionEntries(underlay.rive.contents || {}, underlay.file, page)
        if (pageInteractionEntries.length) {
          startInteractionStateMachines(underlay.file, pageInteractionEntries, page, reason)
        }
      }
    } else {
      setStatus(`Loaded ${underlay.file.name} for reader page ${page} (mapped ${underlay.readerPageLabel}). Page_in was not found.`)
      logPageMappingDebug(context, {
        readerPage: page,
        reason,
        matchedFile: underlay.file,
        playbackTriggered: false,
        animation: pageTurnInAnimation,
        note: shouldPlaceForwardIncomingOnTop
          ? 'Promoted preloaded spread above the outgoing spread, but Page_in was requested and not found.'
          : 'Promoted preloaded underlay, but Page_in was requested and not found.',
      })
    }

    const offloadRegistered =
      previousRive &&
      registerPageOutUnderlayOffload(previousRive, previousCanvas, underlay.canvas, () => {
        preloadPreferredAdjacentSpreadUnderCurrent(underlay.file, underlay.index, page, `${reason} adjacent underlay`)
      })

    if (!offloadRegistered) {
      window.setTimeout(() => {
        previousRive?.cleanup()
        if (previousCanvas !== activeCanvas) {
          cleanupCanvas(previousCanvas)
        }
        if (activeCanvas === underlay.canvas) {
          underlay.canvas.style.zIndex = '2'
        }
        if (previousFile) {
          context.analytics.log('1tribe_simple_rive_artboard_offloaded', {
            animation: pageTurnForwardOutAnimation,
            artboard: previousFile.artboard || null,
            activeFile: previousFile.name,
            reason: 'Page_out fallback cleanup',
            bookId: context.data.getBookId(),
            page: context.data.getCurrentPage(),
          })
        }
        preloadPreferredAdjacentSpreadUnderCurrent(underlay.file, underlay.index, page, `${reason} adjacent underlay`)
      }, transitionDurationMs + 180)
    }

    return true
  }

  const registerPagePrevUnderlayOffload = (
    outgoingRive: Rive | null,
    outgoingCanvas: HTMLCanvasElement,
    underlayCanvas: HTMLCanvasElement,
    outgoingFile: SimpleRiveFile | null,
    afterOffload?: () => void,
  ): boolean => {
    if (!outgoingRive) return false

    clearPendingPageOutOffload()
    const requestedPageTurnArtboard = outgoingFile?.artboard && outgoingFile.artboard !== 'auto' ? outgoingFile.artboard : null
    const pagePrevEntry = getExactAnimationEntry(outgoingRive, pageTurnBackOutAnimation, requestedPageTurnArtboard)
    const resolvedPagePrevAnimation = pagePrevEntry?.animation || pageTurnBackOutAnimation
    const resolvedPagePrevArtboard = pagePrevEntry?.artboard || requestedPageTurnArtboard || ''
    const pending = {
      instance: outgoingRive,
      animation: resolvedPagePrevAnimation,
      artboard: resolvedPagePrevArtboard,
      activeFile: outgoingFile?.name || null,
      didStop: false,
      offload: null as (() => void) | null,
      afterOffload: afterOffload || null,
      cleanup: () => {},
    }

    pending.offload = () => {
      outgoingRive.cleanup()
      if (outgoingCanvas !== activeCanvas) {
        cleanupCanvas(outgoingCanvas)
      }
      if (activeCanvas === underlayCanvas) {
        underlayCanvas.style.zIndex = '2'
        underlayCanvas.style.pointerEvents = isRivePointerCaptureEnabled ? 'auto' : 'none'
      }
      setStatus(`Offloaded ${pending.activeFile || 'outgoing spread'} after ${pending.animation} completed.`)
    }

    const onStop = (event: RiveRuntimeEvent) => {
      if (pendingPageOutOffload !== pending) return
      const stoppedAnimations = getStoppedAnimationNames(event)
      if (!stoppedAnimations.some((name) => isRiveAnimationNameMatch(name, pending.animation))) return

      pending.didStop = true
      pending.cleanup()
      pending.cleanup = () => {}
      context.analytics.log('1tribe_simple_rive_animation_completed', {
        animation: pending.animation,
        requestedAnimation: pageTurnBackOutAnimation,
        artboard: pending.artboard,
        activeFile: pending.activeFile,
        label: 'page prev',
        bookId: context.data.getBookId(),
        page: context.data.getCurrentPage(),
      })
      runPendingPageOutOffload('Page_prev stop')
    }

    pending.cleanup = () => outgoingRive.off(EventType.Stop, onStop)
    pendingPageOutOffload = pending
    outgoingRive.on(EventType.Stop, onStop)

    window.setTimeout(() => {
      if (pendingPageOutOffload === pending && pending.offload) {
        console.info('[1Tribe simple overlay] Page_prev stop was not observed; offloading by fallback timer.', {
          animation: pending.animation,
          artboard: pending.artboard,
          activeFile: pending.activeFile,
        })
        runPendingPageOutOffload('Page_prev fallback timeout')
      }
    }, transitionDurationMs + 350)

    return true
  }

  const startBackwardRevealUnderlay = (
    underlay: SimpleRiveUnderlay,
    page: number,
    reason: string,
    outgoingFile: SimpleRiveFile | null,
    prepareOnly = false,
  ) => {
    if (shouldDisableTimelineAnimations) return null

    const revealEntry = getExactAnimationEntry(underlay.rive, pageTurnBackOutAnimation, underlay.requestedArtboard)
    if (!revealEntry) {
      startPreloadedUnderlayIdle(
        underlay.rive,
        underlay.file,
        page,
        `${reason} back reveal fallback`,
        underlay.requestedArtboard,
        -1,
      )
      console.info(`[1Tribe simple overlay] Back reveal animation "${pageTurnBackOutAnimation}" was not found on the retained underlay.`, {
        file: underlay.file.name,
        outgoingFile: outgoingFile?.name || null,
        requestedArtboard: underlay.requestedArtboard,
      })
      logPageMappingDebug(context, {
        readerPage: page,
        reason,
        matchedFile: underlay.file,
        playbackTriggered: false,
        animation: pageTurnBackOutAnimation,
        artboard: underlay.requestedArtboard,
        note: `Backward spread boundary: retained underlay had no ${pageTurnBackOutAnimation}; kept it on idle while the outgoing spread runs ${pageTurnBackOutAnimation}.`,
      })
      underlay.backRevealPrepared = true
      return null
    }

    const label = prepareOnly ? 'page back reveal prepare' : 'page back reveal'
    startAnimation(underlay.rive, revealEntry, label)
    scheduleBackPageIdle(underlay.rive, revealEntry, underlay.requestedArtboard)
    context.analytics.log('1tribe_simple_rive_page_turn_animation', {
      animation: revealEntry.animation,
      requestedAnimation: pageTurnBackOutAnimation,
      artboard: revealEntry.artboard,
      label,
      activeFile: underlay.file.name,
      bookId: context.data.getBookId(),
      page: context.data.getCurrentPage(),
    })
    logPageMappingDebug(context, {
      readerPage: page,
      reason,
      matchedFile: underlay.file,
      playbackTriggered: true,
      animation: revealEntry.animation,
      artboard: revealEntry.artboard,
      note: prepareOnly
        ? `Backward spread boundary: prepared retained underlay with ${revealEntry.animation} while it was covered by the active spread.`
        : `Backward spread boundary: ran ${revealEntry.animation} on the retained underlay while ${outgoingFile?.name || 'the outgoing spread'} runs ${pageTurnBackOutAnimation}.`,
    })
    underlay.backRevealPrepared = true
    return revealEntry
  }

  const promotePreloadedBackwardUnderlayForPage = (page: number, reason: string): boolean => {
    const targetMatch = getSimpleRiveFileForPage(files, page)
    if (!targetMatch) return false

    const targetPlaybackKey = getPlaybackKey(targetMatch.file)
    const retainedIndex = getRetainedBackUnderlayIndex(targetMatch.file, targetPlaybackKey)
    const retainedUnderlay = retainedIndex >= 0 ? retainedBackUnderlays[retainedIndex] : null
    const canUsePreloadedUnderlay = Boolean(
      preloadedUnderlay &&
        preloadedUnderlay.direction < 0 &&
        preloadedUnderlay.file.url === targetMatch.file.url &&
        preloadedUnderlay.playbackKey === targetPlaybackKey,
    )
    if (!retainedUnderlay && !canUsePreloadedUnderlay) {
      return false
    }

    const underlay = retainedUnderlay || preloadedUnderlay
    if (!underlay) return false

    if (retainedUnderlay) {
      retainedBackUnderlays.splice(retainedIndex, 1)
    } else {
      preloadedUnderlay = null
    }
    underlayLoadSerial += 1

    const outgoingRive = rive
    const outgoingCanvas = activeCanvas
    const outgoingFile = getActiveSimpleRiveFile()
    cleanupInteractionRive()
    clearBackPageIdle()

    rive = underlay.rive
    activeCanvas = underlay.canvas
    activeFileUrl = underlay.file.url
    activePlaybackKey = underlay.playbackKey
    activeAnimation = underlay.animation
    activeAnimationEntry = underlay.animationEntry
    activeStateMachine = underlay.stateMachine
    activeStateMachineEntry = underlay.stateMachineEntry
    displayedFileIndex = underlay.index
    activeSpreadIncomingPageInHandled = true
    syncRetainedBackUnderlayVisibility(underlay.file, underlay.index)
    emitHarnessAvailableAnimations(underlay.rive, underlay.file, page, reason)
    void renderWordHotspotsForFile(underlay.file, page, reason)

    outgoingCanvas.classList.remove('tribe-simple-active-canvas')
    underlay.canvas.classList.remove('tribe-simple-loading-canvas')
    underlay.canvas.classList.add('tribe-simple-active-canvas')
    underlay.canvas.style.opacity = '1'
    underlay.canvas.style.pointerEvents = 'none'
    underlay.canvas.style.zIndex = '1'
    outgoingCanvas.style.opacity = '1'
    outgoingCanvas.style.zIndex = '2'
    const revealEntry = underlay.backRevealPrepared
      ? null
      : startBackwardRevealUnderlay(underlay, page, reason, outgoingFile)

    setStatus(`Revealing ${underlay.file.name} underneath ${outgoingFile?.name || 'current spread'} with ${pageTurnBackOutAnimation}.`)
    logPageMappingDebug(context, {
      readerPage: page,
      reason,
      matchedFile: underlay.file,
      playbackTriggered: Boolean(revealEntry || underlay.backRevealPrepared),
      animation: revealEntry?.animation || pageTurnIdleAnimation,
      artboard: revealEntry?.artboard || underlay.requestedArtboard,
      note: revealEntry
        ? `Backward spread boundary: previous spread was already loaded underneath; ${revealEntry.animation} on the underlay restores it while ${pageTurnBackOutAnimation} on the outgoing spread reveals it.`
        : underlay.backRevealPrepared
          ? `Backward spread boundary: previous spread was already restored underneath; ${pageTurnBackOutAnimation} on the outgoing spread reveals it.`
        : `Backward spread boundary: previous spread was already loaded underneath in idle; ${pageTurnBackOutAnimation} on the outgoing spread reveals it.`,
    })

    const offloadRegistered = registerPagePrevUnderlayOffload(
      outgoingRive,
      outgoingCanvas,
      underlay.canvas,
      outgoingFile,
    )

    if (!offloadRegistered) {
      window.setTimeout(() => {
        outgoingRive?.cleanup()
        if (outgoingCanvas !== activeCanvas) {
          cleanupCanvas(outgoingCanvas)
        }
        if (activeCanvas === underlay.canvas) {
          underlay.canvas.style.zIndex = '2'
          underlay.canvas.style.pointerEvents = isRivePointerCaptureEnabled ? 'auto' : 'none'
        }
      }, transitionDurationMs + 180)
    }

    return true
  }

  const hideCompletionPage = () => {
    completionPage.hidden = true
  }

  const destroyRive = () => {
    hideManualStart()
    clearStateMachineControls()
    clearWordHotspots()
    disableRivePointerCapture()
    clearPostPageInRenderPump()
    clearBackPageIdle()
    clearPendingPageOutOffload()
    cleanupInteractionRive()
    clearRetainedBackUnderlays()
    clearPreloadedUnderlay()
    rive?.cleanup()
    rive = null
    pendingRive?.cleanup()
    pendingRive = null
    pendingFileUrl = null
    pendingPlaybackKey = null
    activeAnimation = null
    activeAnimationEntry = null
    activeStateMachine = null
    activeStateMachineEntry = null
    activePlaybackKey = null
    activeSpreadIncomingPageInHandled = false
    pendingIncomingPageTurnAnimation = null
    pendingOutgoingPageTurnAnimation = null
    clearFrameBackdropSnapshot()

    for (const riveCanvas of Array.from(frame.querySelectorAll<HTMLCanvasElement>('.tribe-simple-rive-canvas'))) {
      cleanupCanvas(riveCanvas)
    }

    activeCanvas = createRiveCanvas()
    pendingCanvas = null
    activeFileUrl = null
  }

  const showCompletionPage = (page: number, lastRivePage: number) => {
    destroyRive()
    resizeRive()
    frame.hidden = false
    completionPage.hidden = false
    setStatus(`Showing Epic completion page after Rive page ${lastRivePage}.`)
    context.analytics.log('1tribe_simple_completion_page_shown', {
      bookId: context.data.getBookId(),
      page,
      lastRivePage,
    })
  }

  const shouldShowCompletionForPage = (page: number): boolean => {
    if (!shouldShowCompletionPage) return false

    const lastRivePage = getSimpleRiveLastPage(files)
    if (lastRivePage === null || page <= lastRivePage) return false

    showCompletionPage(page, lastRivePage)
    return true
  }

  const showNoFileForPage = (page: number) => {
    destroyRive()
    resizeRive()
    frame.hidden = false
    hideCompletionPage()
    setStatus(`No Rive file mapped to Epic page ${page}.`)
  }

  const getSequentialPageForIndex = (index: number): number => files[index]?.readerPages?.[0] ?? files[index]?.pages?.[0] ?? index
  const getNavigationLoadDelay = (delay: number) =>
    shouldUseTransitionFiles && !shouldStackTransitionPages ? Math.max(delay, transitionDurationMs) : delay

  const loadSequentialFileIndex = (index: number, reason: string) => {
    const file = files[index]
    if (!file?.pages) {
      setStatus(`No Rive file available at sequence item ${index + 1}.`)
      return
    }

    displayedFileIndex = index
    displayedPage = getSequentialPageForIndex(index)
    loadFileForPage(displayedPage, `${reason} item ${index + 1}/${files.length}`)
  }

  const moveSequentialFile = (direction: number, reason: string, delay = pageSwapDelayMs, shouldStartTransition = true) => {
    if (!files.length) return
    const effectiveDelay = getNavigationLoadDelay(delay)

    const currentIndex =
      displayedFileIndex >= 0
        ? displayedFileIndex
        : Math.max(
            0,
            files.findIndex((file) => file.url === activeFileUrl),
          )
    const nextIndex = currentIndex + (direction < 0 ? -1 : 1)

    if (shouldStartTransition) {
      startPageFlip(direction)
    }
    clearPendingNavigation()

    if (nextIndex < 0) {
      displayedFileIndex = 0
      displayedPage = getSequentialPageForIndex(0)
      scheduleFileForPage(displayedPage, `${reason} first file`, effectiveDelay)
      return
    }

    if (nextIndex >= files.length) {
      const lastFile = files[files.length - 1]
      const lastPage = lastFile?.readerPages?.[lastFile.readerPages.length - 1] ?? lastFile?.pages?.[1] ?? getSequentialPageForIndex(files.length - 1)
      displayedFileIndex = files.length
      displayedPage = lastPage + 1
      if (shouldShowCompletionPage) {
        window.setTimeout(() => showCompletionPage(displayedPage, lastPage), effectiveDelay)
      } else {
        window.setTimeout(() => showNoFileForPage(displayedPage), effectiveDelay)
      }
      return
    }

    if (effectiveDelay <= 0) {
      loadSequentialFileIndex(nextIndex, reason)
      return
    }

    setStatus(`Waiting before loading sequence item ${nextIndex + 1}/${files.length}...`)
    if (pageLoadTimer !== null) window.clearTimeout(pageLoadTimer)
    pageLoadTimer = window.setTimeout(() => {
      pageLoadTimer = null
      loadSequentialFileIndex(nextIndex, reason)
    }, effectiveDelay)
  }

  sequentialBackButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    moveSequentialFile(-1, '1Tribe back control', 0)
  })

  sequentialNextButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    moveSequentialFile(1, '1Tribe next control', 0)
  })

  const loadFileForPage = (page: number, reason: string, options: SimpleRiveLoadOptions = {}) => {
    if (isDisposed || !files.length) return

    if (!runtimeConfig.load) {
      frame.hidden = false
      hideCompletionPage()
      setStatus('Rive loading is paused. Add riveLoad=1 when the overlay itself is stable.')
      logPageMappingDebug(context, {
        readerPage: page,
        reason,
        matchedFile: getSimpleRiveFileForPage(files, page)?.file || null,
        playbackTriggered: false,
        note: 'Rive loading disabled by riveLoad=0.',
      })
      return
    }

    const match = getSimpleRiveFileForPage(files, page)
    if (!match) {
      logPageMappingDebug(context, {
        readerPage: page,
        reason,
        matchedFile: null,
        playbackTriggered: false,
        note: 'No explicit reader-page or spread-range mapping matched.',
      })
      if (shouldShowCompletionForPage(page)) return

      showNoFileForPage(page)
      return
    }

    hideCompletionPage()

    const { file, index } = match
    const pageRange = file.pages ? `${file.pages[0]}-${file.pages[1]}` : 'all pages'
    const readerPageLabel = file.readerPages?.length ? file.readerPages.join(',') : pageRange
    const playbackKey = getPlaybackKey(file)
    const shouldSuppressIncomingPlayback = isBackwardPageTurnReason(reason) && !shouldUseStateMachinePageActions
    const outgoingFileForStackedPagePrev = options.pagePrevUnderCurrent ? getActiveSimpleRiveFile() : null
    displayedFileIndex = index

    frame.hidden = false
    disableRivePointerCapture()
    resizeRive()

    if (activeFileUrl === file.url && activePlaybackKey === playbackKey && rive) {
      if (shouldSuppressIncomingPlayback) {
        setStatus(
          `Loaded ${file.name} for reader page ${page} (mapped ${readerPageLabel}). Backward page turn already ran ${pageTurnBackOutAnimation} on the outgoing page.`,
        )
        logPageMappingDebug(context, {
          readerPage: page,
          reason,
          matchedFile: file,
          playbackTriggered: false,
          animation: activeAnimation,
          stateMachine: activeStateMachine,
          artboard: activeStateMachineEntry?.artboard || null,
          note: 'Backward page turn: reused loaded file without starting incoming playback.',
        })
      } else if (shouldUseSpreadTransitionAnimations && isForwardPageTurnReason(reason)) {
        const requestedPageTurnArtboard = file.artboard && file.artboard !== 'auto' ? file.artboard : null
        if (activeSpreadIncomingPageInHandled) {
          const didStartIdle = startCurrentPageIdle(
            rive,
            file,
            page,
            reason,
            requestedPageTurnArtboard,
            'Same spread page advance: current spread already handled Page_in, so started configured idle animation.',
          )
          if (!didStartIdle) {
            setStatus(
              `Loaded ${file.name} for reader page ${page} (mapped ${readerPageLabel}). Page_in already ran for this spread.`,
            )
          }
        } else {
          activeSpreadIncomingPageInHandled = true
          const pageInEntry = playPageTurnAnimation(rive, pageTurnInAnimation, 'same-spread page in', requestedPageTurnArtboard)

          if (pageInEntry) {
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: true,
              animation: pageInEntry.animation,
              artboard: pageInEntry.artboard,
              note: 'Same spread page advance: ran Page_in without loading a new Rive file.',
            })
            schedulePostPageInRenderPump(rive, pageInEntry, file, page, reason)
          } else {
            setStatus(`Loaded ${file.name} for reader page ${page} (mapped ${readerPageLabel}). Page_in was not found.`)
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: false,
              animation: pageTurnInAnimation,
              note: 'Same spread page advance: Page_in was requested but not found.',
            })
          }
        }
      } else if (runtimeConfig.autoplay) {
        rive.play(activeStateMachine || activeAnimation || undefined)
        setStatus(`Playing ${file.name} for reader page ${page} (mapped ${readerPageLabel}).`)
        logPageMappingDebug(context, {
          readerPage: page,
          reason,
          matchedFile: file,
          playbackTriggered: true,
          animation: activeAnimation,
          stateMachine: activeStateMachine,
          artboard: activeStateMachineEntry?.artboard || null,
          note: 'Reused already-loaded Rive file and resumed playback.',
        })
      } else {
        if (activeStateMachine) {
          showManualStart(file.name, activeStateMachine)
          logPageMappingDebug(context, {
            readerPage: page,
            reason,
            matchedFile: file,
            playbackTriggered: false,
            animation: activeAnimation,
            stateMachine: activeStateMachine,
            artboard: activeStateMachineEntry?.artboard || null,
            note: 'Rive file already loaded; manual start is available.',
          })
        } else if (activeAnimation) {
          showManualStart(file.name, activeAnimation)
          logPageMappingDebug(context, {
            readerPage: page,
            reason,
            matchedFile: file,
            playbackTriggered: false,
            animation: activeAnimation,
            artboard: activeAnimationEntry?.artboard || null,
            note: 'Rive file already loaded; manual animation start is available.',
          })
        } else {
          setStatus(`Loaded ${file.name} for reader page ${page} (mapped ${readerPageLabel}). Playback is paused.`)
          logPageMappingDebug(context, {
            readerPage: page,
            reason,
            matchedFile: file,
            playbackTriggered: false,
            note: 'Rive file already loaded; playback is paused.',
          })
        }
      }
      if (activeStateMachineEntry) {
        renderStateMachineControls(rive, activeStateMachineEntry)
      } else {
        clearStateMachineControls()
      }
      void renderWordHotspotsForFile(file, page, reason)
      preloadPreferredAdjacentSpreadUnderCurrent(file, index, page, reason)
      return
    }

    if (pendingFileUrl === file.url && pendingPlaybackKey === playbackKey && pendingRive) {
      setStatus(`Finishing load for ${file.name} on reader page ${page} (mapped ${readerPageLabel}).`)
      logPageMappingDebug(context, {
        readerPage: page,
        reason,
        matchedFile: file,
        playbackTriggered: false,
        note: 'Matched file is already pending load.',
      })
      return
    }

    const matchedPreloadedUnderlay =
      preloadedUnderlay?.file.url === file.url && preloadedUnderlay.playbackKey === playbackKey
    if (
      matchedPreloadedUnderlay &&
      options.stackUnderCurrent &&
      promotePreloadedUnderlayForPage(page, reason)
    ) {
      return
    }
    clearPreloadedUnderlay()

    if (shouldUseFocusedDirectReplacement && rive && activeFileUrl !== file.url) {
      const outgoingRive = rive
      const outgoingCanvas = activeCanvas
      clearPostPageInRenderPump()
      clearBackPageIdle()
      clearPendingPageOutOffload()
      cleanupInteractionRive()
      rive = null
      activeFileUrl = null
      activePlaybackKey = null
      activeAnimation = null
      activeAnimationEntry = null
      activeStateMachine = null
      activeStateMachineEntry = null
      activeSpreadIncomingPageInHandled = false
      outgoingRive.cleanup()
      cleanupCanvas(outgoingCanvas)
    }

    const shouldStackWithCurrent = Boolean(options.stackUnderCurrent && shouldStackPageFiles && rive)
    const shouldStackOverCurrent = shouldStackWithCurrent && !options.pagePrevUnderCurrent && shouldPlaceForwardIncomingOnTop
    const shouldStackUnderCurrent = shouldStackWithCurrent && !shouldStackOverCurrent
    const currentSerial = ++loadSerial
    const nextCanvas = createRiveCanvas(true)
    if (shouldStackUnderCurrent) {
      nextCanvas.style.zIndex = '1'
    } else if (shouldStackOverCurrent) {
      nextCanvas.style.zIndex = '3'
    }

    hideManualStart()
    cleanupInteractionRive()
    pendingRive?.cleanup()
    pendingCanvas?.remove()
    pendingRive = null
    pendingCanvas = nextCanvas
    pendingFileUrl = file.url
    pendingPlaybackKey = playbackKey
    setStatus(`Loading ${file.name} for reader page ${page} (mapped ${readerPageLabel})...`)
    logPageMappingDebug(context, {
      readerPage: page,
      reason,
      matchedFile: file,
      playbackTriggered: false,
      stateMachine: file.stateMachine || null,
      artboard: file.artboard || null,
      note: 'Matched file; starting async Rive load.',
    })

    const mappedArtboard = file.artboard && file.artboard !== 'auto' ? file.artboard : null
    const mappedAnimation = file.animation && file.animation !== 'auto' ? file.animation : null
    const initialAnimation =
      mappedAnimation ||
      (requestedInteractiveAnimation && requestedInteractiveAnimation !== 'auto' ? requestedInteractiveAnimation : null)
    const pendingIncomingPageTurnAtLoad =
      !shouldSuppressIncomingPlayback &&
      shouldUseSpreadTransitionAnimations &&
      pendingIncomingPageTurnAnimation &&
      !/^initial\b/i.test(reason)
        ? pendingIncomingPageTurnAnimation
        : null
    const startupAnimation = pendingIncomingPageTurnAtLoad?.animation || initialAnimation
    const startupAutoplay = !shouldSuppressIncomingPlayback && (Boolean(pendingIncomingPageTurnAtLoad) || runtimeConfig.autoplay)
    const shouldRequestLoadIdleAtStartup = Boolean(
      !shouldDisableTimelineAnimations &&
        shouldStartIdleOnLoad &&
        !runtimeConfig.autoplay &&
        !shouldSuppressIncomingPlayback &&
        !shouldInspectRiveContents &&
        !pendingIncomingPageTurnAtLoad &&
        !options.stackUnderCurrent &&
        !initialAnimation,
    )
    const instance = new Rive({
      src: file.url,
      canvas: nextCanvas,
      artboard: mappedArtboard || requestedInteractiveArtboard || undefined,
      animations: startupAnimation || undefined,
      autoplay: startupAutoplay,
      automaticallyHandleEvents: shouldAutomaticallyHandleRiveEvents,
      autoBind: runtimeConfig.autoBind,
      enableRiveAssetCDN: false,
      shouldDisableRiveListeners: !areRiveListenersEnabled,
      isTouchScrollEnabled: true,
      useOffscreenRenderer: runtimeConfig.useOffscreenRenderer,
      layout: new Layout({
        fit: Fit.Contain,
        alignment: Alignment.Center,
      }),
      onLoad() {
        if (isDisposed || currentSerial !== loadSerial || pendingRive !== instance || pendingCanvas !== nextCanvas) {
          return
        }

        resizeRive()
        const mappedStateMachine = file.stateMachine?.trim() || null
        const mappedAnimationName = file.animation?.trim() || null
        const requestedStateMachineForFile =
          mappedStateMachine && mappedStateMachine !== 'auto' ? mappedStateMachine : requestedInteractiveStateMachine
        const requestedAnimationForFile =
          mappedAnimationName && mappedAnimationName !== 'auto' ? mappedAnimationName : requestedInteractiveAnimation
        const shouldAutoSelectStateMachineForFile = mappedStateMachine === 'auto' || shouldAutoSelectStateMachine
        const shouldAutoSelectAnimationForFile = mappedAnimationName === 'auto' || shouldAutoSelectAnimation
        const requestedArtboardForFile = mappedArtboard || requestedInteractiveArtboard
        const shouldUseStateMachineForFile = (isRiveInteractive || shouldUseStateMachineIdleOnly) && Boolean(requestedStateMachineForFile)
        const stateMachineEntry = shouldUseStateMachineForFile
          ? getSimpleRiveStateMachineEntry(
              instance.contents || {},
              file,
              requestedStateMachineForFile,
              shouldAutoSelectStateMachineForFile,
              requestedArtboardForFile,
            )
          : null
        const stateMachine = stateMachineEntry?.stateMachine || null
        const shouldUseAnimationForFile =
          !shouldDisableTimelineAnimations &&
          !stateMachineEntry &&
          Boolean(requestedAnimationForFile || shouldAutoSelectAnimationForFile)
        const animationEntry = shouldUseAnimationForFile
          ? getSimpleRiveAnimationEntry(
              instance.contents || {},
              file,
              requestedAnimationForFile,
              shouldAutoSelectAnimationForFile,
              requestedArtboardForFile,
            )
          : null
        const animation = animationEntry?.animation || null
    const incomingPageTurnAnimation =
      shouldUseSpreadTransitionAnimations && !shouldSuppressIncomingPlayback
        ? takeIncomingPageTurnAnimation(reason)
        : null
        const incomingPageTurnAnimationEntry = incomingPageTurnAnimation
          ? getExactAnimationEntry(instance, incomingPageTurnAnimation.animation, requestedArtboardForFile)
          : null
        const loadIdleEntry =
          !runtimeConfig.autoplay &&
          !shouldSuppressIncomingPlayback &&
          !shouldInspectRiveContents &&
          !incomingPageTurnAnimationEntry &&
          shouldRequestLoadIdleAtStartup
            ? getExactAnimationEntry(instance, pageTurnIdleAnimation, requestedArtboardForFile)
            : null
        const shouldStartIdleOnVisibleLoad = Boolean(loadIdleEntry)
        if (incomingPageTurnAnimation && !incomingPageTurnAnimationEntry) {
          console.info(`[1Tribe simple overlay] Incoming page-turn animation "${incomingPageTurnAnimation.animation}" was not found.`, {
            file: file.name,
            requestedArtboard: requestedArtboardForFile,
            availableAnimations: listSimpleRiveAnimations(instance.contents || {}),
          })
        }
        const outgoingBackUnderlayFile = getActiveSimpleRiveFile()
        const outgoingBackUnderlayPlaybackKey = activePlaybackKey
        const outgoingBackUnderlayAnimation = activeAnimation
        const outgoingBackUnderlayAnimationEntry = activeAnimationEntry
        const outgoingBackUnderlayStateMachine = activeStateMachine
        const outgoingBackUnderlayStateMachineEntry = activeStateMachineEntry
        const outgoingBackUnderlayIndex = outgoingBackUnderlayFile
          ? files.findIndex(
              (candidate) =>
                candidate.url === outgoingBackUnderlayFile.url &&
                getPlaybackKey(candidate) === outgoingBackUnderlayPlaybackKey,
            )
          : -1
        const outgoingBackUnderlayPage =
          outgoingBackUnderlayFile?.readerPages?.[0] ?? outgoingBackUnderlayFile?.pages?.[0] ?? page
        activeAnimation = animation
        activeAnimationEntry = animationEntry
        activeStateMachine = stateMachine
        activeStateMachineEntry = stateMachineEntry
        activeSpreadIncomingPageInHandled = false
        const shouldStartStateMachineAfterSwap = Boolean(
          stateMachineEntry &&
            !shouldSuppressIncomingPlayback &&
            !runtimeConfig.autoplay &&
            !shouldInspectRiveContents &&
            !shouldStartIdleOnVisibleLoad &&
            shouldStartStateMachineForReason(reason),
        )
        const shouldStartAnimationAfterSwap = Boolean(
          animationEntry &&
            !shouldSuppressIncomingPlayback &&
            !runtimeConfig.autoplay &&
            !shouldInspectRiveContents &&
            !shouldStartIdleOnVisibleLoad &&
            shouldStartStateMachineForReason(reason),
        )
        const shouldDeferStateMachineStart = Boolean(
          stateMachineEntry &&
            (shouldSuppressIncomingPlayback ||
              (shouldOfferManualStart &&
                !runtimeConfig.autoplay &&
                !shouldStartStateMachineAfterSwap)),
        )
        const shouldDeferAnimationStart = Boolean(
          animationEntry &&
            (shouldSuppressIncomingPlayback ||
              (shouldOfferManualStart &&
                !runtimeConfig.autoplay &&
                !shouldStartAnimationAfterSwap)),
        )
        if (shouldInspectRiveContents) {
          console.info(`[1Tribe simple overlay] Rive contents for ${file.name}`, instance.contents || {})
          setStatus(
            `Loaded ${file.name}. Animations: ${listSimpleRiveAnimations(instance.contents || {})}. State machines: ${listSimpleRiveStateMachines(instance.contents || {})}.`,
          )
        }
        if (stateMachineEntry) {
          if (!shouldInspectRiveContents && !shouldDeferStateMachineStart && !shouldStartStateMachineAfterSwap) {
            const resolvedStateMachineEntry = getResolvedStateMachineEntry(instance, stateMachineEntry)
            instance.resizeDrawingSurfaceToCanvas(getEffectivePixelRatio(frame))
            instance.play(resolvedStateMachineEntry.stateMachine)
            const runtimeSummary = getStateMachineRuntimeSummary(instance, resolvedStateMachineEntry)
            console.info(`[1Tribe simple overlay] Running state machine "${resolvedStateMachineEntry.stateMachine}" without reset.`, {
              file: file.name,
              artboard: resolvedStateMachineEntry.artboard,
              runtimeSummary,
            })
            setStatus(`Running ${resolvedStateMachineEntry.artboard} / ${resolvedStateMachineEntry.stateMachine}. ${runtimeSummary}`)
          } else if (shouldStartStateMachineAfterSwap) {
            console.info(`[1Tribe simple overlay] Will start state machine "${stateMachineEntry.stateMachine}" after page turn`, {
              file: file.name,
              artboard: stateMachineEntry.artboard,
              reason,
            })
          } else if (shouldDeferStateMachineStart) {
            console.info(`[1Tribe simple overlay] Selected state machine "${stateMachineEntry.stateMachine}"`, {
              file: file.name,
              artboard: stateMachineEntry.artboard,
            })
          }
        } else if (animationEntry) {
          if (!shouldInspectRiveContents && !shouldDeferAnimationStart && !shouldStartAnimationAfterSwap) {
            instance.resizeDrawingSurfaceToCanvas(getEffectivePixelRatio(frame))
            instance.play(animationEntry.animation)
            console.info(`[1Tribe simple overlay] Running animation "${animationEntry.animation}" without reset.`, {
              file: file.name,
              artboard: animationEntry.artboard,
            })
            setStatus(`Running ${animationEntry.artboard} / ${animationEntry.animation}.`)
          } else if (shouldStartAnimationAfterSwap) {
            console.info(`[1Tribe simple overlay] Will start animation "${animationEntry.animation}" after page turn`, {
              file: file.name,
              artboard: animationEntry.artboard,
              reason,
            })
          } else if (shouldDeferAnimationStart) {
            console.info(`[1Tribe simple overlay] Selected animation "${animationEntry.animation}"`, {
              file: file.name,
              artboard: animationEntry.artboard,
            })
          }
        } else if (isRiveInteractive && requestedStateMachineForFile && shouldAutoSelectStateMachineForFile) {
          console.warn(
            `[1Tribe simple overlay] Interactive auto mode could not find a state machine in ${file.name}.`,
            listSimpleRiveStateMachines(instance.contents || {}),
          )
        } else if (isRiveInteractive && requestedStateMachineForFile) {
          console.warn(
            `[1Tribe simple overlay] State machine "${requestedStateMachineForFile}" was not found in ${file.name}.`,
            listSimpleRiveStateMachines(instance.contents || {}),
          )
        } else if (isRiveInteractive) {
          console.warn(
            `[1Tribe simple overlay] Interactive mode needs a riveStateMachine query param. Available state machines in ${file.name}:`,
            listSimpleRiveStateMachines(instance.contents || {}),
          )
        } else if (requestedAnimationForFile && shouldAutoSelectAnimationForFile) {
          console.warn(
            `[1Tribe simple overlay] Animation auto mode could not find an animation in ${file.name}.`,
            listSimpleRiveAnimations(instance.contents || {}),
          )
        } else if (requestedAnimationForFile) {
          console.warn(
            `[1Tribe simple overlay] Animation "${requestedAnimationForFile}" was not found in ${file.name}.`,
            listSimpleRiveAnimations(instance.contents || {}),
          )
        }
        if (
          runtimeConfig.autoplay &&
          !shouldSuppressIncomingPlayback &&
          !shouldInspectRiveContents &&
          !shouldDeferStateMachineStart &&
          !shouldDeferAnimationStart
        ) {
          instance.play(stateMachine || animation || undefined)
        }
        const previousRive = rive
        const previousCanvas = activeCanvas
        const shouldStartIncomingPageTurnImmediately = Boolean(incomingPageTurnAnimationEntry && !shouldInspectRiveContents)
        const shouldKeepLoadedFileUnderCurrent = Boolean(
          shouldStackUnderCurrent && previousRive && previousCanvas !== nextCanvas && !shouldStartIncomingPageTurnImmediately,
        )
        const shouldKeepLoadedFileOverCurrent = Boolean(
          shouldStackOverCurrent && previousRive && previousCanvas !== nextCanvas && !shouldStartIncomingPageTurnImmediately,
        )
        const shouldKeepLoadedFileLayeredWithCurrent =
          shouldKeepLoadedFileUnderCurrent || shouldKeepLoadedFileOverCurrent
        const outgoingPageTurnAtLoad = shouldStartIncomingPageTurnImmediately
          ? pendingOutgoingPageTurnAnimation
          : null

        if (outgoingPageTurnAtLoad) {
          console.info(
            `[1Tribe simple overlay] Starting deferred outgoing page-turn "${outgoingPageTurnAtLoad.animation}".`,
            {
              file: file.name,
              page,
              reason,
            },
          )
          playActivePageTurnAnimation(outgoingPageTurnAtLoad.animation, outgoingPageTurnAtLoad.label)
          pendingOutgoingPageTurnAnimation = null
        } else if (!shouldStartIncomingPageTurnImmediately && !options.pagePrevUnderCurrent) {
          pendingOutgoingPageTurnAnimation = null
        }

        rive = instance
        activeCanvas = nextCanvas
        activeFileUrl = file.url
        activePlaybackKey = playbackKey
        pendingRive = null
        pendingCanvas = null
        pendingFileUrl = null
        pendingPlaybackKey = null
        void renderWordHotspotsForFile(file, page, reason)

        previousCanvas.classList.remove('tribe-simple-active-canvas')
        nextCanvas.classList.remove('tribe-simple-loading-canvas')
        nextCanvas.classList.add('tribe-simple-active-canvas')
        nextCanvas.style.opacity = '1'
        nextCanvas.style.pointerEvents = isRivePointerCaptureEnabled ? 'auto' : 'none'
        nextCanvas.style.zIndex = shouldKeepLoadedFileOverCurrent ? '3' : shouldKeepLoadedFileUnderCurrent ? '1' : '2'
        previousCanvas.style.opacity = shouldStartIncomingPageTurnImmediately || shouldKeepLoadedFileLayeredWithCurrent ? '1' : '0'
        previousCanvas.style.zIndex = shouldKeepLoadedFileLayeredWithCurrent ? '2' : '1'

        if (options.pagePrevUnderCurrent && shouldKeepLoadedFileUnderCurrent && !shouldInspectRiveContents) {
          startPreloadedUnderlayIdle(
            instance,
            file,
            page,
            `${reason} page prev underlay`,
            requestedArtboardForFile,
            -1,
          )
        }

        if (loadIdleEntry && !shouldStartIncomingPageTurnImmediately && !shouldKeepLoadedFileLayeredWithCurrent) {
          const loadIdleLabel = /^initial\b/i.test(reason) ? 'initial load idle' : 'load idle'
          startAnimation(instance, loadIdleEntry, loadIdleLabel)
          logPageMappingDebug(context, {
            readerPage: page,
            reason,
            matchedFile: file,
            playbackTriggered: true,
            animation: loadIdleEntry.animation,
            artboard: loadIdleEntry.artboard,
            note: 'Visible Rive file loaded; started configured idle animation.',
          })
        }

        const startStackedPagePrevOverUnderlay = () => {
          if (!previousRive || !previousCanvas || isDisposed || rive !== instance || activeCanvas !== nextCanvas) return false

          const outgoingFile = outgoingFileForStackedPagePrev
          const requestedPageTurnArtboard =
            outgoingFile?.artboard && outgoingFile.artboard !== 'auto' ? outgoingFile.artboard : null
          const requestedPagePrevAnimation = pendingOutgoingPageTurnAnimation?.animation || pageTurnBackOutAnimation
          const pagePrevLabel = pendingOutgoingPageTurnAnimation?.label || 'page go back'
          const pagePrevEntry = getExactAnimationEntry(previousRive, requestedPagePrevAnimation, requestedPageTurnArtboard)

          if (!pagePrevEntry) {
            pendingOutgoingPageTurnAnimation = null
            setStatus(
              `Loaded ${file.name} underneath ${outgoingFile?.name || 'current spread'}, but ${requestedPagePrevAnimation} was not found.`,
            )
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: false,
              animation: requestedPagePrevAnimation,
              artboard: requestedPageTurnArtboard,
              note: 'Backward spread boundary: previous spread loaded underneath, but the outgoing Page_prev animation was not found.',
            })
            return false
          }

          activeSpreadIncomingPageInHandled = true
          const offloadRegistered = registerPagePrevUnderlayOffload(
            previousRive,
            previousCanvas,
            nextCanvas,
            outgoingFile,
          )

          startAnimation(previousRive, pagePrevEntry, pagePrevLabel)
          markSimpleRivePageTurnBusy(pagePrevLabel)
          pendingOutgoingPageTurnAnimation = null
          context.analytics.log('1tribe_simple_rive_page_turn_animation', {
            animation: pagePrevEntry.animation,
            requestedAnimation: requestedPagePrevAnimation,
            artboard: pagePrevEntry.artboard,
            label: pagePrevLabel,
            activeFile: outgoingFile?.name || null,
            bookId: context.data.getBookId(),
            page: context.data.getCurrentPage(),
          })
          logPageMappingDebug(context, {
            readerPage: page,
            reason,
            matchedFile: file,
            playbackTriggered: true,
            animation: pagePrevEntry.animation,
            artboard: pagePrevEntry.artboard,
            note: `Backward spread boundary: loaded ${file.name} underneath and ran ${pagePrevEntry.animation} on ${outgoingFile?.name || 'the outgoing spread'}.`,
          })

          if (!offloadRegistered) {
            window.setTimeout(() => {
              previousRive.cleanup()
              if (previousCanvas !== activeCanvas) {
                cleanupCanvas(previousCanvas)
              }
              if (activeCanvas === nextCanvas) {
                nextCanvas.style.zIndex = '2'
                nextCanvas.style.pointerEvents = isRivePointerCaptureEnabled ? 'auto' : 'none'
              }
            }, transitionDurationMs + 180)
          }

          return true
        }

        const startStackedPageInUnderOutgoing = () => {
          if (isDisposed || rive !== instance || activeCanvas !== nextCanvas) return

          activeSpreadIncomingPageInHandled = true
          const pageInEntry = playPageTurnAnimation(
            instance,
            pageTurnInAnimation,
            'page in after page out',
            requestedArtboardForFile,
          )

          if (!pageInEntry) {
            setStatus(`Loaded ${file.name} for reader page ${page} (mapped ${readerPageLabel}). Page_in was not found.`)
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: false,
              animation: pageTurnInAnimation,
              note: shouldKeepLoadedFileOverCurrent
                ? 'Stacked forward spread: Page_in was requested above the outgoing spread but was not found.'
                : 'Stacked forward spread: Page_in was requested under the outgoing spread but was not found.',
            })
            return
          }

          logPageMappingDebug(context, {
            readerPage: page,
            reason,
            matchedFile: file,
            playbackTriggered: true,
            animation: pageInEntry.animation,
            artboard: pageInEntry.artboard,
            note: shouldKeepLoadedFileOverCurrent
              ? 'Stacked forward spread: ran Page_in on the newly loaded Rive file above the outgoing spread before Page_out offloads the previous artboard.'
              : 'Stacked forward spread: ran Page_in on the newly loaded Rive file before Page_out offloads the previous artboard.',
          })
          schedulePostPageInRenderPump(instance, pageInEntry, file, page, reason)
          if (areRiveListenersEnabled) {
            const pageInteractionEntries = stateMachineEntry
              ? [stateMachineEntry]
              : getSimpleRivePageInteractionEntries(instance.contents || {}, file, page)
            if (pageInteractionEntries.length) {
              startInteractionStateMachines(file, pageInteractionEntries, page, reason)
            }
          }
        }
        if (shouldKeepLoadedFileLayeredWithCurrent && options.pagePrevUnderCurrent) {
          startStackedPagePrevOverUnderlay()
        } else if (shouldKeepLoadedFileLayeredWithCurrent) {
          startStackedPageInUnderOutgoing()
        }
        if (!options.pagePrevUnderCurrent) {
          const shouldRetainOutgoingAsBackUnderlay = Boolean(
            shouldStartIncomingPageTurnImmediately &&
              outgoingPageTurnAtLoad &&
              outgoingBackUnderlayFile &&
              outgoingBackUnderlayIndex >= 0,
          )
          const offloadRegistered =
            (shouldKeepLoadedFileLayeredWithCurrent || shouldRetainOutgoingAsBackUnderlay) &&
            registerPageOutUnderlayOffload(
              previousRive,
              previousCanvas,
              nextCanvas,
              shouldRetainOutgoingAsBackUnderlay
                ? undefined
                : () => {
                    preloadPreferredAdjacentSpreadUnderCurrent(file, index, page, `${reason} adjacent underlay`)
                  },
              shouldRetainOutgoingAsBackUnderlay && outgoingBackUnderlayFile
                ? {
                    file: outgoingBackUnderlayFile,
                    index: outgoingBackUnderlayIndex,
                    page: outgoingBackUnderlayPage,
                    readerPageLabel: getReaderPageLabelForFile(outgoingBackUnderlayFile),
                    playbackKey: outgoingBackUnderlayPlaybackKey || getPlaybackKey(outgoingBackUnderlayFile),
                    requestedArtboard:
                      outgoingBackUnderlayFile.artboard && outgoingBackUnderlayFile.artboard !== 'auto'
                        ? outgoingBackUnderlayFile.artboard
                        : null,
                    animation: outgoingBackUnderlayAnimation,
                    animationEntry: outgoingBackUnderlayAnimationEntry,
                    stateMachine: outgoingBackUnderlayStateMachine,
                    stateMachineEntry: outgoingBackUnderlayStateMachineEntry,
                    reason,
                  }
                : undefined,
            )
          if (!offloadRegistered) {
            const previousCanvasCleanupDelay =
              shouldStartIncomingPageTurnImmediately || shouldSuppressIncomingPlayback || shouldKeepLoadedFileLayeredWithCurrent
                ? transitionDurationMs + 180
                : 180
            window.setTimeout(() => {
              previousRive?.cleanup()
              if (previousCanvas !== activeCanvas) {
                cleanupCanvas(previousCanvas)
              }
              if (shouldKeepLoadedFileLayeredWithCurrent && activeCanvas === nextCanvas) {
                nextCanvas.style.zIndex = '2'
              }
              if (shouldKeepLoadedFileLayeredWithCurrent && activeCanvas === nextCanvas) {
                preloadPreferredAdjacentSpreadUnderCurrent(file, index, page, `${reason} adjacent underlay`)
              }
            }, previousCanvasCleanupDelay)
          }
        }

        if (shouldStartIncomingPageTurnImmediately && incomingPageTurnAnimationEntry) {
          activeSpreadIncomingPageInHandled = true
          const startedIncomingPageTurnEntry = pendingIncomingPageTurnAtLoad
            ? incomingPageTurnAnimationEntry
            : playPageTurnAnimation(instance, incomingPageTurnAnimationEntry.animation, 'incoming page in after load', requestedArtboardForFile) ||
              incomingPageTurnAnimationEntry
          if (pendingIncomingPageTurnAtLoad) {
            hideManualStart()
            setStatus(`Running ${startedIncomingPageTurnEntry.artboard} / ${startedIncomingPageTurnEntry.animation} (page in).`)
            context.analytics.log('1tribe_simple_rive_page_turn_animation', {
              animation: startedIncomingPageTurnEntry.animation,
              requestedAnimation: pendingIncomingPageTurnAtLoad.animation,
              artboard: startedIncomingPageTurnEntry.artboard,
              label: 'incoming page in startup',
              activeFile: file.name,
              bookId: context.data.getBookId(),
              page: context.data.getCurrentPage(),
            })
          }
          logPageMappingDebug(context, {
            readerPage: page,
            reason,
            matchedFile: file,
            playbackTriggered: true,
            animation: startedIncomingPageTurnEntry.animation,
            artboard: startedIncomingPageTurnEntry.artboard,
            note: 'Incoming Page_in animation started after resolving the loaded file contents.',
          })
          schedulePostPageInRenderPump(instance, startedIncomingPageTurnEntry, file, page, reason)
          if (areRiveListenersEnabled) {
            const pageInteractionEntries = stateMachineEntry
              ? [stateMachineEntry]
              : getSimpleRivePageInteractionEntries(instance.contents || {}, file, page)
            const interactionEntries = pageInteractionEntries
            if (interactionEntries.length) {
              startInteractionStateMachines(file, interactionEntries, page, reason)
            }
          }
        } else if (stateMachineEntry) {
          if (shouldSuppressIncomingPlayback) {
            setStatus(
              `Loaded ${file.name} for reader page ${page} (mapped ${readerPageLabel}). Backward page turn already ran ${pageTurnBackOutAnimation} on the outgoing page.`,
            )
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: false,
              stateMachine: stateMachineEntry.stateMachine,
              artboard: stateMachineEntry.artboard,
              note: 'Backward page turn: suppressed incoming page-turn and page state-machine playback.',
            })
          } else if (shouldStartIdleOnVisibleLoad && loadIdleEntry) {
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: true,
              animation: loadIdleEntry.animation,
              stateMachine: stateMachineEntry.stateMachine,
              artboard: loadIdleEntry.artboard,
              note: 'Initial visible load used the configured idle animation instead of resetting into the auto state machine.',
            })
          } else if (shouldStartStateMachineAfterSwap) {
            scheduleStateMachineStart(instance, stateMachineEntry, 'page turn')
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: true,
              stateMachine: stateMachineEntry.stateMachine,
              artboard: stateMachineEntry.artboard,
              note: 'State machine scheduled to start after page swap.',
            })
          } else if (shouldDeferStateMachineStart) {
            showManualStart(file.name, stateMachineEntry.stateMachine)
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: false,
              stateMachine: stateMachineEntry.stateMachine,
              artboard: stateMachineEntry.artboard,
              note: 'State machine selected, waiting for manual start.',
            })
          } else if (runtimeConfig.autoplay) {
            setStatus(
              `Playing ${file.name} for reader page ${page} (mapped ${readerPageLabel}) with ${stateMachineEntry.artboard} / ${stateMachineEntry.stateMachine}.`,
            )
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: true,
              stateMachine: stateMachineEntry.stateMachine,
              artboard: stateMachineEntry.artboard,
              note: 'Autoplay started selected state machine.',
            })
          } else {
            showManualStart(file.name, stateMachineEntry.stateMachine)
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: false,
              stateMachine: stateMachineEntry.stateMachine,
              artboard: stateMachineEntry.artboard,
              note: 'State machine selected, playback paused.',
            })
          }
        } else if (animationEntry) {
          if (shouldSuppressIncomingPlayback) {
            setStatus(
              `Loaded ${file.name} for reader page ${page} (mapped ${readerPageLabel}). Backward page turn already ran ${pageTurnBackOutAnimation} on the outgoing page.`,
            )
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: false,
              animation: animationEntry.animation,
              artboard: animationEntry.artboard,
              note: 'Backward page turn: suppressed incoming page-turn and page animation playback.',
            })
          } else if (shouldStartAnimationAfterSwap) {
            scheduleAnimationStart(instance, animationEntry, 'page turn')
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: true,
              animation: animationEntry.animation,
              artboard: animationEntry.artboard,
              note: 'Animation scheduled to start after page swap.',
            })
          } else if (shouldDeferAnimationStart) {
            showManualStart(file.name, animationEntry.animation)
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: false,
              animation: animationEntry.animation,
              artboard: animationEntry.artboard,
              note: 'Animation selected, waiting for manual start.',
            })
          } else if (runtimeConfig.autoplay) {
            setStatus(
              `Playing ${file.name} for reader page ${page} (mapped ${readerPageLabel}) with ${animationEntry.artboard} / ${animationEntry.animation}.`,
            )
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: true,
              animation: animationEntry.animation,
              artboard: animationEntry.artboard,
              note: 'Autoplay started selected animation.',
            })
          } else {
            showManualStart(file.name, animationEntry.animation)
            logPageMappingDebug(context, {
              readerPage: page,
              reason,
              matchedFile: file,
              playbackTriggered: false,
              animation: animationEntry.animation,
              artboard: animationEntry.artboard,
              note: 'Animation selected, playback paused.',
            })
          }
        } else if (isRiveInteractive) {
          setStatus(
            `Interactive test needs riveStateMachine or riveAnimation. Animations: ${listSimpleRiveAnimations(instance.contents || {})}. State machines: ${listSimpleRiveStateMachines(instance.contents || {})}.`,
          )
          logPageMappingDebug(context, {
            readerPage: page,
            reason,
            matchedFile: file,
            playbackTriggered: false,
            note: 'Interactive mode did not find a matching state machine.',
          })
        } else {
          setStatus(`${runtimeConfig.autoplay ? 'Playing' : 'Loaded'} ${file.name} for reader page ${page} (mapped ${readerPageLabel})${runtimeConfig.autoplay ? '' : ' (paused)'}.`)
          logPageMappingDebug(context, {
            readerPage: page,
            reason,
            matchedFile: file,
            playbackTriggered: runtimeConfig.autoplay,
            note: runtimeConfig.autoplay ? 'Autoplay started animation.' : 'File loaded with playback paused.',
          })
        }
        if (stateMachineEntry) {
          renderStateMachineControls(instance, stateMachineEntry)
        } else {
          clearStateMachineControls()
        }
        emitHarnessAvailableAnimations(instance, file, page, reason)
        context.analytics.log('1tribe_simple_rive_loaded', {
          bookId: context.data.getBookId(),
          mappedBookId: activeBookId,
          riveBookId: file.bookId,
          page,
          file: file.name,
          index,
          pageRange,
          reason,
          animation,
          stateMachine,
          artboard: stateMachineEntry?.artboard || animationEntry?.artboard || null,
          stackedUnderCurrent: shouldKeepLoadedFileUnderCurrent,
          stackedAboveCurrent: shouldKeepLoadedFileOverCurrent,
        })
        if (!shouldKeepLoadedFileLayeredWithCurrent && (shouldPreloadAdjacentOnInitialLoad || !/^initial\b/i.test(reason))) {
          window.setTimeout(() => preloadPreferredAdjacentSpreadUnderCurrent(file, index, page, reason), 0)
        }
        if (shouldUseTransitionFiles) {
          window.setTimeout(preloadTransitionRives, 0)
        }
      },
      onLoadError(event) {
        if (isDisposed || currentSerial !== loadSerial) return

        pendingRive?.cleanup()
        pendingRive = null
        pendingCanvas?.remove()
        pendingCanvas = null
        pendingFileUrl = null
        pendingPlaybackKey = null
        setStatus(`Failed ${file.name}: ${String(event.data || 'unknown error')}`)
      },
    })

    if (areRiveListenersEnabled) {
      instance.on(EventType.RiveEvent, onSimpleRiveEvent)
      instance.on(EventType.StateChange, onSimpleStateChange)
    }

    pendingRive = instance
  }

  const scheduleFileForPage = (
    page: number,
    reason: string,
    delay = pageSwapDelayMs,
    options: SimpleRiveLoadOptions = {},
  ) => {
    if (pageLoadTimer !== null) window.clearTimeout(pageLoadTimer)
    const effectiveDelay =
      shouldUseTransitionFiles && !shouldStackTransitionPages && !/^initial\b/i.test(reason)
        ? Math.max(delay, transitionDurationMs)
        : delay

    if (effectiveDelay <= 0 && options.pagePrevUnderCurrent) {
      pageLoadTimer = window.setTimeout(() => {
        pageLoadTimer = null
        loadFileForPage(page, reason, options)
      }, 0)
      return
    }

    if (effectiveDelay <= 0) {
      loadFileForPage(page, reason, options)
      return
    }

    setStatus(`Waiting for Epic page transition before loading page ${page} Rive...`)
    pageLoadTimer = window.setTimeout(() => {
      pageLoadTimer = null
      loadFileForPage(page, reason, options)
    }, effectiveDelay)
  }

  const clearPendingNavigation = () => {
    if (pendingNavigationTimer !== null) window.clearTimeout(pendingNavigationTimer)
    pendingNavigationTimer = null
    pendingNavigationDirection = null
    pendingNavigationReason = ''
    pendingNavigationStartedSpreadTransition = false
  }

  const queueSpreadTransitionAnimations = (
    direction: number,
    reason: string,
    options: { queueIncomingPageTurn?: boolean; deferOutgoingPageTurn?: boolean } = {},
  ): boolean => {
    if (!shouldUseSpreadTransitionAnimations) return false

    const outgoingAnimation = direction < 0 ? pageTurnBackOutAnimation : pageTurnForwardOutAnimation
    const outgoingLabel = direction < 0 ? 'page go back' : 'page out'

    if (direction < 0) {
      pendingIncomingPageTurnAnimation = null
      pendingOutgoingPageTurnAnimation = null

      if (shouldDisablePageOutAnimation) {
        console.info(`[1Tribe simple overlay] Skipped backward page-turn "${outgoingAnimation}" by test flag.`, {
          direction,
          reason,
        })
        return false
      }

      if (options.deferOutgoingPageTurn) {
        pendingOutgoingPageTurnAnimation = {
          animation: outgoingAnimation,
          label: outgoingLabel,
        }
        console.info(`[1Tribe simple overlay] Deferred backward page-turn "${outgoingAnimation}" until previous Rive load.`, {
          direction,
          reason,
        })
        return true
      }

      return playActivePageTurnAnimation(outgoingAnimation, outgoingLabel, true)
    }

    if (options.queueIncomingPageTurn === false) {
      pendingIncomingPageTurnAnimation = null
    } else {
      pendingIncomingPageTurnAnimation = {
        animation: pageTurnInAnimation,
        direction,
        reason,
      }
    }
    captureFrameBackdropSnapshot(reason)

    if (shouldDisablePageOutAnimation || shouldDisableForwardPageOutAnimation) {
      pendingOutgoingPageTurnAnimation = null
      console.info(`[1Tribe simple overlay] Skipped outgoing page-turn "${outgoingAnimation}" by test flag.`, {
        direction,
        reason,
      })
      return true
    }

    if (shouldDeferOutgoingPageTurn) {
      pendingOutgoingPageTurnAnimation = {
        animation: outgoingAnimation,
        label: outgoingLabel,
      }
      console.info(`[1Tribe simple overlay] Deferred outgoing page-turn "${outgoingAnimation}" until incoming Rive load.`, {
        direction,
        reason,
      })
      return true
    }

    return playActivePageTurnAnimation(outgoingAnimation, outgoingLabel)
  }

  const queueNavigationCycle = (direction: number, reason: string) => {
    if (isSimpleRivePageTurnBusy && direction) {
      clearPendingNavigation()
      const livePage = context.data.getCurrentPage()
      const targetPage = livePage !== displayedPage ? livePage : inferSimpleRivePage(files, livePage, direction)
      queueRapidSimpleRivePageChange(targetPage, direction, reason)
      return
    }

    const didStartSpreadTransition = shouldUseSpreadTransitionAnimations
      ? queueSpreadTransitionAnimations(direction, reason)
      : false

    if (shouldUseSequentialFiles) {
      pendingNavigationDirection = direction
      pendingNavigationReason = reason
      pendingNavigationStartedSpreadTransition = didStartSpreadTransition
      if (pendingNavigationTimer !== null) window.clearTimeout(pendingNavigationTimer)
      pendingNavigationTimer = window.setTimeout(() => {
        const queuedDirection = pendingNavigationDirection
        const queuedReason = pendingNavigationReason
        if (queuedDirection) {
          moveSequentialFile(queuedDirection, `${queuedReason} fallback`, 0, false)
        }
      }, 450)
      startPageFlip(direction)
      return
    }

    pendingNavigationDirection = direction
    pendingNavigationReason = reason
    pendingNavigationStartedSpreadTransition = didStartSpreadTransition
    startPageFlip(direction)
    if (pendingNavigationTimer !== null) window.clearTimeout(pendingNavigationTimer)

    pendingNavigationTimer = window.setTimeout(() => {
      const queuedDirection = pendingNavigationDirection
      const queuedReason = pendingNavigationReason
      const queuedStartedSpreadTransition = pendingNavigationStartedSpreadTransition
      clearPendingNavigation()
      if (queuedDirection) {
        const livePage = context.data.getCurrentPage()
        const page = livePage !== displayedPage ? livePage : inferSimpleRivePage(files, displayedPage, queuedDirection)
        const shouldFallbackLoadForwardUnderlay = Boolean(
          queuedDirection > 0 && queuedStartedSpreadTransition && shouldStackPageFiles,
        )
        displayedPage = page
        scheduleFileForPage(
          page,
          `${queuedReason} fallback`,
          shouldFallbackLoadForwardUnderlay ? 0 : pageSwapDelayMs,
          {
            stackUnderCurrent: shouldFallbackLoadForwardUnderlay,
          },
        )
      }
    }, 450)
  }

  const onDocumentNavigationClick = (event: Event) => {
    if (event.target instanceof Node && root.contains(event.target)) return

    const direction = getNavigationDirectionFromClick(event, context.data.getFlipBookRect())
    if (!direction) return

    queueNavigationCycle(direction, direction < 0 ? 'epic back button' : 'epic next button')
  }

  resizeRive()
  loadSimpleRiveFiles(fetchController.signal)
    .then((loadedFiles) => {
      if (isDisposed) return

      files = filterSimpleRiveFilesForBook(loadedFiles, activeBookId)
      if (!files.length) {
        setStatus(
          activeBookId === null
            ? 'No Rive files found in rive-files.json.'
            : `No Rive files found in rive-files.json for Epic book ${activeBookId}.`,
        )
        return
      }

      if (!runtimeConfig.load) {
        frame.hidden = false
        hideCompletionPage()
        setStatus('Rive loading is paused. Add riveLoad=1 when the overlay itself is stable.')
        return
      }

      if (shouldUseSequentialFiles) {
        displayedFileIndex = 0
        displayedPage = getSequentialPageForIndex(0)
      } else if (getBooleanParam('tribeWordHotspotTest', false) && !getSimpleRiveFileForPage(files, displayedPage)) {
        const firstMappedPage = getFirstSimpleRivePage(files)
        if (firstMappedPage !== null) {
          console.info('[1Tribe word hotspots] Epic test page did not match the focused Rive folder; loading first mapped test page.', {
            contextPage: context.data.getCurrentPage(),
            displayedPage,
            firstMappedPage,
            files: files.map((file) => ({ name: file.name, pages: file.pages, readerPages: file.readerPages })),
          })
          displayedPage = firstMappedPage
        }
      }
      scheduleFileForPage(displayedPage, 'initial', initialLoadDelayMs)
    })
    .catch((error) => {
      if (!isDisposed) setStatus(`Unable to load Rive file list: ${String(error)}`)
    })

  window.addEventListener('resize', resizeRive)
  window.addEventListener(harnessAnimationEventName, onHarnessAnimationRequest)
  document.addEventListener('click', onDocumentNavigationClick, true)
  frame.addEventListener('pointerdown', markRivePointerInteraction, true)
  navBackGutter.addEventListener('click', onReaderNavBackGutterClick)
  navNextGutter.addEventListener('click', onReaderNavNextGutterClick)

  cleanupCallbacks.push(
    () => {
      window.removeEventListener('resize', resizeRive)
      window.removeEventListener(harnessAnimationEventName, onHarnessAnimationRequest)
      document.removeEventListener('click', onDocumentNavigationClick, true)
      frame.removeEventListener('pointerdown', markRivePointerInteraction, true)
      navBackGutter.removeEventListener('click', onReaderNavBackGutterClick)
      navNextGutter.removeEventListener('click', onReaderNavNextGutterClick)
      clearPendingNavigation()
    },
    context.events.on('pageChange', (payload) => {
      resizeRive()

      let page = getReaderPageFromPayload(payload, context.data.getCurrentPage())
      const payloadDirection = getNavigationDirectionFromPayload(payload)
      const inferredDirection = page < displayedPage ? -1 : page > displayedPage ? 1 : null
      const direction = pendingNavigationDirection || payloadDirection || inferredDirection
      const reason =
        pendingNavigationReason ||
        (direction && direction < 0 ? 'back page' : 'next page')
      const targetMatch = getSimpleRiveFileForPage(files, page)
      const activeFile = getActiveSimpleRiveFile()
      const canPromoteBusyPreloadedUnderlay = Boolean(
        direction &&
          pendingNavigationDirection &&
          direction === pendingNavigationDirection &&
          targetMatch &&
          preloadedUnderlay &&
          preloadedUnderlay.file.url === targetMatch.file.url &&
          preloadedUnderlay.playbackKey === getPlaybackKey(targetMatch.file) &&
          ((direction > 0 && preloadedUnderlay.direction > 0) || (direction < 0 && preloadedUnderlay.direction < 0)),
      )
      if (isSimpleRivePageTurnBusy && direction && !canPromoteBusyPreloadedUnderlay) {
        const queuedPage = page !== displayedPage ? page : direction ? inferSimpleRivePage(files, page, direction) : page
        queueRapidSimpleRivePageChange(queuedPage, direction, reason)
        clearPendingNavigation()
        return
      }
      const isSameMappedForwardPage = Boolean(
        direction &&
          direction > 0 &&
          !pendingNavigationDirection &&
          targetMatch &&
          activeFile &&
          targetMatch.file.url === activeFile.url &&
          getPlaybackKey(targetMatch.file) === activePlaybackKey,
      )
      const isForwardSpreadBoundaryPage = Boolean(
        direction &&
          direction > 0 &&
          targetMatch &&
          activeFile &&
          (targetMatch.file.url !== activeFile.url || getPlaybackKey(targetMatch.file) !== activePlaybackKey),
      )
      const isBackwardSpreadBoundaryPage = Boolean(
        direction &&
          direction < 0 &&
          targetMatch &&
          activeFile &&
          (targetMatch.file.url !== activeFile.url || getPlaybackKey(targetMatch.file) !== activePlaybackKey),
      )
      const hasMatchingBackwardPreloadedUnderlay = Boolean(
        direction &&
          direction < 0 &&
          targetMatch &&
          (hasRetainedBackUnderlayForFile(targetMatch.file, getPlaybackKey(targetMatch.file)) ||
            (preloadedUnderlay &&
              preloadedUnderlay.direction < 0 &&
              preloadedUnderlay.file.url === targetMatch.file.url &&
              preloadedUnderlay.playbackKey === getPlaybackKey(targetMatch.file))),
      )
      let didStartOutgoingSpreadTransition = Boolean(
        pendingNavigationDirection &&
          pendingNavigationStartedSpreadTransition &&
          direction === pendingNavigationDirection,
      )

      console.info('[1Tribe page map] pageChange', {
        bookId: context.data.getBookId(),
        contextCurrentPage: context.data.getCurrentPage(),
        payload,
        resolvedReaderPage: page,
        displayedPage,
        direction,
        readerCompletion: getReaderCompletionDebug(context, page),
      })

      if (shouldUseSequentialFiles) {
        if (direction) {
          moveSequentialFile(direction, reason, pageSwapDelayMs, !pendingNavigationDirection)
        }
        return
      }

      if (!pendingNavigationDirection && direction && !isSameMappedForwardPage) {
        if (shouldUseSpreadTransitionAnimations) {
          didStartOutgoingSpreadTransition = queueSpreadTransitionAnimations(direction, reason, {
            deferOutgoingPageTurn: Boolean(
              isBackwardSpreadBoundaryPage && shouldStackPageFiles && !hasMatchingBackwardPreloadedUnderlay,
            ),
          })
        }
        startPageFlip(direction)
      }
      if (page === displayedPage && direction) {
        page = inferSimpleRivePage(files, page, direction)
      }

      displayedPage = page
      const shouldLoadForwardUnderlay = Boolean(
        isForwardSpreadBoundaryPage && shouldStackPageFiles && didStartOutgoingSpreadTransition,
      )
      const didPromotePreloadedUnderlay = shouldLoadForwardUnderlay
        ? promotePreloadedUnderlayForPage(page, reason)
        : false
      const shouldRevealBackwardUnderlay = Boolean(
        isBackwardSpreadBoundaryPage && shouldStackPageFiles && didStartOutgoingSpreadTransition,
      )
      const didPromoteBackwardUnderlay = shouldRevealBackwardUnderlay
        ? promotePreloadedBackwardUnderlayForPage(page, reason)
        : false
      const shouldLoadBackwardUnderlay = Boolean(shouldRevealBackwardUnderlay && !didPromoteBackwardUnderlay)
      const shouldWaitForForwardPageOut = Boolean(
        isForwardSpreadBoundaryPage &&
          didStartOutgoingSpreadTransition &&
          shouldUseSpreadTransitionAnimations &&
          !shouldDisablePageOutAnimation &&
          !shouldLoadForwardUnderlay,
      )
      clearPendingNavigation()
      if (isForwardSpreadBoundaryPage && didStartOutgoingSpreadTransition) {
        logPageMappingDebug(context, {
          readerPage: page,
          reason,
          matchedFile: activeFile,
          playbackTriggered: true,
          animation: pageTurnForwardOutAnimation,
          artboard: activeFile?.artboard || null,
          note: shouldLoadForwardUnderlay
            ? shouldPlaceForwardIncomingOnTop
              ? 'Forward spread boundary: ran Page_out on the current spread while promoting or loading the next Rive file above it.'
              : 'Forward spread boundary: ran Page_out on the current spread while loading the next Rive file underneath.'
            : 'Forward spread boundary: ran Page_out on the current spread before loading the next Rive file.',
        })
      }
      if (didPromotePreloadedUnderlay || didPromoteBackwardUnderlay) return
      scheduleFileForPage(
        page,
        reason,
        shouldLoadForwardUnderlay || shouldLoadBackwardUnderlay
          ? 0
          : shouldWaitForForwardPageOut
            ? Math.max(pageSwapDelayMs, transitionDurationMs)
            : pageSwapDelayMs,
        {
          stackUnderCurrent: shouldLoadForwardUnderlay || shouldLoadBackwardUnderlay,
          pagePrevUnderCurrent: shouldLoadBackwardUnderlay,
        },
      )
    }),
    context.events.on('pageTurnStart', (payload) => {
      const direction = getNavigationDirectionFromPayload(payload)
      if (!direction) return

      const reason = direction < 0 ? 'state machine page prev' : 'state machine page next'
      const didPulsePageAction = pulseVisibleRivePageAction(direction, reason)
      if (!didPulsePageAction) return

      pendingNavigationDirection = direction
      pendingNavigationReason = reason
      pendingNavigationStartedSpreadTransition = false
    }),
  )

  context.analytics.log('1tribe_simple_overlay_activated', {
    bookId: context.data.getBookId(),
    mappedBookId: activeBookId,
    page: context.data.getCurrentPage(),
    replaceReadingArea: shouldReplaceReadingArea,
    preserveReaderChrome: shouldPreserveReaderChrome,
    replaceSelector: replacementSelector,
    hideSelector,
    frameSelector,
  })

  return () => {
    isDisposed = true
    fetchController.abort()
    if (pageLoadTimer !== null) window.clearTimeout(pageLoadTimer)
    if (pageTurnStartTimer !== null) window.clearTimeout(pageTurnStartTimer)
    if (simpleRivePageTurnBusyTimer !== null) window.clearTimeout(simpleRivePageTurnBusyTimer)
    if (rapidPageChangeCatchUpTimer !== null) window.clearTimeout(rapidPageChangeCatchUpTimer)
    pageTurnStartTimer = null
    simpleRivePageTurnBusyTimer = null
    rapidPageChangeCatchUpTimer = null
    queuedRapidPageChange = null
    cleanupTransitionRives()
    clearPageFlip()
    replacementObserver?.disconnect()
    for (const cleanup of cleanupCallbacks) cleanup()
    destroyRive()
    root.remove()
    restoreReadingAreaContent()
    restoreSelectedContent()
  }
}

extension = {
  activate(context) {
    if (showBootBadge) {
      updateBootBadge('1Tribe activate() called')
    }

    const cleanupWordLookupDismissGuard = installWordLookupDismissGuard(context)
    const cleanupDebugCommands = installDebugCommands(context)
    const cleanupReadAlongPlaybackFollow = installReadAlongPlaybackFollow(context)
    const readingRoot = context.slots.get('reading-area')
    readAlongHotspotRoots.add(readingRoot)
    const cleanupReadAlongHotspotRoot = () => {
      readAlongHotspotRoots.delete(readingRoot)
    }

    if (shouldUseCommandHarness()) {
      const cleanupCommandHarness = activateCommandHarness(context)
      const cleanupStandaloneWordHotspots = shouldUseCommandHarnessWordFinder()
        ? activateStandaloneWordHotspotOverlay(context)
        : () => {}
      return () => {
        cleanupStandaloneWordHotspots()
        cleanupCommandHarness()
        cleanupReadAlongPlaybackFollow()
        cleanupDebugCommands()
        cleanupReadAlongHotspotRoot()
        cleanupWordLookupDismissGuard()
      }
    }

    if (shouldUseSimpleRiveOverlay()) {
      const cleanupSimpleRiveOverlay = activateSimpleRiveOverlay(context)
      const cleanupStandaloneWordHotspots = shouldUseStandaloneWordHotspots()
        ? activateStandaloneWordHotspotOverlay(context)
        : () => {}
      return () => {
        cleanupStandaloneWordHotspots()
        cleanupSimpleRiveOverlay()
        cleanupReadAlongPlaybackFollow()
        cleanupDebugCommands()
        cleanupReadAlongHotspotRoot()
        cleanupWordLookupDismissGuard()
      }
    }

    const root = document.createElement('div')
    const frame = document.createElement('div')
    const canvas = document.createElement('canvas')
    const status = document.createElement('div')
    const cleanupCallbacks: Array<() => void> = []
    let drawerPanel: HTMLElement | null = null
    let activeAction: RiveAction | null = null
    let activeSpread = getSpreadForPage(context.data.getCurrentPage())
    let activeStateMachine: string | null = activeSpread.stateMachine || null
    let didSelectFallbackStateMachine = Boolean(activeSpread.stateMachine)
    let rive: Rive | null = null
    let restoreConsoleError: (() => void) | null = null
    let isDisposed = false
    const fetchController = new AbortController()

    injectStyle(readingRoot, styles, 'tribe-extension-styles')

    root.className = 'tribe-extension-root'
    frame.className = 'tribe-rive-frame'
    canvas.className = 'tribe-rive-canvas'
    status.className = 'tribe-rive-status'
    status.textContent = 'Loading Rive...'

    frame.append(canvas)
    root.append(frame, status)
    readingRoot.append(root)
    positionFrame(frame, context.data.getFlipBookRect(), readingRoot)
    const cleanupStandaloneWordHotspots = shouldUseStandaloneWordHotspots()
      ? activateStandaloneWordHotspotOverlay(context)
      : () => {}

    const runAction = (action: RiveAction) => {
      activeAction = action
      context.analytics.log('1tribe_rive_action', {
        action: action.name,
        source: action.source,
        bookId: context.data.getBookId(),
        page: context.data.getCurrentPage(),
        ...action.properties,
      })

      const command = getCommand(action)
      if (!command) return

      if (isPageNavigationCommand(command)) {
        const epicCommand = getEpicPageNavigationCommand(command)
        if (!epicCommand) return

        context.commands.execute(epicCommand, {
          source: action.source,
          action: action.name,
          properties: action.properties,
        })
        return
      }

      if (command === 'openModal') {
        context.commands.execute(command, getModalSize(action.properties))
        return
      }

      if (command === 'lookup_word') {
        const word = getLookupWordPayload(action)
        if (!word) {
          console.info('[1Tribe] Ignored lookup_word action without a word payload.', action)
          return
        }

        armWordLookupDismissGuard(word, `rive-${action.source}`)
        context.commands.execute(command, word)
        return
      }

      context.commands.execute(command, {
        source: action.source,
        action: action.name,
        properties: action.properties,
      })
    }

    const onRiveEvent = (event: RiveRuntimeEvent) => {
      const payload = getRiveEventPayload(event)
      if (!payload.name) return

      runAction({
        name: payload.name,
        properties: payload.properties,
        source: 'rive-event',
      })
    }

    const onStateChange = (event: RiveRuntimeEvent) => {
      if (!Array.isArray(event.data)) return

      for (const stateName of event.data) {
        if (typeof stateName !== 'string' || !getCommand({ name: stateName, source: 'rive-state' })) {
          continue
        }

        runAction({
          name: stateName,
          source: 'rive-state',
        })
      }
    }

    const resizeRive = () => {
      positionFrame(frame, context.data.getFlipBookRect(), readingRoot)
      const pixelRatio = getEffectivePixelRatio(frame)
      resizeCanvasToFrame(canvas, frame, pixelRatio)
      rive?.resizeDrawingSurfaceToCanvas(pixelRatio)
    }

    const destroyRive = () => {
      restoreConsoleError?.()
      restoreConsoleError = null
      if (!rive) return
      rive.off(EventType.RiveEvent, onRiveEvent)
      rive.off(EventType.StateChange, onStateChange)
      rive.cleanup()
      rive = null
    }

    const createRive = (spread: SpreadConfig) => {
      if (isDisposed) return

      destroyRive()
      activeSpread = spread
      activeStateMachine = spread.stateMachine || null
      didSelectFallbackStateMachine = Boolean(spread.stateMachine)

      const source = getSpreadSource(spread)
      status.hidden = false
      status.textContent = `Initializing ${spread.label}...`
      resizeCanvasToFrame(canvas, frame, getEffectivePixelRatio(frame))
      const shouldPreventDefaultAnimation =
        runtimeConfig.preventDefaultAnimation && !activeStateMachine && !runtimeConfig.autoStateMachine

      if (shouldPreventDefaultAnimation) {
        restoreConsoleError = suppressStaticPreviewWarning()
      }

      rive = new Rive({
        src: source,
        canvas,
        autoplay: runtimeConfig.autoplay,
        animations: shouldPreventDefaultAnimation ? STATIC_PREVIEW_ANIMATION : undefined,
        stateMachines: activeStateMachine || undefined,
        layout: new Layout({
          fit: Fit.Contain,
          alignment: Alignment.Center,
        }),
        autoBind: runtimeConfig.autoBind,
        enableRiveAssetCDN: false,
        useOffscreenRenderer: runtimeConfig.useOffscreenRenderer,
        shouldDisableRiveListeners: runtimeConfig.disableListeners,
        automaticallyHandleEvents: false,
        isTouchScrollEnabled: true,
        onLoad: () => {
          restoreConsoleError?.()
          restoreConsoleError = null
          if (!rive || isDisposed) return

          const stateMachines = rive.stateMachineNames
          if (runtimeConfig.autoStateMachine && !didSelectFallbackStateMachine && stateMachines.length > 0) {
            activeStateMachine = stateMachines[0] || null
            didSelectFallbackStateMachine = true
            rive.reset({
              stateMachines: activeStateMachine || undefined,
              autoplay: runtimeConfig.autoplay,
              autoBind: runtimeConfig.autoBind,
            })
          }

          syncReaderInputs(rive, activeStateMachine, context)
          resizeRive()
          if (runtimeConfig.autoplay) {
            rive.play()
          } else if (activeStateMachine) {
            rive.pause()
          }
          status.hidden = false
          status.textContent = `${spread.label} loaded${activeStateMachine ? `: ${activeStateMachine}` : ''}${
            runtimeConfig.autoplay ? '' : ' (paused)'
          }`
          context.analytics.log('1tribe_rive_loaded', {
            bookId: context.data.getBookId(),
            page: context.data.getCurrentPage(),
            spread: spread.label,
            stateMachine: activeStateMachine,
            autoplay: runtimeConfig.autoplay,
            source,
          })
        },
        onLoadError: (event) => {
          restoreConsoleError?.()
          restoreConsoleError = null
          status.hidden = false
          status.textContent = `Unable to initialize Rive: ${String(event.data || 'unknown error')}`
        },
      })

      rive.on(EventType.RiveEvent, onRiveEvent)
      rive.on(EventType.StateChange, onStateChange)
    }

    const showRiveLoadPaused = (spread: SpreadConfig) => {
      status.hidden = false
      status.textContent = `${spread.label} Rive file loading is paused. Add riveLoad=1 to the bundle URL to profile this file.`
    }

    if (disableRiveRuntime) {
      status.hidden = false
      status.textContent = 'Extension activated with Rive disabled.'
    } else if (!runtimeConfig.load) {
      showRiveLoadPaused(activeSpread)
    } else {
      status.hidden = false
      status.textContent = `Initializing ${activeSpread.label}...`
      createRive(activeSpread)
    }

    window.addEventListener('resize', resizeRive)

    cleanupCallbacks.push(
      cleanupDebugCommands,
      cleanupReadAlongPlaybackFollow,
      cleanupReadAlongHotspotRoot,
      cleanupWordLookupDismissGuard,
      cleanupStandaloneWordHotspots,
      () => {
        window.removeEventListener('resize', resizeRive)
      },
      context.events.on('pageTurnStart', () => {
        frame.hidden = true
        if (activeStateMachine) {
          rive?.pause()
        }
      }),
      context.events.on('pageChange', () => {
        frame.hidden = false
        resizeRive()
        const nextSpread = getSpreadForPage(context.data.getCurrentPage())
        if (!runtimeConfig.load) {
          activeSpread = nextSpread
          showRiveLoadPaused(nextSpread)
          return
        }

        if (nextSpread.file !== activeSpread.file) {
          createRive(nextSpread)
        } else if (rive) {
          syncReaderInputs(rive, activeStateMachine, context)
          if (runtimeConfig.autoplay) {
            rive.play()
          }
        }
        drawerPanel = null
      }),
      context.events.on('drawerStateChange', (payload) => {
        const mounted = Boolean((payload as { mounted?: boolean } | undefined)?.mounted)
        if (mounted) {
          drawerPanel = renderDrawer(context, activeAction)
          return
        }

        drawerPanel?.remove()
        drawerPanel = null
      }),
    )

    context.analytics.log('1tribe_extension_activated', {
      bookId: context.data.getBookId(),
      page: context.data.getCurrentPage(),
      apiVersion: context.version,
    })

    return () => {
      isDisposed = true
      fetchController.abort()
      for (const cleanup of cleanupCallbacks) cleanup()
      destroyRive()
      drawerPanel?.remove()
      root.remove()
    }
  },
}
}

const extensionWindow = window as Window & Record<string, Extension>
extensionWindow[__EXTENSION_GLOBAL_NAME__] = extension
extensionWindow[EPIC_EXTENSION_REGISTRATION_NAME] = extension

export default extension




