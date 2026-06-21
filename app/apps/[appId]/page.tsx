'use client';

import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import BatchRemoveBackgroundLauncher from '@/components/apps/BatchRemoveBackgroundLauncher';
import AppLauncher from '@/components/apps/AppLauncher';
import { useTasks } from '@/hooks/useTasks';
import { AppDefinition } from '@/lib/types';
import { ArrowLeft, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';

// App definitions registry
const APP_REGISTRY: Record<string, AppDefinition> = {
  '2063548168545071105': {
    id: '2063548168545071105',
    name: 'Batch Remove Background (Up to 20 Images)',
    description: 'Upload up to 20 images at once. The AI will remove the backgrounds for all of them concurrently, returning transparent PNGs and PSDs.',
    category: 'image-editing',
    icon: 'grid',
    pinned: true,
    batchMode: true,
    nodeInfoSchema: [],
  },
};

export default function AppDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addTask } = useTasks();
  const appId = params.appId as string;

  const app: AppDefinition = APP_REGISTRY[appId] || {
    id: appId,
    name: `App ${appId}`,
    description: 'Custom AI application',
    category: 'other',
    icon: 'layers',
    nodeInfoSchema: [],
  };

  function handleTaskStarted(taskId: string, appName: string, nodeInfoList: { nodeId: string; fieldName: string; fieldValue: string }[], apiKeyType?: 'enterprise' | 'consumer') {
    const localId = addTask(taskId, appId, appName, nodeInfoList, apiKeyType);
    
    // Save to database
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: localId,
        runninghub_task_id: taskId,
        app_id: appId,
        app_name: appName,
        api_key_type: apiKeyType || 'consumer',
        node_info_list: nodeInfoList,
      }),
    }).catch(() => {});

    toast.success('Task started! Monitoring progress inline...');
  }

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {/* App header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-purple flex items-center justify-center flex-shrink-0">
                <Cpu className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary">{app.name}</h1>
                <p className="text-sm text-text-muted font-mono">ID: {appId}</p>
              </div>
            </div>

            {app.id === '2063548168545071105' ? (
              <BatchRemoveBackgroundLauncher app={app} onTaskStarted={handleTaskStarted} />
            ) : (
              <AppLauncher app={app} onTaskStarted={handleTaskStarted} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
