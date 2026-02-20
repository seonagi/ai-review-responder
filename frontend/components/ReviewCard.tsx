'use client'

import { useState } from 'react'
import api from '@/lib/api'

interface ReviewCardProps {
  review: {
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
  onResponsePosted?: () => void
}

interface AIResponse {
  id: string
  response_text: string
  generated_at: string
  status: string
}

export default function ReviewCard({ review, onResponsePosted }: ReviewCardProps) {
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  const handleGenerateResponse = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const result = await api.generateResponse(review.id)
      
      if (result.data) {
        if (result.data.alreadyExists) {
          // Response already exists
          setAiResponse(result.data.response)
        } else {
          // New response generated
          setAiResponse(result.data.response)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate response')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleStartEdit = () => {
    setEditedText(aiResponse?.response_text || '')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedText('')
  }

  const handleSaveEdit = async () => {
    if (!aiResponse) return

    try {
      const result = await api.updateResponse(aiResponse.id, editedText)
      if (result.data) {
        setAiResponse(result.data.response)
        setIsEditing(false)
        setEditedText('')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save edits')
    }
  }

  const handleApproveAndPost = async () => {
    if (!aiResponse) return

    if (!confirm('Post this response to Google? This action cannot be undone.')) {
      return
    }

    setIsPosting(true)
    setError(null)

    try {
      const result = await api.approveResponse(aiResponse.id)
      
      if (result.data) {
        setAiResponse({
          ...aiResponse,
          status: 'posted'
        })
        // Notify parent to refresh reviews
        if (onResponsePosted) {
          onResponsePosted()
        }
      }
    } catch (err: any) {
      if (err.reconnectNeeded) {
        setError('Google authentication expired. Please reconnect your Google Business account.')
      } else {
        setError(err.message || 'Failed to post response')
      }
    } finally {
      setIsPosting(false)
    }
  }

  const handleDeleteDraft = async () => {
    if (!aiResponse) return

    if (!confirm('Delete this draft response?')) {
      return
    }

    try {
      await api.deleteResponse(aiResponse.id)
      setAiResponse(null)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to delete draft')
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
      <div className="flex items-start gap-4">
        {/* Reviewer Avatar */}
        <div className="flex-shrink-0">
          {review.reviewer_photo_url ? (
            <img 
              src={review.reviewer_photo_url} 
              alt={review.reviewer_name}
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
              {review.reviewer_name[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* Review Content */}
        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold text-gray-900">{review.reviewer_name}</p>
              <p className="text-sm text-gray-500">{formatDate(review.posted_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{renderStars(review.rating)}</span>
              {review.is_responded && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  Responded
                </span>
              )}
            </div>
          </div>

          {review.review_text && (
            <p className="text-gray-700 mb-2">{review.review_text}</p>
          )}

          {/* Existing Response (from Google) */}
          {review.review_reply && (
            <div className="mt-3 pl-4 border-l-2 border-blue-200 bg-blue-50 p-3 rounded">
              <p className="text-sm font-semibold text-blue-900 mb-1">
                Your Response:
              </p>
              <p className="text-sm text-gray-700">{review.review_reply}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* AI Response Section */}
          {!review.is_responded && (
            <div className="mt-3">
              {!aiResponse ? (
                // Generate Response Button
                <button 
                  onClick={handleGenerateResponse}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {isGenerating ? '⏳ Generating...' : '✨ Generate AI Response'}
                </button>
              ) : (
                // AI Response Preview/Edit
                <div className="mt-3 pl-4 border-l-2 border-purple-200 bg-purple-50 p-3 rounded">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-semibold text-purple-900">
                      {aiResponse.status === 'posted' ? '✅ Posted Response:' : '🤖 AI-Generated Response:'}
                    </p>
                    {aiResponse.status === 'draft' && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                        Draft
                      </span>
                    )}
                  </div>

                  {isEditing ? (
                    // Edit Mode
                    <div>
                      <textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm resize-none"
                        rows={4}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        >
                          💾 Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div>
                      <p className="text-sm text-gray-700 mb-3">{aiResponse.response_text}</p>
                      
                      {aiResponse.status === 'draft' && (
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={handleApproveAndPost}
                            disabled={isPosting}
                            className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                          >
                            {isPosting ? '⏳ Posting...' : '✅ Approve & Post to Google'}
                          </button>
                          <button
                            onClick={handleStartEdit}
                            className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={handleDeleteDraft}
                            className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      )}

                      {aiResponse.status === 'posted' && (
                        <p className="text-xs text-gray-600 mt-2">
                          Posted to Google • No longer editable
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
