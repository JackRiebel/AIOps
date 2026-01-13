/**
 * Python Reference Panel
 *
 * Displays SDK documentation, method signatures, and examples.
 */

'use client';

import React, { memo, useState, useMemo, useCallback } from 'react';
import { ALL_SDK_MODULES, SDKModule, SDKMethod } from './pythonSDK';
import { PYTHON_TEMPLATES, PythonTemplate } from './pythonTemplates';

// ============================================================================
// Types
// ============================================================================

type TabType = 'modules' | 'methods' | 'examples';

interface PythonReferenceProps {
  onInsert?: (code: string) => void;
  compact?: boolean;
}

// ============================================================================
// Module Badge Component
// ============================================================================

const ModuleBadge = memo(function ModuleBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    meraki: 'bg-green-600',
    splunk: 'bg-orange-600',
    thousandeyes: 'bg-blue-600',
    notify: 'bg-purple-600',
    ai: 'bg-pink-600',
    logger: 'bg-gray-600',
    context: 'bg-cyan-600',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${colors[name] || 'bg-gray-600'}`}>
      {name}
    </span>
  );
});

// ============================================================================
// Method Card Component
// ============================================================================

const MethodCard = memo(function MethodCard({
  module,
  method,
  onInsert,
}: {
  module: SDKModule;
  method: SDKMethod;
  onInsert?: (code: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const insertCode = method.isAsync
    ? `await ${module.name}.${method.name}()`
    : `${module.name}.${method.name}()`;

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-750 text-left"
      >
        <div className="flex items-center gap-2">
          <ModuleBadge name={module.name} />
          <span className="font-mono text-sm text-gray-200">{method.name}</span>
          {method.isAsync && (
            <span className="text-xs text-yellow-500">async</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-3 py-2 bg-gray-800 border-t border-gray-700">
          {/* Signature */}
          <div className="mb-2">
            <div className="text-xs text-gray-500 mb-1">Signature</div>
            <code className="text-xs text-green-400 bg-gray-900 px-2 py-1 rounded block overflow-x-auto">
              {method.signature}
            </code>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-400 mb-2">{method.description}</p>

          {/* Parameters */}
          {method.params.length > 0 && (
            <div className="mb-2">
              <div className="text-xs text-gray-500 mb-1">Parameters</div>
              <div className="space-y-1">
                {method.params.map((param) => (
                  <div key={param.name} className="text-xs">
                    <span className="text-blue-400">{param.name}</span>
                    <span className="text-gray-500">: {param.type}</span>
                    {param.optional && <span className="text-gray-600 ml-1">(optional)</span>}
                    {param.default && (
                      <span className="text-gray-600 ml-1">= {param.default}</span>
                    )}
                    <span className="text-gray-500 ml-2">- {param.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Returns */}
          <div className="mb-2">
            <div className="text-xs text-gray-500 mb-1">Returns</div>
            <div className="text-xs">
              <span className="text-purple-400">{method.returns.type}</span>
              {method.returns.description && (
                <span className="text-gray-500 ml-2">- {method.returns.description}</span>
              )}
            </div>
          </div>

          {/* Example */}
          <div className="mb-2">
            <div className="text-xs text-gray-500 mb-1">Example</div>
            <code className="text-xs text-yellow-400 bg-gray-900 px-2 py-1 rounded block">
              {method.example}
            </code>
          </div>

          {/* Insert Button */}
          {onInsert && (
            <button
              onClick={() => onInsert(insertCode)}
              className="mt-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Insert
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Module Section Component
// ============================================================================

const ModuleSection = memo(function ModuleSection({
  module,
  onInsert,
}: {
  module: SDKModule;
  onInsert?: (code: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <ModuleBadge name={module.name} />
            <span className="text-sm font-medium text-gray-200">{module.name}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{module.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">{module.methods.length} methods</span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 bg-gray-800 border-t border-gray-700 space-y-2">
          {module.methods.map((method) => (
            <MethodCard
              key={method.name}
              module={module}
              method={method}
              onInsert={onInsert}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Template Card Component
// ============================================================================

const TemplateCard = memo(function TemplateCard({
  template,
  onInsert,
}: {
  template: PythonTemplate;
  onInsert?: (code: string) => void;
}) {
  const categoryColors: Record<string, string> = {
    monitoring: 'text-green-400',
    automation: 'text-blue-400',
    analysis: 'text-purple-400',
    integration: 'text-orange-400',
    reporting: 'text-cyan-400',
  };

  return (
    <div className="border border-gray-700 rounded-lg p-3 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-sm font-medium text-gray-200">{template.name}</h4>
          <span className={`text-xs ${categoryColors[template.category] || 'text-gray-400'}`}>
            {template.category}
          </span>
        </div>
        {onInsert && (
          <button
            onClick={() => onInsert(template.code)}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
          >
            Use
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-2">{template.description}</p>
      <div className="flex flex-wrap gap-1">
        {template.tags.map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-400 rounded"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const PythonReference = memo(function PythonReference({
  onInsert,
  compact = false,
}: PythonReferenceProps) {
  const [activeTab, setActiveTab] = useState<TabType>('modules');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');

  // Filter modules and methods based on search
  const filteredModules = useMemo(() => {
    if (!searchQuery) return ALL_SDK_MODULES;

    const lower = searchQuery.toLowerCase();
    return ALL_SDK_MODULES.filter(
      (module) =>
        module.name.toLowerCase().includes(lower) ||
        module.description.toLowerCase().includes(lower) ||
        module.methods.some(
          (m) =>
            m.name.toLowerCase().includes(lower) ||
            m.description.toLowerCase().includes(lower)
        )
    );
  }, [searchQuery]);

  // Get all methods for methods tab
  const allMethods = useMemo(() => {
    let methods: Array<{ module: SDKModule; method: SDKMethod }> = [];

    const modules = selectedModule === 'all'
      ? ALL_SDK_MODULES
      : ALL_SDK_MODULES.filter((m) => m.name === selectedModule);

    for (const module of modules) {
      for (const method of module.methods) {
        if (
          !searchQuery ||
          method.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          method.description.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          methods.push({ module, method });
        }
      }
    }

    return methods;
  }, [selectedModule, searchQuery]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return PYTHON_TEMPLATES;

    const lower = searchQuery.toLowerCase();
    return PYTHON_TEMPLATES.filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.tags.some((tag) => tag.includes(lower))
    );
  }, [searchQuery]);

  const tabs: Array<{ id: TabType; label: string; count: number }> = [
    { id: 'modules', label: 'Modules', count: ALL_SDK_MODULES.length },
    { id: 'methods', label: 'Methods', count: allMethods.length },
    { id: 'examples', label: 'Examples', count: PYTHON_TEMPLATES.length },
  ];

  return (
    <div className={`flex flex-col h-full bg-gray-850 ${compact ? '' : 'rounded-lg'} overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200 mb-2">Python SDK Reference</h3>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search SDK..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
            <span className="ml-1 text-xs text-gray-600">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Module Filter (for methods tab) */}
      {activeTab === 'methods' && (
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200"
          >
            <option value="all">All Modules</option>
            {ALL_SDK_MODULES.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} ({m.methods.length})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Modules Tab */}
        {activeTab === 'modules' && (
          <div className="space-y-3">
            {filteredModules.map((module) => (
              <ModuleSection
                key={module.name}
                module={module}
                onInsert={onInsert}
              />
            ))}
            {filteredModules.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No modules found matching &quot;{searchQuery}&quot;
              </p>
            )}
          </div>
        )}

        {/* Methods Tab */}
        {activeTab === 'methods' && (
          <div className="space-y-2">
            {allMethods.map(({ module, method }) => (
              <MethodCard
                key={`${module.name}.${method.name}`}
                module={module}
                method={method}
                onInsert={onInsert}
              />
            ))}
            {allMethods.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No methods found
              </p>
            )}
          </div>
        )}

        {/* Examples Tab */}
        {activeTab === 'examples' && (
          <div className="space-y-3">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onInsert={onInsert}
              />
            ))}
            {filteredTemplates.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No examples found
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-500">
        <a
          href="/docs/python-sdk"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-400 flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          Full Documentation
        </a>
      </div>
    </div>
  );
});

export default PythonReference;
