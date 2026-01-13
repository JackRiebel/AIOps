'use client';

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  X,
  Activity,
  Wifi,
  Shield,
  Server,
  BarChart3,
  AlertTriangle,
  FileText,
  Database,
  Cpu,
  Network,
  Radio,
  Zap,
} from 'lucide-react';
import type { CanvasCard, CanvasCardType } from '@/types/session';
import { findNextAvailablePosition } from '@/utils/canvas-layout';

// =============================================================================
// Card Category Definitions
// =============================================================================

interface CardDefinition {
  type: CanvasCardType;
  name: string;
  description: string;
  category: CardCategory;
  icon: React.ReactNode;
  defaultSize: { w: number; h: number };
  requiresContext?: 'networkId' | 'orgId' | 'both' | 'none';
}

type CardCategory =
  | 'infrastructure'
  | 'wireless'
  | 'security'
  | 'traffic'
  | 'alerts'
  | 'splunk'
  | 'knowledge';

const CATEGORY_INFO: Record<CardCategory, { label: string; icon: React.ReactNode; color: string }> = {
  infrastructure: { label: 'Infrastructure', icon: <Server className="w-4 h-4" />, color: 'text-blue-400' },
  wireless: { label: 'Wireless', icon: <Wifi className="w-4 h-4" />, color: 'text-purple-400' },
  security: { label: 'Security', icon: <Shield className="w-4 h-4" />, color: 'text-red-400' },
  traffic: { label: 'Traffic & Performance', icon: <Activity className="w-4 h-4" />, color: 'text-green-400' },
  alerts: { label: 'Alerts & Incidents', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-amber-400' },
  splunk: { label: 'Splunk & Logs', icon: <Database className="w-4 h-4" />, color: 'text-cyan-400' },
  knowledge: { label: 'Knowledge Base', icon: <FileText className="w-4 h-4" />, color: 'text-indigo-400' },
};

// Available cards organized by category
const AVAILABLE_CARDS: CardDefinition[] = [
  // Infrastructure
  { type: 'network-health', name: 'Network Health', description: 'Overall network health score', category: 'infrastructure', icon: <Activity className="w-4 h-4" />, defaultSize: { w: 4, h: 4 }, requiresContext: 'networkId' },
  { type: 'device-status', name: 'Device Status', description: 'Status of all network devices', category: 'infrastructure', icon: <Server className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },
  { type: 'bandwidth-utilization', name: 'Bandwidth Utilization', description: 'Network bandwidth usage over time', category: 'infrastructure', icon: <BarChart3 className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },
  { type: 'latency-monitor', name: 'Latency Monitor', description: 'Network latency metrics', category: 'infrastructure', icon: <Zap className="w-4 h-4" />, defaultSize: { w: 4, h: 4 }, requiresContext: 'networkId' },
  { type: 'cpu-memory-health', name: 'CPU & Memory', description: 'Device resource utilization', category: 'infrastructure', icon: <Cpu className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },
  { type: 'uptime-tracker', name: 'Uptime Tracker', description: 'Device uptime history', category: 'infrastructure', icon: <Activity className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },
  { type: 'topology', name: 'Network Topology', description: 'Visual network topology map', category: 'infrastructure', icon: <Network className="w-4 h-4" />, defaultSize: { w: 8, h: 5 }, requiresContext: 'networkId' },
  { type: 'wan-failover', name: 'WAN Failover', description: 'WAN link failover status', category: 'infrastructure', icon: <Activity className="w-4 h-4" />, defaultSize: { w: 6, h: 3 }, requiresContext: 'networkId' },

  // Wireless
  { type: 'channel-utilization-heatmap', name: 'Channel Utilization', description: 'Wireless channel usage heatmap', category: 'wireless', icon: <Radio className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },
  { type: 'client-signal-strength', name: 'Client Signal Strength', description: 'Wireless client signal levels', category: 'wireless', icon: <Wifi className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },
  { type: 'ssid-client-breakdown', name: 'SSID Breakdown', description: 'Clients per SSID', category: 'wireless', icon: <Wifi className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },
  { type: 'roaming-events', name: 'Roaming Events', description: 'Client roaming activity', category: 'wireless', icon: <Activity className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },
  { type: 'interference-monitor', name: 'Interference Monitor', description: 'RF interference detection', category: 'wireless', icon: <AlertTriangle className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },
  { type: 'rf-analysis', name: 'RF Analysis', description: 'Radio frequency analysis', category: 'wireless', icon: <Radio className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },

  // Security
  { type: 'security-events', name: 'Security Events', description: 'Recent security events', category: 'security', icon: <Shield className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'orgId' },
  { type: 'threat-map', name: 'Threat Map', description: 'Geographic threat visualization', category: 'security', icon: <Shield className="w-4 h-4" />, defaultSize: { w: 8, h: 4 }, requiresContext: 'orgId' },
  { type: 'firewall-hits', name: 'Firewall Hits', description: 'Firewall rule matches', category: 'security', icon: <Shield className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },
  { type: 'blocked-connections', name: 'Blocked Connections', description: 'Blocked connection attempts', category: 'security', icon: <Shield className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },
  { type: 'intrusion-detection', name: 'Intrusion Detection', description: 'IDS/IPS alerts', category: 'security', icon: <AlertTriangle className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },
  { type: 'compliance-score', name: 'Compliance Score', description: 'Security compliance status', category: 'security', icon: <Shield className="w-4 h-4" />, defaultSize: { w: 4, h: 4 }, requiresContext: 'orgId' },

  // Traffic & Performance
  { type: 'top-talkers', name: 'Top Talkers', description: 'Highest bandwidth users', category: 'traffic', icon: <BarChart3 className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },
  { type: 'traffic-composition', name: 'Traffic Composition', description: 'Traffic type breakdown', category: 'traffic', icon: <BarChart3 className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'networkId' },
  { type: 'application-usage', name: 'Application Usage', description: 'Application bandwidth usage', category: 'traffic', icon: <BarChart3 className="w-4 h-4" />, defaultSize: { w: 8, h: 4 }, requiresContext: 'networkId' },
  { type: 'packet-loss', name: 'Packet Loss', description: 'Packet loss metrics', category: 'traffic', icon: <Activity className="w-4 h-4" />, defaultSize: { w: 4, h: 4 }, requiresContext: 'networkId' },
  { type: 'qos-statistics', name: 'QoS Statistics', description: 'Quality of Service metrics', category: 'traffic', icon: <Activity className="w-4 h-4" />, defaultSize: { w: 4, h: 4 }, requiresContext: 'networkId' },

  // Alerts & Incidents
  { type: 'incident-tracker', name: 'Incident Tracker', description: 'Active incident list', category: 'alerts', icon: <AlertTriangle className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'none' },
  { type: 'alert-timeline', name: 'Alert Timeline', description: 'Chronological alert view', category: 'alerts', icon: <Activity className="w-4 h-4" />, defaultSize: { w: 12, h: 3 }, requiresContext: 'orgId' },
  { type: 'alert-summary', name: 'Alert Summary', description: 'Alert count summary', category: 'alerts', icon: <AlertTriangle className="w-4 h-4" />, defaultSize: { w: 4, h: 4 }, requiresContext: 'orgId' },
  { type: 'alert-correlation', name: 'Alert Correlation', description: 'Related alerts grouped', category: 'alerts', icon: <Network className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'orgId' },

  // Splunk & Logs
  { type: 'splunk-search-results', name: 'Splunk Search', description: 'Splunk query results', category: 'splunk', icon: <Database className="w-4 h-4" />, defaultSize: { w: 8, h: 4 }, requiresContext: 'none' },
  { type: 'log-volume-trend', name: 'Log Volume', description: 'Log ingestion trend', category: 'splunk', icon: <BarChart3 className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'none' },
  { type: 'error-distribution', name: 'Error Distribution', description: 'Error type breakdown', category: 'splunk', icon: <AlertTriangle className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'none' },
  { type: 'event-correlation', name: 'Event Correlation', description: 'Correlated log events', category: 'splunk', icon: <Network className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'none' },

  // Knowledge Base
  { type: 'knowledge-sources', name: 'Knowledge Sources', description: 'Referenced documentation', category: 'knowledge', icon: <FileText className="w-4 h-4" />, defaultSize: { w: 6, h: 4 }, requiresContext: 'none' },
  { type: 'datasheet-comparison', name: 'Product Comparison', description: 'Compare product specs', category: 'knowledge', icon: <FileText className="w-4 h-4" />, defaultSize: { w: 8, h: 5 }, requiresContext: 'none' },
];

// =============================================================================
// Component Props
// =============================================================================

interface CardPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCard: (card: CanvasCard) => void;
  /** Current network context for card configuration */
  networkId?: string;
  orgId?: string;
  /** Existing cards to calculate position */
  existingCards?: CanvasCard[];
}

// =============================================================================
// CardPicker Component
// =============================================================================

export function CardPicker({
  isOpen,
  onClose,
  onAddCard,
  networkId,
  orgId,
  existingCards = [],
}: CardPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CardCategory | 'all'>('all');

  // Filter cards based on search and category
  const filteredCards = useMemo(() => {
    return AVAILABLE_CARDS.filter((card) => {
      const matchesSearch = searchQuery === '' ||
        card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || card.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  // Group cards by category for display
  const cardsByCategory = useMemo(() => {
    const grouped: Record<CardCategory, CardDefinition[]> = {
      infrastructure: [],
      wireless: [],
      security: [],
      traffic: [],
      alerts: [],
      splunk: [],
      knowledge: [],
    };
    filteredCards.forEach((card) => {
      grouped[card.category].push(card);
    });
    return grouped;
  }, [filteredCards]);

  // Calculate next available position using grid-aware algorithm
  // This ensures cards never overlap by scanning for gaps in the grid
  const getNextPosition = (cardWidth: number, cardHeight: number): { x: number; y: number } => {
    return findNextAvailablePosition(existingCards, cardWidth, cardHeight);
  };

  // Handle card selection
  const handleSelectCard = (cardDef: CardDefinition) => {
    // Use grid-aware position calculation with the card's specific size
    const position = getNextPosition(cardDef.defaultSize.w, cardDef.defaultSize.h);
    const newCard: CanvasCard = {
      id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: cardDef.type,
      title: cardDef.name,
      layout: {
        x: position.x,
        y: position.y,
        w: cardDef.defaultSize.w,
        h: cardDef.defaultSize.h,
      },
      data: {},
      config: {
        ...(networkId && { networkId }),
        ...(orgId && { orgId }),
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        costUsd: 0,
        isLive: true,
      },
    };
    onAddCard(newCard);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Plus className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Add Card</h3>
              <p className="text-sm text-slate-400">Choose a card to add to your canvas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="p-4 border-b border-slate-700 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cards..."
              className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-slate-700/50 text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              All
            </button>
            {(Object.entries(CATEGORY_INFO) as [CardCategory, typeof CATEGORY_INFO[CardCategory]][]).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedCategory === key
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-700/50 text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                <span className={info.color}>{info.icon}</span>
                {info.label}
              </button>
            ))}
          </div>
        </div>

        {/* Card Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedCategory === 'all' ? (
            // Show grouped by category
            <div className="space-y-6">
              {(Object.entries(cardsByCategory) as [CardCategory, CardDefinition[]][]).map(([category, cards]) => {
                if (cards.length === 0) return null;
                const info = CATEGORY_INFO[category];
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={info.color}>{info.icon}</span>
                      <h4 className="text-sm font-semibold text-slate-300">{info.label}</h4>
                      <span className="text-xs text-slate-500">({cards.length})</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {cards.map((card) => (
                        <CardTile
                          key={card.type}
                          card={card}
                          onSelect={() => handleSelectCard(card)}
                          hasContext={
                            card.requiresContext === 'none' ||
                            (card.requiresContext === 'networkId' && !!networkId) ||
                            (card.requiresContext === 'orgId' && !!orgId) ||
                            (card.requiresContext === 'both' && !!networkId && !!orgId)
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Show flat list for selected category
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filteredCards.map((card) => (
                <CardTile
                  key={card.type}
                  card={card}
                  onSelect={() => handleSelectCard(card)}
                  hasContext={
                    card.requiresContext === 'none' ||
                    (card.requiresContext === 'networkId' && !!networkId) ||
                    (card.requiresContext === 'orgId' && !!orgId) ||
                    (card.requiresContext === 'both' && !!networkId && !!orgId)
                  }
                />
              ))}
            </div>
          )}

          {filteredCards.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No cards match your search</p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-slate-700 bg-slate-800/50">
          <p className="text-xs text-slate-500 text-center">
            {networkId ? (
              <span className="text-green-400">Network context available - cards will auto-populate with live data</span>
            ) : (
              <span>Select a network to enable live data for cards</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Card Tile Component
// =============================================================================

interface CardTileProps {
  card: CardDefinition;
  onSelect: () => void;
  hasContext: boolean;
}

function CardTile({ card, onSelect, hasContext }: CardTileProps) {
  const categoryInfo = CATEGORY_INFO[card.category];

  return (
    <button
      onClick={onSelect}
      className={`group relative p-3 text-left rounded-lg border transition-all ${
        hasContext
          ? 'bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50 hover:border-cyan-500/30'
          : 'bg-slate-700/20 border-slate-700/30 opacity-60'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 ${categoryInfo.color}`}>{card.icon}</span>
        <div className="flex-1 min-w-0">
          <h5 className="text-sm font-medium text-white truncate">{card.name}</h5>
          <p className="text-xs text-slate-400 line-clamp-2">{card.description}</p>
        </div>
      </div>
      {!hasContext && (
        <span className="absolute top-2 right-2 text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
          Needs context
        </span>
      )}
      {hasContext && (
        <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Plus className="w-4 h-4 text-cyan-400" />
        </span>
      )}
    </button>
  );
}

export default CardPicker;
