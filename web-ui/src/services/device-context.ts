/**
 * Device Context Extraction
 *
 * Extracts device mentions from AI responses and matches them against
 * known devices from session context or tool results.
 */

import type { ActionType } from '@/types/session';

// ============================================================================
// Types
// ============================================================================

export interface DetectedDevice {
  serial: string;
  name?: string;
  model?: string;
  networkId?: string;
  ip?: string;
  matchType: 'serial' | 'name' | 'model' | 'ip';
  matchedText: string;
}

export interface DeviceAction {
  device: DetectedDevice;
  actionType: ActionType;
  label: string;
  description: string;
}

// Meraki serial number pattern: XXXX-XXXX-XXXX (alphanumeric)
const SERIAL_PATTERN = /\b([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})\b/gi;

// Common Meraki model prefixes
const MODEL_PREFIXES = ['MX', 'MR', 'MS', 'MV', 'MT', 'MG', 'Z', 'CW', 'GR', 'GS', 'GX'];

// Model pattern: prefix + numbers (e.g., MX68, MR46, MS220-8P)
const MODEL_PATTERN = new RegExp(
  `\\b(${MODEL_PREFIXES.join('|')}\\d+[A-Z0-9-]*)\\b`,
  'gi'
);

// IP address pattern
const IP_PATTERN = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;

// ============================================================================
// Device Detection
// ============================================================================

/**
 * Extract device serials from text
 */
export function extractSerials(text: string): string[] {
  const matches = text.match(SERIAL_PATTERN) || [];
  // Normalize to uppercase and dedupe
  return [...new Set(matches.map(s => s.toUpperCase()))];
}

/**
 * Extract model numbers from text
 */
export function extractModels(text: string): string[] {
  const matches = text.match(MODEL_PATTERN) || [];
  return [...new Set(matches.map(m => m.toUpperCase()))];
}

/**
 * Extract IP addresses from text
 */
export function extractIPs(text: string): string[] {
  const matches = text.match(IP_PATTERN) || [];
  return [...new Set(matches)];
}

/**
 * Extract device names from text by matching against known devices
 */
export function extractDeviceNames(
  text: string,
  knownDevices: Array<{ name: string; serial: string; model?: string }>
): DetectedDevice[] {
  const detected: DetectedDevice[] = [];

  for (const device of knownDevices) {
    if (!device.name) continue;

    // Case-insensitive match for device name
    const nameRegex = new RegExp(`\\b${escapeRegex(device.name)}\\b`, 'gi');
    if (nameRegex.test(text)) {
      detected.push({
        serial: device.serial,
        name: device.name,
        model: device.model,
        matchType: 'name',
        matchedText: device.name,
      });
    }
  }

  return detected;
}

/**
 * Extract all device mentions from text
 */
export function extractDeviceMentions(
  text: string,
  knownDevices: Array<{ name: string; serial: string; model?: string; lanIp?: string }> = []
): DetectedDevice[] {
  const detected: DetectedDevice[] = [];
  const seenSerials = new Set<string>();

  // 1. Extract by serial number (most reliable)
  const serials = extractSerials(text);
  for (const serial of serials) {
    if (seenSerials.has(serial)) continue;
    seenSerials.add(serial);

    // Try to find full device info
    const known = knownDevices.find(d => d.serial.toUpperCase() === serial);
    detected.push({
      serial,
      name: known?.name,
      model: known?.model,
      ip: known?.lanIp,
      matchType: 'serial',
      matchedText: serial,
    });
  }

  // 2. Extract by device name (from known devices)
  const byName = extractDeviceNames(text, knownDevices);
  for (const device of byName) {
    if (!seenSerials.has(device.serial)) {
      seenSerials.add(device.serial);
      detected.push(device);
    }
  }

  // 3. Extract by model number (less specific, only if we can match to known device)
  const models = extractModels(text);
  for (const model of models) {
    // Find devices matching this model
    const matching = knownDevices.filter(d =>
      d.model?.toUpperCase().includes(model)
    );

    for (const device of matching) {
      if (!seenSerials.has(device.serial)) {
        seenSerials.add(device.serial);
        detected.push({
          serial: device.serial,
          name: device.name,
          model: device.model,
          matchType: 'model',
          matchedText: model,
        });
      }
    }
  }

  return detected;
}

// ============================================================================
// Action Suggestions
// ============================================================================

/**
 * Get suggested actions for a detected device based on its type
 */
export function getSuggestedActions(device: DetectedDevice): DeviceAction[] {
  const actions: DeviceAction[] = [];
  const model = device.model?.toUpperCase() || '';

  // Ping is available for all devices
  actions.push({
    device,
    actionType: 'ping',
    label: 'Ping',
    description: `Ping from ${device.name || device.serial}`,
  });

  // Blink LED - available for most devices
  actions.push({
    device,
    actionType: 'blink-led',
    label: 'Blink LED',
    description: `Identify ${device.name || device.serial} by blinking its LEDs`,
  });

  // Cable test - only for switches (MS)
  if (model.startsWith('MS')) {
    actions.push({
      device,
      actionType: 'cable-test',
      label: 'Cable Test',
      description: `Run cable test on ${device.name || device.serial}`,
    });
  }

  // Wake on LAN - only for switches
  if (model.startsWith('MS')) {
    actions.push({
      device,
      actionType: 'wake-on-lan',
      label: 'Wake on LAN',
      description: `Send WoL packet from ${device.name || device.serial}`,
    });
  }

  // Port cycling - only for switches
  if (model.startsWith('MS')) {
    actions.push({
      device,
      actionType: 'cycle-port',
      label: 'Cycle Port',
      description: `Cycle a port on ${device.name || device.serial}`,
    });
  }

  return actions;
}

/**
 * Get quick actions for detected devices in an AI response
 */
export function getQuickActionsFromResponse(
  responseContent: string,
  knownDevices: Array<{ name: string; serial: string; model?: string; lanIp?: string }> = []
): DeviceAction[] {
  const detected = extractDeviceMentions(responseContent, knownDevices);

  // Get actions for each device, but limit to most relevant
  const allActions: DeviceAction[] = [];

  for (const device of detected.slice(0, 3)) { // Max 3 devices
    const deviceActions = getSuggestedActions(device);
    // Only include ping and blink for inline suggestions (most common)
    const quickActions = deviceActions.filter(a =>
      a.actionType === 'ping' || a.actionType === 'blink-led'
    );
    allActions.push(...quickActions.slice(0, 2)); // Max 2 actions per device
  }

  return allActions;
}

// ============================================================================
// Helpers
// ============================================================================

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
