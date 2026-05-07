// lib/workflow/exportSelections.js
import Papa from 'papaparse';

/**
 * Generate CSV from a selectionSnapshot object.
 * Returns a UTF-8 BOM-prefixed CSV string so Excel opens it correctly.
 *
 * @param {object} snapshot  — full snapshot doc including .assets array
 * @param {object[]} projectAssets  — full project assets for extra fields (rating, etc.)
 * @param {string} projectName
 * @returns {string}  CSV string
 */
export function snapshotToCSV(snapshot, projectAssets, projectName) {
  const assetMap = Object.fromEntries((projectAssets || []).map(a => [a.id, a]));

  const rows = (snapshot.assets || []).map((item, idx) => {
    const full = assetMap[item.id] || {};
    return {
      '#': idx + 1,
      'Filename': item.name || full.name || item.id,
      'Selected': item.isSelected ? 'Yes' : 'No',
      'Color Label': item.colorLabel || '',
      'Rating': typeof item.rating === 'number' ? item.rating : (full.rating || ''),
      'Project': projectName || '',
      'Submitted At': snapshot.submittedAt?.toDate
        ? snapshot.submittedAt.toDate().toISOString()
        : (snapshot.submittedAt || ''),
      'Forced': snapshot.forced ? 'Yes' : 'No',
      'Source': snapshot.source || 'web',
    };
  });

  const csv = Papa.unparse(rows, { quotes: true });
  return '﻿' + csv; // UTF-8 BOM for Excel
}

/**
 * Trigger browser download of a CSV string.
 * @param {string} csv
 * @param {string} filename  e.g. "ProjectName-Selection-001.csv"
 */
export function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
