# HR Legal Templates + Employee/Contractor Branching — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Employee vs Contractor branching to the HR module with cleaned-up, statutorily-compliant templates the producer can edit in-app.

**Architecture:** Templates live as JS constants in `lib/hrTemplates.js`, seeded to Firestore on first run, edited via `HrSettingsView`. A simple regex renderer (`lib/hrRender.js`) substitutes `{{placeholders}}`. OnboardingFlow picks templates based on `userProfile.workerClass`. AddEmployeeModal writes `workerClass` when the producer adds a hire.

**Tech Stack:** Next.js 14, Firebase Firestore, React, existing theme tokens.

**Context docs:**
- Design: `docs/plans/2026-04-11-hr-templates-design.md` — read this first.
- Existing HR module: `lib/hr.js`, `components/hr/*.js`
- User-provided source text: in the conversation — the Independent Contractor Agreement and Employee Handbook the producer pasted. Reference this when drafting.

**Notes:**
- No test framework in this repo. No TDD. Manual verification after each UI-touching task.
- No worktree. Work on `main`.
- All commits push to origin.
- Syntax check every touched file with `npx esbuild <file> --outfile=/dev/null --loader:.js=jsx` before committing.

---

## Task 1: Create `lib/hrRender.js`

**Files:**
- Create: `lib/hrRender.js`

**Step 1: Write the file**

```javascript
// lib/hrRender.js — template rendering engine for HR legal documents.
//
// Contract: substitutes {{key}} placeholders with values from a data object.
// Missing or null values render as empty strings (never undefined, never the
// literal {{key}}). Only 15 placeholders are supported — see buildTemplateData
// for the full list.

/**
 * Replace {{key}} placeholders in `text` with values from `data`.
 * Unknown keys render as empty strings.
 */
export function renderTemplate(text, data) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = data?.[key];
    return v == null || v === '' ? '' : String(v);
  });
}

/**
 * Build the full placeholder data object from a user profile + HR settings.
 * This is the SINGLE source of truth for what placeholders are valid. Any
 * placeholder used in a template that's not returned here will render empty.
 */
export function buildTemplateData(userProfile, hrSettings) {
  const annual = Number(userProfile?.ctc?.annual) || 0;
  const fmt = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  return {
    employeeName: userProfile?.name || '',
    email: userProfile?.email || '',
    jobTitle: userProfile?.designation || '',
    department: userProfile?.department || '',
    startDate: userProfile?.dateOfJoining || '',
    annualCtc: annual ? fmt(annual) : '',
    monthlyCtc: annual ? fmt(annual / 12) : '',
    employmentType: userProfile?.workerClass === 'contractor' ? 'Independent Contractor' : 'Full-time Employee',
    noticePeriodMonths: String(hrSettings?.noticePeriodMonths ?? 2),
    companyLegalName: hrSettings?.companyDetails?.legalName || 'Anandi Productions',
    companyAddress: hrSettings?.companyDetails?.address || '',
    companyEmail: hrSettings?.companyDetails?.adminEmail || '',
    companyPhone: hrSettings?.companyDetails?.phone || '',
    companyOwner: hrSettings?.companyDetails?.ownerName || 'Harnesh Joshi',
    effectiveDate: new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric'
    }),
  };
}
```

**Step 2: Syntax check**

Run: `cd /Users/harnesh/Claude_Files/anandi-productions && npx esbuild lib/hrRender.js --outfile=/dev/null --loader:.js=jsx`
Expected: clean compile, size ~1KB.

**Step 3: Commit**

```bash
git add lib/hrRender.js
git commit -m "feat(hr): add template rendering engine"
git push origin main
```

---

## Task 2: Create `lib/hrTemplates.js` — contractor agreement draft

**Files:**
- Create: `lib/hrTemplates.js` (partial — contractor agreement only in this task)

**Step 1: Draft the cleaned contractor agreement**

Start the file with a disclaimer comment and the `CONTRACTOR_AGREEMENT` constant. Base it on the user's original text (see conversation history), applying these fixes:

1. Fix typo `eight (9) hours` → `nine (9) hours`.
2. Fix §3.2(iv) and §14 consistency — both say 9 hours × 6 days but the total must be aligned to 48 hours/week cap per Maharashtra S&E Act. Rewrite to "up to 9 hours per day, not to exceed 48 hours per week, including at least one rest day".
3. Fix §4.1(a) contradiction — replace "purely commission fixed monthly remuneration based on the brackets" with "a fixed monthly remuneration as specified in the engagement letter, payable on or before the 10th of each month".
4. Remove personal mobile from §10 — replace with `{{companyEmail}}` and `{{companyAddress}}`.
5. Change §8.1 notice from 1 month to **2 months**. Same for §8.2.
6. Add new §8.7 — Damages Clause A (salary-in-lieu):
   > "If the Independent Contractor terminates this Agreement without serving the full 2 (two) month notice period under clause 8.1, the Contractor shall pay to the Company, as liquidated damages, an amount equivalent to the Contractor's gross monthly remuneration multiplied by the number of unserved notice months (pro-rated for partial months). This amount represents a genuine pre-estimate of the Company's loss in sourcing, training, and transitioning engagements, and is not a penalty. The Company may recover this amount from any final settlement, unpaid remuneration, reimbursements, or other dues payable to the Contractor."
7. Add new §8.8 — Damages Clause B (broad damages):
   > "In addition to clause 8.7, if the Contractor is terminated for cause under clause 8.3, or if the Contractor materially breaches clauses 5, 6, or 7, the Contractor shall be liable for all direct and consequential damages suffered by the Company, including but not limited to cost of replacement engagement, training, client handover, and loss of business arising from such departure or breach. The Company reserves the right to pursue recovery of such damages through appropriate legal channels."
8. Add §16 — Severability ("If any provision of this Agreement is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.")
9. Add §17 — Entire Agreement ("This Agreement constitutes the entire agreement between the parties and supersedes all prior agreements, understandings, and communications, whether written or oral.")
10. Add §18 — Force Majeure (standard short version).
11. Standardize all placeholders to `{{employeeName}}`, `{{email}}`, `{{jobTitle}}`, `{{startDate}}`, `{{companyLegalName}}`, `{{companyOwner}}`, `{{companyAddress}}`, `{{companyEmail}}`, `{{companyPhone}}`, `{{effectiveDate}}`, `{{noticePeriodMonths}}`, `{{monthlyCtc}}`, `{{annualCtc}}`.
12. At the top of the file, add this disclaimer comment:
    ```
    // ⚠️ LEGAL NOTICE: These templates are cleaned-up drafts based on the
    // producer's original text. They have NOT been reviewed by a lawyer. DO
    // NOT have anyone sign these without first having a qualified Indian
    // employment lawyer review the text. Statutory requirements (Maternity
    // Benefit Act, S&E Act leave minimums, POSH Act IC requirements) have
    // been addressed in spirit but the final language must be counsel-approved.
    ```

**Step 2: Syntax check**

Run: `cd /Users/harnesh/Claude_Files/anandi-productions && npx esbuild lib/hrTemplates.js --outfile=/dev/null --loader:.js=jsx`
Expected: clean compile.

**Step 3: Commit**

```bash
git add lib/hrTemplates.js
git commit -m "feat(hr): draft cleaned contractor agreement template"
git push origin main
```

---

## Task 3: Extend `lib/hrTemplates.js` — employee agreement draft

**Files:**
- Modify: `lib/hrTemplates.js`

**Step 1: Add `EMPLOYEE_AGREEMENT` constant**

Derive from the contractor agreement but:
- Retitle everywhere: "Employment Agreement", "Employee", "Employee Period", not "Independent Contractor".
- Add explicit reference to statutory benefits: PF, ESI, gratuity, annual bonus — all governed by applicable law.
- Add reference to statutory leave entitlements per the handbook.
- Keep the same notice period (2 months symmetric) and the same §8.7 / §8.8 damages clauses.
- Keep non-solicitation but add a code comment above the non-compete clause noting it's likely unenforceable under §27 of the Indian Contract Act and exists primarily as a deterrent.
- Use the same placeholder format.

**Step 2: Syntax check + commit**

```bash
npx esbuild lib/hrTemplates.js --outfile=/dev/null --loader:.js=jsx
git add lib/hrTemplates.js
git commit -m "feat(hr): draft employee agreement template"
git push origin main
```

---

## Task 4: Extend `lib/hrTemplates.js` — handbook draft

**Files:**
- Modify: `lib/hrTemplates.js`

**Step 1: Add `EMPLOYEE_HANDBOOK` constant**

Clean up the producer's original handbook text. Apply these statutory fixes:

1. §21 annual leave: 6 → **21 days** per calendar year (Maharashtra S&E Act minimum).
2. §22 sick leave: 6 → **7 days** per calendar year.
3. §23 maternity leave: 3 weeks → **26 weeks** for the first two children, **12 weeks** for third+, as per the Maternity Benefit Act 1961 (amended 2017).
4. §24 paternity leave: keep 30 days (no statutory minimum, company-generous is fine).
5. §13/§14 work hours: fix contradiction. Write: "Up to 9 hours per day, not to exceed 48 hours per week in accordance with the Maharashtra Shops and Establishments Act. Overtime beyond 48 hours per week is compensated at twice the ordinary rate."
6. Fix typos throughout (`eight (9) hours` etc).
7. §10 contact info: use `{{companyEmail}}`, remove personal mobile.
8. §42 Harassment: add placeholder for the POSH Internal Committee with a note: `POSH Internal Committee members: [TO BE FILLED BY HR — REQUIRED UNDER POSH ACT 2013]`.
9. Standardize placeholders.

**Step 2: Syntax check + commit**

```bash
npx esbuild lib/hrTemplates.js --outfile=/dev/null --loader:.js=jsx
git add lib/hrTemplates.js
git commit -m "feat(hr): draft employee handbook with statutory fixes"
git push origin main
```

---

## Task 5: Add offer letter templates + `DEFAULT_TEMPLATES` export

**Files:**
- Modify: `lib/hrTemplates.js`

**Step 1: Add `OFFER_LETTER_EMPLOYEE` and `OFFER_LETTER_CONTRACTOR`**

Short letters (~15 lines each). Placeholders: `{{employeeName}}`, `{{jobTitle}}`, `{{department}}`, `{{startDate}}`, `{{annualCtc}}`, `{{monthlyCtc}}`, `{{companyLegalName}}`, `{{companyOwner}}`, `{{effectiveDate}}`. Warm welcoming tone, congratulates hire, confirms position/start date/CTC, references the attached agreement and handbook.

**Step 2: Add `DEFAULT_TEMPLATES` bundle**

```javascript
export const DEFAULT_TEMPLATES = {
  employee: {
    offerLetter: OFFER_LETTER_EMPLOYEE,
    agreement: EMPLOYEE_AGREEMENT,
  },
  contractor: {
    offerLetter: OFFER_LETTER_CONTRACTOR,
    agreement: CONTRACTOR_AGREEMENT,
  },
  handbook: EMPLOYEE_HANDBOOK,
  termsAndConditions: '', // existing text, preserved from current settings if already set
};
```

**Step 3: Syntax check + commit**

```bash
npx esbuild lib/hrTemplates.js --outfile=/dev/null --loader:.js=jsx
git add lib/hrTemplates.js
git commit -m "feat(hr): add offer letters and DEFAULT_TEMPLATES bundle"
git push origin main
```

---

## Task 6: Wire templates into `lib/hr.js` settings layer

**Files:**
- Modify: `lib/hr.js` — extend `DEFAULT_HR_SETTINGS`, extend `getHrSettings()`, add `updateHrTemplates()`.

**Step 1: Import templates**

At the top:
```javascript
import { DEFAULT_TEMPLATES } from './hrTemplates';
```

**Step 2: Extend `DEFAULT_HR_SETTINGS`**

Add these fields to the existing default object:
```javascript
templates: DEFAULT_TEMPLATES,
noticePeriodMonths: 2,
```

**Step 3: Extend `getHrSettings`**

Ensure that if `settings/hr.templates` is missing from a loaded doc, the defaults are merged in AND persisted back to Firestore (so next reads are fast). Use a deep-ish merge so producer-edited fields aren't clobbered.

**Step 4: Add `updateHrTemplates(currentUserProfile, templatesPatch)`**

Producer-only (guard with `isHrFullAdmin`). Deep-merges into `settings/hr.templates`. Calls `logHrAction`.

**Step 5: Syntax check + commit**

```bash
npx esbuild lib/hr.js --outfile=/dev/null --loader:.js=jsx
git add lib/hr.js
git commit -m "feat(hr): seed and edit templates via settings"
git push origin main
```

---

## Task 7: Add `workerClass` radio to `AddEmployeeModal.js`

**Files:**
- Modify: `components/hr/AddEmployeeModal.js`

**Step 1: Add state**

Add `workerClass: 'employee'` to the initial `form` state.

**Step 2: Add radio UI**

At the top of the form (above "Full name"), add a radio group styled with existing theme tokens. Two options: "Employee" (default) and "Independent Contractor".

**Step 3: Write to user doc**

In `createUser(...)` call, add `workerClass: form.workerClass`. In `createEmployee(...)` call, add `workerClass: form.workerClass`.

**Step 4: Syntax check + commit**

```bash
npx esbuild components/hr/AddEmployeeModal.js --outfile=/dev/null --loader:.js=jsx
git add components/hr/AddEmployeeModal.js
git commit -m "feat(hr): add employee/contractor type selection"
git push origin main
```

---

## Task 8: Update `OnboardingFlow.js` to pick templates by `workerClass`

**Files:**
- Modify: `components/hr/OnboardingFlow.js`

**Step 1: Import**

```javascript
import { renderTemplate, buildTemplateData } from '@/lib/hrRender';
```

Remove the existing inline `fillTemplate(...)` helper (find it near the bottom of the file — it's the placeholder replacer we're replacing).

**Step 2: Add `templateData` memo**

Inside the `OnboardingFlow` component function:
```javascript
const templateData = useMemo(
  () => buildTemplateData(userProfile, hrSettings),
  [userProfile, hrSettings]
);

const pickTemplate = (docKey) => {
  const type = userProfile?.workerClass === 'contractor' ? 'contractor' : 'employee';
  const templates = hrSettings?.templates || {};
  if (docKey === 'offerLetter') return templates[type]?.offerLetter || '';
  if (docKey === 'agreement') return templates[type]?.agreement || '';
  if (docKey === 'handbook') return templates.handbook || '';
  if (docKey === 'termsAndConditions') return templates.termsAndConditions || '';
  return '';
};
```

**Step 3: Update each SignedDocumentStep usage**

Replace the existing `template={...}` props on the offer letter, agreement, handbook, and T&C steps:

```jsx
<SignedDocumentStep
  docKey="offerLetter"
  title="Offer Letter"
  template={renderTemplate(pickTemplate('offerLetter'), templateData)}
  ...
/>
```

And the agreement step's title is dynamic:
```jsx
title={userProfile?.workerClass === 'contractor' ? 'Independent Contractor Agreement' : 'Employment Agreement'}
```

**Step 4: Update `SignedDocumentStep` empty-state**

If `template` is empty, render: "This document is not yet configured — please contact HR." with the signing inputs disabled.

**Step 5: Syntax check + commit**

```bash
npx esbuild components/hr/OnboardingFlow.js --outfile=/dev/null --loader:.js=jsx
git add components/hr/OnboardingFlow.js
git commit -m "feat(hr): onboarding picks templates by workerClass"
git push origin main
```

---

## Task 9: Extend `HrSettingsView.js` with templates editor

**Files:**
- Modify: `components/hr/HrSettingsView.js`

**Step 1: Add local state**

```javascript
const [templatesTab, setTemplatesTab] = useState('employee'); // 'employee' | 'contractor' | 'handbook'
const [templateDrafts, setTemplateDrafts] = useState(null);
const [previewOpen, setPreviewOpen] = useState(false);
```

On load, initialize `templateDrafts` from `hrSettings.templates`.

**Step 2: Add "Templates" section**

New collapsible card below the existing Offer Letter section. Inside: tab bar (Employee / Contractor / Handbook). Each tab shows the relevant textareas:
- Employee tab: `offerLetter`, `agreement` textareas (bound to `templateDrafts.employee.*`).
- Contractor tab: same structure for `templateDrafts.contractor.*`.
- Handbook tab: single `handbook` textarea.

All textareas use theme-token styling, `rows={20}`, monospace font, full width.

**Step 3: Add Preview button**

Renders the current textarea content through `renderTemplate` with a sample data object (hardcoded fake employee values) and shows the result in a modal. Lets the producer see the real output before saving.

**Step 4: Add Save button**

Calls `updateHrTemplates(userProfile, templateDrafts)`. Shows success toast. Sub-admins see textareas as `readOnly`.

**Step 5: Syntax check + commit**

```bash
npx esbuild components/hr/HrSettingsView.js --outfile=/dev/null --loader:.js=jsx
git add components/hr/HrSettingsView.js
git commit -m "feat(hr): template editor with tabs and preview"
git push origin main
```

---

## Task 10: Manual verification

**Step 1: Reload the app.** On next login the `getHrSettings` seeder runs and writes defaults to `settings/hr.templates`.

**Step 2: Test Employee flow.** In AddEmployee modal, pick "Employee", create a test user, log in as them, walk through onboarding, verify the Employment Agreement and Handbook show the cleaned text with placeholders filled.

**Step 3: Test Contractor flow.** Same thing but pick "Independent Contractor". Verify the Contractor Agreement appears (not the Employment Agreement).

**Step 4: Test Settings editor.** As producer, open HR Settings → Templates tab. Edit a template, hit Preview, verify the render looks right. Save. Reload. Verify the edit persisted.

**Step 5: Report results.** If anything looks wrong, describe exactly what's broken and which task/file needs the fix.

---

## Summary

| # | Task | File(s) | Approx LOC |
|---|---|---|---|
| 1 | Render engine | `lib/hrRender.js` (new) | ~40 |
| 2 | Contractor template | `lib/hrTemplates.js` (new) | ~200 |
| 3 | Employee template | `lib/hrTemplates.js` | ~180 |
| 4 | Handbook template | `lib/hrTemplates.js` | ~350 |
| 5 | Offer letters + bundle | `lib/hrTemplates.js` | ~60 |
| 6 | Settings integration | `lib/hr.js` | ~40 |
| 7 | AddEmployeeModal radio | `components/hr/AddEmployeeModal.js` | ~25 |
| 8 | OnboardingFlow picker | `components/hr/OnboardingFlow.js` | ~30 |
| 9 | Settings editor | `components/hr/HrSettingsView.js` | ~150 |
| 10 | Manual verification | — | — |

**Total:** ~1,100 new lines across 5 files. All contained in `lib/` and `components/hr/`. Zero changes to `MainApp.js`.
