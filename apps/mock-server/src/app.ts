/**
 * COMKEY AFYA POA — Synthetic Local Mock Server Application
 * Implements documented DHA HIE, SHA Claims, KRA eTIMS, and M-Pesa endpoints.
 * Supports deterministic fault scenarios and clearly stamps all synthetic responses.
 */

import express, { Request, Response, NextFunction, Express } from 'express';

export const MOCK_ASSUMPTION_NOTE =
  'SYNTHETIC IN-MEMORY SIMULATION: Verified against DHA-REQ-2026-V1 and SHA-INT-2026-V1. Not connected to external DHA/SHA production network.';

export function createMockApp(): Express {
  const app: Express = express();
  app.use(express.json({ limit: '10mb' }));

  // Request correlation & synthetic labeling middleware
  app.use((req: Request, res: Response, next: NextFunction): void => {
    const correlationId = (req.headers['x-correlation-id'] as string) || `CORR-MOCK-${Date.now()}`;
    const requestId = (req.headers['x-request-id'] as string) || `REQ-MOCK-${Date.now()}`;
    res.setHeader('X-Correlation-Id', correlationId);
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Mock-Engine', 'COMKEY-AFYAPOA-MOCK/1.0');
    next();
  });

  // Deterministic Fault Injection & Scenario Simulation Middleware
  app.use((req: Request, res: Response, next: NextFunction): void => {
    const scenario = (req.headers['x-mock-scenario'] as string) || (req.query.scenario as string);

    if (scenario === 'timeout') {
      res.status(504).json({
        error: 'GATEWAY_TIMEOUT',
        message: 'Upstream DHA HIE Gateway timed out after 5000ms (Simulated)',
        isSynthetic: true,
        mockAssumption: MOCK_ASSUMPTION_NOTE,
      });
      return;
    }

    if (scenario === 'rate_limit') {
      res.setHeader('Retry-After', '1');
      res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Rate limit exceeded: maximum 60 requests per minute to DHA Gateway (Simulated)',
        isSynthetic: true,
        mockAssumption: MOCK_ASSUMPTION_NOTE,
      });
      return;
    }

    if (scenario === 'unavailable') {
      res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'DHA / SHA Gateway is undergoing scheduled maintenance (Simulated)',
        isSynthetic: true,
        mockAssumption: MOCK_ASSUMPTION_NOTE,
      });
      return;
    }

    if (scenario === 'auth_fail') {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid, revoked, or expired OAuth 2.0 bearer token (Simulated)',
        isSynthetic: true,
        mockAssumption: MOCK_ASSUMPTION_NOTE,
      });
      return;
    }

    if (scenario === 'forbidden') {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Practitioner PUID lacks permission or facility is not accredited (Simulated)',
        isSynthetic: true,
        mockAssumption: MOCK_ASSUMPTION_NOTE,
      });
      return;
    }

    if (scenario === 'validation_error') {
      res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'Payload failed DHA FHIR semantic schema validation (Simulated)',
        isSynthetic: true,
        mockAssumption: MOCK_ASSUMPTION_NOTE,
      });
      return;
    }

    if (scenario === 'duplicate') {
      res.status(409).json({
        error: 'DUPLICATE_SUBMISSION',
        message: 'Resource with the given identifier already exists (Simulated)',
        isSynthetic: true,
        mockAssumption: MOCK_ASSUMPTION_NOTE,
      });
      return;
    }

    next();
  });

  // ===========================================================================
  // 1. HEALTH & METRICS
  // ===========================================================================

  app.get('/health', (_req: Request, res: Response): void => {
    res.json({
      status: 'ok',
      service: 'comkey-dha-sha-mock-simulator',
      version: '1.0.0',
      isSynthetic: true,
      timestamp: new Date().toISOString(),
    });
  });

  // ===========================================================================
  // 2. AUTHENTICATION & MULTI-TENANCY OAUTH 2.0 GATEWAY
  // ===========================================================================

  app.post('/api/v1/tenants/token', (req: Request, res: Response): void => {
    const { client_id, client_secret } = req.body || {};
    if (client_id === 'invalid' || client_secret === 'invalid') {
      res.status(401).json({
        error: 'invalid_client',
        message: 'Invalid client credentials',
        isSynthetic: true,
      });
      return;
    }

    res.json({
      access_token: `JWT-MOCK-TOKEN-${Date.now()}`,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'dha:hie:read dha:hie:write sha:claims:read sha:claims:write',
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  // ===========================================================================
  // 3. DHA CLIENT REGISTRY (CR / MPI)
  // ===========================================================================

  const mockClients: Record<string, Record<string, unknown>> = {
    '12345678': {
      crId: 'CRID-KE-DHA-12345678',
      upi: 'UPI-KEN-2026-12345678',
      identificationType: 'KENYA_NATIONAL_ID',
      identificationNumber: '12345678',
      shaNumber: 'SHIF-9988776655',
      firstName: 'Jane',
      middleName: 'Muthoni',
      lastName: 'Mwangi',
      dateOfBirth: '1988-04-12',
      gender: 'FEMALE',
      primaryPhone: '+254712345678',
      nationality: 'KENYAN',
      status: 'VERIFIED',
      verifiedAt: '2026-10-19T00:00:00Z',
      source: 'MOCK_CLIENT_REGISTRY',
    },
    '23456789': {
      crId: 'CRID-KE-DHA-23456789',
      upi: 'UPI-KEN-2026-23456789',
      identificationType: 'KENYA_NATIONAL_ID',
      identificationNumber: '23456789',
      shaNumber: 'SHIF-8877665544',
      firstName: 'David',
      middleName: 'Kiprono',
      lastName: 'Kipkorir',
      dateOfBirth: '1992-09-18',
      gender: 'MALE',
      primaryPhone: '+254722112233',
      nationality: 'KENYAN',
      status: 'VERIFIED',
      verifiedAt: '2026-10-19T00:00:00Z',
      source: 'MOCK_CLIENT_REGISTRY',
    },
    'SHIF-9988776655': {
      crId: 'CRID-KE-DHA-12345678',
      upi: 'UPI-KEN-2026-12345678',
      identificationType: 'SHA_NUMBER',
      identificationNumber: 'SHIF-9988776655',
      shaNumber: 'SHIF-9988776655',
      firstName: 'Jane',
      middleName: 'Muthoni',
      lastName: 'Mwangi',
      dateOfBirth: '1988-04-12',
      gender: 'FEMALE',
      primaryPhone: '+254712345678',
      nationality: 'KENYAN',
      status: 'VERIFIED',
      verifiedAt: '2026-10-19T00:00:00Z',
      source: 'MOCK_CLIENT_REGISTRY',
    },
  };

  app.get('/api/v1/patients', (req: Request, res: Response): void => {
    const idNum = (req.query.identification_number as string)?.trim();
    const idType = (req.query.identification_type as string) || 'KENYA_NATIONAL_ID';

    if (!idNum) {
      res.status(400).json({
        error: 'MISSING_PARAM',
        message: 'Query parameter identification_number is required',
        isSynthetic: true,
      });
      return;
    }

    const patient = mockClients[idNum];
    if (patient) {
      res.json({
        ...patient,
        isSynthetic: true,
        mockAssumption: MOCK_ASSUMPTION_NOTE,
      });
      return;
    }

    res.json({
      crId: '',
      upi: '',
      identificationType: idType,
      identificationNumber: idNum,
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'UNKNOWN',
      nationality: 'KENYAN',
      status: 'UNINDEXED',
      verifiedAt: new Date().toISOString(),
      source: 'MOCK_CLIENT_REGISTRY',
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  app.get('/api/v1/patients/search', (req: Request, res: Response): void => {
    const name = (req.query.name as string)?.toLowerCase();
    const results = Object.values(mockClients).filter((p) => {
      if (name && !`${p.firstName} ${p.lastName}`.toLowerCase().includes(name)) {
        return false;
      }
      return true;
    });

    res.json(results.map((p) => ({ ...p, isSynthetic: true })));
  });

  // Legacy route alias
  app.get('/dha/cr/lookup', (req: Request, res: Response): void => {
    const nationalId = (req.query.nationalId as string) || '12345678';
    const patient = mockClients[nationalId] || {
      crId: `CRID-2026-${nationalId}`,
      firstName: 'Demo Synthetic',
      lastName: 'Patient',
      dateOfBirth: '1988-06-15',
      gender: 'FEMALE',
      status: 'VERIFIED',
    };

    res.json({
      crid: patient.crId,
      nationalId,
      fullName: `${patient.firstName} ${patient.lastName}`,
      birthDate: patient.dateOfBirth,
      gender: (patient.gender as string)?.toLowerCase(),
      county: 'Nairobi',
      status: patient.status,
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  // ===========================================================================
  // 4. DHA FACILITY REGISTRY (FR / KMFL)
  // ===========================================================================

  const mockFacilities: Record<string, Record<string, unknown>> = {
    'FID-01-000101-1': {
      kmflCode: 'FID-01-000101-1',
      name: 'Nairobi Metropolitan Referral Hospital (Mock)',
      level: 'LEVEL_5',
      county: 'Nairobi',
      subCounty: 'Westlands',
      active: true,
    },
    'FID-47-115307-8': {
      kmflCode: 'FID-47-115307-8',
      name: 'Mombasa County Teaching & Referral Hospital (Mock)',
      level: 'LEVEL_5',
      county: 'Mombasa',
      subCounty: 'Mvita',
      active: true,
    },
  };

  app.get('/api/v1/facilities/:kmflCode', (req: Request, res: Response): void => {
    const code = String(req.params.kmflCode);
    const fac = mockFacilities[code] || {
      kmflCode: code,
      name: `Accredited Health Facility ${code} (Mock)`,
      level: 'LEVEL_4',
      county: 'Nairobi',
      active: true,
    };

    res.json({
      ...fac,
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  // Legacy route alias
  app.get('/dha/fr/verify', (_req: Request, res: Response): void => {
    const kmflCode = (_req.query.kmflCode as string) || 'FID-01-000101-1';
    res.json({
      kmflCode,
      name: 'Nairobi Metropolitan Referral Hospital (Mock)',
      level: 'LEVEL_5',
      county: 'Nairobi',
      active: true,
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  // ===========================================================================
  // 5. DHA HEALTH WORKER REGISTRY (HWR)
  // ===========================================================================

  const mockWorkers: Record<string, Record<string, unknown>> = {
    'PUID-KMPDC-A0001': {
      puid: 'PUID-KMPDC-A0001',
      practitionerName: 'Dr. David Otieno (Mock)',
      cadre: 'Medical Officer',
      licenseNumber: 'KMPDC-LIC-99999',
      board: 'KMPDC',
      licenseStatus: 'ACTIVE',
      validUntil: '2027-12-31',
    },
    'PUID-NCK-N0002': {
      puid: 'PUID-NCK-N0002',
      practitionerName: 'Nurse Grace Muthoni (Mock)',
      cadre: 'Registered Nurse',
      licenseNumber: 'NCK-LIC-88888',
      board: 'NCK',
      licenseStatus: 'ACTIVE',
      validUntil: '2027-12-31',
    },
  };

  app.get('/api/v1/practitioners/:puid', (req: Request, res: Response): void => {
    const puid = String(req.params.puid);
    const worker = mockWorkers[puid] || {
      puid,
      practitionerName: `Practitioner ${puid} (Mock)`,
      cadre: 'Clinical Officer',
      licenseNumber: `LIC-${Date.now().toString().slice(-5)}`,
      board: 'COC',
      licenseStatus: 'ACTIVE',
      validUntil: '2027-12-31',
    };

    res.json({
      ...worker,
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  app.get('/api/v1/practitioners/:puid/license', (req: Request, res: Response): void => {
    const puid = String(req.params.puid);
    const board = (req.query.board as string) || 'KMPDC';
    const worker = mockWorkers[puid];

    res.json({
      puid,
      board,
      licenseStatus: worker ? worker.licenseStatus : 'ACTIVE',
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  // Legacy route alias
  app.get('/dha/hwr/verify', (req: Request, res: Response): void => {
    const puid = (req.query.puid as string) || 'PUID-KMPDC-A0001';
    res.json({
      puid,
      practitionerName: 'Dr. David Otieno (Mock)',
      cadre: 'Medical Officer',
      board: 'KMPDC',
      licenseStatus: 'ACTIVE',
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  // ===========================================================================
  // 6. DHA PATIENT CONSENT MANAGEMENT FRAMEWORK
  // ===========================================================================

  const activeVisits = new Map<string, { visitId: string; consentToken: string; openedAt: string }>();

  app.get('/shr/open-visits', (req: Request, res: Response): void => {
    const patientId = String(req.query.patient_id || '');
    const active = activeVisits.get(patientId);

    if (active) {
      res.json({
        hasOpenVisit: true,
        visitId: active.visitId,
        consentToken: active.consentToken,
        openedAt: active.openedAt,
        isSynthetic: true,
      });
      return;
    }

    res.json({
      hasOpenVisit: false,
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  app.get('/api/v1/patients/contacts', (_req: Request, res: Response): void => {
    res.json([
      {
        contactId: 'CNT-MOCK-01',
        maskedPhone: '+254714***898',
        contactType: 'MOBILE',
        isPrimary: true,
        isSynthetic: true,
      },
      {
        contactId: 'CNT-MOCK-02',
        maskedPhone: '+254733***112',
        contactType: 'MOBILE',
        isPrimary: false,
        isSynthetic: true,
      },
    ]);
  });

  app.post(['/shr/consents', '/api/v1/claims/otp'], (_req: Request, res: Response): void => {
    res.json({
      consentId: `CSNT-${Date.now()}`,
      otpRecord: `REC-OTP-${Date.now()}`,
      expiresInSeconds: 300,
      maskedDestination: '+254714***898',
      status: 'PENDING_VERIFICATION',
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  app.post('/shr/consents/:id/verify', (req: Request, res: Response): void => {
    const { otp } = req.body || {};
    if (otp && otp !== '123456') {
      res.status(400).json({
        error: 'INVALID_OTP',
        message: 'The OTP entered is incorrect or expired (Simulated standard OTP is 123456)',
        isSynthetic: true,
      });
      return;
    }

    const visitId = `VISIT-2026-${Date.now()}`;
    const consentToken = `JWT-CONSENT-${Date.now()}`;

    res.json({
      consentToken,
      visitId,
      patientCrId: 'CRID-KE-DHA-12345678',
      status: 'AUTHORIZED',
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  app.post('/api/v1/claims/authorize', (_req: Request, res: Response): void => {
    res.json({
      consentId: `BIO-CSNT-${Date.now()}`,
      iframeUrl: 'https://hie.dha.go.ke/mock-sandbox/biometric-matcher?session=mock-123',
      status: 'PENDING_BIOMETRIC',
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  app.post('/shr/consents/emergency', (_req: Request, res: Response): void => {
    res.json({
      consentToken: `JWT-EMERGENCY-${Date.now()}`,
      visitId: `VISIT-EMERG-${Date.now()}`,
      patientCrId: 'CRID-EMERGENCY-MOCK',
      status: 'AUTHORIZED',
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      isEmergency: true,
      isSynthetic: true,
    });
  });

  app.post('/shr/visits/:id/close', (req: Request, res: Response): void => {
    res.json({
      message: `Encounter visit ${req.params.id} successfully closed in national HIE registry`,
      closedAt: new Date().toISOString(),
      isSynthetic: true,
    });
  });

  // ===========================================================================
  // 7. DHA SHARED HEALTH RECORD (SHR) BUNDLES & QUERY
  // ===========================================================================

  const storedBundles = new Map<string, unknown>();

  app.post('/shr/bundles', (req: Request, res: Response): void => {
    const consentToken = req.headers['x-consent-token'];
    const puid = req.headers['x-puid'];

    if (!consentToken) {
      res.status(403).json({
        error: 'CONSENT_REQUIRED',
        message: 'Mandatory header X-Consent-Token is missing for SHR ingestion',
        isSynthetic: true,
      });
      return;
    }

    if (!puid) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Mandatory header X-PUID is missing for SHR ingestion',
        isSynthetic: true,
      });
      return;
    }

    const bundleId = `SHR-BUNDLE-${Date.now()}`;
    const bundle = req.body || {};
    storedBundles.set(bundleId, bundle);

    const resourceCount = Array.isArray(bundle.entry) ? bundle.entry.length : 1;

    res.json({
      bundleId,
      status: 'INGESTED',
      resourceCount,
      timestamp: new Date().toISOString(),
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  app.get('/shr/patient-records', (req: Request, res: Response): void => {
    const crId = (req.query.cr_id as string) || 'CRID-KE-DHA-12345678';
    const consentToken = req.headers['x-consent-token'];

    if (!consentToken) {
      res.status(403).json({
        error: 'CONSENT_REQUIRED',
        message: 'Access to patient clinical history requires verified X-Consent-Token',
        isSynthetic: true,
      });
      return;
    }

    res.json({
      patientCrId: crId,
      bundle: {
        resourceType: 'Bundle',
        id: `SHR-QUERY-${Date.now()}`,
        type: 'searchset',
        entry: [
          {
            fullUrl: 'urn:uuid:observation-01',
            resource: {
              resourceType: 'Observation',
              id: 'obs-01',
              status: 'final',
              code: {
                coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }],
              },
              subject: { reference: `Patient/${crId}` },
              effectiveDateTime: new Date().toISOString(),
            },
          },
        ],
      },
      recordsCount: 1,
      retrievedAt: new Date().toISOString(),
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  // ===========================================================================
  // 8. DHA TERMINOLOGY SERVICE (TS)
  // ===========================================================================

  app.post('/api/v1/terminology/validate', (req: Request, res: Response): void => {
    const { system, code } = req.body || {};
    if (!code) {
      res.status(400).json({ error: 'MISSING_CODE', message: 'Code is required', isSynthetic: true });
      return;
    }

    res.json({
      isValid: true,
      system: system || 'WHO_ICD_11',
      code,
      display: `Verified Concept for ${code} (Mock Terminology Service)`,
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  app.get('/api/v1/terminology/search', (req: Request, res: Response): void => {
    const query = (req.query.query as string) || '';
    const system = (req.query.system as string) || 'WHO_ICD_11';

    res.json([
      {
        isValid: true,
        system,
        code: '1B10',
        display: `Tuberculosis of respiratory system (Query: ${query})`,
        isSynthetic: true,
      },
      {
        isValid: true,
        system,
        code: 'BA00',
        display: `Essential hypertension (Query: ${query})`,
        isSynthetic: true,
      },
    ]);
  });

  // ===========================================================================
  // 9. SHA ELIGIBILITY, SUB-BENEFITS & INTERVENTIONS (5-STEP JOURNEY)
  // ===========================================================================

  app.get('/api/v1/patients/eligibility', (req: Request, res: Response): void => {
    const idNumber = (req.query.identification_number as string) || '12345678';
    const isExhausted = idNumber.includes('EXHAUSTED');

    if (isExhausted) {
      res.json({
        eligible: false,
        memberNumber: idNumber,
        fundType: 'SHIF',
        benefitBalanceKES: 0,
        copayRequired: true,
        preauthRequired: false,
        coverageStatus: 'EXHAUSTED',
        message: 'Benefit cap reached for the current coverage year',
        activeSchemes: [],
        isSynthetic: true,
        mockAssumption: MOCK_ASSUMPTION_NOTE,
      });
      return;
    }

    res.json({
      eligible: true,
      memberNumber: idNumber,
      fundType: 'SHIF',
      benefitBalanceKES: 500000,
      copayRequired: false,
      preauthRequired: false,
      coverageStatus: 'ACTIVE',
      message: 'Active contributor in good standing across PHC, SHIF, and ECCIF',
      activeSchemes: [
        { fund: 'PHC', name: 'Primary Healthcare Fund (Capitation)', isActive: true },
        { fund: 'SHIF', name: 'Social Health Insurance Fund (Inpatient/Outpatient)', isActive: true },
        { fund: 'ECCIF', name: 'Emergency, Chronic & Critical Illness Fund', isActive: true },
      ],
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  // Legacy route alias
  app.post('/sha/eligibility', (req: Request, res: Response): void => {
    const memberNumber = req.body?.memberNumber || 'SHA-00123456';
    res.json({
      eligible: true,
      memberNumber,
      fundType: 'SHIF',
      benefitBalanceKES: 500000,
      copayRequired: false,
      preauthRequired: false,
      message: 'Active contributor in good standing (Mock Gateway)',
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  app.get('/api/v1/patients/sub-benefits', (_req: Request, res: Response): void => {
    res.json([
      {
        subBenefitCode: 'SB-OP-GEN',
        subBenefitName: 'General Outpatient Primary Care',
        fund: 'PHC',
        benefitCapKES: 50000,
        isCovered: true,
        isSynthetic: true,
      },
      {
        subBenefitCode: 'SB-IP-MED',
        subBenefitName: 'Medical Inpatient General Ward',
        fund: 'SHIF',
        benefitCapKES: 300000,
        isCovered: true,
        isSynthetic: true,
      },
      {
        subBenefitCode: 'SB-EMERG-RESUS',
        subBenefitName: 'Resuscitation and Emergency Stabilization',
        fund: 'ECCIF',
        benefitCapKES: 1000000,
        isCovered: true,
        isSynthetic: true,
      },
    ]);
  });

  app.get('/api/v1/patients/benefits/interventions', (_req: Request, res: Response): void => {
    res.json([
      {
        interventionCode: 'INT-OP-CONSULT',
        interventionName: 'Standard Outpatient Clinical Consultation',
        fund: 'PHC',
        accessPoint: 'OP',
        paymentMechanism: 'FEE_FOR_SERVICE',
        needsPreauth: false,
        needsManualPreauthApproval: false,
        tariffAmountKES: 1500,
        isSynthetic: true,
      },
      {
        interventionCode: 'INT-IP-SURG-APP',
        interventionName: 'Laparoscopic Appendectomy',
        fund: 'SHIF',
        accessPoint: 'IP',
        paymentMechanism: 'FEE_FOR_SERVICE',
        needsPreauth: true,
        needsManualPreauthApproval: false,
        tariffAmountKES: 65000,
        isSynthetic: true,
      },
      {
        interventionCode: 'INT-IP-PER-DIEM',
        interventionName: 'Standard General Ward Daily Bed Rate',
        fund: 'SHIF',
        accessPoint: 'IP',
        paymentMechanism: 'PER_DIEM',
        needsPreauth: false,
        needsManualPreauthApproval: false,
        tariffAmountKES: 4500,
        isSynthetic: true,
      },
      {
        interventionCode: 'INT-ECCIF-TRAUMA',
        interventionName: 'Polytrauma Emergency Resuscitation & Care',
        fund: 'ECCIF',
        accessPoint: 'EMERGENCY',
        paymentMechanism: 'FEE_FOR_SERVICE',
        needsPreauth: false,
        needsManualPreauthApproval: false,
        tariffAmountKES: 120000,
        isSynthetic: true,
      },
    ]);
  });

  // ===========================================================================
  // 10. SHA PREAUTHORIZATIONS & CLAIMS
  // ===========================================================================

  const storedPreauths = new Map<string, Record<string, unknown>>();
  const submittedClaims = new Map<string, Record<string, unknown>>();

  app.post('/api/v1/claims/preauth', (_req: Request, res: Response): void => {
    const preauthId = `PREAUTH-${Date.now()}`;
    const preauthNumber = `PA-SHA-2026-${Date.now().toString().slice(-6)}`;
    const result = {
      preauthId,
      preauthNumber,
      status: 'APPROVED',
      approvedAmountKES: 65000,
      decisionReason: 'Automatic algorithmic approval for accredited Tier-4 facility',
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    };
    storedPreauths.set(preauthId, result);
    res.json(result);
  });

  app.get('/api/v1/claims/preauth/:id', (req: Request, res: Response): void => {
    const id = String(req.params.id);
    const pa = storedPreauths.get(id) || {
      preauthId: id,
      preauthNumber: `PA-SHA-${id}`,
      status: 'APPROVED',
      approvedAmountKES: 65000,
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
      isSynthetic: true,
    };
    res.json(pa);
  });

  app.post('/api/v1/claims/preauth/cancel', (_req: Request, res: Response): void => {
    res.json({
      cancelled: true,
      message: 'Preauthorization successfully cancelled prior to admission',
      isSynthetic: true,
    });
  });

  app.post('/api/v1/claims/visit', (_req: Request, res: Response): void => {
    res.json({
      shaVisitId: `SHA-VISIT-${Date.now()}`,
      visitNumber: `VN-${Date.now().toString().slice(-6)}`,
      status: 'OPEN',
      startedAt: new Date().toISOString(),
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  app.post(['/api/v1/claims/submit', '/sha/claims/submit'], (req: Request, res: Response): void => {
    const claim = req.body || {};
    const claimId = (claim.id as string) || `CLM-SHA-${Date.now()}`;

    if (submittedClaims.has(claimId)) {
      res.status(409).json({
        error: 'DUPLICATE_CLAIM',
        message: `Claim with ID ${claimId} was already submitted. Duplicate claims are barred under SHA Regulations 2024.`,
        isSynthetic: true,
      });
      return;
    }

    const result = {
      claimId,
      status: 'APPROVED',
      trackingNumber: `TRK-SHA-${Date.now()}`,
      adjudicatedAmountKES: 15400,
      timestamp: new Date().toISOString(),
      message: 'Claim processed and approved by automated rule engine',
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    };

    submittedClaims.set(claimId, result);
    res.json(result);
  });

  app.post('/api/v1/claims/discharge_inpatient', (req: Request, res: Response): void => {
    const { claimId } = req.body || {};
    res.json({
      claimId: (claimId as string) || `CLM-IP-${Date.now()}`,
      status: 'APPROVED',
      trackingNumber: `TRK-DISCH-${Date.now()}`,
      adjudicatedAmountKES: 45000,
      timestamp: new Date().toISOString(),
      message: 'Inpatient discharge claim accepted and queued for remittance',
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  app.get('/api/v1/claims/:claimId/status', (req: Request, res: Response): void => {
    const claimId = String(req.params.claimId);
    const claim = submittedClaims.get(claimId) || {
      claimId,
      status: 'APPROVED',
      trackingNumber: `TRK-SHA-${claimId}`,
      adjudicatedAmountKES: 15400,
      timestamp: new Date().toISOString(),
      isSynthetic: true,
    };
    res.json(claim);
  });

  app.post('/api/v1/claims/interventions', (req: Request, res: Response): void => {
    const { visitId, interventionCode } = req.body || {};
    res.json({
      visitId: visitId || `VISIT-${Date.now()}`,
      interventionCode: interventionCode || 'INT-CONS-01',
      status: 'ACTIVE',
      addedAt: new Date().toISOString(),
      isSynthetic: true,
    });
  });

  app.post('/api/v1/claims/billing-lines', (req: Request, res: Response): void => {
    const { visitId, lines } = req.body || {};
    res.json({
      visitId: visitId || `VISIT-${Date.now()}`,
      linesAdded: Array.isArray(lines) ? lines.length : 1,
      totalAmountKES: 15400,
      status: 'RECORDED',
      isSynthetic: true,
    });
  });

  app.post('/api/v1/claims/diagnoses', (req: Request, res: Response): void => {
    const { visitId, diagnoses } = req.body || {};
    res.json({
      visitId: visitId || `VISIT-${Date.now()}`,
      diagnosesRecorded: Array.isArray(diagnoses) ? diagnoses.length : 1,
      status: 'VALIDATED_WHO_ICD_11',
      isSynthetic: true,
    });
  });

  app.post('/api/v1/claims/attachments', (req: Request, res: Response): void => {
    const { claimId, documentType } = req.body || {};
    const attachmentId = `SHA-ATT-${Date.now()}`;
    res.json({
      attachmentId,
      claimId: claimId || `CLM-${Date.now()}`,
      documentType: documentType || 'CLINICAL_NOTE',
      status: 'UPLOADED_AND_VERIFIED',
      uploadedAt: new Date().toISOString(),
      isSynthetic: true,
    });
  });

  app.post('/api/v1/claims/reconciliation', (req: Request, res: Response): void => {
    const { fromDate, toDate, status } = req.body || {};
    const claims = Array.from(submittedClaims.values());
    res.json({
      batchId: `REC-BATCH-${Date.now()}`,
      queryWindow: { fromDate: fromDate || '2026-10-01', toDate: toDate || '2026-10-31' },
      statusFilter: status || 'ALL',
      totalClaims: claims.length,
      claims,
      reconciledAt: new Date().toISOString(),
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  // Callbacks registration & simulation
  const registeredCallbacks = new Map<string, string>();

  app.post('/api/v1/callbacks/endpoints', (req: Request, res: Response): void => {
    const { endpointUrl, secretToken } = req.body || {};
    if (!endpointUrl) {
      res.status(400).json({ error: 'MISSING_ENDPOINT', message: 'endpointUrl is required', isSynthetic: true });
      return;
    }
    registeredCallbacks.set('default', endpointUrl);
    res.json({
      status: 'REGISTERED',
      endpointUrl,
      hasSecretToken: Boolean(secretToken),
      registeredAt: new Date().toISOString(),
      isSynthetic: true,
    });
  });

  app.post('/api/v1/callbacks/operations', (_req: Request, res: Response): void => {
    res.json({
      supportedOperations: ['PREAUTH_APPROVED', 'PREAUTH_REJECTED', 'CLAIM_PROCESSED', 'CLAIM_DISPUTED', 'REMITTANCE_ISSUED'],
      isSynthetic: true,
    });
  });

  app.post('/api/v1/callbacks/simulate', async (req: Request, res: Response): Promise<void> => {
    const { eventType, claimNumber, approvedAmountKES, targetUrl } = req.body || {};
    const url = targetUrl || registeredCallbacks.get('default');

    const eventPayload = {
      eventType: eventType || 'CLAIM_PROCESSED',
      claimNumber: claimNumber || 'CLM-2026-0001',
      status: 'ADJUDICATED',
      approvedAmountKES: approvedAmountKES ?? 15400,
      timestamp: new Date().toISOString(),
      isSynthetic: true,
    };

    if (url) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-SHA-Signature': 'mock-sha-signature' },
          body: JSON.stringify(eventPayload),
        });
      } catch (err: any) {
        // Log but don't fail response
      }
    }

    res.json({
      simulated: true,
      dispatchedTo: url || 'NONE_REGISTERED',
      payload: eventPayload,
      isSynthetic: true,
    });
  });

  // ===========================================================================
  // 11. KRA eTIMS FISCAL SERVICE
  // ===========================================================================

  app.post(['/api/v1/etims/sign', '/etims/sign'], (_req: Request, res: Response): void => {
    const timestamp = new Date().toISOString();
    res.json({
      controlCode: `KRA-ETIMS-MOCK-CTRL-${Date.now()}`,
      qrCodeUrl: `https://etims.kra.go.ke/verify?code=MOCK-${Date.now()}`,
      status: 'SIGNED',
      timestamp,
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  app.post('/api/v1/etims/credit-note', (_req: Request, res: Response): void => {
    const timestamp = new Date().toISOString();
    res.json({
      controlCode: `KRA-ETIMS-CN-CTRL-${Date.now()}`,
      qrCodeUrl: `https://etims.kra.go.ke/verify?code=CN-MOCK-${Date.now()}`,
      status: 'SIGNED',
      timestamp,
      isSynthetic: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  // ===========================================================================
  // 12. M-PESA DARAJA GATEWAY (PROVISIONAL SIMULATION)
  // ===========================================================================

  const mpesaTransactions = new Map<string, Record<string, unknown>>();

  app.post('/api/v1/mpesa/stkpush', (req: Request, res: Response): void => {
    const { phoneNumber, amount } = req.body || {};
    const phone = (phoneNumber as string)?.trim() || '';

    if (!phone.startsWith('+254') && !phone.startsWith('254') && !phone.startsWith('07') && !phone.startsWith('01')) {
      res.status(400).json({
        error: 'INVALID_PHONE',
        message: 'Invalid Kenyan phone number format. Must start with +254, 254, 07, or 01',
        isSynthetic: true,
      });
      return;
    }

    if (!amount || amount <= 0) {
      res.status(400).json({
        error: 'INVALID_AMOUNT',
        message: 'Payment amount must be greater than zero',
        isSynthetic: true,
      });
      return;
    }

    if (phone.includes('000000000') || phone.includes('700000000')) {
      res.status(400).json({
        error: 'SUBSCRIBER_CANCELLED',
        message: 'Simulated payment failure: Request cancelled by subscriber or timeout (DS-1032)',
        isSynthetic: true,
      });
      return;
    }

    const checkoutRequestId = `ws_CO_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const merchantRequestId = `MR_${Date.now()}`;
    const mpesaReceiptNumber = `QAA${Math.floor(1000000 + Math.random() * 9000000)}`;

    const txRecord = {
      checkoutRequestId,
      mpesaReceiptNumber,
      resultCode: 0,
      resultDesc: 'The service request is processed successfully. (SIMULATED)',
      amount,
      phoneNumber: phone,
      transactionDate: new Date().toISOString(),
      status: 'SUCCESS',
      isSimulated: true,
    };

    mpesaTransactions.set(checkoutRequestId, txRecord);

    res.json({
      checkoutRequestId,
      merchantRequestId,
      responseCode: '0',
      customerMessage: 'Success. Request accepted for processing (SIMULATED)',
      status: 'INITIATED',
      isSimulated: true,
      mockAssumption: MOCK_ASSUMPTION_NOTE,
    });
  });

  app.get('/api/v1/mpesa/query/:checkoutRequestId', (req: Request, res: Response): void => {
    const id = String(req.params.checkoutRequestId);
    const tx = mpesaTransactions.get(id);
    if (!tx) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: `Transaction ${id} not found in simulated gateway.`,
        isSynthetic: true,
      });
      return;
    }
    res.json(tx);
  });

  return app;
}
