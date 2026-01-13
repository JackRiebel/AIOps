'use client';

import { memo, useState, useMemo } from 'react';
import {
  Search, Copy, ChevronRight, ChevronDown, Book, Terminal,
  Check, ExternalLink, Code, HelpCircle
} from 'lucide-react';
import { CLI_COMMANDS, CLI_KEYWORDS, type CLIPlatform } from './cliGrammar';

interface CLIReferenceProps {
  onInsertCommand?: (command: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Platform icons/emojis
const PLATFORM_ICONS: Record<CLIPlatform, string> = {
  meraki: '🌐',
  splunk: '🔍',
  thousandeyes: '👁️',
  catalyst: '🏢',
  notify: '📣',
  ai: '🤖',
};

const PLATFORM_COLORS: Record<CLIPlatform, string> = {
  meraki: 'text-emerald-400 bg-emerald-500/20',
  splunk: 'text-orange-400 bg-orange-500/20',
  thousandeyes: 'text-cyan-400 bg-cyan-500/20',
  catalyst: 'text-blue-400 bg-blue-500/20',
  notify: 'text-purple-400 bg-purple-500/20',
  ai: 'text-pink-400 bg-pink-500/20',
};

export const CLIReference = memo(({
  onInsertCommand,
  isCollapsed = false,
  onToggleCollapse,
}: CLIReferenceProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set(['meraki']));
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'commands' | 'keywords' | 'examples'>('commands');

  // Type for command configuration
  type CommandConfig = { description: string; subcommands: Array<{ name: string; description: string; params: readonly string[] }> };

  // Filter commands based on search
  const filteredCommands = useMemo((): Record<string, CommandConfig> => {
    const result: Record<string, CommandConfig> = {};

    Object.entries(CLI_COMMANDS).forEach(([platform, config]) => {
      if (!searchQuery) {
        result[platform] = {
          description: config.description,
          subcommands: [...config.subcommands],
        };
        return;
      }

      const query = searchQuery.toLowerCase();
      const matchingSubcommands = config.subcommands.filter(
        sub =>
          sub.name.toLowerCase().includes(query) ||
          sub.description.toLowerCase().includes(query) ||
          platform.toLowerCase().includes(query)
      );

      if (matchingSubcommands.length > 0 || platform.toLowerCase().includes(query)) {
        result[platform] = {
          description: config.description,
          subcommands: matchingSubcommands.length > 0 ? [...matchingSubcommands] : [...config.subcommands],
        };
      }
    });

    return result;
  }, [searchQuery]);

  const togglePlatform = (platform: string) => {
    setExpandedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  };

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const insertCommand = (platform: string, subcommand: { name: string; params: readonly string[] }) => {
    const flagStr = subcommand.params.map(p => `${p} `).join('');
    const command = `${platform} ${subcommand.name} ${flagStr}`.trim();
    onInsertCommand?.(command);
  };

  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="fixed right-4 bottom-4 p-3 bg-slate-800 rounded-xl border border-slate-700 hover:bg-slate-700 transition-colors shadow-lg z-10"
        title="Show CLI Reference"
      >
        <Book className="w-5 h-5 text-cyan-400" />
      </button>
    );
  }

  return (
    <div className="w-80 bg-slate-800/95 border-l border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-white text-sm">CLI Reference</h3>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700
                     text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2
                     focus:ring-cyan-500/50"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-3">
          {(['commands', 'keywords', 'examples'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'commands' && (
          <div className="space-y-2">
            {Object.entries(filteredCommands).map(([platform, config]) => (
              <div key={platform} className="rounded-lg border border-slate-700 overflow-hidden">
                {/* Platform Header */}
                <button
                  onClick={() => togglePlatform(platform)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 transition-colors"
                >
                  {expandedPlatforms.has(platform) ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-lg">{PLATFORM_ICONS[platform as CLIPlatform]}</span>
                  <span className="font-medium text-white text-sm">{platform}</span>
                  <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] ${PLATFORM_COLORS[platform as CLIPlatform]}`}>
                    {config.subcommands.length} commands
                  </span>
                </button>

                {/* Subcommands */}
                {expandedPlatforms.has(platform) && (
                  <div className="bg-slate-800/50">
                    {config.subcommands.map((sub) => (
                      <div
                        key={sub.name}
                        className="px-3 py-2 border-t border-slate-700/50 hover:bg-slate-700/30 group"
                      >
                        <div className="flex items-center justify-between">
                          <code className="text-sm text-cyan-400 font-mono">{sub.name}</code>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => copyCommand(`${platform} ${sub.name}`)}
                              className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-white"
                              title="Copy command"
                            >
                              {copiedCommand === `${platform} ${sub.name}` ? (
                                <Check className="w-3.5 h-3.5 text-green-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {onInsertCommand && (
                              <button
                                onClick={() => insertCommand(platform, sub)}
                                className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-white"
                                title="Insert into editor"
                              >
                                <Code className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{sub.description}</p>
                        {sub.params.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            {sub.params.map((param) => (
                              <span
                                key={param}
                                className="px-1.5 py-0.5 rounded bg-slate-700/50 text-[10px] text-slate-300 font-mono"
                              >
                                {param}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'keywords' && (
          <div className="space-y-2">
            {/* Control Flow */}
            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <div className="px-3 py-2 bg-slate-700/50">
                <span className="font-medium text-white text-sm">Control Flow</span>
              </div>
              <div className="bg-slate-800/50 p-3 space-y-3">
                <KeywordItem
                  keyword="if...then...end"
                  description="Conditional execution"
                  example="if health_score < 80 then\n  notify slack\nend"
                  onCopy={copyCommand}
                  copiedCommand={copiedCommand}
                />
                <KeywordItem
                  keyword="else"
                  description="Alternative branch"
                  example="if condition then\n  ...\nelse\n  ...\nend"
                  onCopy={copyCommand}
                  copiedCommand={copiedCommand}
                />
                <KeywordItem
                  keyword="elif"
                  description="Else if branch"
                  example="if a then\n  ...\nelif b then\n  ...\nend"
                  onCopy={copyCommand}
                  copiedCommand={copiedCommand}
                />
                <KeywordItem
                  keyword="loop...as...end"
                  description="Iterate over collection"
                  example="loop devices as device\n  meraki get-device --serial ${device.serial}\nend"
                  onCopy={copyCommand}
                  copiedCommand={copiedCommand}
                />
              </div>
            </div>

            {/* Variables */}
            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <div className="px-3 py-2 bg-slate-700/50">
                <span className="font-medium text-white text-sm">Variables</span>
              </div>
              <div className="bg-slate-800/50 p-3 space-y-3">
                <KeywordItem
                  keyword="set"
                  description="Assign a variable"
                  example='set device_name = "Router-1"'
                  onCopy={copyCommand}
                  copiedCommand={copiedCommand}
                />
                <KeywordItem
                  keyword="${...}"
                  description="Variable interpolation"
                  example="meraki get-device --serial ${device.serial}"
                  onCopy={copyCommand}
                  copiedCommand={copiedCommand}
                />
              </div>
            </div>

            {/* Utilities */}
            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <div className="px-3 py-2 bg-slate-700/50">
                <span className="font-medium text-white text-sm">Utilities</span>
              </div>
              <div className="bg-slate-800/50 p-3 space-y-3">
                <KeywordItem
                  keyword="wait"
                  description="Pause execution"
                  example="wait 30s\nwait 5m\nwait 1h"
                  onCopy={copyCommand}
                  copiedCommand={copiedCommand}
                />
                <KeywordItem
                  keyword="return"
                  description="Return value from workflow"
                  example="return ${result}"
                  onCopy={copyCommand}
                  copiedCommand={copiedCommand}
                />
              </div>
            </div>

            {/* Operators */}
            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <div className="px-3 py-2 bg-slate-700/50">
                <span className="font-medium text-white text-sm">Operators</span>
              </div>
              <div className="bg-slate-800/50 p-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-slate-400"><code className="text-cyan-400">==</code> Equal</span>
                  <span className="text-slate-400"><code className="text-cyan-400">!=</code> Not equal</span>
                  <span className="text-slate-400"><code className="text-cyan-400">&gt;</code> Greater than</span>
                  <span className="text-slate-400"><code className="text-cyan-400">&lt;</code> Less than</span>
                  <span className="text-slate-400"><code className="text-cyan-400">&gt;=</code> Greater or equal</span>
                  <span className="text-slate-400"><code className="text-cyan-400">&lt;=</code> Less or equal</span>
                  <span className="text-slate-400"><code className="text-cyan-400">and</code> Logical AND</span>
                  <span className="text-slate-400"><code className="text-cyan-400">or</code> Logical OR</span>
                  <span className="text-slate-400"><code className="text-cyan-400">not</code> Logical NOT</span>
                  <span className="text-slate-400"><code className="text-cyan-400">contains</code> String contains</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="space-y-3">
            <ExampleCard
              title="Health Check & Alert"
              description="Check network health and send Slack alert if degraded"
              code={`meraki get-health --network \${network.id}

if health_score < 80 then
  notify slack --channel "#alerts" \\
    --message "Health degraded: \${health_score}%"
end`}
              onCopy={copyCommand}
              onInsert={onInsertCommand}
              copiedCommand={copiedCommand}
            />

            <ExampleCard
              title="Device Loop"
              description="Iterate over devices and check status"
              code={`meraki get-devices --network \${network.id}

loop devices as device
  if device.status != "online" then
    notify slack --channel "#ops" \\
      --message "Device offline: \${device.name}"
  end
end`}
              onCopy={copyCommand}
              onInsert={onInsertCommand}
              copiedCommand={copiedCommand}
            />

            <ExampleCard
              title="AI Analysis"
              description="Use AI to analyze security events"
              code={`splunk search --query "index=security"

ai analyze --prompt "Analyze security events" \\
  --context \${results}

if ai_result.severity == "critical" then
  notify pagerduty --service "security" \\
    --severity "critical" \\
    --message \${ai_result.summary}
end`}
              onCopy={copyCommand}
              onInsert={onInsertCommand}
              copiedCommand={copiedCommand}
            />

            <ExampleCard
              title="Scheduled Wait"
              description="Wait between operations"
              code={`meraki reboot-device --serial \${serial}

# Wait for device to reboot
wait 2m

meraki get-device --serial \${serial}

if device.status == "online" then
  notify slack --message "Reboot complete"
end`}
              onCopy={copyCommand}
              onInsert={onInsertCommand}
              copiedCommand={copiedCommand}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700">
        <a
          href="/docs#cli-reference"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Full Documentation
        </a>
      </div>
    </div>
  );
});

CLIReference.displayName = 'CLIReference';

// Keyword item component
const KeywordItem = memo(({
  keyword,
  description,
  example,
  onCopy,
  copiedCommand,
}: {
  keyword: string;
  description: string;
  example: string;
  onCopy: (cmd: string) => void;
  copiedCommand: string | null;
}) => (
  <div className="group">
    <div className="flex items-center justify-between">
      <code className="text-sm text-purple-400 font-mono">{keyword}</code>
      <button
        onClick={() => onCopy(example)}
        className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy example"
      >
        {copiedCommand === example ? (
          <Check className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
    <p className="text-xs text-slate-400 mt-0.5">{description}</p>
    <pre className="mt-1.5 p-2 rounded bg-slate-900/50 text-[10px] text-slate-300 font-mono overflow-x-auto">
      {example}
    </pre>
  </div>
));

KeywordItem.displayName = 'KeywordItem';

// Example card component
const ExampleCard = memo(({
  title,
  description,
  code,
  onCopy,
  onInsert,
  copiedCommand,
}: {
  title: string;
  description: string;
  code: string;
  onCopy: (cmd: string) => void;
  onInsert?: (cmd: string) => void;
  copiedCommand: string | null;
}) => (
  <div className="rounded-lg border border-slate-700 overflow-hidden">
    <div className="px-3 py-2 bg-slate-700/50 flex items-center justify-between">
      <div>
        <h4 className="font-medium text-white text-sm">{title}</h4>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onCopy(code)}
          className="p-1.5 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
          title="Copy"
        >
          {copiedCommand === code ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
        {onInsert && (
          <button
            onClick={() => onInsert(code)}
            className="p-1.5 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
            title="Insert into editor"
          >
            <Code className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
    <pre className="p-3 bg-slate-800/50 text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre">
      {code}
    </pre>
  </div>
));

ExampleCard.displayName = 'ExampleCard';

export default CLIReference;
