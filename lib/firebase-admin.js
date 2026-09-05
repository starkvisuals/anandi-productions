// Server-only Firebase Admin SDK. Bypasses Firestore/Storage security rules, so
// it is the gatekeeper for the login-less client share flow: the client sends a
// share TOKEN, the server validates it here, then reads/writes on the client's
// behalf. NEVER import this into a client component.
//
// Requires env FIREBASE_SERVICE_ACCOUNT = the full service-account JSON (from
// Firebase console → Project settings → Service accounts → Generate new private
// key). Added in Vercel → Settings → Environment Variables (Production).
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

let _app = null;
let _initError = null;

function getAdminApp() {
  if (_app) return _app;
  if (_initError) throw _initError;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
    const svc = typeof raw === 'string' ? JSON.parse(raw) : raw;
    // Vercel/others may store the key with literal "\n" — normalise to real newlines.
    if (svc.private_key && svc.private_key.includes('\\n')) {
      svc.private_key = svc.private_key.replace(/\\n/g, '\n');
    }
    _app = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId: svc.project_id,
            clientEmail: svc.client_email,
            privateKey: svc.private_key,
          }),
          storageBucket:
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
            `${svc.project_id}.appspot.com`,
        });
    return _app;
  } catch (e) {
    _initError = e;
    throw e;
  }
}

export function isAdminConfigured() {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT;
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

export function adminStorage() {
  return getStorage(getAdminApp());
}
