'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import {
  Sparkles, ImageIcon, Film, CheckCircle2,
  Loader2, Download, ArrowRight, Zap,
  TrendingUp, Star, Package
} from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { cn, isVideoUrl } from '@/lib/utils';

interface UserProfile {
  name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
}

interface SupabaseTask {
  id: string;
  app_name: string;
  status: string;
  outputs: Array<{ fileUrl: string; fileType?: string }>;
  created_at: string;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function EditorDashboard() {
  const { tasks } = useTasks();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [historyTasks, setHistoryTasks] = useState<SupabaseTask[]>([]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => {});
    fetch('/api/tasks?limit=12')
      .then((r) => r.json())
      .then((d) => { if (d.tasks) setHistoryTasks(d.tasks); })
      .catch(() => {});
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTasks = tasks.filter((t) => t.createdAt >= today.getTime());
  const activeTasks = tasks.filter((t) => t.status === 'RUNNING' || t.status === 'QUEUED');
  const completed = tasks.filter((t) => t.status === 'SUCCESS');
  const savedMinutes = completed.length * 3;

  const recentOutputs = tasks
    .filter((t) => t.status === 'SUCCESS' && t.outputs && t.outputs.length > 0)
    .slice(0, 6)
    .flatMap((t) => t.outputs?.slice(0, 1).map((o) => ({ url: o.fileUrl, label: t.appName, isVideo: isVideoUrl(o.fileUrl) })) || []);

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-y-auto">

          {/* ── Hero Banner ───────────────────────────────── */}
          <div className="relative overflow-hidden px-6 py-10 border-b border-border/50">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-gold/5 via-transparent to-accent-purple/5 pointer-events-none" />
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-accent-gold/8 rounded-full blur-3xl pointer-events-none" />
            <div className="max-w-5xl mx-auto relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-accent-gold text-sm font-semibold mb-1 tracking-widest uppercase">
                    {getGreeting()},
                  </p>
                  <h1 className="text-3xl font-bold text-text-primary mb-2">
                    {user?.name ?? '...'}
                    <span className="ml-2 text-2xl">👋</span>
                  </h1>
                  <p className="text-text-secondary text-sm max-w-md">
                    {"Your AI studio is ready. Let's create something amazing today."}
                  </p>
                </div>
                {activeTasks.length > 0 && (
                  <div className="flex items-center gap-2 bg-accent-blue/10 border border-accent-blue/25 text-accent-blue text-xs font-semibold px-4 py-2 rounded-xl">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {activeTasks.length} task{activeTasks.length > 1 ? 's' : ''} running
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-8 max-w-5xl mx-auto space-y-8">

            {/* ── Stats ─────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Today', value: todayTasks.length, icon: Zap, color: 'text-accent-gold', bg: 'bg-accent-gold/10 border-accent-gold/20' },
                { label: 'Completed', value: completed.length, icon: CheckCircle2, color: 'text-accent-green', bg: 'bg-accent-green/10 border-accent-green/20' },
                { label: 'In Progress', value: activeTasks.length, icon: Loader2, color: 'text-accent-blue', bg: 'bg-accent-blue/10 border-accent-blue/20' },
                { label: 'Min. Saved', value: savedMinutes, icon: TrendingUp, color: 'text-accent-purple', bg: 'bg-accent-purple/10 border-accent-purple/20' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className={cn('glass-card rounded-2xl p-5 border flex items-center gap-4', bg)}>
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
                    <Icon className={cn('w-5 h-5', color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-text-primary">{value}</p>
                    <p className="text-xs text-text-muted font-medium">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Quick Launch ──────────────────────────── */}
            <div>
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-widest mb-4 flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-accent-gold" /> Quick Launch
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link href="/studio" className="group relative overflow-hidden glass-card rounded-2xl p-6 border border-accent-green/20 hover:border-accent-green/50 transition-all hover:-translate-y-0.5 hover:shadow-card">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent-green/5 to-transparent pointer-events-none" />
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg">
                    <ImageIcon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-text-primary mb-1 group-hover:text-accent-green transition-colors">Image AI Studio</h3>
                  <p className="text-xs text-text-muted mb-4">Batch BG Removal · Virtual Try-On · Change Background</p>
                  <div className="flex items-center gap-1 text-xs text-accent-green font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    Open Studio <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Link>

                <Link href="/video" className="group relative overflow-hidden glass-card rounded-2xl p-6 border border-accent-purple/20 hover:border-accent-purple/50 transition-all hover:-translate-y-0.5 hover:shadow-card">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/5 to-transparent pointer-events-none" />
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
                    <Film className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-text-primary mb-1 group-hover:text-accent-purple transition-colors">Video AI Studio</h3>
                  <p className="text-xs text-text-muted mb-4">BG Removal · Seedance · Veo3.1 · Kling · Happy Horse</p>
                  <div className="flex items-center gap-1 text-xs text-accent-purple font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    Open Studio <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Link>

                <Link href="/bundling" className="group relative overflow-hidden glass-card rounded-2xl p-6 border border-accent-gold/20 hover:border-accent-gold/50 transition-all hover:-translate-y-0.5 hover:shadow-card">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent-gold/5 to-transparent pointer-events-none" />
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 shadow-lg">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-text-primary mb-1 group-hover:text-accent-gold transition-colors">Bundling Studio</h3>
                  <p className="text-xs text-text-muted mb-4">AI Bundle Generator · Dimension Analysis · Prompt Builder</p>
                  <div className="flex items-center gap-1 text-xs text-accent-gold font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    Open Studio <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Link>
              </div>
            </div>

            {/* ── Active Tasks ──────────────────────────── */}
            {activeTasks.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-accent-blue animate-spin" /> Active Tasks
                </h2>
                <div className="space-y-2">
                  {activeTasks.map((task) => (
                    <div key={task.id} className="glass-card rounded-xl p-4 border border-accent-blue/20 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{task.appName}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {new Date(task.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-accent-blue/10 border-accent-blue/30 text-accent-blue">
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Recent Outputs Gallery ────────────────── */}
            {recentOutputs.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-green" /> Recent Outputs
                  </h2>
                  <Link href="/history" className="text-xs text-accent-gold hover:text-accent-gold/80 font-medium transition-colors">
                    View all history →
                  </Link>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {recentOutputs.map((item, idx) => (
                    <a
                      key={idx}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="group relative rounded-xl overflow-hidden bg-bg-secondary border border-border hover:border-accent-gold/40 transition-all hover:scale-105"
                      style={{ aspectRatio: '1/1' }}
                    >
                      {item.url && (
                        item.isVideo ? (
                          <video
                            src={item.url}
                            className="w-full h-full object-cover"
                            autoPlay
                            muted
                            loop
                            playsInline
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.url}
                            alt={item.label}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        )
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Download className="w-4 h-4 text-white" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* ── Empty State ───────────────────────────── */}
            {tasks.length === 0 && (
              <div className="text-center py-16 glass-card rounded-2xl border border-dashed border-border">
                <Sparkles className="w-10 h-10 text-accent-gold/40 mx-auto mb-3" />
                <h3 className="text-text-primary font-semibold mb-1">Ready to create!</h3>
                <p className="text-text-muted text-sm mb-5">Start by launching an AI tool from the studio.</p>
                <Link href="/studio" className="inline-flex items-center gap-2 bg-gradient-gold text-white text-sm font-semibold px-5 py-2.5 rounded-xl btn-lift glow-gold">
                  <Zap className="w-4 h-4" /> Open Image Studio
                </Link>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
