'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { Server, Wifi, Radio, Database, Search, Bot, FileBarChart, MessageSquare, User, Shield, ChevronRight } from 'lucide-react';
import type { SplunkServerInfo, SplunkUserInfo } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkPlatformSidebarProps {
  serverInfo: SplunkServerInfo | null;
  userInfo: SplunkUserInfo | null;
  merakiCount: number;
  catalystCount: number;
  teAgentCount: number;
  isConfigured: boolean;
  onNavigate: (view: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export const SplunkPlatformSidebar = memo(({
  serverInfo,
  userInfo,
  merakiCount,
  catalystCount,
  teAgentCount,
  isConfigured,
  onNavigate,
}: SplunkPlatformSidebarProps) => {
  const router = useRouter();

  const platforms = [
    { label: 'Meraki', count: merakiCount, icon: Wifi, iconColor: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Catalyst', count: catalystCount, icon: Server, iconColor: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'ThousandEyes', count: teAgentCount, icon: Radio, iconColor: 'text-cyan-600 dark:text-cyan-400', iconBg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { label: 'Splunk', count: isConfigured ? 1 : 0, icon: Database, iconColor: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-50 dark:bg-purple-500/10' },
  ];

  return (
    <div className="space-y-3">
      {/* Environment Card */}
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
          <h3 className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Environment</h3>
        </div>
        <div className="p-4">
          {serverInfo ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <Server className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{serverInfo.serverName || 'Splunk Server'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Connected</span>
                    {serverInfo.version && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">v{serverInfo.version}</span>
                    )}
                  </div>
                </div>
              </div>
              {userInfo?.name && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700/40">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">{userInfo.name}</span>
                  {userInfo.roles?.[0] && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 px-1.5 py-0.5 rounded-full">
                      <Shield className="w-2.5 h-2.5" />
                      {userInfo.roles[0]}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isConfigured ? 'Loading...' : 'Not configured'}
            </p>
          )}
        </div>
      </div>

      {/* Cross-Platform Health */}
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
          <h3 className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Platform Health</h3>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-2 gap-2">
            {platforms.map(p => {
              const Icon = p.icon;
              return (
                <div
                  key={p.label}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                    p.count > 0
                      ? 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/40 hover:border-slate-200 dark:hover:border-slate-600/50'
                      : 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-700/30 opacity-60'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg ${p.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3 h-3 ${p.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-slate-900 dark:text-white leading-none tabular-nums">{p.count > 0 ? p.count : '\u2014'}</p>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{p.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
          <h3 className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Quick Actions</h3>
        </div>
        <div className="p-2">
          {[
            { label: 'Search Logs', icon: Search, onClick: () => onNavigate('investigate') },
            { label: 'Ask AI', icon: Bot, onClick: () => {
              const message = 'Help me investigate Splunk logs — analyze recent events and identify anything unusual';
              const payload = { message, context: { type: 'splunk_analysis' as const, data: { category: 'general' as const, title: 'Splunk Log Investigation', details: {} as Record<string, string | number | undefined>, message } } };
              const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
              router.push(`/chat-v2?new_session=true&splunk_analysis=${encodeURIComponent(encoded)}`);
            } },
            { label: 'Explore Data', icon: FileBarChart, onClick: () => onNavigate('explore') },
            { label: 'Open Chat', icon: MessageSquare, onClick: () => router.push('/chat-v2') },
          ].map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/40 rounded-lg transition group"
              >
                <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-50 dark:group-hover:bg-cyan-500/10 transition-colors">
                  <Icon className="w-3 h-3 text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                </div>
                <span className="flex-1 text-left">{action.label}</span>
                <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

SplunkPlatformSidebar.displayName = 'SplunkPlatformSidebar';
export default SplunkPlatformSidebar;
