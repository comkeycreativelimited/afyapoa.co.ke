/**
 * COMKEY AFYA POA — Integration Security, Correlation & Secret Protection
 */

import { IntegrationError, IntegrationErrorCode, IntegrationMode } from './types.js';

const PRODUCTION_HOSTNAMES = [
  'api.hie.dha.go.ke',
  'api.claims.sha.go.ke',
  'etims.kra.go.ke',
  'api.safaricom.co.ke',
];

/**
 * Asserts that automated tests and unverified environments cannot invoke production services.
 * Throws a fatal IntegrationError if a test execution attempts to connect to production.
 */
export function assertSafeEnvironment(mode: IntegrationMode, targetUrl: string): void {
  const isTestEnvironment =
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    Boolean(process.env.TEST);

  if (isTestEnvironment && mode === 'PROD') {
    throw new IntegrationError(
      IntegrationErrorCode.PRODUCTION_GUARD_TRIGGERED,
      'Automated test execution cannot run in PROD integration mode. Production endpoints are barred during testing.',
      500,
      undefined,
      false,
      undefined,
      { mode, targetUrl },
    );
  }

  for (const prodHost of PRODUCTION_HOSTNAMES) {
    if (targetUrl.toLowerCase().includes(prodHost)) {
      if (isTestEnvironment) {
        throw new IntegrationError(
          IntegrationErrorCode.PRODUCTION_GUARD_TRIGGERED,
          `Automated test attempted outbound network call to verified production host: ${prodHost}. Hard blocked by safety guard.`,
          500,
          undefined,
          false,
          undefined,
          { targetUrl, prodHost },
        );
      }
      if (mode !== 'PROD') {
        throw new IntegrationError(
          IntegrationErrorCode.PRODUCTION_GUARD_TRIGGERED,
          `Configuration mismatch: Mode is "${mode}" but target URL points to production host "${prodHost}". Endpoint switch rejected.`,
          500,
          undefined,
          false,
          undefined,
          { mode, targetUrl },
        );
      }
    }
  }
}

/**
 * Generates standard multi-tenant headers with request correlation and facility identification.
 */
export function createCorrelationHeaders(
  facilityCode: string,
  correlationId?: string,
  extraHeaders?: Record<string, string>,
): Record<string, string> {
  const cid = correlationId || `CORR-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const reqId = `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  return {
    'X-Correlation-Id': cid,
    'X-Request-Id': reqId,
    'X-Facility-Id': facilityCode,
    'X-Facility-Id-Type': 'fr-code',
    'X-Client-Timestamp': new Date().toISOString(),
    'User-Agent': 'COMKEY-AFYAPOA-HMIS/1.0 (DHA-CIHIS-Client)',
    ...extraHeaders,
  };
}

/**
 * Sanitizes request and response objects before logging.
 * Strictly redacts API keys, secrets, OTPs, and unrestricted clinical PHI payloads.
 */
export function sanitizeForLogging(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogging);
  }

  const copy = { ...(obj as Record<string, unknown>) };

  // 1. Redact authentication secrets
  const secretKeys = [
    'authorization',
    'client_secret',
    'clientsecret',
    'api_key',
    'apikey',
    'otp',
    'otpcode',
    'otprecord',
    'password',
    'passkey',
    'refreshtoken',
    'secret',
  ];

  for (const k of Object.keys(copy)) {
    const lower = k.toLowerCase();
    if (secretKeys.some((s) => lower.includes(s))) {
      copy[k] = '[REDACTED_SECRET]';
    }
  }

  // 2. Redact unrestricted clinical payloads (protect PHI in ordinary logs)
  const clinicalPayloadKeys = [
    'clinicalsummary',
    'notes',
    'summarynotes',
    'observations',
    'diagnosis',
    'diagnoses',
    'histology',
    'biopsy',
    'mentalhealth',
    'hivstatus',
  ];

  for (const k of Object.keys(copy)) {
    const lower = k.toLowerCase();
    if (clinicalPayloadKeys.some((c) => lower.includes(c))) {
      const val = copy[k];
      if (typeof val === 'string' && val.length > 0) {
        copy[k] = `[PROTECTED_CLINICAL_PAYLOAD length=${val.length}]`;
      } else if (Array.isArray(val)) {
        copy[k] = `[PROTECTED_CLINICAL_ARRAY count=${val.length}]`;
      }
    }
  }

  // 3. Mask patient identification numbers (keep last 4 digits)
  if (typeof copy.identificationNumber === 'string' && copy.identificationNumber.length > 4) {
    const str = copy.identificationNumber;
    copy.identificationNumber = `${'*'.repeat(str.length - 4)}${str.slice(-4)}`;
  }
  if (typeof copy.nationalId === 'string' && copy.nationalId.length > 4) {
    const str = copy.nationalId;
    copy.nationalId = `${'*'.repeat(str.length - 4)}${str.slice(-4)}`;
  }

  return copy;
}
