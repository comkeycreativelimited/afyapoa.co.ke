# COMKEY AFYA POA — User Manual: Medical Supplies & Procurement Management

## 1. Introduction & Institutional Procurement Controls

This Standard Operating Procedure (SOP) manual instructs procurement officers, warehouse storekeepers, hospital accountants, and medical directors on the **Medical Supplies and Procurement Module** in COMKEY AFYA POA.

The module enforces:
1. **Pharmacy and Poisons Act (Cap 244)** standards for pharmaceutical and medical consumable inventory tracking.
2. **Dual-Sign Purchase Order Authorization:** Enforces segregation of duties between purchase order origination and administrative/financial approval.
3. **Goods Received Notes (GRN) with Quality Inspection:** Validates deliveries against purchase orders, conducts physical QA inspection, logs manufacturer batch/lot numbers and expiry dates, and allocates warehouse storage bins.
4. **End-to-End Traceability:** Links procurement orders directly to dispensary batch inventory, ensuring full audit visibility from supplier invoice to patient bedside administration.

---

## 2. Standard Operating Procedures (SOPs)

### SOP-PROC-01: Creating and Submitting Purchase Orders
1. **Generating Requisition:**
   - Navigate to **Procurement & Supplies** -> **Purchase Orders**.
   - Click **Create Purchase Order**.
2. **Entering Order Details:**
   - Select or enter the licensed **Supplier Name** (e.g. *Mission for Essential Drugs and Supplies - MEDS*, *KEMSA*, *Cosmos Limited*).
   - Add required line items:
     - Item Description (e.g. *Surgical Gloves Size 7.5*, *Normal Saline 0.9% 500ml*).
     - Item Type (`MEDICATION`, `LAB_CONSUMABLE`, `SURGICAL_SUPPLY`, `GENERAL_MEDICAL_SUPPLY`).
     - Quantity Ordered.
     - Unit Purchase Price in KES.
3. **Submission:**
   - Review total valuation.
   - Click **Submit Purchase Order**.
   - The purchase order is issued with a unique reference (`PO-YYYYMM-XXXX`) and enters status `SUBMITTED`.

---

### SOP-PROC-02: Dual-Sign Multi-Signatory Order Approval
1. **Administrative Review:**
   - The Hospital Administrator or Medical Director opens the **Pending Purchase Orders** queue.
   - Reviews supplier reputation, line items, budget allocation, and total valuation.
2. **Executing Approval:**
   - Click **Authorize & Approve Order**.
   - Enter authorization notes.
   - The system transitions the PO to `APPROVED`, timestamps the approval, and stamps the approving administrator's digital identity (`approvedByUserId`).
   - The approved PO voucher is generated for vendor transmission.

---

### SOP-PROC-03: Receiving Deliveries & Recording Goods Received Notes (GRN)
1. **Physical Delivery Verification:**
   - When the supplier delivers goods at the hospital receiving bay:
   - Locate the approved purchase order.
   - Click **Record Goods Received Note (GRN)**.
2. **Physical Inspection & Batch Logging:**
   - Enter the vendor's **Delivery Note / Invoice Number**.
   - Inspect packages for physical damage, container seal integrity, and cold chain temperature compliance (for vaccines/insulin).
   - Select **Inspection Status**: `ACCEPTED`, `PARTIALLY_ACCEPTED`, or `REJECTED`.
   - Record the manufacturer's **Batch / Lot Control Number**.
   - Verify and input the manufacturer **Expiry Date**.
   - Designate the physical warehouse **Storage Bin Location** (e.g. `BIN-C-04-SHELF-2`).
3. **Intake Finalization:**
   - Click **Confirm Goods Intake**.
   - A sequential voucher (`GRN-YYYYMM-XXXX`) is generated.
   - The purchase order advances to `RECEIVED` (or `PARTIALLY_RECEIVED`), and stock is immediately available for pharmacy batch dispensing or laboratory consumable issues.
