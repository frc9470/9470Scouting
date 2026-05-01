import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth";
import {
  generateScoutAssignments,
  nextAssignmentForScouter,
  autoGenerateShifts,
  generateAssignmentsFromShifts,
} from "./assignments";
import {
  aggregateTeams,
  createEmptyDraft,
  createId,
  getDeviceId,
  latestSubmissions,
  missingRequiredFields,
} from "./domain";
import {
  buildExportPayload,
  deleteDraft,
  getLatestDraft,
  importPayload,
  listEventSchedules,
  listScoutAssignments,
  listSubmissions,
  replaceScoutAssignments,
  replaceShifts,
  saveEventSchedule,
  saveDraft,
  saveSubmission,
} from "./db";
import { IconClipboard, IconBarChart, IconHardDrive, IconCheckCircle, IconChevronRight, IconFlag } from "./icons";
import { fetchNexusEventStatus, formatEta, getMatchEtaMs, type NexusLiveState } from "./nexus";
import { Input, Choice, OptionGroup } from "./components/Input";
import { LiveMatch } from "./components/LiveMatch";
import { PostMatch } from "./components/PostMatch";
import { Dashboard } from "./components/Dashboard";
import { DataView } from "./components/DataView";
import { GroupSelect } from "./components/GroupSelect";
import { LeadView } from "./components/LeadView";
import { LoginScreen } from "./components/LoginScreen";
import { MatchSelectionList } from "./components/MatchSelectionList";
import { isSupabaseConfigured } from "./supabase";
import {
  syncWithSupabase,
  pushAssignments,
  pullAssignments,
  pullSchedules,
  pushSchedule,
  pushShifts,
  pullShifts,
  autoSyncSubmission,
  fetchAllProfiles,
  syncAll,
  updateProfileGroup,
  updateMemberGroup,
  updateMemberRole,
  updateMemberScoutingStatus,
  clearSubmittedData,
} from "./sync";
import { fetchTbaEventSchedule } from "./tba";
import { eventDisplayName } from "./eventLabels";
import { DEFAULT_PARENT_AVAILABILITY, groupMatchesForAvailability } from "./availability";
import type {
  ActionInterval,
  ActionKey,
  EventSchedule,
  MatchDraft,
  MatchStep,
  MatchSubmission,
  MemberGroup,
  ScoutingStatus,
  ScoutAssignment,
  ScoutShift,
  ScheduledMatch,
  ScheduledRobot,
  SyncIndicator,
  TeamMember,
  View,
} from "./types";

const SECOND = 1000;
const AUTO_DURATION_MS = 20 * SECOND;
const TRANSITION_DURATION_MS = 3 * SECOND;
const TELEOP_DURATION_MS = 140 * SECOND;
const MATCH_DURATION_MS = AUTO_DURATION_MS + TRANSITION_DURATION_MS + TELEOP_DURATION_MS;

const SYNC_INTERVAL_MS = 30_000;
const STARTING_POSE_ZONES = [
  { id: "zone_1", label: "Trench", className: "zone-trench-left" },
  { id: "zone_2", label: "Bump", className: "zone-bump-left" },
  { id: "zone_3", label: "Hub", className: "zone-hub" },
  { id: "zone_4", label: "Bump", className: "zone-bump-right" },
  { id: "zone_5", label: "Trench", className: "zone-trench-right" },
] as const;

export function App() {
  const { user, profile, loading: authLoading, signInWithGoogle, signOut, refreshProfile } = useAuth();
  const [view, setView] = useState<View>("scout");
  const [step, setStep] = useState<MatchStep>("select");
  const [draft, setDraft] = useState<MatchDraft>(() => createEmptyDraft());
  const [submissions, setSubmissions] = useState<MatchSubmission[]>([]);
  const [activeAction, setActiveAction] = useState<ActionKey>("driving");
  const [activeIntervalId, setActiveIntervalId] = useState<string | null>(null);
  const [matchStartedAt, setMatchStartedAt] = useState<number | null>(null);
  const [elapsedBeforeResume, setElapsedBeforeResume] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [saveStatus, setSaveStatus] = useState("Ready");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState("");
  const [eventSchedules, setEventSchedules] = useState<EventSchedule[]>([]);
  const [scoutAssignments, setScoutAssignments] = useState<ScoutAssignment[]>([]);
  const [scoutShifts, setScoutShifts] = useState<ScoutShift[]>([]);
  const [tbaEventKey, setTbaEventKeyState] = useState(
    () => localStorage.getItem("team9470.tbaEventKey") ?? "",
  );
  const [tbaStatus, setTbaStatus] = useState("Not loaded");
  const [supabaseStatus, setSupabaseStatus] = useState(
    isSupabaseConfigured() ? "Ready" : "Not configured",
  );
  const [syncIndicator, setSyncIndicator] = useState<SyncIndicator>("idle");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [teamProfiles, setTeamProfiles] = useState<TeamMember[]>([]);
  const [nexusState, setNexusState] = useState<NexusLiveState | null>(null);

  const isLead = profile?.role === "lead" || profile?.role === "admin";

  useEffect(() => {
    if (view === "lead" && !isLead) setView("scout");
  }, [isLead, view]);

  // Always populate scouter name from auth profile
  useEffect(() => {
    if (!profile) return;
    const profileName = profile.display_name;
    if (profileName) {
      setDraft((current) => ({ ...current, scouterName: profileName }));
    }
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void initialize(); }, []);

  // ── Auto-pull from Supabase on auth ──────────────────────
  useEffect(() => {
    if (!user || !profile || !isSupabaseConfigured()) return;
    void (async () => {
      try {
        setSyncIndicator("syncing");
        await pullAssignments();
        await pullSchedules();
        await pullShifts();
        await refreshAssignments();
        await refreshEventSchedules();
        await refreshShifts();
        if (profile.role === "lead" || profile.role === "admin") {
          setTeamProfiles(await fetchAllProfiles());
        }
        setSyncIndicator("synced");
      } catch (e) {
        console.warn("Auto-pull failed:", e);
        setSyncIndicator("error");
      }
    })();
  }, [user?.id, profile?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Background sync interval ─────────────────────────────
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;
    const interval = window.setInterval(async () => {
      try {
        setSyncIndicator("syncing");
        await syncAll();
        await refreshSubmissions();
        await refreshAssignments();
        await refreshEventSchedules();
        await refreshShifts();
        setSyncIndicator("synced");
      } catch {
        setSyncIndicator("error");
      }
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Opportunistic sync on reconnect/reopen ───────────────
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;
    let syncing = false;

    async function runSync() {
      if (syncing) return;
      syncing = true;
      try {
        setSyncIndicator("syncing");
        await syncAll();
        await refreshSubmissions();
        await refreshAssignments();
        await refreshEventSchedules();
        await refreshShifts();
        setSyncIndicator("synced");
      } catch {
        setSyncIndicator("pending");
      } finally {
        syncing = false;
      }
    }

    function syncWhenVisible() {
      if (document.visibilityState === "visible") void runSync();
    }

    window.addEventListener("online", runSync);
    window.addEventListener("focus", runSync);
    document.addEventListener("visibilitychange", syncWhenVisible);
    void runSync();

    return () => {
      window.removeEventListener("online", runSync);
      window.removeEventListener("focus", runSync);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Nexus live polling (every 15s) ─────────────────────────
  useEffect(() => {
    if (!tbaEventKey) return;
    let cancelled = false;

    async function pollNexus() {
      const state = await fetchNexusEventStatus(tbaEventKey);
      if (!cancelled && state) setNexusState(state);
    }

    void pollNexus(); // initial fetch
    const interval = window.setInterval(pollNexus, 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [tbaEventKey]);

  useEffect(() => {
    if (step !== "live") return;
    const interval = window.setInterval(() => setNow(Date.now()), SECOND);
    return () => window.clearInterval(interval);
  }, [step]);

  useEffect(() => {
    if (step !== "live") return;
    const interval = window.setInterval(() => {
      setDraft((current) => {
        const next = { ...current, currentStep: "live" as const, elapsedMs: currentElapsedMs() };
        void saveDraft(next).then(() => setSaveStatus("Saved"));
        return next;
      });
    }, 3 * SECOND);
    return () => window.clearInterval(interval);
  }, [step, matchStartedAt, elapsedBeforeResume]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const end = () => endActiveAction();
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
    };
  });

  const elapsedMs = useMemo(() => {
    if (!matchStartedAt) return elapsedBeforeResume;
    return elapsedBeforeResume + now - matchStartedAt;
  }, [elapsedBeforeResume, matchStartedAt, now]);

  const latest = useMemo(() => latestSubmissions(submissions), [submissions]);
  const aggregates = useMemo(() => aggregateTeams(latest), [latest]);
  const selectedAggregate = selectedTeam
    ? aggregates.find((t) => t.teamNumber === selectedTeam)
    : null;
  const activeSchedule = eventSchedules[0] ?? null;
  useEffect(() => {
    if (!activeSchedule || isLead) return;
    if (tbaEventKey === activeSchedule.eventKey) return;
    setTbaEventKeyState(activeSchedule.eventKey);
    localStorage.setItem("team9470.tbaEventKey", activeSchedule.eventKey);
  }, [activeSchedule, isLead, tbaEventKey]);

  const qualificationMatches = useMemo(
    () => activeSchedule?.matches.filter((match) => match.compLevel === "qm") ?? [],
    [activeSchedule],
  );
  const activeEventShifts = useMemo(
    () => activeSchedule ? scoutShifts.filter((shift) => shift.eventKey === activeSchedule.eventKey) : [],
    [activeSchedule, scoutShifts],
  );
  const activeEventAssignments = useMemo(
    () => activeSchedule
      ? scoutAssignments.filter((assignment) => assignment.eventKey === activeSchedule.eventKey)
      : [],
    [activeSchedule, scoutAssignments],
  );
  const matchDayGroups = useMemo(() => groupMatchesForAvailability(activeSchedule), [activeSchedule]);
  const selectedScheduledMatch = useMemo(
    () => qualificationMatches.find((match) => String(match.matchNumber) === draft.matchNumber),
    [draft.matchNumber, qualificationMatches],
  );
  const previewMatches = useMemo(() => qualificationMatches.slice(0, 4), [qualificationMatches]);
  const nextAssignment = useMemo(
    () => nextAssignmentForScouter(activeEventAssignments, latest, user?.id ?? null, draft.scouterName, activeSchedule, nexusState),
    [user?.id, draft.scouterName, latest, activeEventAssignments, activeSchedule, nexusState],
  );

  async function refreshSubmissions() { setSubmissions(await listSubmissions()); }
  async function refreshEventSchedules() { setEventSchedules(await listEventSchedules()); }
  async function refreshAssignments() { setScoutAssignments(await listScoutAssignments()); }
  async function refreshShifts() {
    const { listShifts } = await import("./db");
    setScoutShifts(await listShifts());
  }

  async function initialize() {
    const savedDraft = await getLatestDraft();
    await refreshSubmissions();
    await refreshEventSchedules();
    await refreshAssignments();
    await refreshShifts();
    if (savedDraft) {
      const savedStep = savedDraft.currentStep || "select";
      const savedElapsed = savedDraft.elapsedMs || 0;
      const wallClockElapsed =
        savedStep === "live" && savedDraft.liveStartedAtUnixMs
          ? Math.max(savedElapsed, Date.now() - savedDraft.liveStartedAtUnixMs)
          : savedElapsed;
      const restoredDraft =
        savedStep === "live"
          ? {
              ...savedDraft,
              currentStep: savedStep,
              elapsedMs: wallClockElapsed,
              actionIntervals: savedDraft.actionIntervals.map((i) =>
                i.endMs == null ? { ...i, endMs: wallClockElapsed || i.startMs } : i,
              ),
            }
          : { ...savedDraft, currentStep: savedStep, elapsedMs: savedElapsed };
      setDraft(restoredDraft);
      setStep(restoredDraft.currentStep === "complete" ? "select" : restoredDraft.currentStep);
      setElapsedBeforeResume(restoredDraft.currentStep === "live" ? wallClockElapsed : restoredDraft.elapsedMs || 0);
      if (restoredDraft.currentStep === "live") setMatchStartedAt(Date.now());
      setSaveStatus("Restored");
    }
  }

  function setTbaEventKey(eventKey: string) {
    setTbaEventKeyState(eventKey);
    localStorage.setItem("team9470.tbaEventKey", eventKey);
  }

  async function pullTbaSchedule() {
    if (!isLead) {
      setTbaStatus("Only leads can change the active TBA event.");
      return;
    }
    try {
      setTbaStatus("Loading");
      const schedule = await fetchTbaEventSchedule(tbaEventKey);
      await saveEventSchedule(schedule);
      setTbaEventKey(schedule.eventKey);
      await refreshEventSchedules();
      setTbaStatus("Loaded");
      // Push schedule to Supabase for other devices
      if (isSupabaseConfigured() && user) {
        const result = await pushSchedule(schedule, user.id);
        if (result.error) console.warn("Failed to push schedule:", result.error);
      }
    } catch (error) {
      setTbaStatus(error instanceof Error ? error.message : "TBA import failed");
    }
  }

  async function syncSupabaseNow() {
    try {
      setSupabaseStatus("Syncing");
      setSyncIndicator("syncing");
      const result = await syncAll();
      await refreshSubmissions();
      await refreshAssignments();
      await refreshEventSchedules();
      setSupabaseStatus(`Pushed ${result.pushed}, pulled ${result.pulled}`);
      setSyncIndicator("synced");
    } catch (error) {
      setSupabaseStatus(error instanceof Error ? error.message : "Supabase sync failed");
      setSyncIndicator("error");
    }
  }

  function currentElapsedMs() {
    if (!matchStartedAt) return elapsedBeforeResume;
    return elapsedBeforeResume + Date.now() - matchStartedAt;
  }

  function updateDraft(updater: (current: MatchDraft) => MatchDraft) {
    setDraft((current) => {
      const next = updater(current);
      void saveDraft(next).then(() => setSaveStatus("Saved"));
      return next;
    });
  }

  function toggleProfile(id: string) {
    // kept for backward compat, no longer primary
  }

  async function saveActiveShiftPlan(nextShifts: ScoutShift[]) {
    if (!activeSchedule) return;

    const scopedShifts = nextShifts.map((shift) => ({
      ...shift,
      eventKey: activeSchedule.eventKey,
    }));
    const assignments = generateAssignmentsFromShifts(scopedShifts, activeSchedule);

    await replaceShifts(activeSchedule.eventKey, scopedShifts);
    await replaceScoutAssignments(activeSchedule.eventKey, assignments);
    await refreshShifts();
    await refreshAssignments();

    if (isSupabaseConfigured() && user && isLead) {
      setSupabaseStatus("Saving lead changes");
      const [shiftResult, assignmentResult] = await Promise.all([
        pushShifts(activeSchedule.eventKey, scopedShifts, user.id),
        pushAssignments(activeSchedule.eventKey, assignments, user.id),
      ]);

      if (shiftResult.error || assignmentResult.error) {
        setSupabaseStatus(shiftResult.error || assignmentResult.error || "Failed to save lead changes");
        setSyncIndicator("error");
        return;
      }
      setSupabaseStatus(`Saved ${scopedShifts.length} shifts`);
      setSyncIndicator("synced");
    }
  }

  async function handleAutoGenerateShifts(dayMatches?: ScheduledMatch[], dayMembers?: TeamMember[], dayLabel?: string) {
    if (!activeSchedule) return;
    const sourceMatches = dayMatches ?? activeSchedule.matches.filter((match) => match.compLevel === "qm");
    const members = (dayMembers ?? teamProfiles).filter((member) => member.scouting_status !== "spectator");
    const scopedSchedule: EventSchedule = {
      ...activeSchedule,
      matchCount: sourceMatches.length,
      matches: sourceMatches,
    };
    const generated = autoGenerateShifts(scopedSchedule, members, {
      namePrefix: dayLabel,
      availabilityMatches: activeSchedule.matches,
    });

    if (dayMatches) {
      const selectedMatchNumbers = new Set(dayMatches.map((match) => match.matchNumber));
      const preserved = activeEventShifts.filter((shift) => {
        for (let matchNumber = shift.startMatch; matchNumber <= shift.endMatch; matchNumber += 1) {
          if (selectedMatchNumbers.has(matchNumber)) return false;
        }
        return true;
      });
      await saveActiveShiftPlan([...preserved, ...generated]);
    } else {
      await saveActiveShiftPlan(generated);
    }
  }

  async function handleSaveShift(shift: ScoutShift) {
    if (!activeSchedule) return;
    const nextShifts = activeEventShifts.some((existing) => existing.id === shift.id)
      ? activeEventShifts.map((existing) => existing.id === shift.id ? shift : existing)
      : [...activeEventShifts, shift];
    await saveActiveShiftPlan(nextShifts);
  }

  async function handleDeleteShift(id: string) {
    if (!activeSchedule) return;
    await saveActiveShiftPlan(activeEventShifts.filter((shift) => shift.id !== id));
  }

  async function handleUpdateShifts(shifts: ScoutShift[]) {
    if (!activeSchedule) return;
    await saveActiveShiftPlan(shifts);
  }

  async function handleGenerateAndPush() {
    if (!activeSchedule) return;
    const assignments = generateAssignmentsFromShifts(activeEventShifts, activeSchedule);
    await replaceScoutAssignments(activeSchedule.eventKey, assignments);
    await refreshAssignments();

    // Push shifts + assignments to Supabase
    if (isSupabaseConfigured() && user) {
      const [shiftResult, assignmentResult] = await Promise.all([
        pushShifts(activeSchedule.eventKey, activeEventShifts, user.id),
        pushAssignments(activeSchedule.eventKey, assignments, user.id),
      ]);
      if (shiftResult.error || assignmentResult.error) {
        setSupabaseStatus(shiftResult.error || assignmentResult.error || "Push failed");
        setSyncIndicator("error");
        return;
      }
      setSupabaseStatus(`Pushed ${activeEventShifts.length} shifts`);
      setSyncIndicator("synced");
    }
  }

  async function handleClearSubmittedData() {
    if (!isLead) return;
    try {
      setSyncIndicator("syncing");
      setSupabaseStatus("Clearing submitted data...");
      const result = await clearSubmittedData();
      await refreshSubmissions();
      setSupabaseStatus(
        isSupabaseConfigured()
          ? `Cleared ${result.remoteCleared} shared records.`
          : `Cleared ${result.localCleared} local records.`,
      );
      setSyncIndicator("synced");
    } catch (error) {
      setSupabaseStatus(error instanceof Error ? error.message : "Failed to clear submitted data");
      setSyncIndicator("error");
      throw error;
    }
  }

  async function handleChangeGroup(userId: string, group: MemberGroup | null) {
    try {
      await updateMemberGroup(userId, group, group === "parent" ? DEFAULT_PARENT_AVAILABILITY : []);
      setTeamProfiles(await fetchAllProfiles());
      if (userId === user?.id) await refreshProfile();
      setSupabaseStatus("Updated roster");
    } catch (error) {
      setSupabaseStatus(error instanceof Error ? error.message : "Failed to update roster");
      setSyncIndicator("error");
    }
  }

  async function handleChangeRole(userId: string, role: "scouter" | "lead") {
    try {
      await updateMemberRole(userId, role);
      setTeamProfiles(await fetchAllProfiles());
      if (userId === user?.id) await refreshProfile();
      setSupabaseStatus("Updated role");
    } catch (error) {
      setSupabaseStatus(error instanceof Error ? error.message : "Failed to update role");
      setSyncIndicator("error");
    }
  }

  async function handleChangeScoutingStatus(userId: string, scoutingStatus: ScoutingStatus) {
    try {
      await updateMemberScoutingStatus(userId, scoutingStatus);
      setTeamProfiles(await fetchAllProfiles());
      if (userId === user?.id) await refreshProfile();
      setSupabaseStatus("Updated scouting status");
    } catch (error) {
      setSupabaseStatus(error instanceof Error ? error.message : "Failed to update scouting status");
      setSyncIndicator("error");
    }
  }

  function updateField<K extends keyof MatchDraft>(field: K, value: MatchDraft[K]) {
    updateDraft((current) => {
      if (field === "scouterName") localStorage.setItem("team9470.scouterName", String(value));
      return { ...current, [field]: value };
    });
  }

  function selectScheduledMatch(match: ScheduledMatch) {
    updateDraft((current) => ({
      ...current,
      division: match.eventKey,
      matchNumber: String(match.matchNumber),
      practiceMode: false,
    }));
  }

  function selectScheduledRobot(match: ScheduledMatch, robot: ScheduledRobot) {
    updateDraft((current) => ({
      ...current,
      division: match.eventKey,
      matchNumber: String(match.matchNumber),
      teamNumber: robot.teamNumber,
      alliance: robot.alliance,
      station: robot.station,
      practiceMode: false,
    }));
  }

  function selectAssignment(assignment: ScoutAssignment) {
    updateDraft((current) => ({
      ...current,
      division: assignment.eventKey,
      matchNumber: String(assignment.matchNumber),
      teamNumber: assignment.teamNumber,
      alliance: assignment.alliance,
      station: assignment.station,
      practiceMode: false,
    }));
  }

  function beginScheduledRobot(match: ScheduledMatch, robot: ScheduledRobot) {
    const next: MatchDraft = {
      ...createEmptyDraft(),
      currentStep: "prematch",
      scouterName: profile?.display_name ?? draft.scouterName,
      division: match.eventKey,
      matchNumber: String(match.matchNumber),
      teamNumber: robot.teamNumber,
      alliance: robot.alliance,
      station: robot.station,
      practiceMode: false,
    };
    setDraft(next);
    setStep("prematch");
    setElapsedBeforeResume(0);
    setMatchStartedAt(null);
    void saveDraft(next).then(() => setSaveStatus("Saved"));
  }

  function beginAssignment(assignment: ScoutAssignment) {
    const next: MatchDraft = {
      ...createEmptyDraft(),
      currentStep: "prematch",
      scouterName: profile?.display_name ?? assignment.scouterName,
      division: assignment.eventKey,
      matchNumber: String(assignment.matchNumber),
      teamNumber: assignment.teamNumber,
      alliance: assignment.alliance,
      station: assignment.station,
      practiceMode: false,
    };
    setDraft(next);
    setStep("prematch");
    setElapsedBeforeResume(0);
    setMatchStartedAt(null);
    void saveDraft(next).then(() => setSaveStatus("Saved"));
  }

  function updatePreMatch<K extends keyof MatchDraft["preMatch"]>(
    field: K,
    value: MatchDraft["preMatch"][K],
  ) {
    updateDraft((c) => ({ ...c, preMatch: { ...c.preMatch, [field]: value } }));
  }

  function updateRobotStatus(value: MatchDraft["preMatch"]["robotStatus"]) {
    updateDraft((c) => ({
      ...c,
      preMatch: {
        ...c.preMatch,
        robotStatus: value,
        startingPose: value === "not_present" ? "not_on_field" : c.preMatch.startingPose,
      },
    }));
  }

  function updateStartingPose(value: MatchDraft["preMatch"]["startingPose"]) {
    updateDraft((c) => ({
      ...c,
      preMatch: {
        ...c.preMatch,
        startingPose: value,
        robotStatus: c.preMatch.robotStatus === "not_present" && value !== "not_on_field"
          ? "present"
          : c.preMatch.robotStatus,
      },
    }));
  }

  function updatePostMatch<K extends keyof MatchDraft["postMatch"]>(
    field: K,
    value: MatchDraft["postMatch"][K],
  ) {
    updateDraft((c) => ({ ...c, postMatch: { ...c.postMatch, [field]: value } }));
  }

  function goTo(nextStep: MatchStep) {
    setStep(nextStep);
    updateDraft((c) => ({ ...c, currentStep: nextStep }));
  }

  async function returnToMatchSelection() {
    const hasMatchProgress =
      step === "live" ||
      step === "postmatch" ||
      elapsedMs > 0 ||
      draft.actionIntervals.length > 0 ||
      draft.eventMarks.length > 0;

    if (
      hasMatchProgress &&
      !window.confirm("Discard this scouting draft and choose a different team?")
    ) {
      return;
    }

    const oldDraftId = draft.id;
    const nextDraft = {
      ...createEmptyDraft(),
      scouterName: profile?.display_name ?? draft.scouterName,
    };

    setActiveAction("driving");
    setActiveIntervalId(null);
    setElapsedBeforeResume(0);
    setMatchStartedAt(null);
    setNow(Date.now());
    setDraft(nextDraft);
    setStep("select");
    setSaveStatus("Ready");
    await deleteDraft(oldDraftId);
    await saveDraft(nextDraft);
  }

  function startMatch() {
    setStep("waiting");
    updateDraft((c) => ({ ...c, currentStep: "waiting", liveStartedAtUnixMs: null }));
  }

  function beginLiveMatch() {
    const startedAt = Date.now();
    setElapsedBeforeResume(0);
    setMatchStartedAt(startedAt);
    setNow(startedAt);
    setStep("live");
    updateDraft((c) => ({ ...c, currentStep: "live", elapsedMs: 0, liveStartedAtUnixMs: startedAt }));
  }

  function stopMatch() {
    endActiveAction();
    const stoppedAt = currentElapsedMs();
    setElapsedBeforeResume(stoppedAt);
    setMatchStartedAt(null);
    setStep("postmatch");
    updateDraft((c) => ({ ...c, currentStep: "postmatch", elapsedMs: stoppedAt, liveStartedAtUnixMs: null }));
  }

  function startAction(action: ActionKey, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (action === "driving") {
      endActiveAction();
      setActiveAction("driving");
      return;
    }
    endActiveAction();
    event.currentTarget.setPointerCapture(event.pointerId);
    const interval: ActionInterval = {
      id: createId("interval"),
      action,
      startMs: currentElapsedMs(),
      endMs: null,
    };
    setActiveAction(action);
    setActiveIntervalId(interval.id);
    updateDraft((c) => ({
      ...c,
      elapsedMs: currentElapsedMs(),
      actionIntervals: [...c.actionIntervals, interval],
    }));
  }

  function endActiveAction() {
    if (!activeIntervalId) { setActiveAction("driving"); return; }
    const endedAt = currentElapsedMs();
    const intervalId = activeIntervalId;
    setActiveIntervalId(null);
    setActiveAction("driving");
    updateDraft((c) => ({
      ...c,
      elapsedMs: endedAt,
      actionIntervals: c.actionIntervals.map((i) =>
        i.id === intervalId && i.endMs == null ? { ...i, endMs: endedAt } : i,
      ),
    }));
  }

  function toggleMark(type: "notable" | "foul_concern" | "incap") {
    updateDraft((c) => {
      const existing = c.eventMarks.find((m) => m.type === type);
      if (existing) return { ...c, eventMarks: c.eventMarks.filter((m) => m.id !== existing.id) };
      return {
        ...c,
        eventMarks: [
          ...c.eventMarks,
          { id: createId("mark"), type, matchMs: currentElapsedMs(), createdAt: new Date().toISOString() },
        ],
      };
    });
  }

  function markIncap() {
    updateDraft((c) => ({
      ...c,
      incap: { ...c.incap, occurred: true, startMs: c.incap.startMs ?? currentElapsedMs() },
      eventMarks: c.eventMarks.some((m) => m.type === "incap")
        ? c.eventMarks
        : [
            ...c.eventMarks,
            { id: createId("mark"), type: "incap" as const, matchMs: currentElapsedMs(), createdAt: new Date().toISOString() },
          ],
    }));
  }

  function undoLast() {
    updateDraft((c) => {
      if (c.eventMarks.length > 0) return { ...c, eventMarks: c.eventMarks.slice(0, -1) };
      if (c.actionIntervals.length > 0) return { ...c, actionIntervals: c.actionIntervals.slice(0, -1) };
      return c;
    });
  }

  async function submitMatch() {
    const missing = missingRequiredFields(draft);
    if (missing.length > 0) { window.alert(`Missing: ${missing.join(", ")}`); return; }
    const submission: MatchSubmission = {
      ...draft,
      id: createId("submission"),
      originalSubmissionId: null,
      versionId: createId("version"),
      versionNumber: 1,
      submittedAt: new Date().toISOString(),
      syncStatus: "pending",
    };
    await saveSubmission(submission);
    await deleteDraft(draft.id);
    await refreshSubmissions();
    setStep("complete");
    setSaveStatus("Queued");

    // Auto-sync to Supabase immediately after submit
    if (isSupabaseConfigured() && user) {
      setSyncIndicator("syncing");
      const ok = await autoSyncSubmission(submission);
      setSyncIndicator(ok ? "synced" : "pending");
      if (ok) setSaveStatus("Synced");
    }
  }

  async function exportJson() {
    const payload = await buildExportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `9470-scouting-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    const payload = JSON.parse(await file.text());
    await importPayload(payload);
    await refreshSubmissions();
    await refreshEventSchedules();
    await refreshAssignments();
  }

  async function seedFakeLiveEvent() {
    if (!user) return;
    const nowMs = Date.now();
    const eventKey = "testlive";
    const matchSpacingSeconds = 8 * 60;
    const firstMatchStartSeconds = Math.floor((nowMs - 24 * 60_000) / 1000);
    const secondDayStartSeconds = Math.floor((nowMs + 24 * 60 * 60_000 + 30 * 60_000) / 1000);
    const teams = [
      "9470", "1678", "1382", "1332", "5136", "254",
      "4414", "971", "5940", "1323", "2910", "973",
      "604", "118", "3005", "3476", "6328", "2056",
      "589", "1986", "3310", "1114", "2468", "1690",
      "2052", "4481", "364", "3847", "3538", "1538",
    ];
    const stations: ScheduledRobot["station"][] = ["red1", "red2", "red3", "blue1", "blue2", "blue3"];

    const matches: ScheduledMatch[] = Array.from({ length: 24 }, (_, index) => {
      const matchNumber = index + 1;
      const dayOffset = matchNumber > 14 ? secondDayStartSeconds + (matchNumber - 15) * matchSpacingSeconds : firstMatchStartSeconds;
      const lunchOffset = matchNumber >= 8 && matchNumber <= 14 ? 45 * 60 : 0;
      const start = matchNumber > 14 ? dayOffset : firstMatchStartSeconds + index * matchSpacingSeconds + lunchOffset;
      const robots: ScheduledRobot[] = stations.map((station, stationIndex) => ({
        teamNumber: teams[(index * 6 + stationIndex) % teams.length],
        alliance: station.startsWith("red") ? "red" : "blue",
        station,
      }));

      return {
        id: `${eventKey}_qm${matchNumber}`,
        eventKey,
        compLevel: "qm",
        setNumber: 1,
        matchNumber,
        label: `Q${matchNumber}`,
        scheduledTime: start,
        predictedTime: start,
        actualTime: matchNumber <= 3 ? start + 3 * 60 : null,
        robots,
      };
    });

    const schedule: EventSchedule = {
      eventKey,
      eventName: "Fake Live Event",
      fetchedAt: new Date().toISOString(),
      matchCount: matches.length,
      matches,
    };

    const displayName = profile?.display_name ?? (draft.scouterName || "Test Scouter");
    const currentUserId = user.id;
    const shifts: ScoutShift[] = [
      {
        id: createId("shift"),
        eventKey,
        name: "Shift 1",
        startMatch: 1,
        endMatch: 7,
        createdAt: new Date().toISOString(),
        roster: stations.map((station, index) => ({
          station,
          userId: index === 0 ? currentUserId : `fake-user-${index}`,
          displayName: index === 0 ? displayName : `Fake Scouter ${index + 1}`,
          subs: [],
        })),
      },
      {
        id: createId("shift"),
        eventKey,
        name: "Shift 2",
        startMatch: 8,
        endMatch: 14,
        createdAt: new Date().toISOString(),
        roster: stations.map((station, index) => ({
          station,
          userId: index === 2 ? currentUserId : `fake-user-b-${index}`,
          displayName: index === 2 ? displayName : `Fake Scouter ${index + 7}`,
          subs: [],
        })),
      },
      {
        id: createId("shift"),
        eventKey,
        name: "Shift 3",
        startMatch: 15,
        endMatch: 18,
        createdAt: new Date().toISOString(),
        roster: stations.map((station, index) => ({
          station,
          userId: index === 4 ? currentUserId : `fake-user-c-${index}`,
          displayName: index === 4 ? displayName : `Fake Scouter ${index + 13}`,
          subs: [],
        })),
      },
    ];
    const assignments = generateAssignmentsFromShifts(shifts, schedule);

    await saveEventSchedule(schedule);
    await replaceShifts(eventKey, shifts);
    await replaceScoutAssignments(eventKey, assignments);
    setTbaEventKey(eventKey);
    await refreshEventSchedules();
    await refreshShifts();
    await refreshAssignments();
    setTbaStatus("Seeded fake live event");
    setView("scout");
    setStep("select");
  }

  const marked = new Set(draft.eventMarks.map((m) => m.type));

  // Step indicator state
  const stepIndex = { select: 0, prematch: 1, waiting: 2, live: 2, postmatch: 3, complete: 4 }[step];

  const matchPhase = (() => {
    if (elapsedMs < AUTO_DURATION_MS) {
      return {
        key: "auto" as const,
        label: "Auto",
        remainingMs: AUTO_DURATION_MS - elapsedMs,
      };
    }
    if (elapsedMs < AUTO_DURATION_MS + TRANSITION_DURATION_MS) {
      return {
        key: "transition" as const,
        label: "Transition",
        remainingMs: AUTO_DURATION_MS + TRANSITION_DURATION_MS - elapsedMs,
      };
    }
    if (elapsedMs < MATCH_DURATION_MS) {
      return {
        key: "teleop" as const,
        label: "Teleop",
        remainingMs: MATCH_DURATION_MS - elapsedMs,
      };
    }
    return {
      key: "over" as const,
      label: "Over",
      remainingMs: 0,
    };
  })();
  const matchExpired = step === "live" && matchPhase.key === "over";

  // Gate on auth — show login screen when not signed in
  if (authLoading) {
    return (
      <div className="app-shell">
        <div className="login-screen">
          <div className="login-card">
            <div className="login-brand">
              <strong>9470 Scout</strong>
              <p>Loading…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-shell">
        <LoginScreen signInWithGoogle={signInWithGoogle} loading={authLoading} />
      </div>
    );
  }

  // Gate: group selection and parent availability onboarding
  const profileHasAvailability = Object.hasOwn(profile ?? {}, "availability");
  if (profile && (!profile.group || (profileHasAvailability && profile.group === "parent" && (profile.availability?.length ?? 0) === 0))) {
    return (
      <div className="app-shell">
        <GroupSelect
          initialGroup={profile.group}
          onSelect={async (group: MemberGroup, availability: string[] | null) => {
            await updateProfileGroup(
              user.id,
              group,
              group === "parent" ? availability ?? DEFAULT_PARENT_AVAILABILITY : [],
            );
            await refreshProfile();
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>9470 Scout</strong>
          <div className={`sync-indicator ${syncIndicator}`} title={syncIndicator}>
            <span className="sync-icon">
              {syncIndicator === "syncing" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 11-6.2-8.56" />
                </svg>
              ) : syncIndicator === "synced" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : syncIndicator === "error" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <span className="sync-idle-dot" />
              )}
            </span>
            <span className="sync-label">
              {syncIndicator === "syncing" ? "Syncing" :
               syncIndicator === "synced" ? "Live" :
               syncIndicator === "error" ? "Offline" :
               syncIndicator === "pending" ? "Pending" : ""}
            </span>
          </div>
        </div>
        <div className="topbar-user-wrap">
          <button className="topbar-user" onClick={() => setShowUserMenu((v) => !v)}>
            {profile?.avatar_url && (
              <img
                src={profile.avatar_url}
                alt=""
                className="topbar-avatar"
                referrerPolicy="no-referrer"
              />
            )}
            <span className="topbar-name">{profile?.display_name ?? user.email}</span>
            {isLead && <span className="role-badge">Lead</span>}
          </button>
          {showUserMenu && (
            <>
              <div className="popover-backdrop" onClick={() => setShowUserMenu(false)} />
              <div className="user-menu">
                <div className="user-menu-header">
                  <span>{profile?.display_name}</span>
                  <span className="muted small">{profile?.email}</span>
                </div>
                <button className="user-menu-item" onClick={() => { setShowUserMenu(false); void signOut(); }}>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="main">
        {view === "scout" && (
          <div className="grid">
            {step !== "select" && step !== "complete" && (
              <div className={`identity ${draft.alliance}`}>
                <div>
                  <strong>
                    Q{draft.matchNumber || "?"} · Team {draft.teamNumber || "?"}
                  </strong>
                  <div className="identity-meta">
                    {profile?.display_name || "Unnamed"}
                    {draft.station ? ` · ${draft.station.toUpperCase()}` : ""}
                    {draft.practiceMode ? " · Practice" : ""}
                  </div>
                </div>
                <span className="status-pill">{saveStatus}</span>
              </div>
            )}

            {/* Step progress dots */}
            {step !== "complete" && (
              <div className="step-indicator">
                {[0, 1, 2, 3].map((i) => (
                  <React.Fragment key={i}>
                    <span className={`step-dot ${i === stepIndex ? "active" : i < stepIndex ? "done" : ""}`} />
                    {i < 3 && <span className="step-connector" />}
                  </React.Fragment>
                ))}
              </div>
            )}

            {step === "select" && (
              <>
                {activeSchedule ? (
                  <MatchSelectionList
                    eventKey={activeSchedule.eventKey}
                    eventLabel={eventDisplayName(activeSchedule)}
                    dayGroups={matchDayGroups}
                    matches={qualificationMatches}
                    assignments={activeEventAssignments}
                    shifts={activeEventShifts}
                    submissions={latest}
                    userId={user.id}
                    scouterName={profile?.display_name ?? draft.scouterName}
                    nexusState={nexusState}
                    onScoutRobot={beginScheduledRobot}
                  />
                ) : scoutAssignments.length > 0 ? (
                  <section className="panel">
                    <div className="empty" style={{ textAlign: "center", padding: 16 }}>
                      <IconCheckCircle size={28} style={{ color: "var(--green)", marginBottom: 8 }} />
                      <p style={{ fontWeight: 700 }}>Assignments cached</p>
                      <p className="muted small">Load the event schedule to use the match list.</p>
                    </div>
                  </section>
                ) : (
                  <section className="panel">
                    <h1>No schedule cached</h1>
                    <p className="muted">Use Data to load the event once, then this screen works offline.</p>
                  </section>
                )}

                {/* ── Fallback: Manual Entry (collapsed) ── */}
                <section className="panel">
                  <button
                    className="manual-toggle"
                    onClick={() => setShowManualEntry((v) => !v)}
                  >
                    <span>Manual entry</span>
                    <IconChevronRight
                      size={16}
                      style={{
                        transform: showManualEntry ? "rotate(90deg)" : "none",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </button>
                  {showManualEntry && (
                    <>
                      <div className="form-grid top-space">
                        <Input label="Division" value={draft.division} onChange={(v) => updateField("division", v)} />
                        <Input label="Match #" value={draft.matchNumber} onChange={(v) => updateField("matchNumber", v)} inputMode="numeric" />
                        <Input label="Team #" value={draft.teamNumber} onChange={(v) => updateField("teamNumber", v)} inputMode="numeric" />
                        <label className="field">
                          <span>Alliance</span>
                          <select
                            value={draft.alliance}
                            onChange={(e) => updateField("alliance", e.target.value as MatchDraft["alliance"])}
                          >
                            <option value="red">Red</option>
                            <option value="blue">Blue</option>
                            <option value="unknown">Unknown</option>
                          </select>
                        </label>
                      </div>
                      <div className="button-row top-space">
                        <Choice selected={draft.practiceMode} onClick={() => updateField("practiceMode", !draft.practiceMode)}>
                          Practice Mode
                        </Choice>
                        <button className="button primary" style={{ marginLeft: "auto" }} onClick={() => {
                          if (!draft.matchNumber || !draft.teamNumber) {
                            window.alert("Please fill out the Match # and Team # before continuing.");
                            return;
                          }
                          goTo("prematch")
                        }}>
                          Continue
                        </button>
                      </div>
                    </>
                  )}
                </section>
              </>
            )}

            {step === "prematch" && (
              <section className="panel">
                <h1>Pre-Match</h1>
                <p className="muted">Capture setup quickly. Unknown is better than guessing.</p>
                <div className="grid top-space">
                  <div>
                    <h2>Starting Pose</h2>
                    <div className="field-map-container">
                      <img src="./field-map.png" alt="Field" className="field-map-img" />
                      <div className="field-map-zones">
                        {STARTING_POSE_ZONES.map((zone) => (
                          <button
                            className={`zone ${zone.className} ${draft.preMatch.startingPose === zone.id ? "selected" : ""}`}
                            key={zone.id}
                            onClick={() => updateStartingPose(zone.id)}
                          >
                            {zone.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="button-row">
                      <Choice selected={draft.preMatch.startingPose === "unknown"} onClick={() => updateStartingPose("unknown")}>
                        Pose unknown
                      </Choice>
                    </div>
                  </div>
                  <OptionGroup
                    title="Robot Status"
                    options={[
                      ["present", "Present"],
                      ["not_present", "Not present"],
                      ["problem_visible", "Problem visible"],
                    ]}
                    value={draft.preMatch.robotStatus}
                    onChange={(v) => updateRobotStatus(v)}
                  />
                  <div className="button-row">
                    <button className="button ghost" onClick={() => goTo("select")}>Back</button>
                    <button className="button primary" style={{ marginLeft: "auto" }} onClick={startMatch}>
                      Ready for Match
                    </button>
                  </div>
                </div>
              </section>
            )}

            {step === "waiting" && (
              <section
                className="panel waiting-touch"
                onClick={beginLiveMatch}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") beginLiveMatch(); }}
              >
                <button
                  className="button ghost waiting-back-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void returnToMatchSelection();
                  }}
                >
                  Back
                </button>
                <div className="waiting-screen">
                  <span className="waiting-label">Ready</span>
                  <div className="countdown running">Auto 0:20</div>
                  <p className="muted">Tap when the match starts</p>
                </div>
              </section>
            )}

            {step === "live" && (
              <LiveMatch
                draft={draft}
                elapsedMs={elapsedMs}
                matchPhase={matchPhase}
                matchExpired={matchExpired}
                activeAction={activeAction}
                marked={marked}
                startAction={startAction}
                stopMatch={stopMatch}
                toggleMark={toggleMark}
                markIncap={markIncap}
                undoLast={undoLast}
                updateDraft={updateDraft}
                onBackToSelection={returnToMatchSelection}
              />
            )}

            {step === "postmatch" && (
              <PostMatch
                draft={draft}
                elapsedMs={elapsedMs}
                updatePostMatch={updatePostMatch}
                updateDraft={updateDraft}
                submitMatch={submitMatch}
                goTo={goTo}
                onBackToSelection={returnToMatchSelection}
              />
            )}

            {step === "complete" && (
              <section className="panel">
                <div className="complete-screen">
                  <div className="complete-icon">
                    <IconCheckCircle size={32} />
                  </div>
                  <h1>Submitted</h1>
                  <p className="muted">
                    {syncIndicator === "synced"
                      ? "Synced to server ✓"
                      : syncIndicator === "syncing"
                        ? "Syncing…"
                        : "Saved locally, will sync soon."}
                  </p>
                  {nextAssignment && (
                    <div className={`next-up-preview ${nextAssignment.alliance}`}>
                      <span className="muted small">Up next</span>
                      <strong>{nextAssignment.label} · Team {nextAssignment.teamNumber}</strong>
                    </div>
                  )}
                  <div className="button-row">
                    <button
                      className="button primary"
                      onClick={() => {
                        if (nextAssignment) {
                          beginAssignment(nextAssignment);
                          return;
                        }
                        const newDraft = createEmptyDraft();
                        setDraft(newDraft);
                        setStep("select");
                        setSaveStatus("Ready");
                      }}
                    >
                      {nextAssignment ? "Scout Next Assignment" : "Scout Next"}
                    </button>
                    <button className="button ghost" onClick={() => setView("dashboard")}>
                      Dashboard
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {view === "dashboard" && (
          <Dashboard
            aggregates={aggregates}
            latest={latest}
            selectedTeam={selectedTeam}
            selectedAggregate={selectedAggregate}
            setSelectedTeam={setSelectedTeam}
            teamFilter={teamFilter}
            setTeamFilter={setTeamFilter}
          />
        )}

        {view === "lead" && isLead && (
          <LeadView
            activeSchedule={activeSchedule}
            profiles={teamProfiles}
            shifts={activeEventShifts}
            assignments={activeEventAssignments}
            submissions={latest}
            onAutoGenerate={(matches, members, dayLabel) => { void handleAutoGenerateShifts(matches, members, dayLabel); }}
            onSaveShift={(s) => { void handleSaveShift(s); }}
            onDeleteShift={(id) => { void handleDeleteShift(id); }}
            onUpdateShifts={(s) => { void handleUpdateShifts(s); }}
            onGenerateAndPush={() => { void handleGenerateAndPush(); }}
            onClearSubmittedData={handleClearSubmittedData}
            onChangeGroup={(uid, g) => { void handleChangeGroup(uid, g); }}
            onChangeRole={(uid, r) => { void handleChangeRole(uid, r); }}
            onChangeScoutingStatus={(uid, status) => { void handleChangeScoutingStatus(uid, status); }}
          />
        )}

        {view === "data" && (
          <DataView
            submissions={submissions}
            schedules={eventSchedules}
            tbaEventKey={tbaEventKey}
            tbaStatus={tbaStatus}
            supabaseConfigured={isSupabaseConfigured()}
            supabaseStatus={supabaseStatus}
            setTbaEventKey={setTbaEventKey}
            fetchTbaSchedule={() => { void pullTbaSchedule(); }}
            canManageSchedule={isLead}
            syncSupabase={() => { void syncSupabaseNow(); }}
            exportJson={exportJson}
            importJson={importJson}
            seedTestEvent={import.meta.env.DEV && isLead ? () => { void seedFakeLiveEvent(); } : undefined}
          />
        )}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="tab-bar" aria-label="Primary">
        <button className={`tab-item ${view === "scout" ? "active" : ""}`} onClick={() => setView("scout")}>
          <IconClipboard size={20} />
          <span>Scout</span>
        </button>
        {isLead && (
          <button className={`tab-item ${view === "lead" ? "active" : ""}`} onClick={() => setView("lead")}>
            <IconFlag size={20} />
            <span>Lead</span>
          </button>
        )}
        <button
          className={`tab-item ${view === "dashboard" ? "active" : ""}`}
          onClick={() => { setView("dashboard"); void refreshSubmissions(); }}
        >
          <IconBarChart size={20} />
          <span>Dashboard</span>
        </button>
        <button className={`tab-item ${view === "data" ? "active" : ""}`} onClick={() => setView("data")}>
          <IconHardDrive size={20} />
          <span>Data</span>
        </button>
      </nav>
    </div>
  );
}
