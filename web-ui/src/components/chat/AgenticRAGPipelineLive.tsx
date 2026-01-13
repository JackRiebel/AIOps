'use client';

import React from 'react';
import {
  Search,
  FileText,
  RefreshCw,
  Sparkles,
  Globe,
  Brain,
  Zap,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { PipelineState } from '@/hooks/useRAGPipelineSocket';

interface AgenticRAGPipelineLiveProps {
  pipelineState: PipelineState;
  className?: string;
}

// Pipeline stage configuration
const PIPELINE_STAGES = [
  {
    key: 'QueryAnalysisAgent',
    name: 'Query Analysis',
    icon: Search,
    description: 'Decomposing query',
    color: 'cyan',
  },
  {
    key: 'RetrievalRouterAgent',
    name: 'Router',
    icon: Zap,
    description: 'Selecting strategy',
    color: 'blue',
  },
  {
    key: 'DocumentGraderAgent',
    name: 'Grading',
    icon: FileText,
    description: 'Evaluating docs',
    color: 'purple',
  },
  {
    key: 'CorrectiveRAGAgent',
    name: 'Corrective',
    icon: RefreshCw,
    description: 'Checking coverage',
    color: 'amber',
  },
  {
    key: 'SynthesisAgent',
    name: 'Synthesis',
    icon: Sparkles,
    description: 'Generating answer',
    color: 'green',
  },
  {
    key: 'ReflectionAgent',
    name: 'Reflection',
    icon: Brain,
    description: 'Quality check',
    color: 'pink',
  },
];

const colorClasses: Record<string, { bg: string; text: string; border: string; icon: string; pulse: string }> = {
  cyan: {
    bg: 'bg-cyan-50 dark:bg-cyan-500/10',
    text: 'text-cyan-700 dark:text-cyan-400',
    border: 'border-cyan-300 dark:border-cyan-500/50',
    icon: 'text-cyan-500',
    pulse: 'ring-cyan-400',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-500/50',
    icon: 'text-blue-500',
    pulse: 'ring-blue-400',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-300 dark:border-purple-500/50',
    icon: 'text-purple-500',
    pulse: 'ring-purple-400',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-500/50',
    icon: 'text-amber-500',
    pulse: 'ring-amber-400',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-500/10',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-300 dark:border-green-500/50',
    icon: 'text-green-500',
    pulse: 'ring-green-400',
  },
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-500/10',
    text: 'text-pink-700 dark:text-pink-400',
    border: 'border-pink-300 dark:border-pink-500/50',
    icon: 'text-pink-500',
    pulse: 'ring-pink-400',
  },
};

export function AgenticRAGPipelineLive({ pipelineState, className = '' }: AgenticRAGPipelineLiveProps) {
  const {
    currentAgent,
    completedAgents,
    iteration,
    quality,
    totalDurationMs,
    error,
  } = pipelineState;

  const completedSet = new Set(completedAgents);
  const isComplete = totalDurationMs !== null && !error;
  const hasError = error !== null;

  // Calculate progress percentage
  const progressPercent = Math.round((completedAgents.length / PIPELINE_STAGES.length) * 100);

  return (
    <div className={`rounded-lg border border-purple-200 dark:border-purple-500/20 overflow-hidden ${className}`}>
      {/* Header with Progress Bar */}
      <div className="relative">
        <div className="flex items-center justify-between p-2 bg-gradient-to-r from-purple-50 to-cyan-50 dark:from-purple-500/10 dark:to-cyan-500/10">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-purple-100 dark:bg-purple-500/20">
              {hasError ? (
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              ) : isComplete ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Loader2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 animate-spin" />
              )}
            </div>
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
              {hasError ? 'Pipeline Error' : isComplete ? 'Pipeline Complete' : 'Processing...'}
            </span>
            {iteration > 0 && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Iteration {iteration}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {totalDurationMs && (
              <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <Clock className="w-3 h-3" />
                {totalDurationMs}ms
              </span>
            )}
            {quality && (
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                quality === 'EXCELLENT' || quality === 'GOOD'
                  ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                  : quality === 'NEEDS_ITERATION'
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                  : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
              }`}>
                {quality}
              </span>
            )}
            <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-0.5 bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-full transition-all duration-300 ${
              hasError
                ? 'bg-red-500'
                : isComplete
                ? 'bg-green-500'
                : 'bg-gradient-to-r from-purple-500 to-cyan-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Error Message */}
      {hasError && (
        <div className="p-2 bg-red-50 dark:bg-red-500/10 border-t border-red-200 dark:border-red-500/20">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Pipeline Stages */}
      <div className="p-2 bg-slate-50 dark:bg-slate-800/30">
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {PIPELINE_STAGES.map((stage, index) => {
            const isActive = currentAgent === stage.key;
            const isCompleted = completedSet.has(stage.key);
            const isPending = !isActive && !isCompleted;
            const colors = colorClasses[stage.color];
            const Icon = stage.icon;

            return (
              <React.Fragment key={stage.key}>
                {/* Stage Node */}
                <div
                  className={`flex-shrink-0 flex flex-col items-center gap-0.5 p-1.5 rounded-md transition-all ${
                    isActive
                      ? `${colors.bg} ${colors.border} border ring-2 ring-offset-1 ${colors.pulse} ring-opacity-50`
                      : isCompleted
                      ? `${colors.bg} ${colors.border} border`
                      : 'bg-slate-100 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 opacity-40'
                  }`}
                  title={stage.description}
                >
                  <div className={`p-1 rounded ${isActive || isCompleted ? colors.bg : 'bg-slate-200 dark:bg-slate-600'}`}>
                    {isActive ? (
                      <Loader2 className={`w-3 h-3 ${colors.icon} animate-spin`} />
                    ) : (
                      <Icon className={`w-3 h-3 ${isCompleted ? colors.icon : 'text-slate-400'}`} />
                    )}
                  </div>
                  <span className={`text-[8px] font-medium whitespace-nowrap ${
                    isActive || isCompleted ? colors.text : 'text-slate-400'
                  }`}>
                    {stage.name}
                  </span>
                </div>

                {/* Connector */}
                {index < PIPELINE_STAGES.length - 1 && (
                  <div className={`flex-shrink-0 w-2 h-0.5 ${
                    isCompleted && (completedSet.has(PIPELINE_STAGES[index + 1]?.key) || currentAgent === PIPELINE_STAGES[index + 1]?.key)
                      ? 'bg-gradient-to-r from-cyan-400 to-purple-400'
                      : 'bg-slate-200 dark:bg-slate-600'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Current Activity */}
      {currentAgent && !hasError && (
        <div className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700/30">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[10px] text-slate-600 dark:text-slate-400">
              {PIPELINE_STAGES.find(s => s.key === currentAgent)?.description || 'Processing...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgenticRAGPipelineLive;
