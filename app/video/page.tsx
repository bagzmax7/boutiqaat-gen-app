'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import BatchVideoBgRemovalLauncher from '@/components/apps/BatchVideoBgRemovalLauncher';
import { useTasks } from '@/hooks/useTasks';
import { AppDefinition } from '@/lib/types';
import { Film, Zap, Clock, ArrowLeft, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const VIDEO_APPS: (AppDefinition & {
  gradient: string;
  iconBg: string;
  iconColor: string;
  badge?: string;
  status: 'live' | 'soon';
  tags: string[];
  estimatedTime: string;
})[] = [
  {
    id: '2015810111150759938', // Remove Video Background ComfyUI Workflow ID
    name: 'Video BG Removal',
    description: 'Remove backgrounds from multiple video clips in parallel. Outputs transparent or studio-lit videos using high-performance ComfyUI workflows.',
    category: 'video-generation',
    icon: 'film',
    status: 'live',
    gradient: 'from-emerald-500/20 to-teal-600/10',
    iconBg: 'from-emerald-500 to-teal-600',
    iconColor: 'text-white',
    tags: ['Batch', 'Video', 'Transparent', 'MP4'],
    estimatedTime: '~60 sec/video',
    nodeInfoSchema: [],
  },
  {
    id: 'seedance-2',
    name: 'Seedance 2.0',
    description: 'High-quality AI video generation model for commercial advertisements and product motion showcase.',
    category: 'video-generation',
    icon: 'film',
    status: 'soon',
    gradient: 'from-blue-500/20 to-cyan-600/10',
    iconBg: 'from-blue-500 to-cyan-600',
    iconColor: 'text-white',
    tags: ['Generation', 'Motion', 'Ad'],
    estimatedTime: '~120 sec',
    badge: 'Soon',
    nodeInfoSchema: [],
  },
  {
    id: 'veo3',
    name: 'Veo 3.1',
    description: 'Google DeepMind cinematic video generation model. Superior text-to-video capabilities.',
    category: 'video-generation',
    icon: 'film',
    status: 'soon',
    gradient: 'from-purple-500/20 to-violet-600/10',
    iconBg: 'from-purple-500 to-violet-600',
    iconColor: 'text-white',
    tags: ['Cinematic', 'DeepMind', 'Text-to-Video'],
    estimatedTime: '~90 sec',
    badge: 'Soon',
    nodeInfoSchema: [],
  },
  {
    id: 'kling-o3',
    name: 'Kling O3',
    description: 'Fast and creative video synthesis for quick campaign prototyping and social media clips.',
    category: 'video-generation',
    icon: 'film',
    status: 'soon',
    gradient: 'from-orange-500/20 to-amber-600/10',
    iconBg: 'from-orange-500 to-amber-600',
    iconColor: 'text-white',
    tags: ['Fast', 'Social', 'Synthesis'],
    estimatedTime: '~40 sec',
    badge: 'Soon',
    nodeInfoSchema: [],
  },
  {
    id: 'kling-o1',
    name: 'Kling O1',
    description: 'Ultra-realistic physical simulation and motion rendering for perfect product details.',
    category: 'video-generation',
    icon: 'film',
    status: 'soon',
    gradient: 'from-red-500/20 to-rose-600/10',
    iconBg: 'from-red-500 to-rose-600',
    iconColor: 'text-white',
    tags: ['Physics', 'Realistic', 'Simulation'],
    estimatedTime: '~150 sec',
    badge: 'Soon',
    nodeInfoSchema: [],
  },
  {
    id: 'happy-horse',
    name: 'Happy Horse',
    description: 'Dynamic motion and action tracking AI generator for highly engaged lifestyle marketing assets.',
    category: 'video-generation',
    icon: 'film',
    status: 'soon',
    gradient: 'from-pink-500/20 to-fuchsia-600/10',
    iconBg: 'from-pink-500 to-fuchsia-600',
    iconColor: 'text-white',
    tags: ['Action', 'Lifestyle', 'Dynamic'],
    estimatedTime: '~80 sec',
    badge: 'Soon',
    nodeInfoSchema: [],
  },
];

export default function VideoStudioPage() {
  const { addTask } = useTasks();
  const [selectedApp, setSelectedApp] = useState<typeof VIDEO_APPS[0] | null>(null);

  function handleTaskStarted(
    taskId: string,
    appName: string,
    nodeInfoList: { nodeId: string; fieldName: string; fieldValue: string }[],
    apiKeyType?: 'enterprise' | 'consumer'
  ) {
    if (!selectedApp) return;
    
    // Register the task locally using the useTasks hook
    const localId = addTask(taskId, selectedApp.id, appName, nodeInfoList, apiKeyType);

    // Sync task initiation with database
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: localId,
        runninghub_task_id: taskId,
        app_id: selectedApp.id,
        app_name: appName,
        api_key_type: apiKeyType || 'enterprise',
        node_info_list: nodeInfoList,
      }),
    }).catch(() => {});

    toast.success('Task submitted successfully! Monitoring status...', { duration: 3000 });
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
              {/* Back navigation breadcrumbs */}
              <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
                <button
                  onClick={() => setSelectedApp(null)}
                  className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  Video AI Studio
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-border" />
                <span className="text-sm font-semibold text-text-primary">{selectedApp.name}</span>
              </div>

              <div className="px-6 py-6 max-w-4xl mx-auto">
                <BatchVideoBgRemovalLauncher app={selectedApp} onTaskStarted={handleTaskStarted} />
              </div>
            </div>
          ) : (
            /* ── App Gallery View ──────────────────────────────── */
            <div>
              {/* Header */}
              <div className="relative overflow-hidden px-6 py-10 border-b border-border/50">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-indigo-600/5 pointer-events-none" />
                <div className="absolute -top-8 -right-8 w-48 h-48 bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center gap-4 relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
                    <Film className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-text-primary">Video AI Studio</h1>
                    <p className="text-sm text-text-secondary mt-0.5">Next-gen video processing & generation</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-8 max-w-5xl mx-auto">
                <div className="flex items-center gap-2 text-text-muted text-sm mb-8 bg-accent-purple/5 border border-accent-purple/15 rounded-xl px-4 py-3">
                  <Zap className="w-4 h-4 text-accent-purple flex-shrink-0" />
                  Video AI tools are being integrated. Select a model to get started.
                </div>

                {/* Ready to Use Section */}
                <div className="mb-8">
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Zap className="w-3 h-3 text-accent-green" /> Ready to Use
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {VIDEO_APPS.filter(app => app.status === 'live').map(app => (
                      <AppCard
                        key={app.id}
                        app={app}
                        onClick={() => setSelectedApp(app)}
                      />
                    ))}
                  </div>
                </div>

                {/* Coming Soon Section */}
                <div>
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Clock className="w-3 h-3 text-text-muted" /> Coming Soon
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {VIDEO_APPS.filter(app => app.status === 'soon').map(app => (
                      <AppCard
                        key={app.id}
                        app={app}
                        onClick={() => toast('Coming soon! This model is being integrated. 🚀', { icon: '🎬' })}
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

// AppCard component to render each individual app choice
function AppCard({
  app,
  onClick,
  disabled = false,
}: {
  app: typeof VIDEO_APPS[0];
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
          : 'border-border hover:border-accent-purple/30 hover:-translate-y-0.5 hover:shadow-card cursor-pointer'
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
        <Film className="w-6 h-6 text-white" />
      </div>

      {/* Title & Desc */}
      <h3
        className={cn(
          'text-base font-bold text-text-primary mb-1.5 transition-colors',
          !disabled && 'group-hover:text-accent-purple'
        )}
      >
        {app.name}
      </h3>
      <p className="text-xs text-text-muted leading-relaxed mb-4 line-clamp-2">
        {app.description}
      </p>

      {/* Footer tags and est time */}
      <div className="flex items-center justify-between">
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

        <span className="text-[10px] text-text-muted flex items-center gap-1 flex-shrink-0 ml-2">
          <Clock className="w-2.5 h-2.5" />
          {app.estimatedTime}
        </span>
      </div>

      {/* Hover Arrow */}
      {!disabled && (
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
          <div className="w-7 h-7 rounded-lg bg-accent-purple/20 border border-accent-purple/30 flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-accent-purple" />
          </div>
        </div>
      )}
    </button>
  );
}

