'use client';

import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { blockSource, type ActionState } from '@/services/cardActions';
import { geoNaturalEarth1, geoPath, GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection } from 'geojson';

interface ThreatLocation {
  country: string;
  countryCode: string;
  city?: string;
  lat?: number;
  lng?: number;
  count: number;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  ips?: string[];
}

interface TargetNetwork {
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  networkName?: string;
}

interface ThreatMapCardData {
  threats?: ThreatLocation[];
  locations?: ThreatLocation[];
  totalBlocked?: number;
  targetNetwork?: TargetNetwork;
  timeRange?: string;
  networkId?: string;
  geoDisclaimer?: string;
  dataSource?: 'meraki' | 'demo';
}

interface ThreatMapCardProps {
  data: ThreatMapCardData;
  config?: {
    maxLocations?: number;
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

// ISO 3166-1 numeric to alpha-2 mapping (world-atlas uses numeric IDs)
const NUMERIC_TO_ALPHA2: Record<string, string> = {
  '4': 'AF', '8': 'AL', '12': 'DZ', '20': 'AD', '24': 'AO', '28': 'AG', '32': 'AR',
  '36': 'AU', '40': 'AT', '31': 'AZ', '44': 'BS', '48': 'BH', '50': 'BD', '51': 'AM',
  '52': 'BB', '56': 'BE', '64': 'BT', '68': 'BO', '70': 'BA', '72': 'BW', '76': 'BR',
  '84': 'BZ', '90': 'SB', '96': 'BN', '100': 'BG', '104': 'MM', '108': 'BI', '112': 'BY',
  '116': 'KH', '120': 'CM', '124': 'CA', '140': 'CF', '144': 'LK', '148': 'TD', '152': 'CL',
  '156': 'CN', '158': 'TW', '170': 'CO', '178': 'CG', '180': 'CD', '188': 'CR', '191': 'HR',
  '192': 'CU', '196': 'CY', '203': 'CZ', '204': 'BJ', '208': 'DK', '212': 'DM', '214': 'DO',
  '218': 'EC', '222': 'SV', '226': 'GQ', '231': 'ET', '232': 'ER', '233': 'EE', '242': 'FJ',
  '246': 'FI', '250': 'FR', '262': 'DJ', '266': 'GA', '268': 'GE', '270': 'GM', '276': 'DE',
  '288': 'GH', '300': 'GR', '308': 'GD', '320': 'GT', '324': 'GN', '328': 'GY', '332': 'HT',
  '340': 'HN', '348': 'HU', '352': 'IS', '356': 'IN', '360': 'ID', '364': 'IR', '368': 'IQ',
  '372': 'IE', '376': 'IL', '380': 'IT', '384': 'CI', '388': 'JM', '392': 'JP', '398': 'KZ',
  '400': 'JO', '404': 'KE', '408': 'KP', '410': 'KR', '414': 'KW', '417': 'KG', '418': 'LA',
  '422': 'LB', '426': 'LS', '428': 'LV', '430': 'LR', '434': 'LY', '440': 'LT', '442': 'LU',
  '450': 'MG', '454': 'MW', '458': 'MY', '462': 'MV', '466': 'ML', '470': 'MT', '478': 'MR',
  '480': 'MU', '484': 'MX', '496': 'MN', '498': 'MD', '499': 'ME', '504': 'MA', '508': 'MZ',
  '512': 'OM', '516': 'NA', '524': 'NP', '528': 'NL', '548': 'VU', '554': 'NZ', '558': 'NI',
  '562': 'NE', '566': 'NG', '578': 'NO', '586': 'PK', '591': 'PA', '598': 'PG', '600': 'PY',
  '604': 'PE', '608': 'PH', '616': 'PL', '620': 'PT', '624': 'GW', '626': 'TL', '630': 'PR',
  '634': 'QA', '642': 'RO', '643': 'RU', '646': 'RW', '682': 'SA', '686': 'SN', '688': 'RS',
  '694': 'SL', '702': 'SG', '703': 'SK', '704': 'VN', '705': 'SI', '706': 'SO', '710': 'ZA',
  '716': 'ZW', '724': 'ES', '728': 'SS', '729': 'SD', '740': 'SR', '748': 'SZ', '752': 'SE',
  '756': 'CH', '760': 'SY', '762': 'TJ', '764': 'TH', '768': 'TG', '780': 'TT', '784': 'AE',
  '788': 'TN', '792': 'TR', '795': 'TM', '800': 'UG', '804': 'UA', '807': 'MK', '818': 'EG',
  '826': 'GB', '834': 'TZ', '840': 'US', '854': 'BF', '858': 'UY', '860': 'UZ', '862': 'VE',
  '887': 'YE', '894': 'ZM',
};

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
  const curvature = Math.min(dist * 0.3, 80);
  const cx = midX - (dy / dist) * curvature;
  const cy = midY + (dx / dist) * curvature;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export const ThreatMapCard = memo(({ data, config }: ThreatMapCardProps) => {
  const maxLocations = config?.maxLocations ?? 10;
  const { demoMode } = useDemoMode();
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [hoveredListCountry, setHoveredListCountry] = useState<string | null>(null);
  const [selectedThreat, setSelectedThreat] = useState<ThreatLocation | null>(null);
  const [blockedIps, setBlockedIps] = useState<Set<string>>(new Set());
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
    let rawThreats = data?.threats || data?.locations || [];
    let threats = Array.isArray(rawThreats) ? rawThreats : [];

    // Generate mock data if no real data available and demo mode is enabled
    if (demoMode && (!data || threats.length === 0)) {
      threats = [
        { country: 'China', countryCode: 'CN', city: 'Beijing', lat: 39.9042, lng: 116.4074, count: 2847, severity: 'critical' as const, ips: ['103.21.244.15', '103.21.244.16', '103.21.244.17'] },
        { country: 'Russia', countryCode: 'RU', city: 'Moscow', lat: 55.7558, lng: 37.6173, count: 1923, severity: 'high' as const, ips: ['185.159.82.20', '185.159.82.21'] },
        { country: 'Brazil', countryCode: 'BR', city: 'São Paulo', lat: -23.5505, lng: -46.6333, count: 856, severity: 'medium' as const, ips: ['179.191.84.50'] },
        { country: 'India', countryCode: 'IN', city: 'Mumbai', lat: 19.0760, lng: 72.8777, count: 743, severity: 'medium' as const, ips: ['103.87.212.30', '103.87.212.31'] },
        { country: 'Nigeria', countryCode: 'NG', city: 'Lagos', lat: 6.5244, lng: 3.3792, count: 512, severity: 'high' as const, ips: ['41.58.65.80'] },
        { country: 'Vietnam', countryCode: 'VN', city: 'Hanoi', lat: 21.0285, lng: 105.8542, count: 389, severity: 'medium' as const, ips: ['113.161.72.100'] },
        { country: 'Iran', countryCode: 'IR', city: 'Tehran', lat: 35.6892, lng: 51.3890, count: 278, severity: 'low' as const, ips: ['5.160.218.40'] },
        { country: 'North Korea', countryCode: 'KP', city: 'Pyongyang', lat: 39.0392, lng: 125.7625, count: 156, severity: 'critical' as const, ips: ['175.45.176.10'] },
      ];
    }

    // Return null if still no threats
    if (threats.length === 0) return null;

    const sorted = [...threats].sort((a, b) => b.count - a.count);
    const totalBlocked = data?.totalBlocked ?? threats.reduce((sum, t) => sum + t.count, 0);
    const topLocations = sorted.slice(0, maxLocations);

    const threatsByAlpha2: Record<string, ThreatLocation[]> = {};
    for (const threat of threats) {
      const code = threat.countryCode?.toUpperCase();
      if (code) {
        if (!threatsByAlpha2[code]) threatsByAlpha2[code] = [];
        threatsByAlpha2[code].push(threat);
      }
    }

    const maxCount = sorted[0]?.count || 1;

    return {
      locations: topLocations,
      threatsByAlpha2,
      totalBlocked,
      countryCount: new Set(threats.map(t => t.countryCode)).size,
      cityCount: threats.length,
      maxCount,
      targetNetwork: data?.targetNetwork,
      geoDisclaimer: data?.geoDisclaimer,
      isLiveData: data?.dataSource === 'meraki',
    };
  }, [data, maxLocations, demoMode]);

  const { projection, pathGenerator } = useMemo(() => {
    const proj = geoNaturalEarth1()
      .scale(155)
      .translate([480, 220]) as GeoProjection;
    const path = geoPath().projection(proj);
    return { projection: proj, pathGenerator: path };
  }, []);

  const handleBlockIp = useCallback(async (ip: string) => {
    setActionState({ status: 'loading', message: `Blocking ${ip}...` });
    setBlockedIps(prev => new Set([...prev, ip]));

    const result = await blockSource({
      sourceIp: ip,
      reason: 'Blocked from Threat Map Card',
    });

    if (result.success) {
      setActionState({ status: 'success', message: `${ip} blocked` });
    } else {
      setActionState({ status: 'error', message: result.message });
      // Revert on failure
      setBlockedIps(prev => {
        const next = new Set(prev);
        next.delete(ip);
        return next;
      });
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, []);

  const handleBlockAllIps = useCallback(async (ips: string[]) => {
    setActionState({ status: 'loading', message: `Blocking ${ips.length} IPs...` });
    setBlockedIps(prev => new Set([...prev, ...ips]));

    // Block all IPs in sequence
    let successCount = 0;
    for (const ip of ips) {
      const result = await blockSource({
        sourceIp: ip,
        reason: 'Blocked from Threat Map Card',
      });
      if (result.success) successCount++;
    }

    if (successCount === ips.length) {
      setActionState({ status: 'success', message: `All ${ips.length} IPs blocked` });
    } else if (successCount > 0) {
      setActionState({ status: 'success', message: `${successCount}/${ips.length} IPs blocked` });
    } else {
      setActionState({ status: 'error', message: 'Failed to block IPs' });
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, []);

  if (!processedData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        <svg className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          No Threat Data
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          No blocked threats in the past 24 hours
        </div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
          Enable Demo Mode to see sample data
        </div>
      </div>
    );
  }

  const getAlpha2 = (numericId: string): string | undefined => NUMERIC_TO_ALPHA2[numericId];

  const alpha2ToNumeric = Object.entries(NUMERIC_TO_ALPHA2).reduce((acc, [num, alpha]) => {
    acc[alpha] = num;
    return acc;
  }, {} as Record<string, string>);

  const getThreatsByNumericId = (numericId: string): ThreatLocation[] => {
    const alpha2 = getAlpha2(numericId);
    return alpha2 ? (processedData.threatsByAlpha2[alpha2] || []) : [];
  };

  const getCountryFill = (numericId: string): string => {
    const threats = getThreatsByNumericId(numericId);
    if (threats.length === 0) return '#334155';
    const order: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const maxSeverity = threats.reduce((max, t) => {
      const severity = t.severity || 'low';
      return (order[severity] || 0) > (order[max] || 0) ? severity : max;
    }, 'low');
    return SEVERITY_COLORS[maxSeverity] || SEVERITY_COLORS.medium;
  };

  const hasThreat = (numericId: string): boolean => getThreatsByNumericId(numericId).length > 0;

  const isCountryHighlighted = (numericId: string): boolean => {
    if (hoveredCountry === numericId) return true;
    if (hoveredListCountry) {
      const numericForList = alpha2ToNumeric[hoveredListCountry];
      return numericId === numericForList;
    }
    return false;
  };

  // Target network coordinates
  const targetNetwork = processedData.targetNetwork;
  const targetCoords = targetNetwork
    ? projection([targetNetwork.lng, targetNetwork.lat])
    : projection([-122.42, 37.77]); // Default to SF
  const targetX = targetCoords?.[0] || 200;
  const targetY = targetCoords?.[1] || 180;

  const hoveredThreat = hoveredCountry
    ? getThreatsByNumericId(hoveredCountry)[0]
    : hoveredListCountry
      ? processedData.locations.find(l => l.countryCode === hoveredListCountry)
      : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Threat Origins
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

      {/* World Map - scales with both width and height */}
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
                <pattern id="threatMapGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(56,189,248,0.08)" strokeWidth="0.5" />
                </pattern>
                <filter id="threatGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <rect width="960" height="440" fill="url(#threatMapGrid)" />

              {/* Country paths */}
              {worldData.features.map((country, idx: number) => {
                const countryId = String(country.id || idx);
                const pathD = pathGenerator(country);
                const isThreat = hasThreat(countryId);
                const isHighlighted = isCountryHighlighted(countryId);
                const fillColor = getCountryFill(countryId);

                return (
                  <path
                    key={countryId}
                    d={pathD || ''}
                    fill={isHighlighted && isThreat ? '#fff' : fillColor}
                    stroke={isHighlighted ? '#fff' : isThreat ? 'rgba(0,0,0,0.3)' : '#1e293b'}
                    strokeWidth={isHighlighted ? 2 : 0.5}
                    opacity={isThreat ? 0.85 : 0.5}
                    filter={isThreat ? 'url(#threatGlow)' : undefined}
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredCountry(countryId)}
                    onMouseLeave={() => setHoveredCountry(null)}
                  />
                );
              })}

              {/* Attack lines - thickness based on threat count */}
              {processedData.locations.map((loc, idx) => {
                if (!loc.lat || !loc.lng) return null;
                const coords = projection([loc.lng, loc.lat]);
                if (!coords) return null;

                const arcPath = generateArcPath(coords[0], coords[1], targetX, targetY);
                const severity = loc.severity || 'medium';
                const color = SEVERITY_COLORS[severity];
                // Line thickness scales with threat count using sqrt for better visual distribution
                // Min 1px, max 6px - sqrt makes high-volume threats stand out more
                const ratio = loc.count / processedData.maxCount;
                const lineWidth = 1 + Math.sqrt(ratio) * 5;
                const isLineHovered = hoveredListCountry === loc.countryCode ||
                  (selectedThreat?.city === loc.city && selectedThreat?.countryCode === loc.countryCode);

                return (
                  <g
                    key={`attack-${idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredListCountry(loc.countryCode)}
                    onMouseLeave={() => setHoveredListCountry(null)}
                    onClick={() => setSelectedThreat(selectedThreat?.city === loc.city ? null : loc)}
                  >
                    {/* Invisible wider path for easier hover */}
                    <path d={arcPath} fill="none" stroke="transparent" strokeWidth={12} />
                    {/* Visible line */}
                    <path
                      d={arcPath}
                      fill="none"
                      stroke={color}
                      strokeWidth={isLineHovered ? lineWidth + 2 : lineWidth}
                      opacity={isLineHovered ? 0.8 : 0.35}
                      className="transition-all duration-150"
                    />
                    {/* Animated traveling dot */}
                    <circle r={isLineHovered ? 4 : 2.5} fill={color} opacity={0.9} className="transition-all duration-150">
                      <animateMotion dur={`${2.5 + idx * 0.2}s`} repeatCount="indefinite" begin={`${idx * 0.3}s`}>
                        <mpath href={`#attackPath-${idx}`} />
                      </animateMotion>
                    </circle>
                    <path id={`attackPath-${idx}`} d={arcPath} fill="none" stroke="none" />
                  </g>
                );
              })}

              {/* Target network */}
              <g className="cursor-pointer">
                <circle cx={targetX} cy={targetY} r={12} fill="none" stroke="#22c55e" strokeWidth={2} opacity={0.4} />
                <circle cx={targetX} cy={targetY} r={7} fill="#22c55e" stroke="#166534" strokeWidth={2} />
                <text x={targetX} y={targetY + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="7" fontWeight="bold">
                  ✓
                </text>
                {targetNetwork && (
                  <text x={targetX} y={targetY + 18} textAnchor="middle" fill="#86efac" fontSize="7" fontWeight="500">
                    {targetNetwork.city}
                  </text>
                )}
              </g>

              {/* Threat city markers - clickable */}
              {processedData.locations.map((loc, idx) => {
                if (!loc.lat || !loc.lng) return null;
                const coords = projection([loc.lng, loc.lat]);
                if (!coords) return null;

                const severity = loc.severity || 'medium';
                const color = SEVERITY_COLORS[severity];
                const size = 4 + Math.log10(loc.count + 1) * 2;
                const isHighlighted = hoveredListCountry === loc.countryCode ||
                  (selectedThreat?.city === loc.city && selectedThreat?.countryCode === loc.countryCode);

                return (
                  <g
                    key={`marker-${idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredListCountry(loc.countryCode)}
                    onMouseLeave={() => setHoveredListCountry(null)}
                    onClick={() => setSelectedThreat(selectedThreat?.city === loc.city ? null : loc)}
                  >
                    <circle cx={coords[0]} cy={coords[1]} r={size + 4} fill="none" stroke={color}
                      strokeWidth={isHighlighted ? 2 : 1} opacity={isHighlighted ? 1 : 0.5} />
                    <circle cx={coords[0]} cy={coords[1]} r={isHighlighted ? size + 2 : size}
                      fill={isHighlighted ? '#fff' : color} stroke={isHighlighted ? color : 'rgba(0,0,0,0.5)'}
                      strokeWidth={isHighlighted ? 2 : 1} className="transition-all duration-150" />
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-slate-500 text-xs">Loading map...</div>
            </div>
          )}

          {/* Hover tooltip */}
          {hoveredThreat && !selectedThreat && (
            <div className="absolute top-2 left-2 px-2.5 py-2 bg-slate-900/95 border border-slate-600 rounded-lg text-xs text-white shadow-xl z-10 backdrop-blur-sm">
              <div className="font-semibold flex items-center gap-2">
                <span className="text-lg">{getFlagEmoji(hoveredThreat.countryCode)}</span>
                <div>
                  <div>{hoveredThreat.city || hoveredThreat.country}</div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    {hoveredThreat.city ? hoveredThreat.country : ''} {hoveredThreat.severity?.toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="text-slate-300 mt-1 pt-1 border-t border-slate-700">
                <span className="text-red-400 font-bold">{hoveredThreat.count.toLocaleString()}</span> threats
              </div>
              <div className="text-[9px] text-slate-500 mt-1">Click marker to view IPs</div>
            </div>
          )}

          {/* Selected threat panel with IPs */}
          {selectedThreat && (
            <div className="absolute top-2 left-2 right-2 max-w-xs bg-slate-900/98 border border-slate-600 rounded-lg text-xs text-white shadow-xl z-20 backdrop-blur-sm">
              <div className="p-3 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getFlagEmoji(selectedThreat.countryCode)}</span>
                    <div>
                      <div className="font-semibold">{selectedThreat.city}</div>
                      <div className="text-[10px] text-slate-400">{selectedThreat.country}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedThreat(null)}
                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded font-medium ${
                    selectedThreat.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                    selectedThreat.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    selectedThreat.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {selectedThreat.severity?.toUpperCase()}
                  </span>
                  <span className="text-slate-400">{selectedThreat.count} blocked threats</span>
                </div>
              </div>

              {/* IP List */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Source IPs</span>
                  {selectedThreat.ips && selectedThreat.ips.length > 0 && (
                    <button
                      onClick={() => handleBlockAllIps(selectedThreat.ips!.filter(ip => !blockedIps.has(ip)))}
                      className="text-[9px] px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded transition-colors"
                    >
                      Block All
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-24 overflow-auto">
                  {selectedThreat.ips && selectedThreat.ips.length > 0 ? (
                    selectedThreat.ips.map((ip, i) => {
                      const isBlocked = blockedIps.has(ip);
                      return (
                        <div key={i} className="flex items-center justify-between py-1 px-2 bg-slate-800 rounded">
                          <code className={`text-[10px] font-mono ${isBlocked ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                            {ip}
                          </code>
                          {isBlocked ? (
                            <span className="text-[9px] text-slate-500">Blocked</span>
                          ) : (
                            <button
                              onClick={() => handleBlockIp(ip)}
                              className="text-[9px] px-2 py-0.5 bg-red-600/80 hover:bg-red-500 rounded transition-colors"
                            >
                              Block
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[10px] text-slate-500 text-center py-2">No IPs available</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-2 right-2 flex flex-col gap-1 px-2 py-1.5 bg-slate-900/90 rounded text-[9px] text-slate-300 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" /> Critical
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500" /> High
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500" /> Medium
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Low
              </span>
            </div>
          </div>

          {/* Stats badge */}
          <div className="absolute bottom-2 left-2 px-2 py-1.5 bg-slate-900/90 rounded text-[9px] text-slate-300 backdrop-blur-sm">
            <div className="font-semibold text-white">{processedData.cityCount} cities</div>
            <div className="text-slate-400">{processedData.countryCount} countries</div>
          </div>
        </div>
      </div>

      {/* City sources list */}
      <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 max-h-24 overflow-auto">
        <div className="px-3 py-2">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {processedData.locations.slice(0, 6).map((location, idx) => {
              const severityColor = SEVERITY_COLORS[location.severity || 'medium'];
              const isHighlighted = hoveredListCountry === location.countryCode;
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between py-0.5 px-1 rounded cursor-pointer transition-colors ${
                    isHighlighted ? 'bg-slate-200 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  onMouseEnter={() => setHoveredListCountry(location.countryCode)}
                  onMouseLeave={() => setHoveredListCountry(null)}
                  onClick={() => setSelectedThreat(location)}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: severityColor }} />
                    <span className={`text-[10px] truncate ${
                      isHighlighted ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-600 dark:text-slate-400'
                    }`}>
                      {getFlagEmoji(location.countryCode)} {location.city || location.country}
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold tabular-nums ml-1 ${
                    isHighlighted ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {location.count}
                  </span>
                </div>
              );
            })}
          </div>
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

ThreatMapCard.displayName = 'ThreatMapCard';

export default ThreatMapCard;
