// Token encryption utilities
// Using crypto for secure token storage
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

/**
 * Derive encryption key from JWT secret
 * Using PBKDF2 for key derivation (more secure than raw secret)
 */
function getEncryptionKey(salt) {
  return crypto.pbkdf2Sync(
    process.env.JWT_SECRET,
    salt,
    100000, // iterations
    KEY_LENGTH,
    'sha512'
  );
}

/**
 * Encrypt a token (access_token or refresh_token)
 * Returns base64-encoded string: salt:iv:tag:encrypted
 */
function encryptToken(token) {
  if (!token) return null;
  
  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive key from JWT secret
    const key = getEncryptionKey(salt);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt
    let encrypted = cipher.update(token, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get auth tag (for AES-GCM integrity check)
    const tag = cipher.getAuthTag();
    
    // Combine salt:iv:tag:encrypted (all base64)
    const combined = [
      salt.toString('base64'),
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted
    ].join(':');
    
    return combined;
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypt a token
 * Expects format: salt:iv:tag:encrypted (base64)
 */
function decryptToken(encryptedToken) {
  if (!encryptedToken) return null;
  
  try {
    // Split components
    const parts = encryptedToken.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted token format');
    }
    
    const [saltB64, ivB64, tagB64, encrypted] = parts;
    
    // Decode from base64
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    
    // Derive key (same process as encryption)
    const key = getEncryptionKey(salt);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error('Failed to decrypt token');
  }
}

module.exports = {
  encryptToken,
  decryptToken
};
