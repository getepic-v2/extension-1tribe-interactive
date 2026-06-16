export type SlotName = 'reading-area' | 'drawer' | 'modal'

export type ExtensionEventName =
  | 'pageChange'
  | 'pageTurnStart'
  | 'drawerStateChange'
  | 'modalStateChange'

export interface BookData {
  id?: number
  title?: string
  type?: number
  author?: string
  numPages?: number
  labData?: string
  aspectRatio?: number
  bookDescription?: string
  [key: string]: unknown
}

export interface FlipBookRect {
  x: number
  y: number
  width: number
  height: number
}

export interface WordTimingEntry {
  text?: string
  time?: string | number
  duration?: string | number
  bbox?: {
    x1?: number
    y1?: number
    x2?: number
    y2?: number
    width?: number
    height?: number
    [key: string]: unknown
  }
  coords?: number[]
  [key: string]: unknown
}

export interface WordTimingData {
  word_data?: WordTimingEntry[]
  [key: string]: unknown
}

export interface ExtensionContext {
  version: string
  analytics: {
    log(eventName: string, params?: Record<string, unknown>): void
  }
  slots: {
    get(slotName: SlotName): ShadowRoot
  }
  data: {
    getBookId(): number | undefined
    getBookData(): BookData
    getCurrentPage(): number
    getLabsData(): string | null
    getFlipBookRect(): FlipBookRect | null
    getPageAudioUrl?(pageIndex: number): string
    getWordTimingData?(pageIndex: number): Promise<WordTimingData | null>
  }
  commands: {
    execute(
      command:
        | 'openDrawer'
        | 'closeDrawer'
        | 'openModal'
        | 'closeModal'
        | 'pageForward'
        | 'pageBack'
        | 'goToPage'
        | 'nextPage'
        | 'previousPage'
        | 'lookup_word',
      payload?: unknown,
    ): void
  }
  events: {
    on(eventName: ExtensionEventName, handler: (payload?: unknown) => void): () => void
  }
}

export interface Extension {
  activate(context: ExtensionContext): () => void
}

