# COMKEY AFYA POA — User Manual: Operating Theatre & Procedure Scheduling

## 1. Introduction & Surgical Quality Standards

This Standard Operating Procedure (SOP) manual instructs theatre managers, scrub nurses, circulating nurses, consultant surgeons, and anesthesiologists on the **Operating Theatre and Procedure Scheduling Subsystem** in COMKEY AFYA POA.

The module enforces:
1. **WHO Guidelines for Safe Surgery (2009)** and the 3-stage Surgical Safety Checklist.
2. **KMPDC Surgical Practice Guidelines** for operating rooms in Level 4–6 Kenyan health facilities.
3. **Automated Slot Overlap Conflict Prevention:** Transactional time-window checking to eliminate double-booking of surgical suites.
4. **Perioperative Tracking:** Full lifecycle visibility (`SCHEDULED` -> `PREOP` -> `IN_PROCEDURE` -> `POSTOP` -> `COMPLETED`, or `CANCELLED`).

---

## 2. Standard Operating Procedures (SOPs)

### SOP-TH-01: Scheduling Elective and Emergency Surgeries
1. **Initiating Booking:**
   - Navigate to **Theatre Operations** -> **Theatre Schedule**.
   - Click **New Surgical Booking**.
2. **Entering Booking Parameters:**
   - Select the target **Theatre Suite** (e.g. `Main Operating Theatre 1`).
   - Enter the **Patient MRN**, planned **Procedure Name**, **Lead Surgeon**, and **Anesthetist**.
   - Specify the **Urgency Tier**: `ELECTIVE`, `URGENT`, or `EMERGENCY`.
   - Set the planned start and conclusion timestamps.
3. **Collision Detection Verification:**
   - The system checks active bookings for that room.
   - If another procedure overlaps, the system blocks the booking with an alert: `Theatre suite is already booked for this time slot`.
   - If clear, the booking is created with status `SCHEDULED` and sequential booking number (`THB-YYYYMM-XXXX`).

---

### SOP-TH-02: Stage 1 — WHO Surgical Safety Checklist: Sign In
*Conducted in the operating room prior to induction of anesthesia with patient, anesthetist, and circulating nurse.*
1. Open the scheduled case on the Theatre Console.
2. Click **Execute Checklist** -> **Stage 1: Sign In**.
3. Verify and check each statutory safety parameter:
   - Patient has confirmed identity, surgical site, procedure, and signed informed consent.
   - Surgical site is physically marked.
   - Pulse oximeter is placed on patient and functioning.
   - Patient allergy status confirmed.
   - Difficult airway / aspiration risk evaluated and equipment ready.
   - Blood loss risk assessed ($\ge 500\text{ ml}$ in adults) and IV access/fluids prepared.
4. Click **Attest Sign In**. System records practitioner digital signatures and advances status to `PREOP`.

---

### SOP-TH-03: Stage 2 — WHO Surgical Safety Checklist: Time Out
*Conducted immediately prior to skin incision with the entire surgical team (Surgeon, Anesthetist, Scrub Nurse, Circulating Nurse).*
1. Click **Stage 2: Time Out**.
2. Team members introduce themselves by name and role.
3. Surgeon, Anesthetist, and Nurse verbally confirm:
   - Patient name and procedure.
   - Correct anatomical operative site.
   - Antibiotic prophylaxis administered within the past 60 minutes.
   - Anticipated critical events, expected duration, and blood loss.
   - Essential diagnostic imaging displayed on theatre monitors.
4. Click **Attest Time Out**. Procedure status updates to `IN_PROCEDURE`.

---

### SOP-TH-04: Stage 3 — WHO Surgical Safety Checklist: Sign Out
*Conducted prior to patient leaving the operating room.*
1. Click **Stage 3: Sign Out**.
2. Nurse and surgical team verbally confirm:
   - Official name of procedure recorded.
   - Instrument, sponge, and needle counts are 100% correct.
   - Surgical specimens are correctly labeled with patient name and MRN.
   - Equipment malfunctions flagged for biomedical engineering.
   - Surgeon, anesthetist, and nurse review post-operative recovery concerns for the PACU team.
3. Click **Attest Sign Out**. Procedure status advances to `POSTOP` and then `COMPLETED`.

---

### SOP-TH-05: Cancelling or Postponing a Surgical Booking
1. If a procedure must be postponed (e.g. unoptimized comorbidities, acute decompensation):
2. Click **Cancel Booking**.
3. Enter the detailed clinical reason.
4. The system updates the booking to `CANCELLED`, emits an audit event, and immediately frees the theatre calendar slot.
