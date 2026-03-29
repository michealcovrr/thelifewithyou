'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, ImageIcon } from 'lucide-react'

interface Props {
  bookId: string
}

interface FilePreview {
  file: File
  preview: string
}

export default function ContributeForm({ bookId }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [caption, setCaption] = useState('')
  const [files, setFiles] = useState<FilePreview[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const addFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return
    const previews: FilePreview[] = Array.from(newFiles)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ file, preview: URL.createObjectURL(file) }))
    setFiles((prev) => [...prev, ...previews])
  }, [])

  function removeFile(index: number) {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) {
      setError('Please add at least one photo.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const uploadedUrls: string[] = []

    for (const { file } of files) {
      const ext = file.name.split('.').pop()
      const path = `submissions/${bookId}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, file, { upsert: false })

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        setLoading(false)
        return
      }

      const { data } = supabase.storage.from('photos').getPublicUrl(path)
      uploadedUrls.push(data.publicUrl)
    }

    const { error: insertError } = await supabase.from('submissions').insert({
      book_id: bookId,
      contributor_name: name,
      contributor_email: email || null,
      photo_urls: uploadedUrls,
      caption: caption || null,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

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
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Email <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>
      </div>

      {/* Drop zone */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Photos *</label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-stone-400 bg-stone-50' : 'border-stone-200 hover:border-stone-300'
          }`}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <Upload className="mx-auto text-stone-300 mb-2" size={28} />
          <p className="text-sm text-stone-500">
            Drop photos here or <span className="text-stone-700 underline">browse</span>
          </p>
          <p className="text-xs text-stone-400 mt-1">JPEG, PNG, HEIC — up to 20MB each</p>
          <input
            id="file-input"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {files.map((f, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.preview} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => document.getElementById('file-input')?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400 hover:border-stone-300 transition-colors"
          >
            <ImageIcon size={18} />
            <span className="text-xs mt-1">Add more</span>
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          A note or memory <span className="text-stone-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Share a memory, a story, or just what this person meant to you…"
          rows={3}
          className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 resize-none"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="bg-stone-900 text-white py-3 rounded-full text-sm hover:bg-stone-700 transition-colors disabled:opacity-50"
      >
        {loading ? 'Uploading…' : `Submit ${files.length > 0 ? `${files.length} photo${files.length !== 1 ? 's' : ''}` : 'photos'}`}
      </button>
    </form>
  )
}
