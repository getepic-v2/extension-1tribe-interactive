export interface WordHotspotBounds {
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface WordHotspotTextSegment {
  bounds: Required<WordHotspotBounds>
  lookupWord: string
  segmentCount: number
  segmentIndex: number
  sourcePhrase: string | null
  sourceWord: string
}

export function getWordHotspotLogicalPage(fallbackPage: number, pages: number[] | null | undefined, bounds: WordHotspotBounds): number {
  const orderedPages = Array.from(
    new Set(
      (pages || [])
        .map((page) => Number(page))
        .filter((page): page is number => Number.isFinite(page))
        .map((page) => Math.trunc(page)),
    ),
  ).sort((first, second) => first - second)
  if (orderedPages.length <= 1) return orderedPages[0] ?? fallbackPage

  const x = Number(bounds.x)
  const width = Number(bounds.width)
  if (!Number.isFinite(x) || !Number.isFinite(width)) return fallbackPage

  const centerX = Math.max(0, Math.min(0.999999, x + width / 2))
  const pageIndex = Math.max(0, Math.min(orderedPages.length - 1, Math.floor(centerX * orderedPages.length)))
  return orderedPages[pageIndex] ?? fallbackPage
}

export function getWordHotspotTextSegments(
  sourceWord: string,
  bounds: Required<WordHotspotBounds>,
): WordHotspotTextSegment[] {
  const sourcePhrase = String(sourceWord || '')
  if (!/[-\u2010-\u2015]/.test(sourcePhrase)) {
    return [
      {
        bounds,
        lookupWord: cleanWordHotspotText(sourcePhrase),
        segmentCount: 1,
        segmentIndex: 0,
        sourcePhrase: null,
        sourceWord: sourcePhrase,
      },
    ]
  }

  const tokens = sourcePhrase.match(/[^-\u2010-\u2015]+|[-\u2010-\u2015]+/g) || []
  const totalUnits = tokens.reduce((total, token) => total + Math.max(1, token.length), 0)
  if (tokens.length < 3 || totalUnits <= 0) {
    return [
      {
        bounds,
        lookupWord: cleanWordHotspotText(sourcePhrase),
        segmentCount: 1,
        segmentIndex: 0,
        sourcePhrase: null,
        sourceWord: sourcePhrase,
      },
    ]
  }

  const segments: WordHotspotTextSegment[] = []
  let offsetUnits = 0
  for (const token of tokens) {
    const tokenUnits = Math.max(1, token.length)
    if (!/^[-\u2010-\u2015]+$/.test(token)) {
      const lookupWord = cleanWordHotspotText(token)
      if (lookupWord) {
        segments.push({
          bounds: {
            ...bounds,
            x: bounds.x + bounds.width * (offsetUnits / totalUnits),
            width: bounds.width * (tokenUnits / totalUnits),
          },
          lookupWord,
          segmentCount: 0,
          segmentIndex: segments.length,
          sourcePhrase,
          sourceWord: token,
        })
      }
    }
    offsetUnits += tokenUnits
  }

  if (segments.length < 2) {
    return [
      {
        bounds,
        lookupWord: cleanWordHotspotText(sourcePhrase),
        segmentCount: 1,
        segmentIndex: 0,
        sourcePhrase: null,
        sourceWord: sourcePhrase,
      },
    ]
  }

  return segments.map((segment) => ({
    ...segment,
    segmentCount: segments.length,
  }))
}

export function normalizeWordHotspotFileName(value: string): string {
  const normalized = value.replace(/\\/g, '/')
  return normalized.split('/').filter(Boolean).at(-1) || normalized
}

export function cleanWordHotspotText(value: string): string {
  return value.replace(/[^A-Za-z0-9'-]+/g, '').trim()
}

export function isSuspectWordHotspotText(value: string): boolean {
  const clean = cleanWordHotspotText(value)
  if (clean.length <= 1) return true
  if (/^\d+$/.test(clean)) return true
  return clean !== value.trim()
}
