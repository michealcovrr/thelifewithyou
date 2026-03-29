'use client'

import Image from 'next/image'
import { BOOK_SIZES, BookSizeId } from '@/lib/types'

interface Props {
  value: BookSizeId
  onChange: (id: BookSizeId) => void
}

export default function BookSizePicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {BOOK_SIZES.map(size => {
        const selected = value === size.id
        return (
          <button
            key={size.id}
            onClick={() => onChange(size.id)}
            className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 text-left transition-all ${
              selected
                ? 'border-stone-900 bg-stone-50 shadow-sm'
                : 'border-stone-200 hover:border-stone-400 bg-white'
            }`}
          >
            {size.popular && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
                Most popular
              </span>
            )}

            {/* Book preview image */}
            <div className="relative w-full h-28 overflow-hidden rounded-xl bg-stone-100">
              <Image
                src={size.image}
                alt={size.label}
                fill
                className="object-contain p-2"
                sizes="150px"
              />
            </div>

            <div className="w-full">
              <p className={`text-xs font-semibold leading-tight ${selected ? 'text-stone-900' : 'text-stone-700'}`}>
                {size.label}
              </p>
              <p className="text-[11px] text-stone-400 mt-0.5">
                {size.dimensions} <span className="text-stone-300">·</span> {size.cm}
              </p>
              <p className={`text-xs font-medium mt-1 ${selected ? 'text-stone-900' : 'text-stone-500'}`}>
                from ${size.basePriceUsd}
              </p>
            </div>

            {selected && (
              <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-stone-900 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
