# COMKEY AFYA POA — User Manual: Appointments & Outpatient Scheduling

## 1. Introduction & Clinic Flow Governance

This Standard Operating Procedure (SOP) manual instructs receptionists, customer care personnel, clinic coordinators, and outpatient clinicians on the **Appointments and Scheduling Module** in COMKEY AFYA POA.

The module enforces:
1. **Practitioner Conflict Prevention:** Algorithmic verification preventing simultaneous bookings for the same clinician. Overlapping appointment windows are blocked by transactional conflict guards.
2. **Outpatient Service Clinics:** Standard categorization across specialized outpatient clinics (General Outpatient, Antenatal Clinic / ANC, Diabetes & Hypertension Chronic Care, Specialized Pediatric Clinic, Dental, Physiotherapy, Telemedicine).
3. **Visit Lifecycle Progression:** Full visibility from `SCHEDULED` through `CONFIRMED`, `CHECKED_IN`, `IN_CONSULTATION`, to `COMPLETED`.
4. **Structured Cancellation Tracking:** Preserves the distinction between completed, rescheduled, cancelled, and no-show visits.

---

## 2. Standard Operating Procedures (SOPs)

### SOP-APT-01: Booking a Patient Consultation Appointment
1. **Patient Search & Intake:**
   - Search for the patient by Name, National ID, Phone Number, or MRN.
2. **Consultation Parameters:**
   - Click **Book Appointment**.
   - Select the target **Service Type** (e.g. `ANTENATAL`, `DIABETES_CLINIC`, `SPECIALIST_CLINIC`).
   - Select the **Attending Practitioner**.
   - Select the appointment date and time window (e.g. 09:00 – 09:30).
3. **Conflict Validation:**
   - The system checks the practitioner's active calendar.
   - If the practitioner already has a consult scheduled during that period, an alert displays: `Practitioner is already booked for this consultation window`.
   - If available, click **Confirm Booking**.
   - A sequential reference (`APT-YYYYMM-XXXX`) is issued, and an automated SMS confirmation can be sent to the patient.

---

### SOP-APT-02: Patient Check-In & Clinic Flow Tracking
1. When the patient arrives at the hospital reception on the appointment date:
2. Open **Today's Appointments** queue.
3. Click **Check In**.
4. Status advances to `CHECKED_IN`. The patient is immediately routed to the nursing triage queue for vital signs assessment.
5. Once called into the doctor's consulting room, the doctor selects **Start Consultation** (`IN_CONSULTATION`).
6. Upon conclusion of clinical charting, the appointment is marked `COMPLETED`.

---

### SOP-APT-03: Cancelling or Rescheduling Appointments
1. If a patient contacts the facility to cancel or an emergency surgery prevents the clinician from holding clinic:
2. Locate the appointment and click **Cancel Appointment**.
3. Select or enter the mandatory reason (e.g. *Patient request due to illness*, *Clinician emergency procedure*).
4. Click **Confirm Cancellation**.
5. Status updates to `CANCELLED`, freeing the practitioner's calendar slot for other patients.
