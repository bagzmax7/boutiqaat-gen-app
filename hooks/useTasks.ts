'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Task, TaskStatus, TaskOutput } from '@/lib/types';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'bqa_tasks';
const POLL_INTERVAL = 4000; // 4 seconds

// --- Global Store ---
let globalTasks: Task[] = [];
let isLoaded = false;
const listeners = new Set<() => void>();

function getTasks(): Task[] {
  if (!isLoaded && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) globalTasks = JSON.parse(stored);
    } catch {}
    isLoaded = true;
  }
  return globalTasks;
}

function setGlobalTasks(action: Task[] | ((prev: Task[]) => Task[])) {
  globalTasks = typeof action === 'function' ? action(globalTasks) : action;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(globalTasks));
  }
  listeners.forEach(l => l());
}
// --------------------

let activePollingInterval: NodeJS.Timeout | null = null;

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);

  // Subscribe to global store
  useEffect(() => {
    setTasks(getTasks());
    const listener = () => setTasks(getTasks());
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  // ── Add a new task ──────────────────────────────────────
  const addTask = useCallback((
    taskId: string,
    appId: string,
    appName: string,
    nodeInfoList: Task['nodeInfoList'],
    apiKeyType?: 'enterprise' | 'consumer'
  ) => {
    const newTask: Task = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      taskId,
      appId,
      appName,
      status: 'QUEUED',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodeInfoList,
      apiKeyType,
    };
    setGlobalTasks(prev => [newTask, ...prev]);
    return newTask.id;
  }, []);

  // ── Update a task ───────────────────────────────────────
  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setGlobalTasks(prev =>
      prev.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t)
    );
  }, []);

  // ── Cancel task locally ─────────────────────────────────
  const cancelTaskLocally = useCallback((id: string) => {
    setGlobalTasks(prev =>
      prev.map(t => t.id === id ? { ...t, status: 'CANCELED', updatedAt: Date.now() } : t)
    );
  }, []);

  // ── Clear all tasks ─────────────────────────────────────
  const clearTasks = useCallback(() => {
    setGlobalTasks([]);
  }, []);

  // ── Polling loop (Singleton) ────────────────────────────
  useEffect(() => {
    const activeTasks = tasks.filter(t => t.status === 'RUNNING' || t.status === 'QUEUED');

    if (activeTasks.length === 0) {
      if (activePollingInterval) {
        clearInterval(activePollingInterval);
        activePollingInterval = null;
      }
      return;
    }

    if (activePollingInterval) return; // already polling

    activePollingInterval = setInterval(async () => {
      const currentTasks = getTasks();
      const running = currentTasks.filter(t => t.status === 'RUNNING' || t.status === 'QUEUED');

      if (running.length === 0) {
        clearInterval(activePollingInterval!);
        activePollingInterval = null;
        return;
      }

      for (const task of running) {
        try {
          const res = await fetch('/api/runninghub/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: task.taskId, apiKeyType: task.apiKeyType }),
          });

          if (!res.ok) continue;

          const data = await res.json();
          const newStatus: TaskStatus = data.status || task.status;

          if (newStatus === task.status) continue; // no change

          if (newStatus === 'SUCCESS') {
            const outputs: TaskOutput[] = (data.results || []).map(
              (r: { url: string; outputType: string }) => ({
                fileUrl: r.url,
                fileType: r.outputType,
              })
            );

            const updatedNodeInfoList = [...(task.nodeInfoList || []), {
              nodeId: 'USAGE',
              fieldName: 'usage',
              fieldValue: JSON.stringify(data.usage || {})
            }];

            // Sync to database
            fetch('/api/tasks', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                id: task.id, 
                status: 'SUCCESS', 
                outputs,
                node_info_list: updatedNodeInfoList
              })
            }).catch(() => {});

            setGlobalTasks(prev =>
              prev.map(t =>
                t.id === task.id
                  ? { ...t, status: 'SUCCESS', outputs, nodeInfoList: updatedNodeInfoList, updatedAt: Date.now() }
                  : t
              )
            );

            toast.success(`✅ "${task.appName}" completed!`, { duration: 5000 });

          } else if (newStatus === 'FAILED') {
            const errorMsg = data.errorMessage || 'Task failed';
            
            // Sync to database
            fetch('/api/tasks', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: task.id, status: 'FAILED', error: errorMsg })
            }).catch(() => {});

            setGlobalTasks(prev =>
              prev.map(t =>
                t.id === task.id
                  ? { ...t, status: 'FAILED', error: errorMsg, updatedAt: Date.now() }
                  : t
              )
            );
            toast.error(`❌ "${task.appName}" failed: ${errorMsg}`);

          } else {
            // RUNNING or QUEUED
            setGlobalTasks(prev =>
              prev.map(t =>
                t.id === task.id
                  ? { ...t, status: newStatus, updatedAt: Date.now() }
                  : t
              )
            );
          }
        } catch {
          // Ignore network errors
        }
      }
    }, POLL_INTERVAL);

    // Don't clear interval on unmount, allow polling to continue globally
  }, [tasks]);

  return { tasks, addTask, updateTask, cancelTaskLocally, clearTasks };
}
