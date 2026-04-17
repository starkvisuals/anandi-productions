import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { MODEL_RELEASE_TEXT, DOS_AND_DONTS_TEXT } from '@/lib/releaseTexts';

export async function POST(req) {
  try {
    const { campaignId, submissionId } = await req.json();
    if (!campaignId || !submissionId) {
      return NextResponse.json({ error: 'campaignId and submissionId required' }, { status: 400 });
    }

    // Fetch campaign
    const campaignSnap = await getDoc(doc(db, 'release_campaigns', campaignId));
    if (!campaignSnap.exists()) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    const campaign = campaignSnap.data();

    // Fetch submission
    const subSnap = await getDoc(doc(db, 'release_campaigns', campaignId, 'submissions', submissionId));
    if (!subSnap.exists()) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }
    const sub = subSnap.data();

    // Dynamic import jspdf (server-side)
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = 210;
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let y = 20;

    const addText = (text, size = 10, bold = false, color = [26, 26, 46]) => {
      pdf.setFontSize(size);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setTextColor(...color);
      const lines = pdf.splitTextToSize(text, contentWidth);
      for (const line of lines) {
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.text(line, margin, y);
        y += size * 0.45;
      }
    };

    const addLine = () => {
      y += 2;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 6;
    };

    const fmtDate = (v) => {
      if (!v) return '—';
      try {
        const d = v.toDate ? v.toDate() : new Date(v);
        return d.toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch { return String(v); }
    };

    // ─── Header ──────────────────────────────────────────────────────────
    addText('ANANDI PRODUCTIONS', 18, true);
    y += 2;
    addText('Model Release Form', 12, false, [99, 102, 241]);
    y += 2;
    addText(`Campaign: ${campaign.label || '—'}`, 10, true);
    addLine();

    // ─── Personal Details ────────────────────────────────────────────────
    addText('PERSONAL DETAILS', 11, true);
    y += 2;
    addText(`Name: ${sub.name || '—'}`);
    addText(`Phone: ${sub.phone || '—'}`);
    addText(`Date of Birth: ${sub.dob || '—'}`);
    addText(`Aadhar: ${sub.aadhar || '—'}`);
    addText(`Address: ${sub.address || '—'}`);
    y += 2;
    addText(`GPS Location: ${sub.gpsLat && sub.gpsLng ? `${sub.gpsLat.toFixed(6)}, ${sub.gpsLng.toFixed(6)}` : 'Not captured'}`, 9, false, [107, 114, 128]);
    addText(`IP Address: ${sub.signatureIp || '—'}`, 9, false, [107, 114, 128]);
    addText(`User Agent: ${(sub.userAgent || '—').substring(0, 80)}`, 8, false, [107, 114, 128]);
    addLine();

    // ─── Photo ───────────────────────────────────────────────────────────
    if (sub.photoUrl) {
      addText('PHOTO', 11, true);
      y += 2;
      try {
        const photoRes = await fetch(sub.photoUrl);
        const photoBuffer = await photoRes.arrayBuffer();
        const base64 = Buffer.from(photoBuffer).toString('base64');
        const ext = sub.photoUrl.includes('.png') ? 'PNG' : 'JPEG';
        pdf.addImage(`data:image/${ext.toLowerCase()};base64,${base64}`, ext, margin, y, 40, 40);
        y += 44;
      } catch {
        addText('[Photo could not be embedded]', 9, false, [200, 100, 100]);
      }
      addLine();
    }

    // ─── Model Release Text ──────────────────────────────────────────────
    addText('MODEL RELEASE AGREEMENT', 11, true);
    y += 2;
    const releaseText = MODEL_RELEASE_TEXT
      .replace(/\{\{companyLegalName\}\}/g, 'Anandi Productions')
      .replace(/\{\{companyOwner\}\}/g, 'Harnesh Joshi')
      .replace(/\{\{campaignLabel\}\}/g, campaign.label || '')
      .replace(/\{\{submissionDate\}\}/g, fmtDate(sub.agreedReleaseAt));
    addText(releaseText, 9);
    y += 4;
    addText(`✓ AGREED on ${fmtDate(sub.agreedReleaseAt)}`, 10, true, [34, 197, 94]);
    addLine();

    // ─── Signature ───────────────────────────────────────────────────────
    if (sub.signatureUrl) {
      addText('DIGITAL SIGNATURE', 11, true);
      y += 2;
      addText(`Typed name: ${sub.signatureTypedName || '—'}`);
      y += 2;
      try {
        const sigRes = await fetch(sub.signatureUrl);
        const sigBuffer = await sigRes.arrayBuffer();
        const base64 = Buffer.from(sigBuffer).toString('base64');
        pdf.addImage(`data:image/png;base64,${base64}`, 'PNG', margin, y, 60, 25);
        y += 29;
      } catch {
        addText('[Signature could not be embedded]', 9, false, [200, 100, 100]);
      }
      addLine();
    }

    // ─── Do's & Don'ts Text ──────────────────────────────────────────────
    addText("PRODUCTION CONDUCT AGREEMENT — DO'S & DON'TS", 11, true);
    y += 2;
    const conductText = DOS_AND_DONTS_TEXT
      .replace(/\{\{companyLegalName\}\}/g, 'Anandi Productions')
      .replace(/\{\{campaignLabel\}\}/g, campaign.label || '')
      .replace(/\{\{submissionDate\}\}/g, fmtDate(sub.agreedDosDontsAt));
    addText(conductText, 9);
    y += 4;
    addText(`✓ AGREED on ${fmtDate(sub.agreedDosDontsAt)}`, 10, true, [34, 197, 94]);
    addLine();

    // ─── Footer ──────────────────────────────────────────────────────────
    addText(`Submitted: ${fmtDate(sub.submittedAt)}`, 9, false, [107, 114, 128]);
    addText(`Document generated: ${new Date().toLocaleString('en-IN')}`, 9, false, [107, 114, 128]);

    // Return PDF
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Model-Release-${(sub.name || 'unknown').replace(/\s+/g, '-')}.pdf"`,
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: err.message || 'PDF generation failed' }, { status: 500 });
  }
}
