# AI Review Responder

AI-powered review response generator for small businesses. Respond to Google reviews in seconds, not hours.

## 🚀 Quick Start (Local Development)

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database (free options: [Neon](https://neon.tech), [Supabase](https://supabase.com))
- Git

### 1. Clone Repository

```bash
git clone https://github.com/[your-username]/ai-review-responder.git
cd ai-review-responder
```

### 2. Set Up Backend

```bash
cd backend
npm install
```

Create `backend/.env` from the example:

```bash
cp .env.example .env
```

Edit `backend/.env` and fill in:
- `DATABASE_URL` - Your PostgreSQL connection string (from Neon/Supabase)
- `JWT_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Run database migrations:

```bash
npm run migrate
```

Start backend server:

```bash
npm run dev
```

Backend will run on http://localhost:5000

### 3. Set Up Frontend

Open a new terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```bash
cp .env.example .env.local
```

No changes needed for local development (uses http://localhost:5000 by default).

Start frontend:

```bash
npm run dev
```

Frontend will run on http://localhost:3000

### 4. Test It Out

1. Visit http://localhost:3000
2. Click "Sign Up" and create an account
3. Log in with your credentials
4. You'll see the dashboard (Phase 2 & 3 features coming soon!)

## 📁 Project Structure

```
ai-review-responder/
├── backend/              # Node.js/Express API
│   ├── src/
│   │   ├── routes/      # API routes (auth, reviews, etc.)
│   │   ├── middleware/  # Auth, error handling
│   │   ├── config/      # Database connection
│   │   └── server.js    # Express app entry point
│   ├── scripts/
│   │   └── migrate.js   # Database migration script
│   └── package.json
├── frontend/             # Next.js React app
│   ├── app/             # Pages (Next.js App Router)
│   │   ├── page.tsx     # Landing page
│   │   ├── login/       # Login page
│   │   ├── signup/      # Signup page
│   │   └── dashboard/   # Dashboard (protected)
│   ├── components/      # Reusable React components
│   ├── lib/             # API client, utilities
│   └── package.json
├── shared/              # Shared types/utilities (future)
└── database-schema.sql  # PostgreSQL schema
```

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 14 (React)
- **Styling:** Tailwind CSS
- **Language:** TypeScript
- **Hosting:** Vercel (free tier)

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Auth:** JWT + bcrypt
- **Hosting:** Railway (free tier)

### Database
- **PostgreSQL** (Neon or Supabase free tier)
- Production-ready schema with indexes, foreign keys, audit logging

## 📊 Database Schema

### Users
- Authentication (email/password with bcrypt)
- JWT token-based sessions

### Google Connections (Phase 2)
- OAuth tokens for Google My Business
- Business metadata

### Reviews (Phase 2)
- Imported from Google My Business API
- Sentiment analysis, ratings

### Responses (Phase 3)
- AI-generated responses
- Approval workflow (draft → approved → posted)

### Brand Voices (Phase 3)
- Custom tone/style profiles for AI
- Example responses for training

See `database-schema.sql` for full schema.

## 🗺️ Development Phases

### ✅ Phase 1: Foundation (Complete)
- [x] User registration/login (JWT auth)
- [x] Database schema designed
- [x] Basic frontend UI (landing, login, signup, dashboard)
- [x] Backend API foundation (Express, CORS, error handling)
- [x] PostgreSQL integration

### 🚧 Phase 2: Google Integration (Next)
- [ ] Google My Business OAuth flow
- [ ] Fetch reviews from Google API
- [ ] Store reviews in database
- [ ] Display reviews in dashboard

### 🔮 Phase 3: AI Responses (Future)
- [ ] OpenAI GPT-4 integration
- [ ] Generate AI responses
- [ ] Approval workflow UI
- [ ] Post responses to Google
- [ ] Brand voice training

## 🚀 Deployment

### Backend (Railway)

1. Create a Railway account (free tier)
2. Create new project → Add PostgreSQL plugin
3. Connect GitHub repository
4. Set environment variables in Railway dashboard
5. Deploy!

Railway automatically detects Node.js and runs `npm start`.

### Frontend (Vercel)

1. Create a Vercel account (free tier)
2. Import GitHub repository
3. Set `NEXT_PUBLIC_API_URL` to your Railway backend URL
4. Deploy!

Vercel automatically detects Next.js.

### Database (Neon - Recommended)

1. Sign up at [neon.tech](https://neon.tech)
2. Create new project (0.5GB free)
3. Copy connection string
4. Run migrations: `npm run migrate` (from backend/)

## 📝 API Documentation

### Authentication

**POST** `/api/auth/register`
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}
```

**POST** `/api/auth/login`
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**GET** `/api/auth/me` (requires JWT token)
- Header: `Authorization: Bearer <token>`

## 🐛 Troubleshooting

### Backend won't start
- Check `DATABASE_URL` is correct in `backend/.env`
- Make sure PostgreSQL database is accessible
- Run `npm run migrate` to create tables

### Frontend can't connect to backend
- Check `NEXT_PUBLIC_API_URL` in `frontend/.env.local`
- Make sure backend is running on port 5000
- Check CORS settings in `backend/src/server.js`

### Database migration fails
- Ensure database exists (Neon creates it automatically)
- Check PostgreSQL version (needs 12+)
- Verify UUID extension is supported

## 📈 Performance & Costs

### Current (MVP Phase 1)
- **Cost:** £0/month (all free tiers)
- **Capacity:** ~10 users, 1000 reviews/month
- **Response time:** <500ms average

### Production (Phase 3)
- **Estimated cost:** £30-50/month
  - Neon Pro: £10/month (1GB database)
  - Railway: £10/month (backend hosting)
  - OpenAI API: £20-30/month (GPT-4 calls)
- **Capacity:** 500+ users, 50K reviews/month

## 🔒 Security

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens expire after 7 days
- CORS configured for frontend domain only
- Helmet.js for security headers
- Input validation on all endpoints
- SQL injection protection (parameterized queries)
- Audit logging for compliance

## 🧪 Testing

*Tests not yet implemented (Phase 1 MVP)*

Planned for Phase 2:
- Unit tests (Jest)
- Integration tests (Supertest for API)
- E2E tests (Playwright for frontend)

## 🤝 Contributing

This is an autonomous product experiment. Development is primarily automated.

For issues or suggestions:
1. Check existing issues
2. Create detailed bug report or feature request
3. Wait for Product Manager assessment

## 📄 License

MIT License - see LICENSE file for details

## 📞 Support

- **Email:** support@aireviewresponder.com (coming soon)
- **Documentation:** (coming soon)
- **GitHub Issues:** For bug reports

## 🏗️ Built With

- Love ❤️
- Coffee ☕
- AI assistance 🤖
- Open source tools 🛠️

---

**Status:** Phase 1 Complete ✅  
**Next milestone:** Google OAuth integration (Phase 2)  
**Last updated:** 2026-02-20
