'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm text-stone-600 focus:outline-none"
      />
      <button
        onClick={copy}
        className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700 transition-colors"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}
