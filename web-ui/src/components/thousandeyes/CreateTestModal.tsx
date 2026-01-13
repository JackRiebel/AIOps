'use client';

import { memo, useState } from 'react';
import { X, Zap, ChevronRight, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface CreateTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAI: (prompt: string) => Promise<void>;
  onCreateManual: (config: ManualTestConfig) => Promise<void>;
  loading: boolean;
  aiProcessing: boolean;
  error: string | null;
}

export interface ManualTestConfig {
  testName: string;
  url: string;
  testType: string;
  interval: number;
}

// ============================================================================
// Test Types
// ============================================================================

const testTypes = [
  { value: 'http-server', label: 'HTTP Server' },
  { value: 'page-load', label: 'Page Load' },
  { value: 'web-transactions', label: 'Web Transaction' },
  { value: 'agent-to-server', label: 'Agent to Server' },
  { value: 'agent-to-agent', label: 'Agent to Agent' },
  { value: 'bgp', label: 'BGP' },
  { value: 'dns-trace', label: 'DNS Trace' },
  { value: 'dns-server', label: 'DNS Server' },
  { value: 'dnssec', label: 'DNSSEC' },
  { value: 'sip-server', label: 'SIP Server' },
  { value: 'voice', label: 'Voice (RTP Stream)' },
];

const intervals = [
  { value: 60, label: 'Every minute' },
  { value: 120, label: 'Every 2 minutes' },
  { value: 300, label: 'Every 5 minutes' },
  { value: 600, label: 'Every 10 minutes' },
  { value: 900, label: 'Every 15 minutes' },
  { value: 1800, label: 'Every 30 minutes' },
  { value: 3600, label: 'Every hour' },
];

// ============================================================================
// CreateTestModal Component
// ============================================================================

export const CreateTestModal = memo(({
  isOpen,
  onClose,
  onCreateAI,
  onCreateManual,
  loading,
  aiProcessing,
  error,
}: CreateTestModalProps) => {
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testName, setTestName] = useState('');
  const [testUrl, setTestUrl] = useState('');
  const [testType, setTestType] = useState('http-server');
  const [testInterval, setTestInterval] = useState(300);

  const handleClose = () => {
    setAiPrompt('');
    setShowAdvanced(false);
    setTestName('');
    setTestUrl('');
    setTestType('http-server');
    setTestInterval(300);
    onClose();
  };

  const handleCreateAI = async () => {
    if (!aiPrompt.trim()) return;
    await onCreateAI(aiPrompt);
    handleClose();
  };

  const handleCreateManual = async () => {
    if (!testName || !testUrl) return;
    await onCreateManual({
      testName,
      url: testUrl,
      testType,
      interval: testInterval,
    });
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/50">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Create ThousandEyes Test
          </h3>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* AI Prompt Section */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Describe your test
              <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 rounded text-[10px] font-medium">
                AI-Powered
              </span>
            </label>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Example: Monitor the homepage of example.com every 5 minutes for availability and performance"
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm resize-none"
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Describe what you want to test. AI will configure the test for you.
            </p>
          </div>

          {/* Advanced Toggle */}
          <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              />
              Advanced Manual Configuration
            </button>
          </div>

          {/* Manual Configuration Form */}
          {showAdvanced && (
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  Test Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="My Website Performance Test"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  Target URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    Test Type
                  </label>
                  <select
                    value={testType}
                    onChange={(e) => setTestType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900 dark:text-white text-sm"
                  >
                    {testTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    Interval
                  </label>
                  <select
                    value={testInterval}
                    onChange={(e) => setTestInterval(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900 dark:text-white text-sm"
                  >
                    {intervals.map(i => (
                      <option key={i.value} value={i.value}>{i.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700/50">
          {showAdvanced ? (
            <button
              onClick={handleCreateManual}
              disabled={loading || !testName || !testUrl}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700 transition font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Test'
              )}
            </button>
          ) : (
            <button
              onClick={handleCreateAI}
              disabled={aiProcessing || !aiPrompt.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating with AI...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Create with AI
                </>
              )}
            </button>
          )}
          <button
            onClick={handleClose}
            disabled={loading || aiProcessing}
            className="px-4 py-2.5 bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600/50 transition font-medium disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
});

CreateTestModal.displayName = 'CreateTestModal';

export default CreateTestModal;
