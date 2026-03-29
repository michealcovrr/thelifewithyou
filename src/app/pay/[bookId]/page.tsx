import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { BookSizeId, calculatePrice, getBookSize } from '@/lib/types'
import PayButton from './PayButton'

function getService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string }>
  searchParams: Promise<{ pages?: string; size?: string; ship?: string }>
}) {
  const { bookId } = await params
  const { pages: pagesParam, size: sizeParam, ship: shipParam } = await searchParams
  const supabase = getService()

  const { data: book } = await supabase
    .from('books')
    .select('id, title, occasion_type, print_details, book_size, status')
    .eq('id', bookId)
    .single()

  if (!book) notFound()

  if (['review', 'proof_sent', 'approved', 'shipped', 'delivered'].includes(book.status)) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-stone-100 p-10 max-w-sm w-full text-center">
          <p className="text-2xl mb-2">✓</p>
          <h1 className="text-xl font-normal text-stone-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
            Already paid
          </h1>
          <p className="text-sm text-stone-500">This book has already been paid for. Thank you!</p>
        </div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const printDetails = book.print_details as any
  const pageCount    = pagesParam ? parseInt(pagesParam, 10) : (printDetails?.pageOrder?.length ?? 0)
  const sizeId       = (sizeParam ?? book.book_size ?? 'portrait-8x10') as BookSizeId
  const shipping     = shipParam ? parseFloat(shipParam) : (printDetails?.delivery?.shippingCost ?? 0)
  const size         = getBookSize(sizeId)
  const bookPrice    = calculatePrice(pageCount, sizeId)
  const totalPrice   = bookPrice + shipping

  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        <p className="text-center text-sm font-semibold tracking-tight text-stone-400 mb-8"
          style={{ fontFamily: 'var(--font-playfair)' }}>
          The Life with You
        </p>

        <div className="bg-white rounded-2xl border border-stone-100 p-8 flex flex-col gap-6">
          <div className="text-center">
            <p className="text-xs text-stone-400 uppercase tracking-widest mb-1 capitalize">{book.occasion_type}</p>
            <h1 className="text-2xl font-normal text-stone-900" style={{ fontFamily: 'var(--font-playfair)' }}>
              {book.title}
            </h1>
          </div>

          <div className="bg-stone-50 rounded-xl p-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>{size.label} ({size.dimensions})</span>
              <span>${size.basePriceUsd}.00</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>{pageCount} pages × ${size.perPageUsd.toFixed(2)}</span>
              <span>${(pageCount * size.perPageUsd).toFixed(2)}</span>
            </div>
            {shipping > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>Shipping</span>
                <span>${shipping.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-stone-200 pt-2 mt-1 flex justify-between font-semibold text-stone-900">
              <span>Total</span>
              <span className="text-xl font-light">${totalPrice.toFixed(2)}</span>
            </div>
          </div>

          <p className="text-xs text-stone-400 text-center -mt-2">
            Includes hardcover printing, cover design, and shipping.
          </p>

          <PayButton bookId={book.id} pageCount={pageCount} sizeId={sizeId} shippingCost={shipping} />
        </div>

        <p className="text-center text-xs text-stone-400 mt-6">
          Secure payment via Stripe. You will be redirected to checkout.
        </p>
      </div>
    </div>
  )
}
