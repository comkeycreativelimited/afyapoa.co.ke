import { describe, it, expect } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const controller = new HealthController();

  it('should return liveness status ok', () => {
    const liveness = controller.getLiveness();
    expect(liveness.status).toBe('ok');
    expect(liveness.service).toBe('comkey-afyapoa-api');
    expect(typeof liveness.uptimeSeconds).toBe('number');
  });

  it('should return general health as liveness', () => {
    const general = controller.getGeneral();
    expect(general.status).toBe('ok');
  });
});
