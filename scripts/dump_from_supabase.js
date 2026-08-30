const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local
const envFile = path.resolve(__dirname, '../.env.local');
const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf-8') : '';
const envMap = {};
env.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envMap[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = envMap.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envMap.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase credentials not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const LOCAL_DB_DIR = 'C:\\Jenna\\Antigravity\\Runninghub Api\\Boutiqaat Local Database';
const TABLES_DIR = path.join(LOCAL_DB_DIR, 'tables');
const STORAGE_DIR = path.join(LOCAL_DB_DIR, 'storage');
const BACKUPS_DIR = path.join(LOCAL_DB_DIR, 'backups');
const SCHEMAS_DIR = path.join(LOCAL_DB_DIR, 'schemas');

// Ensure directories exist
[LOCAL_DB_DIR, TABLES_DIR, STORAGE_DIR, BACKUPS_DIR, SCHEMAS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const TABLE_NAMES = [
  'users',
  'tasks',
  'bundling_sessions',
  'layers_projects',
  'retouch_sessions',
  'quick_create_sessions',
  'image_agent_sessions'
];

async function dumpTable(tableName) {
  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      console.warn(`[WARN] Table ${tableName} query notice:`, error.message);
      return [];
    }
    const targetFile = path.join(TABLES_DIR, `${tableName}.json`);
    fs.writeFileSync(targetFile, JSON.stringify(data || [], null, 2), 'utf-8');
    console.log(`✓ Saved ${tableName}: ${(data || []).length} rows -> ${targetFile}`);
    return data || [];
  } catch (err) {
    console.error(`[ERROR] dumping ${tableName}:`, err.message);
    return [];
  }
}

async function main() {
  console.log(`=== SYNCING SUPABASE DATA TO LOCAL DRIVE ===`);
  console.log(`Target Directory: ${LOCAL_DB_DIR}\n`);

  const summary = {};
  for (const table of TABLE_NAMES) {
    const rows = await dumpTable(table);
    summary[table] = rows.length;
  }

  // Copy app_controls, team_settings, and active studio project stores
  const localDataDir = path.resolve(__dirname, '../.data');
  if (fs.existsSync(localDataDir)) {
    const files = fs.readdirSync(localDataDir);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        fs.copyFileSync(path.join(localDataDir, file), path.join(TABLES_DIR, file));
        console.log(`✓ Copied local store: ${file}`);
      }
    });
  }

  const localTeamSettings = path.resolve(__dirname, '../data/team-settings.json');
  if (fs.existsSync(localTeamSettings)) {
    fs.copyFileSync(localTeamSettings, path.join(TABLES_DIR, 'team_settings.json'));
    console.log('✓ Copied team_settings.json');
  }

  // Copy Supabase SQL schemas and migrations
  const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
  const schemaFile = path.resolve(__dirname, '../supabase/schema.sql');
  if (fs.existsSync(schemaFile)) {
    fs.copyFileSync(schemaFile, path.join(SCHEMAS_DIR, '000_core_schema.sql'));
  }
  if (fs.existsSync(migrationsDir)) {
    const migFiles = fs.readdirSync(migrationsDir);
    migFiles.forEach(f => {
      if (f.endsWith('.sql')) {
        fs.copyFileSync(path.join(migrationsDir, f), path.join(SCHEMAS_DIR, f));
      }
    });
    console.log(`✓ Copied ${migFiles.length} SQL schema migrations to schemas/`);
  }

  // Create timestamped backup snapshot
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupZipName = `backup_${timestamp}.json`;
  const backupFile = path.join(BACKUPS_DIR, backupZipName);
  
  const allData = {};
  const allJsonFiles = fs.readdirSync(TABLES_DIR).filter(f => f.endsWith('.json'));
  for (const f of allJsonFiles) {
    const filePath = path.join(TABLES_DIR, f);
    allData[f.replace('.json', '')] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  fs.writeFileSync(backupFile, JSON.stringify(allData, null, 2), 'utf-8');
  console.log(`\n✓ Created snapshot backup: ${backupFile}`);

  console.log('\n=== LOCAL DATABASE SYNC SUMMARY ===');
  console.table(summary);
}

main();
