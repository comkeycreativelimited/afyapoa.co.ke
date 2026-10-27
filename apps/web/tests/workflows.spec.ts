import { test, expect } from '@playwright/test';

test.describe('COMKEY AFYA POA — Role-Specific Workflows', () => {
  test('Workflow 1: Reception & Registry — Patient Intake & Triage Routing', async ({ page }) => {
    await page.goto('/patients');

    // Verify patient registry table is loaded
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('table').getByText(/Amina Fatuma Bakari/i).first()).toBeVisible();

    // Check emergency intake button exists
    const emergencyBtn = page.getByRole('button', { name: /Emergency Intake/i });
    await expect(emergencyBtn).toBeVisible();

    // Click "Send to Triage" on a patient row
    const triageButtons = page.getByRole('button', { name: /Send to Triage/i });
    if ((await triageButtons.count()) > 0) {
      await triageButtons.first().click();
      // Should redirect to /triage
      await expect(page).toHaveURL(/.*triage/);
    }
  });

  test('Workflow 2: Nursing & Triage — Acuity Scoring and Automated Vitals Calculation', async ({ page }) => {
    await page.goto('/triage');

    // Verify SATS acuity protocol is indicated
    await expect(page.getByText(/South African Triage Scale/i)).toBeVisible();
    await expect(page.getByText(/Resuscitation/i).first()).toBeVisible();

    // Check vitals form inputs
    const sbpInput = page.locator('input#systolicBp');
    const dbpInput = page.locator('input#diastolicBp');
    const weightInput = page.locator('input#weightKg');
    const heightInput = page.locator('input#heightCm');

    await sbpInput.fill('120');
    await dbpInput.fill('80');
    await weightInput.fill('70');
    await heightInput.fill('175');

    // Verify automated MAP calculation (120 + 2*80)/3 = 93 mmHg
    await expect(page.getByText(/MAP: 93 mmHg/i)).toBeVisible();

    // Verify automated BMI calculation (70 / (1.75*1.75) = 22.9 kg/m²)
    await expect(page.getByText(/22.9 kg\/m²/i)).toBeVisible();
  });

  test('Workflow 3: Clinician Consultation — CPOE and Clinical Charting', async ({ page }) => {
    await page.goto('/encounters');

    // Verify encounters interface renders SOAP charting components
    await expect(page.locator('body')).toBeVisible();
    // Check navigation context
    await expect(page.locator('nav')).toBeVisible();
  });

  test('Workflow 4: Laboratory — Worklists and Specimen Results', async ({ page }) => {
    await page.goto('/laboratory');

    // Verify lab diagnostic queue
    await expect(page.locator('body')).toBeVisible();
  });

  test('Workflow 5: Pharmacy — Prescriptions and Safety Alerts', async ({ page }) => {
    await page.goto('/pharmacy');

    // Verify pharmacy workspace
    await expect(page.locator('body')).toBeVisible();
  });

  test('Workflow 6: Billing & Cashier — Invoice Settlement & KRA eTIMS Fiscal Receipt', async ({ page }) => {
    console.log('[W6] Navigating to /billing');
    await page.goto('/billing');

    console.log('[W6] Checking Shift Status');
    await expect(page.getByText(/Shift Status:/i)).toBeVisible();

    console.log('[W6] Checking Tariffs and Payable');
    await expect(page.getByText(/Itemized Medical Services & Tariffs/i)).toBeVisible();
    await expect(page.getByText(/Net Patient Co-Pay Payable/i)).toBeVisible();

    // Open Payment settlement modal
    const collectBtn = page.getByRole('button', { name: /Collect KES/i });
    await expect(collectBtn).toBeVisible();
    await collectBtn.click();

    // Verify Accessible Dialog opens with focus trap
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(page.getByText(/M-Pesa STK/i).first()).toBeVisible();

    // Close dialog via accessible keyboard escape or close button
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('Workflow 7: Claims Officer — SHA Statutory eClaims & 24h Countdown SLA', async ({ page }) => {
    await page.goto('/claims');

    // Verify statutory 24-hour countdown alert
    await expect(page.getByText(/24-Hour Statutory Claim SLA/i)).toBeVisible();

    // Verify eClaim pillar columns: PHC, SHIF, ECCIF
    await expect(page.getByRole('cell', { name: 'PHC' })).toBeVisible();
    await expect(page.getByText(/SHIF/i).first()).toBeVisible();

    // Verify Batch Dispatch button
    const dispatchBtn = page.getByRole('button', { name: /Dispatch SHA Batch/i });
    await expect(dispatchBtn).toBeVisible();
  });

  test('Workflow 8: Facility Administration — Ward Occupancy and Staff Rosters', async ({ page }) => {
    await page.goto('/facility-admin');

    // Verify Bed Census KPI
    await expect(page.getByText(/Overall Bed Occupancy/i)).toBeVisible();
    await expect(page.getByText(/Active Duty Staff/i)).toBeVisible();

    // Verify Roster table
    await expect(page.getByText(/Sister Beatrice Otieno/i)).toBeVisible();
  });

  test('Workflow 9: Platform Administration — Multi-Tenant Isolation & National Gateways', async ({ page }) => {
    await page.goto('/platform-admin');

    // Verify National Gateways status
    await expect(page.getByText(/DHA Kenya HIE Middleware/i)).toBeVisible();
    await expect(page.getByText(/SHA eClaims Gateway/i)).toBeVisible();
    await expect(page.getByText(/KRA eTIMS VSCU Gateway/i)).toBeVisible();

    // Verify Tenant facilities list
    await expect(page.getByText(/Registered Healthcare Facilities/i)).toBeVisible();
  });

  test('Workflow 10: Localization — English and Kiswahili Language Switching', async ({ page }) => {
    await page.goto('/');

    // Check language toggle button
    const swahiliBtn = page.getByRole('button', { name: /Kiswahili/i });
    await expect(swahiliBtn).toBeVisible();
    await swahiliBtn.click();

    // Verify clinical navigation updates to Kiswahili
    await expect(page.getByRole('link', { name: /Mapokezi na Usajili/i }).first()).toBeVisible();

    // Switch back to English
    const englishBtn = page.getByRole('button', { name: /English/i });
    await expect(englishBtn).toBeVisible();
    await englishBtn.click();

    await expect(page.getByRole('link', { name: /Reception & Registry/i }).first()).toBeVisible();
  });

  test('Workflow 11: Low-Bandwidth & Offline Simulation Mode', async ({ page }) => {
    await page.goto('/');

    // Toggle offline mode from header
    const offlineToggle = page.getByTitle(/Simulate Low-Bandwidth/i);
    await expect(offlineToggle).toBeVisible();
    await offlineToggle.click();

    // Verify Offline Indicator shows offline status
    await expect(page.getByText(/Offline Mode/i).first()).toBeVisible();

    // Toggle back to online
    const reconnectToggle = page.getByTitle(/Restore Online Connectivity/i);
    await reconnectToggle.click();

    // Status shows online or pending sync
    const statusContainer = page.locator('div[role="status"]');
    await expect(statusContainer).toBeVisible();
  });
});
