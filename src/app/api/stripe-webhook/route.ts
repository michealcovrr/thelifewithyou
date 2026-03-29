import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    console.error('Webhook signature verification failed')
    return NextResponse.json({ error: 'Webhook signature failed' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = event.data.object as any

    const { bookId, pageCount, sizeId, userId } = session.metadata as {
      bookId: string
      pageCount: string
      sizeId: string
      userId: string
    }

    const supabase = getServiceClient()

    // Read delivery address from print_details (saved during wizard before checkout)
    const { data: book } = await supabase
      .from('books')
      .select('print_details')
      .eq('id', bookId)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delivery = (book?.print_details as any)?.delivery ?? {}

    // Create order record
    await supabase.from('orders').insert({
      book_id: bookId,
      stripe_payment_intent_id: session.payment_intent as string,
      page_count: parseInt(pageCount, 10),
      book_size: sizeId,
      amount_charged: (session.amount_total ?? 0) / 100,
      shipping_address: {
        name:        delivery.fullName    ?? '',
        line1:       delivery.line1       ?? '',
        line2:       delivery.line2       ?? '',
        city:        delivery.city        ?? '',
        state:       delivery.state       ?? '',
        postal_code: delivery.postalCode  ?? '',
        country:     delivery.country     ?? '',
        phone:       delivery.phone       ?? '',
        whatsapp:    delivery.whatsapp    ?? '',
        email:       delivery.email       ?? '',
      },
      status: 'paid',
    })

    // Advance book status → review (team now takes over: design cover, review layout, send proof)
    await supabase
      .from('books')
      .update({ status: 'review' })
      .eq('id', bookId)
      .eq('user_id', userId)

    console.log(`✓ Order created for book ${bookId} — ${pageCount} pages, $${(session.amount_total ?? 0) / 100}`)
  }

  return NextResponse.json({ received: true })
}
