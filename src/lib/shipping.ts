export type ShippingRegion = 'us' | 'uk' | 'canada' | 'australia' | 'other'

export interface ShippingMethod {
  id: string
  label: string
  daysMin: number
  daysMax: number
  basePrice: number    // for 1 book
  perBookExtra: number // added per each additional book
}

// Countries we can ship to and their region
export const COUNTRY_TO_REGION: Record<string, ShippingRegion> = {
  'United States': 'us',
  'United Kingdom': 'uk',
  'Canada':         'canada',
  'Australia':      'australia',
}

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_TO_REGION)

// Rates derived from Blurb shipping calculator — all trackable
export const SHIPPING_METHODS: Record<Exclude<ShippingRegion, 'other'>, ShippingMethod[]> = {
  us: [
    { id: 'economy',  label: 'Economy',  daysMin: 12, daysMax: 16, basePrice: 6.99,  perBookExtra: 1.50 },
    { id: 'standard', label: 'Standard', daysMin: 8,  daysMax: 12, basePrice: 11.99, perBookExtra: 3.00 },
    { id: 'express',  label: 'Express',  daysMin: 5,  daysMax: 8,  basePrice: 17.99, perBookExtra: 4.00 },
    { id: 'priority', label: 'Priority', daysMin: 3,  daysMax: 5,  basePrice: 24.99, perBookExtra: 6.00 },
  ],
  uk: [
    { id: 'standard', label: 'Standard', daysMin: 7,  daysMax: 10, basePrice: 10.99, perBookExtra: 1.50 },
    { id: 'priority', label: 'Priority', daysMin: 2,  daysMax: 4,  basePrice: 30.99, perBookExtra: 6.00 },
  ],
  canada: [
    { id: 'standard', label: 'Standard', daysMin: 8,  daysMax: 14, basePrice: 12.99, perBookExtra: 2.50 },
    { id: 'express',  label: 'Express',  daysMin: 5,  daysMax: 8,  basePrice: 29.99, perBookExtra: 4.00 },
    { id: 'priority', label: 'Priority', daysMin: 3,  daysMax: 5,  basePrice: 39.99, perBookExtra: 5.00 },
  ],
  australia: [
    { id: 'express',  label: 'Express',  daysMin: 8,  daysMax: 14, basePrice: 42.99, perBookExtra: 6.00 },
    { id: 'priority', label: 'Priority', daysMin: 5,  daysMax: 9,  basePrice: 49.99, perBookExtra: 10.00 },
  ],
}

export function getShippingMethods(country: string): ShippingMethod[] | null {
  const region = COUNTRY_TO_REGION[country]
  if (!region) return null
  return SHIPPING_METHODS[region as Exclude<ShippingRegion, 'other'>] ?? null
}

/** Calculate shipping cost for n copies */
export function calcShipping(method: ShippingMethod, quantity: number): number {
  const raw = method.basePrice + Math.max(0, quantity - 1) * method.perBookExtra
  return Math.round(raw * 100) / 100
}

/** Return an estimated arrival window string, e.g. "Apr 10 – Apr 14" */
export function arrivalWindow(method: ShippingMethod): string {
  const today = new Date()
  const min = new Date(today); min.setDate(today.getDate() + method.daysMin)
  const max = new Date(today); max.setDate(today.getDate() + method.daysMax)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(min)} – ${fmt(max)}`
}
