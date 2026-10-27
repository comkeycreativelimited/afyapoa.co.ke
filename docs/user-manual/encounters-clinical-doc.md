# COMKEY AFYA POA — User Manual: Reception, Encounter, Triage & Outpatient Clinical Documentation

**Module:** Reception, Patient Queues, Triage Vitals & Outpatient Clinical Documentation  
**Document Identifier:** `UM-ENC-001`  
**Target Roles:** Front-Desk Receptionists, Triage Nurses, Medical Officers / Clinical Officers / Consultants, Health Records and Information Officers (HRIO)  
**Applicable Legal Framework:** Kenya Health Act 2017, Kenya Data Protection Act 2019, Digital Health Act 2023, Medical Practitioners and Dentists Act  

---

## 1. Introduction

The Reception, Encounter, Triage, and Outpatient Clinical Documentation module of **COMKEY AFYA POA** coordinates patient movement from front-desk intake through nursing triage to clinical consultation and safe discharge.

Designed specifically for Kenyan outpatient healthcare settings, the module ensures:
- **Rapid Keyboard-Driven Reception:** Fast intake of walk-ins and scheduled appointments without bypassing patient safety checks.
- **Objective Nursing Triage:** Standard physiological measurements recorded using verified Kenyan units, automated Body Mass Index (BMI) computation, and triage priority ranking.
- **Defensible Clinical Documentation:** Structured SOAP, H&P, and consultation notes with clear separation between draft iterations and finalized legal medical records.
- **Statutory Clinical Immutability:** Finalized clinical notes cannot be altered or overwritten. Any subsequent corrections must follow the formal statutory addendum workflow with author attribution and timestamping.
- **Clinical Safety Controls:** Mandatory allergy warnings and strict encounter closure rules that prevent closing an encounter while draft clinical notes remain unfinalized.

---

## 2. Staff Roles and Permissions

Access is strictly segregated by professional role:

| Role | Permitted Actions | Restrictions |
| :--- | :--- | :--- |
| **Front-Desk Receptionist** | Patient Queue Board, Walk-In Check-In, Appointment Registration, Department Queue Assignment. | Cannot view or edit clinical consultation notes or record triage vitals. |
| **Triage Nurse** | Triage Station, Vital Sign Capture (BP, Pulse, Temp, SpO2, RR, Glucose, AVPU), Priority Classification, Queue Progression. | Cannot sign consultation notes or close encounters. |
| **Clinician / Medical Officer** | Consultation Room, Vitals Review, Allergy Documentation, SOAP/H&P Note Drafting, Finalization & Digital Signing, Legal Amendments, Encounter Closure. | Cannot delete or mutate finalized clinical records. |
| **HRIO / Records Supervisor** | Queue Audit, Audit Trail Inspection, Encounter Reopening (with mandatory statutory justification). | All reopening events generate non-repudiable audit logs. |

---

## 3. Keyboard Navigation & Accessibility Shortcuts

The clinical module is optimized for high-volume outpatient clinics with fast keyboard navigation:

| Key Combination | Action |
| :--- | :--- |
| `Alt + 1` | Switch to **Reception & Queue Board** |
| `Alt + 2` | Switch to **Triage Station** |
| `Alt + 3` | Switch to **Consultation & Clinical Notes** |
| `Alt + W` | Trigger **Register Walk-In Encounter** dialog |
| `Alt + S` | **Save Draft Note** (in consultation room) |
| `Alt + F` | **Finalize & Sign Note** (prompts digital signature confirmation) |
| `Esc` | Close any active modal, drawer, or amendment dialog |

---

## 4. Receptionist Workflow: Queue & Check-In

### Step 1: Patient Check-In
1. Navigate to **Clinical OPD & Triage** (`/encounters`) or press `Alt + 1`.
2. Locate the patient in the queue or search by Name / MRN.
3. To register an unscheduled arrival, click **Register Walk-In** (`Alt + W`).
4. Select or verify:
   - **Service Department:** e.g., `OPD_GENERAL`, `OPD_SPECIALIZED`, `EMERGENCY`, `MCH_FP`.
   - **Initial Priority:** `ROUTINE`, `URGENT`, or `EMERGENCY`.
   - **Chief Complaint / Reason for Visit:** Brief statement (e.g., *"Persistent cough and fever for 3 days"*).
5. Click **Check-In Patient**. The system assigns a unique encounter sequence number (e.g. `ENC-202610-0012`) and places the patient in the **Arrived** queue awaiting triage.

---

## 5. Nurse Workflow: Triage Observations & Vital Signs

Under the Kenya Health Act 2017, all outpatient attendees must undergo standardized triage assessment before clinician consultation.

### Step 1: Open Triage Station
1. In the encounter list, select the arrived patient.
2. Click the **Triage Station** tab (`Alt + 2`).

### Step 2: Record Physiological Measurements
Input all observed vital signs with standard Kenyan medical units:
- **Blood Pressure:** Enter Systolic and Diastolic values in **mmHg** (e.g. `120` / `80`).
- **Heart Rate / Pulse:** Beats per minute (**bpm**).
- **Respiratory Rate:** Breaths per minute.
- **Body Temperature:** Degrees Celsius (**°C**) with one decimal place (e.g. `37.2`).
- **Oxygen Saturation ($SpO_2$):** Percentage (**%**) on room air or oxygen.
- **Anthropometry:** Weight in **kg** (e.g. `68.5`) and Height in **cm** (e.g. `172`).
  - *Automatic Calculation:* The system instantly computes and displays the patient's **Body Mass Index (BMI)** in $kg/m^2$ upon entering weight and height.
- **Capillary Blood Glucose:** Optional measurement in **mmol/L** (standard Kenyan unit).
- **AVPU Neurological Scale:** Select `ALERT`, `VOICE`, `PAIN`, or `UNRESPONSIVE`.

### Step 3: Assign Priority & Queue to Clinician
1. Select the verified triage priority:
   - `RESUSCITATION`: Immediate life-threatening condition (red badge, top of queue).
   - `EMERGENCY`: High clinical risk requiring prompt attention.
   - `URGENT`: Moderate illness needing timely care.
   - `SEMI_URGENT` / `ROUTINE`: Stable conditions.
2. Add qualitative **Triage Notes** if necessary.
3. Click **Save Triage & Route to Doctor**. The encounter status automatically updates to `TRIAGED` and moves to the clinician's consultation queue.

---

## 6. Clinician Workflow: Consultation, Notes & Digital Signing

### Step 1: Review Patient History & Allergies
1. In the Consultation Room (`Alt + 3`), review the patient's banner:
   - Check the **Allergies** alert badge (highlighted in red/amber if active drug or food allergies are present).
   - Review the **Latest Recorded Vitals** snapshot taken by the triage nurse.

### Step 2: Author Structured Clinical Notes
The system provides industry-standard outpatient schemas:
- **SOAP Note (Default):**
  - **S (Subjective):** Patient complaints, history of presenting illness (HPI), review of systems.
  - **O (Objective):** Physical examination findings, laboratory or imaging review.
  - **A (Assessment):** Clinical impression, differential diagnoses.
  - **P (Plan):** Treatment plan, prescriptions, investigations, patient education, follow-up.
- **Other Note Types:** History & Physical (H&P), Consultation Note, Progress Note, Discharge Summary.

### Step 3: Save as Draft vs. Finalize & Sign
- **Save as Draft (`Alt + S`):** Saves work in progress. Drafts can be revised or updated by the author as additional examination details or lab results return.
- **Finalize & Sign (`Alt + F`):** 
  - Seals the clinical note permanently.
  - Computes a cryptographic digital signature binding the practitioner's identity, the encounter reference, and the content.
  - Changes note status to `FINALIZED`.
  - **Warning:** Once finalized, the note is legally immutable. Direct editing or deletion is prohibited by system design and Kenyan medical record standards.

---

## 7. Clinical Amendments & Addenda Workflow

If additional clinical information arrives after a note is finalized (e.g., delayed imaging report, microbiology culture, or inadvertent typographical omission):

1. Locate the finalized note in the consultation notes history.
2. Click **Add Legal Addendum / Amend**.
3. In the Amendment Drawer:
   - **Clinical Reason for Amendment:** Provide an auditable justification of at least 10 characters (e.g., *"CXR report received post-consultation confirming right lower lobe infiltrate"*).
   - **Addendum Text:** Enter the supplementary findings or corrective observations.
4. Click **Record Statutory Addendum**.
5. The system attaches the amendment as a separate, versioned record linked to the original note. Both the original untouched note and the dated addendum are displayed in chronological order with full practitioner attribution.

---

## 8. Encounter Closure and Reopening Rules

### Encounter Closure
When outpatient care is complete:
1. Ensure all draft notes for the encounter have been **Finalized** or discarded.
   - *Safety Guard:* The system will block closure with HTTP 422 if any draft notes remain open.
2. Enter an **Outpatient Closure / Discharge Summary**.
3. Click **Complete & Close Encounter**. The status changes to `COMPLETED` and the departure timestamp is logged.

### Encounter Reopening
If a discharged patient returns shortly after departure with worsening symptoms, adverse medication reaction, or administrative corrections are required:
1. Open the closed encounter.
2. Click **Reopen Encounter**.
3. Provide a mandatory **Reopening Justification** ($\ge 10$ characters).
4. Click **Confirm Reopening**.
5. The encounter status changes to `REOPENED`, allowing additional triage or notes, and a high-priority audit event is logged.
