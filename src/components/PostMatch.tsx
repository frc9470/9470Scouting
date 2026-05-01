import { NOTABLE_REASONS } from "../constants";
import { missingRequiredFields, summarizeIntervals } from "../domain";
import { IconAlertTriangle } from "../icons";
import { AutoPrompts } from "./AutoPrompts";
import { Choice, Metric, OptionGroup, StarRating } from "./Input";
import type { MatchDraft } from "../types";

export function PostMatch({
  draft,
  elapsedMs,
  updatePostMatch,
  updateDraft,
  submitMatch,
  goTo,
  onBackToSelection,
}: {
  draft: MatchDraft;
  elapsedMs: number;
  updatePostMatch: <K extends keyof MatchDraft["postMatch"]>(
    field: K,
    value: MatchDraft["postMatch"][K],
  ) => void;
  updateDraft: (updater: (current: MatchDraft) => MatchDraft) => void;
  submitMatch: () => void;
  goTo: (step: "select" | "prematch" | "live" | "postmatch" | "complete") => void;
  onBackToSelection: () => void;
}) {
  const summary = summarizeIntervals(draft.actionIntervals, elapsedMs);
  const missing = missingRequiredFields(draft);
  const hasNotable = draft.eventMarks.some((m) => m.type === "notable");

  return (
    <section className="panel">
      <h1>Post-Match</h1>
      <p className="muted">Convert observations into strategy data.</p>

      <div className="metric-grid summary-grid">
        <Metric className="metric-action metric-driving" label="Driving" value={`${Math.round(summary.drivingMs / 1000)}s`} />
        <Metric className="metric-action metric-intaking" label="Intaking" value={`${Math.round(summary.intakingMs / 1000)}s`} />
        <Metric className="metric-action metric-scoring" label="Scoring" value={`${Math.round(summary.scoringMs / 1000)}s`} />
        <Metric className="metric-action metric-defense" label="Defense" value={`${Math.round(summary.defenseMs / 1000)}s`} />
        <Metric className="metric-action metric-feeding" label="Feeding" value={`${Math.round(summary.feedingMs / 1000)}s`} />
        <Metric className="metric-action metric-blocked" label="Blocked" value={`${Math.round(summary.blockedMs / 1000)}s`} />
        <Metric className="metric-action metric-beached" label="Beached" value={`${Math.round(summary.beachedMs / 1000)}s`} />
        <Metric className="metric-action metric-missing" label="Missing" value={`${Math.round(summary.missingMs / 1000)}s`} />
      </div>

      <div className="postmatch-sections top-space">
        <AutoPrompts draft={draft} updateDraft={updateDraft} />
        <OptionGroup
          title="BPS estimate"
          options={[
            ["<5", "<5"],
            ["10", "10"],
            ["20", "20"],
            ["25+", "25+"],
            ["unknown", "Not sure"],
          ] as const}
          value={draft.postMatch.bpsEstimate}
          onChange={(v) => updatePostMatch("bpsEstimate", v as MatchDraft["postMatch"]["bpsEstimate"])}
        />
        <StarRating
          title="Driver skill"
          value={draft.postMatch.driverSkill}
          onChange={(v) => updatePostMatch("driverSkill", v as MatchDraft["postMatch"]["driverSkill"])}
        />
        <StarRating
          title="Defense effectiveness"
          value={draft.postMatch.defenseEffectiveness === "not_observed" ? "" : draft.postMatch.defenseEffectiveness}
          onChange={(v) => updatePostMatch("defenseEffectiveness", (v || "not_observed") as MatchDraft["postMatch"]["defenseEffectiveness"])}
        />
        <OptionGroup
          title="Can steal"
          options={[
            ["none", "None"],
            ["partial", "Partial"],
            ["full", "Full"],
            ["not_observed", "Not observed"],
          ] as const}
          value={draft.postMatch.canSteal}
          onChange={(v) => updatePostMatch("canSteal", v as MatchDraft["postMatch"]["canSteal"])}
        />
      </div>

      {hasNotable && (
        <section className="top-space">
          <h2>Notable Reason</h2>
          <div className="segmented">
            {NOTABLE_REASONS.map(([value, label]) => {
              const selected = draft.postMatch.notableReasons.includes(value);
              return (
                <Choice
                  key={value}
                  selected={selected}
                  onClick={() =>
                    updateDraft((c) => ({
                      ...c,
                      postMatch: {
                        ...c.postMatch,
                        notableReasons: selected
                          ? c.postMatch.notableReasons.filter((r) => r !== value)
                          : [...c.postMatch.notableReasons, value],
                      },
                    }))
                  }
                >
                  {label}
                </Choice>
              );
            })}
          </div>
        </section>
      )}

      <label className="field top-space">
        <span>Optional short note</span>
        <textarea
          value={draft.postMatch.note}
          onChange={(e) => updatePostMatch("note", e.target.value)}
        />
      </label>

      {missing.length > 0 && (
        <div className="notice top-space">
          <IconAlertTriangle size={16} /> Missing: {missing.join(", ")}
        </div>
      )}

      <div className="button-row top-space">
        <button className="button ghost" onClick={onBackToSelection}>
          Back to Teams
        </button>
        <button className="button ghost" onClick={() => goTo("live")}>
          Back to Match
        </button>
        <button className="button primary" onClick={submitMatch}>
          Submit Match
        </button>
      </div>
    </section>
  );
}
