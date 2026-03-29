'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, ImageIcon, CheckCircle } from 'lucide-react'

interface Props { bookId: string }
interface FileItem { id: string; file: File; preview: string; status: 'pending' | 'uploading' | 'done' | 'failed' }

async function compressImage(file: File, maxPx = 2048, quality = 0.85): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx }
        else { width = Math.round(width * maxPx / height); height = maxPx }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(b => resolve(b!), 'image/jpeg', quality)
    }
    img.src = url
  })
}

export default function ContributeForm({ bookId }: Props) {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [caption, setCaption] = useState('')
  const [items, setItems]     = useState<FileItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError]     = useState('')
  const nameRef   = useRef(name)
  const emailRef  = useRef(email)
  const captionRef = useRef(caption)
  nameRef.current = name; emailRef.current = email; captionRef.current = caption

  const addFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return
    const newItems: FileItem[] = Array.from(newFiles)
      .filter(f => f.type.startsWith('image/'))
      .map(file => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), status: 'pending' as const }))
    setItems(prev => [...prev, ...newItems])
  }, [])

  function removeItem(id: string) {
    setItems(prev => { const item = prev.find(i => i.id === id); if (item) URL.revokeObjectURL(item.preview); return prev.filter(i => i.id !== id) })
  }

  // Upload + save a single photo immediately, then remove from grid on success
  async function uploadOne(item: FileItem) {
    const supabase = createClient()

    // Mark as uploading
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i))

    try {
      const blob = await compressImage(item.file)
      const path = `submissions/${bookId}/${crypto.randomUUID()}.jpg`

      const { error: upErr } = await supabase.storage
        .from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (upErr) throw new Error(upErr.message)

      const url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl

      // Insert into DB immediately — one row per photo
      const { error: dbErr } = await supabase.from('submissions').insert({
        book_id: bookId,
        contributor_name: nameRef.current,
        contributor_email: emailRef.current || null,
        photo_urls: [url],
        caption: captionRef.current || null,
      })
      if (dbErr) throw new Error(dbErr.message)

      // Success — remove from grid, increment counter
      setItems(prev => prev.filter(i => i.id !== item.id))
      setSavedCount(n => n + 1)
    } catch (err) {
      // Failed — mark red so user knows which ones to retry
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'failed' } : i))
      throw err
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const pending = items.filter(i => i.status === 'pending' || i.status === 'failed')
    if (pending.length === 0) { setError('Please add at least one photo.'); return }
    setLoading(true); setError('')

    // Upload in batches of 5 in parallel
    const BATCH = 5
    let failCount = 0
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH)
      const results = await Promise.allSettled(batch.map(item => uploadOne(item)))
      failCount += results.filter(r => r.status === 'rejected').length
    }

    setLoading(false)
    if (failCount > 0) {
      setError(`${failCount} photo${failCount > 1 ? 's' : ''} failed to upload — they're highlighted below. Tap submit to retry them.`)
    }
  }

  // All done
  if (!loading && savedCount > 0 && items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
        <div className="text-5xl mb-4">💛</div>
        <h2 className="text-2xl font-normal text-stone-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
          Thank you, {name}
        </h2>
        <p className="text-stone-500 text-sm">
          {savedCount} photo{savedCount !== 1 ? 's have' : ' has'} been added to the book.
          The organiser will let you know when it&apos;s ready.
        </p>
      </div>
    )
  }

  const pendingCount = items.filter(i => i.status === 'pending' || i.status === 'failed').length
  const uploadingCount = items.filter(i => i.status === 'uploading').length

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-200 p-8 flex flex-col gap-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Your name *</label>
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith"
            className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Email <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com"
            className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" />
        </div>
      </div>

      {/* Drop zone */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Photos *</label>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-stone-400 bg-stone-50' : 'border-stone-200 hover:border-stone-300'
          }`}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <Upload className="mx-auto text-stone-300 mb-2" size={28} />
          <p className="text-sm text-stone-500">Drop photos here or <span className="text-stone-700 underline">browse</span></p>
          <p className="text-xs text-stone-400 mt-1">JPEG, PNG, HEIC — auto-compressed for fast upload</p>
          <input id="file-input" type="file" accept="image/*" multiple className="hidden"
            onChange={e => addFiles(e.target.files)} />
        </div>
      </div>

      {/* Saved counter */}
      {savedCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <CheckCircle size={15} />
          <span>{savedCount} photo{savedCount !== 1 ? 's' : ''} saved to the book</span>
        </div>
      )}

      {/* Photo grid — only shows pending/uploading/failed */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {items.map(item => (
            <div key={item.id} className={`relative aspect-square rounded-xl overflow-hidden bg-stone-100 transition-all ${
              item.status === 'failed' ? 'ring-2 ring-red-400' : ''
            }`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.preview} alt="" className="w-full h-full object-cover" />

              {/* Uploading overlay */}
              {item.status === 'uploading' && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Failed badge */}
              {item.status === 'failed' && (
                <div className="absolute bottom-0 inset-x-0 bg-red-500/90 text-white text-[10px] text-center py-0.5">
                  Failed
                </div>
              )}

              {/* Remove button (only when not uploading) */}
              {item.status !== 'uploading' && (
                <button type="button" onClick={() => removeItem(item.id)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => document.getElementById('file-input')?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400 hover:border-stone-300 transition-colors">
            <ImageIcon size={18} />
            <span className="text-xs mt-1">Add more</span>
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          A note or memory <span className="text-stone-400 font-normal">(optional)</span>
        </label>
        <textarea value={caption} onChange={e => setCaption(e.target.value)}
          placeholder="Share a memory, a story, or just what this person meant to you…"
          rows={3}
          className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 resize-none" />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button type="submit" disabled={loading || pendingCount === 0}
        className="bg-stone-900 text-white py-3 rounded-full text-sm hover:bg-stone-700 transition-colors disabled:opacity-50">
        {uploadingCount > 0
          ? `Uploading ${uploadingCount} photo${uploadingCount !== 1 ? 's' : ''}…`
          : pendingCount > 0
            ? `Submit ${pendingCount} photo${pendingCount !== 1 ? 's' : ''}`
            : 'All photos uploaded'}
      </button>
    </form>
  )
}
