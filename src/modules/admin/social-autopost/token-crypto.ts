import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * The Meta token is stored in the database (so the server can renew it by
 * itself), encrypted with AES-256-GCM under SOCIAL_TOKEN_KEY. A database dump
 * alone therefore never reveals a working token.
 *
 * Format: "v1:" + base64(iv[12] | tag[16] | ciphertext).
 */
const PREFIX = 'v1:';

function key(): Buffer {
  const raw = process.env.SOCIAL_TOKEN_KEY?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SOCIAL_TOKEN_KEY must be set to store the Meta token');
    }
    // Local development only.
    return createHash('sha256').update('dev-insecure-social-token-key').digest();
  }
  // Any string works (Render's generated values are base64); hash it to 32 bytes.
  return createHash('sha256').update(raw).digest();
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

/** null when the value is missing or cannot be decrypted (key changed). */
export function decryptToken(stored: string | null | undefined): string | null {
  if (!stored?.startsWith(PREFIX)) return null;
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
