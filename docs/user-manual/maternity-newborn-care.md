# COMKEY AFYA POA — User Manual: Maternity & Newborn Care

## 1. Introduction & Maternal Health Norms

This Standard Operating Procedure (SOP) manual guides midwives, obstetricians, pediatricians, and neonatal nurses on the **Maternity and Newborn Clinical Operations Subsystem** in COMKEY AFYA POA.

The module enforces:
1. **Kenya National Clinical Guidelines for Maternal and Newborn Health (MOH Kenya)**.
2. **Maternal and Perinatal Death Surveillance and Response (MPDSR)** statutory tracking requirements.
3. **Intrapartum Partograph Monitoring:** Real-time documentation of cervical dilation, descent, uterine contractions, and fetal heart rate.
4. **Neonatal Evaluation & APGAR Scoring:** Mandatory APGAR score recording at 1 minute, 5 minutes, and 10 minutes post-delivery.
5. **Automated Master Patient Registry Integration:** Registering a newborn automatically provisions a new child patient record, issues a unique Medical Record Number (`MRN-NB-YYYYMM-XXXX`), and links the child to the maternal file.

---

## 2. Standard Operating Procedures (SOPs)

### SOP-MAT-01: Documenting Maternal Deliveries
1. **Accessing Labor & Delivery:**
   - From the Inpatient Maternity Ward or Labour Ward worklist, select the admitting mother's chart.
   - Click **Record Delivery**.
2. **Entering Delivery Details:**
   - Confirm delivery timestamp.
   - Select **Delivery Mode**: `SPONTANEOUS_VAGINAL`, `ASSISTED_VAGINAL`, `CESAREAN_ELECTIVE`, or `CESAREAN_EMERGENCY`.
   - Record **Delivery Outcome**: `LIVE_BIRTH`, `STILLBIRTH_FRESH`, or `STILLBIRTH_MACERATED`.
   - Quantify **Estimated Blood Loss (EBL)** in millilitres (e.g. `250 ml`).
   - Grade **Perineal Trauma**: `NONE`, `FIRST_DEGREE`, `SECOND_DEGREE`, `THIRD_DEGREE`, `FOURTH_DEGREE`.
   - Enter partograph intrapartum summary (cervical dilation curve, duration of active labor, membranes status, liquor color).
3. **Authorizing & Submitting:**
   - Verify the attending midwife or obstetrician's credentials and click **Submit Delivery Record**.

---

### SOP-MAT-02: Registering Newborns & Auto-Provisioning MRN
1. **Initiating Newborn Intake:**
   - On the finalized delivery record, click **Register Newborn**.
2. **Recording Neonatal Characteristics:**
   - Select **Gender**: `MALE`, `FEMALE`, or `OTHER`.
   - Enter **Birth Order**: `SINGLETON`, `TWIN_1`, `TWIN_2`, `TRIPLET`.
   - Enter **APGAR Scores**:
     - APGAR at 1 Minute (0–10).
     - APGAR at 5 Minutes (0–10).
     - APGAR at 10 Minutes (0–10) if resuscitation or monitoring is required.
   - Enter verified **Birth Weight** in grams (e.g. `3450 g`).
3. **Automated Registry Provisioning:**
   - Click **Save & Provision Newborn Record**.
   - The system automatically:
     1. Creates a full patient file in the master patient registry.
     2. Generates an official pediatric Medical Record Number (`MRN-NB-202610-0042`).
     3. Binds the maternal patient record as the primary guardian.
     4. Sets up initial immunizations schedule (BCG, Polio 0, Vitamin K, Chlorhexidine cord care).

---

### SOP-MAT-03: Managing Complicated Neonatal Care & NBU Transfers
1. If the 5-minute APGAR score is $\le 6$ or the infant has respiratory distress / very low birth weight ($< 1500\text{ g}$):
2. On the newborn profile, select **Update Status** -> **Transfer to Newborn Unit (NBU / NICU)**.
3. The system notifies the pediatric team, generates a transfer admission to the neonatal nursery, and creates a critical care monitoring encounter.
