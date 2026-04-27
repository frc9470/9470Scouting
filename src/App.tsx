import React, { useEffect, useMemo, useState } from "react";
import { generateScoutAssignments, nextAssignmentForScouter } from "./assignments";
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
  listScouterProfiles,
  listSubmissions,
  deleteScouterProfile,
  replaceScoutAssignments,
  saveEventSchedule,
  saveDraft,
  saveScouterProfile,
  saveSubmission,
} from "./db";
import { IconClipboard, IconBarChart, IconHardDrive, IconCheckCircle, IconFlag } from "./icons";
import { Input, Choice, OptionGroup } from "./components/Input";
import { LiveMatch } from "./components/LiveMatch";
import { PostMatch } from "./components/PostMatch";
import { Dashboard } from "./components/Dashboard";
import { DataView } from "./components/DataView";
import { LeadView } from "./components/LeadView";
import { fetchTbaEventSchedule } from "./tba";
import type {
  ActionInterval,
  ActionKey,
  EventSchedule,
  MatchDraft,
  MatchStep,
  MatchSubmission,
  ScoutAssignment,
  ScouterProfile,
  ScheduledMatch,
  ScheduledRobot,
  View,
} from "./types";

const SECOND = 1000;
const MATCH_DURATION_MS = 160 * SECOND; // 2:40

export function App() {
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
  const [scouterProfiles, setScouterProfiles] = useState<ScouterProfile[]>([]);
  const [scoutAssignments, setScoutAssignments] = useState<ScoutAssignment[]>([]);
  const [newScouterName, setNewScouterName] = useState("");
  const [tbaEventKey, setTbaEventKeyState] = useState(
    () => localStorage.getItem("team9470.tbaEventKey") ?? "",
  );
  const [tbaStatus, setTbaStatus] = useState("Not loaded");

  useEffect(() => { void initialize(); }, []);

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
    () => nextAssignmentForScouter(scoutAssignments, latest, draft.scouterName),
    [draft.scouterName, latest, scoutAssignments],
  );

  async function refreshSubmissions() { setSubmissions(await listSubmissions()); }
  async function refreshEventSchedules() { setEventSchedules(await listEventSchedules()); }
  async function refreshScouters() { setScouterProfiles(await listScouterProfiles()); }
  async function refreshAssignments() { setScoutAssignments(await listScoutAssignments()); }

  async function initialize() {
    const savedDraft = await getLatestDraft();
    await refreshSubmissions();
    await refreshEventSchedules();
    await refreshScouters();
    await refreshAssignments();
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
    } catch (error) {
      setTbaStatus(error instanceof Error ? error.message : "TBA import failed");
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

  async function addScouter() {
    const name = newScouterName.trim();
    if (!name) return;
    if (scouterProfiles.some((scouter) => scouter.name.trim().toLowerCase() === name.toLowerCase())) {
      setNewScouterName("");
      return;
    }
    await saveScouterProfile({
      id: createId("scouter"),
      name,
      active: true,
      createdAt: new Date().toISOString(),
    });
    setNewScouterName("");
    await refreshScouters();
  }

  async function removeScouter(id: string) {
    await deleteScouterProfile(id);
    await refreshScouters();
  }

  async function generateAssignments() {
    if (!activeSchedule) return;
    const assignments = generateScoutAssignments(activeSchedule, scouterProfiles);
    await replaceScoutAssignments(activeSchedule.eventKey, assignments);
    await refreshAssignments();
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
    await refreshScouters();
    await refreshAssignments();
  }

  const marked = new Set(draft.eventMarks.map((m) => m.type));

  // Step indicator state
  const stepIndex = { select: 0, prematch: 1, waiting: 2, live: 2, postmatch: 3, complete: 4 }[step];

  // Live countdown (counts down from 2:40 during live match)
  const countdownRemainingMs = Math.max(0, MATCH_DURATION_MS - elapsedMs);
  const matchExpired = step === "live" && countdownRemainingMs <= 0;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>9470 Scout</strong>
          <span>Device {getDeviceId().slice(-6)}</span>
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
                    {draft.scouterName || "Unnamed"}
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
                {nextAssignment && (
                  <section className={`panel next-assignment ${nextAssignment.alliance}`}>
                    <div>
                      <span className="waiting-label">Next Assignment</span>
                      <h1>{nextAssignment.label} · Team {nextAssignment.teamNumber}</h1>
                      <p className="muted">
                        {nextAssignment.station.toUpperCase()} · {nextAssignment.eventKey.toUpperCase()}
                      </p>
                    </div>
                    <button className="button primary" onClick={() => selectAssignment(nextAssignment)}>
                      Use Assignment
                    </button>
                  </section>
                )}

                {activeSchedule && (
                  <section className="panel schedule-picker">
                    <div className="section-head">
                      <div>
                        <h1>{activeSchedule.eventKey.toUpperCase()}</h1>
                        <p className="muted">TBA match schedule</p>
                      </div>
                      <span className="status-pill">{activeSchedule.matchCount} matches</span>
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

                    {selectedScheduledMatch ? (
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
                    ) : (
                      <p className="muted small top-space">Enter or choose a qualification match to pick from its six teams.</p>
                    )}
                  </section>
                )}

                <section className="panel">
                  <h1>New Match</h1>
                  <p className="muted">Select the robot you are scouting.</p>
                  <div className="form-grid top-space">
                    <Input label="Scouter name" value={draft.scouterName} onChange={(v) => updateField("scouterName", v)} />
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
                  <p className="muted">Saved locally and queued for sync.</p>
                  <div className="button-row">
                    <button
                      className="button primary"
                      onClick={() => {
                        setDraft(createEmptyDraft());
                        setStep("select");
                        setSaveStatus("Ready");
                      }}
                    >
                      Scout Next
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
            scouters={scouterProfiles}
            assignments={scoutAssignments}
            submissions={latest}
            newScouterName={newScouterName}
            setNewScouterName={setNewScouterName}
            addScouter={() => { void addScouter(); }}
            removeScouter={(id) => { void removeScouter(id); }}
            generateAssignments={() => { void generateAssignments(); }}
          />
        )}

        {view === "data" && (
          <DataView
            submissions={submissions}
            schedules={eventSchedules}
            tbaEventKey={tbaEventKey}
            tbaStatus={tbaStatus}
            setTbaEventKey={setTbaEventKey}
            fetchTbaSchedule={() => { void pullTbaSchedule(); }}
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
        <button className={`tab-item ${view === "lead" ? "active" : ""}`} onClick={() => setView("lead")}>
          <IconFlag size={20} />
          <span>Lead</span>
        </button>
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
