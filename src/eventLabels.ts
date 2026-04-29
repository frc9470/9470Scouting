import type { EventSchedule } from "./types";

const CHAMPIONSHIP_DIVISIONS: Record<string, string> = {
  arc: "Archimedes",
  cur: "Curie",
  dal: "Daly",
  gal: "Galileo",
  hop: "Hopper",
  joh: "Johnson",
  mil: "Milstein",
  new: "Newton",
};

const LOCAL_EVENT_LABELS: Record<string, string> = {
  testlive: "Fake Live Event",
};

function divisionNameFromKey(eventKey: string) {
  const normalized = eventKey.trim().toLowerCase();
  const championshipMatch = normalized.match(/^20\d{2}([a-z]{3})$/);
  if (!championshipMatch) return null;

  const divisionName = CHAMPIONSHIP_DIVISIONS[championshipMatch[1]];
  return divisionName ? `${divisionName} Division` : null;
}

function cleanTbaEventName(eventName: string) {
  return eventName.replace(/^FIRST Championship\s*-\s*/i, "").trim();
}

export function eventDisplayName(event: Pick<EventSchedule, "eventKey"> & Partial<Pick<EventSchedule, "eventName">>) {
  const eventKey = event.eventKey.trim();
  const localLabel = LOCAL_EVENT_LABELS[eventKey.toLowerCase()];
  if (localLabel) return localLabel;

  const divisionLabel = divisionNameFromKey(eventKey);
  if (divisionLabel) return divisionLabel;

  const eventName = event.eventName?.trim();
  if (eventName) return cleanTbaEventName(eventName);

  return eventKey.toUpperCase();
}
