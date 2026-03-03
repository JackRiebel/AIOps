/**
 * SessionMetrics - Display session token and cost metrics
 */

export interface SessionMetricsData {
  totalTokensIn?: number;
  totalTokensOut?: number;
  totalTokens?: number;
  totalCost: number;
  messageCount: number;
  cardCount: number;
}

interface SessionMetricsProps {
  metrics?: SessionMetricsData;
}

export function SessionMetrics({ metrics }: SessionMetricsProps) {
  if (!metrics) return null;

  const tokensIn = metrics.totalTokensIn ?? Math.round((metrics.totalTokens ?? 0) * 0.7);
  const tokensOut = metrics.totalTokensOut ?? Math.round((metrics.totalTokens ?? 0) * 0.3);
  const cost = metrics.totalCost ?? 0;

  const hasData = tokensIn > 0 || tokensOut > 0 || cost > 0;
  if (!hasData) return null;

  const formatTokens = (count: number): string => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatCost = (usd: number): string => {
    if (usd === 0) return '$0';
    if (usd < 0.0001) return `$${usd.toFixed(6)}`;
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    if (usd < 1) return `$${usd.toFixed(3)}`;
    return `$${usd.toFixed(2)}`;
  };

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-700/50 text-[10px] font-medium text-slate-400"
      title={`Input: ${tokensIn.toLocaleString()} tokens | Output: ${tokensOut.toLocaleString()} tokens | Cost: ${formatCost(cost)}`}
    >
      <span className="flex items-center gap-0.5">
        <svg className="w-3 h-3 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        <span>{formatTokens(tokensIn)}</span>
      </span>
      <span className="text-slate-600">·</span>
      <span className="flex items-center gap-0.5">
        <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
        <span>{formatTokens(tokensOut)}</span>
      </span>
      <span className="text-slate-600">·</span>
      <span className="text-emerald-400 font-semibold">{formatCost(cost)}</span>
    </div>
  );
}
