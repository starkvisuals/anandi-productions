import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generateOfferLetterPdf({ candidateName, position, ctc, startDate, issueDate }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 56;
  let y = 780;
  const lineHeight = 18;

  const drawText = (text, { size = 11, bold = false, color = rgb(0.1, 0.1, 0.1), gap = lineHeight } = {}) => {
    page.drawText(text, { x: margin, y, size, font: bold ? boldFont : font, color });
    y -= gap;
  };

  drawText('Anandi Productions', { size: 18, bold: true, gap: 26 });
  drawText('Offer of Employment', { size: 13, bold: true, color: rgb(0.4, 0.25, 0.85), gap: 32 });

  drawText(`Date: ${issueDate}`, { gap: 24 });

  drawText(`Dear ${candidateName},`, { gap: 24 });

  const bodyLines = [
    `We are pleased to offer you the position of ${position} at Anandi Productions.`,
    `Your annual compensation (CTC) for this role will be ${ctc}.`,
    `Your expected start date is ${startDate}.`,
    '',
    'This offer is contingent upon the completion of any pending background',
    'and reference verification. A detailed employment contract covering',
    'role responsibilities, notice period, and other terms will follow',
    'separately for your review and signature.',
    '',
    'We are excited to have you join our creative team and look forward to',
    'the contributions you will bring to Anandi Productions.',
  ];

  bodyLines.forEach(line => drawText(line));

  y -= 16;
  drawText('Warm regards,', { gap: 22 });
  drawText('Team Anandi Productions', { bold: true });

  return pdfDoc.save();
}
