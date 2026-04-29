import type { EventSchedule, ScheduledMatch, ScheduledRobot, ScheduleAlliance } from "./types";

interface TbaAlliance {
  team_keys?: string[];
}

interface TbaMatchSimple {
  key: string;
  event_key: string;
  comp_level: string;
  set_number: number;
  match_number: number;
  time?: number | null;
  predicted_time?: number | null;
  actual_time?: number | null;
  alliances?: Partial<Record<ScheduleAlliance, TbaAlliance>>;
}

interface TbaEventSimple {
  name?: string;
  short_name?: string;
}

export function normalizeEventKey(eventKey: string) {
  return eventKey.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function teamNumber(teamKey: string) {
  return teamKey.replace(/^frc/i, "");
}

function labelFor(match: TbaMatchSimple) {
  if (match.comp_level === "qm") return `Q${match.match_number}`;
  return `${match.comp_level.toUpperCase()} ${match.set_number}-${match.match_number}`;
}

function robotsFor(match: TbaMatchSimple): ScheduledRobot[] {
  return (["red", "blue"] as const).flatMap((alliance) =>
    (match.alliances?.[alliance]?.team_keys ?? []).map((teamKey, index) => ({
      teamNumber: teamNumber(teamKey),
      alliance,
      station: `${alliance}${index + 1}` as ScheduledRobot["station"],
    })),
  );
}

function sortMatches(a: ScheduledMatch, b: ScheduledMatch) {
  if (a.compLevel !== b.compLevel) {
    if (a.compLevel === "qm") return -1;
    if (b.compLevel === "qm") return 1;
    return a.compLevel.localeCompare(b.compLevel);
  }
  return a.setNumber - b.setNumber || a.matchNumber - b.matchNumber;
}

export async function fetchTbaEventSchedule(eventKeyInput: string): Promise<EventSchedule> {
  const eventKey = normalizeEventKey(eventKeyInput);
  if (!eventKey) throw new Error("Enter a TBA event key.");

  const [response, eventResponse] = await Promise.all([
    fetch(`/api/tba/event/${encodeURIComponent(eventKey)}/matches/simple`),
    fetch(`/api/tba/event/${encodeURIComponent(eventKey)}/simple`),
  ]);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `TBA request failed with ${response.status}.`);
  }

  const tbaEvent = eventResponse.ok ? ((await eventResponse.json()) as TbaEventSimple) : null;
  const tbaMatches = (await response.json()) as TbaMatchSimple[];
  const matches = tbaMatches
    .map<ScheduledMatch>((match) => ({
      id: match.key,
      eventKey: match.event_key || eventKey,
      compLevel: match.comp_level,
      setNumber: match.set_number,
      matchNumber: match.match_number,
      label: labelFor(match),
      scheduledTime: match.time ?? null,
      predictedTime: match.predicted_time ?? null,
      actualTime: match.actual_time ?? null,
      robots: robotsFor(match),
    }))
    .sort(sortMatches);

  return {
    eventKey,
    eventName: tbaEvent?.short_name || tbaEvent?.name,
    fetchedAt: new Date().toISOString(),
    matchCount: matches.length,
    matches,
  };
}
