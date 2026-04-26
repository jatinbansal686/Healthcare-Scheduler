// ============================================================
// AdminService.ts — Calls admin-data edge function
// Requires a valid Supabase JWT in the Authorization header
// ============================================================

import type { IAdminService } from "./IAdminService";
import type { AdminDataResponse } from "../types/api.types";
import { logger } from "../lib/logger";
import { logAndNormalize } from "../lib/errorHandler";

const CONTEXT = "AdminService";

export class AdminService implements IAdminService {
  private readonly edgeFunctionUrl: string;

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/admin-data`;
    logger.info(CONTEXT, "AdminService initialized", {
      url: this.edgeFunctionUrl,
    });
  }

  async fetchAdminData(accessToken: string): Promise<AdminDataResponse> {
    logger.info(CONTEXT, "fetchAdminData called");

    if (!accessToken) {
      logger.error(CONTEXT, "fetchAdminData called without accessToken");
      throw new Error("Access token is required to fetch admin data");
    }

    try {
      const response = await fetch(this.edgeFunctionUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      logger.info(CONTEXT, "admin-data response received", {
        status: response.status,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        logger.error(CONTEXT, "admin-data returned non-OK", {
          status: response.status,
          body: errorText,
        });
        throw new Error(
          `Admin data fetch failed: ${response.status} ${errorText}`,
        );
      }

      const json = await response.json();
      logger.info(CONTEXT, "fetchAdminData successful", {
        inquiries: json.data?.inquiries?.length ?? 0,
        appointments: json.data?.appointments?.length ?? 0,
      });

      if (!json.success) {
        logger.error(CONTEXT, "admin-data returned success:false", json.error);
        throw new Error(json.error?.message ?? "Unknown admin data error");
      }

      return json.data as AdminDataResponse;
    } catch (err) {
      logAndNormalize(CONTEXT, err);
      throw err;
    }
  }
}
