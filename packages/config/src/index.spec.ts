import { describe, it, expect } from 'vitest';
import { envSchema } from './index.js';

describe('Configuration Schema Validation', () => {
  it('should validate default environment values', () => {
    const parsed = envSchema.parse({});
    expect(parsed.PORT).toBe(4000);
    expect(parsed.DATABASE_PORT).toBe(5432);
    expect(parsed.INTEGRATION_DRIVER).toBe('MOCK');
  });

  it('should reject invalid integration driver', () => {
    expect(() =>
      envSchema.parse({
        INTEGRATION_DRIVER: 'INVALID_DRIVER',
      }),
    ).toThrow();
  });
});
