import { NOTABLE_REASONS } from "../constants";
import { missingRequiredFields, summarizeIntervals } from "../domain";
import { IconAlertTriangle } from "../icons";
import { Choice, Metric, OptionGroup, StarRating } from "./Input";
import type { MatchDraft } from "../types";

type AutoResult = "success" | "partial" | "failed" | "no_auto" | "unknown";
type AutoType = "basic_or_other" | "depot" | "eight_preload" | "unknown";

function getAutoResult(postMatch: MatchDraft["postMatch"]): AutoResult {
  if (postMatch.autoAttempted === "no") return "no_auto";
  if (postMatch.autoSuccessful === "yes") return "success";
  if (postMatch.autoSuccessful === "partial") return "partial";
  if (postMatch.autoSuccessful === "no") return "failed";
  return "unknown";
}

function getAutoType(postMatch: MatchDraft["postMatch"]): AutoType {
  if (postMatch.eightPreloadObserved === "yes") return "eight_preload";
  if (postMatch.depotObserved === "yes") return "depot";
  if (postMatch.eightPreloadObserved === "no" && postMatch.depotObserved === "no") {
    return "basic_or_other";
  }
  return "unknown";
}

export function PostMatch({
  draft,
  elapsedMs,
  updatePostMatch,
  updateDraft,
  submitMatch,
  goTo,
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
}) {
  const summary = summarizeIntervals(draft.actionIntervals, elapsedMs);
  const missing = missingRequiredFields(draft);
  const hasNotable = draft.eventMarks.some((m) => m.type === "notable");
  const autoResult = getAutoResult(draft.postMatch);
  const autoType = getAutoType(draft.postMatch);

  function updateAutoResult(result: AutoResult) {
    updateDraft((current) => {
      const nextPostMatch = { ...current.postMatch };
      if (result === "no_auto") {
        nextPostMatch.autoAttempted = "no";
        nextPostMatch.autoSuccessful = "no";
        nextPostMatch.eightPreloadObserved = "no";
        nextPostMatch.depotObserved = "no";
      } else if (result === "unknown") {
        nextPostMatch.autoAttempted = "unknown";
        nextPostMatch.autoSuccessful = "unknown";
      } else {
        nextPostMatch.autoAttempted = "yes";
        nextPostMatch.autoSuccessful =
          result === "success" ? "yes" : result === "partial" ? "partial" : "no";
      }
      return { ...current, postMatch: nextPostMatch };
    });
  }

  function updateAutoType(type: AutoType) {
    updateDraft((current) => {
      const nextPostMatch = { ...current.postMatch };
      if (type === "eight_preload") {
        nextPostMatch.eightPreloadObserved = "yes";
        nextPostMatch.depotObserved = "no";
      } else if (type === "depot") {
        nextPostMatch.eightPreloadObserved = "no";
        nextPostMatch.depotObserved = "yes";
      } else if (type === "basic_or_other") {
        nextPostMatch.eightPreloadObserved = "no";
        nextPostMatch.depotObserved = "no";
      } else {
        nextPostMatch.eightPreloadObserved = "unknown";
        nextPostMatch.depotObserved = "unknown";
      }
      return { ...current, postMatch: nextPostMatch };
    });
  }

  return (
    <section className="panel">
      <h1>Post-Match</h1>
      <p className="muted">Convert observations into strategy data.</p>

      <div className="metric-grid summary-grid">
        <Metric label="Defense" value={`${Math.round(summary.defenseMs / 1000)}s`} />
        <Metric label="Feeding" value={`${Math.round(summary.feedingMs / 1000)}s`} />
        <Metric label="Blocked" value={`${Math.round(summary.blockedMs / 1000)}s`} />
        <Metric label="Beached" value={`${Math.round(summary.beachedMs / 1000)}s`} />
        <Metric label="Missing" value={`${Math.round(summary.missingMs / 1000)}s`} />
      </div>

      <div className="grid two top-space">
        <OptionGroup
          title="Auto result"
          options={[
            ["success", "Success"],
            ["partial", "Partial"],
            ["failed", "Failed"],
            ["no_auto", "No auto"],
            ["unknown", "Unknown"],
          ] as const}
          value={autoResult}
          onChange={updateAutoResult}
        />
        {autoResult !== "no_auto" && (
          <OptionGroup
            title="Observed auto type"
            options={[
              ["basic_or_other", "Basic/other"],
              ["depot", "Depot"],
              ["eight_preload", "8-preload"],
              ["unknown", "Unknown"],
            ] as const}
            value={autoType}
            onChange={updateAutoType}
          />
        )}
        <OptionGroup
          title="BPS estimate"
          options={["<5", "10", "20", "25+", "unknown"].map((v) => [v, v] as [string, string])}
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
          options={["none", "partial", "full", "not_observed"].map((v) => [v, v] as [string, string])}
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
        <button className="button ghost" onClick={() => goTo("live")}>
          Back
        </button>
        <button className="button primary" onClick={submitMatch}>
          Submit Match
        </button>
      </div>
    </section>
  );
}
