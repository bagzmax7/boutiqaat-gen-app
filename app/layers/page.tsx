'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { LayersProject, CanvasLayerItem } from '@/lib/types';
import { LayersProjectHub } from '@/components/layers/LayersProjectHub';
import { LayersCanvasWorkspace } from '@/components/layers/LayersCanvasWorkspace';
import { LayersStackPanel } from '@/components/layers/LayersStackPanel';
import { LayersReCreateModal } from '@/components/layers/LayersReCreateModal';
import AppLockoutGuard from '@/components/layout/AppLockoutGuard';
import toast, { Toaster } from 'react-hot-toast';

export default function BoutiqaatLayersPage() {
  return (
    <AppLockoutGuard appKey="boutiqaat-layers" appName="Boutiqaat Layers Studio">
      <BoutiqaatLayersContent />
    </AppLockoutGuard>
  );
}

function BoutiqaatLayersContent() {
  const [projects, setProjects] = useState<LayersProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<LayersProject | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [reCreateModalLayer, setReCreateModalLayer] = useState<CanvasLayerItem | null>(null);

  // Fetch Projects List
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/layers/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err: any) {
      console.error('[Fetch Projects Error]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Handle Save / Update Project
  const handleSaveProject = async (updatedProject: LayersProject) => {
    setActiveProject(updatedProject);
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));

    try {
      await fetch('/api/layers/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', project: updatedProject }),
      });
    } catch (err) {
      console.warn('[Auto-save warning]', err);
    }
  };

  // Layer Update Handler
  const handleUpdateLayer = (updatedLayer: CanvasLayerItem) => {
    if (!activeProject) return;
    const currentLayers = Array.isArray(activeProject.layers) ? activeProject.layers : [];
    const updatedLayers = currentLayers.map(l => l.id === updatedLayer.id ? updatedLayer : l);
    handleSaveProject({ ...activeProject, layers: updatedLayers });
  };

  // Layer Reorder Handler
  const handleReorderLayers = (newLayers: CanvasLayerItem[]) => {
    if (!activeProject) return;
    handleSaveProject({ ...activeProject, layers: newLayers });
  };

  // Layer Delete Handler
  const handleDeleteLayer = (layerId: string) => {
    if (!activeProject) return;
    const currentLayers = Array.isArray(activeProject.layers) ? activeProject.layers : [];
    const updatedLayers = currentLayers.filter(l => l.id !== layerId);
    if (selectedLayerId === layerId) setSelectedLayerId(null);
    handleSaveProject({ ...activeProject, layers: updatedLayers });
    toast.success('Layer deleted');
  };

  // Layer Duplicate Handler
  const handleDuplicateLayer = (layerId: string) => {
    if (!activeProject) return;
    const currentLayers = Array.isArray(activeProject.layers) ? activeProject.layers : [];
    const target = currentLayers.find(l => l.id === layerId);
    if (!target) return;

    const newLayer: CanvasLayerItem = {
      ...target,
      id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${target.name} (Copy)`,
      x: target.x + 20,
      y: target.y + 20,
      zIndex: currentLayers.length,
      isBackground: false,
    };

    handleSaveProject({ ...activeProject, layers: [...currentLayers, newLayer] });
    setSelectedLayerId(newLayer.id);
    toast.success('Layer duplicated');
  };

  // Apply Re-Created Layer
  const handleApplyReCreated = (updatedLayer: CanvasLayerItem) => {
    handleUpdateLayer(updatedLayer);
  };

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-white overflow-hidden font-sans">
      <Toaster position="bottom-right" />

      {/* Global Sidebar for Navigation */}
      <Sidebar />

      {/* Main Studio Area */}
      <main className="flex-1 h-full overflow-hidden flex flex-col bg-[#050505] relative">
        {!activeProject ? (
          <div className="flex-1 h-full overflow-y-auto">
            <LayersProjectHub
              projects={projects}
              loading={loading}
              onOpenProject={(proj) => {
                setActiveProject(proj);
                if (proj.layers && proj.layers.length > 0) {
                  const nonBg = proj.layers.find(l => !l.isBackground);
                  setSelectedLayerId(nonBg ? nonBg.id : proj.layers[0].id);
                }
              }}
              onRefreshProjects={fetchProjects}
            />
          </div>
        ) : (
          <div className="flex h-full w-full overflow-hidden">
            {/* Main Canvas Workspace */}
            <div className="flex-1 h-full overflow-hidden">
              <LayersCanvasWorkspace
                project={activeProject}
                onBackToHub={() => setActiveProject(null)}
                onSaveProject={handleSaveProject}
                onOpenReCreate={(layer) => setReCreateModalLayer(layer)}
                selectedLayerId={selectedLayerId}
                onSelectLayer={setSelectedLayerId}
                onUpdateLayer={handleUpdateLayer}
              />
            </div>

            {/* Right Photoshop-Style Layers Matrix Panel */}
            <LayersStackPanel
              layers={Array.isArray(activeProject?.layers) ? activeProject.layers : []}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
              onUpdateLayer={handleUpdateLayer}
              onReorderLayers={handleReorderLayers}
              onOpenReCreate={(layer) => setReCreateModalLayer(layer)}
              onDeleteLayer={handleDeleteLayer}
              onDuplicateLayer={handleDuplicateLayer}
            />

            {/* Re-Create AI Studio Modal */}
            <LayersReCreateModal
              layer={reCreateModalLayer}
              projectId={activeProject.id}
              isOpen={!!reCreateModalLayer}
              onClose={() => setReCreateModalLayer(null)}
              onApply={handleApplyReCreated}
            />
          </div>
        )}
      </main>
    </div>
  );
}
