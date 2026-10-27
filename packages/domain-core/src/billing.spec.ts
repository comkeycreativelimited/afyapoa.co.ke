import { describe, it, expect } from 'vitest';
import {
  TaxCode,
  roundCurrency,
  calculateLineItemTotals,
  calculateInvoiceTotals,
  checkDiscountRequiresApproval,
  formatCurrencyKES,
  BillingCategory,
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  PaymentStatus,
  AdjustmentType,
  AdjustmentStatus,
} from './index.js';

describe('Domain Core — Billing & Payments Financial Logic', () => {
  describe('Rounding & Precision', () => {
    it('should round numbers accurately to 2 decimal places preventing floating point drift', () => {
      expect(roundCurrency(10.005)).toBe(10.01);
      expect(roundCurrency(10.004)).toBe(10);
      expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
      expect(roundCurrency(1234.5678)).toBe(1234.57);
    });

    it('should format Kenyan Shillings correctly', () => {
      expect(formatCurrencyKES(1500)).toBe('KES 1,500.00');
      expect(formatCurrencyKES(1250000.5)).toBe('KES 1,250,000.50');
    });
  });

  describe('Line Item Calculations & KRA Tax Framework', () => {
    it('should calculate VAT exempt medical consultation (Tax Code E)', () => {
      const line = calculateLineItemTotals({
        quantity: 1,
        unitPrice: 1500,
        taxCode: TaxCode.E,
      });

      expect(line.grossAmount).toBe(1500);
      expect(line.discountAmount).toBe(0);
      expect(line.taxAmount).toBe(0);
      expect(line.netAmount).toBe(1500);
      expect(line.shaCoverageAmount).toBe(0);
      expect(line.patientPayableAmount).toBe(1500);
    });

    it('should calculate standard rated non-clinical item (Tax Code A at 16%)', () => {
      const line = calculateLineItemTotals({
        quantity: 2,
        unitPrice: 500,
        discountAmount: 100,
        taxCode: TaxCode.A,
      });

      // Gross = 1000, discount = 100, taxable = 900
      // Tax = 900 * 0.16 = 144
      // Net = 900 + 144 = 1044
      expect(line.grossAmount).toBe(1000);
      expect(line.discountAmount).toBe(100);
      expect(line.taxAmount).toBe(144);
      expect(line.netAmount).toBe(1044);
      expect(line.patientPayableAmount).toBe(1044);
    });

    it('should calculate SHA coverage split with patient copay', () => {
      const line = calculateLineItemTotals({
        quantity: 1,
        unitPrice: 2000,
        taxCode: TaxCode.E,
        shaCoverageAmount: 1500,
      });

      expect(line.netAmount).toBe(2000);
      expect(line.shaCoverageAmount).toBe(1500);
      expect(line.patientPayableAmount).toBe(500);
    });
  });

  describe('Aggregate Invoice Totals & Balance Due', () => {
    it('should aggregate subtotal, discounts, tax, SHA portion and patient balance due', () => {
      const line1 = calculateLineItemTotals({
        quantity: 1,
        unitPrice: 1500,
        taxCode: TaxCode.E,
        shaCoverageAmount: 1000,
      });

      const line2 = calculateLineItemTotals({
        quantity: 10,
        unitPrice: 15, // Pharmacy: Paracetamol 500mg
        taxCode: TaxCode.E,
      });

      const line3 = calculateLineItemTotals({
        quantity: 1,
        unitPrice: 800, // Lab: Full Blood Count
        taxCode: TaxCode.E,
        discountAmount: 80,
      });

      const totals = calculateInvoiceTotals([line1, line2, line3], 200);

      // line1: gross 1500, disc 0, net 1500, sha 1000, patient 500
      // line2: gross 150, disc 0, net 150, sha 0, patient 150
      // line3: gross 800, disc 80, net 720, sha 0, patient 720
      // Subtotal: 1500 + 150 + 800 = 2450
      // Discount: 80
      // Total Gross Net: 1500 + 150 + 720 = 2370
      // SHA Total: 1000
      // Patient Payable: 500 + 150 + 720 = 1370
      // Paid: 200
      // Balance Due: 1370 - 200 = 1170
      expect(totals.subtotalAmount).toBe(2450);
      expect(totals.discountAmount).toBe(80);
      expect(totals.taxAmount).toBe(0);
      expect(totals.totalAmount).toBe(2370);
      expect(totals.shaPortionAmount).toBe(1000);
      expect(totals.patientPortionAmount).toBe(1370);
      expect(totals.balanceDue).toBe(1170);
    });
  });

  describe('Segregation of Duties & Discount Approval Thresholds', () => {
    it('should allow small cashier discounts without supervisor approval', () => {
      const check = checkDiscountRequiresApproval(500, 10000);
      expect(check.requiresApproval).toBe(false);
    });

    it('should flag discounts exceeding fixed KES threshold (e.g. > KES 1,000)', () => {
      const check = checkDiscountRequiresApproval(1500, 20000, 1000, 10);
      expect(check.requiresApproval).toBe(true);
      expect(check.reason).toContain('exceeds cashier limit');
    });

    it('should flag discounts exceeding percentage threshold (e.g. > 10%)', () => {
      const check = checkDiscountRequiresApproval(600, 2000, 1000, 10);
      // 600 / 2000 = 30% > 10%
      expect(check.requiresApproval).toBe(true);
      expect(check.reason).toContain('30.0% exceeds cashier limit of 10%');
    });
  });
});
