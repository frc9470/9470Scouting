import type { MatchDraft } from "../types";
import { Choice } from "./Input";

export type AutoResult = "success" | "partial" | "failed" | "no_auto" | "unknown";
type AutoFeature = "depotObserved" | "eightPreloadObserved" | "bumpObserved" | "trenchObserved";

const AUTO_FEATURES: readonly { key: AutoFeature; label: string }[] = [
  { key: "depotObserved", label: "Depot" },
  { key: "eightPreloadObserved", label: "8-preload" },
  { key: "bumpObserved", label: "Bump" },
  { key: "trenchObserved", label: "Trench" },
];

export function getAutoResult(postMatch: MatchDraft["postMatch"]): AutoResult {
  if (postMatch.autoAttempted === "no") return "no_auto";
  if (postMatch.autoSuccessful === "yes") return "success";
  if (postMatch.autoSuccessful === "partial") return "partial";
  if (postMatch.autoSuccessful === "no") return "failed";
  return "unknown";
}

export function updateAutoResultDraft(
  current: MatchDraft,
  result: AutoResult,
): MatchDraft {
  const nextPostMatch = { ...current.postMatch };
  if (result === "no_auto") {
    nextPostMatch.autoAttempted = "no";
    nextPostMatch.autoSuccessful = "no";
    for (const feature of AUTO_FEATURES) nextPostMatch[feature.key] = "no";
  } else if (result === "unknown") {
    nextPostMatch.autoAttempted = "unknown";
    nextPostMatch.autoSuccessful = "unknown";
  } else {
    nextPostMatch.autoAttempted = "yes";
    nextPostMatch.autoSuccessful =
      result === "success" ? "yes" : result === "partial" ? "partial" : "no";
  }
  return { ...current, postMatch: nextPostMatch };
}

export function toggleAutoFeatureDraft(
  current: MatchDraft,
  feature: AutoFeature,
): MatchDraft {
  const nextPostMatch = {
    ...current.postMatch,
    [feature]: current.postMatch[feature] === "yes" ? "no" : "yes",
  };
  if (nextPostMatch.autoAttempted === "no") {
    nextPostMatch.autoAttempted = "yes";
    nextPostMatch.autoSuccessful = "unknown";
  }
  return { ...current, postMatch: nextPostMatch };
}

export function setNoAutoFeaturesDraft(current: MatchDraft): MatchDraft {
  return {
    ...current,
    postMatch: {
      ...current.postMatch,
      depotObserved: "no",
      eightPreloadObserved: "no",
      bumpObserved: "no",
      trenchObserved: "no",
    },
  };
}

export function AutoPrompts({
  draft,
  updateDraft,
  compact = false,
}: {
  draft: MatchDraft;
  updateDraft: (updater: (current: MatchDraft) => MatchDraft) => void;
  compact?: boolean;
}) {
  const autoResult = getAutoResult(draft.postMatch);
  const noFeaturesObserved = AUTO_FEATURES.every((feature) => draft.postMatch[feature.key] !== "yes");

  return (
    <div className={`auto-prompts ${compact ? "compact" : ""}`}>
      <section>
        <h3>Auto result</h3>
        <div className="row-options">
          {([
            ["success", "Success"],
            ["partial", "Partial"],
            ["failed", "Failed"],
            ["no_auto", "No auto"],
            ["unknown", "Not sure"],
          ] as const).map(([value, label]) => (
            <Choice
              key={value}
              selected={autoResult === value}
              onClick={() => updateDraft((current) => updateAutoResultDraft(current, value))}
            >
              {label}
            </Choice>
          ))}
        </div>
      </section>

      {autoResult !== "no_auto" && (
        <section>
          <h3>Auto features</h3>
          <div className="row-options">
            {AUTO_FEATURES.map((feature) => (
              <Choice
                key={feature.key}
                selected={draft.postMatch[feature.key] === "yes"}
                onClick={() => updateDraft((current) => toggleAutoFeatureDraft(current, feature.key))}
              >
                {feature.label}
              </Choice>
            ))}
            <Choice
              selected={noFeaturesObserved}
              onClick={() => updateDraft(setNoAutoFeaturesDraft)}
            >
              Not observed
            </Choice>
          </div>
        </section>
      )}
    </div>
  );
}
