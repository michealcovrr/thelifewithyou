'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  useDraggable, useDroppable,
} from '@dnd-kit/core'
import {
  BookLayout, BookPage, CanvasPhoto, TextBlock,
  makeBlankPage, buildSpreads, BOOK_DIMS,
} from '@/lib/layouts'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Plus, Trash2, ChevronLeft, ChevronRight, Save, ArrowLeft,
  MessageSquarePlus, Type, Bold, Italic,
  AlignLeft, AlignCenter, AlignRight, Layers, RotateCw, ArrowLeftRight,
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

// ─── Pool photo ────────────────────────────────────────────────────────────────

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

// ─── Canvas photo element ─────────────────────────────────────────────────────

type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br'

function CanvasPhotoEl({
  el, selected, onSelect, onUpdate, onDelete, containerRef, canSpan,
}: {
  el: CanvasPhoto
  selected: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<CanvasPhoto>) => void
  onDelete: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
  canSpan: boolean
}) {
  const elRef = useRef<HTMLDivElement>(null)

  // ── Move ──────────────────────────────────────────────────────────────────
  function handleBodyMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    e.stopPropagation()
    onSelect()
    const c = containerRef.current; if (!c) return
    const { width, height } = c.getBoundingClientRect()
    const startX = e.clientX; const startY = e.clientY
    const sx = el.x; const sy = el.y

    function onMove(ev: MouseEvent) {
      onUpdate({
        x: Math.max(0, Math.min(100 - el.width, sx + ((ev.clientX - startX) / width) * 100)),
        y: Math.max(0, Math.min(100 - el.height, sy + ((ev.clientY - startY) / height) * 100)),
      })
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  function handleCornerMouseDown(e: React.MouseEvent, corner: ResizeCorner) {
    e.stopPropagation()
    const c = containerRef.current; if (!c) return
    const { width, height } = c.getBoundingClientRect()
    const startX = e.clientX; const startY = e.clientY
    const snap = { x: el.x, y: el.y, w: el.width, h: el.height }

    function onMove(ev: MouseEvent) {
      const dx = ((ev.clientX - startX) / width) * 100
      const dy = ((ev.clientY - startY) / height) * 100
      let nx = snap.x, ny = snap.y, nw = snap.w, nh = snap.h
      if (corner === 'tl') { nx = snap.x + dx; ny = snap.y + dy; nw = snap.w - dx; nh = snap.h - dy }
      if (corner === 'tr') { ny = snap.y + dy; nw = snap.w + dx; nh = snap.h - dy }
      if (corner === 'bl') { nx = snap.x + dx; nw = snap.w - dx; nh = snap.h + dy }
      if (corner === 'br') { nw = snap.w + dx; nh = snap.h + dy }
      if (nw < 5) { nw = 5; if (corner === 'tl' || corner === 'bl') nx = snap.x + snap.w - 5 }
      if (nh < 5) { nh = 5; if (corner === 'tl' || corner === 'tr') ny = snap.y + snap.h - 5 }
      onUpdate({ x: nx, y: ny, width: nw, height: nh })
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  // ── Rotate ────────────────────────────────────────────────────────────────
  function handleRotateMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    const el_el = elRef.current; if (!el_el) return
    const rect = el_el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx)
    const startRot = el.rotation ?? 0

    function onMove(ev: MouseEvent) {
      const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx)
      onUpdate({ rotation: startRot + (angle - startAngle) * (180 / Math.PI) })
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  const corners: { id: ResizeCorner; style: React.CSSProperties; cursor: string }[] = [
    { id: 'tl', style: { top: -5, left: -5 }, cursor: 'nw-resize' },
    { id: 'tr', style: { top: -5, right: -5 }, cursor: 'ne-resize' },
    { id: 'bl', style: { bottom: -5, left: -5 }, cursor: 'sw-resize' },
    { id: 'br', style: { bottom: -5, right: -5 }, cursor: 'se-resize' },
  ]

  return (
    <div
      ref={elRef}
      style={{
        position: 'absolute',
        left: `${el.x}%`, top: `${el.y}%`,
        width: `${el.width}%`, height: `${el.height}%`,
        zIndex: el.zIndex,
        cursor: 'move',
        userSelect: 'none',
        transform: `rotate(${el.rotation ?? 0}deg)`,
        transformOrigin: 'center center',
      }}
      onMouseDown={handleBodyMouseDown}
    >
      {/* Photo clip */}
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
        boxShadow: selected ? '0 0 0 2px #3b82f6' : 'none' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={el.photoUrl} alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          style={{ objectPosition: `${el.objectPosition.x}% ${el.objectPosition.y}%` }}
          draggable={false}
        />
      </div>

      {selected && (
        <>
          {/* Rotation handle */}
          <div
            style={{ position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)', zIndex: 51 }}
            className="w-5 h-5 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center cursor-grab shadow-sm"
            onMouseDown={handleRotateMouseDown}
          >
            <RotateCw size={10} className="text-blue-500" />
          </div>
          {/* Line from handle to element */}
          <div style={{ position: 'absolute', top: -12, left: '50%', width: 1, height: 12, background: 'rgba(59,130,246,0.5)', zIndex: 50 }} />

          {/* Corner handles */}
          {corners.map(c => (
            <div key={c.id}
              style={{ ...c.style, cursor: c.cursor, position: 'absolute', width: 10, height: 10 }}
              className="bg-white border-2 border-blue-500 rounded-sm z-50"
              onMouseDown={e => handleCornerMouseDown(e, c.id)}
            />
          ))}

          {/* Toolbar */}
          <div
            className="absolute -top-9 left-0 flex items-center gap-1 bg-white rounded-lg shadow-lg px-2 py-1 z-50 border border-stone-200 whitespace-nowrap"
            onMouseDown={e => e.stopPropagation()}
          >
            {canSpan && (
              <>
                <button onClick={() => onUpdate({ crossPage: !el.crossPage })}
                  title={el.crossPage ? 'Unspan pages' : 'Span across both pages'}
                  className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    el.crossPage ? 'bg-blue-100 text-blue-700' : 'text-stone-500 hover:text-stone-900'
                  }`}>
                  <ArrowLeftRight size={12} />
                  {el.crossPage ? 'Unspan' : 'Span pages'}
                </button>
                <div className="w-px h-4 bg-stone-200" />
              </>
            )}
            <button onClick={() => onUpdate({ zIndex: el.zIndex + 1 })} title="Bring forward"
              className="text-stone-500 hover:text-stone-900 p-0.5 transition-colors">
              <Layers size={13} />
            </button>
            <button onClick={() => onUpdate({ zIndex: Math.max(1, el.zIndex - 1) })} title="Send back"
              className="text-stone-400 hover:text-stone-900 p-0.5 transition-colors rotate-180">
              <Layers size={13} />
            </button>
            <div className="w-px h-4 bg-stone-200" />
            <button onClick={onDelete} title="Delete"
              className="text-red-400 hover:text-red-600 p-0.5 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Editable text block ───────────────────────────────────────────────────────

function EditableTextBlock({
  block, selected, onSelect, onUpdate, onDelete, containerRef,
}: {
  block: TextBlock; selected: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<TextBlock>) => void
  onDelete: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const [editing, setEditing] = useState(false)
  const fontSizes = ['0.55rem', '0.7rem', '0.875rem', '1.15rem', '1.6rem']

  function handleMouseDown(e: React.MouseEvent) {
    if (editing) return
    e.stopPropagation()
    onSelect()
    const c = containerRef.current; if (!c) return
    const { width, height } = c.getBoundingClientRect()
    const startX = e.clientX; const startY = e.clientY
    const startBX = block.x; const startBY = block.y

    function onMove(ev: MouseEvent) {
      onUpdate({
        x: Math.min(95, Math.max(0, startBX + ((ev.clientX - startX) / width) * 100)),
        y: Math.min(95, Math.max(0, startBY + ((ev.clientY - startY) / height) * 100)),
      })
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      style={{
        position: 'absolute', left: `${block.x}%`, top: `${block.y}%`,
        fontSize: fontSizes[block.fontSize - 1],
        fontFamily: block.fontFamily === 'serif' ? 'var(--font-playfair, Georgia, serif)' : 'var(--font-inter, sans-serif)',
        color: block.color, textAlign: block.textAlign,
        fontWeight: block.bold ? 700 : 400,
        fontStyle: block.italic ? 'italic' : 'normal',
        cursor: editing ? 'text' : 'move',
        userSelect: editing ? 'text' : 'none',
        zIndex: 40, lineHeight: 1.3,
        outline: selected && !editing ? '1px dashed rgba(59,130,246,0.7)' : 'none',
        outlineOffset: 3, maxWidth: '80%',
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={e => { e.stopPropagation(); setEditing(true); onSelect() }}
    >
      {editing ? (
        <textarea autoFocus value={block.content} onChange={e => onUpdate({ content: e.target.value })}
          onBlur={() => setEditing(false)} onKeyDown={e => e.key === 'Escape' && setEditing(false)}
          rows={2}
          className="bg-transparent border-none outline-none resize-none"
          style={{ fontSize:'inherit', fontFamily:'inherit', color:'inherit', fontWeight:'inherit',
            fontStyle:'inherit', textAlign:'inherit', lineHeight:'inherit', minWidth:'8rem' }}
        />
      ) : (
        <span className="whitespace-pre-wrap break-words">
          {block.content || <span className="opacity-40 italic">Text</span>}
        </span>
      )}
      {selected && !editing && (
        <button onMouseDown={e => { e.stopPropagation(); onDelete() }}
          className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] hover:bg-red-600 z-50">
          ×
        </button>
      )}
    </div>
  )
}

// ─── Page canvas ──────────────────────────────────────────────────────────────

function PageCanvas({
  page, isActive, onActivate,
  selectedElId, onElSelect, onElUpdate, onElDelete,
  selectedTextId, onTextSelect, onTextUpdate, onTextDelete,
  canSpan,
}: {
  page: BookPage; isActive: boolean; onActivate: () => void
  selectedElId: string | null
  onElSelect: (id: string | null) => void
  onElUpdate: (id: string, patch: Partial<CanvasPhoto>) => void
  onElDelete: (id: string) => void
  selectedTextId: string | null
  onTextSelect: (id: string | null) => void
  onTextUpdate: (id: string, patch: Partial<TextBlock>) => void
  onTextDelete: (id: string) => void
  canSpan: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `canvas-${page.id}`, data: { pageId: page.id } })
  const containerRef = useRef<HTMLDivElement>(null)

  function mergeRefs(el: HTMLDivElement | null) {
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
    setNodeRef(el)
  }

  // Only render elements that are NOT cross-page (cross-page renders at spread level)
  const pageElements = (page.elements ?? []).filter(el => !el.crossPage)

  return (
    <div
      ref={mergeRefs}
      onClick={e => { onActivate(); if (e.target === e.currentTarget) { onElSelect(null); onTextSelect(null) } }}
      className={`relative w-full h-full overflow-hidden transition-all select-none ${
        isOver ? 'ring-4 ring-blue-400 ring-inset' : ''
      } ${isActive ? 'ring-2 ring-stone-900 ring-offset-2' : 'hover:ring-2 hover:ring-stone-300 hover:ring-offset-2 cursor-pointer'}`}
      style={{ background: page.background }}
    >
      {[...pageElements].sort((a, b) => a.zIndex - b.zIndex).map(el => (
        <CanvasPhotoEl key={el.id} el={el} selected={selectedElId === el.id}
          onSelect={() => onElSelect(el.id)}
          onUpdate={patch => onElUpdate(el.id, patch)}
          onDelete={() => onElDelete(el.id)}
          containerRef={containerRef}
          canSpan={canSpan}
        />
      ))}

      {page.textBlocks.map(block => (
        <EditableTextBlock key={block.id} block={block}
          selected={selectedTextId === block.id}
          onSelect={() => onTextSelect(block.id)}
          onUpdate={patch => onTextUpdate(block.id, patch)}
          onDelete={() => onTextDelete(block.id)}
          containerRef={containerRef}
        />
      ))}

      {!isOver && pageElements.length === 0 && page.textBlocks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <p className="text-stone-300 text-xs">Drag photos here</p>
        </div>
      )}
      {isOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 bg-blue-50/30">
          <p className="text-blue-500 text-sm font-medium">Drop photo</p>
        </div>
      )}
    </div>
  )
}

// ─── IFC placeholder ──────────────────────────────────────────────────────────

function IfcPlaceholder() {
  return (
    <div className="relative w-full h-full bg-stone-100 flex flex-col items-center justify-center border border-stone-200">
      <span className="text-stone-400 text-xs uppercase tracking-widest">Inner cover</span>
      <span className="text-stone-300 text-[10px] mt-1">Not editable</span>
    </div>
  )
}

// ─── Notes ────────────────────────────────────────────────────────────────────

function NotesDropdown({ notes, onChange }: { notes: string[]; onChange: (n: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  return (
    <div className="border-t border-stone-100 pt-2">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-1 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900">
        <span className="flex items-center gap-2">
          <MessageSquarePlus size={13} className="text-stone-400" />
          Notes for design team
          {notes.length > 0 && <span className="bg-amber-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{notes.length}</span>}
        </span>
        <ChevronRight size={13} className={`text-stone-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="pb-3 flex flex-col gap-2">
          {notes.map((n, i) => (
            <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 group">
              <span className="text-amber-400 text-[10px] mt-0.5">•</span>
              <span className="text-[10px] text-stone-700 flex-1">{n}</span>
              <button onClick={() => onChange(notes.filter((_,j) => j !== i))} className="text-stone-300 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={11} /></button>
            </div>
          ))}
          <div className="flex gap-1.5">
            <input value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { onChange([...notes, draft.trim()]); setDraft('') } }}
              placeholder="Add a request…"
              className="flex-1 text-[10px] border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-stone-400 placeholder-stone-300" />
            <button disabled={!draft.trim()} onClick={() => { onChange([...notes, draft.trim()]); setDraft('') }}
              className="bg-stone-900 text-white rounded-lg px-2.5 py-1.5 disabled:opacity-30 hover:bg-stone-700 transition-colors">
              <Plus size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Text style panel ─────────────────────────────────────────────────────────

function TextStylePanel({ block, onUpdate }: { block: TextBlock; onUpdate: (p: Partial<TextBlock>) => void }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 border-b border-stone-100 bg-stone-50">
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
            }`}>{label}</button>
        ))}
      </div>
      <div className="flex gap-1 items-center">
        {[
          { icon: <Bold size={12} />, key: 'bold' as const, val: block.bold },
          { icon: <Italic size={12} />, key: 'italic' as const, val: block.italic },
        ].map(({ icon, key, val }) => (
          <button key={key} onClick={() => onUpdate({ [key]: !val })}
            className={`p-1.5 rounded border transition-colors ${val ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'}`}>
            {icon}
          </button>
        ))}
        <div className="w-px bg-stone-200 h-5 mx-0.5" />
        {(['left','center','right'] as const).map(align => (
          <button key={align} onClick={() => onUpdate({ textAlign: align })}
            className={`p-1.5 rounded border transition-colors ${block.textAlign === align ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'}`}>
            {align === 'left' ? <AlignLeft size={12} /> : align === 'center' ? <AlignCenter size={12} /> : <AlignRight size={12} />}
          </button>
        ))}
        <div className="flex-1" />
        <input type="color" value={block.color} onChange={e => onUpdate({ color: e.target.value })}
          className="w-7 h-7 rounded border border-stone-200 cursor-pointer" />
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

// ─── Spread size hook ─────────────────────────────────────────────────────────

function useSpreadSize(containerRef: React.RefObject<HTMLDivElement | null>, aspectRatio: number) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width / height > aspectRatio) setSize({ w: height * aspectRatio, h: height })
      else setSize({ w: width, h: width / aspectRatio })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [containerRef, aspectRatio])
  return size
}

// ─── Main editor ───────────────────────────────────────────────────────────────

export default function CurateEditor({
  bookId, bookTitle, photos, initialLayout, backHref, initialBookSize,
}: Props) {
  const [layout, setLayout] = useState<BookLayout>(initialLayout)
  const [bookSizeId, setBookSizeId] = useState<BookSizeId>((initialBookSize as BookSizeId) ?? DEFAULT_BOOK_SIZE_ID)
  const [spreadIndex, setSpreadIndex] = useState(0)
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [selectedEl, setSelectedEl] = useState<{ pageId: string; elId: string } | null>(null)
  const [selectedText, setSelectedText] = useState<{ pageId: string; blockId: string } | null>(null)
  const [activePhoto, setActivePhoto] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const spreadContainerRef = useRef<HTMLDivElement>(null)
  const spreadElLayerRef = useRef<HTMLDivElement>(null)
  const bookSize = getBookSize(bookSizeId)
  const spreadAR = bookSize.aspectNum * 2
  const spreadSize = useSpreadSize(spreadContainerRef, spreadAR)

  const spreads = buildSpreads(layout.pages)
  const currentSpread = spreads[Math.min(spreadIndex, spreads.length - 1)]
  const dims = BOOK_DIMS[bookSizeId] ?? [8, 10]
  const bleedY = (0.5 / dims[1]) * 100
  const bleedXSpread = (0.5 / (dims[0] * 2)) * 100  // 0.5in as % of spread width

  const activePageIndex = activePageId ? layout.pages.findIndex(p => p.id === activePageId) : -1
  const activePage = activePageIndex >= 0 ? layout.pages[activePageIndex] : null

  const selectedTextBlock = selectedText
    ? layout.pages.find(p => p.id === selectedText.pageId)?.textBlocks.find(b => b.id === selectedText.blockId) ?? null
    : null

  // Two editable pages in current spread (for cross-page eligibility)
  const hasTwoPages = currentSpread?.left !== null && currentSpread?.right !== null

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
    const drag = active.data.current as { type: string; url: string } | undefined
    if (!drag || drag.type !== 'pool') return
    const drop = over.data.current as { pageId: string } | undefined
    if (!drop?.pageId) return

    const canvasRect = over.rect
    const draggedRect = active.rect.current?.translated
    let x = 30, y = 30
    if (canvasRect && draggedRect) {
      x = Math.max(0, Math.min(60, ((draggedRect.left - canvasRect.left) / canvasRect.width) * 100))
      y = Math.max(0, Math.min(60, ((draggedRect.top - canvasRect.top) / canvasRect.height) * 100))
    }

    const pageId = drop.pageId
    const maxZ = layout.pages.find(p => p.id === pageId)?.elements.reduce((m, el) => Math.max(m, el.zIndex), 0) ?? 0
    const newEl: CanvasPhoto = {
      id: crypto.randomUUID(), photoUrl: drag.url,
      x, y, width: 40, height: 40,
      objectPosition: { x: 50, y: 50 },
      rotation: 0, zIndex: maxZ + 1,
    }
    updatePageById(pageId, page => ({ ...page, elements: [...page.elements, newEl] }))
    setSelectedEl({ pageId, elId: newEl.id })
    setSelectedText(null)
    setActivePageId(pageId)
  }

  function updateElement(pageId: string, elId: string, patch: Partial<CanvasPhoto>) {
    updatePageById(pageId, page => ({
      ...page,
      elements: page.elements.map(el => el.id === elId ? { ...el, ...patch } : el),
    }))
  }

  function deleteElement(pageId: string, elId: string) {
    updatePageById(pageId, page => ({ ...page, elements: page.elements.filter(el => el.id !== elId) }))
    setSelectedEl(null)
  }

  function addTextBlock() {
    if (!activePageId) return
    const newBlock: TextBlock = {
      id: crypto.randomUUID(),
      content: 'Double-click to edit',
      x: 15, y: 40, fontSize: 3,
      fontFamily: 'serif', color: '#1a1714',
      textAlign: 'left', bold: false, italic: false,
    }
    updatePageById(activePageId, page => ({ ...page, textBlocks: [...page.textBlocks, newBlock] }))
    setSelectedText({ pageId: activePageId, blockId: newBlock.id })
    setSelectedEl(null)
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

  function addPage() {
    const newPage = makeBlankPage()
    const newPages = [...layout.pages, newPage]
    setLayout({ pages: newPages })
    setSpreadIndex(buildSpreads(newPages).length - 1)
    setActivePageId(newPage.id)
  }

  function deletePage() {
    if (!activePageId || layout.pages.length <= 1) return
    setLayout(prev => ({ pages: prev.pages.filter(p => p.id !== activePageId) }))
    setActivePageId(null)
    setSpreadIndex(Math.max(0, spreadIndex - 1))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('books').update({ layout, book_size: bookSizeId }).eq('id', bookId)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function goSpread(dir: number) {
    setSpreadIndex(i => Math.max(0, Math.min(spreads.length - 1, i + dir)))
    setActivePageId(null); setSelectedEl(null); setSelectedText(null)
  }

  // Collect cross-page elements from both pages in current spread
  type CrossEl = { el: CanvasPhoto; pageId: string }
  const crossPageEls: CrossEl[] = []
  if (currentSpread) {
    for (const page of [currentSpread.left, currentSpread.right]) {
      if (page) {
        for (const el of page.elements ?? []) {
          if (el.crossPage) crossPageEls.push({ el, pageId: page.id })
        }
      }
    }
  }

  const filledCount = layout.pages.reduce((a, p) => a + (p.elements?.length ?? 0), 0)

  const spreadLabel = spreadIndex === 0
    ? 'Inner cover  ·  Page 1'
    : [currentSpread?.leftLabel, currentSpread?.rightLabel].filter(Boolean).join('  ·  ')

  function renderPage(page: BookPage | null, isLeftNull: boolean) {
    if (isLeftNull) return <IfcPlaceholder />
    if (!page) return (
      <div className="w-full h-full bg-stone-50 border border-dashed border-stone-200 flex items-center justify-center">
        <span className="text-stone-300 text-xs">No page</span>
      </div>
    )
    return (
      <PageCanvas
        page={page}
        isActive={activePageId === page.id}
        onActivate={() => setActivePageId(page.id)}
        selectedElId={selectedEl?.pageId === page.id ? selectedEl.elId : null}
        onElSelect={id => { setSelectedEl(id ? { pageId: page.id, elId: id } : null); setSelectedText(null) }}
        onElUpdate={(id, patch) => updateElement(page.id, id, patch)}
        onElDelete={id => deleteElement(page.id, id)}
        selectedTextId={selectedText?.pageId === page.id ? selectedText.blockId : null}
        onTextSelect={id => { setSelectedText(id ? { pageId: page.id, blockId: id } : null); setSelectedEl(null) }}
        onTextUpdate={(id, patch) => updateTextBlock(page.id, id, patch)}
        onTextDelete={id => deleteTextBlock(page.id, id)}
        canSpan={hasTwoPages}
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
              {backHref && <span className="text-xs">Back</span>}
            </Link>
            <span className="text-sm font-semibold text-stone-900">{bookTitle}</span>
            <span className="text-xs text-stone-400">{layout.pages.length} pages · {filledCount} photos placed</span>
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
              className="flex items-center gap-1.5 border border-stone-200 px-3 py-2 rounded-full text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={!activePageId ? 'Select a page first' : 'Add text block'}>
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
          <div className="w-52 bg-white border-r border-stone-200 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-stone-100">
              <p className="text-sm font-semibold text-stone-800">Photo pool</p>
              <p className="text-xs text-stone-400 mt-0.5">{photos.length} photos — drag onto page</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2 content-start">
              {photos.map((photo, i) => <PoolPhoto key={i} photo={photo} index={i} />)}
              {photos.length === 0 && <p className="col-span-3 text-xs text-stone-400 text-center py-8">No photos yet</p>}
            </div>
          </div>

          {/* ── Centre: Spread ────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col items-center justify-between py-4 px-6 overflow-hidden gap-3">

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-stone-500 font-medium">{spreadLabel}</span>
              <div className="flex gap-1">
                {spreads.map((_, i) => (
                  <button key={i} onClick={() => { setSpreadIndex(i); setActivePageId(null); setSelectedEl(null); setSelectedText(null) }}
                    className={`h-1.5 rounded-full transition-all ${i === spreadIndex ? 'bg-stone-700 w-5' : 'bg-stone-300 w-1.5 hover:bg-stone-500'}`} />
                ))}
              </div>
            </div>

            <div ref={spreadContainerRef} className="flex-1 w-full flex items-center justify-center min-h-0">
              {spreadSize.w > 0 && (
                <div className="flex items-center gap-4">
                  <button onClick={() => goSpread(-1)} disabled={spreadIndex === 0}
                    className="shrink-0 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-stone-600 hover:bg-stone-50 disabled:opacity-20 transition-all hover:scale-105">
                    <ChevronLeft size={22} />
                  </button>

                  {/* Spread — two pages seamless */}
                  <div
                    className="relative flex shadow-2xl overflow-visible"
                    style={{ width: spreadSize.w - 80, height: spreadSize.h }}
                  >
                    <div style={{ flex: 1 }}>
                      {renderPage(currentSpread.left, currentSpread.left === null)}
                    </div>
                    <div style={{ flex: 1 }}>
                      {renderPage(currentSpread.right, false)}
                    </div>

                    {/* Cross-page elements layer — overlays both pages */}
                    <div ref={spreadElLayerRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 25 }}>
                      {crossPageEls.map(({ el, pageId }) => (
                        <div key={el.id} className="pointer-events-auto">
                          <CanvasPhotoEl
                            el={el}
                            selected={selectedEl?.elId === el.id}
                            onSelect={() => { setSelectedEl({ pageId, elId: el.id }); setSelectedText(null); setActivePageId(pageId) }}
                            onUpdate={patch => updateElement(pageId, el.id, patch)}
                            onDelete={() => deleteElement(pageId, el.id)}
                            containerRef={spreadElLayerRef}
                            canSpan={hasTwoPages}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Outer bleed guide */}
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        top: `${bleedY}%`, bottom: `${bleedY}%`,
                        left: `${bleedXSpread * 2}%`, right: `${bleedXSpread * 2}%`,
                        border: '1px dashed rgba(160,120,0,0.4)',
                        zIndex: 50,
                      }}
                    />
                  </div>

                  <button onClick={() => goSpread(1)} disabled={spreadIndex === spreads.length - 1}
                    className="shrink-0 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-stone-600 hover:bg-stone-50 disabled:opacity-20 transition-all hover:scale-105">
                    <ChevronRight size={22} />
                  </button>
                </div>
              )}
            </div>

            <p className="text-[10px] text-stone-400 shrink-0">
              <span className="opacity-60">– – –</span> dashed border = 0.5&quot; print bleed margin
              {!activePageId && <span className="ml-2">· Click a page first, then &quot;Add text&quot;</span>}
            </p>
          </div>

          {/* ── Right: Controls ───────────────────────────────────────────── */}
          <div className="w-72 bg-white border-l border-stone-200 flex flex-col shrink-0 overflow-y-auto">

            <BookSizeDropdown value={bookSizeId} onChange={setBookSizeId} />

            {selectedTextBlock ? (
              <TextStylePanel
                block={selectedTextBlock}
                onUpdate={patch => updateTextBlock(selectedText!.pageId, selectedText!.blockId, patch)}
              />
            ) : null}

            {activePage ? (
              <>
                <div className="px-4 py-3 border-b border-stone-100">
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
                <div className="px-4 pb-4">
                  <NotesDropdown
                    notes={activePage.notes}
                    onChange={notes => updatePage(activePageIndex, p => ({ ...p, notes }))}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center px-6 text-center">
                <div>
                  <p className="text-sm text-stone-400 leading-relaxed mb-2">Click a page to select it</p>
                  <p className="text-xs text-stone-300">Then drag photos from the pool, or use &quot;Add text&quot; above</p>
                </div>
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
