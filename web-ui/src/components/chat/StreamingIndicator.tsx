'use client';

import { memo, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export type StreamingStatus =
  | 'idle'
  | 'thinking'
  | 'tool_use'
  | 'agent_activity'
  | 'streaming'
  | 'error';

// AgenticOps phases aligned with Cisco AI Canvas paradigm
export type AgenticPhase = 'idle' | 'see' | 'think' | 'act';

export interface AgentActivityInfo {
  agent: string;
  tool?: string;
  query?: string;
  confidence?: number;
  sources_count?: number;
  steps_count?: number;
  success?: boolean;
}

export interface StreamingIndicatorProps {
  status: StreamingStatus;
  toolName?: string;
  agentActivity?: AgentActivityInfo;
  className?: string;
  /** Show AgenticOps phase indicator (See/Think/Act) */
  showPhaseIndicator?: boolean;
}

// ============================================================================
// Animated Dots
// ============================================================================

const AnimatedDots = memo(() => (
  <span className="inline-flex items-center gap-1 ml-1">
    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </span>
));

AnimatedDots.displayName = 'AnimatedDots';

// ============================================================================
// Pulsing Orb
// ============================================================================

const PulsingOrb = memo(({ color = 'cyan' }: { color?: 'cyan' | 'violet' | 'amber' | 'emerald' }) => {
  const colorClasses = {
    cyan: 'bg-cyan-400 shadow-cyan-400/50',
    violet: 'bg-violet-400 shadow-violet-400/50',
    amber: 'bg-amber-400 shadow-amber-400/50',
    emerald: 'bg-emerald-400 shadow-emerald-400/50',
  };

  return (
    <div className="relative flex items-center justify-center">
      <div className={`w-3 h-3 rounded-full ${colorClasses[color]} animate-pulse shadow-lg`} />
      <div className={`absolute w-3 h-3 rounded-full ${colorClasses[color]} animate-ping opacity-50`} />
    </div>
  );
});

PulsingOrb.displayName = 'PulsingOrb';

// ============================================================================
// Spinner
// ============================================================================

const Spinner = memo(({ size = 'sm' }: { size?: 'sm' | 'md' }) => {
  const sizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <svg className={`${sizeClasses} animate-spin text-cyan-500`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
});

Spinner.displayName = 'Spinner';

// ============================================================================
// Status Icons
// ============================================================================

const ThinkingIcon = memo(() => (
  <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
));

ThinkingIcon.displayName = 'ThinkingIcon';

const ToolIcon = memo(() => (
  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
));

ToolIcon.displayName = 'ToolIcon';

const AgentIcon = memo(() => (
  <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
));

AgentIcon.displayName = 'AgentIcon';

// ============================================================================
// AgenticOps Phase Indicator - See → Think → Act
// ============================================================================

const PhaseStep = memo(({
  label,
  isActive,
  isCompleted,
  icon
}: {
  label: string;
  isActive: boolean;
  isCompleted: boolean;
  icon: React.ReactNode;
}) => {
  const bgColor = isActive
    ? 'bg-cyan-500/20 border-cyan-500/50'
    : isCompleted
      ? 'bg-emerald-500/20 border-emerald-500/50'
      : 'bg-slate-700/30 border-slate-600/30';

  const textColor = isActive
    ? 'text-cyan-400'
    : isCompleted
      ? 'text-emerald-400'
      : 'text-slate-500';

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${bgColor} transition-all duration-300`}>
      <span className={textColor}>{icon}</span>
      <span className={`text-xs font-medium ${textColor}`}>{label}</span>
      {isCompleted && (
        <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
});

PhaseStep.displayName = 'PhaseStep';

const AgenticPhaseIndicator = memo(({ phase }: { phase: AgenticPhase }) => {
  const phases = [
    {
      key: 'see',
      label: 'See',
      icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    },
    {
      key: 'think',
      label: 'Think',
      icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    },
    {
      key: 'act',
      label: 'Act',
      icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    },
  ];

  const phaseOrder = ['see', 'think', 'act'];
  const currentIndex = phaseOrder.indexOf(phase);

  return (
    <div className="flex items-center gap-1 mb-2">
      {phases.map((p, index) => (
        <div key={p.key} className="flex items-center">
          <PhaseStep
            label={p.label}
            isActive={phase === p.key}
            isCompleted={currentIndex > index}
            icon={p.icon}
          />
          {index < phases.length - 1 && (
            <svg className={`w-4 h-4 mx-1 ${currentIndex > index ? 'text-emerald-500' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
});

AgenticPhaseIndicator.displayName = 'AgenticPhaseIndicator';

// Helper to map streaming status to AgenticOps phase
function getAgenticPhase(status: StreamingStatus): AgenticPhase {
  switch (status) {
    case 'thinking':
      return 'think';
    case 'tool_use':
      return 'act';
    case 'agent_activity':
      return 'see'; // Gathering context from agents
    case 'streaming':
      return 'think'; // Formulating response
    default:
      return 'idle';
  }
}

// ============================================================================
// Main StreamingIndicator Component
// ============================================================================

export const StreamingIndicator = memo(({
  status,
  toolName,
  agentActivity,
  className = '',
  showPhaseIndicator = false,
}: StreamingIndicatorProps) => {
  if (status === 'idle') return null;

  // Derive AgenticOps phase from streaming status
  const agenticPhase = useMemo(() => getAgenticPhase(status), [status]);

  const renderContent = () => {
    switch (status) {
      case 'thinking':
        return (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <PulsingOrb color="cyan" />
            <ThinkingIcon />
            <span>Analyzing your request</span>
            <AnimatedDots />
          </div>
        );

      case 'tool_use':
        return (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Spinner />
            <ToolIcon />
            <span>
              Executing <span className="font-mono text-amber-600 dark:text-amber-400">{toolName || 'tool'}</span>
            </span>
            <AnimatedDots />
          </div>
        );

      case 'agent_activity':
        // Agent activity is shown in the Agent Flow panel, not in the chat
        return null;

      case 'streaming':
        return (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <PulsingOrb color="cyan" />
            <span>Generating response</span>
            <AnimatedDots />
          </div>
        );

      case 'error':
        return (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>An error occurred</span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`flex justify-start ${className}`}>
      <div className="bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/30 rounded-xl px-4 py-3 shadow-sm">
        {/* AgenticOps Phase Indicator - See → Think → Act */}
        {showPhaseIndicator && agenticPhase !== 'idle' && (
          <AgenticPhaseIndicator phase={agenticPhase} />
        )}
        {renderContent()}
      </div>
    </div>
  );
});

StreamingIndicator.displayName = 'StreamingIndicator';

// Export the phase indicator for use elsewhere
export { AgenticPhaseIndicator, getAgenticPhase };

export default StreamingIndicator;
