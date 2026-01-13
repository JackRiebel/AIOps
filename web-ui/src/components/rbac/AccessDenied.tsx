'use client';

import { ShieldX, ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AccessDeniedProps {
  /** Custom message to display */
  message?: string;
  /** Permission that was required */
  requiredPermission?: string;
  /** Show back button */
  showBackButton?: boolean;
  /** Show home button */
  showHomeButton?: boolean;
  /** Compact mode for inline use */
  compact?: boolean;
}

/**
 * AccessDenied - Component to display when user lacks required permissions.
 *
 * Usage:
 * ```tsx
 * // Full page
 * <AccessDenied requiredPermission="admin.system.manage" />
 *
 * // Compact inline
 * <AccessDenied compact message="You cannot edit this resource" />
 *
 * // As fallback in PermissionGate
 * <PermissionGate permission="users.delete" fallback={<AccessDenied compact />}>
 *   <DeleteButton />
 * </PermissionGate>
 * ```
 */
export function AccessDenied({
  message = 'You do not have permission to access this resource.',
  requiredPermission,
  showBackButton = true,
  showHomeButton = true,
  compact = false,
}: AccessDeniedProps) {
  const router = useRouter();

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
        <ShieldX className="w-4 h-4 flex-shrink-0" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        {/* Icon */}
        <div className="p-4 bg-red-500/10 rounded-full">
          <ShieldX className="w-12 h-12 text-red-400" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white">Access Denied</h1>

        {/* Message */}
        <p className="text-gray-400">{message}</p>

        {/* Required permission info */}
        {requiredPermission && (
          <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <p className="text-xs text-gray-500 mb-1">Required permission:</p>
            <code className="text-sm text-cyan-400">{requiredPermission}</code>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 mt-4">
          {showBackButton && (
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
          )}
          {showHomeButton && (
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
          )}
        </div>

        {/* Contact admin hint */}
        <p className="text-xs text-gray-500 mt-4">
          If you believe you should have access, please contact your administrator.
        </p>
      </div>
    </div>
  );
}

export default AccessDenied;
