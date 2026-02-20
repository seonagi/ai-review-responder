// Response Management Routes
// Handles AI response generation, editing, approval, and posting
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { generateResponse, checkRateLimit, hasValidApiKey } = require('../services/openaiService');
const { postReviewReply } = require('../services/googleApi');

/**
 * POST /api/responses/generate
 * Generate an AI response for a specific review
 * Protected: Requires authentication
 */
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { reviewId } = req.body;
    
    if (!reviewId) {
      return res.status(400).json({ error: 'Review ID is required' });
    }

    // Check if OpenAI API key is configured
    if (!hasValidApiKey()) {
      return res.status(500).json({ 
        error: 'OpenAI API not configured',
        message: 'Please add OPENAI_API_KEY to environment variables'
      });
    }

    // Rate limiting check
    const rateLimit = checkRateLimit(req.user.id);
    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: `Please wait ${rateLimit.retryAfter} seconds before generating more responses`,
        retryAfter: rateLimit.retryAfter
      });
    }

    // Fetch the review (and verify it belongs to this user)
    const reviewResult = await pool.query(
      `SELECT r.*, gc.user_id
       FROM reviews r
       JOIN google_connections gc ON r.google_connection_id = gc.id
       WHERE r.id = $1`,
      [reviewId]
    );

    if (reviewResult.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const review = reviewResult.rows[0];

    // Verify ownership
    if (review.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if review already has a response (draft or posted)
    const existingResponseResult = await pool.query(
      `SELECT id, response_text, status
       FROM responses
       WHERE review_id = $1`,
      [reviewId]
    );

    if (existingResponseResult.rows.length > 0) {
      const existingResponse = existingResponseResult.rows[0];
      return res.status(200).json({
        alreadyExists: true,
        response: existingResponse,
        message: 'This review already has a generated response'
      });
    }

    // Fetch user's brand voice (if configured)
    const brandVoiceResult = await pool.query(
      `SELECT tone, custom_instructions, example_responses
       FROM brand_voices
       WHERE user_id = $1 AND is_active = TRUE
       LIMIT 1`,
      [req.user.id]
    );

    const brandVoice = brandVoiceResult.rows.length > 0 ? brandVoiceResult.rows[0] : null;

    // Generate AI response
    const aiResult = await generateResponse(review, brandVoice);

    // Store the generated response in database
    const insertResult = await pool.query(
      `INSERT INTO responses 
       (review_id, response_text, ai_model, generation_params, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, response_text, generated_at, status`,
      [
        reviewId,
        aiResult.text,
        aiResult.model,
        JSON.stringify({ 
          tokens: aiResult.tokens,
          finishReason: aiResult.finishReason,
          brandVoiceTone: brandVoice?.tone || 'default'
        }),
        'draft'
      ]
    );

    const response = insertResult.rows[0];

    // Log to audit_logs
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'response_generated',
        'response',
        response.id,
        JSON.stringify({ 
          reviewId,
          model: aiResult.model,
          tokens: aiResult.tokens 
        })
      ]
    );

    res.json({
      success: true,
      response,
      rateLimit: {
        remaining: rateLimit.remaining
      }
    });
  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      message: error.message 
    });
  }
});

/**
 * PUT /api/responses/:id
 * Edit a draft response
 * Protected: Requires authentication
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { responseText } = req.body;

    if (!responseText || responseText.trim().length === 0) {
      return res.status(400).json({ error: 'Response text is required' });
    }

    // Fetch the response and verify ownership
    const responseResult = await pool.query(
      `SELECT r.id, r.response_text AS original_text, r.status, rv.id AS review_id, gc.user_id
       FROM responses r
       JOIN reviews rv ON r.review_id = rv.id
       JOIN google_connections gc ON rv.google_connection_id = gc.id
       WHERE r.id = $1`,
      [id]
    );

    if (responseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Response not found' });
    }

    const response = responseResult.rows[0];

    if (response.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (response.status !== 'draft') {
      return res.status(400).json({ 
        error: 'Cannot edit posted response',
        message: 'Only draft responses can be edited'
      });
    }

    // Update the response
    const updateResult = await pool.query(
      `UPDATE responses
       SET response_text = $1, user_edits = $2
       WHERE id = $3
       RETURNING id, response_text, generated_at, status`,
      [responseText.trim(), response.original_text, id]
    );

    // Log to audit_logs
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'response_edited', 'response', id, JSON.stringify({ reviewId: response.review_id })]
    );

    res.json({
      success: true,
      response: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Error updating response:', error);
    res.status(500).json({ error: 'Failed to update response' });
  }
});

/**
 * POST /api/responses/:id/approve
 * Approve and post a response to Google
 * Protected: Requires authentication
 */
router.post('/:id/approve', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Fetch the response with all necessary data
    const responseResult = await client.query(
      `SELECT 
         r.id AS response_id,
         r.response_text,
         r.status,
         rv.id AS review_id,
         rv.google_review_id,
         gc.id AS connection_id,
         gc.google_business_id,
         gc.user_id
       FROM responses r
       JOIN reviews rv ON r.review_id = rv.id
       JOIN google_connections gc ON rv.google_connection_id = gc.id
       WHERE r.id = $1`,
      [id]
    );

    if (responseResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Response not found' });
    }

    const response = responseResult.rows[0];

    if (response.user_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }

    if (response.status === 'posted') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Response already posted',
        message: 'This response has already been posted to Google'
      });
    }

    // Post the response to Google My Business
    try {
      await postReviewReply(
        response.connection_id,
        response.google_business_id,
        response.google_review_id,
        response.response_text
      );
    } catch (googleError) {
      await client.query('ROLLBACK');
      
      console.error('Google API error:', googleError);
      
      // Handle specific Google API errors
      if (googleError.message.includes('already replied')) {
        return res.status(400).json({ 
          error: 'Review already has a reply',
          message: 'This review already has a reply on Google'
        });
      }
      
      if (googleError.message.includes('not found')) {
        return res.status(404).json({ 
          error: 'Review not found on Google',
          message: 'This review may have been deleted'
        });
      }

      if (googleError.message.includes('token') || googleError.message.includes('auth')) {
        return res.status(401).json({ 
          error: 'Google authentication expired',
          message: 'Please reconnect your Google Business account',
          reconnectNeeded: true
        });
      }
      
      throw googleError;
    }

    // Update response status to posted
    await client.query(
      `UPDATE responses
       SET status = $1, approved_at = CURRENT_TIMESTAMP, posted_at = CURRENT_TIMESTAMP, approved_by_user_id = $2
       WHERE id = $3`,
      ['posted', req.user.id, id]
    );

    // Update review as responded
    await client.query(
      `UPDATE reviews
       SET is_responded = TRUE, review_reply = $1
       WHERE id = $2`,
      [response.response_text, response.review_id]
    );

    // Log to audit_logs
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'response_posted',
        'response',
        id,
        JSON.stringify({ 
          reviewId: response.review_id,
          googleReviewId: response.google_review_id
        })
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Response posted to Google successfully',
      response: {
        id,
        status: 'posted',
        postedAt: new Date()
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving response:', error);
    res.status(500).json({ 
      error: 'Failed to post response',
      message: error.message 
    });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/responses/:id
 * Delete a draft response
 * Protected: Requires authentication
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the response and verify ownership
    const responseResult = await pool.query(
      `SELECT r.id, r.status, gc.user_id
       FROM responses r
       JOIN reviews rv ON r.review_id = rv.id
       JOIN google_connections gc ON rv.google_connection_id = gc.id
       WHERE r.id = $1`,
      [id]
    );

    if (responseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Response not found' });
    }

    const response = responseResult.rows[0];

    if (response.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (response.status !== 'draft') {
      return res.status(400).json({ 
        error: 'Cannot delete posted response',
        message: 'Only draft responses can be deleted'
      });
    }

    // Delete the response
    await pool.query('DELETE FROM responses WHERE id = $1', [id]);

    // Log to audit_logs
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'response_deleted', 'response', id, JSON.stringify({})]
    );

    res.json({
      success: true,
      message: 'Response deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting response:', error);
    res.status(500).json({ error: 'Failed to delete response' });
  }
});

/**
 * GET /api/responses/:reviewId
 * Get response for a specific review
 * Protected: Requires authentication
 */
router.get('/:reviewId', authMiddleware, async (req, res) => {
  try {
    const { reviewId } = req.params;

    const result = await pool.query(
      `SELECT r.id, r.response_text, r.generated_at, r.approved_at, r.posted_at, r.status
       FROM responses r
       JOIN reviews rv ON r.review_id = rv.id
       JOIN google_connections gc ON rv.google_connection_id = gc.id
       WHERE r.review_id = $1 AND gc.user_id = $2`,
      [reviewId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Response not found' });
    }

    res.json({ response: result.rows[0] });
  } catch (error) {
    console.error('Error fetching response:', error);
    res.status(500).json({ error: 'Failed to fetch response' });
  }
});

module.exports = router;
