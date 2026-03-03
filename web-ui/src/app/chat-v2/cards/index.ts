/**
 * Smart Cards Module
 *
 * Exports all card-related components, hooks, and utilities.
 */

// Types
export * from './types';

// Registry and Factory
export { CARD_REGISTRY, getCardDefinition, getCardsByPlatform } from './registry';
export { createCard, updateCardData, toggleCardPin, serializeCard, deserializeCard } from './factory';

// Components
export { SmartCardWrapper } from './SmartCardWrapper';
export { VisualizationRenderer } from './visualizations/VisualizationRenderer';

// Visualizations
export { BigNumber } from './visualizations/BigNumber';
export { DonutChart } from './visualizations/DonutChart';
export { StatusGrid, StatusDots } from './visualizations/StatusGrid';
export { DataTable } from './visualizations/DataTable';
export { Gauge, MultiGauge } from './visualizations/Gauge';
export { BadgeList, BadgeRow } from './visualizations/BadgeList';
export { BarChart } from './visualizations/BarChart';
export { LineChart, AreaChart } from './visualizations/LineChart';
export { Timeline } from './visualizations/Timeline';
export { AlertList, DeviceList } from './visualizations/AlertList';

// Hooks
export {
  useCardRefresh,
  useBatchCardRefresh,
  calculateFreshness,
  getFreshnessLabel,
  getFreshnessColor,
} from './hooks/useCardRefresh';
