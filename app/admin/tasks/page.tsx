'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import {
  Activity, Search, RefreshCw, Download, CheckCircle2, XCircle,
  Loader2, Clock, Zap, DollarSign, Timer, Filter, ChevronLeft,
  ChevronRight, X, Copy, Eye, EyeOff, Check, Calendar, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface TaskRecord {
  taskId: string;
  taskName: string;
  taskStartTime: string;
  taskStatus: string;
  callTypeDisplay: string;
  moneyDuration: string;
  coinAmount: number;
  moneyAmount: number;
  currency: string;
  apiKeyType: 'enterprise' | 'consumer';
  userAccount: string;
  userEmail: string;
  userId: string;
  outputs: any[];
  errorMessage: string;
  nodeInfoList: any[];
}

interface Stats {
  total: number;
  totalEnterprise: number;
  totalConsumer: number;
  durationAll: number;
  coinNumAll: number;
  amountAll: number;
}

const toggleableColumns = [
  { id: 'startTime', label: 'Start Time' },
  { id: 'source', label: 'Source' },
  { id: 'callMethod', label: 'Call Method' },
  { id: 'account', label: 'Account' },
  { id: 'apiKeyInfo', label: 'API Key Info' },
  { id: 'keyType', label: 'Key Type' },
  { id: 'status', label: 'Status' },
  { id: 'duration', label: 'Duration' },
  { id: 'rhCoin', label: 'RH Coin' },
  { id: 'originalCost', label: 'Original Cost Amount($)' },
  { id: 'discountRate', label: 'Discount Rate' },
  { id: 'savedAmount', label: 'Saved Amount($)' },
  { id: 'finalAmount', label: 'Final Amount($)' },
  { id: 'mode', label: 'Mode' },
];

function formatDurationRH(seconds: string | number): string {
  const s = typeof seconds === 'string' ? parseInt(seconds) : seconds;
  if (isNaN(s) || s <= 0) return '00:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

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
  } catch {
    return isoString;
  }
}

function StatusIndicator({ status }: { status: string }) {
  const s = status?.toUpperCase();
  let dotColor = 'bg-[#606575]';
  let textColor = 'text-[#606575]';
  let label = status || 'Queued';

  if (s === 'SUCCESS') {
    dotColor = 'bg-[#00BFA5]';
    textColor = 'text-[#00BFA5]';
    label = 'Success';
  } else if (s === 'FAILED') {
    dotColor = 'bg-[#ff4d4f]';
    textColor = 'text-[#ff4d4f]';
    label = 'Failed';
  } else if (s === 'RUNNING') {
    dotColor = 'bg-[#1890ff] animate-pulse';
    textColor = 'text-[#1890ff]';
    label = 'Running';
  } else if (s === 'QUEUED') {
    dotColor = 'bg-[#faad14]';
    textColor = 'text-[#faad14]';
    label = 'Queued';
  } else if (s === 'CANCELED') {
    dotColor = 'bg-[#606575]';
    textColor = 'text-[#606575]';
    label = 'Canceled';
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', textColor)}>
      <span className={cn('w-2 h-2 rounded-full', dotColor)} /> {label}
    </span>
  );
}

function CustomColumnsDropdown({
  visibleColumns,
  onChange,
}: {
  visibleColumns: string[];
  onChange: (cols: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggleColumn = (colId: string) => {
    if (visibleColumns.includes(colId)) {
      onChange(visibleColumns.filter((c) => c !== colId));
    } else {
      onChange([...visibleColumns, colId]);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 border border-[#2a2d35] text-xs font-semibold text-[#a0a5b5] bg-[#181a1f] px-3.5 py-2 rounded-lg hover:bg-[#181a1f]/80 hover:text-white transition-all"
      >
        Custom Columns
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-[#121417] border border-[#2a2d35] rounded-xl shadow-2xl p-2.5 z-50 space-y-1">
            <p className="text-[10px] font-bold text-[#606575] uppercase px-2 py-1 tracking-wider">Show/Hide Columns</p>
            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {toggleableColumns.map((col) => {
                const isActive = visibleColumns.includes(col.id);
                return (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#181a1f] cursor-pointer text-xs text-[#a0a5b5] select-none hover:text-white"
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggleColumn(col.id)}
                      className="rounded border-[#2a2d35] bg-[#181a1f] text-[#00BFA5] focus:ring-0 w-3.5 h-3.5"
                    />
                    {col.label}
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function exportCSV(records: TaskRecord[]) {
  const header = 'Task ID,Start Time,Task Name,Status,Duration,RH Coins,Final Amount(USD),Source,Call Method,Account,API Key Type\n';
  const rows = records.map((r) => [
    r.taskId,
    formatDateTime(r.taskStartTime),
    r.taskName,
    r.taskStatus,
    formatDurationRH(r.moneyDuration),
    r.coinAmount,
    r.moneyAmount,
    'AI App API',
    r.callTypeDisplay,
    r.userAccount,
    r.apiKeyType === 'enterprise' ? 'Enterprise-Shared' : 'Membership',
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `studio-billing-records-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Billing records exported successfully!');
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

export default function AdminTaskMonitorPage() {
  const [records, setRecords] = useState<TaskRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [apiKeyFilter, setApiKeyFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [syncingBills, setSyncingBills] = useState(false);

  const handleSyncBills = async () => {
    setSyncingBills(true);
    const toastId = toast.loading('Syncing task bills from RunningHub...');
    try {
      const res = await fetch('/api/admin/tasks/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Synced ${data.syncedCount} tasks successfully!`, { id: toastId });
        fetchData();
      } else {
        toast.error('Sync failed: ' + (data.error || 'Unknown error'), { id: toastId });
      }
    } catch (err: any) {
      toast.error('Sync failed: ' + err.message, { id: toastId });
    } finally {
      setSyncingBills(false);
    }
  };

  // Column config
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'startTime',
    'status',
    'duration',
    'rhCoin',
    'finalAmount',
  ]);

  const dates = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(dates.from);
  const [dateTo, setDateTo] = useState(dates.to);
  const pageSize = 20;

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(pageSize),
        keyword,
        status: statusFilter,
        from: dateFrom,
        to: dateTo,
      });
      const res = await fetch(`/api/admin/tasks?${params}`);
      const data = await res.json();
      setRecords(data.records || []);
      setStats(data.stats || null);
    } catch {
      setRecords([]);
      toast.error('Failed to fetch billing tasks history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, keyword, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied to clipboard!');
  };

  const handleRegenerate = (record: TaskRecord) => {
    toast.success(`Regenerating task "${record.taskName}"...`);
  };

  const filteredRecords = records.filter((r) => {
    if (apiKeyFilter && r.apiKeyType !== apiKeyFilter) return false;
    return true;
  });

  return (
    <div className="flex h-screen bg-[#0a0b0d] text-[#a0a5b5] font-sans overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Header */}
          <div className="flex flex-col gap-1.5 border-b border-[#2a2d35]/30 pb-4">
            <h1 className="text-xl font-bold text-white tracking-wide">Console</h1>
            <p className="text-xs text-[#606575]">
              View execution status and billing details of all platform tasks. Supports custom columns and filtering by date range and task source.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-6 border-b border-[#2a2d35]/30 text-sm font-semibold pb-0">
            <a href="/admin" className="text-[#606575] hover:text-white pb-3 transition-colors">
              Dashboard
            </a>
            <a href="/admin/tasks" className="text-[#00BFA5] border-b-2 border-[#00BFA5] pb-3 transition-colors">
              Tasks & Billing
            </a>
            <span className="text-[#606575] cursor-not-allowed pb-3">
              LLM Logs (Coming Soon)
            </span>
          </div>

          {/* Date Range Selector Box */}
          <div className="bg-[#121417] border border-[#2a2d35]/30 rounded-xl p-4">
            <p className="text-xs font-semibold text-[#a0a5b5] mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#606575]" />
              Date Range 
              <span className="text-[#606575] font-normal">Latest tasks are shown by default. You can query up to the last 365 days.</span>
            </p>
            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full bg-[#181a1f] border border-[#2a2d35] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00BFA5] transition-all"
              />
              <span className="text-[#606575] text-xs">至</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-full bg-[#181a1f] border border-[#2a2d35] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00BFA5] transition-all"
              />
            </div>
          </div>

          {/* Filters & Details Box */}
          <div className="bg-[#121417] border border-[#2a2d35]/30 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white tracking-wide">Task & Billing Details</h3>
            
            <div className="flex flex-wrap gap-3 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[280px]">
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                  placeholder="Enter task ID or task name"
                  className="w-full bg-[#181a1f] border border-[#2a2d35] rounded-lg pl-3 pr-8 py-2 text-xs text-white placeholder-[#606575] focus:outline-none focus:border-[#00BFA5] transition-all"
                />
              </div>

              {/* Source Filter */}
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="bg-[#181a1f] border border-[#2a2d35] rounded-lg px-3 py-2 text-xs text-[#a0a5b5] focus:outline-none focus:border-[#00BFA5] transition-all"
              >
                <option value="">All Sources</option>
                <option value="API">API</option>
                <option value="Workflow">Workflow</option>
                <option value="AI App">AI App</option>
              </select>

              {/* API Key Filter */}
              <select
                value={apiKeyFilter}
                onChange={(e) => setApiKeyFilter(e.target.value)}
                className="bg-[#181a1f] border border-[#2a2d35] rounded-lg px-3 py-2 text-xs text-[#a0a5b5] focus:outline-none focus:border-[#00BFA5] transition-all"
              >
                <option value="">Please select key</option>
                <option value="consumer">Membership</option>
                <option value="enterprise">Enterprise-Shared</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#181a1f] border border-[#2a2d35] rounded-lg px-3 py-2 text-xs text-[#a0a5b5] focus:outline-none focus:border-[#00BFA5] transition-all"
              >
                <option value="">All Status</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="RUNNING">Running</option>
                <option value="QUEUED">Queued</option>
                <option value="CANCELED">Canceled</option>
              </select>

              {/* Action Buttons */}
              <button
                onClick={() => fetchData()}
                className="bg-[#00BFA5] text-[#0a0b0d] font-bold text-xs px-5 py-2 rounded-lg hover:bg-[#00bfa5]/90 transition-colors"
              >
                Search
              </button>
              <button
                onClick={() => exportCSV(filteredRecords)}
                className="border border-[#2a2d35] text-[#a0a5b5] font-semibold text-xs px-5 py-2 rounded-lg hover:bg-[#181a1f] hover:text-white transition-colors"
              >
                Export
              </button>
              <button
                onClick={handleSyncBills}
                disabled={syncingBills}
                className="flex items-center gap-1.5 border border-accent-purple/40 text-accent-purple font-semibold text-xs px-5 py-2 rounded-lg hover:bg-accent-purple/10 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                {syncingBills ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Sync bills
              </button>
            </div>

            {/* Metrics Line & Custom Columns Toggle */}
            <div className="flex flex-wrap gap-4 items-center justify-between pt-3.5 border-t border-[#2a2d35]/30">
              <div className="flex flex-wrap gap-x-4 gap-y-2 items-center text-xs text-[#a0a5b5]">
                <span>Total <strong className="text-white font-bold">{stats?.total || 0}</strong> records</span>
                <span className="w-1 h-1 rounded-full bg-[#2a2d35]" />
                <span>Billing duration <strong className="text-white font-bold">{formatDurationRH(stats?.durationAll || 0)}</strong></span>
                <span className="w-1 h-1 rounded-full bg-[#2a2d35]" />
                <span>RH Coins <strong className="text-white font-bold">{stats?.coinNumAll || 0}</strong></span>
                <span className="w-1 h-1 rounded-full bg-[#2a2d35]" />
                <span>Wallet Amount <strong className="text-white font-bold">${stats?.amountAll?.toFixed(3) || '0.000'}</strong></span>
              </div>

              <CustomColumnsDropdown
                visibleColumns={visibleColumns}
                onChange={setVisibleColumns}
              />
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto w-full border border-[#2a2d35]/30 rounded-xl bg-[#0e1013]">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#00BFA5]" />
                  <p className="text-xs text-[#606575]">Loading billing details...</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-20">
                  <Activity className="w-10 h-10 text-[#606575]/40 mx-auto mb-3" />
                  <p className="text-[#606575] text-xs">No matching billing records found</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                        Task ID
                      </th>
                      {visibleColumns.includes('startTime') && (
                        <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                          Start Time
                        </th>
                      )}
                      <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                        Task Name
                      </th>
                      {visibleColumns.includes('source') && (
                        <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                          Source
                        </th>
                      )}
                      {visibleColumns.includes('callMethod') && (
                        <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                          Call Method
                        </th>
                      )}
                      {visibleColumns.includes('account') && (
                        <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                          Account
                        </th>
                      )}
                      {visibleColumns.includes('apiKeyInfo') && (
                        <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                          API Key Info
                        </th>
                      )}
                      {visibleColumns.includes('keyType') && (
                        <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                          Key Type
                        </th>
                      )}
                      {visibleColumns.includes('status') && (
                        <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                          Status
                        </th>
                      )}
                      {visibleColumns.includes('duration') && (
                        <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                          Duration
                        </th>
                      )}
                      {visibleColumns.includes('rhCoin') && (
                        <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                          RH Coin
                        </th>
                      )}
                      {visibleColumns.includes('originalCost') && (
                        <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                          Original Cost
                        </th>
                      )}
                      {visibleColumns.includes('discountRate') && (
                        <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                          Discount Rate
                        </th>
                      )}
                      {visibleColumns.includes('savedAmount') && (
                        <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                          Saved Amount
                        </th>
                      )}
                      {visibleColumns.includes('finalAmount') && (
                        <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                          Final Amount($)
                        </th>
                      )}
                      {visibleColumns.includes('mode') && (
                        <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                          Mode
                        </th>
                      )}
                      <th className="px-4 py-3 bg-[#181a1f] text-[10px] font-bold text-[#606575] uppercase tracking-wider border-b border-[#2a2d35]/30">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#181a1f]">
                    {filteredRecords.map((record, idx) => (
                      <tr key={`${record.taskId}-${idx}`} className="hover:bg-[#181a1f]/30 transition-colors">
                        {/* Task ID */}
                        <td className="px-4 py-3 text-xs font-mono align-middle whitespace-nowrap">
                          <span className="flex items-center gap-1.5 text-white">
                            {record.taskId}
                            <button
                              onClick={() => handleCopy(record.taskId, record.taskId)}
                              className="text-[#606575] hover:text-[#00BFA5] transition-colors"
                            >
                              {copiedId === record.taskId ? (
                                <Check className="w-3 h-3 text-[#00BFA5]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </span>
                        </td>

                        {/* Start Time */}
                        {visibleColumns.includes('startTime') && (
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                            {formatDateTime(record.taskStartTime)}
                          </td>
                        )}

                        {/* Task Name Link */}
                        <td className="px-4 py-3 text-xs font-semibold align-middle whitespace-nowrap">
                          <button
                            onClick={() => setSelectedTask(record)}
                            className="text-white hover:text-[#00BFA5] underline text-left transition-colors truncate max-w-[200px]"
                          >
                            {record.taskName || 'Untitled'}
                          </button>
                        </td>

                        {/* Source */}
                        {visibleColumns.includes('source') && (
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                            AI App API
                          </td>
                        )}

                        {/* Call Method */}
                        {visibleColumns.includes('callMethod') && (
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                            API
                          </td>
                        )}

                        {/* Account */}
                        {visibleColumns.includes('account') && (
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap max-w-[150px] truncate">
                            {record.userAccount}
                          </td>
                        )}

                        {/* API Key Info */}
                        {visibleColumns.includes('apiKeyInfo') && (
                          <td className="px-4 py-3 text-xs font-mono align-middle whitespace-nowrap text-[#606575]">
                            c24e************************6772
                          </td>
                        )}

                        {/* Key Type */}
                        {visibleColumns.includes('keyType') && (
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                            {record.apiKeyType === 'enterprise' ? 'Enterprise-Shared' : 'Membership'}
                          </td>
                        )}

                        {/* Status */}
                        {visibleColumns.includes('status') && (
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                            <StatusIndicator status={record.taskStatus} />
                          </td>
                        )}

                        {/* Duration */}
                        {visibleColumns.includes('duration') && (
                          <td className="px-4 py-3 text-xs font-mono align-middle whitespace-nowrap text-white">
                            {formatDurationRH(record.moneyDuration)}
                          </td>
                        )}

                        {/* RH Coin */}
                        {visibleColumns.includes('rhCoin') && (
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-white">
                            {record.coinAmount}
                          </td>
                        )}

                        {/* Original Cost */}
                        {visibleColumns.includes('originalCost') && (
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                            $0
                          </td>
                        )}

                        {/* Discount Rate */}
                        {visibleColumns.includes('discountRate') && (
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                            -
                          </td>
                        )}

                        {/* Saved Amount */}
                        {visibleColumns.includes('savedAmount') && (
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                            $0
                          </td>
                        )}

                        {/* Final Amount */}
                        {visibleColumns.includes('finalAmount') && (
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap text-white">
                            {record.moneyAmount}
                          </td>
                        )}

                        {/* Mode */}
                        {visibleColumns.includes('mode') && (
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                            Standard
                          </td>
                        )}

                        {/* Action Link */}
                        <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                          <button
                            onClick={() => handleRegenerate(record)}
                            className="text-[#00BFA5] hover:text-[#00bfa5]/80 font-bold transition-colors"
                          >
                            Regenerate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            {stats && stats.total > pageSize && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-[#606575]">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, stats.total)} of{' '}
                  <span className="font-semibold text-white">{stats.total}</span> tasks
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-8 h-8 rounded-lg border border-[#2a2d35] flex items-center justify-center text-[#606575] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-white px-2">Page {page}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * pageSize >= stats.total}
                    className="w-8 h-8 rounded-lg border border-[#2a2d35] flex items-center justify-center text-[#606575] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Task Details Drawer */}
      {selectedTask && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedTask(null)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-[#0a0b0d] border-l border-[#2a2d35]/60 z-50 shadow-2xl flex flex-col transform transition-transform duration-300">
            {/* Drawer Header */}
            <div className="flex items-center gap-2 px-6 py-5 border-b border-[#2a2d35]/30">
              <button
                onClick={() => setSelectedTask(null)}
                className="text-[#606575] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-bold text-white tracking-wide">Task Details</h2>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Task Name, Source, Status Card */}
              <div className="bg-[#121417] border border-[#2a2d35]/30 rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-base font-bold text-white">{selectedTask.taskName || 'Untitled'}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white bg-[#6f42c1] px-2 py-0.5 rounded-full">
                      AI App API
                    </span>
                    <StatusIndicator status={selectedTask.taskStatus} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#606575] font-mono">
                  {selectedTask.taskId}
                  <button
                    onClick={() => handleCopy(selectedTask.taskId, 'drawer-' + selectedTask.taskId)}
                    className="hover:text-[#00BFA5] transition-colors"
                  >
                    {copiedId === 'drawer-' + selectedTask.taskId ? (
                      <Check className="w-3 h-3 text-[#00BFA5]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-[#121417] border border-[#2a2d35]/30 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-[#606575] uppercase">RH Coin</p>
                  <p className="text-lg font-bold text-white mt-1">{selectedTask.coinAmount}</p>
                </div>
                <div className="bg-[#121417] border border-[#2a2d35]/30 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-[#606575] uppercase">Final Amount</p>
                  <p className="text-lg font-bold text-white mt-1">${selectedTask.moneyAmount}</p>
                </div>
                <div className="bg-[#121417] border border-[#2a2d35]/30 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-[#606575] uppercase">Duration</p>
                  <p className="text-lg font-bold text-white mt-1">{formatDurationRH(selectedTask.moneyDuration)}</p>
                </div>
                <div className="bg-[#121417] border border-[#2a2d35]/30 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-[#606575] uppercase">Result</p>
                  <p className={cn(
                    'text-lg font-bold mt-1',
                    selectedTask.taskStatus?.toUpperCase() === 'SUCCESS' ? 'text-[#00BFA5]' :
                    selectedTask.taskStatus?.toUpperCase() === 'FAILED' ? 'text-[#ff4d4f]' :
                    'text-[#faad14]'
                  )}>
                    {selectedTask.taskStatus || 'Queued'}
                  </p>
                </div>
              </div>

              {/* Basic Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white tracking-wider uppercase">Basic Info</h4>
                <div className="bg-[#121417] border border-[#2a2d35]/30 rounded-xl divide-y divide-[#2a2d35]/20 text-xs">
                  <div className="flex justify-between p-3.5">
                    <span className="text-[#606575] font-semibold">Task ID</span>
                    <span className="text-white font-mono">{selectedTask.taskId}</span>
                  </div>
                  <div className="flex justify-between p-3.5">
                    <span className="text-[#606575] font-semibold">Start Time</span>
                    <span className="text-white">{formatDateTime(selectedTask.taskStartTime)}</span>
                  </div>
                  <div className="flex justify-between p-3.5">
                    <span className="text-[#606575] font-semibold">Task Name</span>
                    <span className="text-white">{selectedTask.taskName || 'Untitled'}</span>
                  </div>
                  <div className="flex justify-between p-3.5 items-center">
                    <span className="text-[#606575] font-semibold">Source</span>
                    <div className="flex items-center gap-1.5">
                      <span className="bg-[#181a1f] border border-[#2a2d35] px-1.5 py-0.5 rounded text-[10px] font-bold text-[#00BFA5]">
                        API
                      </span>
                      <span className="text-[#a0a5b5] font-normal">· AI App API</span>
                    </div>
                  </div>
                  <div className="flex justify-between p-3.5">
                    <span className="text-[#606575] font-semibold">Call Method</span>
                    <span className="text-white">API</span>
                  </div>
                  <div className="flex justify-between p-3.5 items-start">
                    <span className="text-[#606575] font-semibold">Account</span>
                    <div className="text-right">
                      <p className="text-white font-semibold">{selectedTask.userAccount}</p>
                      <p className="text-[10px] text-[#606575] font-mono mt-0.5">{selectedTask.userId}</p>
                    </div>
                  </div>
                  <div className="flex justify-between p-3.5 items-center">
                    <span className="text-[#606575] font-semibold">API Key Info</span>
                    <div className="flex items-center gap-1.5 font-mono text-white">
                      <span>
                        {showApiKey ? 'c24e68e4bf96443cb7801df0797362626772' : 'c24e************************6772'}
                      </span>
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="text-[#606575] hover:text-[#00BFA5] transition-colors"
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between p-3.5 items-center">
                    <span className="text-[#606575] font-semibold">Key Type</span>
                    <span className="bg-[#181a1f] border border-[#2a2d35] px-2 py-0.5 rounded-full text-[10px] font-semibold text-white">
                      {selectedTask.apiKeyType === 'enterprise' ? 'Enterprise-Shared' : 'Membership'}
                    </span>
                  </div>
                  <div className="flex justify-between p-3.5">
                    <span className="text-[#606575] font-semibold">Mode</span>
                    <span className="text-white">Standard</span>
                  </div>
                </div>
              </div>

              {/* Billing Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white tracking-wider uppercase">Billing Info</h4>
                <div className="bg-[#121417] border border-[#2a2d35]/30 rounded-xl divide-y divide-[#2a2d35]/20 text-xs">
                  <div className="flex justify-between p-3.5">
                    <span className="text-[#606575] font-semibold">Original Cost Amount</span>
                    <span className="text-white">$0</span>
                  </div>
                  <div className="flex justify-between p-3.5">
                    <span className="text-[#606575] font-semibold">Discount Rate</span>
                    <span className="text-white">-</span>
                  </div>
                  <div className="flex justify-between p-3.5">
                    <span className="text-[#606575] font-semibold">Saved Amount</span>
                    <span className="text-white">$0</span>
                  </div>
                </div>
              </div>

              {/* Results output image preview */}
              {selectedTask.taskStatus?.toUpperCase() === 'SUCCESS' && selectedTask.outputs && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white tracking-wider uppercase">Result Media</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedTask.outputs.map((out, idx) => {
                      const url = typeof out === 'string' ? out : out.fileUrl || out.url;
                      if (!url) return null;
                      return (
                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-[#2a2d35] bg-[#121417]">
                          <img
                            src={url}
                            alt={`Output ${idx + 1}`}
                            className="w-full h-36 object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 bg-[#181a1f] border border-[#2a2d35] rounded-lg hover:text-[#00BFA5] text-white transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Error messages if failed */}
              {selectedTask.taskStatus?.toUpperCase() === 'FAILED' && selectedTask.errorMessage && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#ff4d4f] tracking-wider uppercase">Failure Cause</h4>
                  <div className="bg-[#ff4d4f]/10 border border-[#ff4d4f]/30 rounded-xl p-4 text-xs text-[#ff4d4f] font-mono whitespace-pre-wrap leading-relaxed">
                    {selectedTask.errorMessage}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#2a2d35]/30 bg-[#121417] flex justify-end">
              <button
                onClick={() => setSelectedTask(null)}
                className="px-5 py-2 text-xs font-bold text-white bg-[#181a1f] border border-[#2a2d35] hover:bg-[#181a1f]/80 rounded-lg transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
