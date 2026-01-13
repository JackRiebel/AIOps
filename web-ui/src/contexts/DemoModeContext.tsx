'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DemoModeContextType {
  demoMode: boolean;
  toggleDemoMode: () => void;
  setDemoMode: (enabled: boolean) => void;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  // Default to false - show real data by default, not demo data
  const [demoMode, setDemoModeState] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  // Load demo mode setting from localStorage on mount
  useEffect(() => {
    const savedDemoMode = localStorage.getItem('demoMode');
    if (savedDemoMode !== null) {
      setDemoModeState(savedDemoMode === 'true');
    }
    setMounted(true);
  }, []);

  // Save demo mode setting to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('demoMode', String(demoMode));
    }
  }, [demoMode, mounted]);

  function toggleDemoMode() {
    setDemoModeState(prev => !prev);
  }

  function setDemoMode(enabled: boolean) {
    setDemoModeState(enabled);
  }

  // Prevent flash of wrong state
  if (!mounted) {
    return null;
  }

  return (
    <DemoModeContext.Provider value={{ demoMode, toggleDemoMode, setDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (context === undefined) {
    throw new Error('useDemoMode must be used within a DemoModeProvider');
  }
  return context;
}
