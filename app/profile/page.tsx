'use client';

import { useEffect, useState, FormEvent } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { User, Camera, Lock, Save, CheckCircle2, ImageIcon, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface UserProfile { id: string; email: string; name: string; role: string; avatar_url?: string | null; }

const AVATAR_PRESETS = [
  '🎨', '🖼️', '✨', '🎬', '💫', '🌟', '🎭', '🔮',
];

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) {
        setUser(d.user);
        setName(d.user.name);
        setSelectedEmoji(d.user.avatar_url || '🎨');
      }
    });
    fetch('/api/tasks?limit=200').then(r => r.json()).then(d => setTaskCount(d.tasks?.length || 0));
  }, []);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, string> = { name, avatar_url: selectedEmoji };
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          toast.error('New passwords do not match'); setSaving(false); return;
        }
        if (newPassword.length < 8) {
          toast.error('Password must be at least 8 characters'); setSaving(false); return;
        }
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success('Profile updated!');
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        setUser(prev => prev ? { ...prev, name, avatar_url: selectedEmoji } : prev);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Update failed');
      }
    } catch { toast.error('Connection error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-gold flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-bold text-text-primary">My Profile</h1>
            </div>
          </div>

          <div className="px-6 py-8 max-w-2xl mx-auto space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card rounded-xl p-4 border border-accent-gold/20 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent-gold/10 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-accent-gold" />
                </div>
                <div>
                  <p className="text-xl font-bold text-text-primary">{taskCount}</p>
                  <p className="text-xs text-text-muted">Total Tasks</p>
                </div>
              </div>
              <div className="glass-card rounded-xl p-4 border border-accent-green/20 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent-green/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-accent-green" />
                </div>
                <div>
                  <p className="text-xl font-bold text-text-primary">{taskCount * 3}m</p>
                  <p className="text-xs text-text-muted">Time Saved (est.)</p>
                </div>
              </div>
            </div>

            {/* Profile form */}
            <form onSubmit={handleSaveProfile} className="glass-card rounded-2xl p-6 border border-border space-y-6">
              {/* Avatar picker */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                  <Camera className="w-3 h-3 inline mr-1.5" />Avatar
                </label>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_PRESETS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedEmoji(emoji)}
                      className={cn(
                        'w-11 h-11 rounded-xl text-xl flex items-center justify-center border transition-all',
                        selectedEmoji === emoji
                          ? 'border-accent-gold bg-accent-gold/10 scale-110'
                          : 'border-border hover:border-accent-gold/40 bg-bg-secondary'
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Display Name
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-text-primary text-sm input-gold transition-all"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  value={user?.email || ''}
                  readOnly
                  className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-text-muted text-sm cursor-not-allowed opacity-60"
                />
              </div>

              {/* Password section */}
              <div className="border-t border-border pt-5">
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                  <Lock className="w-3 h-3 inline mr-1.5" />Change Password
                </label>
                <div className="space-y-3">
                  {[
                    { label: 'Current Password', value: currentPassword, onChange: setCurrentPassword },
                    { label: 'New Password', value: newPassword, onChange: setNewPassword },
                    { label: 'Confirm New Password', value: confirmPassword, onChange: setConfirmPassword },
                  ].map(({ label, value, onChange }) => (
                    <input
                      key={label}
                      type="password"
                      placeholder={label}
                      value={value}
                      onChange={e => onChange(e.target.value)}
                      className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-2.5 text-text-primary text-sm placeholder-text-muted input-gold transition-all"
                    />
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-2">Leave password fields empty to keep current password.</p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gradient-gold text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 btn-lift glow-gold disabled:opacity-50 transition-all text-sm"
              >
                {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
