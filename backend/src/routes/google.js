// Google OAuth and Review Management Routes
const express = require('express');
const passport = require('passport');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { encryptToken } = require('../utils/encryption');
const { 
  listAccounts, 
  listLocations, 
  fetchReviews, 
  storeReviews 
} = require('../services/googleApi');

/**
 * GET /api/google/connect
 * Initiate Google OAuth flow
 * Protected: Requires authentication
 */
router.get('/connect', authMiddleware, (req, res, next) => {
  // Store user ID in session state (we'll retrieve it in callback)
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');
  
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/business.manage'
    ],
    accessType: 'offline',
    prompt: 'consent',
    state
  })(req, res, next);
});

/**
 * GET /api/google/callback
 * OAuth callback handler
 * Public (Google redirects here)
 */
router.get('/callback', 
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?error=oauth_failed`
  }),
  async (req, res) => {
    try {
      // Extract state to get user ID
      const state = req.query.state;
      if (!state) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?error=invalid_state`);
      }

      const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
      
      const { accessToken, refreshToken } = req.user;

      if (!accessToken || !refreshToken) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?error=missing_tokens`);
      }

      // Fetch user's Google Business accounts
      const accounts = await listAccounts(accessToken);
      
      if (accounts.length === 0) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?error=no_business_account`);
      }

      // Get first account (most users have only one)
      const account = accounts[0];
      const accountId = account.name; // Format: accounts/123456789

      // Fetch locations for this account
      const locations = await listLocations(accessToken, accountId);
      
      if (locations.length === 0) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?error=no_locations`);
      }

      // For now, connect the first location (we can add multi-location support later)
      const location = locations[0];
      const locationId = location.name; // Format: accounts/123/locations/456
      const businessName = location.title || 'My Business';

      // Encrypt tokens before storing
      const encryptedAccessToken = encryptToken(accessToken);
      const encryptedRefreshToken = encryptToken(refreshToken);

      // Calculate token expiry (Google tokens typically last 1 hour)
      const expiresAt = new Date(Date.now() + 3600 * 1000);

      // Store connection in database (or update if exists)
      const result = await pool.query(
        `INSERT INTO google_connections 
         (user_id, google_business_id, business_name, access_token, refresh_token, token_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, google_business_id)
         DO UPDATE SET
           access_token = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token,
           token_expires_at = EXCLUDED.token_expires_at,
           is_active = TRUE,
           connected_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [userId, locationId, businessName, encryptedAccessToken, encryptedRefreshToken, expiresAt]
      );

      const connectionId = result.rows[0].id;

      // Log to audit_logs
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'google_oauth_connected', 'google_connection', connectionId, 
         JSON.stringify({ businessName, locationId })]
      );

      // Redirect to dashboard with success
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?google_connected=true`);
    } catch (error) {
      console.error('OAuth callback error:', error);
      
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?error=connection_failed`);
    }
  }
);

/**
 * GET /api/google/status
 * Get Google connection status for current user
 * Protected: Requires authentication
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, business_name, connected_at, last_synced_at, is_active
       FROM google_connections
       WHERE user_id = $1 AND is_active = TRUE
       ORDER BY connected_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({ connected: false });
    }

    const connection = result.rows[0];
    
    res.json({
      connected: true,
      businessName: connection.business_name,
      connectedAt: connection.connected_at,
      lastSyncedAt: connection.last_synced_at,
      connectionId: connection.id
    });
  } catch (error) {
    console.error('Error fetching Google status:', error);
    res.status(500).json({ error: 'Failed to fetch connection status' });
  }
});

/**
 * POST /api/google/disconnect
 * Disconnect Google Business account
 * Protected: Requires authentication
 */
router.post('/disconnect', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      `UPDATE google_connections 
       SET is_active = FALSE
       WHERE user_id = $1`,
      [req.user.id]
    );

    // Log to audit_logs
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type)
       VALUES ($1, $2, $3)`,
      [req.user.id, 'google_oauth_disconnected', 'google_connection']
    );

    res.json({ success: true, message: 'Google Business disconnected' });
  } catch (error) {
    console.error('Error disconnecting Google:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

/**
 * POST /api/google/sync-reviews
 * Fetch latest reviews from Google and store in database
 * Protected: Requires authentication
 */
router.post('/sync-reviews', authMiddleware, async (req, res) => {
  try {
    // Get user's active Google connection
    const connectionResult = await pool.query(
      `SELECT id, google_business_id, business_name
       FROM google_connections
       WHERE user_id = $1 AND is_active = TRUE
       LIMIT 1`,
      [req.user.id]
    );

    if (connectionResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No Google connection found',
        message: 'Please connect your Google Business account first'
      });
    }

    const connection = connectionResult.rows[0];
    const { id: connectionId, google_business_id: locationName } = connection;

    // Fetch reviews from Google
    const reviews = await fetchReviews(connectionId, locationName);

    // Store reviews in database
    const { newCount, updatedCount, totalFetched } = await storeReviews(connectionId, reviews);

    res.json({
      success: true,
      message: 'Reviews synced successfully',
      stats: {
        totalFetched,
        newReviews: newCount,
        updatedReviews: updatedCount
      }
    });
  } catch (error) {
    console.error('Error syncing reviews:', error);
    
    // Check if it's a token error
    if (error.message.includes('token') || error.message.includes('auth')) {
      return res.status(401).json({ 
        error: 'Authentication error',
        message: 'Please reconnect your Google Business account',
        reconnectNeeded: true
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to sync reviews',
      message: error.message 
    });
  }
});

/**
 * GET /api/google/reviews
 * Get all reviews for the current user
 * Protected: Requires authentication
 * Query params: ?limit=50&offset=0&rating=5&responded=false
 */
router.get('/reviews', authMiddleware, async (req, res) => {
  try {
    // Get user's active Google connection
    const connectionResult = await pool.query(
      `SELECT id FROM google_connections
       WHERE user_id = $1 AND is_active = TRUE
       LIMIT 1`,
      [req.user.id]
    );

    if (connectionResult.rows.length === 0) {
      return res.json({ reviews: [], total: 0 });
    }

    const connectionId = connectionResult.rows[0].id;

    // Build query with filters
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const rating = req.query.rating ? parseInt(req.query.rating) : null;
    const responded = req.query.responded === 'true' ? true : 
                      req.query.responded === 'false' ? false : null;

    let whereClause = 'WHERE google_connection_id = $1';
    const params = [connectionId];
    let paramIndex = 2;

    if (rating !== null) {
      whereClause += ` AND rating = $${paramIndex}`;
      params.push(rating);
      paramIndex++;
    }

    if (responded !== null) {
      whereClause += ` AND is_responded = $${paramIndex}`;
      params.push(responded);
      paramIndex++;
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM reviews ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get reviews with pagination
    params.push(limit, offset);
    const reviewsResult = await pool.query(
      `SELECT 
         id, google_review_id, reviewer_name, reviewer_photo_url,
         rating, review_text, review_reply, posted_at, 
         is_responded, sentiment, fetched_at
       FROM reviews
       ${whereClause}
       ORDER BY posted_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    res.json({
      reviews: reviewsResult.rows,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

module.exports = router;
