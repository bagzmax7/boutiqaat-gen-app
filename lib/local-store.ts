import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('[LocalStore ensure directory warning]', err);
  }
}

/**
 * Universal type-safe local JSON file store reader
 */
export function readJsonStore<T>(fileName: string, defaultValue: T): T {
  try {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, fileName);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw || '{}') as T;
    }
  } catch (err) {
    console.warn(`[LocalStore read warning for ${fileName}]`, err);
  }
  return defaultValue;
}

/**
 * Universal type-safe local JSON file store writer
 */
export function writeJsonStore<T>(fileName: string, data: T): void {
  try {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`[LocalStore write warning for ${fileName}]`, err);
  }
}
