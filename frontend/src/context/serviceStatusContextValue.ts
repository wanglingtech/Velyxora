import { createContext, useContext } from 'react';
import type { BackendHealth } from '../services/apiClient';
import type { RequiredService } from '../services/toolAvailability';

export interface ServiceStatusContextValue {
  health: BackendHealth | null;
  /**
   * Whether a backend service required by a tool is usable right now.
   * Optimistic while the first health probe is in flight so cards do not
   * flash as "maintenance"; unavailable once the backend is unreachable.
   */
  isServiceAvailable: (service: RequiredService) => boolean;
  refresh: () => Promise<void>;
}

export const ServiceStatusContext = createContext<ServiceStatusContextValue | null>(null);

export const useServiceStatus = (): ServiceStatusContextValue => {
  const ctx = useContext(ServiceStatusContext);
  if (!ctx) throw new Error('useServiceStatus must be used within ServiceStatusProvider');
  return ctx;
};
