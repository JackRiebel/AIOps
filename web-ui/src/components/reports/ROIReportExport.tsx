'use client';

import { memo, useState, useCallback } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import type { AISessionData, CostSummary, DailyCost } from '@/components/costs/types';

// ============================================================================
// Types
// ============================================================================

export interface ROIReportData {
  summary: CostSummary | null;
  sessions: AISessionData[];
  dailyCosts: DailyCost[];
  roiMetrics: {
    totalTimeSaved: number;
    averageROI: number;
    totalManualCostSaved: number;
  };
}

export interface ROIReportExportProps {
  data: ROIReportData;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// PDF Generation
// ============================================================================

async function generateROIReport(data: ROIReportData): Promise<void> {
  // Dynamic import to avoid SSR issues
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = margin;

  // Helper for centering text
  const centerText = (text: string, y: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, y);
  };

  // Helper for formatting currency
  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

  // Helper for formatting time
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // ========== Header ==========
  doc.setFillColor(8, 145, 178); // cyan-600
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  centerText('AI ROI & Cost Analytics Report', 25, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  centerText(`Generated on ${dateStr}`, 35, 10);

  yPos = 55;
  doc.setTextColor(0, 0, 0);

  // ========== Executive Summary ==========
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Executive Summary', margin, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const summaryData = [
    ['Report Period', `${data.summary?.period_days ?? 30} days`],
    ['Total AI Queries', `${data.summary?.queries?.toLocaleString() ?? 0}`],
    ['Total AI Cost', formatCurrency(data.summary?.total_cost_usd ?? 0)],
    ['Total Time Saved', formatTime(data.roiMetrics.totalTimeSaved)],
    ['Estimated Manual Cost Saved', formatCurrency(data.roiMetrics.totalManualCostSaved)],
    ['Average ROI', `${data.roiMetrics.averageROI.toFixed(0)}%`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: summaryData,
    theme: 'plain',
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 80 },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // ========== ROI Highlights ==========
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ROI Highlights', margin, yPos);
  yPos += 10;

  // Create highlight boxes
  const boxWidth = (pageWidth - margin * 2 - 10) / 2;
  const boxHeight = 35;

  // Net Savings Box
  doc.setFillColor(240, 253, 244); // green-50
  doc.setDrawColor(34, 197, 94); // green-500
  doc.roundedRect(margin, yPos, boxWidth, boxHeight, 3, 3, 'FD');

  doc.setTextColor(22, 101, 52); // green-800
  doc.setFontSize(9);
  doc.text('Net Savings', margin + 5, yPos + 10);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const netSavings = data.roiMetrics.totalManualCostSaved - (data.summary?.total_cost_usd ?? 0);
  doc.text(formatCurrency(netSavings), margin + 5, yPos + 25);

  // Time Saved Box
  doc.setFillColor(239, 246, 255); // blue-50
  doc.setDrawColor(59, 130, 246); // blue-500
  doc.roundedRect(margin + boxWidth + 10, yPos, boxWidth, boxHeight, 3, 3, 'FD');

  doc.setTextColor(30, 64, 175); // blue-800
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Time Saved', margin + boxWidth + 15, yPos + 10);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(formatTime(data.roiMetrics.totalTimeSaved), margin + boxWidth + 15, yPos + 25);

  yPos += boxHeight + 15;
  doc.setTextColor(0, 0, 0);

  // ========== Model Breakdown ==========
  if (data.summary?.model_breakdown && data.summary.model_breakdown.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Cost by Model', margin, yPos);
    yPos += 5;

    const modelData = data.summary.model_breakdown.map(m => [
      m.model.replace('claude-', '').replace(/-\d+$/, ''),
      m.queries.toLocaleString(),
      m.total_tokens.toLocaleString(),
      formatCurrency(m.cost_usd),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Model', 'Queries', 'Tokens', 'Cost']],
      body: modelData,
      theme: 'striped',
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [8, 145, 178], textColor: 255 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // ========== Recent Sessions ==========
  // Check if we need a new page
  if (yPos > 220) {
    doc.addPage();
    yPos = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Recent AI Sessions', margin, yPos);
  yPos += 5;

  const sessionsToShow = data.sessions.slice(0, 10);
  const sessionData = sessionsToShow.map(s => [
    s.name?.substring(0, 25) || 'Untitled',
    s.status === 'completed' ? 'Completed' : 'Active',
    s.ai_query_count.toString(),
    formatCurrency(s.total_cost_usd),
    formatTime(s.time_saved_minutes ?? 0),
    `${(s.roi_percentage ?? 0).toFixed(0)}%`,
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Session', 'Status', 'Queries', 'Cost', 'Time Saved', 'ROI']],
    body: sessionData,
    theme: 'striped',
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [8, 145, 178], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 22 },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 18, halign: 'center' },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // ========== Daily Costs (Last 7 Days) ==========
  if (data.dailyCosts.length > 0) {
    if (yPos > 230) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Daily Cost Trend (Last 7 Days)', margin, yPos);
    yPos += 5;

    const recentDays = data.dailyCosts.slice(-7);
    const dailyData = recentDays.map(d => [d.label, formatCurrency(d.cost_usd)]);

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Cost']],
      body: dailyData,
      theme: 'striped',
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [8, 145, 178], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 40, halign: 'right' },
      },
    });
  }

  // ========== Footer ==========
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${pageCount} | Lumen AI Analytics`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  const timestamp = new Date().toISOString().split('T')[0];
  doc.save(`ai_roi_report_${timestamp}.pdf`);
}

// ============================================================================
// Component
// ============================================================================

export const ROIReportExport = memo(({
  data,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
}: ROIReportExportProps) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await generateROIReport(data);
    } catch (error) {
      console.error('Failed to generate PDF report:', error);
    } finally {
      setIsExporting(false);
    }
  }, [data]);

  const variantClasses = {
    primary: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg shadow-cyan-500/25',
    secondary: 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || isExporting}
      className={`
        inline-flex items-center font-medium rounded-lg transition-all
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isExporting ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : (
        <FileText className={iconSizes[size]} />
      )}
      Export PDF Report
    </button>
  );
});

ROIReportExport.displayName = 'ROIReportExport';

export default ROIReportExport;
