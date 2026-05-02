import type {
  ActionInterval,
  MatchDraft,
  MatchSubmission,
  TeamAggregate,
} from "./types";

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function getDeviceId() {
  const key = "team9470.deviceId";
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = createId("device");
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

export function createEmptyDraft(): MatchDraft {
  const now = new Date().toISOString();
  return {
    id: createId("draft"),
    deviceId: getDeviceId(),
    createdAt: now,
    updatedAt: now,
    currentStep: "select",
    elapsedMs: 0,
    liveStartedAtUnixMs: null,
    scouterName: localStorage.getItem("team9470.scouterName") ?? "",
    division: "",
    matchNumber: "",
    teamNumber: "",
    alliance: "red",
    station: "",
    practiceMode: false,
    preMatch: {
      startingPose: "",
      robotStatus: "present",
    },
    actionIntervals: [],
    eventMarks: [],
    incap: {
      occurred: false,
      startMs: null,
      endMs: null,
      severity: "",
      observableStatus: "",
      recovered: false,
    },
    postMatch: {
      autoAttempted: "unknown",
      autoSuccessful: "unknown",
      eightPreloadObserved: "unknown",
      depotObserved: "unknown",
      bumpObserved: "unknown",
      trenchObserved: "unknown",
      bpsEstimate: "unknown",
      driverSkill: "",
      defenseEffectiveness: "not_observed",
      canSteal: "not_observed",
      notableReasons: [],
      note: "",
    },
  };
}

export function summarizeIntervals(intervals: ActionInterval[], currentMs = 0) {
  const summary = {
    drivingMs: 0,
    intakingMs: 0,
    scoringMs: 0,
    defenseMs: 0,
    feedingMs: 0,
    blockedMs: 0,
    beachedMs: 0,
    missingMs: 0,
  };

  for (const interval of intervals) {
    const endMs = interval.endMs ?? currentMs;
    const duration = Math.max(0, endMs - interval.startMs);
    if (interval.action === "intaking") summary.intakingMs += duration;
    if (interval.action === "scoring") summary.scoringMs += duration;
    if (interval.action === "defense") summary.defenseMs += duration;
    if (interval.action === "feeding") summary.feedingMs += duration;
    if (interval.action === "blocked") summary.blockedMs += duration;
    if (interval.action === "beached") summary.beachedMs += duration;
    if (interval.action === "missing") summary.missingMs += duration;
  }

  const explicitMs =
    summary.intakingMs +
    summary.scoringMs +
    summary.defenseMs +
    summary.feedingMs +
    summary.blockedMs +
    summary.beachedMs +
    summary.missingMs;
  summary.drivingMs = Math.max(0, currentMs - explicitMs);

  return summary;
}

export function formatMatchTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function missingRequiredFields(draft: MatchDraft) {
  const missing: string[] = [];
  if (!draft.matchNumber) missing.push("match number");
  if (!draft.teamNumber) missing.push("team number");
  if (!draft.preMatch.startingPose) missing.push("starting pose");
  if (!draft.postMatch.driverSkill) missing.push("driver skill");
  if (
    draft.eventMarks.some((mark) => mark.type === "notable") &&
    draft.postMatch.notableReasons.length === 0
  ) {
    missing.push("notable reason");
  }
  if (draft.incap.occurred && (!draft.incap.severity || !draft.incap.observableStatus)) {
    missing.push("incap severity/status");
  }
  return missing;
}

export function latestSubmissions(submissions: MatchSubmission[]) {
  const byOriginal = new Map<string, MatchSubmission>();

  for (const submission of submissions) {
    const key = submission.originalSubmissionId || submission.id;
    const previous = byOriginal.get(key);
    if (!previous || submission.versionNumber > previous.versionNumber) {
      byOriginal.set(key, submission);
    }
  }

  return [...byOriginal.values()].filter((submission) => !submission.deleted);
}

export function aggregateTeams(submissions: MatchSubmission[]): TeamAggregate[] {
  const teams = new Map<string, Omit<TeamAggregate, "defenseAvg" | "driverAvg"> & {
    defenseRatings: number[];
    driverRatings: number[];
  }>();

  for (const submission of submissions) {
    const teamNumber = String(submission.teamNumber || "unknown");
    if (!teams.has(teamNumber)) {
      teams.set(teamNumber, {
        teamNumber,
        submissions: [],
        matches: 0,
        totalObservedMs: 0,
        drivingMs: 0,
        intakingMs: 0,
        scoringMs: 0,
        incapCount: 0,
        defenseMs: 0,
        feedingMs: 0,
        blockedMs: 0,
        beachedMs: 0,
        missingMs: 0,
        defenseRatings: [],
        driverRatings: [],
        feedCount: 0,
        stealMax: "not_observed",
        autoAttempts: 0,
        autoSuccess: 0,
        notableCount: 0,
        foulConcernCount: 0,
      });
    }

    const team = teams.get(teamNumber)!;
    const observedMs = observedMatchMs(submission);
    const summary = summarizeIntervals(submission.actionIntervals, observedMs);
    team.submissions.push(submission);
    team.matches += 1;
    team.totalObservedMs += observedMs;
    team.drivingMs += summary.drivingMs;
    team.intakingMs += summary.intakingMs;
    team.scoringMs += summary.scoringMs;
    team.defenseMs += summary.defenseMs;
    team.feedingMs += summary.feedingMs;
    team.blockedMs += summary.blockedMs;
    team.beachedMs += summary.beachedMs;
    team.missingMs += summary.missingMs;
    if (submission.incap.occurred) team.incapCount += 1;
    if (submission.eventMarks.some((mark) => mark.type === "notable")) team.notableCount += 1;
    if (submission.eventMarks.some((mark) => mark.type === "foul_concern")) {
      team.foulConcernCount += 1;
    }
    if (submission.postMatch.autoAttempted === "yes") team.autoAttempts += 1;
    if (submission.postMatch.autoSuccessful === "yes") team.autoSuccess += 1;
    if (summary.feedingMs > 0) team.feedCount += 1;
    team.stealMax = maxSteal(team.stealMax, submission.postMatch.canSteal);

    const defense = Number(submission.postMatch.defenseEffectiveness);
    if (Number.isFinite(defense)) team.defenseRatings.push(defense);
    const driver = Number(submission.postMatch.driverSkill);
    if (Number.isFinite(driver)) team.driverRatings.push(driver);
  }

  return [...teams.values()]
    .map(({ defenseRatings, driverRatings, ...team }) => ({
      ...team,
      defenseAvg: average(defenseRatings),
      driverAvg: average(driverRatings),
    }))
    .sort((a, b) => Number(a.teamNumber) - Number(b.teamNumber));
}

export function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatAverage(value: number | null) {
  return value == null ? "-" : value.toFixed(1);
}

function maxSteal(
  current: TeamAggregate["stealMax"],
  next: MatchSubmission["postMatch"]["canSteal"],
) {
  const order = { not_observed: 0, none: 0, partial: 1, full: 2 };
  return order[next] > order[current] ? next : current;
}

function observedMatchMs(submission: MatchSubmission) {
  const intervalEndMs = submission.actionIntervals.reduce(
    (latest, interval) => Math.max(latest, interval.endMs ?? interval.startMs),
    0,
  );
  return Math.max(submission.elapsedMs, intervalEndMs);
}
