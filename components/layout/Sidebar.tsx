'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ImageIcon, Film, History, User, LogOut,
  ChevronLeft, ChevronRight, Sparkles, Zap, Shield, Users,
  Activity, Layers, Package, Bot, Crop
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface UserProfile {
  name: string;
  email: string;
  role: 'editor' | 'admin';
  avatar_url?: string | null;
}

const EDITOR_NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/boutiqaat-flow', label: 'Boutiqaat Flow', icon: Zap },
  { href: '/studio', label: 'Image Studio', icon: ImageIcon },
  { href: '/video', label: 'Video Studio', icon: Film },
  { href: '/bundling', label: 'Bundling Studio', icon: Package },
  { href: '/history', label: 'My History', icon: History },
  { href: '/profile', label: 'My Profile', icon: User },
];

const ADMIN_NAV = [
  { href: '/admin', label: 'Admin Dashboard', icon: Shield },
  { href: '/admin/tasks', label: 'Task Monitor', icon: Activity },
  { href: '/admin/users', label: 'User Management', icon: Users },
  { href: '/', label: 'Studio View', icon: Layers },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user)).catch(() => {});
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Logout failed');
    } finally {
      setLoggingOut(false);
    }
  }

  const isAdmin = user?.role === 'admin';
  const navItems = isAdmin && pathname.startsWith('/admin') ? ADMIN_NAV : EDITOR_NAV;

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  return (
    <aside className={cn(
      'relative flex flex-col h-screen bg-bg-secondary border-r border-border transition-all duration-300 flex-shrink-0',
      collapsed ? 'w-[68px]' : 'w-64'
    )}>
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-20 z-10 w-7 h-7 rounded-full bg-bg-card border border-border flex items-center justify-center text-text-muted hover:text-accent-gold hover:border-accent-gold/40 transition-all shadow-card"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Brand */}
      <div className={cn('flex items-center gap-3 p-4 border-b border-border h-16 flex-shrink-0', collapsed && 'justify-center px-2')}>
        {collapsed ? (
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <img src="/btq-logo.png" className="w-full h-full object-contain" alt="Boutiqaat Logo" />
          </div>
        ) : (
          <div className="flex flex-col items-start overflow-hidden animate-fade-in">
            <img src="/btq-logo.png" className="h-7 w-auto object-contain" alt="Boutiqaat Logo" />
            <p className="text-[8px] text-text-muted leading-none font-semibold tracking-[0.2em] uppercase mt-1 pl-0.5">STUDIO AI HUB</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto pt-3">
        {/* Admin badge */}
        {isAdmin && !collapsed && (
          <div className="px-3 py-1.5 mb-2">
            <div className="flex items-center gap-1.5 text-[10px] text-accent-gold/70 font-semibold uppercase tracking-widest">
              <Zap className="w-3 h-3" />
              {pathname.startsWith('/admin') ? 'Admin Panel' : 'Editor View'}
            </div>
          </div>
        )}

        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/'
            ? pathname === '/'
            : pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                active
                  ? 'bg-accent-gold/10 text-accent-gold border border-accent-gold/20'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary border border-transparent',
                collapsed && 'justify-center px-2.5'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', active && 'text-accent-gold')} />
              {!collapsed && <span className="animate-fade-in truncate">{label}</span>}
            </Link>
          );
        })}

        {/* Admin switch */}
        {isAdmin && !collapsed && (
          <div className="pt-3 mt-3 border-t border-border">
            <Link
              href={pathname.startsWith('/admin') ? '/' : '/admin'}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-muted hover:text-accent-gold hover:bg-accent-gold/5 border border-transparent hover:border-accent-gold/15 transition-all"
            >
              {pathname.startsWith('/admin') ? (
                <><Layers className="w-4 h-4" /> Switch to Studio</>
              ) : (
                <><Shield className="w-4 h-4" /> Switch to Admin</>
              )}
            </Link>
          </div>
        )}
      </nav>

      {/* User profile footer */}
      <div className={cn('border-t border-border p-3 space-y-1', collapsed && 'flex flex-col items-center')}>
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-bg-hover mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-gold flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-primary truncate">{user.name}</p>
              <p className="text-[10px] text-text-muted truncate">{user.email}</p>
            </div>
            {isAdmin && <Shield className="w-3 h-3 text-accent-gold flex-shrink-0" />}
          </div>
        )}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title={collapsed ? 'Sign Out' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:bg-accent-red/10 hover:text-accent-red border border-transparent hover:border-accent-red/20 transition-all w-full disabled:opacity-50',
            collapsed && 'justify-center w-auto'
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
