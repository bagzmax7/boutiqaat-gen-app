export interface SocialPreset {
  id: string;
  name: string;
  platform: string;
  width: number;
  height: number;
  category: 'social' | 'ads' | 'web';
}

export const SOCIAL_PRESETS: SocialPreset[] = [
  // X (Twitter)
  { id: 'x-post', name: 'Post', platform: 'X', width: 1200, height: 675, category: 'social' }, // 16:9 approx
  { id: 'x-header', name: 'Header', platform: 'X', width: 1500, height: 500, category: 'social' }, // 3:1
  { id: 'x-profile', name: 'Profile', platform: 'X', width: 400, height: 400, category: 'social' }, // 1:1
  
  // Threads
  { id: 'threads-post', name: 'Post (4:5)', platform: 'Threads', width: 1080, height: 1350, category: 'social' },
  { id: 'threads-square', name: 'Square', platform: 'Threads', width: 1080, height: 1080, category: 'social' },

  // YouTube
  { id: 'yt-thumb', name: 'Thumbnail', platform: 'YouTube', width: 1280, height: 720, category: 'social' },
  { id: 'yt-banner', name: 'Banner', platform: 'YouTube', width: 2560, height: 1440, category: 'social' }, // 16:9 safe area
  { id: 'yt-profile', name: 'Profile', platform: 'YouTube', width: 800, height: 800, category: 'social' },

  // TikTok
  { id: 'tiktok-video', name: 'Video', platform: 'TikTok', width: 1080, height: 1920, category: 'social' },
  { id: 'tiktok-profile', name: 'Profile', platform: 'TikTok', width: 200, height: 200, category: 'social' },

  // Facebook
  { id: 'fb-post-sq', name: 'Post Square', platform: 'Facebook', width: 1080, height: 1080, category: 'social' },
  { id: 'fb-cover', name: 'Cover', platform: 'Facebook', width: 820, height: 312, category: 'social' },
  { id: 'fb-story', name: 'Story', platform: 'Facebook', width: 1080, height: 1920, category: 'social' },

  // Meta Ads
  { id: 'meta-feed', name: 'Feed Ad', platform: 'Meta Ads', width: 1080, height: 1080, category: 'ads' },
  { id: 'meta-story', name: 'Story Ad', platform: 'Meta Ads', width: 1080, height: 1920, category: 'ads' },
  { id: 'meta-landscape', name: 'Landscape Ad', platform: 'Meta Ads', width: 1200, height: 628, category: 'ads' },

  // Web
  { id: 'web-hero', name: 'Hero Banner', platform: 'Web', width: 1920, height: 1080, category: 'web' },
  { id: 'web-standard', name: 'Standard Image', platform: 'Web', width: 1200, height: 900, category: 'web' } // 4:3
];

export function getAspectRatio(width: number, height: number): string {
  // Approximate standard ratios for the UI display
  const r = width / height;
  if (Math.abs(r - 1) < 0.01) return '1:1';
  if (Math.abs(r - 16/9) < 0.01) return '16:9';
  if (Math.abs(r - 9/16) < 0.01) return '9:16';
  if (Math.abs(r - 4/5) < 0.01) return '4:5';
  if (Math.abs(r - 5/4) < 0.01) return '5:4';
  if (Math.abs(r - 4/3) < 0.01) return '4:3';
  if (Math.abs(r - 3/4) < 0.01) return '3:4';
  if (Math.abs(r - 3) < 0.01) return '3:1';
  // Use GCD to get exact ratio string
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const div = gcd(width, height);
  return `${width/div}:${height/div}`;
}

export function mapToAllowedRatio(width: number, height: number): string {
  const allowed = [
    { ratio: 1/1, string: '1:1' },
    { ratio: 16/9, string: '16:9' },
    { ratio: 9/16, string: '9:16' },
    { ratio: 4/3, string: '4:3' },
    { ratio: 3/4, string: '3:4' },
    { ratio: 3/2, string: '3:2' },
    { ratio: 2/3, string: '2:3' },
    { ratio: 5/4, string: '5:4' },
    { ratio: 4/5, string: '4:5' },
    { ratio: 21/9, string: '21:9' },
    { ratio: 1/4, string: '1:4' },
    { ratio: 4/1, string: '4:1' },
    { ratio: 1/8, string: '1:8' },
    { ratio: 8/1, string: '8:1' }
  ];

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

