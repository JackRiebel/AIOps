'use client';

import { memo, useState } from 'react';
import { AlertTriangle, Settings, RotateCw, X, ExternalLink } from 'lucide-react';
import type { Device } from './types';
import { getStatusBadge } from './types';

// ============================================================================
// Types
// ============================================================================

export interface DeviceActionModalsProps {
  // Reboot Modal
  showRebootModal: boolean;
  rebootDevice: Device | null;
  onRebootConfirm: () => void;
  onRebootCancel: () => void;

  // Remove Modal
  showRemoveModal: boolean;
  removeDevice: Device | null;
  onRemoveConfirm: () => void;
  onRemoveCancel: () => void;

  // Configure Modal
  showConfigureModal: boolean;
  configureDevice: Device | null;
  onConfigureClose: () => void;
}

// ============================================================================
// Modal Backdrop
// ============================================================================

function ModalBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      {children}
    </div>
  );
}

// ============================================================================
// RebootModal Component
// ============================================================================

const RebootModal = memo(({
  device,
  onConfirm,
  onCancel,
}: {
  device: Device;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  return (
    <ModalBackdrop>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-2xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-200 dark:border-amber-500/20">
              <RotateCw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Confirm Reboot</h3>
              <p className="text-sm text-slate-500 dark:text-slate-500">This will restart the device</p>
            </div>
          </div>

          {/* Content */}
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Reboot <span className="font-mono font-medium text-slate-900 dark:text-white">{device.name}</span>?
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              The device will be offline for 1-2 minutes.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600/50 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium"
            >
              Reboot
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
});

RebootModal.displayName = 'RebootModal';

// ============================================================================
// RemoveModal Component
// ============================================================================

// Wrapper to provide key-based remounting for state reset
const RemoveModalWrapper = memo(({
  device,
  onConfirm,
  onCancel,
}: {
  device: Device;
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <RemoveModalInner
    key={device.serial}
    device={device}
    onConfirm={onConfirm}
    onCancel={onCancel}
  />
));

RemoveModalWrapper.displayName = 'RemoveModalWrapper';

const RemoveModalInner = memo(({
  device,
  onConfirm,
  onCancel,
}: {
  device: Device;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const [confirmText, setConfirmText] = useState('');
  const canConfirm = confirmText === device.name;

  return (
    <ModalBackdrop>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-2xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-500/10 rounded-lg flex items-center justify-center border border-red-200 dark:border-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Remove Device</h3>
              <p className="text-sm text-slate-500 dark:text-slate-500">This cannot be undone</p>
            </div>
          </div>

          {/* Warning */}
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg">
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">This will permanently remove:</p>
            <ul className="text-sm text-slate-500 dark:text-slate-400 list-disc list-inside space-y-1">
              <li>Device: <span className="font-mono text-slate-900 dark:text-white">{device.name}</span></li>
              <li>Serial: <span className="font-mono text-slate-900 dark:text-white">{device.serial}</span></li>
            </ul>
          </div>

          {/* Confirmation Input */}
          <div className="mb-6">
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">
              Type <span className="font-mono text-red-600 dark:text-red-400">{device.name}</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={device.name}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-mono placeholder-slate-400 dark:placeholder-slate-500"
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600/50 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
});

RemoveModalInner.displayName = 'RemoveModalInner';

// ============================================================================
// ConfigureModal Component
// ============================================================================

const ConfigureModal = memo(({
  device,
  onClose,
}: {
  device: Device;
  onClose: () => void;
}) => {
  return (
    <ModalBackdrop>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-2xl max-w-lg w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-200 dark:border-blue-500/20">
                <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Device Details</h3>
                <p className="text-sm text-slate-500 dark:text-slate-500">{device.name} ({device.model})</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-white transition p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Device Info Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50">
              <p className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-1">Serial</p>
              <p className="text-sm text-slate-900 dark:text-white font-mono">{device.serial}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50">
              <p className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-1">Status</p>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadge(device.status)}`}>
                {device.status?.toUpperCase()}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50">
              <p className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-1">IP Address</p>
              <p className="text-sm text-slate-900 dark:text-white font-mono">
                {device.lanIp || device.publicIp || 'N/A'}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50">
              <p className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-1">Firmware</p>
              <p className="text-sm text-slate-900 dark:text-white">{device.firmware || 'N/A'}</p>
            </div>
            {device.mac && (
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50 col-span-2">
                <p className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-1">MAC Address</p>
                <p className="text-sm text-slate-900 dark:text-white font-mono">{device.mac}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600/50 transition font-medium"
            >
              Close
            </button>
            <button
              onClick={() => window.open('https://dashboard.meraki.com', '_blank')}
              className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium flex items-center justify-center gap-2"
            >
              Open Dashboard
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
});

ConfigureModal.displayName = 'ConfigureModal';

// ============================================================================
// DeviceActionModals Component
// ============================================================================

export const DeviceActionModals = memo(({
  showRebootModal,
  rebootDevice,
  onRebootConfirm,
  onRebootCancel,
  showRemoveModal,
  removeDevice,
  onRemoveConfirm,
  onRemoveCancel,
  showConfigureModal,
  configureDevice,
  onConfigureClose,
}: DeviceActionModalsProps) => {
  return (
    <>
      {showRebootModal && rebootDevice && (
        <RebootModal
          device={rebootDevice}
          onConfirm={onRebootConfirm}
          onCancel={onRebootCancel}
        />
      )}

      {showRemoveModal && removeDevice && (
        <RemoveModalWrapper
          device={removeDevice}
          onConfirm={onRemoveConfirm}
          onCancel={onRemoveCancel}
        />
      )}

      {showConfigureModal && configureDevice && (
        <ConfigureModal
          device={configureDevice}
          onClose={onConfigureClose}
        />
      )}
    </>
  );
});

DeviceActionModals.displayName = 'DeviceActionModals';

export default DeviceActionModals;
