'use client';

import React, { useState } from 'react';

export interface FieldConfig {
  key: string;
  displayName: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;  // Pre-filled value when no config exists
  type?: 'text' | 'password' | 'url' | 'number' | 'select' | 'boolean';
  options?: string[];
  required?: boolean;
  helpUrl?: string;
}

interface SettingsFieldProps {
  config: FieldConfig;
  value: string;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  error?: string;
  source?: 'database' | 'env' | 'default' | 'none';
}

export function SettingsField({
  config,
  value,
  onChange,
  disabled = false,
  error,
  source,
}: SettingsFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = config.type === 'password';

  const handleChange = (newValue: string) => {
    onChange(config.key, newValue);
  };

  const renderInput = () => {
    const baseClasses = `
      w-full px-3 py-2 rounded-lg border text-sm
      bg-white dark:bg-slate-800
      border-slate-200 dark:border-slate-700
      text-slate-900 dark:text-slate-100
      placeholder-slate-400 dark:placeholder-slate-500
      focus:ring-2 focus:ring-cyan-500 focus:border-transparent
      disabled:opacity-50 disabled:cursor-not-allowed
      ${error ? 'border-red-500 dark:border-red-400' : ''}
    `;

    // Boolean toggle
    if (config.type === 'boolean') {
      return (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleChange(value === 'true' ? 'false' : 'true')}
            disabled={disabled}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full
              transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2
              ${value === 'true' ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-600'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                ${value === 'true' ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {value === 'true' ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      );
    }

    // Select dropdown
    if (config.type === 'select' && config.options) {
      return (
        <select
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className={baseClasses}
        >
          <option value="">Select...</option>
          {config.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    // Number input
    if (config.type === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={config.placeholder}
          disabled={disabled}
          className={baseClasses}
        />
      );
    }

    // Password with show/hide toggle
    if (isPassword) {
      return (
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={config.placeholder || 'Enter value...'}
            disabled={disabled}
            className={`${baseClasses} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 rounded"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      );
    }

    // Default text/url input
    return (
      <input
        type={config.type === 'url' ? 'url' : 'text'}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={config.placeholder || 'Enter value...'}
        disabled={disabled}
        className={baseClasses}
      />
    );
  };

  const renderSourceBadge = () => {
    if (!source || source === 'none') return null;

    const sourceConfig: Record<string, { label: string; color: string }> = {
      database: { label: 'DB', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      env: { label: 'ENV', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
      default: { label: 'Default', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    };

    const s = sourceConfig[source];
    if (!s) return null;

    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${s.color}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          {config.displayName}
          {config.required && <span className="text-red-500">*</span>}
          {renderSourceBadge()}
        </label>
        {config.helpUrl && (
          <a
            href={config.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
          >
            Docs
          </a>
        )}
      </div>

      {renderInput()}

      {config.description && !error && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{config.description}</p>
      )}

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export default SettingsField;
