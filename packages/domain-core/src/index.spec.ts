import { describe, it, expect } from 'vitest';
import { Result, NotFoundError, FacilityLevel, UserRole } from './index.js';

describe('Domain Core Primitives', () => {
  it('Result.ok should wrap value and report success', () => {
    const res = Result.ok('success_data');
    expect(res.isSuccess()).toBe(true);
    expect(res.isFailure()).toBe(false);
    expect(res.getValue()).toBe('success_data');
  });

  it('Result.fail should wrap error and report failure', () => {
    const error = new NotFoundError('Item not found');
    const res = Result.fail(error);
    expect(res.isSuccess()).toBe(false);
    expect(res.isFailure()).toBe(true);
    expect(res.getError().statusCode).toBe(404);
    expect(res.getError().code).toBe('NOT_FOUND');
    expect(() => res.getValue()).toThrow();
  });

  it('should define Kenyan facility levels and roles properly', () => {
    expect(FacilityLevel.LEVEL_5_COUNTY_REFERRAL).toBe('LEVEL_5');
    expect(FacilityLevel.LEVEL_2_DISPENSARY).toBe('LEVEL_2');
    expect(UserRole.CLINICIAN).toBe('CLINICIAN');
  });
});
