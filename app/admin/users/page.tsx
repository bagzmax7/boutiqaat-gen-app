'use client';

import { useEffect, useState, FormEvent } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { Users, Plus, Trash2, Loader2, X, Check, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface UserRow { id: string; email: string; name: string; role: string; created_at: string; }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'editor' | 'admin' | 'manager'>('editor');
  const [creating, setCreating] = useState(false);

  function loadUsers() {
    setLoading(true);
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || [])).finally(() => setLoading(false));
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, name: newName, password: newPassword, role: newRole }),
      });
      if (res.ok) {
        toast.success(`${newName} added successfully!`);
        setShowAdd(false); setNewName(''); setNewEmail(''); setNewPassword('');
        loadUsers();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to create user');
      }
    } catch { toast.error('Connection error'); }
    finally { setCreating(false); }
  }

  async function handleDelete(user: UserRow) {
    if (!confirm(`Delete ${user.name}? This will remove all their task history.`)) return;
    const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('User deleted'); loadUsers(); }
    else toast.error('Failed to delete user');
  }

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-purple to-violet-600 flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-text-primary">User Management</h1>
                  <p className="text-sm text-text-secondary">{users.length} registered accounts</p>
                </div>
              </div>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 bg-accent-gold/10 border border-accent-gold/30 text-accent-gold text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-accent-gold/15 transition-all"
              >
                <UserPlus className="w-4 h-4" /> Add Team Member
              </button>
            </div>
          </div>

          <div className="px-6 py-6 max-w-4xl mx-auto">
            {/* Add form */}
            {showAdd && (
              <form onSubmit={handleCreate} className="glass-card rounded-2xl p-6 border border-accent-gold/20 mb-6 animate-slide-up">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-text-primary flex items-center gap-2"><Plus className="w-4 h-4 text-accent-gold" /> New Account</h3>
                  <button type="button" onClick={() => setShowAdd(false)} className="text-text-muted hover:text-text-primary transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Name</label>
                    <input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="Jane Studio" className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary input-gold transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Email</label>
                    <input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="jane@boutiqaat.com" className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary input-gold transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Temp Password</label>
                    <input required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 8 characters" className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary input-gold transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Role</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value as 'editor' | 'admin' | 'manager')} className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary input-gold transition-all">
                      <option value="editor">Editor (Studio Access)</option>
                      <option value="manager">Manager (Team Analytics + History)</option>
                      <option value="admin">Admin (Full Control)</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={creating} className="bg-gradient-gold text-white text-sm font-semibold px-5 py-2.5 rounded-xl btn-lift glow-gold disabled:opacity-50 flex items-center gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {creating ? 'Creating...' : 'Create Account'}
                </button>
              </form>
            )}

            {/* Users table */}
            {loading ? (
              <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-accent-gold/50" /></div>
            ) : (
              <div className="space-y-2">
                {users.map(user => (
                  <div key={user.id} className="glass-card rounded-xl p-4 border border-border flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-gold flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{user.name}</p>
                      <p className="text-xs text-text-muted">{user.email}</p>
                    </div>
                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 uppercase',
                      user.role === 'admin'
                        ? 'text-accent-gold bg-accent-gold/10 border-accent-gold/25'
                        : user.role === 'manager'
                          ? 'text-accent-blue bg-accent-blue/10 border-accent-blue/25'
                          : 'text-accent-purple bg-accent-purple/10 border-accent-purple/25'
                    )}>
                      {user.role}
                    </span>
                    <p className="text-xs text-text-muted flex-shrink-0">{new Date(user.created_at).toLocaleDateString()}</p>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-2 text-text-muted hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-all flex-shrink-0"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
