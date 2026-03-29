import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { BookLayout, makeBlankPage } from '@/lib/layouts'
import CurateEditor from './CurateEditor'

export default async function CuratePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string; from?: string }>
}) {
  const { id } = await params
  const { page, from } = await searchParams

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

  const { data: submissions } = await supabase
    .from('submissions')
    .select('photo_urls, contributor_name, caption')
    .eq('book_id', id)

  const allPhotos = (submissions ?? []).flatMap((s) =>
    s.photo_urls.map((url: string) => ({ url, contributor: s.contributor_name, caption: s.caption }))
  )

  const existingLayout: BookLayout = book.layout ?? { pages: [makeBlankPage('full')] }
  const initialPageIndex = page ? Math.max(0, parseInt(page, 10)) : 0
  const backHref = from === 'printing' ? `/dashboard/books/${id}/printing` : undefined

  return (
    <CurateEditor
      bookId={id}
      bookTitle={book.title}
      photos={allPhotos}
      initialLayout={existingLayout}
      initialPageIndex={initialPageIndex}
      backHref={backHref}
      initialBookSize={book.book_size ?? null}
    />
  )
}
