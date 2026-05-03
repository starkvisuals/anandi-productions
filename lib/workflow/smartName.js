// lib/workflow/smartName.js

export const BLOCK_ABBR = {
  UploadBlock: 'SRC',
  SelectionRound: 'SEL',
  ProductionBlock: 'EDIT',
  ApprovalRound: 'REV',
  AdaptBlock: 'ADAPT',
  DeliveryBlock: 'DEL',
  Checkpoint: 'CHK',
  Parallel: 'PAR',
};

/**
 * Derive a short project code from name + creation date.
 * e.g. "Pepsi Merch Shoot 2026" → "PMS-2026"
 */
export function generateProjectCode(projectName, createdAt) {
  const letters = (projectName || 'PRJ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => (w[0] || '').toUpperCase())
    .join('')
    .slice(0, 6);
  const year = new Date(
    createdAt?.toMillis?.() ?? createdAt ?? Date.now()
  ).getFullYear();
  return `${letters || 'PRJ'}-${year}`;
}

/**
 * Build a smart filename.
 * e.g. "PMS-2026-SRC-001.jpg"
 */
export function generateSmartName(projectCode, blockTypeAbbr, seq, originalExt) {
  const padded = String(seq).padStart(3, '0');
  const ext = (originalExt || 'jpg').replace(/^\./, '');
  return `${projectCode}-${blockTypeAbbr}-${padded}.${ext}`;
}
