'use client';

import { memo, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Globe, Loader2, Eye, EyeOff, Search, X, ChevronDown, ChevronUp,
  Activity, AlertTriangle, Monitor, BookmarkCheck,
} from 'lucide-react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Pagination } from './Pagination';
import type { InternetInsightsOutage, InternetInsightsCatalogProvider } from './types';

// ============================================================================
// Props & Types
// ============================================================================

export interface InternetInsightsPanelProps {
  onAskAI?: (context: string) => void;
}

type OutageFilter = 'all' | 'application' | 'network';
/** TE API window format: number + unit (s/m/h/d/w) */
type TimeWindow = '1h' | '6h' | '1d' | '7d';

// ============================================================================
// Provider Geo-Location Lookup
// Coordinates are [longitude, latitude] — the GeoJSON/d3-geo convention.
// ============================================================================

const PROVIDER_GEO: Record<string, [number, number]> = {
  // Cloud Providers
  'aws':              [-77.5,  39.0],   'amazon web services': [-77.5, 39.0],
  'amazon':           [-122.3, 47.6],
  'azure':            [-122.3, 47.6],   'microsoft':      [-122.3, 47.6],
  'google':           [-122.1, 37.4],   'gcp':            [-122.1, 37.4],
  'google cloud':     [-122.1, 37.4],
  'cloudflare':       [-122.4, 37.8],
  'akamai':           [-71.1,  42.4],
  'fastly':           [-122.4, 37.8],
  'digitalocean':     [-74.0,  40.7],
  'oracle':           [-122.3, 37.5],   'oracle cloud':   [-122.3, 37.5],
  'ibm':              [-87.6,  41.9],   'ibm cloud':      [-87.6, 41.9],
  'alibaba':          [120.2,  30.3],   'aliyun':         [120.2, 30.3],
  'tencent':          [114.1,  22.5],   'tencent cloud':  [114.1, 22.5],
  'huawei':           [114.1,  22.5],   'huawei cloud':   [114.1, 22.5],
  'linode':           [-75.2,  39.9],   'vultr':          [-74.0, 40.7],
  'ovh':              [2.3,    48.9],   'ovhcloud':       [2.3, 48.9],
  'hetzner':          [11.1,   49.5],
  'rackspace':        [-98.5,  29.4],
  'equinix':          [-122.4, 37.8],

  // CDN
  'limelight':        [-111.9, 33.4],   'edgecast':       [-118.2, 34.1],
  'stackpath':        [-96.8,  32.8],   'keycdn':         [8.5, 47.4],
  'bunny':            [14.5,   46.1],   'jsdelivr':       [8.5, 47.4],
  'imperva':          [-122.4, 37.8],   'incapsula':      [-122.4, 37.8],
  'sucuri':           [-97.7, 30.3],

  // Major ISPs & Transit — Americas
  'comcast':          [-75.2,  39.9],   'xfinity':        [-75.2, 39.9],
  'at&t':             [-96.8,  32.8],   'att':            [-96.8, 32.8],
  'verizon':          [-74.0,  40.7],
  'lumen':            [-105.0, 39.7],   'level3':         [-105.0, 39.7],
  'centurylink':      [-105.0, 39.7],
  'cogent':           [-77.0,  38.9],
  'zayo':             [-105.0, 39.7],
  'sprint':           [-94.7,  38.9],   't-mobile':       [-122.2, 47.6],
  'spectrum':         [-73.9,  40.7],   'charter':        [-73.2, 41.2],
  'cox':              [-76.6,  39.3],
  'frontier':         [-73.2,  41.2],
  'windstream':       [-92.4,  34.7],
  'bell canada':      [-73.6,  45.5],   'bell':           [-73.6, 45.5],
  'telus':            [-123.1, 49.3],   'rogers':         [-79.4, 43.7],
  'shaw':             [-114.1, 51.0],
  'telmex':           [-99.1,  19.4],   'claro':          [-43.2, -22.9],
  'telefonica':       [-3.7,   40.4],
  'america movil':    [-99.1,  19.4],

  // Major ISPs & Transit — Europe
  'deutsche telekom': [8.7,    50.1],   'dtag':           [8.7, 50.1],
  'orange':           [2.3,    48.9],
  'vodafone':         [-0.1,   51.5],
  'bt':               [-0.1,   51.5],   'british telecom': [-0.1, 51.5],
  'swisscom':         [7.4,    46.9],
  'telia':            [18.1,   59.3],   'telia carrier':  [18.1, 59.3],
  'telenor':          [10.8,   59.9],
  'kpn':              [4.9,    52.4],
  'proximus':         [4.4,    50.8],
  'telecom italia':   [12.5,   41.9],   'tim':            [12.5, 41.9],
  'bouygues':         [2.3,    48.9],
  'free':             [2.3,    48.9],
  'liberty global':   [4.9,    52.4],
  'colt':             [-0.1,   51.5],
  'eunetworks':       [-0.1,   51.5],
  'de-cix':           [8.7,    50.1],
  'ams-ix':           [4.9,    52.4],
  'linx':             [-0.1,   51.5],

  // Major ISPs & Transit — Asia-Pacific
  'ntt':              [139.7,  35.7],   'ntt communications': [139.7, 35.7],
  'kddi':             [139.7,  35.7],   'softbank':       [139.7, 35.7],
  'singtel':          [103.8,  1.3],
  'telstra':          [151.2, -33.9],
  'pccw':             [114.2,  22.3],
  'china telecom':    [121.5,  31.2],   'chinanet':       [121.5, 31.2],
  'china unicom':     [116.4,  39.9],
  'china mobile':     [116.4,  39.9],
  'reliance':         [72.9,   19.1],   'jio':            [72.9, 19.1],
  'airtel':           [77.2,   28.6],   'bharti':         [77.2, 28.6],
  'tata':             [72.9,   19.1],   'tata communications': [72.9, 19.1],
  'sk telecom':       [127.0,  37.6],   'kt':             [127.0, 37.6],
  'lg u+':            [127.0,  37.6],
  'chunghwa':         [121.5,  25.0],
  'starhub':          [103.8,  1.3],
  'optus':            [151.2, -33.9],
  'globe':            [121.0,  14.6],   'pldt':           [121.0, 14.6],
  'indosat':          [106.8, -6.2],    'telkom':         [106.8, -6.2],
  'true':             [100.5,  13.8],   'ais':            [100.5, 13.8],

  // Middle East & Africa
  'etisalat':         [54.4,   24.5],   'du':             [55.3, 25.3],
  'stc':              [46.7,   24.7],
  'mtn':              [28.0,  -26.2],
  'safaricom':        [36.8,  -1.3],
  'liquid telecom':   [28.0,  -26.2],

  // SaaS / App Providers
  'salesforce':       [-122.4, 37.8],
  'zoom':             [-122.1, 37.4],   'zoom video':     [-122.1, 37.4],
  'slack':            [-122.4, 37.8],
  'github':           [-122.4, 37.8],
  'okta':             [-122.4, 37.8],
  'twilio':           [-122.4, 37.8],
  'stripe':           [-122.4, 37.8],
  'datadog':          [-74.0,  40.7],
  'meta':             [-122.1, 37.5],   'facebook':       [-122.1, 37.5],
  'apple':            [-122.0, 37.3],
  'netflix':          [-121.9, 37.3],
  'twitter':          [-122.4, 37.8],   'x.com':          [-122.4, 37.8],
  'linkedin':         [-122.1, 37.4],
  'spotify':          [18.1,   59.3],
  'shopify':          [-75.7,  45.4],
  'atlassian':        [151.2, -33.9],
  'servicenow':       [-121.9, 37.3],
  'workday':          [-122.1, 37.5],
  'zendesk':          [-122.4, 37.8],
  'pagerduty':        [-122.4, 37.8],
  'new relic':        [-122.4, 37.8],   'newrelic':       [-122.4, 37.8],
  'splunk':           [-122.4, 37.8],
  'elastic':          [-122.3, 37.4],
  'mongodb':          [-74.0,  40.7],
  'snowflake':        [-104.8, 38.8],
  'dropbox':          [-122.4, 37.8],
  'box':              [-122.1, 37.5],
  'adobe':            [-111.9, 33.4],
  'sap':              [8.6,    49.3],
  'cisco':            [-121.9, 37.3],   'webex':          [-121.9, 37.3],
  'meraki':           [-122.4, 37.8],
  'palo alto':        [-122.1, 37.4],

  // DNS Providers
  'verisign':         [-77.2,  38.9],
  'dyn':              [-72.8,  41.3],
  'ns1':              [-74.0,  40.7],
  'route53':          [-77.5,  39.0],
};

/** Region name → approximate center [lng, lat] */
const REGION_GEO: Record<string, [number, number]> = {
  'north america':   [-98.0,  38.0],
  'south america':   [-58.0, -15.0],
  'europe':          [10.0,   50.0],
  'asia':            [100.0,  30.0],
  'asia pacific':    [120.0,  15.0],
  'apac':            [120.0,  15.0],
  'middle east':     [45.0,   25.0],
  'africa':          [20.0,    5.0],
  'oceania':         [145.0, -25.0],
  'global':          [0.0,    20.0],
};

/** Populated-area anchors for hash-based fallback (avoids oceans) */
const FALLBACK_ANCHORS: [number, number][] = [
  [-74.0, 40.7],   // New York
  [-118.2, 34.1],  // Los Angeles
  [-0.1, 51.5],    // London
  [8.7, 50.1],     // Frankfurt
  [2.3, 48.9],     // Paris
  [139.7, 35.7],   // Tokyo
  [103.8, 1.3],    // Singapore
  [151.2, -33.9],  // Sydney
  [72.9, 19.1],    // Mumbai
  [-43.2, -22.9],  // São Paulo
  [121.5, 31.2],   // Shanghai
  [37.6, 55.8],    // Moscow
  [28.0, -26.2],   // Johannesburg
  [-79.4, 43.7],   // Toronto
  [114.2, 22.3],   // Hong Kong
  [127.0, 37.6],   // Seoul
];

function getProviderCoords(
  name: string,
  catalogRegion?: string,
): [number, number] {
  const lower = name.toLowerCase().trim();

  // 1. Exact match first (most specific)
  if (PROVIDER_GEO[lower]) return PROVIDER_GEO[lower];

  // 2. Substring match — try longer keys first to prefer specific matches
  const sortedKeys = Object.keys(PROVIDER_GEO).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key) || key.includes(lower)) return PROVIDER_GEO[key];
  }

  // 3. Region-based fallback from catalog data
  if (catalogRegion) {
    const regionLower = catalogRegion.toLowerCase();
    for (const [regionKey, coords] of Object.entries(REGION_GEO)) {
      if (regionLower.includes(regionKey) || regionKey.includes(regionLower)) {
        // Add small jitter within the region so markers don't overlap
        const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const jitterLng = ((hash * 37) % 20) - 10;
        const jitterLat = ((hash * 53) % 14) - 7;
        return [coords[0] + jitterLng, coords[1] + jitterLat];
      }
    }
  }

  // 4. Hash-based fallback — pick a populated area and jitter around it
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const anchor = FALLBACK_ANCHORS[hash % FALLBACK_ANCHORS.length];
  const jitterLng = ((hash * 31) % 12) - 6;
  const jitterLat = ((hash * 47) % 8) - 4;
  return [anchor[0] + jitterLng, anchor[1] + jitterLat];
}

// ============================================================================
// Helpers
// ============================================================================

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return 'N/A';
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDurationSecs(totalSecs: number): string {
  const mins = Math.floor(totalSecs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hrs < 24) return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

function getDuration(outage: InternetInsightsOutage): string {
  // Prefer API-provided duration (in seconds)
  if (outage.duration && outage.duration > 0) return formatDurationSecs(outage.duration);
  // Fallback: compute from start/end
  const s = new Date(outage.startDate).getTime();
  const e = outage.endDate ? new Date(outage.endDate).getTime() : Date.now();
  if (isNaN(s)) return 'N/A';
  return formatDurationSecs(Math.floor((e - s) / 1000));
}

/** Provider type badge label */
function providerTypeLabel(pt?: string): string | null {
  if (!pt) return null;
  const map: Record<string, string> = {
    IAAS: 'IaaS', SAAS: 'SaaS', CDN: 'CDN', DNS: 'DNS', ISP: 'ISP',
    UCAAS: 'UCaaS', SASE: 'SASE',
  };
  return map[pt.toUpperCase()] || pt;
}

function getProviderInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function getProviderColor(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = [
    'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500',
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500',
    'bg-teal-500', 'bg-cyan-500',
  ];
  return colors[hash % colors.length];
}

function isActive(outage: InternetInsightsOutage): boolean {
  return !outage.endDate;
}

// ============================================================================
// World Map Sub-component
// ============================================================================

const WORLD_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface MapTooltip {
  x: number;
  y: number;
  outage: InternetInsightsOutage;
}

function WorldMap({
  outages,
  onOutageClick,
  catalogProviders,
}: {
  outages: InternetInsightsOutage[];
  onOutageClick: (id: string) => void;
  catalogProviders: InternetInsightsCatalogProvider[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [worldData, setWorldData] = useState<FeatureCollection<Geometry> | null>(null);
  const [tooltip, setTooltip] = useState<MapTooltip | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  // Load world atlas
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try local import first, fall back to CDN
        let topo: Topology;
        try {
          topo = (await import('world-atlas/countries-110m.json' as any)).default as unknown as Topology;
        } catch {
          const resp = await fetch(WORLD_ATLAS_URL);
          topo = await resp.json() as Topology;
        }
        if (!cancelled) {
          const countries = feature(topo, topo.objects.countries as any) as unknown as FeatureCollection<Geometry>;
          setWorldData(countries);
        }
      } catch (err) {
        console.error('Failed to load world atlas:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Responsive dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      if (width > 0) setDimensions({ width, height: Math.max(280, Math.min(400, width * 0.5)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const projection = useMemo(
    () => geoNaturalEarth1()
      .fitSize([dimensions.width, dimensions.height], { type: 'Sphere' } as any)
      .translate([dimensions.width / 2, dimensions.height / 2]),
    [dimensions]
  );

  const pathGen = useMemo(() => geoPath(projection), [projection]);

  // Build catalog region map for geo fallback
  const catalogRegionMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of catalogProviders) {
      if (p.region) m.set(p.providerName.toLowerCase(), p.region);
    }
    return m;
  }, [catalogProviders]);

  // Compute markers — one per provider, positioned using [lng, lat] coords
  const markers = useMemo(() => {
    const byProvider = new Map<string, { outages: InternetInsightsOutage[]; coords: [number, number] }>();
    for (const o of outages) {
      const key = o.providerName;
      if (!byProvider.has(key)) {
        const region = catalogRegionMap.get(o.providerName.toLowerCase());
        byProvider.set(key, { outages: [], coords: getProviderCoords(o.providerName, region) });
      }
      byProvider.get(key)!.outages.push(o);
    }
    return Array.from(byProvider.entries()).map(([provider, data]) => {
      const hasActive = data.outages.some(o => !o.endDate);
      const totalAffected = data.outages.reduce((s, o) => s + o.affectedTestsCount, 0);
      // projection expects [longitude, latitude]
      const pos = projection(data.coords);
      return {
        provider,
        outages: data.outages,
        hasActive,
        totalAffected,
        x: pos ? pos[0] : 0,
        y: pos ? pos[1] : 0,
        r: Math.max(5, Math.min(18, 5 + Math.sqrt(totalAffected) * 2)),
        mainOutage: data.outages[0],
      };
    });
  }, [outages, projection, catalogRegionMap]);

  const handleMouseEnter = useCallback((e: React.MouseEvent, outage: InternetInsightsOutage) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    setTooltip({ x: e.clientX - svgRect.left, y: e.clientY - svgRect.top - 10, outage });
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (!worldData) {
    return (
      <div className="flex items-center justify-center h-[300px] bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
        <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
        <span className="ml-2 text-xs text-slate-500">Loading map...</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/50">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="w-full"
        style={{ height: dimensions.height }}
      >
        {/* Gradient background */}
        <defs>
          <radialGradient id="mapBg" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgb(30,41,59)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="rgb(30,41,59)" stopOpacity="0.02" />
          </radialGradient>
          {/* Pulsing animation */}
          <style>{`
            @keyframes pulse-ring {
              0% { r: inherit; opacity: 0.6; }
              100% { r: 22; opacity: 0; }
            }
            .pulse-ring { animation: pulse-ring 2s ease-out infinite; }
          `}</style>
        </defs>
        <rect width={dimensions.width} height={dimensions.height} fill="url(#mapBg)" />

        {/* Country outlines */}
        <g>
          {worldData.features.map((feat, i) => (
            <path
              key={i}
              d={pathGen(feat) || ''}
              fill="rgb(203,213,225)"
              fillOpacity={0.3}
              stroke="rgb(148,163,184)"
              strokeWidth={0.5}
              strokeOpacity={0.5}
              className="dark:fill-slate-700/40 dark:stroke-slate-600/50"
            />
          ))}
        </g>

        {/* Outage markers */}
        <g>
          {markers.map((m) => (
            <g
              key={m.provider}
              transform={`translate(${m.x},${m.y})`}
              className="cursor-pointer"
              onMouseEnter={(e) => handleMouseEnter(e, m.mainOutage)}
              onMouseLeave={handleMouseLeave}
              onClick={() => onOutageClick(m.mainOutage.id)}
            >
              {/* Pulse ring for active outages */}
              {m.hasActive && (
                <circle r={m.r} fill="none" stroke="#ef4444" strokeWidth={2} className="pulse-ring" />
              )}
              {/* Main circle */}
              <circle
                r={m.r}
                fill={m.hasActive ? '#ef4444' : '#f59e0b'}
                fillOpacity={0.8}
                stroke={m.hasActive ? '#dc2626' : '#d97706'}
                strokeWidth={1.5}
              />
              {/* Count label for larger markers */}
              {m.r > 10 && (
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  fontSize={9}
                  fontWeight="bold"
                  fill="white"
                >
                  {m.totalAffected}
                </text>
              )}
            </g>
          ))}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-10 pointer-events-none px-3 py-2 rounded-lg bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs shadow-lg border border-slate-700/50 max-w-[220px]"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          <p className="font-semibold">{tooltip.outage.providerName}</p>
          <div className="flex items-center gap-2 mt-1 text-slate-300">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
              tooltip.outage.type === 'application' ? 'bg-purple-500/30 text-purple-300' : 'bg-orange-500/30 text-orange-300'
            }`}>
              {tooltip.outage.type}
            </span>
            {tooltip.outage.providerType && (
              <span className="text-[10px] text-slate-400">{providerTypeLabel(tooltip.outage.providerType)}</span>
            )}
            {tooltip.outage.asn && <span>AS{tooltip.outage.asn}</span>}
          </div>
          <div className="mt-1 text-slate-400">
            <span>{tooltip.outage.affectedTestsCount} affected tests</span>
            <span className="mx-1">&middot;</span>
            <span>{getDuration(tooltip.outage)}</span>
          </div>
          <div className="mt-1">
            <span className={`text-[10px] font-semibold ${isActive(tooltip.outage) ? 'text-red-400' : 'text-amber-400'}`}>
              {isActive(tooltip.outage) ? 'ACTIVE' : 'RESOLVED'}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 right-2 flex items-center gap-3 px-2 py-1 rounded bg-white/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 text-[10px] text-slate-600 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" /> Active
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" /> Resolved
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Watchlist Modal
// ============================================================================

function WatchlistModal({
  providers,
  watchlist,
  onToggle,
  onClose,
  catalogProviders,
}: {
  providers: string[];
  watchlist: Set<string>;
  onToggle: (name: string) => void;
  onClose: () => void;
  catalogProviders: InternetInsightsCatalogProvider[];
}) {
  const catalogMap = useMemo(() => {
    const m = new Map<string, InternetInsightsCatalogProvider>();
    for (const p of catalogProviders) m.set(p.providerName, p);
    return m;
  }, [catalogProviders]);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return providers.filter(p => p.toLowerCase().includes(q));
  }, [providers, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700/50 w-full max-w-md max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Manage Watchlist</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        {/* Search */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search providers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
        </div>
        {/* Provider list */}
        <div className="overflow-y-auto flex-1 px-2 py-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No providers found</p>
          ) : (
            filtered.map((p) => {
              const cat = catalogMap.get(p);
              return (
              <button
                key={p}
                onClick={() => onToggle(p)}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className={`w-7 h-7 rounded-full ${getProviderColor(p)} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white text-xs font-bold">{getProviderInitial(p)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-900 dark:text-white truncate block">{p}</span>
                  {cat && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {providerTypeLabel(cat.providerType)}
                      {cat.region ? ` · ${cat.region}` : ''}
                    </span>
                  )}
                </div>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  watchlist.has(p)
                    ? 'bg-purple-600 border-purple-600'
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {watchlist.has(p) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
              );
            })
          )}
        </div>
        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">{watchlist.size} provider{watchlist.size !== 1 ? 's' : ''} watched</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Panel
// ============================================================================

const WATCHLIST_KEY = 'te-internet-insights-watchlist';

function loadWatchlist(): Set<string> {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveWatchlist(wl: Set<string>) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...wl]));
}

export const InternetInsightsPanel = memo(({ onAskAI }: InternetInsightsPanelProps) => {
  // ---- State ----
  const [outages, setOutages] = useState<InternetInsightsOutage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OutageFilter>('all');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('1d');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [expandedOutage, setExpandedOutage] = useState<string | null>(null);
  const [catalogProviders, setCatalogProviders] = useState<InternetInsightsCatalogProvider[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  // Load watchlist from localStorage on mount
  useEffect(() => {
    setWatchlist(loadWatchlist());
  }, []);

  // Fetch catalog providers (for watchlist)
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(
          '/api/thousandeyes/internet-insights/catalog/providers?organization=default',
          { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }
        );
        if (resp.ok) {
          const data = await resp.json();
          const providers = data?.providers || [];
          setCatalogProviders(providers);
        }
      } catch {
        // Non-critical — watchlist still works with outage-seen providers
      }
    })();
  }, []);

  // ---- Data fetching ----
  const parseOutages = useCallback((data: any): InternetInsightsOutage[] => {
    const raw = data?.outages || data?._embedded?.outages || [];
    return raw.map((o: any) => {
      // TE API returns type: "app" for application outages, "network" for network
      const rawType = (o.type || o.outageType || 'network').toLowerCase();
      const type: 'application' | 'network' = rawType.includes('app') ? 'application' : 'network';
      return {
        id: o.id || o.outageId || String(Math.random()),
        type,
        providerName: o.providerName || o.provider?.providerName || o.provider || o.server || 'Unknown',
        providerType: o.providerType,
        name: o.name || o.applicationName || o.networkName,
        asn: o.asn ?? o.asNumber ?? o.provider?.asNumber,
        startDate: o.startDate || o.startedDate || '',
        endDate: o.endDate || o.endedDate || undefined,
        duration: o.duration ? Number(o.duration) : undefined,
        affectedTestsCount: Number(o.affectedTestsCount ?? o.affectedTestsCount ?? 0),
        affectedServersCount: o.affectedServersCount ? Number(o.affectedServersCount) : undefined,
        affectedLocationsCount: o.affectedLocationsCount ? Number(o.affectedLocationsCount) : undefined,
        affectedInterfacesCount: o.affectedInterfacesCount ? Number(o.affectedInterfacesCount) : undefined,
      };
    });
  }, []);

  const fetchOutages = useCallback(async () => {
    setLoading(true);
    try {
      // Try Internet Insights endpoint first
      let response = await fetch(
        `/api/thousandeyes/internet-insights/outages?organization=default&window=${timeWindow}`,
        { credentials: 'include' }
      );
      let data: any = null;
      if (response.ok) {
        data = await response.json();
        const parsed = parseOutages(data);
        if (parsed.length > 0) {
          setOutages(parsed);
          return;
        }
        // API returned OK but with empty outages — that's valid (no outages right now)
        if (!data?.error) {
          setOutages([]);
          return;
        }
      }
      // Fallback: try standard outages endpoint
      try {
        response = await fetch(
          `/api/thousandeyes/outages?organization=default&window=${timeWindow}`,
          { credentials: 'include' }
        );
        if (response.ok) {
          data = await response.json();
          setOutages(parseOutages(data));
          return;
        }
      } catch {
        // Fallback also failed — that's fine, continue to empty state
      }
      // Both endpoints returned no data — show empty map (not an error)
      setOutages([]);
    } catch (err) {
      console.error('Failed to fetch Internet Insights outages:', err);
      // Network-level failure — show empty state with soft warning, not blocking error
      setOutages([]);
    } finally {
      setLoading(false);
    }
  }, [timeWindow, parseOutages]);

  useEffect(() => { fetchOutages(); }, [fetchOutages]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchOutages, 60_000);
    return () => clearInterval(interval);
  }, [fetchOutages]);

  // ---- Derived data ----
  const allProviders = useMemo(() => {
    const fromOutages = outages.map(o => o.providerName);
    const fromCatalog = catalogProviders.map(p => p.providerName);
    return [...new Set([...fromOutages, ...fromCatalog])].sort();
  }, [outages, catalogProviders]);

  const filteredOutages = useMemo(() => {
    let result = outages;
    if (filter !== 'all') result = result.filter(o => o.type === filter);
    if (watchlistOnly && watchlist.size > 0) result = result.filter(o => watchlist.has(o.providerName));
    return result;
  }, [outages, filter, watchlistOnly, watchlist]);

  const totalPages = Math.max(1, Math.ceil(filteredOutages.length / pageSize));
  const paginatedOutages = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOutages.slice(start, start + pageSize);
  }, [filteredOutages, page, pageSize]);

  const stats = useMemo(() => {
    const active = outages.filter(o => !o.endDate);
    return {
      total: outages.length,
      active: active.length,
      affectedTests: outages.reduce((s, o) => s + o.affectedTestsCount, 0),
      watched: watchlist.size,
    };
  }, [outages, watchlist]);

  // ---- Watchlist handlers ----
  const toggleWatchlist = useCallback((name: string) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      saveWatchlist(next);
      return next;
    });
  }, []);

  // ---- Map click handler ----
  const scrollToOutage = useCallback((id: string) => {
    setExpandedOutage(id);
    // Find the card in the feed and scroll to it
    setTimeout(() => {
      const el = document.getElementById(`outage-card-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  // ---- Filter button class ----
  const pillClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
      active
        ? 'bg-purple-600 text-white'
        : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700/50'
    }`;

  return (
    <DashboardCard title="Internet Insights" icon={<Globe className="w-4 h-4" />} accent="purple">
      {/* ---- Stats Bar ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Activity className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Outages</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
        </div>
        <div className={`rounded-lg px-3 py-2.5 border text-center ${
          stats.active > 0
            ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
            : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50'
        }`}>
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <AlertTriangle className={`w-3 h-3 ${stats.active > 0 ? 'text-red-500' : 'text-slate-400'}`} />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active</span>
          </div>
          <p className={`text-xl font-bold ${stats.active > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
            {stats.active}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Monitor className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Affected Tests</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.affectedTests}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <BookmarkCheck className="w-3 h-3 text-purple-500" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Watched</span>
          </div>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{stats.watched}</p>
        </div>
      </div>

      {/* ---- Filter Bar ---- */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <button onClick={() => { setFilter('all'); setPage(1); }} className={pillClass(filter === 'all')}>All</button>
          <button onClick={() => { setFilter('application'); setPage(1); }} className={pillClass(filter === 'application')}>Application</button>
          <button onClick={() => { setFilter('network'); setPage(1); }} className={pillClass(filter === 'network')}>Network</button>
        </div>
        <div className="flex items-center gap-2">
          {/* Watchlist filter toggle */}
          <button
            onClick={() => { setWatchlistOnly(v => !v); setPage(1); }}
            className={`p-1.5 rounded-lg border transition-colors ${
              watchlistOnly
                ? 'bg-purple-100 dark:bg-purple-500/20 border-purple-300 dark:border-purple-500/40 text-purple-700 dark:text-purple-400'
                : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            title={watchlistOnly ? 'Show all providers' : 'Show watched only'}
          >
            {watchlistOnly ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          {/* Manage Watchlist */}
          <button
            onClick={() => setShowWatchlistModal(true)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-400 hover:border-purple-300 dark:hover:border-purple-500/40 hover:text-purple-700 dark:hover:text-purple-400 transition-colors"
          >
            Watchlist
          </button>
          {/* Time window */}
          <select
            value={timeWindow}
            onChange={(e) => { setTimeWindow(e.target.value as TimeWindow); setPage(1); }}
            className="px-2 py-1.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="1h">Last 1h</option>
            <option value="6h">Last 6h</option>
            <option value="1d">Last 24h</option>
            <option value="7d">Last 7d</option>
          </select>
        </div>
      </div>

      {/* ---- Content ---- */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          <span className="ml-2 text-sm text-slate-500">Loading Internet Insights...</span>
        </div>
      ) : (
        <>
          {/* World Map — always rendered */}
          <div className="mb-4">
            <WorldMap outages={filteredOutages} onOutageClick={scrollToOutage} catalogProviders={catalogProviders} />
          </div>

          {filteredOutages.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center">
                <Globe className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">No outages detected</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {watchlistOnly ? 'No outages for watched providers in this window' : 'All clear in the selected time window'}
              </p>
            </div>
          ) : (
            <>
              {/* ---- Outage Feed ---- */}
              <div ref={feedRef} className="space-y-2">
                {paginatedOutages.map((outage) => {
                  const active = isActive(outage);
                  const expanded = expandedOutage === outage.id;
                  return (
                    <div
                      key={outage.id}
                      id={`outage-card-${outage.id}`}
                      className={`rounded-lg border transition-all overflow-hidden ${
                        active
                          ? 'border-l-4 border-l-red-500 border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50'
                          : 'border-l-4 border-l-amber-500 border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50'
                      } ${expanded ? 'ring-1 ring-purple-400/30' : ''}`}
                    >
                      {/* Main row */}
                      <button
                        onClick={() => setExpandedOutage(expanded ? null : outage.id)}
                        className="flex items-center gap-3 w-full px-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                      >
                        {/* Provider avatar */}
                        <div className="relative flex-shrink-0">
                          <div className={`w-9 h-9 rounded-full ${getProviderColor(outage.providerName)} flex items-center justify-center`}>
                            <span className="text-white text-sm font-bold">{getProviderInitial(outage.providerName)}</span>
                          </div>
                          <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${active ? 'bg-red-500' : 'bg-amber-500'}`} />
                        </div>

                        {/* Provider + Type */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {outage.providerName}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                              outage.type === 'application'
                                ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400'
                                : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
                            }`}>
                              {outage.type}
                            </span>
                            {outage.providerType && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400">
                                {providerTypeLabel(outage.providerType)}
                              </span>
                            )}
                            {outage.asn && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-500 font-mono">AS{outage.asn}</span>
                            )}
                            <span className="text-[10px] text-slate-400">{getDuration(outage)}</span>
                          </div>
                        </div>

                        {/* Time ago */}
                        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap hidden sm:block">
                          {getRelativeTime(outage.startDate)}
                        </span>

                        {/* Affected tests */}
                        <div className="flex-shrink-0 bg-slate-100 dark:bg-slate-700/50 rounded-full px-2.5 py-1 min-w-[32px] text-center">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{outage.affectedTestsCount}</span>
                        </div>

                        {/* Expand chevron */}
                        {expanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        )}
                      </button>

                      {/* Expanded detail */}
                      {expanded && (
                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700/50 space-y-2">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            {outage.name && outage.name !== outage.providerName && (
                              <div className="col-span-2">
                                <span className="text-slate-500 dark:text-slate-400">
                                  {outage.type === 'application' ? 'Application:' : 'Network:'}
                                </span>{' '}
                                <span className="text-slate-900 dark:text-white font-medium">{outage.name}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Start:</span>{' '}
                              <span className="text-slate-900 dark:text-white font-medium">
                                {new Date(outage.startDate).toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">End:</span>{' '}
                              <span className="text-slate-900 dark:text-white font-medium">
                                {outage.endDate ? new Date(outage.endDate).toLocaleString() : 'Ongoing'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Duration:</span>{' '}
                              <span className="text-slate-900 dark:text-white font-medium">{getDuration(outage)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Affected Tests:</span>{' '}
                              <span className="text-slate-900 dark:text-white font-medium">{outage.affectedTestsCount}</span>
                            </div>
                            {outage.affectedInterfacesCount !== undefined && (
                              <div>
                                <span className="text-slate-500 dark:text-slate-400">Affected Interfaces:</span>{' '}
                                <span className="text-slate-900 dark:text-white font-medium">{outage.affectedInterfacesCount}</span>
                              </div>
                            )}
                            {outage.affectedLocationsCount !== undefined && (
                              <div>
                                <span className="text-slate-500 dark:text-slate-400">Affected Locations:</span>{' '}
                                <span className="text-slate-900 dark:text-white font-medium">{outage.affectedLocationsCount}</span>
                              </div>
                            )}
                            {outage.affectedServersCount !== undefined && (
                              <div>
                                <span className="text-slate-500 dark:text-slate-400">Affected Servers:</span>{' '}
                                <span className="text-slate-900 dark:text-white font-medium">{outage.affectedServersCount}</span>
                              </div>
                            )}
                          </div>
                          {onAskAI && (
                            <button
                              onClick={() => onAskAI(
                                `Analyze this Internet Insights outage: Provider "${outage.providerName}"` +
                                `${outage.providerType ? ` (${outage.providerType})` : ''} ` +
                                `(${outage.type}${outage.asn ? `, AS${outage.asn}` : ''}) ` +
                                `started ${outage.startDate}${outage.endDate ? `, ended ${outage.endDate}` : ', still active'}. ` +
                                `${outage.affectedTestsCount} affected tests` +
                                `${outage.affectedLocationsCount ? `, ${outage.affectedLocationsCount} locations` : ''}` +
                                `${outage.affectedInterfacesCount ? `, ${outage.affectedInterfacesCount} interfaces` : ''}. ` +
                                `What is the likely impact and recommended actions?`
                              )}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
                            >
                              <Activity className="w-3 h-3" />
                              AI Analysis
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="mt-3">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={outages.length}
                  filteredItems={filteredOutages.length}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                />
              </div>
            </>
          )}
        </>
      )}

      {/* Watchlist Modal */}
      {showWatchlistModal && (
        <WatchlistModal
          providers={allProviders}
          watchlist={watchlist}
          onToggle={toggleWatchlist}
          onClose={() => setShowWatchlistModal(false)}
          catalogProviders={catalogProviders}
        />
      )}
    </DashboardCard>
  );
});

InternetInsightsPanel.displayName = 'InternetInsightsPanel';

export default InternetInsightsPanel;
