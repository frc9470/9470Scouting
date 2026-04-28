import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheckCircle, IconChevronRight } from "../icons";
import { formatEta, getMatchEtaMs, type NexusLiveState } from "../nexus";
import { findLargeBreaks, type MatchDayGroup } from "../scheduleDays";
import type {
  MatchSubmission,
  ScoutAssignment,
  ScoutShift,
  ScheduledMatch,
  ScheduledRobot,
} from "../types";

type MatchState = "passed" | "current" | "upcoming";

interface MatchSelectionListProps {
  eventKey: string;
  eventLabel: string;
  dayGroups: MatchDayGroup[];
  matches: ScheduledMatch[];
  assignments: ScoutAssignment[];
  shifts: ScoutShift[];
  submissions: MatchSubmission[];
  userId: string | null;
  scouterName: string;
  nexusState: NexusLiveState | null;
  onScoutRobot: (match: ScheduledMatch, robot: ScheduledRobot) => void;
}

function assignmentKey(matchNumber: number | string, teamNumber: string) {
  return `${String(matchNumber).trim()}::${teamNumber.trim()}`;
}

function isSameScouter(submission: MatchSubmission, scouterName: string) {
  return (
    scouterName.trim() !== "" &&
    submission.scouterName.trim().toLowerCase() === scouterName.trim().toLowerCase()
  );
}

function bestMatchTimeMs(match: ScheduledMatch, nexusState: NexusLiveState | null) {
  const nexusStart = nexusState?.matchStatus.get(match.matchNumber)?.times.estimatedStartTime;
  if (nexusStart) return nexusStart;
  const tbaTime = match.predictedTime ?? match.scheduledTime;
  return tbaTime ? tbaTime * 1000 : null;
}

function matchState(
  match: ScheduledMatch,
  submissions: MatchSubmission[],
  nexusState: NexusLiveState | null,
  nowMs: number,
): MatchState {
  const nexusInfo = nexusState?.matchStatus.get(match.matchNumber);
  const actualOnField = nexusInfo?.times.actualOnFieldTime;
  if (actualOnField && nowMs - actualOnField > 5 * 60_000) return "passed";
  if (match.actualTime) return "passed";
  if (nexusState?.nowQueuingNumber && match.matchNumber < nexusState.nowQueuingNumber - 1) return "passed";

  const oldestSubmission = submissions.length
    ? Math.min(...submissions.map((s) => new Date(s.submittedAt).getTime()).filter(Number.isFinite))
    : 0;
  if (oldestSubmission && nowMs - oldestSubmission > 5 * 60_000) return "passed";

  const scheduledMs = bestMatchTimeMs(match, nexusState);
  if (scheduledMs && nowMs >= scheduledMs && nowMs - scheduledMs <= 8 * 60_000) return "current";
  if (scheduledMs && nowMs - scheduledMs > 60 * 60_000) return "passed";

  const status = nexusInfo?.status?.toLowerCase() ?? "";
  if (
    nexusState?.nowQueuingNumber === match.matchNumber ||
    status.includes("on field") ||
    status.includes("on deck") ||
    status.includes("queuing")
  ) {
    return "current";
  }

  return "upcoming";
}

function shiftUserForMatch(shift: ScoutShift, matchNumber: number, userId: string | null) {
  if (!userId || matchNumber < shift.startMatch || matchNumber > shift.endMatch) return false;

  return shift.roster.some((slot) => {
    const activeSub = slot.subs.find((sub) => matchNumber >= sub.startMatch && matchNumber <= sub.endMatch);
    if (activeSub) return activeSub.userId === userId;
    return slot.userId === userId;
  });
}

function shiftTimerLabel(shift: ScoutShift, matchesByNumber: Map<number, ScheduledMatch>, nexusState: NexusLiveState | null) {
  const nowMs = Date.now();
  const startMatch = matchesByNumber.get(shift.startMatch);
  const endMatch = matchesByNumber.get(shift.endMatch);
  const startMs = startMatch ? bestMatchTimeMs(startMatch, nexusState) : null;
  const endMs = endMatch ? bestMatchTimeMs(endMatch, nexusState) : null;

  if (startMs && startMs > nowMs) return `Starts in ${formatEta(startMs - nowMs)}`;
  if (endMs && endMs > nowMs) return `Ends in ${formatEta(endMs - nowMs)}`;
  return null;
}

function teamGroups(match: ScheduledMatch) {
  const red = match.robots.filter((robot) => robot.alliance === "red").map((robot) => robot.teamNumber);
  const blue = match.robots.filter((robot) => robot.alliance === "blue").map((robot) => robot.teamNumber);
  return { red, blue };
}

export function MatchSelectionList({
  eventKey,
  eventLabel,
  dayGroups,
  matches,
  assignments,
  shifts,
  submissions,
  userId,
  scouterName,
  nexusState,
  onScoutRobot,
}: MatchSelectionListProps) {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const didAutoScroll = useRef(false);
  const nowMs = Date.now();

  const eventAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.eventKey === eventKey),
    [assignments, eventKey],
  );
  const eventShifts = useMemo(
    () => shifts.filter((shift) => shift.eventKey === eventKey),
    [eventKey, shifts],
  );
  const eventSubmissions = useMemo(
    () => submissions.filter((submission) => !submission.division || submission.division === eventKey),
    [eventKey, submissions],
  );

  const submissionsByMatch = useMemo(() => {
    const byMatch = new Map<number, MatchSubmission[]>();
    for (const submission of eventSubmissions) {
      const matchNumber = Number(submission.matchNumber);
      if (!Number.isFinite(matchNumber)) continue;
      const list = byMatch.get(matchNumber) ?? [];
      list.push(submission);
      byMatch.set(matchNumber, list);
    }
    return byMatch;
  }, [eventSubmissions]);

  const assignmentsByMatch = useMemo(() => {
    const byMatch = new Map<number, ScoutAssignment[]>();
    for (const assignment of eventAssignments) {
      const list = byMatch.get(assignment.matchNumber) ?? [];
      list.push(assignment);
      byMatch.set(assignment.matchNumber, list);
    }
    return byMatch;
  }, [eventAssignments]);

  const matchesByNumber = useMemo(
    () => new Map(matches.map((match) => [match.matchNumber, match])),
    [matches],
  );
  const dayByFirstMatch = useMemo(() => {
    const byMatch = new Map<number, MatchDayGroup>();
    for (const group of dayGroups) {
      const first = group.matches[0];
      if (first) byMatch.set(first.matchNumber, group);
    }
    return byMatch;
  }, [dayGroups]);
  const dayBreaks = useMemo(() => findLargeBreaks(matches), [matches]);
  const breakAfterMatches = useMemo(
    () => new Map(dayBreaks.map((dayBreak) => [dayBreak.afterMatchNumber, dayBreak])),
    [dayBreaks],
  );

  const userShiftStarts = useMemo(() => {
    const byStart = new Map<number, ScoutShift[]>();
    const visibleMatchNumbers = matches.map((match) => match.matchNumber);
    const visibleMatchNumberSet = new Set(visibleMatchNumbers);
    for (const shift of eventShifts) {
      if (!shift.roster.some((slot) => slot.userId === userId || slot.subs.some((sub) => sub.userId === userId))) {
        continue;
      }
      const visibleStart = visibleMatchNumbers.find(
        (matchNumber) => matchNumber >= shift.startMatch && matchNumber <= shift.endMatch,
      );
      if (!visibleStart || !visibleMatchNumberSet.has(visibleStart)) continue;
      const list = byStart.get(visibleStart) ?? [];
      list.push(shift);
      byStart.set(visibleStart, list);
    }
    return byStart;
  }, [eventShifts, matches, userId]);

  const firstActionableId = useMemo(() => {
    const assignedUpcoming = matches.find((match) => {
      const matchSubmissions = submissionsByMatch.get(match.matchNumber) ?? [];
      const state = matchState(match, matchSubmissions, nexusState, nowMs);
      const myAssignment = (assignmentsByMatch.get(match.matchNumber) ?? []).find(
        (assignment) =>
          (userId && assignment.userId === userId) ||
          assignment.scouterName.trim().toLowerCase() === scouterName.trim().toLowerCase(),
      );
      if (!myAssignment || state === "passed") return false;
      return !matchSubmissions.some(
        (submission) =>
          isSameScouter(submission, scouterName) &&
          assignmentKey(submission.matchNumber, submission.teamNumber) ===
            assignmentKey(myAssignment.matchNumber, myAssignment.teamNumber),
      );
    });
    if (assignedUpcoming) return assignedUpcoming.id;

    const currentOrUpcoming = matches.find((match) => {
      const state = matchState(match, submissionsByMatch.get(match.matchNumber) ?? [], nexusState, nowMs);
      return state !== "passed";
    });
    return currentOrUpcoming?.id ?? matches.at(-1)?.id ?? null;
  }, [assignmentsByMatch, matches, nexusState, nowMs, scouterName, submissionsByMatch, userId]);

  useEffect(() => {
    if (didAutoScroll.current || !firstActionableId) return;
    const target = cardRefs.current.get(firstActionableId);
    if (!target) return;
    didAutoScroll.current = true;
    window.setTimeout(() => target.scrollIntoView({ block: "start" }), 80);
  }, [firstActionableId]);

  return (
    <section className="match-selection">
      <div className="match-selection-head">
        <div>
          <h1>{eventLabel}</h1>
          <p className="muted small">
            {matches.length} qualification matches cached across {Math.max(1, dayGroups.length)} day{dayGroups.length === 1 ? "" : "s"}
          </p>
        </div>
        {nexusState?.available && nexusState.nowQueuingNumber && (
          <span className="match-live-pill">Live Q{nexusState.nowQueuingNumber}</span>
        )}
      </div>

      <div className="match-list">
        {matches.map((match) => {
          const matchSubmissions = submissionsByMatch.get(match.matchNumber) ?? [];
          const state = matchState(match, matchSubmissions, nexusState, nowMs);
          const matchAssignments = assignmentsByMatch.get(match.matchNumber) ?? [];
          const myAssignment = matchAssignments.find(
            (assignment) =>
              (userId && assignment.userId === userId) ||
              assignment.scouterName.trim().toLowerCase() === scouterName.trim().toLowerCase(),
          );
          const submittedByMe = matchSubmissions.filter((submission) => isSameScouter(submission, scouterName));
          const myAssignedSubmission = myAssignment
            ? submittedByMe.find(
                (submission) =>
                  assignmentKey(submission.matchNumber, submission.teamNumber) ===
                  assignmentKey(myAssignment.matchNumber, myAssignment.teamNumber),
              )
            : null;
          const anyMinePending = submittedByMe.some((submission) => submission.syncStatus === "pending");
          const anyMineFailed = submittedByMe.some((submission) => submission.syncStatus === "failed");
          const missed = Boolean(myAssignment && state === "passed" && !myAssignedSubmission);
          const inMyShift = eventShifts.some((shift) => shiftUserForMatch(shift, match.matchNumber, userId));
          const eta = nexusState?.available ? getMatchEtaMs(nexusState, match.matchNumber) : null;
          const expanded = expandedMatchId === match.id;
          const shiftDividers = userShiftStarts.get(match.matchNumber) ?? [];
          const teams = teamGroups(match);

          return (
            <div key={match.id}>
              {dayByFirstMatch.has(match.matchNumber) && (
                <div className="match-day-divider">
                  <strong>{dayByFirstMatch.get(match.matchNumber)!.label}</strong>
                  <span>{dayByFirstMatch.get(match.matchNumber)!.dateLabel}</span>
                </div>
              )}

              {shiftDividers.map((shift) => {
                const timingLabel = shiftTimerLabel(shift, matchesByNumber, nexusState);
                return (
                  <div className="shift-divider" key={shift.id}>
                    <div>
                      <strong>{shift.name}</strong>
                      <span>Q{shift.startMatch}-Q{shift.endMatch}</span>
                    </div>
                    {timingLabel && <em>{timingLabel}</em>}
                  </div>
                );
              })}

              <article
                ref={(node) => {
                  if (node) cardRefs.current.set(match.id, node);
                  else cardRefs.current.delete(match.id);
                }}
                className={[
                  "match-card",
                  state,
                  inMyShift ? "in-my-shift" : "",
                  myAssignment ? "assigned" : "",
                  myAssignedSubmission || submittedByMe.length > 0 ? "submitted" : "",
                  missed ? "missed" : "",
                  expanded ? "expanded" : "",
                ].join(" ")}
              >
                <button
                  className="match-card-main"
                  onClick={() => setExpandedMatchId(expanded ? null : match.id)}
                >
                  <div className="match-card-top">
                    <div>
                      <strong>{match.label}</strong>
                      <span className="match-teams">
                        <span className="match-teams-red">{teams.red.join(" ")}</span>
                        <span className="match-teams-divider">•</span>
                        <span className="match-teams-blue">{teams.blue.join(" ")}</span>
                      </span>
                    </div>
                    <IconChevronRight size={18} />
                  </div>

                  <div className="match-card-meta">
                    {myAssignment && (
                      <span className={`match-chip-status assigned-${myAssignment.alliance}`}>
                        You scout {myAssignment.teamNumber} · {myAssignment.station.toUpperCase()}
                      </span>
                    )}
                    {myAssignedSubmission && (
                      <span className="match-chip-status done">
                        <IconCheckCircle size={13} /> Submitted
                      </span>
                    )}
                    {!myAssignedSubmission && submittedByMe.length > 0 && (
                      <span className="match-chip-status done">
                        <IconCheckCircle size={13} /> Fill-in submitted
                      </span>
                    )}
                    {anyMinePending && <span className="match-chip-status queued">Queued</span>}
                    {anyMineFailed && <span className="match-chip-status missed">Retrying</span>}
                    {missed && <span className="match-chip-status missed">Missed</span>}
                    {state === "current" && <span className="match-chip-status live">Now</span>}
                    {eta && <span className="match-chip-status">{formatEta(eta)}</span>}
                  </div>
                </button>

                {expanded && (
                  <div className="match-robot-picker">
                    {myAssignment && (
                      <button
                        className={`match-assigned-start ${myAssignment.alliance}`}
                        onClick={() => {
                          const robot = match.robots.find((r) => r.teamNumber === myAssignment.teamNumber);
                          if (robot) onScoutRobot(match, robot);
                        }}
                      >
                        Scout assigned team {myAssignment.teamNumber}
                      </button>
                    )}
                    <div className="robot-grid">
                      {match.robots.map((robot) => (
                        <button
                          key={`${match.id}-${robot.station}`}
                          className={`robot-pick ${robot.alliance}`}
                          onClick={() => onScoutRobot(match, robot)}
                        >
                          <span>{robot.station.toUpperCase()}</span>
                          <strong>{robot.teamNumber}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </article>

              {breakAfterMatches.has(match.matchNumber) && (
                <div className="match-break-divider">
                  <span>Break</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
