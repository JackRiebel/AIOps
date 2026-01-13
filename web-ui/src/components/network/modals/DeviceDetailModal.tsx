'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Server, Activity, Settings, History, Wifi, AlertTriangle, ChevronRight } from 'lucide-react';
import type { DeviceSummary } from '../types';

interface DeviceDetailModalProps {
  device: DeviceSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onAskAI?: (query: string) => void;
}

type TabId = 'overview' | 'status' | 'config' | 'logs';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: <Server className="w-4 h-4" /> },
  { id: 'status', label: 'Status', icon: <Activity className="w-4 h-4" /> },
  { id: 'config', label: 'Config', icon: <Settings className="w-4 h-4" /> },
  { id: 'logs', label: 'Logs', icon: <History className="w-4 h-4" /> },
];

export function DeviceDetailModal({ device, isOpen, onClose, onAskAI }: DeviceDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Reset tab when device changes
  useEffect(() => {
    setActiveTab('overview');
  }, [device?.serial]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!device) return null;

  const statusColors = {
    online: 'text-green-500 bg-green-500/10',
    offline: 'text-slate-400 bg-slate-400/10',
    alerting: 'text-amber-500 bg-amber-500/10',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[700px] md:max-h-[80vh] bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${statusColors[device.status]}`}>
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {device.name || device.model}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                    {device.serial}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700/50 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {activeTab === 'overview' && (
                <OverviewTab device={device} onAskAI={onAskAI} />
              )}
              {activeTab === 'status' && <StatusTab device={device} />}
              {activeTab === 'config' && <ConfigTab device={device} />}
              {activeTab === 'logs' && <LogsTab device={device} />}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[device.status]}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    device.status === 'online' ? 'bg-green-500' :
                    device.status === 'alerting' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'
                  }`} />
                  {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                </span>
              </div>
              {onAskAI && (
                <button
                  onClick={() => onAskAI(`Tell me about device ${device.serial}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Ask AI about this device
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Tab Components
// ============================================================================

function OverviewTab({ device, onAskAI }: { device: DeviceSummary; onAskAI?: (query: string) => void }) {
  const infoItems = [
    { label: 'Model', value: device.model },
    { label: 'Serial', value: device.serial },
    { label: 'Status', value: device.status },
    { label: 'Network ID', value: device.networkId || 'N/A' },
  ];

  return (
    <div className="space-y-6">
      {/* Device Info */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
          Device Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {infoItems.map((item) => (
            <div
              key={item.label}
              className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                {item.label}
              </p>
              <p className="text-sm font-medium text-slate-900 dark:text-white font-mono">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      {onAskAI && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: <Wifi className="w-4 h-4" />, label: 'Check connectivity', query: `Check connectivity for device ${device.serial}` },
              { icon: <Activity className="w-4 h-4" />, label: 'View performance', query: `Show performance metrics for ${device.serial}` },
              { icon: <AlertTriangle className="w-4 h-4" />, label: 'Recent alerts', query: `What alerts are there for device ${device.serial}` },
              { icon: <History className="w-4 h-4" />, label: 'View history', query: `Show recent changes for ${device.serial}` },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => onAskAI(action.query)}
                className="flex items-center gap-2 p-3 text-left text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-colors"
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusTab({ device }: { device: DeviceSummary }) {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Real-time status data would be fetched from the API.
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          Device: {device.serial}
        </p>
      </div>
    </div>
  );
}

function ConfigTab({ device }: { device: DeviceSummary }) {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configuration data would be fetched from the API.
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          Device: {device.serial}
        </p>
      </div>
    </div>
  );
}

function LogsTab({ device }: { device: DeviceSummary }) {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Event logs would be fetched from the API.
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          Device: {device.serial}
        </p>
      </div>
    </div>
  );
}
