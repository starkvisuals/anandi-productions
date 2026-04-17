# Model Release & Do's/Don'ts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Public, no-login model release form with shareable link per campaign — captures personal details, photo, signature, GPS, and two scroll-to-agree sections (Model Release + Do's/Don'ts).

**Architecture:** New `release_campaigns` Firestore collection with submissions subcollection. Public Next.js page at `/release/[campaignId]` renders a 4-step wizard reusing existing SignaturePad + WebcamCapture. Admin manages campaigns from a new "Releases" sidebar section. PDF generation via API route.

**Tech Stack:** Next.js 14 App Router, Firebase Firestore + Storage, existing SignaturePad.js + WebcamCapture.js components, jspdf for PDF generation.

---

### Task 1: Legal texts — Model Release + Do's/Don'ts

**Files:**
- Create: `lib/releaseTexts.js`

**Step 1: Write the file**

```javascript
// lib/releaseTexts.js — Legal text constants for Model Release forms.
//
// ⚠️ LEGAL NOTICE: These are drafts. Have a lawyer review before use.

export const MODEL_RELEASE_TEXT = `MODEL RELEASE

In consideration of my engagement as a model, and for other good and valuable consideration herein acknowledged as received, I hereby grant the following rights and permissions to {{companyLegalName}} / {{companyOwner}} ("Producer / Photographer"), his/her heirs, legal representatives, and assigns, those for whom Photographer is acting, and those acting with his/her authority and permission.

They have the irrevocable, perpetual, and unrestricted right and permission to take, use, re-use, publish, and republish photographic portraits or pictures of me or in which I may be included, in whole or in part, or composite or distorted in character or form, without restriction as to changes or alterations, in conjunction with my own or a fictitious name, or reproductions thereof in colour or otherwise, made through any medium at his/her studios or elsewhere, and in any and all possible digital media formats now or hereafter known, specifically including but not limited to distribution over the internet, for illustration, promotion, art, editorial, advertising, trade, or any other purpose whatsoever.

I specifically consent to the digital compositing or distortion of the portraits or pictures, including without restriction any changes or alterations as to colour, size, shape, perspective, context, foreground or background. I also consent to the use of any published matter in conjunction with such photographs.

I hereby waive any right that I may have to inspect or approve the finished product or products and the advertising copy or other matter that may be used in connection with them or the use to which they may be applied.

I hereby release, discharge, and agree to hold harmless the Producer / Photographer, his/her heirs, legal representatives, and assigns, and all persons acting under his/her permission or authority or those for whom he/she is acting, from any liability by virtue of any blurring, distortion, alteration, optical illusion, or use in composite form, whether intentional or otherwise, that may occur or be produced in the taking of such photographs or in any subsequent processing of them, as well as any publication of them, including without limitation any claims for libel or violation of any right of publicity or privacy.

I hereby warrant that I am of full age and have the right to contract in my own name. I have read the above authorization, release, and agreement, prior to its execution, and I am fully familiar with the contents of this document. This document shall be binding upon me and my heirs, legal representatives, and assigns.

Campaign / Project: {{campaignLabel}}
Date: {{submissionDate}}`;

export const DOS_AND_DONTS_TEXT = `PRODUCTION CONDUCT AGREEMENT — DO'S & DON'TS

This Production Conduct Agreement ("Agreement") is entered into between {{companyLegalName}} ("the Company") and the undersigned ("the Participant") in connection with the production identified as "{{campaignLabel}}".

By agreeing to this document, the Participant acknowledges and agrees to the following terms:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO'S — EXPECTED CONDUCT

1. FOLLOW DIRECTIONS: Follow all instructions given by the Director, Producer, Assistant Director, or any authorised crew member during the shoot.

2. PUNCTUALITY: Arrive on time at the designated location. Inform the production coordinator immediately if you anticipate any delay.

3. PROFESSIONAL CONDUCT: Maintain professional behaviour at all times on set, at locations, during travel, and at any production-related event.

4. SAFETY COMPLIANCE: Follow all safety protocols, including use of protective equipment where required, and immediately report any unsafe conditions or incidents.

5. WARDROBE & APPEARANCE: Maintain the wardrobe, hair, and makeup as directed by the production team. Do not make changes without approval.

6. CONFIDENTIALITY: Keep all production details, creative concepts, scripts, storyboards, and client information strictly confidential.

7. RESPECT: Treat all crew members, fellow talent, clients, vendors, and members of the public with respect and courtesy.

8. PROPERTY CARE: Handle all production equipment, props, wardrobe, and location property with care. Report any damage immediately.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DON'TS — PROHIBITED CONDUCT

1. NO UNAUTHORISED BTS CONTENT: Do NOT take, record, or share any behind-the-scenes (BTS) photographs, videos, audio recordings, or screen recordings on any personal device or social media platform without prior written permission from the Company. This includes Instagram Stories, Reels, TikTok, YouTube, WhatsApp Status, Snapchat, or any other platform.

2. NO SHARING OF CREATIVE DETAILS: Do NOT share, discuss, or disclose any creative concepts, scripts, storyboards, mood boards, shot lists, editing styles, or production techniques with any third party, including friends, family, other production houses, or on social media.

3. NO CLIENT INFORMATION DISCLOSURE: Do NOT disclose the name, brand, product, campaign details, or launch dates of the client before the official public release/launch, unless explicitly authorised in writing by the Company.

4. NO DIRECT CLIENT CONTACT: Do NOT contact the client, brand representatives, or agency personnel directly unless instructed to do so by the Company. All communication with the client must go through the Company.

5. NO UNAUTHORISED USE OF PRODUCTION MATERIAL: Do NOT copy, download, duplicate, forward, or use any production footage, photographs, edits, raw files, or other deliverables for personal portfolios, showreels, auditions, or any other purpose without prior written permission from the Company.

6. NO SUBSTANCE USE: Do NOT consume alcohol, drugs, or any intoxicating substance during working hours, on set, at locations, or during any production-related activity.

7. NO DISRUPTIVE BEHAVIOUR: Do NOT engage in any behaviour that disrupts the production, causes delays, creates an unsafe environment, or reflects poorly on the Company or the client.

8. NO REMOVAL OF PROPERTY: Do NOT remove any equipment, props, wardrobe, or production material from the set or location without written authorisation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONSEQUENCES OF VIOLATION

Any violation of this Agreement may result in one or more of the following:

(a) Immediate removal from the production without compensation for remaining work;

(b) The Participant shall be liable for all direct and consequential damages suffered by the Company and/or the client, including but not limited to: loss of business, client penalties, legal costs, and reputational damage;

(c) The Company reserves the right to pursue legal action under applicable Indian law, including but not limited to: the Indian Contract Act 1872, the Information Technology Act 2000, the Copyright Act 1957, and any other applicable statute;

(d) If BTS content is posted without authorisation, the Participant shall immediately remove such content upon notice and shall be liable for any damages arising from the period of publication.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SURVIVAL

The obligations under this Agreement, particularly those relating to confidentiality, non-disclosure, and prohibited use of production material, shall survive the completion of the production and remain in effect indefinitely.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACKNOWLEDGEMENT

By clicking "I Agree" below, I confirm that I have read, understood, and agree to comply with all the terms set out in this Production Conduct Agreement.

Campaign / Project: {{campaignLabel}}
Date: {{submissionDate}}`;
```

**Step 2: Syntax check**

Run: `cd /Users/harnesh/Claude_Files/anandi-productions && npx esbuild lib/releaseTexts.js --outfile=/dev/null --loader:.js=jsx`
Expected: clean compile.

**Step 3: Commit**

```bash
git add lib/releaseTexts.js && git commit -m "feat(releases): model release + dos/donts legal texts"
```

---

### Task 2: Firestore CRUD — lib/releases.js

**Files:**
- Create: `lib/releases.js`

**Step 1: Write the file**

```javascript
// lib/releases.js — Firestore CRUD for release campaigns + submissions.

import { db, storage } from './firebase';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import { ref as sRef, uploadBytesResumable, uploadString, getDownloadURL } from 'firebase/storage';

// ─── Campaign CRUD ──────────────────────────────────────────────────────────

const campaignsRef = () => collection(db, 'release_campaigns');

const generateCampaignId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
};

export const createCampaign = async (actor, label) => {
  if (!actor?.id) throw new Error('Not authenticated');
  const id = generateCampaignId();
  await setDoc(doc(db, 'release_campaigns', id), {
    label: label.trim(),
    createdAt: serverTimestamp(),
    createdBy: actor.id,
    createdByName: actor.name || actor.email || '',
    projectId: null,
    submissionCount: 0,
    status: 'active', // active | archived
  });
  return { id, label: label.trim() };
};

export const getCampaigns = async () => {
  const snap = await getDocs(query(campaignsRef(), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getCampaign = async (campaignId) => {
  const snap = await getDoc(doc(db, 'release_campaigns', campaignId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

export const updateCampaign = async (campaignId, data) => {
  await updateDoc(doc(db, 'release_campaigns', campaignId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const archiveCampaign = async (campaignId) => {
  await updateCampaign(campaignId, { status: 'archived' });
};

// ─── Submission CRUD ────────────────────────────────────────────────────────

const submissionsRef = (campaignId) =>
  collection(db, 'release_campaigns', campaignId, 'submissions');

export const createSubmission = async (campaignId, data) => {
  // Public — no auth check. Validate campaign exists.
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error('Invalid release link');
  if (campaign.status !== 'active') throw new Error('This release form is no longer accepting submissions');

  const docRef = await addDoc(submissionsRef(campaignId), {
    ...data,
    submittedAt: serverTimestamp(),
  });

  // Increment submission count
  await updateDoc(doc(db, 'release_campaigns', campaignId), {
    submissionCount: (campaign.submissionCount || 0) + 1,
  });

  return { id: docRef.id };
};

export const getSubmissions = async (campaignId) => {
  const snap = await getDocs(query(submissionsRef(campaignId), orderBy('submittedAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getSubmission = async (campaignId, submissionId) => {
  const snap = await getDoc(doc(db, 'release_campaigns', campaignId, 'submissions', submissionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

export const deleteSubmission = async (campaignId, submissionId) => {
  await deleteDoc(doc(db, 'release_campaigns', campaignId, 'submissions', submissionId));
};

// ─── Storage helpers ────────────────────────────────────────────────────────

export const uploadReleasePhoto = async (campaignId, file) => {
  const path = `releases/${campaignId}/${Date.now()}-photo.jpg`;
  const ref = sRef(storage, path);
  const task = uploadBytesResumable(ref, file);
  await new Promise((resolve, reject) => {
    task.on('state_changed', null, reject, resolve);
  });
  const url = await getDownloadURL(task.snapshot.ref);
  return { url, path };
};

export const uploadReleaseSignature = async (campaignId, dataUrl) => {
  const path = `releases/${campaignId}/${Date.now()}-signature.png`;
  const ref = sRef(storage, path);
  const snap = await uploadString(ref, dataUrl, 'data_url');
  const url = await getDownloadURL(snap.ref);
  return { url, path };
};
```

**Step 2: Syntax check**

Run: `node -e "try { require('./lib/releases.js') } catch(e) { if(e.code==='ERR_REQUIRE_ESM' || e.message.includes('firebase')) console.log('OK'); else console.log(e.message) }"`
Expected: "OK"

**Step 3: Commit**

```bash
git add lib/releases.js && git commit -m "feat(releases): Firestore CRUD for campaigns + submissions"
```

---

### Task 3: Public release form wizard — ReleaseFormWizard.js

**Files:**
- Create: `components/releases/ReleaseFormWizard.js`

This is the main public-facing component — the 4-step wizard models fill out. It's a large component.

**Step 1: Write the file**

The wizard has 4 steps:
1. PersonalDetailsStep — name, phone, address, Aadhar, DOB
2. PhotoStep — reuses WebcamCapture from HR module
3. ModelReleaseStep — scroll-to-bottom to unlock "I Agree" + SignaturePad
4. DosDontsStep — scroll-to-bottom to unlock "I Agree" + submit

Key behaviors:
- GPS location requested on mount via `navigator.geolocation`
- Each step validates before advancing
- On final submit, uploads photo + signature to Storage, creates submission in Firestore
- Confirmation screen after submit
- Branded with Anandi Productions logo
- Mobile-first responsive design
- MODEL_RELEASE_TEXT and DOS_AND_DONTS_TEXT rendered with campaign label substituted

The scroll-to-bottom pattern: a ref on a sentinel div at the bottom of the text, IntersectionObserver sets `hasScrolledToBottom = true`, which enables the "I Agree" checkbox/button.

Reuse imports:
```javascript
import SignaturePad from '@/components/hr/SignaturePad';
import WebcamCapture from '@/components/hr/WebcamCapture';
import { MODEL_RELEASE_TEXT, DOS_AND_DONTS_TEXT } from '@/lib/releaseTexts';
import { uploadReleasePhoto, uploadReleaseSignature, createSubmission } from '@/lib/releases';
```

**Step 2: Syntax check**

Run: `npx esbuild components/releases/ReleaseFormWizard.js --outfile=/dev/null --loader:.js=jsx`
Expected: clean compile (ignoring import resolution).

**Step 3: Commit**

```bash
git add components/releases/ReleaseFormWizard.js && git commit -m "feat(releases): 4-step public release form wizard"
```

---

### Task 4: Public page route — app/release/[campaignId]/page.js

**Files:**
- Create: `app/release/[campaignId]/page.js`

**Step 1: Write the file**

```javascript
'use client';
import { useState, useEffect } from 'react';
import { getCampaign } from '@/lib/releases';
import ReleaseFormWizard from '@/components/releases/ReleaseFormWizard';
import { useParams } from 'next/navigation';

export default function ReleasePage() {
  const { campaignId } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!campaignId) return;
    getCampaign(campaignId)
      .then(c => {
        if (!c) setError('This release link is invalid.');
        else if (c.status !== 'active') setError('This release form is no longer accepting submissions.');
        else setCampaign(c);
      })
      .catch(() => setError('Something went wrong. Please try again.'))
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  return <ReleaseFormWizard campaign={campaign} campaignId={campaignId} />;
}

// Minimal loading/error screens — styled inline, no theme dependency (public page).
function LoadingScreen() { /* centered spinner with AP branding */ }
function ErrorScreen({ message }) { /* centered error message with AP branding */ }
```

**Step 2: Commit**

```bash
git add app/release/[campaignId]/page.js && git commit -m "feat(releases): public release page route"
```

---

### Task 5: Admin dashboard — ReleasesModule.js + CreateCampaignModal.js

**Files:**
- Create: `components/releases/ReleasesModule.js`
- Create: `components/releases/CreateCampaignModal.js`

**Step 1: Write ReleasesModule.js**

Admin view with two states:
- **Campaign list** — shows all campaigns with label, date, submission count, copy-link button, archive button. Click → drill into submissions.
- **Submission list** — shows all submissions for a campaign. Each row: name, phone, date. Click → detail view with all info, photo, signature. Download PDF button. Email button.

Props: `{ t, userProfile }` (same pattern as EmployeeModule.js)

**Step 2: Write CreateCampaignModal.js**

Simple modal — one input field (campaign label) + Create button. On create, shows the shareable link with a copy button.

Props: `{ t, onClose, onCreated }`

**Step 3: Syntax check both**

**Step 4: Commit**

```bash
git add components/releases/ && git commit -m "feat(releases): admin dashboard + create campaign modal"
```

---

### Task 6: Wire into MainApp.js sidebar

**Files:**
- Modify: `components/MainApp.js`

**Step 1: Add "Releases" to navItems array (around line 2209)**

Add after the employees entry:
```javascript
...(isProducer || canManageEmployeesNow ? [{
  id: 'releases',
  icon: 'document',
  label: 'Releases',
}] : []),
```

If there's no `document` icon in the Icons object, add one (simple clipboard/document SVG).

**Step 2: Add the view render case**

Find where `currentView === 'employees'` renders `<EmployeeModule>` and add:
```javascript
{currentView === 'releases' && <ReleasesModule t={t} userProfile={userProfile} />}
```

Add import at top:
```javascript
import ReleasesModule from './releases/ReleasesModule';
```

**Step 3: Commit**

```bash
git add components/MainApp.js && git commit -m "feat(releases): add Releases section to sidebar"
```

---

### Task 7: PDF generation — API route

**Files:**
- Create: `app/api/release/pdf/route.js`

**Step 1: Install jspdf**

Run: `npm install jspdf`

**Step 2: Write the API route**

POST endpoint. Receives `{ campaignId, submissionId }`. Fetches submission from Firestore, generates a branded PDF with:
- Anandi Productions header
- Campaign label
- Personal details (name, phone, address, Aadhar, DOB)
- Photo (embedded)
- Model Release full text + "Agreed" timestamp
- Do's & Don'ts full text + "Agreed" timestamp
- Signature image (embedded)
- GPS coordinates
- Submission timestamp

Returns PDF as `application/pdf` response.

**Step 3: Commit**

```bash
git add app/api/release/pdf/ package.json package-lock.json && git commit -m "feat(releases): PDF generation API route"
```

---

### Task 8: Email integration

**Files:**
- Modify: `app/api/send-email/route.js` (add `model_release_pdf` email type)

**Step 1: Add email type**

Add a new case in the email handler that:
- Generates the PDF (calls the pdf route internally or shares the generation logic)
- Sends it as an attachment to the specified email address
- Subject: "Model Release — {modelName} — {campaignLabel}"

**Step 2: Commit**

```bash
git add app/api/send-email/ && git commit -m "feat(releases): email PDF of signed model release"
```

---

### Task 9: Testing checkpoint — STOP FOR USER TESTING

**What to test:**
1. Go to Releases in sidebar → Create a new campaign → copy the link
2. Open the link in an incognito/phone browser (no login)
3. Fill out all 4 steps — verify scroll-to-bottom works, signature works, photo works
4. Submit → check it appears in the admin dashboard
5. Download PDF → verify all details are there
6. Try emailing the PDF

---

### Task 10: Tag campaign to project (optional follow-up)

**Files:**
- Modify: `components/releases/ReleasesModule.js` — add a "Tag to Project" dropdown
- Read: `lib/firestore.js` — use `getProjects()` to list available projects

This is a small enhancement: in the campaign detail view, add a dropdown to select an existing project. Saves `projectId` on the campaign doc.

**Step 1: Add project tagging UI**

**Step 2: Commit**

```bash
git commit -m "feat(releases): tag campaign to project"
```

---

## Summary

| Task | What | ~LOC |
|------|------|------|
| 1 | Legal texts (releaseTexts.js) | ~120 |
| 2 | Firestore CRUD (releases.js) | ~110 |
| 3 | Public wizard (ReleaseFormWizard.js) | ~500 |
| 4 | Public page route | ~50 |
| 5 | Admin dashboard + modal | ~400 |
| 6 | Wire into MainApp sidebar | ~15 |
| 7 | PDF generation API | ~200 |
| 8 | Email integration | ~40 |
| 9 | **STOP — user testing** | — |
| 10 | Tag to project (optional) | ~30 |

**Total: ~1,465 LOC across 8 files**
