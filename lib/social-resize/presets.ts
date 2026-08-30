export interface SocialPreset {
  id: string;
  name: string;
  platform: string;
  width: number;
  height: number;
  category: 'boutiqaat' | 'social';
}

export const SOCIAL_PRESETS: SocialPreset[] = [
  // ── Boutiqaat Size (including Google Size & Display Ads) ─────────────────────
  { id: 'bq-728-90', name: 'Leaderboard (728x90)', platform: 'Boutiqaat / Google', width: 728, height: 90, category: 'boutiqaat' },
  { id: 'bq-300-600', name: 'Half-Page (300x600)', platform: 'Boutiqaat / Google', width: 300, height: 600, category: 'boutiqaat' },
  { id: 'bq-336-280', name: 'Large Rectangle (336x280)', platform: 'Boutiqaat / Google', width: 336, height: 280, category: 'boutiqaat' },
  { id: 'bq-320-50', name: 'Mobile Leaderboard (320x50)', platform: 'Boutiqaat / Google', width: 320, height: 50, category: 'boutiqaat' },
  { id: 'bq-320-480', name: 'Mobile Interstitial Portrait (320x480)', platform: 'Boutiqaat / Google', width: 320, height: 480, category: 'boutiqaat' },
  { id: 'bq-300-50', name: 'Mobile Banner (300x50)', platform: 'Boutiqaat / Google', width: 300, height: 50, category: 'boutiqaat' },
  { id: 'bq-300-100', name: 'Large Mobile Banner (300x100)', platform: 'Boutiqaat / Google', width: 300, height: 100, category: 'boutiqaat' },
  { id: 'bq-480-320', name: 'Mobile Interstitial Landscape (480x320)', platform: 'Boutiqaat / Google', width: 480, height: 320, category: 'boutiqaat' },
  { id: 'bq-300-250', name: 'Medium Rectangle (300x250)', platform: 'Boutiqaat / Google', width: 300, height: 250, category: 'boutiqaat' },
  { id: 'bq-1200-627', name: 'Display Banner (1200x627)', platform: 'Boutiqaat / Google', width: 1200, height: 627, category: 'boutiqaat' },
  { id: 'bq-300-68', name: 'Small Banner (300x68)', platform: 'Boutiqaat / Google', width: 300, height: 68, category: 'boutiqaat' },
  { id: 'bq-123-50', name: 'Small Button (123x50)', platform: 'Boutiqaat / Google', width: 123, height: 50, category: 'boutiqaat' },
  { id: 'bq-208-90', name: 'Small Horizontal (208x90)', platform: 'Boutiqaat / Google', width: 208, height: 90, category: 'boutiqaat' },
  { id: 'bq-160-137', name: 'Small Box (160x137)', platform: 'Boutiqaat / Google', width: 160, height: 137, category: 'boutiqaat' },
  { id: 'bq-320-100', name: 'Large Mobile Banner (320x100)', platform: 'Boutiqaat / Google', width: 320, height: 100, category: 'boutiqaat' },
  { id: 'bq-468-60', name: 'Standard Banner (468x60)', platform: 'Boutiqaat / Google', width: 468, height: 60, category: 'boutiqaat' },
  { id: 'bq-970-90', name: 'Super Leaderboard (970x90)', platform: 'Boutiqaat / Google', width: 970, height: 90, category: 'boutiqaat' },
  { id: 'bq-970-250', name: 'Billboard (970x250)', platform: 'Boutiqaat / Google', width: 970, height: 250, category: 'boutiqaat' },
  { id: 'bq-120-600', name: 'Skyscraper (120x600)', platform: 'Boutiqaat / Google', width: 120, height: 600, category: 'boutiqaat' },
  { id: 'bq-160-600', name: 'Wide Skyscraper (160x600)', platform: 'Boutiqaat / Google', width: 160, height: 600, category: 'boutiqaat' },
  { id: 'bq-200-300', name: 'Portrait (200x300)', platform: 'Boutiqaat / Google', width: 200, height: 300, category: 'boutiqaat' },
  { id: 'bq-600-315', name: 'Landscape Share (600x315)', platform: 'Boutiqaat / Google', width: 600, height: 315, category: 'boutiqaat' },
  { id: 'bq-200-200', name: 'Square Small (200x200)', platform: 'Boutiqaat / Google', width: 200, height: 200, category: 'boutiqaat' },
  { id: 'bq-500-500', name: 'Square Medium (500x500)', platform: 'Boutiqaat / Google', width: 500, height: 500, category: 'boutiqaat' },
  { id: 'bq-627-627', name: 'Square Standard (627x627)', platform: 'Boutiqaat / Google', width: 627, height: 627, category: 'boutiqaat' },
  { id: 'bq-240-400', name: 'Vertical Rectangle (240x400)', platform: 'Boutiqaat / Google', width: 240, height: 400, category: 'boutiqaat' },

  // ── Social Media ─────────────────────────────────────────────────────────────
  { id: 'sm-1080-1350', name: 'Portrait Feed (1080x1350)', platform: 'Instagram', width: 1080, height: 1350, category: 'social' }, // 4:5
  { id: 'sm-1080-1080', name: 'Square Post (1080x1080)', platform: 'Instagram / FB', width: 1080, height: 1080, category: 'social' }, // 1:1
  { id: 'sm-1080-1920', name: 'Story / Reels / TikTok (1080x1920)', platform: 'TikTok / Stories', width: 1080, height: 1920, category: 'social' }, // 9:16
  { id: 'sm-1200-1200', name: 'High-Res Square (1200x1200)', platform: 'Social Media', width: 1200, height: 1200, category: 'social' }, // 1:1
  { id: 'sm-1200-1500', name: 'High-Res Portrait (1200x1500)', platform: 'Social Media', width: 1200, height: 1500, category: 'social' }, // 4:5
  { id: 'sm-1200-628', name: 'Landscape Ad / Share (1200x628)', platform: 'Meta Ads / FB', width: 1200, height: 628, category: 'social' }, // 1.91:1
  { id: 'sm-1080-1450', name: 'Custom Portrait (1080x1450)', platform: 'Social Media', width: 1080, height: 1450, category: 'social' },
  { id: 'sm-300-600', name: 'Half Page Vertical (300x600)', platform: 'Social Media', width: 300, height: 600, category: 'social' }, // 1:2
  { id: 'sm-360-600', name: 'Vertical Banner (360x600)', platform: 'Social Media', width: 360, height: 600, category: 'social' }, // 3:5
  { id: 'sm-1200-675', name: 'Post (1200x675)', platform: 'X (Twitter)', width: 1200, height: 675, category: 'social' }, // 16:9 approx
  { id: 'sm-1280-720', name: 'Thumbnail (1280x720)', platform: 'YouTube', width: 1280, height: 720, category: 'social' }, // 16:9
  { id: 'sm-2560-1440', name: 'Channel Banner (2560x1440)', platform: 'YouTube', width: 2560, height: 1440, category: 'social' }, // 16:9
];

export function getAspectRatio(width: number, height: number): string {
  const r = width / height;
  if (Math.abs(r - 1) < 0.01) return '1:1';
  if (Math.abs(r - 16/9) < 0.01) return '16:9';
  if (Math.abs(r - 9/16) < 0.01) return '9:16';
  if (Math.abs(r - 4/5) < 0.01) return '4:5';
  if (Math.abs(r - 5/4) < 0.01) return '5:4';
  if (Math.abs(r - 4/3) < 0.01) return '4:3';
  if (Math.abs(r - 3/4) < 0.01) return '3:4';
  if (Math.abs(r - 3) < 0.01) return '3:1';
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const div = gcd(width, height);
  return `${width/div}:${height/div}`;
}

// Aspect ratio sets per model as officially specified by RunningHub API
const MODEL_ALLOWED_RATIOS: Record<string, string[]> = {
  'nano-banana-2': ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9', '1:4', '4:1', '1:8', '8:1'],
  'nano-banana-2-lite': ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9', '1:4', '4:1', '1:8', '8:1'],
  'nano-banana-pro': ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'],
  'gpt-2.0': ['1:1', '2:3', '3:2', '4:5', '5:4', '4:3', '3:4', '16:9', '9:16', '21:9', '9:21', '2:1', '1:2', '3:1', '1:3'],
  'seedream-v5-pro': ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9', '1:4', '4:1', '1:8', '8:1'],
};

export function parseRatioToNumeric(ratioStr: string): number {
  const parts = ratioStr.split(':');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (den > 0) return num / den;
  }
  return 1;
}

export function mapToAllowedRatio(width: number, height: number, modelId?: string): string {
  const allowedList = (modelId && MODEL_ALLOWED_RATIOS[modelId]) 
    ? MODEL_ALLOWED_RATIOS[modelId] 
    : ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9', '1:4', '4:1', '1:8', '8:1'];

  const allowed = allowedList.map(str => ({
    ratio: parseRatioToNumeric(str),
    string: str
  }));

  const target = width / height;
  let bestMatch = allowed[0];
  let minDiff = Math.abs(target - bestMatch.ratio);

  for (const opt of allowed) {
    const diff = Math.abs(target - opt.ratio);
    if (diff < minDiff) {
      minDiff = diff;
      bestMatch = opt;
    }
  }

  return bestMatch.string;
}
