# Phase 2 Testing Guide

Complete testing instructions for Google OAuth and review fetching functionality.

---

## Prerequisites

Before testing, ensure you have:
- ✅ Completed `SETUP-GOOGLE.md` (Google Cloud Console setup)
- ✅ Google OAuth credentials in backend `.env`
- ✅ A Google Business Profile with at least a few reviews
- ✅ PostgreSQL database running and migrated
- ✅ Both backend and frontend running locally

---

## Setup Instructions

### 1. Backend Configuration

```bash
cd backend

# Copy .env.example if you haven't already
cp .env.example .env

# Edit .env and add:
# - DATABASE_URL (PostgreSQL connection)
# - JWT_SECRET (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
# - GOOGLE_CLIENT_ID (from Google Cloud Console)
# - GOOGLE_CLIENT_SECRET (from Google Cloud Console)
# - GOOGLE_CALLBACK_URL=http://localhost:5000/api/google/callback
# - FRONTEND_URL=http://localhost:3000

# Install dependencies (if not done)
npm install

# Run database migrations (if not done)
npm run migrate

# Start backend
npm run dev

# Backend should be running on http://localhost:5000
```

### 2. Frontend Configuration

```bash
cd frontend

# Create .env.local if it doesn't exist
echo "NEXT_PUBLIC_API_URL=http://localhost:5000" > .env.local

# Install dependencies (if not done)
npm install

# Start frontend
npm run dev

# Frontend should be running on http://localhost:3000
```

---

## Testing Workflow

### Test 1: User Registration/Login

**Goal:** Ensure auth is working before testing Google integration

1. Open browser: `http://localhost:3000`
2. Click "Sign Up"
3. Register with email/password
4. Login with same credentials
5. You should see the dashboard

**Expected result:** Dashboard loads with "Connect Google Business" button

---

### Test 2: Google OAuth Connection

**Goal:** Successfully connect Google Business account

1. **Initiate OAuth:**
   - On dashboard, click "Connect Google Business"
   - You'll be redirected to Google's consent screen

2. **Google Consent Screen:**
   - Sign in with your Google account (must own the business profile)
   - You'll see: "AI Review Responder wants to access your Google Account"
   - Permissions requested:
     - View your email address
     - View your basic profile info
     - **Manage your Google My Business account**
   - Click "Allow"

3. **Callback:**
   - You'll be redirected back to `http://localhost:3000/dashboard?google_connected=true`
   - You should see a green success message: "Google Business connected successfully!"

4. **Verify Connection:**
   - Dashboard should now show:
     - "✅ Connected to [Your Business Name]"
     - "Refresh Reviews" button
     - "Disconnect" button

**Expected result:** Connection established, business name displayed

**Troubleshooting:**
- If you see "OAuth authorization failed":
  - Check that `GOOGLE_CALLBACK_URL` in `.env` matches Google Console
  - Verify scopes are correct in Google Console
- If you see "No business account found":
  - Make sure you're logged into Google with the account that owns the business
  - Verify you have a Google Business Profile at https://business.google.com
- If you see "redirect_uri_mismatch":
  - Check Google Console → Credentials → Authorized redirect URIs
  - Must exactly match: `http://localhost:5000/api/google/callback`

---

### Test 3: Fetch Reviews

**Goal:** Sync reviews from Google to local database

1. **Manual Sync:**
   - Click "Refresh Reviews" button
   - You should see a loading state: "⏳ Syncing..."
   - After 2-10 seconds (depending on review count), you'll see:
     - Success message: "Synced X reviews (Y new, Z updated)"
     - Reviews appear in the list below

2. **Verify Reviews Display:**
   - Each review should show:
     - Reviewer name (or initial if no photo)
     - Star rating (⭐⭐⭐⭐⭐)
     - Review text
     - Date posted (relative: "2 days ago")
     - Response status ("Responded" badge if already replied on Google)

3. **Check Stats:**
   - Top stats should update:
     - Total Reviews
     - Responded count
     - Average rating
     - Need Response count

**Expected result:** Reviews sync successfully and display in dashboard

**Troubleshooting:**
- If you see "Authentication expired":
  - This means the access token expired (happens after 1 hour)
  - Click "Connect Google Business" again to refresh
- If you see "Failed to sync reviews":
  - Check backend console for detailed error
  - Verify Google Business Profile API is enabled in Google Console
  - Check API quotas (you might have hit the limit)

---

### Test 4: Review Filters (Future Feature)

Currently not implemented, but the API supports filtering by:
- Rating (1-5 stars)
- Response status (responded/not responded)

This will be added to the frontend in a future update.

---

### Test 5: Token Refresh (Automatic)

**Goal:** Verify access token auto-refreshes when expired

1. **Wait for token to expire:**
   - Access tokens expire after 1 hour
   - Or manually expire it in the database for testing:
     ```sql
     UPDATE google_connections 
     SET token_expires_at = NOW() - INTERVAL '1 hour' 
     WHERE user_id = 'your-user-id';
     ```

2. **Trigger refresh:**
   - Click "Refresh Reviews"
   - Backend should automatically detect expired token
   - Uses refresh_token to get new access_token
   - Reviews sync successfully

3. **Verify:**
   - Check backend console logs for "Access token expired, refreshing..."
   - Reviews should sync without user intervention

**Expected result:** Token refreshes silently, reviews sync normally

**Troubleshooting:**
- If refresh fails:
  - Refresh token might be invalid (user needs to reconnect)
  - User will see "Authentication expired. Please reconnect your Google Business account."

---

### Test 6: Disconnect Google

**Goal:** Successfully disconnect Google Business account

1. Click "Disconnect" button
2. Confirm in the popup: "Are you sure you want to disconnect your Google Business account?"
3. You should see:
   - Success message: "Google Business disconnected successfully"
   - Connection status changes to disconnected
   - Reviews disappear from view (but remain in database)

4. **Verify in database:**
   ```sql
   SELECT * FROM google_connections WHERE user_id = 'your-user-id';
   -- is_active should be FALSE
   ```

**Expected result:** Connection marked as inactive, UI updates

---

## Database Verification

After testing, verify data is stored correctly:

### Check Google Connections

```sql
SELECT 
  id, 
  user_id, 
  business_name, 
  connected_at, 
  last_synced_at, 
  is_active
FROM google_connections;

-- Should show your connection with business_name populated
-- access_token and refresh_token should be encrypted (long strings)
```

### Check Reviews

```sql
SELECT 
  id, 
  reviewer_name, 
  rating, 
  review_text, 
  posted_at, 
  is_responded, 
  sentiment
FROM reviews
ORDER BY posted_at DESC
LIMIT 10;

-- Should show your fetched reviews
-- sentiment should be: positive (4-5 stars), neutral (3 stars), negative (1-2 stars)
```

### Check Audit Logs

```sql
SELECT 
  action, 
  entity_type, 
  details, 
  created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 10;

-- Should show:
-- - google_oauth_connected
-- - google_fetch_reviews
-- - google_oauth_disconnected (if you tested disconnect)
```

---

## API Endpoint Testing (Manual/Postman)

If you prefer testing APIs directly:

### 1. Get Auth Token

```bash
# Register/Login to get JWT token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Copy the "token" from response
```

### 2. Check Google Status

```bash
curl http://localhost:5000/api/google/status \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Response:
# { "connected": false }
# or
# { "connected": true, "businessName": "...", "connectedAt": "...", ... }
```

### 3. Initiate OAuth (Browser Only)

```bash
# This must be done in a browser (OAuth flow requires redirects)
# Visit: http://localhost:5000/api/google/connect
# Include token as query param: ?token=YOUR_TOKEN_HERE
# Or set as cookie/header
```

### 4. Sync Reviews

```bash
curl -X POST http://localhost:5000/api/google/sync-reviews \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Response:
# {
#   "success": true,
#   "message": "Reviews synced successfully",
#   "stats": {
#     "totalFetched": 15,
#     "newReviews": 10,
#     "updatedReviews": 5
#   }
# }
```

### 5. Get Reviews

```bash
curl http://localhost:5000/api/google/reviews?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Response:
# {
#   "reviews": [...],
#   "total": 15,
#   "limit": 10,
#   "offset": 0,
#   "hasMore": true
# }
```

---

## Error Scenarios to Test

### Scenario 1: User Denies OAuth Permission

1. Start OAuth flow
2. Click "Cancel" on Google consent screen
3. Expected: Redirect to dashboard with error message

### Scenario 2: No Business Profile

1. Use Google account without a business profile
2. Expected: Error "No business account found"

### Scenario 3: Rate Limiting (Hard to test locally)

1. Make 100+ API calls in quick succession
2. Expected: Google API returns 429 error
3. App should handle gracefully and show user-friendly message

### Scenario 4: Database Connection Lost

1. Stop PostgreSQL
2. Try to sync reviews
3. Expected: 500 error with message "Database connection failed"
4. Backend logs should show detailed error

---

## Performance Expectations

**OAuth Flow:**
- Initiate → Consent → Callback: 5-15 seconds (depends on user)

**Review Sync:**
- 0-50 reviews: 2-5 seconds
- 50-200 reviews: 5-15 seconds
- 200+ reviews: 15-30 seconds (pagination)

**Token Refresh:**
- Should happen automatically in <1 second

**Database Queries:**
- Connection status: <50ms
- Fetch reviews: <200ms (for 50 reviews)

---

## Security Checklist

Before deploying to production:

- [ ] Tokens are encrypted in database (not plain text)
- [ ] JWT_SECRET is strong (32+ random bytes)
- [ ] HTTPS is enabled (not http://)
- [ ] CORS is restricted to frontend domain only
- [ ] Google OAuth credentials are different for dev/prod
- [ ] Rate limiting is enabled on API endpoints
- [ ] Audit logs capture all Google API calls
- [ ] Error messages don't leak sensitive info

---

## Next Steps After Testing

Once all tests pass:

1. **Deploy to staging:**
   - Update `GOOGLE_CALLBACK_URL` to staging URL
   - Add staging URL to Google Console authorized redirect URIs
   - Test OAuth flow on staging

2. **User acceptance testing:**
   - Invite beta users (restaurant owners)
   - Collect feedback on OAuth flow clarity
   - Identify edge cases

3. **Monitor logs:**
   - Check audit_logs for errors
   - Track API quota usage in Google Console
   - Set up alerts for failures

4. **Phase 3 preparation:**
   - Reviews are now in database
   - Ready for OpenAI integration (generate responses)

---

## Support & Debugging

**Common Issues:**

| Error | Cause | Solution |
|-------|-------|----------|
| "redirect_uri_mismatch" | Callback URL doesn't match Google Console | Update Google Console or .env |
| "insufficient_permissions" | Wrong scopes | Add `business.manage` scope |
| "Token expired" | Access token >1 hour old | Auto-refresh logic should handle this |
| "No business account" | User doesn't own a business | User needs to create Google Business Profile |
| "CORS error" | Frontend/backend URL mismatch | Update FRONTEND_URL in .env |

**Debugging Tools:**

- Backend logs: `npm run dev` console
- Database inspection: `psql` or TablePlus
- Network tab: Browser DevTools → Network
- Google API logs: https://console.cloud.google.com/logs

---

**Last updated:** 2026-02-20  
**Phase:** 2 - Google OAuth & Review Fetching  
**Status:** Ready for testing
