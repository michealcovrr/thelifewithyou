'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, ImageIcon } from 'lucide-react'

interface Props { bookId: string }
interface FilePreview { file: File; preview: string }

// Resize + compress to JPEG before upload — reduces 5MB phone photo to ~300KB
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

// Upload one file, return public URL
async function uploadOne(supabase: ReturnType<typeof createClient>, bookId: string, file: File): Promise<string> {
  const blob = await compressImage(file)
  const path = `submissions/${bookId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error(error.message)
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
}

export default function ContributeForm({ bookId }: Props) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [caption, setCaption]   = useState('')
  const [files, setFiles]       = useState<FilePreview[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError]       = useState('')
  const [submitted, setSubmitted] = useState(false)

  const addFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return
    const previews: FilePreview[] = Array.from(newFiles)
      .filter(f => f.type.startsWith('image/'))
      .map(file => ({ file, preview: URL.createObjectURL(file) }))
    setFiles(prev => [...prev, ...previews])
  }, [])

  function removeFile(index: number) {
    setFiles(prev => { URL.revokeObjectURL(prev[index].preview); return prev.filter((_, i) => i !== index) })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) { setError('Please add at least one photo.'); return }
    setLoading(true); setError('')
    setProgress({ done: 0, total: files.length })

    const supabase = createClient()
    const uploadedUrls: string[] = []

    // Upload in parallel batches of 5
    const BATCH = 5
    for (let i = 0; i < files.length; i += BATCH) {
      const batch = files.slice(i, i + BATCH)
      try {
        const urls = await Promise.all(batch.map(({ file }) => uploadOne(supabase, bookId, file)))
        uploadedUrls.push(...urls)
        setProgress(p => ({ ...p, done: Math.min(p.done + batch.length, p.total) }))
      } catch (err) {
        setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
        setLoading(false)
        return
      }
    }

    const { error: insertError } = await supabase.from('submissions').insert({
      book_id: bookId,
      contributor_name: name,
      contributor_email: email || null,
      photo_urls: uploadedUrls,
      caption: caption || null,
    })

    if (insertError) { setError(insertError.message); setLoading(false); return }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
        <div className="text-5xl mb-4">💛</div>
        <h2 className="text-2xl font-normal text-stone-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
          Thank you, {name}
        </h2>
        <p className="text-stone-500 text-sm">
          Your {files.length} photo{files.length !== 1 ? 's have' : ' has'} been added.
          The organiser will let you know when the book is ready.
        </p>
      </div>
    )
  }

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
          <p className="text-xs text-stone-400 mt-1">JPEG, PNG, HEIC — photos are auto-compressed for fast upload</p>
          <input id="file-input" type="file" accept="image/*" multiple className="hidden"
            onChange={e => addFiles(e.target.files)} />
        </div>
      </div>

      {/* Previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {files.map((f, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.preview} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => removeFile(i)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
                <X size={12} />
              </button>
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

      {/* Upload progress bar */}
      {loading && progress.total > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs text-stone-500">
            <span>Uploading photos…</span>
            <span>{progress.done} of {progress.total}</span>
          </div>
          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-stone-900 rounded-full transition-all duration-300"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <button type="submit" disabled={loading}
        className="bg-stone-900 text-white py-3 rounded-full text-sm hover:bg-stone-700 transition-colors disabled:opacity-50">
        {loading
          ? `Uploading ${progress.done} of ${progress.total}…`
          : `Submit ${files.length > 0 ? `${files.length} photo${files.length !== 1 ? 's' : ''}` : 'photos'}`}
      </button>
    </form>
  )
}
