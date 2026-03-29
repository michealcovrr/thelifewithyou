import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <nav className="bg-white border-b border-stone-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight" style={{ fontFamily: 'var(--font-playfair)' }}>
            The Life with You
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm text-stone-600 hover:text-stone-900">
              My Books
            </Link>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-sm text-stone-400 hover:text-stone-700">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  )
}
