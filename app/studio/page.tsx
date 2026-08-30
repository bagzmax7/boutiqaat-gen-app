'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import BatchRemoveBackgroundLauncher from '@/components/apps/BatchRemoveBackgroundLauncher';
import AutoRetouchLauncher from '@/components/apps/AutoRetouchLauncher';
import { useTasks } from '@/hooks/useTasks';
import { useAppControls } from '@/hooks/useAppControls';
import { AppDefinition } from '@/lib/types';
import {
  Sparkles, Search, Clock, ArrowRight, X, ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface StudioAppCard {
  id: string;
  appKey?: string;
  name: string;
  desc: string;
  image: string;
  tag: string;
  ctaText: string;
  status: 'live' | 'soon';
  href?: string;
  isBatchRemove?: boolean;
  isRetouch?: boolean;
  estimatedTime?: string;
}

const STUDIO_CARDS: StudioAppCard[] = [
  {
    id: 'layers',
    appKey: 'boutiqaat-layers',
    name: 'Boutiqaat Layers: AI Layer Decomposition',
    desc: 'Decompose flat banners into isolated transparent layers (background, product, typography) with generative infill.',
    image: '/banners/boutiqaat-layers.gif',
    tag: 'LAYER DECOMPOSITION',
    ctaText: 'Create Now',
    status: 'live',
    href: '/layers',
    estimatedTime: '~1.5 min',
  },
  {
    id: 'bundling',
    appKey: 'bundling-studio',
    name: 'Bundling Studio: Multi-SKU Composition',
    desc: 'Synthesize multi-SKU product collections on luxury pedestals with automatic marketing prompt formulas.',
    image: '/banners/bundling-studio.gif',
    tag: 'MULTI-SKU BUNDLE',
    ctaText: 'Create Now',
    status: 'live',
    href: '/bundling',
    estimatedTime: '~1 min',
  },
  {
    id: 'social-resize',
    appKey: 'social-resize',
    name: 'Social Resize: AI Generative Outpaint',
    desc: 'Adapt any 1:1 image to 9:16 Instagram Reels, Stories & 16:9 banner dimensions with context-aware generative fill.',
    image: '/banners/social-resize.gif',
    tag: 'ASPECT OUTPAINT',
    ctaText: 'Create Now',
    status: 'live',
    href: '/studio/social-resize',
    estimatedTime: '~15 sec',
  },
  {
    id: 'remove-bg',
    appKey: 'batch-remove-bg',
    name: 'Remove Background: Precision Batch Matting',
    desc: 'Batch isolate up to 20 product packshots with clean alpha transparency and lossless PNG export.',
    image: '/banners/remove-background.gif',
    tag: 'BATCH MATTING',
    ctaText: 'Batch PNG',
    status: 'live',
    isBatchRemove: true,
    estimatedTime: '~45 sec/img',
  },
  {
    id: 'auto-retouch',
    appKey: 'auto-retouch',
    name: 'Boutiqaat AI Retouch',
    desc: 'The internal Auto Retouch tool to polish fabrics, standardize studio backdrops, and preserve model fidelity at scale, saving production hours without compromising Boutiqaat visual standards.',
    image: '/banners/auto-retouch.gif',
    tag: 'AI STUDIO RETOUCH',
    ctaText: 'Retouch Studio',
    status: 'live',
    href: '/studio/auto-retouch',
    estimatedTime: '~1 min',
  },
  {
    id: 'virtual-tryon',
    name: 'Virtual Try-On: AI Fashion Model Showcase',
    desc: 'Dress commercial AI models in garments and accessories with physics-accurate drape and lighting.',
    image: '/banners/virtual-try-on.gif',
    tag: 'FASHION APPAREL',
    ctaText: 'Coming Soon',
    status: 'soon',
    estimatedTime: '~90 sec',
  },
];

export default function ImageStudioPage() {
  const router = useRouter();
  const { addTask } = useTasks();
  const { isAppLocked, getAppBadgeLabel, isAdmin } = useAppControls();
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive modal states
  const [showBatchRemove, setShowBatchRemove] = useState(false);
  const [showRetouch, setShowRetouch] = useState(false);

  const filteredCards = STUDIO_CARDS.filter(card => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      card.name.toLowerCase().includes(q) ||
      card.desc.toLowerCase().includes(q) ||
      card.tag.toLowerCase().includes(q)
    );
  });

  function handleTaskStarted(
    taskId: string,
    appName: string,
    nodeInfoList: { nodeId: string; fieldName: string; fieldValue: string }[],
    apiKeyType?: 'enterprise' | 'consumer'
  ) {
    const localId = addTask(taskId, 'custom-studio-app', appName, nodeInfoList, apiKeyType);
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: localId,
        runninghub_task_id: taskId,
        app_id: 'custom-studio-app',
        app_name: appName,
        api_key_type: apiKeyType || 'consumer',
        node_info_list: nodeInfoList,
      }),
    }).catch(() => {});

    toast.success('Task started! Processing image...');
  }

  const handleCardClick = (card: StudioAppCard) => {
    const isLocked = card.appKey ? isAppLocked(card.appKey) : card.status === 'soon';

    if (isLocked && !isAdmin) {
      const badge = card.appKey ? getAppBadgeLabel(card.appKey) : 'COMING SOON';
      toast(`This AI tool is currently ${badge.toLowerCase()} for the next update.`, { icon: '🔒' });
      return;
    }

    if (card.href) {
      router.push(card.href);
      return;
    }

    if (card.isBatchRemove) {
      setShowBatchRemove(true);
      return;
    }

    if (card.isRetouch) {
      setShowRetouch(true);
      return;
    }
  };

  return (
    <div className="flex h-screen bg-[#07080a] text-white overflow-hidden font-sans selection:bg-[#d2ff2d] selection:text-black">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 space-y-8">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/[0.06]">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d2ff2d]/10 border border-[#d2ff2d]/25 text-[#d2ff2d] text-xs font-mono font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Creative AI Suite
              </div>
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-emerald-400 bg-clip-text text-transparent">
                Image AI Studio
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Empower your creative workflow with specialized AI pipelines: multi-layer decomposition, multi-SKU composition, and generative social outpainting.
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative min-w-[260px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search studio tools..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#d2ff2d] focus:bg-white/[0.06] transition-all font-sans"
              />
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCards.map(card => {
              const isLocked = card.appKey ? isAppLocked(card.appKey) : card.status === 'soon';
              const isCardLockedForUser = isLocked && !isAdmin;
              const badgeLabel = card.appKey && isLocked ? getAppBadgeLabel(card.appKey) : card.ctaText;

              return (
                <div
                  key={card.id}
                  onClick={() => handleCardClick(card)}
                  className={cn(
                    'group relative h-[280px] rounded-3xl overflow-hidden border border-white/[0.08] bg-[#0d0e12] cursor-pointer transition-all duration-300 hover:border-[#d2ff2d]/60 hover:shadow-[0_0_25px_rgba(210,255,45,0.15)] flex flex-col justify-between p-5',
                    isCardLockedForUser && 'opacity-65 hover:border-white/20 hover:shadow-none bg-[#090a0d]'
                  )}
                >
                  {/* Animated Banner with Dark Gradient Overlay */}
                  <img
                    src={card.image}
                    alt={card.name}
                    loading="lazy"
                    className={cn(
                      'absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105',
                      isCardLockedForUser && 'filter brightness-50 contrast-90'
                    )}
                  />
                  <div className={cn(
                    'absolute inset-0 bg-gradient-to-t from-[#07080a] via-[#07080a]/75 to-[#07080a]/30 transition-opacity duration-300 group-hover:via-[#07080a]/65 pointer-events-none',
                    isCardLockedForUser && 'from-[#07080a] via-[#07080a]/90 to-[#07080a]/60'
                  )} />

                  {/* Top Bar: Tag and Pill CTA Button */}
                  <div className="relative z-10 flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono font-bold tracking-wider text-zinc-300 uppercase">
                      {card.tag}
                    </span>

                    {/* Glowing CTA Pill Button or Coming Soon Gray Pill */}
                    <div
                      className={cn(
                        'px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide uppercase transition-all shadow-md flex items-center gap-1.5',
                        isCardLockedForUser
                          ? 'bg-zinc-800/90 text-zinc-400 border border-zinc-700/80 shadow-none'
                          : 'bg-[#d2ff2d] text-black group-hover:bg-[#e1ff55] group-hover:scale-105 shadow-[#d2ff2d]/25'
                      )}
                    >
                      <span>{isCardLockedForUser ? badgeLabel : card.ctaText}</span>
                      {!isCardLockedForUser && <ArrowRight className="w-3.5 h-3.5" />}
                    </div>
                  </div>

                  {/* Bottom Text Details */}
                  <div className="relative z-10 space-y-1.5 pt-4">
                    <h3 className={cn(
                      'text-base lg:text-lg font-bold text-white transition-colors leading-tight',
                      !isCardLockedForUser && 'group-hover:text-[#d2ff2d]'
                    )}>
                      {card.name}
                    </h3>
                    <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed font-normal">
                      {card.desc}
                    </p>

                    {/* Meta info footer */}
                    {card.estimatedTime && (
                      <div className="flex items-center gap-2 pt-1 text-[11px] text-zinc-400 font-mono">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <span>Est: {card.estimatedTime}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Interactive Modals */}
      {showBatchRemove && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-[#0e0f14] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Batch Remove Background</span>
              </div>
              <button
                onClick={() => setShowBatchRemove(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <BatchRemoveBackgroundLauncher
              app={{
                id: '2063548168545071105',
                name: 'Remove Background',
                description: 'Remove backgrounds from up to 20 product images at once.',
                category: 'image-editing',
                icon: 'layers',
                batchMode: true,
                nodeInfoSchema: [],
              }}
              onTaskStarted={handleTaskStarted}
            />
          </div>
        </div>
      )}
    </div>
  );
}
