/**
 * POST /api/bundling/generate-prompt
 * Receives { products, dimensions, order } and returns generated prompt string.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { generateBundlingPrompt, BundlingPromptOptions, ProductAnalysis } from '@/lib/bundling';

export async function POST(req: NextRequest) {
  const auth = await validateAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      products,
      options,
      promptStyle = 'lifestyle',
    } = body as {
      products: Array<{ name: string; analysis: ProductAnalysis; imageIndex: number }>;
      options?: BundlingPromptOptions;
      promptStyle?: 'lifestyle' | 'studio' | 'creative' | 'both';
    };

    if (!products || products.length < 1) {
      return NextResponse.json({ error: 'At least 1 product required' }, { status: 400 });
    }

    let prompts: string[] = [];
    
    if (promptStyle === 'both') {
      prompts.push(generateBundlingPrompt(products, { ...options, promptStyle: 'lifestyle' }));
      prompts.push(generateBundlingPrompt(products, { ...options, promptStyle: 'studio' }));
    } else {
      prompts.push(generateBundlingPrompt(products, { ...options, promptStyle }));
    }

    return NextResponse.json({ prompts });
  } catch (err) {
    console.error('Generate prompt error:', err);
    return NextResponse.json({ error: 'Prompt generation failed' }, { status: 500 });
  }
}
