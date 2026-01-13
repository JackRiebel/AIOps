'use client';

import React from 'react';

export type ConnectionState = 'connected' | 'not-configured' | 'error' | 'testing';

interface ConnectionStatusProps {
  state: ConnectionState;
  message?: string;
  className?: string;
}

const STATUS_CONFIG: Record<ConnectionState, {
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  icon: React.ReactNode
}> = {
  connected: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-800',
    label: 'Connected',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  'not-configured': {
    color: 'text-gray-500 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    borderColor: 'border-gray-200 dark:border-gray-700',
    label: 'Not Configured',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
  },
  error: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    borderColor: 'border-red-200 dark:border-red-800',
    label: 'Connection Failed',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  testing: {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Testing...',
    icon: (
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    ),
  },
};

export function ConnectionStatus({ state, message, className = '' }: ConnectionStatusProps) {
  const config = STATUS_CONFIG[state];

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.borderColor} ${config.color} ${className}`}>
      {config.icon}
      <span>{message || config.label}</span>
    </div>
  );
}

// Compact dot-only version for card headers
export function ConnectionDot({ state, className = '' }: { state: ConnectionState; className?: string }) {
  const colors: Record<ConnectionState, string> = {
    connected: 'bg-green-500',
    'not-configured': 'bg-gray-400',
    error: 'bg-red-500',
    testing: 'bg-blue-500 animate-pulse',
  };

  return (
    <div
      className={`w-2.5 h-2.5 rounded-full ${colors[state]} ${className}`}
      title={STATUS_CONFIG[state].label}
    />
  );
}

export default ConnectionStatus;
