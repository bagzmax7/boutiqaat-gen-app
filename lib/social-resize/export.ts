import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export async function downloadUrlDirectly(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
  const blob = await res.blob();
  saveAs(blob, filename);
}

export async function exportCanvasToBlob(canvas: HTMLCanvasElement, mimeType: string = 'image/png', quality: number = 1.0): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas to Blob conversion failed'));
      }
    }, mimeType, quality);
  });
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

export async function downloadSingleImage(canvas: HTMLCanvasElement, baseName: string, presetName: string, platformName: string) {
  const blob = await exportCanvasToBlob(canvas, 'image/png');
  const safeBase = sanitizeFilename(baseName) || 'image';
  const safePlatform = sanitizeFilename(platformName);
  const safePreset = sanitizeFilename(presetName);
  const filename = `${safeBase}_${safePlatform}_${safePreset}.png`;
  
  saveAs(blob, filename);
}

export async function downloadBatchZip(
  items: { canvas: HTMLCanvasElement, baseName: string, presetName: string, platformName: string }[]
) {
  const zip = new JSZip();
  const safeBase = sanitizeFilename(items[0]?.baseName) || 'images';
  
  for (const item of items) {
    const blob = await exportCanvasToBlob(item.canvas, 'image/png');
    const safePlatform = sanitizeFilename(item.platformName);
    const safePreset = sanitizeFilename(item.presetName);
    const filename = `${safePlatform}_${safePreset}.png`;
    zip.file(filename, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${safeBase}_social_resize.zip`);
}
