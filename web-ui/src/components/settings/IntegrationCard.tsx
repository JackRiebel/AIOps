'use client';

import React, { useState, useCallback } from 'react';
import { ConnectionStatus, ConnectionDot, type ConnectionState } from './ConnectionStatus';
import { SettingsField, type FieldConfig } from './SettingsField';

export interface IntegrationConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  fields: FieldConfig[];
  testable?: boolean;
  docUrl?: string;
  configNote?: {
    title: string;
    lines: string[];
    warning?: string;
  };
}

interface IntegrationCardProps {
  config: IntegrationConfig;
  values: Record<string, string>;
  sources: Record<string, 'database' | 'env' | 'default' | 'none'>;
  onSave: (values: Record<string, string>) => Promise<void>;
  onTest?: () => Promise<{ success: boolean; message: string }>;
  onReset?: () => void;
  defaultExpanded?: boolean;
}

export function IntegrationCard({
  config,
  values,
  sources,
  onSave,
  onTest,
  onReset,
  defaultExpanded = false,
}: IntegrationCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate connection state
  const getConnectionState = (): ConnectionState => {
    if (isTesting) return 'testing';
    if (testResult?.success === false) return 'error';
    if (testResult?.success === true) return 'connected';

    // Check if any required fields have values
    const hasAnyValue = config.fields.some((f) => {
      const val = editedValues[f.key] ?? values[f.key];
      return val && val.trim() !== '';
    });

    return hasAnyValue ? 'connected' : 'not-configured';
  };

  const connectionState = getConnectionState();

  // Check for unsaved changes (edited values OR unsaved default values)
  const hasChanges = Object.keys(editedValues).length > 0 || config.fields.some((field) => {
    const value = editedValues[field.key] ?? values[field.key] ?? '';
    const source = sources[field.key];
    // Has a value but not saved to database yet
    return value && (source === 'none' || source === 'default');
  });

  // Get effective value (edited or original)
  const getValue = (key: string) => editedValues[key] ?? values[key] ?? '';

  const handleFieldChange = useCallback((key: string, value: string) => {
    setEditedValues((prev) => {
      const newValues = { ...prev };
      if (value === values[key]) {
        delete newValues[key];
      } else {
        newValues[key] = value;
      }
      return newValues;
    });
    setTestResult(null);
    setErrors((prev) => ({ ...prev, [key]: '' }));
  }, [values]);

  const handleSave = async () => {
    // Validate required fields
    const newErrors: Record<string, string> = {};
    config.fields.forEach((field) => {
      if (field.required && !getValue(field.key)) {
        newErrors[field.key] = 'This field is required';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      // Save edited values AND unsaved default values
      const saveValues: Record<string, string> = {};
      config.fields.forEach((field) => {
        const value = getValue(field.key);
        const source = sources[field.key];
        // Save if: edited, OR has a value but not saved to database yet
        if (editedValues[field.key] !== undefined) {
          saveValues[field.key] = editedValues[field.key];
        } else if (value && (source === 'none' || source === 'default')) {
          // Default value that hasn't been saved - include it
          saveValues[field.key] = value;
        }
      });

      await onSave(saveValues);
      setEditedValues({});
      setTestResult(null);
    } catch (err) {
      setErrors({ _general: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!onTest) return;

    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleReset = () => {
    setEditedValues({});
    setTestResult(null);
    setErrors({});
    onReset?.();
  };

  return (
    <div
      className={`
        rounded-xl border transition-all duration-200
        ${isExpanded
          ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'
          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm'
        }
      `}
    >
      {/* Card Header - Always Visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={`${config.name}: ${isExpanded ? 'Click to collapse' : 'Click to expand and configure'}`}
        className="w-full px-4 py-3 flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500/50 rounded-xl"
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center`} aria-hidden="true">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
            </svg>
          </div>

          {/* Name & Description */}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-900 dark:text-slate-100">{config.name}</h3>
              <ConnectionDot state={connectionState} />
            </div>
            {!isExpanded && (
              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                {config.description}
              </p>
            )}
          </div>
        </div>

        {/* Expand/Collapse Icon */}
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Description */}
          <p className="text-sm text-slate-600 dark:text-slate-400">{config.description}</p>

          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <ConnectionStatus state={connectionState} message={testResult?.message} />
            {config.docUrl && (
              <a
                href={config.docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 rounded"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Documentation
                <span className="sr-only">(opens in new tab)</span>
              </a>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {config.fields.map((field) => (
              <SettingsField
                key={field.key}
                config={field}
                value={getValue(field.key)}
                onChange={handleFieldChange}
                disabled={isSaving}
                error={errors[field.key]}
                source={sources[field.key]}
              />
            ))}
          </div>

          {/* Configuration Note */}
          {config.configNote && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs space-y-1">
                  <p className="font-medium text-blue-700 dark:text-blue-300">{config.configNote.title}</p>
                  {config.configNote.lines.map((line, i) => (
                    <p key={i} className="text-blue-600 dark:text-blue-200">{line}</p>
                  ))}
                  {config.configNote.warning && (
                    <p className="text-amber-600 dark:text-amber-400 mt-1">{config.configNote.warning}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* General Error */}
          {errors._general && (
            <div role="alert" className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{errors._general}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              {config.testable && onTest && (
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting || isSaving}
                  aria-label={isTesting ? 'Testing connection' : 'Test connection'}
                  className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  {isTesting ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Testing...
                    </span>
                  ) : (
                    'Test Connection'
                  )}
                </button>
              )}
              {hasChanges && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isSaving}
                  aria-label="Reset changes"
                  className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/50 rounded-lg"
                >
                  Reset
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              aria-label={isSaving ? 'Saving changes' : 'Save changes'}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2
                ${hasChanges
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                }
                disabled:opacity-50
              `}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default IntegrationCard;
