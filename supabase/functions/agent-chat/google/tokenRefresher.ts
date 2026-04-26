// ============================================================
// agent-chat/google/tokenRefresher.ts
// Exchanges a Google OAuth refresh token for a short-lived access token
// SOLID: SRP — one job: get a valid access token from a refresh token
// ============================================================

import type { ITokenRefresher, TokenResponse } from "./IGoogleClient.ts";
import { createLogger } from "../../_shared/logger.ts";
import { CalendarError } from "../../_shared/error.ts";

const logger = createLogger("TokenRefresher");

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export class TokenRefresher implements ITokenRefresher {
  private readonly clientId: string;
  private readonly clientSecret: string;

  // In-memory cache: refreshToken → { accessToken, expiresAt }
  private readonly cache: Map<
    string,
    { accessToken: string; expiresAt: number }
  > = new Map();

  constructor() {
    logger.info("Initializing TokenRefresher");

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!clientId) {
      throw new CalendarError(
        "GOOGLE_CLIENT_ID environment variable is not set",
      );
    }
    if (!clientSecret) {
      throw new CalendarError(
        "GOOGLE_CLIENT_SECRET environment variable is not set",
      );
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    logger.info("TokenRefresher initialized successfully");
  }

  async getAccessToken(refreshToken: string): Promise<string> {
    logger.calendar("Getting access token for refresh token", {
      tokenPrefix: refreshToken.slice(0, 10) + "...",
    });

    // Check cache — avoid unnecessary token requests
    const cached = this.cache.get(refreshToken);
    if (cached && Date.now() < cached.expiresAt - 60_000) {
      logger.calendar("Returning cached access token (still valid)");
      return cached.accessToken;
    }

    logger.calendar("Cached token expired or missing — refreshing from Google");

    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      console.log(
        "[CALENDAR] [TokenRefresher] POSTing to Google token endpoint",
      );
      const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Google token refresh failed", {
          status: response.status,
          body: errorText,
        });
        throw new CalendarError(
          `Google token refresh failed (${response.status}): ${errorText}`,
        );
      }

      const tokenData = (await response.json()) as TokenResponse;

      logger.calendar("Access token refreshed successfully", {
        expiresIn: tokenData.expires_in,
      });

      // Cache the new token (expires_in is in seconds)
      this.cache.set(refreshToken, {
        accessToken: tokenData.access_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
      });

      return tokenData.access_token;
    } catch (err) {
      if (err instanceof CalendarError) throw err;
      logger.error("Unexpected error during token refresh", err);
      throw new CalendarError(
        `Token refresh failed: ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }
  }
}
