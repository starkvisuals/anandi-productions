import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Download multiple assets as a ZIP file.
 *
 * @param {Array} assets - Array of { name, url } objects
 * @param {string} zipName - Name for the ZIP file
 * @param {Function} onProgress - Callback with { current, total, percent }
 * @returns {Promise<{ success: number, failed: number }>}
 */
export async function downloadAssetsAsZip(assets, zipName, onProgress) {
  const zip = new JSZip();
  let completed = 0;
  let failed = 0;
  const total = assets.length;

  // Track filenames to avoid duplicates
  const usedNames = new Set();
  const getUniqueName = (name) => {
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
    const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
    const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
    let counter = 1;
    while (usedNames.has(`${base}_${counter}${ext}`)) counter++;
    const unique = `${base}_${counter}${ext}`;
    usedNames.add(unique);
    return unique;
  };

  // Fetch all files in parallel (with concurrency limit)
  const concurrency = 4;
  const chunks = [];
  for (let i = 0; i < assets.length; i += concurrency) {
    chunks.push(assets.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (asset) => {
      try {
        const response = await fetch(asset.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const fileName = getUniqueName(asset.name || `asset_${completed + 1}`);
        zip.file(fileName, blob);
        completed++;
      } catch (err) {
        console.warn(`Failed to download ${asset.name}:`, err.message);
        failed++;
        completed++;
      }

      if (onProgress) {
        onProgress({
          current: completed,
          total,
          percent: Math.round((completed / total) * 100)
        });
      }
    }));
  }

  // Generate ZIP
  if (onProgress) {
    onProgress({ current: total, total, percent: 100, stage: 'zipping' });
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  // Trigger download
  const date = new Date().toISOString().split('T')[0];
  saveAs(zipBlob, `${zipName}_${date}.zip`);

  return { success: completed - failed, failed };
}
