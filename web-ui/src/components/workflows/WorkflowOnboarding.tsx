'use client';

import { memo, useState, useCallback, useEffect } from 'react';
import {
  X,
  Workflow,
  Sparkles,
  FileCode,
  CheckCircle,
  ArrowRight,
  Play,
  Clock,
  Shield,
  Brain,
} from 'lucide-react';

/**
 * WorkflowOnboarding - First-time user onboarding modal
 *
 * Features:
 * - Multi-step tour explaining workflows
 * - Visual guides with icons
 * - Progress indicator
 * - Option to skip or dismiss
 */

export interface WorkflowOnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tips: string[];
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to AI Workflows',
    description: 'Automate your network operations with intelligent, event-driven workflows that use AI to analyze events and recommend actions.',
    icon: Workflow,
    tips: [
      'Workflows run automatically when triggered by events',
      'AI analyzes each trigger to reduce false positives',
      'Critical actions require your approval before execution',
    ],
  },
  {
    id: 'triggers',
    title: 'Workflow Triggers',
    description: 'Workflows can be triggered by network events, scheduled times, or manually on demand.',
    icon: Play,
    tips: [
      'Event-based: Device offline, high latency, security alerts',
      'Scheduled: Daily reports, weekly audits, hourly checks',
      'Manual: Run anytime with a single click',
    ],
  },
  {
    id: 'ai',
    title: 'AI-Powered Analysis',
    description: 'Each workflow can use AI to analyze trigger events and provide intelligent recommendations.',
    icon: Brain,
    tips: [
      'AI evaluates if action is truly needed',
      'Confidence scores help you make decisions',
      'Risk levels indicate potential impact',
    ],
  },
  {
    id: 'approvals',
    title: 'Approval Process',
    description: 'Critical actions like device reboots or port changes require your approval before execution.',
    icon: Shield,
    tips: [
      'Review AI analysis before approving',
      'Modify proposed actions if needed',
      'Reject with a reason for auditing',
    ],
  },
  {
    id: 'start',
    title: 'Get Started',
    description: "You're ready to create your first workflow! Start with a template or create a custom one.",
    icon: Sparkles,
    tips: [
      'Use "Quick Create" for simple workflows',
      'Try "AI Generate" to describe what you want',
      'Browse templates for common use cases',
    ],
  },
];

const STORAGE_KEY = 'workflow-onboarding-completed';

export const WorkflowOnboarding = memo(({
  onComplete,
  onSkip,
}: WorkflowOnboardingProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      localStorage.setItem(STORAGE_KEY, 'true');
      onComplete();
    } else {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsAnimating(false);
      }, 150);
    }
  }, [isLastStep, onComplete]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(prev => prev - 1);
        setIsAnimating(false);
      }, 150);
    }
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onSkip();
  }, [onSkip]);

  const IconComponent = step.icon;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-cyan-600 to-blue-700 p-8 text-white">
          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Progress dots */}
          <div className="flex items-center gap-2 mb-6">
            {ONBOARDING_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-8 bg-white'
                    : index < currentStep
                    ? 'w-4 bg-white/60'
                    : 'w-4 bg-white/30'
                }`}
              />
            ))}
          </div>

          {/* Icon and title */}
          <div className={`transition-opacity duration-150 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
              <IconComponent className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{step.title}</h2>
            <p className="text-white/80 leading-relaxed">{step.description}</p>
          </div>
        </div>

        {/* Tips section */}
        <div className={`p-6 transition-opacity duration-150 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider">
            Key Points
          </h3>
          <div className="space-y-3">
            {step.tips.map((tip, index) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700 dark:text-slate-300">{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <div>
            {!isFirstStep ? (
              <button
                onClick={handlePrev}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Back
              </button>
            ) : (
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Skip tour
              </button>
            )}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium rounded-xl hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20"
          >
            {isLastStep ? (
              <>
                Get Started
                <Sparkles className="w-4 h-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

WorkflowOnboarding.displayName = 'WorkflowOnboarding';

// Helper to check if onboarding should be shown
export function shouldShowOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) !== 'true';
}

// Helper to reset onboarding state (for testing)
export function resetOnboarding(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export default WorkflowOnboarding;
