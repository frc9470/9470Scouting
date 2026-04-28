import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Alliance,
  EventSchedule,
  MatchSubmission,
  ScoutAssignment,
  ScheduleAlliance,
  ScheduledRobot,
} from "./types";

export interface SupabaseMatchSubmissionRow {
  id: string;
  original_submission_id: string | null;
  version_id: string;
  version_number: number;
  device_id: string;
  event_key: string | null;
  match_number: number | null;
  team_number: string;
  scouter_name: string;
  alliance: Alliance;
  station: string | null;
  submitted_at: string;
  deleted: boolean;
  payload: MatchSubmission;
}

let _client: SupabaseClient | null = null;

export function supabaseConfig() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  };
}

export function isSupabaseConfigured() {
  const { url, anonKey } = supabaseConfig();
  return Boolean(url && anonKey);
}

/** Synchronous singleton — safe to call from hooks and event listeners. */
export function getClient(): SupabaseClient {
  if (_client) return _client;
  const { url, anonKey } = supabaseConfig();
  if (!url || !anonKey) throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
  _client = createSupabaseClient(url, anonKey);
  return _client;
}

/** Backward-compatible async wrapper used by sync.ts. */
export async function getSupabaseClient(): Promise<SupabaseClient> {
  return getClient();
}

function numericMatchNumber(matchNumber: string) {
  const parsed = Number(matchNumber);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toSupabaseRow(submission: MatchSubmission): SupabaseMatchSubmissionRow {
  return {
    id: submission.id,
    original_submission_id: submission.originalSubmissionId,
    version_id: submission.versionId,
    version_number: submission.versionNumber,
    device_id: submission.deviceId,
    event_key: submission.division || null,
    match_number: numericMatchNumber(submission.matchNumber),
    team_number: submission.teamNumber,
    scouter_name: submission.scouterName,
    alliance: submission.alliance,
    station: submission.station || null,
    submitted_at: submission.submittedAt,
    deleted: Boolean(submission.deleted),
    payload: submission,
  };
}

export function fromSupabaseRow(row: SupabaseMatchSubmissionRow): MatchSubmission {
  return {
    ...row.payload,
    id: row.id,
    originalSubmissionId: row.original_submission_id,
    versionId: row.version_id,
    versionNumber: row.version_number,
    deviceId: row.device_id,
    division: row.event_key ?? row.payload.division,
    matchNumber: row.match_number == null ? row.payload.matchNumber : String(row.match_number),
    teamNumber: row.team_number,
    scouterName: row.scouter_name,
    alliance: row.alliance,
    station: row.station ?? "",
    submittedAt: row.submitted_at,
    syncStatus: "synced",
    deleted: row.deleted,
  };
}

// ── Scout Assignment conversions ────────────────────────────

export interface SupabaseScoutAssignmentRow {
  id: string;
  event_key: string;
  match_id: string;
  match_number: number;
  label: string;
  team_number: string;
  alliance: ScheduleAlliance;
  station: string;
  scouter_id: string;
  scouter_name: string;
  user_id: string | null;
  created_at: string;
  created_by: string | null;
}

export function assignmentToSupabaseRow(
  assignment: ScoutAssignment,
  createdBy?: string,
): SupabaseScoutAssignmentRow {
  return {
    id: assignment.id,
    event_key: assignment.eventKey,
    match_id: assignment.matchId,
    match_number: assignment.matchNumber,
    label: assignment.label,
    team_number: assignment.teamNumber,
    alliance: assignment.alliance,
    station: assignment.station,
    scouter_id: assignment.scouterId,
    scouter_name: assignment.scouterName,
    user_id: assignment.userId,
    created_at: assignment.createdAt,
    created_by: createdBy ?? null,
  };
}

export function assignmentFromSupabaseRow(row: SupabaseScoutAssignmentRow): ScoutAssignment {
  return {
    id: row.id,
    eventKey: row.event_key,
    matchId: row.match_id,
    matchNumber: row.match_number,
    label: row.label,
    teamNumber: row.team_number,
    alliance: row.alliance as ScheduleAlliance,
    station: row.station as ScheduledRobot["station"],
    scouterId: row.scouter_id,
    scouterName: row.scouter_name,
    userId: row.user_id ?? null,
    createdAt: row.created_at,
  };
}

// ── Event Schedule conversions ──────────────────────────────

export interface SupabaseEventScheduleRow {
  event_key: string;
  fetched_at: string;
  match_count: number;
  matches: EventSchedule["matches"];
  created_by: string | null;
}

export function scheduleToSupabaseRow(
  schedule: EventSchedule,
  createdBy?: string,
): SupabaseEventScheduleRow {
  return {
    event_key: schedule.eventKey,
    fetched_at: schedule.fetchedAt,
    match_count: schedule.matchCount,
    matches: schedule.matches,
    created_by: createdBy ?? null,
  };
}

export function scheduleFromSupabaseRow(row: SupabaseEventScheduleRow): EventSchedule {
  return {
    eventKey: row.event_key,
    fetchedAt: row.fetched_at,
    matchCount: row.match_count,
    matches: row.matches,
  };
}
