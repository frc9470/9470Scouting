import Dexie, { type Table } from "dexie";
import type { EventSchedule, ExportPayload, MatchDraft, MatchSubmission, SyncQueueItem } from "./types";
import { createId, getDeviceId } from "./domain";

class ScoutingDatabase extends Dexie {
  matchDrafts!: Table<MatchDraft, string>;
  matchSubmissions!: Table<MatchSubmission, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  eventSchedules!: Table<EventSchedule, string>;

  constructor() {
    super("team-9470-scouting");
    this.version(1).stores({
      matchDrafts: "id, matchNumber, teamNumber, updatedAt",
      matchSubmissions: "id, teamNumber, matchNumber, syncStatus, submittedAt",
      syncQueue: "id, status, recordType, recordId, createdAt",
    });
    this.version(2).stores({
      matchDrafts: "id, matchNumber, teamNumber, updatedAt",
      matchSubmissions: "id, teamNumber, matchNumber, syncStatus, submittedAt",
      syncQueue: "id, status, recordType, recordId, createdAt",
      eventSchedules: "eventKey, fetchedAt",
    });
  }
}

export const db = new ScoutingDatabase();

export async function saveDraft(draft: MatchDraft) {
  await db.matchDrafts.put({
    ...draft,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteDraft(id: string) {
  await db.matchDrafts.delete(id);
}

export async function listSubmissions() {
  return db.matchSubmissions.orderBy("submittedAt").reverse().toArray();
}

export async function getLatestDraft() {
  return db.matchDrafts.orderBy("updatedAt").last();
}

export async function saveSubmission(submission: MatchSubmission) {
  await db.transaction("rw", db.matchSubmissions, db.syncQueue, async () => {
    await db.matchSubmissions.put(submission);
    await db.syncQueue.put({
      id: createId("sync"),
      recordType: "match_submission",
      recordId: submission.id,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  });
}

export async function saveEventSchedule(schedule: EventSchedule) {
  await db.eventSchedules.put(schedule);
}

export async function listEventSchedules() {
  return db.eventSchedules.orderBy("fetchedAt").reverse().toArray();
}

export async function buildExportPayload(): Promise<ExportPayload> {
  return {
    exportedAt: new Date().toISOString(),
    deviceId: getDeviceId(),
    matchSubmissions: await db.matchSubmissions.toArray(),
    eventSchedules: await db.eventSchedules.toArray(),
  };
}

export async function importPayload(payload: ExportPayload) {
  await db.transaction("rw", db.matchSubmissions, db.eventSchedules, async () => {
    for (const submission of payload.matchSubmissions || []) {
      await db.matchSubmissions.put(submission);
    }
    for (const schedule of payload.eventSchedules || []) {
      await db.eventSchedules.put(schedule);
    }
  });
}
