# Password Recovery Feature - Testing Guide

## Unit Tests (Code Level)

### Backend Auth Routes Tests

The following endpoints should be tested:

#### 1. POST /api/auth/forgot-password

**Valid Request:**
```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

**Expected Responses:**
- ✅ User exists: `{"message":"If an account exists with that email, we have sent a password reset link."}`
- ✅ User doesn't exist: `{"message":"If an account exists with that email, we have sent a password reset link."}` (same - prevents enumeration)
- ❌ Invalid email: `{"error":"Please provide a valid email address"}`
- ❌ Missing email: `{"error":"email is required"}`

**Database Check:**
```sql
SELECT * FROM password_reset_tokens 
WHERE user_id IN (SELECT id FROM users WHERE email = 'user@example.com')
ORDER BY created_at DESC LIMIT 1;
```

Should show:
- `token_hash`: SHA256 hash (not plaintext)
- `expires_at`: Now + 1 hour
- `used_at`: NULL (unused)

#### 2. POST /api/auth/reset-password

**Valid Request:**
```bash
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123...",
    "password": "NewPassword123"
  }'
```

**Expected Responses:**
- ✅ Valid token: `{"message":"Password reset successfully. You can now log in with your new password."}`
- ❌ Invalid/expired token: `{"error":"Invalid or expired token","message":"The password reset link is invalid or has expired..."}`
- ❌ Already used token: `{"error":"Invalid or expired token"}`
- ❌ Invalid password: `{"error":"Password must contain at least one uppercase letter, one lowercase letter, and one number"}`
- ❌ Short password: `{"error":"Password must be at least 8 characters long"}`

**Database Check:**
```sql
SELECT * FROM password_reset_tokens WHERE used_at IS NOT NULL;
```

Should show token marked as used after successful reset.

---

## Integration Tests (Full Flow)

### Test Case 1: Successful Password Reset

**Steps:**
1. Create test user (or use existing)
2. Call POST /api/auth/forgot-password with user email
3. Retrieve token from database
4. Call POST /api/auth/reset-password with token + new password
5. Verify user can login with new password

**Expected Outcome:** ✅ All steps succeed

### Test Case 2: Expired Token

**Steps:**
1. Generate reset token
2. Wait 1+ hour (or manually set expires_at to past time in DB)
3. Attempt to reset password with expired token

**Expected Outcome:** ❌ "Invalid or expired token" error

### Test Case 3: Already Used Token

**Steps:**
1. Generate reset token
2. Use it to reset password successfully
3. Try to use same token again

**Expected Outcome:** ❌ "Invalid or expired token" error

### Test Case 4: Invalid Token Format

**Steps:**
1. Call POST /api/auth/reset-password with random string as token
2. Call with empty token string
3. Call with missing token field

**Expected Outcome:** ❌ All return appropriate error

### Test Case 5: Password Strength Validation

Test each requirement:
- ❌ "password" - No uppercase
- ❌ "PASSWORD123" - No lowercase
- ❌ "Password" - No number
- ❌ "Pass1" - Too short (< 8)
- ✅ "NewPass123" - Valid

**Expected Outcome:** Only valid password accepted

---

## Frontend Tests (Browser Level)

### Test Case 1: Forgot Password Page Loads

```
Visit: http://localhost:3000/forgot-password
- ✅ Page loads
- ✅ Email input field visible
- ✅ Submit button enabled
- ✅ Link back to login visible
```

### Test Case 2: Forgot Password Form Submission

```
1. Enter registered user email
2. Click "Send reset link"
- ✅ Loading state shows
- ✅ Success message appears: "Check your email"
- ✅ No error messages
- ✅ Form hides after success
```

### Test Case 3: Email Reception

```
1. Check email for "AI Review Responder" sender
- ✅ Email arrives (may be in spam)
- ✅ Contains "Reset Password" button
- ✅ Contains reset link with token
- ✅ Link is valid (not broken)
```

### Test Case 4: Reset Password Page with Valid Token

```
Visit: /reset-password?token=<VALID_TOKEN>
- ✅ Page loads
- ✅ Password input fields visible
- ✅ Shows password requirements
- ✅ Submit button enabled
```

### Test Case 5: Reset Password Form Validation

```
Try submitting:
- "password" (all lowercase) → ❌ Error shown
- "PASSWORD123" (no lowercase) → ❌ Error shown
- "Password" (no number) → ❌ Error shown
- "Pass1" (too short) → ❌ Error shown
- "NewPass123" (valid) → ✅ Success message
```

### Test Case 6: Login After Reset

```
1. Reset password successfully
2. Go to login page
3. Enter email + new password
- ✅ Login succeeds
- ✅ Redirect to dashboard
- ✅ Can access protected pages
```

### Test Case 7: Reset Password Page with Invalid Token

```
Visit: /reset-password?token=invalid123
- ✅ Error message shown: "Invalid Reset Link"
- ✅ Link to request new reset visible
- ✅ Form hidden
```

### Test Case 8: Reset Password Page with No Token

```
Visit: /reset-password (no token param)
- ✅ Error message shown
- ✅ Prompts to request new reset link
```

---

## API Integration Tests (Curl Commands)

### Setup Test User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "InitialPass123",
    "name": "Test User"
  }'
```

### Request Reset
```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "testuser@example.com"}'
```

### Get Token from Database
```bash
# After requesting reset, run this SQL
SELECT token_hash, expires_at FROM password_reset_tokens 
WHERE user_id = (SELECT id FROM users WHERE email = 'testuser@example.com')
ORDER BY created_at DESC LIMIT 1;
```

### Reset Password
```bash
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN_HERE",
    "password": "NewTestPass123"
  }'
```

### Login with New Password
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "NewTestPass123"
  }'
```

Expected: `{"message":"Login successful","user":{...},"token":"..."}`

---

## Load/Performance Tests

### Email Sending Performance
- Single email: < 500ms
- Bulk password resets: Should handle 100+ concurrent requests

### Token Generation
- Token creation: < 10ms
- Token validation: < 20ms

### Database Performance
```sql
-- Check if password_reset_tokens queries are indexed
EXPLAIN ANALYZE SELECT * FROM password_reset_tokens 
WHERE token_hash = 'abc...';
-- Should use idx_password_reset_tokens_hash
```

---

## Security Tests

### 1. Token Exposure Prevention
- [ ] Tokens never logged to console (check backend logs)
- [ ] Tokens never appear in URLs after submission
- [ ] Tokens only in email and database
- [ ] Token never sent back to frontend (except in email link)

### 2. Email Enumeration Protection
```bash
# Test with non-existent email
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "nonexistent@example.com"}'

# Should return same message as valid email
# {"message":"If an account exists..."}
```

### 3. Timing Attack Prevention
- Request for valid email: ~200ms
- Request for invalid email: ~200ms (should be similar)

### 4. SQL Injection Prevention
Test with SQL payloads in email field:
```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com\"; DROP TABLE users; --"}'
```
Expected: Email validation error (not SQL error)

### 5. CSRF Prevention
- POST endpoints should validate CSRF tokens (if implemented)
- Should reject requests from wrong origin

---

## Monitoring Tests

### Audit Log Generation
```sql
SELECT * FROM audit_logs WHERE action LIKE '%password%' 
ORDER BY created_at DESC;
```

Should show:
- `forgot_password_request` actions
- `password_reset` actions
- User IDs
- Timestamps

### Email Delivery Monitoring
```
Check Resend dashboard:
- Total emails sent
- Delivery rate
- Bounce rate
- Any failures
```

---

## Checklist for Production Readiness

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All security tests passing
- [ ] API endpoints responding correctly
- [ ] Database migrations applied
- [ ] Email service configured and tested
- [ ] Frontend builds without errors
- [ ] Frontend pages load correctly
- [ ] Form validation working
- [ ] Error messages clear and helpful
- [ ] User can complete full password reset flow
- [ ] User can login after password reset
- [ ] Tokens expire correctly after 1 hour
- [ ] Already-used tokens rejected
- [ ] Email enumeration protection working
- [ ] Audit logs recording actions
- [ ] Performance acceptable (<500ms per operation)
- [ ] No console errors in browser
- [ ] No SQL errors in backend logs
- [ ] No exposed credentials in code/logs

## Test Results Template

```markdown
## Password Recovery Feature - Test Results
Date: YYYY-MM-DD
Tested By: [Name]

### Frontend Tests
- [ ] Forgot password page loads: ✅/❌
- [ ] Form submission: ✅/❌
- [ ] Email reception: ✅/❌
- [ ] Reset password page loads: ✅/❌
- [ ] Password validation: ✅/❌
- [ ] Successful password reset: ✅/❌
- [ ] Login after reset: ✅/❌

### Backend Tests
- [ ] /forgot-password endpoint: ✅/❌
- [ ] /reset-password endpoint: ✅/❌
- [ ] Token generation: ✅/❌
- [ ] Token validation: ✅/❌
- [ ] Email sending: ✅/❌
- [ ] Database migration: ✅/❌

### Security Tests
- [ ] Email enumeration protection: ✅/❌
- [ ] Token expiration: ✅/❌
- [ ] Single-use token enforcement: ✅/❌
- [ ] Password strength validation: ✅/❌

### Issues Found
1. [Description]
2. [Description]

### Overall Status
✅ READY FOR PRODUCTION / ❌ BLOCKING ISSUES FOUND

### Notes
[Any additional observations]
```

---

## Need Help?

1. **Email not arriving?** Check Resend dashboard and spam folders
2. **Token not working?** Verify token hasn't expired (1-hour limit)
3. **Password validation failing?** Check password meets all requirements (8+ chars, mixed case, number)
4. **Database error?** Ensure migration ran successfully: `npm run migrate`
5. **Frontend page not found?** Clear Next.js cache: `rm -rf .next && npm run build`
