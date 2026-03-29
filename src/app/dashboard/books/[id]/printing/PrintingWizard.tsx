'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { BookLayout, BookPage } from '@/lib/layouts'
import { PrintDetails, calculatePrice, BookSizeId, DEFAULT_BOOK_SIZE_ID, getBookSize } from '@/lib/types'
import { getShippingMethods, calcShipping, arrivalWindow, SUPPORTED_COUNTRIES, ShippingMethod } from '@/lib/shipping'
import BookSizePicker from '@/components/BookSizePicker'
import { ChevronRight, ChevronLeft, GripVertical, Check, Eye, EyeOff, Loader2, ImageIcon, X, Pencil, Upload, Trash2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

interface Props {
  bookId: string
  bookTitle: string
  layout: BookLayout
  userEmail: string
  initialBookSize?: BookSizeId | null
}

const COLOR_THEMES = [
  { name: 'Ivory & Gold',  bg: '#f9f5ec', accent: '#c9a84c' },
  { name: 'Midnight',       bg: '#1a1714', accent: '#e8e0d5' },
  { name: 'Dusty Rose',     bg: '#f5e8e0', accent: '#c97b6a' },
  { name: 'Forest',         bg: '#e0ece4', accent: '#2d5a3d' },
  { name: 'Navy & White',   bg: '#1c2b4a', accent: '#ffffff' },
  { name: 'Warm Stone',     bg: '#e8e0d5', accent: '#5a4a3a' },
]

const FONT_STYLES = ['Classic Serif', 'Modern Sans', 'Elegant Script', 'Bold Display']

const STEPS = ['Cover', 'Pages', 'Delivery', 'Review & Pay']

// ── Page preview modal ─────────────────────────────────────────────────────────

function PagePreviewModal({
  page,
  pageIndex,
  bookId,
  onClose,
}: {
  page: BookPage
  pageIndex: number
  bookId: string
  onClose: () => void
}) {
  const photoEls = page.elements ?? []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div>
            <p className="text-sm font-semibold text-stone-900">Page {pageIndex + 1}</p>
            <p className="text-xs text-stone-400">{photoEls.length} photo{photoEls.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Page preview */}
        <div className="p-5">
          {photoEls.length === 0 ? (
            <div className="aspect-[3/4] rounded-xl bg-stone-100 flex items-center justify-center text-stone-400 text-sm">
              No photos on this page
            </div>
          ) : (
            <div
              className="relative rounded-xl overflow-hidden border border-stone-100"
              style={{ background: page.background, aspectRatio: '3/4' }}
            >
              {photoEls.map(el => (
                <div key={el.id} style={{
                  position: 'absolute',
                  left: `${el.x}%`, top: `${el.y}%`,
                  width: `${el.width}%`, height: `${el.height}%`,
                  borderRadius: 0,
                  overflow: 'hidden',
                  zIndex: el.zIndex,
                }}>
                  <Image src={el.photoUrl} alt="" fill className="object-cover"
                    style={{ objectPosition: `${el.objectPosition.x}% ${el.objectPosition.y}%` }}
                    sizes="300px" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit button */}
        <div className="px-5 pb-5">
          <Link
            href={`/dashboard/books/${bookId}/curate?page=${pageIndex}&from=printing`}
            className="flex items-center justify-center gap-2 w-full bg-stone-900 text-white px-4 py-3 rounded-xl text-sm hover:bg-stone-700 transition-colors"
          >
            <Pencil size={14} />
            Edit this page in curator
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Sortable page row ──────────────────────────────────────────────────────────

function SortablePageRow({
  page, index, included, onToggle, onPreview, bookId,
}: {
  page: BookPage; index: number; included: boolean; onToggle: () => void
  onPreview: () => void; bookId: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const firstPhoto = (page.elements ?? [])[0]?.photoUrl

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
        included ? 'border-stone-200 bg-white' : 'border-stone-100 bg-stone-50 opacity-50'
      }`}
    >
      <button {...listeners} {...attributes} className="text-stone-300 hover:text-stone-500 cursor-grab active:cursor-grabbing">
        <GripVertical size={18} />
      </button>

      <div className="w-10 h-14 rounded overflow-hidden bg-stone-100 shrink-0" style={{ background: page.background }}>
        {firstPhoto && (
          <Image src={firstPhoto} alt="" width={40} height={56} className="w-full h-full object-cover" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800">Page {index + 1}</p>
        <p className="text-xs text-stone-400">
          {(page.elements ?? []).length} photo{(page.elements ?? []).length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Preview icon */}
      <button
        onClick={onPreview}
        title="Preview this page"
        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 transition-colors"
      >
        <ImageIcon size={16} />
      </button>

      {/* Visibility toggle */}
      <button
        onClick={onToggle}
        title={included ? 'Exclude this page' : 'Include this page'}
        className={`p-1.5 rounded-lg transition-colors ${included ? 'text-stone-400 hover:text-red-400' : 'text-stone-300 hover:text-stone-600'}`}
      >
        {included ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
    </div>
  )
}

// ── Shareable payment link copier ─────────────────────────────────────────────

function PayLinkCopier({ bookId, pageCount, sizeId, shipping }: { bookId: string; pageCount: number; sizeId: string; shipping: number }) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = `${origin}/pay/${bookId}?pages=${pageCount}&size=${encodeURIComponent(sizeId)}&ship=${shipping}`

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
      <p className="text-sm font-semibold text-stone-800 mb-1">Want someone else to pay?</p>
      <p className="text-xs text-stone-500 mb-3">
        Share this link with a friend or family member and they can pay directly — no account needed.
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-500 min-w-0 truncate"
        />
        <button
          onClick={copy}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            copied ? 'bg-green-100 text-green-700' : 'bg-stone-900 text-white hover:bg-stone-700'
          }`}
        >
          {copied ? '✓ Copied' : 'Copy link'}
        </button>
      </div>
    </div>
  )
}

// ── Main wizard ────────────────────────────────────────────────────────────────

export default function PrintingWizard({ bookId, bookTitle, layout, userEmail, initialBookSize }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  // Book size
  const [bookSizeId, setBookSizeId] = useState<BookSizeId>(initialBookSize ?? DEFAULT_BOOK_SIZE_ID)

  // Cover state
  const [coverTitle, setCoverTitle]     = useState(bookTitle)
  const [subtitle, setSubtitle]         = useState('')
  const [dedication, setDedication]     = useState('')
  const [colorTheme, setColorTheme]     = useState(COLOR_THEMES[0].name)
  const [fontStyle, setFontStyle]       = useState(FONT_STYLES[0])
  const [description, setDescription]   = useState('')
  const [refPhotos, setRefPhotos]       = useState<string[]>([])
  const [uploadingRef, setUploadingRef] = useState(false)
  const refInputRef = useRef<HTMLInputElement>(null)

  // Pages state
  const [pages, setPages]           = useState<BookPage[]>(layout.pages)
  const [includedIds, setIncludedIds] = useState<Set<string>>(new Set(layout.pages.map(p => p.id)))
  const [previewPage, setPreviewPage] = useState<{ page: BookPage; index: number } | null>(null)

  // Delivery state
  const [fullName, setFullName]         = useState('')
  const [phone, setPhone]               = useState('')
  const [whatsapp, setWhatsapp]         = useState('')
  const [email, setEmail]               = useState(userEmail)
  const [line1, setLine1]               = useState('')
  const [line2, setLine2]               = useState('')
  const [city, setCity]                 = useState('')
  const [stateField, setStateField]     = useState('')
  const [postalCode, setPostalCode]     = useState('')
  const [country, setCountry]             = useState('United States')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [quantity, setQuantity]           = useState(1)
  const [shippingMethodId, setShippingMethodId] = useState('standard')

  // Review state
  const [finalRequests, setFinalRequests] = useState('')

  // ── Reference photo upload ──────────────────────────────────────────────────

  async function handleRefUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploadingRef(true)
    const supabase = createClient()
    const urls: string[] = []
    for (const file of files) {
      const path = `cover-refs/${bookId}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('photos').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
    }
    setRefPhotos(prev => [...prev, ...urls])
    setUploadingRef(false)
    if (refInputRef.current) refInputRef.current.value = ''
  }

  // ── Page sorting ────────────────────────────────────────────────────────────

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setPages(prev => {
        const oldIndex = prev.findIndex(p => p.id === active.id)
        const newIndex = prev.findIndex(p => p.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setLoading(true)
    const includedPages = pages.filter(p => includedIds.has(p.id))
    const printDetails: PrintDetails = {
      bookSize: bookSizeId,
      cover: { title: coverTitle, subtitle, dedication, colorTheme, description, referencePhotos: refPhotos, fontStyle },
      pageOrder: includedPages.map(p => p.id),
      delivery: { fullName, phone, whatsapp, email, line1, line2, city, state: stateField, postalCode, country, notes: deliveryNotes, quantity, shippingMethodId: activeShipMethod?.id ?? 'standard', shippingCost },
      finalRequests,
      submittedAt: new Date().toISOString(),
    }

    // Save print details + book_size so webhook and curate editor can read them
    const supabase = createClient()
    await supabase.from('books').update({ print_details: printDetails, book_size: bookSizeId }).eq('id', bookId)

    // Create Stripe checkout session
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, pageCount: includedPages.length, sizeId: bookSizeId, shippingCost, quantity }),
    })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      alert(data.error ?? 'Could not start checkout. Please try again.')
      setLoading(false)
    }
  }

  const includedCount  = pages.filter(p => includedIds.has(p.id)).length
  const selectedSize   = getBookSize(bookSizeId)
  const bookPrice      = calculatePrice(includedCount, bookSizeId)

  // Shipping
  const shippingMethods  = getShippingMethods(country)           // null = unsupported
  const isUnsupported    = !SUPPORTED_COUNTRIES.includes(country) && country !== ''
  const activeShipMethod: ShippingMethod | undefined = shippingMethods?.find(m => m.id === shippingMethodId)
    ?? shippingMethods?.[0]
  const shippingCost = activeShipMethod ? calcShipping(activeShipMethod, quantity) : 0
  const totalPrice   = bookPrice + shippingCost

  const canProceed = [
    coverTitle.trim().length > 0,
    includedCount > 0,
    !isUnsupported && fullName.trim() && line1.trim() && city.trim() && postalCode.trim()
      && (phone.trim() || whatsapp.trim()) && !!activeShipMethod,
    true,
  ][step]

  return (
    <div className="max-w-2xl mx-auto">

      {/* Preview modal */}
      {previewPage && (
        <PagePreviewModal
          page={previewPage.page}
          pageIndex={previewPage.index}
          bookId={bookId}
          onClose={() => setPreviewPage(null)}
        />
      )}

      {/* Step indicator */}
      <div className="flex items-center mb-10">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                i < step ? 'bg-stone-900 text-white' :
                i === step ? 'bg-stone-900 text-white ring-4 ring-stone-200' :
                'bg-stone-100 text-stone-400'
              }`}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-xs mt-1.5 whitespace-nowrap ${i <= step ? 'text-stone-700 font-medium' : 'text-stone-400'}`}>
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-5 ${i < step ? 'bg-stone-900' : 'bg-stone-100'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 0: Cover ──────────────────────────────────────────── */}
      {step === 0 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-normal text-stone-900 mb-1" style={{ fontFamily: 'var(--font-playfair)' }}>
              Design your cover
            </h2>
            <p className="text-stone-500 text-sm">
              Tell us your vision — our design team will create a beautiful cover for you.
            </p>
          </div>

          {/* Book size selection */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <p className="text-sm font-semibold text-stone-800 mb-3">Choose your book size</p>
            <BookSizePicker value={bookSizeId} onChange={setBookSizeId} />
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-6 flex flex-col gap-5">
            {/* Title / subtitle / dedication */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Cover title *</label>
              <input value={coverTitle} onChange={e => setCoverTitle(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Subtitle <span className="text-stone-400 font-normal">(optional)</span></label>
              <input value={subtitle} onChange={e => setSubtitle(e.target.value)}
                placeholder="e.g. A Life Beautifully Lived · 1942–2024"
                className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Dedication <span className="text-stone-400 font-normal">(optional)</span></label>
              <textarea value={dedication} onChange={e => setDedication(e.target.value)}
                placeholder="e.g. For everyone who loved her"
                rows={2}
                className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 resize-none" />
            </div>

            {/* Colour theme */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Colour theme</label>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_THEMES.map(theme => (
                  <button key={theme.name} onClick={() => setColorTheme(theme.name)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs text-left transition-all ${
                      colorTheme === theme.name ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200 hover:border-stone-400'
                    }`}>
                    <div className="w-7 h-7 rounded-full border border-stone-200 shrink-0 flex items-center justify-center" style={{ background: theme.bg }}>
                      <div className="w-3 h-3 rounded-full" style={{ background: theme.accent }} />
                    </div>
                    <span className="text-stone-700 leading-tight">{theme.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font style */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Font style</label>
              <div className="grid grid-cols-2 gap-2">
                {FONT_STYLES.map(f => (
                  <button key={f} onClick={() => setFontStyle(f)}
                    className={`p-2.5 rounded-xl border text-sm transition-all ${
                      fontStyle === f ? 'border-stone-900 bg-stone-50 text-stone-900 font-medium' : 'border-stone-200 text-stone-500 hover:border-stone-400'
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Cover description */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Describe your ideal cover
                <span className="ml-2 text-xs font-normal text-stone-400">— our team will bring it to life</span>
              </label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Warm and elegant with soft golden tones, flowers in the background, vintage feel — like a treasured family heirloom. I'd love a photo of her garden on the front if possible."
                rows={4}
                className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 resize-none" />
            </div>

            {/* Reference photos */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Cover reference photos
                <span className="ml-2 text-xs font-normal text-stone-400">— photos you want on the cover or for inspiration</span>
              </label>

              {refPhotos.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {refPhotos.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-stone-200 group">
                      <Image src={url} alt={`Reference ${i + 1}`} fill className="object-cover" sizes="80px" />
                      <button
                        onClick={() => setRefPhotos(prev => prev.filter((_, j) => j !== i))}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Trash2 size={16} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={refInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleRefUpload}
              />
              <button
                onClick={() => refInputRef.current?.click()}
                disabled={uploadingRef}
                className="flex items-center gap-2 text-sm border border-stone-200 text-stone-600 px-4 py-2.5 rounded-xl hover:border-stone-400 transition-colors disabled:opacity-50"
              >
                {uploadingRef ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Add photos</>}
              </button>
              <p className="text-xs text-stone-400 mt-1.5">Upload any photos you want included or used as inspiration for the cover.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 1: Pages ──────────────────────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-normal text-stone-900 mb-1" style={{ fontFamily: 'var(--font-playfair)' }}>
              Choose & order your pages
            </h2>
            <p className="text-stone-500 text-sm">
              Drag to reorder. Use <ImageIcon size={12} className="inline" /> to preview a page or jump back to edit it.
              Use <Eye size={12} className="inline" /> to include or exclude. {includedCount} of {pages.length} pages included.
            </p>
          </div>

          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} id="pages-sorter">
            <SortableContext items={pages.map(p => p.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {pages.map((page, i) => (
                  <SortablePageRow
                    key={page.id}
                    page={page}
                    index={i}
                    included={includedIds.has(page.id)}
                    bookId={bookId}
                    onPreview={() => setPreviewPage({ page, index: i })}
                    onToggle={() => setIncludedIds(prev => {
                      const next = new Set(prev)
                      next.has(page.id) ? next.delete(page.id) : next.add(page.id)
                      return next
                    })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* ── Step 2: Delivery ───────────────────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-normal text-stone-900 mb-1" style={{ fontFamily: 'var(--font-playfair)' }}>
              Delivery details
            </h2>
            <p className="text-stone-500 text-sm">Where should we send the book? We&apos;ll also send your PDF proof here before printing.</p>
          </div>

          {/* Contact info */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 flex flex-col gap-4">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Contact</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-stone-700 mb-1">Full name *</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Phone *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
                  className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  WhatsApp <span className="text-xs font-normal text-stone-400">(proof delivery)</span>
                </label>
                <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} type="tel"
                  placeholder="+1 555 000 0000"
                  className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-stone-700 mb-1">Email for proof *</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                  className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" />
              </div>
            </div>
          </div>

          {/* Shipping address */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 flex flex-col gap-4">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Shipping address</p>
            <div className="grid grid-cols-2 gap-4">
              {/* Country first — determines shipping options */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-stone-700 mb-1">Country *</label>
                <select
                  value={SUPPORTED_COUNTRIES.includes(country) ? country : 'Other'}
                  onChange={e => {
                    const val = e.target.value
                    setCountry(val === 'Other' ? 'Other' : val)
                    setShippingMethodId('standard')
                  }}
                  className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 bg-white"
                >
                  {SUPPORTED_COUNTRIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="Other">Other country…</option>
                </select>
              </div>

              {/* Unsupported country message */}
              {isUnsupported && (
                <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-stone-800 mb-1">We don&apos;t have direct shipping to your country yet</p>
                  <p className="text-sm text-stone-600 mb-3">
                    Send us a message and we&apos;ll get back to you within 5 minutes to confirm if we can service your location.
                    You won&apos;t be charged until we confirm.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <a href="https://wa.me/message/enquiry" target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
                      WhatsApp us
                    </a>
                    <a href="mailto:hello@thelifewithyou.com"
                      className="inline-flex items-center gap-1.5 bg-stone-900 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-stone-700 transition-colors">
                      Email us
                    </a>
                  </div>
                </div>
              )}

              {!isUnsupported && (
                <>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-1">Address line 1 *</label>
                    <input value={line1} onChange={e => setLine1(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Address line 2 <span className="text-stone-400 font-normal">(optional)</span>
                    </label>
                    <input value={line2} onChange={e => setLine2(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">City *</label>
                    <input value={city} onChange={e => setCity(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">State / Province</label>
                    <input value={stateField} onChange={e => setStateField(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Postal code *</label>
                    <input value={postalCode} onChange={e => setPostalCode(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      Quantity <span className="text-xs font-normal text-stone-400">(copies)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        className="w-10 h-10 rounded-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:bg-stone-50 text-lg font-light">−</button>
                      <span className="w-8 text-center text-sm font-medium">{quantity}</span>
                      <button onClick={() => setQuantity(q => q + 1)}
                        className="w-10 h-10 rounded-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:bg-stone-50 text-lg font-light">+</button>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-1">Delivery notes <span className="text-stone-400 font-normal">(optional)</span></label>
                    <input value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)}
                      placeholder="e.g. Leave with concierge, call on arrival"
                      className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Shipping method */}
          {!isUnsupported && shippingMethods && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6 flex flex-col gap-3">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">Shipping method</p>
              {shippingMethods.map(method => {
                const cost = calcShipping(method, quantity)
                const arrival = arrivalWindow(method)
                const selected = (activeShipMethod?.id === method.id)
                return (
                  <button
                    key={method.id}
                    onClick={() => setShippingMethodId(method.id)}
                    className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                      selected
                        ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selected ? 'border-stone-900' : 'border-stone-300'
                      }`}>
                        {selected && <div className="w-2 h-2 rounded-full bg-stone-900" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-800">{method.label}</p>
                        <p className="text-xs text-stone-400">Est. {arrival} · Trackable</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-stone-900">${cost.toFixed(2)}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Review & Pay ───────────────────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-normal text-stone-900 mb-1" style={{ fontFamily: 'var(--font-playfair)' }}>
              Review & submit
            </h2>
            <p className="text-stone-500 text-sm">
              We&apos;ll design your cover, review your layout, and send you a PDF proof before anything prints.
              You approve it in the app — nothing ships without your sign-off.
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <p className="text-xs text-stone-400 mb-1">Cover</p>
              <p className="text-sm font-medium text-stone-800 truncate">{coverTitle}</p>
              {subtitle && <p className="text-xs text-stone-500 mt-0.5 truncate">{subtitle}</p>}
              <p className="text-xs text-stone-400 mt-1">{colorTheme} · {fontStyle}</p>
              {refPhotos.length > 0 && <p className="text-xs text-stone-400 mt-0.5">{refPhotos.length} reference photo{refPhotos.length !== 1 ? 's' : ''}</p>}
            </div>
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <p className="text-xs text-stone-400 mb-1">Pages</p>
              <p className="text-sm font-medium text-stone-800">{includedCount} pages included</p>
              <p className="text-xs text-stone-400 mt-0.5">of {pages.length} curated</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 p-4 col-span-2">
              <p className="text-xs text-stone-400 mb-1">Delivering to</p>
              <p className="text-sm font-medium text-stone-800">{fullName}</p>
              <p className="text-xs text-stone-500">{line1}{line2 ? `, ${line2}` : ''}, {city}, {country}</p>
              <p className="text-xs text-stone-400 mt-1">Proof to: {email}{whatsapp ? ` · WhatsApp: ${whatsapp}` : ''}</p>
            </div>
          </div>

          {/* Dynamic price calculator */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100">
              <p className="text-sm font-semibold text-stone-800">Price breakdown</p>
            </div>
            <div className="px-5 py-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-500">{selectedSize.label} ({selectedSize.dimensions})</span>
                <span className="text-stone-800 font-medium">${selectedSize.basePriceUsd}.00</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-500">{includedCount} pages × ${selectedSize.perPageUsd.toFixed(2)}</span>
                <span className="text-stone-800">${(includedCount * selectedSize.perPageUsd).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-500">
                  {activeShipMethod ? `${activeShipMethod.label} shipping` : 'Shipping'}
                  {quantity > 1 ? ` × ${quantity} copies` : ''}
                </span>
                <span className="text-stone-800">${shippingCost.toFixed(2)}</span>
              </div>
              <div className="border-t border-stone-100 mt-1 pt-3 flex items-center justify-between">
                <span className="text-base font-semibold text-stone-900">Total</span>
                <span className="text-2xl font-light text-stone-900">${totalPrice.toFixed(2)}</span>
              </div>
            </div>
            <div className="px-5 pb-4 text-xs text-stone-400">
              Go back to adjust pages, size, or shipping method.
            </div>
          </div>

          {/* Final requests */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Any final requests for our team? <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <textarea value={finalRequests} onChange={e => setFinalRequests(e.target.value)}
              placeholder="e.g. Please make the colours warmer overall, add a quote on page 3…"
              rows={3}
              className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 resize-none" />
          </div>

          {/* Shareable payment link */}
          <PayLinkCopier bookId={bookId} pageCount={includedCount} sizeId={bookSizeId} shipping={shippingCost} />

          {/* What happens next */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
            <p className="text-sm font-semibold text-stone-800 mb-2">What happens after you submit</p>
            <ol className="text-sm text-stone-600 flex flex-col gap-1.5 list-decimal list-inside">
              <li>Our team designs your cover and reviews your layout</li>
              <li>We send you a full PDF proof via email{whatsapp ? ' & WhatsApp' : ''}</li>
              <li>You approve it here in the app</li>
              <li>We send it to print and ship — arrives within 5 business days of approval</li>
            </ol>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-stone-100">
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="flex items-center gap-2 text-stone-500 hover:text-stone-800 disabled:opacity-0 transition-colors text-sm"
        >
          <ChevronLeft size={16} /> Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed}
            className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-full text-sm hover:bg-stone-700 transition-colors disabled:opacity-40"
          >
            Continue <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-full text-sm hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {loading ? <><Loader2 size={14} className="animate-spin" /> Redirecting to payment…</> : <>Pay ${totalPrice.toFixed(2)} <ChevronRight size={16} /></>}
          </button>
        )}
      </div>
    </div>
  )
}
