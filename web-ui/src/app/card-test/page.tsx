'use client';

/**
 * Card Test Page
 *
 * Hidden test page for viewing all card types with real API data.
 * Access at /card-test - not linked in navigation.
 *
 * Use this to verify which card types are working correctly.
 */

import { useState, useEffect, useMemo } from 'react';
import { SmartCardWrapper } from '../chat-v2/cards/SmartCardWrapper';
import {
  CARD_REGISTRY,
  getAllCardTypes,
  generateCardsForPlatform,
  generateCard,
  type CardScope,
} from '../chat-v2/cards/registry';
import type { SmartCard, CardPlatform, AllCardTypes } from '../chat-v2/cards/types';

// =============================================================================
// Types
// =============================================================================

interface Organization {
  id: number;
  name: string;
  display_name?: string;
  platform: 'meraki' | 'catalyst';
  is_active: boolean;
}

interface Network {
  id: string;
  name: string;
  organizationId?: string;
}

// =============================================================================
// Component
// =============================================================================

export default function CardTestPage() {
  // API data state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<CardPlatform | 'all'>('meraki');
  const [filterStatus, setFilterStatus] = useState<'all' | 'working' | 'broken'>('all');

  // Generated cards
  const [cards, setCards] = useState<SmartCard[]>([]);
  const [cardStatuses, setCardStatuses] = useState<Record<string, 'loading' | 'success' | 'error'>>({});

  // Fetch organizations on mount
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/organizations/network-platforms', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch organizations');
        const data = await res.json();
        // Filter to active Meraki orgs
        const merakiOrgs = (data || []).filter((o: Organization) => o.platform === 'meraki' && o.is_active);
        setOrganizations(merakiOrgs);

        // Auto-select first org
        if (merakiOrgs.length > 0) {
          setSelectedOrg(merakiOrgs[0].name);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organizations');
      } finally {
        setLoading(false);
      }
    };
    fetchOrganizations();
  }, []);

  // Fetch networks when org changes
  useEffect(() => {
    if (!selectedOrg) {
      setNetworks([]);
      return;
    }

    const fetchNetworks = async () => {
      try {
        const res = await fetch(`/api/meraki/networks?organization=${encodeURIComponent(selectedOrg)}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch networks');
        const data = await res.json();
        const networkList = data.data || data || [];
        setNetworks(networkList);

        // Auto-select first network
        if (networkList.length > 0) {
          setSelectedNetwork(networkList[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch networks:', err);
        setNetworks([]);
      }
    };
    fetchNetworks();
  }, [selectedOrg]);

  // Build scope from selections
  const scope: CardScope = useMemo(() => {
    const org = organizations.find(o => o.name === selectedOrg);
    const network = networks.find(n => n.id === selectedNetwork);

    return {
      credentialOrg: selectedOrg,
      organizationId: network?.organizationId || '',
      organizationName: org?.display_name || org?.name || '',
      networkId: selectedNetwork,
      networkName: network?.name || '',
    };
  }, [selectedOrg, selectedNetwork, organizations, networks]);

  // Debug logging
  useEffect(() => {
    console.log('[CardTest] Organizations:', organizations);
    console.log('[CardTest] Networks:', networks);
    console.log('[CardTest] Selected org:', selectedOrg);
    console.log('[CardTest] Selected network:', selectedNetwork);
  }, [organizations, networks, selectedOrg, selectedNetwork]);

  // Generate cards for selected platform
  const generateCards = () => {
    if (!selectedOrg || !selectedNetwork) {
      alert('Please select an organization and network first');
      return;
    }

    let newCards: SmartCard[] = [];

    if (selectedPlatform === 'all') {
      const platforms: CardPlatform[] = ['meraki', 'thousandeyes', 'splunk', 'catalyst', 'general'];
      platforms.forEach(platform => {
        newCards = [...newCards, ...generateCardsForPlatform(platform, scope)];
      });
    } else {
      newCards = generateCardsForPlatform(selectedPlatform, scope);
    }

    setCards(newCards);
    // Reset statuses
    setCardStatuses({});
  };

  // Generate single card
  const addSingleCard = (type: AllCardTypes) => {
    if (!selectedOrg || !selectedNetwork) {
      alert('Please select an organization and network first');
      return;
    }

    const newCard = generateCard(type, scope);
    setCards(prev => [...prev, newCard]);
  };

  // Track card status updates
  const handleCardAction = (cardId: string, action: string) => {
    if (action === 'data-loaded') {
      setCardStatuses(prev => ({ ...prev, [cardId]: 'success' }));
    } else if (action === 'data-error') {
      setCardStatuses(prev => ({ ...prev, [cardId]: 'error' }));
    }
  };

  // Remove card
  const removeCard = (cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId));
    setCardStatuses(prev => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  };

  // Filter cards by status
  const filteredCards = useMemo(() => {
    if (filterStatus === 'all') return cards;
    return cards.filter(card => {
      const status = cardStatuses[card.id];
      if (filterStatus === 'working') return status === 'success';
      if (filterStatus === 'broken') return status === 'error';
      return true;
    });
  }, [cards, cardStatuses, filterStatus]);

  // Card type list for individual card generation
  const allCardTypes = useMemo(() => getAllCardTypes(), []);
  const cardTypesByPlatform = useMemo(() => {
    const grouped: Record<CardPlatform, AllCardTypes[]> = {
      meraki: [],
      thousandeyes: [],
      splunk: [],
      catalyst: [],
      general: [],
      system: [],
    };
    allCardTypes.forEach(type => {
      const def = CARD_REGISTRY[type];
      if (def) {
        grouped[def.platform].push(type);
      }
    });
    return grouped;
  }, [allCardTypes]);

  // Stats
  const stats = useMemo(() => {
    const total = cards.length;
    const working = Object.values(cardStatuses).filter(s => s === 'success').length;
    const broken = Object.values(cardStatuses).filter(s => s === 'error').length;
    const pending = total - working - broken;
    return { total, working, broken, pending };
  }, [cards.length, cardStatuses]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">Loading organizations...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Card Test Page</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Test all card types with real API data. This page is not linked in navigation.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Organization Select */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Organization
              </label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="">Select organization...</option>
                {organizations.map((org) => (
                  <option key={String(org.id)} value={org.name}>
                    {org.display_name || org.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Network Select */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Network
              </label>
              <select
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                disabled={networks.length === 0}
              >
                <option value="">Select network...</option>
                {networks.map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Platform Select */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Platform
              </label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value as CardPlatform | 'all')}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="all">All Platforms</option>
                <option value="meraki">Meraki</option>
                <option value="thousandeyes">ThousandEyes</option>
                <option value="splunk">Splunk</option>
                <option value="catalyst">Catalyst</option>
                <option value="general">General Network</option>
              </select>
            </div>

            {/* Generate Button */}
            <div className="flex items-end">
              <button
                onClick={generateCards}
                disabled={!selectedOrg || !selectedNetwork}
                className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-400 text-white font-medium rounded-lg transition-colors"
              >
                Generate Cards
              </button>
            </div>
          </div>

          {/* Stats */}
          {cards.length > 0 && (
            <div className="flex items-center gap-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">{stats.total}</span> cards
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">
                <span className="font-medium">{stats.working}</span> working
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">
                <span className="font-medium">{stats.broken}</span> broken
              </div>
              <div className="text-sm text-amber-600 dark:text-amber-400">
                <span className="font-medium">{stats.pending}</span> pending
              </div>

              {/* Filter */}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-slate-500">Filter:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'working' | 'broken')}
                  className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="all">All</option>
                  <option value="working">Working Only</option>
                  <option value="broken">Broken Only</option>
                </select>
              </div>

              {/* Clear */}
              <button
                onClick={() => { setCards([]); setCardStatuses({}); }}
                className="px-3 py-1 text-sm text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Individual Card Selection */}
        <details className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
          <summary className="p-4 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
            Add Individual Cards ({allCardTypes.length} types available)
          </summary>
          <div className="p-4 pt-0 space-y-4">
            {(['meraki', 'thousandeyes', 'splunk', 'catalyst', 'general'] as CardPlatform[]).map((platform) => (
              <div key={platform}>
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase mb-2">
                  {platform} ({cardTypesByPlatform[platform].length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {cardTypesByPlatform[platform].map((type) => (
                    <button
                      key={type}
                      onClick={() => addSingleCard(type)}
                      disabled={!selectedOrg || !selectedNetwork}
                      className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-700 dark:text-slate-300 rounded transition-colors"
                    >
                      {CARD_REGISTRY[type].title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>

        {/* Cards Grid */}
        {filteredCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCards.map((card) => (
              <div key={card.id} className="relative">
                {/* Status Badge */}
                <div className="absolute -top-2 -right-2 z-10">
                  {cardStatuses[card.id] === 'success' && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-500 text-white rounded-full">
                      OK
                    </span>
                  )}
                  {cardStatuses[card.id] === 'error' && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full">
                      ERROR
                    </span>
                  )}
                  {!cardStatuses[card.id] && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-500 text-white rounded-full animate-pulse">
                      Loading
                    </span>
                  )}
                </div>

                {/* Card Type Label */}
                <div className="absolute -top-2 left-2 z-10">
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-800 dark:bg-slate-600 text-white rounded">
                    {card.type}
                  </span>
                </div>

                <SmartCardWrapper
                  card={card}
                  onRemove={removeCard}
                  onAction={handleCardAction}
                  pollingContext={scope}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500 dark:text-slate-400">
            {cards.length === 0 ? (
              <>
                <p className="text-lg mb-2">No cards generated yet</p>
                <p className="text-sm">Select an organization and network, then click Generate Cards</p>
              </>
            ) : (
              <p className="text-lg">No cards match the current filter</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
