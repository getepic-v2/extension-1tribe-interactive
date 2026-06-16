import type { ExtensionContext, FlipBookRect } from './types'

interface SimpleRiveFileRuntimeDeps {
  getBooleanParam(name: string, fallback: boolean): boolean
  getStringParam(name: string): string | null
  getExtensionScriptUrl(): string
}

let simpleRiveFileRuntimeDeps: SimpleRiveFileRuntimeDeps = {
  getBooleanParam: (_name, fallback) => fallback,
  getStringParam: () => null,
  getExtensionScriptUrl: () => window.location.href,
}

export function configureSimpleRiveFiles(deps: SimpleRiveFileRuntimeDeps): void {
  simpleRiveFileRuntimeDeps = deps
}

function getBooleanParam(name: string, fallback: boolean): boolean {
  return simpleRiveFileRuntimeDeps.getBooleanParam(name, fallback)
}

function getStringParam(name: string): string | null {
  return simpleRiveFileRuntimeDeps.getStringParam(name)
}

function getSimpleRiveExtensionScriptUrl(): string {
  return simpleRiveFileRuntimeDeps.getExtensionScriptUrl()
}

export interface SimpleRiveFile {
  bookId: number | null
  folder: string | null
  name: string
  pages: [number, number] | null
  readerPages: number[] | null
  animation?: string | null
  stateMachine?: string | null
  artboard?: string | null
  url: string
}

export interface SimpleRiveContents {
  artboards?: Array<{
    name: string
    animations?: string[]
    stateMachines?: Array<{
      name: string
    }>
  }>
}

export interface SimpleRiveAnimationEntry {
  artboard: string
  animation: string
}

export interface SimpleRiveStateMachineEntry {
  artboard: string
  stateMachine: string
}

export function getSimpleRiveFileSource(file: string): string {
  return new URL(file, getSimpleRiveExtensionScriptUrl()).href
}

export function parseSimpleRivePages(value: string): [number, number] | null {
  const decoded = (() => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  })()
  const fileName = decoded.replace(/^.*[/\\]/, '').replace(/\.riv$/i, '')
  const normalized = fileName.replace(/[_\s]+/g, '-')
  const matches = Array.from(normalized.matchAll(/0*(\d{1,3})\s*(?:-|&|and)\s*0*(\d{1,3})/gi))
  const match = matches.at(-1)
  if (!match) {
    const singlePageMatch = normalized.match(/(?:^|-)0*(\d{1,3})$/)
    if (!singlePageMatch) return null

    const page = Number(singlePageMatch[1])
    return Number.isFinite(page) ? [page, page] : null
  }

  const start = Number(match[1])
  const end = Number(match[2])
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null

  return [Math.min(start, end), Math.max(start, end)]
}

export function getSimpleRiveCompatibilityUrl(rawUrl: string): string | null {
  const decoded = (() => {
    try {
      return decodeURIComponent(rawUrl)
    } catch {
      return rawUrl
    }
  })()
  if (!/[\\/]rive[\\/]ICanFindIt_83936[\\/]/i.test(decoded)) return null
  if (!/(Epic_I_Can_Find_It_|sdk_icanfindit_spread_)/i.test(decoded)) return null

  const pages = parseSimpleRivePages(decoded)
  if (!pages) return null

  const [start, end] = pages
  const prefix = decoded.replace(/[^/\\]+$/, '')
  const padPage = (page: number) => String(page).padStart(2, '0')
  return `${prefix}83936_spread_${padPage(start || end)}.riv`
}
export function parseSimpleRiveBookId(value: string): number | null {
  const decoded = (() => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  })()
  const segments = decoded.split(/[\\/]/).filter(Boolean).reverse()

  for (const segment of segments) {
    const match = segment.match(/(?:^|_)(\d{5,})(?:$|[_\-.])/)
    if (!match) continue

    const bookId = Number(match[1])
    if (Number.isFinite(bookId)) return bookId
  }

  return null
}

export function getSimpleRiveFileLabel(file: string): string {
  return file.replace(/^.*\//, '')
}

export function getPageStateMachineNameCandidates(pages: [number, number] | null): string[] {
  if (!pages) return []

  const start = String(pages[0]).padStart(2, '0')
  const end = String(pages[1]).padStart(2, '0')
  const candidates = [`Page_${start}_${end}`]

  if (pages[0] === 0 && pages[1] === 1) {
    candidates.unshift('Page_01')
  }

  if (pages[0] === pages[1]) {
    candidates.unshift(`Page_${end}`)
  }

  return Array.from(new Set(candidates))
}

export function getPageAnimationNameCandidates(pages: [number, number] | null): string[] {
  if (!pages) return []

  const start = String(pages[0]).padStart(2, '0')
  const end = String(pages[1]).padStart(2, '0')
  const candidates = [
    `Page Turn${start}`,
    `Page Turn ${start}`,
    `Page_Turn${start}`,
    `Page_Turn_${start}`,
    `PageTurn${start}`,
    `Page_${start}`,
    `Page_${start}_${end}`,
  ]

  if (pages[0] !== pages[1]) {
    candidates.push(
      `Page Turn${end}`,
      `Page Turn ${end}`,
      `Page_Turn${end}`,
      `Page_Turn_${end}`,
      `PageTurn${end}`,
    )
  }

  return Array.from(new Set(candidates))
}

export function normalizeRiveNameForMatch(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

export function getRiveAnimationNameMatchKeys(name: string | null): string[] {
  if (!name) return []

  const normalizedName = normalizeRiveNameForMatch(name)
  const keys = new Set<string>([normalizedName])
  const add = (...aliases: string[]) => {
    for (const alias of aliases) {
      keys.add(normalizeRiveNameForMatch(alias))
    }
  }

  if (['pagenext', 'next', 'pageforward', 'forward', 'pageout'].includes(normalizedName)) {
    add('Page_Next', 'Page_next', 'Next', 'Page_out')
  }

  if (['pageprev', 'prev', 'pageprevious', 'previous', 'pageback', 'back', 'pagegoback', 'goback'].includes(normalizedName)) {
    add('Page_Prev', 'Page_prev', 'Prev', 'Page_go back')
  }

  if (['pagein', 'in'].includes(normalizedName)) {
    add('Page_in', 'Page_In')
  }

  if (['pageidle', 'idle'].includes(normalizedName)) {
    add('idle', 'Idle', 'Page_idle')
  }

  return Array.from(keys)
}

export function getRiveAnimationInputNameCandidates(name: string | null): string[] {
  if (!name) return []

  const normalizedName = normalizeRiveNameForMatch(name)
  const candidates = new Map<string, string>()
  const add = (...names: string[]) => {
    for (const candidate of names) {
      if (!candidate) continue
      const key = normalizeRiveNameForMatch(candidate)
      if (!candidates.has(key)) candidates.set(key, candidate)
    }
  }

  add(name)

  if (['pagenext', 'next', 'pageforward', 'forward', 'pageout'].includes(normalizedName)) {
    add('Next', 'Page_next', 'Page_Next', 'Page_out', 'Page_Out')
  }

  if (['pagein', 'in'].includes(normalizedName)) {
    add('Page_in', 'Page_In', 'In')
  }

  if (['pageprev', 'prev', 'pageprevious', 'previous', 'pageback', 'back', 'pagegoback', 'goback'].includes(normalizedName)) {
    add('Back', 'Prev', 'Page_go back', 'Page_Go_Back', 'Page_back', 'Page_Back')
  }

  if (['pageidle', 'idle'].includes(normalizedName)) {
    add('idle', 'Idle', 'Page_idle')
  }

  return Array.from(candidates.values())
}

export function isRiveAnimationNameMatch(animationName: string, requestedName: string | null): boolean {
  if (!requestedName) return false

  const requested = requestedName.trim()
  const animation = animationName.trim()
  if (animation.toLowerCase() === requested.toLowerCase()) return true

  const requestedKeys = getRiveAnimationNameMatchKeys(requested)
  return requestedKeys.includes(normalizeRiveNameForMatch(animation))
}

export function isExactRiveAnimationNameMatch(animationName: string, requestedName: string | null): boolean {
  return Boolean(requestedName && animationName.trim().toLowerCase() === requestedName.trim().toLowerCase())
}

export function getSimpleRiveAnimationEntry(
  contents: SimpleRiveContents,
  file: SimpleRiveFile,
  requestedName: string | null,
  shouldAutoSelect: boolean,
  requestedArtboard: string | null,
): SimpleRiveAnimationEntry | null {
  const artboards = contents.artboards || []
  const findByName = (name: string | null): SimpleRiveAnimationEntry | null => {
    if (!name) return null

    for (const artboard of artboards) {
      if (requestedArtboard && artboard.name !== requestedArtboard) continue

      for (const animation of artboard.animations || []) {
        if (isRiveAnimationNameMatch(animation, name)) {
          return {
            artboard: artboard.name,
            animation,
          }
        }
      }
    }

    return null
  }

  const explicitMatch = shouldAutoSelect ? null : findByName(requestedName)
  if (explicitMatch) return explicitMatch

  for (const pageAnimationName of getPageAnimationNameCandidates(file.pages)) {
    const pageMatch = findByName(pageAnimationName)
    if (pageMatch) return pageMatch
  }

  if (!shouldAutoSelect) return null

  for (const artboard of artboards) {
    if (requestedArtboard && artboard.name !== requestedArtboard) continue

    const animation = artboard.animations?.[0]
    if (animation) {
      return {
        artboard: artboard.name,
        animation,
      }
    }
  }

  return null
}

export function getSimpleRiveStateMachineEntry(
  contents: SimpleRiveContents,
  file: SimpleRiveFile,
  requestedName: string | null,
  shouldAutoSelect: boolean,
  requestedArtboard: string | null,
): SimpleRiveStateMachineEntry | null {
  const artboards = contents.artboards || []
  const findByName = (name: string | null): SimpleRiveStateMachineEntry | null => {
    if (!name) return null

    const normalizedName = name.toLowerCase()
    for (const artboard of artboards) {
      if (requestedArtboard && artboard.name !== requestedArtboard) continue

      for (const stateMachine of artboard.stateMachines || []) {
        if (stateMachine.name.toLowerCase() === normalizedName) {
          return {
            artboard: artboard.name,
            stateMachine: stateMachine.name,
          }
        }
      }
    }

    return null
  }

  const pageStateMachineNames = getPageStateMachineNameCandidates(file.pages)
  const explicitMatch = shouldAutoSelect ? null : findByName(requestedName)
  if (explicitMatch) return explicitMatch

  for (const pageStateMachineName of pageStateMachineNames) {
    const pageMatch = findByName(pageStateMachineName)
    if (pageMatch) return pageMatch
  }

  if (!shouldAutoSelect) return null

  for (const artboard of artboards) {
    if (requestedArtboard && artboard.name !== requestedArtboard) continue

    const stateMachine = artboard.stateMachines?.[0]
    if (stateMachine) {
      return {
        artboard: artboard.name,
        stateMachine: stateMachine.name,
      }
    }
  }

  return null
}

export function listSimpleRiveStateMachines(contents: SimpleRiveContents): string {
  return (
    contents.artboards
      ?.flatMap((artboard) => (artboard.stateMachines || []).map((stateMachine) => `${artboard.name} / ${stateMachine.name}`))
      .join(', ') || 'none'
  )
}

export function listSimpleRiveAnimations(contents: SimpleRiveContents): string {
  return (
    contents.artboards
      ?.flatMap((artboard) => (artboard.animations || []).map((animation) => `${artboard.name} / ${animation}`))
      .join(', ') || 'none'
  )
}

export function getSimpleRiveAnimationNames(contents: SimpleRiveContents): string[] {
  const names = contents.artboards?.flatMap((artboard) => artboard.animations || []) || []
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
}

export function expandPageRange(pages: [number, number]): number[] {
  const start = Math.floor(pages[0])
  const end = Math.floor(pages[1])
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return []

  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

export function getSimpleRiveFilesFromParams(): SimpleRiveFile[] | null {
  const forcedFile = getStringParam('riveFile')?.trim()
  if (forcedFile) {
    const label = getStringParam('riveLabel')?.trim() || forcedFile
    const pages = (parseSimpleRivePages(label) ||
      parseSimpleRivePages(forcedFile) || [1, Number.MAX_SAFE_INTEGER]) as [number, number]

    return [
      {
        bookId: parseSimpleRiveBookId(label) || parseSimpleRiveBookId(forcedFile),
        folder: null,
        name: label,
        pages,
        readerPages: pages[1] === Number.MAX_SAFE_INTEGER ? null : expandPageRange(pages),
        animation: getStringParam('riveAnimation')?.trim() || null,
        stateMachine: getStringParam('riveStateMachine')?.trim() || null,
        artboard: getStringParam('riveArtboard')?.trim() || null,
        url: getSimpleRiveFileSource(forcedFile),
      },
    ]
  }

  const forcedFiles = getStringParam('riveFiles')
    ?.split(',')
    .map((file) => file.trim())
    .filter(Boolean)

  if (!forcedFiles?.length) return null

  return forcedFiles.map((file) => {
    const pages = parseSimpleRivePages(file)
    return {
      bookId: parseSimpleRiveBookId(file),
      folder: null,
      name: getSimpleRiveFileLabel(file),
      pages,
      readerPages: pages ? expandPageRange(pages) : null,
      animation: null,
      stateMachine: null,
      artboard: null,
      url: getSimpleRiveFileSource(file),
    }
  })
}

export function getStringField(item: Record<string, unknown>, names: string[]): string | null {
  for (const name of names) {
    const value = item[name]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return null
}

export function getNumberArrayField(item: Record<string, unknown>, names: string[]): number[] | null {
  for (const name of names) {
    const value = item[name]
    if (!Array.isArray(value)) continue

    const values = value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
    if (values.length) return Array.from(new Set(values)).sort((a, b) => a - b)
  }

  return null
}

export function getPageRangeField(item: Record<string, unknown>, names: string[]): [number, number] | null {
  for (const name of names) {
    const value = item[name]
    if (!Array.isArray(value) || value.length < 2) continue

    const start = Number(value[0])
    const end = Number(value[1])
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return [Math.min(start, end), Math.max(start, end)]
    }
  }

  return null
}

export function getFolderFromRiveUrl(url: string): string | null {
  const parts = url.split(/[\\/]/).filter(Boolean)
  const riveIndex = parts.findIndex((part) => part === 'rive')
  return riveIndex >= 0 && parts[riveIndex + 1] ? parts[riveIndex + 1] : null
}

export function normalizeSimpleRiveFile(file: unknown, listUrl: string): SimpleRiveFile | null {
  if (!file || typeof file !== 'object') return null

  const item = file as Record<string, unknown>
  const rawUrl = getStringField(item, ['url', 'file', 'riveFile'])
  if (!rawUrl) return null

  const fileUrl = getSimpleRiveCompatibilityUrl(rawUrl) || rawUrl
  const folder = getStringField(item, ['folder']) || getFolderFromRiveUrl(fileUrl) || getFolderFromRiveUrl(rawUrl)
  const name = getStringField(item, ['name', 'label']) || getSimpleRiveFileLabel(fileUrl)
  const explicitBookId = Number(item.bookId)
  const explicitPages = getPageRangeField(item, ['pages', 'rivePages'])
  const pages =
    explicitPages && explicitPages.every((page) => Number.isFinite(page))
      ? explicitPages
      : parseSimpleRivePages(name) || parseSimpleRivePages(fileUrl) || parseSimpleRivePages(rawUrl)
  const readerPages = getNumberArrayField(item, ['readerPages', 'readerPageIndexes', 'readerPageIndices'])
  const readerPageIndex = Number(item.readerPageIndex ?? item.readerPage)
  const url = new URL(fileUrl, listUrl).href
  const normalizedReaderPages =
    readerPages ||
    (Number.isFinite(readerPageIndex) ? [readerPageIndex] : pages ? expandPageRange(pages) : null)

  return {
    bookId: Number.isFinite(explicitBookId) ? explicitBookId : parseSimpleRiveBookId(name) || parseSimpleRiveBookId(fileUrl) || parseSimpleRiveBookId(rawUrl),
    folder,
    name,
    pages,
    readerPages: normalizedReaderPages,
    animation: getStringField(item, ['animation', 'riveAnimation']),
    stateMachine: getStringField(item, ['stateMachine']),
    artboard: getStringField(item, ['artboard']),
    url,
  }
}

export function getPageMapEntriesFromBook(bookId: number, bookConfig: unknown, mapUrl: string): SimpleRiveFile[] {
  if (!bookConfig || typeof bookConfig !== 'object') return []

  const config = bookConfig as Record<string, unknown>
  const folder = getStringField(config, ['folder'])
  const readerPageOffset = Number(config.readerPageOffset || 0)
  const pages = config.pages
  if (!pages || typeof pages !== 'object' || Array.isArray(pages)) return []

  const entries: SimpleRiveFile[] = []
  for (const [readerPageIndex, value] of Object.entries(pages as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue

    const item = value as Record<string, unknown>
    const pageNumber = Number(readerPageIndex) + (Number.isFinite(readerPageOffset) ? readerPageOffset : 0)
    const file = getStringField(item, ['file', 'url', 'riveFile'])
    if (!Number.isFinite(pageNumber) || !file) continue

    const normalized = normalizeSimpleRiveFile(
      {
        ...item,
        bookId,
        folder: getStringField(item, ['folder']) || folder,
        url: file,
        readerPageIndex: pageNumber,
        pages: getPageRangeField(item, ['rivePages', 'pages']) || parseSimpleRivePages(file),
      },
      mapUrl,
    )
    if (normalized) entries.push(normalized)
  }

  return entries
}

export function mergeSimpleRiveFileEntries(files: SimpleRiveFile[]): SimpleRiveFile[] {
  const merged = new Map<string, SimpleRiveFile>()

  for (const file of files) {
    const key = [
      file.bookId ?? 'all',
      file.url,
      file.artboard ?? '',
      file.stateMachine ?? '',
      file.animation ?? '',
    ].join('|')
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, {
        ...file,
        readerPages: file.readerPages ? Array.from(new Set(file.readerPages)).sort((a, b) => a - b) : null,
      })
      continue
    }

    const readerPages = Array.from(
      new Set([...(existing.readerPages || []), ...(file.readerPages || [])]),
    ).sort((a, b) => a - b)
    existing.readerPages = readerPages.length ? readerPages : existing.readerPages
    existing.pages = existing.pages || file.pages
    existing.folder = existing.folder || file.folder
    existing.animation = existing.animation || file.animation
    existing.stateMachine = existing.stateMachine || file.stateMachine
    existing.artboard = existing.artboard || file.artboard
  }

  return Array.from(merged.values())
}

export function normalizeRivePageMap(map: unknown, mapUrl: string): SimpleRiveFile[] {
  if (!map || typeof map !== 'object') return []

  const root = map as Record<string, unknown>
  const books = root.books && typeof root.books === 'object' ? (root.books as Record<string, unknown>) : root
  const entries: SimpleRiveFile[] = []

  for (const [bookIdKey, bookConfig] of Object.entries(books)) {
    const bookId = Number(bookIdKey)
    if (!Number.isFinite(bookId)) continue

    entries.push(...getPageMapEntriesFromBook(bookId, bookConfig, mapUrl))
  }

  return mergeSimpleRiveFileEntries(entries)
}

export function getSimpleRiveBookIdFromContext(context: ExtensionContext): number | null {
  const requestedBookId = Number(getStringParam('riveBookId'))
  if (Number.isFinite(requestedBookId) && requestedBookId > 0) return requestedBookId

  const contextBookId = Number(context.data.getBookId())
  if (Number.isFinite(contextBookId) && contextBookId > 0) return contextBookId

  const bookDataId = Number(context.data.getBookData()?.id)
  if (Number.isFinite(bookDataId) && bookDataId > 0) return bookDataId

  const urlMatch = window.location.pathname.match(/\/read\/(\d+)/)
  if (urlMatch) {
    const urlBookId = Number(urlMatch[1])
    if (Number.isFinite(urlBookId) && urlBookId > 0) return urlBookId
  }

  return null
}

export function sortSimpleRiveFiles(files: SimpleRiveFile[]): SimpleRiveFile[] {
  return files.slice().sort((a, b) => {
    const aPage = a.readerPages?.[0] ?? a.pages?.[0] ?? Number.MAX_SAFE_INTEGER
    const bPage = b.readerPages?.[0] ?? b.pages?.[0] ?? Number.MAX_SAFE_INTEGER
    if (aPage !== bPage) return aPage - bPage

    return a.name.localeCompare(b.name)
  })
}

export function filterSimpleRiveFilesForBook(files: SimpleRiveFile[], bookId: number | null): SimpleRiveFile[] {
  const requestedFolder = getStringParam('riveFolder')?.trim()
  if (requestedFolder) {
    return sortSimpleRiveFiles(files.filter((file) => file.folder === requestedFolder))
  }

  if (bookId === null) return sortSimpleRiveFiles(files)

  const matchingFiles = files.filter((file) => file.bookId === bookId)
  if (matchingFiles.length) return sortSimpleRiveFiles(matchingFiles)

  const unscopedFiles = files.filter((file) => file.bookId === null)
  return sortSimpleRiveFiles(unscopedFiles)
}

export function getSimpleRiveFileForPage(
  files: SimpleRiveFile[],
  page: number,
): { file: SimpleRiveFile; index: number } | null {
  const exactReaderPageIndex = files.findIndex((file) => file.readerPages?.includes(page))
  if (exactReaderPageIndex >= 0) {
    return { file: files[exactReaderPageIndex], index: exactReaderPageIndex }
  }

  const index = files.findIndex((file) => {
    if (!file.pages) return false

    return page >= file.pages[0] && page <= file.pages[1]
  })

  return index >= 0 ? { file: files[index], index } : null
}

export function inferSimpleRivePage(files: SimpleRiveFile[], page: number, direction: number): number {
  const match = getSimpleRiveFileForPage(files, page)
  const readerPages = match?.file.readerPages
  if (readerPages?.length) {
    if (direction > 0) return readerPages[readerPages.length - 1] + 1
    return Math.max(0, readerPages[0] - 1)
  }
  if (!match?.file.pages) return Math.max(0, page + direction * 2)

  if (direction > 0) return match.file.pages[1] + 1
  return Math.max(0, match.file.pages[0] - 2)
}

export function getSimpleRiveLastPage(files: SimpleRiveFile[]): number | null {
  const endPages = files
    .map((file) => file.readerPages?.[file.readerPages.length - 1] ?? file.pages?.[1])
    .filter((page): page is number => typeof page === 'number' && Number.isFinite(page))

  return endPages.length ? Math.max(...endPages) : null
}

export function getFirstSimpleRivePage(files: SimpleRiveFile[]): number | null {
  const page = files[0]?.readerPages?.[0] ?? files[0]?.pages?.[0]
  return typeof page === 'number' && Number.isFinite(page) ? page : null
}

export function getNavigationDirectionFromText(value: string): number | null {
  const text = value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .toLowerCase()

  const hasBackDirection = /\b(prev|previous|back|backward|left|arrow left|chevron left|page left)\b/.test(text)
  const hasForwardDirection = /\b(next|forward|right|arrow right|chevron right|page right)\b/.test(text)

  if (hasBackDirection && hasForwardDirection) {
    return null
  }

  if (hasBackDirection) {
    return -1
  }

  if (hasForwardDirection) {
    return 1
  }

  return null
}

export function getNavigationDirectionFromPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null

  const data = payload as Record<string, unknown>
  for (const key of ['direction', 'navigationDirection']) {
    const value = Number(data[key])
    if (value > 0) return 1
    if (value < 0) return -1
  }

  const values = Object.values(payload as Record<string, unknown>)
    .filter((value): value is string => typeof value === 'string')
    .join(' ')

  return getNavigationDirectionFromText(values)
}

export function getReaderPageFromPayload(payload: unknown, fallback: number): number {
  if (!payload || typeof payload !== 'object') return fallback

  const data = payload as Record<string, unknown>
  for (const key of ['pageIndex', 'currentPage', 'page', 'readerPageIndex']) {
    const value = Number(data[key])
    if (Number.isFinite(value)) return value
  }

  return fallback
}

export function getNavigationDescriptor(element: Element, includeAncestors = true): string {
  const parts: string[] = []
  const attributes = [
    'aria-label',
    'title',
    'alt',
    'id',
    'class',
    'data-testid',
    'data-test-id',
    'data-qa',
    'data-cy',
    'role',
  ]

  let current: Element | null = element
  let depth = 0
  const maxDepth = includeAncestors ? 5 : 1
  while (current && depth < maxDepth) {
    for (const attribute of attributes) {
      const value = current.getAttribute(attribute)
      if (value) parts.push(value)
    }

    const text = current.textContent?.trim()
    if (text && text.length <= 80) parts.push(text)

    current = current.parentElement
    depth += 1
  }

  return parts.join(' ')
}

export function getNavigationDirectionFromClick(event: Event, flipBookRect: FlipBookRect | null): number | null {
  if (!(event.target instanceof Element)) return null

  const target = event.target
  if (target.closest('[data-reader-navigation-ignore]')) return null

  const control = target.closest<HTMLElement>(
    'button,a,[role="button"],[aria-label],[title],[data-testid],[data-test-id],[data-qa],[data-cy]',
  )

  if (control) {
    const controlDescriptorDirection = getNavigationDirectionFromText(getNavigationDescriptor(control, false))
    if (controlDescriptorDirection) return controlDescriptorDirection
  }

  const descriptorDirection = getNavigationDirectionFromText(getNavigationDescriptor(target, !control))
  if (descriptorDirection) return descriptorDirection

  if (!control || !(event instanceof MouseEvent) || !flipBookRect) return null

  const controlRect = control.getBoundingClientRect()
  const centerY = controlRect.y + controlRect.height / 2
  const isNearReaderVertically = centerY >= flipBookRect.y - 96 && centerY <= flipBookRect.y + flipBookRect.height + 96
  if (!isNearReaderVertically) return null

  const centerX = controlRect.x + controlRect.width / 2
  if (centerX <= flipBookRect.x + flipBookRect.width * 0.22) return -1
  if (centerX >= flipBookRect.x + flipBookRect.width * 0.78) return 1

  return null
}

export async function loadSimpleRiveFiles(signal: AbortSignal): Promise<SimpleRiveFile[]> {
  const paramFiles = getSimpleRiveFilesFromParams()
  if (paramFiles) return paramFiles

  if (getBooleanParam('rivePageMap', true)) {
    const mapUrl = new URL('rive-page-map.json', getSimpleRiveExtensionScriptUrl()).href
    try {
      const mapResponse = await fetch(mapUrl, {
        cache: 'no-store',
        signal,
      })

      if (mapResponse.ok) {
        const mappedFiles = normalizeRivePageMap(await mapResponse.json(), mapUrl)
        if (mappedFiles.length) {
          console.info(`[1Tribe simple overlay] Loaded explicit Rive page map from ${mapUrl}.`, {
            files: mappedFiles.length,
          })
          return mappedFiles
        }
      } else if (mapResponse.status !== 404) {
        console.warn(`[1Tribe simple overlay] Unable to load ${mapUrl}: HTTP ${mapResponse.status}`)
      }
    } catch (error) {
      if (!signal.aborted) {
        console.warn(`[1Tribe simple overlay] Falling back to rive-files.json after page map error: ${String(error)}`)
      }
    }
  }

  const listUrl = new URL('rive-files.json', getSimpleRiveExtensionScriptUrl()).href
  const response = await fetch(listUrl, {
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading ${listUrl}`)
  }

  const items = (await response.json()) as unknown
  if (!Array.isArray(items)) return []

  return items
    .map((item) => normalizeSimpleRiveFile(item, listUrl))
    .filter((item): item is SimpleRiveFile => Boolean(item))
}
