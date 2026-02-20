# Quick Start: Phase 3 Testing

**⏱️ Total setup time: ~5 minutes**

---

## 🎯 Prerequisites

You must have completed Phases 1 & 2:
- ✅ Database set up
- ✅ User registered
- ✅ Google Business connected
- ✅ Reviews synced

---

## 🔧 Add OpenAI API Key

### 1. Get OpenAI API Key

1. Visit: https://platform.openai.com/api-keys
2. Sign in (or create account)
3. Click "Create new secret key"
4. Name it: "AI Review Responder Dev"
5. Copy the key (starts with `sk-proj-` or `sk-`)

**Note:** Free tier includes $5 credit (enough for ~2,500 responses)

### 2. Add to Backend Environment

Edit `backend/.env`:

```bash
# Add this line (replace with your actual key)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx

# Optional: Choose model (default: gpt-3.5-turbo)
OPENAI_MODEL=gpt-3.5-turbo
```

**Save the file.**

### 3. Restart Backend Server

```bash
# Stop the current backend server (Ctrl+C)
# Start it again
cd ~/clawd/autonomous-product-teams/products/ai-review-responder/ai-review-responder/backend
npm run dev
```

**Verify:** Server should start without errors.

---

## 🧪 Test AI Response Generation

### Quick Test (2 minutes)

1. **Open dashboard:** http://localhost:3000/dashboard
2. **Log in** with your test account
3. **Find a review** (any rating)
4. **Click "✨ Generate AI Response"**
5. **Wait 2-3 seconds**
6. **Review the AI response**

**Expected:**
- Purple box appears with AI-generated response
- Response is personalized (uses reviewer name)
- Response matches review sentiment
- Response is 2-4 sentences

### Test Edit Workflow (1 minute)

1. **Click "✏️ Edit"**
2. **Modify the text** (add/remove a sentence)
3. **Click "💾 Save"**
4. **Verify:** Edited text is displayed

### Test Post to Google (1 minute)

1. **Click "✅ Approve & Post to Google"**
2. **Confirm** in dialog
3. **Wait ~2 seconds**
4. **Verify:**
   - Status changes to "Posted"
   - "Responded" badge appears
   - Stats update

5. **Check Google:** Open Google Business Profile → Find review → See response

---

## ✅ Success Checklist

Phase 3 is working if:
- [ ] Generate button works (no errors)
- [ ] AI response appears in <5 seconds
- [ ] Response quality is good (natural, not robotic)
- [ ] Edit workflow works
- [ ] Post to Google succeeds
- [ ] Response visible on Google within 30 seconds

---

## 🐛 Common Issues

### "OpenAI API not configured"
**Fix:** Add `OPENAI_API_KEY` to `backend/.env` and restart server

### "Failed to generate response"
**Fix:** Check backend logs for error details

### "Rate limit exceeded"
**Fix:** Wait 60 seconds (10 requests/minute limit)

### "Google authentication expired"
**Fix:** Disconnect and reconnect Google Business account

---

## 📊 What to Test

**Different review types:**
1. 5-star review (positive)
2. 3-star review (mixed)
3. 1-star review (negative)
4. Review with no text (rating only)
5. Long review (multiple paragraphs)

**Verify AI adjusts tone appropriately.**

---

## 🚀 Next Steps

Once basic testing passes:
1. Run full test suite (see `TESTING-PHASE3.md`)
2. Test error scenarios
3. Deploy to staging
4. Prepare for beta users

---

## 📞 Need Help?

**Check documentation:**
- `PHASE-3-AI-RESPONSES.md` - Implementation details
- `TESTING-PHASE3.md` - Comprehensive test cases
- `backend/README.md` - API documentation

**Common error messages are user-friendly and actionable.**

---

**Happy testing! 🎉**

Phase 3 delivers the core AI magic. You should see genuinely human-sounding responses that save 95%+ of manual writing time.
