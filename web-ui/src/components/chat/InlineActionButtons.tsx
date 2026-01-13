'use client';

import { memo, useState, useCallback } from 'react';
import type { DeviceAction } from '@/services/device-context';
import type { ActionType, CanvasCard, ActionCardConfig } from '@/types/session';

/**
 * InlineActionButtons - Quick action buttons shown below AI responses
 *
 * These buttons allow users to quickly:
 * - Add an action card to the canvas (ping, blink LED, etc.)
 * - Execute an action directly
 */

interface InlineActionButtonsProps {
  actions: DeviceAction[];
  onAddActionCard?: (card: Partial<CanvasCard>) => void;
  onExecuteAction?: (action: DeviceAction) => Promise<void>;
  className?: string;
}

// Icon components for each action type
function ActionIcon({ type, className = 'w-3.5 h-3.5' }: { type: ActionType; className?: string }) {
  switch (type) {
    case 'ping':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
      );
    case 'blink-led':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    case 'cable-test':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'reboot':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

// Get button color based on action type
function getActionColor(type: ActionType): string {
  switch (type) {
    case 'ping':
      return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 border-cyan-500/30';
    case 'blink-led':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30';
    case 'cable-test':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border-purple-500/30';
    case 'reboot':
      return 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border-red-500/30';
    default:
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 border-slate-500/30';
  }
}

export const InlineActionButtons = memo(({
  actions,
  onAddActionCard,
  className = '',
}: InlineActionButtonsProps) => {
  const [addedActions, setAddedActions] = useState<Set<string>>(new Set());

  const handleAddCard = useCallback((action: DeviceAction) => {
    if (!onAddActionCard) return;

    const actionKey = `${action.device.serial}-${action.actionType}`;
    if (addedActions.has(actionKey)) return;

    // Create the action card config
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

    // Create the card
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
    setAddedActions(prev => new Set(prev).add(actionKey));
  }, [onAddActionCard, addedActions]);

  if (actions.length === 0) return null;

  // Group actions by device
  const deviceGroups = new Map<string, DeviceAction[]>();
  for (const action of actions) {
    const key = action.device.serial;
    if (!deviceGroups.has(key)) {
      deviceGroups.set(key, []);
    }
    deviceGroups.get(key)!.push(action);
  }

  return (
    <div className={`flex flex-wrap gap-2 mt-3 ${className}`}>
      {Array.from(deviceGroups.entries()).map(([serial, deviceActions]) => (
        <div key={serial} className="flex items-center gap-1.5">
          {/* Device label */}
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
            {deviceActions[0].device.name || serial.slice(-8)}
          </span>

          {/* Action buttons for this device */}
          {deviceActions.map((action) => {
            const actionKey = `${action.device.serial}-${action.actionType}`;
            const isAdded = addedActions.has(actionKey);

            return (
              <button
                key={actionKey}
                onClick={() => handleAddCard(action)}
                disabled={isAdded}
                className={`
                  inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium
                  rounded-md border transition-all duration-150
                  ${isAdded
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 cursor-default'
                    : getActionColor(action.actionType)
                  }
                  disabled:opacity-60
                `}
                title={action.description}
              >
                {isAdded ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Added
                  </>
                ) : (
                  <>
                    <ActionIcon type={action.actionType} />
                    {action.label}
                  </>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});

InlineActionButtons.displayName = 'InlineActionButtons';

export default InlineActionButtons;
