# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

<!-- Responsive web; mobile matters (team reviews/approves on phones, WhatsApp-first
     communication). Not a native app. Existing stack (Next.js 14 + Firebase + Vercel)
     is answered by the codebase, so no Stack section. -->

## Users

- **Producer / owner (Harnesh)** — sole proprietor of Anandi Productions (Mumbai media/production house). Super-admin; runs everything: projects, client reviews, team, HR, payroll.
- **Internal team** — editors, shooters, PR, social media, office staff, accounts. Roles vary; they work inside the app daily to run projects, upload/deliver assets, act on feedback, and (as employees) do onboarding/attendance/leave.
- **Clients** — external brand/agency contacts who review photos and videos and give feedback. **Clients do NOT log in** — they review via a share link (`/share/{token}`). No client accounts.

## Product Purpose

The full operating system for a boutique production house. Three co-equal jobs:
1. **Client content review** — share shoots (photos/videos), collect frame-accurate feedback, iterate to approval.
2. **Team / project workflow** — organize projects, assets, versions, tasks, deliverables across the team.
3. **HR / payroll** — onboard the internal team, run attendance (Jibble), leave, payroll, payslips, contracts.

Success = the studio runs its entire client-delivery + team + back-office on one branded system instead of scattered tools (email, WhatsApp, spreadsheets, generic review sites).

## Positioning

An **all-in-one production-house OS** — client review + team workflow + HR/payroll unified under one brand — sized for a boutique Indian studio. Where neighbors specialize (Frame.io = review only; a PM tool = tasks only; an HR SaaS = payroll only), this is the single place the whole business runs, tuned to the realities of a small production house (WhatsApp-first, INR, sole-proprietor statutory reality, shoot/pre/post rhythms).

## Operating Context

- **Production rhythm:** pre-production → shoots → post-production → client review loops → delivery. Hours are irregular (long shoot days, night shoots, weekends, travel) — reflected in contracts and expectations.
- **Client review loop:** producer shares a link → client rates/selects/comments (often frame- or timestamp-specific) → team revises → re-review → approve → deliver hi-res.
- **Communication:** WhatsApp-first (invites, credentials, nudges) because email delivery is unreliable for this audience. Email is secondary (SMTP via `system@anandiproductions.com`).
- **Attendance:** Jibble CSV export drives payroll.
- **Locale:** Mumbai, India; INR; Indian statutory context (sole proprietor, <10 people → no PF/ESI/gratuity/PT; contractors are the default worker class).

## Capabilities and Constraints

- **Assets** live inside `projects/{id}.assets[]` (images/videos/audio/docs) with ratings, color labels, selection, status, versions, comments (`feedback[]`), drawings (`annotations[]`).
- **Review:** comments can be pinned to a video timestamp and (being built) to a frame coordinate — Frame.io-style. Custom canvas overlay (own code, MIT-safe), not a licensed lib.
- **Sharing:** public share links; hi-res download gated until unlocked.
- **HR:** employees (extend `users` with `isEmployee`), onboarding, leave ledger, comp-off, attendance import, monthly payroll, payslips, termination, probation, offer-letter PDF upload.
- **Constraint — Firestore 1 MB/doc:** assets+comments stored as arrays in the project doc; watch the ceiling, migrate to subcollections if a project grows large (see `docs/PLAYBOOK.md`).
- **Constraint — client SDK cannot delete Auth users:** needs Admin SDK for full user deletion / admin password reset.

## Brand Commitments

- **Name:** Anandi Productions. **Owner:** Harnesh Joshi.
- **Identity:** black + yellow (logo = bold "AP" + yellow play triangle; `#FACC15` = brand yellow, accent/focus only, never a fill behind text). Design system in `docs/design-system.md`; component library in `components/ui/`.
- Official documents (contracts, offer letters, model release, T&C, handbook, payslips) must carry AP branding — use the `ap-brand-design` skill as the source of truth for letterhead/format.
- Voice: confident, cinematic, no-fluff, premium.

## Evidence on Hand

- Real legal/HR templates in repo: contractor + employee agreements, handbook, offer letters, model release (`lib/hrTemplates.js`, sample PDFs provided by owner).
- Real brand assets: logo (`components/Logo.js`), brand tokens.
- Live production data: real employees, projects, clients on the deployed app (`anandi-productions.vercel.app`).
- **Do not fabricate:** testimonials, client names, case studies, pricing, or benchmarks — none are established.

## Product Principles

1. **Client review is the soul; make it feel like Frame.io, not a form.** Frame-accurate, fast, delightful — even though clients never log in.
2. **One system, three co-equal jobs.** Review, team workflow, HR/payroll are all first-class; don't let one rot while polishing another.
3. **WhatsApp-first, email-second.** Never depend on email for anything critical; always give a shareable link/credential path.
4. **Small-studio reality over enterprise theater.** Match the sole-proprietor / contractor / INR / irregular-hours truth; don't impose big-company statutory assumptions.
5. **Build to not re-derive.** Ship in small chunks; keep `docs/ROADMAP.md` + `ARCHITECTURE.md` + `PLAYBOOK.md` + `BUILDING-BLOCKS.md` current so future work is cheap. Adopt-and-own permissive OSS over reinventing.
6. **SaaS-aware, not SaaS-now.** Anandi-only today, but avoid data/architecture choices that would block multi-tenancy (per-org branding, tenant isolation) later.

## Accessibility & Inclusion

- WCAG AA baseline (contrast, visible focus rings in brand yellow, keyboard nav, `prefers-reduced-motion`, ≥44px touch targets) — enforced via the `components/ui/` primitives.
- Mobile-first for team members reviewing/approving on phones.
