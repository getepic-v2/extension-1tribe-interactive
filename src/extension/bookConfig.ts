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
const CURRENT_EPIC_1TRIBE_BOOK_ID = 83936

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

const EPIC_1TRIBE_BOOK_CONFIGS: Record<number, EpicTribeBookConfig> = {
  [CURRENT_EPIC_1TRIBE_BOOK_ID]: {
    bookId: CURRENT_EPIC_1TRIBE_BOOK_ID,
    defaultParams: EPIC_1TRIBE_READER_DEFAULTS,
    previewFiles: createIcanFindItPreviewFiles(),
    riveFolder: 'ICanFindIt_83936',
    title: 'I Can Find It',
    wordHotspotFolder: 'ICanFindIt_83936',
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
