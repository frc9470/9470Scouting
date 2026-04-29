import type { EventSchedule, ScheduledMatch, TeamMember } from "./types";
import { groupMatchesByDay, type MatchDayGroup } from "./scheduleDays";

export const PARENT_AVAILABILITY_SLOTS = [
  { id: "archimedes_day1_morning", label: "Day 1 Morning", shortLabel: "D1 AM" },
  { id: "archimedes_day1_afternoon", label: "Day 1 Afternoon", shortLabel: "D1 PM" },
  { id: "archimedes_day2_morning", label: "Day 2 Morning", shortLabel: "D2 AM" },
  { id: "archimedes_day2_afternoon", label: "Day 2 Afternoon", shortLabel: "D2 PM" },
] as const;

export type ParentAvailabilitySlot = (typeof PARENT_AVAILABILITY_SLOTS)[number]["id"];

export const DEFAULT_PARENT_AVAILABILITY = PARENT_AVAILABILITY_SLOTS.map((slot) => slot.id);

const ARCHIMEDES_KEYS = new Set(["2026arc", "testlive"]);

function matchTimeMs(match: ScheduledMatch) {
  const seconds = match.predictedTime ?? match.scheduledTime ?? match.actualTime;
  return seconds ? seconds * 1000 : null;
}

function hasUsableDayTimes(matches: ScheduledMatch[]) {
  const dayKeys = new Set(
    matches
      .map(matchTimeMs)
      .filter((ms): ms is number => ms != null)
      .map((ms) => new Date(ms).toDateString()),
  );
  return dayKeys.size >= 2;
}

function splitIntoTwoQualDays(matches: ScheduledMatch[]): MatchDayGroup[] {
  const sorted = [...matches].sort((a, b) => a.matchNumber - b.matchNumber);
  const splitIndex = Math.ceil(sorted.length / 2);
  const first = sorted.slice(0, splitIndex);
  const second = sorted.slice(splitIndex);

  return [
    { id: "archimedes_day1", label: "Day 1", dateLabel: "Archimedes quals", matches: first },
    { id: "archimedes_day2", label: "Day 2", dateLabel: "Archimedes quals", matches: second },
  ].filter((day) => day.matches.length > 0);
}

export function groupMatchesForAvailability(schedule: EventSchedule | null): MatchDayGroup[] {
  if (!schedule) return [];
  const qualMatches = schedule.matches.filter((match) => match.compLevel === "qm");
  if (ARCHIMEDES_KEYS.has(schedule.eventKey.toLowerCase()) && !hasUsableDayTimes(qualMatches)) {
    return splitIntoTwoQualDays(qualMatches);
  }
  return groupMatchesByDay(qualMatches);
}

export function parentAvailabilitySlotForMatch(matchNumber: number, matches: ScheduledMatch[]) {
  const sorted = [...matches].filter((match) => match.compLevel === "qm").sort((a, b) => a.matchNumber - b.matchNumber);
  const index = sorted.findIndex((match) => match.matchNumber === matchNumber);
  if (index < 0 || sorted.length === 0) return null;

  const quarter = Math.min(3, Math.floor((index / sorted.length) * 4));
  return PARENT_AVAILABILITY_SLOTS[quarter].id;
}

export function isMemberAvailableForMatch(member: TeamMember, matchNumber: number, matches: ScheduledMatch[]) {
  if (member.group !== "parent") return true;
  const slot = parentAvailabilitySlotForMatch(matchNumber, matches);
  if (!slot) return true;
  return (member.availability ?? []).includes(slot);
}

export function availabilityLabel(slotId: string) {
  return PARENT_AVAILABILITY_SLOTS.find((slot) => slot.id === slotId)?.shortLabel ?? slotId;
}
