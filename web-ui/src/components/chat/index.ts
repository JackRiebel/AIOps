// Chat Components - Chat UI Overhaul
// These components provide a modular, reusable chat interface with streaming support
// and agent collaboration visualization

export { ChatContainer } from './ChatContainer';
export type { ChatContainerProps, AgentFlowState } from './ChatContainer';

export { ChatMessage } from './ChatMessage';
export type { Message, ChatMessageProps } from './ChatMessage';

export { ChatInput } from './ChatInput';
export type { ChatInputProps, ChatInputRef } from './ChatInput';

export { StreamingIndicator, AgenticPhaseIndicator, getAgenticPhase } from './StreamingIndicator';
export type {
  StreamingStatus,
  AgenticPhase,
  AgentActivityInfo,
  StreamingIndicatorProps,
} from './StreamingIndicator';

export { AgentFlowPanel } from './AgentFlowPanel';
export type { AgentFlowPanelProps } from './AgentFlowPanel';

export { CodeBlock, InlineCode } from './CodeBlock';
export type { CodeBlockProps } from './CodeBlock';

export { NetworkChatPanel } from './NetworkChatPanel';
export type { NetworkChatPanelProps, SelectedNetwork } from './NetworkChatPanel';

export { SlashCommandMenu, defaultCommands } from './SlashCommandMenu';
export type { SlashCommand } from './SlashCommandMenu';

// Response rendering components
export {
  ResponseSection,
  ActionButton,
  ApplyFixButton,
  CopyButton,
  ExportButton,
  ViewDetailsButton,
  ConfigureButton,
  EmbeddedChart,
  SparklineChart,
} from './response';
export type {
  ResponseSectionProps,
  ActionButtonProps,
  EmbeddedChartProps,
  ChartType,
  DataPoint,
  ChartSeries,
} from './response';

// Agent workflow visualization
export { AgentWorkflowTimeline } from './AgentWorkflowTimeline';
export type { AgentWorkflowTimelineProps, WorkflowStep, StepStatus, StepType } from './AgentWorkflowTimeline';

// Multi-agent turn timeline
export { TurnTimeline } from './TurnTimeline';
export type { TurnTimelineProps } from './TurnTimeline';

// Incident context card for Ask AI flow
export { IncidentContextCard, isIncidentContext } from './IncidentContextCard';
export type { IncidentContextData } from './IncidentContextCard';
