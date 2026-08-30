'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Task, TaskStatus, TaskOutput } from '@/lib/types';
import toast from 'react-hot-toast';

const BASE_STORAGE_KEY = 'bqa_tasks';
const POLL_INTERVAL = 4000; // 4 seconds

// --- Global Store ---
let globalTasks: Task[] = [];
let currentStoreUserId: string | null = null;
const listeners = new Set<() => void>();

function getStorageKey(userId?: string | null): string {
  if (!userId) return BASE_STORAGE_KEY;
  return `${BASE_STORAGE_KEY}_${userId}`;
}

function deduplicateTasks(taskList: Task[]): Task[] {
  if (!Array.isArray(taskList)) return [];
  const map = new Map<string, Task>();
  
  for (const t of taskList) {
    if (!t) continue;
    // Determine key: prioritize valid taskId, otherwise t.id
    const key = (t.taskId && String(t.taskId).trim()) || t.id;
    if (!key) continue;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, t);
    } else {
      // Pick the better/latest one
      const existingSuccess = existing.status === 'SUCCESS';
      const currentSuccess = t.status === 'SUCCESS';
      const existingHasOut = Boolean(existing.outputs && existing.outputs.length > 0);
      const currentHasOut = Boolean(t.outputs && t.outputs.length > 0);
      
      const shouldReplace = 
        (!existingHasOut && currentHasOut) || 
        (currentSuccess && !existingSuccess) || 
        (t.updatedAt > existing.updatedAt);

      if (shouldReplace) {
        map.set(key, {
          ...existing,
          ...t,
          appName: (t.appName && !t.appName.startsWith('App 20')) ? t.appName : existing.appName,
          outputs: currentHasOut ? t.outputs : existing.outputs,
        });
      }
    }
  }

  // Also deduplicate items that have identical non-empty output URLs
  const urlMap = new Map<string, Task>();
  const results: Task[] = [];

  for (const t of Array.from(map.values())) {
    const firstUrl = t.outputs?.[0]?.fileUrl;
    if (firstUrl && t.status === 'SUCCESS') {
      if (!urlMap.has(firstUrl)) {
        urlMap.set(firstUrl, t);
        results.push(t);
      }
    } else {
      results.push(t);
    }
  }

  return results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function loadTasksForUser(userId: string | null): Task[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getStorageKey(userId);
    const stored = localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : [];
    return deduplicateTasks(parsed);
  } catch {
    return [];
  }
}

function saveTasksForUser(tasks: Task[], userId: string | null) {
  if (typeof window !== 'undefined') {
    try {
      const key = getStorageKey(userId);
      localStorage.setItem(key, JSON.stringify(tasks));
    } catch {}
  }
}

function setGlobalTasks(action: Task[] | ((prev: Task[]) => Task[]), userId: string | null = currentStoreUserId) {
  const next = typeof action === 'function' ? action(globalTasks) : action;
  globalTasks = deduplicateTasks(next);
  saveTasksForUser(globalTasks, userId);
  listeners.forEach(l => l());
}
// --------------------

let activePollingInterval: NodeJS.Timeout | null = null;

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 1. Fetch current session user identity to ensure user-scoped data
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        const uId = data?.user?.id || null;
        setCurrentUserId(uId);

        if (currentStoreUserId !== uId) {
          currentStoreUserId = uId;
          const initialTasks = loadTasksForUser(uId);
          globalTasks = initialTasks;
          setTasks(initialTasks);
          listeners.forEach(l => l());
        }
      })
      .catch(() => {});
  }, []);

  // 2. Subscribe to global store
  useEffect(() => {
    setTasks(globalTasks);
    const listener = () => setTasks(globalTasks);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  // 3. Sync tasks from database for this specific user on mount & user change
  useEffect(() => {
    if (!currentUserId) return;

    async function syncWithDatabase() {
      try {
        const res = await fetch('/api/tasks?limit=50');
        if (!res.ok) return;
        const data = await res.json();
        
        const dbTasks: Task[] = (data.tasks || []).map((t: any) => ({
          id: t.id,
          taskId: t.runninghub_task_id,
          appId: t.app_id || '',
          appName: t.app_name || '',
          status: t.status as TaskStatus,
          createdAt: new Date(t.created_at).getTime(),
          updatedAt: new Date(t.updated_at || t.created_at).getTime(),
          nodeInfoList: t.node_info_list,
          outputs: t.outputs,
          error: t.error_message,
          apiKeyType: t.api_key_type
        }));

        setGlobalTasks(prev => deduplicateTasks([...prev, ...dbTasks]), currentUserId);
      } catch (err) {
        console.error('Failed to sync tasks with database:', err);
      }
    }

    syncWithDatabase();
  }, [currentUserId]);

  // ── Add a new task ──────────────────────────────────────
  const addTask = useCallback((
    taskId: string,
    appId: string,
    appName: string,
    nodeInfoList: Task['nodeInfoList'],
    apiKeyType?: 'enterprise' | 'consumer'
  ) => {
    let assignedId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setGlobalTasks(prev => {
      if (taskId) {
        const existing = prev.find(t => t.taskId === taskId);
        if (existing) {
          assignedId = existing.id;
          return prev.map(t => t.id === existing.id ? {
            ...t,
            appId: appId || t.appId,
            appName: appName || t.appName,
            nodeInfoList: nodeInfoList || t.nodeInfoList,
            apiKeyType: apiKeyType || t.apiKeyType,
            updatedAt: Date.now()
          } : t);
        }
      }

      const newTask: Task = {
        id: assignedId,
        taskId,
        appId,
        appName,
        status: 'QUEUED',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        nodeInfoList,
        apiKeyType,
      };
      return [newTask, ...prev];
    });
    return assignedId;
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
      const currentTasks = globalTasks;
      const running = currentTasks.filter(t => t.status === 'RUNNING' || t.status === 'QUEUED');

      if (running.length === 0) {
        clearInterval(activePollingInterval!);
        activePollingInterval = null;
        return;
      }

      for (const task of running) {
        // Skip tasks with no valid taskId — prevents empty-body 400 errors on /api/runninghub/query
        if (!task.taskId || typeof task.taskId !== 'string') {
          setGlobalTasks(prev =>
            prev.map(t => t.id === task.id ? { ...t, status: 'FAILED', error: 'Invalid taskId', updatedAt: Date.now() } : t)
          );
          continue;
        }
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
