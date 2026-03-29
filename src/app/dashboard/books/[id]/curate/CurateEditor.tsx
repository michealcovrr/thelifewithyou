'use client'

import { useState, useCallback } from 'react'
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  useDraggable, useDroppable,
} from '@dnd-kit/core'
import {
  BookLayout, BookPage, PageSlot, LayoutType,
  LAYOUT_TEMPLATES, getTemplate, makeBlankPage, makeSlots,
} from '@/lib/layouts'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Trash2, ChevronLeft, ChevronRight, Save, ArrowLeft, Move, MessageSquarePlus } from 'lucide-react'
import Image from 'next/image'
import { useRef, useEffect } from 'react'
import BookSizePicker from '@/components/BookSizePicker'
import { BookSizeId, DEFAULT_BOOK_SIZE_ID, getBookSize } from '@/lib/types'

interface Photo { url: string; contributor: string; caption: string | null }
interface Props {
  bookId: string
  bookTitle: string
  photos: Photo[]
  initialLayout: BookLayout
  initialPageIndex?: number
  backHref?: string
  initialBookSize?: string | null
}

// ─── Grid helpers ─────────────────────────────────────────────────────────────

function getGridCols(type: LayoutType) {
  switch (type) {
    case 'full': return '1fr'
    case 'side-by-side': return '1fr 1fr'
    case 'top-bottom': return '1fr'
    case 'trio-row': return '1fr 1fr 1fr'
    case 'one-two': return '3fr 2fr'
    case 'two-one': return '2fr 3fr'
    case 'quad': return '1fr 1fr'
    case 'hero-strip': return '1fr 1fr'
    default: return '1fr'
  }
}
function getGridRows(type: LayoutType) {
  switch (type) {
    case 'full': return '1fr'
    case 'side-by-side': return '1fr'
    case 'top-bottom': return '1fr 1fr'
    case 'trio-row': return '1fr'
    case 'one-two': return '1fr 1fr'
    case 'two-one': return '1fr 1fr'
    case 'quad': return '1fr 1fr'
    case 'hero-strip': return '3fr 2fr'
    default: return '1fr'
  }
}

// ─── Layout template visual preview ──────────────────────────────────────────

function LayoutPreview({ type, active, onClick }: { type: LayoutType; active: boolean; onClick: () => void }) {
  const t = getTemplate(type)
  const slotColors = ['bg-stone-400', 'bg-stone-300', 'bg-stone-500', 'bg-stone-200']
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl overflow-hidden border-2 transition-all ${
        active ? 'border-stone-900 shadow-md scale-[1.02]' : 'border-stone-200 hover:border-stone-400'
      }`}
    >
      {/* Mini canvas preview */}
      <div className="w-full bg-white p-1.5" style={{ aspectRatio: '3/4' }}>
        <div
          className="w-full h-full grid gap-0.5 rounded overflow-hidden"
          style={{
            gridTemplateAreas: t.gridAreas,
            gridTemplateColumns: getGridCols(type),
            gridTemplateRows: getGridRows(type),
          }}
        >
          {Array.from({ length: t.slotCount }).map((_, i) => (
            <div
              key={i}
              style={{ gridArea: ['a','b','c','d'][i] }}
              className={`${slotColors[i]} rounded-sm`}
            />
          ))}
        </div>
      </div>
      {/* Label */}
      <div className={`px-2 py-1.5 text-xs font-medium text-center ${active ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-600'}`}>
        {t.label}
      </div>
    </button>
  )
}

// ─── Draggable pool photo ─────────────────────────────────────────────────────

function PoolPhoto({ photo, index }: { photo: Photo; index: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool-${index}`,
    data: { type: 'pool', url: photo.url },
  })
  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      title={photo.contributor}
      className={`relative aspect-square rounded-lg overflow-hidden cursor-grab active:cursor-grabbing
        border-2 border-transparent hover:border-stone-500 hover:scale-105 transition-all shadow-sm
        ${isDragging ? 'opacity-25 scale-95' : ''}`}
    >
      <Image src={photo.url} alt={photo.contributor} fill className="object-cover" sizes="100px" />
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1 pt-4 pb-1 opacity-0 hover:opacity-100 transition-opacity">
        <p className="text-white text-[10px] truncate">{photo.contributor}</p>
      </div>
    </div>
  )
}

// ─── Droppable page slot ──────────────────────────────────────────────────────

function PageSlotCell({
  slot, pageId, slotIndex, gridArea, onClear, onCaptionChange, onPositionChange,
}: {
  slot: PageSlot; pageId: string; slotIndex: number; gridArea: string
  onClear: () => void
  onCaptionChange: (c: string) => void
  onPositionChange: (pos: { x: number; y: number }) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${pageId}-${slotIndex}`,
    data: { pageId, slotIndex },
  })
  const [editingCaption, setEditingCaption] = useState(false)
  const [repositioning, setRepositioning] = useState(false)

  // Pan state
  const panRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)
  const pos = slot.objectPosition ?? { x: 50, y: 50 }

  function handlePanStart(e: React.MouseEvent) {
    if (!repositioning) return
    e.preventDefault()
    panRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y }

    function onMove(ev: MouseEvent) {
      if (!panRef.current) return
      const el = (e.target as HTMLElement).closest('[data-slot]') as HTMLElement
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      const dx = ((ev.clientX - panRef.current.startX) / width) * -100
      const dy = ((ev.clientY - panRef.current.startY) / height) * -100
      const nx = Math.min(100, Math.max(0, panRef.current.startPosX + dx))
      const ny = Math.min(100, Math.max(0, panRef.current.startPosY + dy))
      onPositionChange({ x: nx, y: ny })
    }
    function onUp() {
      panRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={setNodeRef}
      data-slot
      style={{ gridArea }}
      className={`relative overflow-hidden transition-all ${
        isOver ? 'ring-4 ring-stone-900 ring-offset-2 scale-[0.98]' : ''
      } ${slot.photoUrl ? '' : 'bg-stone-100 border-2 border-dashed border-stone-300'}`}
    >
      {slot.photoUrl ? (
        <>
          {/* Photo — object-position controlled by pan */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slot.photoUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover select-none"
            style={{
              objectPosition: `${pos.x}% ${pos.y}%`,
              cursor: repositioning ? 'grab' : 'default',
            }}
            draggable={false}
            onMouseDown={handlePanStart}
          />

          {/* Reposition active overlay */}
          {repositioning && (
            <div className="absolute inset-0 ring-4 ring-blue-400 ring-inset pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm pointer-events-none">
                Drag to reposition
              </div>
            </div>
          )}

          {/* Caption overlay */}
          {(slot.caption || editingCaption) && (
            <div className="absolute bottom-0 inset-x-0 bg-black/50 px-3 py-2 z-10">
              {editingCaption ? (
                <input
                  autoFocus
                  value={slot.caption ?? ''}
                  onChange={(e) => onCaptionChange(e.target.value)}
                  onBlur={() => setEditingCaption(false)}
                  className="w-full bg-transparent text-white text-sm outline-none placeholder-white/60"
                  placeholder="Type caption…"
                />
              ) : (
                <p className="text-white text-sm cursor-text" onClick={() => setEditingCaption(true)}>
                  {slot.caption}
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 hover:opacity-100 transition-opacity z-10">
            {/* Reposition toggle */}
            <button
              onClick={() => setRepositioning((r) => !r)}
              title="Drag to reposition photo"
              className={`rounded-full p-1.5 backdrop-blur-sm transition-colors ${
                repositioning
                  ? 'bg-blue-500 text-white'
                  : 'bg-black/60 hover:bg-black/80 text-white'
              }`}
            >
              <Move size={13} />
            </button>
            {!slot.caption && !editingCaption && (
              <button
                onClick={() => setEditingCaption(true)}
                className="bg-black/60 hover:bg-black/80 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm"
              >
                + caption
              </button>
            )}
            <button
              onClick={() => { setRepositioning(false); onClear() }}
              className="bg-black/60 hover:bg-red-600 text-white rounded-full p-1.5 backdrop-blur-sm transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-400">
          {isOver
            ? <span className="text-stone-700 font-semibold text-sm">Drop here</span>
            : <>
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-stone-300 flex items-center justify-center">
                  <Plus size={18} className="text-stone-300" />
                </div>
                <span className="text-xs">drag photo here</span>
              </>
          }
        </div>
      )}
    </div>
  )
}

// ─── Notes dropdown ───────────────────────────────────────────────────────────

function NotesDropdown({ notes, onChange }: { notes: string[]; onChange: (n: string[]) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-1 py-3 text-xs font-semibold text-stone-700 hover:text-stone-900 transition-colors group"
      >
        <span className="flex items-center gap-2">
          <MessageSquarePlus size={14} className="text-stone-500 group-hover:text-stone-800" />
          Want us to edit this page?
          {notes.length > 0 && (
            <span className="bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {notes.length}
            </span>
          )}
        </span>
        <ChevronRight
          size={14}
          className={`text-stone-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="pb-3 flex flex-col gap-2">
          <p className="text-xs text-stone-400 leading-relaxed px-1">
            List anything you&apos;d like us to change on this page — a special frame, a text overlay, a colour effect. Our team will handle it personally before printing.
          </p>
          <NotesList notes={notes} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

// ─── Notes list ───────────────────────────────────────────────────────────────

function NotesList({ notes, onChange }: { notes: string[]; onChange: (n: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function addNote() {
    const trimmed = draft.trim()
    if (!trimmed) return
    onChange([...notes, trimmed])
    setDraft('')
    inputRef.current?.focus()
  }

  function removeNote(i: number) {
    onChange(notes.filter((_, idx) => idx !== i))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addNote() }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Existing notes */}
      {notes.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {notes.map((note, i) => (
            <li
              key={i}
              className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 group"
            >
              <span className="text-amber-400 mt-0.5 shrink-0">•</span>
              <span className="text-xs text-stone-700 flex-1 leading-relaxed">{note}</span>
              <button
                onClick={() => removeNote(i)}
                className="text-stone-300 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100 mt-0.5"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add new note */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a request…"
          className="flex-1 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-stone-400 placeholder-stone-300"
        />
        <button
          onClick={addNote}
          disabled={!draft.trim()}
          className="bg-stone-900 text-white rounded-lg px-3 py-2 text-xs hover:bg-stone-700 transition-colors disabled:opacity-30"
        >
          <Plus size={14} />
        </button>
      </div>

      {notes.length === 0 && (
        <p className="text-xs text-stone-300 italic">No requests yet for this page.</p>
      )}
    </div>
  )
}

// ─── Large single-page canvas ─────────────────────────────────────────────────

function LargePageCanvas({
  page, onSlotClear, onSlotCaption, onSlotPosition,
}: {
  page: BookPage
  onSlotClear: (i: number) => void
  onSlotCaption: (i: number, c: string) => void
  onSlotPosition: (i: number, pos: { x: number; y: number }) => void
}) {
  const t = getTemplate(page.layoutType)
  return (
    <div
      className="w-full h-full rounded-2xl overflow-hidden shadow-2xl"
      style={{ background: page.background }}
    >
      <div
        className="w-full h-full grid gap-1 p-1"
        style={{
          gridTemplateAreas: t.gridAreas,
          gridTemplateColumns: getGridCols(page.layoutType),
          gridTemplateRows: getGridRows(page.layoutType),
        }}
      >
        {page.slots.map((slot, i) => (
          <PageSlotCell
            key={slot.id}
            slot={slot}
            pageId={page.id}
            slotIndex={i}
            gridArea={['a','b','c','d'][i]}
            onClear={() => onSlotClear(i)}
            onCaptionChange={(c) => onSlotCaption(i, c)}
            onPositionChange={(pos) => onSlotPosition(i, pos)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Book size dropdown ────────────────────────────────────────────────────────

function BookSizeDropdown({ value, onChange }: { value: BookSizeId; onChange: (id: BookSizeId) => void }) {
  const [open, setOpen] = useState(false)
  const selected = getBookSize(value)
  return (
    <div className="border-b border-stone-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-stone-800">Book size</span>
          <span className="text-xs text-stone-400 truncate">{selected.label} · {selected.dimensions}</span>
        </div>
        <svg
          className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 16 16"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <BookSizePicker value={value} onChange={(id) => { onChange(id); setOpen(false) }} />
        </div>
      )}
    </div>
  )
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export default function CurateEditor({ bookId, bookTitle, photos, initialLayout, initialPageIndex = 0, backHref, initialBookSize }: Props) {
  const [layout, setLayout] = useState<BookLayout>(initialLayout)
  const [pageIndex, setPageIndex] = useState(initialPageIndex)
  const [bookSizeId, setBookSizeId] = useState<BookSizeId>((initialBookSize as BookSizeId) ?? DEFAULT_BOOK_SIZE_ID)
  const bookSize = getBookSize(bookSizeId)
  const [activePhoto, setActivePhoto] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const currentPage = layout.pages[pageIndex]

  const updatePage = useCallback((idx: number, fn: (p: BookPage) => BookPage) => {
    setLayout((prev) => ({ pages: prev.pages.map((p, i) => i === idx ? fn(p) : p) }))
  }, [])

  function handleDragStart(e: DragStartEvent) {
    const d = e.active.data.current
    if (d?.type === 'pool') setActivePhoto(d.url)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActivePhoto(null)
    const { over, active } = e
    if (!over) return
    const drop = over.data.current as { pageId: string; slotIndex: number } | undefined
    const drag = active.data.current as { type: string; url: string } | undefined
    if (!drop || !drag) return
    const idx = layout.pages.findIndex((p) => p.id === drop.pageId)
    if (idx === -1) return
    updatePage(idx, (page) => ({
      ...page,
      slots: page.slots.map((s, i) => i === drop.slotIndex ? { ...s, photoUrl: drag.url } : s),
    }))
  }

  function handleLayoutChange(type: LayoutType) {
    updatePage(pageIndex, (page) => {
      const t = getTemplate(type)
      return {
        ...page,
        layoutType: type,
        slots: makeSlots(t.slotCount).map((s, i) => ({
          ...s,
          photoUrl: page.slots[i]?.photoUrl ?? null,
          caption: page.slots[i]?.caption ?? null,
        })),
      }
    })
  }

  function addPage() {
    setLayout((prev) => ({ pages: [...prev.pages, makeBlankPage('full')] }))
    setPageIndex(layout.pages.length)
  }

  function deletePage() {
    if (layout.pages.length <= 1) return
    setLayout((prev) => ({ pages: prev.pages.filter((_, i) => i !== pageIndex) }))
    setPageIndex(Math.min(pageIndex, layout.pages.length - 2))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('books').update({ layout, book_size: bookSizeId }).eq('id', bookId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const filledSlots = layout.pages.reduce((a, p) => a + p.slots.filter((s) => s.photoUrl).length, 0)

  return (
    <DndContext id="curate-editor" onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="fixed inset-0 bg-[#e8e6e1] flex flex-col" style={{ fontFamily: 'var(--font-inter)' }}>

        {/* ── Top bar ────────────────────────────────────────────────── */}
        <div className="bg-white border-b border-stone-200 px-5 py-3 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <Link href={backHref ?? `/dashboard/books/${bookId}`} className="text-stone-400 hover:text-stone-800 transition-colors flex items-center gap-1.5">
              <ArrowLeft size={20} />
              {backHref && <span className="text-xs text-stone-400">Back to print details</span>}
            </Link>
            <div>
              <span className="text-sm font-semibold text-stone-900">{bookTitle}</span>
              <span className="text-xs text-stone-400 ml-3">
                {layout.pages.length} pages · {filledSlots} photos placed
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={addPage}
              className="flex items-center gap-1.5 border border-stone-200 px-3 py-2 rounded-full text-sm text-stone-600 hover:bg-stone-50 transition-colors"
            >
              <Plus size={14} /> Add page
            </button>
            <button
              onClick={deletePage}
              disabled={layout.pages.length <= 1}
              className="flex items-center gap-1.5 border border-red-100 px-3 py-2 rounded-full text-sm text-red-400 hover:bg-red-50 disabled:opacity-30 transition-colors"
            >
              <Trash2 size={14} /> Delete page
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                saved ? 'bg-green-600 text-white' : 'bg-stone-900 text-white hover:bg-stone-700'
              } disabled:opacity-50`}
            >
              <Save size={14} />
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save layout'}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: Photo pool ───────────────────────────────────────── */}
          <div className="w-64 bg-white border-r border-stone-200 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-stone-100">
              <p className="text-sm font-semibold text-stone-800">Photo pool</p>
              <p className="text-xs text-stone-400 mt-0.5">{photos.length} submitted — drag onto page</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2 content-start">
              {photos.map((photo, i) => (
                <PoolPhoto key={i} photo={photo} index={i} />
              ))}
            </div>
          </div>

          {/* ── Centre: Single large page + navigation ─────────────────── */}
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 py-6 overflow-hidden">

            {/* Page counter */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-stone-500">
                Page <strong className="text-stone-800">{pageIndex + 1}</strong> of {layout.pages.length}
              </span>
              <div className="flex gap-1">
                {layout.pages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPageIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === pageIndex ? 'bg-stone-800 w-5' : 'bg-stone-300 hover:bg-stone-500'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Page canvas + arrows */}
            <div className="flex items-center gap-4 flex-1 w-full max-w-2xl">

              {/* Prev arrow */}
              <button
                onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                disabled={pageIndex === 0}
                className="shrink-0 w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-stone-600 hover:bg-stone-50 disabled:opacity-20 transition-all hover:scale-105"
              >
                <ChevronLeft size={24} />
              </button>

              {/* Page canvas */}
              <div className="flex-1 h-full" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                <div className="h-full mx-auto" style={{ aspectRatio: bookSize.aspectRatio, maxHeight: '100%' }}>
                  {currentPage && (
                    <LargePageCanvas
                      page={currentPage}
                      onSlotClear={(i) => updatePage(pageIndex, (p) => ({
                        ...p,
                        slots: p.slots.map((s, si) => si === i ? { ...s, photoUrl: null, caption: null } : s),
                      }))}
                      onSlotCaption={(i, c) => updatePage(pageIndex, (p) => ({
                        ...p,
                        slots: p.slots.map((s, si) => si === i ? { ...s, caption: c } : s),
                      }))}
                      onSlotPosition={(i, pos) => updatePage(pageIndex, (p) => ({
                        ...p,
                        slots: p.slots.map((s, si) => si === i ? { ...s, objectPosition: pos } : s),
                      }))}
                    />
                  )}
                </div>
              </div>

              {/* Next arrow */}
              <button
                onClick={() => setPageIndex((i) => Math.min(layout.pages.length - 1, i + 1))}
                disabled={pageIndex === layout.pages.length - 1}
                className="shrink-0 w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-stone-600 hover:bg-stone-50 disabled:opacity-20 transition-all hover:scale-105"
              >
                <ChevronRight size={24} />
              </button>
            </div>

          </div>

          {/* ── Right: Book size + Layout templates + Notes ─────────────── */}
          <div className="w-72 bg-white border-l border-stone-200 flex flex-col shrink-0">

            {/* Book size picker — collapsible */}
            <BookSizeDropdown value={bookSizeId} onChange={setBookSizeId} />

            <div className="px-4 py-3 border-b border-stone-100">
              <p className="text-sm font-semibold text-stone-800">Page layout</p>
              <p className="text-xs text-stone-400 mt-0.5">Click to apply to current page</p>
            </div>

            {/* Notes dropdown pinned at top */}
            <div className="px-3 border-b border-stone-100">
              <NotesDropdown
                notes={currentPage?.notes ?? []}
                onChange={(notes) => updatePage(pageIndex, (p) => ({ ...p, notes }))}
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
              {/* Layouts grid — 2 columns */}
              <div className="grid grid-cols-2 gap-2">
                {LAYOUT_TEMPLATES.map((t) => (
                  <LayoutPreview
                    key={t.type}
                    type={t.type}
                    active={currentPage?.layoutType === t.type}
                    onClick={() => handleLayoutChange(t.type)}
                  />
                ))}
              </div>

              {/* Background colour */}
              <div className="border-t border-stone-100 pt-3 mt-1">
                <p className="text-xs font-semibold text-stone-700 mb-2">Page background</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={currentPage?.background ?? '#ffffff'}
                    onChange={(e) => updatePage(pageIndex, (p) => ({ ...p, background: e.target.value }))}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-stone-200"
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {['#ffffff','#faf9f7','#1a1714','#e8e0d5','#dce8e0','#e8dce8'].map((c) => (
                      <button
                        key={c}
                        onClick={() => updatePage(pageIndex, (p) => ({ ...p, background: c }))}
                        className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                        style={{
                          background: c,
                          borderColor: currentPage?.background === c ? '#1a1714' : '#e5e5e5',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      <DragOverlay>
        {activePhoto && (
          <div className="w-20 h-20 rounded-xl overflow-hidden shadow-2xl ring-2 ring-stone-900 rotate-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activePhoto} alt="" className="w-full h-full object-cover" />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
