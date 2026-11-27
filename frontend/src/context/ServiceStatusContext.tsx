import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, BackendHealth } from '../services/apiClient';
import type { RequiredService } from '../services/toolAvailability';
import { ServiceStatusContext, type ServiceStatusContextValue } from './serviceStatusContextValue';

const HEALTH_REFRESH_INTERVAL_MS = 30_000;

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
