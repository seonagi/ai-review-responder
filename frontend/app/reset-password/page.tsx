'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tokenValid, setTokenValid] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. No token provided.')
    } else {
      setTokenValid(true)
    }
  }, [token])

  const validatePassword = () => {
    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters long'
    }
    if (!/[a-z]/.test(formData.password)) {
      return 'Password must contain at least one lowercase letter'
    }
    if (!/[A-Z]/.test(formData.password)) {
      return 'Password must contain at least one uppercase letter'
    }
    if (!/\d/.test(formData.password)) {
      return 'Password must contain at least one number'
    }
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match'
    }
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const validationError = validatePassword()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    try {
      if (!token) {
        setError('Invalid reset link')
        return
      }

      const result = await api.resetPassword(token, formData.password)

      if (result.error) {
        setError(result.message || 'Failed to reset password')
      } else {
        setSuccess(true)
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-red-900 font-semibold mb-2">Invalid Reset Link</h3>
            <p className="text-red-800 text-sm mb-4">
              {error || 'The password reset link is invalid or has expired.'}
            </p>
            <Link href="/forgot-password" className="text-blue-600 hover:text-blue-700 font-medium">
              Request a new reset link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Set your new password
          </h2>
          <p className="mt-2 text-center text-gray-600">
            Enter a new password for your account
          </p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-green-900 font-semibold mb-2">Password reset successful!</h3>
            <p className="text-green-800 text-sm mb-4">
              Your password has been reset. Redirecting to login...
            </p>
            <Link
              href="/login"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Go to login →
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
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input-field"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
              <p className="mt-2 text-xs text-gray-500">
                Must be at least 8 characters with uppercase, lowercase, and a number
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className="input-field"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !formData.password || !formData.confirmPassword}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            <div className="text-center">
              <p className="text-gray-600 text-sm">
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  ← Back to login
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function ResetPasswordLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoadingFallback />}>
      <ResetPasswordContent />
    </Suspense>
  )
}
