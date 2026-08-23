/**
 * Utility functions for exporting reports to formatted Excel (.xlsx compatible / CSV)
 */

export function downloadExcelFile(csvContent: string, fileName: string) {
  // UTF-8 BOM ensures Excel displays special characters, currency symbols, and UTF-8 properly
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportUsersSummaryExcel(users: any[], dateRange: { from: string; to: string }) {
  const headers = [
    'User Name',
    'Email',
    'Role',
    'Total Tasks',
    'Success Tasks',
    'Failed Tasks',
    'Success Rate (%)',
    'RH Coins Used',
    'Total Amount ($ USD)',
    'Total Duration (Seconds)',
    'Total Duration (Formatted)',
    'Top Used Tool',
    'Last Active Date',
  ];

  const formatDuration = (sec: number) => {
    if (!sec || sec <= 0) return '00:00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const rows = users.map(u => [
    u.name,
    u.email,
    (u.role || 'editor').toUpperCase(),
    u.totalTasks,
    u.successCount,
    u.failedCount,
    `${u.successRate}%`,
    Math.round(u.totalCoins || 0),
    `$${(u.totalAmount || 0).toFixed(3)}`,
    u.totalDuration || 0,
    formatDuration(u.totalDuration || 0),
    u.topApp || '—',
    u.lastActive ? new Date(u.lastActive).toLocaleString() : '—',
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\r\n');
  const filename = `Boutiqaat_Team_User_Summary_${dateRange.from}_to_${dateRange.to}.csv`;
  downloadExcelFile(csv, filename);
}

export function exportTasksDetailedExcel(tasks: any[], dateRange: { from: string; to: string }) {
  const headers = [
    'Task ID',
    'User Name',
    'User Email',
    'User ID',
    'Start Time',
    'Task / Feature Name',
    'Status',
    'Duration (Seconds)',
    'Duration (Formatted)',
    'RH Coins',
    'Final Amount ($ USD)',
    '3rd Party Cost ($ USD)',
    'API Key Type',
    'Key Masked',
    'Source',
    'Call Method',
  ];

  const formatDuration = (sec: number) => {
    if (!sec || sec <= 0) return '—';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  const rows = tasks.map(r => [
    r.taskId,
    r.userAccount,
    r.userEmail || '—',
    r.userId || '—',
    r.taskStartTime ? new Date(r.taskStartTime).toLocaleString() : '—',
    r.taskName,
    r.taskStatus,
    r.duration || 0,
    formatDuration(r.duration || 0),
    Math.round(r.coins || 0),
    `$${(r.amount || 0).toFixed(3)}`,
    `$${(r.thirdParty || 0).toFixed(3)}`,
    r.apiKeyType === 'consumer' ? 'Consumer-Normal' : 'Enterprise-Shared',
    r.apiKeyMasked,
    'AI App API',
    'API',
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\r\n');
  const filename = `Boutiqaat_Tasks_Billing_Report_${dateRange.from}_to_${dateRange.to}.csv`;
  downloadExcelFile(csv, filename);
}

export function exportToExcelCSV<T extends Record<string, any>>(
  data: T[],
  columns: { header: string; key: keyof T; width?: number }[],
  fileName: string
) {
  const headers = columns.map(c => c.header);
  const rows = data.map(item =>
    columns
      .map(col => {
        const val = item[col.key];
        return `"${String(val ?? '').replace(/"/g, '""')}"`;
      })
      .join(',')
  );

  const csv = [headers.join(','), ...rows].join('\r\n');
  const finalFilename = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  downloadExcelFile(csv, finalFilename);
}

