'use client';

import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  MessageSquare,
  BarChart3,
  Shield,
  Workflow,
  AlertTriangle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface TourStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon?: React.ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export interface OnboardingTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  storageKey?: string;
}

// ============================================================================
// Default Tour Steps
// ============================================================================

export const defaultTourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Lumen AI',
    description: 'Your intelligent network assistant. Let me show you around the key features that will help you work faster and smarter.',
    position: 'center',
    icon: <Sparkles className="w-6 h-6 text-cyan-500" />,
  },
  {
    id: 'ai-chat',
    title: 'AI-Powered Network Assistant',
    description: 'Ask questions in natural language about your network. The AI understands Meraki, ThousandEyes, Splunk, and more. Try "Show me devices that went offline today".',
    target: '[data-tour="ai-chat"]',
    position: 'right',
    icon: <MessageSquare className="w-6 h-6 text-purple-500" />,
    action: {
      label: 'Try AI Chat',
      href: '/network',
    },
  },
  {
    id: 'costs',
    title: 'Track AI ROI & Costs',
    description: 'See exactly how much AI is saving you. Track costs per query, time saved vs manual work, and your overall return on investment.',
    target: '[data-tour="costs"]',
    position: 'bottom',
    icon: <BarChart3 className="w-6 h-6 text-emerald-500" />,
    action: {
      label: 'View ROI Dashboard',
      href: '/costs',
    },
  },
  {
    id: 'incidents',
    title: 'AI-Powered Incident Detection',
    description: 'Incidents are automatically detected and correlated across your integrations. AI helps identify root causes and suggests remediations.',
    target: '[data-tour="incidents"]',
    position: 'bottom',
    icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
    action: {
      label: 'View Incidents',
      href: '/incidents',
    },
  },
  {
    id: 'workflows',
    title: 'Automate with AI Workflows',
    description: 'Create automated workflows that respond to network events. AI can help generate workflows from natural language descriptions.',
    target: '[data-tour="workflows"]',
    position: 'bottom',
    icon: <Workflow className="w-6 h-6 text-blue-500" />,
    action: {
      label: 'Create Workflow',
      href: '/workflows',
    },
  },
  {
    id: 'security',
    title: 'Enterprise Security',
    description: 'Full audit logging, role-based access control, and compliance features. Every AI action is tracked and auditable.',
    target: '[data-tour="security"]',
    position: 'bottom',
    icon: <Shield className="w-6 h-6 text-red-500" />,
  },
];

// ============================================================================
// Spotlight Overlay Component
// ============================================================================

function SpotlightOverlay({ targetRect }: { targetRect: DOMRect | null }) {
  if (!targetRect) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[9998] transition-opacity duration-300" />
    );
  }

  const padding = 8;
  const { top, left, width, height } = targetRect;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      <svg className="w-full h-full">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={left - padding}
              y={top - padding}
              width={width + padding * 2}
              height={height + padding * 2}
              rx="8"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.6)"
          mask="url(#spotlight-mask)"
        />
      </svg>
      {/* Highlight border */}
      <div
        className="absolute border-2 border-cyan-500 rounded-lg shadow-lg shadow-cyan-500/30 pointer-events-none animate-pulse"
        style={{
          top: top - padding,
          left: left - padding,
          width: width + padding * 2,
          height: height + padding * 2,
        }}
      />
    </div>
  );
}

// ============================================================================
// Tour Dialog Component
// ============================================================================

interface TourDialogProps {
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onAction?: () => void;
}

function TourDialog({
  step,
  currentStep,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onSkip,
  onAction,
}: TourDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Calculate position based on target element
  const getPosition = useCallback(() => {
    if (!targetRect || step.position === 'center') {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 16;
    const dialogWidth = 400;
    const dialogHeight = 280;

    switch (step.position) {
      case 'top':
        return {
          position: 'fixed' as const,
          top: Math.max(padding, targetRect.top - dialogHeight - padding),
          left: Math.max(padding, targetRect.left + targetRect.width / 2 - dialogWidth / 2),
        };
      case 'bottom':
        return {
          position: 'fixed' as const,
          top: targetRect.bottom + padding,
          left: Math.max(padding, Math.min(
            window.innerWidth - dialogWidth - padding,
            targetRect.left + targetRect.width / 2 - dialogWidth / 2
          )),
        };
      case 'left':
        return {
          position: 'fixed' as const,
          top: Math.max(padding, targetRect.top + targetRect.height / 2 - dialogHeight / 2),
          left: Math.max(padding, targetRect.left - dialogWidth - padding),
        };
      case 'right':
        return {
          position: 'fixed' as const,
          top: Math.max(padding, targetRect.top + targetRect.height / 2 - dialogHeight / 2),
          left: Math.min(window.innerWidth - dialogWidth - padding, targetRect.right + padding),
        };
      default:
        return {
          position: 'fixed' as const,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  }, [targetRect, step.position]);

  const positionStyle = getPosition();
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`tour-title-${step.id}`}
      aria-describedby={`tour-desc-${step.id}`}
      className="z-[9999] w-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
      style={positionStyle}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {step.icon && (
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                {step.icon}
              </div>
            )}
            <div>
              <h3 id={`tour-title-${step.id}`} className="text-lg font-semibold text-slate-900 dark:text-white">
                {step.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5" aria-live="polite">
                Step {currentStep + 1} of {totalSteps}
              </p>
            </div>
          </div>
          <button
            onClick={onSkip}
            aria-label="Skip tour"
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-4">
        <p id={`tour-desc-${step.id}`} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {step.description}
        </p>

        {step.action && (
          <button
            onClick={onAction}
            className="mt-4 px-4 py-2 text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-lg transition-colors"
          >
            {step.action.label} &rarr;
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-6 pb-2">
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= currentStep
                  ? 'bg-cyan-500'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          Skip tour
        </button>

        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button
            onClick={onNext}
            className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
          >
            {isLastStep ? 'Finish' : 'Next'}
            {!isLastStep && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main OnboardingTour Component
// ============================================================================

export const OnboardingTour = memo(({
  steps,
  isOpen,
  onClose,
  onComplete,
  storageKey = 'lumen-onboarding-completed',
}: OnboardingTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Find and highlight target element
  useEffect(() => {
    if (!isOpen) return;

    const step = steps[currentStep];
    if (step.target) {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [isOpen, currentStep, steps]);

  // Handle window resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      const step = steps[currentStep];
      if (step.target) {
        const element = document.querySelector(step.target);
        if (element) {
          setTargetRect(element.getBoundingClientRect());
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, currentStep, steps]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete tour
      localStorage.setItem(storageKey, 'true');
      onComplete();
    }
  }, [currentStep, steps.length, storageKey, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(storageKey, 'true');
    onClose();
  }, [storageKey, onClose]);

  const handleAction = useCallback(() => {
    const step = steps[currentStep];
    if (step.action?.onClick) {
      step.action.onClick();
    } else if (step.action?.href) {
      handleSkip();
      window.location.href = step.action.href;
    }
  }, [currentStep, steps, handleSkip]);

  if (!isOpen || !mounted) return null;

  const step = steps[currentStep];

  return createPortal(
    <>
      <SpotlightOverlay targetRect={targetRect} />
      <TourDialog
        step={step}
        currentStep={currentStep}
        totalSteps={steps.length}
        targetRect={targetRect}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
        onAction={step.action ? handleAction : undefined}
      />
    </>,
    document.body
  );
});

OnboardingTour.displayName = 'OnboardingTour';

export default OnboardingTour;
