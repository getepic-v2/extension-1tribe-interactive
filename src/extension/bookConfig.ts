export interface CommandHarnessPreviewFile {
  file: string
  label: string
  readerEnd: number
  readerStart: number
  stateMachine: string
}

export interface EpicTribeBookConfig {
  bookId: number
  defaultParams: Record<string, string>
  nativePassthroughLeftPages?: number[]
  nativePassthroughRightPages?: number[]
  previewFiles: CommandHarnessPreviewFile[]
  readAlongTranscriptFile?: string
  riveFolder: string
  title: string
  wordHotspotFolder: string
}

export interface SpreadConfig {
  pages: [number, number]
  file: string
  label: string
  stateMachine?: string
}

export const SAMPLE_SPREADS: SpreadConfig[] = [
  {
    pages: [1, Number.MAX_SAFE_INTEGER],
    file: 'rive/ICanFindIt_83936/83936_spread_02.riv',
    label: 'Spread 02',
  },
]
export const TRIBE_SPREADS: SpreadConfig[] = [
  {
    pages: [1, Number.MAX_SAFE_INTEGER],
    file: 'rive/ICanFindIt_83936/83936_spread_02.riv',
    label: 'Spread 02',
  },
]

export const EPIC_WORD_HOTSPOT_TEST_DEFAULTS: Record<string, string> = {
  riveStackTransitionPages: '0',
  riveForwardIncomingOnTop: '1',
  riveWordHotspots: '1',
  tribeStandaloneWordHotspots: '1',
  riveWordHotspotPaddingPct: '0.004',
  riveWordHotspotPaddingXPct: '0.0012',
  riveWordHotspotPaddingYPct: '0.004',
  riveWordHotspotStrokePx: '3',
  riveWordHotspotMagnifyScale: '1.16',
  riveWordHotspotOutlineScaleX: '1.16',
  riveWordHotspotOutlineScaleY: '1.2',
  rivePageTurnForwardOutAnimation: 'Page_next',
  rivePageTurnBackOutAnimation: 'Page_prev',
  rivePageTurnInAnimation: 'Page_in',
  rivePageTurnIdleAnimation: 'idle',
  riveNavGutterPct: '2',
}
const EPIC_1TRIBE_READER_DEFAULTS: Record<string, string> = {
  tribeCommandHarness: '1',
  tribeCommandHarnessTakeover: '1',
  tribeCommandHarnessRive: '1',
  tribeCommandHarnessWordFinder: '1',
  tribeCommandHarnessForwardPreload: '1',
  tribeCommandHarnessIdleAfterPageIn: '1',
  tribeCommandHarnessResumeStateMachineAfterIdle: '1',
  tribeCommandHarnessUseEpicBookFrame: '1',
  tribeCommandHarnessUseEpicNativeShell: '1',
  tribeCommandHarnessEpicBookFrameInsetPx: '0',
  tribeCommandHarnessEdgeNavPct: '5',
  tribeCommandHarnessShowControls: '0',
  tribeReadAlong: '1',
}
const ICAN_FIND_IT_BOOK_ID = 83936
const HUMMINGBIRD_BOOK_ID = 83230
const CREEPY_CAFETORIUM_BOOK_ID = 74774

const ICAN_FIND_IT_READER_DEFAULTS: Record<string, string> = {
  ...EPIC_1TRIBE_READER_DEFAULTS,
  riveWordHotspotMagnifierPixelScale: '2',
  riveWordHotspotShadowXPx: '3',
  riveWordHotspotShadowYPx: '3',
  riveWordHotspotStrokePx: '2',
}

const HUMMINGBIRD_READER_DEFAULTS: Record<string, string> = {
  ...EPIC_1TRIBE_READER_DEFAULTS,
  tribeCommandHarnessWordFinder: '1',
  tribeCommandHarnessPageInAnimation: 'Page_in',
  tribeCommandHarnessPageOutAnimation: 'Page_Next',
  tribeCommandHarnessPageBackAnimation: 'Page_Prev02',
  tribeCommandHarnessBackIdleAnimation: 'idle',
  tribeReadAlong: '1',
  simpleRiveOverlay: '1',
  riveFolder: 'TheWildLifeHummingbirdforaDay_83230',
  rivePageTurnForwardOutAnimation: 'Page_Next',
  rivePageTurnBackOutAnimation: 'Page_Prev02',
  rivePageTurnInAnimation: 'Page_in',
  rivePageTurnIdleAnimation: 'idle',
  riveStackPageFiles: '0',
  riveStackTransitionPages: '0',
  rivePreloadAdjacentUnderlay: '0',
  riveDpr: '1',
  riveMaxPixels: '2200000',
  riveWordHotspotMagnifierPixelScale: '2',
  riveWordHotspotShadowXPx: '3',
  riveWordHotspotShadowYPx: '3',
  riveWordHotspotStrokePx: '2',
}

const CREEPY_CAFETORIUM_READER_DEFAULTS: Record<string, string> = {
  ...EPIC_1TRIBE_READER_DEFAULTS,
  tribeCommandHarnessWordFinder: '1',
  tribeCommandHarnessPageInAnimation: 'Page_In',
  tribeCommandHarnessPageOutAnimation: 'Page_next',
  tribeCommandHarnessPageBackAnimation: 'Page_Prev',
  tribeCommandHarnessBackIdleAnimation: 'idle',
  tribeReadAlong: '1',
  simpleRiveOverlay: '1',
  riveFolder: 'CreepyCafetorium_74774',
  rivePageTurnForwardOutAnimation: 'Page_next',
  rivePageTurnBackOutAnimation: 'Page_Prev',
  rivePageTurnInAnimation: 'Page_In',
  rivePageTurnIdleAnimation: 'idle',
  riveStackTransitionPages: '0',
  rivePreloadAdjacentUnderlay: '0',
  riveDpr: '1',
  riveMaxPixels: '2200000',
  riveWordHotspotMagnifierPixelScale: '2',
  riveWordHotspotShadowXPx: '3',
  riveWordHotspotShadowYPx: '3',
  riveWordHotspotStrokePx: '2',
}

function createIcanFindItPreviewFiles(): CommandHarnessPreviewFile[] {
  return ['01', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22', '24'].map((spread) => {
    const spreadNumber = Number(spread)
    const readerStart = spread === '01' ? 0 : spreadNumber
    return {
      file: `rive/ICanFindIt_83936/83936_spread_${spread}.riv`,
      label: `spread ${spread}`,
      readerEnd: readerStart + 1,
      readerStart,
      stateMachine:
        spread === '01'
          ? '83936_spread_01'
          : `83936_spread_${spread}&${String(spreadNumber + 1).padStart(2, '0')}`,
    }
  })
}

function createHummingbirdPreviewFiles(): CommandHarnessPreviewFile[] {
  return ['01', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32', '34'].map(
    (spread) => {
      const spreadNumber = Number(spread)
      const readerStart = spread === '01' ? 0 : spreadNumber
      const stateMachine =
        spread === '01'
          ? 'HummingBird_spread_00&01'
          : spread === '34'
            ? 'HummingBird_spread_34'
            : `HummingBird_spread_${spread}&${String(spreadNumber + 1).padStart(2, '0')}`

      return {
        file: `rive/TheWildLifeHummingbirdforaDay_83230/hummingbird_spread_${spread}.riv`,
        label: `spread ${spread}`,
        readerEnd: readerStart + 1,
        readerStart,
        stateMachine,
      }
    },
  )
}

function createCreepyCafetoriumPreviewFiles(): CommandHarnessPreviewFile[] {
  return [
    { fileSpread: '00', readerStart: 0, readerEnd: 1, stateMachine: 'Creepy_Cafetorium_spread_00' },
    { fileSpread: '02', readerStart: 2, readerEnd: 3, stateMachine: 'Creepy_Cafetorium_spread_01' },
    { fileSpread: '04', readerStart: 4, readerEnd: 5, stateMachine: 'Creepy_Cafetorium_spread_02&03' },
    { fileSpread: '06', readerStart: 6, readerEnd: 7, stateMachine: 'Creepy_Cafetorium_spread_04&05' },
    { fileSpread: '08', readerStart: 8, readerEnd: 9, stateMachine: 'Creepy_Cafetorium_spread_06&07' },
    { fileSpread: '10', readerStart: 10, readerEnd: 11, stateMachine: 'Creepy_Cafetorium_spread_08&09' },
    { fileSpread: '12', readerStart: 12, readerEnd: 13, stateMachine: 'Creepy_Cafetorium_spread_10&11' },
    { fileSpread: '14', readerStart: 14, readerEnd: 15, stateMachine: 'Creepy_Cafetorium_spread_12&13' },
    { fileSpread: '16', readerStart: 16, readerEnd: 17, stateMachine: 'Creepy_Cafetorium_spread_14&15' },
    { fileSpread: '18', readerStart: 18, readerEnd: 19, stateMachine: 'Creepy_Cafetorium_spread_16&17' },
    { fileSpread: '20', readerStart: 20, readerEnd: 21, stateMachine: 'Creepy_Cafetorium_spread_18&19' },
    { fileSpread: '22', readerStart: 22, readerEnd: 23, stateMachine: 'Creepy_Cafetorium_spread_20&21' },
    { fileSpread: '24', readerStart: 24, readerEnd: 25, stateMachine: 'Creepy_Cafetorium_spread_22&23' },
    { fileSpread: '26', readerStart: 26, readerEnd: 27, stateMachine: 'Creepy_Cafetorium_spread_24&25' },
    { fileSpread: '28', readerStart: 28, readerEnd: 29, stateMachine: 'Creepy_Cafetorium_spread_26&27' },
    { fileSpread: '30', readerStart: 30, readerEnd: 31, stateMachine: 'Creepy_Cafetorium_spread_28&29' },
    { fileSpread: '32', readerStart: 32, readerEnd: 32, stateMachine: 'Creepy_Cafetorium_spread_30' },
  ].map(({ fileSpread, readerEnd, readerStart, stateMachine }) => ({
    file: `rive/CreepyCafetorium_74774/creepy_cafetorium_spread_${fileSpread}.riv`,
    label:
      readerStart === readerEnd || fileSpread.includes('-')
        ? `spread ${fileSpread}`
        : `spread ${fileSpread}-${String(readerEnd).padStart(2, '0')}`,
    readerEnd,
    readerStart,
    stateMachine,
  }))
}

const EPIC_1TRIBE_BOOK_CONFIGS: Record<number, EpicTribeBookConfig> = {
  [ICAN_FIND_IT_BOOK_ID]: {
    bookId: ICAN_FIND_IT_BOOK_ID,
    defaultParams: ICAN_FIND_IT_READER_DEFAULTS,
    nativePassthroughLeftPages: [0],
    nativePassthroughRightPages: [25],
    previewFiles: createIcanFindItPreviewFiles(),
    riveFolder: 'ICanFindIt_83936',
    title: 'I Can Find It',
    wordHotspotFolder: 'ICanFindIt_83936',
  },
  [HUMMINGBIRD_BOOK_ID]: {
    bookId: HUMMINGBIRD_BOOK_ID,
    defaultParams: HUMMINGBIRD_READER_DEFAULTS,
    nativePassthroughLeftPages: [0],
    nativePassthroughRightPages: [35],
    previewFiles: createHummingbirdPreviewFiles(),
    readAlongTranscriptFile: 'hummingbird-83230-transcript.json',
    riveFolder: 'TheWildLifeHummingbirdforaDay_83230',
    title: 'Hummingbird For A Day',
    wordHotspotFolder: 'TheWildLifeHummingbirdforaDay_83230',
  },
  [CREEPY_CAFETORIUM_BOOK_ID]: {
    bookId: CREEPY_CAFETORIUM_BOOK_ID,
    defaultParams: CREEPY_CAFETORIUM_READER_DEFAULTS,
    nativePassthroughLeftPages: [],
    nativePassthroughRightPages: [32],
    previewFiles: createCreepyCafetoriumPreviewFiles(),
    readAlongTranscriptFile: 'creepy-cafetorium-74774-transcript.json',
    riveFolder: 'CreepyCafetorium_74774',
    title: 'Creepy Cafetorium',
    wordHotspotFolder: 'CreepyCafetorium_74774',
  },
}

export function isEpicReaderHost(): boolean {
  return window.location.hostname.endsWith('getepic.dev') || window.location.hostname.endsWith('getepic.com')
}

export function getEpicTribeBookConfig(bookId: unknown = getEpicReaderBookIdFromUrl()): EpicTribeBookConfig | null {
  const numericBookId = Number(bookId)
  if (!Number.isFinite(numericBookId)) return null

  return EPIC_1TRIBE_BOOK_CONFIGS[Math.trunc(numericBookId)] || null
}

export function getSupportedTribeRiveFolders(): string[] {
  return Object.values(EPIC_1TRIBE_BOOK_CONFIGS).map((config) => config.riveFolder)
}

export function getEpicReaderBookIdFromUrl(): number | null {
  const match = window.location.pathname.match(/\/app\/read\/(\d+)/)
  if (!match) return null

  const bookId = Number(match[1])
  return Number.isFinite(bookId) && bookId > 0 ? bookId : null
}
