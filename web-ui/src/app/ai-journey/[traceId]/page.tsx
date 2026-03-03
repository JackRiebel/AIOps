'use client';

import { use } from 'react';
import { useAITrace } from '@/components/ai-trace/useAITrace';
import { TraceDetailView } from '@/components/ai-trace/TraceDetailView';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function TraceDetailPage({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = use(params);
  const { trace, waterfall, costSummary, loading, error } = useAITrace(traceId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !trace) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-500">{error || 'Trace not found'}</p>
        <Link
          href="/thousandeyes?tab=platform"
          className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to AI Journey
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <TraceDetailView trace={trace} waterfall={waterfall} costSummary={costSummary} />
    </div>
  );
}
