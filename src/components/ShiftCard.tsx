import { IconGraduationCap, IconSwap, IconUser } from "../icons";
import type { ScoutShift, ShiftSlot, StationType, TeamMember } from "../types";
export function ShiftCard({
  shift,
  profiles,
  onSlotClick,
  onEdit,
  onDelete,
}: {
  shift: ScoutShift;
  profiles: TeamMember[];
  onSlotClick: (shift: ScoutShift, slot: ShiftSlot) => void;
  onEdit: (shift: ScoutShift) => void;
  onDelete: (shiftId: string) => void;
}) {
  const matchCount = shift.endMatch - shift.startMatch + 1;
  const totalSubs = shift.roster.reduce((t, s) => t + s.subs.length, 0);
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  return (
    <div className="shift-card">
      <div className="shift-header">
        <h3>{shift.name}</h3>
        <span className="shift-range">Q{shift.startMatch}–Q{shift.endMatch}</span>
      </div>

      <div className="station-grid">
        {(["red1", "red2", "red3", "blue1", "blue2", "blue3"] as StationType[]).map((station) => {
          const slot = shift.roster.find((s) => s.station === station);
          const alliance = station.startsWith("red") ? "red" : "blue";
          const label = station.toUpperCase().replace(/(\d)/, " $1");
          const profile = slot ? profileMap.get(slot.userId) : null;

          if (!slot) {
            return (
              <button
                key={station}
                className={`station-slot empty ${alliance}`}
                onClick={() =>
                  onEdit(shift)
                }
              >
                <span className={`station-label ${alliance}`}>{label}</span>
                <span>+</span>
              </button>
            );
          }

          return (
            <button
              key={station}
              className={`station-slot ${alliance}`}
              onClick={() => onSlotClick(shift, slot)}
            >
              <span className={`station-label ${alliance}`}>{label}</span>
              <span className="station-name">{slot.displayName}</span>
              <span className="station-group">
                {profile?.group === "student"
                  ? <IconGraduationCap size={12} />
                  : profile?.group === "parent"
                    ? <IconUser size={12} />
                    : null}
                {slot.subs.length > 0 && <> <IconSwap size={11} />{slot.subs.length}</>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="shift-footer">
        <span>
          {matchCount} matches × {shift.roster.length}
          {totalSubs > 0 && <span className="sub-badge"> · {totalSubs} sub{totalSubs > 1 ? "s" : ""}</span>}
        </span>
        <div className="shift-actions">
          <button className="button ghost" style={{ minHeight: 32, padding: "0 10px", fontSize: 12 }} onClick={() => onEdit(shift)}>Edit</button>
          <button className="button ghost" style={{ minHeight: 32, padding: "0 10px", fontSize: 12 }} onClick={() => onDelete(shift.id)}>✕</button>
        </div>
      </div>
    </div>
  );
}
