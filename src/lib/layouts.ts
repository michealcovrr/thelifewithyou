export type LayoutType =
  | 'full'
  | 'side-by-side'
  | 'top-bottom'
  | 'trio-row'
  | 'one-two'
  | 'two-one'
  | 'quad'
  | 'hero-strip'

export interface PageSlot {
  id: string
  photoUrl: string | null
  caption: string | null
  objectPosition?: { x: number; y: number }
}

export interface TextBlock {
  id: string
  content: string
  x: number          // % from left (0–100)
  y: number          // % from top (0–100)
  fontSize: number   // 1=XS … 5=XL
  fontFamily: 'serif' | 'sans-serif'
  color: string
  textAlign: 'left' | 'center' | 'right'
  bold: boolean
  italic: boolean
}

export interface BookPage {
  id: string
  layoutType: LayoutType
  slots: PageSlot[]
  background: string
  notes: string[]
  textBlocks: TextBlock[]
}

export interface BookLayout {
  pages: BookPage[]
}

export interface LayoutTemplate {
  type: LayoutType
  label: string
  slotCount: number
  icon: string
  gridAreas: string
  gridTemplate: string
}

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  { type: 'full',         label: 'Full page',    slotCount: 1, icon: '⬛', gridAreas: '"a"',          gridTemplate: 'grid-cols-1 grid-rows-1' },
  { type: 'side-by-side', label: 'Side by side', slotCount: 2, icon: '▪▪', gridAreas: '"a b"',         gridTemplate: 'grid-cols-2 grid-rows-1' },
  { type: 'top-bottom',   label: 'Top & bottom', slotCount: 2, icon: '▬',  gridAreas: '"a" "b"',       gridTemplate: 'grid-cols-1 grid-rows-2' },
  { type: 'trio-row',     label: '3 in a row',   slotCount: 3, icon: '▪▪▪',gridAreas: '"a b c"',       gridTemplate: 'grid-cols-3 grid-rows-1' },
  { type: 'one-two',      label: '1 + 2',        slotCount: 3, icon: '▬▪', gridAreas: '"a b" "a c"',   gridTemplate: 'grid-cols-2 grid-rows-2' },
  { type: 'two-one',      label: '2 + 1',        slotCount: 3, icon: '▪▬', gridAreas: '"a c" "b c"',   gridTemplate: 'grid-cols-2 grid-rows-2' },
  { type: 'quad',         label: '4 grid',       slotCount: 4, icon: '▪▪', gridAreas: '"a b" "c d"',   gridTemplate: 'grid-cols-2 grid-rows-2' },
  { type: 'hero-strip',   label: 'Hero + strip', slotCount: 3, icon: '▬',  gridAreas: '"a a" "b c"',   gridTemplate: 'grid-cols-2 grid-rows-2' },
]

export function getTemplate(type: LayoutType): LayoutTemplate {
  return LAYOUT_TEMPLATES.find(t => t.type === type) ?? LAYOUT_TEMPLATES[0]
}

export function makeSlots(count: number): PageSlot[] {
  return Array.from({ length: count }, () => ({ id: crypto.randomUUID(), photoUrl: null, caption: null }))
}

export function makeBlankPage(layoutType: LayoutType = 'full'): BookPage {
  const template = getTemplate(layoutType)
  return {
    id: crypto.randomUUID(),
    layoutType,
    slots: makeSlots(template.slotCount),
    background: '#ffffff',
    notes: [],
    textBlocks: [],
  }
}

// ── Spread helpers ────────────────────────────────────────────────────────────

export interface Spread {
  left:  BookPage | null   // null = IFC/IBC placeholder (not editable)
  right: BookPage | null
  leftIndex:  number | null  // index into layout.pages
  rightIndex: number | null
  leftLabel:  string | null  // display label e.g. "Inner cover"
  rightLabel: string | null
}

/** Build the spread list from a flat pages array.
 *  Structure: [IFC | p1], [p2 | p3], [p4 | p5], ...
 */
export function buildSpreads(pages: BookPage[]): Spread[] {
  const spreads: Spread[] = []

  // First spread: inner front cover (non-editable) + page 1
  spreads.push({
    left: null, right: pages[0] ?? null,
    leftIndex: null, rightIndex: 0,
    leftLabel: 'Inner cover', rightLabel: pages[0] ? 'Page 1' : null,
  })

  // Remaining pages in pairs
  for (let i = 1; i < pages.length; i += 2) {
    spreads.push({
      left: pages[i],   right: pages[i + 1] ?? null,
      leftIndex: i,     rightIndex: pages[i + 1] ? i + 1 : null,
      leftLabel: `Page ${i + 1}`,
      rightLabel: pages[i + 1] ? `Page ${i + 2}` : null,
    })
  }

  return spreads
}

// ── Grid CSS helpers ──────────────────────────────────────────────────────────

export function getGridCols(type: LayoutType) {
  switch (type) {
    case 'full':          return '1fr'
    case 'side-by-side':  return '1fr 1fr'
    case 'top-bottom':    return '1fr'
    case 'trio-row':      return '1fr 1fr 1fr'
    case 'one-two':       return '3fr 2fr'
    case 'two-one':       return '2fr 3fr'
    case 'quad':          return '1fr 1fr'
    case 'hero-strip':    return '1fr 1fr'
    default:              return '1fr'
  }
}

export function getGridRows(type: LayoutType) {
  switch (type) {
    case 'full':          return '1fr'
    case 'side-by-side':  return '1fr'
    case 'top-bottom':    return '1fr 1fr'
    case 'trio-row':      return '1fr'
    case 'one-two':       return '1fr 1fr'
    case 'two-one':       return '1fr 1fr'
    case 'quad':          return '1fr 1fr'
    case 'hero-strip':    return '3fr 2fr'
    default:              return '1fr'
  }
}

// Physical dimensions in inches — used to calculate bleed guide percentages
export const BOOK_DIMS: Record<string, [number, number]> = {
  'square-7x7':      [7,  7],
  'portrait-8x10':   [8,  10],
  'landscape-10x8':  [10, 8],
  'square-12x12':    [12, 12],
  'landscape-13x11': [13, 11],
}
