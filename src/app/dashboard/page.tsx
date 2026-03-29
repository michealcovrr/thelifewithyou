import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Book } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { BookOpen, Plus } from 'lucide-react'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  collecting: { label: 'Collecting photos', color: 'bg-blue-50 text-blue-700' },
  curating: { label: 'Being curated', color: 'bg-amber-50 text-amber-700' },
  printing: { label: 'Printing', color: 'bg-purple-50 text-purple-700' },
  delivered: { label: 'Delivered', color: 'bg-green-50 text-green-700' },
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: books } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-normal text-stone-900" style={{ fontFamily: 'var(--font-playfair)' }}>
            My Books
          </h1>
          <p className="text-stone-500 text-sm mt-1">{user?.email}</p>
        </div>
        <Link
          href="/dashboard/new"
          className="flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-full text-sm hover:bg-stone-700 transition-colors"
        >
          <Plus size={16} />
          New book
        </Link>
      </div>

      {!books || books.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-stone-100">
          <BookOpen className="mx-auto text-stone-200 mb-4" size={48} />
          <h2 className="text-xl font-normal text-stone-700 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
            No books yet
          </h2>
          <p className="text-stone-400 text-sm mb-6">
            Start collecting memories for someone special.
          </p>
          <Link
            href="/dashboard/new"
            className="inline-flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-full text-sm hover:bg-stone-700 transition-colors"
          >
            <Plus size={14} />
            Create your first book
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(books as Book[]).map((book) => {
            const status = STATUS_LABELS[book.status] ?? STATUS_LABELS.collecting
            return (
              <Link
                key={book.id}
                href={`/dashboard/books/${book.id}`}
                className="bg-white rounded-2xl border border-stone-100 p-6 hover:border-stone-300 transition-colors flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-stone-900 text-base leading-tight">
                    {book.title}
                  </h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${status.color} whitespace-nowrap ml-2`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-xs text-stone-400 capitalize">{book.occasion_type}</p>
                {book.deadline && (
                  <p className="text-xs text-stone-400">
                    Deadline: {formatDate(book.deadline)}
                  </p>
                )}
                <p className="text-xs text-stone-300 mt-auto pt-2 border-t border-stone-50">
                  Created {formatDate(book.created_at)}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
