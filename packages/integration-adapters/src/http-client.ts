/**
 * COMKEY AFYA POA — Resilient HTTP Integration Client
 * Provides configurable timeouts, bounded retries with jitter, and structured error handling.
 */

import { IntegrationError, IntegrationErrorCode, IntegrationMode } from './types.js';
import { assertSafeEnvironment, createCorrelationHeaders, sanitizeForLogging } from './security.js';

export interface HttpClientOptions {
  mode: IntegrationMode;
  baseUrl: string;
  defaultTimeoutMs?: number;
  maxRetries?: number;
  baseRetryDelayMs?: number;
}

export class ResilientHttpClient {
  private readonly mode: IntegrationMode;
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseRetryDelayMs: number;

  // Circuit breaker state
  private failureCount = 0;
  private circuitOpenUntil = 0;
  private readonly circuitFailureThreshold = 5;
  private readonly circuitResetTimeoutMs = 15000;

  constructor(options: HttpClientOptions) {
    this.mode = options.mode;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 5000;
    this.maxRetries = options.maxRetries ?? 2;
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? 200;
  }

  async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      headers?: Record<string, string>;
      body?: unknown;
      facilityCode: string;
      correlationId?: string;
      timeoutMs?: number;
      skipRetries?: boolean;
    },
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;

    // 1. Guard against accidental production invocation
    assertSafeEnvironment(this.mode, url);

    // 2. Check circuit breaker
    const now = Date.now();
    if (this.circuitOpenUntil > now) {
      const waitRemaining = Math.ceil((this.circuitOpenUntil - now) / 1000);
      throw new IntegrationError(
        IntegrationErrorCode.CIRCUIT_OPEN,
        `Circuit breaker is OPEN for ${this.baseUrl} due to repeated upstream failures. Retry in ${waitRemaining}s.`,
        503,
        options.correlationId,
        false,
      );
    }

    const method = options.method || 'GET';
    const correlationHeaders = createCorrelationHeaders(
      options.facilityCode,
      options.correlationId,
      options.headers,
    );
    const correlationId = correlationHeaders['X-Correlation-Id'];

    const effectiveTimeout = options.timeoutMs ?? this.defaultTimeoutMs;
    const maxAttempts = options.skipRetries ? 1 : this.maxRetries + 1;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), effectiveTimeout);

      try {
        const fetchOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...correlationHeaders,
          },
          signal: controller.signal,
        };

        if (options.body && method !== 'GET') {
          fetchOptions.body = JSON.stringify(options.body);
        }

        const response = await fetch(url, fetchOptions);
        clearTimeout(timer);

        // Success - reset circuit breaker
        if (response.ok) {
          this.failureCount = 0;
          this.circuitOpenUntil = 0;

          if (response.status === 204) {
            return {} as T;
          }

          const responseData = await response.json();
          return responseData as T;
        }

        // Handle HTTP error responses
        const status = response.status;
        let responseJson: Record<string, unknown> = {};
        try {
          responseJson = (await response.json()) as Record<string, unknown>;
        } catch {
          responseJson = { message: response.statusText };
        }

        const errorMsg =
          (responseJson.message as string) ||
          (responseJson.error as string) ||
          `HTTP ${status} ${response.statusText}`;

        // Map status code to integration error code
        let errCode = IntegrationErrorCode.GATEWAY_ERROR;
        let retryable = false;

        if (status === 400) {
          errCode = IntegrationErrorCode.VALIDATION_FAILED;
        } else if (status === 401) {
          errCode = IntegrationErrorCode.AUTH_FAILED;
        } else if (status === 403) {
          errCode = IntegrationErrorCode.FORBIDDEN;
        } else if (status === 404) {
          errCode = IntegrationErrorCode.NOT_FOUND;
        } else if (status === 409) {
          errCode = IntegrationErrorCode.DUPLICATE_SUBMISSION;
        } else if (status === 422) {
          errCode = IntegrationErrorCode.VALIDATION_FAILED;
        } else if (status === 429) {
          errCode = IntegrationErrorCode.RATE_LIMITED;
          retryable = true;
        } else if (status >= 500) {
          errCode = IntegrationErrorCode.SERVICE_UNAVAILABLE;
          retryable = true;
        }

        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : undefined;

        const integrationError = new IntegrationError(
          errCode,
          errorMsg,
          status,
          correlationId,
          retryable,
          retryAfterMs,
          sanitizeForLogging(responseJson) as Record<string, unknown>,
        );

        if (!retryable || attempt === maxAttempts) {
          this.recordFailure();
          throw integrationError;
        }

        lastError = integrationError;
      } catch (err: unknown) {
        clearTimeout(timer);

        if (err instanceof IntegrationError && !err.retryable) {
          throw err;
        }

        const isAbort = (err as { name?: string })?.name === 'AbortError';
        const isTimeout = isAbort || (err as { code?: string })?.code === 'ETIMEDOUT';

        const retryable = true;
        const errCode = isTimeout ? IntegrationErrorCode.TIMEOUT : IntegrationErrorCode.SERVICE_UNAVAILABLE;
        const errMsg = isTimeout
          ? `Request timed out after ${effectiveTimeout}ms: ${method} ${url}`
          : (err as Error)?.message || 'Network communication failure';

        lastError = new IntegrationError(errCode, errMsg, isTimeout ? 504 : 503, correlationId, retryable);

        if (attempt === maxAttempts) {
          this.recordFailure();
          throw lastError;
        }
      }

      // Compute exponential backoff with jitter before retrying
      const jitter = Math.random() * 50;
      const delayMs = Math.min(2000, this.baseRetryDelayMs * Math.pow(2, attempt - 1) + jitter);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw lastError || new IntegrationError(IntegrationErrorCode.SERVICE_UNAVAILABLE, 'Request execution failed', 503, correlationId);
  }

  private recordFailure() {
    this.failureCount++;
    if (this.failureCount >= this.circuitFailureThreshold) {
      this.circuitOpenUntil = Date.now() + this.circuitResetTimeoutMs;
    }
  }
}
