export interface PricingOption {
  name: string;
  price: number; // in USD
  official: number | null; // in USD
  saving: string | null; // e.g. "50.0%"
  unit: string; // e.g. "Image", "Call", "Sec", "Song", "10k Chars"
  notes?: string;
  aspectRatio?: string;
  pixels?: string;
}

export interface PricingModelItem {
  id: string;
  name: string;
  category: 'image' | 'video' | 'audio' | 'layers';
  categoryLabel: string;
  badge?: string;
  desc: string;
  options: PricingOption[];
}

export const KWD_EXCHANGE_RATE = 3.25; // 1 KWD = $3.25 USD -> 1 USD = 1 / 3.25 KWD

export const PRICING_MODELS_DATA: PricingModelItem[] = [
  // ==================== IMAGE MODELS ====================
  {
    id: 'nano-banana-2-economy',
    name: 'Nano Banana 2',
    category: 'image',
    categoryLabel: 'Image Generation',
    badge: 'ECONOMY',
    desc: 'Cost-optimized visual generation pipeline for high-volume batches',
    options: [
      { name: '1K', price: 0.027, official: 0.080, saving: '66.3%', unit: 'Call', notes: 'Fixed Price' },
      { name: '2K', price: 0.027, official: 0.120, saving: '77.5%', unit: 'Call', notes: 'Fixed Price' },
      { name: '4K', price: 0.043, official: 0.160, saving: '73.1%', unit: 'Call', notes: 'Fixed Price' },
    ],
  },
  {
    id: 'nano-banana-2-official',
    name: 'Nano Banana 2',
    category: 'image',
    categoryLabel: 'Image Generation',
    badge: 'STABLE / OFFICIAL',
    desc: 'High-availability official enterprise engine with guaranteed concurrency',
    options: [
      { name: '1K', price: 0.070, official: 0.080, saving: '12.5%', unit: 'Call', notes: 'Fixed Price' },
      { name: '2K', price: 0.110, official: 0.120, saving: '8.3%', unit: 'Call', notes: 'Fixed Price' },
      { name: '4K', price: 0.140, official: 0.160, saving: '12.5%', unit: 'Call', notes: 'Fixed Price' },
    ],
  },
  {
    id: 'nano-banana-2-lite',
    name: 'Nano Banana 2 Lite',
    category: 'image',
    categoryLabel: 'Image Generation',
    badge: 'LIGHTWEIGHT',
    desc: 'Ultra-fast low-latency generator for draft iterations & thumbnail pre-visualization',
    options: [
      { name: '1K (Economy)', price: 0.010, official: 0.020, saving: '50.0%', unit: 'Call', notes: 'Fixed Price' },
      { name: '1K (Official)', price: 0.031, official: 0.034, saving: '8.8%', unit: 'Call', notes: 'Fixed Price' },
    ],
  },
  {
    id: 'nano-banana-pro-economy',
    name: 'Nano Banana Pro',
    category: 'image',
    categoryLabel: 'Image Generation',
    badge: 'PRO ECONOMY',
    desc: 'Commercial studio grade rendering with intricate fabric, skin, and product details',
    options: [
      { name: '1K', price: 0.060, official: 0.150, saving: '60.0%', unit: 'Call', notes: 'Fixed Price' },
      { name: '2K', price: 0.060, official: 0.150, saving: '60.0%', unit: 'Call', notes: 'Fixed Price' },
      { name: '4K', price: 0.070, official: 0.300, saving: '76.7%', unit: 'Call', notes: 'Fixed Price' },
    ],
  },
  {
    id: 'nano-banana-pro-official',
    name: 'Nano Banana Pro',
    category: 'image',
    categoryLabel: 'Image Generation',
    badge: 'PRO OFFICIAL',
    desc: 'Guaranteed priority SLA rendering pipeline for flagship luxury campaigns',
    options: [
      { name: '1K', price: 0.120, official: 0.150, saving: '20.0%', unit: 'Call', notes: 'Fixed Price' },
      { name: '2K', price: 0.150, official: 0.150, saving: '0.0%', unit: 'Call', notes: 'Fixed Price' },
      { name: '4K', price: 0.220, official: 0.300, saving: '26.7%', unit: 'Call', notes: 'Fixed Price' },
    ],
  },
  {
    id: 'gpt-image-2-t2i',
    name: 'GPT Image 2.0 (Text to Image)',
    category: 'image',
    categoryLabel: 'Image Generation',
    badge: 'MULTIMODAL T2I',
    desc: 'High-semantic prompt alignment with multilingual typography rendering',
    options: [
      { name: 'Low - 1K', price: 0.009, official: 0.060, saving: '85.0%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'Low - 2K', price: 0.018, official: 0.090, saving: '80.0%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'Low - 4K', price: 0.027, official: 0.120, saving: '77.5%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'Medium - 1K', price: 0.054, official: 0.090, saving: '40.0%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'Medium - 2K', price: 0.108, official: 0.145, saving: '25.5%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'Medium - 4K', price: 0.162, official: 0.285, saving: '43.2%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'High - 1K', price: 0.198, official: 0.258, saving: '23.3%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'High - 2K', price: 0.396, official: 0.434, saving: '8.8%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'High - 4K', price: 0.594, official: 0.643, saving: '7.6%', unit: 'Call', notes: 'Fixed Price' },
    ],
  },
  {
    id: 'gpt-image-2-i2i',
    name: 'GPT Image 2.0 (Image to Image)',
    category: 'image',
    categoryLabel: 'Image Generation',
    badge: 'IMAGE TO IMAGE',
    desc: 'Precision image guidance, character identity retention, and reference styling',
    options: [
      { name: 'Low - 1K', price: 0.027, official: 0.053, saving: '49.1%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'Low - 2K', price: 0.054, official: 0.068, saving: '20.6%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'Low - 4K', price: 0.081, official: 0.113, saving: '28.3%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'Medium - 1K', price: 0.054, official: 0.158, saving: '65.8%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'Medium - 2K', price: 0.108, official: 0.234, saving: '53.8%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'Medium - 4K', price: 0.162, official: 0.413, saving: '60.8%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'High - 1K', price: 0.198, official: 0.258, saving: '23.3%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'High - 2K', price: 0.396, official: 0.564, saving: '29.8%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'High - 4K', price: 0.594, official: 0.712, saving: '16.6%', unit: 'Call', notes: 'Fixed Price' },
    ],
  },
  {
    id: 'gpt-image-2-economy',
    name: 'GPT Image 2.0 (Fast Economy)',
    category: 'image',
    categoryLabel: 'Image Generation',
    badge: 'ECONOMY',
    desc: 'High-speed flexible generation for instant rapid prototyping',
    options: [
      { name: 'Text to Image (Mixed)', price: 0.015, official: 0.035, saving: '57.1%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'Image to Image (Mixed)', price: 0.015, official: 0.035, saving: '57.1%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'Image Edit (1-4K)', price: 0.015, official: 0.035, saving: '57.1%', unit: 'Call', notes: 'Fixed Price' },
    ],
  },
  {
    id: 'flux-2-klein-edit',
    name: 'Flux 2 Klein',
    category: 'image',
    categoryLabel: 'Image Generation',
    badge: 'INPAINTING / EDIT',
    desc: 'High-speed open weight precision inpainting and regional subject replacement',
    options: [
      { name: '9B Edit - 1.5K', price: 0.010, official: 0.035, saving: '71.4%', unit: 'Call', notes: 'Fixed Price' },
      { name: '4B Edit - 1.5K', price: 0.010, official: 0.035, saving: '71.4%', unit: 'Call', notes: 'Fixed Price' },
    ],
  },

  // ==================== SEEDREAM 5 PRO LAYERS ====================
  {
    id: 'seedream-5-pro-layers-1k',
    name: 'Seedream 5.0 Pro (Layer Decomp 1K)',
    category: 'layers',
    categoryLabel: 'Layer Decomposition',
    badge: '1K RESOLUTION',
    desc: 'Decomposes flat image into isolated alpha PNG layers and inpainted base (<= 2.36MP)',
    options: [
      { name: '1:1 Square (1024×1024)', price: 0.041, official: 0.070, saving: '41.4%', unit: 'Call', pixels: '1,048,576 px (<= 2.36MP)' },
      { name: '4:3 Standard (1152×864)', price: 0.041, official: 0.070, saving: '41.4%', unit: 'Call', pixels: '995,328 px (<= 2.36MP)' },
      { name: '3:4 Portrait (864×1152)', price: 0.041, official: 0.070, saving: '41.4%', unit: 'Call', pixels: '995,328 px (<= 2.36MP)' },
      { name: '16:9 Landscape (1424×800)', price: 0.041, official: 0.070, saving: '41.4%', unit: 'Call', pixels: '1,139,200 px (<= 2.36MP)' },
      { name: '9:16 Story/Reel (800×1424)', price: 0.041, official: 0.070, saving: '41.4%', unit: 'Call', pixels: '1,139,200 px (<= 2.36MP)' },
      { name: '3:2 Photo (1248×832)', price: 0.041, official: 0.070, saving: '41.4%', unit: 'Call', pixels: '1,038,336 px (<= 2.36MP)' },
      { name: '2:3 Vertical (832×1248)', price: 0.041, official: 0.070, saving: '41.4%', unit: 'Call', pixels: '1,038,336 px (<= 2.36MP)' },
      { name: '21:9 Ultra-Wide (1568×672)', price: 0.041, official: 0.070, saving: '41.4%', unit: 'Call', pixels: '1,053,696 px (<= 2.36MP)' },
    ],
  },
  {
    id: 'seedream-5-pro-layers-1-5k',
    name: 'Seedream 5.0 Pro (Layer Decomp 1.5K)',
    category: 'layers',
    categoryLabel: 'Layer Decomposition',
    badge: '1.5K SWEET SPOT',
    desc: 'Optimal visual fidelity & cost-effective layer extraction for studio commercial banners',
    options: [
      { name: '1:1 Square (1536×1536)', price: 0.041, official: 0.070, saving: '41.4%', unit: 'Call', pixels: '2,359,296 px (<= 2.36MP)' },
      { name: '16:9 Landscape (2048×1152)', price: 0.041, official: 0.070, saving: '41.4%', unit: 'Call', pixels: '2,359,296 px (<= 2.36MP)' },
      { name: '9:16 Story/Reel (1152×2048)', price: 0.041, official: 0.070, saving: '41.4%', unit: 'Call', pixels: '2,359,296 px (<= 2.36MP)' },
      { name: '3:2 Photo (1872×1248)', price: 0.041, official: 0.070, saving: '41.4%', unit: 'Call', pixels: '2,336,256 px (<= 2.36MP)' },
      { name: '2:3 Vertical (1248×1872)', price: 0.041, official: 0.070, saving: '41.4%', unit: 'Call', pixels: '2,336,256 px (<= 2.36MP)' },
      { name: '4:3 Standard (1792×1344)', price: 0.081, official: 0.120, saving: '32.5%', unit: 'Call', pixels: '2,408,448 px (> 2.36MP)' },
      { name: '3:4 Portrait (1344×1792)', price: 0.081, official: 0.120, saving: '32.5%', unit: 'Call', pixels: '2,408,448 px (> 2.36MP)' },
      { name: '21:9 Ultra-Wide (2352×1008)', price: 0.081, official: 0.120, saving: '32.5%', unit: 'Call', pixels: '2,370,816 px (> 2.36MP)' },
    ],
  },
  {
    id: 'seedream-5-pro-layers-2k',
    name: 'Seedream 5.0 Pro (Layer Decomp 2K)',
    category: 'layers',
    categoryLabel: 'Layer Decomposition',
    badge: '2K ULTRA HD',
    desc: 'High resolution ultra-sharp layer separation for large billboard & print scale (> 2.36MP)',
    options: [
      { name: '1:1 Square (2048×2048)', price: 0.081, official: 0.120, saving: '32.5%', unit: 'Call', pixels: '4,194,304 px (> 2.36MP)' },
      { name: '4:3 Standard (2368×1776)', price: 0.081, official: 0.120, saving: '32.5%', unit: 'Call', pixels: '4,205,568 px (> 2.36MP)' },
      { name: '3:4 Portrait (1776×2368)', price: 0.081, official: 0.120, saving: '32.5%', unit: 'Call', pixels: '4,205,568 px (> 2.36MP)' },
      { name: '16:9 Landscape (2816×1584)', price: 0.081, official: 0.120, saving: '32.5%', unit: 'Call', pixels: '4,460,544 px (> 2.36MP)' },
      { name: '9:16 Story/Reel (1584×2816)', price: 0.081, official: 0.120, saving: '32.5%', unit: 'Call', pixels: '4,460,544 px (> 2.36MP)' },
      { name: '3:2 Photo (2496×1664)', price: 0.081, official: 0.120, saving: '32.5%', unit: 'Call', pixels: '4,153,344 px (> 2.36MP)' },
      { name: '2:3 Vertical (1664×2496)', price: 0.081, official: 0.120, saving: '32.5%', unit: 'Call', pixels: '4,153,344 px (> 2.36MP)' },
      { name: '21:9 Ultra-Wide (3136×1344)', price: 0.081, official: 0.120, saving: '32.5%', unit: 'Call', pixels: '4,214,784 px (> 2.36MP)' },
    ],
  },

  // ==================== VIDEO MODELS ====================
  {
    id: 'gemini-omni-flash-video-edit',
    name: 'Gemini Omni Flash (Video Edit)',
    category: 'video',
    categoryLabel: 'Video Generation',
    badge: 'ECONOMY EDIT',
    desc: 'AI video instruction editing, stylization, and object transformation (4-10 sec)',
    options: [
      { name: '720p (4-10s)', price: 0.050, official: 0.130, saving: '61.5%', unit: 'Call', notes: 'Fixed Price per Call' },
      { name: '1080p (4-10s)', price: 0.050, official: 0.840, saving: '94.0%', unit: 'Call', notes: 'Fixed Price per Call' },
      { name: '4K (4-10s)', price: 0.080, official: 1.260, saving: '93.7%', unit: 'Call', notes: 'Fixed Price per Call' },
    ],
  },
  {
    id: 'gemini-omni-flash-i2v',
    name: 'Gemini Omni Flash (Image to Video)',
    category: 'video',
    categoryLabel: 'Video Generation',
    badge: 'ECONOMY I2V',
    desc: 'High-speed image animation and cinematic motion physics',
    options: [
      { name: '720p - 4s', price: 0.280, official: 0.500, saving: '44.0%', unit: 'Call', notes: 'Per Call' },
      { name: '720p - 6s', price: 0.280, official: 0.750, saving: '62.7%', unit: 'Call', notes: 'Per Call' },
      { name: '720p - 8s', price: 0.280, official: 1.000, saving: '72.0%', unit: 'Call', notes: 'Per Call' },
      { name: '720p - 10s', price: 0.300, official: 1.250, saving: '76.0%', unit: 'Call', notes: 'Per Call' },
      { name: '1080p - 4s', price: 0.280, official: 0.315, saving: '11.1%', unit: 'Call', notes: 'Per Call' },
      { name: '1080p - 6s', price: 0.280, official: 0.420, saving: '33.3%', unit: 'Call', notes: 'Per Call' },
      { name: '1080p - 8s', price: 0.280, official: 0.525, saving: '46.7%', unit: 'Call', notes: 'Per Call' },
      { name: '1080p - 10s', price: 0.300, official: 0.630, saving: '52.4%', unit: 'Call', notes: 'Per Call' },
      { name: '4K - 4s', price: 0.450, official: 0.735, saving: '38.8%', unit: 'Call', notes: 'Per Call' },
      { name: '4K - 6s', price: 0.510, official: 0.840, saving: '39.3%', unit: 'Call', notes: 'Per Call' },
      { name: '4K - 8s', price: 0.540, official: 0.945, saving: '42.9%', unit: 'Call', notes: 'Per Call' },
      { name: '4K - 10s', price: 0.600, official: 1.050, saving: '42.9%', unit: 'Call', notes: 'Per Call' },
    ],
  },
  {
    id: 'gemini-omni-flash-t2v',
    name: 'Gemini Omni Flash (Text to Video)',
    category: 'video',
    categoryLabel: 'Video Generation',
    badge: 'ECONOMY T2V',
    desc: 'Direct textual prompt to cinematic video animation with dynamic camera moves',
    options: [
      { name: '720p - 4s', price: 0.280, official: 0.500, saving: '44.0%', unit: 'Call', notes: 'Per Call' },
      { name: '720p - 6s', price: 0.280, official: 0.750, saving: '62.7%', unit: 'Call', notes: 'Per Call' },
      { name: '720p - 8s', price: 0.280, official: 1.000, saving: '72.0%', unit: 'Call', notes: 'Per Call' },
      { name: '720p - 10s', price: 0.300, official: 1.250, saving: '76.0%', unit: 'Call', notes: 'Per Call' },
      { name: '1080p - 4s', price: 0.280, official: 0.315, saving: '11.1%', unit: 'Call', notes: 'Per Call' },
      { name: '1080p - 6s', price: 0.280, official: 0.420, saving: '33.3%', unit: 'Call', notes: 'Per Call' },
      { name: '1080p - 8s', price: 0.280, official: 0.525, saving: '46.7%', unit: 'Call', notes: 'Per Call' },
      { name: '1080p - 10s', price: 0.300, official: 0.630, saving: '52.4%', unit: 'Call', notes: 'Per Call' },
      { name: '4K - 4s', price: 0.450, official: 0.735, saving: '38.8%', unit: 'Call', notes: 'Per Call' },
      { name: '4K - 6s', price: 0.510, official: 0.840, saving: '39.3%', unit: 'Call', notes: 'Per Call' },
      { name: '4K - 8s', price: 0.540, official: 0.945, saving: '42.9%', unit: 'Call', notes: 'Per Call' },
      { name: '4K - 10s', price: 0.600, official: 1.050, saving: '42.9%', unit: 'Call', notes: 'Per Call' },
    ],
  },
  {
    id: 'seedance-2-mini-multimodal',
    name: 'Seedance 2.0 Mini (Multimodal)',
    category: 'video',
    categoryLabel: 'Video Generation',
    badge: 'MULTIMODAL',
    desc: 'High-speed multimodal video engine with audio-visual synchronization & reference tracking',
    options: [
      { name: '480p (No Ref Video)', price: 0.050, official: 0.090, saving: '44.4%', unit: 'Sec', notes: 'Billed per generated second' },
      { name: '720p (No Ref Video)', price: 0.100, official: 0.180, saving: '44.4%', unit: 'Sec', notes: 'Native model output' },
      { name: '1080p (No Ref Video)', price: 0.140, official: 0.250, saving: '44.0%', unit: 'Sec', notes: 'Upscaled frame-enhanced' },
      { name: '480p (With Ref Video)', price: 0.072, official: 0.120, saving: '40.0%', unit: 'Sec', notes: 'Min threshold billable' },
      { name: '720p (With Ref Video)', price: 0.144, official: 0.240, saving: '40.0%', unit: 'Sec', notes: 'Min threshold billable' },
      { name: '1080p (With Ref Video)', price: 0.184, official: 0.320, saving: '42.5%', unit: 'Sec', notes: 'Base + Gen rate' },
    ],
  },
  {
    id: 'seedance-2-mini-generation',
    name: 'Seedance 2.0 Mini (T2V / I2V)',
    category: 'video',
    categoryLabel: 'Video Generation',
    badge: 'PER SECOND',
    desc: 'Direct per-second billed text-to-video and image-to-video pipeline',
    options: [
      { name: 'T2V - 480p', price: 0.050, official: 0.100, saving: '50.0%', unit: 'Sec', notes: 'Billed per sec' },
      { name: 'T2V - 720p', price: 0.100, official: 0.200, saving: '50.0%', unit: 'Sec', notes: 'Billed per sec' },
      { name: 'T2V - 1080p', price: 0.140, official: 0.250, saving: '44.0%', unit: 'Sec', notes: 'Billed per sec' },
      { name: 'I2V - 480p', price: 0.050, official: 0.100, saving: '50.0%', unit: 'Sec', notes: 'Billed per sec' },
      { name: 'I2V - 720p', price: 0.100, official: 0.200, saving: '50.0%', unit: 'Sec', notes: 'Billed per sec' },
      { name: 'I2V - 1080p', price: 0.140, official: 0.250, saving: '44.0%', unit: 'Sec', notes: 'Billed per sec' },
    ],
  },
  {
    id: 'google-veo-3-1-fast',
    name: 'Google Veo 3.1 Fast (Economy)',
    category: 'video',
    categoryLabel: 'Video Generation',
    badge: 'FLAT $0.02',
    desc: 'Ultra-low cost high speed Google Veo engine for instant video drafting (Fixed 8s)',
    options: [
      { name: 'I2V - 720p (8s)', price: 0.020, official: 0.500, saving: '96.0%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'I2V - 1080p (8s)', price: 0.020, official: 0.800, saving: '97.5%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'I2V - 4K (8s)', price: 0.020, official: 1.200, saving: '98.3%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'T2V - 720p (8s)', price: 0.020, official: 0.500, saving: '96.0%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'T2V - 1080p (8s)', price: 0.020, official: 0.800, saving: '97.5%', unit: 'Call', notes: 'Fixed Price' },
      { name: 'T2V - 4K (8s)', price: 0.020, official: 1.200, saving: '98.3%', unit: 'Call', notes: 'Fixed Price' },
    ],
  },
  {
    id: 'minimax-h3-multimodal',
    name: 'Minimax H3 (Multimodal Video)',
    category: 'video',
    categoryLabel: 'Video Generation',
    badge: 'MULTI-IMAGE REF',
    desc: 'Complex multi-character reference tracking & cinematic storytelling (5-15 sec)',
    options: [
      { name: '768P (6-15s)', price: 0.060, official: 0.150, saving: '60.0%', unit: 'Sec', notes: 'First 5 Images free; +$0.04/img' },
      { name: '2K (5-15s)', price: 0.100, official: 0.250, saving: '60.0%', unit: 'Sec', notes: 'First 5 Images free; +$0.04/img' },
    ],
  },

  // ==================== AUDIO & MUSIC ====================
  {
    id: 'suno-v5-5',
    name: 'Suno V5.5',
    category: 'audio',
    categoryLabel: 'Audio & Music',
    badge: 'FULL VOCAL SONG',
    desc: 'Industry-standard AI song generator with dual vocalist synthesis, verses & bridge',
    options: [
      { name: 'Single Generation', price: 0.012, official: 0.400, saving: '97.0%', unit: 'Song', notes: 'Fixed Price per song' },
      { name: 'Custom Stems & Lyrics', price: 0.012, official: 0.400, saving: '97.0%', unit: 'Song', notes: 'Fixed Price per song' },
    ],
  },
  {
    id: 'minimax-music-cover',
    name: 'MiniMax Music Cover',
    category: 'audio',
    categoryLabel: 'Audio & Music',
    badge: 'MUSIC COVER',
    desc: 'Premium acoustic restyling, vocal replacement, and instrument re-orchestration',
    options: [
      { name: 'Standard Cover', price: 0.012, official: 0.400, saving: '97.0%', unit: 'Song', notes: 'Fixed Price per song' },
    ],
  },
  {
    id: 'mureka-v9',
    name: 'Mureka v9 (Generated Song)',
    category: 'audio',
    categoryLabel: 'Audio & Music',
    badge: 'STUDIO MASTER',
    desc: 'State-of-the-art cinematic commercial track and vocal synthesizing engine',
    options: [
      { name: 'Full Generated Song', price: 0.050, official: 0.600, saving: '91.7%', unit: 'Song', notes: 'Fixed Price per song' },
    ],
  },
  {
    id: 'seed-audio-v1-tts',
    name: 'Seed Audio v1.0 (TTS)',
    category: 'audio',
    categoryLabel: 'Audio & Music',
    badge: 'NATURAL TTS',
    desc: 'Ultra-realistic human voiceover & dialogue synthesis (capped at 120s duration)',
    options: [
      { name: 'Per Audio Second', price: 0.001, official: 0.005, saving: '80.0%', unit: 'Sec', notes: 'Unit Price × Audio Duration' },
    ],
  },
  {
    id: 'qwen3-tts',
    name: 'Qwen3 TTS',
    category: 'audio',
    categoryLabel: 'Audio & Music',
    badge: 'VOICE CLONE',
    desc: 'Multilingual speech generation with authentic emotional inflection',
    options: [
      { name: 'Per 10,000 Characters', price: 0.115, official: 0.300, saving: '61.7%', unit: '10k Ch', notes: 'Batch character rate' },
    ],
  },
];
