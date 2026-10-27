# COMKEY AFYA POA — User Manual: Staff Rosters & Departmental Assignments

## 1. Introduction & Healthcare Staffing Governance

This Standard Operating Procedure (SOP) manual instructs nursing officers in charge, heads of clinical departments, matrons, and human resource managers on the **Staff Rosters and Departmental Assignments Module** in COMKEY AFYA POA.

The module enforces:
1. **Employment Act 2007** of Kenya standards regarding working hours and mandatory rest periods.
2. **Nursing Council of Kenya (NCK) Standards of Practice** and KMPDC staffing ratios for acute care, ICU, pediatric, and maternity wards.
3. **Structured Hospital Departmental Hierarchy:** Department configurations across clinical and administrative domains.
4. **Shift Organization & Lifecycle:** Standard shift taxonomy:
   - `MORNING` (07:00 – 14:00)
   - `AFTERNOON` (14:00 – 21:00)
   - `NIGHT` (20:30 – 07:30)
   - `ON_CALL` (24-hour consultant standby rotation)
   - `OFF_DUTY`
   - `LEAVE`
5. **Publishing Audit Trail:** Roster drafts remain editable until formally authorized and published by the hospital administration.

---

## 2. Standard Operating Procedures (SOPs)

### SOP-ROST-01: Configuring Hospital Departments
1. **Department Setup:**
   - Hospital Administrators navigate to **Staff Management** -> **Departments**.
   - Click **Add Department**.
   - Enter **Department Code** (e.g. `DEP-ICU`, `DEP-MAT`, `DEP-SURG`, `DEP-EMERGENCY`) and **Department Name**.
   - Click **Save Department**.

---

### SOP-ROST-02: Generating Monthly Departmental Rosters
1. **Initiating Roster Draft:**
   - Navigate to **Staff Rosters**.
   - Click **Create Monthly Roster**.
   - Select the target **Department**, **Month** (e.g. `NOVEMBER`), and **Year** (`2026`).
   - Click **Create Draft Roster**.
   - The roster enters `DRAFT` status and opens the interactive duty grid.

---

### SOP-ROST-03: Assigning Duty Shifts to Personnel
1. **Assigning Shifts:**
   - On the monthly roster grid, locate the healthcare worker (Doctor, Clinical Officer, Nurse, Radiographer, Lab Tech).
   - Click on the designated calendar date cell.
   - Select the **Shift Type**:
     - `MORNING`
     - `AFTERNOON`
     - `NIGHT`
     - `ON_CALL`
     - `OFF_DUTY`
     - `LEAVE`
   - Click **Assign Shift**.
   - The cell updates with the color-coded shift tag, and a `SHIFT_ASSIGNED` event is recorded.
2. **Reviewing Shift Coverage Ratios:**
   - Check the daily footer metrics to ensure minimum statutory staffing ratios (e.g. at least 1 Registered Nurse per 4 ICU beds, 2 midwives per active labor shift).

---

### SOP-ROST-04: Authorizing and Publishing the Roster
1. Once all departmental shifts for the calendar month have been allocated and verified:
2. The Head of Department or Hospital Matron clicks **Publish Monthly Roster**.
3. The system:
   - Transitions roster status from `DRAFT` to `PUBLISHED`.
   - Stamps the authorizer's user ID and timestamp.
   - Generates an immutable `ROSTER_PUBLISHED` audit event.
   - Makes the published roster active across the hospital portal, enabling staff to view their confirmed shifts on mobile and web consoles.
