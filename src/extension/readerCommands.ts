export type ReaderCommand =
  | 'openDrawer'
  | 'closeDrawer'
  | 'openModal'
  | 'closeModal'
  | 'pageForward'
  | 'pageBack'
  | 'goToPage'
  | 'nextPage'
  | 'previousPage'
  | 'lookup_word'

export type EpicPageNavigationCommand = 'nextPage' | 'previousPage'

export interface RiveAction {
  name: string
  properties?: Record<string, unknown>
  source: 'rive-event' | 'rive-state' | 'nav-gutter'
}

const actionToCommand: Record<string, ReaderCommand> = {
  drawer: 'openDrawer',
  opendrawer: 'openDrawer',
  open_drawer: 'openDrawer',
  close: 'closeDrawer',
  closedrawer: 'closeDrawer',
  close_drawer: 'closeDrawer',
  modal: 'openModal',
  openmodal: 'openModal',
  open_modal: 'openModal',
  closemodal: 'closeModal',
  close_modal: 'closeModal',
  next: 'pageForward',
  forward: 'pageForward',
  pageforward: 'pageForward',
  page_forward: 'pageForward',
  pagenext: 'pageForward',
  page_next: 'pageForward',
  nextpage: 'pageForward',
  next_page: 'pageForward',
  nextpagecommand: 'pageForward',
  goforward: 'pageForward',
  go_forward: 'pageForward',
  gonext: 'pageForward',
  go_next: 'pageForward',
  back: 'pageBack',
  previous: 'pageBack',
  prev: 'pageBack',
  backward: 'pageBack',
  pageback: 'pageBack',
  page_back: 'pageBack',
  pageprevious: 'pageBack',
  page_previous: 'pageBack',
  backpage: 'pageBack',
  back_page: 'pageBack',
  previouspage: 'pageBack',
  previous_page: 'pageBack',
  goback: 'pageBack',
  go_back: 'pageBack',
  lookup_word: 'lookup_word',
  lookupword: 'lookup_word',
  look_up_word: 'lookup_word',
  word_lookup: 'lookup_word',
  wordlookup: 'lookup_word',
  define: 'lookup_word',
  definition: 'lookup_word',
}

function getPageNavigationCommand(actionName: string): ReaderCommand | null {
  const normalized = normalizeActionName(actionName)
  const forwardPattern = /^(next|forward|pageforward|page_forward|pagenext|page_next|nextpage|next_page|goforward|go_forward|gonext|go_next|pagegoforward|page_go_forward|pagegonext|page_go_next)(?:_?\d+)?$/
  const backPattern = /^(back|previous|prev|backward|pageback|page_back|pageprevious|page_previous|backpage|back_page|goback|go_back|pagegoback|page_go_back|pagegoprevious|page_go_previous|pagegoprev|page_go_prev)(?:_?\d+)?$/

  if (forwardPattern.test(normalized)) {
    return 'pageForward'
  }
  if (backPattern.test(normalized)) {
    return 'pageBack'
  }

  return null
}

export function isPageNavigationCommand(
  command: ReaderCommand,
): command is 'pageForward' | 'pageBack' | 'nextPage' | 'previousPage' {
  return command === 'pageForward' || command === 'pageBack' || command === 'nextPage' || command === 'previousPage'
}

export function getPageNavigationDirection(command: ReaderCommand): number | null {
  if (command === 'pageForward' || command === 'nextPage') return 1
  if (command === 'pageBack' || command === 'previousPage') return -1
  return null
}

export function getEpicPageNavigationCommand(command: ReaderCommand): EpicPageNavigationCommand | null {
  const direction = getPageNavigationDirection(command)
  if (direction === 1) return 'nextPage'
  if (direction === -1) return 'previousPage'
  return null
}

function getLookupWordCommand(actionName: string): ReaderCommand | null {
  return /^(?:lookup[_\s-]?word|lookupword|word[_\s-]?lookup|define|definition)(?:[:=\s_-].+)?$/i.test(
    actionName.trim(),
  )
    ? 'lookup_word'
    : null
}

function normalizeActionName(name: string): string {
  return name.trim().replace(/[\s-]/g, '_').toLowerCase()
}

function getRiveEventPayload(event: RiveRuntimeEvent): { name?: string; properties?: Record<string, unknown> } {
  const data = event.data
  if (!data || typeof data !== 'object' || !('name' in data)) {
    return {}
  }

  const payload = data as { name?: unknown; properties?: unknown }
  return {
    name: typeof payload.name === 'string' ? payload.name : undefined,
    properties:
      payload.properties && typeof payload.properties === 'object'
        ? (payload.properties as Record<string, unknown>)
        : undefined,
  }
}

export function getCommand(action: RiveAction): ReaderCommand | null {
  const normalized = normalizeActionName(action.name)
  return actionToCommand[normalized] || getPageNavigationCommand(action.name) || getLookupWordCommand(action.name)
}

export function cleanLookupWord(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const word = value.trim().replace(/^["']|["']$/g, '')
  return word.length > 0 ? word : null
}

export function getLookupWordPayload(action: RiveAction): string | null {
  const keys = ['word', 'lookupWord', 'lookup_word', 'term', 'text', 'value', 'label']

  for (const key of keys) {
    const word = cleanLookupWord(action.properties?.[key])
    if (word) return word
  }

  const match = action.name
    .trim()
    .match(/^(?:lookup[_\s-]?word|lookupword|word[_\s-]?lookup|define|definition)[:=\s_-]+(.+)$/i)
  if (!match) return null

  return cleanLookupWord(match[1]?.replace(/_/g, ' '))
}

export function getModalSize(properties?: Record<string, unknown>): { width: number; height: number } {
  const width = Number(properties?.width)
  const height = Number(properties?.height)

  return {
    width: Number.isFinite(width) && width > 0 ? width : 960,
    height: Number.isFinite(height) && height > 0 ? height : 640,
  }
}
