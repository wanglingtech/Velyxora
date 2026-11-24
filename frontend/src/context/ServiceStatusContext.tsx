import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, BackendHealth } from '../services/apiClient';
import type { RequiredService } from '../services/toolAvailability';

const HEALTH_REFRESH_INTERVAL_MS = 30_000;

interface ServiceStatusContextValue {
  health: BackendHealth | null;
  /**
   * Whether a backend service required by a tool is usable right now.
   * Optimistic while the first health probe is in flight so cards do not
   * flash as "maintenance"; unavailable once the backend is unreachable.
   */
  isServiceAvailable: (service: RequiredService) => boolean;
  refresh: () => Promise<void>;
}

const ServiceStatusContext = createContext<ServiceStatusContextValue | null>(null);

export const ServiceStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [hasProbed, setHasProbed] = useState(false);

  const fetchHealth = useCallback(async (force = false) => {
    try {
      const data = await apiClient.checkHealth(force);
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setHasProbed(true);
    }
  }, []);

  const refresh = useCallback(() => fetchHealth(true), [fetchHealth]);

  useEffect(() => {
    // Initial probe uses the short-lived cache to absorb StrictMode remounts.
    void fetchHealth();
    const interval = window.setInterval(() => {
      void fetchHealth(true);
    }, HEALTH_REFRESH_INTERVAL_MS);

    // Re-check as soon as the tab becomes visible again (laptop sleep, etc.).
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void fetchHealth(true);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchHealth]);

  const isServiceAvailable = useCallback(
    (service: RequiredService): boolean => {
      if (!hasProbed) return true; // optimistic while the first probe is in flight
      if (!health) return false; // backend unreachable: dependent services are down
      return health.services[service] === true;
    },
    [hasProbed, health],
  );

  const value = useMemo<ServiceStatusContextValue>(
    () => ({ health, isServiceAvailable, refresh }),
    [health, isServiceAvailable, refresh],
  );

  return <ServiceStatusContext.Provider value={value}>{children}</ServiceStatusContext.Provider>;
};

export const useServiceStatus = (): ServiceStatusContextValue => {
  const ctx = useContext(ServiceStatusContext);
  if (!ctx) throw new Error('useServiceStatus must be used within ServiceStatusProvider');
  return ctx;
};
