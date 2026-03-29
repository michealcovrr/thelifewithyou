export default function PayLinkSuccess() {
  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-stone-100 p-10 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-xl font-normal text-stone-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
          Payment successful!
        </h1>
        <p className="text-sm text-stone-500">
          Thank you for your payment. The book owner will be notified and our team will begin working on the book.
        </p>
      </div>
    </div>
  )
}
