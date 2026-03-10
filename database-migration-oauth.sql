-- Migration: Add Google OAuth support
-- Date: 2026-03-10
-- Description: Add google_id column to users table for OAuth signup/login tracking

ALTER TABLE users 
ADD COLUMN google_id VARCHAR(255) UNIQUE;

-- Create index for fast Google ID lookups
CREATE INDEX idx_users_google_id ON users(google_id);

-- Update password_hash column to allow NULL (for OAuth users without password)
ALTER TABLE users 
ALTER COLUMN password_hash DROP NOT NULL;
