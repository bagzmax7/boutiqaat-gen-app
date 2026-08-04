'use client';

import { Sparkles, Cpu, Zap, Film, Image as ImageIcon, Video } from 'lucide-react';

const RUNNINGHUB_FEATURED_MODELS = [
  { name: 'Seedream 5.0 Pro', provider: 'ByteDance', desc: 'Precision position image editing', badge: 'Image', color: 'from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30' },
  { name: 'Kling O3 Pro', provider: 'Kuaishou', desc: '4K Multi-element locking & motion', badge: '4K Video', color: 'from-pink-500/20 to-red-500/20 text-pink-400 border-pink-500/30' },
  { name: 'Google Veo 3.1', provider: 'DeepMind', desc: 'Native audio & high fidelity motion', badge: 'Audio+Video', color: 'from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30' },
  { name: 'Sora 2 Pro', provider: 'OpenAI', desc: 'Identity Lock & 3D Parallax physics', badge: 'Ultra Real', color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30' },
  { name: 'Hailuo 2.3 Pro', provider: 'MiniMax', desc: '1080P cinematic lighting & cloth', badge: '1080P HD', color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30' },
  { name: 'Wan 2.6 Flash', provider: 'Alibaba', desc: 'Multi-shot schedule & reference R2V', badge: 'Multi-Shot', color: 'from-indigo-500/20 to-violet-500/20 text-indigo-400 border-indigo-500/30' },
];

export default function RunningHubModelsBar() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent-gold/15 border border-accent-gold/30 flex items-center justify-center text-accent-gold">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
            Powered by RunningHub AI Models
          </h2>
        </div>
        <span className="text-xs text-text-muted">Direct API Cloud Execution</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {RUNNINGHUB_FEATURED_MODELS.map((m, idx) => (
          <div
            key={idx}
            className="p-3 rounded-2xl bg-bg-card/70 border border-border/70 hover:border-accent-gold/40 transition-all hover:-translate-y-0.5 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{m.provider}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border bg-gradient-to-r ${m.color} font-semibold`}>
                {m.badge}
              </span>
            </div>
            <h3 className="text-xs font-bold text-text-primary line-clamp-1">{m.name}</h3>
            <p className="text-[10px] text-text-muted line-clamp-1">{m.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
