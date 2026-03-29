export type OccasionType = 'memorial' | 'birthday' | 'anniversary' | 'graduation' | 'other'

// ── Book sizes ────────────────────────────────────────────────────────────────

export type BookSizeId =
  | 'square-7x7'
  | 'portrait-8x10'
  | 'landscape-10x8'
  | 'square-12x12'
  | 'landscape-13x11'

export interface BookSize {
  id: BookSizeId
  label: string
  dimensions: string    // "7×7 in"
  cm: string            // "18×18 cm"
  aspectRatio: string   // CSS aspect-ratio value e.g. "1/1", "4/5"
  aspectNum: number     // width/height as a number for layout math
  image: string         // /bookratios/... path
  basePriceUsd: number  // our base price for this size (includes printing cost)
  perPageUsd: number    // our per-page surcharge
  popular?: boolean
}

export const BOOK_SIZES: BookSize[] = [
  {
    id: 'square-7x7',
    label: 'Small Square',
    dimensions: '7×7 in',
    cm: '18×18 cm',
    aspectRatio: '1/1',
    aspectNum: 1,
    image: '/bookratios/square7x7.png',
    basePriceUsd: 39,
    perPageUsd: 0.55,
  },
  {
    id: 'portrait-8x10',
    label: 'Standard Portrait',
    dimensions: '8×10 in',
    cm: '20×25 cm',
    aspectRatio: '4/5',
    aspectNum: 0.8,
    image: '/bookratios/standard-portrait8x10.png',
    basePriceUsd: 49,
    perPageUsd: 0.65,
    popular: true,
  },
  {
    id: 'landscape-10x8',
    label: 'Standard Landscape',
    dimensions: '10×8 in',
    cm: '25×20 cm',
    aspectRatio: '5/4',
    aspectNum: 1.25,
    image: '/bookratios/standard-landscape10x8.png',
    basePriceUsd: 49,
    perPageUsd: 0.65,
  },
  {
    id: 'square-12x12',
    label: 'Large Square',
    dimensions: '12×12 in',
    cm: '30×30 cm',
    aspectRatio: '1/1',
    aspectNum: 1,
    image: '/bookratios/large-square12x12.png',
    basePriceUsd: 79,
    perPageUsd: 1.10,
  },
  {
    id: 'landscape-13x11',
    label: 'Large Landscape',
    dimensions: '13×11 in',
    cm: '33×28 cm',
    aspectRatio: '13/11',
    aspectNum: 13 / 11,
    image: '/bookratios/large-format-landscape13x11.png',
    basePriceUsd: 82,
    perPageUsd: 1.10,
  },
]

export const DEFAULT_BOOK_SIZE_ID: BookSizeId = 'portrait-8x10'

export function getBookSize(id?: BookSizeId | null): BookSize {
  return BOOK_SIZES.find(s => s.id === id) ?? BOOK_SIZES.find(s => s.id === DEFAULT_BOOK_SIZE_ID)!
}

export function calculatePrice(pages: number, sizeId?: BookSizeId | null): number {
  const size = getBookSize(sizeId)
  return Math.round(size.basePriceUsd + pages * size.perPageUsd)
}

export type BookStatus =
  | 'collecting'
  | 'curating'
  | 'printing'   // filling out print details
  | 'review'     // submitted — team reviewing
  | 'proof_sent' // PDF proof sent to user
  | 'approved'   // user approved proof in-app
  | 'shipped'    // dispatched, tracking available
  | 'delivered'

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered'

export interface Book {
  id: string
  user_id: string
  title: string
  occasion_type: OccasionType
  deadline: string | null
  invite_token: string
  status: BookStatus
  created_at: string
  cover_photo_url?: string | null
  page_count?: number | null
  print_details?: PrintDetails | null
  tracking_number?: string | null
  book_size?: BookSizeId | null
}

export interface PrintDetails {
  // Book format
  bookSize: BookSizeId
  // Cover
  cover: {
    title: string
    subtitle: string
    dedication: string
    colorTheme: string
    description: string      // cover brief for our design team
    referencePhotos: string[] // uploaded reference image URLs
    fontStyle: string
  }
  // Pages
  pageOrder: string[]      // ordered list of BookPage IDs to include
  // Delivery
  delivery: {
    fullName: string
    phone: string
    whatsapp: string       // number for proof delivery
    email: string
    line1: string
    line2: string
    city: string
    state: string
    postalCode: string
    country: string
    notes: string
    quantity: number           // number of copies
    shippingMethodId: string   // e.g. 'standard', 'express'
    shippingCost: number       // USD, pre-calculated
  }
  // Final
  finalRequests: string
  submittedAt?: string
}

export interface Submission {
  id: string
  book_id: string
  contributor_name: string
  contributor_email: string | null
  photo_urls: string[]
  caption: string | null
  submitted_at: string
}

export interface Order {
  id: string
  book_id: string
  stripe_payment_intent_id: string | null
  prodigi_order_id: string | null
  page_count: number
  amount_charged: number
  shipping_address: ShippingAddress
  status: OrderStatus
  created_at: string
}

export interface ShippingAddress {
  name: string
  line1: string
  line2?: string
  city: string
  state: string
  postal_code: string
  country: string
}

// Pricing is now size-based — see calculatePrice() above

// Progress steps shown on book detail page
export const BOOK_PROGRESS_STEPS: { status: BookStatus; label: string }[] = [
  { status: 'collecting', label: 'Collecting' },
  { status: 'curating',   label: 'Curating' },
  { status: 'printing',   label: 'Print details' },
  { status: 'review',     label: 'Review' },
  { status: 'proof_sent', label: 'Proof' },
  { status: 'approved',   label: 'Approved' },
  { status: 'shipped',    label: 'Shipped' },
  { status: 'delivered',  label: 'Delivered' },
]
