import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createMockApp, MOCK_ASSUMPTION_NOTE } from './app.js';

const getJson = async (res: Response): Promise<any> => res.json() as Promise<any>;

describe('Local Mock Server (DHA & SHA Synthetic Simulator)', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createMockApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // 1. Health
  it('GET /health should return 200 and identify simulator service', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const data = await getJson(res);
    expect(data.status).toBe('ok');
    expect(data.service).toBe('comkey-dha-sha-mock-simulator');
    expect(data.isSynthetic).toBe(true);
  });

  // 2. Authentication
  it('POST /api/v1/tenants/token should issue OAuth 2.0 token', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tenants/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: 'dha_dev_org', client_secret: 'secret123' }),
    });
    expect(res.status).toBe(200);
    const data = await getJson(res);
    expect(data.token_type).toBe('Bearer');
    expect(data.access_token).toContain('JWT-MOCK-TOKEN-');
    expect(data.isSynthetic).toBe(true);
    expect(data.mockAssumption).toBe(MOCK_ASSUMPTION_NOTE);
  });

  it('POST /api/v1/tenants/token should reject invalid credentials with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tenants/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: 'invalid', client_secret: 'invalid' }),
    });
    expect(res.status).toBe(401);
    const data = await getJson(res);
    expect(data.error).toBe('invalid_client');
  });

  // 3. Client Registry
  it('GET /api/v1/patients should return verified synthetic beneficiary', async () => {
    const res = await fetch(`${baseUrl}/api/v1/patients?identification_number=12345678&identification_type=KENYA_NATIONAL_ID`);
    expect(res.status).toBe(200);
    const data = await getJson(res);
    expect(data.status).toBe('VERIFIED');
    expect(data.firstName).toBe('Jane');
    expect(data.lastName).toBe('Mwangi');
    expect(data.upi).toBe('UPI-KEN-2026-12345678');
    expect(data.isSynthetic).toBe(true);
  });

  it('GET /api/v1/patients should return UNINDEXED status for unknown identification number', async () => {
    const res = await fetch(`${baseUrl}/api/v1/patients?identification_number=99999999&identification_type=KENYA_NATIONAL_ID`);
    expect(res.status).toBe(200);
    const data = await getJson(res);
    expect(data.status).toBe('UNINDEXED');
    expect(data.crId).toBe('');
    expect(data.isSynthetic).toBe(true);
  });

  // 4. Facility Registry
  it('GET /api/v1/facilities/:kmflCode should return accredited facility metadata', async () => {
    const res = await fetch(`${baseUrl}/api/v1/facilities/FID-01-000101-1`);
    expect(res.status).toBe(200);
    const data = await getJson(res);
    expect(data.kmflCode).toBe('FID-01-000101-1');
    expect(data.name).toContain('Nairobi Metropolitan Referral Hospital');
    expect(data.level).toBe('LEVEL_5');
    expect(data.active).toBe(true);
  });

  // 5. Health Worker Registry
  it('GET /api/v1/practitioners/:puid should return practitioner credentials', async () => {
    const res = await fetch(`${baseUrl}/api/v1/practitioners/PUID-KMPDC-A0001`);
    expect(res.status).toBe(200);
    const data = await getJson(res);
    expect(data.puid).toBe('PUID-KMPDC-A0001');
    expect(data.board).toBe('KMPDC');
    expect(data.licenseStatus).toBe('ACTIVE');
  });

  // 6. Consent Management
  it('should support full consent lifecycle: contacts -> OTP request -> OTP verification', async () => {
    // 1. Get contacts
    const contactsRes = await fetch(`${baseUrl}/api/v1/patients/contacts?patient_id=CRID-KE-DHA-12345678`);
    expect(contactsRes.status).toBe(200);
    const contacts = await getJson(contactsRes);
    expect(contacts.length).toBeGreaterThan(0);
    expect(contacts[0].maskedPhone).toBe('+254714***898');

    // 2. Request OTP
    const otpReqRes = await fetch(`${baseUrl}/shr/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: 'CRID-KE-DHA-12345678', contact_id: contacts[0].contactId }),
    });
    expect(otpReqRes.status).toBe(200);
    const otpReq = await getJson(otpReqRes);
    expect(otpReq.status).toBe('PENDING_VERIFICATION');

    // 3. Verify OTP with correct token (123456)
    const verifyRes = await fetch(`${baseUrl}/shr/consents/${otpReq.consentId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: '123456', otp_record: otpReq.otpRecord }),
    });
    expect(verifyRes.status).toBe(200);
    const verified = await getJson(verifyRes);
    expect(verified.status).toBe('AUTHORIZED');
    expect(verified.consentToken).toContain('JWT-CONSENT-');
    expect(verified.visitId).toContain('VISIT-2026-');

    // 4. Verify OTP with incorrect token fails
    const badVerify = await fetch(`${baseUrl}/shr/consents/${otpReq.consentId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: '999999', otp_record: otpReq.otpRecord }),
    });
    expect(badVerify.status).toBe(400);
  });

  // 7. Shared Health Record (SHR)
  it('POST /shr/bundles should reject ingestion without mandatory X-Consent-Token or X-PUID', async () => {
    const res = await fetch(`${baseUrl}/shr/bundles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resourceType: 'Bundle', type: 'collection', entry: [] }),
    });
    expect(res.status).toBe(403);
    const data = await getJson(res);
    expect(data.error).toBe('CONSENT_REQUIRED');
  });

  it('POST /shr/bundles should accept clinical bundle when authenticated and consent-verified', async () => {
    const res = await fetch(`${baseUrl}/shr/bundles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Consent-Token': 'JWT-CONSENT-TEST',
        'X-PUID': 'PUID-KMPDC-A0001',
      },
      body: JSON.stringify({
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            fullUrl: 'urn:uuid:enc-01',
            resource: { resourceType: 'Encounter', id: 'enc-01', status: 'finished' },
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const data = await getJson(res);
    expect(data.status).toBe('INGESTED');
    expect(data.bundleId).toContain('SHR-BUNDLE-');
  });

  // 8. Terminology Service
  it('POST /api/v1/terminology/validate should validate medical concept', async () => {
    const res = await fetch(`${baseUrl}/api/v1/terminology/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: 'WHO_ICD_11', code: 'BA00' }),
    });
    expect(res.status).toBe(200);
    const data = await getJson(res);
    expect(data.isValid).toBe(true);
    expect(data.code).toBe('BA00');
  });

  // 9. SHA Eligibility & Benefits
  it('GET /api/v1/patients/eligibility should return active contributor coverage across 3 funds', async () => {
    const res = await fetch(`${baseUrl}/api/v1/patients/eligibility?identification_number=12345678`);
    expect(res.status).toBe(200);
    const data = await getJson(res);
    expect(data.eligible).toBe(true);
    expect(data.fundType).toBe('SHIF');
    expect(data.benefitBalanceKES).toBeGreaterThan(0);
    expect(data.activeSchemes.length).toBe(3);
  });

  it('GET /api/v1/patients/eligibility should return EXHAUSTED when test token is used', async () => {
    const res = await fetch(`${baseUrl}/api/v1/patients/eligibility?identification_number=SHA-EXHAUSTED-001`);
    expect(res.status).toBe(200);
    const data = await getJson(res);
    expect(data.eligible).toBe(false);
    expect(data.coverageStatus).toBe('EXHAUSTED');
    expect(data.benefitBalanceKES).toBe(0);
  });

  // 10. SHA Preauthorizations & Claims
  it('POST /api/v1/claims/preauth should approve preauthorization', async () => {
    const res = await fetch(`${baseUrl}/api/v1/claims/preauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientCrId: 'CRID-KE-DHA-12345678',
        subBenefitCode: 'SB-IP-MED',
        interventionCode: 'INT-IP-SURG-APP',
        estimatedCostKES: 65000,
        clinicalSummary: 'Scheduled appendectomy',
      }),
    });
    expect(res.status).toBe(200);
    const data = await getJson(res);
    expect(data.status).toBe('APPROVED');
    expect(data.approvedAmountKES).toBe(65000);
  });

  it('POST /api/v1/claims/submit should adjudicate claim and prevent duplicate submissions', async () => {
    const claimId = `CLAIM-TEST-${Date.now()}`;
    const claimPayload = {
      resourceType: 'Claim',
      id: claimId,
      status: 'active',
      type: { coding: [{ code: 'institutional' }] },
      patient: { reference: 'Patient/CRID-KE-DHA-12345678' },
      total: { value: 15400, currency: 'KES' },
    };

    // First submission
    const res1 = await fetch(`${baseUrl}/api/v1/claims/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(claimPayload),
    });
    expect(res1.status).toBe(200);
    const data1 = await getJson(res1);
    expect(data1.status).toBe('APPROVED');
    expect(data1.claimId).toBe(claimId);

    // Duplicate submission must be barred with 409 Conflict
    const res2 = await fetch(`${baseUrl}/api/v1/claims/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(claimPayload),
    });
    expect(res2.status).toBe(409);
    const data2 = await getJson(res2);
    expect(data2.error).toBe('DUPLICATE_CLAIM');
  });

  // 11. KRA eTIMS
  it('POST /api/v1/etims/sign should fiscally sign invoice', async () => {
    const res = await fetch(`${baseUrl}/api/v1/etims/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceNumber: 'INV-2026-0001', amount: 4500 }),
    });
    expect(res.status).toBe(200);
    const data = await getJson(res);
    expect(data.status).toBe('SIGNED');
    expect(data.controlCode).toContain('KRA-ETIMS-MOCK-CTRL-');
  });

  // 12. M-Pesa STK Push
  it('POST /api/v1/mpesa/stkpush should initiate transaction and allow query', async () => {
    const pushRes = await fetch(`${baseUrl}/api/v1/mpesa/stkpush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '+254712345678',
        amount: 2500,
        accountReference: 'INV-001',
        transactionDesc: 'Consultation fee',
      }),
    });
    expect(pushRes.status).toBe(200);
    const pushData = await getJson(pushRes);
    expect(pushData.status).toBe('INITIATED');
    expect(pushData.checkoutRequestId).toContain('ws_CO_');

    // Query payment status
    const queryRes = await fetch(`${baseUrl}/api/v1/mpesa/query/${pushData.checkoutRequestId}`);
    expect(queryRes.status).toBe(200);
    const queryData = await getJson(queryRes);
    expect(queryData.status).toBe('SUCCESS');
    expect(queryData.mpesaReceiptNumber).toMatch(/^QAA\d+$/);
  });

  // 13. Deterministic Fault Scenarios
  it('X-Mock-Scenario: timeout should trigger 504 Gateway Timeout', async () => {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { 'X-Mock-Scenario': 'timeout' },
    });
    expect(res.status).toBe(504);
    const data = await getJson(res);
    expect(data.error).toBe('GATEWAY_TIMEOUT');
  });

  it('X-Mock-Scenario: rate_limit should trigger 429 Too Many Requests with Retry-After', async () => {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { 'X-Mock-Scenario': 'rate_limit' },
    });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('1');
    const data = await getJson(res);
    expect(data.error).toBe('RATE_LIMITED');
  });

  it('X-Mock-Scenario: unavailable should trigger 503 Service Unavailable', async () => {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { 'X-Mock-Scenario': 'unavailable' },
    });
    expect(res.status).toBe(503);
    const data = await getJson(res);
    expect(data.error).toBe('SERVICE_UNAVAILABLE');
  });

  it('X-Mock-Scenario: auth_fail should trigger 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { 'X-Mock-Scenario': 'auth_fail' },
    });
    expect(res.status).toBe(401);
    const data = await getJson(res);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('X-Mock-Scenario: forbidden should trigger 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { 'X-Mock-Scenario': 'forbidden' },
    });
    expect(res.status).toBe(403);
    const data = await getJson(res);
    expect(data.error).toBe('FORBIDDEN');
  });

  it('X-Mock-Scenario: validation_error should trigger 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { 'X-Mock-Scenario': 'validation_error' },
    });
    expect(res.status).toBe(400);
    const data = await getJson(res);
    expect(data.error).toBe('VALIDATION_FAILED');
  });

  it('X-Mock-Scenario: duplicate should trigger 409 Conflict', async () => {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { 'X-Mock-Scenario': 'duplicate' },
    });
    expect(res.status).toBe(409);
    const data = await getJson(res);
    expect(data.error).toBe('DUPLICATE_SUBMISSION');
  });

  it('X-Correlation-Id header should be reflected in response headers', async () => {
    const customCorr = 'CORR-TEST-TRACE-999';
    const res = await fetch(`${baseUrl}/health`, {
      headers: { 'X-Correlation-Id': customCorr },
    });
    expect(res.headers.get('X-Correlation-Id')).toBe(customCorr);
  });
});
