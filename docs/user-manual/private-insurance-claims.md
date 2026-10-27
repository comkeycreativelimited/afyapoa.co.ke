# COMKEY AFYA POA — User Manual: Private Insurance Adapters & Claims

## 1. Introduction & Underwriter Standards

This Standard Operating Procedure (SOP) manual guides hospital billing cashiers, claims officers, front desk staff, and preauthorization managers on the **Private Insurance Adapters Module** in COMKEY AFYA POA.

The module provides adapters for Kenya's primary private healthcare underwriters:
1. **Jubilee Insurance Kenya**
2. **AAR Insurance Kenya**
3. **APA Insurance**
4. **Britam Insurance**
5. **Old Mutual / UAP Old Mutual**

The module enforces:
- **Insurance Regulatory Authority (IRA) Guidelines** on health insurance policy administration.
- **Real-Time Eligibility Checking:** Evaluates active membership, benefit caps, copay requirements, and remaining annual balances.
- **Electronic Preauthorizations:** Facilitates rapid preauthorization submissions and tracks insurer approval tracking numbers.

---

## 2. Standard Operating Procedures (SOPs)

### SOP-INS-01: Registering Patient Private Insurance Policies
1. **Patient Verification:**
   - On the patient master file, open the **Insurance & Cover** tab.
   - Click **Add Private Policy**.
2. **Policy Details:**
   - Select the **Commercial Insurer**: `JUBILEE`, `AAR`, `APA`, `BRITAM`, `OLD_MUTUAL`, `CIC`, or `FIRST_ASSURANCE`.
   - Input the **Policy Number** and **Member Number** from the patient's insurance card or biometric e-card.
   - Enter benefit limits: Annual Inpatient Limit (e.g. `KES 2,000,000`), Annual Outpatient Limit (e.g. `KES 150,000`), and fixed per-visit Copay Amount (e.g. `KES 500`).
3. **Save Policy:**
   - Click **Register Policy**.
   - The policy enters `ACTIVE` status and is ready for real-time eligibility adjudication.

---

### SOP-INS-02: Real-Time Eligibility Verification
1. When an insured patient presents at the front desk or admission desk:
2. Click **Verify Eligibility**.
3. Optionally enter the estimated consultation or procedure fee.
4. The system queries the designated insurer adapter and displays:
   - **Active Cover Status:** Green checkmark confirming member is active.
   - **Copay Obligation:** Mandatory out-of-pocket cash copay (e.g. *KES 500 due at cashier*).
   - **Remaining Limits:** Real-time remaining balance for inpatient or outpatient benefits.
   - **Preauthorization Flag:** Flags whether the service requires advance underwriter preauth.

---

### SOP-INS-03: Requesting and Recording Preauthorizations
1. **Initiating Preauthorization:**
   - For planned admissions, surgical procedures, or high-cost diagnostic imaging (e.g. MRI):
   - Click **Request Preauthorization**.
   - Input the **Procedure Code**, **Estimated Amount** in KES, and concise **Clinical Justification / Diagnosis**.
   - Click **Submit Preauth Request**.
   - A sequential authorization reference (`PA-YYYYMM-XXXX`) enters `PENDING` status.
2. **Recording Insurer Adjudication:**
   - Upon receiving the formal authorization letter / code from the underwriter:
   - Open the pending preauthorization and click **Record Approval**.
   - Input the **Approved Amount** (full or partial approval) and underwriter notes.
   - Click **Save Approval**.
   - The approval status advances to `APPROVED`, unlocking the procedure for scheduling and claims adjudication.
