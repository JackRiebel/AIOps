'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  Clock,
  ArrowRight,
  Database,
  Eye,
  Network,
  Server,
  Palette,
  Layers,
} from 'lucide-react';
import type { ConversationTurn, RoutingDecision, SpecialistAgentId } from '@/types/agent-flow';
import { SPECIALIST_AGENTS } from '@/types/agent-flow';

export interface TurnTimelineProps {
  turns: ConversationTurn[];
  currentTurn: number;
  routingDecision?: RoutingDecision;
  isParallelExecution: boolean;
  isSynthesizing: boolean;
  isExpanded?: boolean;
  className?: string;
}

// Specialist agent icons
const specialistIcons: Record<string, React.ReactNode> = {
  'meraki-agent': <Network className="w-4 h-4" />,
  'thousandeyes-agent': <Eye className="w-4 h-4" />,
  'catalyst-agent': <Server className="w-4 h-4" />,
  'splunk-agent': <Database className="w-4 h-4" />,
  'ui-agent': <Palette className="w-4 h-4" />,
};

// Status icons
const statusIcons: Record<ConversationTurn['status'], React.ReactNode> = {
  pending: <Circle className="w-4 h-4 text-slate-400" />,
  active: <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function getAgentColor(agentId: string): string {
  const specialistAgent = SPECIALIST_AGENTS[agentId as SpecialistAgentId];
  if (specialistAgent) {
    return specialistAgent.color;
  }
  return '#6366f1'; // Default indigo
}

function getAgentName(agentId: string, agentName?: string): string {
  if (agentName) return agentName;
  const specialistAgent = SPECIALIST_AGENTS[agentId as SpecialistAgentId];
  if (specialistAgent) {
    return specialistAgent.shortName;
  }
  return agentId;
}

export function TurnTimeline({
  turns,
  currentTurn,
  routingDecision,
  isParallelExecution,
  isSynthesizing,
  isExpanded: defaultExpanded = true,
  className = '',
}: TurnTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Calculate summary stats
  const stats = useMemo(() => {
    const completed = turns.filter((t) => t.status === 'completed').length;
    const totalDuration = turns.reduce((acc, t) => acc + (t.durationMs || 0), 0);
    const hasErrors = turns.some((t) => t.status === 'error');
    const isRunning = turns.some((t) => t.status === 'active');

    return { completed, total: turns.length, totalDuration, hasErrors, isRunning };
  }, [turns]);

  if (turns.length === 0 && !routingDecision) {
    return null;
  }

  return (
    <div className={`rounded-lg border border-slate-200 dark:border-slate-700/50 overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-md ${
            stats.hasErrors
              ? 'bg-red-100 dark:bg-red-500/20'
              : stats.isRunning || isSynthesizing
                ? 'bg-cyan-100 dark:bg-cyan-500/20'
                : 'bg-green-100 dark:bg-green-500/20'
          }`}>
            {stats.hasErrors ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : stats.isRunning || isSynthesizing ? (
              <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Multi-Agent Conversation
              {isParallelExecution && (
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
                  Parallel
                </span>
              )}
              {isSynthesizing && (
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  Synthesizing
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {stats.completed}/{stats.total} turns
              {stats.totalDuration > 0 && ` • ${formatDuration(stats.totalDuration)}`}
              {routingDecision && ` • ${routingDecision.confidence.toFixed(0)}% confidence`}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Timeline Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 bg-white dark:bg-slate-800/30">
              {/* Routing Decision */}
              {routingDecision && (
                <div className="mb-4 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                      Orchestrator Routing
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-600 dark:text-slate-400">Primary:</span>
                    <span
                      className="px-2 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: `${getAgentColor(routingDecision.primaryAgent)}20`,
                        color: getAgentColor(routingDecision.primaryAgent),
                      }}
                    >
                      {routingDecision.primaryAgentName}
                    </span>
                    {routingDecision.secondaryAgents.length > 0 && (
                      <>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        {routingDecision.secondaryAgents.map((agentId) => (
                          <span
                            key={agentId}
                            className="px-2 py-0.5 rounded font-medium"
                            style={{
                              backgroundColor: `${getAgentColor(agentId)}20`,
                              color: getAgentColor(agentId),
                            }}
                          >
                            {getAgentName(agentId)}
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                  {routingDecision.reasoning && (
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {routingDecision.reasoning}
                    </p>
                  )}
                </div>
              )}

              {/* Turn Timeline */}
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />

                {/* Turns */}
                <div className="space-y-3">
                  {turns.map((turn, index) => (
                    <TurnItem key={turn.turnId} turn={turn} isLast={index === turns.length - 1} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface TurnItemProps {
  turn: ConversationTurn;
  isLast: boolean;
}

function TurnItem({ turn, isLast }: TurnItemProps) {
  const [showDetails, setShowDetails] = useState(false);
  const agentColor = getAgentColor(turn.agentId);
  const agentIcon = specialistIcons[turn.agentId] || <Server className="w-4 h-4" />;

  return (
    <div className="relative pl-6">
      {/* Status indicator */}
      <div className="absolute left-0 top-0.5 bg-white dark:bg-slate-800">
        {statusIcons[turn.status]}
      </div>

      {/* Turn content */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Turn number badge */}
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
            {turn.turnNumber}
          </span>

          {/* Agent badge */}
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: `${agentColor}20`,
              color: agentColor,
            }}
          >
            {agentIcon}
            {turn.agentName || getAgentName(turn.agentId)}
          </span>

          {/* Turn type */}
          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-medium ${
            turn.turnType === 'synthesis'
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
              : turn.turnType === 'follow_up'
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
          }`}>
            {turn.turnType.replace('_', ' ')}
          </span>

          {/* Duration */}
          {turn.durationMs !== undefined && (
            <span className="flex items-center gap-0.5 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              {formatDuration(turn.durationMs)}
            </span>
          )}
        </div>

        {/* Query */}
        {turn.query && (
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
            {turn.query}
          </p>
        )}

        {/* Response preview */}
        {turn.response && turn.status === 'completed' && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500 line-clamp-1 italic">
            {turn.response}
          </p>
        )}

        {/* Error */}
        {turn.error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            Error: {turn.error}
          </p>
        )}

        {/* Stats row */}
        {turn.status === 'completed' && (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {turn.artifactsCount !== undefined && turn.artifactsCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                {turn.artifactsCount} artifacts
              </span>
            )}
            {turn.entitiesExtracted && turn.entitiesExtracted.length > 0 && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="px-1.5 py-0.5 text-[10px] rounded bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50"
              >
                {turn.entitiesExtracted.length} entities {showDetails ? '▲' : '▼'}
              </button>
            )}
          </div>
        )}

        {/* Expanded entities */}
        <AnimatePresence>
          {showDetails && turn.entitiesExtracted && turn.entitiesExtracted.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2 flex flex-wrap gap-1"
            >
              {turn.entitiesExtracted.map((entity, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
                >
                  {entity}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default TurnTimeline;
