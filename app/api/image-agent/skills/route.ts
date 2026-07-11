import { NextResponse } from 'next/server';
import { loadSkills } from '@/lib/skills-loader';

export async function GET() {
  try {
    const skills = loadSkills();
    return NextResponse.json({ skills });
  } catch (err: any) {
    console.error('[Skills API Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
