import type { ScheduledMatch } from "./types";

const LARGE_BREAK_MS = 30 * 60 * 1000;

export interface MatchDayGroup {
  id: string;
  label: string;
  dateLabel: string;
  matches: ScheduledMatch[];
}

export interface BreakAfterMatch {
  afterMatchNumber: number;
  beforeMatchNumber: number;
  gapMs: number;
}

export interface MatchSegment {
  id: string;
  dayLabel: string;
  startMatch: number;
  endMatch: number;
  matches: ScheduledMatch[];
}

function matchTimeMs(match: ScheduledMatch) {
  const seconds = match.predictedTime ?? match.scheduledTime ?? match.actualTime;
  return seconds ? seconds * 1000 : null;
}

function localDateKey(ms: number) {
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(ms: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(ms));
}

export function groupMatchesByDay(matches: ScheduledMatch[]): MatchDayGroup[] {
  const timed = matches
    .map((match, index) => ({ match, index, ms: matchTimeMs(match) }))
    .sort((a, b) => (a.ms ?? Number.MAX_SAFE_INTEGER) - (b.ms ?? Number.MAX_SAFE_INTEGER) || a.index - b.index);

  const groups: { key: string; firstMs: number | null; matches: ScheduledMatch[] }[] = [];
  for (const item of timed) {
    const key = item.ms ? localDateKey(item.ms) : "unscheduled";
    let group = groups.find((candidate) => candidate.key === key);
    if (!group) {
      group = { key, firstMs: item.ms, matches: [] };
      groups.push(group);
    }
    group.matches.push(item.match);
  }

  return groups.map((group, index) => ({
    id: group.key,
    label: `Day ${index + 1}`,
    dateLabel: group.firstMs ? formatDateLabel(group.firstMs) : "Unscheduled",
    matches: group.matches.sort((a, b) => a.matchNumber - b.matchNumber),
  }));
}

export function chooseDefaultDay(groups: MatchDayGroup[], nowMs = Date.now()) {
  if (groups.length === 0) return null;
  const todayKey = localDateKey(nowMs);
  const today = groups.find((group) => group.id === todayKey);
  if (today) return today.id;

  const next = groups.find((group) => {
    const first = group.matches[0] ? matchTimeMs(group.matches[0]) : null;
    return first != null && first >= nowMs;
  });
  return next?.id ?? groups[groups.length - 1].id;
}

export function findLargeBreaks(matches: ScheduledMatch[], minGapMs = LARGE_BREAK_MS): BreakAfterMatch[] {
  const sorted = [...matches].sort((a, b) => a.matchNumber - b.matchNumber);
  const breaks: BreakAfterMatch[] = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const currentMs = matchTimeMs(sorted[i]);
    const nextMs = matchTimeMs(sorted[i + 1]);
    if (!currentMs || !nextMs) continue;

    const gapMs = nextMs - currentMs;
    if (gapMs >= minGapMs) {
      breaks.push({
        afterMatchNumber: sorted[i].matchNumber,
        beforeMatchNumber: sorted[i + 1].matchNumber,
        gapMs,
      });
    }
  }

  return breaks;
}

export function splitMatchesIntoSegments(
  matches: ScheduledMatch[],
  minBreakGapMs = LARGE_BREAK_MS,
): MatchSegment[] {
  const days = groupMatchesByDay(matches);
  const segments: MatchSegment[] = [];

  for (const day of days) {
    let current: ScheduledMatch[] = [];

    for (let index = 0; index < day.matches.length; index += 1) {
      const match = day.matches[index];
      current.push(match);

      const next = day.matches[index + 1];
      const currentMs = matchTimeMs(match);
      const nextMs = next ? matchTimeMs(next) : null;
      const hasBreak = currentMs && nextMs ? nextMs - currentMs >= minBreakGapMs : false;
      const isEnd = !next || hasBreak;

      if (isEnd && current.length > 0) {
        const start = current[0].matchNumber;
        const end = current[current.length - 1].matchNumber;
        segments.push({
          id: `${day.id}:${start}-${end}`,
          dayLabel: day.label,
          startMatch: start,
          endMatch: end,
          matches: current,
        });
        current = [];
      }
    }
  }

  return segments;
}
