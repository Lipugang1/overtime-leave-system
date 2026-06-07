// Edge runtime compatible password hashing using Web Crypto API
// Replaces bcryptjs which requires Node.js crypto

const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const HASH_ALGORITHM = 'SHA-256';

/**
 * Generate a random salt (base64url)
 */
function generateSalt(): string {
  const array = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Hash password with PBKDF2 (Web Crypto API)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const key = await pbkdf2(password, salt, ITERATIONS, KEY_LENGTH);
  const hash = base64UrlEncode(key);
  // Format: iterations.salt.hash
  return `${ITERATIONS}.${salt}.${hash}`;
}

/**
 * Verify password against hash
 * Supports both PBKDF2 (iterations.salt.hash) and bcrypt ($2b$...) formats
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // bcrypt format: $2b$10$...
  if (hash.startsWith('$2b$') || hash.startsWith('$2a$')) {
    try {
      const bcrypt = await import('bcryptjs');
      return bcrypt.compareSync(password, hash);
    } catch {
      return false;
    }
  }

  // PBKDF2 format: iterations.salt.hash
  const parts = hash.split('.');
  if (parts.length !== 3) return false;
  const [iterStr, salt, storedHash] = parts;
  const iterations = parseInt(iterStr, 10);
  if (isNaN(iterations)) return false;
  const key = await pbkdf2(password, salt, iterations, KEY_LENGTH);
  const hash2 = base64UrlEncode(key);
  return timingSafeEqual(storedHash, hash2);
}

/**
 * PBKDF2 using Web Crypto API
 */
async function pbkdf2(
  password: string,
  salt: string,
  iterations: number,
  keyLength: number
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const saltData = base64UrlDecode(salt);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltData as unknown as BufferSource,
      iterations,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    keyLength * 8
  );

  return new Uint8Array(derivedBits);
}

/**
 * Base64URL encode
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): Uint8Array {
  str += new Array(5 - (str.length % 4)).join('=');
  str = str.replace(/\-/g, '+').replace(/\_/g, '/');
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Timing-safe comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
