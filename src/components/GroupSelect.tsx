import { useState } from "react";
import { IconGraduationCap, IconUser } from "../icons";
import { DEFAULT_PARENT_AVAILABILITY, PARENT_AVAILABILITY_SLOTS } from "../availability";
import type { MemberGroup } from "../types";

export function GroupSelect({
  onSelect,
  initialGroup = null,
}: {
  onSelect: (group: MemberGroup, availability: string[] | null) => void;
  initialGroup?: MemberGroup | null;
}) {
  const [selectedGroup, setSelectedGroup] = useState<MemberGroup | null>(initialGroup);
  const [availability, setAvailability] = useState<string[]>(DEFAULT_PARENT_AVAILABILITY);

  function toggleAvailability(slotId: string) {
    setAvailability((current) =>
      current.includes(slotId)
        ? current.filter((id) => id !== slotId)
        : [...current, slotId],
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card group-select">
        <div className="login-brand">
          <strong>9470 Scout</strong>
          <p>One quick thing before we start —</p>
        </div>
        <h2>I am a…</h2>
        <div className="group-options">
          <button
            className={`group-option student ${selectedGroup === "student" ? "selected" : ""}`}
            onClick={() => {
              setSelectedGroup("student");
              onSelect("student", null);
            }}
          >
            <span className="group-icon"><IconGraduationCap size={28} /></span>
            <div className="group-text">
              <span className="group-label">Student</span>
              <span className="group-desc">Team member</span>
            </div>
          </button>
          <button
            className={`group-option parent ${selectedGroup === "parent" ? "selected" : ""}`}
            onClick={() => setSelectedGroup("parent")}
          >
            <span className="group-icon"><IconUser size={28} /></span>
            <div className="group-text">
              <span className="group-label">Parent / Mentor</span>
              <span className="group-desc">Support crew</span>
            </div>
          </button>
        </div>
        {selectedGroup === "parent" && (
          <div className="parent-availability">
            <h3>Archimedes availability</h3>
            <div className="parent-availability-grid">
              {PARENT_AVAILABILITY_SLOTS.map((slot) => (
                <label className="availability-check" key={slot.id}>
                  <input
                    type="checkbox"
                    checked={availability.includes(slot.id)}
                    onChange={() => toggleAvailability(slot.id)}
                  />
                  <span>{slot.label}</span>
                </label>
              ))}
            </div>
            <button
              className="button primary"
              onClick={() => onSelect("parent", availability)}
              disabled={availability.length === 0}
            >
              Continue
            </button>
          </div>
        )}
        <p className="muted small" style={{ marginTop: 16, textAlign: "center" }}>
          This helps the scout lead balance assignments.
          <br />You can change this later.
        </p>
      </div>
    </div>
  );
}
