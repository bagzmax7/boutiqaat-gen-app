'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import BatchRemoveBackgroundLauncher from '@/components/apps/BatchRemoveBackgroundLauncher';
import AppLauncher from '@/components/apps/AppLauncher';
import { useTasks } from '@/hooks/useTasks';
import { AppDefinition } from '@/lib/types';
import {
  ImageIcon, Layers, Wand2, Shirt, Palette, ArrowLeft,
  Sparkles, Clock, Zap, ChevronRight, Crop
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── App Registry ─────────────────────────────────────────────────────────────
const IMAGE_APPS: (AppDefinition & {
  gradient: string;
  iconBg: string;
  iconColor: string;
  badge?: string;
  status: 'live' | 'soon';
  tags: string[];
  estimatedTime: string;
})[] = [
  {
    id: 'social-resize',
    name: 'Social Resize',
    description: 'Adapt one image to all social formats instantly with AI Generative Fill & Focal Cropping.',
    category: 'image-editing',
    icon: 'crop',
    pinned: true,
    status: 'live',
    gradient: 'from-purple-500/20 to-pink-600/10',
    iconBg: 'from-purple-500 to-pink-600',
    iconColor: 'text-white',
    tags: ['Resize', 'Outpaint', 'Social'],
    estimatedTime: '~15 sec',
    nodeInfoSchema: [],
  },
  {
    id: '2063548168545071105',
    name: 'Remove Background',
    description: 'Remove backgrounds from up to 20 product images at once. Outputs transparent PNG + PSD files ready for production.',
    category: 'image-editing',
    icon: 'layers',
    pinned: true,
    batchMode: true,
    status: 'live',
    gradient: 'from-emerald-500/20 to-teal-600/10',
    iconBg: 'from-emerald-500 to-teal-600',
    iconColor: 'text-white',
    tags: ['Batch', 'PNG', 'PSD', 'Transparent'],
    estimatedTime: '~45 sec/image',
    nodeInfoSchema: [],
  },
  {
    id: 'virtual-tryon',
    name: 'Virtual Try-On',
    description: 'Dress models with your product garments using AI. Perfect for fashion and apparel e-commerce listings.',
    category: 'image-generation',
    icon: 'shirt',
    status: 'soon',
    gradient: 'from-purple-500/20 to-indigo-600/10',
    iconBg: 'from-purple-500 to-indigo-600',
    iconColor: 'text-white',
    tags: ['Fashion', 'Model', 'Garment'],
    estimatedTime: '~90 sec',
    badge: 'Soon',
    nodeInfoSchema: [],
  },
  {
    id: 'change-background',
    name: 'Change Background',
    description: 'Replace product backgrounds with custom scenes, studio setups, or branded environments automatically.',
    category: 'image-editing',
    icon: 'palette',
    status: 'soon',
    gradient: 'from-blue-500/20 to-cyan-600/10',
    iconBg: 'from-blue-500 to-cyan-600',
    iconColor: 'text-white',
    tags: ['Background', 'Scene', 'Studio'],
    estimatedTime: '~60 sec',
    badge: 'Soon',
    nodeInfoSchema: [],
  },
  {
    id: 'prompt-generator',
    name: 'AI Prompt Generator',
    description: 'Generate optimized creative prompts for product photography, lifestyle shots, and campaign visuals.',
    category: 'text-generation',
    icon: 'wand2',
    status: 'soon',
    gradient: 'from-amber-500/20 to-orange-600/10',
    iconBg: 'from-amber-500 to-orange-600',
    iconColor: 'text-white',
    tags: ['Prompt', 'Creative', 'Photography'],
    estimatedTime: '~5 sec',
    badge: 'Soon',
    nodeInfoSchema: [],
  },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  layers: <Layers className="w-6 h-6" />,
  shirt: <Shirt className="w-6 h-6" />,
  palette: <Palette className="w-6 h-6" />,
  wand2: <Wand2 className="w-6 h-6" />,
  crop: <Crop className="w-6 h-6" />,
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ImageStudioPage() {
  const router = useRouter();
  const { addTask } = useTasks();
  const [selectedApp, setSelectedApp] = useState<typeof IMAGE_APPS[0] | null>(null);

  function handleTaskStarted(
    taskId: string,
    appName: string,
    nodeInfoList: { nodeId: string; fieldName: string; fieldValue: string }[],
    apiKeyType?: 'enterprise' | 'consumer'
  ) {
    if (!selectedApp) return;
    const localId = addTask(taskId, selectedApp.id, appName, nodeInfoList, apiKeyType);

    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: localId,
        runninghub_task_id: taskId,
        app_id: selectedApp.id,
        app_name: appName,
        api_key_type: apiKeyType || 'consumer',
        node_info_list: nodeInfoList,
      }),
    }).catch(() => {});

    toast.success('Task started! Check your history soon.', { duration: 3000 });
  }

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">

          {selectedApp ? (
            /* ── App Launcher View ─────────────────────────────── */
            <div>
              {/* Back breadcrumb */}
              <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
                <button
                  onClick={() => setSelectedApp(null)}
                  className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  Image AI Studio
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-border" />
                <span className="text-sm font-semibold text-text-primary">{selectedApp.name}</span>
              </div>

              <div className="px-6 py-6 max-w-4xl mx-auto">
                {selectedApp.id === '2063548168545071105' ? (
                  <BatchRemoveBackgroundLauncher app={selectedApp} onTaskStarted={handleTaskStarted} />
                ) : (
                  <AppLauncher app={selectedApp} onTaskStarted={handleTaskStarted} />
                )}
              </div>
            </div>
          ) : (
            /* ── App Gallery View ──────────────────────────────── */
            <div>
              {/* Page header */}
              <div className="relative overflow-hidden px-6 py-10 border-b border-border/50">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-600/5 pointer-events-none" />
                <div className="absolute -top-8 -right-8 w-48 h-48 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center gap-4 relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg flex-shrink-0">
                    <ImageIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-text-primary">Image AI Studio</h1>
                    <p className="text-sm text-text-secondary mt-0.5">
                      Choose a tool to get started
                    </p>
                  </div>
                </div>
              </div>

              {/* App grid */}
              <div className="px-6 py-8 max-w-5xl mx-auto">

                {/* Live tools */}
                <div className="mb-3">
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Zap className="w-3 h-3 text-accent-green" /> Ready to Use
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {IMAGE_APPS.filter((a) => a.status === 'live').map((app) => (
                      <AppCard
                        key={app.id}
                        app={app}
                        onClick={() => {
                          if (app.id === 'social-resize') {
                            router.push('/studio/social-resize');
                          } else {
                            setSelectedApp(app);
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Coming soon */}
                <div className="mt-8">
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Clock className="w-3 h-3 text-text-muted" /> Coming Soon
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {IMAGE_APPS.filter((a) => a.status === 'soon').map((app) => (
                      <AppCard
                        key={app.id}
                        app={app}
                        onClick={() => toast('Coming soon! Stay tuned 🚀', { icon: '🚀' })}
                        disabled
                      />
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

// ─── App Card Component ───────────────────────────────────────────────────────
function AppCard({
  app,
  onClick,
  disabled = false,
}: {
  app: typeof IMAGE_APPS[0];
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative text-left w-full rounded-2xl border p-5 transition-all duration-200',
        'bg-gradient-to-br',
        app.gradient,
        disabled
          ? 'border-border opacity-60 cursor-default'
          : 'border-border hover:border-accent-gold/30 hover:-translate-y-0.5 hover:shadow-card cursor-pointer'
      )}
    >
      {/* Badge */}
      {app.badge && (
        <span className="absolute top-3.5 right-3.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple border border-accent-purple/25">
          {app.badge}
        </span>
      )}

      {/* Icon */}
      <div
        className={cn(
          'w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-md',
          app.iconBg,
          app.iconColor
        )}
      >
        {ICON_MAP[app.icon] ?? <Sparkles className="w-6 h-6" />}
      </div>

      {/* Title & desc */}
      <h3
        className={cn(
          'text-base font-bold text-text-primary mb-1.5 transition-colors',
          !disabled && 'group-hover:text-accent-gold'
        )}
      >
        {app.name}
      </h3>
      <p className="text-xs text-text-muted leading-relaxed mb-4 line-clamp-2">
        {app.description}
      </p>

      {/* Footer row */}
      <div className="flex items-center justify-between">
        {/* Tags */}
        <div className="flex gap-1.5 flex-wrap">
          {app.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-bg-secondary border border-border text-text-muted"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Est. time */}
        <span className="text-[10px] text-text-muted flex items-center gap-1 flex-shrink-0 ml-2">
          <Clock className="w-2.5 h-2.5" />
          {app.estimatedTime}
        </span>
      </div>

      {/* Hover arrow */}
      {!disabled && (
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
          <div className="w-7 h-7 rounded-lg bg-accent-gold/20 border border-accent-gold/30 flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-accent-gold" />
          </div>
        </div>
      )}
    </button>
  );
}
