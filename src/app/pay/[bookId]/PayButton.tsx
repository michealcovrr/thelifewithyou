'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function PayButton({
  bookId, pageCount, sizeId, shippingCost,
}: {
  bookId: string; pageCount: number; sizeId: string; shippingCost: number
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handlePay() {
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/pay-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, pageCount, sizeId, shippingCost }),
      })
      const data = await res.json()
      if (data.url) { window.location.href = data.url }
      else { setError(data.error ?? 'Something went wrong.'); setLoading(false) }
    } catch {
      setError('Could not connect. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button onClick={handlePay} disabled={loading || pageCount === 0}
        className="w-full bg-stone-900 text-white py-3.5 rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50">
        {loading
          ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Redirecting…</span>
          : 'Pay now'}
      </button>
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      {pageCount === 0 && (
        <p className="text-xs text-stone-400 text-center">
          The book owner hasn&apos;t finished filling in print details yet.
        </p>
      )}
    </div>
  )
}
