'use client';

import type { WaterfallBar } from '@/types/ai-trace';
import { SPAN_COLORS, PLATFORM_COLORS } from '@/types/ai-trace';

interface SpanTooltipProps {
  bar: WaterfallBar;
  position: { x: number; y: number };
}

export function SpanTooltip({ bar, position }: SpanTooltipProps) {
  const color = SPAN_COLORS[bar.span_type];

  return (
    <div
      className="fixed z-50 bg-gray-900 text-white rounded-lg shadow-xl p-3 text-xs max-w-xs pointer-events-none"
      style={{ left: position.x + 12, top: position.y - 8 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color.hex }} />
        <span className="font-semibold">{bar.span_name}</span>
      </div>

      <div className="space-y-1 text-gray-300">
        <Row label="Type" value={bar.span_type.replace('_', ' ')} />
        <Row label="Duration" value={bar.duration_ms ? `${bar.duration_ms}ms` : 'running...'} />
        <Row label="Status" value={bar.status} />

        {bar.tool_platform && (
          <Row label="Platform">
            <span style={{ color: PLATFORM_COLORS[bar.tool_platform] || '#94a3b8' }}>
              {bar.tool_platform}
            </span>
          </Row>
        )}

        {bar.model && <Row label="Model" value={bar.model} />}

        {bar.tokens && (
          <Row label="Tokens" value={`${bar.tokens.input.toLocaleString()} in / ${bar.tokens.output.toLocaleString()} out`} />
        )}

        {bar.cost_usd !== undefined && bar.cost_usd > 0 && (
          <Row label="Cost" value={`$${bar.cost_usd.toFixed(6)}`} />
        )}

        {bar.server_ip && (
          <div className="mt-1 pt-1 border-t border-gray-700">
            <div className="text-gray-400 mb-0.5">Connection</div>
            <Row label="Server" value={`${bar.server_ip}${bar.server_port ? `:${bar.server_port}` : ''}`} />
            {bar.tls_version && <Row label="TLS" value={bar.tls_version} />}
            {bar.http_version && <Row label="Protocol" value={bar.http_version} />}
          </div>
        )}

        {bar.network_timing && (
          <div className="mt-1 pt-1 border-t border-gray-700">
            <div className="text-gray-400 mb-0.5">Network Timing</div>
            {bar.network_timing.dns_ms !== undefined && <Row label="DNS" value={`${bar.network_timing.dns_ms}ms`} />}
            {bar.network_timing.tcp_ms !== undefined && <Row label="TCP" value={`${bar.network_timing.tcp_ms}ms`} />}
            {bar.network_timing.tls_ms !== undefined && <Row label="TLS" value={`${bar.network_timing.tls_ms}ms`} />}
            {bar.network_timing.ttfb_ms !== undefined && <Row label="TTFB" value={`${bar.network_timing.ttfb_ms}ms`} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-400">{label}</span>
      {children || <span>{value}</span>}
    </div>
  );
}
