import { NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/runninghub';
import { loadSkills } from '@/lib/skills-loader';

export async function POST(request: Request) {
  let fallbackPrompt = '';
  try {
    const { 
      userPrompt, 
      skillIds, 
      conversationHistory, 
      isBrainstorm = false, 
      llmModel = 'google/gemini-3.5-flash',
      imageUrls
    } = await request.json();
    
    fallbackPrompt = userPrompt || '';

    if (!userPrompt?.trim()) {
      return NextResponse.json({ error: 'userPrompt is required' }, { status: 400 });
    }

    // Load and combine selected skills' content into a system prompt
    const allSkills = loadSkills();
    const selectedSkills = skillIds && skillIds.length > 0
      ? allSkills.filter(s => skillIds.includes(s.id))
      : [];

    let systemPrompt = '';

    if (isBrainstorm) {
      systemPrompt = `You are a visual design consultant named "Iris", working with the Boutiqaat Creative Studio team to brainstorm and design image generation ideas.
Your goal is to guide the user in a collaborative brainstorming session. Ask clarifying questions, suggest ideas (composition, style, lighting, color palette), and help them refine their vision.
You can view and analyze any reference images the user has attached to understand the visual context (such as design patterns, items, colors, styles).
If they are ready or if their prompt is clear enough, suggest a final detailed image prompt at the end of your message.

CRITICAL FORMATTING RULES:
1. You MUST wrap your final recommended image generation prompt at the end of your response inside a block tagged with [PROMPT: <enhanced prompt>]. For example:
"Based on our discussion, here is the suggested prompt:
[PROMPT: A detailed watercolor illustration of a cozy kitchen, warm lighting, rustic furniture, ultra detailed, 8k]"
2. The prompt inside [PROMPT: ...] MUST be in English.
3. The rest of your response (consultation/conversation) should match the language the user is speaking (e.g. Indonesian or English).
4. If the user explicitly asks to generate/create/run the concepts (e.g., using terms like "#generate", "#generated", "buat masing-masing konsep", "generate all concepts", "masing-masing konsep"), you MUST extract/write the final prompt for EACH concept inside a separate '<slice_prompt>...</slice_prompt>' tag. For example, if there are 5 concepts, output 5 separate '<slice_prompt>...</slice_prompt>' tags in your response. The prompt inside '<slice_prompt>' MUST be the complete, self-contained detailed English prompt for that concept (including subject description, clothing, style, lighting, camera angle, and quality keywords like "photorealistic, 8k"). Do NOT wrap these slice prompts inside [PROMPT: ...] tags.
5. Be conversational, creative, helpful, and concise.`;
    } else {
      systemPrompt = `You are an expert AI Image Prompt Engineer named "Iris", designed specifically for the Boutiqaat Creative Studio team.
Your sole purpose is to take a user's brief, casual description and transform it into a richly detailed, optimized image generation prompt.
Analyze any attached reference images to extract key visual attributes (composition, style, color palette, lighting, objects) and incorporate them into the enhanced prompt.

CRITICAL RULES:
1. Your output MUST be ONLY the enhanced image generation prompt — no explanations, no preamble, no quotation marks around the output.
2. The enhanced prompt must be in English, regardless of the user's input language.
3. Include: subject description, style, lighting, mood, camera angle, background, quality modifiers.
4. Always end with quality tokens like: "ultra detailed, photorealistic, 8K, masterpiece".
5. Keep the final prompt between 80 and 200 words.`;
    }

    if (selectedSkills.length > 0) {
      systemPrompt += '\n\n## ACTIVE SKILL MODULES\nThe following specialized skill modules are active and you MUST incorporate their guidance:\n\n';
      selectedSkills.forEach(skill => {
        systemPrompt += `### ${skill.name} (${skill.icon})\n${skill.content}\n\n`;
      });
    }

    // Build conversation messages for context
    const messages: { role: string; content: any }[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history context (last 6 turns to stay within token limits)
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-6);
      recentHistory.forEach((msg: { role: string; content: string }) => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      });
    }

    // Build user content (text or multi-modal parts)
    let userContent: any = isBrainstorm
      ? userPrompt
      : `Please enhance this image prompt: "${userPrompt}"`;

    if (imageUrls && imageUrls.length > 0) {
      const parts: any[] = [
        { type: "text", text: userContent }
      ];
      imageUrls.forEach((uri: string, idx: number) => {
        parts.push({ type: "text", text: `\n[Attached Reference Image ${idx + 1}]:` });
        parts.push({
          type: "image_url",
          image_url: { url: uri }
        });
      });
      userContent = parts;
    }

    // Add the current user request
    messages.push({
      role: 'user',
      content: userContent,
    });

    const response = await chatCompletion({
      model: llmModel,
      messages,
      max_tokens: isBrainstorm ? 1024 : 512,
      temperature: 0.8,
    }, 'enterprise');

    const assistantContent = response?.choices?.[0]?.message?.content || '';
    
    let enhancedPrompt = '';
    let brainstormResponse = assistantContent;
    const slicedPrompts: string[] = [];

    if (isBrainstorm) {
      // 1. Extract any <slice_prompt>...</slice_prompt> tags
      const sliceRegex = /<slice_prompt>([\s\S]*?)<\/slice_prompt>/gi;
      let sliceMatch;
      while ((sliceMatch = sliceRegex.exec(assistantContent)) !== null) {
        if (sliceMatch[1].trim()) {
          slicedPrompts.push(sliceMatch[1].trim());
        }
      }

      // 2. Extract standard [PROMPT: ...] tag if present
      const promptRegex = /\[PROMPT:\s*([\s\S]*?)\]/i;
      const match = assistantContent.match(promptRegex);
      if (match) {
        enhancedPrompt = match[1].trim();
      }

      // 3. Clean up both types of tags for the conversational bubble
      brainstormResponse = assistantContent
        .replace(/<slice_prompt>[\s\S]*?<\/slice_prompt>/gi, '')
        .replace(promptRegex, '')
        .trim();
    } else {
      enhancedPrompt = assistantContent.trim() || userPrompt;
    }

    return NextResponse.json({
      enhancedPrompt,
      brainstormResponse: isBrainstorm ? brainstormResponse : undefined,
      slicedPrompts: slicedPrompts.length > 0 ? slicedPrompts : undefined,
      skillsUsed: selectedSkills.map(s => ({ id: s.id, name: s.name, icon: s.icon })),
    });
  } catch (err: any) {
    console.error('[Agent Enhance Error]:', err);
    // Graceful fallback — return the original prompt if LLM fails
    return NextResponse.json({
      enhancedPrompt: fallbackPrompt,
      skillsUsed: [],
      warning: `Agent unavailable: ${err.message}. Original prompt used.`,
    });
  }
}
