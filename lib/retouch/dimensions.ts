/**
 * Dimension & Aspect Ratio calculation utility for Auto Retouch APIs.
 */

// Supported aspect ratios for Nano Banana 2 (Gemini 3.1 Flash /rhart-image-n-g31-flash/image-to-image)
export const NANO_BANANA_RATIOS: { ratio: string; value: number }[] = [
  { ratio: '1:1',  value: 1 / 1 },
  { ratio: '3:4',  value: 3 / 4 },
  { ratio: '4:3',  value: 4 / 3 },
  { ratio: '9:16', value: 9 / 16 },
  { ratio: '16:9', value: 16 / 9 },
  { ratio: '2:3',  value: 2 / 3 },
  { ratio: '3:2',  value: 3 / 2 },
  { ratio: '4:5',  value: 4 / 5 },
  { ratio: '5:4',  value: 5 / 4 },
  { ratio: '21:9', value: 21 / 9 },
  { ratio: '1:4',  value: 1 / 4 },
  { ratio: '4:1',  value: 4 / 1 },
  { ratio: '1:8',  value: 1 / 8 },
  { ratio: '8:1',  value: 8 / 1 },
];

/**
 * Calculates the closest supported aspect ratio for Nano Banana 2 given an input width & height.
 */
export function matchClosestAspectRatio(width: number, height: number): string {
  if (!width || !height || width <= 0 || height <= 0) return '1:1';
  const target = width / height;

  let closestRatio = '1:1';
  let minDiff = Infinity;

  for (const item of NANO_BANANA_RATIOS) {
    const diff = Math.abs(item.value - target);
    if (diff < minDiff) {
      minDiff = diff;
      closestRatio = item.ratio;
    }
  }

  return closestRatio;
}

/**
 * Calculates max-1536px dimensions for Flux 2 Klein 9B (/rhart-image/f-2-klein-9b/edit).
 * Constraint rules:
 * - customWidth: strictly 256 to 1536 (multiples of 16)
 * - customHight: strictly 256 to 1536 (multiples of 16)
 * - Scales the larger side to maximum 1536px while maintaining proportional ratio.
 */
export function calculateFluxDimensions(width: number, height: number): { customWidth: number; customHight: number } {
  const MIN_SIDE = 256;
  const MAX_SIDE = 1536;

  if (!width || !height || width <= 0 || height <= 0) {
    return { customWidth: 1024, customHight: 1024 };
  }

  const ratio = width / height;
  let targetW: number;
  let targetH: number;

  if (width >= height) {
    targetW = MAX_SIDE;
    targetH = Math.round(MAX_SIDE / ratio);
  } else {
    targetH = MAX_SIDE;
    targetW = Math.round(MAX_SIDE * ratio);
  }

  // Snap to multiples of 16 and clamp between 256 and 1536
  let customWidth = Math.round(targetW / 16) * 16;
  let customHight = Math.round(targetH / 16) * 16;

  customWidth = Math.max(MIN_SIDE, Math.min(MAX_SIDE, customWidth));
  customHight = Math.max(MIN_SIDE, Math.min(MAX_SIDE, customHight));

  return { customWidth, customHight };
}
