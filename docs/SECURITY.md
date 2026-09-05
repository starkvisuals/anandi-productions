# Anandi Productions — Security

## The exposure we found (2026-09-05)

The Firestore database was wide open (`allow read, write: if true`). Verified live with
a **no-auth, public REST read from the open internet** — HTTP 200, full contents of every
project, including `shareLinks` (each client's access **token + password hash**) and every
client's `assets`. Anyone with the project ref could also **write and delete** everything.

This is the single highest-severity issue for client work: one leaked link, curious client,
or competitor could read every client's material at once.

## Why it wasn't a one-line rule change

The login-less client share page (`app/share/[token]/page.js`) was *built on* the open
rules — it **listed the entire `projects` collection** in the browser to find the one project
matching a token. Locking the rules naively would break every client link.

## The fix

### Phase 1 — shipped in the app (no secret, no breakage)
- Added a **`shareTokens/{token}` index** (`lib/firestore.js`): each share link now maps its
  token → project, so a client resolves their link with a **single-doc GET**, never a list.
  Written on `createShareLink`; legacy tokens self-heal + were backfilled.
- Refactored the share page, share-verify route to resolve via the index (list kept only as a
  legacy fallback, which locked rules will simply deny).
- Wrote fail-safe rules: `firestore.rules` + `storage.rules`.

### Phase 1 — YOU deploy the rules (≈2 min, Firebase console)
> Do this **after** the app deploy that ships the index resolver is live (so no client link
> breaks). The one existing active token has already been backfilled into the index.

1. Firebase Console → **Firestore Database → Rules** → paste all of `firestore.rules` → **Publish**.
2. Firebase Console → **Storage → Rules** → paste all of `storage.rules` → **Publish**.
3. Verify: open the live editor share link — it should still load. In an incognito window,
   the public REST read of `/projects` should now return **403**, not 200.

**What Phase 1 closes:** anonymous *listing* of the whole database — the mass-exfiltration
hole. Users, HR, settings, workflow templates become **team-only**. **What remains:** a client
mutation (rate/select/feedback/upload) is still allowed on a project *if its random id is
known* — dramatically harder (ids are no longer discoverable) but not zero.

### Phase 2 — airtight (needs a Firebase Admin service account)
Route every login-less client mutation through server API routes using the **Firebase Admin
SDK** (bypasses rules safely; validates the share token server-side). Then flip the
`‹PHASE-2›` lines in `firestore.rules` / `storage.rules` from `if true` to `if false`.

Setup (only Harnesh can do — involves a secret Claude must never handle):
1. Firebase Console → Project settings → **Service accounts → Generate new private key** (JSON).
2. Vercel → Project → Settings → **Environment Variables** → add `FIREBASE_SERVICE_ACCOUNT`
   = the JSON (as a single-line string), for Production.
3. Tell Claude it's set — the server routes + `lib/firebase-admin.js` get wired, tested, then
   the `‹PHASE-2›` rule lines flip.
