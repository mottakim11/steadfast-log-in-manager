const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const KEY_FILE = path.join(DATA_DIR, 'secret.key');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getMasterKey() {
  if (process.env.APP_SECRET_KEY) {
    return crypto.createHash('sha256').update(process.env.APP_SECRET_KEY).digest();
  }

  if (fs.existsSync(KEY_FILE)) {
    const raw = fs.readFileSync(KEY_FILE);
    if (raw.length === 32) return raw;
  }

  const generated = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, generated);
  return generated;
}

const MASTER_KEY = getMasterKey();
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt plain text using AES-256-GCM
 * Output format: base64(iv:authTag:cipherText)
 */
function encrypt(plainText) {
  if (!plainText) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64')
  ].join(':');
}

/**
 * Decrypt cipher text created with encrypt()
 */
function decrypt(cipherText) {
  if (!cipherText) return '';
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      // Fallback if plain text was stored
      return cipherText;
    }
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const encrypted = Buffer.from(parts[2], 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return '';
  }
}

module.exports = {
  encrypt,
  decrypt
};
