# COMKEY AFYA POA — Personal Data Breach Response Runbook
*(Kenya Data Protection Act, 2019 — Section 43 & General Regulations 2021)*

> **LEGAL NOTICE & COMPLIANCE DISCLAIMER:**  
> **DRAFT - FOR REVIEW BY QUALIFIED LEGAL AND PRIVACY PROFESSIONALS.**  
> *This document provides technical and operational response guidance for personal data breaches involving the COMKEY AFYA POA platform. It is not formal legal advice. Healthcare facilities (Data Controllers) and Comkey Creative Limited (Data Processor) must submit this runbook to their qualified legal counsel and certified Data Protection Officer (DPO) for formal adaptation prior to operational adoption.*

---

## 1. Statutory Context & Legal Obligations

### 1.1 Kenya Data Protection Act 2019 (Section 43)
Under **Section 43** of the Data Protection Act (DPA) 2019 and Regulation 37-40 of the *Data Protection (General) Regulations, 2021*:
1. **Processor Notification (Section 43(2)):** A data processor who becomes aware of a personal data breach shall notify the data controller **without undue delay** (contractually fixed at **within 48 hours**).
2. **Controller Notification to ODPC (Section 43(1)):** A data controller shall notify the Data Protection Commissioner of a personal data breach **within seventy-two (72) hours** of becoming aware of the breach, unless the personal data breach is unlikely to result in a risk to the rights and freedoms of the data subjects.
3. **Communication to Data Subject (Section 43(1)(b)):** Where a breach is likely to result in a high risk to the rights and freedoms of data subjects, the data controller shall communicate the breach to the affected data subjects in written form without undue delay.

### 1.2 Definition of Personal Data Breach
A breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, personal data transmitted, stored, or otherwise processed.

---

## 2. Breach Response Timeline (The 72-Hour Clock)

```
[HOUR 0] Breach Detected / Triaged
   |
[HOURS 0 - 2] Initial Containment & CIRT Activation
   |
[HOURS 2 - 12] Technical Investigation & Scope Determination
   |
[HOURS 12 - 24] Risk Assessment (Likelihood & Impact on Data Subjects)
   |
[HOURS 24 - 48] Comkey (Processor) Formal Notification to Hospital (Controller)
   |
[HOURS 48 - 72] Hospital (Controller) Formal Filing to ODPC (Statutory Deadline)
   |
[POST 72 HOURS] Patient Notification & Long-Term Remediation
```

---

## 3. Hour-by-Hour Operational Response Runbook

### Phase 1: Hours 0 to 2 — Discovery & Initial Containment
1. **Detection:** Security alert received (e.g., unauthorized export, RLS error, compromised credential).
2. **Freeze & Contain:**
   - Immediately terminate affected user sessions in database:
     ```sql
     UPDATE user_sessions SET is_revoked = true WHERE user_id = :compromisedUserId;
     ```
   - Lock user accounts (`locked_until = NOW() + INTERVAL '48 HOURS'`).
   - If server compromise is suspected, isolate container pod from the VPC network.
3. **Convene CIRT:** The Incident Commander convenes the technical response team, the Data Protection Officer (DPO), and legal counsel.

### Phase 2: Hours 2 to 12 — Scope Determination & Forensic Quantification
1. **Identify Compromised Data Categories:**
   - Did the breach expose:
     - General personal data (names, email, physical address)?
     - Sensitive personal health data (diagnoses, HIV status, reproductive health, clinical notes)?
     - Government identifiers (Kenyan National ID, SHA Number, UPI)?
     - Financial data (M-Pesa transaction reference numbers, invoices)?
2. **Quantify Volume:**
   - Extract exact query count and patient IDs from `patient_access_logs` and `audit_events`.
   - Calculate total number of affected data subjects.
3. **Determine Encryption Status:**
   - Confirm whether leaked database fields were protected by AES-256-GCM encryption (`phone_encrypted`, `value_encrypted`) or if decryption keys were also compromised.

### Phase 3: Hours 12 to 24 — Severity & Harm Risk Assessment
The DPO and legal counsel evaluate the risk to the rights and freedoms of affected patients based on Regulation 38:
- **High Risk Triggers:**
  - Exposure of medical histories, infectious disease diagnoses, or psychiatric notes.
  - Exposure of National ID and phone numbers (identity theft, fraud, extortion risk).
  - Exposure of records relating to minors or vulnerable individuals.
- **Low / Unlikely Risk Triggers:**
  - Breached data was strongly encrypted with AES-256-GCM and the encryption key was never compromised.
  - The breach was contained immediately before external exfiltration occurred.

### Phase 4: Hours 24 to 48 — Data Processor Notification to Controller
If the breach occurred on the Comkey Afya Poa infrastructure:
- Comkey DPO dispatches the **Processor Breach Notification** to the healthcare facility's Chief Executive Officer and designated DPO.
- The notification contains:
  1. Description of the nature of the breach.
  2. Categories and approximate number of data subjects affected.
  3. Identity and contact details of Comkey's DPO.
  4. Likely consequences of the breach.
  5. Technical and organizational measures taken or proposed to mitigate harm.

### Phase 5: Hours 48 to 72 — Data Controller Notification to ODPC
- The healthcare facility Data Controller submits the formal **Statutory Personal Data Breach Notification** to the Office of the Data Protection Commissioner (ODPC) via `complaints@odpc.go.ke` or the online ODPC portal.
- If full technical details are not yet available, submit an **Interim Notification** within the 72-hour window, stating that further details will follow without undue delay.

### Phase 6: Post 72 Hours — Patient Notification & Corrective Action
- If risk to data subjects is high, dispatch direct notifications to affected patients via secure SMS/Email.
- Implement permanent architectural remediations, update threat model, and archive full evidence for 7 years.

---

## 4. Statutory Notification Templates

### 4.1 ODPC Notification Form (Form DPC/PR/1 Aligned)

```markdown
DRAFT - FOR REVIEW BY QUALIFIED LEGAL AND PRIVACY PROFESSIONALS

NOTIFICATION OF A PERSONAL DATA BREACH TO THE DATA PROTECTION COMMISSIONER
(Pursuant to Section 43 of the Data Protection Act, 2019 and Regulation 37 of the Data Protection (General) Regulations, 2021)

To:
The Data Protection Commissioner
Office of the Data Protection Commissioner
Britam Tower, 13th Floor, Hospital Road, Upper Hill,
P.O. Box 30920-00100, Nairobi, Kenya.
Email: complaints@odpc.go.ke / info@odpc.go.ke

PART A: DATA CONTROLLER / DATA PROCESSOR DETAILS
1. Name of Healthcare Facility (Data Controller): [HOSPITAL NAME]
2. ODPC Registration Certificate Number: [REG-XXXXX-XXXX]
3. Physical Address: [FACILITY PHYSICAL LOCATION, COUNTY]
4. Contact Person / Designated DPO:
   - Name: [NAME OF DPO]
   - Email: [dpo@hospital.co.ke]
   - Telephone: [+254 7XX XXX XXX]
5. Data Processor Details (if applicable):
   - Name: Comkey Creative Limited (COMKEY AFYA POA)
   - ODPC Processor Registration Number: [PROCESSOR-REG-XXXXX]

PART B: DETAILS OF THE PERSONAL DATA BREACH
1. Date and Time Breach Occurred: [YYYY-MM-DD HH:MM EAT]
2. Date and Time Breach Detected: [YYYY-MM-DD HH:MM EAT]
3. Circumstances of the Breach:
   [Provide factual description: e.g., unauthorized access via compromised credentials,
   unauthorized export, malicious software, accidental disclosure]
4. Nature of the Personal Data Breach:
   [ ] Loss of Confidentiality
   [ ] Loss of Integrity
   [ ] Loss of Availability
   [ ] Destruction of Data

PART C: DATA SUBJECTS & CATEGORIES OF DATA
1. Estimated Number of Data Subjects Affected: [NUMBER]
2. Categories of Data Subjects:
   [ ] Out-patients
   [ ] In-patients
   [ ] Maternity / Newborn patients
   [ ] Hospital Staff
   [ ] Minors / Children
3. Categories of Personal Data Breached:
   [ ] General Identifiers (Full Name, Date of Birth, Address)
   [ ] Government Identifiers (Kenyan National ID, SHA Number, UPI)
   [ ] Sensitive Health Data (Clinical Notes, Diagnoses, Prescriptions, Lab Results)
   [ ] Financial / Billing Information (M-Pesa reference numbers, invoice details)

PART D: LIKELY CONSEQUENCES & RISK EVALUATION
1. Assessment of Risk to Rights and Freedoms: [HIGH / MEDIUM / LOW]
2. Likely Consequences to Affected Individuals:
   [Detail potential harms: identity theft, discrimination, reputational damage, psychological distress]

PART E: TECHNICAL & MITIGATION MEASURES TAKEN
1. Measures Taken to Contain and Eradicate the Breach:
   - Immediate session revocation and credential rotation across all active users.
   - Isolation of affected database and container services.
   - Patching of the identified application vulnerability (Hotfix vX.X.X deployed).
   - Verification of Row-Level Security and cryptographic audit hash chain integrity.
2. Measures Taken or Proposed to Address Future Breaches:
   - Enforcement of mandatory hardware TOTP MFA for all clinical cadres.
   - Network segmentation tightening and enhanced WAF filtering.
3. Has Communication Been Made to Affected Data Subjects?
   [ ] YES — Communicated on [DATE] via [METHOD]
   [ ] NO — Notification delayed/not required because [STATE LEGAL JUSTIFICATION]

DATED this ________ day of __________________, 20____.

Signed on behalf of the Data Controller:

________________________________________
[NAME OF HOSPITAL AUTHORIZED SIGNATORY]
Designation: Chief Executive Officer / Medical Superintendent
```

---

### 4.2 Patient Notification Letter Template (High-Risk Breaches)

```markdown
DRAFT - FOR REVIEW BY QUALIFIED LEGAL AND PRIVACY PROFESSIONALS

CONFIDENTIAL NOTICE OF A PERSONAL DATA BREACH

Date: [YYYY-MM-DD]
To: [PATIENT NAME / LEGAL GUARDIAN]
Patient Reference: [MRN-XXXX]

Dear [Patient Name],

RE: NOTICE OF DATA SECURITY INCIDENT INVOLVING YOUR HEALTH RECORD

We are writing to inform you of a data security incident that may have involved your personal and clinical information at [HOSPITAL NAME]. We take the privacy and confidentiality of your medical records with the utmost seriousness, and we deeply regret that this incident occurred.

WHAT HAPPENED?
On [DATE], our information security team detected an unauthorized access incident affecting our hospital electronic records system. The unauthorized activity was identified and contained within [NUMBER] hours. We immediately notified the Office of the Data Protection Commissioner (ODPC) in compliance with the Kenya Data Protection Act, 2019.

WHAT INFORMATION WAS INVOLVED?
Our technical investigation indicates that the information accessed may have included:
- Your full name, contact information, and date of birth.
- Your hospital record number and national identification number.
- [If applicable: Summary of clinical notes, consultation dates, and prescribed medications.]

Please note: Your clinical records were NOT deleted or altered, and your ongoing medical care is completely unaffected.

WHAT ARE WE DOING?
We immediately took the following remedial actions:
1. Blocked the unauthorized access point and revoked all affected system credentials.
2. Deployed enhanced cryptographic controls and security patches across our medical software.
3. Commenced a full forensic review with independent cybersecurity and data privacy experts.
4. Coordinated our response with the ODPC and relevant national health authorities.

WHAT YOU CAN DO TO PROTECT YOURSELF:
While we have no evidence that your information has been misused, we recommend that you:
- Remain vigilant against suspicious telephone calls, SMS messages, or emails asking for personal, banking, or M-Pesa PIN details claiming to be from the hospital or health authorities.
- Remember that [HOSPITAL NAME] staff will NEVER call you to request your passwords, M-Pesa PIN, or banking credentials.

WHO CAN YOU CONTACT FOR FURTHER INFORMATION?
If you have questions, concerns, or require further assistance, please contact our dedicated Data Protection Office:
- Telephone Helpline: [+254 7XX XXX XXX / TOLL-FREE]
- Email: [privacy@hospital.co.ke]
- In-Person: Hospital Administration Block, Room [XXX], Monday to Friday 8:00 AM - 5:00 PM.

Yours sincerely,

________________________________________
[NAME OF HOSPITAL DIRECTOR]
Medical Superintendent / Chief Executive Officer
[HOSPITAL NAME]
```
