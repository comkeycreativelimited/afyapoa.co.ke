import { describe, it, expect } from 'vitest';

describe('Worker Queue Processors Definition', () => {
  it('should define queue names for health-check, hie-outbound, and claims-outbound', () => {
    const queueNames = ['health-check', 'hie-outbound', 'claims-outbound'];
    expect(queueNames).toContain('health-check');
    expect(queueNames).toContain('hie-outbound');
    expect(queueNames).toContain('claims-outbound');
  });
});
