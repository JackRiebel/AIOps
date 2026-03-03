'use client';

import { memo } from 'react';
import { Server, User, Shield, CheckCircle } from 'lucide-react';
import type { SplunkServerInfo, SplunkUserInfo } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkEnvironmentCardProps {
  serverInfo: SplunkServerInfo | null;
  userInfo: SplunkUserInfo | null;
  loading: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const SplunkEnvironmentCard = memo(({
  serverInfo,
  userInfo,
  loading,
}: SplunkEnvironmentCardProps) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 animate-pulse">
        <div className="space-y-3">
          <div className="h-4 w-32 bg-slate-100 dark:bg-slate-700 rounded" />
          <div className="h-3 w-48 bg-slate-100 dark:bg-slate-700 rounded" />
          <div className="h-3 w-40 bg-slate-100 dark:bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  if (!serverInfo && !userInfo) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">No environment data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 space-y-4">
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-purple-500" />
          Environment
        </h3>
        <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
          <CheckCircle className="w-3.5 h-3.5" />
          Connected
        </span>
      </div>

      {/* Server Info */}
      {serverInfo && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">
            <Server className="w-3 h-3" />
            Server
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {serverInfo.serverName && (
              <>
                <span className="text-slate-500 dark:text-slate-400">Name</span>
                <span className="text-slate-900 dark:text-white font-medium truncate">{serverInfo.serverName}</span>
              </>
            )}
            {serverInfo.version && (
              <>
                <span className="text-slate-500 dark:text-slate-400">Version</span>
                <span className="text-slate-900 dark:text-white font-mono text-xs">{serverInfo.version}{serverInfo.build ? ` (${serverInfo.build})` : ''}</span>
              </>
            )}
            {serverInfo.os && (
              <>
                <span className="text-slate-500 dark:text-slate-400">OS</span>
                <span className="text-slate-900 dark:text-white truncate">{serverInfo.os}</span>
              </>
            )}
            {serverInfo.licenseState && (
              <>
                <span className="text-slate-500 dark:text-slate-400">License</span>
                <span className="text-slate-900 dark:text-white">{serverInfo.licenseState}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Divider */}
      {serverInfo && userInfo && (
        <div className="border-t border-slate-100 dark:border-slate-700/50" />
      )}

      {/* User Info */}
      {userInfo && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">
            <User className="w-3 h-3" />
            Current User
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {(userInfo.realname || userInfo.name) && (
              <>
                <span className="text-slate-500 dark:text-slate-400">Name</span>
                <span className="text-slate-900 dark:text-white font-medium">{userInfo.realname || userInfo.name}</span>
              </>
            )}
            {userInfo.email && (
              <>
                <span className="text-slate-500 dark:text-slate-400">Email</span>
                <span className="text-slate-900 dark:text-white truncate">{userInfo.email}</span>
              </>
            )}
            {userInfo.roles && userInfo.roles.length > 0 && (
              <>
                <span className="text-slate-500 dark:text-slate-400">Roles</span>
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(userInfo.roles) ? userInfo.roles : String(userInfo.roles).split(',')).map(role => (
                    <span key={role} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                      <Shield className="w-2.5 h-2.5" />
                      {role}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

SplunkEnvironmentCard.displayName = 'SplunkEnvironmentCard';
export default SplunkEnvironmentCard;
