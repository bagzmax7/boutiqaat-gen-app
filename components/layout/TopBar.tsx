'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell, RefreshCw, AlertTriangle, CheckCircle2, Star,
  DollarSign, Sparkles, Check, ExternalLink, X,
  User, History, LogOut, Shield, ShieldAlert, ChevronRight
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { NotificationItem } from '@/lib/types';
import toast from 'react-hot-toast';

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Studio Dashboard', subtitle: 'Welcome to your AI creative workspace' },
  '/boutiqaat-flow': { title: 'Boutiqaat Flow', subtitle: 'The ultimate AI creative workspace' },
  '/studio': { title: 'Image AI Studio', subtitle: 'Process and enhance product images with AI' },
  '/video': { title: 'Video AI Studio', subtitle: 'Generate and edit video content with AI' },
  '/history': { title: 'My Generation History', subtitle: 'All your past AI creative tasks' },
  '/profile': { title: 'My Profile', subtitle: 'Manage your account settings' },
  '/apps': { title: 'AI Apps Directory', subtitle: 'Browse and launch AI generation apps' },
  '/tasks': { title: 'Task Monitor', subtitle: 'Track and manage running tasks' },
  '/manager': { title: 'Executive Overview', subtitle: 'Division financial pulse and AI asset metrics' },
  '/manager/team': { title: 'Workforce Directory', subtitle: 'Manage team member access and credit quotas' },
  '/manager/gallery': { title: 'Team Creative Gallery', subtitle: 'Curated masterpieces and company presets' },
  '/manager/presets': { title: 'Brand Style Presets', subtitle: 'Standardized prompt formulas and styles' },
  '/manager/reports': { title: 'Financial & Task Audit', subtitle: 'Official records and Excel export' },
  '/admin': { title: 'Super Admin Console', subtitle: 'Platform-wide infrastructure overview' },
  '/admin/pricing': { title: 'AI Model Pricing Matrix', subtitle: 'Transparent cost matrix and live batch calculator' },
  '/admin/tasks': { title: 'Platform Task Monitor', subtitle: 'Multi-key task history & analytics' },
  '/admin/users': { title: 'Global User Management', subtitle: 'Manage platform roles and credentials' },
  '/studio/social-resize': { title: 'Social Resize', subtitle: 'Adapt one image to all social formats with Generative Fill & Focal Cropping.' },
};

export default function TopBar({ onRefresh }: { onRefresh?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<{ name?: string; role?: string; email?: string } | null>(null);

  // Notification Center State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // User Profile Dropdown State
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const routeInfo = Object.entries(ROUTE_TITLES).find(([path]) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)
  )?.[1] || { title: 'Boutiqaat Creative Studio', subtitle: '' };

  const fetchUserAndNotifications = async () => {
    try {
      const [meRes, notifRes] = await Promise.all([
        fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
        fetch('/api/notifications').then(r => r.ok ? r.json() : null),
      ]);

      if (meRes?.user) setUser(meRes.user);
      if (notifRes?.notifications) {
        setNotifications(notifRes.notifications);
        setUnreadCount(notifRes.unreadCount || 0);
      }
    } catch {}
  };

  useEffect(() => {
    fetchUserAndNotifications();
    const interval = setInterval(fetchUserAndNotifications, 30000); // 30s polling
    return () => clearInterval(interval);
  }, []);

  // Close drawers when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    onRefresh?.();
    fetchUserAndNotifications();
    setTimeout(() => setRefreshing(false), 800);
  }

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {}
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notif.id }),
      });
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    if (notif.link_url) {
      setShowNotifications(false);
      router.push(notif.link_url);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      window.location.href = '/login';
    } catch {
      toast.error('Logout failed');
    }
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return { label: 'Super Admin', color: 'bg-[#d2ff2d]/20 text-[#d2ff2d] border-[#d2ff2d]/30' };
      case 'manager':
        return { label: 'Manager', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' };
      default:
        return { label: 'Creative Editor', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
    }
  };

  const roleInfo = getRoleBadge(user?.role);

  return (
    <header className="h-16 bg-bg-secondary border-b border-border flex items-center justify-between px-6 flex-shrink-0 relative z-30">
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
          title="Refresh Studio State"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
        </button>

        {/* Active Notification Center Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent hover:border-border transition-all relative",
              showNotifications && "bg-bg-hover border-border text-white"
            )}
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 bg-accent-gold text-black text-[9px] font-black rounded-full flex items-center justify-center shadow-md animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Slide-Down Notification Drawer */}
          {showNotifications && (
            <div className="absolute right-0 top-11 w-80 sm:w-96 bg-[#13151a] border border-border/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              {/* Header */}
              <div className="p-3.5 border-b border-border/60 flex items-center justify-between bg-white/3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-accent-gold" />
                  <span className="text-xs font-bold text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-accent-gold/20 text-accent-gold">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10.5px] font-semibold text-accent-gold hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-text-muted text-xs">
                    <Bell className="w-6 h-6 mx-auto mb-2 text-text-muted/40" />
                    No notifications at this time
                  </div>
                ) : (
                  notifications.map(notif => {
                    const isBudget = notif.type === 'BUDGET_ALERT';
                    const isQuota = notif.type === 'QUOTA_WARNING';
                    const isGallery = notif.type === 'GALLERY_STAR';

                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={cn(
                          "p-3 hover:bg-white/4 transition-colors cursor-pointer flex items-start gap-3 text-left",
                          !notif.read && "bg-accent-gold/5"
                        )}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                          isBudget ? "bg-accent-red/15 text-accent-red" :
                          isQuota ? "bg-accent-blue/15 text-accent-blue" :
                          isGallery ? "bg-accent-gold/15 text-accent-gold" :
                          "bg-white/5 text-text-muted"
                        )}>
                          {isBudget ? <AlertTriangle className="w-3.5 h-3.5" /> :
                           isQuota ? <DollarSign className="w-3.5 h-3.5" /> :
                           isGallery ? <Star className="w-3.5 h-3.5 fill-accent-gold" /> :
                           <Sparkles className="w-3.5 h-3.5" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className={cn("text-xs font-bold truncate", notif.read ? "text-text-primary" : "text-white")}>
                              {notif.title}
                            </h4>
                            <span className="text-[9px] text-text-muted whitespace-nowrap">
                              {new Date(notif.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-2 leading-relaxed">
                            {notif.message}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar with Social-Media / SaaS Style Dropdown Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className={cn(
              "w-8 h-8 rounded-lg bg-gradient-to-br from-accent-gold to-accent-gold/60 border border-accent-gold/40 flex items-center justify-center text-black text-xs font-black shadow-md uppercase cursor-pointer transition-all hover:scale-105 active:scale-95",
              showUserMenu && "ring-2 ring-[#d2ff2d] ring-offset-2 ring-offset-[#0B0A0A]"
            )}
            title={`${user?.name || 'User'} (${user?.role || 'editor'})`}
          >
            {user?.name?.slice(0, 1) || 'U'}
          </button>

          {/* Social Profile Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 top-11 w-64 bg-[#111216] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50 text-left">
              {/* Profile Card Header */}
              <div className="p-4 bg-gradient-to-b from-white/[0.04] to-transparent border-b border-white/[0.08] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold to-accent-gold/70 border border-accent-gold/40 flex items-center justify-center text-black text-sm font-black shadow-inner uppercase shrink-0">
                  {user?.name?.slice(0, 1) || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate">
                    {user?.name || 'Boutiqaat Creator'}
                  </h4>
                  <p className="text-[10.5px] text-zinc-400 truncate">
                    {user?.email || 'creator@boutiqaat.com'}
                  </p>
                  <div className="mt-1">
                    <span className={cn('text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border', roleInfo.color)}>
                      {roleInfo.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Menu Navigation Links */}
              <div className="p-2 space-y-1">
                <Link
                  href="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-400 group-hover:text-accent-gold group-hover:border-accent-gold/30 transition-colors shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block font-semibold">My Profile</span>
                    <span className="block text-[10px] text-zinc-500 truncate">Account settings & security</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-white transition-colors" />
                </Link>

                <Link
                  href="/history"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-400 group-hover:text-accent-blue group-hover:border-accent-blue/30 transition-colors shrink-0">
                    <History className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block font-semibold">My History</span>
                    <span className="block text-[10px] text-zinc-500 truncate">Past AI creative tasks</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-white transition-colors" />
                </Link>

                {/* Super Admin Quick Link */}
                {user?.role === 'admin' && (
                  <Link
                    href="/admin/pricing"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#d2ff2d]/10 border border-[#d2ff2d]/25 flex items-center justify-center text-[#d2ff2d] shrink-0">
                      <DollarSign className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block font-semibold text-white">AI Pricing Matrix</span>
                      <span className="block text-[10px] text-zinc-500 truncate">Admin cost & billing table</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-white transition-colors" />
                  </Link>
                )}
              </div>

              {/* Sign Out Section */}
              <div className="p-2 border-t border-white/[0.08] bg-black/20">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors group text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-red-950/40 border border-red-500/20 flex items-center justify-center text-red-400 group-hover:border-red-500/40 transition-colors shrink-0">
                    <LogOut className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block font-bold">Sign Out</span>
                    <span className="block text-[10px] text-red-300/60 truncate">End active session</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
