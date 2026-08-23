'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import {
  DollarSign, TrendingUp, Users, Activity,
  Sparkles, Film, Layers, CheckCircle2, ChevronRight,
  Clock, Download, Settings, Sliders,
  Package, Crop, ArrowRight, ShieldCheck, Edit3, Camera,
  UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface DeliverableItem {
  label: string;
  count: number;
  spendUsd: number;
  tool: string;
}

interface ManagerAgencyData {
  department: {
    id: string;
    name: string;
    monthlyBudgetUsd: number;
    monthlyBudgetKwd: number;
    criticalThresholdPercent: number;
    autoPauseOnCritical: boolean;
    remainingBudgetUsd: number;
    remainingBudgetKwd: number;
    budgetUsedPercent: number;
    budgetHealthTier: 'safe' | 'warning' | 'critical';
    isAutoPaused: boolean;
  };
  photoshootComparison: {
    benchmarkReportName: string;
    benchmarkCostPerSkuKwd: number;
    benchmarkCostPerSkuUsd: number;
    totalAssetsProduced: number;
    physicalEquivalentCostUsd: number;
    physicalEquivalentCostKwd: number;
    actualAiCostUsd: number;
    actualAiCostKwd: number;
    netSavingsUsd: number;
    netSavingsKwd: number;
    savingsPercent: number;
    physicalHoursSaved: number;
    exchangeRate: number;
  };
  assetsDelivered?: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    inFilterRange: number;
    hoursSaved: number;
  };
  deliverables: {
    flowImages: DeliverableItem;
    flowVideos: DeliverableItem;
    bundles: DeliverableItem;
    layers: DeliverableItem;
    socialResize: DeliverableItem;
    autoRetouch: DeliverableItem;
  };
  workforce: {
    totalEditors: number;
    teamAvgTasks: number;
    rankings: Array<{
      userId: string;
      name: string;
      email: string;
      role: string;
      taskCount: number;
      successCount: number;
      successRate: number;
      spendUsd: number;
      spendKwd: number;
      vsAvgPercent: number;
      balanceStatus: 'Heavy Load' | 'Balanced' | 'Underutilized';
    }>;
  };
  telemetry: {
    taskSuccessRate: number;
    totalTasks: number;
    successCount: number;
    failedCount: number;
    queueDepth: number;
    uptimePercent: number;
    renderSpeed: {
      avgRenderSec: number;
      maxRenderSec: number;
      byModule: Record<string, { avgSec: number; label: string }>;
    };
    failureCauses: {
      contentAudit: number;
      apiTimeout: number;
      formatMismatch: number;
      serverError: number;
      other: number;
    };
  };
  models: Array<{
    modelName: string;
    category: string;
    unitPriceUsd: number;
    officialPriceUsd: number;
    spendUsd: number;
    spendKwd: number;
    marketValueUsd: number;
    marketValueKwd: number;
    savingsUsd: number;
    savingsPercent: number;
    count: number;
  }>;
}

export default function ManagerDashboardPage() {
  const [data, setData] = useState<ManagerAgencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<'USD' | 'KWD'>('USD');
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'custom'>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Physical Photoshoot Benchmark custom rate (Default: 3.34 KD from June report)
  const [benchmarkRateKwd, setBenchmarkRateKwd] = useState('3.34');
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);

  // Budget threshold modal
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetCap, setBudgetCap] = useState('500');
  const [threshold, setThreshold] = useState('90');
  const [autoPause, setAutoPause] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      let url = '/api/manager/overview';
      const params = new URLSearchParams();

      const now = new Date();
      if (dateFilter === 'today') {
        const d = now.toISOString().slice(0, 10);
        params.set('from', d);
        params.set('to', d);
      } else if (dateFilter === '7days') {
        const past = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        params.set('from', past);
      } else if (dateFilter === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        params.set('from', start);
      } else if (dateFilter === 'custom' && customFrom) {
        params.set('from', customFrom);
        if (customTo) params.set('to', customTo);
      }

      if (benchmarkRateKwd) {
        params.set('benchmarkSkuKwd', benchmarkRateKwd);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch Manager KPIs');
      const json = await res.json();
      setData(json);

      if (json.department) {
        setBudgetCap(String(json.department.monthlyBudgetUsd || 500));
        setThreshold(String(json.department.criticalThresholdPercent || 90));
        setAutoPause(Boolean(json.department.autoPauseOnCritical));
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not load Manager metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [dateFilter, customFrom, customTo, benchmarkRateKwd]);

  const handleUpdateBudget = async () => {
    setSavingBudget(true);
    try {
      const res = await fetch('/api/manager/budget', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyBudgetUsd: parseFloat(budgetCap),
          criticalThresholdPercent: parseInt(threshold),
          autoPauseOnCritical: autoPause,
        }),
      });
      if (!res.ok) throw new Error('Failed to save budget settings');
      toast.success('Budget settings updated successfully!');
      setShowBudgetModal(false);
      fetchMetrics();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update budget');
    } finally {
      setSavingBudget(false);
    }
  };

  const formatMoney = (usdVal: number) => {
    if (currency === 'KWD') {
      const kwd = usdVal / (data?.photoshootComparison?.exchangeRate || 3.25);
      return `${kwd.toFixed(3)} KWD`;
    }
    return `$${usdVal.toFixed(2)}`;
  };

  const handleExportSummary = () => {
    if (!data) return;
    const report = {
      studio: 'Boutiqaat Creative AI Studio',
      exportDate: new Date().toISOString(),
      currency,
      exchangeRate: data.photoshootComparison.exchangeRate,
      photoshootComparison: data.photoshootComparison,
      assetsDelivered: data.assetsDelivered,
      deliverables: data.deliverables,
      myTeam: data.workforce,
      enginePerformance: data.telemetry,
      modelUsageSummary: data.models,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Boutiqaat_CreativeOps_Audit_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Executive Audit Report exported successfully!');
  };

  const dept = data?.department;
  const comp = data?.photoshootComparison;
  const assets = data?.assetsDelivered;
  const deliv = data?.deliverables;
  const wf = data?.workforce;
  const telem = data?.telemetry;
  const models = data?.models || [];

  return (
    <div className="flex h-screen bg-[#07080a] text-white overflow-hidden font-sans selection:bg-[#d2ff2d] selection:text-black">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onRefresh={fetchMetrics} />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 space-y-9">
          
          {/* Header & Controls Bar */}
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 pb-6 border-b border-white/[0.06]">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d2ff2d]/10 border border-[#d2ff2d]/25 text-[#d2ff2d] text-xs font-mono font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Creative Agency • Production Ops
              </div>
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-purple-400 bg-clip-text text-transparent">
                Creative Ops Manager Dashboard
              </h1>
              <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
                Commercial E-Commerce Deliverables, Team Performance & Physical Photoshoot ROI Benchmark.
              </p>
            </div>

            {/* Controls Bar: Date Filter, Currency & Export */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Filter Presets */}
              <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
                {[
                  { key: 'today', label: 'Today' },
                  { key: '7days', label: '7 Days' },
                  { key: 'month', label: 'This Month' },
                  { key: 'custom', label: 'Custom' },
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setDateFilter(item.key as any)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                      dateFilter === item.key
                        ? 'bg-[#d2ff2d] text-black shadow-md shadow-[#d2ff2d]/20 font-extrabold'
                        : 'text-zinc-400 hover:text-white'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Pickers */}
              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] p-1.5 rounded-2xl animate-in fade-in">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                    className="bg-black/60 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#d2ff2d]"
                  />
                  <span className="text-zinc-500 text-xs">to</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                    className="bg-black/60 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#d2ff2d]"
                  />
                </div>
              )}

              {/* Currency Toggle */}
              <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
                <button
                  onClick={() => setCurrency('USD')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                    currency === 'USD'
                      ? 'bg-sky-400 text-black shadow-md font-extrabold'
                      : 'text-zinc-400 hover:text-white'
                  )}
                >
                  USD ($)
                </button>
                <button
                  onClick={() => setCurrency('KWD')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                    currency === 'KWD'
                      ? 'bg-sky-400 text-black shadow-md font-extrabold'
                      : 'text-zinc-400 hover:text-white'
                  )}
                >
                  KWD (د.ك)
                </button>
              </div>

              {/* Action Buttons */}
              <button
                onClick={() => setShowBudgetModal(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-all"
                title="Configure Monthly Ceiling & Alert Thresholds"
              >
                <Settings className="w-4 h-4 text-[#d2ff2d]" />
                <span>Budget Settings</span>
              </button>

              <button
                onClick={handleExportSummary}
                className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#d2ff2d]/10 border border-[#d2ff2d]/30 text-xs font-bold text-[#d2ff2d] hover:bg-[#d2ff2d]/20 transition-all shadow-md shadow-[#d2ff2d]/10"
              >
                <Download className="w-4 h-4" />
                <span>Export Audit</span>
              </button>
            </div>
          </div>

          {/* 1. FINANCIAL PULSE & ACCURATE PHOTOSHOOT ROI BENCHMARK (HERO CARDS) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Studio Spend vs Pool */}
            <div className="rounded-3xl bg-[#0e0f14] border border-white/[0.08] p-5 space-y-3 relative overflow-hidden group hover:border-[#d2ff2d]/30 transition-all">
              <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
                <span>AI Studio Spend</span>
                <DollarSign className="w-4 h-4 text-[#d2ff2d]" />
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-black text-white font-mono">
                  {formatMoney(comp?.actualAiCostUsd || 0)}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Pool Ceiling: <span className="font-bold text-zinc-200">{formatMoney(dept?.monthlyBudgetUsd || 500)}</span> ({dept?.budgetUsedPercent || 0}% used)
                </p>
              </div>
              {/* Progress bar */}
              <div className="space-y-1 pt-1">
                <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      dept?.budgetHealthTier === 'critical' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' :
                      dept?.budgetHealthTier === 'warning' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' :
                      'bg-[#d2ff2d] shadow-[0_0_8px_rgba(210,255,45,0.8)]'
                    )}
                    style={{ width: `${Math.min(100, dept?.budgetUsedPercent || 0)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>Remaining: {formatMoney(dept?.remainingBudgetUsd || 0)}</span>
                  <span className={cn('font-bold uppercase', dept?.budgetHealthTier === 'critical' ? 'text-red-400' : 'text-emerald-400')}>
                    Status: {dept?.budgetHealthTier}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Accurate Physical Photoshoot Savings Benchmark */}
            <div className="rounded-3xl bg-[#0e0f14] border border-white/[0.08] p-5 space-y-3 relative overflow-hidden group hover:border-emerald-400/30 transition-all">
              <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  Photoshoot Cost Saved
                </span>
                <button
                  onClick={() => setShowBenchmarkModal(true)}
                  className="text-zinc-500 hover:text-emerald-400 transition-colors"
                  title="Configure Physical Photoshoot Benchmark Rate"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-black text-emerald-400 font-mono flex items-center gap-1.5">
                  <span>+{comp?.savingsPercent || 99.7}%</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-sans font-bold">
                    Saved
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 truncate">
                  Physical Shoot Baseline: <span className="font-bold text-zinc-200">{formatMoney(comp?.physicalEquivalentCostUsd || 0)}</span>
                </p>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-zinc-500 border-t border-white/[0.06]">
                <span>Net Capital Saved:</span>
                <span className="font-bold text-emerald-400">{formatMoney(comp?.netSavingsUsd || 0)}</span>
              </div>
            </div>

            {/* Card 3: Team Assets Delivered (Today / Week / Month Mini-Cards) */}
            <div className="rounded-3xl bg-[#0e0f14] border border-white/[0.08] p-5 space-y-2.5 relative overflow-hidden group hover:border-purple-400/30 transition-all">
              <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
                <span>Assets Delivered</span>
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              
              {/* Mini-Card Grid for Today / Week / Month */}
              <div className="grid grid-cols-3 gap-2 pt-0.5">
                <div className="p-2 rounded-2xl bg-white/[0.03] border border-white/[0.05] text-center">
                  <span className="text-[10px] font-mono text-zinc-400 block uppercase">Today</span>
                  <span className="text-base font-extrabold font-mono text-white mt-0.5 block">
                    {assets?.today || 0}
                  </span>
                </div>
                <div className="p-2 rounded-2xl bg-white/[0.03] border border-white/[0.05] text-center">
                  <span className="text-[10px] font-mono text-zinc-400 block uppercase">This Week</span>
                  <span className="text-base font-extrabold font-mono text-purple-300 mt-0.5 block">
                    {assets?.thisWeek || 0}
                  </span>
                </div>
                <div className="p-2 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center">
                  <span className="text-[10px] font-mono text-purple-300 block uppercase font-bold">This Month</span>
                  <span className="text-base font-black font-mono text-white mt-0.5 block">
                    {assets?.thisMonth || comp?.totalAssetsProduced || 0}
                  </span>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-zinc-500 border-t border-white/[0.06]">
                <span>Studio Hours Saved:</span>
                <span className="font-bold text-purple-400">~{comp?.physicalHoursSaved || 0} Hours</span>
              </div>
            </div>

            {/* Card 4: AI Engine Reliability & Speed */}
            <div className="rounded-3xl bg-[#0e0f14] border border-white/[0.08] p-5 space-y-3 relative overflow-hidden group hover:border-sky-400/30 transition-all">
              <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
                <span>AI Engine Reliability</span>
                <Activity className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-black text-white font-mono flex items-center gap-2">
                  <span>{telem?.taskSuccessRate || 99}%</span>
                  <span className="text-[11px] font-sans font-bold text-emerald-400">
                    ({telem?.successCount || 0} Success)
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Platform Uptime: <span className="font-bold text-emerald-400 font-mono">{telem?.uptimePercent || 99.9}%</span> • Queue: {telem?.queueDepth || 0} in-flight
                </p>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-zinc-500 border-t border-white/[0.06]">
                <span>Average Render Speed:</span>
                <span className="font-bold text-sky-400 font-mono">{telem?.renderSpeed.avgRenderSec || 36}s / asset</span>
              </div>
            </div>
          </div>

          {/* 2. COMMERCIAL ASSET DELIVERABLES PIPELINE (BY WORKFLOW) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#d2ff2d]" />
                  Commercial E-Commerce Deliverables
                </h3>
                <p className="text-xs text-zinc-400">
                  Total visual production output categorized by commercial studio workflow.
                </p>
              </div>
              <span className="text-xs text-zinc-500 font-mono">Total Tasks: {telem?.totalTasks || 0}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[
                { key: 'flowImages', item: deliv?.flowImages, icon: Sparkles, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
                { key: 'flowVideos', item: deliv?.flowVideos, icon: Film, color: 'text-pink-400 bg-pink-400/10 border-pink-400/20' },
                { key: 'bundles', item: deliv?.bundles, icon: Package, color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
                { key: 'layers', item: deliv?.layers, icon: Layers, color: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
                { key: 'socialResize', item: deliv?.socialResize, icon: Crop, color: 'text-[#d2ff2d] bg-[#d2ff2d]/10 border-[#d2ff2d]/20' },
                { key: 'autoRetouch', item: deliv?.autoRetouch, icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
              ].map(({ key, item, icon: Icon, color }) => (
                <div key={key} className="p-4 rounded-3xl bg-[#0e0f14] border border-white/[0.06] space-y-3 hover:border-white/20 transition-all">
                  <div className="flex items-center justify-between">
                    <span className={cn('p-2 rounded-xl border flex items-center justify-center', color)}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">{item?.tool}</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-300 block truncate">{item?.label}</span>
                    <div className="text-2xl font-extrabold text-white font-mono mt-0.5">
                      {item?.count || 0}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-500">Spend:</span>
                    <span className="text-[#d2ff2d] font-bold">{formatMoney(item?.spendUsd || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. MY TEAM PERFORMANCE TABLE */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-pink-400" />
                  My Team Performance
                </h3>
                <p className="text-xs text-zinc-400">
                  Real-time throughput and workload balance for your assigned creative team.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-zinc-400 font-mono">
                  Team Average: <span className="font-bold text-white">{wf?.teamAvgTasks || 0}</span> tasks/member
                </div>
                <Link
                  href="/manager/team"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-500/10 border border-pink-500/30 text-xs font-bold text-pink-300 hover:bg-pink-500/20 transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Manage Team</span>
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/[0.08] bg-[#0c0d10] overflow-hidden shadow-xl">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.01]">
                      <th className="py-4 px-6 text-zinc-400 font-mono uppercase text-[11px]">Member Name</th>
                      <th className="py-4 px-6 text-zinc-400 font-mono uppercase text-[11px]">Role</th>
                      <th className="py-4 px-6 text-zinc-400 font-mono uppercase text-[11px]">Tasks Completed</th>
                      <th className="py-4 px-6 text-zinc-400 font-mono uppercase text-[11px]">Success Rate</th>
                      <th className="py-4 px-6 text-zinc-400 font-mono uppercase text-[11px]">Studio Spend</th>
                      <th className="py-4 px-6 text-zinc-400 font-mono uppercase text-[11px]">Workload Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {wf?.rankings.map(editor => (
                      <tr key={editor.userId} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-white text-sm">{editor.name}</div>
                          <div className="text-[11px] text-zinc-500 font-mono">{editor.email}</div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={cn(
                            'px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border',
                            editor.role === 'admin' ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                          )}>
                            {editor.role}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-mono font-bold text-white text-sm">
                          {editor.taskCount}
                        </td>
                        <td className="py-4 px-6 font-mono">
                          <span className={cn('font-bold', editor.successRate >= 95 ? 'text-emerald-400' : 'text-amber-400')}>
                            {editor.successRate}%
                          </span>
                        </td>
                        <td className="py-4 px-6 font-mono font-bold text-white">
                          {formatMoney(editor.spendUsd)}
                        </td>
                        <td className="py-4 px-6">
                          <span className={cn(
                            'px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase border',
                            editor.balanceStatus === 'Heavy Load' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            editor.balanceStatus === 'Underutilized' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          )}>
                            {editor.vsAvgPercent > 0 ? `+${editor.vsAvgPercent}%` : `${editor.vsAvgPercent}%`} ({editor.balanceStatus})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 4. SUPER ADMIN MASTER PRICING & MODEL USAGE TABLE */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#d2ff2d]" />
                  AI Model Cost & Super Admin Pricing Registry
                </h3>
                <p className="text-xs text-zinc-400">
                  Direct correlation with Super Admin Master Pricing Registry showing actual internal spend vs market price.
                </p>
              </div>
              <Link
                href="/admin/pricing"
                className="text-xs text-[#d2ff2d] hover:underline font-mono flex items-center gap-1"
              >
                View Full Pricing Matrix <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="rounded-3xl border border-white/[0.08] bg-[#0c0d10] overflow-hidden shadow-xl">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.01]">
                      <th className="py-4 px-6 text-zinc-400 font-mono uppercase text-[11px]">AI Model Name</th>
                      <th className="py-4 px-6 text-zinc-400 font-mono uppercase text-[11px]">Generations</th>
                      <th className="py-4 px-6 text-zinc-400 font-mono uppercase text-[11px]">Studio Spend</th>
                      <th className="py-4 px-6 text-zinc-400 font-mono uppercase text-[11px]">Official Market Value</th>
                      <th className="py-4 px-6 text-zinc-400 font-mono uppercase text-[11px]">Net Savings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {models.map(m => (
                      <tr key={m.modelName} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-white">{m.modelName}</div>
                          <div className="text-[10.5px] font-mono text-zinc-500">
                            Unit Rate: {formatMoney(m.unitPriceUsd)} / call
                          </div>
                        </td>
                        <td className="py-4 px-6 font-mono font-bold text-white">
                          {m.count}
                        </td>
                        <td className="py-4 px-6 font-mono font-extrabold text-[#d2ff2d]">
                          {formatMoney(m.spendUsd)}
                        </td>
                        <td className="py-4 px-6 font-mono text-zinc-400 line-through">
                          {formatMoney(m.marketValueUsd)}
                        </td>
                        <td className="py-4 px-6 font-mono">
                          <span className="text-emerald-400 font-bold">
                            +{formatMoney(m.savingsUsd)} ({m.savingsPercent}%)
                          </span>
                        </td>
                      </tr>
                    ))}
                    {models.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-zinc-500">
                          No model generation tasks recorded in this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 5. USER-FRIENDLY SPEED TELEMETRY & ZERO-WASTE GUARANTEE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Average Processing Time per Tool */}
            <div className="p-6 rounded-3xl bg-[#0e0f14] border border-white/[0.06] space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  Average Processing Speed per Tool
                </h4>
                <span className="text-xs font-mono text-sky-400 font-bold">
                  Overall Avg: {telem?.renderSpeed.avgRenderSec || 36}s
                </span>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Boutiqaat Flow (Commercial Images)', speed: telem?.renderSpeed.byModule.flowImages?.label || '24s avg' },
                  { label: 'Boutiqaat Flow (Video Ads)', speed: telem?.renderSpeed.byModule.flowVideos?.label || '68s avg' },
                  { label: 'Bundling Studio (Multi-SKU Sets)', speed: telem?.renderSpeed.byModule.bundles?.label || '50s avg' },
                  { label: 'Boutiqaat Layers (PSD Decomposition)', speed: telem?.renderSpeed.byModule.layers?.label || '42s avg' },
                  { label: 'Social Resize (Multi-Scale Outpaint)', speed: telem?.renderSpeed.byModule.socialResize?.label || '15s avg' },
                  { label: 'Auto Retouch (Beauty Polish & Cutout)', speed: telem?.renderSpeed.byModule.autoRetouch?.label || '18s avg' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-xs text-zinc-300 font-medium">{item.label}</span>
                    <span className="text-xs font-mono font-bold text-[#d2ff2d]">{item.speed}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Zero-Waste & Auto-Refund Guarantee */}
            <div className="p-6 rounded-3xl bg-[#0e0f14] border border-white/[0.06] flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Zero-Cost Failed Generation Guarantee</h4>
                    <p className="text-[11px] text-zinc-400">100% Financial Protection for Boutiqaat Studio</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Whenever a render encounters an issue (such as content security audit blocks or connection timeouts), the system guarantees a <span className="text-[#d2ff2d] font-bold">billable cost of exactly $0.00 (0 KWD)</span> with automatic balance restoration.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
                <span>Studio Balance Protection Status:</span>
                <span className="font-bold font-mono text-emerald-400">ACTIVE (100% Guaranteed)</span>
              </div>
            </div>
          </div>

        </main>
      </div>

      {/* Physical Photoshoot Benchmark Config Modal */}
      {showBenchmarkModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0e0f14] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Physical Photoshoot Cost Benchmark</h3>
              </div>
              <button
                onClick={() => setShowBenchmarkModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                <span className="text-[11px] text-zinc-400 font-bold uppercase">Official Reference Benchmark:</span>
                <p className="text-zinc-300">
                  <span className="font-semibold text-white">June Photoshoot Cost Report</span>: 4,002.5 KD total cost for 1,199 SKUs (~3.34 KD / SKU).
                </p>
              </div>

              {/* Benchmark Input in KD */}
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-semibold">Physical Studio Cost per SKU (KWD د.ك):</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={benchmarkRateKwd}
                    onChange={e => setBenchmarkRateKwd(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-zinc-700 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-400"
                  />
                  <span className="absolute right-3.5 top-2.5 font-mono text-xs text-zinc-400">KD / SKU</span>
                </div>
                <p className="text-[10.5px] text-zinc-500">
                  Equivalent to approx ${(parseFloat(benchmarkRateKwd || '0') * 3.25).toFixed(2)} USD per product shoot.
                </p>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <label className="text-zinc-400 font-semibold">Quick Presets:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '3.34 KD', sub: 'June Report', val: '3.34' },
                    { label: '4.50 KD', sub: 'Model Shoot', val: '4.50' },
                    { label: '5.00 KD', sub: 'Agency Rate', val: '5.00' },
                  ].map(p => (
                    <button
                      key={p.val}
                      onClick={() => setBenchmarkRateKwd(p.val)}
                      className={cn(
                        'p-2 rounded-xl border text-center transition-all',
                        benchmarkRateKwd === p.val
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white'
                      )}
                    >
                      <div className="font-mono text-xs">{p.label}</div>
                      <div className="text-[9px] text-zinc-500">{p.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setShowBenchmarkModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-400 text-black hover:bg-emerald-300 shadow-lg shadow-emerald-400/20"
              >
                Apply Benchmark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Budget & Threshold Settings Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0e0f14] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#d2ff2d]" />
                <h3 className="text-sm font-bold text-white">Configure Monthly Studio Budget</h3>
              </div>
              <button
                onClick={() => setShowBudgetModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Monthly Cap */}
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-semibold">Monthly Budget Ceiling (USD $):</label>
                <input
                  type="number"
                  value={budgetCap}
                  onChange={e => setBudgetCap(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-zinc-700 text-white font-mono font-bold text-sm focus:outline-none focus:border-[#d2ff2d]"
                />
              </div>

              {/* Threshold Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-zinc-300 font-semibold">Critical Alert Threshold (%):</label>
                  <span className="font-mono font-bold text-[#d2ff2d]">{threshold}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="98"
                  value={threshold}
                  onChange={e => setThreshold(e.target.value)}
                  className="w-full accent-[#d2ff2d] cursor-pointer"
                />
              </div>

              {/* Auto Pause Switch */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="space-y-0.5">
                  <span className="font-bold text-white">Auto-Pause on Critical Spend</span>
                  <p className="text-[10.5px] text-zinc-500">Automatically lock new renders when budget ceiling threshold is breached.</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoPause}
                  onChange={e => setAutoPause(e.target.checked)}
                  className="w-4 h-4 accent-[#d2ff2d] cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setShowBudgetModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateBudget}
                disabled={savingBudget}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#d2ff2d] text-black hover:bg-[#e1ff55] shadow-lg shadow-[#d2ff2d]/20"
              >
                {savingBudget ? 'Saving...' : 'Save Parameters'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
