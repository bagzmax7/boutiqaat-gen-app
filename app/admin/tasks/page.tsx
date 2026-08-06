'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import {
  Activity, RefreshCw, Download, Loader2, ChevronLeft,
  ChevronRight, X, Copy, Eye, EyeOff, Check, Calendar,
  ExternalLink, Zap, DollarSign, Timer, TrendingUp, Filter,
  CheckCircle2, XCircle, Clock, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

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
  duration: number;
  coins: number;
  amount: number;
  thirdParty: number;
  nodeInfoList: any[];
}

interface BillingStats {
  total: number;
  successCount: number;
  failedCount: number;
  runningCount: number;
  queuedCount: number;
  missingBillingCount: number;
  totalDuration: number;
  totalCoins: number;
  totalAmount: number;
  totalThirdParty: number;
}

// ─── Utility Functions ──────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function formatDateTime(isoString: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
  } catch { return isoString; }
}

function formatAmount(n: number): string {
  if (!n || n === 0) return '—';
  return `$${n.toFixed(4)}`;
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

// ─── Status Badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase();
  if (s === 'SUCCESS') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
      <CheckCircle2 className="w-3.5 h-3.5" /> Success
    </span>
  );
  if (s === 'FAILED') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400">
      <XCircle className="w-3.5 h-3.5" /> Failed
    </span>
  );
  if (s === 'RUNNING') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400">
      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" /> Running
    </span>
  );
  if (s === 'QUEUED') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
      <Clock className="w-3.5 h-3.5" /> Queued
    </span>
  );
  if (s === 'CANCELED') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400">
      <AlertCircle className="w-3.5 h-3.5" /> Canceled
    </span>
  );
  return <span className="text-[11px] text-gray-500">{status || '—'}</span>;
}

// ─── Stats Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, sub, color
}: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-[#111316] border border-[#22252e] rounded-xl p-4 flex items-start gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color || 'bg-indigo-500/15')}>
        <Icon className={cn('w-5 h-5', color ? color.replace('bg-', 'text-').replace('/15', '') : 'text-indigo-400')} />
      </div>
      <div>
        <p className="text-[11px] font-medium text-[#606575] mb-0.5">{label}</p>
        <p className="text-base font-bold text-white leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-[#606575] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Export CSV ─────────────────────────────────────────────────────────────────
function exportCSV(records: BillingRecord[]) {
  const header = 'Task ID,Start Time,Task Name,Status,Duration(s),RH Coins,Final Amount($),API Key,User Account\n';
  const rows = records.map(r => [
    r.taskId, formatDateTime(r.taskStartTime), r.taskName, r.taskStatus,
    r.duration, r.coins, r.amount || '',
    r.apiKeyMasked, r.userAccount,
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `billing-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast.success('Exported successfully!');
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminBillingPage() {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingBills, setSyncingBills] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<BillingRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [visibleCols, setVisibleCols] = useState([
    'startTime', 'status', 'account', 'apiKey', 'duration', 'coins', 'amount',
  ]);
  const [colsOpen, setColsOpen] = useState(false);

  const dates = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(dates.from);
  const [dateTo, setDateTo] = useState(dates.to);
  const PAGE_SIZE = 20;

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo, status: statusFilter });
      const res = await fetch(`/api/admin/tasks/rh-billing?${params}`);
      const data = await res.json();
      setRecords(data.records || []);
      setStats(data.stats || null);
    } catch {
      toast.error('Failed to load billing data.');
      setRecords([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [dateFrom, dateTo, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const iv = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const handleSyncBills = async (days = 90) => {
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
        toast.success(
          `Synced ${data.syncedCount}/${data.totalTargeted} tasks (${data.totalScanned} scanned in ${days} days)`,
          { id: toastId, duration: 5000 }
        );
        fetchData();
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

  // Apply keyword + pagination
  const filtered = records.filter(r => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return r.taskId.toLowerCase().includes(kw) ||
      r.taskName.toLowerCase().includes(kw) ||
      r.userAccount.toLowerCase().includes(kw);
  });
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allCols = [
    { id: 'startTime', label: 'Start Time' },
    { id: 'taskName', label: 'Task Name' },
    { id: 'status', label: 'Status' },
    { id: 'account', label: 'Account' },
    { id: 'apiKey', label: 'API Key' },
    { id: 'keyType', label: 'Key Type' },
    { id: 'source', label: 'Source' },
    { id: 'callMethod', label: 'Call Method' },
    { id: 'duration', label: 'Duration' },
    { id: 'coins', label: 'RH Coin' },
    { id: 'origCost', label: 'Original Cost($)' },
    { id: 'discount', label: 'Discount Rate' },
    { id: 'saved', label: 'Saved($)' },
    { id: 'amount', label: 'Final Amount($)' },
    { id: 'mode', label: 'Mode' },
  ];
  const toggleCol = (id: string) =>
    setVisibleCols(v => v.includes(id) ? v.filter(c => c !== id) : [...v, id]);

  return (
    <div className="flex h-screen bg-[#0a0b0d] text-[#a0a5b5] font-sans overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Page Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">Task & Billing</h1>
              <p className="text-xs text-[#606575] mt-0.5">
                Enterprise API tasks only — Key: <span className="font-mono text-[#a0a5b5]">1c81****e474</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 border border-[#2a2d35] text-xs font-semibold text-[#a0a5b5] bg-[#111316] px-3.5 py-2 rounded-lg hover:text-white hover:border-[#3a3d45] disabled:opacity-50 transition-all"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
                Refresh
              </button>
              <div className="relative group">
                <button
                  onClick={() => handleSyncBills(90)}
                  disabled={syncingBills}
                  className="flex items-center gap-1.5 border border-violet-500/40 text-xs font-semibold text-violet-400 bg-violet-500/5 px-3.5 py-2 rounded-lg hover:bg-violet-500/10 disabled:opacity-50 transition-all"
                >
                  {syncingBills ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Sync Bills (90d)
                </button>
                {/* Dropdown for extended sync */}
                <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 bg-[#111316] border border-[#22252e] rounded-xl shadow-xl overflow-hidden min-w-[160px]">
                  <button onClick={() => handleSyncBills(30)} className="w-full px-4 py-2.5 text-xs text-left text-[#a0a5b5] hover:bg-[#181b21] hover:text-white transition-colors">Sync last 30 days</button>
                  <button onClick={() => handleSyncBills(90)} className="w-full px-4 py-2.5 text-xs text-left text-[#a0a5b5] hover:bg-[#181b21] hover:text-white transition-colors">Sync last 90 days</button>
                  <button onClick={() => handleSyncBills(180)} className="w-full px-4 py-2.5 text-xs text-left text-[#a0a5b5] hover:bg-[#181b21] hover:text-white transition-colors">Sync last 180 days</button>
                  <button onClick={() => handleSyncBills(365)} className="w-full px-4 py-2.5 text-xs text-left text-[#a0a5b5] hover:bg-[#181b21] hover:text-white transition-colors font-semibold text-amber-400">Sync last 365 days</button>
                </div>
              </div>
              <button
                onClick={() => exportCSV(filtered)}
                className="flex items-center gap-1.5 border border-[#2a2d35] text-xs font-semibold text-[#a0a5b5] bg-[#111316] px-3.5 py-2 rounded-lg hover:text-white hover:border-[#3a3d45] transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="flex gap-6 border-b border-[#22252e] text-sm font-semibold">
            <a href="/admin" className="text-[#606575] hover:text-white pb-3 transition-colors">Dashboard</a>
            <a href="/admin/tasks" className="text-emerald-400 border-b-2 border-emerald-400 pb-3 transition-colors">Tasks & Billing</a>
            <span className="text-[#606575] cursor-not-allowed pb-3">LLM Logs (Soon)</span>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={Activity}
              label="Total Tasks"
              value={stats?.total || 0}
              sub={`✓ ${stats?.successCount || 0} · ✗ ${stats?.failedCount || 0} · ⏳ ${stats?.runningCount || 0}`}
              color="bg-blue-500/15"
            />
            <StatCard
              icon={Timer}
              label="Billing Duration"
              value={formatDuration(stats?.totalDuration || 0)}
              sub="Cumulative task time"
              color="bg-amber-500/15"
            />
            <StatCard
              icon={Zap}
              label="RH Coins Used"
              value={(stats?.totalCoins || 0).toFixed(2)}
              sub={`${stats?.missingBillingCount || 0} tasks missing billing data`}
              color="bg-violet-500/15"
            />
            <StatCard
              icon={DollarSign}
              label="Final Amount (USD)"
              value={`$${(stats?.totalAmount || 0).toFixed(4)}`}
              sub={`3rd Party: $${(stats?.totalThirdParty || 0).toFixed(4)}`}
              color="bg-emerald-500/15"
            />
          </div>

          {/* Date Range + Filters */}
          <div className="bg-[#111316] border border-[#22252e] rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              {/* Date Range */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-[#606575] uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date Range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date" value={dateFrom}
                    onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                    className="bg-[#181b21] border border-[#2a2d35] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all"
                  />
                  <span className="text-[#606575] text-xs">→</span>
                  <input
                    type="date" value={dateTo}
                    onChange={e => { setDateTo(e.target.value); setPage(1); }}
                    className="bg-[#181b21] border border-[#2a2d35] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-[#606575] uppercase tracking-wider">Status</label>
                <select
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                  className="bg-[#181b21] border border-[#2a2d35] rounded-lg px-2.5 py-1.5 text-xs text-[#a0a5b5] focus:outline-none focus:border-emerald-500 transition-all"
                >
                  <option value="">All Status</option>
                  <option value="SUCCESS">Success</option>
                  <option value="FAILED">Failed</option>
                  <option value="RUNNING">Running</option>
                  <option value="QUEUED">Queued</option>
                  <option value="CANCELED">Canceled</option>
                </select>
              </div>

              {/* Keyword Search */}
              <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
                <label className="text-[10px] font-semibold text-[#606575] uppercase tracking-wider">Search</label>
                <input
                  type="text" value={keyword}
                  onChange={e => { setKeyword(e.target.value); setPage(1); }}
                  placeholder="Task ID / Task Name / Account..."
                  className="bg-[#181b21] border border-[#2a2d35] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#606575] focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Search button */}
              <button
                onClick={() => { setPage(1); fetchData(); }}
                className="bg-emerald-500 text-[#0a0b0d] font-bold text-xs px-5 py-1.5 rounded-lg hover:bg-emerald-400 transition-colors"
              >
                Query
              </button>
            </div>

            {/* Summary Line */}
            <div className="flex items-center justify-between border-t border-[#22252e] pt-3">
              <div className="flex flex-wrap gap-x-5 gap-y-1 items-center text-xs text-[#606575]">
                <span>Total: <strong className="text-white font-bold">{filtered.length}</strong> records</span>
                <span className="hidden md:inline w-px h-3 bg-[#2a2d35]" />
                <span>Billing Duration: <strong className="text-white font-bold">{formatDuration(stats?.totalDuration || 0)}</strong></span>
                <span className="hidden md:inline w-px h-3 bg-[#2a2d35]" />
                <span>RH Coins: <strong className="text-white font-bold">{(stats?.totalCoins || 0).toFixed(2)}</strong></span>
                <span className="hidden md:inline w-px h-3 bg-[#2a2d35]" />
                <span>Wallet Amount: <strong className="text-emerald-400 font-bold">${(stats?.totalAmount || 0).toFixed(4)}</strong></span>
              </div>

              {/* Custom Columns */}
              <div className="relative">
                <button
                  onClick={() => setColsOpen(v => !v)}
                  className="flex items-center gap-1.5 border border-[#2a2d35] text-xs font-semibold text-[#a0a5b5] bg-[#181b21] px-3 py-1.5 rounded-lg hover:text-white transition-all"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Columns
                </button>
                {colsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setColsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-52 bg-[#111316] border border-[#22252e] rounded-xl shadow-2xl p-2 z-50">
                      <p className="text-[10px] font-bold text-[#606575] uppercase px-2 py-1 tracking-wider">Show/Hide Columns</p>
                      <div className="max-h-64 overflow-y-auto space-y-0.5">
                        {allCols.map(col => (
                          <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#181b21] cursor-pointer text-xs text-[#a0a5b5] hover:text-white select-none">
                            <input type="checkbox" checked={visibleCols.includes(col.id)} onChange={() => toggleCol(col.id)} className="rounded border-[#2a2d35] text-emerald-500 focus:ring-0 w-3.5 h-3.5" />
                            {col.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#111316] border border-[#22252e] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
                  <p className="text-xs text-[#606575]">Loading billing records...</p>
                </div>
              ) : paged.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3">
                  <Activity className="w-10 h-10 text-[#606575]/30" />
                  <p className="text-xs text-[#606575]">No billing records found</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-[#0e1013]">
                      <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Task ID</th>
                      {visibleCols.includes('startTime') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Start Time</th>}
                      {visibleCols.includes('taskName') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Task Name</th>}
                      {visibleCols.includes('source') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Source</th>}
                      {visibleCols.includes('callMethod') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Call Method</th>}
                      {visibleCols.includes('account') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Account</th>}
                      {visibleCols.includes('apiKey') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">API Key Info</th>}
                      {visibleCols.includes('keyType') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Key Type</th>}
                      {visibleCols.includes('status') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Status</th>}
                      {visibleCols.includes('duration') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Duration</th>}
                      {visibleCols.includes('coins') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">RH Coin</th>}
                      {visibleCols.includes('origCost') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Original Cost($)</th>}
                      {visibleCols.includes('discount') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Discount Rate</th>}
                      {visibleCols.includes('saved') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Saved($)</th>}
                      {visibleCols.includes('amount') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Final Amount($)</th>}
                      {visibleCols.includes('mode') && <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Mode</th>}
                      <th className="px-4 py-3 text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#22252e] whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#181b21]">
                    {paged.map((r, idx) => (
                      <tr key={`${r.taskId}-${idx}`} className="hover:bg-[#181b21]/40 transition-colors">
                        {/* Task ID */}
                        <td className="px-4 py-3 text-xs font-mono align-middle whitespace-nowrap">
                          <span className="flex items-center gap-1.5 text-white">
                            <span className="truncate max-w-[120px]" title={r.taskId}>{r.taskId}</span>
                            <button onClick={() => { handleCopy(r.taskId, r.taskId); toast.success('Copied!'); }} className="text-[#606575] hover:text-emerald-400 transition-colors shrink-0">
                              {copiedId === r.taskId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </span>
                        </td>
                        {visibleCols.includes('startTime') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#a0a5b5]">{formatDateTime(r.taskStartTime)}</td>}
                        {visibleCols.includes('taskName') && (
                          <td className="px-4 py-3 text-xs font-semibold align-middle whitespace-nowrap max-w-[180px]">
                            <button onClick={() => setSelectedRecord(r)} className="text-white hover:text-emerald-400 underline text-left transition-colors truncate max-w-[180px] block">{r.taskName || 'Untitled'}</button>
                          </td>
                        )}
                        {visibleCols.includes('source') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#a0a5b5]">AI App API</td>}
                        {visibleCols.includes('callMethod') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap"><span className="bg-[#181b21] border border-[#2a2d35] px-2 py-0.5 rounded text-[10px] font-bold text-emerald-400">API</span></td>}
                        {visibleCols.includes('account') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-white truncate max-w-[140px]">{r.userAccount}</td>}
                        {visibleCols.includes('apiKey') && <td className="px-4 py-3 text-xs font-mono align-middle whitespace-nowrap text-[#606575]">{r.apiKeyMasked}</td>}
                        {visibleCols.includes('keyType') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap"><span className="bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">Enterprise-Shared</span></td>}
                        {visibleCols.includes('status') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap"><StatusBadge status={r.taskStatus} /></td>}
                        {visibleCols.includes('duration') && <td className="px-4 py-3 text-xs font-mono align-middle whitespace-nowrap text-white">{r.duration > 0 ? formatDuration(r.duration) : '—'}</td>}
                        {visibleCols.includes('coins') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-white">{r.coins > 0 ? r.coins.toFixed(2) : '—'}</td>}
                        {visibleCols.includes('origCost') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#606575]">—</td>}
                        {visibleCols.includes('discount') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#606575]">—</td>}
                        {visibleCols.includes('saved') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#606575]">—</td>}
                        {visibleCols.includes('amount') && (
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap font-semibold">
                            {r.amount > 0 
                              ? <span className="text-emerald-400">${r.amount.toFixed(4)}</span> 
                              : r.taskStatus?.toUpperCase() === 'SUCCESS'
                                ? <span className="text-amber-500 text-[10px] font-semibold">⚠ Pending Sync</span>
                                : <span className="text-[#606575]">—</span>
                            }
                          </td>
                        )}
                        {visibleCols.includes('mode') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#a0a5b5]">Standard</td>}
                        <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                          <button onClick={() => setSelectedRecord(r)} className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">Details</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#22252e]">
                <p className="text-xs text-[#606575]">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of <strong className="text-white">{filtered.length}</strong> records
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#22252e] text-[#606575] hover:text-white disabled:opacity-30 transition-all">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-white px-1">Page {page} / {pageCount}</span>
                  <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#22252e] text-[#606575] hover:text-white disabled:opacity-30 transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Task Detail Drawer */}
      {selectedRecord && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setSelectedRecord(null)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[#0a0b0d] border-l border-[#22252e] z-50 shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#22252e]">
              <button onClick={() => setSelectedRecord(null)} className="text-[#606575] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-bold text-white">Task Details</h2>
              <StatusBadge status={selectedRecord.taskStatus} />
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Task Summary */}
              <div className="bg-[#111316] border border-[#22252e] rounded-xl p-4 space-y-1.5">
                <h3 className="text-sm font-bold text-white">{selectedRecord.taskName || 'Untitled'}</h3>
                <p className="text-[11px] text-[#606575] font-mono">{selectedRecord.taskId}</p>
              </div>

              {/* Billing Metrics */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#111316] border border-[#22252e] rounded-xl p-3 text-center">
                  <p className="text-[10px] text-[#606575] font-semibold uppercase">Duration</p>
                  <p className="text-sm font-bold text-white mt-1">{formatDuration(selectedRecord.duration)}</p>
                </div>
                <div className="bg-[#111316] border border-[#22252e] rounded-xl p-3 text-center">
                  <p className="text-[10px] text-[#606575] font-semibold uppercase">RH Coin</p>
                  <p className="text-sm font-bold text-white mt-1">{selectedRecord.coins > 0 ? selectedRecord.coins.toFixed(2) : '—'}</p>
                </div>
                <div className="bg-[#111316] border border-[#22252e] rounded-xl p-3 text-center">
                  <p className="text-[10px] text-[#606575] font-semibold uppercase">Amount</p>
                  <p className="text-sm font-bold text-emerald-400 mt-1">{selectedRecord.amount > 0 ? `$${selectedRecord.amount.toFixed(4)}` : '—'}</p>
                </div>
              </div>

              {/* Basic Info */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-[#606575] uppercase tracking-widest">Basic Info</h4>
                <div className="bg-[#111316] border border-[#22252e] rounded-xl divide-y divide-[#22252e] text-xs">
                  {[
                    ['Task ID', selectedRecord.taskId, 'mono'],
                    ['Start Time', formatDateTime(selectedRecord.taskStartTime)],
                    ['Task Name', selectedRecord.taskName || 'Untitled'],
                    ['Source', 'AI App API'],
                    ['Call Method', 'API'],
                    ['Account', selectedRecord.userAccount],
                    ['Key Type', 'Enterprise-Shared'],
                    ['Mode', 'Standard'],
                  ].map(([k, v, type]) => (
                    <div key={String(k)} className="flex justify-between items-center px-3.5 py-3">
                      <span className="text-[#606575] font-semibold">{k}</span>
                      <span className={cn('text-white text-right max-w-[200px] truncate', type === 'mono' && 'font-mono text-[11px]')}>{v}</span>
                    </div>
                  ))}
                  {/* API Key with toggle */}
                  <div className="flex justify-between items-center px-3.5 py-3">
                    <span className="text-[#606575] font-semibold">API Key</span>
                    <span className="flex items-center gap-1.5 font-mono text-[11px] text-white">
                      {showKey ? selectedRecord.apiKeyFull : selectedRecord.apiKeyMasked}
                      <button onClick={() => setShowKey(v => !v)} className="text-[#606575] hover:text-emerald-400 transition-colors">
                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </span>
                  </div>
                </div>
              </div>

              {/* Billing Info */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-[#606575] uppercase tracking-widest">Billing Info</h4>
                <div className="bg-[#111316] border border-[#22252e] rounded-xl divide-y divide-[#22252e] text-xs">
                  {[
                    ['Duration', formatDuration(selectedRecord.duration)],
                    ['RH Coins', selectedRecord.coins > 0 ? selectedRecord.coins.toFixed(2) : '—'],
                    ['Original Cost', '—'],
                    ['Discount Rate', '—'],
                    ['Saved Amount', '—'],
                    ['Final Amount (USD)', selectedRecord.amount > 0 ? `$${selectedRecord.amount.toFixed(4)}` : '—'],
                    ['3rd Party Cost', selectedRecord.thirdParty > 0 ? `$${selectedRecord.thirdParty.toFixed(4)}` : '—'],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between px-3.5 py-3">
                      <span className="text-[#606575] font-semibold">{k}</span>
                      <span className={cn('text-white', String(k).includes('Final') && selectedRecord.amount > 0 && 'text-emerald-400 font-bold')}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Outputs */}
              {selectedRecord.taskStatus?.toUpperCase() === 'SUCCESS' && selectedRecord.outputs?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-[#606575] uppercase tracking-widest">Output Media</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedRecord.outputs.map((out, idx) => {
                      const url = typeof out === 'string' ? out : out.fileUrl || out.url;
                      if (!url) return null;
                      return (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-[#22252e]">
                          <img src={url} alt={`Output ${idx + 1}`} className="w-full h-28 object-cover"
                            onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <a href={url} target="_blank" rel="noreferrer" className="p-2 bg-[#111316] border border-[#22252e] rounded-lg text-white hover:text-emerald-400 transition-colors">
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

            {/* Drawer Footer */}
            <div className="px-5 py-4 border-t border-[#22252e] flex justify-end">
              <button onClick={() => setSelectedRecord(null)} className="px-4 py-2 text-xs font-bold text-white bg-[#181b21] border border-[#22252e] hover:bg-[#22252e] rounded-lg transition-all">
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
