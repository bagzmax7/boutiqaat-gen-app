'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import {
  Users, UserPlus, Key, DollarSign, Shield, RefreshCw,
  Lock, CheckCircle2, AlertTriangle, XCircle, Copy, Check,
  Search, SlidersHorizontal, MoreVertical, Trash2, ShieldCheck,
  Film, Image as ImageIcon, Sparkles, Layers, ArrowUpDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface TeamEditor {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  monthly_credit_limit_usd: number;
  credit_used_usd: number;
  remaining_credit_usd: number;
  usage_percent: number;
  total_tasks_this_month: number;
  success_tasks_this_month: number;
  allowed_models: string[];
  status: 'active' | 'suspended';
  created_at: string;
}

function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  let pass = 'Btx#';
  for (let i = 0; i < 6; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

export default function ManagerTeamPage() {
  const [editors, setEditors] = useState<TeamEditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add Editor Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addQuota, setAddQuota] = useState('50');
  const [addModels, setAddModels] = useState<string[]>(['image', 'video', 'social-resize', 'bundling']);
  const [creating, setCreating] = useState(false);

  // Quick Edit Quota Modal
  const [quotaModalEditor, setQuotaModalEditor] = useState<TeamEditor | null>(null);
  const [quotaAmount, setQuotaAmount] = useState('50');
  const [savingQuota, setSavingQuota] = useState(false);

  // Reset Password Modal
  const [resetModalEditor, setResetModalEditor] = useState<TeamEditor | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [savingReset, setSavingReset] = useState(false);
  const [copied, setCopied] = useState(false);

  // Model Permission Modal
  const [permModalEditor, setPermModalEditor] = useState<TeamEditor | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/manager/team');
      if (!res.ok) throw new Error('Failed to load workforce');
      const data = await res.json();
      setEditors(data.editors || []);
    } catch (err: any) {
      toast.error(err.message || 'Error loading team');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  // 1. Create Editor
  const handleAddEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName || !addEmail || !addPassword) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/manager/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName,
          email: addEmail,
          password: addPassword,
          monthlyCreditLimitUsd: parseFloat(addQuota),
          allowedModels: addModels,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create editor');

      toast.success(`Editor ${addName} provisioned successfully!`);
      setShowAddModal(false);
      setAddName('');
      setAddEmail('');
      setAddPassword('');
      setAddQuota('50');
      fetchTeam();
    } catch (err: any) {
      toast.error(err.message || 'Creation failed');
    } finally {
      setCreating(false);
    }
  };

  // 2. Save Quick Quota
  const handleSaveQuota = async () => {
    if (!quotaModalEditor) return;
    setSavingQuota(true);
    try {
      const res = await fetch(`/api/manager/team/${quotaModalEditor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyCreditLimitUsd: parseFloat(quotaAmount),
        }),
      });

      if (!res.ok) throw new Error('Failed to update quota limit');
      toast.success(`Quota updated to $${quotaAmount} for ${quotaModalEditor.name}`);
      setQuotaModalEditor(null);
      fetchTeam();
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    } finally {
      setSavingQuota(false);
    }
  };

  // 3. Save Reset Password
  const handleSaveResetPassword = async () => {
    if (!resetModalEditor || !resetPasswordVal) return;
    setSavingReset(true);
    try {
      const res = await fetch(`/api/manager/team/${resetModalEditor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: resetPasswordVal,
        }),
      });

      if (!res.ok) throw new Error('Failed to reset password');
      toast.success(`Password reset for ${resetModalEditor.name}!`);
      setResetModalEditor(null);
      setResetPasswordVal('');
    } catch (err: any) {
      toast.error(err.message || 'Reset failed');
    } finally {
      setSavingReset(false);
    }
  };

  // 4. Save Model Permissions
  const handleSavePermissions = async () => {
    if (!permModalEditor) return;
    setSavingPerms(true);
    try {
      const res = await fetch(`/api/manager/team/${permModalEditor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowedModels: selectedModels,
        }),
      });

      if (!res.ok) throw new Error('Failed to update model permissions');
      toast.success(`Permissions updated for ${permModalEditor.name}`);
      setPermModalEditor(null);
      fetchTeam();
    } catch (err: any) {
      toast.error(err.message || 'Permissions update failed');
    } finally {
      setSavingPerms(false);
    }
  };

  // 5. Toggle Account Status (Active / Suspended)
  const handleToggleStatus = async (editor: TeamEditor) => {
    const nextStatus = editor.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch(`/api/manager/team/${editor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) throw new Error('Failed to change status');
      toast.success(`Account ${nextStatus === 'active' ? 'activated' : 'suspended'}`);
      fetchTeam();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    }
  };

  // Filtered list
  const filteredEditors = editors.filter(e => {
    if (!search) return true;
    const kw = search.toLowerCase();
    return e.name.toLowerCase().includes(kw) || e.email.toLowerCase().includes(kw);
  });

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-6 border-b border-border/50 bg-gradient-to-r from-bg-secondary/60 via-transparent to-transparent">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue to-accent-blue/40 flex items-center justify-center shadow-lg border border-accent-blue/30">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-text-primary">Workforce Directory & Quota Controls</h1>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Manage team member access, monthly credit budgets, and model permissions
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={fetchTeam}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-white border border-border hover:bg-bg-hover px-3.5 py-2 rounded-xl transition-all"
                  title="Refresh team"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                  Refresh
                </button>
                <button
                  onClick={() => {
                    setAddPassword(generateRandomPassword());
                    setShowAddModal(true);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold bg-accent-gold text-black hover:bg-accent-gold/90 px-4 py-2 rounded-xl transition-all shadow-md"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Provision New Editor
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
            {/* Search Bar & Quick Stats */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search designer by name or email..."
                  className="w-full bg-bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-text-primary placeholder-text-muted input-gold transition-all"
                />
              </div>

              <div className="flex items-center gap-4 text-xs">
                <span className="text-text-muted">
                  Total Editors: <strong className="text-white font-mono">{editors.length}</strong>
                </span>
                <span className="text-text-muted">
                  Active: <strong className="text-accent-green font-mono">{editors.filter(e => e.status === 'active').length}</strong>
                </span>
                <span className="text-text-muted">
                  Suspended: <strong className="text-accent-red font-mono">{editors.filter(e => e.status === 'suspended').length}</strong>
                </span>
              </div>
            </div>

            {/* Workforce Table */}
            {loading ? (
              <div className="text-center py-20 text-text-muted">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-accent-gold/50" />
                Loading workforce matrix...
              </div>
            ) : filteredEditors.length === 0 ? (
              <div className="text-center py-20 glass-card rounded-2xl border border-dashed border-border">
                <Users className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
                <p className="text-text-muted text-sm">No creative editors found in this division</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 text-xs font-bold text-accent-gold hover:underline"
                >
                  + Add first team editor
                </button>
              </div>
            ) : (
              <div className="glass-card rounded-2xl border border-border overflow-hidden bg-bg-card shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/80 bg-white/3 text-text-muted font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-4">Designer</th>
                        <th className="py-3.5 px-4">Monthly Credit Usage</th>
                        <th className="py-3.5 px-4">Allowed Model Tiers</th>
                        <th className="py-3.5 px-4">Tasks (Mo)</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredEditors.map(editor => {
                        const isOver = editor.usage_percent >= 90;
                        return (
                          <tr key={editor.id} className="hover:bg-white/2 transition-colors group">
                            {/* Designer Info */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center font-bold text-white uppercase text-xs shrink-0">
                                  {editor.name.slice(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-bold text-text-primary block truncate">{editor.name}</span>
                                  <span className="text-[11px] text-text-muted block truncate font-mono">{editor.email}</span>
                                </div>
                              </div>
                            </td>

                            {/* Monthly Credit Progress */}
                            <td className="py-4 px-4 min-w-[200px]">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-mono font-semibold text-white">
                                    ${editor.credit_used_usd.toFixed(2)}{' '}
                                    <span className="text-text-muted font-normal">/ ${editor.monthly_credit_limit_usd.toFixed(2)}</span>
                                  </span>
                                  <span className={cn(
                                    "font-bold text-[10px] px-1.5 py-0.5 rounded",
                                    isOver ? "bg-accent-red/15 text-accent-red" : "bg-white/5 text-text-muted"
                                  )}>
                                    {editor.usage_percent}%
                                  </span>
                                </div>

                                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all",
                                      isOver ? "bg-accent-red" :
                                      editor.usage_percent >= 70 ? "bg-accent-gold" : "bg-accent-blue"
                                    )}
                                    style={{ width: `${Math.min(100, editor.usage_percent)}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Allowed Models */}
                            <td className="py-4 px-4">
                              <div className="flex flex-wrap gap-1 max-w-[220px]">
                                {editor.allowed_models.map((m, i) => (
                                  <span key={i} className="text-[9px] font-semibold bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/80">
                                    {m === 'image' ? 'Image 2K' :
                                     m === 'video' ? 'Video 4K' :
                                     m === 'social-resize' ? 'Resize' :
                                     m === 'bundling' ? 'Bundling' : m}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Task Volume */}
                            <td className="py-4 px-4">
                              <span className="font-mono font-bold text-white block">{editor.total_tasks_this_month} Runs</span>
                              <span className="text-[10px] text-accent-green block">{editor.success_tasks_this_month} Success</span>
                            </td>

                            {/* Status */}
                            <td className="py-4 px-4">
                              <button
                                onClick={() => handleToggleStatus(editor)}
                                className={cn(
                                  "inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all",
                                  editor.status === 'active'
                                    ? "bg-accent-green/10 text-accent-green border-accent-green/25 hover:bg-accent-green/20"
                                    : "bg-accent-red/10 text-accent-red border-accent-red/25 hover:bg-accent-red/20"
                                )}
                                title="Click to toggle active/suspended"
                              >
                                {editor.status === 'active' ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent-green" /> Active
                                  </>
                                ) : (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent-red" /> Suspended
                                  </>
                                )}
                              </button>
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Quick Quota Button */}
                                <button
                                  onClick={() => {
                                    setQuotaModalEditor(editor);
                                    setQuotaAmount(String(editor.monthly_credit_limit_usd));
                                  }}
                                  className="p-2 rounded-lg bg-white/5 hover:bg-accent-gold/15 hover:text-accent-gold text-text-muted transition-all"
                                  title="Quick Edit Quota ($)"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                </button>

                                {/* Permission Tier Button */}
                                <button
                                  onClick={() => {
                                    setPermModalEditor(editor);
                                    setSelectedModels(editor.allowed_models || []);
                                  }}
                                  className="p-2 rounded-lg bg-white/5 hover:bg-accent-blue/15 hover:text-accent-blue text-text-muted transition-all"
                                  title="Manage Model Permissions"
                                >
                                  <SlidersHorizontal className="w-3.5 h-3.5" />
                                </button>

                                {/* Reset Password Button */}
                                <button
                                  onClick={() => {
                                    setResetModalEditor(editor);
                                    setResetPasswordVal(generateRandomPassword());
                                    setCopied(false);
                                  }}
                                  className="p-2 rounded-lg bg-white/5 hover:bg-purple-400/15 hover:text-purple-400 text-text-muted transition-all"
                                  title="Reset Password"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 1. Modal: Provision New Editor */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-[#14161b] border border-border rounded-2xl overflow-hidden shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent-gold/15 text-accent-gold flex items-center justify-center border border-accent-gold/30">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Provision Creative Editor</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-text-muted hover:text-white text-xs">✕</button>
            </div>

            <form onSubmit={handleAddEditor} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-primary block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full bg-bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-text-primary input-gold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-primary block mb-1">Boutiqaat Email</label>
                <input
                  type="email"
                  required
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  placeholder="jane.doe@boutiqaat.com"
                  className="w-full bg-bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-text-primary input-gold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-text-primary">Temporary Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      const p = generateRandomPassword();
                      setAddPassword(p);
                      navigator.clipboard.writeText(p);
                      toast.success('Random password generated & copied!');
                    }}
                    className="text-[10px] font-bold text-accent-gold hover:underline flex items-center gap-1"
                  >
                    🎲 Generate Random
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={addPassword}
                  onChange={e => setAddPassword(e.target.value)}
                  placeholder="Strong password or auto-generate"
                  className="w-full bg-bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-text-primary font-mono input-gold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-primary block mb-1">Monthly Credit Quota ($ USD)</label>
                <input
                  type="number"
                  step="5"
                  required
                  value={addQuota}
                  onChange={e => setAddQuota(e.target.value)}
                  placeholder="50"
                  className="w-full bg-bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-text-primary input-gold"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-border text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-accent-gold text-black hover:bg-accent-gold/90 transition-all shadow-md"
                >
                  {creating ? 'Provisioning...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Quick Edit Quota */}
      {quotaModalEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-sm w-full bg-[#14161b] border border-border rounded-2xl overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-accent-gold" />
                <h3 className="text-sm font-bold text-white">Adjust Credit Quota</h3>
              </div>
              <button onClick={() => setQuotaModalEditor(null)} className="text-text-muted hover:text-white text-xs">✕</button>
            </div>

            <div>
              <p className="text-xs text-text-muted mb-3">
                Adjusting monthly budget limit for <strong className="text-white">{quotaModalEditor.name}</strong>.
              </p>
              
              <label className="text-xs font-semibold text-text-primary block mb-1.5">Quota Limit ($ USD)</label>
              <input
                type="number"
                step="5"
                value={quotaAmount}
                onChange={e => setQuotaAmount(e.target.value)}
                className="w-full bg-bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-text-primary font-bold input-gold"
              />

              {/* Quick Increase Pills */}
              <div className="flex gap-2 mt-3">
                {['+10', '+25', '+50'].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setQuotaAmount(String(parseFloat(quotaAmount || '0') + parseInt(amt)))}
                    className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-accent-gold/15 text-[11px] font-bold text-white hover:text-accent-gold border border-white/10 transition-all"
                  >
                    {amt} USD
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/50">
              <button
                onClick={() => setQuotaModalEditor(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border text-text-muted hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuota}
                disabled={savingQuota}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-accent-gold text-black hover:bg-accent-gold/90 transition-all shadow-md"
              >
                {savingQuota ? 'Saving...' : 'Apply Quota'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Reset Password */}
      {resetModalEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-sm w-full bg-[#14161b] border border-border rounded-2xl overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Reset Editor Password</h3>
              </div>
              <button onClick={() => setResetModalEditor(null)} className="text-text-muted hover:text-white text-xs">✕</button>
            </div>

            <div>
              <p className="text-xs text-text-muted mb-3">
                Resetting credentials for <strong className="text-white">{resetModalEditor.name}</strong>.
              </p>

              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-text-primary">New Password</label>
                <button
                  type="button"
                  onClick={() => {
                    const p = generateRandomPassword();
                    setResetPasswordVal(p);
                  }}
                  className="text-[10px] font-bold text-purple-400 hover:underline"
                >
                  🎲 Generate Random
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={resetPasswordVal}
                  onChange={e => setResetPasswordVal(e.target.value)}
                  className="w-full bg-bg-card border border-border rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-text-primary font-mono input-gold"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(resetPasswordVal);
                    setCopied(true);
                    toast.success('Password copied to clipboard!');
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
                  title="Copy password"
                >
                  {copied ? <Check className="w-4 h-4 text-accent-green" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/50">
              <button
                onClick={() => setResetModalEditor(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border text-text-muted hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveResetPassword}
                disabled={savingReset || !resetPasswordVal}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-500 text-white hover:bg-purple-600 transition-all shadow-md"
              >
                {savingReset ? 'Saving...' : 'Set Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal: Model Permissions Tier */}
      {permModalEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-[#14161b] border border-border rounded-2xl overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-accent-blue" />
                <h3 className="text-sm font-bold text-white">Model Permission Tiers</h3>
              </div>
              <button onClick={() => setPermModalEditor(null)} className="text-text-muted hover:text-white text-xs">✕</button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-text-muted">
                Configure AI model capabilities allowed for <strong className="text-white">{permModalEditor.name}</strong>.
              </p>

              {[
                { id: 'image', title: 'Image AI Studio (1K/2K)', desc: 'Nano Banana Pro, Flux, GPT-2.0 Images', icon: ImageIcon },
                { id: 'video', title: 'Video Cinematic AI (4K/HD)', desc: 'Seedance 2.0, Veo 3.1, MiniMax', icon: Film },
                { id: 'social-resize', title: 'Social Media Resize', desc: 'Generative Fill & Multi-Crop Tool', icon: Sparkles },
                { id: 'bundling', title: 'Bundling Studio 2K', desc: 'Compositing, Staging & PSD Generator', icon: Layers },
              ].map(tier => {
                const Icon = tier.icon;
                const isSelected = selectedModels.includes(tier.id);
                return (
                  <div
                    key={tier.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedModels(selectedModels.filter(m => m !== tier.id));
                      } else {
                        setSelectedModels([...selectedModels, tier.id]);
                      }
                    }}
                    className={cn(
                      "p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                      isSelected ? "bg-accent-blue/10 border-accent-blue/40" : "bg-white/3 border-white/5 hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", isSelected ? "bg-accent-blue text-black" : "bg-white/5 text-text-muted")}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{tier.title}</h4>
                        <p className="text-[10px] text-text-muted">{tier.desc}</p>
                      </div>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                      isSelected ? "bg-accent-blue border-accent-blue text-black" : "border-white/20"
                    )}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/50">
              <button
                onClick={() => setPermModalEditor(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border text-text-muted hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={savingPerms}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-accent-blue text-black hover:bg-accent-blue/90 transition-all shadow-md"
              >
                {savingPerms ? 'Saving...' : 'Update Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
