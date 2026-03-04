'use client';

import { memo, useState, useEffect } from 'react';
import { AlertTriangle, Settings, RotateCw, X, ExternalLink, Shield, Cpu, Wifi } from 'lucide-react';
import type { Device } from './types';
import { getStatusColor } from './types';

export interface DeviceActionModalsProps {
  showRebootModal: boolean;
  rebootDevice: Device | null;
  onRebootConfirm: () => void;
  onRebootCancel: () => void;
  showRemoveModal: boolean;
  removeDevice: Device | null;
  onRemoveConfirm: () => void;
  onRemoveCancel: () => void;
  showConfigureModal: boolean;
  configureDevice: Device | null;
  onConfigureClose: () => void;
}

function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <div className="animate-in zoom-in-95 fade-in duration-200">
        {children}
      </div>
    </div>
  );
}

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
    <ModalBackdrop onClose={onCancel}>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/40 shadow-2xl max-w-md w-full overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-200/60 dark:border-amber-500/20">
              <RotateCw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Confirm Reboot</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">This will restart the device</p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/60 dark:border-amber-500/15 rounded-xl">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Reboot <span className="font-mono font-semibold text-slate-900 dark:text-white">{device.name}</span>?
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              The device will be offline for approximately 1-2 minutes during the reboot process.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-medium text-sm"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg transition-all font-medium text-sm shadow-sm hover:shadow-md"
            >
              Reboot Device
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
});

RebootModal.displayName = 'RebootModal';

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
    <ModalBackdrop onClose={onCancel}>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/40 shadow-2xl max-w-md w-full overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-red-500 to-rose-500" />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 bg-red-50 dark:bg-red-500/10 rounded-xl flex items-center justify-center border border-red-200/60 dark:border-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Remove Device</h3>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">This action cannot be undone</p>
            </div>
          </div>

          <div className="mb-5 p-4 bg-red-50/50 dark:bg-red-500/5 border border-red-200/60 dark:border-red-500/15 rounded-xl">
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">This will permanently remove:</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">Device:</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">{device.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">Serial:</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">{device.serial}</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">
              Type <span className="font-mono font-semibold text-red-600 dark:text-red-400">{device.name}</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={device.name}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/40 font-mono text-sm placeholder-slate-400 dark:placeholder-slate-500 transition-all"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-medium text-sm"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-lg transition-all font-medium text-sm shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-sm"
            >
              Remove Device
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
});

RemoveModalInner.displayName = 'RemoveModalInner';

const ConfigureModal = memo(({
  device,
  onClose,
}: {
  device: Device;
  onClose: () => void;
}) => {
  const status = getStatusColor(device.status);

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/40 shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-cyan-50 dark:bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-200/60 dark:border-cyan-500/20">
                <Settings className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Device Details</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{device.name} &middot; {device.model}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/40 dark:border-slate-700/30">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Serial</p>
              <p className="text-sm text-slate-900 dark:text-white font-mono">{device.serial}</p>
            </div>
            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/40 dark:border-slate-700/30">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Status</p>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.bg} ${status.text} ${status.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {device.status?.toUpperCase() || 'UNKNOWN'}
              </span>
            </div>
            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/40 dark:border-slate-700/30">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1.5">IP Address</p>
              <p className="text-sm text-slate-900 dark:text-white font-mono">
                {device.lanIp || device.publicIp || 'N/A'}
              </p>
            </div>
            <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/40 dark:border-slate-700/30">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Firmware</p>
              <p className="text-sm text-slate-900 dark:text-white truncate">{device.firmware || 'N/A'}</p>
            </div>
            {device.mac && (
              <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/40 dark:border-slate-700/30 col-span-2">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1.5">MAC Address</p>
                <p className="text-sm text-slate-900 dark:text-white font-mono">{device.mac}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-medium text-sm"
            >
              Close
            </button>
            <button
              onClick={() => window.open('https://dashboard.meraki.com', '_blank')}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg transition-all font-medium text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
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
