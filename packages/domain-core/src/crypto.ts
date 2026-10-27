import * as crypto from 'crypto';

/**
 * DEFAULT SECRET KEYS FOR DETERMINISTIC FIELD ENCRYPTION & BLIND INDEXING
 * In production, these are injected via environment variables (e.g. KMS / HashiCorp Vault).
 */
const DEFAULT_ENCRYPTION_KEY = (process.env.FIELD_ENCRYPTION_KEY || 'afyapoa_aes_256_gcm_secret_key_32b!').slice(0, 32).padEnd(32, '0');
const DEFAULT_PEPPER = process.env.BLIND_INDEX_PEPPER || 'afyapoa_blind_index_pepper_kenya_hmac_2026';

function resolveEncryptionKey(key?: string): string {
  if (key) return key.slice(0, 32).padEnd(32, '0');
  if (process.env.NODE_ENV === 'production' && !process.env.FIELD_ENCRYPTION_KEY) {
    throw new Error('FATAL: FIELD_ENCRYPTION_KEY must be explicitly configured in production.');
  }
  return DEFAULT_ENCRYPTION_KEY;
}

function resolvePepper(pepper?: string): string {
  if (pepper) return pepper;
  if (process.env.NODE_ENV === 'production' && !process.env.BLIND_INDEX_PEPPER) {
    throw new Error('FATAL: BLIND_INDEX_PEPPER must be explicitly configured in production.');
  }
  return DEFAULT_PEPPER;
}

/**
 * Encrypts a sensitive string field (PII) using AES-256-GCM.
 * Output format: `iv_hex:authTag_hex:ciphertext_hex`
 */
export function encryptField(plaintext: string, key?: string): string {
  if (!plaintext) return '';
  const resolvedKey = resolveEncryptionKey(key);
  const keyBuffer = Buffer.from(resolvedKey.slice(0, 32), 'utf-8');
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a sensitive string field encrypted with AES-256-GCM.
 */
export function decryptField(encryptedPayload: string, key?: string): string {
  if (!encryptedPayload) return '';
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error('Invalid encrypted payload format. Expected iv:authTag:ciphertext');
  }

  const ivHex = parts[0];
  const authTagHex = parts[1];
  const cipherHex = parts[2];
  const resolvedKey = resolveEncryptionKey(key);
  const keyBuffer = Buffer.from(resolvedKey.slice(0, 32), 'utf-8');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  const decrypted = decipher.update(cipherHex, 'hex', 'utf8') + decipher.final('utf8');
  return decrypted;
}

/**
 * Computes a deterministic HMAC-SHA256 blind index for exact search on encrypted values.
 * Normalizes input (trims, uppercase, strips hyphens/spaces).
 */
export function computeBlindIndex(value: string, pepper?: string): string {
  if (!value) return '';
  const resolvedPepper = resolvePepper(pepper);
  const normalized = value.trim().toUpperCase().replace(/[\s\-_]/g, '');
  return crypto.createHmac('sha256', resolvedPepper).update(normalized).digest('hex');
}

/**
 * Masks a sensitive identity or phone number for safe display in UI/logs.
 * Examples:
 * - National ID '12345678' -> '*****678'
 * - Phone '+254712345678' -> '+2547****5678'
 * - SHA Number 'SHIF-12345678' -> 'SHIF-****5678'
 */
export function maskIdentifier(value: string, system?: string): string {
  if (!value) return '';
  const trimmed = value.trim();

  if (system === 'KENYA_NATIONAL_ID' || /^\d{6,9}$/.test(trimmed)) {
    if (trimmed.length <= 4) return '****';
    return '*'.repeat(trimmed.length - 3) + trimmed.slice(-3);
  }

  if (trimmed.startsWith('+254') || /^0[17]\d{8}$/.test(trimmed)) {
    if (trimmed.length >= 10) {
      return trimmed.slice(0, 5) + '****' + trimmed.slice(-4);
    }
  }

  if (trimmed.length <= 4) {
    return '****';
  }
  return trimmed.slice(0, 2) + '*'.repeat(Math.max(trimmed.length - 6, 3)) + trimmed.slice(-4);
}

/**
 * Normalizes Kenyan phone numbers to E.164 standard (+254...).
 * Accepts formats:
 * - 0712345678 -> +254712345678
 * - 0112345678 -> +254112345678
 * - 254712345678 -> +254712345678
 * - +254712345678 -> +254712345678
 */
export function normalizeKenyanPhone(phone: string): string {
  if (!phone) return '';
  const digitsOnly = phone.replace(/[^\d+]/g, '');

  if (digitsOnly.startsWith('+254')) {
    return digitsOnly;
  }
  if (digitsOnly.startsWith('254') && digitsOnly.length === 12) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    return `+254${digitsOnly.slice(1)}`;
  }
  return digitsOnly;
}

/**
 * Validates Kenyan phone number format (+254 7XX XXX XXX or +254 1XX XXX XXX).
 */
export function isValidKenyanPhone(phone: string): boolean {
  const normalized = normalizeKenyanPhone(phone);
  return /^\+254(7|1)\d{8}$/.test(normalized);
}

/**
 * Validates Kenyan National ID format (6 to 9 numeric digits).
 */
export function isValidKenyanNationalId(id: string): boolean {
  if (!id) return false;
  const trimmed = id.trim();
  return /^\d{6,9}$/.test(trimmed);
}

/**
 * Computes Levenshtein distance between two strings for fuzzy matching.
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    const row = matrix[i]!;
    const prevRow = matrix[i - 1]!;
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        row[j] = prevRow[j - 1]!;
      } else {
        row[j] = Math.min(
          prevRow[j - 1]! + 1, // substitution
          row[j - 1]! + 1,     // insertion
          prevRow[j]! + 1,     // deletion
        );
      }
    }
  }

  return matrix[bn]![an]!;
}

/**
 * Computes normalized string similarity (0.0 to 1.0) based on Levenshtein distance.
 */
export function stringSimilarity(strA: string, strB: string): number {
  if (!strA && !strB) return 1.0;
  if (!strA || !strB) return 0.0;

  const s1 = strA.trim().toLowerCase();
  const s2 = strB.trim().toLowerCase();
  if (s1 === s2) return 1.0;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  return Math.max(0, 1 - distance / maxLength);
}

/**
 * Calculates candidate duplicate similarity score between two patient profiles.
 * Returns score between 0.0 and 1.0 and match reasons.
 */
export interface DuplicateMatchCalculation {
  confidenceScore: number;
  matchReasons: string[];
}

export function calculateDuplicateScore(
  input: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    phoneBlindIndex?: string;
    nationalIdBlindIndex?: string;
  },
  existing: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    phoneBlindIndex?: string;
    nationalIdBlindIndex?: string;
  },
): DuplicateMatchCalculation {
  const reasons: string[] = [];
  let score = 0;

  // 1. Exact National ID match (Definitive match)
  if (
    input.nationalIdBlindIndex &&
    existing.nationalIdBlindIndex &&
    input.nationalIdBlindIndex === existing.nationalIdBlindIndex
  ) {
    return {
      confidenceScore: 1.0,
      matchReasons: ['EXACT_NATIONAL_ID_MATCH'],
    };
  }

  // 2. Exact Phone match
  if (
    input.phoneBlindIndex &&
    existing.phoneBlindIndex &&
    input.phoneBlindIndex === existing.phoneBlindIndex
  ) {
    score += 0.35;
    reasons.push('EXACT_PHONE_MATCH');
  }

  // 3. Exact Date of Birth & Gender
  const dobMatch = input.dateOfBirth && existing.dateOfBirth && input.dateOfBirth === existing.dateOfBirth;
  const genderMatch = input.gender && existing.gender && input.gender.toUpperCase() === existing.gender.toUpperCase();

  if (dobMatch && genderMatch) {
    score += 0.35;
    reasons.push('EXACT_DOB_AND_GENDER_MATCH');
  } else if (dobMatch) {
    score += 0.20;
    reasons.push('EXACT_DOB_MATCH');
  }

  // 4. Name similarity
  const firstSim = stringSimilarity(input.firstName, existing.firstName);
  const lastSim = stringSimilarity(input.lastName, existing.lastName);
  const nameScore = (firstSim * 0.15) + (lastSim * 0.20);

  if (firstSim >= 0.85 && lastSim >= 0.85) {
    reasons.push('STRONG_NAME_SIMILARITY');
  } else if (firstSim >= 0.70 || lastSim >= 0.70) {
    reasons.push('MODERATE_NAME_SIMILARITY');
  }
  score += nameScore;

  // Cap score between 0.0 and 0.99 (unless exact national ID match)
  const finalScore = Math.min(0.99, Math.round(score * 100) / 100);

  return {
    confidenceScore: finalScore,
    matchReasons: reasons,
  };
}
