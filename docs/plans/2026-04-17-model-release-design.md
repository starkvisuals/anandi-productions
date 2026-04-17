# Model Release & Do's/Don'ts — Design Doc

**Date:** 2026-04-17

## Goal

Public, no-login form that models/talent fill out before a shoot. Admin creates a "Release Campaign" with a label, gets one shareable link. Models open it, complete a 4-step wizard, done.

## Admin Flow

1. Sidebar → **Releases** section (separate from HR)
2. "New Release Campaign" → enter label (e.g. "Nike Shoot April 2026")
3. Get shareable link: `domain.com/release/{campaignId}`
4. See all submissions per campaign — view, download PDF, email
5. Optionally tag campaign to a project later

## Model Flow (public, no login)

4-step wizard:

1. **Personal Details** — name, phone, address, Aadhar number, DOB
2. **Photo** — selfie via camera or upload
3. **Model Release** — must scroll to bottom → "I Agree" unlocks → digital signature
4. **Do's & Don'ts** — must scroll to bottom → "I Agree" → submit

GPS location captured automatically via browser API.

## Firestore Schema

```
release_campaigns/{campaignId}
  label: string
  createdAt: timestamp
  createdBy: uid
  projectId: string | null  (tagged later)

release_campaigns/{campaignId}/submissions/{submissionId}
  name, phone, address, aadhar, dob: strings
  photoUrl, photoPath: string (Firebase Storage)
  signatureUrl, signaturePath: string (Firebase Storage)
  gpsLat, gpsLng: number
  agreedReleaseAt: timestamp
  agreedDosDontsAt: timestamp
  submittedAt: timestamp
  userAgent: string
```

## File Layout

```
app/release/[campaignId]/page.js          — public form page (no auth)
app/api/release/pdf/route.js              — PDF generation endpoint
components/releases/ReleasesModule.js     — admin dashboard (sidebar section)
components/releases/CreateCampaignModal.js — new campaign modal
components/releases/SubmissionDetail.js   — view a single submission
components/releases/ReleaseFormWizard.js  — the 4-step public wizard
lib/releases.js                           — Firestore CRUD for campaigns + submissions
lib/releaseTexts.js                       — Model Release text + Do's/Don'ts text
```

## Legal Texts

### Model Release
Based on existing Anandi Productions PDF — enhanced with:
- Project/campaign label shown at top
- Aadhar number as ID proof
- GPS location + timestamp for evidentiary value
- Digital signature

### Do's & Don'ts (Production Conduct Agreement)
Covers:
- No BTS photos/videos on social media without written permission
- No sharing of creative/concept/storyline/script details
- No sharing of client brand details before official launch
- No direct contact with the client
- No recording of proprietary production techniques
- Professional conduct on set
- Compliance with safety and direction instructions
- Consequences: liability for damages, legal action under Indian law
- Survival: obligations continue after the shoot

## Reuse from HR Module

- `SignaturePad.js` — digital signature canvas (already built)
- `WebcamCapture.js` — selfie/photo capture (already built)

## PDF Output

Server-side generation with Anandi Productions branding:
- All personal details
- Embedded photo + signature images
- Full release text + Do's/Don'ts text
- GPS coordinates + timestamps
- Downloadable + emailable
