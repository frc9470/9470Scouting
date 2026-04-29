import React, { useMemo, useState } from "react";
import { calculateWorkload, coveredAssignmentIds } from "../assignments";
import { IconAlertTriangle, IconFlag, IconGraduationCap, IconUser, IconZap } from "../icons";
import { groupMatchesByDay } from "../scheduleDays";
import { eventDisplayName } from "../eventLabels";
import { Metric } from "./Input";
import { ShiftCard } from "./ShiftCard";
import { SubSheet } from "./SubSheet";
import type {
  EventSchedule,
  MemberGroup,
  MatchSubmission,
  ScoutAssignment,
  ScoutShift,
  ScheduledMatch,
  ShiftSlot,
  StationType,
  SubOverride,
  TeamMember,
} from "../types";

export function LeadView({
  activeSchedule,
  profiles,
  shifts,
  assignments,
  submissions,
  onAutoGenerate,
  onSaveShift,
  onDeleteShift,
  onUpdateShifts,
  onGenerateAndPush,
  onChangeGroup,
  onChangeRole,
}: {
  activeSchedule: EventSchedule | null;
  profiles: TeamMember[];
  shifts: ScoutShift[];
  assignments: ScoutAssignment[];
  submissions: MatchSubmission[];
  onAutoGenerate: (matches?: ScheduledMatch[], members?: TeamMember[], dayLabel?: string) => void;
  onSaveShift: (shift: ScoutShift) => void;
  onDeleteShift: (id: string) => void;
  onUpdateShifts: (shifts: ScoutShift[]) => void;
  onGenerateAndPush: () => void;
  onChangeGroup: (userId: string, group: MemberGroup | null) => void;
  onChangeRole: (userId: string, role: "scouter" | "lead") => void;
}) {
  const [activeSlot, setActiveSlot] = useState<{ shift: ScoutShift; slot: ShiftSlot } | null>(null);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [showRoster, setShowRoster] = useState(false);
  const [selectedShiftDayId, setSelectedShiftDayId] = useState<string | null>(null);
  const [includedByDay, setIncludedByDay] = useState<Record<string, string[]>>({});

  const covered = coveredAssignmentIds(assignments, submissions);
  const totalAssignments = assignments.length;
  const coveragePct = totalAssignments > 0 ? Math.round((covered.size / totalAssignments) * 100) : 0;

  // Workload from shifts
  const workload = calculateWorkload(shifts);
  const students = profiles.filter((p) => p.group === "student");
  const parents = profiles.filter((p) => p.group === "parent");
  const unset = profiles.filter((p) => !p.group);
  const qualMatches = useMemo(
    () => activeSchedule?.matches.filter((match) => match.compLevel === "qm") ?? [],
    [activeSchedule],
  );
  const shiftDays = useMemo(() => groupMatchesByDay(qualMatches), [qualMatches]);
  const activeShiftDay = shiftDays.find((day) => day.id === selectedShiftDayId) ?? shiftDays[0] ?? null;
  const activeIncludedIds = activeShiftDay
    ? includedByDay[activeShiftDay.id] ?? profiles.map((profile) => profile.id)
    : [];
  const activeIncludedMembers = profiles.filter((profile) => activeIncludedIds.includes(profile.id));

  const studentAvg =
    students.length > 0
      ? Math.round(students.reduce((t, s) => t + (workload.get(s.id)?.matches ?? 0), 0) / students.length)
      : 0;
  const parentAvg =
    parents.length > 0
      ? Math.round(parents.reduce((t, p) => t + (workload.get(p.id)?.matches ?? 0), 0) / parents.length)
      : 0;

  // Detect gaps
  const qualCount = activeSchedule
    ? activeSchedule.matches.filter((m) => m.compLevel === "qm").length
    : 0;
  const coveredMatches = new Set<number>();
  for (const shift of shifts) {
    for (let m = shift.startMatch; m <= shift.endMatch; m++) coveredMatches.add(m);
  }
  const firstMatch = activeSchedule
    ? Math.min(...activeSchedule.matches.filter((m) => m.compLevel === "qm").map((m) => m.matchNumber))
    : 1;
  const lastMatch = activeSchedule
    ? Math.max(...activeSchedule.matches.filter((m) => m.compLevel === "qm").map((m) => m.matchNumber))
    : 0;
  const gaps: { start: number; end: number }[] = [];
  let gapStart: number | null = null;
  for (let m = firstMatch; m <= lastMatch; m++) {
    if (!coveredMatches.has(m)) {
      if (gapStart == null) gapStart = m;
    } else if (gapStart != null) {
      gaps.push({ start: gapStart, end: m - 1 });
      gapStart = null;
    }
  }
  if (gapStart != null) gaps.push({ start: gapStart, end: lastMatch });

  // Sub sheet handlers
  function handleAddSub(shiftId: string, station: StationType, sub: SubOverride) {
    const updated = shifts.map((s) => {
      if (s.id !== shiftId) return s;
      return {
        ...s,
        roster: s.roster.map((slot) => {
          if (slot.station !== station) return slot;
          return { ...slot, subs: [...slot.subs, sub] };
        }),
      };
    });
    onUpdateShifts(updated);
  }

  function handleRemoveSub(shiftId: string, station: StationType, subId: string) {
    const updated = shifts.map((s) => {
      if (s.id !== shiftId) return s;
      return {
        ...s,
        roster: s.roster.map((slot) => {
          if (slot.station !== station) return slot;
          return { ...slot, subs: slot.subs.filter((sub) => sub.id !== subId) };
        }),
      };
    });
    onUpdateShifts(updated);
  }

  function handleChangeSlotMember(shiftId: string, station: StationType, member: TeamMember) {
    const updated = shifts.map((s) => {
      if (s.id !== shiftId) return s;
      return {
        ...s,
        roster: s.roster.map((slot) => {
          if (slot.station !== station) return slot;
          return { ...slot, userId: member.id, displayName: member.display_name };
        }),
      };
    });
    onUpdateShifts(updated);
    setActiveSlot(null);
  }

  function renderWorkloadChips(members: TeamMember[], label: string, avg: number, icon: React.ReactNode) {
    if (members.length === 0) return null;
    return (
      <>
        <h3>
          {icon && <>{icon}{" "}</>}{label} ({members.length})
          <span>avg {avg}m</span>
        </h3>
        <div className="workload-chips">
          {members.map((m) => {
            const wl = workload.get(m.id);
            const matches = wl?.matches ?? 0;
            const isHeavy = avg > 0 && matches > avg * 1.5;
            return (
              <div className={`workload-chip ${isHeavy ? "heavy" : ""} ${matches === 0 ? "none" : ""}`} key={m.id}>
                <span>{m.display_name}</span>
                <span className="wl-count">{matches}</span>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  function toggleDayMember(dayId: string, userId: string) {
    setIncludedByDay((current) => {
      const existing = current[dayId] ?? profiles.map((profile) => profile.id);
      const next = existing.includes(userId)
        ? existing.filter((id) => id !== userId)
        : [...existing, userId];
      return { ...current, [dayId]: next };
    });
  }

  function setDayIncluded(dayId: string, userIds: string[]) {
    setIncludedByDay((current) => ({ ...current, [dayId]: userIds }));
  }

  return (
    <div className="grid">
      {/* Header + Coverage */}
      <section className="panel">
        <h1>Lead</h1>
        <p className="muted">
          {activeSchedule
            ? `${eventDisplayName(activeSchedule)} · ${qualCount} qual matches`
            : "Load a TBA schedule first"}
        </p>
        {totalAssignments > 0 && (
          <>
            <div className="metric-grid" style={{ marginTop: 10 }}>
              <Metric label="Assigned" value={totalAssignments} />
              <Metric label="Covered" value={covered.size} />
              <Metric label="Shifts" value={shifts.length} />
              <Metric label="Coverage" value={`${coveragePct}%`} />
            </div>
            <div className="coverage-bar-track">
              <div className="coverage-bar-fill" style={{ width: `${coveragePct}%` }} />
            </div>
          </>
        )}
      </section>

      {/* Workload */}
      {shifts.length > 0 && (
        <section className="panel">
          <div className="section-head">
            <h2>Workload</h2>
          </div>
          <div className="workload-section">
            {renderWorkloadChips(students, "Students", studentAvg, <IconGraduationCap size={14} />)}
            {renderWorkloadChips(parents, "Parents", parentAvg, <IconUser size={14} />)}
            {unset.length > 0 && renderWorkloadChips(unset, "Unset Group", 0, null)}
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Shift Generation</h2>
            <p className="muted small">Pick a day, exclude anyone unavailable, then generate that day only.</p>
          </div>
        </div>

        {shiftDays.length > 0 && (
          <div className="lead-day-tabs top-space">
            {shiftDays.map((day) => (
              <button
                key={day.id}
                className={`lead-day-tab ${activeShiftDay?.id === day.id ? "active" : ""}`}
                onClick={() => setSelectedShiftDayId(day.id)}
              >
                <strong>{day.label}</strong>
                <span>{day.dateLabel}</span>
                <em>Q{day.matches[0]?.matchNumber}–Q{day.matches[day.matches.length - 1]?.matchNumber}</em>
              </button>
            ))}
          </div>
        )}

        {activeShiftDay && (
          <div className="day-availability top-space">
            <div className="day-availability-head">
              <span>{activeIncludedMembers.length}/{profiles.length} available</span>
              <div>
                <button
                  className="link-button"
                  onClick={() => setDayIncluded(activeShiftDay.id, profiles.map((profile) => profile.id))}
                >
                  All
                </button>
                <button
                  className="link-button"
                  onClick={() => setDayIncluded(activeShiftDay.id, [])}
                >
                  None
                </button>
              </div>
            </div>
            <div className="availability-grid">
              {profiles.map((profile) => {
                const included = activeIncludedIds.includes(profile.id);
                return (
                  <button
                    key={profile.id}
                    className={`availability-chip ${included ? "included" : ""}`}
                    onClick={() => toggleDayMember(activeShiftDay.id, profile.id)}
                  >
                    <span>{profile.display_name}</span>
                    <em>{included ? "In" : "Out"}</em>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="button-row top-space">
          <button
            className="button primary"
            onClick={() => {
              if (!activeShiftDay) return;
              onAutoGenerate(activeShiftDay.matches, activeIncludedMembers, activeShiftDay.label);
            }}
            disabled={!activeSchedule || !activeShiftDay || activeIncludedMembers.length === 0}
          >
            <IconZap size={16} /> Generate {activeShiftDay?.label ?? "Day"} Shifts
          </button>
          <button
            className="button ghost"
            onClick={() => setShowRoster(!showRoster)}
          >
            {showRoster ? "Hide Roster" : "Roster"}
          </button>
        </div>
        {shifts.length > 0 && (
          <div className="button-row" style={{ marginTop: 8 }}>
            <button className="button primary" onClick={onGenerateAndPush}>
              <IconFlag size={16} /> Generate & Push
            </button>
          </div>
        )}
      </section>

      {/* Roster (collapsible) */}
      {showRoster && (
        <section className="panel">
          <div className="section-head">
            <h2>Team Roster</h2>
            <span className="muted small">{profiles.length} registered</span>
          </div>
          {profiles.length > 0 ? (
            <div className="scouter-list top-space">
              {profiles.map((p) => (
                <div className="roster-row" key={p.id}>
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="scouter-avatar" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="scouter-avatar placeholder"><IconUser size={16} /></div>
                  )}
                  <div className="roster-name">
                    <span>{p.display_name}</span>
                  </div>
                  <div className="roster-pills">
                    <button
                      className={`roster-pill ${p.group === "student" ? "active student" : p.group === "parent" ? "active parent" : ""}`}
                      onClick={() => {
                        const next = p.group === "student" ? "parent" : p.group === "parent" ? null : "student";
                        onChangeGroup(p.id, next as MemberGroup | null);
                      }}
                    >
                      {p.group === "student" ? <><IconGraduationCap size={12} /> Student</> :
                       p.group === "parent" ? <><IconUser size={12} /> Parent</> :
                       "Set group"}
                    </button>
                    <button
                      className={`roster-pill role ${p.role === "lead" ? "active lead" : ""}`}
                      onClick={() => onChangeRole(p.id, p.role === "lead" ? "scouter" : "lead")}
                    >
                      {p.role === "lead" ? "★ Lead" : "Scouter"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty top-space">
              No team members registered yet. Have scouters sign in with Google.
            </div>
          )}
        </section>
      )}

      {/* Gap warnings */}
      {gaps.map((gap) => (
        <div className="gap-warning" key={`${gap.start}-${gap.end}`}>
          <IconAlertTriangle size={16} /> Q{gap.start}–Q{gap.end} have no shift assigned
        </div>
      ))}

      {/* Shift Cards */}
      {shifts.map((shift) => (
        <ShiftCard
          key={shift.id}
          shift={shift}
          profiles={profiles}
          onSlotClick={(s, slot) => setActiveSlot({ shift: s, slot })}
          onEdit={(s) => setEditingShiftId(s.id)}
          onDelete={onDeleteShift}
        />
      ))}

      {shifts.length === 0 && activeSchedule && (
        <section className="panel">
          <div className="empty" style={{ textAlign: "center", padding: 20 }}>
            <p>No shifts created yet.</p>
            <p className="muted small">
              Pick a day above and generate balanced shifts,
              <br />or manually add shifts.
            </p>
          </div>
        </section>
      )}

      {/* Sub Sheet */}
      {activeSlot && (
        <SubSheet
          shift={activeSlot.shift}
          slot={activeSlot.slot}
          availableMembers={profiles}
          onAddSub={handleAddSub}
          onRemoveSub={handleRemoveSub}
          onChangeSlotMember={handleChangeSlotMember}
          onClose={() => setActiveSlot(null)}
        />
      )}
    </div>
  );
}
