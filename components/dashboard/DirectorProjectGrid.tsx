'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Film, Plus, Sparkles, Layers, Play, Clock,
  MoreHorizontal, ChevronRight, FolderPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  title: string;
  category: string;
  shotsCount: number;
  updatedAt: string;
  thumbnail: string;
  isExample?: boolean;
}

const EXAMPLE_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    title: 'Luxury Perfume Commercial',
    category: 'Video Director',
    shotsCount: 4,
    updatedAt: '2 hours ago',
    thumbnail: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80',
    isExample: true,
  },
  {
    id: 'proj-2',
    title: 'Summer Fashion Campaign',
    category: 'Virtual Try-On',
    shotsCount: 6,
    updatedAt: 'Yesterday',
    thumbnail: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80',
    isExample: true,
  },
  {
    id: 'proj-3',
    title: 'High-End Jewelry Showcase',
    category: 'Multi-Shot',
    shotsCount: 3,
    updatedAt: '3 days ago',
    thumbnail: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=600&q=80',
    isExample: true,
  },
];

export default function DirectorProjectGrid() {
  const [projects, setProjects] = useState<Project[]>(EXAMPLE_PROJECTS);

  return (
    <div className="space-y-4">
      {/* ── Section Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-purple/15 border border-accent-purple/30 flex items-center justify-center text-accent-purple">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary tracking-tight">
              Director Projects & Storyboards
            </h2>
            <p className="text-xs text-text-muted">
              Multi-shot AI video sequences & campaign projects
            </p>
          </div>
        </div>

        <Link
          href="/studio"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent-purple/10 border border-accent-purple/30 text-accent-purple hover:bg-accent-purple/20 text-xs font-semibold transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create New Project</span>
        </Link>
      </div>

      {/* ── Projects Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Create Blank Card */}
        <Link
          href="/studio"
          className="group relative h-48 rounded-2xl border-2 border-dashed border-border hover:border-accent-gold/60 bg-bg-card/40 hover:bg-bg-card/80 flex flex-col items-center justify-center p-6 text-center transition-all hover:scale-[1.02]"
        >
          <div className="w-12 h-12 rounded-2xl bg-accent-gold/10 border border-accent-gold/30 flex items-center justify-center text-accent-gold mb-3 group-hover:scale-110 transition-transform">
            <FolderPlus className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold text-text-primary mb-0.5">New Project</span>
          <span className="text-xs text-text-muted">Start multi-shot storyboard</span>
        </Link>

        {/* Project Cards */}
        {projects.map((proj) => (
          <div
            key={proj.id}
            className="group relative h-48 rounded-2xl border border-border/80 bg-bg-card overflow-hidden transition-all hover:border-accent-purple/50 hover:shadow-card flex flex-col justify-end"
          >
            {/* Background Thumbnail */}
            <div className="absolute inset-0 bg-bg-secondary">
              <img
                src={proj.thumbnail}
                alt={proj.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-70 group-hover:opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            </div>

            {/* Badges */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
              <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-semibold text-accent-gold border border-accent-gold/30 uppercase tracking-wider">
                {proj.category}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-medium text-white/80 border border-white/10 flex items-center gap-1">
                <Layers className="w-3 h-3 text-purple-400" /> {proj.shotsCount} Shots
              </span>
            </div>

            {/* Content info */}
            <div className="relative p-4 z-10 space-y-1">
              <h3 className="text-sm font-bold text-white group-hover:text-accent-gold transition-colors line-clamp-1">
                {proj.title}
              </h3>
              <div className="flex items-center justify-between text-xs text-white/60 pt-1">
                <span className="flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3" /> {proj.updatedAt}
                </span>
                <Link
                  href={`/studio?project=${proj.id}`}
                  className="flex items-center gap-1 text-accent-purple font-semibold group-hover:translate-x-1 transition-transform"
                >
                  Open <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
