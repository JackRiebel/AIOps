'use client';

import { useState, useEffect, useCallback } from 'react';

const ONBOARDING_STORAGE_KEY = 'lumen-onboarding-completed';
const WELCOME_SHOWN_KEY = 'lumen-welcome-shown';

export interface UseOnboardingReturn {
  /** Whether the welcome modal should be shown */
  showWelcome: boolean;
  /** Whether the tour is currently active */
  showTour: boolean;
  /** Whether onboarding has been completed */
  isCompleted: boolean;
  /** Start the guided tour */
  startTour: () => void;
  /** Close the welcome modal */
  closeWelcome: () => void;
  /** Close the tour */
  closeTour: () => void;
  /** Mark onboarding as complete */
  completeOnboarding: () => void;
  /** Reset onboarding state (for testing) */
  resetOnboarding: () => void;
}

/**
 * useOnboarding - Hook to manage first-time user onboarding
 *
 * Usage:
 * ```tsx
 * const { showWelcome, showTour, startTour, closeWelcome, completeOnboarding } = useOnboarding();
 *
 * return (
 *   <>
 *     <WelcomeModal
 *       isOpen={showWelcome}
 *       onClose={closeWelcome}
 *       onStartTour={startTour}
 *       onSkip={closeWelcome}
 *     />
 *     <OnboardingTour
 *       steps={defaultTourSteps}
 *       isOpen={showTour}
 *       onClose={closeTour}
 *       onComplete={completeOnboarding}
 *     />
 *   </>
 * );
 * ```
 */
export function useOnboarding(): UseOnboardingReturn {
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [isCompleted, setIsCompleted] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
    const welcomeShown = localStorage.getItem(WELCOME_SHOWN_KEY) === 'true';

    setIsCompleted(completed);

    // Show welcome modal for first-time users
    if (!completed && !welcomeShown) {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        setShowWelcome(true);
        localStorage.setItem(WELCOME_SHOWN_KEY, 'true');
      }, 1000);
      return () => clearTimeout(timer);
    }

    setIsInitialized(true);
  }, []);

  const startTour = useCallback(() => {
    setShowWelcome(false);
    // Small delay before starting tour
    setTimeout(() => {
      setShowTour(true);
    }, 300);
  }, []);

  const closeWelcome = useCallback(() => {
    setShowWelcome(false);
    // Mark as completed if they skip the welcome
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setIsCompleted(true);
  }, []);

  const closeTour = useCallback(() => {
    setShowTour(false);
  }, []);

  const completeOnboarding = useCallback(() => {
    setShowTour(false);
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setIsCompleted(true);
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    localStorage.removeItem(WELCOME_SHOWN_KEY);
    setIsCompleted(false);
    setShowWelcome(true);
  }, []);

  return {
    showWelcome: isInitialized && showWelcome, // Only show after initialization check completes
    showTour,
    isCompleted,
    startTour,
    closeWelcome,
    closeTour,
    completeOnboarding,
    resetOnboarding,
  };
}

export default useOnboarding;
