'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import {
  RefreshCw, Download, Loader2, ChevronLeft,
  ChevronRight, X, Copy, Eye, EyeOff, Check,
  ExternalLink, Zap, DollarSign, Timer, Settings2,
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

// ─── Utility Functions ──────────────────────────────────────────────────────────

/** Format duration as MM:SS or HH:MM:SS — same format as RunningHub */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/** Format billing duration total as HH:MM:SS */
function formatTotalDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Format datetime: YYYY-MM-DD HH:MM:SS — same as RunningHub */
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

/** Format Final Amount — RunningHub shows numbers like 0.027, 0.693 (no $ prefix in table) */
function formatFinalAmount(n: number): string {
  if (!n || n === 0) return '0';
  // Show up to 3 significant decimal places, matching RunningHub display
  if (n < 0.001) return n.toFixed(6);
  if (n < 0.01) return n.toFixed(4);
  if (n < 1) return n.toFixed(3);
  return n.toFixed(2);
}

/** Default date range: last 7 days (matches RunningHub default) */
function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
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
  { id: 'account', label: 'Account' },
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

// ─── Export CSV ─────────────────────────────────────────────────────────────────
function exportCSV(records: BillingRecord[]) {
  const header = 'Task ID,Start Time,Task Name,Status,Duration,RH Coin,Final Amount($),Account\n';
  const rows = records.map(r => [
    r.taskId,
    formatDateTime(r.taskStartTime),
    r.taskName,
    r.taskStatus,
    formatDuration(r.duration),
    r.coins,
    r.amount ? formatFinalAmount(r.amount) : '0',
    r.userAccount,
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `bill-task-${new Date().toISOString().slice(0, 10)}.csv`;
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
  const [colsModalOpen, setColsModalOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState([
    'taskId', 'startTime', 'taskName', 'status', 'duration', 'coins', 'amount',
  ]);

  // RunningHub default: 7 days
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
        toast.success(
          `Synced ${data.syncedCount}/${data.totalTargeted} tasks`,
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

  const handleSearch = () => { setPage(1); fetchData(); };

  // Filter by keyword (client-side)
  const filtered = records.filter(r => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return r.taskId.includes(kw) || r.taskName.toLowerCase().includes(kw);
  });
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex h-screen bg-[#0d0e11] text-[#a0a5b5] font-sans overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Page Header — matches RunningHub "Console" heading */}
          <div>
            <h1 className="text-xl font-bold text-white">Console</h1>
            <p className="text-xs text-[#606575] mt-0.5">
              View execution status and billing details of all platform tasks. Supports custom columns and filtering by date range and task source.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-0 border-b border-[#22252e]">
            <a href="/admin" className="px-5 py-2.5 text-sm text-[#606575] hover:text-white transition-colors border-b-2 border-transparent">Dashboard</a>
            <button className="px-5 py-2.5 text-sm font-semibold text-white border-b-2 border-emerald-400 transition-colors">Tasks & Billing</button>
            <button className="px-5 py-2.5 text-sm text-[#606575] cursor-not-allowed">LLM Logs</button>
          </div>

          {/* Date Range Section */}
          <div className="bg-[#111316] border border-[#22252e] rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">Date Range</span>
            </div>
            <p className="text-[11px] text-[#606575]">
              Latest tasks are shown by default. You can query up to the last 365 days.
            </p>
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

          {/* Task & Billing Details Section */}
          <div className="bg-[#111316] border border-[#22252e] rounded-xl overflow-hidden">
            {/* Section Header */}
            <div className="px-5 pt-5 pb-3 border-b border-[#22252e]">
              <h2 className="text-sm font-bold text-white mb-4">Task & Billing Details</h2>

              {/* Search Row */}
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="text"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter task ID or task name"
                  className="bg-[#0d0e11] border border-[#2a2d35] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#606575] focus:outline-none focus:border-emerald-500 transition-all w-56"
                />
                <select
                  value=""
                  onChange={() => {}}
                  className="bg-[#0d0e11] border border-[#2a2d35] rounded-lg px-3 py-1.5 text-xs text-[#606575] focus:outline-none transition-all"
                >
                  <option value="">All Sources</option>
                  <option value="api">API</option>
                </select>
                <select
                  value=""
                  onChange={() => {}}
                  className="bg-[#0d0e11] border border-[#2a2d35] rounded-lg px-3 py-1.5 text-xs text-[#606575] focus:outline-none transition-all"
                >
                  <option value="">Please select key</option>
                  <option value="enterprise">1c81****e474 (Enterprise)</option>
                </select>
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
                  className="bg-[#c5f135] text-black font-bold text-xs px-8 py-1.5 rounded-lg hover:bg-[#d4ff3d] transition-colors"
                >
                  Search
                </button>
                <button
                  onClick={() => exportCSV(filtered)}
                  className="border border-[#2a2d35] text-xs font-semibold text-[#a0a5b5] bg-[#0d0e11] px-6 py-1.5 rounded-lg hover:text-white hover:border-[#3a3d45] transition-all"
                >
                  Export
                </button>
              </div>
            </div>

            {/* Summary Bar — exactly like RunningHub */}
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
                {/* Sync Button */}
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
                {/* Custom Columns Button */}
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
              ) : paged.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-2">
                  <p className="text-sm text-[#606575]">No records found</p>
                  <p className="text-xs text-[#606575]/60">Try expanding the date range or click Sync Bills</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-[#0d0e11]">
                      <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Task ID</th>
                      {visibleCols.includes('startTime') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Start Time</th>}
                      {visibleCols.includes('taskName') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Task Name</th>}
                      {visibleCols.includes('source') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Source</th>}
                      {visibleCols.includes('callMethod') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Call Method</th>}
                      {visibleCols.includes('account') && <th className="px-4 py-3 text-xs font-semibold text-[#606575] border-b border-[#22252e] whitespace-nowrap">Account</th>}
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
                    {paged.map((r, idx) => (
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
                        {/* Task Name — matches RunningHub: shows API endpoint name as link */}
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
                        {visibleCols.includes('source') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#a0a5b5]">AI App API</td>}
                        {visibleCols.includes('callMethod') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap"><span className="text-[#a0a5b5]">API</span></td>}
                        {visibleCols.includes('account') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-white truncate max-w-[140px]">{r.userAccount}</td>}
                        {visibleCols.includes('apiKey') && <td className="px-4 py-3 text-xs font-mono align-middle whitespace-nowrap text-[#606575]">{r.apiKeyMasked}</td>}
                        {visibleCols.includes('keyType') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#a0a5b5]">Enterprise-Shared</td>}
                        {/* Status */}
                        {visibleCols.includes('status') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap"><StatusBadge status={r.taskStatus} /></td>}
                        {/* Duration — MM:SS format like RunningHub */}
                        {visibleCols.includes('duration') && (
                          <td className="px-4 py-3 text-xs font-mono align-middle whitespace-nowrap text-white">
                            {r.duration > 0 ? formatDuration(r.duration) : '—'}
                          </td>
                        )}
                        {/* RH Coin — integer like RunningHub */}
                        {visibleCols.includes('coins') && (
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-white">
                            {r.coins > 0 ? Math.round(r.coins) : '0'}
                          </td>
                        )}
                        {visibleCols.includes('discountRate') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#606575]">—</td>}
                        {visibleCols.includes('savedAmount') && <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-[#606575]">—</td>}
                        {/* Final Amount — decimal like RunningHub (0.027, 0.693) */}
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
                        {/* Action */}
                        <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                          {r.taskStatus?.toUpperCase() === 'SUCCESS' ? (
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedRecord(r); }}
                              className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                            >
                              Regenerate
                            </button>
                          ) : <span className="text-[#606575]">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination — exactly like RunningHub: Previous | page number | Next | Total N */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#22252e]">
              <div className="flex items-center gap-1">
                <select
                  value={PAGE_SIZE}
                  onChange={() => {}}
                  className="bg-[#0d0e11] border border-[#22252e] rounded-lg px-2 py-1 text-xs text-[#606575] focus:outline-none"
                >
                  <option value={20}>20 / page</option>
                </select>
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
                <span className="text-xs text-[#606575]">Total {filtered.length}</span>
              </div>
            </div>
          </div>
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

              {/* Billing Grid — 3 columns like RunningHub */}
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

              {/* Basic Info */}
              <div>
                <h4 className="text-[11px] font-bold text-[#606575] uppercase tracking-widest mb-2">Basic Info</h4>
                <div className="bg-[#111316] border border-[#22252e] rounded-xl divide-y divide-[#22252e] text-xs">
                  {[
                    ['Task ID', selectedRecord.taskId],
                    ['Start Time', formatDateTime(selectedRecord.taskStartTime)],
                    ['Task Name', selectedRecord.taskName || '—'],
                    ['Source', 'AI App API'],
                    ['Call Method', 'API'],
                    ['Account', selectedRecord.userAccount || '—'],
                    ['Key Type', 'Enterprise-Shared'],
                    ['Mode', 'Standard'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center px-4 py-3 gap-4">
                      <span className="text-[#606575] font-medium shrink-0">{k}</span>
                      <span className="text-white text-right text-[11px] font-mono truncate max-w-[200px]" title={String(v)}>{v}</span>
                    </div>
                  ))}
                  {/* API Key with toggle */}
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

              {/* Billing Info */}
              <div>
                <h4 className="text-[11px] font-bold text-[#606575] uppercase tracking-widest mb-2">Billing Info</h4>
                <div className="bg-[#111316] border border-[#22252e] rounded-xl divide-y divide-[#22252e] text-xs">
                  {[
                    ['Duration', formatDuration(selectedRecord.duration)],
                    ['RH Coins', selectedRecord.coins > 0 ? Math.round(selectedRecord.coins) : '0'],
                    ['Discount Rate', '—'],
                    ['Saved Amount', '—'],
                    ['Final Amount (USD)', selectedRecord.amount > 0 ? `$${formatFinalAmount(selectedRecord.amount)}` : '$0'],
                    ['3rd Party Cost', selectedRecord.thirdParty > 0 ? `$${formatFinalAmount(selectedRecord.thirdParty)}` : '$0'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between px-4 py-3">
                      <span className="text-[#606575] font-medium">{k}</span>
                      <span className={cn('text-white font-mono text-[11px]', String(k).includes('Final') && selectedRecord.amount > 0 && 'text-emerald-400 font-bold')}>{v}</span>
                    </div>
                  ))}
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
