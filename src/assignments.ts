import { createId } from "./domain";
import type { EventSchedule, MatchSubmission, ScoutAssignment, ScouterProfile } from "./types";

const stationOrder = ["red1", "red2", "red3", "blue1", "blue2", "blue3"];

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

export function generateScoutAssignments(
  schedule: EventSchedule,
  scouters: ScouterProfile[],
): ScoutAssignment[] {
  const activeScouters = scouters.filter((scouter) => scouter.active && scouter.name.trim());
  if (activeScouters.length === 0) return [];

  const createdAt = new Date().toISOString();
  return schedule.matches
    .filter((match) => match.compLevel === "qm")
    .flatMap((match, matchIndex) =>
      match.robots.map((robot, robotIndex) => {
        const scouter = activeScouters[(matchIndex * 6 + robotIndex) % activeScouters.length];
        return {
          id: createId("assignment"),
          eventKey: schedule.eventKey,
          matchId: match.id,
          matchNumber: match.matchNumber,
          label: match.label,
          teamNumber: robot.teamNumber,
          alliance: robot.alliance,
          station: robot.station,
          scouterId: scouter.id,
          scouterName: scouter.name,
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

export function nextAssignmentForScouter(
  assignments: ScoutAssignment[],
  submissions: MatchSubmission[],
  scouterName: string,
) {
  const normalizedName = scouterName.trim().toLowerCase();
  if (!normalizedName) return null;
  return (
    missingAssignments(assignments, submissions)
      .filter((assignment) => assignment.scouterName.trim().toLowerCase() === normalizedName)
      [0] ?? null
  );
}
