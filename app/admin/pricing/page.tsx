'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import {
  Shield, Search, TrendingDown, Layers, Sparkles,
  ArrowUpRight, Info, Zap,
  Film, Music, Image as ImageIcon, DollarSign, Wallet,
  Calculator, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRICING_MODELS_DATA, KWD_EXCHANGE_RATE, PricingModelItem } from '@/lib/pricing-data';

interface CalculatorState {
  quantity: number;
  durationSec: number;
  chars: number;
  extraImages: number;
}

export default function AdminPricingPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'image' | 'layers' | 'video' | 'audio'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'KWD'>('USD');
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const [openCalculators, setOpenCalculators] = useState<Record<string, boolean>>({});
  const [calcStates, setCalcStates] = useState<Record<string, CalculatorState>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.user) setUserRole(d.user.role);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Initialize first option and default calc state for every model
  useEffect(() => {
    const initialOptions: Record<string, number> = {};
    const initialCalcs: Record<string, CalculatorState> = {};
    PRICING_MODELS_DATA.forEach(m => {
      initialOptions[m.id] = 0;
      initialCalcs[m.id] = {
        quantity: m.category === 'audio' ? (m.id.includes('tts') ? 1 : 10) : (m.category === 'video' ? 5 : 100),
        durationSec: 8,
        chars: 10000,
        extraImages: 0,
      };
    });
    setSelectedOptions(initialOptions);
    setCalcStates(initialCalcs);
  }, []);

  const handleOptionChange = (modelId: string, optionIndex: number) => {
    setSelectedOptions(prev => ({ ...prev, [modelId]: optionIndex }));
  };

  const toggleCalculator = (modelId: string) => {
    setOpenCalculators(prev => ({ ...prev, [modelId]: !prev[modelId] }));
  };

  const updateCalcState = (modelId: string, patch: Partial<CalculatorState>) => {
    setCalcStates(prev => ({
      ...prev,
      [modelId]: {
        ...(prev[modelId] || { quantity: 100, durationSec: 8, chars: 10000, extraImages: 0 }),
        ...patch,
      },
    }));
  };

  const filteredModels = useMemo(() => {
    return PRICING_MODELS_DATA.filter(m => {
      const matchCategory = activeTab === 'all' || m.category === activeTab;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.desc.toLowerCase().includes(q) ||
        m.options.some(o => o.name.toLowerCase().includes(q) || (o.notes && o.notes.toLowerCase().includes(q)));
      return matchCategory && matchSearch;
    });
  }, [activeTab, searchQuery]);

  const formatPrice = (usdVal: number | null) => {
    if (usdVal === null || usdVal === undefined) return '—';
    if (currency === 'KWD') {
      const kwdVal = usdVal / KWD_EXCHANGE_RATE;
      return `${kwdVal.toFixed(4)} KWD`;
    }
    return `$${usdVal >= 1 ? usdVal.toFixed(2) : usdVal.toFixed(3)}`;
  };

  const formatTotalMoney = (usdVal: number) => {
    if (currency === 'KWD') {
      const kwdVal = usdVal / KWD_EXCHANGE_RATE;
      return `${kwdVal.toFixed(3)} KWD`;
    }
    return `$${usdVal.toFixed(2)}`;
  };

  const getCategoryDotColor = (category: string) => {
    switch (category) {
      case 'image': return 'bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.7)]';
      case 'video': return 'bg-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.7)]';
      case 'audio': return 'bg-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.7)]';
      case 'layers': return 'bg-[#d2ff2d] shadow-[0_0_10px_rgba(210,255,45,0.7)]';
      default: return 'bg-zinc-400 shadow-[0_0_10px_rgba(161,161,170,0.7)]';
    }
  };

  // Helper to compute cost calculations for a given model and its selected option
  const computeModelCost = (model: PricingModelItem, optIdx: number) => {
    const opt = model.options[optIdx] || model.options[0];
    const calc = calcStates[model.id] || { quantity: 100, durationSec: 8, chars: 10000, extraImages: 0 };
    
    let totalBoutiqaat = 0;
    let totalOfficial = 0;
    let unitLabel = opt.unit;

    if (model.category === 'image' || model.category === 'layers') {
      const qty = calc.quantity || 1;
      totalBoutiqaat = qty * opt.price;
      totalOfficial = opt.official !== null ? qty * opt.official : 0;
    } else if (model.category === 'video') {
      if (opt.unit === 'Sec') {
        const dur = calc.durationSec || 5;
        const clips = calc.quantity || 1;
        let baseCost = dur * opt.price * clips;
        // Minimax H3 extra images rule
        if (model.id === 'minimax-h3-multimodal' && calc.extraImages > 0) {
          baseCost += calc.extraImages * 0.04 * clips;
        }
        totalBoutiqaat = baseCost;
        totalOfficial = opt.official !== null ? (dur * opt.official * clips) : 0;
      } else {
        // Per Call / Fixed (e.g. Gemini Omni Flash, Google Veo Fast)
        const clips = calc.quantity || 1;
        totalBoutiqaat = clips * opt.price;
        totalOfficial = opt.official !== null ? clips * opt.official : 0;
      }
    } else if (model.category === 'audio') {
      if (opt.unit === 'Sec') {
        const dur = Math.min(120, calc.durationSec || 30);
        totalBoutiqaat = dur * opt.price;
        totalOfficial = opt.official !== null ? dur * opt.official : 0;
      } else if (opt.unit === '10k Ch') {
        const unitsOf10k = Math.max(1, (calc.chars || 10000) / 10000);
        totalBoutiqaat = unitsOf10k * opt.price;
        totalOfficial = opt.official !== null ? unitsOf10k * opt.official : 0;
      } else {
        // Per song
        const songs = calc.quantity || 1;
        totalBoutiqaat = songs * opt.price;
        totalOfficial = opt.official !== null ? songs * opt.official : 0;
      }
    }

    const netSavings = totalOfficial > totalBoutiqaat ? (totalOfficial - totalBoutiqaat) : 0;
    const savingPercent = totalOfficial > 0 ? ((netSavings / totalOfficial) * 100).toFixed(1) : '0.0';

    return {
      totalBoutiqaat,
      totalOfficial,
      netSavings,
      savingPercent,
      unitLabel,
    };
  };

  if (!loading && userRole && userRole !== 'admin') {
    return (
      <div className="flex h-screen bg-[#07080a] text-white">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar />
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div className="max-w-md p-8 rounded-3xl bg-red-950/20 border border-red-500/30 space-y-4">
              <Shield className="w-12 h-12 text-red-400 mx-auto" />
              <h2 className="text-xl font-bold">Access Restricted</h2>
              <p className="text-sm text-zinc-400">
                The AI Model Pricing Matrix is exclusively available to Super Administrators.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#07080a] text-white overflow-hidden font-sans selection:bg-[#d2ff2d] selection:text-black">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 space-y-10">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/[0.06]">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d2ff2d]/10 border border-[#d2ff2d]/25 text-[#d2ff2d] text-xs font-mono font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Super Admin AI Cost Matrix & Live Estimator
              </div>
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-purple-400 bg-clip-text text-transparent">
                Transparent Pricing, Built for Scale
              </h1>
              <p className="text-sm lg:text-base text-zinc-400 leading-relaxed">
                Break free from the subscription trap. Access leading AI models with live cost calculators, batch volume projections, and up to 96% lower costs.
              </p>
            </div>

            {/* Currency Switcher */}
            <div className="flex items-center gap-3 bg-[#0d0e12] border border-white/[0.08] p-1.5 rounded-2xl shrink-0 self-start md:self-auto shadow-lg">
              <span className="text-xs font-semibold text-zinc-400 px-2 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-[#d2ff2d]" /> Currency:
              </span>
              <button
                onClick={() => setCurrency('USD')}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all',
                  currency === 'USD'
                    ? 'bg-[#d2ff2d] text-black shadow-md shadow-[#d2ff2d]/20 scale-105'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                USD ($)
              </button>
              <button
                onClick={() => setCurrency('KWD')}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all',
                  currency === 'KWD'
                    ? 'bg-[#d2ff2d] text-black shadow-md shadow-[#d2ff2d]/20 scale-105'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                KWD (د.ك)
              </button>
            </div>
          </div>

          {/* Top 3 Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Average Savings */}
            <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 backdrop-blur-xl group hover:border-[#d2ff2d]/30 transition-all">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
              <div className="flex items-center justify-between text-xs uppercase tracking-widest text-zinc-400 mb-3 font-semibold font-mono">
                <span>Average Savings</span>
                <TrendingDown className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-purple-300 via-pink-300 to-purple-400 bg-clip-text text-transparent mb-1">
                Up to 96%
              </div>
              <p className="text-xs text-zinc-500">vs Official APIs, Fal.ai & Cloud GPU Runtimes</p>
            </div>

            {/* Card 2: Failed Tasks Policy */}
            <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 backdrop-blur-xl group hover:border-[#d2ff2d]/30 transition-all">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#d2ff2d]/40 to-transparent" />
              <div className="flex items-center justify-between text-xs uppercase tracking-widest text-zinc-400 mb-3 font-semibold font-mono">
                <span>Failed Tasks Risk</span>
                <Shield className="w-4 h-4 text-[#d2ff2d]" />
              </div>
              <div className="text-3xl lg:text-4xl font-extrabold text-white mb-1">
                $0.00
              </div>
              <p className="text-xs text-zinc-500">Zero-risk policy; auto-refunded on generation error</p>
            </div>

            {/* Card 3: Wallet & Exchange Rate */}
            <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 backdrop-blur-xl group hover:border-[#d2ff2d]/30 transition-all">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />
              <div className="flex items-center justify-between text-xs uppercase tracking-widest text-zinc-400 mb-3 font-semibold font-mono">
                <span>Prepaid Exchange Rate</span>
                <DollarSign className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-3xl lg:text-4xl font-extrabold text-white mb-1 font-mono">
                1 KWD = $3.25
              </div>
              <p className="text-xs text-zinc-500">One transparent prepaid wallet, PAYG rollover</p>
            </div>
          </div>

          {/* Controls Bar: Category Tabs & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-x-auto custom-scrollbar">
              {[
                { key: 'all', label: 'All Models', icon: Zap, count: PRICING_MODELS_DATA.length },
                { key: 'image', label: 'Image Models', icon: ImageIcon, count: PRICING_MODELS_DATA.filter(m => m.category === 'image').length },
                { key: 'layers', label: 'Seedream Layers', icon: Layers, count: PRICING_MODELS_DATA.filter(m => m.category === 'layers').length },
                { key: 'video', label: 'Video Models', icon: Film, count: PRICING_MODELS_DATA.filter(m => m.category === 'video').length },
                { key: 'audio', label: 'Audio & Music', icon: Music, count: PRICING_MODELS_DATA.filter(m => m.category === 'audio').length },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={cn(
                      'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                      isActive
                        ? 'bg-[#d2ff2d] text-black shadow-md shadow-[#d2ff2d]/20 scale-105'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                      isActive ? 'bg-black/20 text-black' : 'bg-white/[0.06] text-zinc-400'
                    )}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[260px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search AI model or resolution..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#d2ff2d] focus:bg-white/[0.04] focus:shadow-[0_0_15px_rgba(210,255,45,0.15)] transition-all font-sans"
              />
            </div>
          </div>

          {/* Pricing Table with Integrated Calculator Rows */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0c0d10]/60 backdrop-blur-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.01]">
                    <th className="py-4 px-6 text-zinc-400 font-mono font-bold uppercase tracking-wider text-[11px] w-[32%]">
                      Model & Architecture
                    </th>
                    <th className="py-4 px-6 text-zinc-400 font-mono font-bold uppercase tracking-wider text-[11px] w-[18%]">
                      Resolution / Mode
                    </th>
                    <th className="py-4 px-6 text-zinc-400 font-mono font-bold uppercase tracking-wider text-[11px] w-[17%]">
                      Boutiqaat Studio Price
                    </th>
                    <th className="py-4 px-6 text-zinc-400 font-mono font-bold uppercase tracking-wider text-[11px] w-[13%]">
                      Savings
                    </th>
                    <th className="py-4 px-6 text-zinc-400 font-mono font-bold uppercase tracking-wider text-[11px] w-[12%]">
                      Official / Market
                    </th>
                    <th className="py-4 px-6 text-zinc-400 font-mono font-bold uppercase tracking-wider text-[11px] w-[8%] text-center">
                      Calculate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredModels.map(model => {
                    const optIdx = selectedOptions[model.id] || 0;
                    const currentOpt = model.options[optIdx] || model.options[0];
                    const isCalcOpen = !!openCalculators[model.id];
                    const calc = calcStates[model.id] || { quantity: 100, durationSec: 8, chars: 10000, extraImages: 0 };
                    const { totalBoutiqaat, totalOfficial, netSavings, savingPercent } = computeModelCost(model, optIdx);

                    return (
                      <>
                        {/* Main Model Row */}
                        <tr
                          key={model.id}
                          className={cn(
                            'hover:bg-white/[0.02] transition-colors group',
                            isCalcOpen && 'bg-white/[0.02]'
                          )}
                        >
                          {/* Model & Description */}
                          <td className="py-4 px-6 align-middle">
                            <div className="flex items-start gap-3.5">
                              <div className={cn('w-2.5 h-2.5 rounded-full mt-1.5 shrink-0', getCategoryDotColor(model.category))} />
                              <div className="space-y-1">
                                <div className="flex items-center flex-wrap gap-2">
                                  <span className="text-sm font-bold text-white group-hover:text-[#d2ff2d] transition-colors">
                                    {model.name}
                                  </span>
                                  {model.badge && (
                                    <span className="bg-[#d2ff2d] text-black text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-sm transform -skew-x-6 tracking-wide shadow-sm">
                                      {model.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-zinc-400 text-xs leading-relaxed max-w-md">
                                  {model.desc}
                                </p>
                                {currentOpt.pixels && (
                                  <p className="text-[10px] font-mono text-zinc-500 pt-0.5">
                                    Pixel Target: {currentOpt.pixels}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Resolution / Option Selector */}
                          <td className="py-4 px-6 align-middle">
                            {model.options.length > 1 ? (
                              <div className="relative inline-block w-full max-w-[200px]">
                                <select
                                  value={optIdx}
                                  onChange={e => handleOptionChange(model.id, Number(e.target.value))}
                                  className="w-full bg-[#121318] border border-white/[0.1] hover:border-[#d2ff2d]/60 focus:border-[#d2ff2d] rounded-xl text-xs font-semibold text-white px-3 py-2 outline-none cursor-pointer transition-all shadow-inner focus:shadow-[0_0_12px_rgba(210,255,45,0.15)] appearance-none pr-8"
                                >
                                  {model.options.map((opt, i) => (
                                    <option key={i} value={i} className="bg-[#0f1015] text-white">
                                      {opt.name}
                                    </option>
                                  ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-[10px]">
                                  ▼
                                </div>
                              </div>
                            ) : (
                              <span className="inline-block px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-300 font-semibold text-xs">
                                {currentOpt.name}
                              </span>
                            )}
                          </td>

                          {/* Boutiqaat Price Card */}
                          <td className="py-4 px-6 align-middle">
                            <div className="inline-flex flex-col items-start px-3.5 py-2 rounded-xl bg-[#d2ff2d]/[0.04] border border-[#d2ff2d]/20 min-w-[130px]">
                              <span className="text-[9px] font-mono font-bold tracking-widest text-[#d2ff2d] uppercase">
                                BOUTIQAAT
                              </span>
                              <span className="text-base font-extrabold text-white font-mono">
                                {formatPrice(currentOpt.price)}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono">
                                Per {currentOpt.unit}
                              </span>
                            </div>
                          </td>

                          {/* Savings % */}
                          <td className="py-4 px-6 align-middle">
                            {currentOpt.saving && currentOpt.saving !== '0.0%' ? (
                              <div className="space-y-0.5">
                                <div className="inline-flex items-center gap-1 text-emerald-400 font-extrabold text-sm">
                                  <ArrowUpRight className="w-4 h-4" />
                                  <span>{currentOpt.saving}</span>
                                </div>
                                <span className="block text-[10px] text-zinc-500 font-mono">
                                  vs Official
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-500 font-mono text-xs">Standard</span>
                            )}
                          </td>

                          {/* Official Price Strikethrough Card */}
                          <td className="py-4 px-6 align-middle">
                            {currentOpt.official !== null ? (
                              <div className="inline-flex flex-col items-start px-3.5 py-2 rounded-xl bg-white/[0.01] border border-white/[0.04] min-w-[110px] opacity-75">
                                <span className="text-[9px] font-mono font-bold tracking-widest text-zinc-500 uppercase">
                                  OFFICIAL / FAL
                                </span>
                                <span className="text-sm font-semibold text-zinc-400 line-through font-mono">
                                  {formatPrice(currentOpt.official)}
                                </span>
                                <span className="text-[10px] text-zinc-600 font-mono">
                                  Per {currentOpt.unit}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-600 font-mono text-xs italic">N/A</span>
                            )}
                          </td>

                          {/* Calculator Action Toggle */}
                          <td className="py-4 px-6 align-middle text-center">
                            <button
                              onClick={() => toggleCalculator(model.id)}
                              className={cn(
                                'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all',
                                isCalcOpen
                                  ? 'bg-[#d2ff2d] text-black shadow-lg shadow-[#d2ff2d]/25'
                                  : 'bg-white/[0.04] text-zinc-300 border border-white/[0.08] hover:bg-[#d2ff2d]/10 hover:text-[#d2ff2d] hover:border-[#d2ff2d]/30'
                              )}
                              title="Open Cost Calculator"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">{isCalcOpen ? 'Close' : 'Calculate'}</span>
                              {isCalcOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </td>
                        </tr>

                        {/* Interactive Calculator Drawer Row */}
                        {isCalcOpen && (
                          <tr className="bg-[#0e0f14]/90 border-t border-b border-[#d2ff2d]/20 animate-in fade-in duration-200">
                            <td colSpan={6} className="p-6">
                              <div className="space-y-5">
                                {/* Calculator Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                                    <div className="w-7 h-7 rounded-lg bg-[#d2ff2d]/10 border border-[#d2ff2d]/30 flex items-center justify-center text-[#d2ff2d]">
                                      <Calculator className="w-4 h-4" />
                                    </div>
                                    <span>
                                      Cost Calculator: <span className="text-[#d2ff2d]">{model.name}</span> ({currentOpt.name})
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-zinc-400 font-mono">
                                    Rate: {formatPrice(currentOpt.price)} / {currentOpt.unit}
                                    {currentOpt.notes && ` • ${currentOpt.notes}`}
                                  </span>
                                </div>

                                {/* Calculator Input Controls based on Model Type */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                                  {/* Left: Input sliders & Presets */}
                                  <div className="lg:col-span-7 space-y-4">
                                    {/* Image & Layer Models: Quantity Input */}
                                    {(model.category === 'image' || model.category === 'layers') && (
                                      <div className="space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                          <label className="font-semibold text-zinc-300">
                                            Number of Generated Images / Calls:
                                          </label>
                                          <span className="font-mono font-bold text-[#d2ff2d] text-sm">
                                            {calc.quantity.toLocaleString()} images
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <input
                                            type="range"
                                            min="1"
                                            max="5000"
                                            step="1"
                                            value={calc.quantity}
                                            onChange={e => updateCalcState(model.id, { quantity: Number(e.target.value) })}
                                            className="flex-1 accent-[#d2ff2d] h-2 bg-zinc-800 rounded-lg cursor-pointer"
                                          />
                                          <input
                                            type="number"
                                            min="1"
                                            max="50000"
                                            value={calc.quantity}
                                            onChange={e => updateCalcState(model.id, { quantity: Math.max(1, Number(e.target.value)) })}
                                            className="w-24 px-3 py-1.5 rounded-xl bg-black border border-zinc-700 text-center font-mono font-bold text-xs text-white focus:outline-none focus:border-[#d2ff2d]"
                                          />
                                        </div>

                                        {/* Quick Preset Buttons */}
                                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                                          <span className="text-[10px] text-zinc-500 uppercase font-mono">Quick Presets:</span>
                                          {[4, 20, 100, 500, 1000, 2500, 5000].map(val => (
                                            <button
                                              key={val}
                                              onClick={() => updateCalcState(model.id, { quantity: val })}
                                              className={cn(
                                                'px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all',
                                                calc.quantity === val
                                                  ? 'bg-[#d2ff2d] text-black font-bold'
                                                  : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
                                              )}
                                            >
                                              {val.toLocaleString()}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Video Models: Duration & Clips */}
                                    {model.category === 'video' && (
                                      <div className="space-y-4">
                                        {/* Video Duration (if billed per second) */}
                                        {currentOpt.unit === 'Sec' ? (
                                          <div className="space-y-2">
                                            <div className="flex justify-between items-center text-xs">
                                              <label className="font-semibold text-zinc-300">
                                                Video Duration per Clip (Seconds):
                                              </label>
                                              <span className="font-mono font-bold text-[#d2ff2d] text-sm">
                                                {calc.durationSec}s
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {[4, 5, 8, 10, 15, 20, 30].map(s => (
                                                <button
                                                  key={s}
                                                  onClick={() => updateCalcState(model.id, { durationSec: s })}
                                                  className={cn(
                                                    'flex-1 py-1.5 rounded-xl text-xs font-mono font-bold transition-all',
                                                    calc.durationSec === s
                                                      ? 'bg-[#d2ff2d] text-black'
                                                      : 'bg-white/[0.04] text-zinc-400 hover:text-white'
                                                  )}
                                                >
                                                  {s}s
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200">
                                            Fixed Price model: <span className="font-bold text-white">{formatPrice(currentOpt.price)}</span> per complete video call (up to 8-10 seconds).
                                          </div>
                                        )}

                                        {/* Number of Video Clips */}
                                        <div className="space-y-2">
                                          <div className="flex justify-between items-center text-xs">
                                            <label className="font-semibold text-zinc-300">Total Video Clips to Generate:</label>
                                            <span className="font-mono font-bold text-white text-sm">{calc.quantity} clips</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {[1, 5, 10, 25, 50, 100].map(qty => (
                                              <button
                                                key={qty}
                                                onClick={() => updateCalcState(model.id, { quantity: qty })}
                                                className={cn(
                                                  'flex-1 py-1.5 rounded-xl text-xs font-mono font-bold transition-all',
                                                  calc.quantity === qty
                                                    ? 'bg-purple-400 text-black'
                                                    : 'bg-white/[0.04] text-zinc-400 hover:text-white'
                                                )}
                                              >
                                                {qty}
                                              </button>
                                            ))}
                                          </div>
                                        </div>

                                        {/* Minimax H3 Extra Image Setting */}
                                        {model.id === 'minimax-h3-multimodal' && (
                                          <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-zinc-800 text-xs">
                                            <span className="text-zinc-300">Extra Reference Images (First 5 free; +$0.04/img):</span>
                                            <div className="flex items-center gap-2">
                                              <button
                                                onClick={() => updateCalcState(model.id, { extraImages: Math.max(0, calc.extraImages - 1) })}
                                                className="w-7 h-7 rounded-lg bg-zinc-800 text-white flex items-center justify-center font-bold"
                                              >
                                                -
                                              </button>
                                              <span className="w-8 text-center font-mono font-bold text-[#d2ff2d]">{calc.extraImages}</span>
                                              <button
                                                onClick={() => updateCalcState(model.id, { extraImages: calc.extraImages + 1 })}
                                                className="w-7 h-7 rounded-lg bg-zinc-800 text-white flex items-center justify-center font-bold"
                                              >
                                                +
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Audio & Speech Models: Songs / Duration / Characters */}
                                    {model.category === 'audio' && (
                                      <div className="space-y-3">
                                        {currentOpt.unit === 'Song' && (
                                          <div className="space-y-2">
                                            <div className="flex justify-between items-center text-xs">
                                              <label className="font-semibold text-zinc-300">Number of Full AI Songs to Produce:</label>
                                              <span className="font-mono font-bold text-[#d2ff2d] text-sm">{calc.quantity} songs</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {[1, 5, 10, 25, 50, 100].map(s => (
                                                <button
                                                  key={s}
                                                  onClick={() => updateCalcState(model.id, { quantity: s })}
                                                  className={cn(
                                                    'flex-1 py-1.5 rounded-xl text-xs font-mono font-bold transition-all',
                                                    calc.quantity === s
                                                      ? 'bg-pink-400 text-black'
                                                      : 'bg-white/[0.04] text-zinc-400 hover:text-white'
                                                  )}
                                                >
                                                  {s}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {currentOpt.unit === 'Sec' && (
                                          <div className="space-y-2">
                                            <div className="flex justify-between items-center text-xs">
                                              <label className="font-semibold text-zinc-300">Speech Audio Duration (Capped at 120s):</label>
                                              <span className="font-mono font-bold text-[#d2ff2d] text-sm">{calc.durationSec} seconds</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {[10, 30, 60, 90, 120].map(sec => (
                                                <button
                                                  key={sec}
                                                  onClick={() => updateCalcState(model.id, { durationSec: sec })}
                                                  className={cn(
                                                    'flex-1 py-1.5 rounded-xl text-xs font-mono font-bold transition-all',
                                                    calc.durationSec === sec
                                                      ? 'bg-pink-400 text-black'
                                                      : 'bg-white/[0.04] text-zinc-400 hover:text-white'
                                                  )}
                                                >
                                                  {sec}s
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {currentOpt.unit === '10k Ch' && (
                                          <div className="space-y-2">
                                            <div className="flex justify-between items-center text-xs">
                                              <label className="font-semibold text-zinc-300">Total Character Count to Clone / Synthesize:</label>
                                              <span className="font-mono font-bold text-[#d2ff2d] text-sm">{calc.chars.toLocaleString()} chars</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {[5000, 10000, 50000, 100000, 250000].map(ch => (
                                                <button
                                                  key={ch}
                                                  onClick={() => updateCalcState(model.id, { chars: ch })}
                                                  className={cn(
                                                    'flex-1 py-1.5 rounded-xl text-xs font-mono font-bold transition-all',
                                                    calc.chars === ch
                                                      ? 'bg-pink-400 text-black'
                                                      : 'bg-white/[0.04] text-zinc-400 hover:text-white'
                                                  )}
                                                >
                                                  {(ch / 1000)}k
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Right: Real-time Calculation Summary Cards */}
                                  <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                                    {/* Boutiqaat Total Cost */}
                                    <div className="p-4 rounded-2xl bg-[#d2ff2d]/[0.06] border border-[#d2ff2d]/30 space-y-1">
                                      <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-[#d2ff2d]">
                                        <span>Estimated Total Cost</span>
                                        <span>BOUTIQAAT STUDIO</span>
                                      </div>
                                      <div className="text-2xl font-black text-white font-mono">
                                        {formatTotalMoney(totalBoutiqaat)}
                                      </div>
                                      <p className="text-[11px] text-zinc-400">
                                        Deducted seamlessly from prepaid studio pool
                                      </p>
                                    </div>

                                    {/* Official Comparison & Net Savings */}
                                    {totalOfficial > 0 && (
                                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-zinc-500 font-mono">Official / Market Cost:</span>
                                          <span className="text-zinc-400 font-mono font-semibold line-through">
                                            {formatTotalMoney(totalOfficial)}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.06]">
                                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                                            <ArrowUpRight className="w-3.5 h-3.5" /> Net Savings:
                                          </span>
                                          <span className="text-emerald-400 font-mono font-bold">
                                            {formatTotalMoney(netSavings)} ({savingPercent}%)
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}

                  {filteredModels.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-zinc-500 space-y-2">
                        <Search className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-zinc-400">No AI models found matching your query.</p>
                        <p className="text-xs text-zinc-600">Try changing filter tabs or search terms.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Note */}
          <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/[0.04] flex items-center gap-3 text-xs text-zinc-400">
            <Info className="w-4 h-4 text-zinc-500 shrink-0" />
            <p>
              Prices shown reflect actual cost deductions applied directly to the Boutiqaat Studio prepaid wallet pool. 
              All generation tasks are monitored in real-time via RunningHub enterprise API.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
