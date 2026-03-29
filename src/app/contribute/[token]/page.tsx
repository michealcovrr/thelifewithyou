import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ContributeForm from './ContributeForm'

function getService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function ContributePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = getService()

  const { data: book } = await supabase
    .from('books')
    .select('id, title, occasion_type, deadline, status')
    .eq('invite_token', token)
    .single()

  if (!book) notFound()

  if (book.status !== 'collecting') {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center px-4 text-center">
        <div className="text-4xl mb-4">📚</div>
        <h1 className="text-2xl font-normal text-stone-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
          Submissions are now closed
        </h1>
        <p className="text-stone-500 text-sm">
          The collection period for <strong>{book.title}</strong> has ended.
          The book is being prepared.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <p className="text-sm uppercase tracking-widest text-stone-400 mb-2">You&apos;re contributing to</p>
          <h1 className="text-3xl font-normal text-stone-900" style={{ fontFamily: 'var(--font-playfair)' }}>
            {book.title}
          </h1>
          {book.deadline && (
            <p className="text-sm text-stone-400 mt-1">
              Submissions close {new Date(book.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>

        <ContributeForm bookId={book.id} />
      </div>
    </div>
  )
}
