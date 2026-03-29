import Link from 'next/link'

export default async function SuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="max-w-md mx-auto text-center py-20">
      <div className="text-5xl mb-6">🎉</div>
      <h1 className="text-3xl font-normal text-stone-900 mb-3" style={{ fontFamily: 'var(--font-playfair)' }}>
        Payment received
      </h1>
      <p className="text-stone-500 text-sm mb-8 leading-relaxed">
        We&apos;ve got your order. Our team will now curate and lay out your book.
        You&apos;ll receive an email when it ships — usually within 5–7 business days.
      </p>
      <Link
        href={`/dashboard/books/${id}`}
        className="inline-block bg-stone-900 text-white px-6 py-3 rounded-full text-sm hover:bg-stone-700 transition-colors"
      >
        View your book
      </Link>
    </div>
  )
}
