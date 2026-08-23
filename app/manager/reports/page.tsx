'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import {
  FileSpreadsheet, Download, Calendar, Filter, RefreshCw,
  DollarSign, CheckCircle2, XCircle, Clock, Activity, Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { exportToExcelCSV } from '@/lib/excel-export';

interface AuditTask {
  id: string;
  app_name: string;
  status: string;
  created_at: string;
  user_name: string;
  user_email: string;
  cost_usd: number;
  coins: number;
  duration_sec: number;
  output_url: string;
}

export default function ManagerReportsPage() {
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Default: past 30 days
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/manager/overview?from=${dateFrom}&to=${dateTo}`);
      if (!res.ok) throw new Error('Failed to fetch reports');
      
      // Fetch detailed tasks list for audit
      const tasksRes = await fetch(`/api/tasks?limit=300`);
      if (tasksRes.ok) {
        const json = await tasksRes.json();
        const rawTasks = json.tasks || [];
        
        const formatted: AuditTask[] = rawTasks.map((t: any) => {
          let cost = 0;
          let coins = 0;
          let duration = 0;
          const nodeInfoList = t.node_info_list || [];
          const usageNode = nodeInfoList.find((n: any) => n.nodeId === 'USAGE' && n.fieldName === 'usage');
          if (usageNode?.fieldValue) {
            try {
              const usage = JSON.parse(usageNode.fieldValue);
              coins = usage?.consumeCoins ? parseFloat(usage.consumeCoins) : 0;
              const thirdParty = usage?.thirdPartyConsumeMoney ? parseFloat(usage.thirdPartyConsumeMoney) : 0;
              cost = usage?.consumeMoney ? parseFloat(usage.consumeMoney) : thirdParty;
              duration = usage?.taskCostTime ? parseInt(usage.taskCostTime) : 0;
            } catch {}
          }

          const firstOut = t.outputs && t.outputs.length > 0
            ? (typeof t.outputs[0] === 'string' ? t.outputs[0] : t.outputs[0]?.fileUrl || t.outputs[0]?.url)
            : '';

          return {
            id: t.id,
            app_name: t.app_name,
            status: t.status,
            created_at: t.created_at,
            user_name: t.users?.name || 'Designer',
            user_email: t.users?.email || '',
            cost_usd: Number(cost.toFixed(3)),
            coins: Math.round(coins),
            duration_sec: duration,
            output_url: firstOut || '',
          };
        });

        setTasks(formatted);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error loading reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateFrom, dateTo]);

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    const matchSearch = !search ||
      t.app_name.toLowerCase().includes(search.toLowerCase()) ||
      t.user_name.toLowerCase().includes(search.toLowerCase()) ||
      t.user_email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || t.status.toUpperCase() === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalCost = filteredTasks.reduce((acc, t) => acc + t.cost_usd, 0);
  const totalCoins = filteredTasks.reduce((acc, t) => acc + t.coins, 0);
  const successCount = filteredTasks.filter(t => t.status === 'SUCCESS').length;

  const handleExportExcel = () => {
    const columns = [
      { header: 'Task ID', key: 'id' as const, width: 20 },
      { header: 'Date & Time', key: 'created_at' as const, width: 22 },
      { header: 'Feature / App', key: 'app_name' as const, width: 24 },
      { header: 'Designer Name', key: 'user_name' as const, width: 20 },
      { header: 'Designer Email', key: 'user_email' as const, width: 26 },
      { header: 'Status', key: 'status' as const, width: 14 },
      { header: 'Cost (USD)', key: 'cost_usd' as const, width: 14 },
      { header: 'Coins', key: 'coins' as const, width: 12 },
      { header: 'Render Duration (s)', key: 'duration_sec' as const, width: 18 },
      { header: 'Output URL', key: 'output_url' as const, width: 40 },
    ];

    exportToExcelCSV(
      filteredTasks,
      columns,
      `Boutiqaat_Financial_Audit_${dateFrom}_to_${dateTo}`
    );
    toast.success('Excel audit report exported successfully!');
  };

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-6 border-b border-border/50 bg-gradient-to-r from-bg-secondary/60 via-transparent to-transparent">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-500/40 flex items-center justify-center shadow-lg border border-purple-500/30">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-text-primary">Financial & Task Audit Reports</h1>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 uppercase tracking-wider">
                      Management Audit
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Download official financial records and task logs for accounting and division performance review
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={fetchReports}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-white border border-border hover:bg-bg-hover px-3.5 py-2 rounded-xl transition-all"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                  Refresh
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 text-xs font-bold bg-accent-gold text-black hover:bg-accent-gold/90 px-4 py-2 rounded-xl transition-all shadow-md"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel / CSV (.xlsx)
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
            {/* Date Range & Summary KPI Ribbon */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Date Pickers */}
              <div className="glass-card rounded-xl p-4 border border-border bg-bg-card flex flex-col justify-center space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-accent-gold" /> Date Filter Range
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                  <span className="text-text-muted text-xs">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full bg-black/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              {/* Total Spend */}
              <div className="glass-card rounded-xl p-4 border border-border bg-bg-card flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Total Filtered Spend</span>
                <h3 className="text-xl font-bold text-white mt-1">${totalCost.toFixed(3)} USD</h3>
                <span className="text-[10px] text-accent-gold mt-0.5">{totalCoins.toLocaleString()} Coins computed</span>
              </div>

              {/* Tasks Count */}
              <div className="glass-card rounded-xl p-4 border border-border bg-bg-card flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Task Volume</span>
                <h3 className="text-xl font-bold text-white mt-1">{filteredTasks.length} Tasks</h3>
                <span className="text-[10px] text-accent-green mt-0.5">{successCount} Succeeded</span>
              </div>

              {/* Success Rate */}
              <div className="glass-card rounded-xl p-4 border border-border bg-bg-card flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Success Rate</span>
                <h3 className="text-xl font-bold text-accent-green mt-1">
                  {filteredTasks.length ? Math.round((successCount / filteredTasks.length) * 100) : 100}%
                </h3>
                <span className="text-[10px] text-text-muted mt-0.5">Commercial Delivery Quality</span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filter by app name, designer, or email..."
                  className="w-full bg-bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-text-primary placeholder-text-muted input-gold transition-all"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-bg-card border border-border p-1 rounded-xl">
                {['ALL', 'SUCCESS', 'FAILED'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                      statusFilter === s ? 'bg-accent-gold/15 text-accent-gold border border-accent-gold/30' : 'text-text-muted hover:text-text-primary'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Audit Table */}
            {loading ? (
              <div className="text-center py-20 text-text-muted">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-accent-gold/50" />
                Compiling financial audit log...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-20 glass-card rounded-2xl border border-dashed border-border">
                <Activity className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
                <p className="text-text-muted text-sm">No task records found in the selected date range</p>
              </div>
            ) : (
              <div className="glass-card rounded-2xl border border-border overflow-hidden bg-bg-card shadow-xl">
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#16181e] z-10">
                      <tr className="border-b border-border/80 text-text-muted font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Feature / App</th>
                        <th className="py-3 px-4">Designer</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Cost (USD)</th>
                        <th className="py-3 px-4">Render Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {filteredTasks.map(t => (
                        <tr key={t.id} className="hover:bg-white/2 transition-colors">
                          <td className="py-3 px-4 text-text-muted whitespace-nowrap">
                            {new Date(t.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 font-sans font-bold text-white whitespace-nowrap">
                            {t.app_name}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <span className="text-text-primary block font-medium">{t.user_name}</span>
                            <span className="text-[10px] text-text-muted block font-mono">{t.user_email}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                              t.status === 'SUCCESS' ? "bg-accent-green/10 text-accent-green border-accent-green/25" :
                              t.status === 'FAILED' ? "bg-accent-red/10 text-accent-red border-accent-red/25" :
                              "bg-accent-gold/10 text-accent-gold border-accent-gold/25"
                            )}>
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            ${t.cost_usd.toFixed(3)}
                          </td>
                          <td className="py-3 px-4 text-text-muted">
                            {t.duration_sec}s
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
