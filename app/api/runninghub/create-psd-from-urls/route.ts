import { NextRequest, NextResponse } from "next/server";
import { writePsd } from "ag-psd";
import { Jimp } from "jimp";

export async function POST(req: NextRequest) {
  try {
    const { originalUrl, maskUrl, fileName = "output.psd" } = await req.json();

    if (!originalUrl || !maskUrl) {
      return NextResponse.json(
        { error: "originalUrl and maskUrl are required" },
        { status: 400 }
      );
    }

    // 1. Download original image
    let origRes: Response;
    try {
      origRes = await fetch(originalUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
    } catch (fetchErr: any) {
      throw new Error(`Network error downloading original image: ${fetchErr.message}`);
    }
    if (!origRes.ok) {
      console.error(
        `Failed to download original image: ${origRes.status} ${origRes.statusText} — URL: ${originalUrl}`
      );
      throw new Error(
        `Failed to download original image (${origRes.status} ${origRes.statusText})`
      );
    }
    const origArrayBuffer = await origRes.arrayBuffer();
    const origBuffer = Buffer.from(origArrayBuffer);

    // 2. Download mask/transparent image (RunningHub output)
    let maskRes: Response;
    try {
      maskRes = await fetch(maskUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
    } catch (fetchErr: any) {
      throw new Error(`Network error downloading mask image: ${fetchErr.message}`);
    }
    if (!maskRes.ok) {
      console.error(
        `Failed to download mask image: ${maskRes.status} ${maskRes.statusText} — URL: ${maskUrl}`
      );
      throw new Error(
        `Failed to download mask image (${maskRes.status} ${maskRes.statusText})`
      );
    }
    const maskArrayBuffer = await maskRes.arrayBuffer();
    const maskBuffer = Buffer.from(maskArrayBuffer);

    // 3. Process with Jimp
    const origJimp = await Jimp.read(origBuffer);
    const maskJimp = await Jimp.read(maskBuffer);

    const width = origJimp.bitmap.width;
    const height = origJimp.bitmap.height;

    // Resize mask if somehow dimensions don't match exactly
    if (maskJimp.bitmap.width !== width || maskJimp.bitmap.height !== height) {
      maskJimp.resize({ w: width, h: height } as any);
    }

    // 4. Create proper Alpha Mask for ag-psd
    // ag-psd PixelData requires RGBA format (4 channels) even for masks.
    // If we only pass 1 channel, it gets read as RGBA out-of-bounds, corrupting the image.
    const maskPixelData = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      // The alpha channel in Jimp is the 4th byte of every pixel (i * 4 + 3)
      // RunningHub's output is a transparent PNG. We use its alpha to define our mask.
      const alpha = maskJimp.bitmap.data[i * 4 + 3];
      
      // Fill all RGB channels with the alpha value, and set A to 255.
      // This ensures ag-psd extracts the mask correctly regardless of which channel it reads.
      maskPixelData[i * 4] = alpha;     // R
      maskPixelData[i * 4 + 1] = alpha; // G
      maskPixelData[i * 4 + 2] = alpha; // B
      maskPixelData[i * 4 + 3] = 255;   // A
    }

    // 5. Structure the PSD Data
    // We provide explicit top/left/bottom/right bounds to prevent Photoshop offset bugs.
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
          imageData: { width, height, data: new Uint8Array(origJimp.bitmap.data) },
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
    } as any;

    // 6. Generate the PSD buffer
    const psdBuffer = writePsd(psdData);
    const finalBuffer = Buffer.from(psdBuffer);

    // 7. Return the file
    return new NextResponse(finalBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Error creating PSD from URLs:", error);
    return NextResponse.json(
      { error: "Failed to generate PSD", details: error.message },
      { status: 500 }
    );
  }
}
