# COMKEY AFYA POA — User Manual: Pharmacy & Medication-Dispensing

## 1. Introduction & Operational Scope

This Standard Operating Procedure (SOP) manual instructs clinical pharmacists, dispensary technicians, ward nurses, and inventory managers on using the **Pharmacy and Medication-Dispensing Module** in COMKEY AFYA POA.

The module enforces:
1. **Kenyan Pharmacy and Poisons Board (PPB) Cap 244** legal compliance for Schedule Part 1/Part 2 poisons and controlled narcotics.
2. **First-Expiring, First-Out (FEFO)** automated batch allocation to eliminate pharmaceutical inventory expiration wastage.
3. **Multi-tier partial dispensing workflows** allowing patients to collect immediate acute supplies while reserving or tracking unfulfilled balances.
4. **Controlled returns and reversals** mandating $\ge 10$ character clinical justifications to maintain unbroken audit trails.
5. **Bedside administration logging** validating the 5 Rights of Medication Administration.

---

## 2. Standard Operating Procedures (SOPs)

### SOP-PHARM-01: Processing Electronic Prescriptions (CPOE Intake)

1. **Accessing the Worklist:**
   - Log in with your clinical credentials (e.g. `pharm.njeri`).
   - Navigate to **Pharmacy & Dispensing** from the main navigation or visit `/pharmacy`.
   - The **Prescription Worklist** displays all active electronic orders from outpatient and inpatient encounters.
2. **Reviewing the Prescription:**
   - Verify the patient identity: Full Name, Patient Number (MRN), Age, and Gender.
   - Confirm the Prescribing Clinician's authorized credentials.
   - Review the medication display name, Kenya Essential Medicines List (KEML 2023) code, dose, route, frequency, and instructions.
   - Note special priority badges: `ROUTINE`, `URGENT`, or flashing red `STAT` badges.
3. **Generic Substitution Check:**
   - Check the **Generic OK** or **No Generic Sub** indicator.
   - If the clinician flagged `substitutionAllowed: false`, the brand-name product prescribed must be dispensed.
   - If generic substitution is allowed, alternative bioequivalent formulations may be selected with documentation of substitution notes.

---

### SOP-PHARM-02: Executing Medication Dispensation with FEFO Allocation

1. **Initiating Dispense:**
   - On the target prescription row, click **Dispense (FEFO)**.
   - The Dispensing Drawer opens with the patient chart and prescription details.
2. **Automated FEFO Allocation:**
   - The system automatically selects the inventory batch with the **earliest statutory expiration date** that holds unreserved stock.
   - The drawer displays the allocated Batch Number, Expiry Date, Days to Expiry, and current on-hand units.
3. **Batch Override (Clinical Exception):**
   - If physical inspection reveals damaged packaging or the patient requires a specific formulation, select a secondary batch from the dropdown.
   - An audit record will document the manual override.
4. **Quantity Selection & Partial Dispensing:**
   - Enter the quantity to dispense.
   - **Full Dispense:** Enter the entire remaining balance. The prescription transitions to `FULLY_DISPENSED` and clears from the active queue.
   - **Partial Dispense:** If the patient can only afford a partial course or dispensary stock is split, enter the partial quantity (e.g. 12 of 24 tablets).
   - The system records a `PARTIAL` dispense. The prescription remains on the worklist flagged as `PARTIALLY_DISPENSED` with remaining units clearly tracked.
   - When the patient returns for the remainder, enter the balance quantity. The system automatically tags the fulfillment as `BALANCE_COMPLETION`.
5. **Patient Counseling Documentation:**
   - Review or update counseling notes (e.g., "Take with food", "Complete full 5-day course").
   - Click **Confirm Dispensation**.
   - Database row-level locks prevent negative stock or duplicate simultaneous dispenses.

---

### SOP-PHARM-03: Controlled Returns, Reversals, and Corrections

1. **Clinical Justification Mandate:**
   - In compliance with PPB Cap 244, dispensations may never be silently deleted or erased.
   - A controlled reversal must be performed via the **Controlled Return** workflow.
2. **Processing a Return:**
   - Click **Controlled Return** in the top navigation bar.
   - Enter the target Dispense Reference ID (e.g. `DISP-2026-00412`).
   - Enter a **clinical justification of at least 10 characters** (e.g., "Patient developed allergic rash prior to leaving dispensary counter; returned intact, sealed blister pack.").
   - Click **Authorize Return to Stock**.
3. **Audit Ledger Result:**
   - The original dispense status is updated to `ENTERED_IN_ERROR`.
   - On-hand stock is automatically credited back to the original batch.
   - An immutable `RETURN_TO_STOCK` movement record is published to the audit ledger.

---

### SOP-PHARM-04: Receiving Stock from Suppliers & Cold-Chain Intake

1. **Intake Verification:**
   - Click **Receive Stock**.
   - Select the approved pharmaceutical supplier (e.g., `KEMSA`, `MEDS`, `Cosmos Pharma`, `Dawa Ltd`).
   - Enter the physical Batch Number, Expiry Date, Quantity Received, Acquisition Unit Cost, and Retail Price.
2. **Cold-Chain Verification (2–8°C Items):**
   - For insulin, oxytocin, vaccines, or blood products, inspect the temperature logger on arrival.
   - Confirm storage condition as `REFRIGERATED` and designate storage location to `COLD-FRIDGE-1 (2-8°C)`.
   - Record temperature log reading in the consignment notes.
3. **Commitment:**
   - Click **Record Stock Inflow**.
   - The batch is immediately activated and available for automated FEFO allocation.

---

### SOP-NURSE-01: Bedside Medication Administration (Ward Nurses)

1. **5 Rights Verification:**
   - Before administering any medication at the bedside, verify:
     1. **Right Patient:** Confirm verbal name and match hospital wristband MRN.
     2. **Right Drug:** Confirm drug name and concentration against doctor's order.
     3. **Right Dose:** Verify physical measurement.
     4. **Right Route:** Confirm route (`ORAL`, `INTRAVENOUS`, `INTRAMUSCULAR`, etc.).
     5. **Right Time:** Confirm scheduled administration window.
2. **Logging Administration:**
   - On the **Bedside Administration** tab, record the actual administered dose, route, anatomical site (e.g., "Left deltoid", "Right gluteal"), and patient tolerance notes.
   - If the dose was withheld due to clinical parameters (e.g. low blood pressure or nausea) or patient refusal, record status as `WITHHELD` or `REFUSED` with mandatory explanation.
3. **Real-Time EHR Integration:**
   - Submissions immediately generate an HL7 FHIR R4 `MedicationAdministration` resource visible to attending physicians.
