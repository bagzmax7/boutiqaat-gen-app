/**
 * Master Prompt for Auto Retouch v1 (International E-Commerce Studio Standard)
 * Source: C:\Jenna\Antigravity\Runninghub Api\Master prompt - Auto Retouch v1.md
 */
export const AUTO_RETOUCH_MASTER_PROMPT = `Edit this image into a high-end international e-commerce studio photograph.

PRIMARY TRANSFORMATION:
Completely remove the entire original background and replace it with a seamless pure studio white background (#FFFFFF). Remove all walls, floors, surfaces, furniture, scenery, props, environmental objects, textures, and colors from the original environment. Do not simply whiten, blur, or preserve the original background.

SUBJECT:
Identify the actual commercial product in the image and preserve it as the exact same product. If a real human model is present, preserve the human exactly as photographed. If a mannequin or artificial display form is present, completely remove the mannequin while preserving the actual product displayed on it.

PRODUCT PRESERVATION:
Keep the product's exact geometry, silhouette, proportions, perspective, orientation, color, material, texture, pattern, print, logo, typography, label, stitching, seams, hardware, construction, and fine details unchanged. Do not redesign, regenerate, simplify, beautify, or reinterpret the product.

HUMAN MODEL PROTECTION:
If a real human is present, keep the exact same person, face, facial features, skin tone, hair, hijab, makeup, body proportions, pose, hands, fingers, expression, accessories, and clothing. Do not reshape, replace, beautify, or alter the person.

MANNEQUIN REMOVAL:
If the product is displayed on a mannequin, dress form, headless mannequin, torso form, or artificial body, remove the entire mannequin from the final image. Preserve the garment or product exactly. Reconstruct only the minimum garment information necessary to naturally remove the mannequin. Do not redesign or change the garment.

SHADOW — CRITICAL:
Preserve the original photographic shadow from the input image as closely as possible. The original shadow is the source of truth. Remove the original environment but retain the original subject-related shadow and transfer it naturally onto the new white studio background.

Preserve the original shadow's exact direction, shape, softness, density, opacity, falloff, spread, gradient, and relationship to the subject and light source.

Do NOT create a new generic e-commerce shadow. Do NOT create a dark oval drop shadow. Do NOT strengthen, exaggerate, stylize, or artificially darken the shadow.

CONTACT SHADOW:
Preserve the original natural contact shadow wherever the product or subject meets the surface. Keep it subtle, soft, physically connected, and consistent with the original lighting. If the original contact shadow is faint, keep it faint. If there is little or no meaningful shadow in the source, do not invent a prominent new shadow.

RETOUCHING:
Apply subtle high-end commercial e-commerce retouching appropriate to the detected product. Remove temporary dust, lint, minor photographic imperfections, sensor spots, and unwanted background artifacts. Improve clarity and exposure while preserving authentic materials, textures, colors, reflections, transparency, and product details.

LIGHTING:
Maintain the original lighting direction and photographic character. Create a clean, balanced, natural professional studio appearance without dramatic cinematic lighting, artificial rim lighting, excessive contrast, excessive highlights, or unnatural reflections.

EDGE QUALITY:
Create clean professional isolation against the white background while preserving fine hair strands, fabric fibers, lace, mesh, transparent edges, thin straps, and product contours. No white halos, dark halos, jagged edges, background remnants, or artificial outlines.

COLOR:
Preserve the exact original product color. Do not recolor, shift hue, oversaturate, or apply cinematic/fashion color grading.

FINAL RESULT:
The final image must look like the exact original commercial product professionally photographed in a premium seamless pure-white international e-commerce studio. Photorealistic, natural, clean, accurate, and physically grounded. No AI-looking reconstruction, no CGI appearance, no generic drop shadow, no product redesign, no human alteration, and no mannequin remaining.`;
