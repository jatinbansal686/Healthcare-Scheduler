// ============================================================
// useAdminData.ts — Fetches admin data using current session
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AdminDataResponse } from '../types/api.types';
import { AdminService } from '../services/AdminService';
import { logger } from '../lib/logger';
import { logAndNormalize } from '../lib/errorHandler';

const CONTEXT = 'useAdminData';

const adminService = new AdminService();

export interface UseAdminDataReturn {
  data: AdminDataResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAdminData(session: Session | null): UseAdminDataReturn {
  logger.debug(CONTEXT, 'useAdminData hook initialized', { hasSession: !!session });

  const [data, setData] = useState<AdminDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState<number>(0);

  const refetch = useCallback(() => {
    logger.info(CONTEXT, 'Manual refetch triggered');
    setFetchTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!session?.access_token) {
      logger.warn(CONTEXT, 'No session token — skipping admin data fetch');
      setData(null);
      return;
    }

    logger.info(CONTEXT, 'Fetching admin data', { trigger: fetchTrigger });
    setIsLoading(true);
    setError(null);

    adminService.fetchAdminData(session.access_token)
      .then((result) => {
        logger.info(CONTEXT, 'Admin data loaded', {
          inquiries: result.inquiries.length,
          appointments: result.appointments.length,
        });
        setData(result);
      })
      .catch((err) => {
        const normalized = logAndNormalize(CONTEXT, err);
        setError(normalized.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [session?.access_token, fetchTrigger]);

  return { data, isLoading, error, refetch };
}