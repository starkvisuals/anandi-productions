// lib/workflow/watermark.js
// Client-side canvas watermarking. Browser-only — do not call in SSR.

/**
 * Overlay a tiled diagonal text watermark on an image file.
 * Returns a Blob (JPEG, 0.85 quality) or null on failure.
 *
 * @param {File} file - image file
 * @param {string} text - watermark text (e.g. project name)
 * @returns {Promise<Blob|null>}
 */
export async function watermarkImage(file, text) {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);

    // Tiled diagonal watermark
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#ffffff';
    const fontSize = Math.max(14, Math.round(bitmap.width / 40));
    ctx.font = `${fontSize}px sans-serif`;
    ctx.rotate(-Math.PI / 12);

    const stepX = Math.max(300, Math.round(bitmap.width / 3));
    const stepY = Math.max(120, Math.round(bitmap.height / 6));

    for (let y = -bitmap.height; y < bitmap.height * 2; y += stepY) {
      for (let x = -bitmap.width; x < bitmap.width * 2; x += stepX) {
        ctx.fillText(text, x, y);
      }
    }
    ctx.restore();

    return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  } catch (err) {
    console.error('[watermark] failed:', err);
    return null;
  }
}
