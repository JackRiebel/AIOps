'use client';

/**
 * ContextualSuggestions - Smart Prompt Suggestions
 *
 * Shows contextual suggestions based on:
 * - Current network health status
 * - Active incidents/alerts
 * - Recent activity patterns
 */

import { memo, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// Types
// =============================================================================

interface NetworkHealth {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  onlineDevices: number;
  offlineDevices: number;
  alertingDevices: number;
  activeIncidents: number;
  criticalIncidents: number;
}

interface Suggestion {
  id: string;
  label: string;
  query: string;
  icon: React.ReactNode;
  priority: 'high' | 'medium' | 'low';
  category: 'incident' | 'health' | 'explore' | 'security';
}

interface ContextualSuggestionsProps {
  onAction: (query: string) => void;
  className?: string;
}

// =============================================================================
// Icons
// =============================================================================

const AlertIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const HealthIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DeviceIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

const SecurityIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const ExploreIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

// =============================================================================
// Default Suggestions (when no specific context)
// =============================================================================

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  {
    id: 'overview',
    label: 'Network Overview',
    query: 'Show me an overview of my network health and status',
    icon: <ChartIcon />,
    priority: 'medium',
    category: 'health',
  },
  {
    id: 'security',
    label: 'Security Check',
    query: 'Are there any security alerts or threats I should know about?',
    icon: <SecurityIcon />,
    priority: 'medium',
    category: 'security',
  },
  {
    id: 'devices',
    label: 'Device Status',
    query: 'List all devices and their current status',
    icon: <DeviceIcon />,
    priority: 'medium',
    category: 'explore',
  },
  {
    id: 'performance',
    label: 'Performance Analysis',
    query: 'How is my network performing? Show me throughput and latency metrics',
    icon: <ExploreIcon />,
    priority: 'low',
    category: 'explore',
  },
];

// =============================================================================
// Generate Contextual Suggestions
// =============================================================================

function generateSuggestions(health: NetworkHealth | null): Suggestion[] {
  if (!health) return DEFAULT_SUGGESTIONS;

  const suggestions: Suggestion[] = [];

  // Critical incidents - highest priority
  if (health.criticalIncidents > 0) {
    suggestions.push({
      id: 'critical-incidents',
      label: `${health.criticalIncidents} Critical Incident${health.criticalIncidents > 1 ? 's' : ''}`,
      query: 'Show me all critical incidents and their details. What actions should I take?',
      icon: <AlertIcon />,
      priority: 'high',
      category: 'incident',
    });
  }

  // Offline devices - high priority
  if (health.offlineDevices > 0) {
    suggestions.push({
      id: 'offline-devices',
      label: `${health.offlineDevices} Device${health.offlineDevices > 1 ? 's' : ''} Offline`,
      query: `I have ${health.offlineDevices} offline device${health.offlineDevices > 1 ? 's' : ''}. Show me details and help me troubleshoot.`,
      icon: <DeviceIcon />,
      priority: 'high',
      category: 'health',
    });
  }

  // Alerting devices - medium priority
  if (health.alertingDevices > 0) {
    suggestions.push({
      id: 'alerting-devices',
      label: `${health.alertingDevices} Device Alert${health.alertingDevices > 1 ? 's' : ''}`,
      query: 'Show me all devices with active alerts and their current status',
      icon: <AlertIcon />,
      priority: 'medium',
      category: 'health',
    });
  }

  // Active incidents (non-critical)
  if (health.activeIncidents > health.criticalIncidents) {
    const nonCritical = health.activeIncidents - health.criticalIncidents;
    suggestions.push({
      id: 'active-incidents',
      label: `${nonCritical} Active Incident${nonCritical > 1 ? 's' : ''}`,
      query: 'Show me all active incidents, prioritized by severity',
      icon: <AlertIcon />,
      priority: 'medium',
      category: 'incident',
    });
  }

  // Network health summary
  suggestions.push({
    id: 'health-summary',
    label: 'Network Health',
    query: 'Give me a comprehensive summary of my network health',
    icon: health.status === 'healthy' ? <HealthIcon /> : <AlertIcon />,
    priority: health.status === 'healthy' ? 'low' : 'medium',
    category: 'health',
  });

  // Security check
  suggestions.push({
    id: 'security',
    label: 'Security Check',
    query: 'Are there any security threats or vulnerabilities I should address?',
    icon: <SecurityIcon />,
    priority: 'medium',
    category: 'security',
  });

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Return top 4 suggestions
  return suggestions.slice(0, 4);
}

// =============================================================================
// Suggestion Button
// =============================================================================

const SuggestionButton = memo(({
  suggestion,
  onAction,
  index,
}: {
  suggestion: Suggestion;
  onAction: (query: string) => void;
  index: number;
}) => {
  const bgColor = {
    high: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20',
    medium: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20',
    low: 'bg-slate-700/30 border-slate-600/30 hover:bg-slate-700/50',
  }[suggestion.priority];

  const iconColor = {
    high: 'text-red-400',
    medium: 'text-amber-400',
    low: 'text-cyan-400',
  }[suggestion.priority];

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 500, damping: 30 }}
      onClick={() => onAction(suggestion.query)}
      className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left group ${bgColor}`}
    >
      <div className={`p-2 rounded-lg bg-slate-800/50 ${iconColor} group-hover:scale-110 transition-transform`}>
        {suggestion.icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-white font-medium truncate block">
          {suggestion.label}
        </span>
        {suggestion.priority === 'high' && (
          <span className="text-xs text-red-400">Requires attention</span>
        )}
      </div>
      <svg className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </motion.button>
  );
});
SuggestionButton.displayName = 'SuggestionButton';

// =============================================================================
// Main Component
// =============================================================================

export const ContextualSuggestions = memo(({
  onAction,
  className = '',
}: ContextualSuggestionsProps) => {
  const [health, setHealth] = useState<NetworkHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch network health on mount
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        // Try to fetch health summary from API
        const response = await fetch('/api/network/health/summary', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setHealth({
            status: data.status || 'unknown',
            onlineDevices: data.online || data.onlineDevices || 0,
            offlineDevices: data.offline || data.offlineDevices || 0,
            alertingDevices: data.alerting || data.alertingDevices || 0,
            activeIncidents: data.activeIncidents || data.incidents || 0,
            criticalIncidents: data.criticalIncidents || 0,
          });
        }
      } catch {
        // Silently fail - we'll show default suggestions
      } finally {
        setIsLoading(false);
      }
    };

    fetchHealth();
  }, []);

  // Generate suggestions based on health
  const suggestions = useMemo(() => generateSuggestions(health), [health]);

  // Determine if there are issues requiring attention
  const hasIssues = health && (health.criticalIncidents > 0 || health.offlineDevices > 0);

  return (
    <div className={className}>
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${
            hasIssues
              ? 'bg-gradient-to-br from-red-500/20 to-amber-600/20'
              : 'bg-gradient-to-br from-cyan-500/20 to-blue-600/20'
          }`}
        >
          {hasIssues ? (
            <AlertIcon />
          ) : (
            <svg className="w-8 h-8 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
        </motion.div>
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-semibold text-white mb-2"
        >
          {hasIssues ? 'Attention Needed' : 'AI Assistant'}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-slate-400"
        >
          {hasIssues
            ? 'Your network has issues that need attention'
            : 'Ask questions or explore your network'
          }
        </motion.p>
      </div>

      {/* Suggestions grid */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-slate-800/30 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {suggestions.map((suggestion, index) => (
              <SuggestionButton
                key={suggestion.id}
                suggestion={suggestion}
                onAction={onAction}
                index={index}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Health status indicator */}
      {health && !isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 pt-4 border-t border-slate-800"
        >
          <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {health.onlineDevices} Online
            </span>
            {health.offlineDevices > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {health.offlineDevices} Offline
              </span>
            )}
            {health.alertingDevices > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {health.alertingDevices} Alerting
              </span>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
});

ContextualSuggestions.displayName = 'ContextualSuggestions';

export default ContextualSuggestions;
