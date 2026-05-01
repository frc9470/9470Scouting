import { ACTIONS, INCAP_STATUSES } from "../constants";
import { formatMatchTime } from "../domain";
import { IconRotateCcw } from "../icons";
import { AutoPrompts } from "./AutoPrompts";
import { OptionGroup } from "./Input";
import type { ActionKey, MatchDraft } from "../types";

export function LiveMatch({
  draft,
  elapsedMs,
  matchPhase,
  matchExpired,
  activeAction,
  marked,
  startAction,
  stopMatch,
  toggleMark,
  markIncap,
  undoLast,
  updateDraft,
  onBackToSelection,
}: {
  draft: MatchDraft;
  elapsedMs: number;
  matchPhase: {
    key: "auto" | "transition" | "teleop" | "over";
    label: string;
    remainingMs: number;
  };
  matchExpired: boolean;
  activeAction: ActionKey;
  marked: Set<string>;
  startAction: (action: ActionKey, event: React.PointerEvent<HTMLButtonElement>) => void;
  stopMatch: () => void;
  toggleMark: (type: "notable" | "foul_concern" | "incap") => void;
  markIncap: () => void;
  undoLast: () => void;
  updateDraft: (updater: (current: MatchDraft) => MatchDraft) => void;
  onBackToSelection: () => void;
}) {
  return (
    <section className="panel live-layout">
      <div className="live-head">
        <div>
          <div className={`phase-label phase-${matchPhase.key}`}>
            {matchPhase.label}
          </div>
          <div className={`timer phase-${matchPhase.key} ${matchExpired ? "timer-expired" : ""}`}>
            {formatMatchTime(matchPhase.remainingMs)}
          </div>
        </div>
        <div className="button-row">
          <button className="button ghost" onClick={onBackToSelection}>
            Back
          </button>
          <button className="button ghost" onClick={undoLast}>
            <IconRotateCcw size={16} /> Undo
          </button>
          <button className={`button ${matchExpired ? "danger" : "primary"}`} onClick={stopMatch}>
            End Match
          </button>
        </div>
      </div>

      {matchExpired && (
        <div className="notice" style={{ justifyContent: "center", textAlign: "center" }}>
          Match time elapsed — end match when ready
        </div>
      )}

      {matchPhase.key === "transition" && (
        <section className="transition-prompts">
          <div className="notice" style={{ justifyContent: "center", textAlign: "center" }}>
            Auto ended — teleop starts in {formatMatchTime(matchPhase.remainingMs)}
          </div>
          <AutoPrompts draft={draft} updateDraft={updateDraft} compact />
        </section>
      )}

      <div className="action-grid">
        {ACTIONS.map(({ key, label, Icon }) => (
          <button
            className={`action-button action-${key} ${activeAction === key ? "active" : ""} ${
              activeAction === key && key !== "driving" ? "recording" : ""
            }`}
            key={key}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => startAction(key, event)}
          >
            <Icon size={26} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="flag-row">
        <button
          className={`button ${marked.has("notable") ? "primary" : ""}`}
          onClick={() => toggleMark("notable")}
        >
          Notable
        </button>
        <button
          className={`button ${marked.has("foul_concern") ? "primary" : ""}`}
          onClick={() => toggleMark("foul_concern")}
        >
          Foul
        </button>
        <button className="button danger" onClick={markIncap}>
          Incap
        </button>
      </div>

      {draft.incap.occurred && (
        <IncapPanel draft={draft} elapsedMs={elapsedMs} updateDraft={updateDraft} />
      )}
    </section>
  );
}

function IncapPanel({
  draft,
  elapsedMs,
  updateDraft,
}: {
  draft: MatchDraft;
  elapsedMs: number;
  updateDraft: (updater: (current: MatchDraft) => MatchDraft) => void;
}) {
  return (
    <section className="incap-panel">
      <h2>⚠ Incap Recorded</h2>
      <OptionGroup
        title="Severity"
        options={[
          ["partial", "Partial"],
          ["full", "Full"],
          ["unknown", "Unknown"],
        ]}
        value={draft.incap.severity}
        onChange={(value) =>
          updateDraft((c) => ({ ...c, incap: { ...c.incap, severity: value } }))
        }
      />
      <OptionGroup
        title="Observable Status"
        options={INCAP_STATUSES}
        value={draft.incap.observableStatus}
        onChange={(value) =>
          updateDraft((c) => ({ ...c, incap: { ...c.incap, observableStatus: value } }))
        }
      />
      <div className="button-row top-space">
        <button
          className={`button ${draft.incap.recovered ? "primary" : ""}`}
          onClick={() =>
            updateDraft((c) => ({
              ...c,
              incap: { ...c.incap, recovered: true, endMs: c.incap.endMs ?? elapsedMs },
            }))
          }
        >
          Recovered
        </button>
      </div>
    </section>
  );
}
