'use client';

import { memo, type ReactElement } from 'react';

interface DeviceTypeIconProps {
  type: string;
  className?: string;
}

// SVG icons for different device types
const icons: Record<string, ReactElement> = {
  // Network switch
  switch: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="10" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  ms: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="10" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  // Router
  router: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
  // Firewall / Security appliance (MX)
  firewall: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  mx: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  appliance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  // Wireless access point (MR)
  access_point: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  mr: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  wireless: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  // Camera (MV)
  camera: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  mv: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  // Sensor (MT)
  sensor: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" />
    </svg>
  ),
  mt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" />
    </svg>
  ),
  // Cellular gateway (MG)
  cellular: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M9 18h6" />
      <path d="M12 6v8" />
      <path d="M9 9l3-3 3 3" />
    </svg>
  ),
  mg: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M9 18h6" />
      <path d="M12 6v8" />
      <path d="M9 9l3-3 3 3" />
    </svg>
  ),
  // Server
  server: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <circle cx="6" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="6" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  // Default device
  default: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
      <path d="M4 14h16" />
    </svg>
  ),
};

export const DeviceTypeIcon = memo(({ type, className = 'w-5 h-5' }: DeviceTypeIconProps) => {
  // Normalize type to lowercase and extract prefix (e.g., "MX68" -> "mx")
  const normalizedType = type?.toLowerCase().replace(/[^a-z]/g, '') || 'default';

  // Try to find matching icon by checking prefixes
  const getIcon = () => {
    // Direct match
    if (icons[normalizedType]) return icons[normalizedType];

    // Check for Meraki product prefixes
    if (normalizedType.startsWith('mx')) return icons.mx;
    if (normalizedType.startsWith('ms')) return icons.ms;
    if (normalizedType.startsWith('mr')) return icons.mr;
    if (normalizedType.startsWith('mv')) return icons.mv;
    if (normalizedType.startsWith('mt')) return icons.mt;
    if (normalizedType.startsWith('mg')) return icons.mg;

    // Keyword matching
    if (normalizedType.includes('switch')) return icons.switch;
    if (normalizedType.includes('router')) return icons.router;
    if (normalizedType.includes('firewall') || normalizedType.includes('appliance')) return icons.firewall;
    if (normalizedType.includes('wireless') || normalizedType.includes('access')) return icons.access_point;
    if (normalizedType.includes('camera')) return icons.camera;
    if (normalizedType.includes('sensor')) return icons.sensor;
    if (normalizedType.includes('cellular')) return icons.cellular;
    if (normalizedType.includes('server')) return icons.server;

    return icons.default;
  };

  return <span className={className}>{getIcon()}</span>;
});

DeviceTypeIcon.displayName = 'DeviceTypeIcon';

export default DeviceTypeIcon;
