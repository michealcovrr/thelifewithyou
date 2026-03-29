'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    })
    if (error) {
      setError(error.message)
    } else {
      setSubmitted(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center px-4">
      <Link href="/" className="mb-10 text-xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-playfair)' }}>
        The Life with You
      </Link>

      <div className="bg-white rounded-2xl border border-stone-200 p-10 w-full max-w-md">
        {submitted ? (
          <div className="text-center">
            <div className="text-4xl mb-4">✉️</div>
            <h2 className="text-2xl font-normal text-stone-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
              Check your email
            </h2>
            <p className="text-stone-500 text-sm">
              We sent a sign-in link to <strong>{email}</strong>. Click it to create your account.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-normal text-stone-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
              Create a book
            </h2>
            <p className="text-stone-500 text-sm mb-8">Start in seconds. No password, ever.</p>

            {/* Google */}
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 border border-stone-200 rounded-full py-3 text-sm text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50 mb-6"
            >
              <GoogleIcon />
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-stone-100" />
              <span className="text-xs text-stone-400">or</span>
              <div className="flex-1 h-px bg-stone-100" />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="email" className="block text-sm text-stone-600 mb-1">Email address</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="bg-stone-900 text-white py-3 rounded-full text-sm hover:bg-stone-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Get started with email'}
              </button>
            </form>

            <p className="text-center text-sm text-stone-400 mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-stone-700 hover:underline">Sign in</Link>
            </p>
            <p className="text-center text-xs text-stone-300 mt-4">
              By continuing you agree to our Terms of Service and Privacy Policy.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
