'use client';

import { memo, useState, useCallback } from 'react';
import { LayoutDashboard, ChevronDown, ChevronRight, Clock, Layers, AlertCircle, BarChart3, PieChart, LineChart, Table, Loader2, Info } from 'lucide-react';
import type { TEDashboard, TEDashboardWidget } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TEDashboardsPanelProps {
  dashboards: TEDashboard[];
  widgets: Record<string, TEDashboardWidget[]>;
  loading: boolean;
  mcpAvailable: boolean;
  onFetchWidgets: (dashboardId: string) => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const widgetTypeIcons: Record<string, typeof BarChart3> = {
  'bar-chart': BarChart3,
  'line-chart': LineChart,
  'pie-chart': PieChart,
  'table': Table,
  'number': BarChart3,
};

const widgetTypeBadgeColors: Record<string, { bg: string; text: string }> = {
  'bar-chart': { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400' },
  'line-chart': { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' },
  'pie-chart': { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400' },
  'table': { bg: 'bg-slate-100 dark:bg-slate-500/15', text: 'text-slate-700 dark:text-slate-400' },
  'number': { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400' },
  'default': { bg: 'bg-cyan-100 dark:bg-cyan-500/15', text: 'text-cyan-700 dark:text-cyan-400' },
};

// ============================================================================
// Skeleton
// ============================================================================

const DashboardGridSkeleton = memo(() => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
        <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3" />
        <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
        <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
        <div className="flex items-center gap-3">
          <div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
      </div>
    ))}
  </div>
));
DashboardGridSkeleton.displayName = 'DashboardGridSkeleton';

// ============================================================================
// Sub-components
// ============================================================================

const WidgetItem = memo(({ widget }: { widget: TEDashboardWidget }) => {
  const typeKey = widget.type?.toLowerCase().replace(/\s+/g, '-') || 'default';
  const IconComponent = widgetTypeIcons[typeKey] || Layers;
  const badgeColor = widgetTypeBadgeColors[typeKey] || widgetTypeBadgeColors['default'];

  return (
    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/30">
      <div className={`w-7 h-7 rounded-md flex items-center justify-center ${badgeColor.bg}`}>
        <IconComponent className={`w-3.5 h-3.5 ${badgeColor.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{widget.title}</p>
        <span className={`inline-block px-1.5 py-0.5 mt-0.5 text-[9px] font-bold rounded ${badgeColor.bg} ${badgeColor.text} capitalize`}>
          {widget.type || 'Widget'}
        </span>
      </div>
      {widget.dataComponents && widget.dataComponents.length > 0 && (
        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">
          {widget.dataComponents.length} source{widget.dataComponents.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
});
WidgetItem.displayName = 'WidgetItem';

const DashboardCard = memo(({
  dashboard,
  widgets,
  onFetchWidgets,
}: {
  dashboard: TEDashboard;
  widgets: TEDashboardWidget[] | undefined;
  onFetchWidgets: (dashboardId: string) => Promise<void>;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [loadingWidgets, setLoadingWidgets] = useState(false);

  const handleToggle = useCallback(async () => {
    const willExpand = !expanded;
    setExpanded(willExpand);

    if (willExpand && !widgets) {
      setLoadingWidgets(true);
      try {
        await onFetchWidgets(dashboard.id);
      } catch (err) {
        console.error('Failed to fetch widgets:', err);
      } finally {
        setLoadingWidgets(false);
      }
    }
  }, [expanded, widgets, dashboard.id, onFetchWidgets]);

  const formattedDate = dashboard.modifiedDate
    ? new Date(dashboard.modifiedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-all overflow-hidden group">
      {/* Card header - clickable */}
      <button
        onClick={handleToggle}
        className="w-full text-left p-4 flex items-start gap-3"
      >
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 dark:from-cyan-500/10 dark:to-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <LayoutDashboard className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition truncate">
            {dashboard.title}
          </h4>
          {dashboard.description && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
              {dashboard.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {dashboard.widgetCount != null && (
              <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <Layers className="w-3 h-3" />
                {dashboard.widgetCount} widget{dashboard.widgetCount !== 1 ? 's' : ''}
              </span>
            )}
            {formattedDate && (
              <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                <Clock className="w-3 h-3" />
                {formattedDate}
              </span>
            )}
            {dashboard.isBuiltin && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                Built-in
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 mt-1">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-slate-400" />
            : <ChevronRight className="w-4 h-4 text-slate-400" />
          }
        </div>
      </button>

      {/* Expanded widget list */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700/30 pt-3">
          {loadingWidgets ? (
            <div className="flex items-center justify-center py-6 gap-2">
              <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
              <span className="text-xs text-slate-500 dark:text-slate-400">Loading widgets...</span>
            </div>
          ) : widgets && widgets.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Widgets ({widgets.length})
              </p>
              {widgets.map(widget => (
                <WidgetItem key={widget.id} widget={widget} />
              ))}
            </div>
          ) : widgets && widgets.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-slate-400 dark:text-slate-500">No widgets in this dashboard</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-slate-400 dark:text-slate-500">Click to load widgets</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
DashboardCard.displayName = 'DashboardCard';

// ============================================================================
// Main Component
// ============================================================================

export const TEDashboardsPanel = memo(({
  dashboards,
  widgets,
  loading,
  mcpAvailable,
  onFetchWidgets,
}: TEDashboardsPanelProps) => {
  if (!mcpAvailable) {
    return (
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-500/30 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Info className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-1">MCP Connection Required</h3>
            <p className="text-xs text-purple-700 dark:text-purple-300 leading-relaxed">
              ThousandEyes dashboards require an active MCP (Model Context Protocol) connection. Configure the ThousandEyes MCP server in Admin Settings to enable dashboard browsing and widget data retrieval.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-purple-200 dark:bg-purple-500/25 text-purple-800 dark:text-purple-300">
                te_list_dashboards
              </span>
              <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-blue-200 dark:bg-blue-500/25 text-blue-800 dark:text-blue-300">
                te_get_dashboard_widgets
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <DashboardGridSkeleton />;
  }

  if (dashboards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <LayoutDashboard className="w-8 h-8 text-slate-300 dark:text-slate-600" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">No Dashboards Found</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
          No ThousandEyes dashboards were returned. Create dashboards in the ThousandEyes portal, or verify your API permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {dashboards.length} Dashboard{dashboards.length !== 1 ? 's' : ''}
        </span>
        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {dashboards.filter(d => d.isBuiltin).length} built-in
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {dashboards.filter(d => !d.isBuiltin).length} custom
        </span>
      </div>

      {/* Dashboard grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {dashboards.map(dashboard => (
          <DashboardCard
            key={dashboard.id}
            dashboard={dashboard}
            widgets={widgets[dashboard.id]}
            onFetchWidgets={onFetchWidgets}
          />
        ))}
      </div>
    </div>
  );
});

TEDashboardsPanel.displayName = 'TEDashboardsPanel';
export default TEDashboardsPanel;
