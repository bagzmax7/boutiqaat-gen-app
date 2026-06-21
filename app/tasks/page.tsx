'use client';

import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import TaskDetailModal from '@/components/tasks/TaskDetailModal';
import { useTasks } from '@/hooks/useTasks';
import { Task, TaskStatus } from '@/lib/types';
import { useState } from 'react';
import { Search, Download, Trash2, CheckCircle2, Loader2, XCircle, MinusCircle, Clock, Filter } from 'lucide-react';
import { cn, formatDuration, getStatusBg, getStatusColor } from '@/lib/utils';

const STATUS_FILTERS: { label: string; value: TaskStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Running', value: 'RUNNING' },
  { label: 'Queued', value: 'QUEUED' },
  { label: 'Completed', value: 'SUCCESS' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'Cancelled', value: 'CANCELED' },
];

export default function TasksPage() {
  const { tasks, clearTasks } = useTasks();
  const [filter, setFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const filtered = tasks.filter(t => {
    const matchStatus = filter === 'ALL' || t.status === filter;
    const matchSearch = !search ||
      t.appName.toLowerCase().includes(search.toLowerCase()) ||
      t.taskId.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  function handleExport() {
    const headers = ['Task ID', 'API Name', 'API Type', 'Key Type', 'Status', 'Call Time', 'Task Duration', 'Mode'];
    const csvContent = [
      headers.join(','),
      ...filtered.map(t => [
        t.taskId,
        `"${t.appName}"`,
        'AI Application API',
        'Enterprise Shared',
        t.status,
        `"${new Date(t.createdAt).toLocaleString()}"`,
        `"${formatDuration(t.createdAt, t.updatedAt)}"`,
        'Standard'
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `call_records_${new Date().getTime()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 bg-[#0B1015]">
          <div className="max-w-[1400px] mx-auto">
            
            {/* Header Area matching RunningHub style */}
            <div className="flex flex-col items-center justify-center py-10 mb-8 rounded-2xl relative overflow-hidden bg-gradient-to-b from-[#0F1C25] to-transparent border border-white/5">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent-green/10 via-transparent to-transparent opacity-50" />
              <h1 className="text-3xl font-semibold text-accent-green mb-3 relative z-10">My Call Records</h1>
              <p className="text-sm text-text-muted relative z-10">View your API call history, including call status and details</p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search API Name, TaskID"
                    className="w-64 bg-bg-secondary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent-green/50 outline-none transition-all"
                  />
                </div>
                <select
                  value={filter}
                  onChange={e => setFilter(e.target.value as TaskStatus | 'ALL')}
                  className="bg-bg-secondary border border-border rounded-lg px-4 py-2 text-sm text-text-primary outline-none focus:border-accent-green/50 transition-all appearance-none pr-8 cursor-pointer relative"
                >
                  {STATUS_FILTERS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExport}
                  disabled={filtered.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-bg-secondary hover:bg-bg-hover border border-border rounded-lg text-sm text-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
                {tasks.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Clear all records?')) clearTasks();
                    }}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-accent-red/10 border border-transparent hover:border-accent-red/20 rounded-lg text-sm text-text-muted hover:text-accent-red transition-all"
                  >
                    <Trash2 className="w-4 h-4" /> Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-[#1A2229] border-b border-border">
                      <th className="py-4 px-6 text-xs font-medium text-text-muted whitespace-nowrap">Task ID</th>
                      <th className="py-4 px-6 text-xs font-medium text-text-muted whitespace-nowrap">API Name</th>
                      <th className="py-4 px-6 text-xs font-medium text-text-muted whitespace-nowrap">API Type</th>
                      <th className="py-4 px-6 text-xs font-medium text-text-muted whitespace-nowrap">Key Type</th>
                      <th className="py-4 px-6 text-xs font-medium text-text-muted whitespace-nowrap">Call Time</th>
                      <th className="py-4 px-6 text-xs font-medium text-text-muted whitespace-nowrap">Status</th>
                      <th className="py-4 px-6 text-xs font-medium text-text-muted whitespace-nowrap">Task Duration</th>
                      <th className="py-4 px-6 text-xs font-medium text-text-muted whitespace-nowrap">Mode</th>
                      <th className="py-4 px-6 text-xs font-medium text-text-muted whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-sm text-text-muted">
                          No records found
                        </td>
                      </tr>
                    ) : (
                      filtered.map(task => (
                        <tr key={task.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-6 text-sm text-text-secondary font-mono">{task.taskId}</td>
                          <td className="py-4 px-6 text-sm text-text-secondary truncate max-w-[150px]">{task.appName}</td>
                          <td className="py-4 px-6 text-sm text-text-secondary">AI Application API</td>
                          <td className="py-4 px-6">
                            <span className="px-3 py-1 rounded-full bg-accent-purple/10 text-accent-purple text-xs font-medium border border-accent-purple/20">
                              Enterprise Shared
                            </span>
                          </td>
                          <td className="py-4 px-6 text-sm text-text-secondary whitespace-nowrap">
                            <div className="flex flex-col">
                              <span>{new Date(task.createdAt).toISOString().split('T')[0]}</span>
                              <span className="text-xs text-text-muted">{new Date(task.createdAt).toTimeString().split(' ')[0]}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusBg(task.status)} ${getStatusColor(task.status)}`}>
                              {task.status === 'SUCCESS' ? <CheckCircle2 className="w-3.5 h-3.5" /> : 
                               task.status === 'FAILED' ? <XCircle className="w-3.5 h-3.5" /> : 
                               task.status === 'CANCELED' ? <MinusCircle className="w-3.5 h-3.5" /> : 
                               task.status === 'QUEUED' ? <Clock className="w-3.5 h-3.5" /> : 
                               <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              {task.status === 'SUCCESS' ? 'Success' : 
                               task.status === 'FAILED' ? 'Failed' : 
                               task.status === 'QUEUED' ? 'Queued' : 
                               task.status === 'RUNNING' ? 'Running' : 'Canceled'}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-sm text-text-secondary font-mono">{formatDuration(task.createdAt, task.updatedAt)}</td>
                          <td className="py-4 px-6 text-sm text-text-secondary">Standard</td>
                          <td className="py-4 px-6">
                            <button
                              onClick={() => setSelectedTask(task)}
                              className="px-4 py-1.5 rounded bg-transparent border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-light transition-colors"
                            >
                              View Detail
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>

      {selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
