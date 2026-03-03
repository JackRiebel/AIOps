'use client';

import { memo } from 'react';
import type { TEPathHop } from '@/types/journey-flow';
import { classifyZone, ZONE_CONFIG, findBottleneck } from '../pathUtils';

interface InlinePathPreviewProps {
  hops: TEPathHop[];
  width?: number;
}

export const InlinePathPreview = memo(({ hops, width = 60 }: InlinePathPreviewProps) => {
  if (hops.length === 0) return null;

  const maxHops = 10;
  const displayHops = hops.length > maxHops
    ? [...hops.slice(0, maxHops - 1), hops[hops.length - 1]]
    : hops;
  const dotSize = 3;
  const spacing = Math.min(8, (width - dotSize) / Math.max(displayHops.length - 1, 1));
  const svgWidth = (displayHops.length - 1) * spacing + dotSize;
  const svgHeight = 8;
  const cy = svgHeight / 2;

  const bottleneck = findBottleneck(hops);
  const { hasBottleneck, index: bottleneckIdx } = bottleneck;

  return (
    <svg width={svgWidth} height={svgHeight} className="shrink-0">
      {/* Connection line */}
      <line x1={dotSize / 2} y1={cy} x2={svgWidth - dotSize / 2} y2={cy} stroke="#94a3b8" strokeWidth={0.5} opacity={0.5} />
      {/* Hop dots */}
      {displayHops.map((hop, i) => {
        const origIdx = i === displayHops.length - 1 && hops.length > maxHops ? hops.length - 1 : i;
        const zone = classifyZone(hop, origIdx, hops.length);
        const color = ZONE_CONFIG[zone]?.dotColorHex || '#94a3b8';
        const isBottleneck = hasBottleneck && origIdx === bottleneckIdx;
        const hasLoss = hop.loss > 0;

        return (
          <g key={i}>
            {isBottleneck && (
              <circle cx={i * spacing + dotSize / 2} cy={cy} r={dotSize} fill="none" stroke="#ef4444" strokeWidth={0.5} opacity={0.6}>
                <animate attributeName="r" values={`${dotSize};${dotSize + 1.5};${dotSize}`} dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx={i * spacing + dotSize / 2}
              cy={cy}
              r={dotSize / 2}
              fill={hasLoss ? '#ef4444' : color}
            />
          </g>
        );
      })}
    </svg>
  );
});
InlinePathPreview.displayName = 'InlinePathPreview';
