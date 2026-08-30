'use client';

import React, { useState } from 'react';
import { useAppControls } from '@/hooks/useAppControls';
import { AppStatus } from '@/lib/app-controls';
import { Sliders, Shield, CheckCircle2, Clock, Wrench, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function AppControlsPanel() {
  const { controls, loading, updateStatus } = useAppControls();
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const statusOptions: { value: AppStatus; label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string }[] = [
    {
      value: 'ACTIVE',
      label: 'Active (Public)',
      icon: CheckCircle2,
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
    {
      value: 'COMING_SOON',
      label: 'Coming Soon',
      icon: Clock,
      badgeClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    },
    {
      value: 'UNDER_MAINTENANCE',
      label: 'Under Maintenance',
      icon: Wrench,
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    },
    {
      value: 'UPDATE_PROCESS',
      label: 'Update Process',
      icon: RefreshCw,
      badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    },
  ];

  async function handleStatusChange(appKey: string, newStatus: AppStatus) {
    setUpdatingKey(appKey);
    const success = await updateStatus(appKey, newStatus);
    setUpdatingKey(null);
    if (success) {
      toast.success(`${controls[appKey]?.name || appKey} status set to ${newStatus}`);
    } else {
      toast.error('Failed to update app status');
    }
  }

  const appList = Object.values(controls);

  return (
    <div className="rounded-3xl bg-[#0e0f14] border border-white/[0.08] p-6 space-y-5 relative overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-accent-gold" />
            Studio App & Feature Access Control
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time kill switch & maintenance control. Super Admins always have bypass access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            LIVE SYNC
          </span>
        </div>
      </div>

      {/* Grid of Controllable Apps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3.5">
        {appList.map((app) => {
          const currentOption = statusOptions.find((o) => o.value === app.status) || statusOptions[0];
          const Icon = currentOption.icon;
          const isUpdating = updatingKey === app.id;

          return (
            <div
              key={app.id}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/20 transition-all flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">{app.name}</h4>
                  <p className="text-[11px] text-zinc-400 font-mono mt-0.5">{app.route}</p>
                </div>
                <span
                  className={cn(
                    'px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold font-mono uppercase tracking-wider flex items-center gap-1 flex-shrink-0',
                    currentOption.badgeClass
                  )}
                >
                  <Icon className={cn('w-3 h-3', isUpdating && 'animate-spin')} />
                  {currentOption.label}
                </span>
              </div>

              {/* Status Select Control */}
              <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between gap-2">
                <span className="text-[11px] text-zinc-400 font-medium">Access Status:</span>
                <select
                  value={app.status}
                  disabled={isUpdating}
                  onChange={(e) => handleStatusChange(app.id, e.target.value as AppStatus)}
                  className="bg-black/60 border border-white/[0.12] hover:border-accent-gold/40 text-xs font-semibold text-zinc-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent-gold cursor-pointer transition-all"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#12131a] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
