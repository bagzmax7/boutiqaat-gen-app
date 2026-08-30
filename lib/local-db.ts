import fs from 'fs';
import path from 'path';

/**
 * lib/local-db.ts
 *
 * 100% Local File-Based Database Driver for Boutiqaat Creative AI Suite.
 * Replaces cloud Supabase queries with zero-latency atomic file operations.
 *
 * Target directory: C:\Jenna\Antigravity\Runninghub Api\Boutiqaat Local Database\tables
 */

const LOCAL_DB_DIR =
  process.env.LOCAL_DB_PATH ||
  (fs.existsSync(path.resolve(process.cwd(), '../Boutiqaat Clean Database'))
    ? path.resolve(process.cwd(), '../Boutiqaat Clean Database')
    : path.resolve(process.cwd(), 'database'));
const TABLES_DIR = path.join(LOCAL_DB_DIR, 'tables');

// Ensure tables directory exists
if (!fs.existsSync(TABLES_DIR)) {
  try {
    fs.mkdirSync(TABLES_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

// Helper to get file path for a table
function getTableFile(tableName: string): string {
  // Normalize names
  const normalized = tableName.toLowerCase();
  return path.join(TABLES_DIR, `${normalized}.json`);
}

// In-memory cache with file modification tracking
const cache: Record<string, { mtime: number; data: any[] }> = {};

function readTable<T = any>(tableName: string): T[] {
  const filePath = getTableFile(tableName);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const stat = fs.statSync(filePath);
    const cached = cache[tableName];
    if (cached && cached.mtime === stat.mtimeMs) {
      return cached.data;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content || '[]');
    const arr = Array.isArray(data) ? data : [data];
    cache[tableName] = { mtime: stat.mtimeMs, data: arr };
    return arr;
  } catch (err) {
    console.error(`[LocalDB] Error reading table ${tableName}:`, err);
    return [];
  }
}

function writeTable<T = any>(tableName: string, data: T[]): boolean {
  const filePath = getTableFile(tableName);
  try {
    const parent = path.dirname(filePath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }

    const tempPath = `${filePath}.tmp.${Date.now()}`;
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, filePath);

    const stat = fs.statSync(filePath);
    cache[tableName] = { mtime: stat.mtimeMs, data };
    return true;
  } catch (err) {
    console.error(`[LocalDB] Error writing table ${tableName}:`, err);
    return false;
  }
}

type FilterFn = (item: any) => boolean;

export class LocalQueryBuilder<T = any> implements PromiseLike<{ data: any; error: any; count?: number }> {
  private tableName: string;
  private filters: FilterFn[] = [];
  private orderCol: string | null = null;
  private orderAsc: boolean = true;
  private limitCount: number | null = null;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;
  private action: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private mutateData: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns: string = '*') {
    this.action = 'select';
    return this;
  }

  insert(data: any | any[]) {
    this.action = 'insert';
    this.mutateData = Array.isArray(data) ? data : [data];
    return this;
  }

  upsert(data: any | any[], options?: { onConflict?: string }) {
    this.action = 'upsert';
    this.mutateData = Array.isArray(data) ? data : [data];
    return this;
  }

  update(data: any) {
    this.action = 'update';
    this.mutateData = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push(item => String(item?.[column]) === String(value));
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push(item => String(item?.[column]) !== String(value));
    return this;
  }

  in(column: string, values: any[]) {
    const stringValues = new Set((values || []).map(v => String(v)));
    this.filters.push(item => stringValues.has(String(item?.[column])));
    return this;
  }

  is(column: string, value: any) {
    this.filters.push(item => item?.[column] === value);
    return this;
  }

  ilike(column: string, pattern: string) {
    const cleanPattern = pattern.replace(/%/g, '.*');
    const regex = new RegExp(`^${cleanPattern}$`, 'i');
    this.filters.push(item => regex.test(String(item?.[column] || '')));
    return this;
  }

  like(column: string, pattern: string) {
    const cleanPattern = pattern.replace(/%/g, '.*');
    const regex = new RegExp(`^${cleanPattern}$`);
    this.filters.push(item => regex.test(String(item?.[column] || '')));
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push(item => (item?.[column] ?? 0) >= value);
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push(item => (item?.[column] ?? 0) <= value);
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push(item => (item?.[column] ?? 0) > value);
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push(item => (item?.[column] ?? 0) < value);
    return this;
  }

  not(column: string, operator: string, value: any) {
    if (operator === 'is') {
      this.filters.push(item => item?.[column] !== value);
    } else if (operator === 'eq') {
      this.filters.push(item => String(item?.[column]) !== String(value));
    }
    return this;
  }

  or(filterStr: string) {
    // Simple or matching for search terms
    const terms = filterStr.split(',').map(s => s.trim());
    this.filters.push(item => {
      return terms.some(term => {
        const parts = term.split('.ilike.');
        if (parts.length === 2) {
          const col = parts[0];
          const pattern = parts[1].replace(/%/g, '.*');
          const regex = new RegExp(pattern, 'i');
          return regex.test(String(item?.[col] || ''));
        }
        return true;
      });
    });
    return this;
  }

  range(from: number, to: number) {
    this.limitCount = Math.max(0, to - from + 1);
    return this;
  }

  csv() {
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  private async execute(): Promise<{ data: any; error: any; count?: number }> {
    const rows = readTable(this.tableName);

    // 1. INSERT
    if (this.action === 'insert') {
      const itemsToAdd = (this.mutateData || []).map((item: any) => ({
        id: item.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...item,
      }));

      const nextRows = [...itemsToAdd, ...rows];
      writeTable(this.tableName, nextRows);

      return {
        data: this.isSingle ? itemsToAdd[0] : itemsToAdd,
        error: null,
      };
    }

    // 2. UPSERT
    if (this.action === 'upsert') {
      const itemsToUpsert = this.mutateData || [];
      const updatedRows = [...rows];

      for (const item of itemsToUpsert) {
        const index = updatedRows.findIndex(r => r.id === item.id);
        const itemRecord = {
          created_at: index >= 0 ? updatedRows[index].created_at : new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item,
        };

        if (index >= 0) {
          updatedRows[index] = { ...updatedRows[index], ...itemRecord };
        } else {
          updatedRows.unshift(itemRecord);
        }
      }

      writeTable(this.tableName, updatedRows);
      return {
        data: this.isSingle ? itemsToUpsert[0] : itemsToUpsert,
        error: null,
      };
    }

    // 3. UPDATE
    if (this.action === 'update') {
      let matchedCount = 0;
      const updatedRows = rows.map(item => {
        const matches = this.filters.every(fn => fn(item));
        if (matches) {
          matchedCount++;
          return {
            ...item,
            ...this.mutateData,
            updated_at: new Date().toISOString(),
          };
        }
        return item;
      });

      writeTable(this.tableName, updatedRows);
      return {
        data: this.mutateData,
        error: null,
        count: matchedCount,
      };
    }

    // 4. DELETE
    if (this.action === 'delete') {
      const remainingRows = rows.filter(item => !this.filters.every(fn => fn(item)));
      writeTable(this.tableName, remainingRows);
      return {
        data: null,
        error: null,
      };
    }

    // 5. SELECT
    let result = rows.filter(item => this.filters.every(fn => fn(item)));

    // Order
    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.orderAsc;
      result.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (typeof valA === 'string' && typeof valB === 'string') {
          return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return asc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
    }

    // Limit
    if (this.limitCount !== null && this.limitCount >= 0) {
      result = result.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      return {
        data: result[0] || null,
        error: result.length === 0 ? { message: 'Row not found' } : null,
      };
    }

    if (this.isMaybeSingle) {
      return {
        data: result[0] || null,
        error: null,
      };
    }

    return {
      data: result,
      error: null,
      count: result.length,
    };
  }

  // Support thenable / async await
  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/**
 * Local Storage Mock
 */
const localStorageClient = {
  from(bucket: string) {
    return {
      async upload(filePath: string, fileData: any, options?: any) {
        return { data: { path: filePath }, error: null };
      },
      getPublicUrl(filePath: string) {
        return {
          data: { publicUrl: `/local-storage/${bucket}/${filePath}` },
        };
      },
      async list() {
        return { data: [], error: null };
      },
    };
  },
};

/**
 * Standalone Local Database Client
 */
export const localDbClient = {
  from(tableName: string) {
    return new LocalQueryBuilder(tableName);
  },
  storage: localStorageClient,
  auth: {
    admin: {
      async listUsers() {
        const users = readTable('users');
        return { data: { users }, error: null };
      },
    },
  },
};
