'use client';

import React from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { useAppControls } from '@/hooks/useAppControls';
import { Sparkles, Clock, Wrench, RefreshCw, ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLockoutGuardProps {
  appKey: string;
  appName: string;
  children: React.ReactNode;
}

export default function AppLockoutGuard({ appKey, appName, children }: AppLockoutGuardProps) {
  const { controls, isAdmin, loading, isAppLocked, getAppStatus } = useAppControls();

  if (loading) {
    return (
      <div className="flex h-screen bg-bg-primary items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent-gold/40 border-t-accent-gold animate-spin" />
          <p className="text-xs text-text-muted">Verifying studio permissions...</p>
        </div>
      </div>
    );
  }

  const isLocked = isAppLocked(appKey);
  const status = getAppStatus(appKey);

  // If user is Super Admin or tool is ACTIVE, render the studio directly
  if (!isLocked || isAdmin) {
    return <>{children}</>;
  }

  // Determine icon, badge styling, and explanation text based on status
  let statusBadge = 'COMING SOON';
  let statusTitle = 'Feature Coming Soon';
  let statusDesc = 'This creative AI studio tool is currently being prepared and will be released in an upcoming update.';
  let badgeColor = 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
  let Icon = Clock;

  if (status === 'UNDER_MAINTENANCE') {
    statusBadge = 'UNDER MAINTENANCE';
    statusTitle = 'Studio Under Maintenance';
    statusDesc = 'Our engineering team is currently performing scheduled maintenance to upgrade AI neural engines. Access will be restored shortly.';
    badgeColor = 'bg-amber-500/10 border-amber-500/30 text-amber-400';
    Icon = Wrench;
  } else if (status === 'UPDATE_PROCESS') {
    statusBadge = 'UPDATE PROCESS';
    statusTitle = 'System Update in Progress';
    statusDesc = 'New model checkpoints and enhancements are currently being deployed to this tool. Please check back soon.';
    badgeColor = 'bg-blue-500/10 border-blue-500/30 text-blue-400';
    Icon = RefreshCw;
  }

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
          <div className="max-w-md w-full glass-card rounded-3xl p-8 border border-border/80 text-center relative overflow-hidden shadow-2xl">
            {/* Background ambient glow */}
            <div className="absolute -top-16 -left-16 w-44 h-44 bg-accent-gold/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-accent-purple/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              {/* Status Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold tracking-wider uppercase mb-6 shadow-sm mx-auto">
                <span className={cn('px-2 py-0.5 rounded-full border text-[11px] font-extrabold', badgeColor)}>
                  {statusBadge}
                </span>
              </div>

              {/* Icon Container */}
              <div className="w-16 h-16 rounded-2xl bg-bg-secondary/80 border border-border flex items-center justify-center mx-auto mb-5 shadow-inner">
                <Icon className="w-8 h-8 text-text-secondary animate-pulse" />
              </div>

              {/* Title & Description in English */}
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                {statusTitle}
              </h2>
              <p className="text-xs font-semibold text-accent-gold uppercase tracking-widest mb-3">
                {appName}
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mb-8">
                {statusDesc}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
                <Link
                  href="/"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-gold text-bg-primary font-bold text-sm hover:opacity-90 transition-all btn-lift glow-gold shadow-lg"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Link>
                <Link
                  href="/boutiqaat-flow"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-bg-secondary hover:bg-bg-tertiary border border-border text-text-secondary hover:text-text-primary text-sm font-semibold transition-all"
                >
                  <Sparkles className="w-4 h-4 text-accent-gold" />
                  Explore Active Tools
                </Link>
              </div>

              {/* Admin Note if viewer is guest/editor */}
              <div className="mt-8 pt-6 border-t border-border/40 flex items-center justify-center gap-1.5 text-xs text-text-muted">
                <Shield className="w-3.5 h-3.5" />
                <span>Super Admins can manage access from the Admin Portal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
