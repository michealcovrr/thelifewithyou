'use client'

import { useState, useCallback, useRef } from 'react'
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  useDraggable, useDroppable,
} from '@dnd-kit/core'
import {
  BookLayout, BookPage, PageSlot, LayoutType, TextBlock,
  LAYOUT_TEMPLATES, getTemplate, makeBlankPage, makeSlots,
  buildSpreads, getGridCols, getGridRows, BOOK_DIMS,
} from '@/lib/layouts'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Plus, Trash2, ChevronLeft, ChevronRight, Save, ArrowLeft,
  Move, MessageSquarePlus, Type, Bold, Italic,
  AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react'
import Image from 'next/image'
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

// ─── Layout preview ────────────────────────────────────────────────────────────

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
            <div key={i} style={{ gridArea: ['a','b','c','d'][i] }} className={`${slotColors[i]} rounded-sm`} />
          ))}
        </div>
      </div>
      <div className={`px-2 py-1.5 text-xs font-medium text-center ${active ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-600'}`}>
        {t.label}
      </div>
    </button>
  )
}

// ─── Draggable pool photo ──────────────────────────────────────────────────────

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
        border-2 border-transparent hover:border-stone-400 hover:scale-105 transition-all shadow-sm
        ${isDragging ? 'opacity-25 scale-95' : ''}`}
    >
      <Image src={photo.url} alt={photo.contributor} fill className="object-cover" sizes="80px" />
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1 pt-3 pb-0.5 opacity-0 hover:opacity-100 transition-opacity">
        <p className="text-white text-[9px] truncate">{photo.contributor}</p>
      </div>
    </div>
  )
}

// ─── Droppable page slot ───────────────────────────────────────────────────────

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
      onPositionChange({
        x: Math.min(100, Math.max(0, panRef.current.startPosX + dx)),
        y: Math.min(100, Math.max(0, panRef.current.startPosY + dy)),
      })
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
        isOver ? 'ring-4 ring-stone-900 ring-offset-1 scale-[0.98]' : ''
      } ${slot.photoUrl ? '' : 'bg-stone-100 border-2 border-dashed border-stone-300'}`}
    >
      {slot.photoUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slot.photoUrl} alt=""
            className="absolute inset-0 w-full h-full object-cover select-none"
            style={{ objectPosition: `${pos.x}% ${pos.y}%`, cursor: repositioning ? 'grab' : 'default' }}
            draggable={false}
            onMouseDown={handlePanStart}
          />
          {repositioning && (
            <div className="absolute inset-0 ring-4 ring-blue-400 ring-inset pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500/80 text-white text-[10px] px-2 py-1 rounded-full pointer-events-none">
                Drag to reposition
              </div>
            </div>
          )}
          {(slot.caption || editingCaption) && (
            <div className="absolute bottom-0 inset-x-0 bg-black/50 px-3 py-2 z-10">
              {editingCaption ? (
                <input autoFocus value={slot.caption ?? ''} onChange={e => onCaptionChange(e.target.value)}
                  onBlur={() => setEditingCaption(false)}
                  className="w-full bg-transparent text-white text-xs outline-none placeholder-white/60"
                  placeholder="Type caption…" />
              ) : (
                <p className="text-white text-xs cursor-text" onClick={() => setEditingCaption(true)}>{slot.caption}</p>
              )}
            </div>
          )}
          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 hover:opacity-100 transition-opacity z-10">
            <button onClick={() => setRepositioning(r => !r)} title="Reposition"
              className={`rounded-full p-1.5 backdrop-blur-sm transition-colors ${repositioning ? 'bg-blue-500 text-white' : 'bg-black/60 hover:bg-black/80 text-white'}`}>
              <Move size={11} />
            </button>
            {!slot.caption && !editingCaption && (
              <button onClick={() => setEditingCaption(true)}
                className="bg-black/60 hover:bg-black/80 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm">
                + caption
              </button>
            )}
            <button onClick={() => { setRepositioning(false); onClear() }}
              className="bg-black/60 hover:bg-red-600 text-white rounded-full p-1.5 backdrop-blur-sm transition-colors">
              <Trash2 size={11} />
            </button>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-stone-400">
          {isOver
            ? <span className="text-stone-700 font-semibold text-sm">Drop here</span>
            : <>
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-stone-300 flex items-center justify-center">
                  <Plus size={14} className="text-stone-300" />
                </div>
                <span className="text-[10px]">drag photo here</span>
              </>
          }
        </div>
      )}
    </div>
  )
}

// ─── Editable text block ───────────────────────────────────────────────────────

function EditableTextBlock({
  block, selected, onSelect, onUpdate, onDelete, onDragStart,
}: {
  block: TextBlock
  selected: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<TextBlock>) => void
  onDelete: () => void
  onDragStart: (e: React.MouseEvent) => void
}) {
  const [editing, setEditing] = useState(false)
  const fontSizes = ['0.55rem', '0.7rem', '0.875rem', '1.15rem', '1.6rem']

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${block.x}%`,
    top: `${block.y}%`,
    fontSize: fontSizes[block.fontSize - 1],
    fontFamily: block.fontFamily === 'serif' ? 'var(--font-playfair, Georgia, serif)' : 'var(--font-inter, sans-serif)',
    color: block.color,
    textAlign: block.textAlign,
    fontWeight: block.bold ? 700 : 400,
    fontStyle: block.italic ? 'italic' : 'normal',
    cursor: editing ? 'text' : 'move',
    userSelect: editing ? 'text' : 'none',
    minWidth: '3rem',
    maxWidth: '80%',
    zIndex: 30,
    lineHeight: 1.3,
  }

  return (
    <div
      style={style}
      className={selected && !editing ? 'outline outline-2 outline-dashed outline-stone-400 outline-offset-2' : ''}
      onMouseDown={e => { if (!editing) { e.stopPropagation(); onSelect(); onDragStart(e) } }}
      onDoubleClick={e => { e.stopPropagation(); setEditing(true); onSelect() }}
    >
      {editing ? (
        <textarea
          autoFocus
          value={block.content}
          onChange={e => onUpdate({ content: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }}
          rows={2}
          className="bg-transparent border-none outline-none resize-none w-full"
          style={{
            fontSize: 'inherit', fontFamily: 'inherit', color: 'inherit',
            fontWeight: 'inherit', fontStyle: 'inherit', textAlign: 'inherit',
            lineHeight: 'inherit', minWidth: '8rem',
          }}
        />
      ) : (
        <span className="whitespace-pre-wrap break-words">
          {block.content || <span className="opacity-40 italic">Text</span>}
        </span>
      )}
      {selected && !editing && (
        <button
          onMouseDown={e => { e.stopPropagation(); onDelete() }}
          className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] hover:bg-red-600"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ─── Page canvas ──────────────────────────────────────────────────────────────

function PageCanvas({
  page, bleedX, bleedY, isActive, onActivate,
  onSlotClear, onSlotCaption, onSlotPosition,
  selectedTextId, onTextSelect, onTextUpdate, onTextDelete,
}: {
  page: BookPage
  bleedX: number; bleedY: number
  isActive: boolean
  onActivate: () => void
  onSlotClear: (i: number) => void
  onSlotCaption: (i: number, c: string) => void
  onSlotPosition: (i: number, pos: { x: number; y: number }) => void
  selectedTextId: string | null
  onTextSelect: (id: string | null) => void
  onTextUpdate: (blockId: string, patch: Partial<TextBlock>) => void
  onTextDelete: (blockId: string) => void
}) {
  const t = getTemplate(page.layoutType)
  const containerRef = useRef<HTMLDivElement>(null)

  function handleTextDragStart(e: React.MouseEvent, block: TextBlock) {
    const captured = containerRef.current
    if (!captured) return
    const startX = e.clientX; const startY = e.clientY
    const startBX = block.x; const startBY = block.y
    const el: HTMLDivElement = captured
    function onMove(ev: MouseEvent) {
      const { width, height } = el.getBoundingClientRect()
      onTextUpdate(block.id, {
        x: Math.min(95, Math.max(0, startBX + ((ev.clientX - startX) / width) * 100)),
        y: Math.min(95, Math.max(0, startBY + ((ev.clientY - startY) / height) * 100)),
      })
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={containerRef}
      onClick={onActivate}
      className={`relative w-full h-full overflow-hidden cursor-pointer transition-all ${
        isActive ? 'ring-2 ring-stone-900 ring-offset-2' : 'hover:ring-2 hover:ring-stone-300 hover:ring-offset-2'
      }`}
      style={{ background: page.background }}
    >
      {/* Photo grid */}
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateAreas: t.gridAreas,
          gridTemplateColumns: getGridCols(page.layoutType),
          gridTemplateRows: getGridRows(page.layoutType),
          gap: '2px',
        }}
      >
        {page.slots.map((slot, i) => (
          <PageSlotCell
            key={slot.id} slot={slot} pageId={page.id} slotIndex={i}
            gridArea={['a','b','c','d'][i]}
            onClear={() => onSlotClear(i)}
            onCaptionChange={c => onSlotCaption(i, c)}
            onPositionChange={pos => onSlotPosition(i, pos)}
          />
        ))}
      </div>

      {/* Text blocks */}
      {page.textBlocks.map(block => (
        <EditableTextBlock
          key={block.id} block={block}
          selected={selectedTextId === block.id}
          onSelect={() => onTextSelect(block.id)}
          onUpdate={patch => onTextUpdate(block.id, patch)}
          onDelete={() => onTextDelete(block.id)}
          onDragStart={e => handleTextDragStart(e, block)}
        />
      ))}

      {/* Bleed / safety guide */}
      <div
        className="absolute pointer-events-none z-40"
        style={{
          top: `${bleedY}%`, left: `${bleedX}%`,
          right: `${bleedX}%`, bottom: `${bleedY}%`,
          border: '1px dashed rgba(180,140,0,0.4)',
        }}
      />
    </div>
  )
}

// ─── IFC placeholder ──────────────────────────────────────────────────────────

function IfcPlaceholder() {
  return (
    <div className="relative w-full h-full bg-stone-100 flex flex-col items-center justify-center gap-1 border border-stone-200">
      <span className="text-stone-400 text-xs uppercase tracking-widest">Inner cover</span>
      <span className="text-stone-300 text-[10px]">Not editable</span>
    </div>
  )
}

// ─── Notes ────────────────────────────────────────────────────────────────────

function NotesDropdown({ notes, onChange }: { notes: string[]; onChange: (n: string[]) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-stone-100 pt-2">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-1 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 transition-colors">
        <span className="flex items-center gap-2">
          <MessageSquarePlus size={13} className="text-stone-500" />
          Notes for design team
          {notes.length > 0 && (
            <span className="bg-amber-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{notes.length}</span>
          )}
        </span>
        <ChevronRight size={13} className={`text-stone-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="pb-3 flex flex-col gap-2">
          <p className="text-[10px] text-stone-400 leading-relaxed px-1">
            Any requests for this page — effects, cross-spine photos, framing.
          </p>
          <NotesList notes={notes} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

function NotesList({ notes, onChange }: { notes: string[]; onChange: (n: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  function addNote() {
    const t = draft.trim(); if (!t) return
    onChange([...notes, t]); setDraft(''); inputRef.current?.focus()
  }
  return (
    <div className="flex flex-col gap-2">
      {notes.length > 0 && (
        <ul className="flex flex-col gap-1">
          {notes.map((note, i) => (
            <li key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 group">
              <span className="text-amber-400 mt-0.5 shrink-0 text-[10px]">•</span>
              <span className="text-[10px] text-stone-700 flex-1">{note}</span>
              <button onClick={() => onChange(notes.filter((_,idx) => idx !== i))}
                className="text-stone-300 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100">
                <Trash2 size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1.5">
        <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addNote()}
          placeholder="Add a request…"
          className="flex-1 text-[10px] border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-stone-400 placeholder-stone-300" />
        <button onClick={addNote} disabled={!draft.trim()}
          className="bg-stone-900 text-white rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-30 transition-colors hover:bg-stone-700">
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── Text style panel ─────────────────────────────────────────────────────────

function TextStylePanel({ block, onUpdate }: { block: TextBlock; onUpdate: (p: Partial<TextBlock>) => void }) {
  return (
    <div className="flex flex-col gap-3 px-3 py-3 border-b border-stone-100 bg-stone-50">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Text style</p>
      <div className="flex gap-1.5">
        {(['serif', 'sans-serif'] as const).map(f => (
          <button key={f} onClick={() => onUpdate({ fontFamily: f })}
            className={`flex-1 py-1.5 rounded-lg text-[10px] border transition-colors ${
              block.fontFamily === f ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
            }`}
            style={{ fontFamily: f === 'serif' ? 'Georgia, serif' : 'sans-serif' }}>
            {f === 'serif' ? 'Serif' : 'Sans'}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        {(['XS','S','M','L','XL'] as const).map((label, i) => (
          <button key={i} onClick={() => onUpdate({ fontSize: (i + 1) as 1|2|3|4|5 })}
            className={`flex-1 py-1 rounded text-[9px] border transition-colors ${
              block.fontSize === i + 1 ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'
            }`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-1 items-center">
        <button onClick={() => onUpdate({ bold: !block.bold })}
          className={`p-1.5 rounded border transition-colors ${block.bold ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'}`}>
          <Bold size={12} />
        </button>
        <button onClick={() => onUpdate({ italic: !block.italic })}
          className={`p-1.5 rounded border transition-colors ${block.italic ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'}`}>
          <Italic size={12} />
        </button>
        <div className="w-px bg-stone-200 h-5 mx-0.5" />
        {(['left','center','right'] as const).map(align => (
          <button key={align} onClick={() => onUpdate({ textAlign: align })}
            className={`p-1.5 rounded border transition-colors ${block.textAlign === align ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'}`}>
            {align === 'left' ? <AlignLeft size={12} /> : align === 'center' ? <AlignCenter size={12} /> : <AlignRight size={12} />}
          </button>
        ))}
        <div className="flex-1" />
        <input type="color" value={block.color} onChange={e => onUpdate({ color: e.target.value })}
          className="w-7 h-7 rounded border border-stone-200 cursor-pointer" title="Text colour" />
      </div>
      <div className="flex gap-1 flex-wrap">
        {['#000000','#ffffff','#faf9f7','#1a1714','#e8d5b0','#a3c4bc','#f4b942','#e05c5c'].map(c => (
          <button key={c} onClick={() => onUpdate({ color: c })}
            className="w-5 h-5 rounded-full border-2 transition-all hover:scale-110"
            style={{ background: c, borderColor: block.color === c ? '#1a1714' : '#d1d5db' }} />
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
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-stone-800">Book size</span>
          <span className="text-xs text-stone-400 truncate">{selected.label} · {selected.dimensions}</span>
        </div>
        <svg className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 16 16">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <BookSizePicker value={value} onChange={id => { onChange(id); setOpen(false) }} />
        </div>
      )}
    </div>
  )
}

// ─── Main editor ───────────────────────────────────────────────────────────────

export default function CurateEditor({
  bookId, bookTitle, photos, initialLayout, backHref, initialBookSize,
}: Props) {
  const [layout, setLayout] = useState<BookLayout>(initialLayout)
  const [bookSizeId, setBookSizeId] = useState<BookSizeId>((initialBookSize as BookSizeId) ?? DEFAULT_BOOK_SIZE_ID)
  const [spreadIndex, setSpreadIndex] = useState(0)
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [selectedText, setSelectedText] = useState<{ pageId: string; blockId: string } | null>(null)
  const [activePhoto, setActivePhoto] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const spreads = buildSpreads(layout.pages)
  const currentSpread = spreads[spreadIndex]

  const dims = BOOK_DIMS[bookSizeId] ?? [8, 10]
  const bleedX = (0.5 / dims[0]) * 100
  const bleedY = (0.5 / dims[1]) * 100

  const activePageIndex = activePageId ? layout.pages.findIndex(p => p.id === activePageId) : -1
  const activePage = activePageIndex >= 0 ? layout.pages[activePageIndex] : null

  const selectedTextBlock = selectedText
    ? layout.pages.find(p => p.id === selectedText.pageId)?.textBlocks.find(b => b.id === selectedText.blockId) ?? null
    : null

  const updatePage = useCallback((idx: number, fn: (p: BookPage) => BookPage) => {
    setLayout(prev => ({ pages: prev.pages.map((p, i) => i === idx ? fn(p) : p) }))
  }, [])

  function updatePageById(pageId: string, fn: (p: BookPage) => BookPage) {
    const idx = layout.pages.findIndex(p => p.id === pageId)
    if (idx >= 0) updatePage(idx, fn)
  }

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
    const idx = layout.pages.findIndex(p => p.id === drop.pageId)
    if (idx === -1) return
    updatePage(idx, page => ({
      ...page,
      slots: page.slots.map((s, i) => i === drop.slotIndex ? { ...s, photoUrl: drag.url } : s),
    }))
  }

  function handleLayoutChange(type: LayoutType) {
    if (activePageIndex < 0) return
    updatePage(activePageIndex, page => {
      const t = getTemplate(type)
      return {
        ...page, layoutType: type,
        slots: makeSlots(t.slotCount).map((s, i) => ({
          ...s,
          photoUrl: page.slots[i]?.photoUrl ?? null,
          caption: page.slots[i]?.caption ?? null,
        })),
      }
    })
  }

  function addPage() {
    const newPage = makeBlankPage('full')
    const newPages = [...layout.pages, newPage]
    setLayout({ pages: newPages })
    const newSpreads = buildSpreads(newPages)
    setSpreadIndex(newSpreads.length - 1)
    setActivePageId(newPage.id)
  }

  function deletePage() {
    if (!activePageId || layout.pages.length <= 1) return
    setLayout(prev => ({ pages: prev.pages.filter(p => p.id !== activePageId) }))
    setActivePageId(null)
    setSpreadIndex(Math.max(0, spreadIndex - 1))
  }

  function addTextBlock() {
    if (!activePageId) return
    const newBlock: TextBlock = {
      id: crypto.randomUUID(),
      content: 'Double-click to edit',
      x: 20, y: 45,
      fontSize: 3,
      fontFamily: 'serif',
      color: '#ffffff',
      textAlign: 'left',
      bold: false,
      italic: false,
    }
    updatePageById(activePageId, page => ({ ...page, textBlocks: [...page.textBlocks, newBlock] }))
    setSelectedText({ pageId: activePageId, blockId: newBlock.id })
  }

  function updateTextBlock(pageId: string, blockId: string, patch: Partial<TextBlock>) {
    updatePageById(pageId, page => ({
      ...page,
      textBlocks: page.textBlocks.map(b => b.id === blockId ? { ...b, ...patch } : b),
    }))
  }

  function deleteTextBlock(pageId: string, blockId: string) {
    updatePageById(pageId, page => ({ ...page, textBlocks: page.textBlocks.filter(b => b.id !== blockId) }))
    setSelectedText(null)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('books').update({ layout, book_size: bookSizeId }).eq('id', bookId)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const filledSlots = layout.pages.reduce((a, p) => a + p.slots.filter(s => s.photoUrl).length, 0)

  // Helper to render one side of the spread
  function renderPage(page: BookPage | null, isLeft: boolean) {
    if (isLeft && currentSpread.left === null) return <IfcPlaceholder />
    if (!page) return (
      <div className="w-full h-full bg-stone-50 border border-dashed border-stone-200 flex items-center justify-center">
        <span className="text-stone-300 text-xs">No page</span>
      </div>
    )
    return (
      <PageCanvas
        page={page}
        bleedX={bleedX} bleedY={bleedY}
        isActive={activePageId === page.id}
        onActivate={() => { setActivePageId(page.id); setSelectedText(null) }}
        onSlotClear={i => updatePageById(page.id, p => ({
          ...p, slots: p.slots.map((s, si) => si === i ? { ...s, photoUrl: null, caption: null } : s),
        }))}
        onSlotCaption={(i, c) => updatePageById(page.id, p => ({
          ...p, slots: p.slots.map((s, si) => si === i ? { ...s, caption: c } : s),
        }))}
        onSlotPosition={(i, pos) => updatePageById(page.id, p => ({
          ...p, slots: p.slots.map((s, si) => si === i ? { ...s, objectPosition: pos } : s),
        }))}
        selectedTextId={selectedText?.pageId === page.id ? selectedText.blockId : null}
        onTextSelect={id => setSelectedText(id ? { pageId: page.id, blockId: id } : null)}
        onTextUpdate={(blockId, patch) => updateTextBlock(page.id, blockId, patch)}
        onTextDelete={blockId => deleteTextBlock(page.id, blockId)}
      />
    )
  }

  return (
    <DndContext id="curate-editor" onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="fixed inset-0 bg-[#e8e6e1] flex flex-col" style={{ fontFamily: 'var(--font-inter)' }}>

        {/* ── Top bar ───────────────────────────────────────────────────────── */}
        <div className="bg-white border-b border-stone-200 px-5 py-3 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <Link href={backHref ?? `/dashboard/books/${bookId}`}
              className="text-stone-400 hover:text-stone-800 transition-colors flex items-center gap-1.5">
              <ArrowLeft size={20} />
              {backHref && <span className="text-xs text-stone-400">Back</span>}
            </Link>
            <div>
              <span className="text-sm font-semibold text-stone-900">{bookTitle}</span>
              <span className="text-xs text-stone-400 ml-3">
                {layout.pages.length} pages · {filledSlots} photos placed
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={addPage}
              className="flex items-center gap-1.5 border border-stone-200 px-3 py-2 rounded-full text-sm text-stone-600 hover:bg-stone-50 transition-colors">
              <Plus size={14} /> Add page
            </button>
            <button onClick={deletePage} disabled={!activePageId || layout.pages.length <= 1}
              className="flex items-center gap-1.5 border border-red-100 px-3 py-2 rounded-full text-sm text-red-400 hover:bg-red-50 disabled:opacity-30 transition-colors">
              <Trash2 size={14} /> Delete page
            </button>
            <button onClick={addTextBlock} disabled={!activePageId}
              className="flex items-center gap-1.5 border border-stone-200 px-3 py-2 rounded-full text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Type size={14} /> Add text
            </button>
            <button onClick={handleSave} disabled={saving}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                saved ? 'bg-green-600 text-white' : 'bg-stone-900 text-white hover:bg-stone-700'
              } disabled:opacity-50`}>
              <Save size={14} />
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save layout'}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: Photo pool ──────────────────────────────────────────── */}
          <div className="w-56 bg-white border-r border-stone-200 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-stone-100">
              <p className="text-sm font-semibold text-stone-800">Photo pool</p>
              <p className="text-xs text-stone-400 mt-0.5">{photos.length} photos — drag onto page</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2 content-start">
              {photos.map((photo, i) => <PoolPhoto key={i} photo={photo} index={i} />)}
              {photos.length === 0 && (
                <p className="col-span-3 text-xs text-stone-400 text-center py-8">No photos yet</p>
              )}
            </div>
          </div>

          {/* ── Centre: Spread ────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col items-center justify-between py-5 px-4 overflow-hidden gap-4">

            {/* Spread label + dots */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-stone-500 font-medium">
                {spreadIndex === 0
                  ? 'Inner cover  ·  Page 1'
                  : [currentSpread.leftLabel, currentSpread.rightLabel].filter(Boolean).join('  ·  ')
                }
              </span>
              <div className="flex gap-1">
                {spreads.map((_, i) => (
                  <button key={i} onClick={() => { setSpreadIndex(i); setActivePageId(null); setSelectedText(null) }}
                    className={`h-1.5 rounded-full transition-all ${
                      i === spreadIndex ? 'bg-stone-700 w-5' : 'bg-stone-300 w-1.5 hover:bg-stone-500'
                    }`} />
                ))}
              </div>
            </div>

            {/* Spread canvas */}
            <div className="flex-1 flex items-center justify-center w-full min-h-0">
              <div className="flex items-center gap-3 w-full h-full">

                {/* Prev */}
                <button onClick={() => { setSpreadIndex(i => Math.max(0, i - 1)); setActivePageId(null); setSelectedText(null) }}
                  disabled={spreadIndex === 0}
                  className="shrink-0 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-stone-600 hover:bg-stone-50 disabled:opacity-20 transition-all hover:scale-105">
                  <ChevronLeft size={22} />
                </button>

                {/* The two pages */}
                <div className="flex-1 flex items-center justify-center min-h-0 min-w-0 h-full">
                  <div
                    className="flex items-stretch shadow-2xl"
                    style={{
                      /* fill vertically, respect aspect ratio */
                      height: '100%',
                      aspectRatio: `${dims[0] * 2} / ${dims[1]}`,
                      maxWidth: '100%',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      {renderPage(currentSpread.left, true)}
                    </div>
                    {/* Spine */}
                    <div className="w-3 shrink-0 bg-gradient-to-r from-stone-400 via-stone-200 to-stone-400" />
                    <div className="flex-1 min-w-0">
                      {renderPage(currentSpread.right, false)}
                    </div>
                  </div>
                </div>

                {/* Next */}
                <button onClick={() => { setSpreadIndex(i => Math.min(spreads.length - 1, i + 1)); setActivePageId(null); setSelectedText(null) }}
                  disabled={spreadIndex === spreads.length - 1}
                  className="shrink-0 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-stone-600 hover:bg-stone-50 disabled:opacity-20 transition-all hover:scale-105">
                  <ChevronRight size={22} />
                </button>
              </div>
            </div>

            {/* Bleed hint */}
            <p className="text-[10px] text-stone-400 shrink-0">
              <span className="opacity-60">– – –</span> dashed line = 0.5&quot; bleed margin (safe zone for print)
              {!activePageId && <span className="ml-2 text-stone-400">· Click a page to edit it</span>}
            </p>
          </div>

          {/* ── Right: Controls ───────────────────────────────────────────── */}
          <div className="w-72 bg-white border-l border-stone-200 flex flex-col shrink-0 overflow-y-auto">

            <BookSizeDropdown value={bookSizeId} onChange={setBookSizeId} />

            {selectedTextBlock && (
              <TextStylePanel
                block={selectedTextBlock}
                onUpdate={patch => updateTextBlock(selectedText!.pageId, selectedText!.blockId, patch)}
              />
            )}

            {activePage ? (
              <>
                <div className="px-4 py-3 border-b border-stone-100">
                  <p className="text-sm font-semibold text-stone-800">Page layout</p>
                  <p className="text-xs text-stone-400 mt-0.5">Applied to selected page</p>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2">
                  {LAYOUT_TEMPLATES.map(t => (
                    <LayoutPreview key={t.type} type={t.type}
                      active={activePage.layoutType === t.type}
                      onClick={() => handleLayoutChange(t.type)} />
                  ))}
                </div>

                <div className="px-4 py-3 border-t border-stone-100">
                  <p className="text-xs font-semibold text-stone-700 mb-2">Page background</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="color" value={activePage.background}
                      onChange={e => updatePage(activePageIndex, p => ({ ...p, background: e.target.value }))}
                      className="w-9 h-9 rounded-lg cursor-pointer border border-stone-200" />
                    {['#ffffff','#faf9f7','#1a1714','#e8e0d5','#dce8e0','#e8dce8','#111111'].map(c => (
                      <button key={c} onClick={() => updatePage(activePageIndex, p => ({ ...p, background: c }))}
                        className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                        style={{ background: c, borderColor: activePage.background === c ? '#1a1714' : '#e5e5e5' }} />
                    ))}
                  </div>
                </div>

                <div className="px-3 pb-4">
                  <NotesDropdown
                    notes={activePage.notes}
                    onChange={notes => updatePage(activePageIndex, p => ({ ...p, notes }))}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center px-6 text-center">
                <p className="text-sm text-stone-400 leading-relaxed">
                  Click a page in the spread to select it
                </p>
              </div>
            )}
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
