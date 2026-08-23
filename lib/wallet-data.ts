import fs from 'fs';
import path from 'path';

export interface WalletDeposit {
  id: string;
  amountUsd: number;
  date: string;
  note: string;
  source: 'RunningHub Base Plan' | 'Manual Top-Up' | 'Enterprise Refill';
  createdAt: string;
}

export interface WalletConfig {
  initialDepositUsd: number;
  lowBalanceThresholdUsd: number;
  criticalThresholdUsd: number;
  topUps: WalletDeposit[];
}

const DATA_FILE = path.join(process.cwd(), 'data', 'wallet-config.json');

const DEFAULT_CONFIG: WalletConfig = {
  initialDepositUsd: 500.0,
  lowBalanceThresholdUsd: 100.0,
  criticalThresholdUsd: 30.0,
  topUps: [
    {
      id: 'dep_init_001',
      amountUsd: 500.0,
      date: '2026-08-01',
      note: 'Initial RunningHub Enterprise Studio Wallet Deposit',
      source: 'RunningHub Base Plan',
      createdAt: '2026-08-01T00:00:00Z',
    },
  ],
};

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  }
}

export function getWalletConfig(): WalletConfig {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (err) {
    return DEFAULT_CONFIG;
  }
}

export function addWalletDeposit(deposit: Omit<WalletDeposit, 'id' | 'createdAt'>): WalletDeposit {
  const config = getWalletConfig();
  const newDeposit: WalletDeposit = {
    ...deposit,
    id: `dep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  config.topUps.unshift(newDeposit);
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(config, null, 2), 'utf-8');
  return newDeposit;
}

export function updateWalletConfig(updates: Partial<Pick<WalletConfig, 'initialDepositUsd' | 'lowBalanceThresholdUsd' | 'criticalThresholdUsd'>>): WalletConfig {
  const config = getWalletConfig();
  const updated: WalletConfig = {
    ...config,
    ...updates,
  };
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}
