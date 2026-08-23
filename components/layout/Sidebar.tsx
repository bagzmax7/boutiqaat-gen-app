'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ImageIcon, Film,
  ChevronLeft, ChevronRight,
  Sparkles, Zap, Shield, Users,
  Activity, Layers, Bookmark, ShieldAlert,
  FileSpreadsheet, DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserProfile {
  name: string;
  email: string;
  role: 'editor' | 'admin' | 'manager';
  avatar_url?: string | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
}

const EDITOR_NAV: NavItem[] = [
  { href: '/', label: 'Studio Dashboard', icon: LayoutDashboard },
  { href: '/boutiqaat-flow', label: 'Boutiqaat Flow', icon: Zap },
  { href: '/studio', label: 'Image Studio', icon: ImageIcon },
  { href: '/video', label: 'Video Studio', icon: Film },
];

const MANAGER_NAV: NavItem[] = [
  { href: '/manager', label: 'Executive Pulse', icon: ShieldAlert },
  { href: '/manager/team', label: 'My Team', icon: Users },
  { href: '/manager/presets', label: 'Brand Style Presets', icon: Bookmark },
  { href: '/manager/reports', label: 'Financial Audit', icon: FileSpreadsheet },
  { href: '/', label: 'Switch to Studio', icon: Layers },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Super Admin Console', icon: Shield },
  { href: '/admin/tasks', label: 'Task Monitor', icon: Activity },
  { href: '/admin/pricing', label: 'AI Pricing Matrix', icon: DollarSign },
  { href: '/admin/users', label: 'User Management', icon: Users },
  { href: '/manager', label: 'Manager Portal', icon: ShieldAlert },
  { href: '/', label: 'Studio View', icon: Layers },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setUser(d.user))
      .catch(() => {});
  }, []);

  // Determine navigation tier
  let navItems = EDITOR_NAV;
  let panelLabel = 'Editor Workspace';

  if (user?.role === 'admin') {
    if (pathname.startsWith('/admin')) {
      navItems = ADMIN_NAV;
      panelLabel = 'Super Admin Console';
    } else if (pathname.startsWith('/manager')) {
      navItems = MANAGER_NAV;
      panelLabel = 'Manager Portal';
    } else {
      navItems = EDITOR_NAV;
      panelLabel = 'Studio View (Admin)';
    }
  } else if (user?.role === 'manager') {
    if (pathname.startsWith('/manager') || pathname.startsWith('/admin')) {
      navItems = MANAGER_NAV;
      panelLabel = 'Manager Portal';
    } else {
      navItems = EDITOR_NAV;
      panelLabel = 'Studio View';
    }
  }

  return (
    <aside className={cn(
      'relative flex flex-col h-screen bg-bg-secondary border-r border-border transition-all duration-300 flex-shrink-0 z-20',
      collapsed ? 'w-[68px]' : 'w-64'
    )}>
      {/* Collapse toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-20 z-10 w-7 h-7 rounded-full bg-bg-card border border-border flex items-center justify-center text-text-muted hover:text-accent-gold hover:border-accent-gold/40 transition-all shadow-card"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Brand Header */}
      <div className={cn('flex items-center gap-3 p-4 border-b border-border h-16 flex-shrink-0', collapsed && 'justify-center px-2')}>
        {collapsed ? (
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
            <img src="/btq-logo.png" className="w-full h-full object-contain" alt="Boutiqaat Logo" />
          </div>
        ) : (
          <div className="flex flex-col items-start overflow-hidden animate-fade-in">
            <img src="/btq-logo.png" className="h-9 w-auto object-contain" alt="Boutiqaat Logo" />
            <p className="text-[8px] text-text-muted leading-none font-semibold tracking-[0.2em] uppercase mt-1.5 pl-0.5">CREATIVE AI STUDIO</p>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto pt-3 custom-scrollbar">
        {/* Role Badge */}
        {!collapsed && (
          <div className="px-3 py-1.5 mb-2">
            <div className="flex items-center gap-1.5 text-[10px] text-accent-gold/80 font-bold uppercase tracking-wider">
              {user?.role === 'admin' ? <Shield className="w-3 h-3 text-accent-gold" /> :
               user?.role === 'manager' ? <ShieldAlert className="w-3 h-3 text-accent-blue" /> :
               <Zap className="w-3 h-3 text-text-muted" />}
              <span>{panelLabel}</span>
            </div>
          </div>
        )}

        {navItems.map(item => {
          const active = item.href === '/' || item.href === '/admin' || item.href === '/manager'
            ? pathname === item.href
            : pathname === item.href || (item.href === '/studio' && (pathname.startsWith('/studio') || pathname.startsWith('/layers') || pathname.startsWith('/bundling'))) || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                active
                  ? 'bg-accent-gold/10 text-accent-gold border border-accent-gold/20'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary border border-transparent',
                collapsed && 'justify-center px-2.5'
              )}
            >
              <item.icon className={cn('w-4 h-4 flex-shrink-0', active && 'text-accent-gold')} />
              {!collapsed && <span className="animate-fade-in truncate">{item.label}</span>}
            </Link>
          );
        })}

        {/* Quick Portal Switcher */}
        {!collapsed && (user?.role === 'admin' || user?.role === 'manager') && (
          <div className="pt-3 mt-3 border-t border-border">
            {user?.role === 'admin' ? (
              <div className="space-y-1">
                <Link
                  href={pathname.startsWith('/admin') ? '/manager' : '/admin'}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-accent-gold hover:bg-accent-gold/5 transition-all"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-accent-blue" />
                  {pathname.startsWith('/admin') ? 'View Manager Portal' : 'View Super Admin Console'}
                </Link>
              </div>
            ) : (
              <Link
                href={pathname.startsWith('/manager') ? '/' : '/manager'}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-accent-gold hover:bg-accent-gold/5 transition-all"
              >
                {pathname.startsWith('/manager') ? (
                  <><Layers className="w-3.5 h-3.5" /> Switch to Studio</>
                ) : (
                  <><ShieldAlert className="w-3.5 h-3.5 text-accent-blue" /> Open Manager Portal</>
                )}
              </Link>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
