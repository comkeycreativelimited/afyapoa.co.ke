# COMKEY AFYA POA — Commercial SaaS Billing Model Architecture

## 1. Domain Separation from Patient Billing & SHA Claims

A foundational architectural requirement of COMKEY AFYA POA is the strict segregation between:
1. **Commercial SaaS Platform Billing**: B2B subscription licensing, metered usage fees, gateway SLA charges, and infrastructure services invoiced by the software operator (COMKEY) to healthcare facilities/tenants.
2. **Clinical Patient Billing**: Point-of-care billing for patient encounters, bed charges, theatre fees, laboratory investigations, pharmacy dispensations, and statutory Social Health Authority (SHA) claims.

```mermaid
graph TD
    subgraph "Commercial SaaS Administration (COMKEY Platform)"
        PPlan[Subscription Plans & Tiers] --> PSub[Tenant Subscriptions]
        PSub --> PEnt[Tenant Entitlements]
        PSub --> PMeter[Tenant Usage Meters]
        PSub --> PInv[Platform Invoices<br/>(16% Kenyan VAT)]
        PInv --> PPay[Platform Payments<br/>(M-Pesa STK / Bank Transfer)]
        PInv --> PDun[5-Stage Dunning Engine]
    end

    subgraph "Clinical Operations & Patient Revenue Cycle (Tenant Enclave)"
        PtReg[Patient Encounters & Wards] --> PtBill[Patient Invoices]
        PtBill --> SHAClaims[SHA Claims / e-Claims API]
        PtBill --> PrivateIns[Private Insurer Adapters]
        PtBill --> PtPayment[Patient Point-of-Sale Payments]
        PtBill --> eTIMSSign[KRA eTIMS Fiscal Receipts]
    end

    style PPlan fill:#e1f5fe,stroke:#01579b
    style PSub fill:#e1f5fe,stroke:#01579b
    style PInv fill:#e8f5e9,stroke:#2e7d32
    style PPay fill:#e8f5e9,stroke:#2e7d32
    style PtBill fill:#fff3e0,stroke:#e65100
    style SHAClaims fill:#f3e5f5,stroke:#4a148c
```

### Key Isolation Guarantees
- **Data Model Segregation**: Commercial SaaS tables (`subscription_plans`, `tenant_subscriptions`, `tenant_entitlements`, `tenant_usage_meters`, `platform_invoices`, `platform_payments`, `platform_dunning_events`) exist independently from patient accounting tables (`invoices`, `payments`, `claims`, `billable_items`).
- **Cryptographic & Financial Integrity**: Platform invoices use the prefix `INV-SAAS-YYYYMM-XXXXX` and compute Kenyan Standard Value Added Tax (VAT 16%) in accordance with the Kenya Revenue Authority (KRA) Tax Procedures Act. Patient invoices reflect patient copays, SHA coverage exclusions, and waiver classifications.
- **Idempotency Segregation**: Commercial payments require unique platform idempotency tokens (`idempotencyKey`) and interface with Safaricom Daraja via dedicated HQ billing shortcodes (`HQ-BILLING`).

---

## 2. Subscription Plan Catalog & Feature Entitlements

COMKEY AFYA POA offers tiered subscription plans aligned to Kenya Essential Package for Health (KEPH) facility levels:

| Tier Code | Plan Name | Facility Level | Billing Cycle | Base Price (KES) | Max Staff Users | Monthly Encounters | Storage Quota | Features Included |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `PLAN_LEVEL2_BASIC` | Level 2 Dispensary Tier | LEVEL_2 | MONTHLY | KES 8,500 | 5 | 500 | 5 GB | Outpatient, Basic Pharmacy, SHA Claims |
| `PLAN_LEVEL3_HEALTH_CENTRE` | Level 3 Health Centre Tier | LEVEL_3 | MONTHLY | KES 18,500 | 15 | 1,200 | 15 GB | Outpatient, Maternity/Delivery, Basic Lab, SHA Claims, eTIMS |
| `PLAN_LEVEL4_STANDARD` | Level 4 Sub-County Hospital | LEVEL_4 | MONTHLY | KES 45,000 | 50 | 2,500 | 50 GB | Inpatient ADT, Theatre Scheduling, Maternity, Radiology, Procurement, DHA SHR Sync, eTIMS, Advanced Rosters |
| `PLAN_LEVEL5_ENTERPRISE` | Level 5 County Referral Tier | LEVEL_5 | ANNUAL / MONTHLY | KES 95,000 | 200 | 15,000 | 500 GB | All Level 4 features + Private Insurance Adapters, PACS Integration, High-Availability SLA, Dedicated Support |
| `PLAN_LEVEL6_NATIONAL` | Level 6 National Teaching Tier | LEVEL_6 | ANNUAL | Custom | Unlimited | Unlimited | Multi-TB | Complete clinical suite, multi-tenant clustering, custom DHA integrations |

### Feature Entitlement Flags
```typescript
export interface PlanFeatureEntitlements {
  inpatient: boolean;          // Inpatient ADT, ward bed management, rounds
  theatre: boolean;            // Operating theatre scheduling & procedure recording
  maternity: boolean;          // Antenatal, labor/delivery partograph, postnatal, newborn register
  radiology: boolean;          // Radiology orders, modality scheduling, reporting, authorized DICOM/PACS
  procurement: boolean;        // Stock inventory, purchase orders, supplier management
  privateInsurance: boolean;   // Private insurance integration adapters
  dhaShr: boolean;             // National DHA Shared Health Record sync
  kraEtims: boolean;           // KRA eTIMS fiscal electronic invoicing
  advancedRosters: boolean;    // Departmental shift scheduling and roster management
}
```

---

## 3. Usage Metering with Tenant-Level Attribution

In addition to base subscription fees, resource utilization is metered and attributed at the tenant level with proactive threshold notifications:

- **Encounter Metering**: Billable clinical encounters per calendar month.
- **Active User Metering**: Number of active staff accounts authenticated during the billing cycle.
- **Storage Consumption**: Cloud storage volume utilized for patient records, digitized lab attachments, and radiology reports.
- **National DHA Transactions**: API invocations with the Digital Health Agency (DHA) health information exchange.
- **Integration API Calls**: External webhook and automated synchronization calls.

### Threshold Alerts & Server-Side Enforcement
1. **80% Warning Notification**: When a tenant reaches 80% of their monthly encounter or storage quota, a warning alert is flagged on the SaaS administration dashboard and logged via audit telemetry.
2. **100% Limit Notification**: When a tenant reaches 100% utilization, the system notifies hospital administrators to upgrade their subscription tier.
3. **Capacity Guards on Downgrade**: If a hospital attempts to downgrade to a lower subscription tier whose capacity limits (e.g., `maxUsers`) are less than currently active tenant resources, the server-side API rejects the downgrade with HTTP 400 Bad Request until excess accounts are deactivated.

---

## 4. Platform Invoicing and Payment Processing

### Invoicing Lifecycle
1. **Draft Generation**: Automated generation 7 days prior to subscription renewal date.
2. **Standard Tax Computation**:
   $$\text{Subtotal} = \sum (\text{Item Quantity} \times \text{Item Unit Price})$$
   $$\text{VAT (16\%)} = \text{Subtotal} \times 0.16$$
   $$\text{Total Invoice Amount} = \text{Subtotal} + \text{VAT}$$
3. **Idempotency Enforcement**: Every platform invoice creation and payment request requires a caller-specified `idempotencyKey`. Duplicate submissions with an identical key return the original record without duplicate charges.

### Payment Provider Adapter Architecture
Platform SaaS collections use the approved `IMpesaPaymentClient` from `@afyapoa/integration-adapters`:
- **M-Pesa STK Push**: Triggers instant SIM-toolkit authorization on the hospital finance officer's phone number (`+254XXXXXXXXX`).
- **Bank Transfer Reconciliation**: Allows manual reference matching with bank statement confirmation for institutional annual contracts.
- **Reactivation Trigger**: Once a full payment is processed, any overdue invoice status transitions to `PAID`, and associated restricted subscriptions are restored to `ACTIVE`.

---

## 5. Subscription Financial Reporting & Reconciliation

The platform provides administrative intelligence tools for platform operators:
- **Monthly Recurring Revenue (MRR)**: Sum of all active monthly subscription prices + annualized contracts normalized to monthly equivalents.
- **Annual Recurring Revenue (ARR)**: $\text{MRR} \times 12$.
- **Automated Financial Reconciliation**:
  - Compares all recorded `platform_payments` with completed status against issued `platform_invoices`.
  - Audits discrepancy between total collections and invoice balances.
  - Automatically flags unallocated receipts or partial payment discrepancies.
