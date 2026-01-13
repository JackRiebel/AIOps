'use client';

import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, Loader2, AlertCircle, Search, X, Check } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SmartSelectProps {
  value: string | undefined;
  onChange: (value: string) => void;
  options: SelectOption[];
  loading: boolean;
  error: string | null;
  placeholder: string;
  disabled?: boolean;
  searchable?: boolean;
}

// ============================================================================
// Reusable Searchable Select Component
// ============================================================================

const SearchableSelect = memo(({
  value,
  onChange,
  options,
  loading,
  error,
  placeholder,
  disabled = false,
  searchable = true,
}: SmartSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(o => o.value === value);

  const filteredOptions = search
    ? options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.sublabel?.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when search changes
  const handleSearchChange = useCallback((newSearch: string) => {
    setSearch(newSearch);
    setHighlightedIndex(0);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        setIsOpen(false);
        setSearch('');
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(i => Math.min(i + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
          setSearch('');
        }
        break;
    }
  }, [isOpen, filteredOptions, highlightedIndex, onChange]);

  const handleSelect = useCallback((optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch('');
  }, [onChange]);

  if (loading) {
    return (
      <div className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-600 text-slate-400 text-sm flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full px-3 py-2 rounded-lg bg-slate-900/50 border text-sm text-left flex items-center justify-between transition-colors ${
          disabled
            ? 'border-slate-700 text-slate-500 cursor-not-allowed'
            : isOpen
              ? 'border-cyan-500 ring-1 ring-cyan-500/50'
              : 'border-slate-600 text-white hover:border-slate-500'
        }`}
      >
        <span className={selectedOption ? 'text-white' : 'text-slate-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          {searchable && options.length > 5 && (
            <div className="p-2 border-b border-slate-700">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="w-full pl-8 pr-8 py-1.5 rounded bg-slate-900/50 border border-slate-600 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                {search && (
                  <button
                    onClick={() => handleSearchChange('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-700"
                  >
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                {search ? 'No matches found' : 'No options available'}
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                    index === highlightedIndex ? 'bg-slate-700' : 'hover:bg-slate-700/50'
                  } ${option.value === value ? 'text-cyan-400' : 'text-white'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{option.label}</div>
                    {option.sublabel && (
                      <div className="text-xs text-slate-500 truncate">{option.sublabel}</div>
                    )}
                  </div>
                  {option.value === value && <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});

SearchableSelect.displayName = 'SearchableSelect';

// ============================================================================
// Organization Select
// ============================================================================

interface OrganizationSelectProps {
  value: string | undefined;
  onChange: (value: string) => void;
}

export const OrganizationSelect = memo(({ value, onChange }: OrganizationSelectProps) => {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        setLoading(true);
        setError(null);
        // Use network-platforms endpoint which returns configured Meraki/Catalyst orgs
        const response = await fetch('/api/organizations/network-platforms', {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to load organizations');
        const orgs = await response.json();
        // Filter to only Meraki organizations for Meraki actions
        const merakiOrgs = orgs.filter((org: { platform: string }) => org.platform === 'meraki');
        setOptions(merakiOrgs.map((org: { name: string; display_name: string }) => ({
          value: org.name, // Use name as value (needed for API calls)
          label: org.display_name || org.name,
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchOrganizations();
  }, []);

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={options}
      loading={loading}
      error={error}
      placeholder="Select organization..."
    />
  );
});

OrganizationSelect.displayName = 'OrganizationSelect';

// ============================================================================
// Network Select
// ============================================================================

interface NetworkSelectProps {
  value: string | undefined;
  onChange: (value: string) => void;
  organizationName: string | undefined;
}

export const NetworkSelect = memo(({ value, onChange, organizationName }: NetworkSelectProps) => {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationName) {
      setOptions([]);
      return;
    }

    const fetchNetworks = async () => {
      try {
        setLoading(true);
        setError(null);
        // Use the networks endpoint with organization query param
        const response = await fetch(`/api/meraki/networks?organization=${encodeURIComponent(organizationName)}`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to load networks');
        const networks = await response.json();
        setOptions(networks.map((net: { id: string; name: string; productTypes?: string[] }) => ({
          value: net.id,
          label: net.name,
          sublabel: net.productTypes?.join(', '),
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchNetworks();
  }, [organizationName]);

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={options}
      loading={loading}
      error={error}
      placeholder={organizationName ? 'Select network...' : 'Select organization first'}
      disabled={!organizationName}
    />
  );
});

NetworkSelect.displayName = 'NetworkSelect';

// ============================================================================
// Device Select
// ============================================================================

interface DeviceSelectProps {
  value: string | undefined;
  onChange: (value: string) => void;
  networkId: string | undefined;
  organizationName: string | undefined;
}

export const DeviceSelect = memo(({ value, onChange, networkId, organizationName }: DeviceSelectProps) => {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[DeviceSelect] networkId:', networkId, 'organizationName:', organizationName);
    if (!networkId || !organizationName) {
      setOptions([]);
      return;
    }

    const fetchDevices = async () => {
      try {
        setLoading(true);
        setError(null);
        const url = `/api/meraki/networks/${networkId}/devices?organization=${encodeURIComponent(organizationName)}`;
        console.log('[DeviceSelect] Fetching:', url);
        const response = await fetch(url, { credentials: 'include' });
        console.log('[DeviceSelect] Response status:', response.status);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.log('[DeviceSelect] Error response:', errorData);
          throw new Error(errorData.detail || 'Failed to load devices');
        }
        const devices = await response.json();
        console.log('[DeviceSelect] Devices:', devices);
        setOptions(devices.map((dev: { serial: string; name?: string; model?: string; status?: string }) => ({
          value: dev.serial,
          label: dev.name || dev.serial,
          sublabel: `${dev.model || 'Unknown'} - ${dev.serial}${dev.status ? ` (${dev.status})` : ''}`,
        })));
      } catch (err) {
        console.error('[DeviceSelect] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchDevices();
  }, [networkId, organizationName]);

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={options}
      loading={loading}
      error={error}
      placeholder={networkId ? 'Select device...' : 'Select network first'}
      disabled={!networkId}
    />
  );
});

DeviceSelect.displayName = 'DeviceSelect';

// ============================================================================
// Client Select
// ============================================================================

interface ClientSelectProps {
  value: string | undefined;
  onChange: (value: string) => void;
  networkId: string | undefined;
  organizationName: string | undefined;
}

export const ClientSelect = memo(({ value, onChange, networkId, organizationName }: ClientSelectProps) => {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!networkId || !organizationName) {
      setOptions([]);
      return;
    }

    const fetchClients = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/meraki/networks/${networkId}/clients?organization=${encodeURIComponent(organizationName)}`,
          { credentials: 'include' }
        );
        if (!response.ok) throw new Error('Failed to load clients');
        const clients = await response.json();
        setOptions(clients.map((client: { id: string; mac: string; description?: string; ip?: string }) => ({
          value: client.id || client.mac,
          label: client.description || client.mac,
          sublabel: `${client.mac}${client.ip ? ` - ${client.ip}` : ''}`,
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [networkId, organizationName]);

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={options}
      loading={loading}
      error={error}
      placeholder={networkId ? 'Select client...' : 'Select network first'}
      disabled={!networkId}
    />
  );
});

ClientSelect.displayName = 'ClientSelect';

// ============================================================================
// Smart Parameter Field (Main Export)
// ============================================================================

interface SmartParameterFieldProps {
  type: 'organization' | 'network' | 'device' | 'client' | 'ssid';
  value: string | undefined;
  onChange: (value: string) => void;
  allParams: Record<string, unknown>; // All parameter values for resolving dependencies
  label: string;
  required?: boolean;
}

export const SmartParameterField = memo(({
  type,
  value,
  onChange,
  allParams,
  label,
  required,
}: SmartParameterFieldProps) => {
  // Extract common parameter values
  const organizationName = allParams.organization as string | undefined;
  const networkId = allParams.networkId as string | undefined;

  // Debug logging
  if (type === 'device' || type === 'client') {
    console.log(`[SmartParameterField:${type}] allParams:`, allParams);
    console.log(`[SmartParameterField:${type}] organizationName:`, organizationName, 'networkId:', networkId);
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {type === 'organization' && (
        <OrganizationSelect value={value} onChange={onChange} />
      )}
      {type === 'network' && (
        <NetworkSelect value={value} onChange={onChange} organizationName={organizationName} />
      )}
      {type === 'device' && (
        <DeviceSelect value={value} onChange={onChange} networkId={networkId} organizationName={organizationName} />
      )}
      {type === 'client' && (
        <ClientSelect value={value} onChange={onChange} networkId={networkId} organizationName={organizationName} />
      )}
    </div>
  );
});

SmartParameterField.displayName = 'SmartParameterField';

export default SmartParameterField;
