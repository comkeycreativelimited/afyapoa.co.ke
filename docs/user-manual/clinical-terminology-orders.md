# COMKEY AFYA POA - User Manual: Clinical Terminology & CPOE Orders

**Target Audience:** Medical Officers, Clinical Officers, Nursing Officers, Pharmacists, and Laboratory Technologists.  
**Applicable Standards:** WHO ICD-11 MMS (Release 2024-01), Kenya Essential Medicines List (KEML 2023), LOINC v2.76, Kenya Core FHIR Interoperability Guidelines.

---

## 1. Overview & Regulatory Notice

The **COMKEY AFYA POA** Clinical Terminology and Computerized Provider Order Entry (CPOE) module enables authorized clinicians to record structured patient diagnoses and place computerized medication and diagnostic requests.

> [!CAUTION]
> **Clinical Safety Policy**:
> 1. AFYA POA does **not** provide autonomous treatment recommendations or automated algorithm-based prescribing. All clinical choices are the sole responsibility of the licensed human clinician.
> 2. Clinical order records represent the clinician's **ordering intent**. They are strictly isolated from pharmacy dispensing logs and laboratory resulting observations.
> 3. Invented, arbitrary codes are prohibited. Diagnoses and orders must conform to authentic Kenyan terminology catalogues.

---

## 2. Diagnoses Entry & Management

### 2.1 Standard Diagnostic Systems
- **Kenya Primary Standard:** **WHO ICD-11 MMS** (Morbidity and Mortality Statistics, 2024-01 Release).
- **Secondary Compatibility:** **WHO ICD-10** (for legacy billing and historical records).

### 2.2 Recording a Diagnosis
1. Open the patient's active encounter from the **Outpatient Clinical Documentation** screen.
2. Click the **CPOE & Terminology** tab.
3. In the **Clinical Diagnoses Entry** section:
   - Use the **Quick Catalogue Picker** for high-frequency conditions (e.g. `BA00` Essential hypertension, `1F40` Malaria, `5A11` Type 2 Diabetes, `CA40` Pneumonia), or enter an authentic ICD-11 code directly.
   - Choose the diagnosis type: `CONFIRMED`, `WORKING`, `PRESUMPTIVE`, or `DIFFERENTIAL`.
   - Toggle **Primary Diagnosis** if this condition is the primary clinical driver of the visit.
   - Enter relevant clinical reasoning in the notes field.
4. Click **Record Diagnosis**. The system validates the code against the imported WHO catalogue and binds the diagnosis to the encounter.

### 2.3 FHIR R4 Interoperability Export
Click the **FHIR R4 Condition** button next to any recorded diagnosis to inspect or copy the standardized FHIR JSON payload for transmission to the Kenya National Health Information Exchange (HIE / DHA).

---

## 3. Computerized Provider Order Entry (CPOE)

### 3.1 Medication Requests (Prescriptions)
1. Select the medication from the **Kenya Essential Medicines List (KEML 2023)** formulary dropdown.
2. Specify the precise posology:
   - **Dosage:** e.g., `10mg`, `500mg`.
   - **Route:** `ORAL`, `INTRAVENOUS`, `INTRAMUSCULAR`, `SUBCUTANEOUS`, `INHALATION`, `TOPICAL`.
   - **Frequency:** `OD` (once daily), `BD` (twice daily), `TDS` (three times daily), `QID` (four times daily), `PRN` (as needed).
   - **Duration:** Number of days.
   - **Dispense Quantity:** Total units to dispense.
   - **Clinical Indication:** Diagnostic reason for prescription.
3. Click **Place Medication Order**.

### 3.2 Duplicate Prescription Guard
- If an active order for the same item code already exists for this patient within **24 hours**, the system intercepts the request with a **Duplicate Order Warning**.
- To prevent accidental overprescribing, you must either **Abort Duplicate** or enter a mandatory clinician rationale ($\ge 10$ characters) to confirm the intentional dose adjustment or replacement.

### 3.3 Diagnostic & Laboratory Service Requests
1. In the **Diagnostic & Lab Request** section, select the desired test (e.g. `2160-0` Creatinine, `57021-8` Malaria Rapid Test, `718-7` Hemoglobin).
2. Choose the priority:
   - `ROUTINE`: Standard clinic turnaround.
   - `URGENT`: Expedited outpatient workup.
   - `STAT`: Immediate casualty/emergency processing.
3. Verify the **Specimen Protocol** (e.g. Serum, Whole Blood, Urine).
4. Enter the clinical question or indication.
5. Click **Place Diagnostic Request**.

---

## 4. Order Lifecycle Management

### 4.1 Order Review & Authorization
- Orders placed by clinical staff start in `ACTIVE` or `DRAFT` status.
- Attending medical officers review active orders and click **Authorize**. This records a tamper-evident digital signature and locks the order details for pharmacy or laboratory pickup.

### 4.2 Order Cancellation
- If a patient develops a contraindication or an order is no longer clinically necessary, click **Cancel**.
- By Kenyan medical record standards, you must provide a detailed clinical reason ($\ge 10$ characters). The order status changes to `CANCELLED` (strikethrough in view), preserving full audit trails.

### 4.3 Order Amendments
- To adjust the dose or frequency of an existing order, initiate an amendment.
- The original order transitions to `AMENDED` and links to the newly created replacement order via `superseded_by_order_id`, maintaining complete historical fidelity.

---

## 5. Security & Multi-Tenant Isolation

- All orders and diagnoses are strictly bound to the authenticated facility tenant.
- Row-Level Security (RLS) guarantees that clinicians cannot view or modify clinical orders from other facilities or organizations.
- Every order creation, authorization, cancellation, and duplicate override generates a tamper-evident, hash-chained audit log.
