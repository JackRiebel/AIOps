'use client';

import { useState, useEffect } from 'react';
import { X, Link2, AlertTriangle, Check, Loader2, Search } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Incident {
  id: number;
  title: string;
  severity: string;
  status: string;
  created_at: string;
  source?: string;
}

interface LinkIncidentModalProps {
  isOpen: boolean;
  sessionId: number;
  sessionName: string;
  onClose: () => void;
  onLink: (sessionId: number, incidentId: number, resolved: boolean) => Promise<void>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSeverityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400';
    case 'high':
      return 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400';
    case 'medium':
      return 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
    case 'low':
      return 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400';
    default:
      return 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400';
  }
}

function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'open':
    case 'active':
      return 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'resolved':
    case 'closed':
      return 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'investigating':
      return 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400';
    default:
      return 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400';
  }
}

// ============================================================================
// Component
// ============================================================================

export function LinkIncidentModal({
  isOpen,
  sessionId,
  sessionName,
  onClose,
  onLink,
}: LinkIncidentModalProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<number | null>(null);
  const [markResolved, setMarkResolved] = useState(false);

  // Fetch incidents when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchIncidents = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/incidents?hours=168'); // Last 7 days
        if (!response.ok) {
          throw new Error('Failed to fetch incidents');
        }
        const data = await response.json();
        setIncidents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load incidents');
      } finally {
        setLoading(false);
      }
    };

    fetchIncidents();
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedIncident(null);
      setMarkResolved(false);
      setSearchTerm('');
    }
  }, [isOpen]);

  // Filter incidents by search term
  const filteredIncidents = incidents.filter((incident) =>
    incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    incident.id.toString().includes(searchTerm)
  );

  const handleLink = async () => {
    if (!selectedIncident) return;

    setLinking(true);
    try {
      await onLink(sessionId, selectedIncident, markResolved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link incident');
    } finally {
      setLinking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/10">
              <Link2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Link to Incident
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {sessionName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search incidents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-3" />
              <p className="text-sm text-slate-500">Loading incidents...</p>
            </div>
          )}

          {/* Incident List */}
          {!loading && (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredIncidents.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    {searchTerm ? 'No matching incidents found' : 'No incidents in the last 7 days'}
                  </p>
                </div>
              ) : (
                filteredIncidents.map((incident) => (
                  <button
                    key={incident.id}
                    onClick={() => setSelectedIncident(incident.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      selectedIncident === incident.id
                        ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-300 dark:border-cyan-500/30'
                        : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {incident.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getSeverityColor(incident.severity)}`}>
                            {incident.severity}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getStatusColor(incident.status)}`}>
                            {incident.status}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            #{incident.id}
                          </span>
                        </div>
                      </div>
                      {selectedIncident === incident.id && (
                        <Check className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Mark as Resolved Checkbox */}
          {selectedIncident && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markResolved}
                  onChange={(e) => setMarkResolved(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-cyan-500 focus:ring-cyan-500/50"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Mark incident as resolved by this session
                </span>
              </label>
              <p className="mt-1 ml-7 text-xs text-slate-500">
                This will track resolution time for MTTR calculation
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleLink}
            disabled={!selectedIncident || linking}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-400 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {linking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Linking...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Link Incident
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LinkIncidentModal;
