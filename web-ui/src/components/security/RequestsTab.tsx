'use client';

import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { RoleChangeRequest } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionContext';

interface RequestsTabProps {
  className?: string;
}

export function RequestsTab({ className = '' }: RequestsTabProps) {
  useAuth(); // Hook required for auth context
  const { hasPermission } = usePermissions();
  const [requests, setRequests] = useState<RoleChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedRequest, setSelectedRequest] = useState<RoleChangeRequest | null>(null);

  const canManageRequests = hasPermission('rbac.requests.manage');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rbac/role-requests', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }

      const data = await response.json();
      setRequests(data.requests || data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: number, comment?: string) => {
    try {
      const response = await fetch(`/api/rbac/role-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ review_comment: comment }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve request');
      }

      fetchRequests();
      setSelectedRequest(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve request');
    }
  };

  const handleReject = async (requestId: number, comment?: string) => {
    try {
      const response = await fetch(`/api/rbac/role-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ review_comment: comment }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject request');
      }

      fetchRequests();
      setSelectedRequest(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject request');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
            <CheckCircle className="h-3 w-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
            {status}
          </span>
        );
    }
  };

  const filteredRequests = requests.filter(request => {
    if (statusFilter !== 'all' && request.status !== statusFilter) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        request.requester_name?.toLowerCase().includes(query) ||
        request.target_user_name?.toLowerCase().includes(query) ||
        request.requested_role_name?.toLowerCase().includes(query) ||
        request.reason?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-400">Loading requests...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-500/10 border border-red-500/30 rounded-lg p-4 ${className}`}>
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchRequests}
          className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Role Change Requests</h2>
          <p className="text-sm text-gray-400 mt-1">
            Review and manage role change requests
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Pending Requests Alert */}
      {pendingCount > 0 && canManageRequests && (
        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-300">
            <p className="font-medium">
              You have {pendingCount} pending request{pendingCount !== 1 ? 's' : ''} awaiting review
            </p>
            <p className="mt-1 text-yellow-300/80">
              Click on a request to review and approve or reject it.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by user, role, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-yellow-500 text-yellow-900 rounded-full text-xs font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex gap-6">
        {/* Requests List */}
        <div className="flex-1">
          {filteredRequests.length === 0 ? (
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-12 text-center">
              <UserPlus className="h-12 w-12 mx-auto mb-4 text-gray-500" />
              <h3 className="text-lg font-medium text-white mb-2">No Requests Found</h3>
              <p className="text-gray-400">
                {statusFilter !== 'all'
                  ? `No ${statusFilter} role change requests.`
                  : 'There are no role change requests at this time.'}
              </p>
            </div>
          ) : (
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 divide-y divide-gray-700">
              {filteredRequests.map(request => (
                <RequestRow
                  key={request.id}
                  request={request}
                  isSelected={selectedRequest?.id === request.id}
                  onSelect={() => setSelectedRequest(request)}
                  getStatusBadge={getStatusBadge}
                  formatRelativeTime={formatRelativeTime}
                />
              ))}
            </div>
          )}
        </div>

        {/* Request Detail Panel */}
        {selectedRequest && (
          <div className="w-96 shrink-0">
            <RequestDetailPanel
              request={selectedRequest}
              onClose={() => setSelectedRequest(null)}
              onApprove={handleApprove}
              onReject={handleReject}
              canManage={canManageRequests}
              formatDateTime={formatDateTime}
              getStatusBadge={getStatusBadge}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Request Row Component
interface RequestRowProps {
  request: RoleChangeRequest;
  isSelected: boolean;
  onSelect: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
  formatRelativeTime: (dateString: string) => string;
}

function RequestRow({
  request,
  isSelected,
  onSelect,
  getStatusBadge,
  formatRelativeTime,
}: RequestRowProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-4 p-4 text-left transition-colors ${
        isSelected
          ? 'bg-blue-500/20 border-l-2 border-blue-500'
          : 'hover:bg-gray-700/30 border-l-2 border-transparent'
      }`}
    >
      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
        <User className="h-5 w-5 text-gray-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white truncate">
            {request.target_user_name || `User ${request.target_user_id}`}
          </span>
          {request.status === 'pending' && (
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mt-0.5">
          <span className="truncate">{request.current_role_name || 'No Role'}</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="text-blue-400 truncate">{request.requested_role_name}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        {getStatusBadge(request.status)}
        <span className="text-xs text-gray-500">{formatRelativeTime(request.created_at)}</span>
      </div>
    </button>
  );
}

// Request Detail Panel Component
interface RequestDetailPanelProps {
  request: RoleChangeRequest;
  onClose: () => void;
  onApprove: (requestId: number, comment?: string) => void;
  onReject: (requestId: number, comment?: string) => void;
  canManage: boolean;
  formatDateTime: (dateString: string) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}

function RequestDetailPanel({
  request,
  onClose,
  onApprove,
  onReject,
  canManage,
  formatDateTime,
  getStatusBadge,
}: RequestDetailPanelProps) {
  const [reviewComment, setReviewComment] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleApprove = async () => {
    setProcessing(true);
    await onApprove(request.id, reviewComment);
    setProcessing(false);
  };

  const handleReject = async () => {
    setProcessing(true);
    await onReject(request.id, reviewComment);
    setProcessing(false);
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 sticky top-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="font-medium text-white">Request Details</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* User Info */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
            <User className="h-6 w-6 text-gray-400" />
          </div>
          <div>
            <p className="font-medium text-white">
              {request.target_user_name || `User ${request.target_user_id}`}
            </p>
            {request.requester_name && (
              <p className="text-sm text-gray-400">Requested by: {request.requester_name}</p>
            )}
          </div>
        </div>

        {/* Role Change */}
        <div className="bg-gray-700/50 rounded-lg p-3">
          <label className="text-xs text-gray-500 uppercase tracking-wide">Role Change</label>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1">
              <p className="text-sm text-gray-400">{request.current_role_name || 'No Role'}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-400">{request.requested_role_name}</p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Status</label>
          <div className="mt-1">{getStatusBadge(request.status)}</div>
        </div>

        {/* Request Reason */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Reason</label>
          <p className="text-sm text-gray-300 mt-1">
            {request.reason || <span className="italic text-gray-500">No reason provided</span>}
          </p>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Requested</label>
            <p className="text-sm text-gray-300 mt-1">{formatDateTime(request.created_at)}</p>
          </div>
          {request.reviewed_at && (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Reviewed</label>
              <p className="text-sm text-gray-300 mt-1">{formatDateTime(request.reviewed_at)}</p>
            </div>
          )}
        </div>

        {/* Reviewer Info */}
        {request.reviewer_name && (
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Reviewed By</label>
            <p className="text-sm text-gray-300 mt-1">{request.reviewer_name}</p>
          </div>
        )}

        {/* Review Notes */}
        {request.review_notes && (
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Review Notes</label>
            <p className="text-sm text-gray-300 mt-1 italic">&ldquo;{request.review_notes}&rdquo;</p>
          </div>
        )}

        {/* Action Section (for pending requests) */}
        {request.status === 'pending' && canManage && (
          <div className="pt-4 border-t border-gray-700 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Review Comment (optional)
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Add a comment for the requester..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={processing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <ThumbsUp className="h-4 w-4" />
                Approve
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <ThumbsDown className="h-4 w-4" />
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RequestsTab;
