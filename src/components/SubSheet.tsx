import { useState } from "react";
import { createId } from "../domain";
import type { ScoutShift, ShiftSlot, StationType, SubOverride, TeamMember } from "../types";

const STATIONS: StationType[] = ["red1", "red2", "red3", "blue1", "blue2", "blue3"];
const REASONS: { value: SubOverride["reason"]; label: string }[] = [
  { value: "break", label: "Break" },
  { value: "pit", label: "Pit Duty" },
  { value: "our_match", label: "Our Match" },
  { value: "other", label: "Other" },
];

export function SubSheet({
  shift,
  slot,
  availableMembers,
  onAddSub,
  onRemoveSub,
  onChangeSlotMember,
  onClose,
}: {
  shift: ScoutShift;
  slot: ShiftSlot;
  availableMembers: TeamMember[];
  onAddSub: (shiftId: string, station: StationType, sub: SubOverride) => void;
  onRemoveSub: (shiftId: string, station: StationType, subId: string) => void;
  onChangeSlotMember: (shiftId: string, station: StationType, member: TeamMember) => void;
  onClose: () => void;
}) {
  const [subUserId, setSubUserId] = useState("");
  const [startMatch, setStartMatch] = useState(shift.startMatch);
  const [endMatch, setEndMatch] = useState(Math.min(shift.startMatch + 2, shift.endMatch));
  const [reason, setReason] = useState<SubOverride["reason"]>("break");
  const [showForm, setShowForm] = useState(false);

  const alliance = slot.station.startsWith("red") ? "red" : "blue";
  const stationLabel = slot.station.toUpperCase().replace(/(\d)/, " $1");

  function handleAddSub() {
    const member = availableMembers.find((m) => m.id === subUserId);
    if (!member || startMatch > endMatch) return;
    onAddSub(shift.id, slot.station, {
      id: createId("sub"),
      startMatch,
      endMatch,
      userId: member.id,
      displayName: member.display_name,
      reason,
    });
    setShowForm(false);
    setSubUserId("");
  }

  return (
    <div className="sub-sheet-backdrop" onClick={onClose}>
      <div className="sub-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>
          <span className={`station-label ${alliance}`}>{stationLabel}</span> · {slot.displayName}
        </h3>
        <p className="muted small">
          Primary for Q{shift.startMatch}–Q{shift.endMatch}
          {slot.subs.length > 0 && ` · ${slot.subs.length} sub${slot.subs.length > 1 ? "s" : ""}`}
        </p>

        {slot.subs.length > 0 && (
          <div className="sub-list">
            {slot.subs.map((sub) => (
              <div className="sub-item" key={sub.id}>
                <span>
                  Q{sub.startMatch}–Q{sub.endMatch} → {sub.displayName}
                  {sub.reason && ` (${sub.reason.replace("_", " ")})`}
                </span>
                <button
                  className="button ghost"
                  style={{ minHeight: 32, padding: "0 8px", fontSize: 12 }}
                  onClick={() => onRemoveSub(shift.id, slot.station, sub.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <div className="sub-form">
            <div className="field">
              <span>Substitute</span>
              <select value={subUserId} onChange={(e) => setSubUserId(e.target.value)}>
                <option value="">Select person…</option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name} {m.group ? `(${m.group})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="inline-row">
              <span>From Q</span>
              <input
                type="number"
                value={startMatch}
                min={shift.startMatch}
                max={shift.endMatch}
                onChange={(e) => setStartMatch(Number(e.target.value))}
                style={{ width: 64, minHeight: 38 }}
              />
              <span>to Q</span>
              <input
                type="number"
                value={endMatch}
                min={startMatch}
                max={shift.endMatch}
                onChange={(e) => setEndMatch(Number(e.target.value))}
                style={{ width: 64, minHeight: 38 }}
              />
            </div>
            <div className="reason-chips">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  className={`reason-chip ${reason === r.value ? "selected" : ""}`}
                  onClick={() => setReason(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="button-row">
              <button
                className="button primary"
                onClick={handleAddSub}
                disabled={!subUserId || startMatch > endMatch}
              >
                Add Sub
              </button>
              <button className="button ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="button-row" style={{ marginTop: 12 }}>
            <button className="button ghost" onClick={() => setShowForm(true)}>
              + Add Sub
            </button>
            <button
              className="button ghost"
              onClick={() => {
                // Show a quick picker for changing the primary
                const newId = window.prompt(
                  "Enter new person's name or pick from the list",
                );
                if (!newId) return;
                const member = availableMembers.find(
                  (m) => m.display_name.toLowerCase().includes(newId.toLowerCase()),
                );
                if (member) onChangeSlotMember(shift.id, slot.station, member);
              }}
            >
              Change Primary
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
