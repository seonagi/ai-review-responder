# Password Recovery Feature - Deployment Guide

## Overview
This document covers the complete password recovery implementation for AI Review Responder. The feature enables users to reset forgotten passwords through a secure, time-limited token system with email verification.

## What Was Implemented

### Backend Changes
1. **New Email Service** (`backend/src/services/emailService.js`)
   - Uses Resend for reliable email delivery
   - Sends password reset emails with 1-hour expiry tokens
   - Includes verification email functionality for future use

2. **New Auth Endpoints**
   - `POST /api/auth/forgot-password` - Request password reset
   - `POST /api/auth/reset-password` - Complete password reset with token

3. **Database Schema Updates**
   - New `password_reset_tokens` table for secure token storage
   - Tokens are SHA256-hashed before storage
   - Automatic cleanup: tokens marked as used, expiry validation

4. **Security Features**
   - Tokens expire after 1 hour
   - Tokens are single-use (marked used after reset)
   - Email enumeration protection (always returns success message)
   - Password validation on reset (8+ chars, mixed case, numbers)

### Frontend Changes
1. **New Pages**
   - `/forgot-password` - Email entry form
   - `/reset-password?token=<TOKEN>` - Password reset form with token validation

2. **Updated Login Page**
   - "Forgot password?" link now points to `/forgot-password` (was `#`)

3. **API Client Updates**
   - `api.forgotPassword(email)` method
   - `api.resetPassword(token, password)` method

## Deployment Steps

### Step 1: Database Migration
Run the migration to create the `password_reset_tokens` table:

```bash
# On Railway backend (or production server)
npm run migrate
```

This will read `database-schema.sql` which now includes the password_reset_tokens table.

### Step 2: Backend Environment Variables
Add to Railway environment or `.env`:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

To get a Resend API key:
1. Sign up at https://resend.com (free tier = 100 emails/day)
2. Create API key in dashboard
3. Verify domain (optional for free tier, required for production)

### Step 3: Backend Deployment
Push to Railway (or your deployment target):

```bash
git push origin main
```

Railway will auto-deploy. Verify deployment:
```bash
curl -X POST https://your-backend.railway.app/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Expected response: `{"message":"If an account exists with that email, we have sent a password reset link."}`

### Step 4: Frontend Deployment
The frontend builds successfully and includes new pages:

```bash
git push origin main
# Vercel will auto-deploy
```

Verify in browser:
- Navigate to `/forgot-password` - should show email form
- Navigate to `/reset-password` - should show error (no token)
- Navigate to `/reset-password?token=abc123` - should show form

### Step 5: End-to-End Testing

#### Test 1: Valid Password Reset Flow
1. Go to login page
2. Click "Forgot password?"
3. Enter registered user email
4. Should see "Check your email" message
5. Check email for reset link (may go to spam)
6. Click link → Password reset form
7. Enter new password (8+ chars, mixed case, number)
8. Submit → "Password reset successful" message
9. Click "Go to login"
10. Log in with new password → Should succeed

#### Test 2: Invalid Token
1. Navigate to `/reset-password?token=invalid`
2. Should show "Invalid Reset Link" message
3. Should offer link to request new reset

#### Test 3: Expired Token
1. Tokens expire after 1 hour
2. After expiry, attempting to use token shows "Invalid or expired token"
3. User must request new reset

#### Test 4: Email Enumeration Protection
1. Try forgot-password with non-existent email
2. Should return same success message (doesn't reveal if email exists)

#### Test 5: Invalid Password Submission
Try submitting:
- Password too short (< 8 chars)
- No uppercase letters
- No lowercase letters
- No numbers
- Passwords don't match
Each should show appropriate validation error

## Configuration Checklist

- [ ] Database migrated (`npm run migrate`)
- [ ] `RESEND_API_KEY` set in Railway environment
- [ ] `RESEND_FROM_EMAIL` set in Railway environment
- [ ] Backend deployed to Railway
- [ ] Frontend deployed to Vercel
- [ ] "Forgot password?" link functional
- [ ] End-to-end flow tested with real user account
- [ ] Email delivery tested (check spam folder)
- [ ] Token expiration tested after 1 hour
- [ ] Invalid token handling verified

## Troubleshooting

### Email Not Arriving
1. Check spam/junk folders
2. Verify `RESEND_API_KEY` is correct
3. Check Resend dashboard for failed deliveries
4. For production: verify domain in Resend (not required for free tier but helps deliverability)

### Token Validation Errors
1. Ensure token hasn't expired (1-hour limit)
2. Verify token wasn't already used
3. Check database for valid token record:
   ```sql
   SELECT * FROM password_reset_tokens 
   WHERE user_id = '<user_id>' 
   ORDER BY created_at DESC;
   ```

### Frontend Page Not Found
1. Clear Next.js cache: `rm -rf .next`
2. Rebuild: `npm run build`
3. Verify pages exist: `/app/forgot-password/page.tsx` and `/app/reset-password/page.tsx`

### CORS Issues
Ensure `FRONTEND_URL` is correctly set in backend .env:
```
FRONTEND_URL=https://ai-review-responder-frontend.vercel.app
```

This determines the reset link URL sent in emails.

## Security Considerations

### Already Implemented
✅ Tokens are SHA256-hashed in database (plaintext never stored)
✅ Tokens expire after 1 hour
✅ Single-use tokens (marked used after reset)
✅ Email enumeration protection
✅ Password strength validation
✅ HTTPS transport (production required)
✅ Database transactions for atomic operations

### Future Enhancements
- [ ] Rate limiting on forgot-password endpoint (prevent brute force)
- [ ] Email verification before allowing reset
- [ ] Two-factor authentication (2FA) for additional security
- [ ] Password reset notifications (email alert when password changed)
- [ ] Admin ability to force password reset for users

## Monitoring & Maintenance

### Monitor Email Delivery
```sql
-- Check recent password reset attempts
SELECT user_id, created_at, expires_at, used_at 
FROM password_reset_tokens 
ORDER BY created_at DESC 
LIMIT 20;
```

### Monitor Failed Resets
Check audit logs:
```sql
SELECT user_id, action, created_at, details 
FROM audit_logs 
WHERE action LIKE '%password%' 
ORDER BY created_at DESC;
```

### Clean Up Expired Tokens
Tokens auto-expire but you can clean up old records:
```sql
DELETE FROM password_reset_tokens 
WHERE expires_at < CURRENT_TIMESTAMP 
AND used_at IS NULL;
```

## Rollback Plan

If issues arise:

1. **Frontend Rollback** (Vercel)
   - Revert to previous deployment in Vercel dashboard
   - Or: `git revert <commit-hash>` and push

2. **Backend Rollback** (Railway)
   - Redeploy from previous git commit
   - Or: Disable password reset by commenting out routes in `backend/src/routes/auth.js`

3. **Database Rollback**
   - Drop new table: `DROP TABLE password_reset_tokens;`
   - Note: Only if no tokens have been used (safe to drop)

## Support

Issues? Check:
1. Email service (Resend dashboard)
2. Database migrations
3. Environment variables
4. Browser console for errors
5. Backend logs for API errors
6. Network tab for request/response details

## Next Steps

1. **Deploy to production immediately** - this is a critical feature
2. **Monitor for 24 hours** - watch for email delivery issues
3. **Communicate to users** - let them know password recovery is now available
4. **Document in user help** - add "Forgot Password" section to help docs
5. **Consider 2FA** - add optional 2FA for additional security in future
