'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  LayoutDashboard,
  Wrench,
  Activity,
  Shield,
  ShieldAlert,
  Wifi,
  WifiOff,
  Radio,
  BarChart3,
  FileSearch,
  Network,
  Bell,
  AlertTriangle,
  Server,
  Search,
  X,
  Layers,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Globe,
  Building2,
} from 'lucide-react';
import { CARD_POLLING_CONFIG } from '@/config/card-polling';
import {
  CANVAS_TEMPLATES,
  CATEGORY_INFO,
  getTemplateCategories,
  getTemplatesByCategory,
  searchTemplates,
  templateToCanvasCards,
  type CanvasTemplate,
  type TemplateCategory,
  type TemplateContext,
} from '@/config/canvas-templates';
import { apiClient } from '@/lib/api-client';
import type { CanvasCard } from '@/types/session';
import type { Organization } from '@/types';
import type { MerakiNetwork } from '@/types/api';

// =============================================================================
// Types
// =============================================================================

interface TemplateSelectorProps {
  /** Whether the selector modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Callback when a template is applied */
  onApplyTemplate: (cards: CanvasCard[]) => void;
  /** Whether to replace or add to existing cards */
  mode?: 'replace' | 'add';
  /** Pre-selected organization (optional) */
  defaultOrganization?: string;
}

type Step = 'template' | 'network';

// =============================================================================
// Icon Mapping
// =============================================================================

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Wrench,
  Activity,
  Shield,
  ShieldAlert,
  Wifi,
  WifiOff,
  Radio,
  BarChart3,
  FileSearch,
  Network,
  Bell,
  AlertTriangle,
  Server,
};

function getIcon(iconName: string) {
  return iconMap[iconName] || LayoutDashboard;
}

// =============================================================================
// Template Card Component
// =============================================================================

interface TemplateCardProps {
  template: CanvasTemplate;
  isSelected: boolean;
  onSelect: () => void;
}

function TemplateCard({ template, isSelected, onSelect }: TemplateCardProps) {
  const Icon = getIcon(template.icon);
  const categoryInfo = CATEGORY_INFO[template.category];
  const CategoryIcon = getIcon(categoryInfo.icon);

  return (
    <button
      onClick={onSelect}
      className={`
        relative w-full text-left p-4 rounded-xl border-2 transition-all
        ${isSelected
          ? 'border-cyan-500 bg-cyan-500/10'
          : 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
        }
      `}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg ${isSelected ? 'bg-cyan-500/20' : 'bg-slate-700/50'} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium truncate ${isSelected ? 'text-cyan-100' : 'text-white'}`}>
            {template.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <CategoryIcon className={`w-3 h-3 ${categoryInfo.color}`} />
            <span className="text-xs text-slate-400">{categoryInfo.label}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-400 line-clamp-2 mb-3">
        {template.description}
      </p>

      {/* Card count */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Layers className="w-3.5 h-3.5" />
        <span>{template.cards.length} cards</span>
        {template.cards.some(c => c.isLive) && (
          <>
            <span className="mx-1">·</span>
            <span className="text-green-400">Live data</span>
          </>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mt-3">
        {template.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 text-xs bg-slate-700/50 text-slate-400 rounded"
          >
            {tag}
          </span>
        ))}
        {template.tags.length > 3 && (
          <span className="px-1.5 py-0.5 text-xs bg-slate-700/50 text-slate-500 rounded">
            +{template.tags.length - 3}
          </span>
        )}
      </div>
    </button>
  );
}

// =============================================================================
// Category Tab Component
// =============================================================================

interface CategoryTabProps {
  category: TemplateCategory | 'all';
  isActive: boolean;
  count: number;
  onClick: () => void;
}

function CategoryTab({ category, isActive, count, onClick }: CategoryTabProps) {
  const info = category === 'all'
    ? { label: 'All Templates', icon: 'LayoutDashboard', color: 'text-slate-400' }
    : CATEGORY_INFO[category];
  const Icon = getIcon(info.icon);

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
        ${isActive
          ? 'bg-slate-700 text-white'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }
      `}
    >
      <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : info.color}`} />
      <span>{info.label}</span>
      <span className={`px-1.5 py-0.5 rounded text-xs ${isActive ? 'bg-slate-600' : 'bg-slate-700/50'}`}>
        {count}
      </span>
    </button>
  );
}

// =============================================================================
// Network Selection Component
// =============================================================================

interface NetworkSelectionProps {
  organizations: Organization[];
  selectedOrg: string | null;
  onOrgChange: (org: string) => void;
  networks: MerakiNetwork[];
  selectedNetwork: MerakiNetwork | null;
  onNetworkSelect: (network: MerakiNetwork) => void;
  isLoadingNetworks: boolean;
  networkError: string | null;
}

function NetworkSelection({
  organizations,
  selectedOrg,
  onOrgChange,
  networks,
  selectedNetwork,
  onNetworkSelect,
  isLoadingNetworks,
  networkError,
}: NetworkSelectionProps) {
  return (
    <div className="space-y-6">
      {/* Organization Selector */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <Building2 className="w-4 h-4 inline-block mr-2" />
          Organization
        </label>
        <select
          value={selectedOrg || ''}
          onChange={(e) => onOrgChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
        >
          <option value="">Select an organization...</option>
          {organizations.map((org) => (
            <option key={org.name} value={org.name}>
              {org.display_name || org.name}
            </option>
          ))}
        </select>
      </div>

      {/* Network Grid */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <Globe className="w-4 h-4 inline-block mr-2" />
          Network
        </label>

        {!selectedOrg ? (
          <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Select an organization first</p>
          </div>
        ) : isLoadingNetworks ? (
          <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <Loader2 className="w-8 h-8 text-cyan-500 mx-auto mb-3 animate-spin" />
            <p className="text-slate-400">Loading networks...</p>
          </div>
        ) : networkError ? (
          <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <p className="text-amber-400">{networkError}</p>
          </div>
        ) : networks.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <Network className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No networks found in this organization</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
            {networks.map((network) => (
              <button
                key={network.id}
                onClick={() => onNetworkSelect(network)}
                className={`
                  relative w-full text-left p-4 rounded-xl border-2 transition-all
                  ${selectedNetwork?.id === network.id
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                  }
                `}
              >
                {/* Selected indicator */}
                {selectedNetwork?.id === network.id && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg ${selectedNetwork?.id === network.id ? 'bg-cyan-500/20' : 'bg-slate-700/50'} flex items-center justify-center flex-shrink-0`}>
                    <Network className={`w-4 h-4 ${selectedNetwork?.id === network.id ? 'text-cyan-400' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-medium truncate ${selectedNetwork?.id === network.id ? 'text-cyan-100' : 'text-white'}`}>
                      {network.name}
                    </h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {network.productTypes?.slice(0, 3).map((type) => (
                        <span
                          key={type}
                          className="px-1.5 py-0.5 text-xs bg-slate-700/50 text-slate-400 rounded capitalize"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TemplateSelector({
  isOpen,
  onClose,
  onApplyTemplate,
  mode = 'replace',
  defaultOrganization,
}: TemplateSelectorProps) {
  // Step state
  const [currentStep, setCurrentStep] = useState<Step>('template');

  // Template selection state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<CanvasTemplate | null>(null);

  // Network selection state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(defaultOrganization || null);
  const [networks, setNetworks] = useState<MerakiNetwork[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<MerakiNetwork | null>(null);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [isLoadingNetworks, setIsLoadingNetworks] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Fetch organizations when modal opens
  useEffect(() => {
    if (isOpen && organizations.length === 0) {
      setIsLoadingOrgs(true);
      apiClient.getOrganizations()
        .then((orgs) => {
          const activeOrgs = orgs.filter(org => org.is_active);
          setOrganizations(activeOrgs);
          // Auto-select if only one org or if default provided
          if (activeOrgs.length === 1) {
            setSelectedOrg(activeOrgs[0].name);
          } else if (defaultOrganization) {
            setSelectedOrg(defaultOrganization);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch organizations:', err);
        })
        .finally(() => {
          setIsLoadingOrgs(false);
        });
    }
  }, [isOpen, organizations.length, defaultOrganization]);

  // Fetch networks when organization changes
  useEffect(() => {
    if (!selectedOrg) {
      setNetworks([]);
      setSelectedNetwork(null);
      return;
    }

    setIsLoadingNetworks(true);
    setNetworkError(null);
    setSelectedNetwork(null);

    apiClient.getMerakiNetworks(selectedOrg)
      .then((data) => {
        setNetworks(data);
      })
      .catch((err) => {
        console.error('Failed to fetch networks:', err);
        setNetworkError('Failed to load networks');
        setNetworks([]);
      })
      .finally(() => {
        setIsLoadingNetworks(false);
      });
  }, [selectedOrg]);

  // Get categories with counts
  const categories = useMemo(() => {
    const cats = getTemplateCategories();
    return cats.map((cat) => ({
      category: cat,
      count: getTemplatesByCategory(cat).length,
    }));
  }, []);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let templates = searchQuery
      ? searchTemplates(searchQuery)
      : CANVAS_TEMPLATES;

    if (activeCategory !== 'all') {
      templates = templates.filter((t) => t.category === activeCategory);
    }

    return templates;
  }, [searchQuery, activeCategory]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (currentStep === 'template' && selectedTemplate) {
      setCurrentStep('network');
    }
  }, [currentStep, selectedTemplate]);

  // Handle back step
  const handleBack = useCallback(() => {
    if (currentStep === 'network') {
      setCurrentStep('template');
    }
  }, [currentStep]);

  // Handle apply
  const handleApply = useCallback(() => {
    if (!selectedTemplate) return;

    // Build context from selections
    // Use the Meraki organizationId from the selected network for API calls
    const context: TemplateContext = {
      orgId: selectedNetwork?.organizationId || selectedOrg || undefined,
      networkId: selectedNetwork?.id,
      networkName: selectedNetwork?.name,
    };

    const cards = templateToCanvasCards(selectedTemplate, context);
    onApplyTemplate(cards);
    handleClose();
  }, [selectedTemplate, selectedOrg, selectedNetwork, onApplyTemplate]);

  // Handle close
  const handleClose = useCallback(() => {
    onClose();
    setCurrentStep('template');
    setSelectedTemplate(null);
    setSearchQuery('');
    setActiveCategory('all');
    setSelectedNetwork(null);
    // Don't reset org - keep it for next time
  }, [onClose]);

  // Skip network selection (apply without network)
  const handleSkipNetwork = useCallback(() => {
    if (!selectedTemplate) return;

    // When skipping, we don't have a network so we can't get orgId from network
    // Just pass the credential name - cards will show context required message
    const context: TemplateContext = {
      orgId: selectedOrg || undefined,
    };

    const cards = templateToCanvasCards(selectedTemplate, context);
    onApplyTemplate(cards);
    handleClose();
  }, [selectedTemplate, selectedOrg, onApplyTemplate, handleClose]);

  // Check if selected template has cards that require networkId
  // This must be before the early return to maintain consistent hook order
  const templateRequiresNetwork = useMemo(() => {
    if (!selectedTemplate) return false;
    return selectedTemplate.cards.some(card => {
      const config = CARD_POLLING_CONFIG[card.type];
      return config?.requires === 'networkId' || config?.requires === 'both';
    });
  }, [selectedTemplate]);

  if (!isOpen) return null;

  const canProceedToNetwork = !!selectedTemplate;
  const canApply = !!selectedNetwork || currentStep === 'template';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-white">
                {currentStep === 'template' ? 'Canvas Templates' : 'Select Network'}
              </h2>
              {/* Step indicator */}
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${currentStep === 'template' ? 'bg-cyan-500' : 'bg-slate-600'}`} />
                <span className={`w-2 h-2 rounded-full ${currentStep === 'network' ? 'bg-cyan-500' : 'bg-slate-600'}`} />
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              {currentStep === 'template'
                ? 'Choose a pre-built dashboard layout for common use cases'
                : 'Select a network to populate the dashboard with live data'
              }
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {currentStep === 'template' ? (
          <>
            {/* Search and Categories */}
            <div className="px-6 py-4 border-b border-slate-700/50 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                />
              </div>

              {/* Category tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
                <CategoryTab
                  category="all"
                  isActive={activeCategory === 'all'}
                  count={CANVAS_TEMPLATES.length}
                  onClick={() => setActiveCategory('all')}
                />
                {categories.map(({ category, count }) => (
                  <CategoryTab
                    key={category}
                    category={category}
                    isActive={activeCategory === category}
                    count={count}
                    onClick={() => setActiveCategory(category)}
                  />
                ))}
              </div>
            </div>

            {/* Template Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No templates found matching your search</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      isSelected={selectedTemplate?.id === template.id}
                      onSelect={() => setSelectedTemplate(template)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Network Selection Step */
          <div className="flex-1 overflow-y-auto p-6">
            {/* Selected Template Summary */}
            {selectedTemplate && (
              <div className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    {(() => {
                      const Icon = getIcon(selectedTemplate.icon);
                      return <Icon className="w-5 h-5 text-cyan-400" />;
                    })()}
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{selectedTemplate.name}</h3>
                    <p className="text-sm text-slate-400">{selectedTemplate.cards.length} cards</p>
                  </div>
                </div>
              </div>
            )}

            {/* Network Selection */}
            <NetworkSelection
              organizations={organizations}
              selectedOrg={selectedOrg}
              onOrgChange={setSelectedOrg}
              networks={networks}
              selectedNetwork={selectedNetwork}
              onNetworkSelect={setSelectedNetwork}
              isLoadingNetworks={isLoadingNetworks}
              networkError={networkError}
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50 bg-slate-800/50">
          <div className="text-sm text-slate-400">
            {currentStep === 'template' ? (
              selectedTemplate ? (
                <span>
                  Selected: <span className="text-white font-medium">{selectedTemplate.name}</span>
                  {' · '}
                  <span>{selectedTemplate.cards.length} cards</span>
                </span>
              ) : (
                <span>Select a template to continue</span>
              )
            ) : (
              selectedNetwork ? (
                <span>
                  Network: <span className="text-white font-medium">{selectedNetwork.name}</span>
                </span>
              ) : (
                <span>Select a network or skip to apply without data</span>
              )
            )}
          </div>
          <div className="flex items-center gap-3">
            {currentStep === 'template' ? (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNext}
                  disabled={!canProceedToNetwork}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>Next: Select Network</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleBack}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  onClick={handleSkipNetwork}
                  disabled={templateRequiresNetwork}
                  title={templateRequiresNetwork ? 'This template requires a network selection' : undefined}
                  className={`px-4 py-2 transition-colors ${
                    templateRequiresNetwork
                      ? 'text-slate-500 cursor-not-allowed'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Skip
                </button>
                <button
                  onClick={handleApply}
                  disabled={!selectedNetwork}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Layers className="w-4 h-4" />
                  {mode === 'replace' ? 'Apply Template' : 'Add Cards'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateSelector;
