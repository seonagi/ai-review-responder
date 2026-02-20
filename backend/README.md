# AI Review Responder - Backend API

**Version:** 1.0.0 (MVP)  
**Framework:** Node.js + Express  
**Database:** PostgreSQL

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (local or cloud)
- Google Cloud OAuth credentials
- OpenAI API key

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

Server runs on: http://localhost:5000

---

## 📦 Environment Variables

See `.env.example` for all required variables.

**Critical variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `OPENAI_API_KEY` - OpenAI API key (for response generation)
- `ENCRYPTION_KEY` - 32-byte hex key for token encryption

---

## 🔌 API Endpoints

### Authentication Routes (`/api/auth`)

#### POST `/api/auth/register`
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

---

#### POST `/api/auth/login`
Authenticate and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2026-02-20T10:00:00Z"
  }
}
```

---

#### GET `/api/auth/me`
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2026-02-20T10:00:00Z"
  }
}
```

---

### Google Integration Routes (`/api/google`)

#### GET `/api/google/connect`
Initiate Google OAuth flow (redirects to Google).

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
Redirects to Google OAuth consent screen.

---

#### GET `/api/google/callback`
OAuth callback (handled automatically by Google).

**Response:**
Redirects to frontend dashboard with connection status.

---

#### GET `/api/google/status`
Get Google connection status for current user.

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "connected": true,
  "businessName": "Joe's Pizza",
  "connectedAt": "2026-02-20T10:15:00Z",
  "lastSyncedAt": "2026-02-20T12:30:00Z",
  "connectionId": "uuid-here"
}
```

---

#### POST `/api/google/disconnect`
Disconnect Google Business account.

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Google Business disconnected"
}
```

---

#### POST `/api/google/sync-reviews`
Fetch latest reviews from Google and store in database.

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Reviews synced successfully",
  "stats": {
    "totalFetched": 25,
    "newReviews": 3,
    "updatedReviews": 2
  }
}
```

---

#### GET `/api/google/reviews`
Get all reviews for the current user.

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Query Parameters:**
- `limit` (optional, default: 50) - Number of reviews to return
- `offset` (optional, default: 0) - Pagination offset
- `rating` (optional) - Filter by rating (1-5)
- `responded` (optional) - Filter by response status (true/false)

**Example:**
```
GET /api/google/reviews?limit=20&offset=0&responded=false
```

**Response:**
```json
{
  "reviews": [
    {
      "id": "uuid-here",
      "google_review_id": "google-id",
      "reviewer_name": "John Smith",
      "reviewer_photo_url": "https://...",
      "rating": 5,
      "review_text": "Great pizza! Loved the margherita.",
      "review_reply": null,
      "posted_at": "2026-02-15T14:30:00Z",
      "is_responded": false,
      "sentiment": "positive",
      "fetched_at": "2026-02-20T12:30:00Z"
    }
  ],
  "total": 25,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}
```

---

### Response Generation Routes (`/api/responses`)

#### POST `/api/responses/generate`
Generate AI response for a specific review.

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Request:**
```json
{
  "reviewId": "uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "response": {
    "id": "uuid-here",
    "response_text": "Thanks so much, John! We're glad you enjoyed the margherita. Hope to see you again soon!",
    "generated_at": "2026-02-20T14:30:00Z",
    "status": "draft"
  },
  "rateLimit": {
    "remaining": 9
  }
}
```

**Error (Already Exists):**
```json
{
  "alreadyExists": true,
  "response": {
    "id": "uuid-here",
    "response_text": "...",
    "status": "draft"
  },
  "message": "This review already has a generated response"
}
```

**Error (Rate Limit):**
```json
{
  "error": "Rate limit exceeded",
  "message": "Please wait 45 seconds before generating more responses",
  "retryAfter": 45
}
```

---

#### PUT `/api/responses/:id`
Edit a draft response.

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Request:**
```json
{
  "responseText": "Updated response text here..."
}
```

**Response:**
```json
{
  "success": true,
  "response": {
    "id": "uuid-here",
    "response_text": "Updated response text here...",
    "generated_at": "2026-02-20T14:30:00Z",
    "status": "draft"
  }
}
```

**Error (Cannot Edit Posted):**
```json
{
  "error": "Cannot edit posted response",
  "message": "Only draft responses can be edited"
}
```

---

#### POST `/api/responses/:id/approve`
Approve and post response to Google.

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Response posted to Google successfully",
  "response": {
    "id": "uuid-here",
    "status": "posted",
    "postedAt": "2026-02-20T14:35:00Z"
  }
}
```

**Error (Already Replied):**
```json
{
  "error": "Review already has a reply",
  "message": "This review already has a reply on Google"
}
```

**Error (Auth Expired):**
```json
{
  "error": "Google authentication expired",
  "message": "Please reconnect your Google Business account",
  "reconnectNeeded": true
}
```

---

#### DELETE `/api/responses/:id`
Delete a draft response.

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Response deleted successfully"
}
```

**Error (Cannot Delete Posted):**
```json
{
  "error": "Cannot delete posted response",
  "message": "Only draft responses can be deleted"
}
```

---

#### GET `/api/responses/:reviewId`
Get response for a specific review.

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "response": {
    "id": "uuid-here",
    "response_text": "Thanks for your review!",
    "generated_at": "2026-02-20T14:30:00Z",
    "approved_at": "2026-02-20T14:32:00Z",
    "posted_at": "2026-02-20T14:32:00Z",
    "status": "posted"
  }
}
```

---

## 🔐 Authentication

All protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token lifetime:** 24 hours (configurable)

**How to get a token:**
1. Register: `POST /api/auth/register`
2. Login: `POST /api/auth/login`
3. Store token in localStorage
4. Include in all subsequent requests

---

## 🚨 Error Responses

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "User-friendly error message"
}
```

**Common HTTP status codes:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate resource
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## 🧪 Testing

**Run tests:**
```bash
npm test
```

**Test coverage:**
```bash
npm run coverage
```

**Manual testing:**
See `TESTING-PHASE3.md` for comprehensive test cases.

---

## 📊 Database Schema

See `database-schema.sql` for complete schema.

**Key tables:**
- `users` - User accounts
- `google_connections` - Google Business OAuth connections
- `reviews` - Reviews from Google My Business
- `responses` - AI-generated responses (draft/posted)
- `brand_voices` - User brand voice preferences
- `audit_logs` - Audit trail

---

## 🔒 Security

**Implemented:**
- ✅ JWT authentication on all protected endpoints
- ✅ Bcrypt password hashing
- ✅ SQL injection prevention (parameterized queries)
- ✅ AES-256-GCM token encryption
- ✅ CORS configuration
- ✅ Helmet.js security headers
- ✅ Rate limiting on expensive operations
- ✅ Input validation
- ✅ Audit logging

**Best practices:**
- Never commit `.env` file
- Rotate JWT secret regularly
- Use strong passwords
- Keep dependencies updated
- Monitor audit logs

---

## 🚀 Deployment

**Production checklist:**
- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT_SECRET
- [ ] Configure CORS for production domain
- [ ] Set up database backups
- [ ] Enable SSL/TLS
- [ ] Configure monitoring (Sentry, etc.)
- [ ] Set up CI/CD pipeline
- [ ] Review rate limits
- [ ] Test error handling

**Recommended hosts:**
- Backend: Railway, Render, Fly.io
- Database: Neon.tech, Supabase
- Monitoring: Sentry, LogRocket

---

## 📞 Support

**Issues:**
- GitHub Issues: [Repository link]
- Email: support@aireviewresponder.com

**Documentation:**
- API docs: This file
- Testing: TESTING-PHASE3.md
- Phase docs: PHASE-3-AI-RESPONSES.md

---

**Built with ❤️ by Autonomous Product Team**

**Version:** 1.0.0 (MVP)  
**Last updated:** 2026-02-20
