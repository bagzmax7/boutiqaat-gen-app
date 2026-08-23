import fs from 'fs';
import path from 'path';

export interface MemberSettings {
  userId: string;
  monthlyCreditLimitUsd: number;
  allowedModels: string[];
  status: 'active' | 'suspended';
  managerId?: string | null;
  departmentId?: string | null;
}

const DATA_FILE = path.join(process.cwd(), 'data', 'team-settings.json');

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf-8');
  }
}

export function getAllMemberSettings(): Record<string, MemberSettings> {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

export function getMemberSettings(userId: string): MemberSettings {
  const all = getAllMemberSettings();
  if (all[userId]) {
    return all[userId];
  }
  return {
    userId,
    monthlyCreditLimitUsd: 100.0,
    allowedModels: ['image', 'video', 'social-resize', 'bundling'],
    status: 'active',
  };
}

export function updateMemberSettings(userId: string, updates: Partial<MemberSettings>): MemberSettings {
  const all = getAllMemberSettings();
  const current = all[userId] || {
    userId,
    monthlyCreditLimitUsd: 100.0,
    allowedModels: ['image', 'video', 'social-resize', 'bundling'],
    status: 'active',
  };

  const updated: MemberSettings = {
    ...current,
    ...updates,
    userId,
  };

  all[userId] = updated;
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
  return updated;
}
