# HR Legal Templates + Employee/Contractor Branching — Design

**Date:** 2026-04-11
**Author:** Harnesh + Claude
**Status:** Approved

## Goal

1. Clean up the Independent Contractor Agreement and Employee Handbook text (fix legal/statutory issues).
2. Add a second template for true employees (distinct from contractors).
3. Let the producer pick "Employee" or "Contractor" when adding a new hire, and have the onboarding flow show the correct document.
4. Let the producer edit all templates in-app via HR Settings.

## Non-goals (Phase 2 items)

- PDF export of signed documents.
- Template versioning / history.
- Multi-language.
- Conditional blocks in templates (`{{#if}}`).
- Legal review — a lawyer must review the drafted text before production use.

## Architecture decisions

| Decision | Choice |
|---|---|
| Template storage | File-seeded (`lib/hrTemplates.js`), Firestore-edited |
| Rendering engine | Regex replace `{{key}}`, ~10 lines |
| Onboarding branching | Template-level (same flow, different text source) |
| Notice period | Symmetric 2 months (employee and company) |
| Damages clause | A (salary-in-lieu, default) + B (broad damages, additional) |
| Worker type field name | `workerClass: 'employee' \| 'contractor'` |

## File layout

**New:**
- `lib/hrTemplates.js` — default template constants: `CONTRACTOR_AGREEMENT`, `EMPLOYEE_AGREEMENT`, `EMPLOYEE_HANDBOOK`, `OFFER_LETTER_EMPLOYEE`, `OFFER_LETTER_CONTRACTOR`, `DEFAULT_TEMPLATES`.
- `lib/hrRender.js` — `renderTemplate(text, data)` and `buildTemplateData(userProfile, hrSettings)`.

**Edited:**
- `lib/hr.js` — `getHrSettings()` seeds `templates` from `DEFAULT_TEMPLATES` if missing. New `updateHrTemplates()` setter.
- `components/hr/AddEmployeeModal.js` — new "Type" radio (Employee / Independent Contractor) → writes `workerClass`.
- `components/hr/OnboardingFlow.js` — picks template by `userProfile.workerClass` on offer letter, agreement, handbook, T&C steps. Dynamic step titles.
- `components/hr/HrSettingsView.js` — new Templates section with tabs (Employee / Contractor / Handbook) and Preview button.

**Untouched:** `MainApp.js`, all access guards, all other components.

## Firestore data shape

`settings/hr` adds:
```
{
  templates: {
    employee: { offerLetter, agreement },
    contractor: { offerLetter, agreement },
    handbook,
    termsAndConditions
  },
  noticePeriodMonths: 2
}
```

`users/{uid}` adds:
```
{
  workerClass: 'employee' | 'contractor'  // defaults to 'employee' for existing users
}
```

## Placeholder catalog

Only these 15 placeholders may appear in any template:

`{{employeeName}}`, `{{email}}`, `{{jobTitle}}`, `{{department}}`, `{{startDate}}`, `{{annualCtc}}`, `{{monthlyCtc}}`, `{{employmentType}}`, `{{noticePeriodMonths}}`, `{{companyLegalName}}`, `{{companyAddress}}`, `{{companyEmail}}`, `{{companyPhone}}`, `{{companyOwner}}`, `{{effectiveDate}}`

Missing values render as empty strings (never `undefined` or literal `{{key}}`).

## Render engine

```javascript
export function renderTemplate(text, data) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = data?.[key];
    return v == null || v === '' ? '' : String(v);
  });
}
```

`buildTemplateData(userProfile, hrSettings)` assembles all 15 values, formats `annualCtc`/`monthlyCtc` as `₹X,XX,XXX`, derives `employmentType` label from `workerClass`, uses today's date for `effectiveDate`.

## Bootstrap / seed flow

On first `getHrSettings()` read, if `settings/hr.templates` is missing, write defaults from `DEFAULT_TEMPLATES` to Firestore. Subsequent reads return producer-edited values. Producer edits always win.

## Legal text changes (applied when drafting the template strings)

1. **Contractor Agreement** — cleaned up version of the user's text:
   - Fix "eight (9) hours" typo.
   - Fix "purely commission fixed monthly remuneration" contradiction.
   - Fix §3.2(iv) and §14 consistency.
   - Remove personal mobile from §10 notices.
   - Change notice period from 1 to 2 months in §8.1 and §8.2.
   - Add §8.7 Damages clause A (salary-in-lieu for unserved notice).
   - Add §8.8 Damages clause B (additional broad damages for cause termination).
   - Add severability, entire agreement, force majeure clauses.
   - Standardize all placeholders to `{{...}}` format.
   - Add disclaimer comment at top: "Review with a lawyer before use."

2. **Employee Agreement** — new template. Based on contractor agreement structure but:
   - Titled "Employment Agreement" throughout.
   - References PF/ESI/gratuity eligibility.
   - References statutory leave entitlements.
   - Notice period 2 months symmetric.
   - Same damages clauses A+B.
   - Same IP/confidentiality/non-solicitation (non-compete flagged as likely unenforceable in a code comment).

3. **Employee Handbook** — cleaned up version of the user's text:
   - Fix §21 annual leave: 6 → 21 days (Maharashtra S&E Act minimum).
   - Fix §22 sick leave: 6 → 7 days.
   - Fix §23 maternity leave: 3 weeks → 26 weeks (Maternity Benefit Act 1961).
   - Fix §13/14 work hours: align to 48 hours/week cap.
   - Fix typos throughout.
   - Update §10 contact info to company email, not personal mobile.
   - Add POSH Internal Committee placeholder (to be filled by producer).

## Error handling

- Empty template → signing UI shows "Document not yet configured — contact HR", buttons disabled.
- Missing placeholder → renders empty string.
- Missing `workerClass` → defaults to `'employee'`.
- Producer edits template during active onboarding → employee sees new version on next step render (not real-time).

## Testing

Manual verification:
1. Add employee with type "Employee", log in as them, verify correct templates appear.
2. Add employee with type "Contractor", log in, verify contractor templates appear.
3. Edit a template in Settings, hit Preview, verify render.
4. Complete onboarding, verify Firestore stores rendered text (not template string).

No automated tests — no test framework currently in repo.
