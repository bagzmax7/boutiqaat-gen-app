import { NextRequest, NextResponse } from 'next/server';

// Debug endpoint — tests RunningHub API connectivity
// GET /api/test-api  (no auth required for debugging)
export async function GET(req: NextRequest) {
  const apiKey = process.env.RUNNINGHUB_API_KEY || '';
  const appId = '2053333317835083777';

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasApiKey: apiKey.length > 0,
      apiKeyLength: apiKey.length,
      apiKeyPrefix: apiKey.slice(0, 8) + '...',
    },
  };

  // Test with a real public image URL to verify the workflow works
  const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png';

  try {
    const runRes = await fetch(
      `https://www.runninghub.ai/openapi/v2/run/ai-app/${appId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          nodeInfoList: [
            {
              nodeId: '4',
              fieldName: 'image',
              fieldValue: testImageUrl,
              description: 'image',
            },
          ],
          instanceType: 'default',
          usePersonalQueue: 'false',
        }),
      }
    );

    const runText = await runRes.text();
    let runJson: unknown;
    try { runJson = JSON.parse(runText); } catch { runJson = runText; }

    results.runApp = {
      httpStatus: runRes.status,
      testImageUrl,
      response: runJson,
    };
  } catch (err) {
    results.runApp = { error: String(err) };
  }

  return NextResponse.json(results, { status: 200 });
}
