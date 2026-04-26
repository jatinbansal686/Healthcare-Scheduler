// ============================================================
// agent-chat/google/GoogleCalendarClient.ts
// Concrete implementation of IGoogleCalendarClient
// Makes direct HTTP calls to Google Calendar REST API v3
// SOLID: SRP — only concern is Google Calendar API communication
// ============================================================

import type {
  IGoogleCalendarClient,
  CalendarEvent,
  FreeBusySlot,
} from "./IGoogleClient.ts";
import { createLogger } from "../../_shared/logger.ts";
import { CalendarError } from "../../_shared/error.ts";

const logger = createLogger("GoogleCalendarClient");

const CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarClient implements IGoogleCalendarClient {
  constructor() {
    logger.calendar("GoogleCalendarClient initialized");
  }

  // ── Private HTTP helper ───────────────────────────────────

  private async request<T>(
    path: string,
    accessToken: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${CALENDAR_BASE_URL}${path}`;
    logger.calendar(`HTTP ${options.method ?? "GET"} ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`Calendar API error ${response.status}`, {
        url,
        body: errorBody,
      });
      throw new CalendarError(
        `Google Calendar API error (${response.status}): ${errorBody}`,
      );
    }

    const data = (await response.json()) as T;
    logger.calendar("Calendar API request successful");
    return data;
  }

  // ── List events in a time window ─────────────────────────

  async listEvents(
    calendarId: string,
    accessToken: string,
    timeMin: string,
    timeMax: string,
  ): Promise<CalendarEvent[]> {
    logger.calendar("Listing events", { calendarId, timeMin, timeMax });

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });

    const encodedId = encodeURIComponent(calendarId);
    const data = await this.request<{ items?: CalendarEvent[] }>(
      `/calendars/${encodedId}/events?${params}`,
      accessToken,
    );

    const events = data.items ?? [];
    logger.calendar(`Found ${events.length} events in window`);
    return events;
  }

  // ── Create a calendar event ───────────────────────────────

  async createEvent(
    calendarId: string,
    accessToken: string,
    event: CalendarEvent,
  ): Promise<CalendarEvent> {
    logger.calendar("Creating calendar event", {
      calendarId,
      summary: event.summary,
      start: event.start.dateTime,
    });

    const encodedId = encodeURIComponent(calendarId);
    const created = await this.request<CalendarEvent>(
      `/calendars/${encodedId}/events`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify(event),
      },
    );

    logger.calendar("Event created successfully", { eventId: created.id });
    return created;
  }

  // ── Delete a calendar event ───────────────────────────────

  async deleteEvent(
    calendarId: string,
    accessToken: string,
    eventId: string,
  ): Promise<void> {
    logger.calendar("Deleting calendar event", { calendarId, eventId });

    const encodedId = encodeURIComponent(calendarId);
    await fetch(
      `${CALENDAR_BASE_URL}/calendars/${encodedId}/events/${eventId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    logger.calendar("Event deleted successfully", { eventId });
  }

  // ── Get free/busy slots ───────────────────────────────────

  async getFreeBusy(
    calendarId: string,
    accessToken: string,
    timeMin: string,
    timeMax: string,
  ): Promise<FreeBusySlot[]> {
    logger.calendar("Querying free/busy", { calendarId, timeMin, timeMax });

    const body = {
      timeMin,
      timeMax,
      items: [{ id: calendarId }],
    };

    const data = await this.request<{
      calendars: Record<string, { busy: FreeBusySlot[] }>;
    }>("/freeBusy", accessToken, {
      method: "POST",
      body: JSON.stringify(body),
    });

    const busySlots = data.calendars?.[calendarId]?.busy ?? [];
    logger.calendar(`Found ${busySlots.length} busy slots`);
    return busySlots;
  }
}
