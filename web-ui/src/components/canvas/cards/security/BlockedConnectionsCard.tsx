'use client';

import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { createFirewallException, type ActionState } from '@/services/cardActions';
import { geoNaturalEarth1, geoPath, GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';

interface BlockedConnection {
  id?: string;
  timestamp: string;
  sourceIp: string;
  destinationIp: string;
  port: number;
  protocol: string;
  reason: string;
  category?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  city?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
  bytesBlocked?: number;
  packetsBlocked?: number;
}

interface BlockedConnectionsCardData {
  connections?: BlockedConnection[];
  blocked?: BlockedConnection[];
  blockedConnections?: BlockedConnection[];
  totalBlocked?: number;
  timeRange?: string;
  networkId?: string;
  targetNetwork?: {
    city: string;
    country: string;
    lat: number;
    lng: number;
  };
  geoDisclaimer?: string;
  dataSource?: 'meraki' | 'demo';
}

interface BlockedConnectionsCardProps {
  data: BlockedConnectionsCardData;
  config?: {
    maxConnections?: number;
  };
}

interface CountryProperties {
  name: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
};

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  malware: { icon: '🦠', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  'web-attack': { icon: '🌐', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  botnet: { icon: '🤖', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  scan: { icon: '🔍', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  bruteforce: { icon: '🔓', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  ddos: { icon: '💥', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  policy: { icon: '📋', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  ratelimit: { icon: '⏱️', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  other: { icon: '⛔', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700' },
};

// ISO 3166-1 numeric to alpha-2 mapping
const NUMERIC_TO_ALPHA2: Record<string, string> = {
  '4': 'AF', '8': 'AL', '12': 'DZ', '24': 'AO', '32': 'AR', '36': 'AU', '40': 'AT',
  '50': 'BD', '56': 'BE', '76': 'BR', '100': 'BG', '104': 'MM', '112': 'BY', '124': 'CA',
  '156': 'CN', '170': 'CO', '180': 'CD', '188': 'CR', '191': 'HR', '196': 'CY', '203': 'CZ',
  '208': 'DK', '218': 'EC', '818': 'EG', '233': 'EE', '231': 'ET', '246': 'FI', '250': 'FR',
  '276': 'DE', '288': 'GH', '300': 'GR', '348': 'HU', '356': 'IN', '360': 'ID', '364': 'IR',
  '368': 'IQ', '372': 'IE', '376': 'IL', '380': 'IT', '392': 'JP', '400': 'JO', '398': 'KZ',
  '404': 'KE', '408': 'KP', '410': 'KR', '414': 'KW', '422': 'LB', '434': 'LY', '440': 'LT',
  '458': 'MY', '484': 'MX', '504': 'MA', '528': 'NL', '554': 'NZ', '566': 'NG', '578': 'NO',
  '586': 'PK', '604': 'PE', '608': 'PH', '616': 'PL', '620': 'PT', '634': 'QA', '642': 'RO',
  '643': 'RU', '682': 'SA', '688': 'RS', '702': 'SG', '703': 'SK', '705': 'SI', '710': 'ZA',
  '724': 'ES', '752': 'SE', '756': 'CH', '760': 'SY', '764': 'TH', '792': 'TR', '804': 'UA',
  '784': 'AE', '826': 'GB', '840': 'US', '858': 'UY', '860': 'UZ', '862': 'VE', '704': 'VN',
  '887': 'YE', '894': 'ZM', '716': 'ZW',
};

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function generateArcPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const curvature = Math.min(dist * 0.3, 60);
  const cx = midX - (dy / dist) * curvature;
  const cy = midY + (dx / dist) * curvature;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export const BlockedConnectionsCard = memo(({ data, config }: BlockedConnectionsCardProps) => {
  const maxConnections = config?.maxConnections ?? 15;
  const { demoMode } = useDemoMode();
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  const [hoveredListItem, setHoveredListItem] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<BlockedConnection | null>(null);
  const [whitelistedIps, setWhitelistedIps] = useState<Set<string>>(new Set());
  const [worldData, setWorldData] = useState<FeatureCollection | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  useEffect(() => {
    import('world-atlas/countries-110m.json').then((topology) => {
      const topoData = topology.default as unknown as Topology<{ countries: GeometryCollection<CountryProperties> }>;
      const countries = feature(topoData, topoData.objects.countries) as FeatureCollection;
      setWorldData(countries);
    });
  }, []);

  const processedData = useMemo(() => {
    // Step 1: Try to get real data from props
    const rawConnections = data?.connections || data?.blocked || data?.blockedConnections || [];
    const realConnections = Array.isArray(rawConnections) ? rawConnections : [];

    let connections: BlockedConnection[];

    // Step 2: Determine data source based on real data availability and demo mode
    if (realConnections.length > 0) {
      // Use real data (regardless of demo mode)
      connections = realConnections;
    } else if (demoMode) {
      // No real data AND demo mode is ON - generate demo data
      const now = new Date();
      connections = [
        { id: 'bc-001', timestamp: new Date(now.getTime() - 30000).toISOString(), sourceIp: '185.220.101.45', destinationIp: '10.0.1.50', port: 22, protocol: 'TCP', reason: 'SSH Brute Force', category: 'bruteforce', severity: 'critical' as const, city: 'Moscow', country: 'Russia', countryCode: 'RU', lat: 55.7558, lng: 37.6173, bytesBlocked: 45000, packetsBlocked: 380 },
        { id: 'bc-002', timestamp: new Date(now.getTime() - 60000).toISOString(), sourceIp: '103.21.244.15', destinationIp: '10.0.2.100', port: 445, protocol: 'TCP', reason: 'SMB Exploit Attempt', category: 'malware', severity: 'critical' as const, city: 'Beijing', country: 'China', countryCode: 'CN', lat: 39.9042, lng: 116.4074, bytesBlocked: 128000, packetsBlocked: 890 },
        { id: 'bc-003', timestamp: new Date(now.getTime() - 120000).toISOString(), sourceIp: '41.58.65.80', destinationIp: '10.0.1.25', port: 3389, protocol: 'TCP', reason: 'RDP Scan', category: 'scan', severity: 'high' as const, city: 'Lagos', country: 'Nigeria', countryCode: 'NG', lat: 6.5244, lng: 3.3792, bytesBlocked: 12000, packetsBlocked: 95 },
        { id: 'bc-004', timestamp: new Date(now.getTime() - 180000).toISOString(), sourceIp: '179.191.84.50', destinationIp: '10.0.3.200', port: 80, protocol: 'TCP', reason: 'SQL Injection', category: 'web-attack', severity: 'high' as const, city: 'São Paulo', country: 'Brazil', countryCode: 'BR', lat: -23.5505, lng: -46.6333, bytesBlocked: 8500, packetsBlocked: 42 },
        { id: 'bc-005', timestamp: new Date(now.getTime() - 240000).toISOString(), sourceIp: '113.161.72.100', destinationIp: '10.0.1.10', port: 443, protocol: 'TCP', reason: 'Botnet C2 Communication', category: 'botnet', severity: 'critical' as const, city: 'Hanoi', country: 'Vietnam', countryCode: 'VN', lat: 21.0285, lng: 105.8542, bytesBlocked: 256000, packetsBlocked: 1200 },
        { id: 'bc-006', timestamp: new Date(now.getTime() - 300000).toISOString(), sourceIp: '5.160.218.40', destinationIp: '10.0.2.50', port: 8080, protocol: 'TCP', reason: 'Rate Limit Exceeded', category: 'ratelimit', severity: 'medium' as const, city: 'Tehran', country: 'Iran', countryCode: 'IR', lat: 35.6892, lng: 51.3890, bytesBlocked: 2500000, packetsBlocked: 15000 },
      ];
    } else {
      // No real data AND demo mode is OFF - return null to show "no data" message
      return null;
    }

    // Sort by timestamp (newest first)
    const sorted = [...connections].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Group by location for map markers
    const locationGroups: Record<string, { connections: BlockedConnection[]; lat: number; lng: number; city: string; country: string; countryCode: string }> = {};
    for (const conn of connections) {
      if (conn.lat && conn.lng && conn.city) {
        const key = `${conn.city}-${conn.countryCode}`;
        if (!locationGroups[key]) {
          locationGroups[key] = {
            connections: [],
            lat: conn.lat,
            lng: conn.lng,
            city: conn.city,
            country: conn.country || '',
            countryCode: conn.countryCode || '',
          };
        }
        locationGroups[key].connections.push(conn);
      }
    }

    // Category counts
    const categoryCounts: Record<string, number> = {};
    for (const conn of connections) {
      const cat = conn.category || 'other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    const sortedCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));

    // Countries with blocks
    const countriesWithBlocks = new Set(connections.map(c => c.countryCode).filter(Boolean));

    return {
      connections: sorted.slice(0, maxConnections),
      allConnections: sorted,
      totalBlocked: data?.totalBlocked ?? connections.length,
      categories: sortedCategories,
      locationGroups: Object.values(locationGroups),
      countriesWithBlocks,
      // Only use demo fallback location if demo mode is ON and no real targetNetwork
      targetNetwork: data?.targetNetwork || (demoMode ? { city: 'San Francisco', country: 'US', lat: 37.77, lng: -122.42 } : null),
      geoDisclaimer: data?.geoDisclaimer,
      isLiveData: data?.dataSource === 'meraki',
    };
  }, [data, maxConnections, demoMode]);

  const { projection, pathGenerator } = useMemo(() => {
    const proj = geoNaturalEarth1()
      .scale(155)
      .translate([480, 220]) as GeoProjection;
    const path = geoPath().projection(proj);
    return { projection: proj, pathGenerator: path };
  }, []);

  const handleWhitelistIp = useCallback(async (ip: string) => {
    setActionState({ status: 'loading', message: `Whitelisting ${ip}...` });
    setWhitelistedIps(prev => new Set([...prev, ip]));

    const result = await createFirewallException({
      sourceIp: ip,
      reason: 'Whitelisted from Blocked Connections Card',
    });

    if (result.success) {
      setActionState({ status: 'success', message: `${ip} whitelisted` });
    } else {
      setActionState({ status: 'error', message: result.message });
      // Revert on failure
      setWhitelistedIps(prev => {
        const next = new Set(prev);
        next.delete(ip);
        return next;
      });
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, []);

  if (!processedData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        <svg className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          No Blocked Connections
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          No connections blocked in the past 24 hours
        </div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
          Enable Demo Mode to see sample data
        </div>
      </div>
    );
  }

  const getAlpha2 = (numericId: string): string | undefined => NUMERIC_TO_ALPHA2[numericId];

  const hasBlocks = (numericId: string): boolean => {
    const alpha2 = getAlpha2(numericId);
    return alpha2 ? processedData.countriesWithBlocks.has(alpha2) : false;
  };

  const isHighlighted = (id: string): boolean => {
    return hoveredConnection === id || hoveredListItem === id;
  };

  // Target network coordinates (null if no target network data and demo mode is off)
  const targetCoords = processedData.targetNetwork
    ? projection([processedData.targetNetwork.lng, processedData.targetNetwork.lat])
    : null;
  const targetX = targetCoords?.[0] || 200;
  const targetY = targetCoords?.[1] || 180;
  const hasTargetNetwork = !!processedData.targetNetwork;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Blocked Connections
          </span>
          <div className="flex items-center gap-2">
            {processedData.isLiveData ? (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                Live Data
              </span>
            ) : (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                Demo
              </span>
            )}
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
              {processedData.totalBlocked.toLocaleString()} blocked
            </span>
          </div>
        </div>
      </div>

      {/* World Map */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 bg-slate-900 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0c1929] to-[#0a1525]" />

          {worldData ? (
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 960 440"
              preserveAspectRatio="none"
            >
              <defs>
                <pattern id="blockedGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(239,68,68,0.06)" strokeWidth="0.5" />
                </pattern>
                <filter id="blockGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <rect width="960" height="440" fill="url(#blockedGrid)" />

              {/* Country paths */}
              {worldData.features.map((country, idx: number) => {
                const countryId = String(country.id || idx);
                const pathD = pathGenerator(country);
                const hasBlockedTraffic = hasBlocks(countryId);

                return (
                  <path
                    key={countryId}
                    d={pathD || ''}
                    fill={hasBlockedTraffic ? '#dc2626' : '#334155'}
                    stroke={hasBlockedTraffic ? 'rgba(0,0,0,0.3)' : '#1e293b'}
                    strokeWidth={0.5}
                    opacity={hasBlockedTraffic ? 0.7 : 0.5}
                    filter={hasBlockedTraffic ? 'url(#blockGlow)' : undefined}
                    className="transition-all duration-200"
                  />
                );
              })}

              {/* Block lines from sources to target - only render if target network is known */}
              {hasTargetNetwork && processedData.locationGroups.map((loc, idx) => {
                const coords = projection([loc.lng, loc.lat]);
                if (!coords) return null;

                const arcPath = generateArcPath(coords[0], coords[1], targetX, targetY);
                const count = loc.connections.length;
                const lineWidth = 1 + Math.sqrt(count / processedData.locationGroups.length) * 3;
                const isActive = loc.connections.some(c => isHighlighted(c.id || ''));

                return (
                  <g key={`line-${idx}`}>
                    <path d={arcPath} fill="none" stroke="transparent" strokeWidth={10} />
                    <path
                      d={arcPath}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth={isActive ? lineWidth + 1 : lineWidth}
                      opacity={isActive ? 0.7 : 0.3}
                      className="transition-all duration-150"
                    />
                    {/* Animated dot */}
                    <circle r={isActive ? 3 : 2} fill="#ef4444" opacity={0.8}>
                      <animateMotion dur={`${2 + idx * 0.3}s`} repeatCount="indefinite" begin={`${idx * 0.2}s`}>
                        <mpath href={`#blockPath-${idx}`} />
                      </animateMotion>
                    </circle>
                    <path id={`blockPath-${idx}`} d={arcPath} fill="none" stroke="none" />
                  </g>
                );
              })}

              {/* Target network - only render if target network location is known */}
              {hasTargetNetwork && (
                <g>
                  <circle cx={targetX} cy={targetY} r={10} fill="none" stroke="#22c55e" strokeWidth={2} opacity={0.4} />
                  <circle cx={targetX} cy={targetY} r={6} fill="#22c55e" stroke="#166534" strokeWidth={1.5} />
                  <text x={targetX} y={targetY + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="6" fontWeight="bold">
                    ✓
                  </text>
                </g>
              )}

              {/* Source markers */}
              {processedData.locationGroups.map((loc, idx) => {
                const coords = projection([loc.lng, loc.lat]);
                if (!coords) return null;

                const count = loc.connections.length;
                const size = 3 + Math.log10(count + 1) * 3;
                const isActive = loc.connections.some(c => isHighlighted(c.id || ''));

                return (
                  <g
                    key={`marker-${idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => {
                      if (loc.connections[0]?.id) setHoveredConnection(loc.connections[0].id);
                    }}
                    onMouseLeave={() => setHoveredConnection(null)}
                    onClick={() => setSelectedConnection(loc.connections[0])}
                  >
                    <circle
                      cx={coords[0]}
                      cy={coords[1]}
                      r={size + 3}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth={isActive ? 2 : 1}
                      opacity={isActive ? 1 : 0.5}
                    />
                    <circle
                      cx={coords[0]}
                      cy={coords[1]}
                      r={isActive ? size + 1 : size}
                      fill={isActive ? '#fff' : '#ef4444'}
                      stroke={isActive ? '#ef4444' : 'rgba(0,0,0,0.5)'}
                      strokeWidth={1}
                      className="transition-all duration-150"
                    />
                    {count > 1 && (
                      <text
                        x={coords[0]}
                        y={coords[1] + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={isActive ? '#ef4444' : '#fff'}
                        fontSize="7"
                        fontWeight="bold"
                      >
                        {count}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-slate-500 text-xs">Loading map...</div>
            </div>
          )}

          {/* Category legend */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[200px]">
            {processedData.categories.slice(0, 4).map(({ category, count }) => {
              const cfg = CATEGORY_CONFIG[category.toLowerCase()] || CATEGORY_CONFIG.other;
              return (
                <span
                  key={category}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-900/80 backdrop-blur-sm ${cfg.color}`}
                >
                  <span>{cfg.icon}</span>
                  <span className="opacity-80">{count}</span>
                </span>
              );
            })}
          </div>

          {/* Selected connection details panel */}
          {selectedConnection && (
            <div className="absolute top-2 right-2 w-56 bg-slate-900/95 border border-slate-600 rounded-lg text-xs text-white shadow-xl z-20 backdrop-blur-sm">
              <div className="p-2.5 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{getFlagEmoji(selectedConnection.countryCode || '')}</span>
                    <div>
                      <div className="font-semibold">{selectedConnection.city}</div>
                      <div className="text-[10px] text-slate-400">{selectedConnection.country}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedConnection(null)}
                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-2.5 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <div className="text-slate-400">Source IP</div>
                    <code className="text-slate-200 font-mono">{selectedConnection.sourceIp}</code>
                  </div>
                  <div>
                    <div className="text-slate-400">Destination</div>
                    <code className="text-slate-200 font-mono">{selectedConnection.destinationIp}:{selectedConnection.port}</code>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                    selectedConnection.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                    selectedConnection.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    selectedConnection.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {selectedConnection.severity?.toUpperCase()}
                  </span>
                  <span className="text-slate-400">{selectedConnection.reason}</span>
                </div>

                {selectedConnection.bytesBlocked && (
                  <div className="text-[10px] text-slate-400">
                    Blocked: {formatBytes(selectedConnection.bytesBlocked)} / {selectedConnection.packetsBlocked?.toLocaleString()} packets
                  </div>
                )}

                <div className="pt-2 border-t border-slate-700 flex gap-2">
                  {whitelistedIps.has(selectedConnection.sourceIp) ? (
                    <span className="flex-1 text-center py-1.5 text-[10px] text-slate-500 bg-slate-800 rounded">
                      ✓ Whitelisted
                    </span>
                  ) : (
                    <button
                      onClick={() => handleWhitelistIp(selectedConnection.sourceIp)}
                      className="flex-1 py-1.5 text-[10px] bg-green-600 hover:bg-green-500 rounded transition-colors font-medium"
                    >
                      Whitelist IP
                    </button>
                  )}
                  <button
                    className="flex-1 py-1.5 text-[10px] bg-slate-700 hover:bg-slate-600 rounded transition-colors font-medium"
                  >
                    View Logs
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stats badge */}
          <div className="absolute bottom-2 left-2 px-2 py-1.5 bg-slate-900/90 rounded text-[9px] text-slate-300 backdrop-blur-sm">
            <div className="font-semibold text-white">{processedData.locationGroups.length} sources</div>
            <div className="text-slate-400">{processedData.countriesWithBlocks.size} countries</div>
          </div>
        </div>
      </div>

      {/* Connections list */}
      <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 max-h-28 overflow-auto bg-white dark:bg-slate-900">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {processedData.connections.slice(0, 6).map((conn, idx) => {
            const cfg = CATEGORY_CONFIG[conn.category?.toLowerCase() || 'other'] || CATEGORY_CONFIG.other;
            const isActive = isHighlighted(conn.id || `conn-${idx}`);
            const isWhitelisted = whitelistedIps.has(conn.sourceIp);

            return (
              <div
                key={conn.id || idx}
                className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition-colors ${
                  isActive ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                } ${isWhitelisted ? 'opacity-50' : ''}`}
                onMouseEnter={() => setHoveredListItem(conn.id || `conn-${idx}`)}
                onMouseLeave={() => setHoveredListItem(null)}
                onClick={() => setSelectedConnection(conn)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    conn.severity === 'critical' ? 'bg-red-500' :
                    conn.severity === 'high' ? 'bg-orange-500' :
                    conn.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <span className="text-[10px]">{getFlagEmoji(conn.countryCode || '')}</span>
                  <code className="text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate">
                    {conn.sourceIp}
                  </code>
                  <span className={`text-[9px] ${cfg.color}`}>{cfg.icon}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] text-slate-500 dark:text-slate-400">
                    {formatTimeAgo(conn.timestamp)}
                  </span>
                  {isWhitelisted && (
                    <span className="text-[8px] text-green-500">✓</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Geo disclaimer footer */}
      {processedData.geoDisclaimer && (
        <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">
            ℹ️ {processedData.geoDisclaimer}
          </p>
        </div>
      )}
    </div>
  );
});

BlockedConnectionsCard.displayName = 'BlockedConnectionsCard';

export default BlockedConnectionsCard;
