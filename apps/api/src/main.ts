import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { config } from '@afyapoa/config';
import { logger } from '@afyapoa/logger';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: false, // Configured manually below for strict security controls
    logger: ['error', 'warn', 'log'],
  });

  // 1. Helmet HTTP Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 2. Strict CORS Configuration
  app.enableCors({
    origin: (origin, callback) => {
      // In production, validate against allowed tenant domains
      if (!origin || origin.startsWith('http://localhost:') || origin.endsWith('.afyapoa.co.ke')) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy: Not allowed by CORS origin restrictions'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-tenant-id',
      'x-facility-id',
      'x-request-id',
      'x-idempotency-key',
    ],
    maxAge: 3600,
  });

  // Global prefix for API endpoints (excluding health)
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'health/liveness', 'health/readiness'],
  });

  // Global Request Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global Exception Filter (Standardized RFC 7807 / ApiErrorResponse)
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global Response Transform Interceptor (Standardized ApiResponse<T> envelope)
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  // OpenAPI / Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('COMKEY AFYA POA API')
    .setDescription(
      'Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities (Levels 2-6) aligned with DHA HIE, SHA eClaims, and KRA eTIMS',
    )
    .setVersion('0.1.0')
    .addTag('Health & Monitoring')
    .addTag('Authentication & IAM')
    .addTag('Patient Records (Multi-Tenant Demo)')
    .addTag('Platform Administration (Super Admin Only)')
    .addTag('National Integrations (DHA / SHA / eTIMS)')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT bearer token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-tenant-id',
        in: 'header',
        description: 'Tenant ID header (Allowed only for Super-Admin cross-tenant administration)',
      },
      'tenant-id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'COMKEY AFYA POA API Docs',
  });

  const port = config.PORT;
  await app.listen(port);
  logger.info(`[COMKEY AFYA POA API] Server running on port ${port}`, {
    port,
    docsUrl: `http://localhost:${port}/api/docs`,
    healthUrl: `http://localhost:${port}/health/readiness`,
    driver: config.INTEGRATION_DRIVER,
  });
}

bootstrap().catch((err) => {
  logger.error('[API FATAL] Failed to bootstrap NestJS application', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
