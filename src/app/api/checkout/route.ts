import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { calculatePrice, BookSizeId } from '@/lib/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { bookId, pageCount, sizeId, shippingCost = 0, quantity = 1 } = await request.json()

  if (!bookId || !pageCount || pageCount < 1) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: book } = await supabase
    .from('books')
    .select('id, title')
    .eq('id', bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

  const resolvedSizeId = (sizeId ?? 'portrait-8x10') as BookSizeId
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

  // Add shipping as a separate line item if applicable
  if (shippingCost > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Shipping & handling' },
        unit_amount: Math.round(shippingCost * 100),
      },
      quantity: quantity ?? 1,
    })
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: `${appUrl}/dashboard/books/${bookId}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/dashboard/books/${bookId}/printing`,
    metadata: {
      bookId,
      pageCount:    String(pageCount),
      sizeId:       resolvedSizeId,
      shippingCost: String(shippingCost),
      quantity:     String(quantity),
      userId:       user.id,
    },
    customer_email: user.email,
  })

  return NextResponse.json({ url: session.url })
}
