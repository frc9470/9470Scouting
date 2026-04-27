import Dexie, { type Table } from "dexie";
import type {
  EventSchedule,
  ExportPayload,
  MatchDraft,
  MatchSubmission,
  ScoutAssignment,
  ScouterProfile,
  SyncQueueItem,
} from "./types";
import { createId, getDeviceId } from "./domain";
import { sortAssignments } from "./assignments";

class ScoutingDatabase extends Dexie {
  matchDrafts!: Table<MatchDraft, string>;
  matchSubmissions!: Table<MatchSubmission, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  eventSchedules!: Table<EventSchedule, string>;
  scouterProfiles!: Table<ScouterProfile, string>;
  scoutAssignments!: Table<ScoutAssignment, string>;

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
    this.version(3).stores({
      matchDrafts: "id, matchNumber, teamNumber, updatedAt",
      matchSubmissions: "id, teamNumber, matchNumber, syncStatus, submittedAt",
      syncQueue: "id, status, recordType, recordId, createdAt",
      eventSchedules: "eventKey, fetchedAt",
      scouterProfiles: "id, name, active, createdAt",
      scoutAssignments: "id, eventKey, matchNumber, teamNumber, scouterId, scouterName",
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

export async function saveScouterProfile(profile: ScouterProfile) {
  await db.scouterProfiles.put(profile);
}

export async function deleteScouterProfile(id: string) {
  await db.scouterProfiles.delete(id);
}

export async function listScouterProfiles() {
  return db.scouterProfiles.orderBy("createdAt").toArray();
}

export async function replaceScoutAssignments(eventKey: string, assignments: ScoutAssignment[]) {
  await db.transaction("rw", db.scoutAssignments, async () => {
    const existing = await db.scoutAssignments.where("eventKey").equals(eventKey).toArray();
    await db.scoutAssignments.bulkDelete(existing.map((assignment) => assignment.id));
    if (assignments.length > 0) await db.scoutAssignments.bulkPut(assignments);
  });
}

export async function listScoutAssignments() {
  return sortAssignments(await db.scoutAssignments.toArray());
}

export async function buildExportPayload(): Promise<ExportPayload> {
  return {
    exportedAt: new Date().toISOString(),
    deviceId: getDeviceId(),
    matchSubmissions: await db.matchSubmissions.toArray(),
    eventSchedules: await db.eventSchedules.toArray(),
    scouterProfiles: await db.scouterProfiles.toArray(),
    scoutAssignments: await db.scoutAssignments.toArray(),
  };
}

export async function importPayload(payload: ExportPayload) {
  await db.transaction(
    "rw",
    db.matchSubmissions,
    db.eventSchedules,
    db.scouterProfiles,
    db.scoutAssignments,
    async () => {
    for (const submission of payload.matchSubmissions || []) {
      await db.matchSubmissions.put(submission);
    }
    for (const schedule of payload.eventSchedules || []) {
      await db.eventSchedules.put(schedule);
    }
    for (const profile of payload.scouterProfiles || []) {
      await db.scouterProfiles.put(profile);
    }
    for (const assignment of payload.scoutAssignments || []) {
      await db.scoutAssignments.put(assignment);
    }
  });
}
