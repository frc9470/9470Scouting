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
} from "./sync";
import { fetchTbaEventSchedule } from "./tba";
import type {
  ActionInterval,
  ActionKey,
  EventSchedule,
  MatchDraft,
  MatchStep,
  MatchSubmission,
  MemberGroup,
  ScoutAssignment,
  ScoutShift,
  ScheduledMatch,
  ScheduledRobot,
  SyncIndicator,
  TeamMember,
  View,
} from "./types";

const SECOND = 1000;
const MATCH_DURATION_MS = 160 * SECOND; // 2:40

const SYNC_INTERVAL_MS = 30_000;

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
  const qualificationMatches = useMemo(
    () => activeSchedule?.matches.filter((match) => match.compLevel === "qm") ?? [],
    [activeSchedule],
  );
  const selectedScheduledMatch = useMemo(
    () => qualificationMatches.find((match) => String(match.matchNumber) === draft.matchNumber),
    [draft.matchNumber, qualificationMatches],
  );
  const previewMatches = useMemo(() => qualificationMatches.slice(0, 4), [qualificationMatches]);
  const nextAssignment = useMemo(
    () => nextAssignmentForScouter(scoutAssignments, latest, user?.id ?? null, draft.scouterName, activeSchedule, nexusState),
    [user?.id, draft.scouterName, latest, scoutAssignments, activeSchedule, nexusState],
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
      const restoredDraft =
        savedStep === "live"
          ? {
              ...savedDraft,
              currentStep: savedStep,
              elapsedMs: savedElapsed,
              actionIntervals: savedDraft.actionIntervals.map((i) =>
                i.endMs == null ? { ...i, endMs: savedElapsed || i.startMs } : i,
              ),
            }
          : { ...savedDraft, currentStep: savedStep, elapsedMs: savedElapsed };
      setDraft(restoredDraft);
      setStep(restoredDraft.currentStep === "complete" ? "select" : restoredDraft.currentStep);
      setElapsedBeforeResume(restoredDraft.elapsedMs || 0);
      if (restoredDraft.currentStep === "live") setMatchStartedAt(Date.now());
      setSaveStatus("Restored");
    }
  }

  function setTbaEventKey(eventKey: string) {
    setTbaEventKeyState(eventKey);
    localStorage.setItem("team9470.tbaEventKey", eventKey);
  }

  async function pullTbaSchedule() {
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

  async function handleAutoGenerateShifts() {
    if (!activeSchedule) return;
    const shifts = autoGenerateShifts(activeSchedule, teamProfiles);
    const { replaceShifts } = await import("./db");
    await replaceShifts(activeSchedule.eventKey, shifts);
    await refreshShifts();
  }

  async function handleSaveShift(shift: ScoutShift) {
    const { saveShift } = await import("./db");
    await saveShift(shift);
    await refreshShifts();
  }

  async function handleDeleteShift(id: string) {
    const { deleteShift: dbDeleteShift } = await import("./db");
    await dbDeleteShift(id);
    await refreshShifts();
  }

  async function handleUpdateShifts(shifts: ScoutShift[]) {
    if (!activeSchedule) return;
    const { replaceShifts } = await import("./db");
    await replaceShifts(activeSchedule.eventKey, shifts);
    await refreshShifts();
  }

  async function handleGenerateAndPush() {
    if (!activeSchedule || scoutShifts.length === 0) return;
    const assignments = generateAssignmentsFromShifts(scoutShifts, activeSchedule);
    const { replaceScoutAssignments } = await import("./db");
    await replaceScoutAssignments(activeSchedule.eventKey, assignments);
    await refreshAssignments();

    // Push shifts + assignments to Supabase
    if (isSupabaseConfigured() && user) {
      await pushShifts(activeSchedule.eventKey, scoutShifts, user.id);
      await pushAssignments(activeSchedule.eventKey, assignments, user.id);
    }
  }

  async function handleChangeGroup(userId: string, group: MemberGroup | null) {
    await updateMemberGroup(userId, group);
    setTeamProfiles(await fetchAllProfiles());
  }

  async function handleChangeRole(userId: string, role: "scouter" | "lead") {
    await updateMemberRole(userId, role);
    setTeamProfiles(await fetchAllProfiles());
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

  function updatePreMatch<K extends keyof MatchDraft["preMatch"]>(
    field: K,
    value: MatchDraft["preMatch"][K],
  ) {
    updateDraft((c) => ({ ...c, preMatch: { ...c.preMatch, [field]: value } }));
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

  function startMatch() {
    setStep("waiting");
    updateDraft((c) => ({ ...c, currentStep: "waiting" }));
  }

  function beginLiveMatch() {
    setElapsedBeforeResume(0);
    setMatchStartedAt(Date.now());
    setNow(Date.now());
    setStep("live");
    updateDraft((c) => ({ ...c, currentStep: "live", elapsedMs: 0 }));
  }

  function stopMatch() {
    endActiveAction();
    const stoppedAt = currentElapsedMs();
    setElapsedBeforeResume(stoppedAt);
    setMatchStartedAt(null);
    setStep("postmatch");
    updateDraft((c) => ({ ...c, currentStep: "postmatch", elapsedMs: stoppedAt }));
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

  const marked = new Set(draft.eventMarks.map((m) => m.type));

  // Step indicator state
  const stepIndex = { select: 0, prematch: 1, waiting: 2, live: 2, postmatch: 3, complete: 4 }[step];

  // Live countdown (counts down from 2:40 during live match)
  const countdownRemainingMs = Math.max(0, MATCH_DURATION_MS - elapsedMs);
  const matchExpired = step === "live" && countdownRemainingMs <= 0;

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

  // Gate: group selection (first-time onboarding)
  if (profile && !profile.group) {
    return (
      <div className="app-shell">
        <GroupSelect
          onSelect={async (group: MemberGroup) => {
            await updateProfileGroup(user.id, group);
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
                {/* ── Primary: Assignment Card ── */}
                {nextAssignment ? (
                  <section
                    className={`panel assignment-hero ${nextAssignment.alliance}`}
                    onClick={() => selectAssignment(nextAssignment)}
                  >
                    <div className="assignment-header">
                      <span className="assignment-eyebrow">Your next match</span>
                      {nexusState?.available && (() => {
                        const eta = getMatchEtaMs(nexusState, nextAssignment.matchNumber);
                        return eta ? (
                          <span className="assignment-eta">Starts in {formatEta(eta)}</span>
                        ) : null;
                      })()}
                    </div>
                    <div className="assignment-main">
                      <div>
                        <h1 className="assignment-match">{nextAssignment.label}</h1>
                        <span className="assignment-team">Team {nextAssignment.teamNumber}</span>
                      </div>
                      <div className="assignment-station">
                        {nextAssignment.station.toUpperCase().replace(/(\d)/, " $1")}
                      </div>
                    </div>
                    <div className="assignment-action">
                      <IconChevronRight size={20} />
                    </div>
                  </section>
                ) : scoutAssignments.length > 0 ? (
                  <section className="panel">
                    <div className="empty" style={{ textAlign: "center", padding: 16 }}>
                      <IconCheckCircle size={28} style={{ color: "var(--green)", marginBottom: 8 }} />
                      <p style={{ fontWeight: 700 }}>All caught up</p>
                      <p className="muted small">No more assignments for you right now.</p>
                    </div>
                  </section>
                ) : null}

                {/* ── Secondary: Schedule Quick-Pick ── */}
                {activeSchedule && (
                  <section className="panel schedule-picker">
                    <div className="section-head">
                      <div>
                        <h2 style={{ fontSize: 15 }}>{activeSchedule.eventKey.toUpperCase()}</h2>
                        <p className="muted small">{activeSchedule.matchCount} qual matches</p>
                      </div>
                    </div>

                    <div className="match-chip-row">
                      {previewMatches.map((match) => (
                        <button
                          key={match.id}
                          className={`match-chip ${draft.matchNumber === String(match.matchNumber) ? "selected" : ""}`}
                          onClick={() => selectScheduledMatch(match)}
                        >
                          {match.label}
                        </button>
                      ))}
                    </div>

                    {selectedScheduledMatch && (
                      <div className="robot-grid top-space">
                        {selectedScheduledMatch.robots.map((robot) => (
                          <button
                            key={`${selectedScheduledMatch.id}-${robot.station}`}
                            className={`robot-pick ${robot.alliance} ${
                              draft.teamNumber === robot.teamNumber ? "selected" : ""
                            }`}
                            onClick={() => selectScheduledRobot(selectedScheduledMatch, robot)}
                          >
                            <span>{robot.station.toUpperCase()}</span>
                            <strong>{robot.teamNumber}</strong>
                          </button>
                        ))}
                      </div>
                    )}
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
                        <button className="button primary" style={{ marginLeft: "auto" }} onClick={() => goTo("prematch")}>
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
                        {["zone_1", "zone_2", "zone_3", "zone_4", "zone_5"].map((zone, i) => (
                          <button
                            className={`zone ${draft.preMatch.startingPose === zone ? "selected" : ""}`}
                            key={zone}
                            onClick={() => updatePreMatch("startingPose", zone)}
                          >
                            Z{i + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="button-row">
                      <Choice selected={draft.preMatch.startingPose === "unknown"} onClick={() => updatePreMatch("startingPose", "unknown")}>
                        Unknown
                      </Choice>
                      <Choice selected={draft.preMatch.startingPose === "not_on_field"} onClick={() => updatePreMatch("startingPose", "not_on_field")}>
                        Not on field
                      </Choice>
                    </div>
                  </div>
                  <OptionGroup
                    title="Robot Status"
                    options={[
                      ["present", "Present"],
                      ["not_present", "Not present"],
                      ["problem_visible", "Problem visible"],
                      ["unknown", "Unknown"],
                    ]}
                    value={draft.preMatch.robotStatus}
                    onChange={(v) => updatePreMatch("robotStatus", v)}
                  />
                  <div className="button-row">
                    <button className="button ghost" onClick={() => goTo("select")}>Back</button>
                    <button className="button primary" style={{ marginLeft: "auto" }} onClick={startMatch}>
                      Start Match
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
                <div className="waiting-screen">
                  <span className="waiting-label">Ready</span>
                  <div className="countdown running">2:40</div>
                  <p className="muted">Tap anywhere to start the match timer</p>
                </div>
              </section>
            )}

            {step === "live" && (
              <LiveMatch
                draft={draft}
                elapsedMs={elapsedMs}
                countdownRemainingMs={countdownRemainingMs}
                matchExpired={matchExpired}
                activeAction={activeAction}
                marked={marked}
                startAction={startAction}
                stopMatch={stopMatch}
                toggleMark={toggleMark}
                markIncap={markIncap}
                undoLast={undoLast}
                updateDraft={updateDraft}
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
                        const newDraft = createEmptyDraft();
                        setDraft(newDraft);
                        setStep("select");
                        setSaveStatus("Ready");
                        if (nextAssignment) selectAssignment(nextAssignment);
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

        {view === "lead" && (
          <LeadView
            activeSchedule={activeSchedule}
            profiles={teamProfiles}
            shifts={scoutShifts}
            assignments={scoutAssignments}
            submissions={latest}
            onAutoGenerate={() => { void handleAutoGenerateShifts(); }}
            onSaveShift={(s) => { void handleSaveShift(s); }}
            onDeleteShift={(id) => { void handleDeleteShift(id); }}
            onUpdateShifts={(s) => { void handleUpdateShifts(s); }}
            onGenerateAndPush={() => { void handleGenerateAndPush(); }}
            onChangeGroup={(uid, g) => { void handleChangeGroup(uid, g); }}
            onChangeRole={(uid, r) => { void handleChangeRole(uid, r); }}
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
            syncSupabase={() => { void syncSupabaseNow(); }}
            exportJson={exportJson}
            importJson={importJson}
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
