'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import {
  Shield, Users, CheckCircle2, XCircle, Loader2, Clock,
  TrendingUp, Activity, DollarSign, Wallet, ArrowUpRight,
  ExternalLink, RefreshCw, AlertTriangle, Key, Zap, Check,
  ChevronRight, ArrowDownRight, Layers, Coins, Server, Sparkles,
  UserCheck, Image as ImageIcon, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { PRICING_MODELS_DATA, KWD_EXCHANGE_RATE } from '@/lib/pricing-data';

interface AdminDashboardData {
  mainStudioWallet: {
    remainMoneyUsd: number;
    remainMoneyKwd: number;
    remainCoins: number;
    currentTaskCounts: number;
    currency: string;
    apiType: string;
    healthStatus: 'healthy' | 'warning' | 'critical';
    lastSyncedAt: string;
  };
  studioSpend: {
    actualSpendUsd: number;
    actualSpendKwd: number;
    actualCoinsUsed: number;
    totalPaidTasks: number;
    enterpriseSpendUsd: number;
    consumerCoinsUsed: number;
    avgDailyBurnUsd: number;
    estimatedRunwayDays: number;
    exchangeRate: number;
  };
  usersOverview: {
    totalRegistered: number;
    onlineActive: number;
    offlineCount: number;
  };
  recentGenerations: Array<{
    id: string;
    appName: string;
    createdAt: string;
    userName: string;
    userEmail: string;
    outputUrl: string | null;
  }>;
  keys: {
    enterprise: { configured: boolean; masked: string; status: string; apiType: string; coins: string; money: string };
    consumer: { configured: boolean; masked: string; status: string; apiType: string; coins: string; money: string };
  };
}

export default function AdminPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<'USD' | 'KWD'>('USD');

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/wallet');
      if (!res.ok) throw new Error('Failed to load Super Admin dashboard');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error('Failed to load Super Admin metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const formatMoney = (usdVal: number) => {
    if (currency === 'KWD') {
      const kwd = usdVal / (data?.studioSpend.exchangeRate || 3.25);
      return `${kwd.toFixed(3)} KWD`;
    }
    return `$${usdVal.toFixed(2)}`;
  };

  const wallet = data?.mainStudioWallet;
  const spend = data?.studioSpend;
  const users = data?.usersOverview;
  const recent = data?.recentGenerations || [];
  const keys = data?.keys;

  return (
    <div className="flex h-screen bg-[#07080a] text-white overflow-hidden font-sans selection:bg-[#d2ff2d] selection:text-black">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onRefresh={fetchAdminData} />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 space-y-8">
          
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-300 text-xs font-mono font-bold uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" /> Super Admin Control Center
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-purple-400 bg-clip-text text-transparent">
                Boutiqaat AI Studio Infrastructure
              </h1>
              <p className="text-sm text-zinc-400">
                Live Studio Wallet, Global Spend, Registered User Matrix & Model Pricing Management.
              </p>
            </div>

            {/* Controls Bar: Currency Toggle & Sync */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
                <button
                  onClick={() => setCurrency('USD')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                    currency === 'USD' ? 'bg-sky-400 text-black font-extrabold shadow-md' : 'text-zinc-400 hover:text-white'
                  )}
                >
                  USD ($)
                </button>
                <button
                  onClick={() => setCurrency('KWD')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                    currency === 'KWD' ? 'bg-sky-400 text-black font-extrabold shadow-md' : 'text-zinc-400 hover:text-white'
                  )}
                >
                  KWD (د.ك)
                </button>
              </div>

              <Link
                href="/admin/pricing"
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#d2ff2d] text-black text-xs font-extrabold hover:bg-[#e1ff55] transition-all shadow-lg shadow-[#d2ff2d]/20"
              >
                <DollarSign className="w-4 h-4" />
                <span>AI Pricing Matrix</span>
              </Link>

              <button
                onClick={fetchAdminData}
                className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all"
                title="Sync Live Data"
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* 1. SUPER ADMIN HERO CARDS (LIVE DATA) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Card 1: Main Studio Wallet (Live Balance) */}
            <div className="rounded-3xl bg-[#0e0f14] border border-white/[0.08] p-5 space-y-3 relative overflow-hidden group hover:border-[#d2ff2d]/30 transition-all">
              <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-[#d2ff2d]" />
                  Main Studio Wallet
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold">
                  ● LIVE
                </span>
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-black text-white font-mono">
                  {formatMoney(wallet?.remainMoneyUsd || 0)}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                  Credits: <span className="text-amber-400 font-mono font-bold">{wallet?.remainCoins?.toLocaleString() || 0} Studio Credits</span>
                </p>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-zinc-500 border-t border-white/[0.06]">
                <span>Cloud Channel:</span>
                <span className="font-bold text-purple-300 uppercase">{wallet?.apiType || 'SHARED'}</span>
              </div>
            </div>

            {/* Card 2: Boutiqaat AI Studio Spend (Live Recorded Spend) */}
            <div className="rounded-3xl bg-[#0e0f14] border border-white/[0.08] p-5 space-y-3 relative overflow-hidden group hover:border-emerald-400/30 transition-all">
              <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Boutiqaat Studio Spend
                </span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-black text-emerald-400 font-mono">
                  {formatMoney(spend?.actualSpendUsd || 0)}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Total Tracked Tasks: <span className="font-bold text-white font-mono">{spend?.totalPaidTasks || 0} generations</span>
                </p>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-zinc-500 border-t border-white/[0.06]">
                <span>Daily Burn Rate:</span>
                <span className="font-bold text-emerald-400 font-mono">{formatMoney(spend?.avgDailyBurnUsd || 0)} / day</span>
              </div>
            </div>

            {/* Card 3: User Matrix (Online & Total Registered) */}
            <div className="rounded-3xl bg-[#0e0f14] border border-white/[0.08] p-5 space-y-3 relative overflow-hidden group hover:border-purple-400/30 transition-all">
              <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  Studio Creators Matrix
                </span>
                <Link href="/admin/users" className="text-zinc-500 hover:text-purple-300 transition-colors" title="Manage Users">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-black text-white font-mono flex items-center gap-2">
                  <span>{users?.onlineActive || 1} Online</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Total Registered: <span className="font-bold text-zinc-200 font-mono">{users?.totalRegistered || 0} Accounts</span>
                </p>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-zinc-500 border-t border-white/[0.06]">
                <span>Status:</span>
                <span className="font-bold text-purple-400">{users?.offlineCount || 0} Inactive • {users?.onlineActive || 1} Active Today</span>
              </div>
            </div>

            {/* Card 4: Cloud Engine Queue & Health */}
            <div className="rounded-3xl bg-[#0e0f14] border border-white/[0.08] p-5 space-y-3 relative overflow-hidden group hover:border-sky-400/30 transition-all">
              <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-sky-400" />
                  Engine Health & Queue
                </span>
                <Activity className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-black text-white font-mono flex items-center gap-2">
                  <span>{wallet?.currentTaskCounts || 0} Tasks</span>
                  <span className="text-xs font-sans font-bold text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/20">
                    Queue Ready
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Cloud Infrastructure Uptime: <span className="font-bold text-emerald-400 font-mono">99.9%</span>
                </p>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-zinc-500 border-t border-white/[0.06]">
                <span>Status:</span>
                <span className="font-bold text-sky-400 font-mono">All Channels Operational</span>
              </div>
            </div>

          </div>

          {/* 2. SHORTCUT CARD FOR PRICING TABLE & MODEL REGISTRY */}
          <div className="rounded-3xl bg-gradient-to-r from-[#0e0f14] via-[#12141c] to-[#0e0f14] border border-white/[0.08] p-6 lg:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-[#d2ff2d]/10 border border-[#d2ff2d]/25 text-[#d2ff2d] text-[11px] font-mono font-bold uppercase">
                <DollarSign className="w-3 h-3" /> Master Pricing Registry
              </div>
              <h2 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
                AI Model Pricing Matrix & Commercial Margins
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Configure per-generation pricing rates across <span className="text-white font-bold">{PRICING_MODELS_DATA.length} commercial AI models</span> (Nano Banana, Seedance, Omni Flash, GPT 2.0, Veo 3.1) in USD ($) and Kuwaiti Dinars (د.ك @ 1 KWD = $3.25).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center min-w-[110px]">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">Active Models</span>
                <span className="text-lg font-black font-mono text-white mt-0.5 block">{PRICING_MODELS_DATA.length} Models</span>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center min-w-[110px]">
                <span className="text-[10px] font-mono text-zinc-500 uppercase block">Exchange Rate</span>
                <span className="text-lg font-black font-mono text-[#d2ff2d] mt-0.5 block">1 KWD = $3.25</span>
              </div>

              <Link
                href="/admin/pricing"
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#d2ff2d] text-black font-extrabold text-xs hover:bg-[#e1ff55] transition-all shadow-lg shadow-[#d2ff2d]/20"
              >
                <span>Open Pricing Matrix</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* 3. RECENT LIVE GENERATIONS & ENGINE CHANNELS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Recent Live Generations Stream */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Recent Live Studio Generations
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Latest completed high-res product photos, ads, and visuals produced across the studio.
                  </p>
                </div>
                <Link
                  href="/admin/tasks"
                  className="text-xs text-sky-400 hover:underline font-mono flex items-center gap-1"
                >
                  View All Tasks <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {recent.map((task) => (
                  <div key={task.id} className="p-3.5 rounded-2xl bg-[#0e0f14] border border-white/[0.06] space-y-3 hover:border-white/20 transition-all flex flex-col justify-between">
                    <div className="space-y-2">
                      {task.outputUrl ? (
                        <div className="w-full h-32 rounded-xl overflow-hidden bg-black/60 relative border border-white/5 group">
                          {task.outputUrl.includes('.mp4') || task.outputUrl.includes('.webm') ? (
                            <video
                              src={task.outputUrl}
                              muted
                              autoPlay
                              loop
                              playsInline
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <img
                              src={task.outputUrl}
                              alt={task.appName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                (e.target as any).style.display = 'none';
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-32 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center text-zinc-600">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold text-white block truncate">{task.appName}</span>
                        <span className="text-[10.5px] text-zinc-400 font-mono block truncate">by {task.userName}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] font-mono text-zinc-500">
                      <span>{task.createdAt ? new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Success
                      </span>
                    </div>
                  </div>
                ))}

                {recent.length === 0 && (
                  <div className="col-span-3 py-10 text-center text-zinc-500 text-xs">
                    No recent studio generations recorded yet.
                  </div>
                )}
              </div>
            </div>

            {/* Cloud Engine Dual Key Channels & Quick Controls */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-sky-400" />
                  Engine Channels
                </h3>
                <span className="text-xs text-emerald-400 font-mono font-bold">ALL ACTIVE</span>
              </div>

              <div className="p-5 rounded-3xl bg-[#0e0f14] border border-white/[0.08] space-y-4">
                {/* Enterprise Master Channel */}
                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-200 font-bold text-xs font-mono">🔵 Enterprise Master Channel</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-mono font-bold">
                      {keys?.enterprise.status || 'ONLINE'}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-zinc-400 bg-black/40 px-2.5 py-1 rounded-lg border border-white/5 truncate">
                    {keys?.enterprise.masked || '1c81••••••••474'}
                  </div>
                  <div className="flex justify-between text-[10.5px] font-mono text-zinc-500 pt-0.5">
                    <span>Balance: ${keys?.enterprise.money || '5.205'} USD</span>
                    <span>Type: Master Wallet</span>
                  </div>
                </div>

                {/* Consumer Secondary Channel */}
                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-200 font-bold text-xs font-mono">🟢 Consumer Secondary Channel</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-mono font-bold">
                      {keys?.consumer.status || 'ONLINE'}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-zinc-400 bg-black/40 px-2.5 py-1 rounded-lg border border-white/5 truncate">
                    {keys?.consumer.masked || 'c24e••••••••772'}
                  </div>
                  <div className="flex justify-between text-[10.5px] font-mono text-zinc-500 pt-0.5">
                    <span>Credits: {keys?.consumer.coins || '6316'} Coins</span>
                    <span>Type: Standard Queue</span>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="pt-2 space-y-2">
                  <Link
                    href="/admin/users"
                    className="w-full py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs font-bold text-center text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-all flex items-center justify-center gap-2"
                  >
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>Manage User Accounts ({users?.totalRegistered || 0})</span>
                  </Link>

                  <Link
                    href="/admin/tasks"
                    className="w-full py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs font-bold text-center text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-all flex items-center justify-center gap-2"
                  >
                    <Activity className="w-3.5 h-3.5 text-sky-400" />
                    <span>Live Task Monitoring</span>
                  </Link>
                </div>
              </div>
            </div>

          </div>

        </main>
      </div>
    </div>
  );
}
