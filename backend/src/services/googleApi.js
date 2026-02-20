// Google My Business API Service
const axios = require('axios');
const pool = require('../config/database');
const { encryptToken, decryptToken } = require('../utils/encryption');

// Base URL for Google Business Profile API
const GOOGLE_API_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const GOOGLE_REVIEWS_API_BASE = 'https://mybusiness.googleapis.com/v4';

/**
 * Refresh an expired access token using refresh token
 */
async function refreshAccessToken(refreshToken) {
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    console.error('Token refresh failed:', error.response?.data || error.message);
    throw new Error('Failed to refresh access token');
  }
}

/**
 * Get valid access token for a connection (auto-refresh if expired)
 */
async function getValidAccessToken(connectionId) {
  try {
    // Get connection from database
    const result = await pool.query(
      'SELECT access_token, refresh_token, token_expires_at FROM google_connections WHERE id = $1',
      [connectionId]
    );

    if (result.rows.length === 0) {
      throw new Error('Google connection not found');
    }

    const connection = result.rows[0];
    const expiresAt = new Date(connection.token_expires_at);
    const now = new Date();

    // Decrypt current access token
    let accessToken = decryptToken(connection.access_token);

    // Check if token is expired (with 5-minute buffer)
    if (expiresAt < new Date(now.getTime() + 5 * 60 * 1000)) {
      console.log('Access token expired, refreshing...');
      
      // Decrypt refresh token
      const refreshToken = decryptToken(connection.refresh_token);
      
      // Refresh the token
      const { accessToken: newAccessToken, expiresIn } = await refreshAccessToken(refreshToken);
      
      // Update database with new access token
      const newExpiresAt = new Date(now.getTime() + expiresIn * 1000);
      const encryptedNewToken = encryptToken(newAccessToken);
      
      await pool.query(
        'UPDATE google_connections SET access_token = $1, token_expires_at = $2 WHERE id = $3',
        [encryptedNewToken, newExpiresAt, connectionId]
      );

      accessToken = newAccessToken;
    }

    return accessToken;
  } catch (error) {
    console.error('Error getting valid access token:', error.message);
    throw error;
  }
}

/**
 * List all Google Business accounts for the authenticated user
 */
async function listAccounts(accessToken) {
  try {
    const response = await axios.get(`${GOOGLE_API_BASE}/accounts`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data.accounts || [];
  } catch (error) {
    console.error('Error listing accounts:', error.response?.data || error.message);
    throw new Error('Failed to fetch Google Business accounts');
  }
}

/**
 * List all locations (businesses) for a Google Business account
 */
async function listLocations(accessToken, accountId) {
  try {
    const response = await axios.get(`${GOOGLE_API_BASE}/accounts/${accountId}/locations`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        readMask: 'name,title,storeCode' // Only fetch what we need
      }
    });

    return response.data.locations || [];
  } catch (error) {
    console.error('Error listing locations:', error.response?.data || error.message);
    throw new Error('Failed to fetch business locations');
  }
}

/**
 * Fetch reviews for a specific location
 * Handles pagination to get all reviews
 */
async function fetchReviews(connectionId, locationName) {
  try {
    const accessToken = await getValidAccessToken(connectionId);
    
    const reviews = [];
    let pageToken = null;

    // Fetch all pages of reviews
    do {
      const params = {
        pageSize: 50 // Max per page
      };
      
      if (pageToken) {
        params.pageToken = pageToken;
      }

      const response = await axios.get(
        `${GOOGLE_REVIEWS_API_BASE}/${locationName}/reviews`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params
        }
      );

      const data = response.data;
      
      if (data.reviews && data.reviews.length > 0) {
        reviews.push(...data.reviews);
      }

      pageToken = data.nextPageToken;
      
      // Safety check: Don't fetch more than 1000 reviews (rate limiting)
      if (reviews.length >= 1000) {
        console.warn('Reached 1000 review limit, stopping pagination');
        break;
      }
      
    } while (pageToken);

    // Log to audit_logs
    await pool.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4)`,
      [
        'google_fetch_reviews',
        'google_connection',
        connectionId,
        JSON.stringify({ locationName, reviewCount: reviews.length })
      ]
    );

    return reviews;
  } catch (error) {
    console.error('Error fetching reviews:', error.response?.data || error.message);
    
    // Log error to audit_logs
    await pool.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4)`,
      [
        'google_fetch_reviews_error',
        'google_connection',
        connectionId,
        JSON.stringify({ 
          locationName, 
          error: error.response?.data || error.message 
        })
      ]
    );
    
    throw new Error('Failed to fetch reviews from Google');
  }
}

/**
 * Store fetched reviews in database
 * Avoids duplicates using google_review_id
 */
async function storeReviews(connectionId, reviews) {
  try {
    let newCount = 0;
    let updatedCount = 0;

    for (const review of reviews) {
      // Extract review data
      const googleReviewId = review.reviewId || review.name;
      const reviewerName = review.reviewer?.displayName || 'Anonymous';
      const reviewerPhoto = review.reviewer?.profilePhotoUrl || null;
      const rating = review.starRating === 'FIVE' ? 5 :
                     review.starRating === 'FOUR' ? 4 :
                     review.starRating === 'THREE' ? 3 :
                     review.starRating === 'TWO' ? 2 :
                     review.starRating === 'ONE' ? 1 : 3;
      const reviewText = review.comment || null;
      const reviewReply = review.reviewReply?.comment || null;
      const postedAt = new Date(review.createTime);

      // Determine sentiment based on rating
      const sentiment = rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative';

      // Check if already replied
      const isResponded = !!reviewReply;

      // Insert or update
      const result = await pool.query(
        `INSERT INTO reviews 
         (google_connection_id, google_review_id, reviewer_name, reviewer_photo_url, 
          rating, review_text, review_reply, posted_at, sentiment, is_responded)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (google_connection_id, google_review_id) 
         DO UPDATE SET
           reviewer_name = EXCLUDED.reviewer_name,
           reviewer_photo_url = EXCLUDED.reviewer_photo_url,
           rating = EXCLUDED.rating,
           review_text = EXCLUDED.review_text,
           review_reply = EXCLUDED.review_reply,
           is_responded = EXCLUDED.is_responded,
           sentiment = EXCLUDED.sentiment,
           fetched_at = CURRENT_TIMESTAMP
         RETURNING (xmax = 0) AS inserted`,
        [
          connectionId,
          googleReviewId,
          reviewerName,
          reviewerPhoto,
          rating,
          reviewText,
          reviewReply,
          postedAt,
          sentiment,
          isResponded
        ]
      );

      if (result.rows[0].inserted) {
        newCount++;
      } else {
        updatedCount++;
      }
    }

    // Update last_synced_at for the connection
    await pool.query(
      'UPDATE google_connections SET last_synced_at = CURRENT_TIMESTAMP WHERE id = $1',
      [connectionId]
    );

    return { newCount, updatedCount, totalFetched: reviews.length };
  } catch (error) {
    console.error('Error storing reviews:', error.message);
    throw error;
  }
}

module.exports = {
  refreshAccessToken,
  getValidAccessToken,
  listAccounts,
  listLocations,
  fetchReviews,
  storeReviews
};
