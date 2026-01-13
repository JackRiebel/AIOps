'use client';

import { memo, useMemo, useEffect, useRef } from 'react';
import type { CanvasCard, CanvasCardType } from '@/types/session';
import { CANVAS_TEMPLATES, type CanvasTemplate, type TemplateCard } from '@/config/canvas-templates';

import { SUGGESTION_RULES } from './SmartCardSuggestions/suggestion-rules';
import type { CardSuggestion, SuggestionIcon, BackendCardSuggestion, SmartCardSuggestionsProps } from './SmartCardSuggestions/types';
import {
  isMerakiNetworkId,
  isMerakiSerial,
  extractContextFromData,
} from './SmartCardSuggestions/context-utils';
import {
  CARD_TYPE_KEYWORDS,
  EXCLUSIVE_CARD_GROUPS,
  SPECIFICITY_INDICATORS,
  isSpecificQuery,
  getExclusiveGroup,
} from './SmartCardSuggestions/card-keywords';

/**
 * SmartCardSuggestions - AI-like card recommendations based on context
 *
 * Analyzes the query and response to suggest relevant visualizations:
 * - Troubleshoot queries → Topology, Health Trend, Alerts
 * - Wireless queries → RF Analysis, Client Distribution
 * - Overview queries → Health, Device Table, Topology
 * - Device down → Path Analysis, Topology with disconnect
 */

// Context extraction and card keyword utilities are now imported from ./SmartCardSuggestions/ modules

/**
 * Score a template based on query and data context
 */
function scoreTemplate(
  template: CanvasTemplate,
  query: string,
  data: unknown
): number {
  const q = query.toLowerCase();
  let score = 0;

  // Match template name
  if (q.includes(template.name.toLowerCase())) score += 50;

  // Match template description words
  const descWords = template.description.toLowerCase().split(/\s+/);
  for (const word of descWords) {
    if (word.length > 3 && q.includes(word)) score += 5;
  }

  // Match template tags (high value)
  for (const tag of template.tags) {
    if (q.includes(tag.toLowerCase())) score += 20;
  }

  // Match category as context hint
  if (q.includes(template.category)) score += 10;

  // Bonus for troubleshooting keywords
  const troubleshootPatterns = ['troubleshoot', 'debug', 'issue', 'problem', 'fix', 'diagnose'];
  if (troubleshootPatterns.some(p => q.includes(p)) && template.category === 'troubleshooting') {
    score += 25;
  }

  // Check data context for wireless/security/etc.
  const toolDataArray = Array.isArray(data) ? data : [];
  for (const item of toolDataArray) {
    const itemData = item?.data;
    if (Array.isArray(itemData)) {
      // Check for device types in the data
      const hasWirelessDevices = itemData.some((d: any) =>
        d.model?.startsWith('MR') || d.model?.startsWith('CW') || d.productType === 'wireless'
      );
      const hasSwitchDevices = itemData.some((d: any) =>
        d.model?.startsWith('MS') || d.productType === 'switch'
      );
      const hasSecurityData = itemData.some((d: any) =>
        d.eventType?.includes('security') || d.severity
      );

      // Wireless data presence boosts wireless templates
      if (hasWirelessDevices && template.category === 'wireless') {
        score += 30;
      }

      // Switch data presence boosts switch templates
      if (hasSwitchDevices && template.id === 'switch-infrastructure') {
        score += 30;
      }

      // Security events in data
      if (hasSecurityData && template.category === 'security') {
        score += 30;
      }

      // =========================================================================
      // VETO: Strongly penalize wireless/switch templates when no such devices exist
      // =========================================================================
      if (!hasWirelessDevices && template.category === 'wireless') {
        score -= 100;  // Strong penalty to prevent wireless template selection
      }
      if (!hasSwitchDevices && template.id === 'switch-infrastructure') {
        score -= 100;
      }
    }
  }

  return score;
}

/**
 * Score individual cards within a template based on query relevance
 * Now includes negative scoring for unrelated cards when query is specific
 */
function scoreTemplateCard(
  card: TemplateCard,
  query: string,
  data: unknown
): number {
  const q = query.toLowerCase();
  let score = 0;
  let hasKeywordMatch = false;
  let hasTitleMatch = false;

  // Match card title (boost for exact title word matches)
  const titleWords = card.title.toLowerCase().split(/\s+/);
  for (const word of titleWords) {
    if (word.length > 2 && q.includes(word)) {
      score += 15;  // Increased from 10
      hasTitleMatch = true;
    }
  }

  // Match card type keywords
  const keywords = CARD_TYPE_KEYWORDS[card.type] || [];
  for (const keyword of keywords) {
    if (q.includes(keyword.toLowerCase())) {
      score += 15;
      hasKeywordMatch = true;
    }
  }

  // =========================================================================
  // Negative Scoring: Penalize unrelated cards for specific queries
  // =========================================================================
  const queryIsSpecific = isSpecificQuery(query);

  if (queryIsSpecific && !hasKeywordMatch && !hasTitleMatch) {
    // Card has NO relevance to a specific query - apply penalty
    score -= 25;

    // Check if query matches a different exclusive group
    const cardGroup = getExclusiveGroup(card.type);
    if (cardGroup) {
      // Check if query matches keywords from OTHER cards in the same template category
      // but a different exclusive group
      for (const group of EXCLUSIVE_CARD_GROUPS) {
        if (group === cardGroup) continue;  // Skip same group

        // Check if query matches any card in this other group
        const queryMatchesOtherGroup = group.some(otherCardType => {
          const otherKeywords = CARD_TYPE_KEYWORDS[otherCardType] || [];
          return otherKeywords.some(kw => q.includes(kw.toLowerCase()));
        });

        if (queryMatchesOtherGroup) {
          // Query matches a different group - this card is likely irrelevant
          score -= 30;  // Strong penalty
          break;
        }
      }
    }
  }

  // =========================================================================
  // Data-specific boosts (can help overcome penalties)
  // =========================================================================
  const toolDataArray = Array.isArray(data) ? data : [];
  for (const item of toolDataArray) {
    const itemData = item?.data;
    if (Array.isArray(itemData)) {
      // If data contains wireless devices and card is wireless-related
      const hasWirelessDevices = itemData.some((d: any) =>
        d.model?.startsWith('MR') || d.model?.startsWith('CW')
      );
      if (hasWirelessDevices && ['rf-analysis', 'interference-monitor', 'client-signal-strength', 'channel-utilization-heatmap'].includes(card.type)) {
        score += 20;
      }

      // If data contains switches and card is switch-related
      const hasSwitches = itemData.some((d: any) => d.model?.startsWith('MS'));
      if (hasSwitches && ['port-utilization-heatmap', 'poe-budget', 'spanning-tree-status'].includes(card.type)) {
        score += 20;
      }

      // If data contains alerts and card is alert-related
      const hasAlerts = itemData.some((d: any) => d.severity || d.alertType);
      if (hasAlerts && ['alert-summary', 'alert-timeline', 'alert-correlation'].includes(card.type)) {
        score += 20;
      }

      // If data contains client info and card is client-related
      const hasClients = itemData.some((d: any) => d.mac || d.clientMac || d.clients);
      if (hasClients && ['client-signal-strength', 'client-distribution', 'roaming-events'].includes(card.type)) {
        score += 20;
      }

      // =========================================================================
      // VETO: Penalize wireless cards when network has NO wireless APs
      // =========================================================================
      const wirelessCardTypes = [
        'rf-analysis', 'interference-monitor', 'client-signal-strength',
        'channel-utilization-heatmap', 'ssid-client-breakdown', 'client-distribution',
        'roaming-events'
      ];
      if (!hasWirelessDevices && wirelessCardTypes.includes(card.type)) {
        // Strong penalty - wireless cards make no sense without wireless APs
        score -= 50;
      }

      // VETO: Penalize switch cards when network has NO switches
      const switchCardTypes = [
        'port-utilization-heatmap', 'vlan-distribution', 'poe-budget',
        'spanning-tree-status', 'stack-status'
      ];
      if (!hasSwitches && switchCardTypes.includes(card.type)) {
        score -= 50;
      }
    }
  }

  // Live cards get a small boost when data is available
  if (card.isLive && data && score >= 0) score += 5;

  return score;
}

// Internal interface for template scoring (different from exported TemplateCardSuggestion)
interface TemplateCardScore {
  card: TemplateCard;
  template: CanvasTemplate;
  score: number;
  icon: CardSuggestion['icon'];
}

/**
 * Map card type to suggestion icon
 */
function getIconForCardType(type: string): CardSuggestion['icon'] {
  const iconMap: Record<string, CardSuggestion['icon']> = {
    'rf-analysis': 'rf',
    'interference-monitor': 'interference',
    'client-signal-strength': 'signal',
    'roaming-events': 'roaming',
    'channel-utilization-heatmap': 'channel',
    'ssid-client-breakdown': 'ssid',
    'client-distribution': 'topology',
    'network-health': 'health',
    'health-trend': 'health',
    'topology': 'topology',
    'device-table': 'table',
    'alert-summary': 'alert',
    'alert-timeline': 'timeline',
    'alert-correlation': 'correlation',
    'incident-tracker': 'incident',
    'latency-monitor': 'latency',
    'bandwidth-utilization': 'bandwidth',
    'packet-loss': 'latency',
    'path-analysis': 'path',
    'cpu-memory-health': 'device',
    'uptime-tracker': 'uptime',
    'sla-compliance': 'sla',
    'wan-failover': 'wan',
    'top-talkers': 'traffic',
    'traffic-composition': 'traffic',
    'application-usage': 'app',
    'qos-statistics': 'qos',
    'security-events': 'security',
    'threat-map': 'threat',
    'compliance-score': 'compliance',
    'blocked-connections': 'firewall',
    'firewall-hits': 'firewall',
    'intrusion-detection': 'shield',
    'port-utilization-heatmap': 'heatmap',
    'vlan-distribution': 'vlan',
    'poe-budget': 'poe',
    'spanning-tree-status': 'stp',
    'stack-status': 'stack',
    'splunk-search-results': 'log',
    'log-severity-breakdown': 'severity',
    'log-volume-trend': 'log',
    'error-distribution': 'error',
  };
  return iconMap[type] || 'device';
}

/**
 * Find relevant cards from templates based on query and data context
 * This is the key innovation - instead of matching entire templates,
 * we find the most relevant INDIVIDUAL cards across all templates
 *
 * PRECISION-FOCUSED: Only suggests cards with strong demonstrated relevance
 * Maximum 2 suggestions to avoid overwhelming the user
 */
function findRelevantCardsFromTemplates(
  query: string,
  data: unknown,
  existingCardTypes: Set<string>
): TemplateCardScore[] {
  const results: TemplateCardScore[] = [];
  const queryIsSpecific = isSpecificQuery(query);

  // Score and filter templates - require minimum score of 15
  const scoredTemplates = CANVAS_TEMPLATES.map(template => ({
    template,
    score: scoreTemplate(template, query, data)
  })).filter(t => t.score >= 15)
    .sort((a, b) => b.score - a.score);

  // Take only top 2 matching templates
  const topTemplates = scoredTemplates.slice(0, 2);

  // Extract and score individual cards from matching templates
  for (const { template, score: templateScore } of topTemplates) {
    for (const card of template.cards) {
      // Skip if this card type already exists
      if (existingCardTypes.has(card.type)) continue;

      const cardScore = scoreTemplateCard(card, query, data);

      // =====================================================================
      // STRICT Thresholds: Precision over recall
      // =====================================================================
      // - Specific queries: Require strong card match (score >= 20)
      // - Broad queries: Still require moderate card relevance
      // - Never include cards with negative or low scores

      let shouldInclude = false;

      if (queryIsSpecific) {
        // Specific query: Card must have STRONG relevance
        // Minimum threshold: 20 (multiple keyword/title matches)
        shouldInclude = cardScore >= 20;
      } else {
        // Broad query (e.g., "wireless troubleshooting"):
        // - Strong template match (>60): Require card score >= 10
        // - Medium template match (>40): Require card score >= 15
        // - Weaker matches: Require card score >= 25
        if (templateScore > 60) {
          shouldInclude = cardScore >= 10;
        } else if (templateScore > 40) {
          shouldInclude = cardScore >= 15;
        } else {
          shouldInclude = cardScore >= 25;
        }
      }

      if (shouldInclude) {
        results.push({
          card,
          template,
          score: templateScore + cardScore,
          icon: getIconForCardType(card.type),
        });
      }
    }
  }

  // Sort by combined score and deduplicate by card type
  const seenTypes = new Set<string>();
  return results
    .sort((a, b) => b.score - a.score)
    .filter(r => {
      if (seenTypes.has(r.card.type)) return false;
      seenTypes.add(r.card.type);
      return true;
    })
    .slice(0, 2);  // Return MAX 2 template-derived suggestions
}

/**
 * Convert template card suggestion to CardSuggestion format
 */
function templateCardToSuggestion(
  tcs: TemplateCardScore,
  priority: number
): CardSuggestion {
  return {
    type: tcs.card.type,
    title: tcs.card.title,
    description: `From ${tcs.template.name} template`,
    icon: tcs.icon,
    priority,
    condition: () => true,  // Already filtered by findRelevantCardsFromTemplates
    dataExtractor: (data: unknown) => {
      // Basic data pass-through - will be enriched by card components
      return { needsEnrichment: true, templateSource: tcs.template.id };
    },
  };
}

// Icon components for suggestions
function SuggestionIcon({ icon }: { icon: CardSuggestion['icon'] }) {
  const iconClass = "w-5 h-5";

  switch (icon) {
    case 'rf':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
      );
    case 'topology':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    case 'health':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'alert':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'path':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      );
    case 'comparison':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'device':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      );
    case 'bandwidth':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    case 'latency':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'uptime':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'sla':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      );
    case 'wan':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      );
    case 'traffic':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      );
    case 'qos':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case 'heatmap':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      );
    case 'timeline':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'throughput':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'app':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      );
    case 'security':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    case 'threat':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'firewall':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
        </svg>
      );
    case 'shield':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case 'compliance':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      );
    case 'channel':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      );
    case 'signal':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case 'ssid':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
      );
    case 'roaming':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    case 'interference':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
        </svg>
      );
    case 'port':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
        </svg>
      );
    case 'vlan':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case 'poe':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'stp':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      );
    case 'stack':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case 'incident':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'correlation':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    case 'mttr':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'log':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'error':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'severity':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
        </svg>
      );
    case 'knowledge':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case 'book':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'datasheet':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'table':
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
  }
}

// Get icon background color
function getIconColor(icon: CardSuggestion['icon']): string {
  switch (icon) {
    case 'rf': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
    case 'topology': return 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400';
    case 'health': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
    case 'alert': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
    case 'path': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
    case 'comparison': return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400';
    case 'device': return 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400';
    case 'bandwidth': return 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400';
    case 'latency': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
    case 'uptime': return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400';
    case 'sla': return 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400';
    case 'wan': return 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400';
    case 'traffic': return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400';
    case 'qos': return 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400';
    case 'heatmap': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
    case 'timeline': return 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400';
    case 'throughput': return 'bg-lime-100 dark:bg-lime-900/30 text-lime-600 dark:text-lime-400';
    case 'app': return 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400';
    case 'security': return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
    case 'threat': return 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400';
    case 'firewall': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
    case 'shield': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
    case 'compliance': return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400';
    // Phase 7: Wireless Deep Dive icons
    case 'channel': return 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400';
    case 'signal': return 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400';
    case 'ssid': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
    case 'roaming': return 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400';
    case 'interference': return 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400';
    // Phase 8: Switch & Infrastructure icons
    case 'port': return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
    case 'vlan': return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400';
    case 'poe': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
    case 'stp': return 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400';
    case 'stack': return 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400';
    // Phase 9: Alerts & Incidents icons
    case 'incident': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
    case 'correlation': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
    case 'mttr': return 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400';
    // Phase 10: Splunk & Log Integration icons
    case 'log': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
    case 'error': return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
    case 'severity': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
    // Phase 11: Knowledge Base icons
    case 'knowledge': return 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400';
    case 'book': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
    case 'datasheet': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
    default: return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
  }
}

// SUGGESTION_RULES is now imported from ./SmartCardSuggestions/suggestion-rules

// Maximum number of cards to auto-add per message
const MAX_AUTO_ADD_CARDS = 1;

// Grid configuration (must match CanvasWorkspace)
const GRID_COLS = 12;

// Default card sizes by type (for proper layout)
const CARD_SIZES: Record<string, { w: number; h: number; minW: number; minH: number }> = {
  // Network & Health
  'network-health': { w: 5, h: 4, minW: 4, minH: 3 },  // Larger for trends display
  'client-distribution': { w: 4, h: 3, minW: 3, minH: 2 },
  'health-trend': { w: 5, h: 4, minW: 4, minH: 3 },
  'cpu-memory-health': { w: 4, h: 4, minW: 3, minH: 3 },
  'uptime-tracker': { w: 4, h: 3, minW: 3, minH: 2 },
  'sla-compliance': { w: 4, h: 3, minW: 3, minH: 2 },
  'wan-failover': { w: 5, h: 4, minW: 4, minH: 3 },

  // Devices
  'device-table': { w: 8, h: 4, minW: 4, minH: 3 },
  'device-detail': { w: 5, h: 5, minW: 4, minH: 4 },
  'device-status': { w: 6, h: 4, minW: 4, minH: 3 },
  'topology': { w: 6, h: 5, minW: 4, minH: 4 },
  'path-analysis': { w: 4, h: 6, minW: 3, minH: 5 },

  // Alerts & Incidents
  'alert-summary': { w: 4, h: 4, minW: 3, minH: 3 },
  'alert-timeline': { w: 5, h: 6, minW: 4, minH: 5 },
  'alert-correlation': { w: 6, h: 5, minW: 5, minH: 4 },
  'incident-tracker': { w: 8, h: 5, minW: 6, minH: 4 },
  'mttr-metrics': { w: 4, h: 4, minW: 3, minH: 3 },

  // Traffic & Performance
  'performance-chart': { w: 6, h: 4, minW: 4, minH: 3 },
  'comparison': { w: 6, h: 4, minW: 5, minH: 3 },
  'bandwidth-utilization': { w: 6, h: 4, minW: 4, minH: 3 },
  'interface-status': { w: 6, h: 4, minW: 4, minH: 3 },
  'latency-monitor': { w: 4, h: 4, minW: 3, minH: 3 },
  'packet-loss': { w: 4, h: 4, minW: 3, minH: 3 },
  'traffic-composition': { w: 5, h: 5, minW: 4, minH: 4 },
  'top-talkers': { w: 5, h: 5, minW: 4, minH: 4 },
  'application-usage': { w: 6, h: 5, minW: 4, minH: 4 },
  'qos-statistics': { w: 5, h: 4, minW: 4, minH: 3 },
  'traffic-heatmap': { w: 6, h: 5, minW: 5, minH: 4 },
  'client-timeline': { w: 5, h: 5, minW: 4, minH: 4 },
  'throughput-comparison': { w: 6, h: 4, minW: 5, minH: 3 },

  // Security
  'security-events': { w: 6, h: 5, minW: 5, minH: 4 },
  'threat-map': { w: 6, h: 5, minW: 5, minH: 4 },
  'firewall-hits': { w: 6, h: 5, minW: 5, minH: 4 },
  'blocked-connections': { w: 5, h: 4, minW: 4, minH: 3 },
  'intrusion-detection': { w: 6, h: 5, minW: 5, minH: 4 },
  'compliance-score': { w: 4, h: 4, minW: 3, minH: 3 },

  // Wireless
  'rf-analysis': { w: 6, h: 5, minW: 4, minH: 4 },
  'interference-monitor': { w: 6, h: 5, minW: 5, minH: 4 },
  'channel-utilization-heatmap': { w: 6, h: 5, minW: 5, minH: 4 },
  'client-signal-strength': { w: 5, h: 4, minW: 4, minH: 3 },
  'ssid-client-breakdown': { w: 5, h: 4, minW: 4, minH: 3 },
  'roaming-events': { w: 5, h: 5, minW: 4, minH: 4 },

  // Switching
  'port-utilization-heatmap': { w: 6, h: 5, minW: 5, minH: 4 },
  'vlan-distribution': { w: 5, h: 4, minW: 4, minH: 3 },
  'poe-budget': { w: 5, h: 5, minW: 4, minH: 4 },
  'spanning-tree-status': { w: 5, h: 4, minW: 4, minH: 3 },
  'stack-status': { w: 5, h: 4, minW: 4, minH: 3 },

  // Splunk & Logs
  'log-volume-trend': { w: 6, h: 4, minW: 5, minH: 3 },
  'splunk-search-results': { w: 8, h: 5, minW: 6, minH: 4 },
  'splunk-event-summary': { w: 6, h: 4, minW: 5, minH: 3 },
};

/**
 * Find the next available position on the grid that doesn't overlap with existing cards
 */
function findNextAvailablePosition(
  existingCards: CanvasCard[],
  cardWidth: number,
  cardHeight: number
): { x: number; y: number } {
  // Build a grid occupancy map
  const occupiedCells = new Set<string>();

  for (const card of existingCards) {
    if (card.layout) {
      for (let x = card.layout.x; x < card.layout.x + card.layout.w; x++) {
        for (let y = card.layout.y; y < card.layout.y + card.layout.h; y++) {
          occupiedCells.add(`${x},${y}`);
        }
      }
    }
  }

  // Find first available position that can fit the card
  // Scan row by row, left to right
  for (let y = 0; y < 100; y++) { // Max 100 rows
    for (let x = 0; x <= GRID_COLS - cardWidth; x++) {
      // Check if this position can fit the card
      let canFit = true;
      for (let dx = 0; dx < cardWidth && canFit; dx++) {
        for (let dy = 0; dy < cardHeight && canFit; dy++) {
          if (occupiedCells.has(`${x + dx},${y + dy}`)) {
            canFit = false;
          }
        }
      }

      if (canFit) {
        return { x, y };
      }
    }
  }

  // Fallback: place at origin
  return { x: 0, y: 0 };
}

export const SmartCardSuggestions = memo(({
  query,
  responseContent,
  structuredData,
  onAddCard,
  existingCards = [],
  sourceMessageId,
  toolName,
  className = '',
  backendSuggestions = [],
  isLatestMessage = false,
}: SmartCardSuggestionsProps) => {
  // Track which cards have been auto-added for this message to prevent duplicates
  const autoAddedRef = useRef<Set<string>>(new Set());
  const autoAddCountRef = useRef<number>(0);  // Track total count of auto-added cards
  const lastMessageIdRef = useRef<string | undefined>(undefined);

  // Reset auto-added tracking when message changes
  if (sourceMessageId !== lastMessageIdRef.current) {
    autoAddedRef.current = new Set();
    autoAddCountRef.current = 0;  // Reset count
    lastMessageIdRef.current = sourceMessageId;
  }

  // Check if AI already added cards via canvas tools - if so, don't show additional suggestions
  // This prevents duplicate/conflicting suggestions when AI proactively adds visualizations
  const aiAddedCards = backendSuggestions.filter(s => s.metadata?.source === 'ai_tool');
  if (aiAddedCards.length > 0) {
    // AI already added cards, don't show rule-based suggestions
    // The cards are already on the canvas
    return null;
  }

  // Handle adding a backend-provided card (knowledge sources, etc.)
  const handleAddBackendCard = (suggestion: BackendCardSuggestion) => {
    const card: Partial<CanvasCard> = {
      id: crypto.randomUUID(),
      type: suggestion.type as CanvasCardType,
      title: suggestion.title,
      data: suggestion.data,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        costUsd: 0,
        isLive: typeof suggestion.metadata?.isLive === 'boolean' ? suggestion.metadata.isLive : false,
        sourceQuery: query,
        sourceMessageId,
        toolName: typeof suggestion.metadata?.toolName === 'string' ? suggestion.metadata.toolName : 'knowledge_search',
      },
    };
    onAddCard(card);
  };

  // Determine which suggestions to show
  const suggestions = useMemo(() => {
    const matchingSuggestions: CardSuggestion[] = [];

    // Get types from backend suggestions and existing cards to avoid duplicates
    const backendTypes = new Set(backendSuggestions.map(bs => bs.type));
    const existingTypes = new Set(existingCards.map(c => c.type));

    // =========================================================================
    // Step 1: Get template-derived suggestions (smart matching)
    // =========================================================================
    const templateSuggestions = findRelevantCardsFromTemplates(
      query,
      structuredData,
      existingTypes
    );

    // Convert template suggestions to CardSuggestion format with high priority
    // Template-derived cards get priority 110-120 to appear first when relevant
    for (let i = 0; i < templateSuggestions.length; i++) {
      const tcs = templateSuggestions[i];
      // Skip if backend already provides this type
      if (backendTypes.has(tcs.card.type)) continue;

      matchingSuggestions.push(
        templateCardToSuggestion(tcs, 120 - i * 2)  // 120, 118, 116, 114
      );
    }

    // =========================================================================
    // Step 2: Add rule-based suggestions ONLY if template matching found nothing
    // This prevents the flood of cards from broad rule matching
    // =========================================================================
    if (matchingSuggestions.length === 0) {
      // Only consider top-priority rules (priority >= 95) when no template matches
      const highPriorityRules = SUGGESTION_RULES.filter(r => r.priority >= 95);
      let ruleMatchCount = 0;
      const MAX_RULE_MATCHES = 2;  // Strict limit on rule-based suggestions

      for (const rule of highPriorityRules) {
        if (ruleMatchCount >= MAX_RULE_MATCHES) break;

        // Skip if card of this type already exists
        if (existingTypes.has(rule.type)) continue;

        // Skip if backend already provides this type
        if (backendTypes.has(rule.type)) continue;

        // Check if condition matches
        if (rule.condition(query, structuredData, responseContent)) {
          matchingSuggestions.push(rule);
          ruleMatchCount++;
        }
      }
    }

    // Deduplicate similar card types - keep higher priority one
    // When network-health is selected/exists, don't suggest other network-level cards
    const similarGroups: Record<string, string[]> = {
      'network': ['network-health', 'health-trend', 'device-table'],
      'connectivity': ['path-analysis', 'topology'],
      'alerts': ['alert-summary', 'alert-correlation'],
      'performance': ['latency-monitor', 'packet-loss', 'bandwidth-utilization'],
      'infrastructure': ['interface-status', 'switch-ports', 'uplink-status'],
      'wan': ['wan-failover', 'uplink-status', 'sd-wan-health'],
      'splunk': ['log-volume-trend', 'splunk-event-summary', 'event-correlation'],
      'device': ['device-detail', 'device-comparison'],
      'wireless': ['rf-analysis', 'channel-utilization', 'rf-heatmap'],
      'security': ['security-events', 'threat-analysis', 'firewall-events', 'compliance-status'],
    };

    // Complementary cards - suggest these when specific cards exist on canvas
    const complementaryCards: Record<string, string[]> = {
      'network-health': ['device-status', 'alert-summary', 'topology'],
      'topology': ['device-status', 'path-analysis', 'vlan-distribution'],
      'rf-analysis': ['interference-monitor', 'ssid-client-breakdown', 'channel-utilization-heatmap'],
      'security-events': ['threat-map', 'blocked-connections', 'firewall-hits'],
      'device-status': ['cpu-memory-health', 'uptime-tracker', 'port-utilization-heatmap'],
      'alert-summary': ['alert-timeline', 'alert-correlation', 'incident-tracker'],
      'bandwidth-utilization': ['traffic-composition', 'top-talkers', 'qos-statistics'],
      'splunk-search-results': ['log-volume-trend', 'log-severity-breakdown', 'error-distribution'],
      'threat-map': ['security-events', 'intrusion-detection', 'blocked-connections'],
      'client-distribution': ['client-timeline', 'ssid-client-breakdown', 'roaming-events'],
      'poe-budget': ['device-status', 'port-utilization-heatmap', 'interface-status'],
      'vlan-distribution': ['topology', 'device-status', 'traffic-composition'],
    };

    // Boost priority for complementary cards based on existing canvas
    const existingCardTypes = existingCards.map(c => c.type);
    const boostTypes = new Set<string>();
    for (const cardType of existingCardTypes) {
      const complements = complementaryCards[cardType] || [];
      complements.forEach(t => boostTypes.add(t));
    }

    // Sort by priority with complementary boost (+15 for cards that complement existing canvas)
    const sorted = matchingSuggestions.sort((a, b) => {
      const aBoost = boostTypes.has(a.type) ? 15 : 0;
      const bBoost = boostTypes.has(b.type) ? 15 : 0;
      return (b.priority + bBoost) - (a.priority + aBoost);
    });

    // Pre-populate selectedTypes with types from existingCards that are in similar groups
    const selectedTypes = new Set<string>();
    for (const card of existingCards) {
      // Check if this existing card type is in any similar group
      for (const [, types] of Object.entries(similarGroups)) {
        if (types.includes(card.type)) {
          // Add all types in this group as "selected" to prevent showing similar cards
          types.forEach(t => selectedTypes.add(t));
        }
      }
    }

    const deduped: CardSuggestion[] = [];

    for (const suggestion of sorted) {
      // Check if this type conflicts with an already-selected/existing type
      let shouldInclude = true;

      // Skip if this type or a similar type already exists
      if (selectedTypes.has(suggestion.type)) {
        shouldInclude = false;
      } else {
        // Check if adding this would conflict with other suggestions
        for (const [, types] of Object.entries(similarGroups)) {
          if (types.includes(suggestion.type)) {
            if (types.some(t => selectedTypes.has(t))) {
              shouldInclude = false;
              break;
            }
          }
        }
      }

      if (shouldInclude) {
        deduped.push(suggestion);
        selectedTypes.add(suggestion.type);
      }
    }

    // Limit to 2 suggestions max for precision
    return deduped.slice(0, 2);
  }, [query, responseContent, structuredData, existingCards, backendSuggestions]);

  // Helper function to create a card from a suggestion with proper size and position
  const createCardFromSuggestion = (suggestion: CardSuggestion, cardsOnCanvas: CanvasCard[]): Partial<CanvasCard> => {
    // Use robust extraction to get networkId, deviceSerial, and organizationId
    const { networkId, deviceSerial, organizationId } = extractContextFromData(structuredData);

    // Debug logging for context extraction
    console.log(`[SmartCardSuggestions] Creating ${suggestion.type} card with context:`, {
      networkId,
      deviceSerial,
      organizationId,
      structuredDataKeys: Array.isArray(structuredData) ? structuredData.map(d => Object.keys(d || {})) : Object.keys(structuredData || {}),
    });

    const extractedData = suggestion.dataExtractor?.(structuredData, responseContent) || structuredData;

    // Get the appropriate size for this card type
    const size = CARD_SIZES[suggestion.type] || { w: 4, h: 3, minW: 3, minH: 2 };

    // Find the next available position that doesn't overlap
    const position = findNextAvailablePosition(cardsOnCanvas, size.w, size.h);

    // Determine if this card type supports live updates
    const liveCardTypes = [
      'rf-analysis', 'health-trend', 'topology', 'device-detail',
      'device-status', 'network-health', 'alert-summary', 'security-events',
      'bandwidth-utilization', 'traffic-composition', 'client-distribution',
      'interference-monitor', 'poe-budget', 'alert-correlation',
    ];
    const supportsLive = liveCardTypes.includes(suggestion.type) && (networkId || organizationId);

    // Build WebSocket topic based on card type
    let liveTopic: string | undefined;
    if (supportsLive) {
      const id = networkId || organizationId;
      switch (suggestion.type) {
        case 'rf-analysis':
        case 'interference-monitor':
          liveTopic = `meraki:rf:${id}`;
          break;
        case 'health-trend':
        case 'network-health':
          liveTopic = `meraki:health:${id}`;
          break;
        case 'topology':
          liveTopic = `meraki:topology:${id}`;
          break;
        case 'device-detail':
        case 'device-status':
        case 'poe-budget':
          liveTopic = `meraki:devices:${id}`;
          break;
        case 'alert-summary':
        case 'alert-correlation':
          liveTopic = `meraki:alerts:${id}`;
          break;
        case 'security-events':
          liveTopic = `meraki:security:${id}`;
          break;
        case 'bandwidth-utilization':
        case 'traffic-composition':
          liveTopic = `meraki:traffic:${id}`;
          break;
        case 'client-distribution':
          liveTopic = `meraki:clients:${id}`;
          break;
      }
    }

    // Build config with all available context
    const config: Record<string, string> = {};
    if (networkId) config.networkId = networkId;
    if (deviceSerial) config.deviceSerial = deviceSerial;
    // Use 'orgId' to match what LiveCanvasCard expects for polling context
    if (organizationId) config.orgId = organizationId;

    return {
      id: crypto.randomUUID(),
      type: suggestion.type,
      title: suggestion.title,
      data: extractedData,
      // Include layout with proper size and position
      layout: {
        x: position.x,
        y: position.y,
        w: size.w,
        h: size.h,
        minW: size.minW,
        minH: size.minH,
      },
      config: Object.keys(config).length > 0 ? config : undefined,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        costUsd: 0,
        isLive: !!liveTopic,
        sourceQuery: query,
        sourceMessageId,
        toolName,
        // Mark as auto-added for UI feedback
        autoAdded: true,
        // Mark as from template so it uses polling
        templateSource: 'ai-recommendation',
        subscription: liveTopic ? {
          topic: liveTopic,
          transformFn: `${suggestion.type}-transform`,
        } : undefined,
      },
    };
  };

  // Auto-add top suggestions to canvas (silently, cards animate on canvas)
  // Only auto-add for the most recent message to prevent historical messages from flooding the canvas
  useEffect(() => {
    if (suggestions.length === 0) return;
    if (!isLatestMessage) return;  // Only auto-add for the most recent message

    // CRITICAL: Wait for structuredData (tool_data) to be available before auto-adding cards
    // that need context like networkId. Otherwise cards are created without proper context.
    const { networkId } = extractContextFromData(structuredData);
    const needsNetworkContext = suggestions.some(s =>
      ['rf-analysis', 'interference-monitor', 'channel-utilization-heatmap', 'ssid-client-breakdown',
       'client-signal-strength', 'roaming-events', 'network-health', 'health-trend',
       'topology', 'device-status', 'alert-summary'].includes(s.type)
    );
    if (needsNetworkContext && !networkId) {
      // Don't auto-add yet - wait for tool_data with network context
      console.log('[SmartCardSuggestions] Waiting for network context before auto-adding cards');
      return;
    }

    // CRITICAL: Stop if we've already auto-added the max number of cards for this message
    // This prevents the cascading re-trigger bug where existingCards changes cause
    // suggestions to be re-computed and the effect to run again with a new "first" card
    if (autoAddCountRef.current >= MAX_AUTO_ADD_CARDS) return;

    // Track cards as we add them so position calculation is correct for each
    let currentCards = [...existingCards];

    for (const suggestion of suggestions.slice(0, MAX_AUTO_ADD_CARDS)) {
      // Double-check count limit inside loop
      if (autoAddCountRef.current >= MAX_AUTO_ADD_CARDS) break;

      // Skip if already auto-added for this message
      if (autoAddedRef.current.has(suggestion.type)) continue;

      // Skip if card of this type already exists on canvas
      if (currentCards.some(c => c.type === suggestion.type)) continue;

      // Create card with proper size and position
      const card = createCardFromSuggestion(suggestion, currentCards);
      onAddCard(card as CanvasCard);
      autoAddedRef.current.add(suggestion.type);
      autoAddCountRef.current++;  // Increment total count

      // Track this card for next position calculation
      currentCards = [...currentCards, card as CanvasCard];
    }
  }, [suggestions, existingCards, onAddCard, sourceMessageId, isLatestMessage, structuredData]);

  // Handle manually adding a suggested card (for remaining suggestions)
  const handleAddCard = (suggestion: CardSuggestion) => {
    // Use robust extraction to get networkId, deviceSerial, and organizationId
    const { networkId, deviceSerial, organizationId } = extractContextFromData(structuredData);

    const extractedData = suggestion.dataExtractor?.(structuredData, responseContent) || structuredData;

    // Get the appropriate size for this card type
    const size = CARD_SIZES[suggestion.type] || { w: 4, h: 3, minW: 3, minH: 2 };

    // Find the next available position that doesn't overlap with existing cards
    const position = findNextAvailablePosition(existingCards, size.w, size.h);

    // Determine if this card type supports live updates
    const liveCardTypes = [
      'rf-analysis', 'health-trend', 'topology', 'device-detail',
      'device-status', 'network-health', 'alert-summary', 'security-events',
      'bandwidth-utilization', 'traffic-composition', 'client-distribution',
      'interference-monitor', 'poe-budget', 'alert-correlation',
    ];
    const supportsLive = liveCardTypes.includes(suggestion.type) && (networkId || organizationId);

    // Build WebSocket topic based on card type
    let liveTopic: string | undefined;
    if (supportsLive) {
      const id = networkId || organizationId;
      switch (suggestion.type) {
        case 'rf-analysis':
        case 'interference-monitor':
          liveTopic = `meraki:rf:${id}`;
          break;
        case 'health-trend':
        case 'network-health':
          liveTopic = `meraki:health:${id}`;
          break;
        case 'topology':
          liveTopic = `meraki:topology:${id}`;
          break;
        case 'device-detail':
        case 'device-status':
        case 'poe-budget':
          liveTopic = `meraki:devices:${id}`;
          break;
        case 'alert-summary':
        case 'alert-correlation':
          liveTopic = `meraki:alerts:${id}`;
          break;
        case 'security-events':
          liveTopic = `meraki:security:${id}`;
          break;
        case 'bandwidth-utilization':
        case 'traffic-composition':
          liveTopic = `meraki:traffic:${id}`;
          break;
        case 'client-distribution':
          liveTopic = `meraki:clients:${id}`;
          break;
      }
    }

    // Build config with all available context
    const config: Record<string, string> = {};
    if (networkId) config.networkId = networkId;
    if (deviceSerial) config.deviceSerial = deviceSerial;
    // Use 'orgId' to match what LiveCanvasCard expects for polling context
    if (organizationId) config.orgId = organizationId;

    const card: Partial<CanvasCard> = {
      id: crypto.randomUUID(),
      type: suggestion.type,
      title: suggestion.title,
      data: extractedData,
      // Include config with all available context for cards that fetch real data
      config: Object.keys(config).length > 0 ? config : undefined,
      // Add layout with proper size and position
      layout: {
        x: position.x,
        y: position.y,
        w: size.w,
        h: size.h,
        minW: size.minW,
        minH: size.minH,
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        costUsd: 0,
        isLive: !!liveTopic,
        sourceQuery: query,
        sourceMessageId,
        toolName,
        // Mark as from AI recommendation so it uses polling
        templateSource: 'ai-recommendation',
        // Add WebSocket subscription for live updates
        subscription: liveTopic ? {
          topic: liveTopic,
          transformFn: `${suggestion.type}-transform`,
        } : undefined,
      },
    };

    onAddCard(card);
  };

  // Filter backend suggestions that don't already exist on canvas
  const filteredBackendSuggestions = backendSuggestions.filter(
    bs => !existingCards.some(c => c.type === bs.type)
  );

  // Get remaining suggestions that weren't auto-added (after first MAX_AUTO_ADD_CARDS)
  const remainingSuggestions = suggestions.slice(MAX_AUTO_ADD_CARDS).filter(
    s => !autoAddedRef.current.has(s.type) && !existingCards.some(c => c.type === s.type)
  );

  // Don't render anything if no auto-added cards, no remaining suggestions, and no backend suggestions
  if (remainingSuggestions.length === 0 && filteredBackendSuggestions.length === 0) {
    return null;
  }

  return (
    <div className={`mt-4 ${className}`}>
      {/* Backend suggestions (knowledge sources, etc.) - show first with higher priority */}
      {filteredBackendSuggestions.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Source Documents
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {filteredBackendSuggestions.map((suggestion, idx) => (
              <button
                key={`backend-${suggestion.type}-${idx}`}
                onClick={() => handleAddBackendCard(suggestion)}
                className="group flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-sm transition-all"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-800/50 text-amber-600 dark:text-amber-400">
                  <SuggestionIcon icon="book" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                    {suggestion.title}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {(suggestion.data as { documents?: unknown[] })?.documents?.length || 0} sources found
                  </div>
                </div>
                <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Remaining suggestions (after auto-added ones) - shown as manual buttons */}
      {remainingSuggestions.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            More visualizations available
          </div>
          <div className="flex flex-wrap gap-2">
            {remainingSuggestions.map((suggestion) => (
              <button
                key={suggestion.type}
                onClick={() => handleAddCard(suggestion)}
                className="group flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-cyan-500 dark:hover:border-cyan-500 hover:shadow-sm transition-all"
              >
                <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${getIconColor(suggestion.icon)}`}>
                  <SuggestionIcon icon={suggestion.icon} />
                </div>
                <div className="text-left">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                    {suggestion.title}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {suggestion.description}
                  </div>
                </div>
                <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
});

SmartCardSuggestions.displayName = 'SmartCardSuggestions';

export default SmartCardSuggestions;
