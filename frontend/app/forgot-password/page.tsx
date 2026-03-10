'use client'

import { useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await api.forgotPassword(email)

      if (result.error) {
        setError(result.message || 'Failed to send reset email')
      } else {
        setSuccess(true)
        setEmail('')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-gray-600">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-green-900 font-semibold mb-2">Check your email</h3>
            <p className="text-green-800 text-sm mb-4">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <p className="text-green-700 text-sm mb-4">
              The link will expire in 1 hour. If you don't see the email, check your spam folder.
            </p>
            <Link
              href="/login"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              ← Back to login
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6 card" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>

            <div className="text-center">
              <p className="text-gray-600 text-sm">
                Remember your password?{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  Back to login
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
