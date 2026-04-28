import { IconGraduationCap, IconUser } from "../icons";
import type { MemberGroup } from "../types";

export function GroupSelect({
  onSelect,
}: {
  onSelect: (group: MemberGroup) => void;
}) {
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
            className="group-option student"
            onClick={() => onSelect("student")}
          >
            <span className="group-icon"><IconGraduationCap size={28} /></span>
            <div className="group-text">
              <span className="group-label">Student</span>
              <span className="group-desc">Team member</span>
            </div>
          </button>
          <button
            className="group-option parent"
            onClick={() => onSelect("parent")}
          >
            <span className="group-icon"><IconUser size={28} /></span>
            <div className="group-text">
              <span className="group-label">Parent / Mentor</span>
              <span className="group-desc">Support crew</span>
            </div>
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 16, textAlign: "center" }}>
          This helps the scout lead balance assignments.
          <br />You can change this later.
        </p>
      </div>
    </div>
  );
}
