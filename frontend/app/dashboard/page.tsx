'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const result = await api.getCurrentUser()
      
      if (result.error) {
        // Not authenticated, redirect to login
        router.push('/login')
      } else {
        setUser(result.data?.user)
        setLoading(false)
      }
    }

    loadUser()
  }, [router])

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-600">AI Review Responder</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-700">{user?.email}</span>
              <button onClick={handleLogout} className="btn-secondary">
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-6">Welcome, {user?.name || 'User'}! 👋</h2>

          {/* Getting Started Card */}
          <div className="card mb-6">
            <h3 className="text-xl font-semibold mb-4">🚀 Getting Started</h3>
            <p className="text-gray-600 mb-4">
              Your account is set up! Here's what comes next in Phase 2:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">1.</span>
                Connect your Google My Business account
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">2.</span>
                Import your existing reviews
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">3.</span>
                Generate AI-powered responses
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">4.</span>
                Review and post to Google with one click
              </li>
            </ul>
          </div>

          {/* Placeholder Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold mb-2">📊 Reviews</h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">0</p>
              <p className="text-gray-600 text-sm">Connect Google to see reviews</p>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-2">✍️ Responses</h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">0</p>
              <p className="text-gray-600 text-sm">Generated responses will appear here</p>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-2">⏱️ Time Saved</h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">0h</p>
              <p className="text-gray-600 text-sm">Tracked after first response</p>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-2">⭐ Avg Rating</h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">-</p>
              <p className="text-gray-600 text-sm">From your Google reviews</p>
            </div>
          </div>

          {/* Phase Notice */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              🔧 Phase 1 Complete!
            </h3>
            <p className="text-blue-800">
              You're seeing the MVP foundation. Google integration, AI response generation, 
              and review management features are coming in Phase 2 & 3.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
