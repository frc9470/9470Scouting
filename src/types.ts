export type Alliance = "red" | "blue" | "unknown";
export type MatchStep = "select" | "prematch" | "waiting" | "live" | "postmatch" | "complete";
export type View = "scout" | "lead" | "dashboard" | "data";
export type ScheduleAlliance = Exclude<Alliance, "unknown">;
export type SyncIndicator = "idle" | "syncing" | "synced" | "pending" | "error";
export type MemberGroup = "student" | "parent";
export type ScoutingStatus = "active" | "spectator";
export type StationType = "red1" | "red2" | "red3" | "blue1" | "blue2" | "blue3";

export type ActionKey =
  | "driving"
  | "intaking"
  | "scoring"
  | "feeding"
  | "defense"
  | "blocked"
  | "beached"
  | "missing";

export type EventMarkType = "notable" | "foul_concern" | "incap";

export interface ActionInterval {
  id: string;
  action: ActionKey;
  startMs: number;
  endMs: number | null;
}

export interface EventMark {
  id: string;
  type: EventMarkType;
  matchMs: number;
  createdAt: string;
}

export interface IncapRecord {
  occurred: boolean;
  startMs: number | null;
  endMs: number | null;
  severity: "" | "partial" | "full" | "unknown";
  observableStatus:
    | ""
    | "rsl_off"
    | "rsl_on"
    | "rsl_unknown"
    | "tipped"
    | "stuck"
    | "jammed"
    | "mechanism"
    | "unknown";
  recovered: boolean;
}

export interface MatchDraft {
  id: string;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
  currentStep: MatchStep;
  elapsedMs: number;
  liveStartedAtUnixMs: number | null;
  scouterName: string;
  division: string;
  matchNumber: string;
  teamNumber: string;
  alliance: Alliance;
  station: string;
  practiceMode: boolean;
  preMatch: {
    startingPose: string;
    robotStatus: "present" | "not_present" | "problem_visible" | "unknown";
  };
  actionIntervals: ActionInterval[];
  eventMarks: EventMark[];
  incap: IncapRecord;
  postMatch: {
    autoAttempted: "yes" | "no" | "unknown";
    autoSuccessful: "yes" | "partial" | "no" | "unknown";
    eightPreloadObserved: "yes" | "no" | "unknown";
    depotObserved: "yes" | "no" | "unknown";
    bumpObserved: "yes" | "no" | "unknown";
    trenchObserved: "yes" | "no" | "unknown";
    bpsEstimate: "<5" | "10" | "20" | "25+" | "unknown";
    driverSkill: "" | "1" | "2" | "3" | "4" | "5";
    defenseEffectiveness: "" | "1" | "2" | "3" | "4" | "5" | "not_observed";
    canSteal: "none" | "partial" | "full" | "not_observed";
    notableReasons: string[];
    note: string;
  };
}

export interface MatchSubmission extends MatchDraft {
  originalSubmissionId: string | null;
  versionId: string;
  versionNumber: number;
  submittedAt: string;
  syncStatus: "pending" | "synced" | "failed";
  deleted?: boolean;
}

export interface SyncQueueItem {
  id: string;
  recordType: "match_submission" | "pit_submission";
  recordId: string;
  status: "pending" | "synced" | "failed";
  createdAt: string;
  lastAttemptAt?: string;
  error?: string;
}

export interface ScheduledRobot {
  teamNumber: string;
  alliance: ScheduleAlliance;
  station: "red1" | "red2" | "red3" | "blue1" | "blue2" | "blue3";
}

export interface ScheduledMatch {
  id: string;
  eventKey: string;
  compLevel: string;
  setNumber: number;
  matchNumber: number;
  label: string;
  scheduledTime: number | null;
  predictedTime: number | null;
  actualTime: number | null;
  robots: ScheduledRobot[];
}

export interface EventSchedule {
  eventKey: string;
  eventName?: string;
  fetchedAt: string;
  matchCount: number;
  matches: ScheduledMatch[];
}

export interface ScouterProfile {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface ScoutAssignment {
  id: string;
  eventKey: string;
  matchId: string;
  matchNumber: number;
  label: string;
  teamNumber: string;
  alliance: ScheduleAlliance;
  station: ScheduledRobot["station"];
  scouterId: string;
  scouterName: string;
  userId: string | null;
  createdAt: string;
}

/** Supabase profile row — mirrors public.profiles columns. */
export interface TeamMember {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  role: "scouter" | "lead" | "admin";
  group: MemberGroup | null;
  availability: string[] | null;
  scouting_status: ScoutingStatus;
}

// ── Shift Model ─────────────────────────────────────────────

export interface SubOverride {
  id: string;
  startMatch: number;
  endMatch: number;
  userId: string;
  displayName: string;
  reason: "break" | "pit" | "our_match" | "other" | "";
}

export interface ShiftSlot {
  station: StationType;
  userId: string;
  displayName: string;
  subs: SubOverride[];
}

export interface ScoutShift {
  id: string;
  eventKey: string;
  name: string;
  startMatch: number;
  endMatch: number;
  roster: ShiftSlot[];
  createdAt: string;
}

export interface ExportPayload {
  exportedAt: string;
  deviceId: string;
  matchSubmissions: MatchSubmission[];
  eventSchedules?: EventSchedule[];
  scouterProfiles?: ScouterProfile[];
  scoutAssignments?: ScoutAssignment[];
  scoutShifts?: ScoutShift[];
}

export interface TeamAggregate {
  teamNumber: string;
  submissions: MatchSubmission[];
  matches: number;
  incapCount: number;
  defenseMs: number;
  feedingMs: number;
  blockedMs: number;
  beachedMs: number;
  missingMs: number;
  defenseAvg: number | null;
  driverAvg: number | null;
  feedCount: number;
  stealMax: "none" | "partial" | "full" | "not_observed";
  autoAttempts: number;
  autoSuccess: number;
  notableCount: number;
  foulConcernCount: number;
}
