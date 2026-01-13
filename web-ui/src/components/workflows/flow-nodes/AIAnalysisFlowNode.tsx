'use client';

import { memo } from 'react';
import { Brain, Zap } from 'lucide-react';
import type { RiskLevel } from '../types';

interface AIAnalysisFlowNodeProps {
  data: {
    enabled: boolean;
    confidenceThreshold: number;
    prompt?: string;
    autoExecuteEnabled?: boolean;
    autoExecuteMinConfidence?: number;
    autoExecuteMaxRisk?: RiskLevel;
  };
}

/**
 * AIAnalysisFlowNode - Shows AI analysis configuration
 * Purple accent color, displays confidence threshold and auto-execute settings
 */
export const AIAnalysisFlowNode = memo(({ data }: AIAnalysisFlowNodeProps) => {
  const {
    confidenceThreshold,
    prompt,
    autoExecuteEnabled,
    autoExecuteMinConfidence,
    autoExecuteMaxRisk,
  } = data;

  const confidencePercent = Math.round((confidenceThreshold || 0.8) * 100);
  const autoExecPercent = Math.round((autoExecuteMinConfidence || 0.9) * 100);

  return (
    <div className="
      w-[160px] p-3 rounded-lg
      bg-purple-50 dark:bg-purple-900/30
      border-2 border-purple-400 dark:border-purple-600
      shadow-sm hover:shadow-md transition-shadow
    ">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-800/50 text-purple-600 dark:text-purple-400">
          <Brain className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
          AI Analysis
        </span>
      </div>

      {/* Content */}
      <div className="space-y-2">
        {/* Confidence Threshold */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-purple-600 dark:text-purple-400 mb-1">
            <span>Confidence</span>
            <span className="font-medium">{confidencePercent}%</span>
          </div>
          <div className="h-1.5 bg-purple-100 dark:bg-purple-800/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full"
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
        </div>

        {/* AI Prompt Preview */}
        {prompt && (
          <div
            className="text-[9px] text-purple-600 dark:text-purple-400 italic truncate"
            title={prompt}
          >
            &quot;{prompt.substring(0, 40)}...&quot;
          </div>
        )}

        {/* Auto-Execute Badge */}
        {autoExecuteEnabled && (
          <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-800/50 rounded text-[9px]">
            <Zap className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            <span className="text-purple-700 dark:text-purple-300">
              Auto @ {autoExecPercent}%
            </span>
            {autoExecuteMaxRisk && (
              <span className="text-purple-500 dark:text-purple-400">
                ({autoExecuteMaxRisk} risk)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

AIAnalysisFlowNode.displayName = 'AIAnalysisFlowNode';

export default AIAnalysisFlowNode;
