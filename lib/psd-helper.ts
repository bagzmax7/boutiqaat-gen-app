import { writePsd } from "ag-psd";

function loadImage(urlOrFile: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    
    let objectUrl: string | null = null;
    if (urlOrFile instanceof File) {
      objectUrl = URL.createObjectURL(urlOrFile);
      img.src = objectUrl;
    } else {
      img.src = urlOrFile;
    }
    
    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      
      // If it failed and was a third-party URL, try loading through our CORS proxy
      if (typeof urlOrFile === "string" && !urlOrFile.startsWith("data:") && !urlOrFile.startsWith("blob:") && !urlOrFile.startsWith("/")) {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(urlOrFile)}`;
        const proxyImg = new window.Image();
        proxyImg.crossOrigin = "anonymous";
        proxyImg.onload = () => resolve(proxyImg);
        proxyImg.onerror = () => reject(new Error(`Failed to load image via proxy: ${urlOrFile}`));
        proxyImg.src = proxyUrl;
      } else {
        reject(new Error(`Failed to load image`));
      }
    };
  });
}

/**
 * Generates a PSD file client-side using two layers:
 * original source image and the transparency mask image (from background removal app).
 */
export async function generatePsdClient(
  originalSource: string | File,
  maskUrl: string
): Promise<Blob> {
  // 1. Load both images
  const [origImg, maskImg] = await Promise.all([
    loadImage(originalSource),
    loadImage(maskUrl),
  ]);

  const width = origImg.naturalWidth || origImg.width;
  const height = origImg.naturalHeight || origImg.height;

  // 2. Draw original to canvas to get ImageData
  const origCanvas = document.createElement("canvas");
  origCanvas.width = width;
  origCanvas.height = height;
  const origCtx = origCanvas.getContext("2d");
  if (!origCtx) throw new Error("Could not get 2D context for original canvas");
  origCtx.drawImage(origImg, 0, 0, width, height);
  const origImageData = origCtx.getImageData(0, 0, width, height);

  // 3. Draw mask to canvas (and resize if dimensions don't match)
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) throw new Error("Could not get 2D context for mask canvas");
  maskCtx.drawImage(maskImg, 0, 0, width, height);
  const maskImageData = maskCtx.getImageData(0, 0, width, height);

  // 4. Extract alpha channel and create the 4-channel mask pixel data required by ag-psd
  const maskPixelData = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const alpha = maskImageData.data[i * 4 + 3];
    maskPixelData[i * 4] = alpha;     // R
    maskPixelData[i * 4 + 1] = alpha; // G
    maskPixelData[i * 4 + 2] = alpha; // B
    maskPixelData[i * 4 + 3] = 255;   // A
  }

  // 5. Structure the PSD Data
  const psdData = {
    width,
    height,
    children: [
      {
        name: "Original (Masked)",
        top: 0,
        left: 0,
        bottom: height,
        right: width,
        imageData: { width, height, data: new Uint8Array(origImageData.data) },
        mask: {
          top: 0,
          left: 0,
          bottom: height,
          right: width,
          defaultColor: 0,
          imageData: { width, height, data: maskPixelData },
        },
      },
    ],
  };

  // 6. Generate the PSD Uint8Array and convert to Blob
  const psdBuffer = writePsd(psdData as any);
  return new Blob([psdBuffer], { type: "application/octet-stream" });
}

/**
 * Generates a full multi-layer PSD file for Boutiqaat Layers Studio
 */
export async function generateMultiLayerPsdClient(
  layers: Array<{
    name: string;
    url?: string;
    currentUrl?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
    visible: boolean;
  }>,
  canvasWidth = 1024,
  canvasHeight = 1024
): Promise<Blob> {
  const psdLayers = [];

  for (const layer of layers) {
    const layerUrl = layer.currentUrl || layer.url;
    if (!layer.visible || !layerUrl) continue;

    try {
      const img = await loadImage(layerUrl);
      const w = Math.round(layer.width || canvasWidth);
      const h = Math.round(layer.height || canvasHeight);
      const left = Math.round(layer.x || 0);
      const top = Math.round(layer.y || 0);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);

      psdLayers.push({
        name: layer.name || "Layer",
        top: top,
        left: left,
        bottom: top + h,
        right: left + w,
        opacity: Math.max(0, Math.min(1, layer.opacity ?? 1)),
        imageData: {
          width: w,
          height: h,
          data: new Uint8Array(imgData.data),
        },
      });
    } catch (err) {
      console.warn(`[PSD Export] Failed to process layer ${layer.name}:`, err);
    }
  }

  const psdData = {
    width: canvasWidth,
    height: canvasHeight,
    children: psdLayers,
  };

  const psdBuffer = writePsd(psdData as any);
  return new Blob([psdBuffer], { type: "application/octet-stream" });
}
