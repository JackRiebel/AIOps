'use client';

import { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Share2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Clock,
  DollarSign,
  Zap,
  AlertTriangle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface TopWin {
  sessionId: number;
  sessionName: string;
  description: string;
  impact: string;
  roiPercentage?: number;
  timeSavedMinutes?: number;
}

export interface OptimizationOpportunity {
  category: string;
  issue: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
}

export interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  summary: {
    sessionsCompleted: number;
    totalTimeSavedMinutes: number;
    laborCostSaved: number;
    aiCostTotal: number;
    netROI: number;
    roiMultiplier: number;
  };
  topWins: TopWin[];
  optimizations: OptimizationOpportunity[];
  weekOverWeekChange?: {
    sessions: number;
    timeSaved: number;
    cost: number;
    roi: number;
  };
}

interface WeeklyROIReportProps {
  data: WeeklyReportData;
  onDownload?: () => void;
  onShare?: () => void;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatCost(cost: number | undefined | null): string {
  if (cost == null || isNaN(cost)) {
    return '$0.00';
  }
  if (cost >= 1000) {
    return `$${(cost / 1000).toFixed(1)}K`;
  }
  return `$${cost.toFixed(2)}`;
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, options)}`;
}

function getPriorityColor(priority: OptimizationOpportunity['priority']): { bg: string; text: string } {
  switch (priority) {
    case 'high':
      return { bg: 'bg-red-100 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400' };
    case 'medium':
      return { bg: 'bg-yellow-100 dark:bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400' };
    case 'low':
      return { bg: 'bg-slate-100 dark:bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400' };
  }
}

// ============================================================================
// Component
// ============================================================================

export function WeeklyROIReport({
  data,
  onDownload,
  onShare,
  className = '',
}: WeeklyROIReportProps) {
  const [expanded, setExpanded] = useState(true);

  const changeIndicator = useMemo(() => {
    if (!data.weekOverWeekChange) return null;
    return data.weekOverWeekChange;
  }, [data.weekOverWeekChange]);

  return (
    <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-blue-500 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/10">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Weekly AI ROI Report
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatDateRange(data.weekStart, data.weekEnd)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onDownload && (
              <button
                onClick={onDownload}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                title="Download Report"
              >
                <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </button>
            )}
            {onShare && (
              <button
                onClick={onShare}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                title="Share Report"
              >
                <Share2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <>
          {/* Summary Section */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-700/50">
            <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
              Summary
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border-l-2 border-l-blue-500">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Sessions</span>
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {data.summary.sessionsCompleted}
                </p>
                {changeIndicator && changeIndicator.sessions != null && (
                  <p className={`text-xs ${changeIndicator.sessions >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {changeIndicator.sessions >= 0 ? '+' : ''}{changeIndicator.sessions.toFixed(0)}% vs last week
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border-l-2 border-l-emerald-500">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Time Saved</span>
                </div>
                <p className="text-xl font-bold text-emerald-500">
                  {formatTime(data.summary.totalTimeSavedMinutes)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  = {formatCost(data.summary.laborCostSaved)} labor
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border-l-2 border-l-cyan-500">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-cyan-500" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">AI Cost</span>
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {formatCost(data.summary.aiCostTotal)}
                </p>
                {changeIndicator && changeIndicator.cost != null && (
                  <p className={`text-xs ${changeIndicator.cost <= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {changeIndicator.cost >= 0 ? '+' : ''}{changeIndicator.cost.toFixed(0)}% vs last week
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg bg-gradient-to-br from-cyan-50 to-emerald-50 dark:from-cyan-500/5 dark:to-emerald-500/5 border-l-2 border-l-violet-500">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-cyan-500" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Net ROI</span>
                </div>
                <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                  {formatCost(data.summary.netROI)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {(data.summary.roiMultiplier ?? 0).toFixed(0)}x return
                </p>
              </div>
            </div>
          </div>

          {/* Top Wins */}
          {data.topWins.length > 0 && (
            <div className="p-5 border-b border-slate-200 dark:border-slate-700/50">
              <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Top Wins
              </h4>
              <div className="space-y-2">
                {data.topWins.map((win, index) => (
                  <div
                    key={win.sessionId}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border-l-2 border-l-emerald-500"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {win.sessionName}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {win.description}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {win.impact}
                      </p>
                      {win.roiPercentage && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {win.roiPercentage.toFixed(0)}% ROI
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optimization Opportunities */}
          {data.optimizations.length > 0 && (
            <div className="p-5">
              <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Optimization Opportunities
              </h4>
              <div className="space-y-2">
                {data.optimizations.map((opt, index) => {
                  const colors = getPriorityColor(opt.priority);
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30"
                    >
                      <div className="flex-shrink-0">
                        <AlertTriangle className={`w-4 h-4 ${colors.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {opt.issue}
                          </p>
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${colors.bg} ${colors.text}`}>
                            {opt.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {opt.recommendation}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Report generated {new Date().toLocaleDateString()}
              </span>
              <div className="flex items-center gap-2">
                {onDownload && (
                  <button
                    onClick={onDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </button>
                )}
                {onShare && (
                  <button
                    onClick={onShare}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default WeeklyROIReport;
