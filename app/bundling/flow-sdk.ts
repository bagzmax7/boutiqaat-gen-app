/**
 * app/bundling/flow-sdk.ts
 *
 * Local Shim for Google Flow SDK.
 * Redirects Flow operations directly to standard browser features
 * and Boutiqaat's custom dashboard API routes (/api/bundling/*).
 *
 * Upgraded with:
 * - Active products tracking (Flow.setProducts)
 * - Gemini Packaging & Visual Identity Analysis (/api/bundling/analyze)
 * - Aligned Prompt Generation (/api/bundling/generate-prompt)
 * - Multi-reference image generation inputs (canvas layout + high-res products)
 * - Automatic double history logging (Local Studio Sessions & Global Dashboard Tasks)
 */

import { Product, ProductDimensions } from './flow code/types';

// Toggle this to false to revert back to the stable Gemini implementation
export const USE_RUNNINGHUB_API = true;

export interface ProductAnalysis {
  product_id: string;
  product_name: string;
  category: string;
  estimated_volume: string;
  dimensions_cm: {
    height: number;
    width: number;
    depth: number;
  };
  visual_description: string;
  confidence: string;
}

let activeProducts: Product[] = [];

export const Flow = {
  setProducts: (products: Product[]) => {
    activeProducts = products;
  },

  media: {
    select: async (options: { filter?: string } = {}): Promise<{ name: string; base64: string; mimeType: string }> => {
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        if (options.filter === 'image') {
          input.accept = 'image/*';
        }

        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            reject(new Error('User cancelled media selection'));
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const commaIndex = result.indexOf(',');
            const base64 = commaIndex !== -1 ? result.substring(commaIndex + 1) : result;
            resolve({
              name: file.name,
              base64,
              mimeType: file.type,
            });
          };
          reader.onerror = () => {
            reject(new Error('Failed to read file'));
          };
          reader.readAsDataURL(file);
        };

        input.oncancel = () => {
          reject(new Error('User cancelled media selection'));
        };

        input.click();
      });
    },
  },

  upload: async (options: { base64: string; mimeType: string }): Promise<{ mediaId: string }> => {
    const byteCharacters = atob(options.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: options.mimeType });
    const file = new File([blob], 'flow-canvas-upload.png', { type: options.mimeType });

    const formData = new FormData();
    formData.append('images', file);

    const res = await fetch('/api/bundling/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to upload layout to Supabase storage.');
    }

    const { urls } = await res.json() as { urls: string[] };
    if (!urls || urls.length === 0) {
      throw new Error('Upload returned empty list of public URLs');
    }

    return {
      mediaId: urls[0],
    };
  },

  generate: {
    image: async (options: {
      prompt: string;
      referenceImageMediaIds: string[];
      modelDisplayName?: string;
      aspectRatio?: string;
      isPreOptimized?: boolean;
      productUrls?: string[];
      analyses?: ProductAnalysis[];
      genMode?: 'Studio' | 'Aesthetic' | 'Creative';
    }): Promise<{ mediaId: string; base64: string; mimeType: string }> => {
      let finalPrompt = options.prompt;
      let referenceUrls = [...options.referenceImageMediaIds]; // [canvasUrl]
      let analyses: ProductAnalysis[] = options.analyses || [];
      let productUrls: string[] = options.productUrls || [];

      // ── Step 1: Execute Packaging Expert LLM & Prompt Optimization ──
      if (!options.isPreOptimized && activeProducts.length > 0) {
        try {
          console.log('[flow-sdk] Optimizing prompt via Gemini packaging-expert (fallback)...');
          
          // Sort activeProducts from left to right based on their canvas X coordinate.
          const sortedActiveProducts = [...activeProducts].sort((a, b) => a.x - b.x);

          // Load images in browser to find natural aspect ratios
          const productsWithAspect = await Promise.all(sortedActiveProducts.map(async (p) => {
            return new Promise<{ p: typeof p; aspect: number }>((resolve) => {
              const img = new Image();
              img.onload = () => {
                resolve({ p, aspect: img.width > 0 && img.height > 0 ? img.width / img.height : 1.0 });
              };
              img.onerror = () => {
                resolve({ p, aspect: 1.0 });
              };
              img.src = `data:${p.mimeType};base64,${p.base64}`;
            });
          }));

          // Upload any products that haven't been uploaded yet to get public URLs
          const uploadPromises = productsWithAspect.map(async (item) => {
            const p = item.p;
            if (p.uploadedUrl) return p.uploadedUrl;
            
            const uploadRes = await Flow.upload({ base64: p.base64, mimeType: p.mimeType });
            p.uploadedUrl = uploadRes.mediaId;
            return uploadRes.mediaId;
          });
          
          productUrls = await Promise.all(uploadPromises);

          // Invoke analyzer for packaging details & labels
          const analyzeRes = await fetch(USE_RUNNINGHUB_API ? '/api/bundling/analyze-rh' : '/api/bundling/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              images: productUrls,
              product_names: productsWithAspect.map((item) => item.p.name),
            }),
          });

          if (analyzeRes.ok) {
            const data = await analyzeRes.json() as { products: ProductAnalysis[] };
            analyses = data.products || [];

            // Call prompt builder with selected layout style
            let style: 'studio' | 'lifestyle' | 'creative' = 'lifestyle';
            if (options.prompt.includes('studio')) {
              style = 'studio';
            } else if (options.prompt.includes('creative')) {
              style = 'creative';
            }
            const promptRes = await fetch('/api/bundling/generate-prompt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                products: productsWithAspect.map((item, idx) => {
                  const clientProd = item.p;
                  const targetId = `image_${idx + 1}`;
                  const analysis = analyses.find((a) => a.product_id === targetId) || analyses[idx];
                  
                  return {
                    name: clientProd.name,
                    analysis: {
                      ...analysis,
                      category: clientProd.category ? clientProd.category.toLowerCase() : (analysis?.category || 'other'),
                      estimated_volume: clientProd.volumeMl ? `${clientProd.volumeMl}ml` : (analysis?.estimated_volume || '0ml'),
                      dimensions_cm: {
                        height: clientProd.heightCm * clientProd.scale,
                        width: clientProd.heightCm * clientProd.scale * item.aspect,
                        depth: clientProd.lengthCm
                      },
                      visual_description: analysis?.visual_description || '',
                      confidence: analysis?.confidence || 'High'
                    },
                    imageIndex: idx + 2, // Canvas is Image 1, original products start at Image 2
                  };
                }),
                promptStyle: style,
              }),
            });

            if (promptRes.ok) {
              const promptData = await promptRes.json() as { prompts: string[] };
                finalPrompt = promptData.prompts[0];
                referenceUrls = [options.referenceImageMediaIds[0], ...productUrls];
                console.log('[flow-sdk] Aligned prompt successfully generated:', finalPrompt);
            }
          }
        } catch (err) {
          console.error('[flow-sdk] Prompt optimization error (using default):', err);
        }
      } else if (options.isPreOptimized) {
        // If pre-optimized, construct referenceUrls: [canvasUrl, ...productUrls]
        if (referenceUrls.length === 1 && productUrls.length > 0) {
          referenceUrls = [referenceUrls[0], ...productUrls];
        }
      }

      // ── Step 2: Call AI Image Generation Endpoint ──
      console.log('[flow-sdk] Triggering AI generation pipeline...');
      const res = await fetch(USE_RUNNINGHUB_API ? '/api/bundling/generate-rh' : '/api/bundling/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          image_urls: referenceUrls,
          genMode: options.genMode || 'Studio'
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gemini model image generation failed.');
      }

      const { imageUrl } = await res.json() as { imageUrl: string };

      // Convert generated public URL to base64 so it can be previewed/downloaded in Flow app
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        throw new Error(`Failed to load generated result image from storage: ${imageUrl}`);
      }
      
      const blob = await imgRes.blob();
      const reader = new FileReader();

      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const commaIndex = result.indexOf(',');
          resolve(commaIndex !== -1 ? result.substring(commaIndex + 1) : result);
        };
        reader.onerror = reject;
      });
      
      reader.readAsDataURL(blob);
      const base64 = await base64Promise;

      // ── Step 3: Double History Logging (Studio sessions + Global Dashboard) ──
      const sessionName = activeProducts.length > 0
        ? activeProducts.map((p) => p.name).slice(0, 2).join(' + ')
        : 'Bundling Studio';
      const formattedSessionName = `${sessionName} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

      // 3a. Save to Bundling Sessions database
      try {
        await fetch('/api/bundling/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_name: formattedSessionName,
            product_images: productUrls.length > 0 ? productUrls : [referenceUrls[0]],
            product_names: activeProducts.map((p) => p.name),
            dimensions_analysis: { products: analyses },
            final_prompt: finalPrompt,
            generated_image_url: imageUrl,
          }),
        });
        console.log('[flow-sdk] Saved to local Bundling Sessions history.');
      } catch (dbErr) {
        console.error('[flow-sdk] Studio history save error:', dbErr);
      }

      // 3b. Save to Global Dashboard Task History
      try {
        const taskId = `bundling-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        
        // POST to create standard task
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: taskId,
            runninghub_task_id: taskId,
            app_id: 'bundling-studio',
            app_name: 'Bundling Studio',
            api_key_type: 'enterprise',
            node_info_list: [],
          }),
        });

        // PATCH to set status = SUCCESS and outputs = [imageUrl]
        await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'SUCCESS',
            outputs: [{ fileUrl: imageUrl, fileType: 'image' }],
          }),
        });
        console.log('[flow-sdk] Saved to global Dashboard task history.');
      } catch (taskErr) {
        console.error('[flow-sdk] Global dashboard history save error:', taskErr);
      }

      return {
        mediaId: imageUrl,
        base64,
        mimeType: blob.type || 'image/png',
      };
    },
  },

  creativeDirector: {
    optimizePrompt: async (options: {
      products: Product[];
      genMode: 'Studio' | 'Aesthetic' | 'Creative';
      canvasUrl: string;
      selectedLlm?: string;
    }): Promise<{ prompt: string; productUrls: string[]; analyses: ProductAnalysis[] }> => {
      // 1. Sort activeProducts from left to right based on canvas X
      const sortedProds = [...options.products].sort((a, b) => a.x - b.x);

      // 2. Upload any products that haven't been uploaded yet
      const uploadPromises = sortedProds.map(async (p) => {
        if (p.uploadedUrl) return p.uploadedUrl;
        const uploadRes = await Flow.upload({ base64: p.base64, mimeType: p.mimeType });
        p.uploadedUrl = uploadRes.mediaId;
        return uploadRes.mediaId;
      });
      const productUrls = await Promise.all(uploadPromises);

      // Get natural aspects of product images to compute width properly
      const productsWithAspect = await Promise.all(sortedProds.map(async (p) => {
        return new Promise<{ p: typeof p; aspect: number }>((resolve) => {
          const img = new Image();
          img.onload = () => {
            resolve({ p, aspect: img.width > 0 && img.height > 0 ? img.width / img.height : 1.0 });
          };
          img.onerror = () => {
            resolve({ p, aspect: 1.0 });
          };
          img.src = `data:${p.mimeType};base64,${p.base64}`;
        });
      }));

      // 3. Call /api/bundling/analyze-rh
      console.log('[flow-sdk] Requesting Creative Director for prompt optimization...');
      const res = await fetch('/api/bundling/analyze-rh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: [options.canvasUrl, ...productUrls],
          genMode: options.genMode,
          selectedLlm: options.selectedLlm,
          products: productsWithAspect.map((item, idx) => ({
            product_id: `image_${idx + 2}`,
            name: item.p.name,
            category: item.p.category,
            volume_ml: item.p.volumeMl,
            dimensions_cm: {
              height: item.p.heightCm * item.p.scale,
              width: item.p.heightCm * item.p.scale * item.aspect,
              depth: item.p.lengthCm
            }
          }))
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Creative Director prompt optimization failed.');
      }

      const data = await res.json() as { prompt: string; products: ProductAnalysis[] };
      return {
        prompt: data.prompt,
        productUrls,
        analyses: data.products || []
      };
    }
  },


  download: async (options: { base64: string; mimeType: string; filename: string }): Promise<void> => {
    const byteCharacters = atob(options.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: options.mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = options.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
