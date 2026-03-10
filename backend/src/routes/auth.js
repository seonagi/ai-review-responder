// Authentication routes
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const db = require('../config/database');
const { validate } = require('../utils/validation');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// Register new user
router.post('/register', registerValidation, validate, async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const saltRounds = 12; // Higher = more secure but slower
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, email_verified, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, created_at`,
      [email, passwordHash, name || null, false, true]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // Token valid for 7 days
    );

    // Log registration
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, details)
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'register', 'user', JSON.stringify({ email: user.email })]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

// Login user
router.post('/login', loginValidation, validate, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await db.query(
      `SELECT id, email, password_hash, name, is_active, email_verified
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    const user = result.rows[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        error: 'Account disabled',
        message: 'This account has been deactivated. Please contact support.',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Update last login
    await db.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Log login
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, details)
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'login', 'user', JSON.stringify({ email: user.email })]
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.email_verified,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

// Get current user (protected route example)
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, email, name, created_at, last_login_at, email_verified
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account no longer exists',
      });
    }

    res.json({
      user: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ============ PASSWORD RESET ENDPOINTS ============

// Request password reset
const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
];

router.post('/forgot-password', forgotPasswordValidation, validate, async (req, res, next) => {
  try {
    const { email } = req.body;
    const crypto = require('crypto');
    const emailService = require('../services/emailService');

    // Find user by email
    const userResult = await db.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    // Always return success to prevent email enumeration attacks
    if (userResult.rows.length === 0) {
      return res.json({
        message: 'If an account exists with that email, we have sent a password reset link.',
      });
    }

    const user = userResult.rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    // Save token to database
    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    // Send email with reset link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    await emailService.sendPasswordResetEmail(email, resetToken, frontendUrl);

    // Log the action
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, details)
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'forgot_password_request', 'user', JSON.stringify({ email })]
    );

    res.json({
      message: 'If an account exists with that email, we have sent a password reset link.',
    });
  } catch (error) {
    next(error);
  }
});

// Reset password with token
const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
];

router.post('/reset-password', resetPasswordValidation, validate, async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const crypto = require('crypto');

    // Hash the provided token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid reset token
    const tokenResult = await db.query(
      `SELECT user_id, token_hash, expires_at FROM password_reset_tokens
       WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP AND used_at IS NULL`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired token',
        message: 'The password reset link is invalid or has expired. Please request a new one.',
      });
    }

    const resetToken = tokenResult.rows[0];
    const userId = resetToken.user_id;

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update password and mark token as used
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Update user password
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [passwordHash, userId]
      );

      // Mark token as used
      await client.query(
        'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
        [tokenHash]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Log the action
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, details)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'password_reset', 'user', JSON.stringify({ success: true })]
    );

    res.json({
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
});

// ============ GOOGLE OAUTH FOR SIGNUP/LOGIN ============

const passport = require('passport');

/**
 * GET /api/auth/google/login
 * Initiate Google OAuth flow for signup/login
 * Public: Redirects to Google consent screen
 */
router.get('/google/login', passport.authenticate('google', {
  scope: ['profile', 'email'],
  accessType: 'offline',
  prompt: 'consent',
}));

/**
 * GET /api/auth/google/callback
 * OAuth callback handler - creates or updates user
 * Public: Google redirects here after user authorizes
 */
router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`
  }),
  async (req, res) => {
    try {
      const { profile, accessToken, refreshToken } = req.user;
      const { id: googleId, email, name, picture } = profile;

      // Check if user with this email already exists
      let user = await db.query(
        'SELECT id, email, name, created_at FROM users WHERE email = $1',
        [email]
      );

      if (user.rows.length > 0) {
        // User exists - log them in
        const existingUser = user.rows[0];
        
        // Generate JWT token
        const token = jwt.sign(
          { userId: existingUser.id, email: existingUser.email },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        // Update last login
        await db.query(
          'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
          [existingUser.id]
        );

        // Log login
        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, details)
           VALUES ($1, $2, $3, $4)`,
          [existingUser.id, 'google_login', 'user', JSON.stringify({ email })]
        );

        // Redirect to dashboard with token
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?token=${token}`);
      }

      // User doesn't exist - create new account via OAuth
      const result = await db.query(
        `INSERT INTO users (email, name, email_verified, is_active, google_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, name, created_at`,
        [email, name || null, true, true, googleId]
      );

      const newUser = result.rows[0];

      // Generate JWT token for new user
      const token = jwt.sign(
        { userId: newUser.id, email: newUser.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Log registration via OAuth
      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, details)
         VALUES ($1, $2, $3, $4)`,
        [newUser.id, 'google_signup', 'user', JSON.stringify({ email, name })]
      );

      // Redirect to dashboard with token
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?token=${token}`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=callback_failed`);
    }
  }
);

module.exports = router;
