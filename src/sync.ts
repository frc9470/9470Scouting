import {
  listPendingSubmissions,
  markSubmissionSynced,
  markSubmissionSyncFailed,
  replaceScoutAssignments,
  replaceShifts,
  retryFailedSubmissions,
  saveEventSchedule,
  saveSyncedSubmissions,
} from "./db";
import {
  assignmentFromSupabaseRow,
  assignmentToSupabaseRow,
  fromSupabaseRow,
  getSupabaseClient,
  isSupabaseConfigured,
  scheduleFromSupabaseRow,
  scheduleToSupabaseRow,
  toSupabaseRow,
  type SupabaseEventScheduleRow,
  type SupabaseMatchSubmissionRow,
  type SupabaseScoutAssignmentRow,
} from "./supabase";
import type {
  EventSchedule,
  MemberGroup,
  MatchSubmission,
  ScoutAssignment,
  ScoutShift,
  TeamMember,
} from "./types";

export interface SyncResult {
  pushed: number;
  pulled: number;
  failed: number;
  assignmentsPulled: number;
}

// ── Submission sync ─────────────────────────────────────────

export async function syncWithSupabase(): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = await getSupabaseClient();
  await retryFailedSubmissions();
  const pending = await listPendingSubmissions();
  let pushed = 0;
  let failed = 0;

  for (const submission of pending) {
    const { error } = await supabase
      .from("match_submissions")
      .upsert(toSupabaseRow(submission), { onConflict: "id" });

    if (error) {
      failed += 1;
      await markSubmissionSyncFailed(submission.id, error.message);
    } else {
      pushed += 1;
      await markSubmissionSynced(submission.id);
    }
  }

  const { data, error } = await supabase
    .from("match_submissions")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(5000);

  if (error) throw error;

  const rows = (data ?? []) as SupabaseMatchSubmissionRow[];
  await saveSyncedSubmissions(rows.map(fromSupabaseRow));

  // Pull assignments from Supabase
  const assignmentsPulled = await pullAssignments();

  return {
    pushed,
    pulled: rows.length,
    failed,
    assignmentsPulled,
  };
}

/** Quick push of a single submission right after submit — fire-and-forget. */
export async function autoSyncSubmission(submission: MatchSubmission): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from("match_submissions")
      .upsert(toSupabaseRow(submission), { onConflict: "id" });

    if (error) {
      await markSubmissionSyncFailed(submission.id, error.message);
      return false;
    }
    await markSubmissionSynced(submission.id);
    return true;
  } catch {
    return false;
  }
}

// ── Assignment sync ─────────────────────────────────────────

/** Push locally-generated assignments to Supabase (lead only). */
export async function pushAssignments(
  eventKey: string,
  assignments: ScoutAssignment[],
  userId?: string,
): Promise<{ pushed: number; error?: string }> {
  if (!isSupabaseConfigured()) return { pushed: 0, error: "Not configured" };

  const supabase = await getSupabaseClient();

  // Delete existing assignments for this event first
  const { error: deleteError } = await supabase
    .from("scout_assignments")
    .delete()
    .eq("event_key", eventKey);

  if (deleteError) return { pushed: 0, error: deleteError.message };

  if (assignments.length === 0) return { pushed: 0 };

  // Insert new assignments in batches of 500
  const rows = assignments.map((a) => assignmentToSupabaseRow(a, userId));
  const batchSize = 500;
  let pushed = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from("scout_assignments")
      .insert(batch);

    if (error) return { pushed, error: error.message };
    pushed += batch.length;
  }

  return { pushed };
}

/** Pull assignments from Supabase and save to local Dexie. */
export async function pullAssignments(filterUserId?: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await getSupabaseClient();
  let query = supabase
    .from("scout_assignments")
    .select("*")
    .order("match_number", { ascending: true })
    .limit(5000);

  // Scouters only need their own assignments; leads get everything
  if (filterUserId) {
    query = query.eq("user_id", filterUserId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data ?? []) as SupabaseScoutAssignmentRow[];
  const assignments = rows.map(assignmentFromSupabaseRow);

  // Group by event_key and replace local assignments
  const byEvent = new Map<string, ScoutAssignment[]>();
  for (const assignment of assignments) {
    const existing = byEvent.get(assignment.eventKey) ?? [];
    existing.push(assignment);
    byEvent.set(assignment.eventKey, existing);
  }

  for (const [eventKey, eventAssignments] of byEvent) {
    await replaceScoutAssignments(eventKey, eventAssignments);
  }

  return assignments.length;
}

// ── Schedule sync ───────────────────────────────────────────

/** Push an event schedule to Supabase (lead only). */
export async function pushSchedule(
  schedule: EventSchedule,
  userId?: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Not configured" };

  const supabase = await getSupabaseClient();
  const row = scheduleToSupabaseRow(schedule, userId);
  const { error } = await supabase
    .from("event_schedules")
    .upsert(row, { onConflict: "event_key" });

  return { error: error?.message };
}

/** Pull all event schedules from Supabase and save locally. */
export async function pullSchedules(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("event_schedules")
    .select("*")
    .order("fetched_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const rows = (data ?? []) as SupabaseEventScheduleRow[];
  for (const row of rows) {
    await saveEventSchedule(scheduleFromSupabaseRow(row));
  }

  return rows.length;
}

// ── Profile fetching (for lead roster) ──────────────────────

/** Fetch all team member profiles from Supabase. */
export async function fetchAllProfiles(): Promise<TeamMember[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url, role, group")
    .order("display_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TeamMember[];
}

/** Update the current user's group (student/parent). */
export async function updateProfileGroup(userId: string, group: MemberGroup): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from("profiles").update({ group }).eq("id", userId);
  if (error) throw error;
}

/** Update any user's group (lead/admin use). */
export async function updateMemberGroup(userId: string, group: MemberGroup | null): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from("profiles").update({ group }).eq("id", userId);
  if (error) throw error;
}

/** Update any user's role (lead/admin use). */
export async function updateMemberRole(userId: string, role: "scouter" | "lead"): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw error;
}

// ── Shift sync ──────────────────────────────────────────────

/** Push shifts to Supabase (lead only). */
export async function pushShifts(
  eventKey: string,
  shifts: ScoutShift[],
  userId?: string,
): Promise<{ pushed: number; error?: string }> {
  if (!isSupabaseConfigured()) return { pushed: 0, error: "Not configured" };

  const supabase = await getSupabaseClient();

  // Delete existing shifts for this event
  const { error: deleteError } = await supabase
    .from("scout_shifts")
    .delete()
    .eq("event_key", eventKey);

  if (deleteError) return { pushed: 0, error: deleteError.message };
  if (shifts.length === 0) return { pushed: 0 };

  const rows = shifts.map((s) => ({
    id: s.id,
    event_key: s.eventKey,
    name: s.name,
    start_match: s.startMatch,
    end_match: s.endMatch,
    roster: s.roster,
    created_at: s.createdAt,
    created_by: userId ?? null,
  }));

  const { error } = await supabase.from("scout_shifts").insert(rows);
  if (error) return { pushed: 0, error: error.message };
  return { pushed: rows.length };
}

/** Pull shifts from Supabase. */
export async function pullShifts(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("scout_shifts")
    .select("*")
    .order("start_match", { ascending: true })
    .limit(500);

  if (error) throw error;

  const shifts: ScoutShift[] = (data ?? []).map((row: any) => ({
    id: row.id,
    eventKey: row.event_key,
    name: row.name,
    startMatch: row.start_match,
    endMatch: row.end_match,
    roster: row.roster ?? [],
    createdAt: row.created_at,
  }));

  const byEvent = new Map<string, ScoutShift[]>();
  for (const shift of shifts) {
    const existing = byEvent.get(shift.eventKey) ?? [];
    existing.push(shift);
    byEvent.set(shift.eventKey, existing);
  }

  for (const [ek, eventShifts] of byEvent) {
    await replaceShifts(ek, eventShifts);
  }

  return shifts.length;
}

// ── Comprehensive sync (background interval) ───────────────

export async function syncAll(userId?: string): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return { pushed: 0, pulled: 0, failed: 0, assignmentsPulled: 0 };
  }

  const supabase = await getSupabaseClient();

  // 1. Push pending submissions
  await retryFailedSubmissions();
  const pending = await listPendingSubmissions();
  let pushed = 0;
  let failed = 0;

  for (const submission of pending) {
    const { error } = await supabase
      .from("match_submissions")
      .upsert(toSupabaseRow(submission), { onConflict: "id" });

    if (error) {
      failed += 1;
      await markSubmissionSyncFailed(submission.id, error.message);
    } else {
      pushed += 1;
      await markSubmissionSynced(submission.id);
    }
  }

  // 2. Pull all submissions
  const { data, error: pullError } = await supabase
    .from("match_submissions")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(5000);

  if (pullError) throw pullError;

  const rows = (data ?? []) as SupabaseMatchSubmissionRow[];
  await saveSyncedSubmissions(rows.map(fromSupabaseRow));

  // 3. Pull assignments
  const assignmentsPulled = await pullAssignments();

  // 4. Pull schedules
  await pullSchedules();

  // 5. Pull shifts
  await pullShifts();

  return { pushed, pulled: rows.length, failed, assignmentsPulled };
}
