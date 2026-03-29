'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight } from 'lucide-react'

export default function AdvanceStatusButton({
  bookId,
  label,
  nextStatus,
}: {
  bookId: string
  label: string
  nextStatus: string
  icon?: string
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('books').update({ status: nextStatus }).eq('id', bookId)
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-full text-sm hover:bg-stone-700 transition-colors disabled:opacity-50"
    >
      {loading ? 'Submitting…' : label}
      {!loading && <ArrowRight size={14} />}
    </button>
  )
}
