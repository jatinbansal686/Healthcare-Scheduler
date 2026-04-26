// ============================================================
// IAdminService.ts — Admin service interface (DIP)
// ============================================================

import type { AdminDataResponse } from "../types/api.types";

export interface IAdminService {
  fetchAdminData(accessToken: string): Promise<AdminDataResponse>;
}
