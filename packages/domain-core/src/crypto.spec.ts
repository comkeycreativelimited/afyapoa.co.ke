import { describe, it, expect } from 'vitest';
import {
  encryptField,
  decryptField,
  computeBlindIndex,
  maskIdentifier,
  normalizeKenyanPhone,
  isValidKenyanPhone,
  isValidKenyanNationalId,
  levenshteinDistance,
  stringSimilarity,
  calculateDuplicateScore,
} from './crypto.js';

describe('Domain Core Cryptography & Identity Matching Unit Tests', () => {
  const sampleKey = '12345678901234567890123456789012'; // 32 bytes
  const samplePepper = 'test_pepper_afyapoa_2026';

  describe('1. AES-256-GCM Field Encryption', () => {
    it('1.1 should encrypt and successfully decrypt plaintext PII', () => {
      const plaintext = '12345678'; // Sample National ID
      const encrypted = encryptField(plaintext, sampleKey);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.split(':')).toHaveLength(3); // iv:tag:ciphertext

      const decrypted = decryptField(encrypted, sampleKey);
      expect(decrypted).toBe(plaintext);
    });

    it('1.2 should throw an error if ciphertext or authentication tag is tampered with', () => {
      const plaintext = '+254712345678';
      const encrypted = encryptField(plaintext, sampleKey);
      const parts = encrypted.split(':');

      // Corrupt the ciphertext
      const corruptedCipher = parts[2].slice(0, -2) + (parts[2].endsWith('a') ? 'b' : 'a');
      const tampered = `${parts[0]}:${parts[1]}:${corruptedCipher}`;

      expect(() => decryptField(tampered, sampleKey)).toThrow();
    });

    it('1.3 should produce different ciphertexts for the same plaintext due to random 96-bit IV', () => {
      const plaintext = 'Secret Patient Data';
      const enc1 = encryptField(plaintext, sampleKey);
      const enc2 = encryptField(plaintext, sampleKey);

      expect(enc1).not.toBe(enc2);
      expect(decryptField(enc1, sampleKey)).toBe(plaintext);
      expect(decryptField(enc2, sampleKey)).toBe(plaintext);
    });
  });

  describe('2. Deterministic HMAC-SHA256 Blind Indexing', () => {
    it('2.1 should produce deterministic hash for identical inputs', () => {
      const idA = '12345678';
      const idB = '12345678';
      expect(computeBlindIndex(idA, samplePepper)).toBe(computeBlindIndex(idB, samplePepper));
    });

    it('2.2 should normalize case, whitespace, and hyphens', () => {
      const raw1 = '  shif-1234-5678  ';
      const raw2 = 'SHIF12345678';
      expect(computeBlindIndex(raw1, samplePepper)).toBe(computeBlindIndex(raw2, samplePepper));
    });

    it('2.3 should produce distinct hashes for different values', () => {
      const hash1 = computeBlindIndex('12345678', samplePepper);
      const hash2 = computeBlindIndex('87654321', samplePepper);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('3. PII Masking', () => {
    it('3.1 should mask Kenyan National ID numbers preserving last 3 digits', () => {
      expect(maskIdentifier('12345678', 'KENYA_NATIONAL_ID')).toBe('*****678');
      expect(maskIdentifier('3214567', 'KENYA_NATIONAL_ID')).toBe('****567');
    });

    it('3.2 should mask Kenyan phone numbers preserving prefix and last 4 digits', () => {
      expect(maskIdentifier('+254712345678')).toBe('+2547****5678');
      expect(maskIdentifier('0712345678')).toBe('07123****5678');
    });

    it('3.3 should handle short identifiers gracefully', () => {
      expect(maskIdentifier('123')).toBe('****');
    });
  });

  describe('4. Kenyan Phone and ID Validation & Normalization', () => {
    it('4.1 should normalize 07xx and 01xx numbers to +254 format', () => {
      expect(normalizeKenyanPhone('0712345678')).toBe('+254712345678');
      expect(normalizeKenyanPhone('0112345678')).toBe('+254112345678');
      expect(normalizeKenyanPhone('254712345678')).toBe('+254712345678');
      expect(normalizeKenyanPhone('+254712345678')).toBe('+254712345678');
    });

    it('4.2 should validate valid and invalid Kenyan phone numbers', () => {
      expect(isValidKenyanPhone('+254712345678')).toBe(true);
      expect(isValidKenyanPhone('0712345678')).toBe(true);
      expect(isValidKenyanPhone('0110000000')).toBe(true);
      expect(isValidKenyanPhone('0812345678')).toBe(false);
      expect(isValidKenyanPhone('12345')).toBe(false);
    });

    it('4.3 should validate Kenyan National ID numbers (6 to 9 digits)', () => {
      expect(isValidKenyanNationalId('123456')).toBe(true);
      expect(isValidKenyanNationalId('12345678')).toBe(true);
      expect(isValidKenyanNationalId('123456789')).toBe(true);
      expect(isValidKenyanNationalId('12345')).toBe(false);
      expect(isValidKenyanNationalId('1234567890')).toBe(false);
      expect(isValidKenyanNationalId('12345abc')).toBe(false);
    });
  });

  describe('5. Fuzzy Matching & Duplicate Detection Algorithm', () => {
    it('5.1 should compute string similarity accurately', () => {
      expect(stringSimilarity('Mwangi', 'Mwangi')).toBe(1.0);
      expect(stringSimilarity('John', 'Jon')).toBeGreaterThan(0.70);
      expect(stringSimilarity('Kamau', 'Otieno')).toBeLessThan(0.30);
    });

    it('5.2 should assign confidence score 1.0 when National ID blind index matches exactly', () => {
      const result = calculateDuplicateScore(
        {
          firstName: 'Jane',
          lastName: 'Muthoni',
          dateOfBirth: '1990-05-15',
          gender: 'FEMALE',
          nationalIdBlindIndex: 'hash_match_123',
        },
        {
          firstName: 'Janet',
          lastName: 'Muthoni',
          dateOfBirth: '1990-05-15',
          gender: 'FEMALE',
          nationalIdBlindIndex: 'hash_match_123',
        },
      );

      expect(result.confidenceScore).toBe(1.0);
      expect(result.matchReasons).toContain('EXACT_NATIONAL_ID_MATCH');
    });

    it('5.3 should calculate probabilistic score based on phone, DOB, and name similarity', () => {
      const result = calculateDuplicateScore(
        {
          firstName: 'Wanjiku',
          lastName: 'Kariuki',
          dateOfBirth: '1985-11-20',
          gender: 'FEMALE',
          phoneBlindIndex: 'phone_hash_999',
        },
        {
          firstName: 'Wanjiku',
          lastName: 'Kariuki',
          dateOfBirth: '1985-11-20',
          gender: 'FEMALE',
          phoneBlindIndex: 'phone_hash_999',
        },
      );

      // Phone (0.35) + DOB & Gender (0.35) + Exact Name (0.35) = capped at 0.99
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.85);
      expect(result.matchReasons).toContain('EXACT_PHONE_MATCH');
      expect(result.matchReasons).toContain('EXACT_DOB_AND_GENDER_MATCH');
      expect(result.matchReasons).toContain('STRONG_NAME_SIMILARITY');
    });

    it('5.4 should assign low score when individuals have different demographics', () => {
      const result = calculateDuplicateScore(
        {
          firstName: 'Brian',
          lastName: 'Ochieng',
          dateOfBirth: '1995-03-10',
          gender: 'MALE',
        },
        {
          firstName: 'Grace',
          lastName: 'Wambui',
          dateOfBirth: '1982-08-25',
          gender: 'FEMALE',
        },
      );

      expect(result.confidenceScore).toBeLessThan(0.30);
      expect(result.matchReasons).toHaveLength(0);
    });
  });
});
