# COMKEY AFYA POA — Commercial SaaS Administration User Manual

## 1. Role-Based Access Control Matrix

The SaaS administration capabilities enforce strict separation of duties between platform operators and hospital personnel:

| Capability / Action | Platform Super Admin (`SUPER_ADMIN`) | Hospital Administrator (`FACILITY_ADMIN`) | Hospital Finance Officer (`FINANCE_USER`) | Clinician / Doctor (`CLINICAL_OFFICER` / `DOCTOR`) |
| :--- | :---: | :---: | :---: | :---: |
| Onboard New Hospital Tenant | **Yes** | No | No | No |
| Create / Edit Subscription Plans | **Yes** | No | No | No |
| Issue Commercial Invoices | **Yes** | No | No | No |
| View Platform Invoices | **Yes** | **Yes** | **Yes** | No |
| Pay Invoices via M-Pesa | No | **Yes** | **Yes** | No |
| Request Plan Upgrade / Downgrade | No | **Yes** | No | No |
| Suspend / Cancel Subscriptions | **Yes** | No | No | No |
| Log Support Tickets | No | **Yes** | **Yes** | No |
| Grant Temporary Support Access | No | **Yes** | No | No |
| Access Emergency Patient Records | No | **Yes** | No | **Yes (Always)** |
| Initiate Facility Offboarding | No | **Yes** | No | No |
| Generate Sealed Archive Export | **Yes** | No | No | No |

---

## 2. Super Administrator Standard Operating Procedures

### 2.1 Onboarding a New Hospital Tenant
1. Open the Platform Administration portal at `/admin/tenants/onboard`.
2. Fill in the hospital organizational details:
   - **Tenant Code**: Unique slug (e.g., `tenant-meru-level5`).
   - **Hospital Legal Name**: e.g., `Meru Teaching and Referral Hospital`.
   - **Primary Facility**: Enter the official KMFL Code (e.g., `FID-12-000505-5`) and KEPH Level (`LEVEL_5`).
   - **Contact & Tax**: County, contact phone, contact email, KRA PIN, and SHA Contract Code.
   - **Initial Administrator**: Username, email, and temporary password.
3. Select **Submit Onboarding**. The system automatically provisions the organization, primary facility, administrator user, and default subscription with active entitlements.

### 2.2 Issuing Platform Invoices
1. Navigate to `/admin/invoices/new`.
2. Select the target hospital tenant.
3. Enter invoice line items (e.g., `Level 5 Comprehensive SaaS Subscription - November 2026`).
4. Enter the due date. The system automatically computes 16% Kenyan VAT.
5. Provide a unique idempotency key or allow the portal to generate one.
6. Click **Issue Invoice**. An official invoice number (`INV-SAAS-YYYYMM-XXXXX`) is generated and dispatched to the hospital's finance contacts.

### 2.3 Monitoring Gateway Reliability
1. Navigate to `/admin/monitoring`.
2. Review real-time status across national health gateways:
   - **DHA HIE Gateway**: Client Registry and Shared Health Record sync status.
   - **SHA Claims Gateway**: e-Claims dispatch and pre-authorization latency.
   - **KRA eTIMS Gateway**: Fiscal signature latency and status codes.
   - **M-Pesa Gateway**: Daraja API response times and STK push success rates.

---

## 3. Hospital Administrator & Finance Operating Procedures

### 3.1 Managing Subscriptions & Upgrades
1. Go to the Hospital Administration module at `/saas/subscription`.
2. View current plan tier, active entitlements, renewal dates, and encounter usage metrics.
3. To upgrade:
   - Click **Upgrade Plan**.
   - Select the target tier (e.g., upgrading from Level 4 Standard to Level 5 Enterprise).
   - Enter business justification.
   - Click **Confirm Upgrade**. The new features (e.g., private insurance integration, PACS) become active immediately.
4. *Downgrade Capacity Guard*: If downgrading to a smaller tier, ensure active staff accounts do not exceed the target plan's user capacity. Deactivate unneeded accounts prior to submitting the downgrade request.

### 3.2 Settling Platform Invoices via M-Pesa
1. Navigate to `/saas/invoices`.
2. Locate the invoice with status `ISSUED` or `PAST_DUE`.
3. Click **Pay with M-Pesa**.
4. Enter the authorized hospital mobile number (`+254XXXXXXXXX`).
5. Click **Initiate Payment**.
6. The finance officer receives an instant Safaricom M-Pesa STK prompt on their phone.
7. Enter M-Pesa PIN. Once confirmed, the invoice updates to `PAID` within seconds, and any past-due restrictions are automatically cleared.

### 3.3 Authorizing Temporary Support Access
When COMKEY support engineers need to assist with a technical integration issue:
1. Navigate to `/saas/support/access-grants`.
2. Click **Grant Temporary Access**.
3. Select the COMKEY engineer's identifier, select scope (`READ_ONLY` or `READ_WRITE`), and select duration (e.g., 4 hours; max 24 hours).
4. Enter the ticket reason.
5. Click **Generate Token**. Provide the temporary token to the support engineer.
6. *Revocation*: You may revoke access at any time by clicking **Revoke Access**.

---

## 4. Emergency Patient Safety Guarantees

In strict adherence to **Section 7 of the Kenya Health Act, 2017**:
- Commercial payment failures, billing disputes, or subscription suspensions **NEVER block doctor or clinician access to emergency patient records**.
- Clinicians can view patient files, allergies, medication charts, and past laboratory tests at all times.
- Suspensions apply exclusively to commercial administrative functions (e.g., adding staff, changing tiers, creating new branches).
