import { db } from './firebase';
import {
  collection, doc, addDoc, getDocs, updateDoc, writeBatch,
  query, where, orderBy, limit as fbLimit, onSnapshot, serverTimestamp,
} from 'firebase/firestore';

// Shared, server-visible notifications.
//
// The legacy in-app notifications lived in localStorage (per browser), so an
// event caused by ONE person (e.g. a stage becoming someone else's turn) could
// never reach the OTHER person's screen. The pipeline engine needs exactly that
// cross-user delivery, so notifications live in a Firestore `notifications`
// collection: any actor (or a scheduled job) writes a notification addressed to
// a userId; that user's bell reads/subscribes to their own.
//
// Doc shape: { userId, type, title, body, projectId?, blockId?, href?, read, createdAt }
//   type: 'your-turn' | 'overdue' | 'due-soon' | 'feedback' | 'approval' | 'delivered' | 'mention' | 'info'

const COLLECTION = 'notifications';

/**
 * Create a notification addressed to a single user.
 * Returns the new doc id (or null if no userId — a no-op guard so callers
 * don't have to null-check an unassigned stage owner).
 */
export const createNotification = async ({ userId, type = 'info', title, body = '', projectId = null, blockId = null, href = null }) => {
  if (!userId || !title) return null;
  const ref = await addDoc(collection(db, COLLECTION), {
    userId,
    type,
    title,
    body,
    projectId,
    blockId,
    href,
    read: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

/** Create the same notification for several users at once (e.g. a whole team). */
export const notifyUsers = async (userIds, payload) => {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  await Promise.all(unique.map((userId) => createNotification({ ...payload, userId })));
};

/** One-time fetch of a user's most recent notifications (newest first). */
export const listNotifications = async (userId, max = 30) => {
  if (!userId) return [];
  const snap = await getDocs(
    query(collection(db, COLLECTION), where('userId', '==', userId), orderBy('createdAt', 'desc'), fbLimit(max))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Live subscription to a user's notifications. Returns an unsubscribe fn.
 * `cb` receives the array (newest first). Fails soft: on error, cb([]) so the
 * bell renders empty rather than throwing.
 */
export const subscribeNotifications = (userId, cb, max = 30) => {
  if (!userId) { cb([]); return () => {}; }
  const q = query(collection(db, COLLECTION), where('userId', '==', userId), orderBy('createdAt', 'desc'), fbLimit(max));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('[notifications] subscribe failed:', err); cb([]); }
  );
};

/** Mark one notification read. */
export const markNotificationRead = async (id) => {
  if (!id) return;
  await updateDoc(doc(db, COLLECTION, id), { read: true });
};

/** Mark every unread notification for a user read (batched). */
export const markAllNotificationsRead = async (userId) => {
  if (!userId) return;
  const snap = await getDocs(
    query(collection(db, COLLECTION), where('userId', '==', userId), where('read', '==', false))
  );
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
};
