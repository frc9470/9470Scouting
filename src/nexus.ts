/**
 * FRC Nexus API integration for live match timing.
 * https://frc.nexus/api
 *
 * Provides near-instant match status and timing data for events
 * using Nexus field queuing. Falls back gracefully when unavailable.
 *
 * Attribution: Data provided by https://frc.nexus
 */

// ── Types ───────────────────────────────────────────────────

export interface NexusMatchTimes {
  scheduledStartTime?: number | null;
  estimatedQueueTime?: number | null;
  estimatedOnDeckTime?: number | null;
  estimatedOnFieldTime?: number | null;
  estimatedStartTime?: number | null;
  actualQueueTime?: number | null;
  actualOnDeckTime?: number | null;
  actualOnFieldTime?: number | null;
}

export type NexusMatchStatus =
  | "Queuing soon"
  | "Now queuing"
  | "On deck"
  | "On field"
  | string;

export interface NexusMatch {
  label: string;
  status: NexusMatchStatus | null;
  times: NexusMatchTimes;
  breakAfter?: string | null;
}

export interface NexusEventStatus {
  eventKey: string;
  nowQueuing: string | null;
  dataAsOfTime: number;
  matches: NexusMatch[];
}

// ── Parsed result for app consumption ───────────────────────

export interface NexusLiveState {
  /** Which match is currently queuing (e.g., "Qualification 24") */
  nowQueuing: string | null;
  /** Parsed match number from nowQueuing label, or null */
  nowQueuingNumber: number | null;
  /** Map of match number → status + timing */
  matchStatus: Map<number, { status: NexusMatchStatus | null; times: NexusMatchTimes }>;
  /** Timestamp of this snapshot */
  dataAsOfTime: number;
  /** Whether the fetch succeeded */
  available: boolean;
}

// ── API Client ──────────────────────────────────────────────

const NEXUS_API_BASE = "/api/nexus"; // proxy through Vite to avoid CORS

/**
 * Fetch live event status from Nexus.
 * Returns null if the API key is not configured or the event isn't on Nexus.
 */
export async function fetchNexusEventStatus(eventKey: string): Promise<NexusLiveState | null> {
  if (!eventKey) return null;

  try {
    const response = await fetch(`${NEXUS_API_BASE}/event/${encodeURIComponent(eventKey)}`);
    if (!response.ok) {
      // 401 = no API key, 404 = event not on Nexus — both are expected
      return { nowQueuing: null, nowQueuingNumber: null, matchStatus: new Map(), dataAsOfTime: 0, available: false };
    }

    const data = (await response.json()) as NexusEventStatus;
    return parseNexusResponse(data);
  } catch {
    return null;
  }
}

/**
 * Parse the raw Nexus response into app-friendly state.
 */
function parseNexusResponse(data: NexusEventStatus): NexusLiveState {
  const matchStatus = new Map<number, { status: NexusMatchStatus | null; times: NexusMatchTimes }>();

  for (const match of data.matches) {
    const num = parseMatchNumber(match.label);
    if (num !== null) {
      matchStatus.set(num, { status: match.status, times: match.times });
    }
  }

  return {
    nowQueuing: data.nowQueuing,
    nowQueuingNumber: data.nowQueuing ? parseMatchNumber(data.nowQueuing) : null,
    matchStatus,
    dataAsOfTime: data.dataAsOfTime,
    available: true,
  };
}

/**
 * Extract match number from a Nexus label like "Qualification 24" or "Playoff 3-1".
 * Returns null for non-qualification matches (we only track quals for scouting).
 */
function parseMatchNumber(label: string): number | null {
  const match = label.match(/Qualification\s+(\d+)/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

// ── Helpers for the app ─────────────────────────────────────

/**
 * Check if a match has been played according to Nexus timing data.
 * A match is considered played if it has an actualOnFieldTime set
 * (meaning teams have physically been on the field).
 */
export function isNexusMatchPlayed(state: NexusLiveState, matchNumber: number): boolean {
  const info = state.matchStatus.get(matchNumber);
  if (!info) return false;
  return (info.times.actualOnFieldTime ?? 0) > 0;
}

/**
 * Get the estimated time until a match starts, in milliseconds.
 * Returns null if no estimate is available.
 */
export function getMatchEtaMs(state: NexusLiveState, matchNumber: number): number | null {
  const info = state.matchStatus.get(matchNumber);
  if (!info) return null;

  const estimatedStart = info.times.estimatedStartTime;
  if (!estimatedStart) return null;

  const eta = estimatedStart - Date.now();
  return eta > 0 ? eta : null;
}

/**
 * Format an ETA in milliseconds to a human-readable string like "~7 min" or "~1 hr 20 min".
 */
export function formatEta(etaMs: number): string {
  const totalMin = Math.round(etaMs / 60_000);
  if (totalMin < 1) return "< 1 min";
  if (totalMin < 60) return `~${totalMin} min`;
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `~${hrs}h ${mins}m` : `~${hrs}h`;
}
