'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, Eye, EyeOff, Mail, Lock } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Welcome back, ${data.user?.name || 'Studio'}!`);
        router.push(from);
        router.refresh();
      } else {
        toast.error(data.error || 'Invalid email or password');
      }
    } catch {
      toast.error('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card rounded-3xl p-8 shadow-card border border-border/60">
      <h2 className="text-xl font-semibold text-text-primary mb-1">Sign in</h2>
      <p className="text-text-secondary text-sm mb-8">Access your studio workspace</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@boutiqaat.com"
              required
              autoComplete="email"
              className="w-full bg-bg-secondary border border-border rounded-xl pl-11 pr-4 py-3 text-text-primary placeholder-text-muted text-sm input-gold transition-all"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full bg-bg-secondary border border-border rounded-xl pl-11 pr-12 py-3 text-text-primary placeholder-text-muted text-sm input-gold transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-1"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-gold text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 btn-lift glow-gold disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2 text-sm tracking-wide"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
          ) : 'Sign In to Studio'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-accent-gold/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-accent-purple/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#F59E0B 1px, transparent 1px), linear-gradient(90deg, #F59E0B 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Brand */}
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="h-14 w-auto mb-3 flex items-center justify-center">
            <img src="/btq-logo.png" className="h-full w-auto object-contain" alt="Boutiqaat Logo" />
          </div>
          <p className="text-text-muted text-xs tracking-[0.25em] uppercase font-semibold">Studio AI Hub</p>
        </div>

        {/* Card */}
        <Suspense fallback={<div className="glass-card rounded-3xl p-8 flex items-center justify-center h-[400px] border border-border/60"><Loader2 className="w-8 h-8 animate-spin text-accent-gold" /></div>}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-text-muted text-xs mt-6">
          Boutiqaat Creative Studio · Internal Platform
        </p>
      </div>
    </div>
  );
}
