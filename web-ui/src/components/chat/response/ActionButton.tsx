'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Check, X, ExternalLink, Copy, Download, Play, Settings } from 'lucide-react';

export type ActionButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
export type ActionButtonSize = 'sm' | 'md' | 'lg';

export interface ActionButtonProps {
  label: string;
  icon?: React.ReactNode;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  showConfirmation?: boolean;
  confirmationMessage?: string;
  className?: string;
}

const variantClasses: Record<ActionButtonVariant, string> = {
  primary: 'bg-cyan-500 hover:bg-cyan-600 text-white',
  secondary: 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300',
  success: 'bg-green-500 hover:bg-green-600 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
};

const sizeClasses: Record<ActionButtonSize, string> = {
  sm: 'px-2 py-1 text-xs gap-1',
  md: 'px-3 py-1.5 text-sm gap-1.5',
  lg: 'px-4 py-2 text-sm gap-2',
};

export function ActionButton({
  label,
  icon,
  variant = 'secondary',
  size = 'md',
  onClick,
  disabled = false,
  loading = false,
  showConfirmation = false,
  confirmationMessage = 'Are you sure?',
  className = '',
}: ActionButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleClick = async () => {
    if (showConfirmation && !isConfirming) {
      setIsConfirming(true);
      return;
    }

    setIsConfirming(false);
    setIsLoading(true);
    setStatus('idle');

    try {
      await onClick();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsConfirming(false);
  };

  const actualLoading = loading || isLoading;

  // Confirmation state
  if (isConfirming) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {confirmationMessage}
        </span>
        <button
          onClick={handleClick}
          className="p-1 rounded bg-green-500 hover:bg-green-600 text-white transition-colors"
          aria-label="Confirm"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-400 transition-colors"
          aria-label="Cancel"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Status icons
  const statusIcon = () => {
    if (actualLoading) {
      return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    }
    if (status === 'success') {
      return <Check className="w-3.5 h-3.5 text-green-500" />;
    }
    if (status === 'error') {
      return <X className="w-3.5 h-3.5 text-red-500" />;
    }
    return icon;
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled || actualLoading}
      className={`inline-flex items-center font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
    >
      {statusIcon()}
      {label}
    </motion.button>
  );
}

// Pre-configured action buttons
export function ApplyFixButton(props: Omit<ActionButtonProps, 'label' | 'icon' | 'variant'>) {
  return (
    <ActionButton
      label="Apply Fix"
      icon={<Play className="w-3.5 h-3.5" />}
      variant="success"
      showConfirmation
      confirmationMessage="Apply this fix?"
      {...props}
    />
  );
}

export function CopyButton(props: Omit<ActionButtonProps, 'label' | 'icon'>) {
  return (
    <ActionButton
      label="Copy"
      icon={<Copy className="w-3.5 h-3.5" />}
      variant="secondary"
      {...props}
    />
  );
}

export function ExportButton(props: Omit<ActionButtonProps, 'label' | 'icon'>) {
  return (
    <ActionButton
      label="Export"
      icon={<Download className="w-3.5 h-3.5" />}
      variant="secondary"
      {...props}
    />
  );
}

export function ViewDetailsButton(props: Omit<ActionButtonProps, 'label' | 'icon'>) {
  return (
    <ActionButton
      label="View Details"
      icon={<ExternalLink className="w-3.5 h-3.5" />}
      variant="secondary"
      {...props}
    />
  );
}

export function ConfigureButton(props: Omit<ActionButtonProps, 'label' | 'icon'>) {
  return (
    <ActionButton
      label="Configure"
      icon={<Settings className="w-3.5 h-3.5" />}
      variant="secondary"
      {...props}
    />
  );
}
