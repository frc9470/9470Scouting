import { createId } from "./domain";
import type { NexusLiveState } from "./nexus";
import { splitMatchesIntoSegments } from "./scheduleDays";
import type {
  EventSchedule,
  MatchSubmission,
  ScoutAssignment,
  ScoutShift,
  ScheduledMatch,
  ShiftSlot,
  StationType,
  TeamMember,
} from "./types";

const STATIONS: StationType[] = ["red1", "red2", "red3", "blue1", "blue2", "blue3"];
const stationOrder = STATIONS as readonly string[];

function assignmentKey(matchNumber: number | string, teamNumber: string) {
  return `${String(matchNumber).trim()}::${teamNumber.trim()}`;
}

export function sortAssignments(assignments: ScoutAssignment[]) {
  return [...assignments].sort(
    (a, b) =>
      a.matchNumber - b.matchNumber ||
      stationOrder.indexOf(a.station) - stationOrder.indexOf(b.station) ||
      a.teamNumber.localeCompare(b.teamNumber),
  );
}

/**
 * Generate scout assignments from an event schedule and a list of team members.
 * Uses TeamMember (Supabase profiles) so assignments are linked by auth user_id.
 */
export function generateScoutAssignments(
  schedule: EventSchedule,
  members: TeamMember[],
): ScoutAssignment[] {
  const activeMembers = members.filter((m) => m.display_name.trim());
  if (activeMembers.length === 0) return [];

  const createdAt = new Date().toISOString();
  return schedule.matches
    .filter((match) => match.compLevel === "qm")
    .flatMap((match, matchIndex) =>
      match.robots.map((robot, robotIndex) => {
        const member = activeMembers[(matchIndex * 6 + robotIndex) % activeMembers.length];
        return {
          id: createId("assignment"),
          eventKey: schedule.eventKey,
          matchId: match.id,
          matchNumber: match.matchNumber,
          label: match.label,
          teamNumber: robot.teamNumber,
          alliance: robot.alliance,
          station: robot.station,
          scouterId: member.id,
          scouterName: member.display_name,
          userId: member.id,
          createdAt,
        };
      }),
    );
}

export function coveredAssignmentIds(assignments: ScoutAssignment[], submissions: MatchSubmission[]) {
  const submitted = new Set(
    submissions.map((submission) => assignmentKey(submission.matchNumber, submission.teamNumber)),
  );
  return new Set(
    assignments
      .filter((assignment) => submitted.has(assignmentKey(assignment.matchNumber, assignment.teamNumber)))
      .map((assignment) => assignment.id),
  );
}

export function missingAssignments(assignments: ScoutAssignment[], submissions: MatchSubmission[]) {
  const covered = coveredAssignmentIds(assignments, submissions);
  return sortAssignments(assignments.filter((assignment) => !covered.has(assignment.id)));
}

export function duplicateSubmissionKeys(submissions: MatchSubmission[]) {
  const counts = new Map<string, number>();
  for (const submission of submissions) {
    const key = assignmentKey(submission.matchNumber, submission.teamNumber);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => {
      const [matchNumber, teamNumber] = key.split("::");
      return { matchNumber, teamNumber, count };
    });
}

/**
 * Check whether a match has already been played.
 *
 * Four signals, in priority order:
 * 0. Nexus `actualOnFieldTime` is set → near-instant, most reliable
 * 1. TBA `actualTime` is set → match definitively played
 * 2. Other scouters submitted data for this match >5 min ago → match played
 * 3. Scheduled/predicted time was >1 hour ago → match almost certainly played
 *    (1hr buffer because FRC events often run behind schedule)
 */
function isMatchPlayed(
  match: ScheduledMatch | undefined,
  matchSubmissions: MatchSubmission[],
  nowMs: number,
  nexusActualOnField?: number | null,
): boolean {
  // Signal 0: Nexus on-field time + buffer (match takes ~3 min, give 5 min total)
  const NEXUS_BUFFER_MS = 5 * 60 * 1000;
  if (nexusActualOnField && nexusActualOnField > 0 && nowMs - nexusActualOnField > NEXUS_BUFFER_MS) return true;

  // Signal 1: TBA actual time
  if (match?.actualTime) return true;

  // Signal 2: other people's submissions for this match exist and are >5 min old
  const SUBMISSION_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
  if (matchSubmissions.length > 0) {
    const oldest = Math.min(
      ...matchSubmissions.map((s) => new Date(s.submittedAt).getTime()),
    );
    if (oldest > 0 && nowMs - oldest > SUBMISSION_BUFFER_MS) return true;
  }

  // Signal 3: scheduled/predicted time was >1 hour ago
  if (match) {
    const SCHEDULE_BUFFER_MS = 60 * 60 * 1000; // 1 hour
    const bestTime = (match.predictedTime ?? match.scheduledTime ?? 0) * 1000;
    if (bestTime > 0 && nowMs - bestTime > SCHEDULE_BUFFER_MS) return true;
  }

  return false;
}

/**
 * Find the next uncovered assignment for a scouter.
 * Skips matches that have already been played (based on Nexus, TBA,
 * and other scouters' submissions).
 * Prefers matching by userId (auth UUID), falls back to name matching.
 */
export function nextAssignmentForScouter(
  assignments: ScoutAssignment[],
  submissions: MatchSubmission[],
  userId: string | null,
  scouterName: string,
  schedule?: EventSchedule | null,
  nexus?: NexusLiveState | null,
) {
  const missing = missingAssignments(assignments, submissions);
  const nowMs = Date.now();

  // Build lookups for timing and submission data
  const matchByNumber = new Map<number, ScheduledMatch>();
  if (schedule) {
    for (const m of schedule.matches) matchByNumber.set(m.matchNumber, m);
  }

  // Group submissions by match number for the submission-based signal
  const submissionsByMatch = new Map<number, MatchSubmission[]>();
  for (const s of submissions) {
    const mn = Number(s.matchNumber);
    if (!submissionsByMatch.has(mn)) submissionsByMatch.set(mn, []);
    submissionsByMatch.get(mn)!.push(s);
  }

  // Filter out matches that have already been played
  const upcoming = missing.filter(
    (a) => !isMatchPlayed(
      matchByNumber.get(a.matchNumber),
      submissionsByMatch.get(a.matchNumber) ?? [],
      nowMs,
      nexus?.matchStatus.get(a.matchNumber)?.times.actualOnFieldTime,
    ),
  );

  // Prefer userId match (reliable)
  if (userId) {
    const byUserId = upcoming.find((a) => a.userId === userId);
    if (byUserId) return byUserId;
  }

  // Fallback to name match (legacy assignments without userId)
  const normalizedName = scouterName.trim().toLowerCase();
  if (!normalizedName) return null;
  return (
    upcoming
      .filter((assignment) => assignment.scouterName.trim().toLowerCase() === normalizedName)
      [0] ?? null
  );
}

// ── Shift-Based Generation ──────────────────────────────────

const SHIFT_NAMES = [
  "Shift 1", "Shift 2", "Shift 3", "Shift 4",
  "Shift 5", "Shift 6", "Shift 7", "Shift 8",
  "Shift 9", "Shift 10", "Shift 11", "Shift 12",
];

/**
 * Auto-generate balanced shifts for an event.
 * Students get ~2× the load of parents.
 */
export function autoGenerateShifts(
  schedule: EventSchedule,
  members: TeamMember[],
  options: {
    matchesPerShift?: number;
    studentWeight?: number;
    minBreakGapMs?: number;
    namePrefix?: string;
  } = {},
): ScoutShift[] {
  const { matchesPerShift = 10, studentWeight = 2.0, minBreakGapMs, namePrefix } = options;
  const qualMatches = schedule.matches
    .filter((m) => m.compLevel === "qm")
    .sort((a, b) => a.matchNumber - b.matchNumber);

  if (qualMatches.length === 0 || members.length === 0) return [];

  // Build shift boundaries inside day/break segments only.
  const shiftBounds: { start: number; end: number }[] = [];
  const segments = splitMatchesIntoSegments(qualMatches, minBreakGapMs);
  for (const segment of segments) {
    for (let i = 0; i < segment.matches.length; i += matchesPerShift) {
      const chunk = segment.matches.slice(i, i + matchesPerShift);
      if (chunk.length === 0) continue;
      shiftBounds.push({
        start: chunk[0].matchNumber,
        end: chunk[chunk.length - 1].matchNumber,
      });
    }
  }

  // Track assignments per person
  const assignmentCount = new Map<string, number>();
  for (const m of members) assignmentCount.set(m.id, 0);

  const createdAt = new Date().toISOString();
  const shifts: ScoutShift[] = [];

  for (let i = 0; i < shiftBounds.length; i++) {
    const { start, end } = shiftBounds[i];

    // Score each person: lower = should be picked
    // effectiveLoad = count / weight, so students can accumulate more before being "full"
    const scored = members
      .map((m) => {
        const count = assignmentCount.get(m.id) ?? 0;
        const weight = m.group === "student" ? studentWeight : 1.0;
        const effectiveLoad = count / weight;

        // Penalty for being in the immediately previous shift (encourage breaks)
        const prevShift = shifts[shifts.length - 1];
        const inPrevious = prevShift?.roster.some((s) => s.userId === m.id) ? 0.5 : 0;

        return { member: m, score: effectiveLoad + inPrevious };
      })
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        // Tie-break: prefer students
        const aStudent = a.member.group === "student" ? 0 : 1;
        const bStudent = b.member.group === "student" ? 0 : 1;
        if (aStudent !== bStudent) return aStudent - bStudent;
        return a.member.display_name.localeCompare(b.member.display_name);
      });

    // Pick top 6 (or fewer if not enough people)
    const picked = scored.slice(0, Math.min(6, scored.length));

    const roster: ShiftSlot[] = picked.map((p, idx) => {
      assignmentCount.set(p.member.id, (assignmentCount.get(p.member.id) ?? 0) + (end - start + 1));
      return {
        station: STATIONS[idx],
        userId: p.member.id,
        displayName: p.member.display_name,
        subs: [],
      };
    });

    shifts.push({
      id: createId("shift"),
      eventKey: schedule.eventKey,
      name: namePrefix
        ? `${namePrefix} ${SHIFT_NAMES[i] ?? `Shift ${i + 1}`}`
        : SHIFT_NAMES[i] ?? `Shift ${i + 1}`,
      startMatch: start,
      endMatch: end,
      roster,
      createdAt,
    });
  }

  return shifts;
}

/**
 * Generate ScoutAssignments from shifts (with sub override support).
 */
export function generateAssignmentsFromShifts(
  shifts: ScoutShift[],
  schedule: EventSchedule,
): ScoutAssignment[] {
  const qualMatches = schedule.matches.filter((m) => m.compLevel === "qm");
  const matchByNumber = new Map(qualMatches.map((m) => [m.matchNumber, m]));
  const assignments: ScoutAssignment[] = [];
  const createdAt = new Date().toISOString();

  for (const shift of shifts) {
    for (let mn = shift.startMatch; mn <= shift.endMatch; mn++) {
      const match = matchByNumber.get(mn);
      if (!match) continue;

      for (const slot of shift.roster) {
        // Check for active sub override
        const activeSub = slot.subs.find(
          (sub) => mn >= sub.startMatch && mn <= sub.endMatch,
        );

        const scoutUserId = activeSub?.userId ?? slot.userId;
        const scoutName = activeSub?.displayName ?? slot.displayName;

        const robot = match.robots.find((r) => r.station === slot.station);
        if (!robot) continue;

        assignments.push({
          id: createId("assignment"),
          eventKey: schedule.eventKey,
          matchId: match.id,
          matchNumber: match.matchNumber,
          label: match.label,
          teamNumber: robot.teamNumber,
          alliance: robot.alliance,
          station: slot.station,
          scouterId: scoutUserId,
          scouterName: scoutName,
          userId: scoutUserId,
          createdAt,
        });
      }
    }
  }

  return assignments;
}

/** Calculate per-person workload from shifts. */
export function calculateWorkload(
  shifts: ScoutShift[],
): Map<string, { matches: number; shiftCount: number }> {
  const workload = new Map<string, { matches: number; shiftCount: number }>();

  function add(userId: string, matches: number, isShiftPrimary: boolean) {
    const existing = workload.get(userId) ?? { matches: 0, shiftCount: 0 };
    existing.matches += matches;
    if (isShiftPrimary) existing.shiftCount += 1;
    workload.set(userId, existing);
  }

  for (const shift of shifts) {
    const shiftLen = shift.endMatch - shift.startMatch + 1;
    for (const slot of shift.roster) {
      const subbedOut = slot.subs.reduce(
        (total, sub) => total + (sub.endMatch - sub.startMatch + 1), 0,
      );
      add(slot.userId, shiftLen - subbedOut, true);
      for (const sub of slot.subs) {
        add(sub.userId, sub.endMatch - sub.startMatch + 1, false);
      }
    }
  }

  return workload;
}
