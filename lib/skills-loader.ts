import fs from 'fs';
import path from 'path';

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  content: string;
}

// Simple inline YAML frontmatter parser (avoids gray-matter dependency)
function parseFrontmatter(raw: string): { data: Record<string, any>; content: string } {
  const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = raw.match(fmRegex);
  if (!match) return { data: {}, content: raw };

  const yamlBlock = match[1];
  const content = match[2];

  const data: Record<string, any> = {};
  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    } else {
      data[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  return { data, content };
}

// Cache in memory (resets on server restart)
let cachedSkills: Skill[] | null = null;

export function loadSkills(): Skill[] {
  if (cachedSkills) return cachedSkills;

  const skillsDir = path.join(process.cwd(), 'app', 'api', 'image-agent', 'skills', 'data');

  if (!fs.existsSync(skillsDir)) return [];

  const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));

  cachedSkills = files.map(file => {
    const raw = fs.readFileSync(path.join(skillsDir, file), 'utf-8');
    const { data, content } = parseFrontmatter(raw);
    return {
      id: data.id || file.replace('.md', ''),
      name: data.name || file.replace('.md', ''),
      description: data.description || '',
      icon: data.icon || '🧠',
      tags: Array.isArray(data.tags) ? data.tags : [],
      content: content.trim(),
    };
  });

  return cachedSkills;
}
