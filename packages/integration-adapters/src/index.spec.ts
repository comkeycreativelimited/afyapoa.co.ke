/**
 * COMKEY AFYA POA — Integration Adapters Test Suite
 * Validates deterministic scenarios across MOCK, UAT, and PROD safety controls.
 * Covers all 12 required deterministic integration scenarios:
 * 1. Successful requests
 * 2. Invalid requests
 * 3. Authentication failures
 * 4. Authorization failures
 * 5. Timeouts
 * 6. Rate limiting
 * 7. Service unavailability
 * 8. Validation errors
 * 9. Duplicate submissions
 * 10. Partial failures
 * 11. External status changes
 * 12. Retry and reconciliation scenarios
 * + Production safety guard verification
 * + Secret and PHI log sanitization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KenyaCoreClaim } from '@afyapoa/fhir-models';
import {
  createIntegrationClients,
  MockDhaHieClient,
  MockShaClaimsClient,
  MockMpesaPaymentClient,
  assertSafeEnvironment,
  sanitizeForLogging,
  createCorrelationHeaders,
  IntegrationErrorCode,
  IntegrationError,
  ResilientHttpClient,
} from './index.js';

function createSampleClaim(id: string, amount: number = 12500): KenyaCoreClaim {
  return {
    resourceType: 'Claim',
    id,
    identifier: [{ system: 'http://sha.go.ke/claims', value: id }],
    status: 'active',
    type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'institutional' }] },
    use: 'claim',
    patient: { reference: 'Patient/CRID-KE-DHA-12345678' },
    billablePeriod: { start: '2026-10-19T00:00:00Z', end: '2026-10-19T23:59:59Z' },
    created: new Date().toISOString(),
    provider: { reference: 'Organization/FID-01-000101-1' },
    insurance: [{ sequence: 1, focal: true, coverage: { reference: 'Coverage/SHIF-9988776655' } }],
    item: [
      {
        sequence: 1,
        productOrService: { coding: [{ system: 'http://sha.go.ke/tariffs', code: 'INT-OP-CONSULT' }] },
        net: { value: amount, currency: 'KES' },
      },
    ],
  };
}

describe('External Healthcare Integration Adapters & Mock Framework', () => {
  let clients = createIntegrationClients('MOCK');
  let dhaMock: MockDhaHieClient;
  let shaMock: MockShaClaimsClient;
  let mpesaMock: MockMpesaPaymentClient;

  beforeEach(() => {
    clients = createIntegrationClients('MOCK');
    dhaMock = clients.dhaHie as unknown as MockDhaHieClient;
    shaMock = clients.shaClaims as unknown as MockShaClaimsClient;
    mpesaMock = clients.mpesa as unknown as MockMpesaPaymentClient;
    expect(mpesaMock).toBeDefined();
  });

  // ===========================================================================
  // SCENARIO 1: SUCCESSFUL REQUESTS
  // ===========================================================================
  describe('Scenario 1: Successful Requests', () => {
    it('should query DHA Client Registry and return verified patient', async () => {
      const res = await clients.dhaHie.lookupClient('KENYA_NATIONAL_ID', '12345678', 'FID-01-000101-1');
      expect(res.isSuccess()).toBe(true);
      const patient = res.getValue();
      expect(patient.status).toBe('VERIFIED');
      expect(patient.upi).toBe('UPI-KEN-2026-12345678');
      expect(patient.firstName).toBe('Jane');
      expect(patient.lastName).toBe('Mwangi');
      expect(patient.isSynthetic).toBe(true);
    });

    it('should verify facility accreditation in Facility Registry', async () => {
      const res = await clients.dhaHie.verifyFacilityByKmfl('FID-01-000101-1');
      expect(res.isSuccess()).toBe(true);
      const fac = res.getValue();
      expect(fac.kmflCode).toBe('FID-01-000101-1');
      expect(fac.level).toBe('LEVEL_5');
      expect(fac.active).toBe(true);
    });

    it('should verify practitioner license in Health Worker Registry', async () => {
      const res = await clients.dhaHie.verifyHealthWorkerByPuid('PUID-KMPDC-A0001');
      expect(res.isSuccess()).toBe(true);
      const worker = res.getValue();
      expect(worker.board).toBe('KMPDC');
      expect(worker.licenseStatus).toBe('ACTIVE');
    });

    it('should verify SHA eligibility for active member', async () => {
      const res = await clients.shaEligibility.checkEligibility('SHA-00998877', 'SHA_NUMBER', 'FID-01-000101-1');
      expect(res.isSuccess()).toBe(true);
      const elig = res.getValue();
      expect(elig.eligible).toBe(true);
      expect(elig.fundType).toBe('SHIF');
      expect(elig.benefitBalanceKES).toBe(500000);
      expect(elig.activeSchemes.length).toBe(3);
    });

    it('should submit claim and return adjudicated status', async () => {
      const claim = createSampleClaim(`CLM-UNIT-${Date.now()}`, 12500);
      const res = await clients.shaClaims.submitClaim(claim, 'FID-01-000101-1', 'PUID-KMPDC-A0001');
      expect(res.isSuccess()).toBe(true);
      const result = res.getValue();
      expect(result.status).toBe('APPROVED');
      expect(result.adjudicatedAmountKES).toBe(12500);
    });

    it('should upload supporting clinical attachment', async () => {
      const res = await clients.shaClaims.uploadAttachment!(
        'CLM-ATTACH-001',
        'DISCHARGE_SUMMARY',
        {
          title: 'Discharge Summary Note',
          mimeType: 'application/pdf',
          fileUrl: 'https://storage.afyapoa.local/docs/discharge.pdf',
        },
        'FID-01-000101-1',
        'PUID-KMPDC-A0001',
      );
      expect(res.isSuccess()).toBe(true);
      const attachment = res.getValue();
      expect(attachment.attachmentId).toContain('ATT-');
      expect(attachment.status).toBe('UPLOADED_AND_VERIFIED');
    });

    it('should add intervention, billing lines, and diagnoses to active claim', async () => {
      const clmId = 'CLM-INT-001';
      const intRes = await clients.shaClaims.addIntervention!(
        clmId,
        'INT-SURG-01',
        'FID-01-000101-1',
        'PUID-KMPDC-A0001',
      );
      expect(intRes.isSuccess()).toBe(true);
      expect(intRes.getValue().status).toBe('ACTIVE');

      const billRes = await clients.shaClaims.addBillingLines!(
        clmId,
        [{ code: 'BED-01', amountKES: 12000 }],
        'FID-01-000101-1',
        'PUID-KMPDC-A0001',
      );
      expect(billRes.isSuccess()).toBe(true);
      expect(billRes.getValue().linesAdded).toBe(1);

      const diagRes = await clients.shaClaims.addDiagnoses!(
        clmId,
        [{ system: 'ICD-11', code: '1A00' }],
        'FID-01-000101-1',
        'PUID-KMPDC-A0001',
      );
      expect(diagRes.isSuccess()).toBe(true);
      expect(diagRes.getValue().diagnosesRecorded).toBe(1);
    });

    it('should reconcile batch of pending claims', async () => {
      const claim = createSampleClaim(`CLM-REC-${Date.now()}`, 5000);
      await clients.shaClaims.submitClaim(claim, 'FID-01-000101-1', 'PUID-KMPDC-A0001');

      const res = await clients.shaClaims.reconcileBatch!(
        { status: 'APPROVED' },
        'FID-01-000101-1',
      );
      expect(res.isSuccess()).toBe(true);
      const batch = res.getValue();
      expect(batch.batchId).toContain('REC-MOCK-BATCH-');
      expect(batch.claims.length).toBeGreaterThanOrEqual(1);
    });

    it('should fiscally sign invoice via KRA eTIMS port', async () => {
      const res = await clients.kraEtims.signInvoice({ invoiceNo: 'INV-100', amount: 3500 });
      expect(res.isSuccess()).toBe(true);
      const invoice = res.getValue();
      expect(invoice.status).toBe('SIGNED');
      expect(invoice.controlCode).toContain('KRA-ETIMS-MOCK-CTRL');
    });
  });

  // ===========================================================================
  // SCENARIO 2: INVALID REQUESTS
  // ===========================================================================
  describe('Scenario 2: Invalid Requests', () => {
    it('should reject M-Pesa STK push for malformed phone number', async () => {
      const res = await clients.mpesa.initiateStkPush(
        { phoneNumber: 'invalid-number', amount: 1000, accountReference: 'INV-01', transactionDesc: 'Test' },
        'FID-01-000101-1',
      );
      expect(res.isFailure()).toBe(true);
      expect(res.getError().message).toContain('Invalid Kenyan phone number format');
    });

    it('should reject payment with non-positive amount', async () => {
      const res = await clients.mpesa.initiateStkPush(
        { phoneNumber: '+254712345678', amount: -50, accountReference: 'INV-01', transactionDesc: 'Test' },
        'FID-01-000101-1',
      );
      expect(res.isFailure()).toBe(true);
      expect(res.getError().message).toContain('greater than zero');
    });
  });

  // ===========================================================================
  // SCENARIO 3: AUTHENTICATION FAILURES
  // ===========================================================================
  describe('Scenario 3: Authentication Failures', () => {
    it('should fail with AUTH_FAILED when synthetic token is expired or rejected', async () => {
      dhaMock.setSimulatedFault(IntegrationErrorCode.AUTH_FAILED);
      const res = await clients.dhaHie.lookupClient('KENYA_NATIONAL_ID', '12345678', 'FID-01-000101-1');
      expect(res.isFailure()).toBe(true);
      const err = res.getError() as IntegrationError;
      expect(err.code).toBe(IntegrationErrorCode.AUTH_FAILED);
      expect(err.statusCode).toBe(401);
      expect(err.retryable).toBe(false);
    });
  });

  // ===========================================================================
  // SCENARIO 4: AUTHORIZATION FAILURES
  // ===========================================================================
  describe('Scenario 4: Authorization Failures', () => {
    it('should fail with FORBIDDEN when practitioner lacks permissions', async () => {
      dhaMock.setSimulatedFault(IntegrationErrorCode.FORBIDDEN);
      const res = await clients.dhaHie.lookupClient('KENYA_NATIONAL_ID', '12345678', 'FID-01-000101-1');
      expect(res.isFailure()).toBe(true);
      const err = res.getError() as IntegrationError;
      expect(err.code).toBe(IntegrationErrorCode.FORBIDDEN);
      expect(err.statusCode).toBe(403);
    });
  });

  // ===========================================================================
  // SCENARIO 5: TIMEOUTS
  // ===========================================================================
  describe('Scenario 5: Timeouts', () => {
    it('should fail with TIMEOUT when gateway times out', async () => {
      dhaMock.setSimulatedFault(IntegrationErrorCode.TIMEOUT);
      const res = await clients.dhaHie.lookupClient('KENYA_NATIONAL_ID', '12345678', 'FID-01-000101-1');
      expect(res.isFailure()).toBe(true);
      const err = res.getError() as IntegrationError;
      expect(err.code).toBe(IntegrationErrorCode.TIMEOUT);
      expect(err.statusCode).toBe(504);
      expect(err.retryable).toBe(true);
    });
  });

  // ===========================================================================
  // SCENARIO 6: RATE LIMITING
  // ===========================================================================
  describe('Scenario 6: Rate Limiting', () => {
    it('should fail with RATE_LIMITED and provide retryAfterMs', async () => {
      dhaMock.setSimulatedFault(IntegrationErrorCode.RATE_LIMITED);
      const res = await clients.dhaHie.lookupClient('KENYA_NATIONAL_ID', '12345678', 'FID-01-000101-1');
      expect(res.isFailure()).toBe(true);
      const err = res.getError() as IntegrationError;
      expect(err.code).toBe(IntegrationErrorCode.RATE_LIMITED);
      expect(err.statusCode).toBe(429);
      expect(err.retryable).toBe(true);
      expect(err.retryAfterMs).toBeDefined();
    });
  });

  // ===========================================================================
  // SCENARIO 7: SERVICE UNAVAILABILITY
  // ===========================================================================
  describe('Scenario 7: Service Unavailability', () => {
    it('should fail with SERVICE_UNAVAILABLE (503) and mark error as retryable', async () => {
      shaMock.setSimulatedFault(IntegrationErrorCode.SERVICE_UNAVAILABLE);
      const res = await clients.shaEligibility.checkEligibility('SHA-001', 'SHA_NUMBER', 'FID-01-000101-1');
      expect(res.isFailure()).toBe(true);
      const err = res.getError() as IntegrationError;
      expect(err.code).toBe(IntegrationErrorCode.SERVICE_UNAVAILABLE);
      expect(err.statusCode).toBe(503);
      expect(err.retryable).toBe(true);
    });
  });

  // ===========================================================================
  // SCENARIO 8: VALIDATION ERRORS
  // ===========================================================================
  describe('Scenario 8: Validation Errors', () => {
    it('should fail with VALIDATION_FAILED when emergency reason is too brief', async () => {
      const res = await clients.dhaHie.authorizeEmergencyConsent(
        'CRID-001',
        'bad', // Less than 5 chars
        'FID-01-000101-1',
        'PUID-KMPDC-A0001',
      );
      expect(res.isFailure()).toBe(true);
      const err = res.getError() as IntegrationError;
      expect(err.code).toBe(IntegrationErrorCode.VALIDATION_FAILED);
      expect(err.statusCode).toBe(400);
    });
  });

  // ===========================================================================
  // SCENARIO 9: DUPLICATE SUBMISSIONS
  // ===========================================================================
  describe('Scenario 9: Duplicate Submissions', () => {
    it('should reject re-submitting the same claim ID with 409 DUPLICATE_SUBMISSION', async () => {
      const claim = createSampleClaim(`CLM-DUP-TEST-${Date.now()}`, 12500);

      const res1 = await clients.shaClaims.submitClaim(claim, 'FID-01-000101-1', 'PUID-KMPDC-A0001');
      expect(res1.isSuccess()).toBe(true);

      const res2 = await clients.shaClaims.submitClaim(claim, 'FID-01-000101-1', 'PUID-KMPDC-A0001');
      expect(res2.isFailure()).toBe(true);
      const err = res2.getError() as IntegrationError;
      expect(err.code).toBe(IntegrationErrorCode.DUPLICATE_SUBMISSION);
      expect(err.statusCode).toBe(409);
    });
  });

  // ===========================================================================
  // SCENARIO 10: PARTIAL FAILURES
  // ===========================================================================
  describe('Scenario 10: Partial Failures', () => {
    it('should report unindexed patient without crashing client lookup', async () => {
      const res = await clients.dhaHie.lookupClient('KENYA_NATIONAL_ID', '99999999', 'FID-01-000101-1');
      expect(res.isSuccess()).toBe(true);
      const patient = res.getValue();
      expect(patient.status).toBe('UNINDEXED');
      expect(patient.crId).toBe('');
    });

    it('should report benefit entitlement exhaustion without crashing eligibility flow', async () => {
      const res = await clients.shaEligibility.checkEligibility('SHA-EXHAUSTED-001', 'SHA_NUMBER', 'FID-01-000101-1');
      expect(res.isSuccess()).toBe(true);
      const elig = res.getValue();
      expect(elig.eligible).toBe(false);
      expect(elig.coverageStatus).toBe('EXHAUSTED');
      expect(elig.benefitBalanceKES).toBe(0);
    });
  });

  // ===========================================================================
  // SCENARIO 11: EXTERNAL STATUS CHANGES
  // ===========================================================================
  describe('Scenario 11: External Status Changes', () => {
    it('should track preauthorization lifecycle from submission to query', async () => {
      const submitRes = await clients.shaPreauth.submitPreauthorization(
        {
          patientCrId: 'CRID-KE-DHA-12345678',
          subBenefitCode: 'SB-IP-MED',
          interventionCode: 'INT-IP-SURG-APP',
          requestedAmountKES: 65000,
          preauthType: 'SURGICAL',
          clinicalSummary: 'Laparoscopic appendectomy',
        },
        'FID-01-000101-1',
        'PUID-KMPDC-A0001',
      );
      expect(submitRes.isSuccess()).toBe(true);
      const preauth = submitRes.getValue();
      expect(preauth.status).toBe('APPROVED');

      // Query status
      const queryRes = await clients.shaPreauth.queryPreauthStatus(preauth.preauthId, 'FID-01-000101-1');
      expect(queryRes.isSuccess()).toBe(true);
      expect(queryRes.getValue().status).toBe('APPROVED');

      // Cancel preauthorization
      const cancelRes = await clients.shaPreauth.cancelPreauthorization(
        preauth.preauthId,
        'Patient opted for private financing',
        'FID-01-000101-1',
      );
      expect(cancelRes.isSuccess()).toBe(true);
      expect(cancelRes.getValue().cancelled).toBe(true);
    });

    it('should track claim status transitions across queryClaimStatus', async () => {
      const claim = createSampleClaim(`CLM-STATUS-TX-${Date.now()}`, 18000);

      const submitRes = await clients.shaClaims.submitClaim(claim, 'FID-01-000101-1', 'PUID-KMPDC-A0001');
      expect(submitRes.isSuccess()).toBe(true);

      const statusRes = await clients.shaClaims.queryClaimStatus(claim.id!, 'FID-01-000101-1');
      expect(statusRes.isSuccess()).toBe(true);
      expect(statusRes.getValue().claimId).toBe(claim.id);
      expect(statusRes.getValue().status).toBe('APPROVED');
    });
  });

  // ===========================================================================
  // SCENARIO 12: RETRY AND RECONCILIATION SCENARIOS
  // ===========================================================================
  describe('Scenario 12: Retry and Reconciliation', () => {
    it('ResilientHttpClient should respect bounded retries and exponential backoff on transient errors', async () => {
      let attempts = 0;
      const fakeFetch = async () => {
        attempts++;
        if (attempts < 2) {
          return new Response(JSON.stringify({ error: 'Temporary Glitch' }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true, attempt: attempts }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      // Temporarily substitute global fetch
      const origFetch = globalThis.fetch;
      globalThis.fetch = fakeFetch as unknown as typeof fetch;

      try {
        const client = new ResilientHttpClient({
          mode: 'MOCK',
          baseUrl: 'http://127.0.0.1:9999',
          maxRetries: 2,
          baseRetryDelayMs: 10,
        });

        const data = await client.request<{ success: boolean; attempt: number }>('test', {
          facilityCode: 'FID-01-000101-1',
        });
        expect(data.success).toBe(true);
        expect(data.attempt).toBe(2);
        expect(attempts).toBe(2);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('ResilientHttpClient should open circuit breaker after repeated upstream failures', async () => {
      const failingFetch = async () =>
        new Response(JSON.stringify({ error: 'Downstream Down' }), {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
        });

      const origFetch = globalThis.fetch;
      globalThis.fetch = failingFetch as unknown as typeof fetch;

      try {
        const client = new ResilientHttpClient({
          mode: 'MOCK',
          baseUrl: 'http://127.0.0.1:9999',
          maxRetries: 0,
        });

        // Trigger failures to breach threshold (5)
        for (let i = 0; i < 5; i++) {
          try {
            await client.request('test', { facilityCode: 'FID-01', skipRetries: true });
          } catch {
            // expected
          }
        }

        // Subsequent call must fail immediately with CIRCUIT_OPEN
        await expect(client.request('test', { facilityCode: 'FID-01' })).rejects.toThrow(
          /Circuit breaker is OPEN/,
        );
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  // ===========================================================================
  // PRODUCTION SAFETY GUARD & SECURITY CONTROLS
  // ===========================================================================
  describe('Production Safety Guard Verification', () => {
    it('assertSafeEnvironment should strictly block PROD mode during automated testing', () => {
      expect(() => {
        assertSafeEnvironment('PROD', 'https://api.hie.dha.go.ke');
      }).toThrowError(/Automated test execution cannot run in PROD integration mode/);
    });

    it('assertSafeEnvironment should block production hostnames even if mode is UAT during tests', () => {
      expect(() => {
        assertSafeEnvironment('UAT', 'https://api.hie.dha.go.ke/api/v1/patients');
      }).toThrowError(/Automated test attempted outbound network call to verified production host/);
    });

    it('createIntegrationClients should throw when PROD mode is instantiated in test environment', () => {
      expect(() => {
        createIntegrationClients({ mode: 'PROD' });
      }).toThrowError(/Automated test execution cannot run in PROD integration mode/);
    });
  });

  // ===========================================================================
  // PHI & SECRET LOG SANITIZATION
  // ===========================================================================
  describe('Secret and PHI Log Sanitization', () => {
    it('sanitizeForLogging should redact API keys, secrets, OTPs, and clinical notes', () => {
      const sensitivePayload = {
        apiKey: 'SECRET-API-KEY-12345',
        otp: '123456',
        clinicalSummary: 'Patient diagnosed with severe condition, prescribed medication',
        diagnoses: ['ICD11-HIV', 'ICD11-PSY'],
        meta: {
          security: ['HIV', 'PSY'],
        },
        facilityCode: 'FID-01-000101-1',
      };

      const sanitized = sanitizeForLogging(sensitivePayload) as Record<string, unknown>;
      expect(sanitized.apiKey).toBe('[REDACTED_SECRET]');
      expect(sanitized.otp).toBe('[REDACTED_SECRET]');
      expect(sanitized.clinicalSummary).toContain('[PROTECTED_CLINICAL_PAYLOAD');
      expect(sanitized.diagnoses).toContain('[PROTECTED_CLINICAL_ARRAY');
      // Public / non-PHI metadata remains intact
      expect(sanitized.facilityCode).toBe('FID-01-000101-1');
    });

    it('createCorrelationHeaders should generate mandatory multi-tenant headers with fr-code', () => {
      const headers = createCorrelationHeaders('FID-01-000101-1');
      expect(headers['X-Facility-Id']).toBe('FID-01-000101-1');
      expect(headers['X-Facility-Id-Type']).toBe('fr-code');
      expect(headers['X-Correlation-Id']).toContain('CORR-');
      expect(headers['X-Request-Id']).toContain('REQ-');
      expect(headers['User-Agent']).toContain('COMKEY-AFYAPOA-HMIS');
    });
  });
});
