import Link from 'next/link'
import { calculatePrice } from '@/lib/types'

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#faf9f7]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <span className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-playfair)' }}>
          The Life with You
        </span>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-sm bg-stone-900 text-white px-4 py-2 rounded-full hover:bg-stone-700 transition-colors"
          >
            Start a book
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-20 pb-24 max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-stone-400 mb-6">
          Collaborative memory books
        </p>
        <h1
          className="text-5xl md:text-6xl font-normal leading-tight text-stone-900 mb-6"
          style={{ fontFamily: 'var(--font-playfair)' }}
        >
          Every photo they deserved
          <br />
          <span className="italic text-stone-500">to be remembered by.</span>
        </h1>
        <p className="text-lg text-stone-500 max-w-xl leading-relaxed mb-10">
          Send a link. Friends and family upload their photos and memories. You receive a
          beautifully printed book at your door — no design skills needed.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Link
            href="/signup"
            className="bg-stone-900 text-white px-8 py-4 rounded-full text-base hover:bg-stone-700 transition-colors"
          >
            Create your book — from $59
          </Link>
          <Link href="#how-it-works" className="text-stone-500 text-sm hover:text-stone-700 transition-colors">
            See how it works ↓
          </Link>
        </div>
      </section>

      {/* Social proof strip */}
      <div className="bg-stone-100 py-4 px-6 text-center">
        <p className="text-sm text-stone-500">
          ❝ We had no idea so many people had photos of Grandma. The book arrived and we cried for an hour. ❞
          <span className="ml-3 text-stone-400">— Sarah M., memorial book</span>
        </p>
      </div>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 max-w-5xl mx-auto w-full">
        <h2
          className="text-4xl font-normal text-center text-stone-900 mb-16"
          style={{ fontFamily: 'var(--font-playfair)' }}
        >
          How it works
        </h2>
        <div className="grid md:grid-cols-4 gap-8">
          {[
            { step: '01', title: 'You start a Life', body: 'Name the person, choose the occasion — birthday, memorial, anniversary — and set a deadline.' },
            { step: '02', title: 'Share the link', body: 'A unique link goes to family and friends. They upload their photos and a note. No account needed.' },
            { step: '03', title: 'We curate it', body: 'Our team personally selects, sequences, and lays out the best photos into a stunning book design.' },
            { step: '04', title: 'It arrives at your door', body: 'A professionally printed hardcover book, shipped directly to you. Plus a digital link to share.' },
          ].map(({ step, title, body }) => (
            <div key={step} className="flex flex-col gap-3">
              <span className="text-3xl font-light text-stone-200" style={{ fontFamily: 'var(--font-playfair)' }}>
                {step}
              </span>
              <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
              <p className="text-sm text-stone-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 bg-stone-50 w-full">
        <div className="max-w-5xl mx-auto">
          <h2
            className="text-4xl font-normal text-center text-stone-900 mb-4"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Simple pricing
          </h2>
          <p className="text-center text-stone-500 mb-4">
            Pay only for the pages you need. Price is calculated at checkout based on your final page count.
          </p>
          <p className="text-center text-stone-400 text-sm mb-16">$1.30 per page + $20 base fee (design + shipping)</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { pages: 30, label: 'Small', desc: 'Perfect for birthdays & anniversaries', popular: false },
              { pages: 60, label: 'Medium', desc: 'The sweet spot for memorial books', popular: true },
              { pages: 100, label: 'Large', desc: 'For large families & milestone decades', popular: false },
            ].map(({ pages, label, desc, popular }, i) => (
              <div
                key={label}
                className={`rounded-2xl p-8 flex flex-col gap-4 ${
                  popular ? 'bg-stone-900 text-white ring-2 ring-stone-900' : 'bg-white border border-stone-200'
                }`}
              >
                {popular && (
                  <span className="text-xs uppercase tracking-widest text-stone-400">Most popular</span>
                )}
                <h3
                  className={`text-2xl font-normal ${popular ? 'text-white' : 'text-stone-900'}`}
                  style={{ fontFamily: 'var(--font-playfair)' }}
                >
                  {label}
                </h3>
                <div className={`text-4xl font-light ${popular ? 'text-white' : 'text-stone-900'}`}>
                  ~${calculatePrice(pages)}
                </div>
                <p className={`text-xs ${popular ? 'text-stone-500' : 'text-stone-400'}`}>
                  example: {pages} pages
                </p>
                <p className={`text-sm leading-relaxed ${popular ? 'text-stone-400' : 'text-stone-500'}`}>
                  {desc}
                </p>
                <ul className={`text-sm space-y-2 mt-2 ${popular ? 'text-stone-300' : 'text-stone-500'}`}>
                  <li>✓ Hardcover printing</li>
                  <li>✓ Free shipping</li>
                  <li>✓ PDF proof before print</li>
                  <li>✓ Unlimited contributors</li>
                </ul>
                <Link
                  href="/signup"
                  className={`mt-4 text-center py-3 rounded-full text-sm transition-colors ${
                    popular ? 'bg-white text-stone-900 hover:bg-stone-100' : 'bg-stone-900 text-white hover:bg-stone-700'
                  }`}
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Occasions */}
      <section className="py-24 px-6 max-w-5xl mx-auto w-full">
        <h2
          className="text-4xl font-normal text-center text-stone-900 mb-16"
          style={{ fontFamily: 'var(--font-playfair)' }}
        >
          Made for every milestone
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: '🕊️', title: 'Memorials', body: 'Honour someone\'s full life. Gather photos from everyone who knew and loved them.' },
            { icon: '🎂', title: 'Milestone birthdays', body: 'A 50th, 70th, or 100th deserves more than a party. Give them a lifetime in pages.' },
            { icon: '💍', title: 'Anniversaries', body: 'Collect decades of photos from friends and family who were there along the way.' },
          ].map(({ icon, title, body }) => (
            <div key={title} className="bg-white rounded-2xl p-8 border border-stone-100">
              <span className="text-3xl">{icon}</span>
              <h3 className="text-lg font-semibold text-stone-900 mt-4 mb-2">{title}</h3>
              <p className="text-sm text-stone-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-stone-900 w-full text-center">
        <h2
          className="text-4xl font-normal text-white mb-4"
          style={{ fontFamily: 'var(--font-playfair)' }}
        >
          Start collecting memories today
        </h2>
        <p className="text-stone-400 mb-8 max-w-md mx-auto">
          Takes 2 minutes to set up. Your contributors need no account. The book arrives in 7–10 days.
        </p>
        <Link
          href="/signup"
          className="inline-block bg-white text-stone-900 px-8 py-4 rounded-full text-base hover:bg-stone-100 transition-colors"
        >
          Create your book
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-sm text-stone-400">
        <p>© 2026 The Life with You. Made with care.</p>
      </footer>
    </div>
  )
}
