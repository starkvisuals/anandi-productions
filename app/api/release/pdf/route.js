import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { MODEL_RELEASE_TEXT, DOS_AND_DONTS_TEXT } from '@/lib/releaseTexts';

// ─── IST-aware date formatter (avoids jsPDF Unicode spacing bugs) ────────────
// Reason: toLocaleString('en-IN') in Node.js serverless can emit non-breaking
// spaces or narrow spaces that jsPDF renders as individual spaced characters
// (e.g. "1 7   A p r i l"). Manual formatter with ASCII-only output is safe.
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function fmtIST(v) {
  if (!v) return '-';
  try {
    const d = v.toDate ? v.toDate() : new Date(v);
    if (isNaN(d.getTime())) return String(v);
    // Convert to IST (UTC+5:30) manually — avoids Intl in serverless
    const istMs = d.getTime() + (5 * 60 + 30) * 60 * 1000;
    const ist = new Date(istMs);
    const day   = String(ist.getUTCDate()).padStart(2, '0');
    const month = MONTHS[ist.getUTCMonth()];
    const year  = ist.getUTCFullYear();
    const hh    = ist.getUTCHours();
    const mm    = String(ist.getUTCMinutes()).padStart(2, '0');
    const ampm  = hh >= 12 ? 'PM' : 'AM';
    const h12   = hh % 12 || 12;
    return `${day} ${month} ${year} at ${h12}:${mm} ${ampm} IST`;
  } catch { return String(v); }
}

function fmtISTNow() {
  return fmtIST(new Date());
}

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

    const checkPage = (needed = 8) => {
      if (y + needed > 275) { pdf.addPage(); y = 20; }
    };

    const addText = (text, size = 10, bold = false, color = [26, 26, 46]) => {
      pdf.setFontSize(size);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setTextColor(...color);
      const lines = pdf.splitTextToSize(String(text), contentWidth);
      for (const line of lines) {
        checkPage(size * 0.5);
        pdf.text(line, margin, y);
        y += size * 0.45;
      }
    };

    const addLine = () => {
      y += 3;
      pdf.setDrawColor(220, 220, 220);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 7;
    };

    const addSectionTitle = (title) => {
      checkPage(12);
      pdf.setFillColor(99, 102, 241);
      pdf.roundedRect(margin, y - 4, contentWidth, 8, 1, 1, 'F');
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text(title, margin + 4, y + 1);
      y += 10;
    };

    // ─── Logo header ────────────────────────────────────────────────────────
    // Draw AP film-strip logo mark (simplified for PDF)
    pdf.setFillColor(99, 102, 241);
    pdf.roundedRect(margin, y - 4, 12, 12, 2, 2, 'F');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('AP', margin + 2.5, y + 4.5);

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(26, 26, 46);
    pdf.text('ANANDI PRODUCTIONS', margin + 16, y + 3);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(107, 114, 128);
    pdf.text('Model Release Form', margin + 16, y + 8);
    y += 16;

    // Campaign label banner
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(99, 102, 241);
    pdf.text(`Campaign: ${campaign.label || '-'}`, margin + 4, y + 5.5);
    y += 14;

    // ─── Personal Details ────────────────────────────────────────────────
    addSectionTitle('PERSONAL DETAILS');
    const col2x = margin + contentWidth / 2 + 4;
    const rowH = 6;
    const detail = (label, val, x, col) => {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(107, 114, 128);
      pdf.text(label.toUpperCase(), x, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(26, 26, 46);
      pdf.text(String(val || '-').substring(0, col === 2 ? 35 : 70), x, y + 3.5);
    };

    detail('Name', sub.name, margin, 1);
    detail('Phone', sub.phone, col2x, 2);
    y += rowH + 2;
    detail('Date of Birth', sub.dob, margin, 1);
    detail('Aadhar Number', sub.aadhar ? `XXXX XXXX ${sub.aadhar.slice(-4)}` : '-', col2x, 2);
    y += rowH + 2;

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(107, 114, 128);
    pdf.text('ADDRESS', margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(26, 26, 46);
    const addrLines = pdf.splitTextToSize(sub.address || '-', contentWidth);
    y += 4;
    addrLines.forEach(l => { pdf.text(l, margin, y); y += 4; });
    y += 2;

    // Audit trail
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(150, 150, 150);
    pdf.text(`GPS: ${sub.gpsLat && sub.gpsLng ? `${sub.gpsLat.toFixed(5)}, ${sub.gpsLng.toFixed(5)}` : 'Not captured'}  |  IP: ${sub.signatureIp || '-'}`, margin, y);
    y += 8;

    // ─── Photo + Aadhar ─────────────────────────────────────────────────
    const hasPhoto = !!sub.photoUrl;
    const hasAadharFront = !!sub.aadharFrontUrl;
    const hasAadharBack = !!sub.aadharBackUrl;

    if (hasPhoto || hasAadharFront || hasAadharBack) {
      addSectionTitle('IDENTITY PHOTOS');

      const fetchImg = async (url) => {
        try {
          const res = await fetch(url);
          const buf = await res.arrayBuffer();
          const b64 = Buffer.from(buf).toString('base64');
          const ext = url.includes('.png') ? 'PNG' : 'JPEG';
          return { b64, ext };
        } catch { return null; }
      };

      let imgX = margin;
      if (hasPhoto) {
        const img = await fetchImg(sub.photoUrl);
        if (img) {
          checkPage(48);
          pdf.setFontSize(7.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(107,114,128);
          pdf.text('PROFILE PHOTO', imgX, y);
          pdf.addImage(`data:image/${img.ext.toLowerCase()};base64,${img.b64}`, img.ext, imgX, y + 3, 36, 36);
          imgX += 42;
        }
      }
      if (hasAadharFront) {
        const img = await fetchImg(sub.aadharFrontUrl);
        if (img) {
          checkPage(48);
          pdf.setFontSize(7.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(107,114,128);
          pdf.text('AADHAR (FRONT)', imgX, y);
          pdf.addImage(`data:image/${img.ext.toLowerCase()};base64,${img.b64}`, img.ext, imgX, y + 3, 50, 32);
          imgX += 56;
        }
      }
      if (hasAadharBack) {
        const img = await fetchImg(sub.aadharBackUrl);
        if (img) {
          checkPage(48);
          pdf.setFontSize(7.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(107,114,128);
          pdf.text('AADHAR (BACK)', imgX, y);
          pdf.addImage(`data:image/${img.ext.toLowerCase()};base64,${img.b64}`, img.ext, imgX, y + 3, 50, 32);
        }
      }
      y += 44;
    }

    // ─── Model Release Text ──────────────────────────────────────────────
    addSectionTitle('MODEL RELEASE AGREEMENT');
    const releaseText = MODEL_RELEASE_TEXT
      .replace(/\{\{companyLegalName\}\}/g, 'Anandi Productions')
      .replace(/\{\{companyOwner\}\}/g, 'Harnesh Joshi')
      .replace(/\{\{campaignLabel\}\}/g, campaign.label || '')
      .replace(/\{\{submissionDate\}\}/g, fmtIST(sub.agreedReleaseAt));
    addText(releaseText, 8.5);
    y += 4;
    pdf.setFillColor(240, 253, 244);
    pdf.roundedRect(margin, y - 1, contentWidth, 7, 1, 1, 'F');
    pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(21, 128, 61);
    pdf.text(`AGREED on ${fmtIST(sub.agreedReleaseAt)}`, margin + 4, y + 4);
    y += 12;

    // ─── Signature ───────────────────────────────────────────────────────
    if (sub.signatureUrl) {
      addSectionTitle('DIGITAL SIGNATURE');
      addText(`Full name (typed): ${sub.signatureTypedName || '-'}`);
      y += 2;
      const sigImg = await (async () => {
        try {
          const res = await fetch(sub.signatureUrl);
          const buf = await res.arrayBuffer();
          return Buffer.from(buf).toString('base64');
        } catch { return null; }
      })();
      if (sigImg) {
        checkPage(32);
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(margin, y, 70, 26, 2, 2, 'F');
        pdf.setDrawColor(220, 220, 220);
        pdf.roundedRect(margin, y, 70, 26, 2, 2, 'S');
        pdf.addImage(`data:image/png;base64,${sigImg}`, 'PNG', margin + 2, y + 2, 66, 22);
        y += 30;
      }
      addText(`Signed at IP: ${sub.signatureIp || '-'}  |  Timestamp: ${fmtIST(sub.agreedReleaseAt)}`, 7.5, false, [150, 150, 150]);
      y += 4;
    }

    // ─── Do's & Don'ts Text ──────────────────────────────────────────────
    addSectionTitle("PRODUCTION CONDUCT GUIDELINES");
    const conductText = DOS_AND_DONTS_TEXT
      .replace(/\{\{companyLegalName\}\}/g, 'Anandi Productions')
      .replace(/\{\{campaignLabel\}\}/g, campaign.label || '')
      .replace(/\{\{submissionDate\}\}/g, fmtIST(sub.agreedDosDontsAt));
    addText(conductText, 8.5);
    y += 4;
    pdf.setFillColor(240, 253, 244);
    pdf.roundedRect(margin, y - 1, contentWidth, 7, 1, 1, 'F');
    pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(21, 128, 61);
    pdf.text(`AGREED on ${fmtIST(sub.agreedDosDontsAt)}`, margin + 4, y + 4);
    y += 14;

    // ─── Footer ──────────────────────────────────────────────────────────
    checkPage(12);
    pdf.setFontSize(7.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(150,150,150);
    pdf.text(`Submitted: ${fmtIST(sub.submittedAt)}`, margin, y);
    y += 4;
    pdf.text(`Document generated: ${fmtISTNow()}`, margin, y);

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
