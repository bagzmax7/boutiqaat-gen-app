'use client';

import { usePathname } from 'next/navigation';
import { Bell, RefreshCw } from 'lucide-react';
import { useState } from 'react';

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Studio Dashboard', subtitle: 'Welcome to your AI creative workspace' },
  '/image-agent': { title: 'Image Agent ✨', subtitle: 'AI-powered image generation with intelligent prompt enhancement' },
  '/studio': { title: 'Image AI Studio', subtitle: 'Process and enhance product images with AI' },
  '/video': { title: 'Video AI Studio', subtitle: 'Generate and edit video content with AI' },
  '/history': { title: 'My History', subtitle: 'All your past AI generation tasks' },
  '/profile': { title: 'My Profile', subtitle: 'Manage your account settings' },
  '/apps': { title: 'AI Apps', subtitle: 'Browse and launch AI generation apps' },
  '/tasks': { title: 'Task Monitor', subtitle: 'Track and manage all running tasks' },
  '/admin': { title: 'Admin Dashboard', subtitle: 'Platform overview for developers' },
  '/admin/tasks': { title: 'Task Monitor', subtitle: 'Real-time task history' },
  '/admin/users': { title: 'User Management', subtitle: 'Manage editor accounts and access' },
  '/studio/social-resize': { title: 'Social Resize', subtitle: 'Adapt one image to all social formats with AI Generative Fill & Focal Cropping.' },
};

export default function TopBar({ onRefresh }: { onRefresh?: () => void }) {
  const pathname = usePathname();
  const [refreshing, setRefreshing] = useState(false);

  const routeInfo = Object.entries(ROUTE_TITLES).find(([path]) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)
  )?.[1] || { title: 'Boutiqaat Gen-App', subtitle: '' };

  async function handleRefresh() {
    setRefreshing(true);
    onRefresh?.();
    setTimeout(() => setRefreshing(false), 800);
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <header className="h-16 bg-bg-secondary border-b border-border flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: Page title */}
      <div>
        <h1 className="text-base font-semibold text-text-primary">{routeInfo.title}</h1>
        <p className="text-xs text-text-muted">{routeInfo.subtitle}</p>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Date/time */}
        <div className="hidden md:flex flex-col items-end">
          <span className="text-xs font-medium text-text-secondary">{timeStr}</span>
          <span className="text-xs text-text-muted">{dateStr}</span>
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent hover:border-border transition-all"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* Notification bell (decorative) */}
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent hover:border-border transition-all relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent-gold rounded-full" />
        </button>

        {/* User avatar */}
        <div className="w-8 h-8 rounded-lg bg-gradient-gold flex items-center justify-center text-white text-xs font-bold">
          E
        </div>
      </div>
    </header>
  );
}
