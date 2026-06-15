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
  riveWordHotspotUseOcrJson: '1',
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

const HUMMINGBIRD_READER_DEFAULTS: Record<string, string> = {
  ...EPIC_1TRIBE_READER_DEFAULTS,
  tribeCommandHarnessWordFinder: '0',
  tribeCommandHarnessForwardPreload: '0',
  tribeCommandHarnessUseEpicBookFrame: '0',
  tribeCommandHarnessUseEpicNativeShell: '0',
  tribeCommandHarnessUseOwnBookFrame: '1',
  tribeCommandHarnessOwnBookFrameAspect: '1.3722222222',
  tribeCommandHarnessEdgeNavPct: '8',
  tribeCommandHarnessPageInAnimation: 'Page_in',
  tribeCommandHarnessPageOutAnimation: 'Page_Next',
  tribeCommandHarnessPageBackAnimation: 'Page_Prev02',
  tribeCommandHarnessBackIdleAnimation: 'idle',
  tribeReadAlong: '0',
  simpleRiveOverlay: '1',
  riveFolder: 'TheWildLifeHummingbirdforaDay_83230',
  rivePageTurnForwardOutAnimation: 'Page_Next',
  rivePageTurnBackOutAnimation: 'Page_Prev02',
  rivePageTurnInAnimation: 'Page_in',
  rivePageTurnIdleAnimation: 'idle',
  riveStackPageFiles: '0',
  riveStackTransitionPages: '0',
  rivePreloadAdjacentUnderlay: '0',
  riveDpr: '0.5',
  riveMaxPixels: '700000',
}

const CREEPY_CAFETORIUM_READER_DEFAULTS: Record<string, string> = {
  ...EPIC_1TRIBE_READER_DEFAULTS,
  tribeCommandHarnessWordFinder: '0',
  tribeCommandHarnessForwardPreload: '0',
  tribeCommandHarnessPageInAnimation: 'Page_In',
  tribeCommandHarnessPageOutAnimation: 'Page_next',
  tribeCommandHarnessPageBackAnimation: 'Page_Prev',
  tribeCommandHarnessBackIdleAnimation: 'idle',
  tribeReadAlong: '0',
  simpleRiveOverlay: '1',
  riveFolder: 'CreepyCafetorium_74774',
  rivePageTurnForwardOutAnimation: 'Page_next',
  rivePageTurnBackOutAnimation: 'Page_Prev',
  rivePageTurnInAnimation: 'Page_In',
  rivePageTurnIdleAnimation: 'idle',
  riveStackTransitionPages: '0',
  rivePreloadAdjacentUnderlay: '0',
  riveDpr: '0.5',
  riveMaxPixels: '700000',
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
    '00-01',
    '02-03',
    '04-05',
    '06-07',
    '08-09',
    '10-11',
    '12-13',
    '14-15',
    '16-17',
    '20-21',
    '22-23',
    '24-25',
    '26-27',
    '28-29',
    '30',
  ].map((spread) => {
    const [startText, endText] = spread.split('-')
    const readerStart = Number(startText)
    const readerEnd = endText === undefined ? readerStart : Number(endText)
    const stateMachine =
      endText === undefined
        ? `Creepy_Cafetorium_spread_${startText}`
        : `Creepy_Cafetorium_spread_${startText}&${endText}`

    return {
      file: `rive/CreepyCafetorium_74774/creepy_cafetorium_spread_${spread}.riv`,
      label: `spread ${spread}`,
      readerEnd,
      readerStart,
      stateMachine,
    }
  })
}

const EPIC_1TRIBE_BOOK_CONFIGS: Record<number, EpicTribeBookConfig> = {
  [ICAN_FIND_IT_BOOK_ID]: {
    bookId: ICAN_FIND_IT_BOOK_ID,
    defaultParams: EPIC_1TRIBE_READER_DEFAULTS,
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
    riveFolder: 'TheWildLifeHummingbirdforaDay_83230',
    title: 'Hummingbird For A Day',
    wordHotspotFolder: '',
  },
  [CREEPY_CAFETORIUM_BOOK_ID]: {
    bookId: CREEPY_CAFETORIUM_BOOK_ID,
    defaultParams: CREEPY_CAFETORIUM_READER_DEFAULTS,
    nativePassthroughLeftPages: [0],
    nativePassthroughRightPages: [30],
    previewFiles: createCreepyCafetoriumPreviewFiles(),
    riveFolder: 'CreepyCafetorium_74774',
    title: 'Creepy Cafetorium',
    wordHotspotFolder: '',
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
