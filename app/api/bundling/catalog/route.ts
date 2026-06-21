import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

function mapDepartmentToCategory(dept: string, sku: string): 'Perfume' | 'Lipstick' | 'Eyeliner' | 'Foundation' | 'Moisturizer' | 'Serum' | 'Face Mask' | 'Palette' | 'Other' {
  const d = dept.toUpperCase();
  const s = sku.toUpperCase();

  if (d.includes('PERFUME') || d.includes('FRAGRANCE') || d.includes('ORIENTAL')) {
    return 'Perfume';
  }

  if (s.startsWith('SC')) {
    // Skincare defaults
    return 'Moisturizer';
  }
  if (s.startsWith('MU')) {
    // Makeup defaults
    return 'Lipstick';
  }
  
  return 'Other';
}

export async function GET(req: NextRequest) {
  const auth = await validateAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const rawSku = searchParams.get('sku');

    if (!rawSku) {
      return NextResponse.json({ error: 'SKU is required' }, { status: 400 });
    }

    const sku = rawSku.trim().toUpperCase();

    // Extract prefix (characters before first hyphen, or first 2-3 characters)
    const match = sku.match(/^([A-Z0-9]+)/);
    let prefix = match ? match[1] : 'MISC';

    // Limit prefix to 4 chars to align with compiler script
    if (prefix.length > 4) {
      prefix = 'MISC';
    }

    const catalogPath = path.join(process.cwd(), 'lib', 'catalog', `${prefix}.json`);

    let catalogData: Record<string, any> = {};
    try {
      const fileContent = await fs.readFile(catalogPath, 'utf-8');
      catalogData = JSON.parse(fileContent);
    } catch (err) {
      // If prefix file doesn't exist, try MISC.json
      try {
        const miscPath = path.join(process.cwd(), 'lib', 'catalog', 'MISC.json');
        const fileContent = await fs.readFile(miscPath, 'utf-8');
        catalogData = JSON.parse(fileContent);
      } catch (miscErr) {
        return NextResponse.json({ error: 'SKU not found in catalog database' }, { status: 404 });
      }
    }

    const item = catalogData[sku];
    if (!item) {
      // Try a secondary search in MISC.json just in case prefix match was off
      try {
        const miscPath = path.join(process.cwd(), 'lib', 'catalog', 'MISC.json');
        const fileContent = await fs.readFile(miscPath, 'utf-8');
        const miscData = JSON.parse(fileContent);
        const miscItem = miscData[sku];
        if (miscItem) {
          const category = mapDepartmentToCategory(miscItem.dept, sku);
          return NextResponse.json({ success: true, item: { ...miscItem, category } });
        }
      } catch (e) {}

      return NextResponse.json({ error: 'SKU not found in catalog' }, { status: 404 });
    }

    const category = mapDepartmentToCategory(item.dept, sku);
    return NextResponse.json({
      success: true,
      item: {
        ...item,
        category
      }
    });

  } catch (err) {
    console.error('[catalog] Route error:', err);
    return NextResponse.json({ error: 'Lookup failed', details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
