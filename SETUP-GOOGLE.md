# Google My Business API Setup Guide

Complete step-by-step guide to enable Google My Business integration for AI Review Responder.

---

## Prerequisites

- A Google account
- A Google Business Profile (formerly "Google My Business listing")
- Admin access to your business profile
- Basic understanding of OAuth 2.0 (we'll guide you through it!)

---

## Part 1: Google Cloud Console Setup

### Step 1: Create a Google Cloud Project

1. **Go to Google Cloud Console:**  
   Visit: https://console.cloud.google.com/

2. **Create a new project:**
   - Click the project dropdown (top left)
   - Click "New Project"
   - Name: `AI Review Responder` (or your preferred name)
   - Click "Create"
   - Wait 10-15 seconds for project creation

3. **Select your new project:**
   - Use the project dropdown to select your newly created project

---

### Step 2: Enable Google My Business API

1. **Navigate to APIs & Services:**
   - From the left menu: **APIs & Services → Library**
   - Or visit: https://console.cloud.google.com/apis/library

2. **Search for "Google My Business":**
   - In the search bar, type: `Google My Business API`
   - Click on **"Google Business Profile API"** (the new name)

3. **Enable the API:**
   - Click the blue **"Enable"** button
   - Wait 5-10 seconds for activation

---

### Step 3: Create OAuth 2.0 Credentials

1. **Go to Credentials:**
   - Left menu: **APIs & Services → Credentials**
   - Or visit: https://console.cloud.google.com/apis/credentials

2. **Configure OAuth Consent Screen (first time only):**
   - Click **"Configure Consent Screen"**
   - **User Type:** Select **"External"** (unless you have a Google Workspace)
   - Click **"Create"**

3. **Fill out OAuth Consent Screen:**
   - **App name:** `AI Review Responder`
   - **User support email:** Your email address
   - **App logo:** (optional - skip for now)
   - **Developer contact email:** Your email address
   - Click **"Save and Continue"**

4. **Scopes (Step 2 of consent screen):**
   - Click **"Add or Remove Scopes"**
   - Filter by "business" or manually add:
     - `https://www.googleapis.com/auth/business.manage` (Read and manage business data)
   - Click **"Update"**
   - Click **"Save and Continue"**

5. **Test Users (Step 3):**
   - Click **"Add Users"**
   - Add your Google Business Profile email address
   - Click **"Save and Continue"**

6. **Summary:**
   - Review settings
   - Click **"Back to Dashboard"**

7. **Create OAuth Client ID:**
   - Go back to **Credentials** tab
   - Click **"+ Create Credentials"** → **"OAuth client ID"**
   - **Application type:** `Web application`
   - **Name:** `AI Review Responder Web Client`

8. **Authorized Redirect URIs:**
   - Click **"+ Add URI"**
   - **Local development:** `http://localhost:5000/api/auth/google/callback`
   - **Production (later):** `https://your-backend-url.railway.app/api/auth/google/callback`
   - Click **"Create"**

9. **Save Your Credentials:**
   - A popup will show your **Client ID** and **Client Secret**
   - **IMPORTANT:** Copy these immediately!
   - Download the JSON file (optional backup)

   Example:
   ```
   Client ID: 123456789-abcdefghijk.apps.googleusercontent.com
   Client Secret: GOCSPX-AbCdEf123456789
   ```

---

## Part 2: Find Your Google Business Profile ID

Your "Business Profile ID" (also called "Location ID") is needed to fetch reviews.

### Method 1: Using the API (Recommended)

Once you've connected via OAuth (after completing this setup), you can use this endpoint to list your businesses:

```
GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{accountId}/locations
```

The API will return your business locations with their IDs.

**Note:** Our app will automatically fetch this for you after OAuth connection!

---

### Method 2: Manual Lookup (If Needed)

1. **Go to Google Business Profile Manager:**
   - Visit: https://business.google.com/

2. **Select your business:**
   - Click on your business listing

3. **Find the ID in the URL:**
   - The URL will look like:
     `https://business.google.com/dashboard/l/12345678901234567890`
   - The number after `/l/` is your **Location ID**
   - Copy this number

**Example:**
- URL: `https://business.google.com/dashboard/l/12345678901234567890`
- Location ID: `12345678901234567890`

---

## Part 3: Configure Your Backend

### Step 1: Add Credentials to `.env`

In your backend folder (`ai-review-responder/backend/`), edit `.env`:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here

# OAuth callback URL (must match Google Console settings)
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# For production, change to:
# GOOGLE_CALLBACK_URL=https://your-backend.railway.app/api/auth/google/callback
```

**⚠️ SECURITY WARNING:**
- **NEVER commit `.env` to git!**
- `.gitignore` already excludes it, but double-check
- Use different credentials for development and production

---

### Step 2: Install Dependencies

Run from the project root:

```bash
cd backend
npm install passport passport-google-oauth20
```

---

## Part 4: Testing Your Setup

### Test OAuth Flow Locally

1. **Start the backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Initiate OAuth:**
   - Open browser: `http://localhost:5000/api/auth/google`
   - You'll be redirected to Google consent screen

3. **Grant Permissions:**
   - Sign in with your Google account
   - Click **"Allow"** to grant access
   - You'll be redirected back to `http://localhost:5000/api/auth/google/callback`

4. **Success Response:**
   - You should see a JSON response with connection details
   - Your access/refresh tokens are now stored (encrypted) in the database

5. **Verify in Database:**
   ```sql
   SELECT * FROM google_connections WHERE user_id = 'your-user-id';
   ```
   - You should see one row with your connection details

---

## Part 5: Troubleshooting

### Error: "Access blocked: This app's request is invalid"

**Solution:**
- Make sure your redirect URI in Google Console exactly matches your backend URL
- Check for typos (http vs https, trailing slashes)

---

### Error: "redirect_uri_mismatch"

**Solution:**
- Your `GOOGLE_CALLBACK_URL` in `.env` doesn't match Google Console
- Update Google Console → Credentials → Edit OAuth Client → Authorized redirect URIs

---

### Error: "insufficient_permissions" or "access_denied"

**Solution:**
- Make sure you added the correct scope: `https://www.googleapis.com/auth/business.manage`
- Try revoking access and re-authorizing: https://myaccount.google.com/permissions

---

### Error: "The app is not verified"

**Expected behavior for development:**
- Google shows a warning screen: "Google hasn't verified this app"
- Click **"Advanced"** → **"Go to AI Review Responder (unsafe)"**
- This is normal for apps in testing mode

**For production:**
- Submit your app for verification (takes 1-2 weeks)
- Or keep it in "Testing" mode and manually add each user

---

### Can't find Business Profile ID?

**Solution:**
- Make sure you have a Google Business Profile set up: https://business.google.com/
- If you just created it, wait 24 hours for it to propagate
- Check if you're an "Owner" (not just "Manager") of the business

---

### Tokens Expire?

**Normal behavior:**
- `access_token` expires after 1 hour
- Our app automatically refreshes it using `refresh_token`
- `refresh_token` lasts until user revokes access

**If refresh fails:**
- User needs to re-authorize via OAuth flow
- We'll show a "Reconnect Google" button in the dashboard

---

## Part 6: Rate Limits & Quotas

Google My Business API has the following limits:

**Free Tier (Sufficient for MVP):**
- **10,000 requests/day** (shared across all API calls)
- **100 requests/minute**

**What counts as a request:**
- Fetching reviews: 1 request
- Posting a response: 1 request
- Listing locations: 1 request

**Our strategy to stay under limits:**
- Cache reviews (only fetch new ones)
- Sync reviews every 4 hours (not every page load)
- Add rate limiting middleware (max 10 requests/minute per user)

**Monitoring:**
- Check quotas: https://console.cloud.google.com/apis/dashboard
- Set up alerts if approaching limits

---

## Part 7: Production Deployment Checklist

When deploying to production:

- [ ] Update `GOOGLE_CALLBACK_URL` to production backend URL
- [ ] Add production URL to Google Console → Authorized redirect URIs
- [ ] Use different OAuth credentials for production (recommended)
- [ ] Set up monitoring for API quota usage
- [ ] Test OAuth flow on production environment
- [ ] Enable Google Cloud billing alerts (to catch unexpected charges)
- [ ] Submit app for verification (if >100 users)

---

## Security Best Practices

1. **Never log tokens:**
   - Don't `console.log()` access_token or refresh_token
   - They're encrypted in database, but plain text in logs is dangerous

2. **Rotate credentials regularly:**
   - Every 90 days, generate new OAuth client credentials
   - Update `.env` and redeploy

3. **Monitor for suspicious activity:**
   - Audit logs track every Google API call
   - Check for unusual patterns (e.g., 1000 review fetches/hour)

4. **Revoke access when user deletes account:**
   - When user clicks "Delete Account," revoke their Google OAuth token
   - API: `https://oauth2.googleapis.com/revoke?token={token}`

---

## Additional Resources

**Google Documentation:**
- Google Business Profile API: https://developers.google.com/my-business/content/overview
- OAuth 2.0: https://developers.google.com/identity/protocols/oauth2
- API Reference: https://developers.google.com/my-business/reference/rest

**Testing Tools:**
- OAuth Playground: https://developers.google.com/oauthplayground/
- API Explorer: https://developers.google.com/my-business/content/reference-rest

**Support:**
- Google Cloud Support: https://cloud.google.com/support
- Stack Overflow: Tag `google-my-business-api`

---

## Summary

✅ **What you should have now:**
- Google Cloud project with Business Profile API enabled
- OAuth 2.0 client credentials (Client ID + Secret)
- Credentials added to backend `.env`
- Understanding of how to test OAuth flow

✅ **Next steps:**
- Start the backend (`npm run dev`)
- Test OAuth flow by visiting `/api/auth/google`
- Fetch your first reviews!

---

**Questions or issues?** Open a GitHub issue or check the troubleshooting section above.

**Last updated:** 2026-02-20
