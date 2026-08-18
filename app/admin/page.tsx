'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { Shield, Users, CheckCircle2, XCircle, Loader2, Clock, TrendingUp, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface AdminTask {
  id: string; app_name: string; status: string; created_at: string;
  api_key_type: string; users?: { name: string; email: string };
}

export default function AdminPage() {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks?limit=50&scope=all').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([taskData, userData]) => {
      setTasks(taskData.tasks || []);
      setUserCount(userData.users?.length || 0);
    }).finally(() => setLoading(false));
  }, []);

  const successCount = tasks.filter(t => t.status === 'SUCCESS').length;
  const consumerCount = tasks.filter(t => t.api_key_type === 'consumer').length;
  const enterpriseCount = tasks.filter(t => t.api_key_type === 'enterprise').length;

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-gold to-orange-600 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary">Admin Dashboard</h1>
                <p className="text-sm text-text-secondary">Platform overview & monitoring</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 max-w-5xl mx-auto space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Users', value: userCount, icon: Users, color: 'text-accent-purple', bg: 'bg-accent-purple/10 border-accent-purple/20' },
                { label: 'Total Tasks', value: tasks.length, icon: TrendingUp, color: 'text-accent-gold', bg: 'bg-accent-gold/10 border-accent-gold/20' },
                { label: 'Successful', value: successCount, icon: CheckCircle2, color: 'text-accent-green', bg: 'bg-accent-green/10 border-accent-green/20' },
                { label: 'Success Rate', value: tasks.length ? `${Math.round(successCount / tasks.length * 100)}%` : '—', icon: TrendingUp, color: 'text-accent-blue', bg: 'bg-accent-blue/10 border-accent-blue/20' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className={cn('glass-card rounded-2xl p-5 border flex items-center gap-4', bg)}>
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', bg)}>
                    <Icon className={cn('w-5 h-5', color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-text-primary">{value}</p>
                    <p className="text-xs text-text-muted">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* API Key Usage */}
            <div className="glass-card rounded-2xl p-6 border border-border">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">API Key Usage Split</h2>
              <div className="flex gap-4">
                <div className="flex-1 bg-accent-green/5 border border-accent-green/20 rounded-xl p-4">
                  <p className="text-xs text-text-muted mb-1">🟢 Consumer (RH Coins)</p>
                  <p className="text-2xl font-bold text-accent-green">{consumerCount}</p>
                  <p className="text-xs text-text-muted">{tasks.length ? Math.round(consumerCount / tasks.length * 100) : 0}% of total</p>
                </div>
                <div className="flex-1 bg-accent-blue/5 border border-accent-blue/20 rounded-xl p-4">
                  <p className="text-xs text-text-muted mb-1">🔵 Enterprise (Wallet)</p>
                  <p className="text-2xl font-bold text-accent-blue">{enterpriseCount}</p>
                  <p className="text-xs text-text-muted">{tasks.length ? Math.round(enterpriseCount / tasks.length * 100) : 0}% of total</p>
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div className="flex gap-3">
              <Link href="/admin/tasks" className="flex items-center gap-2 bg-accent-blue/10 border border-accent-blue/25 text-accent-blue text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-accent-blue/15 transition-all">
                <Activity className="w-4 h-4" /> Task Monitor
              </Link>
              <Link href="/admin/users" className="flex items-center gap-2 bg-accent-gold/10 border border-accent-gold/25 text-accent-gold text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-accent-gold/15 transition-all">
                <Users className="w-4 h-4" /> Manage Users
              </Link>
            </div>

            {/* Recent tasks from all users */}
            <div>
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Recent Activity (All Users)</h2>
              {loading ? (
                <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-accent-gold/50" /></div>
              ) : (
                <div className="space-y-2">
                  {tasks.slice(0, 20).map(task => (
                    <div key={task.id} className="glass-card rounded-xl p-4 border border-border flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{task.app_name}</p>
                        <p className="text-xs text-text-muted">{task.users?.name || 'Unknown'} · {new Date(task.created_at).toLocaleString()}</p>
                      </div>
                      <span className={cn(
                        'text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0',
                        task.status === 'SUCCESS' ? 'text-accent-green bg-accent-green/10 border-accent-green/25' :
                        task.status === 'FAILED' ? 'text-accent-red bg-accent-red/10 border-accent-red/25' :
                        'text-accent-gold bg-accent-gold/10 border-accent-gold/25'
                      )}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
