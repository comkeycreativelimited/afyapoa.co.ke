# COMKEY AFYA POA — User Manual: Referrals & Counter-Referrals

## 1. Introduction & Referral Network Standards

This Standard Operating Procedure (SOP) manual instructs medical officers, clinical officers, nursing triage staff, and referral coordinators on the **Referrals and Counter-Referrals Module** in COMKEY AFYA POA.

The module enforces:
1. **Kenya National Referral Strategy (2014–2020 & 2023–2030)** guidelines.
2. **Master Health Facility List (KMFL) Validation:** Outbound and inbound dispatches link to authenticated KMFL codes across facility levels 2 through 6.
3. **Transport & Emergency Logistics Tracking:** Tracks ambulance dispatches, paramedic notes, and clinical stability en route.
4. **Closed-Loop Counter-Referrals:** Ensures tertiary and secondary centers provide structured clinical feedback, discharge summaries, and ongoing care plans back to referring primary care providers.

---

## 2. Standard Operating Procedures (SOPs)

### SOP-REF-01: Initiating an Outbound Inter-Facility Referral
1. **Clinical Decision to Refer:**
   - When a patient requires specialized diagnostics, critical care (ICU/HDU), or surgical intervention beyond the current facility's service charter.
2. **Creating the Referral:**
   - From the active clinical encounter, click **Create Outbound Referral**.
   - Search and select the **Destination Facility** by KMFL Code (e.g. `13023 - Kenyatta National Hospital`) or Facility Name.
   - Enter the detailed **Clinical Reason for Referral** (history, provisional diagnosis, current management, reason tertiary capability is required).
   - Select **Urgency Tier**: `ROUTINE`, `URGENT`, or `EMERGENCY`.
   - Specify **Transport Logistics**: `AMBULANCE`, `PRIVATE`, or `PUBLIC`.
3. **Dispatch & Authorization:**
   - Click **Authorize & Dispatch Referral**.
   - An official tracking number (`REF-YYYYMM-XXXX`) is issued with status `DISPATCHED`.
   - The referral summary and digital clinical chart are packaged for transfer.

---

### SOP-REF-02: Receiving and Accepting Inbound Referrals
1. Navigate to **Referrals** -> **Inbound Worklist**.
2. Review arriving patient referrals:
   - Identify originating facility KMFL code.
   - Review incoming clinical summary, vitals, and emergency priority.
3. Upon physical patient arrival at the emergency casualty department or specialized clinic:
   - Click **Acknowledge Arrival / Accept Referral**.
   - Status updates to `ACCEPTED`.
   - The patient is seamlessly queued for triage and consultation.

---

### SOP-REF-03: Completing Counter-Referral Clinical Feedback
1. Following patient stabilization, procedure completion, or tertiary hospital discharge:
2. Open the referral record on the hospital console.
3. Click **Complete Counter-Referral**.
4. Enter structured feedback:
   - Confirmed specialist diagnosis.
   - Procedures and interventions performed.
   - Medication discharge instructions and warning signs.
   - Recommended follow-up schedule at the patient's local primary facility.
5. Click **Submit Counter-Referral**.
6. The referral status advances to `COMPLETED` and an electronic notification is transmitted to the referring clinic's health desk.
