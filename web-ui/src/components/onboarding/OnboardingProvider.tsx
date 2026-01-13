'use client';

import { memo, ReactNode } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { OnboardingTour, defaultTourSteps } from './OnboardingTour';
import { WelcomeModal } from './WelcomeModal';

export interface OnboardingProviderProps {
  children: ReactNode;
  /** User's name for personalized greeting */
  userName?: string;
}

/**
 * OnboardingProvider - Wraps the app to provide onboarding experience
 *
 * Add this to your layout to automatically show the welcome modal
 * and guided tour for first-time users.
 *
 * Usage:
 * ```tsx
 * <OnboardingProvider userName={user?.name}>
 *   {children}
 * </OnboardingProvider>
 * ```
 */
export const OnboardingProvider = memo(({
  children,
  userName,
}: OnboardingProviderProps) => {
  const {
    showWelcome,
    showTour,
    startTour,
    closeWelcome,
    closeTour,
    completeOnboarding,
  } = useOnboarding();

  return (
    <>
      {children}

      <WelcomeModal
        isOpen={showWelcome}
        onClose={closeWelcome}
        onStartTour={startTour}
        onSkip={closeWelcome}
        userName={userName}
      />

      <OnboardingTour
        steps={defaultTourSteps}
        isOpen={showTour}
        onClose={closeTour}
        onComplete={completeOnboarding}
      />
    </>
  );
});

OnboardingProvider.displayName = 'OnboardingProvider';

export default OnboardingProvider;
