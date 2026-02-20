# Production Deployment Guide

**Automated deployment ready!** Follow these steps in order.

---

## Step 1: Supabase Database Setup (5 minutes)

### Actions Required:
1. **Go to:** https://supabase.com/dashboard
2. **Click:** "New project"
3. **Settings:**
   - Name: `AI Review Responder`
   - Database Password: (generate strong password - save it!)
   - Region: Choose closest to UK
   - Pricing: Free tier ✅

4. **Wait ~2 minutes** for project to be ready

5. **Get connection string:**
   - Go to: Project Settings → Database
   - Find: "Connection string" → "URI"
   - Copy the full string (looks like: `postgresql://postgres:[YOUR-PASSWORD]@...`)

6. **Run database migration:**
   - Go to: SQL Editor (left sidebar)
   - Click "New query"
   - Paste the contents of `backend/migrations/schema.sql` (see below)
   - Click "Run"

### Migration SQL (copy this):
```sql
-- Run this in Supabase SQL Editor

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE google_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expiry TIMESTAMP,
    business_id VARCHAR(255),
    business_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_connection_id UUID NOT NULL REFERENCES google_connections(id) ON DELETE CASCADE,
    google_review_id VARCHAR(255) UNIQUE,
    reviewer_name VARCHAR(255),
    reviewer_profile_photo TEXT,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    review_reply TEXT,
    posted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,
    approved_by_user BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE brand_voices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tone VARCHAR(50) DEFAULT 'professional',
    examples TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_google_connections_user_id ON google_connections(user_id);
CREATE INDEX idx_reviews_google_connection_id ON reviews(google_connection_id);
CREATE INDEX idx_responses_review_id ON responses(review_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

**✅ SAVE THE DATABASE_URL** - you'll need it for Railway!

---

## Step 2: Railway Backend Deployment (3 minutes)

### Actions Required:
1. **Go to:** https://railway.app/
2. **Sign in** with GitHub
3. **Click:** "New Project"
4. **Select:** "Deploy from GitHub repo"
5. **Choose:** `seonagi/ai-review-responder`
6. **Root directory:** Set to `backend`

7. **Add environment variables:**
   Click "Variables" tab and add these:

   **I'll provide these values via Telegram - don't hardcode secrets in docs!**

   ```
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=<paste from Supabase>
   JWT_SECRET=<I'll send this>
   ENCRYPTION_KEY=<I'll send this>
   FRONTEND_URL=https://ai-review-responder.vercel.app
   GOOGLE_CLIENT_ID=<from your OAuth client>
   GOOGLE_CLIENT_SECRET=<from your OAuth client>
   GOOGLE_CALLBACK_URL=https://your-backend-url.railway.app/api/auth/google/callback
   OPENAI_API_KEY=<your OpenAI key>
   OPENAI_MODEL=gpt-3.5-turbo
   ```

8. **Click:** "Deploy"

9. **Get your backend URL:**
   - After deploy finishes (~2min), click "Settings"
   - Under "Domains", copy the Railway URL (e.g., `your-backend-name.up.railway.app`)

10. **Update GOOGLE_CALLBACK_URL:**
    - Go back to "Variables"
    - Update `GOOGLE_CALLBACK_URL` to: `https://your-backend-name.up.railway.app/api/auth/google/callback`
    - Redeploy (automatic)

**✅ SAVE THE BACKEND_URL** - you'll need it for Vercel and Google!

---

## Step 3: Update Google OAuth Redirect URI (1 minute)

### Actions Required:
1. **Go to:** https://console.cloud.google.com/apis/credentials
2. **Select:** Moltbot Project
3. **Click:** "AI Review Responder OAuth" (the OAuth client you just created)
4. **Authorized redirect URIs:**
   - **Add:** `https://your-backend-name.up.railway.app/api/auth/google/callback`
   - **Keep:** `http://localhost:5000/api/auth/google/callback` (for local dev)
5. **Click:** "Save"

---

## Step 4: Vercel Frontend Deployment (2 minutes)

### Actions Required:
1. **Go to:** https://vercel.com/
2. **Click:** "Add New" → "Project"
3. **Import:** `seonagi/ai-review-responder`
4. **Root directory:** Set to `frontend`
5. **Framework preset:** Next.js (should auto-detect)

6. **Environment variables:**
   Add this one variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-name.up.railway.app
   ```

7. **Click:** "Deploy"

8. **Get your frontend URL:**
   - After deploy (~2min), you'll see: `ai-review-responder.vercel.app` (or similar)

9. **Update Railway FRONTEND_URL:**
   - Go back to Railway → Variables
   - Update `FRONTEND_URL` to your Vercel URL
   - Redeploy

---

## Step 5: Test the Deployment (2 minutes)

### Actions Required:
1. **Visit:** `https://ai-review-responder.vercel.app`
2. **Register** a test account
3. **Log in**
4. **Click:** "Connect Google Business"
5. **Complete OAuth flow**
6. **Verify:** Reviews sync

**If it works → YOU'RE DONE!** ✅

---

## What I've Automated

✅ Generated secure secrets (JWT, encryption)  
✅ Created deployment configs (Railway, Vercel)  
✅ Prepared database migration SQL  
✅ Set up GitHub repo  
✅ Documented exact deployment steps

---

## What You Need to Do

1. ⏳ Create Supabase project (5 min)
2. ⏳ Deploy backend to Railway (3 min)
3. ⏳ Update Google OAuth redirect (1 min)
4. ⏳ Deploy frontend to Vercel (2 min)
5. ✅ Test the live product!

**Total time: ~15 minutes**  
**Result: Fully deployed, production-ready MVP**

---

## Need Help?

If you hit any blockers:
1. Screenshot the error
2. Send it to me
3. I'll debug and provide exact fix

---

**Let's ship this!** 🚀
