'use client';

import { memo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  Play,
  ArrowRight,
  MessageSquare,
  BarChart3,
  Workflow,
  Zap,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
  onSkip: () => void;
  userName?: string;
}

// ============================================================================
// Feature Highlights
// ============================================================================

const features = [
  {
    icon: MessageSquare,
    title: 'Natural Language AI',
    description: 'Ask questions about your network in plain English',
    color: 'text-purple-500',
    bg: 'bg-purple-100 dark:bg-purple-500/20',
  },
  {
    icon: BarChart3,
    title: 'ROI Tracking',
    description: 'See exactly how much AI saves you',
    color: 'text-emerald-500',
    bg: 'bg-emerald-100 dark:bg-emerald-500/20',
  },
  {
    icon: Workflow,
    title: 'Smart Automation',
    description: 'AI-powered workflows that respond to events',
    color: 'text-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-500/20',
  },
  {
    icon: Zap,
    title: 'Instant Insights',
    description: 'Real-time analysis across all your tools',
    color: 'text-amber-500',
    bg: 'bg-amber-100 dark:bg-amber-500/20',
  },
];

// ============================================================================
// WelcomeModal Component
// ============================================================================

export const WelcomeModal = memo(({
  isOpen,
  onClose,
  onStartTour,
  onSkip,
  userName,
}: WelcomeModalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const greeting = userName ? `Welcome, ${userName}!` : 'Welcome to Lumen AI!';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-300">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors z-10"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>

        {/* Header with gradient */}
        <div className="relative px-8 pt-10 pb-6 bg-gradient-to-br from-cyan-500 via-cyan-600 to-blue-600 text-white">
          {/* Decorative sparkles */}
          <div className="absolute top-4 left-8 opacity-30">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="absolute bottom-4 right-8 opacity-30">
            <Sparkles className="w-6 h-6" />
          </div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Your AI Network Assistant
            </div>
            <h2 className="text-2xl font-bold mb-2">{greeting}</h2>
            <p className="text-cyan-100 text-sm">
              Let&apos;s get you up to speed with the powerful AI features that will transform how you manage your network.
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors"
              >
                <div className={`inline-flex p-2 rounded-lg ${feature.bg} mb-3`}>
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">
                  {feature.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              I&apos;ll explore on my own
            </button>
            <button
              onClick={onStartTour}
              className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30"
            >
              <Play className="w-4 h-4" />
              Take the Tour
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});

WelcomeModal.displayName = 'WelcomeModal';

export default WelcomeModal;
