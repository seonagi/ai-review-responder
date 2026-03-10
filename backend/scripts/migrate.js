// Database migration script
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔄 Starting database migration...');
    
    // Read and execute base schema
    const schemaPath = path.join(__dirname, '../../database-schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📋 Applying base schema...');
    await pool.query(schemaSql);
    console.log('✅ Base schema applied');
    
    // Check if OAuth migration file exists and apply it
    const oauthMigrationPath = path.join(__dirname, '../../database-migration-oauth.sql');
    if (fs.existsSync(oauthMigrationPath)) {
      console.log('📋 Applying OAuth migration...');
      const oauthMigrationSql = fs.readFileSync(oauthMigrationPath, 'utf8');
      
      // Split by statement and execute each (handle multiple SQL statements)
      const statements = oauthMigrationSql.split(';').filter(stmt => stmt.trim());
      for (const statement of statements) {
        try {
          await pool.query(statement);
        } catch (error) {
          // Ignore if column/index already exists (idempotent migrations)
          if (!error.message.includes('already exists')) {
            throw error;
          }
          console.log('⚠️  Skipped (already applied):', statement.trim().substring(0, 50) + '...');
        }
      }
      console.log('✅ OAuth migration applied');
    }
    
    console.log('✅ All database migrations completed successfully!');
    console.log('📊 Tables:');
    console.log('   - users (with google_id support)');
    console.log('   - password_reset_tokens');
    console.log('   - google_connections');
    console.log('   - reviews');
    console.log('   - responses');
    console.log('   - brand_voices');
    console.log('   - audit_logs');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
