import { useState, useEffect, useCallback } from 'react';
import { AppControlItem, AppStatus } from '@/lib/app-controls';

export interface AppControlState {
  controls: Record<string, AppControlItem>;
  isAdmin: boolean;
  loading: boolean;
  isAppLocked: (appKey: string) => boolean;
  getAppStatus: (appKey: string) => AppStatus;
  getAppBadgeLabel: (appKey: string) => string;
  updateStatus: (appKey: string, status: AppStatus) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useAppControls(): AppControlState {
  const [controls, setControls] = useState<Record<string, AppControlItem>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchControls = useCallback(async () => {
    try {
      const res = await fetch('/api/app-controls', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.controls) {
          setControls(data.controls);
          setIsAdmin(data.isAdmin ?? false);
        }
      }
    } catch (err) {
      console.warn('[useAppControls fetch error]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchControls();
  }, [fetchControls]);

  const isAppLocked = useCallback(
    (appKey: string): boolean => {
      if (isAdmin) return false; // Super Admins bypass locks
      const item = controls[appKey];
      if (!item) return false;
      return item.status !== 'ACTIVE';
    },
    [controls, isAdmin]
  );

  const getAppStatus = useCallback(
    (appKey: string): AppStatus => {
      return controls[appKey]?.status || 'ACTIVE';
    },
    [controls]
  );

  const getAppBadgeLabel = useCallback(
    (appKey: string): string => {
      const status = controls[appKey]?.status || 'ACTIVE';
      switch (status) {
        case 'COMING_SOON':
          return 'COMING SOON';
        case 'UNDER_MAINTENANCE':
          return 'UNDER MAINTENANCE';
        case 'UPDATE_PROCESS':
          return 'UPDATE PROCESS';
        case 'ACTIVE':
        default:
          return 'ACTIVE';
      }
    },
    [controls]
  );

  const updateStatus = useCallback(
    async (appKey: string, status: AppStatus): Promise<boolean> => {
      try {
        const res = await fetch('/api/app-controls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appKey, status }),
        });
        if (res.ok) {
          await fetchControls();
          return true;
        }
      } catch (err) {
        console.error('[updateStatus error]', err);
      }
      return false;
    },
    [fetchControls]
  );

  return {
    controls,
    isAdmin,
    loading,
    isAppLocked,
    getAppStatus,
    getAppBadgeLabel,
    updateStatus,
    refresh: fetchControls,
  };
}
