import { NextResponse } from 'next/server';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Server-side gatekeeper for login-less client actions on a shared project.
// The client sends only a share TOKEN + a minimal intent (e.g. assetId+rating);
// the server validates the token, then re-derives and applies the mutation with
// the Admin SDK. The client never writes to Firestore directly, so the DB rules
// can deny anonymous writes entirely. Each action is authorised by link type.

const genId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

async function resolveToken(token) {
  const db = adminDb();
  const idxSnap = await db.collection('shareTokens').doc(token).get();
  if (!idxSnap.exists || idxSnap.data().active === false) return null;
  const { projectId } = idxSnap.data();
  if (!projectId) return null;
  const projSnap = await db.collection('projects').doc(projectId).get();
  if (!projSnap.exists) return null;
  const project = { id: projSnap.id, ...projSnap.data() };
  const link = (project.shareLinks || []).find((l) => l.token === token && l.active);
  if (!link) return null;
  return { db, project, link };
}

const isClientLink = (link) => link.type === 'client';
const isEditorLink = (link) => link.type === 'editor';

export async function POST(request, { params }) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
    }
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const { action, payload = {} } = body;
    if (!token || !action) {
      return NextResponse.json({ error: 'token and action required' }, { status: 400 });
    }

    const resolved = await resolveToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Invalid or inactive share link' }, { status: 404 });
    }
    const { db, project, link } = resolved;
    const ref = db.collection('projects').doc(project.id);

    const activity = (message, type) => ({ id: genId(), type, message, timestamp: new Date().toISOString() });

    // Every asset-array write runs in a transaction that re-reads the FRESHEST
    // project, so a login-less client's action never clobbers a simultaneous
    // team-member or vendor write (last-write-wins → silent data loss). `build`
    // receives the current project and returns the update patch (or falsy to skip).
    const txMutate = (build) =>
      db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error('Project gone');
        const proj = { id: snap.id, ...snap.data() };
        const patch = build(proj);
        if (patch) tx.update(ref, patch);
        return patch;
      });

    switch (action) {
      // ---- CLIENT review actions ----
      case 'rate': {
        if (!isClientLink(link)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        const { assetId, rating } = payload;
        const r = Math.max(0, Math.min(5, Number(rating) || 0));
        await txMutate((proj) => ({ assets: (proj.assets || []).map((a) => (a.id === assetId ? { ...a, rating: r } : a)) }));
        return NextResponse.json({ ok: true, rating: r });
      }
      case 'toggleSelect': {
        if (!isClientLink(link)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        const { assetId } = payload;
        let newSelected;
        await txMutate((proj) => {
          const cur = (proj.assets || []).find((a) => a.id === assetId);
          newSelected = !cur?.isSelected;
          return { assets: (proj.assets || []).map((a) => (a.id === assetId ? { ...a, isSelected: newSelected, status: newSelected ? 'selected' : 'pending' } : a)) };
        });
        return NextResponse.json({ ok: true, isSelected: newSelected });
      }
      case 'colorLabel': {
        if (!isClientLink(link)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        const { assetId, label } = payload;
        let newLabel;
        await txMutate((proj) => {
          const cur = (proj.assets || []).find((a) => a.id === assetId);
          newLabel = cur?.colorLabel === label ? null : label;
          return { assets: (proj.assets || []).map((a) => (a.id === assetId ? { ...a, colorLabel: newLabel } : a)) };
        });
        return NextResponse.json({ ok: true, colorLabel: newLabel });
      }
      case 'clearLabel': {
        if (!isClientLink(link)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        const { assetId } = payload;
        await txMutate((proj) => ({ assets: (proj.assets || []).map((a) => (a.id === assetId ? { ...a, colorLabel: null } : a)) }));
        return NextResponse.json({ ok: true });
      }
      case 'feedback': {
        if (!isClientLink(link)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        const { assetId, text, userName } = payload;
        if (!text || !userName) return NextResponse.json({ error: 'text and userName required' }, { status: 400 });
        const fb = { id: genId(), text: String(text).slice(0, 500), userName: String(userName).slice(0, 80), timestamp: new Date().toISOString(), isExternal: true };
        await txMutate((proj) => {
          const asset = (proj.assets || []).find((a) => a.id === assetId);
          return {
            assets: (proj.assets || []).map((a) => (a.id === assetId ? { ...a, feedback: [...(a.feedback || []), fb], status: 'changes-requested' } : a)),
            activityLog: FieldValue.arrayUnion(activity(`Feedback from ${fb.userName} on ${asset?.name || 'asset'}`, 'feedback')),
          };
        });
        return NextResponse.json({ ok: true, feedback: fb });
      }
      case 'confirmSelection': {
        if (!isClientLink(link)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        await ref.update({
          selectionConfirmed: true,
          activityLog: FieldValue.arrayUnion(activity(`Selection confirmed by ${link.name} (client)`, 'selection')),
        });
        return NextResponse.json({ ok: true });
      }
      case 'blockCorrections': {
        if (!isClientLink(link)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        const { blockId, items = [], round = 1 } = payload;
        if (!blockId) return NextResponse.json({ error: 'blockId required' }, { status: 400 });
        await db.collection('projects').doc(project.id).collection('blocks').doc(blockId).update({
          corrections: FieldValue.arrayUnion({ round, items, submittedBy: 'client', submittedAt: new Date().toISOString(), resolved: false }),
        });
        return NextResponse.json({ ok: true });
      }
      case 'selectionSnapshot': {
        if (!isClientLink(link)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        const { snapshot = {} } = payload;
        const docRef = await db.collection('projects').doc(project.id).collection('selectionSnapshots').add({
          ...snapshot, submittedBy: 'client', createdAt: new Date().toISOString(),
        });
        return NextResponse.json({ ok: true, id: docRef.id });
      }

      // ---- EDITOR action: register an asset already uploaded to Storage ----
      case 'uploadComplete': {
        if (!isEditorLink(link) && !isClientLink(link)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
        const { asset } = payload;
        if (!asset || !asset.url || !asset.name) return NextResponse.json({ error: 'asset {name,url} required' }, { status: 400 });
        // Whitelist fields; force server-controlled provenance.
        const safe = {
          id: genId(),
          name: String(asset.name).slice(0, 260),
          type: ['image', 'video', 'audio', 'other'].includes(asset.type) ? asset.type : 'other',
          category: asset.category || null,
          url: String(asset.url),
          path: asset.path ? String(asset.path) : null,
          thumbnail: asset.thumbnail ? String(asset.thumbnail) : null,
          fileSize: Number(asset.fileSize) || 0,
          mimeType: asset.mimeType ? String(asset.mimeType) : null,
          status: 'review-ready',
          uploadedBy: 'external',
          uploadedByName: link.name || 'external',
          uploadedAt: new Date().toISOString(),
          versions: [{ version: 1, url: String(asset.url) }],
          currentVersion: 1,
          feedback: [],
          rating: 0,
        };
        await txMutate((proj) => ({
          assets: [...(proj.assets || []), safe],
          activityLog: FieldValue.arrayUnion(activity(`${link.name || 'external'} uploaded ${safe.name}`, 'upload')),
        }));
        return NextResponse.json({ ok: true, asset: safe });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    console.error('[share mutate] error', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
