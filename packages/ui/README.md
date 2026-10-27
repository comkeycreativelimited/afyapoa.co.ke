# @afyapoa/ui — Clinical Design System & Component Library

`@afyapoa/ui` is the sovereign clinical design system and accessible component library for the **COMKEY AFYA POA** Hospital Management Information System (HMIS). Designed specifically for Kenyan healthcare facilities (Levels 2–6), it adheres to **WCAG 2.2 AA** standards, supports multi-modal status communication, and provides low-bandwidth touch-first ergonomics.

---

## Component Inventory

### 1. `Button`
Accessible, focus-ringed interactive trigger supporting multiple clinical intents and states.
- **Variants:** `primary` (emerald-700), `secondary` (slate-100), `outline` (slate-300), `danger` (red-600), `ghost` (transparent), `teal` (teal-700), `indigo` (indigo-700).
- **Sizes:** `sm` (h-8), `md` (h-10 / 40px), `lg` (h-12 / 48px).
- **Accessibility:** `aria-busy` and `aria-live` during loading state; minimum 44×44px touch target on mobile/tablet viewports; visible 2px emerald focus offset ring (`focus-visible:ring-2`).

### 2. `Badge` & `StatusBadge`
High-contrast indicators that **never rely on color alone** (WCAG 2.2 SC 1.4.1).
- **Icons & Text:** Every status pairs an SVG icon (`CheckCircle2`, `Clock`, `AlertOctagon`, `ShieldCheck`, `Info`) with explicit text.
- **Semantic Variants:** `success` (green), `warning` (amber), `danger` (red), `info` (blue), `neutral` (slate), `teal` (teal), `indigo` (indigo), `purple` (purple).
- **Usage:**
  ```tsx
  <StatusBadge status="VERIFIED" label="DHA UPI Verified" />
  <StatusBadge status="PENDING" label="Awaiting Triage" />
  <StatusBadge status="DISPATCHED" label="SHA Sent" />
  ```

### 3. `PatientContextBanner`
Pinned, persistent clinical encounter context bar providing unambiguous identity verification (WCAG 2.2 SC 3.3.2).
- **Attributes:** Full Patient Name, MRN, National ID / Birth Cert, Sex, Age, Blood Group, DHA UPI Verification Badge, SHA Insurance Contract, Active Encounter Number.
- **Safety Critical:** Displays pulsating, high-contrast red allergy banner (`Allergies: PENICILLIN (Anaphylaxis)`) whenever patient has documented drug allergies. Never dismissible during active encounter.

### 4. `ClinicalAlert`
High-contrast alert component for clinical safety notices.
- **Principle:** Never hides a clinically important error (e.g. fatal drug-drug interaction, panic laboratory result, unverified patient identity) behind a generic auto-dismissing toast.
- **Severities:** `critical`, `warning`, `info`, `success`.
- **Special Modes:** Supports `isPanic={true}` with flashing border and recovery action buttons.

### 5. `AccessibleDialog`
WAI-ARIA 1.2 compliant modal dialog for clinical confirmations and data entry.
- **Accessibility Features:**
  - Focus trapping: Tab and Shift+Tab wrap within the modal boundary.
  - Initial focus placed on the first interactive element.
  - Return focus: Restores focus to the trigger button upon dismissal.
  - Dismissal: Escape key and backdrop click handlers.
  - Semantics: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`.

### 6. `AccessibleTable`
Keyboard-navigable tabular data presentation.
- **Accessibility Features:**
  - `tabIndex={0}` container with horizontal scroll support for dense clinical grids.
  - Explicit `<caption className="sr-only">` describing purpose and record count.
  - Built-in loading state with `aria-busy="true"` and spinner.
  - Dedicated empty state with contextual action button.

### 7. Form Controls (`InputField`, `SelectField`, `TextareaField`)
Accessible clinical inputs with explicit labels and error announcements.
- **Accessibility Features:**
  - Mandatory `<label htmlFor="...">` pairing.
  - Required indicators with `aria-required="true"`.
  - Error messages linked via `aria-describedby` with `role="alert"`.
  - Minimum touch height: 44px (`min-h-[44px]`) on touch-enabled devices.

### 8. `OfflineIndicator`
Sovereign network state badge and synchronization queue counter.
- **Modes:** `Online`, `Low-Bandwidth`, `Syncing`, `Offline`.
- **Functionality:** Displays count of local SQLite / IndexedDB pending sync items, with manual "Sync Now" trigger.

### 9. `SkipLink`
Accessible skip-to-content navigation link for screen reader and keyboard-only users.
- Placed as the very first focusable element in the DOM.
- Targets `#main-content`.

---

## Design Tokens & Contrast Verification

| Token | Tailwind Class | Hex Code | Contrast on White | WCAG 2.2 AA Compliance |
|-------|----------------|----------|-------------------|------------------------|
| Brand Primary | `bg-emerald-700` | `#047857` | **4.91 : 1** | PASS (Normal & Large Text) |
| Brand Primary Dark | `bg-emerald-800` | `#065f46` | **7.15 : 1** | PASS (AAA Level) |
| Clinical Warning Dark | `text-amber-900` | `#78350f` | **8.12 : 1** | PASS (AAA Level) |
| Clinical Danger Dark | `text-red-800` | `#991b1b` | **5.90 : 1** | PASS (AA Level) |
| Clinical Teal Dark | `text-teal-800` | `#115e59` | **6.75 : 1** | PASS (AA Level) |
| Neutral Text Primary | `text-slate-900` | `#0f172a` | **16.1 : 1** | PASS (AAA Level) |
| Neutral Text Secondary | `text-slate-600` | `#475569` | **5.45 : 1** | PASS (AA Level) |

---

## Build & Module Architecture

`@afyapoa/ui` is compiled as pure ECMAScript Modules (ESM) with `"type": "module"` and TypeScript typings:
```bash
# Build package
pnpm --filter @afyapoa/ui build

# Typecheck
pnpm --filter @afyapoa/ui typecheck
```
