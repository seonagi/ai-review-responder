'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import ReviewCard from '@/components/ReviewCard'

interface GoogleConnection {
  connected: boolean
  businessName?: string
  connectedAt?: string
  lastSyncedAt?: string
  connectionId?: string
}

interface Review {
  id: string
  reviewer_name: string
  reviewer_photo_url?: string
  rating: number
  review_text?: string
  review_reply?: string
  posted_at: string
  is_responded: boolean
  sentiment: string
}

export default function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [googleConnection, setGoogleConnection] = useState<GoogleConnection>({ connected: false })
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    async function loadUser() {
      const result = await api.getCurrentUser()
      
      if (result.error) {
        router.push('/login')
      } else {
        setUser(result.data?.user)
        setLoading(false)
        
        // Load Google connection status
        await loadGoogleStatus()
        
        // Check for OAuth callback messages
        checkOAuthMessages()
      }
    }

    loadUser()
  }, [router])

  const checkOAuthMessages = () => {
    if (searchParams.get('google_connected') === 'true') {
      setMessage({ type: 'success', text: 'Google Business connected successfully!' })
      loadGoogleStatus()
      loadReviews()
      // Clear URL params
      window.history.replaceState({}, '', '/dashboard')
    } else if (searchParams.get('error')) {
      const errorMap: Record<string, string> = {
        oauth_failed: 'OAuth authorization failed. Please try again.',
        invalid_state: 'Invalid OAuth state. Please try again.',
        missing_tokens: 'Failed to receive access tokens from Google.',
        no_business_account: 'No Google Business account found. Please create one first.',
        no_locations: 'No business locations found in your Google Business account.',
        connection_failed: 'Failed to establish connection. Please try again.'
      }
      const errorCode = searchParams.get('error') || 'unknown'
      setMessage({ type: 'error', text: errorMap[errorCode] || 'An error occurred during connection.' })
      // Clear URL params
      window.history.replaceState({}, '', '/dashboard')
    }
  }

  const loadGoogleStatus = async () => {
    try {
      const result = await api.googleStatus()
      if (result.data) {
        setGoogleConnection(result.data)
        if (result.data.connected) {
          loadReviews()
        }
      }
    } catch (error) {
      console.error('Failed to load Google status:', error)
    }
  }

  const loadReviews = async () => {
    setReviewsLoading(true)
    try {
      const result = await api.getReviews({ limit: 50 })
      if (result.data) {
        setReviews(result.data.reviews || [])
      }
    } catch (error) {
      console.error('Failed to load reviews:', error)
    } finally {
      setReviewsLoading(false)
    }
  }

  const handleConnectGoogle = () => {
    // Redirect to backend OAuth endpoint
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    window.location.href = `${backendUrl}/api/google/connect`
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google Business account?')) {
      return
    }

    try {
      await api.googleDisconnect()
      setGoogleConnection({ connected: false })
      setReviews([])
      setMessage({ type: 'success', text: 'Google Business disconnected successfully' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to disconnect Google Business' })
    }
  }

  const handleSyncReviews = async () => {
    setSyncing(true)
    setMessage(null)
    try {
      const result = await api.syncReviews()
      if (result.data) {
        const { stats } = result.data
        setMessage({ 
          type: 'success', 
          text: `Synced ${stats.totalFetched} reviews (${stats.newReviews} new, ${stats.updatedReviews} updated)` 
        })
        await loadReviews()
      }
    } catch (error: any) {
      if (error.reconnectNeeded) {
        setMessage({ type: 'error', text: 'Authentication expired. Please reconnect your Google Business account.' })
        setGoogleConnection({ connected: false })
      } else {
        setMessage({ type: 'error', text: error.message || 'Failed to sync reviews' })
      }
    } finally {
      setSyncing(false)
    }
  }

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  const renderStars = (rating: number) => {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
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
        <div className="max-w-6xl mx-auto">
          {/* Welcome Header */}
          <h2 className="text-3xl font-bold mb-6">Welcome, {user?.name || 'User'}! 👋</h2>

          {/* Alert Messages */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 
              'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <p className="font-medium">{message.text}</p>
            </div>
          )}

          {/* Google Connection Card */}
          <div className="card mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-semibold mb-2">
                  🔗 Google My Business Connection
                </h3>
                {googleConnection.connected ? (
                  <div>
                    <p className="text-green-600 font-medium mb-1">
                      ✅ Connected to {googleConnection.businessName}
                    </p>
                    <p className="text-sm text-gray-600">
                      Connected {googleConnection.connectedAt && formatDate(googleConnection.connectedAt)}
                    </p>
                    {googleConnection.lastSyncedAt && (
                      <p className="text-sm text-gray-600">
                        Last synced {formatDate(googleConnection.lastSyncedAt)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-600">
                    Connect your Google Business account to fetch and respond to reviews.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {googleConnection.connected ? (
                  <>
                    <button 
                      onClick={handleSyncReviews}
                      disabled={syncing}
                      className="btn-primary"
                    >
                      {syncing ? '⏳ Syncing...' : '🔄 Refresh Reviews'}
                    </button>
                    <button 
                      onClick={handleDisconnect}
                      className="btn-secondary"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={handleConnectGoogle}
                    className="btn-primary"
                  >
                    Connect Google Business
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <div className="card">
              <h3 className="text-lg font-semibold mb-2">📊 Total Reviews</h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">{reviews.length}</p>
              <p className="text-gray-600 text-sm">
                {googleConnection.connected ? 'From Google' : 'Connect Google to see reviews'}
              </p>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-2">✅ Responded</h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">
                {reviews.filter(r => r.is_responded).length}
              </p>
              <p className="text-gray-600 text-sm">
                {reviews.length > 0 
                  ? `${Math.round((reviews.filter(r => r.is_responded).length / reviews.length) * 100)}% response rate`
                  : 'No reviews yet'}
              </p>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-2">⭐ Avg Rating</h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">
                {reviews.length > 0 
                  ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
                  : '-'}
              </p>
              <p className="text-gray-600 text-sm">Out of 5 stars</p>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-2">🎯 Need Response</h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">
                {reviews.filter(r => !r.is_responded).length}
              </p>
              <p className="text-gray-600 text-sm">Unanswered reviews</p>
            </div>
          </div>

          {/* Reviews List */}
          {googleConnection.connected && (
            <div className="card">
              <h3 className="text-2xl font-bold mb-4">📝 Recent Reviews</h3>
              
              {reviewsLoading ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">⏳</div>
                  <p className="text-gray-600">Loading reviews...</p>
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📭</div>
                  <p className="text-gray-600 mb-4">No reviews yet</p>
                  <button onClick={handleSyncReviews} className="btn-primary">
                    Sync Reviews from Google
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map(review => (
                    <ReviewCard 
                      key={review.id} 
                      review={review} 
                      onResponsePosted={loadReviews}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Getting Started Card (only show if not connected) */}
          {!googleConnection.connected && (
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">🚀 Getting Started</h3>
              <p className="text-gray-600 mb-4">
                Connect your Google My Business account to start managing your reviews:
              </p>
              <ol className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">1.</span>
                  Click "Connect Google Business" above
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">2.</span>
                  Sign in with your Google account that owns the business
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">3.</span>
                  Grant permissions to read and manage reviews
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">4.</span>
                  Your reviews will sync automatically!
                </li>
              </ol>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
