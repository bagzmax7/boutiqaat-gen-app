'use client';

import { AppDefinition, NodeInfoSchema } from '@/lib/types';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Loader2, Play, Upload, X, Link2, Plus, Trash2, CheckCircle2, Download, ImageIcon, Film, Layers } from 'lucide-react';
import { cn, isImageUrl, isVideoUrl, getFileNameFromUrl } from '@/lib/utils';
import { useTasks } from '@/hooks/useTasks';
import Image from 'next/image';

interface AppLauncherProps {
  app: AppDefinition;
  onTaskStarted: (taskId: string, appName: string, nodeInfoList: { nodeId: string; fieldName: string; fieldValue: string }[], apiKeyType?: 'enterprise' | 'consumer') => void;
}

interface FieldState {
  nodeId: string;
  fieldName: string;
  fieldValue: string;
  label: string;
}

export default function AppLauncher({ app, onTaskStarted }: AppLauncherProps) {
  const [fields, setFields] = useState<FieldState[]>(
    app.nodeInfoSchema?.map(s => ({
      nodeId: s.nodeId,
      fieldName: s.fieldName,
      fieldValue: s.defaultValue || '',
      label: s.label,
    })) || []
  );
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const [running, setRunning] = useState(false);
  const [sessionTaskIds, setSessionTaskIds] = useState<string[]>([]);
  const { tasks } = useTasks();

  const activeTasks = tasks.filter(t => sessionTaskIds.includes(t.taskId));

  // For custom fields (apps without schema)
  const [customFields, setCustomFields] = useState<{ nodeId: string; fieldName: string; fieldValue: string }[]>([]);

  function updateField(index: number, value: string) {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, fieldValue: value } : f));
  }

  function addCustomField() {
    setCustomFields(prev => [...prev, { nodeId: '', fieldName: '', fieldValue: '' }]);
  }

  function updateCustomField(index: number, key: keyof typeof customFields[0], value: string) {
    setCustomFields(prev => prev.map((f, i) => i === index ? { ...f, [key]: value } : f));
  }

  function removeCustomField(index: number) {
    setCustomFields(prev => prev.filter((_, i) => i !== index));
  }

  async function handleUpload(index: number, file: File) {
    setUploading(prev => ({ ...prev, [index]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/runninghub/upload', { method: 'POST', body: formData });
      const data = await res.json();
      // Upload route returns { success: true, fileUrl: '...' } at root level
      if (data.fileUrl) {
        updateField(index, data.fileUrl);
        toast.success('File uploaded! URL set as field value.');
      } else {
        toast.error('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch {
      toast.error('Upload failed — check your connection');
    } finally {
      setUploading(prev => ({ ...prev, [index]: false }));
    }
  }

  async function handleRun() {
    // Validate required fields
    const missingRequired = app.nodeInfoSchema?.filter((schema, i) =>
      schema.required && !fields[i]?.fieldValue?.trim()
    );
    if (missingRequired && missingRequired.length > 0) {
      toast.error(`Please fill in required fields: ${missingRequired.map(s => s.label).join(', ')}`);
      return;
    }

    setRunning(true);
    try {
      const activeFields = fields.filter(f => f.fieldValue.trim());
      const customNodeInfo = customFields.filter(f => f.nodeId && f.fieldName && f.fieldValue);

      if (app.batchMode) {
        // Parallel API calls for each uploaded image
        const promises = activeFields.map(async (f, index) => {
          const singleNodeInfo = [
            { nodeId: f.nodeId, fieldName: f.fieldName, fieldValue: f.fieldValue },
            ...customNodeInfo
          ];
          
          const res = await fetch('/api/runninghub/run-app', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appId: app.id, nodeInfoList: singleNodeInfo }),
          });
          const data = await res.json();
          
          if (data.taskId) {
            onTaskStarted(data.taskId, `${app.name} (${index + 1})`, singleNodeInfo, data.apiKeyType);
            setSessionTaskIds(prev => [...prev, data.taskId]);
            return { success: true };
          } else {
            return { success: false, error: data.errorMessage || data.error || 'Unknown error', code: data.errorCode };
          }
        });

        const results = await Promise.all(promises);
        const successes = results.filter(r => r.success).length;
        const failures = results.length - successes;
        
        if (successes > 0) toast.success(`Started ${successes} batch task(s) in parallel! Monitoring progress...`);
        if (failures > 0) {
          const firstError = results.find(r => !r.success);
          toast.error(`Failed to start ${failures} task(s). Error: ${firstError?.error}`);
        }
      } else {
        // Original single API call with all fields
        const allNodeInfo = [
          ...activeFields.map(f => ({
            nodeId: f.nodeId,
            fieldName: f.fieldName,
            fieldValue: f.fieldValue,
          })),
          ...customNodeInfo,
        ];

        const res = await fetch('/api/runninghub/run-app', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: app.id, nodeInfoList: allNodeInfo }),
        });

        const data = await res.json();

        // RunningHub OpenAPI v2: taskId at root level, non-empty = success
        if (data.taskId) {
          toast.success('Task started! Monitoring progress...');
          onTaskStarted(data.taskId, app.name, allNodeInfo, data.apiKeyType);
          setSessionTaskIds(prev => [...prev, data.taskId]);
        } else {
          // Show specific service error
          const errMsg = data.errorMessage || data.error || 'Unknown error';
          const errCode = data.errorCode ? ` [${data.errorCode}]` : '';
          toast.error(`AI Service error${errCode}: ${errMsg}`, { duration: 6000 });
        }
      }
    } catch {
      toast.error('Failed to connect to AI API');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-text-primary">{app.name}</h3>
          <p className="text-sm text-text-secondary mt-0.5">{app.description}</p>
        </div>
        <div className="text-xs bg-accent-gold/10 text-accent-gold border border-accent-gold/20 px-3 py-1 rounded-full font-medium">
          {app.category}
        </div>
      </div>

      <div className={cn(
        "grid gap-6",
        fields.length > 1 ? "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
      )}>
        {/* Schema-based fields */}
        {fields.map((field, i) => {
          const schema = app.nodeInfoSchema?.[i];
          return (
            <FieldInput
              key={i}
              field={field}
              schema={schema}
              uploading={uploading[i]}
              onValueChange={(v) => updateField(i, v)}
              onUpload={(f) => handleUpload(i, f)}
            />
          );
        })}

        {/* Custom fields (for apps without schema) */}
        {customFields.map((cf, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-start">
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Node ID</label>
              <input
                className="w-full bg-bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder-text-muted input-gold transition-all"
                placeholder="e.g. 6"
                value={cf.nodeId}
                onChange={e => updateCustomField(i, 'nodeId', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Field Name</label>
              <input
                className="w-full bg-bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder-text-muted input-gold transition-all"
                placeholder="e.g. text"
                value={cf.fieldName}
                onChange={e => updateCustomField(i, 'fieldName', e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1.5">Value</label>
                <input
                  className="w-full bg-bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder-text-muted input-gold transition-all"
                  placeholder="value"
                  value={cf.fieldValue}
                  onChange={e => updateCustomField(i, 'fieldValue', e.target.value)}
                />
              </div>
              <button
                onClick={() => removeCustomField(i)}
                className="mt-6 w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Add custom field button */}
        <button
          onClick={addCustomField}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-xl text-sm text-text-muted hover:text-text-secondary hover:border-border-light transition-all"
        >
          <Plus className="w-4 h-4" />
          Add parameter
        </button>
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={running}
        className="mt-6 w-full flex items-center justify-center gap-2 bg-gradient-gold text-white font-semibold py-3 rounded-xl btn-lift glow-gold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {running ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Starting Task...</>
        ) : (
          <><Play className="w-4 h-4" /> Run App</>
        )}
      </button>

      {/* Inline Results Section */}
      {activeTasks.length > 0 && (
        <div className="mt-8 border-t border-border pt-8 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">Generation Results</h3>
            <button 
              onClick={() => setSessionTaskIds([])}
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              Clear Results
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {activeTasks.map((task, idx) => (
              <div key={task.taskId} className="bg-bg-secondary border border-border rounded-xl p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary truncate pr-2">
                    {task.appName}
                  </span>
                  {task.status === 'RUNNING' || task.status === 'QUEUED' ? (
                    <Loader2 className="w-4 h-4 text-accent-blue animate-spin shrink-0" />
                  ) : task.status === 'SUCCESS' ? (
                    <CheckCircle2 className="w-4 h-4 text-accent-green shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-accent-red shrink-0" />
                  )}
                </div>

                {task.status === 'SUCCESS' && task.outputs ? (
                  <div className="flex flex-col gap-2">
                    {task.outputs.map((out, outIdx) => {
                      const isImg = isImageUrl(out.fileUrl);
                      const isVid = isVideoUrl(out.fileUrl);
                      const isPsd = out.fileUrl.toLowerCase().endsWith('.psd');
                      
                      return (
                        <div key={outIdx} className="group relative aspect-square rounded-lg border border-border overflow-hidden bg-bg-card">
                          {isImg ? (
                            <Image src={out.fileUrl} alt="Output" fill className="object-cover" sizes="200px" />
                          ) : isVid ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-accent-purple bg-accent-purple/5"><Film className="w-6 h-6 mb-1"/> <span className="text-[10px]">VIDEO</span></div>
                          ) : isPsd ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-accent-blue bg-accent-blue/5"><ImageIcon className="w-6 h-6 mb-1"/> <span className="text-[10px] font-bold">PSD</span></div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-text-muted"><ImageIcon className="w-6 h-6 mb-1"/> <span className="text-[10px]">FILE</span></div>
                          )}
                          
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(out.fileUrl);
                                  const blob = await res.blob();
                                  const a = document.createElement('a');
                                  a.href = URL.createObjectURL(blob);
                                  a.download = getFileNameFromUrl(out.fileUrl);
                                  a.click();
                                  URL.revokeObjectURL(a.href);
                                } catch {
                                  window.open(out.fileUrl, '_blank');
                                }
                              }}
                              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white text-white hover:text-black flex items-center justify-center transition-all shadow-lg"
                              title="Download file"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            
                            {/* PSD Download Button for Batch Remove Background */}
                            {task.appId === '2063548168545071105' && isImg && (
                              <button
                                onClick={async () => {
                                  const origNode = task.nodeInfoList?.find((n: any) => n.nodeId === '4' && n.fieldName === 'image');
                                  if (!origNode || !origNode.fieldValue) {
                                    toast.error("Original image URL not found.");
                                    return;
                                  }
                                  const toastId = toast.loading("Generating PSD with Native Mask...");
                                  try {
                                    const res = await fetch('/api/runninghub/create-psd-from-urls', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        originalUrl: origNode.fieldValue,
                                        maskUrl: out.fileUrl,
                                        fileName: `masked-output-${task.taskId}.psd`
                                      })
                                    });
                                    
                                    if (!res.ok) throw new Error(await res.text());
                                    
                                    const blob = await res.blob();
                                    const a = document.createElement('a');
                                    a.href = URL.createObjectURL(blob);
                                    a.download = `masked-output-${task.taskId}.psd`;
                                    a.click();
                                    URL.revokeObjectURL(a.href);
                                    toast.success("PSD downloaded successfully!", { id: toastId });
                                  } catch (err: any) {
                                    toast.error("Failed to generate PSD: " + err.message, { id: toastId });
                                  }
                                }}
                                className="w-8 h-8 rounded-full bg-accent-blue/80 hover:bg-accent-blue text-white flex items-center justify-center transition-all shadow-lg"
                                title="Download PSD (Native Mask)"
                              >
                                <Layers className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : task.status === 'FAILED' ? (
                  <div className="flex-1 flex items-center justify-center text-center p-2 rounded-lg bg-accent-red/10 border border-accent-red/20">
                    <p className="text-[10px] text-accent-red">{task.error || 'Task Failed'}</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center min-h-[120px] rounded-lg bg-bg-card border border-border">
                    <p className="text-xs text-text-muted animate-pulse">Processing...</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component for each field type
function FieldInput({
  field,
  schema,
  uploading,
  onValueChange,
  onUpload,
}: {
  field: FieldState;
  schema?: NodeInfoSchema;
  uploading?: boolean;
  onValueChange: (v: string) => void;
  onUpload: (f: File) => void;
}) {
  // Upload is the PRIMARY mode for image fields; URL is secondary
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) onUpload(files[0]);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'video/*': [] },
    maxFiles: 1,
  });

  const isImageField = schema?.type === 'image-url';
  const label = field.label || `${field.nodeId} / ${field.fieldName}`;

  function handleUrlSubmit() {
    if (urlInput.trim()) {
      onValueChange(urlInput.trim());
      setShowUrlInput(false);
    }
  }

  // ── Image / Upload field ──────────────────────────────
  if (isImageField) {
    return (
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {label}
          {schema?.required && <span className="text-accent-red ml-1">*</span>}
        </label>

        {/* Uploaded / URL set — show Image Preview */}
        {field.fieldValue ? (
          <div className="relative rounded-xl border border-border overflow-hidden group aspect-square max-h-48 bg-bg-secondary w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={field.fieldValue} 
              alt="Preview" 
              className="w-full h-full object-cover transition-all"
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
              <button
                onClick={() => { onValueChange(''); setUrlInput(''); setShowUrlInput(false); }}
                className="w-8 h-8 rounded-full bg-accent-red/90 flex items-center justify-center text-white hover:bg-accent-red hover:scale-110 transition-all shadow-lg"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Status indicator */}
            <div className="absolute top-2 left-2 bg-accent-green/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              READY
            </div>
          </div>
        ) : (
          <>
            {/* PRIMARY: Compact upload dropzone */}
            <div
              {...getRootProps()}
              className={cn(
                'relative border-2 border-dashed rounded-xl cursor-pointer transition-all group aspect-square max-h-48 w-full flex items-center justify-center',
                isDragActive
                  ? 'border-accent-gold bg-accent-gold/8 scale-[1.01]'
                  : 'border-border hover:border-accent-gold/50 bg-bg-secondary hover:bg-accent-gold/3'
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center gap-2 px-4 text-center">
                {uploading ? (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-accent-gold/10 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-accent-gold animate-spin" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-primary">Uploading...</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                      isDragActive ? 'bg-accent-gold/20' : 'bg-bg-card border border-border group-hover:border-accent-gold/30 group-hover:bg-accent-gold/5'
                    )}>
                      <Upload className={cn('w-5 h-5 transition-colors', isDragActive ? 'text-accent-gold' : 'text-text-muted group-hover:text-accent-gold')} />
                    </div>
                    <div>
                      <p className={cn('text-xs font-semibold transition-colors', isDragActive ? 'text-accent-gold' : 'text-text-primary')}>
                        {isDragActive ? 'Drop here' : 'Upload'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* SECONDARY: URL option — small, below dropzone */}
            <div className="mt-2">
              {!showUrlInput ? (
                <button
                  onClick={() => setShowUrlInput(true)}
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors py-1"
                >
                  <Link2 className="w-3 h-3" />
                  Or use a public image URL instead
                </button>
              ) : (
                <div className="flex gap-2 items-center">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
                    placeholder="https://example.com/image.jpg"
                    autoFocus
                    className="flex-1 bg-bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder-text-muted input-gold transition-all"
                  />
                  <button
                    onClick={handleUrlSubmit}
                    className="px-3 py-1.5 bg-accent-gold/10 text-accent-gold border border-accent-gold/20 rounded-lg text-xs font-medium hover:bg-accent-gold/20 transition-all"
                  >
                    Use URL
                  </button>
                  <button
                    onClick={() => { setShowUrlInput(false); setUrlInput(''); }}
                    className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Textarea field ────────────────────────────────────
  if (schema?.type === 'textarea') {
    return (
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {label}
          {schema?.required && <span className="text-accent-red ml-1">*</span>}
        </label>
        <textarea
          value={field.fieldValue}
          onChange={e => onValueChange(e.target.value)}
          placeholder={schema?.placeholder || ''}
          rows={4}
          className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted input-gold transition-all resize-none"
        />
      </div>
    );
  }

  // ── Select field ──────────────────────────────────────
  if (schema?.type === 'select') {
    return (
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {label}
          {schema?.required && <span className="text-accent-red ml-1">*</span>}
        </label>
        <select
          value={field.fieldValue}
          onChange={e => onValueChange(e.target.value)}
          className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary input-gold transition-all"
        >
          <option value="">Select...</option>
          {schema.options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  // ── Default text / number field ───────────────────────
  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary mb-2">
        {label}
        {schema?.required && <span className="text-accent-red ml-1">*</span>}
      </label>
      <input
        type={schema?.type === 'number' ? 'number' : 'text'}
        value={field.fieldValue}
        onChange={e => onValueChange(e.target.value)}
        placeholder={schema?.placeholder || `Enter ${field.fieldName}`}
        className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted input-gold transition-all"
      />
    </div>
  );
}


