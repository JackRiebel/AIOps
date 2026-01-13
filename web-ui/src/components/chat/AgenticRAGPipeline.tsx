'use client';

import React, { useState } from 'react';
import {
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  Globe,
  Brain,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
} from 'lucide-react';

export interface AgenticRAGMetrics {
  enabled: boolean;
  iterations: number;
  agents_used: string[];
  query_type?: string;
  quality?: string;
  latency_ms?: number;
  web_search_used?: boolean;
}

interface AgenticRAGPipelineProps {
  metrics: AgenticRAGMetrics;
  className?: string;
}

// Pipeline stage configuration
const PIPELINE_STAGES = [
  {
    key: 'QueryAnalysisAgent',
    name: 'Query Analysis',
    icon: Search,
    description: 'Decomposing query into sub-questions',
    color: 'cyan',
  },
  {
    key: 'RetrievalRouterAgent',
    name: 'Retrieval Router',
    icon: Zap,
    description: 'Selecting optimal retrieval strategy',
    color: 'blue',
  },
  {
    key: 'DocumentGraderAgent',
    name: 'Document Grading',
    icon: FileText,
    description: 'Evaluating document relevance',
    color: 'purple',
  },
  {
    key: 'CorrectiveRAGAgent',
    name: 'Corrective RAG',
    icon: RefreshCw,
    description: 'Checking KB coverage, web fallback',
    color: 'amber',
  },
  {
    key: 'SynthesisAgent',
    name: 'Synthesis',
    icon: Sparkles,
    description: 'Generating cited answer',
    color: 'green',
  },
  {
    key: 'ReflectionAgent',
    name: 'Reflection',
    icon: Brain,
    description: 'Self-evaluating quality',
    color: 'pink',
  },
];

const colorClasses: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  cyan: {
    bg: 'bg-cyan-50 dark:bg-cyan-500/10',
    text: 'text-cyan-700 dark:text-cyan-400',
    border: 'border-cyan-200 dark:border-cyan-500/30',
    icon: 'text-cyan-500',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-500/30',
    icon: 'text-blue-500',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-500/30',
    icon: 'text-purple-500',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-500/30',
    icon: 'text-amber-500',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-500/10',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-500/30',
    icon: 'text-green-500',
  },
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-500/10',
    text: 'text-pink-700 dark:text-pink-400',
    border: 'border-pink-200 dark:border-pink-500/30',
    icon: 'text-pink-500',
  },
};

export function AgenticRAGPipeline({ metrics, className = '' }: AgenticRAGPipelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!metrics?.enabled) {
    return null;
  }

  const agentsUsed = new Set(metrics.agents_used || []);

  // Quality badge styling
  const qualityStyles: Record<string, string> = {
    EXCELLENT: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
    GOOD: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400',
    NEEDS_ITERATION: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
    INSUFFICIENT_KB: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  };

  return (
    <div className={`mt-3 ${className}`}>
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-purple-50 to-cyan-50 dark:from-purple-500/10 dark:to-cyan-500/10 border border-purple-200 dark:border-purple-500/20 hover:border-purple-300 dark:hover:border-purple-500/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-purple-100 dark:bg-purple-500/20">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          </div>
          <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
            Agentic RAG Pipeline
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {agentsUsed.size} agents • {metrics.iterations} iteration{metrics.iterations !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {metrics.latency_ms && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
              <Clock className="w-3 h-3" />
              {metrics.latency_ms}ms
            </span>
          )}
          {metrics.quality && (
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${qualityStyles[metrics.quality] || 'bg-slate-100 text-slate-600'}`}>
              {metrics.quality}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Pipeline View */}
      {isExpanded && (
        <div className="mt-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/30">
          {/* Pipeline Flow */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage, index) => {
              const isUsed = agentsUsed.has(stage.key);
              const colors = colorClasses[stage.color];
              const Icon = stage.icon;

              return (
                <React.Fragment key={stage.key}>
                  {/* Stage Node */}
                  <div
                    className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                      isUsed
                        ? `${colors.bg} ${colors.border} border`
                        : 'bg-slate-100 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 opacity-40'
                    }`}
                    title={stage.description}
                  >
                    <div className={`p-1.5 rounded-md ${isUsed ? colors.bg : 'bg-slate-200 dark:bg-slate-600'}`}>
                      <Icon className={`w-3.5 h-3.5 ${isUsed ? colors.icon : 'text-slate-400'}`} />
                    </div>
                    <span className={`text-[9px] font-medium whitespace-nowrap ${isUsed ? colors.text : 'text-slate-400'}`}>
                      {stage.name}
                    </span>
                    {isUsed && (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    )}
                  </div>

                  {/* Connector Arrow */}
                  {index < PIPELINE_STAGES.length - 1 && (
                    <div className={`flex-shrink-0 w-4 h-0.5 ${
                      isUsed && agentsUsed.has(PIPELINE_STAGES[index + 1]?.key)
                        ? 'bg-gradient-to-r from-cyan-400 to-purple-400'
                        : 'bg-slate-200 dark:bg-slate-600'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Additional Info */}
          <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700/30 flex flex-wrap gap-2">
            {metrics.query_type && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700/50">
                <Zap className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] text-slate-600 dark:text-slate-400">
                  Query: <span className="font-medium">{metrics.query_type}</span>
                </span>
              </div>
            )}
            {metrics.iterations > 1 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700/50">
                <RefreshCw className="w-3 h-3 text-blue-500" />
                <span className="text-[10px] text-slate-600 dark:text-slate-400">
                  Refined in {metrics.iterations} iterations
                </span>
              </div>
            )}
            {metrics.web_search_used && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-500/10">
                <Globe className="w-3 h-3 text-blue-500" />
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                  Web search augmented
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AgenticRAGPipeline;
