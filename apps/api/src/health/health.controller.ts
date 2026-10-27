import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import postgres from 'postgres';
import Redis from 'ioredis';
import { config } from '@afyapoa/config';

@ApiTags('Health & Monitoring')
@Controller('health')
export class HealthController {
  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe for orchestrators (Kubernetes/ECS)' })
  @ApiResponse({ status: 200, description: 'Service process is alive' })
  getLiveness() {
    return {
      status: 'ok',
      service: 'comkey-afyapoa-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
    };
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Readiness probe checking database and redis connectivity' })
  @ApiResponse({ status: 200, description: 'Service is ready to handle traffic' })
  @ApiResponse({ status: 503, description: 'One or more downstream dependencies are unavailable' })
  async getReadiness() {
    const checks: Record<string, { status: 'up' | 'down'; latencyMs?: number; error?: string }> = {};
    let isHealthy = true;

    // 1. PostgreSQL check
    const dbStart = Date.now();
    try {
      const sql = postgres(config.DATABASE_URL, { max: 1, connect_timeout: 3 });
      await sql`SELECT 1 as alive;`;
      await sql.end();
      checks.database = {
        status: 'up',
        latencyMs: Date.now() - dbStart,
      };
    } catch (err: unknown) {
      isHealthy = false;
      checks.database = {
        status: 'down',
        error: err instanceof Error ? err.message : 'Database connection error',
      };
    }

    // 2. Redis check
    const redisStart = Date.now();
    try {
      const redis = new Redis(config.REDIS_URL, { connectTimeout: 3000, maxRetriesPerRequest: 1 });
      const pong = await redis.ping();
      await redis.quit();
      checks.redis = {
        status: pong === 'PONG' ? 'up' : 'down',
        latencyMs: Date.now() - redisStart,
      };
    } catch (err: unknown) {
      isHealthy = false;
      checks.redis = {
        status: 'down',
        error: err instanceof Error ? err.message : 'Redis connection error',
      };
    }

    const response = {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };

    if (!isHealthy) {
      throw new HttpException(response, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return response;
  }

  @Get()
  @ApiOperation({ summary: 'General health check' })
  getGeneral() {
    return this.getLiveness();
  }
}
