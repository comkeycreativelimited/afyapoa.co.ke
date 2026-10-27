/**
 * COMKEY AFYA POA — Integration Clients Factory
 * Instantiates verified external adapters for MOCK, UAT, and PROD modes.
 * Enforces production environment safety guards and configuration controls.
 */

import {
  IntegrationClients,
  IntegrationClientOptions,
  IntegrationMode,
} from './types.js';
import { assertSafeEnvironment } from './security.js';
import {
  MockDhaHieClient,
  MockShaClaimsClient,
  MockKraEtimsClient,
  MockMpesaPaymentClient,
} from './mock-clients.js';
import {
  RemoteDhaHieClient,
  RemoteShaClaimsClient,
  RemoteKraEtimsClient,
  RemoteMpesaClient,
} from './remote-clients.js';

const DEFAULT_SANDBOX_DHA_URL = 'https://sandbox.hie.dha.go.ke';
const DEFAULT_SANDBOX_SHA_URL = 'https://sandbox.claims.sha.go.ke';
const DEFAULT_SANDBOX_ETIMS_URL = 'https://sandbox.etims.kra.go.ke';
const DEFAULT_SANDBOX_MPESA_URL = 'https://sandbox.safaricom.co.ke';

const DEFAULT_PROD_DHA_URL = 'https://api.hie.dha.go.ke';
const DEFAULT_PROD_SHA_URL = 'https://api.claims.sha.go.ke';
const DEFAULT_PROD_ETIMS_URL = 'https://etims.kra.go.ke';
const DEFAULT_PROD_MPESA_URL = 'https://api.safaricom.co.ke';

/**
 * Creates integration clients configured for MOCK, UAT, or PROD operation.
 */
export function createIntegrationClients(
  options: IntegrationClientOptions | IntegrationMode = 'MOCK',
): IntegrationClients {
  const opts: IntegrationClientOptions =
    typeof options === 'string' ? { mode: options } : options;

  const mode: IntegrationMode = opts.mode || 'MOCK';

  // 1. MOCK Mode: In-memory synthetic simulation (Zero network traffic)
  if (mode === 'MOCK') {
    const dhaHie = new MockDhaHieClient();
    const sha = new MockShaClaimsClient();
    const kraEtims = new MockKraEtimsClient();
    const mpesa = new MockMpesaPaymentClient();

    return {
      mode: 'MOCK',
      dhaHie,
      shaEligibility: sha,
      shaPreauth: sha,
      shaClaims: sha,
      kraEtims,
      mpesa,
    };
  }

  // 2. Resolve Base URLs based on mode
  const isProd = mode === 'PROD';
  const dhaBaseUrl = opts.dhaBaseUrl || (isProd ? DEFAULT_PROD_DHA_URL : DEFAULT_SANDBOX_DHA_URL);
  const shaBaseUrl = opts.shaBaseUrl || (isProd ? DEFAULT_PROD_SHA_URL : DEFAULT_SANDBOX_SHA_URL);
  const etimsBaseUrl = opts.etimsBaseUrl || (isProd ? DEFAULT_PROD_ETIMS_URL : DEFAULT_SANDBOX_ETIMS_URL);
  const mpesaBaseUrl = opts.mpesaBaseUrl || (isProd ? DEFAULT_PROD_MPESA_URL : DEFAULT_SANDBOX_MPESA_URL);

  // 3. Enforce Safety Guard
  assertSafeEnvironment(mode, dhaBaseUrl);
  assertSafeEnvironment(mode, shaBaseUrl);
  assertSafeEnvironment(mode, etimsBaseUrl);
  assertSafeEnvironment(mode, mpesaBaseUrl);

  const clientOpts = {
    mode,
    defaultTimeoutMs: opts.timeoutMs ?? 5000,
    maxRetries: opts.maxRetries ?? 2,
  };

  const dhaHie = new RemoteDhaHieClient({
    ...clientOpts,
    baseUrl: dhaBaseUrl,
  });

  const sha = new RemoteShaClaimsClient({
    ...clientOpts,
    baseUrl: shaBaseUrl,
  });

  const kraEtims = new RemoteKraEtimsClient({
    ...clientOpts,
    baseUrl: etimsBaseUrl,
  });

  const mpesa = new RemoteMpesaClient({
    ...clientOpts,
    baseUrl: mpesaBaseUrl,
  });

  return {
    mode,
    dhaHie,
    shaEligibility: sha,
    shaPreauth: sha,
    shaClaims: sha,
    kraEtims,
    mpesa,
  };
}
