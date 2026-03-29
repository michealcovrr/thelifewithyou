'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { OccasionType } from '@/lib/types'

const OCCASIONS: { value: OccasionType; label: string; emoji: string }[] = [
  { value: 'memorial', label: 'Memorial', emoji: '🕊️' },
  { value: 'birthday', label: 'Milestone birthday', emoji: '🎂' },
  { value: 'anniversary', label: 'Anniversary', emoji: '💍' },
  { value: 'graduation', label: 'Graduation', emoji: '🎓' },
  { value: 'other', label: 'Other', emoji: '📖' },
]

export default function NewBookPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [occasion, setOccasion] = useState<OccasionType>('memorial')
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    // Generate a unique invite token
    const token = crypto.randomUUID()

    const { data, error } = await supabase
      .from('books')
      .insert({
        user_id: user.id,
        title,
        occasion_type: occasion,
        deadline: deadline || null,
        invite_token: token,
        status: 'collecting',
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push(`/dashboard/books/${data.id}`)
  }

  return (
    <div className="max-w-xl mx-auto">
      <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-700 mb-6 inline-block">
        ← Back to my books
      </Link>

      <h1 className="text-3xl font-normal text-stone-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
        Start a new book
      </h1>
      <p className="text-stone-500 text-sm mb-10">
        Fill in a few details and we&apos;ll create a shareable link you can send to contributors.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-200 p-8 flex flex-col gap-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-stone-700 mb-1">
            Who is this book about?
          </label>
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Life of Margaret Hughes"
            className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-3">
            What&apos;s the occasion?
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {OCCASIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setOccasion(o.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-sm transition-colors ${
                  occasion === o.value
                    ? 'border-stone-900 bg-stone-50 text-stone-900'
                    : 'border-stone-200 text-stone-500 hover:border-stone-300'
                }`}
              >
                <span className="text-xl">{o.emoji}</span>
                <span>{o.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="deadline" className="block text-sm font-medium text-stone-700 mb-1">
            Submission deadline{' '}
            <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <p className="text-xs text-stone-400 mb-2">
            We&apos;ll remind contributors as the deadline approaches.
          </p>
          <input
            id="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-stone-900 text-white py-3 rounded-full text-sm hover:bg-stone-700 transition-colors disabled:opacity-50 mt-2"
        >
          {loading ? 'Creating…' : 'Create book & get share link'}
        </button>
      </form>
    </div>
  )
}
