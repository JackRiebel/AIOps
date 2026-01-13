'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import type { DeviceAction } from '@/services/device-context';
import type { ActionType, CanvasCard, ActionCardConfig } from '@/types/session';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * ActionMenu - Contextual dropdown menu for device actions
 *
 * Replaces inline action buttons with a clean dropdown that:
 * - Shows "Actions" button with dropdown
 * - Groups actions by type (Ping All, Blink LED, Cable Test, etc.)
 * - Device picker submenu for per-device actions
 * - Context-aware based on device types (switches get cable test, APs get RF analysis)
 */

interface ActionMenuProps {
  actions: DeviceAction[];
  onAddActionCard?: (card: Partial<CanvasCard>) => void;
  onExecuteAction?: (action: DeviceAction) => Promise<void>;
  className?: string;
}

// Action type metadata for grouping and display
interface ActionTypeInfo {
  type: ActionType;
  label: string;
  icon: React.ReactNode;
  color: string;
  supportsAll: boolean; // Can run on all devices at once
}

const ACTION_TYPE_INFO: Record<ActionType, ActionTypeInfo> = {
  'ping': {
    type: 'ping',
    label: 'Ping',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    ),
    color: 'text-cyan-600 dark:text-cyan-400',
    supportsAll: true,
  },
  'blink-led': {
    type: 'blink-led',
    label: 'Blink LED',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    color: 'text-amber-600 dark:text-amber-400',
    supportsAll: false,
  },
  'cable-test': {
    type: 'cable-test',
    label: 'Cable Test',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: 'text-purple-600 dark:text-purple-400',
    supportsAll: false,
  },
  'traceroute': {
    type: 'traceroute',
    label: 'Traceroute',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    color: 'text-blue-600 dark:text-blue-400',
    supportsAll: false,
  },
  'reboot': {
    type: 'reboot',
    label: 'Reboot',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    color: 'text-red-600 dark:text-red-400',
    supportsAll: false,
  },
  'wake-on-lan': {
    type: 'wake-on-lan',
    label: 'Wake-on-LAN',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
      </svg>
    ),
    color: 'text-green-600 dark:text-green-400',
    supportsAll: false,
  },
  'cycle-port': {
    type: 'cycle-port',
    label: 'Cycle Port',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3zm3 3h10m-10 4h10" />
      </svg>
    ),
    color: 'text-orange-600 dark:text-orange-400',
    supportsAll: false,
  },
};

// Group actions by action type
function groupActionsByType(actions: DeviceAction[]): Map<ActionType, DeviceAction[]> {
  const groups = new Map<ActionType, DeviceAction[]>();
  for (const action of actions) {
    if (!groups.has(action.actionType)) {
      groups.set(action.actionType, []);
    }
    groups.get(action.actionType)!.push(action);
  }
  return groups;
}

// Get unique devices from actions
function getUniqueDevices(actions: DeviceAction[]): Array<{ serial: string; name: string; model?: string }> {
  const seen = new Set<string>();
  const devices: Array<{ serial: string; name: string; model?: string }> = [];
  for (const action of actions) {
    if (!seen.has(action.device.serial)) {
      seen.add(action.device.serial);
      devices.push({
        serial: action.device.serial,
        name: action.device.name || action.device.serial,
        model: action.device.model,
      });
    }
  }
  return devices;
}

export const ActionMenu = memo(({
  actions,
  onAddActionCard,
  className = '',
}: ActionMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<ActionType | null>(null);
  const [addedCards, setAddedCards] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveSubmenu(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Create action card for a specific device and action
  const handleAddCard = useCallback((action: DeviceAction) => {
    if (!onAddActionCard) return;

    const cardKey = `${action.device.serial}-${action.actionType}`;
    if (addedCards.has(cardKey)) return;

    const actionConfig: ActionCardConfig = {
      actionType: action.actionType,
      targetDevice: {
        serial: action.device.serial,
        name: action.device.name || action.device.serial,
        model: action.device.model,
        networkId: action.device.networkId,
        ip: action.device.ip,
      },
    };

    const card: Partial<CanvasCard> = {
      id: crypto.randomUUID(),
      type: 'action',
      title: `${action.label}: ${action.device.name || action.device.serial}`,
      data: {
        actionType: action.actionType,
        targetDevice: actionConfig.targetDevice,
      },
      config: { actionConfig },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        costUsd: 0,
        isLive: false,
        toolName: `action_${action.actionType}`,
      },
    };

    onAddActionCard(card);
    setAddedCards(prev => new Set(prev).add(cardKey));
    setIsOpen(false);
    setActiveSubmenu(null);
  }, [onAddActionCard, addedCards]);

  // Create diagnostic card for all devices (ping all)
  const handlePingAll = useCallback(() => {
    if (!onAddActionCard) return;

    const devices = getUniqueDevices(actions);
    if (devices.length === 0) return;

    const cardKey = 'ping-all-devices';
    if (addedCards.has(cardKey)) return;

    const card: Partial<CanvasCard> = {
      id: crypto.randomUUID(),
      type: 'action',
      title: `Ping All Devices (${devices.length})`,
      data: {
        actionType: 'ping',
        targetDevices: devices,
        mode: 'batch',
      },
      config: {
        actionConfig: {
          actionType: 'ping',
          mode: 'batch',
        },
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        costUsd: 0,
        isLive: false,
        toolName: 'action_ping_batch',
      },
    };

    onAddActionCard(card);
    setAddedCards(prev => new Set(prev).add(cardKey));
    setIsOpen(false);
  }, [onAddActionCard, actions, addedCards]);

  if (actions.length === 0) return null;

  const actionGroups = groupActionsByType(actions);
  const devices = getUniqueDevices(actions);
  const hasPing = actionGroups.has('ping');

  return (
    <div className={`relative inline-flex ${className}`}>
      {/* Main Actions Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
          text-xs font-medium transition-all border
          ${isOpen
            ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-500'
            : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
          }
        `}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Actions
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50"
        >
          {/* Ping All Devices - only if ping actions exist */}
          {hasPing && devices.length > 0 && (
            <>
              <button
                onClick={handlePingAll}
                disabled={addedCards.has('ping-all-devices')}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                  ${addedCards.has('ping-all-devices')
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  }
                `}
              >
                <span className="text-cyan-600 dark:text-cyan-400">
                  {ACTION_TYPE_INFO['ping'].icon}
                </span>
                {addedCards.has('ping-all-devices') ? (
                  <>
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Ping All Added
                  </>
                ) : (
                  <>Ping All Devices ({devices.length})</>
                )}
              </button>
              <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
            </>
          )}

          {/* Action Type Groups with Device Submenus */}
          {Array.from(actionGroups.entries()).map(([actionType, deviceActions]) => {
            const info = ACTION_TYPE_INFO[actionType];
            if (!info) return null;

            // If only one device, show directly
            if (deviceActions.length === 1) {
              const action = deviceActions[0];
              const cardKey = `${action.device.serial}-${action.actionType}`;
              const isAdded = addedCards.has(cardKey);

              return (
                <button
                  key={actionType}
                  onClick={() => handleAddCard(action)}
                  disabled={isAdded}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                    ${isAdded
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                    }
                  `}
                >
                  <span className={info.color}>{info.icon}</span>
                  {isAdded ? (
                    <>
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {info.label} Added
                    </>
                  ) : (
                    <>
                      {info.label}: {action.device.name || action.device.serial.slice(-8)}
                    </>
                  )}
                </button>
              );
            }

            // Multiple devices - show submenu
            return (
              <div
                key={actionType}
                className="relative"
                onMouseEnter={() => setActiveSubmenu(actionType)}
                onMouseLeave={() => setActiveSubmenu(null)}
              >
                <button
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                >
                  <div className="flex items-center gap-2">
                    <span className={info.color}>{info.icon}</span>
                    {info.label}...
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* Device Submenu */}
                {activeSubmenu === actionType && (
                  <div className="absolute left-full top-0 ml-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
                    {deviceActions.map((action) => {
                      const cardKey = `${action.device.serial}-${action.actionType}`;
                      const isAdded = addedCards.has(cardKey);

                      return (
                        <button
                          key={cardKey}
                          onClick={() => handleAddCard(action)}
                          disabled={isAdded}
                          className={`
                            w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                            ${isAdded
                              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                            }
                          `}
                        >
                          {isAdded ? (
                            <>
                              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Added
                            </>
                          ) : (
                            <>
                              <span className="w-4 h-4 flex items-center justify-center text-xs font-medium bg-slate-200 dark:bg-slate-600 rounded">
                                {action.device.model?.slice(0, 2) || '??'}
                              </span>
                              {action.device.name || action.device.serial.slice(-8)}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Separator and Add Diagnostic Card */}
          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
          <button
            onClick={() => {
              // Add a generic diagnostic card that shows all available actions
              if (!onAddActionCard) return;

              const card: Partial<CanvasCard> = {
                id: crypto.randomUUID(),
                type: 'action',
                title: 'Network Diagnostics',
                data: {
                  actionType: 'ping',
                  mode: 'diagnostic',
                  availableDevices: devices,
                },
                config: {
                  actionConfig: {
                    actionType: 'ping',
                    mode: 'diagnostic',
                  },
                },
                metadata: {
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  costUsd: 0,
                  isLive: false,
                  toolName: 'action_diagnostic',
                },
              };

              onAddActionCard(card);
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Diagnostic Card
          </button>
        </div>
      )}
    </div>
  );
});

ActionMenu.displayName = 'ActionMenu';

export default ActionMenu;
