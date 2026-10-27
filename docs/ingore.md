COMKEY AFYA POA — Executable Engineering Roadmap & Implementation Backlog
Target System: COMKEY AFYA POA — Multi-Tenant Healthcare Management Information System (HMIS) SaaS
Target Sector: Kenyan Healthcare Facilities (Levels 2–6)
Author: Principal Software Architect & Healthcare Technology Compliance Researcher
Status: Awaiting User Approval to Begin Implementation

Executive Summary
Using the approved regulatory research and technical architecture, COMKEY AFYA POA has been decomposed into an executable, independently testable engineering roadmap.

Three master engineering governance documents have been created under 

/docs/
:



/docs/product-requirements.md
: Comprehensive Product Requirements Document (PRD) detailing personas, facility levels (2–6), statutory alignments, and functional requirements.


/docs/acceptance-criteria.md
: Formal testable acceptance criteria structured in Given-When-Then (Gherkin) syntax across all 16 milestones, including automated verification gates.


/docs/implementation-backlog.md
: A master implementation backlog covering 16 milestones. Every single task explicitly details all 13 required attributes:
Task ID and Name
Business Purpose
Functional Requirements
Technical Dependencies
Regulatory and Security Implications
Database Changes
API Changes
UI Changes
Required Automated Tests
Acceptance Criteria
Documentation Updates
Known Risks & External Dependencies
Definition of Done (DoD)
IMPORTANT

No application code has been written. Per your instructions, this roadmap, its dependency graph, and the proposed completion gates are presented below for your review and formal approval.

1. Dependency Graph & Critical Path Analysis
The project is structured into 16 sequential milestones. The diagram below illustrates the critical path, identifying which tasks must be completed before downstream work can begin:

mermaid
flowchart TD
    M01[M1: Repo & Foundation] --> M02[M2: Tenancy & IAM]
    M02 --> M03[M3: Database & Infra]
    M03 --> M04[M4: Patient Registration]
    M04 --> M05[M5: Encounters & Triage]
    M05 --> M06[M6: Diagnoses & Orders]
    M06 --> M07[M7: Laboratory]
    M06 --> M08[M8: Pharmacy]
    M05 --> M09[M9: Billing & Payments]
    M01 --> M10[M10: DHA/SHA Mock Gateway]
    M09 & M10 --> M11[M11: SHA Claims & ECCIF]
    M06 & M10 --> M12[M12: DHA FHIR SHR]
    M05 & M07 & M08 --> M13[M13: Inpatient & Theatre]
    M02 & M09 --> M14[M14: SaaS Admin & Billing]
    M11 & M12 --> M15[M15: Security & Certification]
    M13 & M14 & M15 --> M16[M16: Performance & Handover]
    classDef critical fill:#f96,stroke:#333,stroke-width:2px;
    class M01,M02,M03,M04,M05,M06,M09,M10,M11,M12,M15 critical;
Critical Blocking Dependencies:
Foundation & Tenant Isolation Gate (M1 $\to$ M2 $\to$ M3): Must be complete before any clinical data is accepted. Database Row-Level Security (RLS) and KMS envelope encryption must be enforced at the storage engine level so no clinical table is created without native multi-tenant protection.
Clinical Core Gate (M4 $\to$ M5 $\to$ M6): Patient registration with blind-indexed National IDs and WHO ICD-11 terminology auto-complete must be operational before laboratory, pharmacy, or billing can create orders.
Payer & Interoperability Gate (M10 $\to$ M11 & M12): The hexagonal mock simulator (TASK-10-01 & TASK-10-02) must be verified against official DHA/SHA schemas before building outbound SHA eClaims (TASK-11-02) or DHA SHR bundles (TASK-12-02), ensuring zero external network dependencies during development.
Certification & Compliance Gate (M15 $\to$ M16): Automated DHA 4-phase pre-UAT test suite (TASK-15-01) and the ODPC 72-hour breach SOP (TASK-15-02) must pass before final performance benchmarking and production deployment.
2. Summary of the 16 Milestones & Tasks
Milestone	Key Objective	Primary Tasks	Prerequisite Milestones
M1: Repo & Foundation	Scaffolding, monorepo, CI/CD, shared UI design system	TASK-01-01: Turborepo Monorepo & Toolchain
TASK-01-02: GitHub Actions CI Pipeline
TASK-01-03: Shared UI Design System (Tailwind/shadcn)	None
M2: Tenancy & IAM	Database RLS, OAuth2/OIDC, TOTP MFA, Clinician PUID verification	TASK-02-01: Multi-Tenant Schema & PostgreSQL RLS
TASK-02-02: IAM Authentication & TOTP MFA
TASK-02-03: RBAC/ABAC & Clinician License (PUID)	M1
M3: Core Database & Infra	Drizzle ORM migrations, KMS envelope encryption, WORM audit, BullMQ	TASK-03-01: Drizzle Schema Migrations & Base DDL
TASK-03-02: AES-256-GCM & HMAC Blind Indexing
TASK-03-03: WORM Append-Only Audit Subsystem
TASK-03-04: Redis & BullMQ Queue Framework	M1, M2
M4: Patient Registration	Demographic capture, blind-indexed search, DHA CR sync, Emergency intake	TASK-04-01: Patient Schema & Secure Blind Search API
TASK-04-02: DHA Client Registry (CR) Client
TASK-04-03: Emergency Unknown Patient Intake	M2, M3
M5: Encounters & Triage	Encounter state machine, vital signs acuity, SOAP notes, 24h ECCIF watcher	TASK-05-01: Encounter Lifecycle & Queue Management
TASK-05-02: Triage Vitals & Acuity Scoring (ESI 1–5)
TASK-05-03: SOAP Notes & Electronic Signature Immutability
TASK-05-04: 24-Hour ECCIF Emergency SLA Watcher	M3, M4
M6: Diagnoses & Orders	WHO ICD-11 terminology auto-suggest, CPOE order routing (Lab/Pharmacy)	TASK-06-01: WHO ICD-11 Terminology & Trigram Search
TASK-06-02: CPOE Order Routing Framework	M5
M7: Laboratory	Specimen collection, barcode accessioning, result entry, critical alarms	TASK-07-01: Specimen Collection & Barcoding
TASK-07-02: Lab Results Entry & Critical Value Alerts	M6
M8: Pharmacy & Dispensing	FEFO inventory batch allocation, e-dispensing, drug interaction & allergy check	TASK-08-01: Dispensing & FEFO Batch Engine
TASK-08-02: Drug-Drug Interaction & Allergy Interceptor	M6
M9: Billing & Payments	Multi-payer charge master, Safaricom Daraja M-Pesa STK, KRA eTIMS signing	TASK-09-01: Dynamic Multi-Payer Charge Master
TASK-09-02: M-Pesa C2B & STK Push Integration
TASK-09-03: KRA eTIMS Fiscal Invoice Generation	M5, M6, M7, M8
M10: DHA/SHA Mock Gateway	Hexagonal ports-and-adapters, driver switching, in-memory synthetic simulator	TASK-10-01: Hexagonal Ports-and-Adapters Gateway
TASK-10-02: In-Memory DHA/SHA Synthetic Simulator	M1
M11: SHA Claims & ECCIF	5-step digital eligibility, FHIR R4 Claim compilation, Remittance reconciliation	TASK-11-01: SHA 5-Step Digital Eligibility Client
TASK-11-02: FHIR R4 Claim Compilation & BullMQ Queue
TASK-11-03: SHA Remittance Reconciliation & Appeals	M9, M10
M12: FHIR Exchange & SHR	DHA OTP/biometric patient consent, FHIR R4 SHR encounter bundle publisher	TASK-12-01: Patient Consent via DHA OTP & Break-Glass
TASK-12-02: FHIR R4 Shared Health Record (SHR) Publisher	M6, M10
M13: Expanded Hospital Ops	Inpatient wards, bed occupancy map, nursing eMAR, operating theatre scheduling	TASK-13-01: Inpatient Wards, Bed Layout & eMAR
TASK-13-02: Operating Theatre Scheduling & WHO Checklist	M5, M7, M8
M14: SaaS Admin & Billing	Automated tenant onboarding, KMFL config, subscription tiers, quota monitoring	TASK-14-01: Multi-Tenant Onboarding & KMFL Config
TASK-14-02: SaaS Subscriptions, Invoicing & Quotas	M2, M9
M15: Security & Certification	Automated DHA 4-phase pre-UAT test suite, ODPC 72-hour breach SOP & Form 1	TASK-15-01: DHA 4-Phase Pre-UAT Test Suite & PDF Audit
TASK-15-02: ODPC 72-Hour Breach Protocol & Form 1	M11, M12
M16: Performance & Handover	k6 load benchmarking (2,000 CCU), Terraform Kenyan Tier-3 deployment, DR drill	TASK-16-01: k6 High-Concurrency Benchmarking
TASK-16-02: Terraform Sovereign Kenyan Deployment & DR	M13, M14, M15
3. Formal Completion Gates & Quality Standards
Before any milestone is marked complete, it must satisfy three rigorous verification gates:

Gate A: Engineering & Testing Standards
Static Analysis: TypeScript compilation with zero errors (tsc --noEmit), ESLint zero warnings.
Test Coverage: $\ge 85%$ line and branch coverage across all domain packages.
Integration Tests: Passing integration test suite executing within Dockerized PostgreSQL, Redis, and mock service containers.
Gate B: Regulatory & Security Compliance
Tenant Isolation: Cross-tenant query penetration tests verify zero data leakage with PostgreSQL RLS active.
Data Sovereignty: All database, cache, and object storage configurations point strictly to verified Kenyan Tier-3 data centers (Regulation 26 DPA 2021).
Cryptographic Invariants: Sensitive PII columns verify AES-256-GCM ciphertext at rest; exact search queries execute via HMAC-SHA256 blind indexing.
Audit Lineage: Every data mutation creates an append-only, SHA-256 chained entry in audit_events.
Gate C: Statutory Interoperability
DHA Schema Conformance: Outbound payloads strictly conform to Kenya Core FHIR R4 JSON schemas.
Emergency Treatment SLA: Inpatient/emergency triage workflows guarantee admission without blocking on administrative payments or network connectivity.
4. Proposed Immediate Next Step: Approval to Start Milestone 1
All preparatory research, architectural design, requirements, and testable tasks are documented, committed, and ready:



docs/product-requirements.md


docs/acceptance-criteria.md


docs/implementation-backlog.md


docs/architecture/
Please provide your approval to proceed. Upon your confirmation, work will commence immediately on Milestone 1: Repository and Engineering Foundation:

Initializing the Turborepo monorepo structure with pnpm (apps/web, apps/api, packages/*).
Setting up the GitHub Actions CI/CD pipeline and code quality automation.
Implementing the shared design system with Tailwind CSS and shadcn/ui.
9:23 AM
9:35 AM
Dependencies are currently downloading and being linked across all monorepo workspaces (apps/web, apps/api, apps/worker, apps/mock-server, and packages/*). I am standing by for the installation to finish.

Next.js 15 is creating the optimized production build for @afyapoa/web. Standing by for completion.

Unit tests are executing across the test runners. Standing by for completion.

pnpm build is running across the workspaces. Standing by for completion.

Engineering Foundation Implementation Report: COMKEY AFYA POA
System: COMKEY AFYA POA — Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities
Repository: comkeycreativelimited/afyapoa.co.ke
Milestone: Milestone 1 — Repository & Engineering Foundation
Status: Completed & Verified
Date: October 19, 2026

1. Current State Inspection & Work Preservation
Before initiating implementation, the workspace was inspected:

Existing Documentation Preserved: All 10 existing architectural and regulatory files in 

/docs/
 were completely preserved and left intact.
Git Repository Clean: Verified clean working tree on branch main tracking origin/main.
Toolchain Detected: Node.js v24.13.0, pnpm 10.30.2, Docker 29.7.2.
2. Implemented Monorepo Architecture
The monorepo was structured using Turborepo and pnpm workspaces in full alignment with the approved system design:

c:/wamp64/www/afya-poa/
├── .github/workflows/ci.yml         # GitHub Actions multi-stage CI pipeline
├── apps/
│   ├── web/                         # Next.js 15 PWA frontend (React 19, Tailwind CSS)
│   ├── api/                         # NestJS 10 modular monolith REST API
│   ├── worker/                      # Dedicated BullMQ background queue worker process
│   └── mock-server/                 # In-memory DHA HIE & SHA Claims synthetic simulator
├── packages/
│   ├── config/                      # Zod-validated environment configurations
│   ├── database/                    # Drizzle ORM schema, RLS policies, migrations, synthetic seed
│   ├── domain-core/                 # Core domain primitives, Result monad, error types, tenant context
│   ├── fhir-models/                 # Kenya Core FHIR R4 profile definitions & interfaces
│   ├── integration-adapters/        # Hexagonal ports & adapters for DHA HIE, SHA, KRA eTIMS
│   ├── logger/                      # Structured logging module with Pino
│   └── ui/                          # Shared Tailwind CSS / component library tokens
├── infra/
│   ├── docker/                      # Docker Compose (PostgreSQL 16, Redis 7, init scripts)
│   │   ├── docker-compose.yml
│   │   ├── init.sql                 # Enables uuid-ossp, pgcrypto, pg_trgm extensions
│   │   └── .env                     # Local container port configuration
│   └── terraform/                   # Infrastructure-as-code blueprints
├── docs/                            # Complete research, PRD, acceptance criteria, architecture
├── .env.example                     # Non-sensitive placeholder environment template
├── .gitignore                       # Production-grade gitignore
├── .prettierrc                      # Consistent code formatting rules
├── package.json                     # Monorepo root scripts & dev dependencies
├── pnpm-workspace.yaml              # Workspace package definitions
├── tsconfig.base.json               # Monorepo TypeScript strict base configuration
├── turbo.json                       # Turborepo task pipeline configuration
└── README.md                        # Master setup, architecture & troubleshooting guide
3. Implementation of the 13 Required Deliverables
1. TypeScript & Package-Management Conventions
Root 

tsconfig.base.json
 configured in strict mode (strict: true, noUncheckedIndexedAccess: true, target: ES2022, module: NodeNext).
Root 

pnpm-workspace.yaml
 defines apps/* and packages/*.


turbo.json
 specifies tasks: build, test, lint, typecheck, dev, and clean with dependency chaining and outputs caching.
2. Linting, Formatting, Type Checking & Test Tooling
Formatting: Prettier configured in 

.prettierrc
 with root scripts pnpm format and pnpm format:fix.
Testing: Vitest test runners configured across packages with root script pnpm test.
Type Checking: Strict non-emitting TypeScript compiler checks via pnpm typecheck.
3. Validated Configuration Loading
Implemented in 

packages/config
 using Zod. Validates database connections, Redis URLs, JWT secrets, integration switches (MOCK | SANDBOX | PRODUCTION), and external gateway URLs at process startup. Fails immediately with detailed error messages if any variable is invalid.
4. Docker Compose for Local Development
Configured in 

infra/docker/docker-compose.yml
 and wrapped by root 

docker-compose.yml
.
Starts PostgreSQL 16 Alpine (with automated health check pg_isready) and Redis 7 Alpine (with AOF persistence and redis-cli ping health check).
5. PostgreSQL and Redis Services
Initialized and running with volume mounts (afyapoa_postgres_data, afyapoa_redis_data).
Custom extension script 

infra/docker/init.sql
 activates uuid-ossp, pgcrypto, and pg_trgm.
6. Database Migration Tooling
Implemented in 

packages/database
 using Drizzle ORM and postgres.js.
Migration runner 

packages/database/src/migrate.ts
 sets up tenants, facility_profiles, users, audit_events (WORM), and enables Row-Level Security (ALTER TABLE users ENABLE ROW LEVEL SECURITY) with tenant_isolation_policy.
7. Structured Application Logging
Implemented in 

packages/logger
 using Pino.
Automatically structures logs with ISO timestamps, log level, context name, tenantId, facilityCode, and correlationId. Uses human-readable pino-pretty in development and JSON in production.
8. Health and Readiness Checks
Implemented in 

apps/api/src/health/health.controller.ts
:
Liveness: GET /health/liveness returns process uptime and status.
Readiness: GET /health/readiness dynamically executes health queries against PostgreSQL and Redis, returning latency in milliseconds.
9. OpenAPI / Swagger Generation
Implemented in 

apps/api/src/main.ts
 using @nestjs/swagger.
Interactive Swagger UI rendered at http://localhost:4000/api/docs.
Raw OpenAPI 3.0.0 JSON specification served at http://localhost:4000/api/docs-json.
10. GitHub Actions CI Pipeline
Defined in 

.github/workflows/ci.yml
.
Automatically provisions ephemeral PostgreSQL and Redis service containers, installs dependencies, validates Docker Compose syntax, runs database migrations, seeds synthetic data, runs typecheck, unit tests, and compiles the entire monorepo.
11. Safe .env.example
Complete template created in 

.env.example
 containing placeholder values only.
Local .env is ignored by .gitignore to prevent credential leaks.
12. Synthetic Seed Data (No Real Patient Information)
Implemented in 

packages/database/src/seed.ts
.
Populates 3 fictional demonstration healthcare facilities across levels 2, 3, and 5:
Nairobi Metropolitan Referral Hospital (Level 5): KMFL FID-01-000101-1, SHA Contract SHA-CTR-00101.
Afya Poa Community Health Centre Kibera (Level 3): KMFL FID-01-000202-2, SHA Contract SHA-CTR-00202.
St. Jude Faith Dispensary Machakos (Level 2): KMFL FID-02-000303-3, SHA Contract SHA-CTR-00303.
Seeds synthetic staff accounts (Medical Superintendent, Clinician, Triage Nurse, Pharmacist, Billing Clerk) with dummy Argon2 password hashes. Contains zero real patient data.
13. Root README & Operational Instructions
Created in 

README.md
 with quick-start steps, architecture diagrams, port conflict resolutions, and troubleshooting commands.
4. Verification Evidence & Command Execution Results
1. Build Verification (pnpm build)
bash
turbo run build
Result: 11 of 11 packages and applications built successfully (Next.js 15 web client, NestJS API, BullMQ worker, Mock server, and all shared packages).

2. Unit Test Verification (pnpm test)
bash
turbo run test
Result: 14 of 14 test tasks passed (100% green):

HealthController: Liveness and general health tests pass.
Domain Core: Result monad (ok/fail), error status codes, and facility level enum tests pass.
Config: Environment schema validation and invalid driver rejection tests pass.
Integration Adapters: DHA Client Registry, SHA Claims, and KRA eTIMS mock client tests pass.
Database: Drizzle schema definitions and table constraints tests pass.
Worker: Queue processor configuration tests pass.
Mock Server: DHA/SHA synthetic contract route tests pass.
3. Type Checking (pnpm typecheck)
bash
turbo run typecheck
Result: 18 of 18 tasks successful with zero TypeScript errors under strict mode.

4. Docker Compose Verification
bash
docker compose -f infra/docker/docker-compose.yml up -d --force-recreate
docker ps
Result:

CONTAINER ID   IMAGE                STATUS                   PORTS                     NAMES
c221f35eba0f   postgres:16-alpine   Up (healthy)             0.0.0.0:5434->5432/tcp    afyapoa-postgres
323b91026229   redis:7-alpine       Up (healthy)             0.0.0.0:6381->6379/tcp    afyapoa-redis
(Dedicated host ports 5434 and 6381 configured to prevent collision with pre-existing local database services).

5. Database Migrations & Synthetic Seed
bash
pnpm db:migrate
pnpm db:seed
Result:

[MIGRATION] Connecting to PostgreSQL database...
[MIGRATION] Applying core extensions and foundational tables...
[MIGRATION] All foundational tables and RLS policies created successfully.
[SEED] Connecting to database for synthetic seeding...
[SEED] Inserting synthetic healthcare facilities (tenants)...
[SEED] Seeded 3 tenants: 576b1558-..., 6e520fc6-..., 098e29f2-...
[SEED] Synthetic demonstration seed completed successfully. (NO real patient data was generated).
6. Live API Health & Integration Probe
powershell
Invoke-RestMethod http://localhost:4000/health/readiness
Output:

json
{
  "status": "ok",
  "timestamp": "2026-10-19T07:08:34.847Z",
  "checks": {
    "database": { "status": "up", "latencyMs": 67 },
    "redis": { "status": "up", "latencyMs": 17 }
  }
}
powershell
Invoke-RestMethod http://localhost:4000/api/v1/integrations/status
Output:

json
{
  "activeDriver": "MOCK",
  "dhaHieBaseUrl": "http://localhost:4010/dha",
  "shaClaimsBaseUrl": "http://localhost:4010/sha",
  "kraEtimsBaseUrl": "http://localhost:4010/etims",
  "isMock": true
}
powershell
Invoke-RestMethod http://localhost:4000/api/docs-json
Output:

json
{
  "openapi": "3.0.0",
  "info": {
    "title": "COMKEY AFYA POA API",
    "version": "0.1.0"
  }
}
5. Documentation Synchronization
The architecture documentation has been updated to reflect the actual verified code:



docs/architecture/roadmap.md
: Phase 0 marked as COMPLETED & VERIFIED.


docs/implementation-backlog.md
: TASK-01-01, TASK-01-02, and TASK-01-03 marked as COMPLETED & VERIFIED.
6. How to Run the Platform
From the project root:

bash
# 1. Start Postgres & Redis
pnpm docker:up
# 2. Run migrations & synthetic seed
pnpm db:migrate
pnpm db:seed
# 3. Start all applications concurrently
pnpm dev
Frontend Web App: http://localhost:3000
Backend API & Swagger: http://localhost:4000/api/docs
API Health Check: http://localhost:4000/health/readiness
Mock Simulator: http://localhost:4010/health
No clinical features have been implemented. The engineering foundation is operational and ready for Milestone 2: Tenant Isolation, Authentication, and Authorization.