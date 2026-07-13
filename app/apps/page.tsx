'use client';

import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import AppLauncher from '@/components/apps/AppLauncher';
import { useTasks } from '@/hooks/useTasks';
import { AppDefinition } from '@/lib/types';
import { useState } from 'react';
import { Search, Grid3X3, Sparkles, Film, Image, Cpu, Layers, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const APPS: AppDefinition[] = [
  {
    id: '2063548168545071105',
    name: 'Remove Background',
    description: 'Upload up to 5 images at once. The AI will remove the backgrounds for all of them concurrently.',
    category: 'image-editing',
    icon: 'grid',
    pinned: true,
    batchMode: true,
    nodeInfoSchema: [
      { nodeId: '4', fieldName: 'image', label: 'Image 1', type: 'image-url', required: true },
      { nodeId: '4', fieldName: 'image', label: 'Image 2', type: 'image-url', required: false },
      { nodeId: '4', fieldName: 'image', label: 'Image 3', type: 'image-url', required: false },
      { nodeId: '4', fieldName: 'image', label: 'Image 4', type: 'image-url', required: false },
      { nodeId: '4', fieldName: 'image', label: 'Image 5', type: 'image-url', required: false },
    ],
  },
  {
    id: 'image-gen-1',
    name: 'Image Generation',
    description: 'Generate stunning images with AI from text prompts',
    category: 'image-generation',
    icon: 'image',
    nodeInfoSchema: [
      { nodeId: '6', fieldName: 'text', label: 'Prompt', type: 'textarea', placeholder: 'Describe the image you want to generate...', required: true },
      { nodeId: '7', fieldName: 'text', label: 'Negative Prompt', type: 'textarea', placeholder: 'What to avoid in the image...' },
    ],
  },
  {
    id: 'video-gen-1',
    name: 'Image to Video',
    description: 'Animate a still image into a cinematic video clip',
    category: 'video-generation',
    icon: 'film',
    nodeInfoSchema: [
      { nodeId: '1', fieldName: 'image', label: 'Source Image', type: 'image-url', required: true },
      { nodeId: '6', fieldName: 'text', label: 'Motion Prompt', type: 'textarea', placeholder: 'Describe the motion or animation...', required: true },
    ],
  },
  {
    id: 'custom-app',
    name: 'Custom App',
    description: 'Run any custom AI app by providing its App ID and parameters manually',
    category: 'other',
    icon: 'layers',
    nodeInfoSchema: [],
  },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'comfyui': <Cpu className="w-4 h-4" />,
  'image-generation': <Image className="w-4 h-4" />,
  'video-generation': <Film className="w-4 h-4" />,
  'image-editing': <Sparkles className="w-4 h-4" />,
  'other': <Layers className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  'comfyui': 'text-accent-purple bg-accent-purple/10 border-accent-purple/20',
  'image-generation': 'text-accent-blue bg-accent-blue/10 border-accent-blue/20',
  'video-generation': 'text-accent-orange bg-accent-orange/10 border-accent-orange/20',
  'image-editing': 'text-accent-green bg-accent-green/10 border-accent-green/20',
  'other': 'text-text-secondary bg-bg-secondary border-border',
};

export default function AppsPage() {
  const { addTask } = useTasks();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<AppDefinition | null>(null);
  const [customAppId, setCustomAppId] = useState('');

  const filtered = APPS.filter(app =>
    app.name.toLowerCase().includes(search.toLowerCase()) ||
    app.description.toLowerCase().includes(search.toLowerCase()) ||
    app.category.toLowerCase().includes(search.toLowerCase())
  );

  function handleTaskStarted(taskId: string, appName: string, nodeInfoList: { nodeId: string; fieldName: string; fieldValue: string }[], apiKeyType?: 'enterprise' | 'consumer') {
    const appId = selectedApp?.id === 'custom-app' ? customAppId : (selectedApp?.id || '');
    addTask(taskId, appId, appName, nodeInfoList, apiKeyType);
    toast.success(`Task started! Redirecting to Task Monitor...`, { duration: 2000 });
    setTimeout(() => router.push('/tasks'), 1000);
  }

  const displayApp = selectedApp?.id === 'custom-app'
    ? { ...selectedApp, id: customAppId || 'custom-app' }
    : selectedApp;

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">

            {!selectedApp ? (
              <>
                {/* Search */}
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search AI apps..."
                    className="w-full bg-bg-card border border-border rounded-xl pl-11 pr-4 py-3 text-text-primary placeholder-text-muted text-sm input-gold transition-all"
                  />
                </div>

                {/* Pinned apps */}
                {!search && (
                  <div className="mb-6">
                    <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Star className="w-3.5 h-3.5 text-accent-gold" /> Pinned
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {APPS.filter(a => a.pinned).map(app => (
                        <AppCard key={app.id} app={app} onClick={() => setSelectedApp(app)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* All apps */}
                <div>
                  <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Grid3X3 className="w-3.5 h-3.5" /> {search ? 'Search Results' : 'All Apps'}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(app => (
                      <AppCard key={app.id} app={app} onClick={() => setSelectedApp(app)} />
                    ))}
                  </div>
                  {filtered.length === 0 && (
                    <div className="text-center py-16 text-text-muted">
                      No apps found for &quot;{search}&quot;
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="max-w-2xl mx-auto">
                <button
                  onClick={() => setSelectedApp(null)}
                  className="text-sm text-text-secondary hover:text-text-primary mb-6 flex items-center gap-1 transition-colors"
                >
                  ← Back to Apps
                </button>

                {/* Custom App ID input */}
                {selectedApp.id === 'custom-app' && (
                  <div className="bg-bg-card border border-border rounded-2xl p-5 mb-4 shadow-card">
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      AI App ID <span className="text-accent-red">*</span>
                    </label>
                    <input
                      value={customAppId}
                      onChange={e => setCustomAppId(e.target.value)}
                      placeholder="e.g. 2053333317835083777"
                      className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted input-gold transition-all font-mono"
                    />
                    <p className="text-xs text-text-muted mt-2">
                      Find the App ID in your AI App details page.
                    </p>
                  </div>
                )}

                {displayApp && (
                  <AppLauncher
                    app={displayApp}
                    onTaskStarted={handleTaskStarted}
                  />
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function AppCard({ app, onClick }: { app: AppDefinition; onClick: () => void }) {
  const colorClass = CATEGORY_COLORS[app.category] || CATEGORY_COLORS.other;

  return (
    <button
      onClick={onClick}
      className="text-left bg-bg-card border border-border rounded-2xl p-5 shadow-card hover:border-accent-gold/30 hover:shadow-gold-sm hover:-translate-y-0.5 transition-all duration-200 group relative overflow-hidden"
    >
      {app.pinned && (
        <div className="absolute top-3 right-3">
          <Star className="w-3.5 h-3.5 text-accent-gold fill-accent-gold" />
        </div>
      )}
      <div className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border mb-4', colorClass)}>
        {CATEGORY_ICONS[app.category]}
        {app.category.replace('-', ' ')}
      </div>
      <h3 className="text-sm font-semibold text-text-primary mb-1.5 group-hover:text-accent-gold transition-colors">
        {app.name}
      </h3>
      <p className="text-xs text-text-muted leading-relaxed">{app.description}</p>
      <div className="mt-4 flex items-center text-xs text-accent-gold font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        Launch App →
      </div>
    </button>
  );
}
