import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">AI Review Responder</h1>
          <div className="space-x-4">
            <Link href="/login" className="text-gray-700 hover:text-blue-600">
              Log In
            </Link>
            <Link href="/signup" className="btn-primary">
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-5xl font-bold mb-6 text-gray-900">
            Respond to Reviews in <span className="text-blue-600">Seconds</span>, Not Hours
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            AI-powered review responses that sound like you, powered by advanced AI. 
            Save hours every week while maintaining authentic customer relationships.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/signup" className="btn-primary text-lg px-8 py-3">
              Get Started Free
            </Link>
            <button className="btn-secondary text-lg px-8 py-3">
              Watch Demo
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="card text-center">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
            <p className="text-gray-600">
              Generate personalized responses in under 5 seconds
            </p>
          </div>
          <div className="card text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold mb-2">Sounds Like You</h3>
            <p className="text-gray-600">
              AI learns your brand voice and tone automatically
            </p>
          </div>
          <div className="card text-center">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-xl font-semibold mb-2">One-Click Post</h3>
            <p className="text-gray-600">
              Review, approve, and post directly to Google
            </p>
          </div>
        </div>

        {/* Social Proof */}
        <div className="mt-20 text-center">
          <p className="text-gray-500 mb-4">Trusted by restaurants across the UK</p>
          <div className="flex justify-center gap-8 text-3xl">
            ⭐⭐⭐⭐⭐
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-20 border-t">
        <div className="text-center text-gray-600">
          <p>&copy; 2026 AI Review Responder. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
