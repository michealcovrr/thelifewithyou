import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { calculatePrice, BookSizeId } from '@/lib/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

function getService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const { bookId, pageCount, sizeId, shippingCost = 0 } = await request.json()

  if (!bookId || !pageCount || pageCount < 1) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = getService()
  const { data: book } = await supabase
    .from('books')
    .select('id, title, user_id, book_size, status')
    .eq('id', bookId)
    .single()

  if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

  if (['review', 'proof_sent', 'approved', 'shipped', 'delivered'].includes(book.status)) {
    return NextResponse.json({ error: 'This book has already been paid for.' }, { status: 400 })
  }

  const resolvedSizeId = (sizeId ?? book.book_size ?? 'portrait-8x10') as BookSizeId
  const bookPriceUsd   = calculatePrice(pageCount, resolvedSizeId)
  const appUrl         = process.env.NEXT_PUBLIC_APP_URL!

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: 'usd',
        product: process.env.STRIPE_PRODUCT_ID!,
        unit_amount: bookPriceUsd * 100,
      },
      quantity: 1,
    },
  ]

  if (shippingCost > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Shipping & handling' },
        unit_amount: Math.round(shippingCost * 100),
      },
      quantity: 1,
    })
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: `${appUrl}/pay/${bookId}/success`,
    cancel_url:  `${appUrl}/pay/${bookId}`,
    metadata: {
      bookId,
      pageCount:    String(pageCount),
      sizeId:       resolvedSizeId,
      shippingCost: String(shippingCost),
      userId:       book.user_id,
    },
  })

  return NextResponse.json({ url: session.url })
}
