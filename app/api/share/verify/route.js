import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import crypto from 'crypto';

// Hash password for comparison
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

export async function POST(request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password required' }, { status: 400 });
    }

    // Find the project with this share token
    const projectsSnap = await getDocs(collection(db, 'projects'));
    let shareLink = null;
    let project = null;

    for (const doc of projectsSnap.docs) {
      const proj = { id: doc.id, ...doc.data() };
      const link = (proj.shareLinks || []).find(sl => sl.token === token);
      if (link) {
        shareLink = link;
        project = proj;
        break;
      }
    }

    if (!shareLink) {
      return NextResponse.json({ error: 'Invalid share link' }, { status: 404 });
    }

    if (!shareLink.password) {
      // No password set — allow access
      return NextResponse.json({ success: true });
    }

    // Compare hashed passwords
    const hashedInput = hashPassword(password);
    if (hashedInput === shareLink.password) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  } catch (error) {
    console.error('Share verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
