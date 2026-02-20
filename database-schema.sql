-- AI Review Responder - Database Schema
-- PostgreSQL production-ready schema
-- Created: 2026-02-20
-- Phase 1: Foundation (users, auth)
-- Phase 2: Google connections, reviews
-- Phase 3: AI responses, brand voices

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Index for fast email lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Google My Business connections (Phase 2)
CREATE TABLE google_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    google_business_id VARCHAR(255) NOT NULL, -- Google's location ID
    business_name VARCHAR(255),
    access_token TEXT, -- Encrypted in application layer
    refresh_token TEXT, -- Encrypted in application layer
    token_expires_at TIMESTAMP,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_synced_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, google_business_id)
);

CREATE INDEX idx_google_connections_user_id ON google_connections(user_id);
CREATE INDEX idx_google_connections_active ON google_connections(user_id, is_active);

-- Reviews (from Google My Business)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_connection_id UUID NOT NULL REFERENCES google_connections(id) ON DELETE CASCADE,
    google_review_id VARCHAR(255) UNIQUE NOT NULL, -- Google's review ID
    reviewer_name VARCHAR(255),
    reviewer_photo_url TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    review_reply TEXT, -- Existing reply from Google (if any)
    posted_at TIMESTAMP NOT NULL,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_responded BOOLEAN DEFAULT FALSE,
    sentiment VARCHAR(50), -- positive, neutral, negative (computed)
    UNIQUE(google_connection_id, google_review_id)
);

CREATE INDEX idx_reviews_connection ON reviews(google_connection_id);
CREATE INDEX idx_reviews_posted_at ON reviews(posted_at DESC);
CREATE INDEX idx_reviews_is_responded ON reviews(google_connection_id, is_responded);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- AI-generated responses
CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    posted_at TIMESTAMP,
    approved_by_user_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'draft', -- draft, approved, posted, rejected
    ai_model VARCHAR(100), -- e.g., "gpt-4", for tracking
    generation_params JSONB, -- Store prompt, temperature, etc.
    user_edits TEXT, -- Track if user modified AI response
    UNIQUE(review_id) -- One response per review
);

CREATE INDEX idx_responses_review ON responses(review_id);
CREATE INDEX idx_responses_status ON responses(status);
CREATE INDEX idx_responses_generated_at ON responses(generated_at DESC);

-- Brand voice profiles (for AI customization - Phase 3)
CREATE TABLE brand_voices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) DEFAULT 'Default Voice',
    tone VARCHAR(100), -- friendly, professional, casual, etc.
    example_responses TEXT[], -- Array of sample responses user likes
    custom_instructions TEXT, -- Free-form guidance for AI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id) -- One brand voice per user for MVP
);

CREATE INDEX idx_brand_voices_user ON brand_voices(user_id);

-- Audit log (for debugging and compliance)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- login, review_fetch, response_generate, response_post, etc.
    entity_type VARCHAR(100), -- review, response, connection
    entity_id UUID,
    details JSONB, -- Flexible metadata
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brand_voices_updated_at BEFORE UPDATE ON brand_voices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts for the platform';
COMMENT ON TABLE google_connections IS 'Google My Business OAuth connections';
COMMENT ON TABLE reviews IS 'Reviews fetched from Google My Business';
COMMENT ON TABLE responses IS 'AI-generated responses (draft, approved, posted)';
COMMENT ON TABLE brand_voices IS 'User-defined brand voice profiles for AI customization';
COMMENT ON TABLE audit_logs IS 'Audit trail for compliance and debugging';

-- Sample data for development (optional, uncomment for local testing)
-- INSERT INTO users (email, password_hash, name, email_verified) VALUES
-- ('test@example.com', '$2b$10$examplehash', 'Test User', TRUE);
