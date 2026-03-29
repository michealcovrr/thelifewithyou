import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Book, BookSizeId } from '@/lib/types'
import { BookLayout } from '@/lib/layouts'
import PrintingWizard from './PrintingWizard'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function PrintingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!book) notFound()

  const layout: BookLayout = (book.layout as BookLayout) ?? { pages: [] }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href={`/dashboard/books/${id}`}
        className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-stone-700 transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to book
      </Link>

      <div className="mb-8">
        <p className="text-sm text-stone-400 mb-1 capitalize">{book.occasion_type}</p>
        <h1 className="text-3xl font-normal text-stone-900" style={{ fontFamily: 'var(--font-playfair)' }}>
          {book.title}
        </h1>
        <p className="text-sm text-stone-400 mt-1">Complete your print details below</p>
      </div>

      <PrintingWizard
        bookId={id}
        bookTitle={(book as Book).title}
        layout={layout}
        userEmail={user.email ?? ''}
        initialBookSize={(book as Book).book_size}
      />
    </div>
  )
}
