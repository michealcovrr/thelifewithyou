import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Book, BookStatus, Submission, BOOK_PROGRESS_STEPS } from '@/lib/types'
import { getInviteUrl, formatDate } from '@/lib/utils'
import CopyLinkButton from './CopyLinkButton'
import Image from 'next/image'
import Link from 'next/link'
import { Pencil, Package, Truck, CheckCircle2, Clock, FileText } from 'lucide-react'
import AdvanceStatusButton from './AdvanceStatusButton'
import ApproveProofButton from './ApproveProofButton'

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: submissions } = await supabase
    .from('submissions')
    .select('*')
    .eq('book_id', id)
    .order('submitted_at', { ascending: false })

  const allPhotos = (submissions as Submission[] ?? []).flatMap((s) =>
    s.photo_urls.map((url) => ({
      url,
      contributor: s.contributor_name,
      caption: s.caption,
    }))
  )

  const inviteUrl = getInviteUrl((book as Book).invite_token)
  const status = (book as Book).status

  // Progress bar uses the full 8-step list
  const currentStep = BOOK_PROGRESS_STEPS.findIndex(s => s.status === status)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-sm text-stone-400 mb-1 capitalize">{book.occasion_type}</p>
          <h1 className="text-3xl font-normal text-stone-900 mb-1" style={{ fontFamily: 'var(--font-playfair)' }}>
            {book.title}
          </h1>
          {book.deadline && (
            <p className="text-sm text-stone-400">Deadline: {formatDate(book.deadline)}</p>
          )}
        </div>
        {(status === 'collecting' || status === 'curating') && allPhotos.length > 0 && (
          <Link
            href={`/dashboard/books/${id}/curate`}
            className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-full text-sm hover:bg-stone-700 transition-colors"
          >
            <Pencil size={14} />
            Curate book
          </Link>
        )}
      </div>

      {/* Progress bar — 8 steps */}
      <div className="bg-white rounded-2xl border border-stone-100 p-6 mb-6 overflow-x-auto">
        <div className="flex items-center min-w-max mx-auto" style={{ gap: 0 }}>
          {BOOK_PROGRESS_STEPS.map(({ status: stepStatus, label }, i) => {
            const isDone = i < currentStep
            const isActive = i === currentStep

            let href: string | null = null
            if (stepStatus === 'curating' && allPhotos.length > 0) href = `/dashboard/books/${id}/curate`
            // Always allow navigating to the printing wizard from any pre-review status
            const preReview = ['collecting', 'curating', 'printing'].includes(status)
            if (stepStatus === 'printing' && preReview) href = `/dashboard/books/${id}/printing`

            const dot = (
              <div className="flex flex-col items-center w-16">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium z-10 ${
                  isDone ? 'bg-stone-900 text-white' : isActive ? 'bg-stone-900 text-white ring-4 ring-stone-200' : 'bg-stone-100 text-stone-400'
                }`}>
                  {isDone ? '✓' : i + 1}
                </div>
                <p className={`text-xs mt-1.5 text-center leading-tight ${isDone || isActive ? 'text-stone-700' : 'text-stone-400'}`}>
                  {label}
                </p>
              </div>
            )

            return (
              <div key={stepStatus} className="flex items-start flex-1 relative">
                {href ? <Link href={href} className="flex flex-col items-center flex-1 hover:opacity-70 transition-opacity">{dot}</Link> : <div className="flex flex-col items-center flex-1">{dot}</div>}
                {i < BOOK_PROGRESS_STEPS.length - 1 && (
                  <div className={`absolute top-3.5 left-1/2 w-full h-0.5 -z-0 ${i < currentStep ? 'bg-stone-900' : 'bg-stone-100'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* === Status-specific panels === */}

      {/* COLLECTING: share link + print details shortcut */}
      {status === 'collecting' && (
        <div className="bg-blue-50 rounded-2xl p-6 mb-6 border border-blue-100">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-stone-900 mb-1">Share this link with contributors</h2>
              <p className="text-sm text-stone-500">
                Anyone with this link can upload photos — no account needed.
              </p>
            </div>
            <Link
              href={`/dashboard/books/${id}/printing`}
              className="shrink-0 flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-full text-sm hover:bg-stone-700 transition-colors"
            >
              Print details
            </Link>
          </div>
          <CopyLinkButton url={inviteUrl} />
        </div>
      )}

      {/* CURATING: done curating CTA */}
      {status === 'curating' && (
        <div className="bg-white rounded-2xl border border-stone-100 p-6 mb-6 flex items-center justify-between gap-6">
          <div>
            <h2 className="text-base font-semibold text-stone-900 mb-1">Happy with your layout?</h2>
            <p className="text-sm text-stone-500">Fill in your print details and we&apos;ll get it made.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href={`/dashboard/books/${id}/curate`} className="text-sm text-stone-500 hover:text-stone-800 transition-colors">
              Keep editing
            </Link>
            <Link
              href={`/dashboard/books/${id}/printing`}
              className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-full text-sm hover:bg-stone-700 transition-colors"
            >
              Fill in print details
            </Link>
          </div>
        </div>
      )}

      {/* PRINTING: continue wizard */}
      {status === 'printing' && (
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-6 mb-6 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-amber-600 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-stone-900 mb-0.5">Complete your print details</h2>
              <p className="text-sm text-stone-500">You&apos;re almost there — finish the wizard to submit your book.</p>
            </div>
          </div>
          <Link
            href={`/dashboard/books/${id}/printing`}
            className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-full text-sm hover:bg-stone-700 transition-colors shrink-0"
          >
            Continue
          </Link>
        </div>
      )}

      {/* REVIEW: under review by team */}
      {status === 'review' && (
        <div className="bg-white rounded-2xl border border-stone-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Clock size={20} className="text-stone-400" />
            <h2 className="text-base font-semibold text-stone-900">Your book is under review</h2>
          </div>
          <p className="text-sm text-stone-500">
            Our team is reviewing your print details and preparing your book. We&apos;ll send a PDF proof to your
            WhatsApp / email within 2–3 business days.
          </p>
        </div>
      )}

      {/* PROOF_SENT: approve in-app */}
      {status === 'proof_sent' && (
        <div className="bg-white rounded-2xl border border-stone-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <FileText size={20} className="text-blue-500" />
            <h2 className="text-base font-semibold text-stone-900">Your proof is ready</h2>
          </div>
          <p className="text-sm text-stone-500 mb-4">
            We&apos;ve sent a PDF proof of your book to your WhatsApp/email. Please review it carefully — once you approve,
            we&apos;ll send it to print. This cannot be undone.
          </p>
          <ApproveProofButton bookId={id} />
        </div>
      )}

      {/* APPROVED: going to print */}
      {status === 'approved' && (
        <div className="bg-green-50 rounded-2xl border border-green-100 p-6 mb-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-green-600" />
            <div>
              <h2 className="text-base font-semibold text-stone-900 mb-0.5">Proof approved — going to print!</h2>
              <p className="text-sm text-stone-500">Your book is now being printed. We&apos;ll update you when it ships.</p>
            </div>
          </div>
        </div>
      )}

      {/* SHIPPED: tracking */}
      {status === 'shipped' && (
        <div className="bg-white rounded-2xl border border-stone-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Truck size={20} className="text-stone-700" />
            <h2 className="text-base font-semibold text-stone-900">Your book is on its way!</h2>
          </div>
          {book.tracking_number ? (
            <p className="text-sm text-stone-500">
              Tracking number: <span className="font-mono font-medium text-stone-800">{book.tracking_number}</span>
            </p>
          ) : (
            <p className="text-sm text-stone-500">Tracking information will appear here once available.</p>
          )}
        </div>
      )}

      {/* DELIVERED */}
      {status === 'delivered' && (
        <div className="bg-stone-900 rounded-2xl p-6 mb-6 text-white text-center">
          <Package size={28} className="mx-auto mb-3 text-stone-300" />
          <h2 className="text-xl font-normal mb-1" style={{ fontFamily: 'var(--font-playfair)' }}>
            Your book has arrived!
          </h2>
          <p className="text-stone-400 text-sm">We hope you love it. Thank you for using The Life with You.</p>
        </div>
      )}

      {/* Photo gallery */}
      <div className="bg-white rounded-2xl border border-stone-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-stone-900">
            Submitted photos
            <span className="ml-2 text-sm font-normal text-stone-400">({allPhotos.length})</span>
          </h2>
          <span className="text-sm text-stone-400">{(submissions ?? []).length} contributors</span>
        </div>

        {allPhotos.length === 0 ? (
          <div className="text-center py-12 text-stone-400">
            <p className="text-sm">No photos submitted yet. Share the link to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {allPhotos.map((photo, i) => (
              <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-stone-100">
                <Image
                  src={photo.url}
                  alt={photo.caption ?? `Photo by ${photo.contributor}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                  <p className="text-white text-xs font-medium">{photo.contributor}</p>
                  {photo.caption && (
                    <p className="text-white/70 text-xs line-clamp-2">{photo.caption}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
