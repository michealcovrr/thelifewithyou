'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2 } from 'lucide-react'

export default function ApproveProofButton({ bookId }: { bookId: string }) {
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const router = useRouter()

  async function handleApprove() {
    if (!confirmed) {
      setConfirmed(true)
      return
    }
    setLoading(true)
    const supabase = createClient()
    await supabase.from('books').update({ status: 'approved' }).eq('id', bookId)
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-3">
      {confirmed && (
        <p className="text-sm text-amber-600">
          This cannot be undone — click confirm to approve and send to print.
        </p>
      )}
      <button
        onClick={handleApprove}
        disabled={loading}
        className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-full text-sm hover:bg-stone-700 transition-colors disabled:opacity-50"
      >
        <CheckCircle2 size={14} />
        {loading ? 'Approving…' : confirmed ? 'Confirm approval' : 'Approve proof'}
      </button>
    </div>
  )
}
