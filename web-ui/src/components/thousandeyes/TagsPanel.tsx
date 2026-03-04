'use client';

import { memo, useState, useMemo, useEffect, useCallback } from 'react';
import {
  Tag, Plus, Trash2, Loader2, X, Search, Edit3, Link2, Unlink,
  FlaskConical, Server, ChevronDown, ChevronRight, RefreshCw, Sparkles,
} from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import type { TETag } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TagsPanelProps {
  onAskAI?: (context: string) => void;
}

interface TagAssignment {
  type: string;
  id: string;
  name?: string;
}

// ============================================================================
// Constants
// ============================================================================

const TAG_COLORS = [
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#ef4444', name: 'Red' },
  { hex: '#8b5cf6', name: 'Purple' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#64748b', name: 'Slate' },
  { hex: '#14b8a6', name: 'Teal' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#6366f1', name: 'Indigo' },
  { hex: '#84cc16', name: 'Lime' },
];

function getTypeIcon(type?: string) {
  if (type === 'test') return <FlaskConical className="w-3 h-3" />;
  if (type === 'agent') return <Server className="w-3 h-3" />;
  return <Tag className="w-3 h-3" />;
}

function getTypeLabel(type?: string) {
  if (type === 'test') return 'Tests';
  if (type === 'agent') return 'Agents';
  return 'All';
}

// ============================================================================
// Tag Create/Edit Modal
// ============================================================================

function TagModal({ tag, onSave, onClose, saving }: {
  tag: Partial<TETag> | null;
  onSave: (data: { name: string; color?: string }) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(tag?.name || '');
  const [color, setColor] = useState(tag?.color || '#3b82f6');
  const isEdit = !!tag?.id;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/50">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{isEdit ? 'Edit Tag' : 'Create Tag'}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Tag Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production, Critical"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-white text-sm"
              autoFocus />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Color</label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map(c => (
                <button key={c.hex} onClick={() => setColor(c.hex)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${color === c.hex ? 'border-slate-900 dark:border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Preview:</span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white shadow-sm" style={{ backgroundColor: color }}>
              {name || 'Tag Name'}
            </span>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700/50">
          <button onClick={async () => { await onSave({ name, color }); }} disabled={saving || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700 transition font-medium shadow-sm disabled:opacity-50 text-sm">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Update' : 'Create Tag'}
          </button>
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2.5 bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50 rounded-xl hover:bg-slate-100 transition font-medium text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Assign Tag Modal
// ============================================================================

function AssignModal({ tag, onAssign, onUnassign, onClose, saving }: {
  tag: TETag;
  onAssign: (tagId: string, assignments: TagAssignment[]) => Promise<void>;
  onUnassign: (tagId: string, assignments: TagAssignment[]) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}) {
  const [assignType, setAssignType] = useState<'test' | 'agent'>('test');
  const [assignId, setAssignId] = useState('');
  const assignments = tag.assignments || [];

  const testAssignments = assignments.filter(a => a.type === 'test');
  const agentAssignments = assignments.filter(a => a.type === 'agent');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full overflow-hidden max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: tag.color || '#3b82f6' }}>
              {tag.name}
            </span>
            <span className="text-sm text-slate-500">Assignments</span>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add assignment */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/30">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Assign to:</p>
          <div className="flex gap-2">
            <select value={assignType} onChange={e => setAssignType(e.target.value as 'test' | 'agent')}
              className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600/50 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
              <option value="test">Test</option>
              <option value="agent">Agent</option>
            </select>
            <input type="text" value={assignId} onChange={e => setAssignId(e.target.value)}
              placeholder={`Enter ${assignType} ID`}
              className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600/50 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
            <button
              onClick={async () => {
                if (!assignId.trim()) return;
                await onAssign(tag.id, [{ type: assignType, id: assignId.trim() }]);
                setAssignId('');
              }}
              disabled={saving || !assignId.trim()}
              className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition disabled:opacity-50 flex items-center gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              Assign
            </button>
          </div>
        </div>

        {/* Current assignments */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {assignments.length === 0 ? (
            <div className="py-6 text-center">
              <Link2 className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500">No assignments yet</p>
              <p className="text-xs text-slate-400 mt-1">Assign this tag to tests or agents above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Tests */}
              {testAssignments.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                    <FlaskConical className="w-3 h-3" /> Tests ({testAssignments.length})
                  </p>
                  <div className="space-y-1">
                    {testAssignments.map(a => (
                      <div key={`${a.type}-${a.id}`} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900/30 rounded-lg group">
                        <span className="text-sm text-slate-700 dark:text-slate-200 font-mono">{a.id}</span>
                        <button
                          onClick={() => onUnassign(tag.id, [{ type: a.type, id: a.id }])}
                          disabled={saving}
                          className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition disabled:opacity-50">
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Agents */}
              {agentAssignments.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                    <Server className="w-3 h-3" /> Agents ({agentAssignments.length})
                  </p>
                  <div className="space-y-1">
                    {agentAssignments.map(a => (
                      <div key={`${a.type}-${a.id}`} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900/30 rounded-lg group">
                        <span className="text-sm text-slate-700 dark:text-slate-200 font-mono">{a.id}</span>
                        <button
                          onClick={() => onUnassign(tag.id, [{ type: a.type, id: a.id }])}
                          disabled={saving}
                          className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition disabled:opacity-50">
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tag Row Component
// ============================================================================

function TagRow({ tag, expanded, onToggle, onEdit, onDelete, onManageAssignments, deleting }: {
  tag: TETag;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onManageAssignments: () => void;
  deleting: boolean;
}) {
  const assignCount = tag.assignments?.length || 0;
  const testCount = tag.assignments?.filter(a => a.type === 'test').length || 0;
  const agentCount = tag.assignments?.filter(a => a.type === 'agent').length || 0;

  return (
    <div className={`rounded-lg border transition-all overflow-hidden ${
      expanded
        ? 'border-purple-300 dark:border-purple-500/40 bg-white dark:bg-slate-800/60 shadow-sm'
        : 'border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600'
    }`}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        {/* Expand toggle */}
        <button onClick={onToggle} className="flex-shrink-0 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {/* Color dot */}
        <span className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: tag.color || '#3b82f6' }} />

        {/* Name */}
        <span className="text-sm font-semibold text-slate-800 dark:text-white flex-1 min-w-0 truncate">{tag.name}</span>

        {/* Type badge */}
        {tag.objectType && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400">
            {getTypeIcon(tag.objectType)} {getTypeLabel(tag.objectType)}
          </span>
        )}

        {/* Assignment count */}
        {assignCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            <Link2 className="w-3 h-3" /> {assignCount}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={onManageAssignments} className="p-1.5 text-slate-400 hover:text-purple-500 transition rounded-md hover:bg-purple-50 dark:hover:bg-purple-500/10" title="Manage assignments">
            <Link2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-cyan-500 transition rounded-md hover:bg-cyan-50 dark:hover:bg-cyan-500/10" title="Edit tag">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} disabled={deleting}
            className="p-1.5 text-slate-400 hover:text-red-500 transition rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50" title="Delete tag">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/30 bg-slate-50/50 dark:bg-slate-900/20">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 text-center border border-slate-100 dark:border-slate-700/30">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{assignCount}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total</p>
            </div>
            <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 text-center border border-slate-100 dark:border-slate-700/30">
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{testCount}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Tests</p>
            </div>
            <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 text-center border border-slate-100 dark:border-slate-700/30">
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{agentCount}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Agents</p>
            </div>
          </div>
          {assignCount > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tag.assignments!.slice(0, 8).map(a => (
                <span key={`${a.type}-${a.id}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded text-[10px] text-slate-600 dark:text-slate-300 font-mono">
                  {a.type === 'test' ? <FlaskConical className="w-2.5 h-2.5 text-blue-500" /> : <Server className="w-2.5 h-2.5 text-emerald-500" />}
                  {a.id}
                </span>
              ))}
              {assignCount > 8 && (
                <span className="px-2 py-0.5 text-[10px] text-slate-400">+{assignCount - 8} more</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TagsPanel Component
// ============================================================================

export const TagsPanel = memo(({ onAskAI }: TagsPanelProps) => {
  const [tags, setTags] = useState<TETag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalTag, setModalTag] = useState<Partial<TETag> | null | 'create'>(null);
  const [assignModalTag, setAssignModalTag] = useState<TETag | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'test' | 'agent'>('all');

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/thousandeyes/tags?organization=default', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const tagsList: TETag[] = data.tags || data._embedded?.tags || [];
      setTags(tagsList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tags');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  // Filtered & searched tags
  const filteredTags = useMemo(() => {
    let result = tags;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => t.name.toLowerCase().includes(q));
    }
    if (filterType !== 'all') {
      result = result.filter(t => t.objectType === filterType || (t.assignments && t.assignments.some(a => a.type === filterType)));
    }
    return result;
  }, [tags, search, filterType]);

  // Stats
  const stats = useMemo(() => {
    const totalAssignments = tags.reduce((s, t) => s + (t.assignments?.length || 0), 0);
    const testAssignments = tags.reduce((s, t) => s + (t.assignments?.filter(a => a.type === 'test').length || 0), 0);
    const agentAssignments = tags.reduce((s, t) => s + (t.assignments?.filter(a => a.type === 'agent').length || 0), 0);
    return { total: tags.length, totalAssignments, testAssignments, agentAssignments };
  }, [tags]);

  const handleSave = useCallback(async (data: { name: string; color?: string }) => {
    setSaving(true);
    try {
      const isEdit = modalTag && typeof modalTag === 'object' && 'id' in modalTag;
      const url = isEdit
        ? `/api/thousandeyes/tags/${(modalTag as TETag).id}?organization=default`
        : '/api/thousandeyes/tags?organization=default';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchTags();
      setModalTag(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tag');
    } finally { setSaving(false); }
  }, [modalTag, fetchTags]);

  const handleDelete = useCallback(async (tagId: string) => {
    setDeletingId(tagId);
    try {
      const res = await fetch(`/api/thousandeyes/tags/${tagId}?organization=default`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
    } finally { setDeletingId(null); }
  }, [fetchTags]);

  const handleAssign = useCallback(async (tagId: string, assignments: TagAssignment[]) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/thousandeyes/tags/${tagId}/assign?organization=default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignments }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchTags();
      // Update the assign modal tag with refreshed data
      const updated = tags.find(t => t.id === tagId);
      if (updated) setAssignModalTag({ ...updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign tag');
    } finally { setSaving(false); }
  }, [fetchTags, tags]);

  const handleUnassign = useCallback(async (tagId: string, assignments: TagAssignment[]) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/thousandeyes/tags/${tagId}/unassign?organization=default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignments }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchTags();
      const updated = tags.find(t => t.id === tagId);
      if (updated) setAssignModalTag({ ...updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unassign tag');
    } finally { setSaving(false); }
  }, [fetchTags, tags]);

  return (
    <DashboardCard title="Tags" icon={<Tag className="w-4 h-4" />} accent="purple">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 text-center">
          <p className="text-lg font-bold text-slate-900 dark:text-white">{stats.total}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Tags</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 text-center">
          <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{stats.totalAssignments}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Assignments</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 text-center">
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.testAssignments}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Tests</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 text-center">
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.agentAssignments}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Agents</p>
        </div>
      </div>

      {/* Search & filter bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tags..."
            className="w-full pl-8 pr-8 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Type filter */}
        <select value={filterType} onChange={e => setFilterType(e.target.value as typeof filterType)}
          className="px-2 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50">
          <option value="all">All Types</option>
          <option value="test">Tests</option>
          <option value="agent">Agents</option>
        </select>

        {/* Refresh */}
        <button onClick={fetchTags} disabled={loading}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          title="Refresh tags">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {/* Create */}
        <button onClick={() => setModalTag('create')}
          className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs rounded-lg hover:from-purple-700 hover:to-indigo-700 transition font-medium shadow-sm">
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2 flex items-center justify-between">
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Loading */}
      {loading && tags.length === 0 && (
        <div className="py-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
          <span className="ml-2 text-xs text-slate-500">Loading tags...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && tags.length === 0 && (
        <div className="py-8 text-center">
          <Tag className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No tags yet</p>
          <p className="text-xs text-slate-400 mt-1 mb-3">Tags help organize and categorize your tests and agents</p>
          <button onClick={() => setModalTag('create')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs rounded-lg hover:from-purple-700 hover:to-indigo-700 transition font-medium shadow-sm">
            <Plus className="w-3.5 h-3.5" /> Create Your First Tag
          </button>
        </div>
      )}

      {/* No search results */}
      {!loading && tags.length > 0 && filteredTags.length === 0 && (
        <div className="py-6 text-center">
          <Search className="w-6 h-6 mx-auto mb-2 text-slate-400" />
          <p className="text-xs text-slate-500">No tags match your search</p>
        </div>
      )}

      {/* Tag list */}
      {filteredTags.length > 0 && (
        <div className="space-y-1.5">
          {filteredTags.map(tag => (
            <TagRow
              key={tag.id}
              tag={tag}
              expanded={expandedId === tag.id}
              onToggle={() => setExpandedId(prev => prev === tag.id ? null : tag.id)}
              onEdit={() => setModalTag(tag)}
              onDelete={() => handleDelete(tag.id)}
              onManageAssignments={() => setAssignModalTag(tag)}
              deleting={deletingId === tag.id}
            />
          ))}
        </div>
      )}

      {/* AI Ask */}
      {onAskAI && tags.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50">
          <button
            onClick={() => onAskAI(`Analyze the tag organization for ${tags.length} tags with ${stats.totalAssignments} total assignments (${stats.testAssignments} test, ${stats.agentAssignments} agent assignments). Tag names: ${tags.map(t => t.name).join(', ')}. Suggest improvements to tag organization and coverage.`)}
            className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition font-medium">
            <Sparkles className="w-3.5 h-3.5" /> Analyze tag organization with AI
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalTag !== null && (
        <TagModal
          tag={modalTag === 'create' ? {} : modalTag}
          onSave={handleSave}
          onClose={() => setModalTag(null)}
          saving={saving}
        />
      )}

      {/* Assign Modal */}
      {assignModalTag && (
        <AssignModal
          tag={assignModalTag}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
          onClose={() => setAssignModalTag(null)}
          saving={saving}
        />
      )}
    </DashboardCard>
  );
});

TagsPanel.displayName = 'TagsPanel';

export default TagsPanel;
