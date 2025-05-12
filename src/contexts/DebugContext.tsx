
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface DebugLogEntry {
  timestamp: string;
  source: string; // e.g., 'CLIENT', 'SERVER_AUTOUDDATE', 'SERVER_AGENT_CHAT'
  type: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG' | 'ORCHESTRATOR' | 'AGENT' | 'SYSTEM';
  message: string;
  data?: any; // Optional structured data
}

interface DebugContextType {
  isDebugModeActive: boolean;
  setIsDebugModeActive: (isActive: boolean) => void;
  isLogWindowExpanded: boolean; // New state
  setIsLogWindowExpanded: (isExpanded: boolean) => void; // New setter
  debugLogs: DebugLogEntry[];
  addDebugLog: (log: Omit<DebugLogEntry, 'timestamp'>) => void;
  clearDebugLogs: () => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export const useDebug = (): DebugContextType => {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
};

const LOCALSTORAGE_DEBUG_MODE_KEY = 'codealchemist_debug_mode_active';
const LOCALSTORAGE_DEBUG_EXPANDED_KEY = 'codealchemist_debug_expanded';

export const DebugProvider = ({ children }: { children: ReactNode }) => {
  const [isDebugModeActive, setIsDebugModeActiveState] = useState<boolean>(false);
  const [isLogWindowExpanded, setIsLogWindowExpandedState] = useState<boolean>(false); // New state
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);

  useEffect(() => {
    const storedDebugMode = localStorage.getItem(LOCALSTORAGE_DEBUG_MODE_KEY);
    if (storedDebugMode) {
      setIsDebugModeActiveState(JSON.parse(storedDebugMode));
    }
    const storedDebugExpanded = localStorage.getItem(LOCALSTORAGE_DEBUG_EXPANDED_KEY);
    if (storedDebugExpanded) {
      setIsLogWindowExpandedState(JSON.parse(storedDebugExpanded));
    }
  }, []);

  const setIsDebugModeActive = useCallback((isActive: boolean) => {
    setIsDebugModeActiveState(isActive);
    localStorage.setItem(LOCALSTORAGE_DEBUG_MODE_KEY, JSON.stringify(isActive));
    if (!isActive) {
      // Optionally clear logs or collapse window when debug mode is deactivated
      setIsLogWindowExpandedState(false); 
      localStorage.setItem(LOCALSTORAGE_DEBUG_EXPANDED_KEY, JSON.stringify(false));
    }
  }, []);

  const setIsLogWindowExpanded = useCallback((isExpanded: boolean) => { // New setter implementation
    setIsLogWindowExpandedState(isExpanded);
    localStorage.setItem(LOCALSTORAGE_DEBUG_EXPANDED_KEY, JSON.stringify(isExpanded));
  }, []);

  const addDebugLog = useCallback((log: Omit<DebugLogEntry, 'timestamp'>) => {
    const timestamp = new Date().toISOString();
    setDebugLogs(prevLogs => [{ ...log, timestamp }, ...prevLogs.slice(0, 499)]); 
  }, []);

  const clearDebugLogs = useCallback(() => {
    setDebugLogs([]);
  }, []);

  return (
    <DebugContext.Provider
      value={{
        isDebugModeActive,
        setIsDebugModeActive,
        isLogWindowExpanded, // Provide new state
        setIsLogWindowExpanded, // Provide new setter
        debugLogs,
        addDebugLog,
        clearDebugLogs,
      }}
    >
      {children}
    </DebugContext.Provider>
  );
};

