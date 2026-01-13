// Incident Components
export { IncidentListItem } from './IncidentListItem';
export type { IncidentListItemProps } from './IncidentListItem';

export { WorkflowProgress } from './WorkflowProgress';
export type { WorkflowProgressProps } from './WorkflowProgress';

export { EventTimelineItem } from './EventTimelineItem';
export type { EventTimelineItemProps, TimelineEvent } from './EventTimelineItem';

export { IncidentFilterBar } from './IncidentFilterBar';
export type { IncidentFilterBarProps, IncidentStats } from './IncidentFilterBar';

export { IncidentDetailPanel } from './IncidentDetailPanel';
export type { IncidentDetailPanelProps } from './IncidentDetailPanel';

export { AIImpactSummary } from './AIImpactSummary';
export type { AIImpactSummaryProps } from './AIImpactSummary';

export { IncidentListSkeleton } from './IncidentListSkeleton';
export type { IncidentListSkeletonProps } from './IncidentListSkeleton';

export { PostMortemButton } from './PostMortemButton';
export type { PostMortemButtonProps } from './PostMortemButton';

export { AIFeedbackControl } from './AIFeedbackControl';
export type { AIFeedbackControlProps } from './AIFeedbackControl';

// Shared types
export interface Incident {
  id: number;
  title: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  severity: 'critical' | 'high' | 'medium' | 'info';
  start_time: string;
  root_cause_hypothesis: string | null;
  confidence_score: number | null;
  affected_services: string[];
  event_count: number;
  // Network-specific fields
  network_id: string | null;
  network_name: string | null;
  device_config: Record<string, unknown> | null;
  // AI assistance tracking
  ai_assisted?: boolean;
  ai_session_id?: string;
  ai_time_saved_seconds?: number;
}

export interface Event {
  id: number;
  source: string;
  title: string;
  severity: string;
  timestamp: string;
  description?: string;
  ai_cost?: number;
  token_count?: number;
  raw_data?: Record<string, unknown>;
}
