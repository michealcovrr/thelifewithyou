export type LayoutType =
  | 'full'        // 1 photo, full page
  | 'side-by-side' // 2 photos equal
  | 'top-bottom'  // 2 photos stacked
  | 'trio-row'    // 3 equal columns
  | 'one-two'     // 1 large left + 2 small right
  | 'two-one'     // 2 small left + 1 large right
  | 'quad'        // 4 equal grid
  | 'hero-strip'  // 1 large top + 2 small bottom

export interface PageSlot {
  id: string
  photoUrl: string | null
  caption: string | null
  objectPosition?: { x: number; y: number } // percentage 0-100, default 50 50
}

export interface BookPage {
  id: string
  layoutType: LayoutType
  slots: PageSlot[]
  background: string // hex color
  notes: string[]   // editing requests for this page
}

export interface BookLayout {
  pages: BookPage[]
}

export interface LayoutTemplate {
  type: LayoutType
  label: string
  slotCount: number
  icon: string
  // CSS grid areas string for preview
  gridAreas: string
  gridTemplate: string
}

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    type: 'full',
    label: 'Full page',
    slotCount: 1,
    icon: '⬛',
    gridAreas: '"a"',
    gridTemplate: 'grid-cols-1 grid-rows-1',
  },
  {
    type: 'side-by-side',
    label: 'Side by side',
    slotCount: 2,
    icon: '▪▪',
    gridAreas: '"a b"',
    gridTemplate: 'grid-cols-2 grid-rows-1',
  },
  {
    type: 'top-bottom',
    label: 'Top & bottom',
    slotCount: 2,
    icon: '▬\n▬',
    gridAreas: '"a" "b"',
    gridTemplate: 'grid-cols-1 grid-rows-2',
  },
  {
    type: 'trio-row',
    label: '3 in a row',
    slotCount: 3,
    icon: '▪▪▪',
    gridAreas: '"a b c"',
    gridTemplate: 'grid-cols-3 grid-rows-1',
  },
  {
    type: 'one-two',
    label: '1 + 2',
    slotCount: 3,
    icon: '▬▪',
    gridAreas: '"a b" "a c"',
    gridTemplate: 'grid-cols-2 grid-rows-2',
  },
  {
    type: 'two-one',
    label: '2 + 1',
    slotCount: 3,
    icon: '▪▬',
    gridAreas: '"a c" "b c"',
    gridTemplate: 'grid-cols-2 grid-rows-2',
  },
  {
    type: 'quad',
    label: '4 grid',
    slotCount: 4,
    icon: '▪▪\n▪▪',
    gridAreas: '"a b" "c d"',
    gridTemplate: 'grid-cols-2 grid-rows-2',
  },
  {
    type: 'hero-strip',
    label: 'Hero + strip',
    slotCount: 3,
    icon: '▬\n▪▪',
    gridAreas: '"a a" "b c"',
    gridTemplate: 'grid-cols-2 grid-rows-2',
  },
]

export function getTemplate(type: LayoutType): LayoutTemplate {
  return LAYOUT_TEMPLATES.find((t) => t.type === type) ?? LAYOUT_TEMPLATES[0]
}

export function makeSlots(count: number): PageSlot[] {
  return Array.from({ length: count }, () => ({
    id: crypto.randomUUID(),
    photoUrl: null,
    caption: null,
  }))
}

export function makeBlankPage(layoutType: LayoutType = 'full'): BookPage {
  const template = getTemplate(layoutType)
  return {
    id: crypto.randomUUID(),
    layoutType,
    slots: makeSlots(template.slotCount),
    background: '#ffffff',
    notes: [],
  }
}
