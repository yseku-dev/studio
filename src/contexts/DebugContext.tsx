
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

export const DebugProvider = ({ children }: { children: ReactNode }) => {
  const [isDebugModeActive, setIsDebugModeActiveState] = useState<boolean>(false);
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);

  useEffect(() => {
    const storedDebugMode = localStorage.getItem(LOCALSTORAGE_DEBUG_MODE_KEY);
    if (storedDebugMode) {
      setIsDebugModeActiveState(JSON.parse(storedDebugMode));
    }
  }, []);

  const setIsDebugModeActive = useCallback((isActive: boolean) => {
    setIsDebugModeActiveState(isActive);
    localStorage.setItem(LOCALSTORAGE_DEBUG_MODE_KEY, JSON.stringify(isActive));
    if (!isActive) {
      // Optionally clear logs when debug mode is deactivated
      // setDebugLogs([]); 
    }
  }, []);

  const addDebugLog = useCallback((log: Omit<DebugLogEntry, 'timestamp'>) => {
    const timestamp = new Date().toISOString();
    // Prepend new logs to keep the latest at the top if desired, or append
    setDebugLogs(prevLogs => [{ ...log, timestamp }, ...prevLogs.slice(0, 499)]); // Keep last 500 logs
  }, []);

  const clearDebugLogs = useCallback(() => {
    setDebugLogs([]);
  }, []);

  return (
    <DebugContext.Provider
      value={{
        isDebugModeActive,
        setIsDebugModeActive,
        debugLogs,
        addDebugLog,
        clearDebugLogs,
      }}
    >
      {children}
    </DebugContext.Provider>
  );
};
