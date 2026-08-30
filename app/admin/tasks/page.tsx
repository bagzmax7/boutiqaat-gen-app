'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import {
  RefreshCw, Loader2,
  X, Copy, Eye, EyeOff, Check,
  ExternalLink, Zap, DollarSign, Timer, Settings2,
  Users, BarChart3, UserCheck, Filter, FileSpreadsheet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { exportUsersSummaryExcel, exportTasksDetailedExcel } from '@/lib/excel-export';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface BillingRecord {
  taskId: string;
  dbId: string;
  taskName: string;
  taskStatus: string;
  taskStartTime: string;
  userAccount: string;
  userEmail: string;
  userId: string;
  outputs: any[];
  apiKeyType: string;
  apiKeyMasked: string;
  apiKeyFull: string;
  duration: number;      // seconds
  coins: number;         // RH Coins (integer)
  amount: number;        // Final Amount in USD
  thirdParty: number;    // 3rd party USD
  hasBilling: boolean;
  nodeInfoList: any[];
}

interface BillingStats {
  total: number;
  successCount: number;
  failedCount: number;
  runningCount: number;
  queuedCount: number;
  missingBillingCount: number;
  totalDuration: number;  // seconds
  totalCoins: number;
  totalAmount: number;    // USD
  totalThirdParty: number;
}

interface UserSummary {
  userId: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  totalTasks: number;
  successCount: number;
  failedCount: number;
  runningCount: number;
  queuedCount: number;
  totalCoins: number;
  totalAmount: number;
  totalDuration: number;
  lastActive: string | null;
  topApp: string;
  successRate: number;
}

interface UserKPIs {
  totalUsers: number;
  activeUsersCount: number;
  teamTotalTasks: number;
  teamTotalSpend: number;
  teamTotalCoins: number;
  teamTotalDuration: number;
  topSpenderName: string;
  topSpenderAmount: number;
}

// ─── Utility Functions ──────────────────────────────────────────────────────────

/** Format duration as MM:SS or HH:MM:SS */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/** Format total duration as HH:MM:SS */
function formatTotalDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Format datetime: YYYY-MM-DD HH:MM:SS */
function formatDateTime(isoString: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  } catch { return isoString; }
}

/** Format Final Amount with precision */
function formatFinalAmount(n: number): string {
  if (!n || n === 0) return '0';
  if (n < 0.001) return n.toFixed(6);
  if (n < 0.01) return n.toFixed(4);
  if (n < 1) return n.toFixed(3);
  return n.toFixed(2);
}

// ─── Status Badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase();
  if (s === 'SUCCESS') return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" /> Success
    </span>
  );
  if (s === 'FAILED') return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-400">
      <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" /> Failed
    </span>
  );
  if (s === 'RUNNING') return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-400">
      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" /> Running
    </span>
  );
  if (s === 'QUEUED') return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" /> Queued
    </span>
  );
  if (s === 'CANCELED') return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
      <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" /> Canceled
    </span>
  );
  return <span className="text-[11px] text-gray-500">{status || '—'}</span>;
}

// ─── Custom Columns Modal ──────────────────────────────────────────────────────
const ALL_COLS = [
  { id: 'taskId', label: 'Task ID', locked: true },
  { id: 'startTime', label: 'Start Time' },
  { id: 'taskName', label: 'Task Name' },
  { id: 'status', label: 'Status' },
  { id: 'duration', label: 'Duration' },
  { id: 'coins', label: 'RH Coin' },
  { id: 'amount', label: 'Final Amount($)' },
  { id: 'source', label: 'Source' },
  { id: 'callMethod', label: 'Call Method' },
  { id: 'account', label: 'Account / User' },
  { id: 'apiKey', label: 'API Key Info' },
  { id: 'keyType', label: 'Key Type' },
  { id: 'discountRate', label: 'Discount Rate' },
  { id: 'savedAmount', label: 'Saved Amount($)' },
  { id: 'mode', label: 'Mode' },
];

function CustomColumnsModal({ visible, visibleCols, onClose, onChange }: {
  visible: boolean; visibleCols: string[]; onClose: () => void; onChange: (c: string[]) => void;
}) {
  if (!visible) return null;
  const toggle = (id: string) => {
    if (visibleCols.includes(id)) onChange(visibleCols.filter(c => c !== id));
    else onChange([...visibleCols, id]);
  };
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[#111316] border border-[#22252e] rounded-2xl shadow-2xl w-80 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Custom Columns</h3>
          <button onClick={onClose} className="text-[#606575] hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {ALL_COLS.map(col => (
            <label key={col.id} className={cn('flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer select-none transition-colors', col.locked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#181b21]')}>
              <input
                type="checkbox"
                checked={visibleCols.includes(col.id)}
                disabled={col.locked}
                onChange={() => !col.locked && toggle(col.id)}
                className="w-4 h-4 rounded accent-emerald-400"
              />
              <span className="text-sm text-[#a0a5b5]">{col.label}</span>
              {col.locked && <span className="ml-auto text-[10px] text-[#606575]">default</span>}
            </label>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-4 bg-emerald-500 text-[#0a0b0d] font-bold text-sm py-2 rounded-lg hover:bg-emerald-400 transition-colors">Apply</button>
      </div>
    </>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────
export default function AdminBillingPage() {
  // Navigation sub-tab: 'tasks' (Tasks & Billing) | 'users' (User Activity & Analytics)
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'users'>('tasks');

  // Tasks state
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [keyTypeFilter, setKeyTypeFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingBills, setSyncingBills] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BillingRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [colsModalOpen, setColsModalOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState([
    'taskId', 'startTime', 'taskName', 'account', 'status', 'duration', 'coins', 'amount', 'keyType'
  ]);

  // Users summary state
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
  const [userKPIs, setUserKPIs] = useState<UserKPIs | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [registeredUsersList, setRegisteredUsersList] = useState<{ id: string; name: string; email: string }[]>([]);

  // Default date range: 30 days
  const defaultDates = () => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  };
  const initDates = defaultDates();
  const [dateFrom, setDateFrom] = useState(initDates.from);
  const [dateTo, setDateTo] = useState(initDates.to);
  const PAGE_SIZE = 20;

  // 1. Fetch Task records
  const fetchTasks = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = new URLSearchParams({ 
        from: dateFrom, 
        to: dateTo, 
        status: statusFilter,
        keyType: keyTypeFilter,
        userId: userFilter,
      });
      const res = await fetch(`/api/admin/tasks/rh-billing?${params}`);
      const data = await res.json();
      setRecords(data.records || []);
      setStats(data.stats || null);
    } catch {
      toast.error('Failed to load billing tasks.');
      setRecords([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [dateFrom, dateTo, statusFilter, keyTypeFilter, userFilter]);

  // 2. Fetch User Summaries & KPIs
  const fetchUserSummaries = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      const res = await fetch(`/api/admin/tasks/users-summary?${params}`);
      const data = await res.json();
      setUserSummaries(data.users || []);
      setUserKPIs(data.kpis || null);
    } catch {
      toast.error('Failed to load team analytics.');
    } finally {
      setLoadingUsers(false);
    }
  }, [dateFrom, dateTo]);

  // 3. Load registered users for dropdown
  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(d => setRegisteredUsersList(d.users || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeSubTab === 'tasks') {
      fetchTasks();
    } else {
      fetchUserSummaries();
    }
  }, [activeSubTab, fetchTasks, fetchUserSummaries]);

  // Auto refresh every 30s
  useEffect(() => {
    const iv = setInterval(() => {
      if (activeSubTab === 'tasks') fetchTasks(true);
      else fetchUserSummaries();
    }, 30000);
    return () => clearInterval(iv);
  }, [activeSubTab, fetchTasks, fetchUserSummaries]);

  const handleSync = async (days = 90) => {
    setSyncingBills(true);
    const toastId = toast.loading(`Syncing billing data (last ${days} days)...`);
    try {
      const res = await fetch('/api/admin/tasks/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Synced ${data.syncedCount}/${data.totalTargeted} tasks`, { id: toastId, duration: 5000 });
        fetchTasks();
        fetchUserSummaries();
      } else {
        toast.error('Sync failed: ' + (data.error || 'Unknown'), { id: toastId });
      }
    } catch (err: any) {
      toast.error('Sync error: ' + err.message, { id: toastId });
    } finally { setSyncingBills(false); }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSearch = () => { setPage(1); fetchTasks(); };

  // Jump from User table directly to filtered task stream
  const handleDrilldownUser = (userId: string) => {
    setUserFilter(userId);
    setPage(1);
    setActiveSubTab('tasks');
    toast.success('Filtered tasks by user');
  };

  // Filter tasks by keyword (client-side)
  const filteredRecords = records.filter(r => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return r.taskId.includes(kw) || 
           r.taskName.toLowerCase().includes(kw) || 
           r.userAccount.toLowerCase().includes(kw) ||
           r.userEmail.toLowerCase().includes(kw);
  });
  const pageCount = Math.ceil(filteredRecords.length / PAGE_SIZE);
  const pagedRecords = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Filter user summaries by search (client-side)
  const filteredUserSummaries = userSummaries.filter(u => {
    if (!userSearch) return true;
    const kw = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(kw) || 
           u.email.toLowerCase().includes(kw) || 
           u.role.toLowerCase().includes(kw) ||
           u.topApp.toLowerCase().includes(kw);
  });

  return (
    <div className="flex h-screen bg-[#0d0e11] text-[#a0a5b5] font-sans overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Page Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Console & Team Monitor
              </h1>
              <p className="text-xs text-[#606575] mt-0.5">
                Monitor team tasks execution, billing breakdown, and individual user activity across 50–100+ team accounts.
              </p>
            </div>
            {/* Quick date range switcher buttons */}
            <div className="flex items-center gap-2 bg-[#111316] border border-[#22252e] p-1 rounded-xl text-xs">
              {[
                { label: '7D', days: 7 },
                { label: '14D', days: 14 },
                { label: '30D', days: 30 },
                { label: '90D', days: 90 },
                { label: '365D', days: 365 },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => {
                    const to = new Date();
                    const from = new Date();
                    from.setDate(from.getDate() - item.days);
                    setDateFrom(from.toISOString().slice(0, 10));
                    setDateTo(to.toISOString().slice(0, 10));
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:text-white hover:bg-[#181b21] transition-all text-[#a0a5b5]"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 border-b border-[#22252e]">
            <a href="/admin" className="px-5 py-2.5 text-sm text-[#606575] hover:text-white transition-colors border-b-2 border-transparent">Dashboard</a>
            <button
              onClick={() => setActiveSubTab('tasks')}
              className={cn(
                'px-5 py-2.5 text-sm font-semibold transition-all border-b-2 flex items-center gap-2',
                activeSubTab === 'tasks' ? 'text-white border-emerald-400' : 'text-[#606575] hover:text-white border-transparent'
              )}
            >
              <Zap className="w-3.5 h-3.5" /> Tasks & Billing
            </button>
            <button
              onClick={() => setActiveSubTab('users')}
              className={cn(
                'px-5 py-2.5 text-sm font-semibold transition-all border-b-2 flex items-center gap-2',
                activeSubTab === 'users' ? 'text-white border-emerald-400' : 'text-[#606575] hover:text-white border-transparent'
              )}
            >
              <Users className="w-3.5 h-3.5" /> User Activity & Analytics
            </button>
            <a href="/admin/users" className="px-5 py-2.5 text-sm text-[#606575] hover:text-white transition-colors border-b-2 border-transparent">User Accounts</a>
          </div>

          {/* Date Range Section */}
          <div className="bg-[#111316] border border-[#22252e] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Date Range Filter</span>
                <span className="text-[11px] text-[#606575]">• Querying active tasks within selected timeframe</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date" value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="bg-[#181b21] border border-[#2a2d35] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all"
                />
                <span className="text-xs text-[#606575]">to</span>
                <input
                  type="date" value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="bg-[#181b21] border border-[#2a2d35] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: TASKS & BILLING STREAM                                       */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeSubTab === 'tasks' && (
            <div className="bg-[#111316] border border-[#22252e] rounded-xl overflow-hidden animate-fade-in">
              {/* Section Header & Filters */}
              <div className="px-5 pt-5 pb-3 border-b border-[#22252e]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-white">Task & Billing Details</h2>
                  {userFilter && (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-lg text-xs">
                      <span>Filtering by User ID: <strong className="font-mono">{userFilter.slice(0, 8)}...</strong></span>
                      <button onClick={() => setUserFilter('')} className="hover:text-white"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>

                {/* Filter Row */}
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by Task ID, Name, or User Email..."
                    className="bg-[#0d0e11] border border-[#2a2d35] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#606575] focus:outline-none focus:border-emerald-500 transition-all w-64"
                  />

                  {/* Filter by User Dropdown */}
                  <select
                    value={userFilter}
                    onChange={e => { setUserFilter(e.target.value); setPage(1); }}
                    className="bg-[#0d0e11] border border-[#2a2d35] rounded-lg px-3 py-1.5 text-xs text-[#a0a5b5] focus:outline-none focus:border-emerald-500 transition-all max-w-[200px]"
                  >
                    <option value="">All Team Members</option>
                    {registeredUsersList.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>

                  {/* Key Filter */}
                  <select
                    value={keyTypeFilter}
                    onChange={e => { setKeyTypeFilter(e.target.value); setPage(1); }}
                    className="bg-[#0d0e11] border border-[#2a2d35] rounded-lg px-3 py-1.5 text-xs text-[#a0a5b5] focus:outline-none focus:border-emerald-500 transition-all"
                  >
                    <option value="">All Keys</option>
                    <option value="enterprise">1c81****e474 (Enterprise)</option>
                    <option value="consumer">c24e****6772 (Consumer)</option>
                  </select>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    className="bg-[#0d0e11] border border-[#2a2d35] rounded-lg px-3 py-1.5 text-xs text-[#606575] focus:outline-none focus:border-emerald-500 transition-all"
                  >
                    <option value="">All Status</option>
                    <option value="SUCCESS">Success</option>
                    <option value="FAILED">Failed</option>
                    <option value="RUNNING">Running</option>
                    <option value="QUEUED">Queued</option>
                    <option value="CANCELED">Canceled</option>
                  </select>

                  <button
                    onClick={handleSearch}
                    className="bg-[#c5f135] text-black font-bold text-xs px-6 py-1.5 rounded-lg hover:bg-[#d4ff3d] transition-colors"
                  >
                    Search
                  </button>

                  {/* Export Excel Button */}
                  <button
                    onClick={() => {
                      exportTasksDetailedExcel(filteredRecords, { from: dateFrom, to: dateTo });
                      toast.success('Tasks report exported to Excel!');
                    }}
                    className="flex items-center gap-1.5 border border-emerald-500/40 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-4 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-all"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Export Excel
                  </button>
                </div>
              </div>

              {/* Summary Bar */}
              <div className="px-5 py-3 flex items-center justify-between border-b border-[#22252e]">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#a0a5b5]">
                  <span className="font-semibold text-white">Total {stats?.total ?? 0} records</span>
                  <span>Billing duration <strong className="text-white">{formatTotalDuration(stats?.totalDuration ?? 0)}</strong></span>
                  <span>RH Coins <strong className="text-white">{Math.round(stats?.totalCoins ?? 0)}</strong></span>
                  <span>Wallet Amount <strong className="text-emerald-400">${(stats?.totalAmount ?? 0).toFixed(3)}</strong></span>
                  {(stats?.missingBillingCount ?? 0) > 0 && (
                    <button
                      onClick={() => handleSync(90)}
                      className="text-amber-400 hover:text-amber-300 text-[11px] font-semibold transition-colors"
                    >
                      ⚠ {stats?.missingBillingCount} tasks need billing sync
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative group">
                    <button
                      onClick={() => handleSync(90)}
                      disabled={syncingBills}
                      className="flex items-center gap-1.5 border border-[#2a2d35] text-xs font-semibold text-[#a0a5b5] bg-[#0d0e11] px-3 py-1.5 rounded-lg hover:text-white transition-all disabled:opacity-50"
                    >
                      {syncingBills ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Sync Bills
                    </button>
                    <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 bg-[#111316] border border-[#22252e] rounded-xl shadow-xl overflow-hidden min-w-[150px]">
                      {[30, 90, 180, 365].map(d => (
                        <button key={d} onClick={() => handleSync(d)} className={cn('w-full px-4 py-2.5 text-xs text-left text-[#a0a5b5] hover:bg-[#181b21] hover:text-white transition-colors', d === 365 && 'text-amber-400')}>
                          Sync last {d} days
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setColsModalOpen(true)}
                    className="flex items-center gap-1.5 border border-[#2a2d35] text-xs font-semibold text-[#a0a5b5] bg-[#0d0e11] px-3 py-1.5 rounded-lg hover:text-white transition-all"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Custom Columns
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
                    <p className="text-xs text-[#606575]">Loading billing records...</p>
                  </div>
                ) : pagedRecords.length === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-2">
                    <p className="text-sm text-[#606575]">No records found</p>
                    <p className="text-xs text-[#606575]/60">Try expanding the date range or clearing user filters</p>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-[#0d0e11]">
                        <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Task ID</th>
                        {visibleCols.includes('startTime') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Start Time</th>}
                        {visibleCols.includes('taskName') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Task Name</th>}
                        {visibleCols.includes('account') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Assigned User</th>}
                        {visibleCols.includes('source') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Source</th>}
                        {visibleCols.includes('callMethod') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Call Method</th>}
                        {visibleCols.includes('apiKey') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">API Key Info</th>}
                        {visibleCols.includes('keyType') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Key Type</th>}
                        {visibleCols.includes('status') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Status</th>}
                        {visibleCols.includes('duration') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Duration</th>}
                        {visibleCols.includes('coins') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">RH Coin</th>}
                        {visibleCols.includes('discountRate') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Discount Rate</th>}
                        {visibleCols.includes('savedAmount') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Saved Amount($)</th>}
                        {visibleCols.includes('amount') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Final Amount($)</th>}
                        {visibleCols.includes('mode') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Mode</th>}
                        <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#181b21]">
                      {pagedRecords.map((r, idx) => (
                        <tr
                          key={`${r.taskId}-${idx}`}
                          onClick={() => setSelectedRecord(r)}
                          className="hover:bg-[#181b21]/50 cursor-pointer transition-colors"
                        >
                          {/* Task ID */}
                          <td className="px-4 py-3 text-xs font-mono align-middle whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <span className="text-white truncate max-w-[140px]" title={r.taskId}>{r.taskId}</span>
                              <button
                                onClick={e => { e.stopPropagation(); handleCopy(r.taskId, r.taskId); toast.success('Copied!'); }}
                                className="text-[#606575] hover:text-emerald-400 transition-colors shrink-0"
                              >
                                {copiedId === r.taskId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </span>
                          </td>
                          {visibleCols.includes('startTime') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#a0a5b5]">{formatDateTime(r.taskStartTime)}</td>}
                          {visibleCols.includes('taskName') && (
                            <td className="px-4 py-3 text-xs align-middle max-w-[200px]">
                              <button
                                onClick={e => { e.stopPropagation(); setSelectedRecord(r); }}
                                className="text-[#60a5fa] hover:underline text-left truncate block max-w-[200px]"
                                title={r.taskName}
                              >
                                {r.taskName || '—'}
                              </button>
                            </td>
                          )}
                          {/* User Account / Identity */}
                          {visibleCols.includes('account') && (
                            <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="text-white font-medium truncate max-w-[150px]">{r.userAccount}</span>
                                {r.userEmail && <span className="text-[10px] text-[#606575] truncate max-w-[150px]">{r.userEmail}</span>}
                              </div>
                            </td>
                          )}
                          {visibleCols.includes('source') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#a0a5b5]">AI App API</td>}
                          {visibleCols.includes('callMethod') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap"><span className="text-[#a0a5b5]">API</span></td>}
                          {visibleCols.includes('apiKey') && <td className="px-4 py-3 text-xs font-mono align-middle whitespace-nowrap text-[#606575]">{r.apiKeyMasked}</td>}
                          {visibleCols.includes('keyType') && (
                            <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#a0a5b5]">
                              {r.apiKeyType === 'consumer' ? 'Consumer-Normal' : 'Enterprise-Shared'}
                            </td>
                          )}
                          {visibleCols.includes('status') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap"><StatusBadge status={r.taskStatus} /></td>}
                          {visibleCols.includes('duration') && (
                            <td className="px-4 py-3 text-xs font-mono align-middle whitespace-nowrap text-white">
                              {r.duration > 0 ? formatDuration(r.duration) : '—'}
                            </td>
                          )}
                          {visibleCols.includes('coins') && (
                            <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-white">
                              {r.coins > 0 ? Math.round(r.coins) : '0'}
                            </td>
                          )}
                          {visibleCols.includes('discountRate') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#606575]">—</td>}
                          {visibleCols.includes('savedAmount') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#606575]">—</td>}
                          {visibleCols.includes('amount') && (
                            <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                              {r.amount > 0
                                ? <span className="text-white font-mono">{formatFinalAmount(r.amount)}</span>
                                : r.taskStatus?.toUpperCase() === 'SUCCESS'
                                  ? <span className="text-amber-500/80 text-[10px]">⚠ sync</span>
                                  : <span className="text-white font-mono">0</span>
                              }
                            </td>
                          )}
                          {visibleCols.includes('mode') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#a0a5b5]">Standard</td>}
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                            {r.taskStatus?.toUpperCase() === 'SUCCESS' ? (
                              <button
                                onClick={e => { e.stopPropagation(); setSelectedRecord(r); }}
                                className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                              >
                                View Details
                              </button>
                            ) : <span className="text-[#606575]">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-[#22252e]">
                <div className="flex items-center gap-1 text-xs text-[#606575]">
                  <span>Showing {pagedRecords.length} of {filteredRecords.length} records</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-xs border border-[#22252e] text-[#606575] hover:text-white disabled:opacity-30 rounded-lg transition-all"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={cn(
                        'w-8 h-8 text-xs rounded-lg font-semibold transition-all',
                        page === n ? 'bg-emerald-500 text-black' : 'text-[#606575] hover:text-white hover:bg-[#181b21]'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                    disabled={page >= pageCount}
                    className="px-3 py-1 text-xs border border-[#22252e] text-[#606575] hover:text-white disabled:opacity-30 rounded-lg transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: USER ACTIVITY & TEAM PERFORMANCE MONITOR                    */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeSubTab === 'users' && (
            <div className="space-y-4 animate-fade-in">
              {/* Executive KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#111316] border border-[#22252e] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#606575] font-semibold uppercase tracking-wider">Active Members</p>
                    <h3 className="text-2xl font-bold text-white mt-1">
                      {userKPIs?.activeUsersCount ?? 0} <span className="text-xs font-normal text-[#606575]">/ {userKPIs?.totalUsers ?? 0} registered</span>
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <UserCheck className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#111316] border border-[#22252e] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#606575] font-semibold uppercase tracking-wider">Total Tasks Run</p>
                    <h3 className="text-2xl font-bold text-white mt-1">
                      {userKPIs?.teamTotalTasks ?? 0}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#111316] border border-[#22252e] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#606575] font-semibold uppercase tracking-wider">Total Team Spend</p>
                    <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                      ${(userKPIs?.teamTotalSpend ?? 0).toFixed(3)}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#111316] border border-[#22252e] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#606575] font-semibold uppercase tracking-wider">Total Render Time</p>
                    <h3 className="text-2xl font-bold text-white mt-1 font-mono">
                      {formatTotalDuration(userKPIs?.teamTotalDuration ?? 0)}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Timer className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* User Performance Table */}
              <div className="bg-[#111316] border border-[#22252e] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#22252e] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">Team Member Usage & Billing Summary</h3>
                    <p className="text-xs text-[#606575] mt-0.5">Click "View Tasks" on any member to drilldown into their individual generation logs.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      placeholder="Search member name or email..."
                      className="bg-[#0d0e11] border border-[#2a2d35] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#606575] focus:outline-none focus:border-emerald-500 transition-all w-60"
                    />
                    <button
                      onClick={() => {
                        exportUsersSummaryExcel(filteredUserSummaries, { from: dateFrom, to: dateTo });
                        toast.success('User summary exported to Excel!');
                      }}
                      className="flex items-center gap-1.5 border border-emerald-500/40 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-4 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-all"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Export Excel Report
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {loadingUsers ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
                      <p className="text-xs text-[#606575]">Aggregating user performance...</p>
                    </div>
                  ) : filteredUserSummaries.length === 0 ? (
                    <div className="text-center py-16 text-[#606575] text-xs">
                      No team members found matching your search.
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-[#0d0e11]">
                          <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e]">Team Member</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e]">Role</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e]">Total Tasks</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e]">Success Rate</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e]">RH Coins</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e]">Total Spend</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e]">Render Duration</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e]">Top Feature</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e]">Last Active</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#181b21]">
                        {filteredUserSummaries.map((u) => (
                          <tr key={u.userId} className="hover:bg-[#181b21]/50 transition-colors">
                            {/* User Avatar + Name + Email */}
                            <td className="px-4 py-3 text-xs">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-white text-xs shrink-0">
                                  {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-white font-semibold truncate max-w-[160px]">{u.name}</p>
                                  <p className="text-[10px] text-[#606575] truncate max-w-[160px]">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            {/* Role */}
                            <td className="px-4 py-3 text-xs whitespace-nowrap">
                              <span className={cn(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider',
                                u.role === 'admin'
                                  ? 'text-accent-gold bg-accent-gold/10 border-accent-gold/25'
                                  : u.role === 'manager'
                                    ? 'text-accent-blue bg-accent-blue/10 border-accent-blue/25'
                                    : 'text-accent-purple bg-accent-purple/10 border-accent-purple/25'
                              )}>
                                {u.role}
                              </span>
                            </td>
                            {/* Total Tasks */}
                            <td className="px-4 py-3 text-xs whitespace-nowrap text-white font-semibold">
                              {u.totalTasks}
                              <span className="text-[10px] text-[#606575] font-normal ml-1">({u.successCount} OK, {u.failedCount} Fail)</span>
                            </td>
                            {/* Success Rate Bar */}
                            <td className="px-4 py-3 text-xs whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-[#181b21] rounded-full overflow-hidden">
                                  <div
                                    className={cn('h-full rounded-full', u.successRate > 80 ? 'bg-emerald-400' : u.successRate > 50 ? 'bg-amber-400' : 'bg-red-400')}
                                    style={{ width: `${u.successRate}%` }}
                                  />
                                </div>
                                <span className="font-mono text-white text-[11px]">{u.successRate}%</span>
                              </div>
                            </td>
                            {/* RH Coins */}
                            <td className="px-4 py-3 text-xs font-mono text-white whitespace-nowrap">
                              {Math.round(u.totalCoins)}
                            </td>
                            {/* Total Spend */}
                            <td className="px-4 py-3 text-xs whitespace-nowrap">
                              <span className="text-emerald-400 font-bold font-mono">
                                ${u.totalAmount.toFixed(3)}
                              </span>
                            </td>
                            {/* Render Duration */}
                            <td className="px-4 py-3 text-xs font-mono text-white whitespace-nowrap">
                              {formatTotalDuration(u.totalDuration)}
                            </td>
                            {/* Top Feature */}
                            <td className="px-4 py-3 text-xs whitespace-nowrap text-[#a0a5b5]">
                              <span className="bg-[#181b21] border border-[#2a2d35] px-2 py-0.5 rounded text-[11px] text-white">
                                {u.topApp}
                              </span>
                            </td>
                            {/* Last Active */}
                            <td className="px-4 py-3 text-xs whitespace-nowrap text-[#606575]">
                              {u.lastActive ? new Date(u.lastActive).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                            </td>
                            {/* Action */}
                            <td className="px-4 py-3 text-xs whitespace-nowrap text-right">
                              <button
                                onClick={() => handleDrilldownUser(u.userId)}
                                className="bg-[#181b21] hover:bg-[#22252e] text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                              >
                                View Tasks →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Custom Columns Modal */}
      <CustomColumnsModal
        visible={colsModalOpen}
        visibleCols={visibleCols}
        onClose={() => setColsModalOpen(false)}
        onChange={setVisibleCols}
      />

      {/* Task Detail Drawer */}
      {selectedRecord && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setSelectedRecord(null)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-[420px] bg-[#0d0e11] border-l border-[#22252e] z-50 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#22252e]">
              <button onClick={() => setSelectedRecord(null)} className="text-[#606575] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-bold text-white">Task Details</h2>
              <StatusBadge status={selectedRecord.taskStatus} />
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Task Header */}
              <div className="bg-[#111316] border border-[#22252e] rounded-xl p-4">
                <button className="text-[#60a5fa] text-sm font-semibold hover:underline text-left">{selectedRecord.taskName}</button>
                <p className="text-[11px] font-mono text-[#606575] mt-1">{selectedRecord.taskId}</p>
              </div>

              {/* Billing Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#111316] border border-[#22252e] rounded-xl p-3 text-center">
                  <p className="text-[10px] text-[#606575] uppercase tracking-wide">Duration</p>
                  <p className="text-sm font-bold text-white mt-1 font-mono">{formatDuration(selectedRecord.duration)}</p>
                </div>
                <div className="bg-[#111316] border border-[#22252e] rounded-xl p-3 text-center">
                  <p className="text-[10px] text-[#606575] uppercase tracking-wide">RH Coin</p>
                  <p className="text-sm font-bold text-white mt-1">{selectedRecord.coins > 0 ? Math.round(selectedRecord.coins) : '0'}</p>
                </div>
                <div className="bg-[#111316] border border-[#22252e] rounded-xl p-3 text-center">
                  <p className="text-[10px] text-[#606575] uppercase tracking-wide">Final Amount</p>
                  <p className="text-sm font-bold text-emerald-400 mt-1">{selectedRecord.amount > 0 ? `$${formatFinalAmount(selectedRecord.amount)}` : '$0'}</p>
                </div>
              </div>

              {/* User Identity Info */}
              <div>
                <h4 className="text-[11px] font-bold text-[#606575] uppercase tracking-widest mb-2">User Attribution</h4>
                <div className="bg-[#111316] border border-[#22252e] rounded-xl divide-y divide-[#22252e] text-xs">
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-[#606575] font-medium">Assigned User</span>
                    <span className="text-white font-semibold">{selectedRecord.userAccount}</span>
                  </div>
                  {selectedRecord.userEmail && (
                    <div className="flex justify-between items-center px-4 py-3">
                      <span className="text-[#606575] font-medium">Email</span>
                      <span className="text-white font-mono text-[11px]">{selectedRecord.userEmail}</span>
                    </div>
                  )}
                  {selectedRecord.userId && (
                    <div className="flex justify-between items-center px-4 py-3">
                      <span className="text-[#606575] font-medium">User ID</span>
                      <span className="text-[#a0a5b5] font-mono text-[10px] truncate max-w-[200px]">{selectedRecord.userId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Basic Info */}
              <div>
                <h4 className="text-[11px] font-bold text-[#606575] uppercase tracking-widest mb-2">Task Parameters</h4>
                <div className="bg-[#111316] border border-[#22252e] rounded-xl divide-y divide-[#22252e] text-xs">
                  {[
                    ['Task ID', selectedRecord.taskId],
                    ['Start Time', formatDateTime(selectedRecord.taskStartTime)],
                    ['Task Name', selectedRecord.taskName || '—'],
                    ['Source', 'AI App API'],
                    ['Call Method', 'API'],
                    ['Key Type', selectedRecord.apiKeyType === 'consumer' ? 'Consumer-Normal' : 'Enterprise-Shared'],
                    ['Mode', 'Standard'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center px-4 py-3 gap-4">
                      <span className="text-[#606575] font-medium shrink-0">{k}</span>
                      <span className="text-white text-right text-[11px] font-mono truncate max-w-[200px]" title={String(v)}>{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-[#606575] font-medium">API Key Info</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-mono text-white">
                      {showKey ? selectedRecord.apiKeyFull : selectedRecord.apiKeyMasked}
                      <button onClick={() => setShowKey(v => !v)} className="text-[#606575] hover:text-emerald-400 transition-colors">
                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </span>
                  </div>
                </div>
              </div>

              {/* Output Media */}
              {selectedRecord.taskStatus?.toUpperCase() === 'SUCCESS' && selectedRecord.outputs?.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-[#606575] uppercase tracking-widest mb-2">Output Media</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedRecord.outputs.map((out, idx) => {
                      const url = typeof out === 'string' ? out : out.fileUrl || out.url;
                      if (!url) return null;
                      return (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-[#22252e]">
                          <img src={url} alt={`Output ${idx + 1}`} className="w-full h-28 object-cover"
                            onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <a href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="p-2 bg-[#0d0e11] border border-[#22252e] rounded-lg text-white hover:text-emerald-400 transition-colors">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#22252e] flex justify-end">
              <button onClick={() => setSelectedRecord(null)} className="px-4 py-2 text-xs font-semibold text-[#a0a5b5] bg-[#181b21] border border-[#22252e] hover:text-white rounded-lg transition-all">
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
