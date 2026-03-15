export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
export async function POST(request) {
  try {
    const { createJobLink } = await import('@/lib/interview-firestore');
    const { position, createdBy } = await request.json();
    if (!position) return NextResponse.json({ error: 'Position required' }, { status: 400 });

    const link = await createJobLink(position, createdBy || 'admin');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://anandi-productions.vercel.app';

    return NextResponse.json({
      success: true,
      link: { ...link, url: `${appUrl}/interview/${link.token}` },
    });
  } catch (error) {
    console.error('Create interview link error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { getAllJobLinks } = await import('@/lib/interview-firestore');
    const links = await getAllJobLinks();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://anandi-productions.vercel.app';
    const enriched = links.map(l => ({ ...l, url: `${appUrl}/interview/${l.token}` }));
    return NextResponse.json({ success: true, links: enriched });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
