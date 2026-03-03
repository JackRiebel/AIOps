'use client';

import { memo, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle, XCircle, Shield, ChevronDown, ChevronRight, Copy, Check, Wrench } from 'lucide-react';
import type { MCPTool } from '@/types/mcp-monitor';

// ============================================================================
// Types
// ============================================================================

export interface MCPToolGridProps {
  tools: MCPTool[];
}

// ============================================================================
// Helpers
// ============================================================================

function validationIcon(status: MCPTool['validation_status']) {
  switch (status) {
    case 'valid':
      return { icon: CheckCircle2, color: 'text-emerald-500 dark:text-emerald-400' };
    case 'degraded':
      return { icon: AlertTriangle, color: 'text-amber-500 dark:text-amber-400' };
    case 'failed':
      return { icon: XCircle, color: 'text-red-500 dark:text-red-400' };
    default:
      return { icon: HelpCircle, color: 'text-slate-400 dark:text-slate-500' };
  }
}

// ============================================================================
// Compact Tool Row (expandable)
// ============================================================================

const ToolRow = memo(({ tool }: { tool: MCPTool }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const config = validationIcon(tool.validation_status);
  const StatusIcon = config.icon;

  const schema = tool.input_schema || {};
  const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
  const requiredProps = (schema.required || []) as string[];
  const propNames = Object.keys(properties);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(tool.name).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [tool.name]);

  return (
    <div className={`border-b border-slate-100 dark:border-slate-700/30 last:border-b-0 ${expanded ? 'bg-slate-50/50 dark:bg-slate-800/40' : ''}`}>
      {/* Compact row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
        }
        <StatusIcon className={`w-3 h-3 flex-shrink-0 ${config.color}`} />
        <span className="text-[11px] font-mono font-medium text-slate-800 dark:text-slate-200 truncate flex-1 min-w-0">
          {tool.name}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {tool.is_sensitive && (
            <span title="Sensitive"><Shield className="w-3 h-3 text-red-400 dark:text-red-500" /></span>
          )}
          {propNames.length > 0 && (
            <span className="text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/50 px-1 py-0.5 rounded font-mono">
              {propNames.length}p
            </span>
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-2.5 pl-8 space-y-2">
          {/* Description */}
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-h-24 overflow-y-auto">
            {tool.description || 'No description'}
          </p>

          {/* Parameters */}
          {propNames.length > 0 && (
            <div className="rounded-md bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/30 px-2 py-1.5 max-h-32 overflow-y-auto">
              {propNames.map((pName) => {
                const prop = properties[pName];
                const isReq = requiredProps.includes(pName);
                return (
                  <div key={pName} className="flex items-center gap-1.5 py-0.5 text-[10px]">
                    <code className="font-mono font-semibold text-cyan-700 dark:text-cyan-400">{pName}</code>
                    {isReq && <span className="text-red-500 font-bold">*</span>}
                    <span className="font-mono text-violet-500 dark:text-violet-400">{(prop.type as string) || 'any'}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition"
          >
            {copied
              ? <><Check className="w-3 h-3 text-emerald-500" /> Copied</>
              : <><Copy className="w-3 h-3" /> Copy name</>
            }
          </button>
        </div>
      )}
    </div>
  );
});
ToolRow.displayName = 'ToolRow';

// ============================================================================
// MCPToolGrid Component
// ============================================================================

export const MCPToolGrid = memo(({ tools }: MCPToolGridProps) => {
  const [showAll, setShowAll] = useState(false);

  const { sensitive, normal } = useMemo(() => {
    const s: MCPTool[] = [];
    const n: MCPTool[] = [];
    for (const t of tools) {
      if (t.is_sensitive) s.push(t);
      else n.push(t);
    }
    return { sensitive: s, normal: n };
  }, [tools]);

  if (tools.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
        <div className="flex flex-col items-center justify-center py-3">
          <HelpCircle className="w-6 h-6 text-slate-300 dark:text-slate-600 mb-1" />
          <p className="text-[12px] text-slate-500 dark:text-slate-400">No tools discovered</p>
        </div>
      </div>
    );
  }

  const COLLAPSED_LIMIT = 5;
  const displayTools = showAll ? tools : tools.slice(0, COLLAPSED_LIMIT);
  const hasMore = tools.length > COLLAPSED_LIMIT;

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-200/60 dark:border-slate-700/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Discovered Tools
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {sensitive.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-red-500 dark:text-red-400">
              <Shield className="w-3 h-3" />
              {sensitive.length} sensitive
            </span>
          )}
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{tools.length} total</span>
        </div>
      </div>

      {/* Tool list */}
      <div className={`${showAll ? 'max-h-[280px]' : ''} overflow-y-auto`}>
        {displayTools.map((tool) => (
          <ToolRow key={tool.name} tool={tool} />
        ))}
      </div>

      {/* Show more/less */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="w-full px-3 py-2 text-[11px] text-cyan-600 dark:text-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-800/30 flex items-center justify-center gap-1 border-t border-slate-200/60 dark:border-slate-700/40 font-medium"
        >
          {showAll ? (
            <><ChevronDown className="w-3 h-3" /> Show fewer</>
          ) : (
            <><ChevronRight className="w-3 h-3" /> Show all {tools.length} tools</>
          )}
        </button>
      )}
    </div>
  );
});

MCPToolGrid.displayName = 'MCPToolGrid';

export default MCPToolGrid;
