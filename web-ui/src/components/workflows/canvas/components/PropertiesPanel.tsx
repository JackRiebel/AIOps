'use client';

import { memo, useState, useCallback, useEffect } from 'react';
import {
  X, Settings, Info, AlertTriangle, ChevronDown, ChevronRight,
  Zap, GitBranch, Brain, Wrench, Bell, Hand, Clock, Repeat, Code,
  HelpCircle, Trash2, Copy, Play, Plus, Minus, Users, Mail, Slack,
  MessageCircle, Globe, Database, FileText, CheckCircle2
} from 'lucide-react';
import { Node } from '@xyflow/react';
import {
  ACTION_REGISTRY,
  type ActionParameter,
  type SmartParameterType,
} from '../../types';
import type { CanvasNodeType, ValidationError } from '../types';
import { SmartParameterField } from './SmartParameterField';

// ============================================================================
// Types
// ============================================================================

interface PropertiesPanelProps {
  node: Node | null;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onDelete: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onClose: () => void;
  validationErrors?: ValidationError[];
}

// ============================================================================
// Styled Input Components
// ============================================================================

const Input = memo(({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-600 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors ${className}`}
  />
));
Input.displayName = 'Input';

const Select = memo(({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-600 text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors ${className}`}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

const Textarea = memo(({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={`w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-600 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors resize-none ${className}`}
  />
));
Textarea.displayName = 'Textarea';

const Checkbox = memo(({ label, checked, onChange, description }: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}) => (
  <label className="flex items-start gap-3 cursor-pointer group">
    <div className="relative flex items-center justify-center w-5 h-5 mt-0.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <div className="w-5 h-5 rounded border-2 border-slate-600 bg-slate-900/50 peer-checked:bg-cyan-500 peer-checked:border-cyan-500 transition-colors">
        {checked && <CheckCircle2 className="w-4 h-4 text-white absolute top-0.5 left-0.5" />}
      </div>
    </div>
    <div className="flex-1">
      <span className="text-sm text-slate-200 group-hover:text-white transition-colors">{label}</span>
      {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
    </div>
  </label>
));
Checkbox.displayName = 'Checkbox';

// ============================================================================
// Main Component
// ============================================================================

export const PropertiesPanel = memo(({
  node,
  onUpdate,
  onDelete,
  onDuplicate,
  onClose,
  validationErrors = [],
}: PropertiesPanelProps) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['config'])
  );

  const handleUpdate = useCallback(
    (updates: Record<string, unknown>) => {
      if (!node) return;
      const nodeData = node.data as Record<string, unknown>;
      onUpdate(node.id, { ...nodeData, ...updates });
    },
    [node, onUpdate]
  );

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  if (!node) {
    return (
      <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-medium text-slate-400">Properties</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-slate-500">
            <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No node selected</p>
            <p className="text-xs mt-1 opacity-70">Click on a node to edit its properties</p>
          </div>
        </div>
      </div>
    );
  }

  const nodeType = node.type as CanvasNodeType;
  const nodeData = node.data as Record<string, unknown>;
  const nodeErrors = validationErrors.filter((e) => e.nodeId === node.id);

  return (
    <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NodeIcon type={nodeType} />
            <div>
              <h3 className="text-sm font-semibold text-white">
                {getNodeTypeName(nodeType)}
              </h3>
              <p className="text-xs text-slate-500 font-mono">{node.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {nodeErrors.length > 0 && (
          <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
            {nodeErrors.map((error, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-red-400">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{error.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Label - Always visible at top */}
        <div className="p-4 border-b border-slate-700/50">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Display Label
          </label>
          <Input
            type="text"
            value={(nodeData.label as string) || ''}
            onChange={(e) => handleUpdate({ label: e.target.value })}
            placeholder={getDefaultPlaceholder(nodeType)}
          />
        </div>

        {/* Type-specific Configuration */}
        <PropertySection
          title="Configuration"
          icon={Code}
          isExpanded={expandedSections.has('config')}
          onToggle={() => toggleSection('config')}
        >
          <NodeConfigFields
            nodeType={nodeType}
            nodeData={nodeData}
            onUpdate={handleUpdate}
          />
        </PropertySection>

        {/* Advanced Options */}
        <PropertySection
          title="Advanced"
          icon={Settings}
          isExpanded={expandedSections.has('advanced')}
          onToggle={() => toggleSection('advanced')}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Timeout
                </label>
                <div className="flex">
                  <Input
                    type="number"
                    value={(nodeData.timeout as number) || ''}
                    onChange={(e) => handleUpdate({ timeout: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="∞"
                    min={1}
                    className="rounded-r-none"
                  />
                  <span className="px-3 py-2 bg-slate-700 border border-l-0 border-slate-600 rounded-r-lg text-xs text-slate-400">
                    sec
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Retries
                </label>
                <Input
                  type="number"
                  value={(nodeData.retryCount as number) || ''}
                  onChange={(e) => handleUpdate({ retryCount: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="0"
                  min={0}
                  max={10}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Notes
              </label>
              <Textarea
                value={(nodeData.notes as string) || ''}
                onChange={(e) => handleUpdate({ notes: e.target.value })}
                placeholder="Add internal notes..."
                rows={2}
              />
            </div>
          </div>
        </PropertySection>
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-slate-700 bg-slate-900/30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDuplicate(node.id)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white text-sm font-medium transition-colors"
          >
            <Copy className="w-4 h-4" />
            Duplicate
          </button>
          <button
            onClick={() => onDelete(node.id)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
});

PropertiesPanel.displayName = 'PropertiesPanel';

// ============================================================================
// Helper Components
// ============================================================================

const PropertySection = memo(({
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  icon: typeof Settings;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <div className="border-b border-slate-700/50">
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-700/20 transition-colors"
    >
      {isExpanded ? (
        <ChevronDown className="w-4 h-4 text-slate-500" />
      ) : (
        <ChevronRight className="w-4 h-4 text-slate-500" />
      )}
      <Icon className="w-4 h-4 text-slate-400" />
      <span className="text-sm font-medium text-slate-300">{title}</span>
    </button>
    {isExpanded && <div className="px-4 pb-4 space-y-4">{children}</div>}
  </div>
));

PropertySection.displayName = 'PropertySection';

const FieldLabel = memo(({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <div className="flex items-center justify-between mb-1.5">
    <label className="text-xs font-medium text-slate-400">{children}</label>
    {hint && (
      <button className="p-0.5 text-slate-500 hover:text-slate-400" title={hint}>
        <HelpCircle className="w-3 h-3" />
      </button>
    )}
  </div>
));

FieldLabel.displayName = 'FieldLabel';

// ============================================================================
// Node Type Specific Fields
// ============================================================================

const NodeConfigFields = memo(({
  nodeType,
  nodeData,
  onUpdate,
}: {
  nodeType: CanvasNodeType;
  nodeData: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
}) => {
  switch (nodeType) {
    case 'trigger':
      return <TriggerFields data={nodeData} onUpdate={onUpdate} />;
    case 'condition':
      return <ConditionFields data={nodeData} onUpdate={onUpdate} />;
    case 'action':
      return <ActionFields data={nodeData} onUpdate={onUpdate} />;
    case 'ai':
      return <AIFields data={nodeData} onUpdate={onUpdate} />;
    case 'notify':
      return <NotifyFields data={nodeData} onUpdate={onUpdate} />;
    case 'delay':
      return <DelayFields data={nodeData} onUpdate={onUpdate} />;
    case 'loop':
      return <LoopFields data={nodeData} onUpdate={onUpdate} />;
    case 'approval':
      return <ApprovalFields data={nodeData} onUpdate={onUpdate} />;
    case 'subworkflow':
      return <SubworkflowFields data={nodeData} onUpdate={onUpdate} />;
    case 'comment':
      return <CommentFields data={nodeData} onUpdate={onUpdate} />;
    default:
      return (
        <div className="text-xs text-slate-500 italic py-2">
          No additional configuration available.
        </div>
      );
  }
});

NodeConfigFields.displayName = 'NodeConfigFields';

// ============================================================================
// TRIGGER FIELDS
// ============================================================================

const TriggerFields = memo(({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
}) => {
  const triggerType = (data.triggerType as string) || 'manual';

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Trigger Type</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'manual', label: 'Manual', icon: Play },
            { value: 'schedule', label: 'Schedule', icon: Clock },
            { value: 'webhook', label: 'Webhook', icon: Globe },
            { value: 'splunk_query', label: 'Splunk Alert', icon: Database },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => onUpdate({ triggerType: value })}
              className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${
                triggerType === value
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-600 bg-slate-900/30 text-slate-400 hover:border-slate-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {triggerType === 'schedule' && (
        <>
          <div>
            <FieldLabel hint="When should this workflow run?">Schedule</FieldLabel>
            <Select
              value={(data.schedulePreset as string) || 'custom'}
              onChange={(e) => {
                const presets: Record<string, string> = {
                  'every_5_min': '*/5 * * * *',
                  'every_hour': '0 * * * *',
                  'every_day': '0 9 * * *',
                  'every_week': '0 9 * * 1',
                };
                onUpdate({
                  schedulePreset: e.target.value,
                  cron: presets[e.target.value] || data.cron,
                });
              }}
            >
              <option value="every_5_min">Every 5 minutes</option>
              <option value="every_hour">Every hour</option>
              <option value="every_day">Every day at 9 AM</option>
              <option value="every_week">Every Monday at 9 AM</option>
              <option value="custom">Custom cron expression</option>
            </Select>
          </div>
          {(data.schedulePreset as string) === 'custom' && (
            <div>
              <FieldLabel hint="Standard cron format: min hour day month weekday">Cron Expression</FieldLabel>
              <Input
                type="text"
                value={(data.cron as string) || ''}
                onChange={(e) => onUpdate({ cron: e.target.value })}
                placeholder="*/15 * * * *"
                className="font-mono"
              />
            </div>
          )}
        </>
      )}

      {triggerType === 'splunk_query' && (
        <>
          <div>
            <FieldLabel hint="SPL query that triggers this workflow">Splunk Query</FieldLabel>
            <Textarea
              value={(data.query as string) || ''}
              onChange={(e) => onUpdate({ query: e.target.value })}
              placeholder="index=network sourcetype=syslog level=error"
              rows={3}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <FieldLabel>Poll Interval</FieldLabel>
            <div className="flex gap-2">
              <Input
                type="number"
                value={(data.pollInterval as number) || 5}
                onChange={(e) => onUpdate({ pollInterval: parseInt(e.target.value) || 5 })}
                min={1}
                className="w-20"
              />
              <Select
                value={(data.pollUnit as string) || 'minutes'}
                onChange={(e) => onUpdate({ pollUnit: e.target.value })}
                className="flex-1"
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </Select>
            </div>
          </div>
        </>
      )}

      {triggerType === 'webhook' && (
        <div>
          <FieldLabel>Webhook URL</FieldLabel>
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-600">
            <code className="text-xs text-cyan-400 break-all">
              {`/api/webhooks/workflow/${data.webhookId || 'xxxxxxxx'}`}
            </code>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            POST to this endpoint to trigger the workflow
          </p>
        </div>
      )}
    </div>
  );
});

TriggerFields.displayName = 'TriggerFields';

// ============================================================================
// CONDITION FIELDS
// ============================================================================

const ConditionFields = memo(({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
}) => {
  const conditionType = (data.conditionType as string) || 'simple';
  const conditions = (data.conditions as Array<{field: string; operator: string; value: string}>) || [
    { field: '', operator: 'equals', value: '' }
  ];

  const addCondition = () => {
    onUpdate({ conditions: [...conditions, { field: '', operator: 'equals', value: '' }] });
  };

  const removeCondition = (index: number) => {
    onUpdate({ conditions: conditions.filter((_, i) => i !== index) });
  };

  const updateCondition = (index: number, updates: Partial<typeof conditions[0]>) => {
    const newConditions = conditions.map((c, i) => i === index ? { ...c, ...updates } : c);
    onUpdate({ conditions: newConditions });
  };

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Condition Mode</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'simple', label: 'Simple Rules' },
            { value: 'expression', label: 'Expression' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onUpdate({ conditionType: value })}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                conditionType === value
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : 'border-slate-600 bg-slate-900/30 text-slate-400 hover:border-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {conditionType === 'simple' && (
        <>
          <div>
            <FieldLabel>Match</FieldLabel>
            <Select
              value={(data.matchType as string) || 'all'}
              onChange={(e) => onUpdate({ matchType: e.target.value })}
            >
              <option value="all">All conditions (AND)</option>
              <option value="any">Any condition (OR)</option>
            </Select>
          </div>

          <div className="space-y-2">
            <FieldLabel>Conditions</FieldLabel>
            {conditions.map((condition, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="text"
                  value={condition.field}
                  onChange={(e) => updateCondition(index, { field: e.target.value })}
                  placeholder="data.value"
                  className="flex-1 font-mono text-xs"
                />
                <Select
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, { operator: e.target.value })}
                  className="w-28"
                >
                  <option value="equals">=</option>
                  <option value="not_equals">≠</option>
                  <option value="greater">&gt;</option>
                  <option value="less">&lt;</option>
                  <option value="contains">contains</option>
                  <option value="starts_with">starts with</option>
                </Select>
                <Input
                  type="text"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
                  placeholder="value"
                  className="flex-1"
                />
                {conditions.length > 1 && (
                  <button
                    onClick={() => removeCondition(index)}
                    className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addCondition}
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
            >
              <Plus className="w-3.5 h-3.5" />
              Add condition
            </button>
          </div>
        </>
      )}

      {conditionType === 'expression' && (
        <div>
          <FieldLabel hint="JavaScript expression that returns true or false">Expression</FieldLabel>
          <Textarea
            value={(data.expression as string) || ''}
            onChange={(e) => onUpdate({ expression: e.target.value })}
            placeholder="data.count > 100 && data.status === 'active'"
            rows={3}
            className="font-mono text-xs"
          />
        </div>
      )}

      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <GitBranch className="w-4 h-4 text-amber-400" />
        <span className="text-xs text-amber-300">
          Branches: <span className="text-green-400">Yes</span> / <span className="text-red-400">No</span>
        </span>
      </div>
    </div>
  );
});

ConditionFields.displayName = 'ConditionFields';

// ============================================================================
// ACTION FIELDS
// ============================================================================

const ActionFields = memo(({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
}) => {
  const selectedActionId = data.actionId as string;
  const selectedAction = ACTION_REGISTRY.find((a) => a.id === selectedActionId);

  // Group actions by category
  const actionsByCategory = ACTION_REGISTRY.reduce((acc, action) => {
    if (!acc[action.category]) acc[action.category] = [];
    acc[action.category].push(action);
    return acc;
  }, {} as Record<string, typeof ACTION_REGISTRY>);

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Select Action</FieldLabel>
        <Select
          value={selectedActionId || ''}
          onChange={(e) => {
            const action = ACTION_REGISTRY.find((a) => a.id === e.target.value);
            onUpdate({
              actionId: e.target.value,
              actionName: action?.name,
              riskLevel: action?.riskLevel,
              requiresApproval: action?.riskLevel === 'high',
              params: {},
            });
          }}
        >
          <option value="">Choose an action...</option>
          {Object.entries(actionsByCategory).map(([category, actions]) => (
            <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
              {actions.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.icon} {action.name}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </div>

      {selectedAction && (
        <>
          <div className="p-3 rounded-lg bg-slate-700/30 border border-slate-600/50">
            <div className="flex items-start gap-2">
              <span className="text-xl">{selectedAction.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{selectedAction.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{selectedAction.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-600/50">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                selectedAction.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' :
                selectedAction.riskLevel === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                {selectedAction.riskLevel} risk
              </span>
              {selectedAction.platform && (
                <span className="text-xs text-slate-500">{selectedAction.platform}</span>
              )}
            </div>
          </div>

          {selectedAction.parameters.length > 0 && (
            <div className="space-y-3">
              <FieldLabel>Parameters</FieldLabel>
              {selectedAction.parameters.map((param) => {
                const currentParams = (data.params as Record<string, unknown>) || {};

                // Handler that clears dependent parameters when a parent changes
                const handleParamChange = (value: unknown) => {
                  const newParams = { ...currentParams, [param.id]: value };

                  // Find and clear all parameters that depend on this one (cascading reset)
                  const clearDependents = (parentId: string) => {
                    selectedAction.parameters.forEach((p) => {
                      if (p.dependsOn === parentId) {
                        newParams[p.id] = undefined;
                        clearDependents(p.id); // Recursively clear nested dependents
                      }
                    });
                  };
                  clearDependents(param.id);

                  onUpdate({ params: newParams });
                };

                return (
                  <ActionParameterField
                    key={param.id}
                    param={param}
                    value={currentParams[param.id]}
                    onChange={handleParamChange}
                    allParams={currentParams}
                  />
                );
              })}
            </div>
          )}

          <Checkbox
            label="Require Approval"
            checked={(data.requiresApproval as boolean) || false}
            onChange={(checked) => onUpdate({ requiresApproval: checked })}
            description="Pause workflow and wait for manual approval"
          />
        </>
      )}
    </div>
  );
});

ActionFields.displayName = 'ActionFields';

// Smart parameter types that use cascading selectors
const SMART_PARAM_TYPES: SmartParameterType[] = ['organization', 'network', 'device', 'client', 'ssid'];

const ActionParameterField = memo(({
  param,
  value,
  onChange,
  allParams,
}: {
  param: ActionParameter;
  value: unknown;
  onChange: (value: unknown) => void;
  allParams: Record<string, unknown>;
}) => {
  // Handle smart parameter types with cascading selectors
  if (SMART_PARAM_TYPES.includes(param.type as SmartParameterType)) {
    return (
      <SmartParameterField
        type={param.type as SmartParameterType}
        value={value as string | undefined}
        onChange={(v) => onChange(v)}
        allParams={allParams}
        label={param.name}
        required={param.required}
      />
    );
  }

  const renderInput = () => {
    switch (param.type) {
      case 'boolean':
        return (
          <Checkbox
            label={param.name}
            checked={Boolean(value)}
            onChange={onChange}
            description={param.description}
          />
        );
      case 'select':
        return (
          <Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select...</option>
            {param.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        );
      case 'number':
        return (
          <Input
            type="number"
            value={(value as number) ?? ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
            min={param.min}
            max={param.max}
            placeholder={param.description}
          />
        );
      case 'text':
        return (
          <Textarea
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={param.description}
            rows={3}
          />
        );
      default:
        return (
          <Input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={param.description}
          />
        );
    }
  };

  if (param.type === 'boolean') {
    return <div>{renderInput()}</div>;
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {param.name}
        {!param.required && <span className="text-slate-600 ml-1">(optional)</span>}
      </label>
      {renderInput()}
    </div>
  );
});

ActionParameterField.displayName = 'ActionParameterField';

// ============================================================================
// AI FIELDS
// ============================================================================

const AIFields = memo(({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
}) => (
  <div className="space-y-4">
    <div>
      <FieldLabel hint="What should the AI analyze or decide?">Prompt</FieldLabel>
      <Textarea
        value={(data.prompt as string) || ''}
        onChange={(e) => onUpdate({ prompt: e.target.value })}
        placeholder="Analyze the network data and determine if there's an anomaly that requires attention..."
        rows={4}
      />
    </div>

    <div>
      <FieldLabel>AI Model</FieldLabel>
      <Select
        value={(data.model as string) || 'claude-sonnet'}
        onChange={(e) => onUpdate({ model: e.target.value })}
      >
        <option value="claude-sonnet">Claude Sonnet (Recommended)</option>
        <option value="claude-opus">Claude Opus (Most Capable)</option>
        <option value="claude-haiku">Claude Haiku (Fastest)</option>
      </Select>
    </div>

    <div>
      <FieldLabel>Output Format</FieldLabel>
      <div className="grid grid-cols-3 gap-2">
        {[
          { value: 'text', label: 'Text' },
          { value: 'json', label: 'JSON' },
          { value: 'decision', label: 'Yes/No' },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onUpdate({ outputFormat: value })}
            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
              (data.outputFormat as string) === value || (!data.outputFormat && value === 'text')
                ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                : 'border-slate-600 bg-slate-900/30 text-slate-400 hover:border-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>

    <Checkbox
      label="Include workflow context"
      checked={(data.includeContext as boolean) ?? true}
      onChange={(checked) => onUpdate({ includeContext: checked })}
      description="Pass trigger data and previous step outputs to AI"
    />

    <div>
      <FieldLabel hint="Minimum confidence level (0-1)">Confidence Threshold</FieldLabel>
      <Input
        type="number"
        value={(data.confidenceThreshold as number) || 0.8}
        onChange={(e) => onUpdate({ confidenceThreshold: parseFloat(e.target.value) || 0.8 })}
        min={0}
        max={1}
        step={0.1}
      />
    </div>
  </div>
));

AIFields.displayName = 'AIFields';

// ============================================================================
// NOTIFY FIELDS
// ============================================================================

const NotifyFields = memo(({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
}) => {
  const channel = (data.channel as string) || 'slack';

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Channel</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'slack', label: 'Slack', icon: Slack },
            { value: 'email', label: 'Email', icon: Mail },
            { value: 'teams', label: 'Teams', icon: MessageCircle },
            { value: 'webex', label: 'Webex', icon: Globe },
            { value: 'pagerduty', label: 'PagerDuty', icon: Bell },
            { value: 'webhook', label: 'Webhook', icon: Globe },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => onUpdate({ channel: value })}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                channel === value
                  ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                  : 'border-slate-600 bg-slate-900/30 text-slate-400 hover:border-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Channel-specific fields */}
      {channel === 'slack' && (
        <div>
          <FieldLabel>Channel/User</FieldLabel>
          <Input
            type="text"
            value={(data.recipients as string) || ''}
            onChange={(e) => onUpdate({ recipients: e.target.value })}
            placeholder="#channel or @user"
          />
        </div>
      )}

      {channel === 'email' && (
        <>
          <div>
            <FieldLabel>Recipients</FieldLabel>
            <Input
              type="text"
              value={(data.recipients as string) || ''}
              onChange={(e) => onUpdate({ recipients: e.target.value })}
              placeholder="email@example.com, another@example.com"
            />
          </div>
          <div>
            <FieldLabel>Subject</FieldLabel>
            <Input
              type="text"
              value={(data.subject as string) || ''}
              onChange={(e) => onUpdate({ subject: e.target.value })}
              placeholder="Alert: {{workflow.name}}"
            />
          </div>
        </>
      )}

      {channel === 'teams' && (
        <div>
          <FieldLabel hint="Incoming Webhook URL from Teams">Webhook URL</FieldLabel>
          <Input
            type="text"
            value={(data.webhookUrl as string) || ''}
            onChange={(e) => onUpdate({ webhookUrl: e.target.value })}
            placeholder="https://outlook.office.com/webhook/..."
          />
        </div>
      )}

      {channel === 'webex' && (
        <div>
          <FieldLabel>Room/Space ID</FieldLabel>
          <Input
            type="text"
            value={(data.roomId as string) || ''}
            onChange={(e) => onUpdate({ roomId: e.target.value })}
            placeholder="Y2lzY29zcGFyazov..."
          />
        </div>
      )}

      {channel === 'pagerduty' && (
        <>
          <div>
            <FieldLabel>Severity</FieldLabel>
            <Select
              value={(data.severity as string) || 'warning'}
              onChange={(e) => onUpdate({ severity: e.target.value })}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </Select>
          </div>
          <div>
            <FieldLabel>Dedup Key (optional)</FieldLabel>
            <Input
              type="text"
              value={(data.dedupKey as string) || ''}
              onChange={(e) => onUpdate({ dedupKey: e.target.value })}
              placeholder="unique-incident-key"
            />
          </div>
        </>
      )}

      {channel === 'webhook' && (
        <>
          <div>
            <FieldLabel>Webhook URL</FieldLabel>
            <Input
              type="text"
              value={(data.webhookUrl as string) || ''}
              onChange={(e) => onUpdate({ webhookUrl: e.target.value })}
              placeholder="https://your-endpoint.com/webhook"
            />
          </div>
          <div>
            <FieldLabel>HTTP Method</FieldLabel>
            <Select
              value={(data.method as string) || 'POST'}
              onChange={(e) => onUpdate({ method: e.target.value })}
            >
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
            </Select>
          </div>
        </>
      )}

      <div>
        <FieldLabel hint="Use {{variable}} for dynamic content">Message</FieldLabel>
        <Textarea
          value={(data.message as string) || ''}
          onChange={(e) => onUpdate({ message: e.target.value })}
          placeholder="Alert: {{workflow.name}} triggered at {{time}}"
          rows={4}
        />
      </div>

      {channel !== 'pagerduty' && (
        <div>
          <FieldLabel>Priority</FieldLabel>
          <Select
            value={(data.priority as string) || 'normal'}
            onChange={(e) => onUpdate({ priority: e.target.value })}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High (Urgent)</option>
          </Select>
        </div>
      )}
    </div>
  );
});

NotifyFields.displayName = 'NotifyFields';

// ============================================================================
// DELAY FIELDS
// ============================================================================

const DelayFields = memo(({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
}) => {
  const delayType = (data.delayType as string) || 'fixed';

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Delay Type</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'fixed', label: 'Fixed Duration' },
            { value: 'until', label: 'Until Time' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onUpdate({ delayType: value })}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                delayType === value
                  ? 'border-slate-400 bg-slate-700/50 text-white'
                  : 'border-slate-600 bg-slate-900/30 text-slate-400 hover:border-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {delayType === 'fixed' && (
        <div>
          <FieldLabel>Wait Duration</FieldLabel>
          <div className="flex gap-2">
            <Input
              type="number"
              value={(data.duration as number) || ''}
              onChange={(e) => onUpdate({ duration: parseInt(e.target.value) || undefined })}
              placeholder="5"
              min={1}
              className="w-24"
            />
            <Select
              value={(data.durationUnit as string) || 'minutes'}
              onChange={(e) => onUpdate({ durationUnit: e.target.value })}
              className="flex-1"
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </Select>
          </div>
        </div>
      )}

      {delayType === 'until' && (
        <div>
          <FieldLabel>Wait Until</FieldLabel>
          <Input
            type="time"
            value={(data.untilTime as string) || ''}
            onChange={(e) => onUpdate({ untilTime: e.target.value })}
          />
        </div>
      )}
    </div>
  );
});

DelayFields.displayName = 'DelayFields';

// ============================================================================
// LOOP FIELDS
// ============================================================================

const LoopFields = memo(({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
}) => {
  const loopType = (data.loopType as string) || 'foreach';

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Loop Type</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'foreach', label: 'For Each Item' },
            { value: 'while', label: 'While Condition' },
            { value: 'count', label: 'Fixed Count' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onUpdate({ loopType: value })}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                loopType === value
                  ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                  : 'border-slate-600 bg-slate-900/30 text-slate-400 hover:border-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loopType === 'foreach' && (
        <div>
          <FieldLabel hint="Array or object to iterate over">Source Data</FieldLabel>
          <Input
            type="text"
            value={(data.sourceData as string) || ''}
            onChange={(e) => onUpdate({ sourceData: e.target.value })}
            placeholder="{{trigger.data.items}}"
            className="font-mono"
          />
        </div>
      )}

      {loopType === 'while' && (
        <div>
          <FieldLabel hint="Continue while this expression is true">Condition</FieldLabel>
          <Input
            type="text"
            value={(data.whileCondition as string) || ''}
            onChange={(e) => onUpdate({ whileCondition: e.target.value })}
            placeholder="{{item.status}} !== 'complete'"
            className="font-mono"
          />
        </div>
      )}

      {loopType === 'count' && (
        <div>
          <FieldLabel>Iterations</FieldLabel>
          <Input
            type="number"
            value={(data.iterationCount as number) || ''}
            onChange={(e) => onUpdate({ iterationCount: parseInt(e.target.value) || undefined })}
            placeholder="10"
            min={1}
            max={1000}
          />
        </div>
      )}

      <div>
        <FieldLabel>Max Iterations (Safety Limit)</FieldLabel>
        <Input
          type="number"
          value={(data.maxIterations as number) || 100}
          onChange={(e) => onUpdate({ maxIterations: parseInt(e.target.value) || 100 })}
          min={1}
          max={10000}
        />
      </div>

      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
        <Repeat className="w-4 h-4 text-orange-400" />
        <span className="text-xs text-orange-300">
          Branches: <span className="text-orange-400">Loop Body</span> / <span className="text-green-400">Done</span>
        </span>
      </div>
    </div>
  );
});

LoopFields.displayName = 'LoopFields';

// ============================================================================
// APPROVAL FIELDS
// ============================================================================

const ApprovalFields = memo(({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
}) => (
  <div className="space-y-4">
    <div>
      <FieldLabel>Approvers</FieldLabel>
      <Input
        type="text"
        value={(data.approvers as string) || ''}
        onChange={(e) => onUpdate({ approvers: e.target.value })}
        placeholder="user@example.com, team@example.com"
      />
      <p className="text-xs text-slate-500 mt-1">Comma-separated email addresses</p>
    </div>

    <div>
      <FieldLabel>Approval Mode</FieldLabel>
      <Select
        value={(data.approvalMode as string) || 'any'}
        onChange={(e) => onUpdate({ approvalMode: e.target.value })}
      >
        <option value="any">Any approver</option>
        <option value="all">All approvers</option>
        <option value="majority">Majority (50%+)</option>
      </Select>
    </div>

    <div>
      <FieldLabel hint="Optional message shown to approvers">Request Message</FieldLabel>
      <Textarea
        value={(data.requestMessage as string) || ''}
        onChange={(e) => onUpdate({ requestMessage: e.target.value })}
        placeholder="Please review and approve this workflow action..."
        rows={3}
      />
    </div>

    <div>
      <FieldLabel>Timeout Action</FieldLabel>
      <Select
        value={(data.timeoutAction as string) || 'reject'}
        onChange={(e) => onUpdate({ timeoutAction: e.target.value })}
      >
        <option value="reject">Reject on timeout</option>
        <option value="approve">Auto-approve on timeout</option>
        <option value="escalate">Escalate to manager</option>
      </Select>
    </div>

    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
      <Hand className="w-4 h-4 text-orange-400" />
      <span className="text-xs text-orange-300">
        Branches: <span className="text-green-400">Approved</span> / <span className="text-red-400">Rejected</span>
      </span>
    </div>
  </div>
));

ApprovalFields.displayName = 'ApprovalFields';

// ============================================================================
// SUBWORKFLOW FIELDS
// ============================================================================

interface WorkflowOption {
  id: number;
  name: string;
  description?: string;
  status: string;
}

const SubworkflowFields = memo(({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
}) => {
  const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/workflows', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to load workflows');
        }
        const workflowList = await response.json();
        console.log('[SubworkflowFields] Fetched workflows:', workflowList);
        // Exclude the current workflow if editing (to prevent recursive references)
        const currentWorkflowId = data.currentWorkflowId as number | undefined;
        const filtered = workflowList.filter((w: WorkflowOption) =>
          w.id !== currentWorkflowId
        );
        console.log('[SubworkflowFields] Filtered workflows:', filtered);
        setWorkflows(filtered);
      } catch (err) {
        console.error('Error fetching workflows:', err);
        setError(err instanceof Error ? err.message : 'Failed to load workflows');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, [data.currentWorkflowId]);

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Workflow to Run</FieldLabel>
        <Select
          value={(data.workflowId as string) || ''}
          onChange={(e) => {
            const selectedWorkflow = workflows.find(w => w.id.toString() === e.target.value);
            onUpdate({
              workflowId: e.target.value,
              workflowName: selectedWorkflow?.name || ''
            });
          }}
          disabled={loading}
        >
          <option value="">
            {loading ? 'Loading workflows...' : 'Select a workflow...'}
          </option>
          {error && <option value="" disabled>Error: {error}</option>}
          {workflows.map((workflow) => (
            <option key={workflow.id} value={workflow.id.toString()}>
              {workflow.name} {workflow.status !== 'active' ? `(${workflow.status})` : ''}
            </option>
          ))}
        </Select>
        {workflows.length === 0 && !loading && !error && (
          <p className="text-xs text-slate-500 mt-1">
            No other workflows available
          </p>
        )}
      </div>

      <Checkbox
        label="Wait for completion"
        checked={(data.waitForCompletion as boolean) ?? true}
        onChange={(checked) => onUpdate({ waitForCompletion: checked })}
        description="Pause until the sub-workflow finishes"
      />

      <Checkbox
        label="Pass current context"
        checked={(data.passContext as boolean) ?? true}
        onChange={(checked) => onUpdate({ passContext: checked })}
        description="Share trigger data with sub-workflow"
      />
    </div>
  );
});

SubworkflowFields.displayName = 'SubworkflowFields';

// ============================================================================
// COMMENT FIELDS
// ============================================================================

const CommentFields = memo(({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
}) => (
  <div className="space-y-4">
    <div>
      <FieldLabel>Comment</FieldLabel>
      <Textarea
        value={(data.comment as string) || ''}
        onChange={(e) => onUpdate({ comment: e.target.value, label: e.target.value.slice(0, 50) })}
        placeholder="Add notes or documentation..."
        rows={4}
      />
    </div>
    <div>
      <FieldLabel>Color</FieldLabel>
      <div className="flex gap-2">
        {['slate', 'blue', 'green', 'amber', 'red'].map((color) => (
          <button
            key={color}
            onClick={() => onUpdate({ commentColor: color })}
            className={`w-8 h-8 rounded-lg border-2 transition-all ${
              (data.commentColor as string) === color || (!data.commentColor && color === 'slate')
                ? 'border-white scale-110'
                : 'border-transparent'
            }`}
            style={{ backgroundColor: `var(--color-${color}-500, #64748b)` }}
          />
        ))}
      </div>
    </div>
  </div>
));

CommentFields.displayName = 'CommentFields';

// ============================================================================
// Utilities
// ============================================================================

const NodeIcon = ({ type }: { type: CanvasNodeType }) => {
  const icons: Record<CanvasNodeType, typeof Zap> = {
    trigger: Zap,
    condition: GitBranch,
    ai: Brain,
    action: Wrench,
    notify: Bell,
    approval: Hand,
    loop: Repeat,
    delay: Clock,
    subworkflow: FileText,
    comment: Info,
  };

  const colors: Record<CanvasNodeType, string> = {
    trigger: 'bg-emerald-500/20 text-emerald-400',
    condition: 'bg-amber-500/20 text-amber-400',
    ai: 'bg-purple-500/20 text-purple-400',
    action: 'bg-cyan-500/20 text-cyan-400',
    notify: 'bg-blue-500/20 text-blue-400',
    approval: 'bg-orange-500/20 text-orange-400',
    loop: 'bg-orange-500/20 text-orange-400',
    delay: 'bg-slate-500/20 text-slate-400',
    subworkflow: 'bg-indigo-500/20 text-indigo-400',
    comment: 'bg-slate-500/20 text-slate-400',
  };

  const Icon = icons[type] || Settings;
  return (
    <div className={`p-2 rounded-lg ${colors[type] || 'bg-slate-500/20 text-slate-400'}`}>
      <Icon className="w-5 h-5" />
    </div>
  );
};

const getNodeTypeName = (type: CanvasNodeType): string => {
  const names: Record<CanvasNodeType, string> = {
    trigger: 'Trigger',
    condition: 'Condition',
    ai: 'AI Decision',
    action: 'Action',
    notify: 'Notification',
    approval: 'Approval Gate',
    loop: 'Loop',
    delay: 'Delay',
    subworkflow: 'Sub-workflow',
    comment: 'Comment',
  };
  return names[type] || 'Node';
};

const getDefaultPlaceholder = (type: CanvasNodeType): string => {
  const placeholders: Record<CanvasNodeType, string> = {
    trigger: 'Start workflow when...',
    condition: 'Check if...',
    ai: 'AI analyzes...',
    action: 'Execute action',
    notify: 'Send notification to...',
    approval: 'Wait for approval from...',
    loop: 'For each item in...',
    delay: 'Wait for...',
    subworkflow: 'Run workflow...',
    comment: 'Add a note...',
  };
  return placeholders[type] || 'Enter label...';
};

export default PropertiesPanel;
