import { useMemo, useState } from "react";
import {
  formatAverage,
  formatMatchTime,
  summarizeIntervals,
} from "../domain";
import { IconSearch } from "../icons";
import { Metric } from "./Input";
import type { MatchSubmission, TeamAggregate } from "../types";

type RankingWeights = {
  scoring: number;
  feeding: number;
  defense: number;
  driver: number;
  steal: number;
  auto: number;
  reliability: number;
  lowFoulRisk: number;
};

type RankedTeam = {
  team: TeamAggregate;
  rank: number;
  score: number;
  scoringPieces: number;
  feedingPieces: number;
  scoringPiecesPerMatch: number;
  feedingPiecesPerMatch: number;
  immobileMs: number;
  immobileRate: number;
  reliabilityScore: number;
  autoRate: number;
  lowFoulRisk: number;
};

const DEFAULT_BPS = "0.5";
const DEFAULT_WEIGHTS: RankingWeights = {
  scoring: 10,
  feeding: 16,
  defense: 18,
  driver: 14,
  steal: 16,
  auto: 8,
  reliability: 16,
  lowFoulRisk: 2,
};

const WEIGHT_FIELDS: Array<{
  key: keyof RankingWeights;
  label: string;
}> = [
  { key: "scoring", label: "Scoring" },
  { key: "feeding", label: "Feeding" },
  { key: "defense", label: "Defense" },
  { key: "driver", label: "Driver" },
  { key: "steal", label: "Steal" },
  { key: "auto", label: "Auto" },
  { key: "reliability", label: "Reliability" },
  { key: "lowFoulRisk", label: "Low foul risk" },
];

const BPS_STORAGE_KEY = "team9470.dashboard.effectiveBps";
const WEIGHTS_STORAGE_KEY = "team9470.dashboard.weights";

export function Dashboard({
  aggregates,
  latest,
  selectedTeam,
  selectedAggregate,
  setSelectedTeam,
  teamFilter,
  setTeamFilter,
}: {
  aggregates: TeamAggregate[];
  latest: MatchSubmission[];
  selectedTeam: string | null;
  selectedAggregate: TeamAggregate | null | undefined;
  setSelectedTeam: (team: string) => void;
  teamFilter: string;
  setTeamFilter: (filter: string) => void;
}) {
  const [effectiveBpsInput, setEffectiveBpsInput] = useState(() =>
    localStorage.getItem(BPS_STORAGE_KEY) ?? DEFAULT_BPS,
  );
  const [weights, setWeights] = useState<RankingWeights>(loadWeights);

  const effectiveBps = Math.max(0, Number(effectiveBpsInput) || 0);
  const rankedTeams = useMemo(
    () => rankTeams(aggregates, effectiveBps, weights),
    [aggregates, effectiveBps, weights],
  );
  const filtered = rankedTeams.filter(({ team }) =>
    team.teamNumber.includes(teamFilter.trim()),
  );
  const selectedRanked = selectedAggregate
    ? rankedTeams.find(({ team }) => team.teamNumber === selectedAggregate.teamNumber)
    : null;
  const leadingTeam = rankedTeams[0];
  const totalScoringSeconds = latest.reduce((sum, submission) => {
    const summary = summarizeIntervals(submission.actionIntervals, observedMatchMs(submission));
    return sum + summary.scoringMs / 1000;
  }, 0);
  const totalFeedingSeconds = latest.reduce((sum, submission) => {
    const summary = summarizeIntervals(submission.actionIntervals, observedMatchMs(submission));
    return sum + summary.feedingMs / 1000;
  }, 0);

  function updateEffectiveBps(value: string) {
    setEffectiveBpsInput(value);
    localStorage.setItem(BPS_STORAGE_KEY, value);
  }

  function updateWeight(key: keyof RankingWeights, value: string) {
    const numericValue = Math.max(0, Number(value) || 0);
    setWeights((current) => {
      const next = { ...current, [key]: numericValue };
      localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="grid dashboard-view">
      <section className="panel dashboard-hero">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">
            Ranked picklist data from local and imported match records. Scores favor
            reliable feeding, defense, stealing, and driver quality.
          </p>
        </div>
        <div className="metric-grid dashboard-summary-grid">
          <Metric label="Submissions" value={latest.length} />
          <Metric label="Teams" value={aggregates.length} />
          <Metric
            label="Est. scored"
            value={formatPieces(totalScoringSeconds * effectiveBps)}
          />
          <Metric
            label="Est. fed"
            value={formatPieces(totalFeedingSeconds * effectiveBps)}
          />
          <Metric
            label="Notable"
            value={latest.filter((s) => s.eventMarks.some((m) => m.type === "notable")).length}
          />
          <Metric label="Incap" value={latest.filter((s) => s.incap.occurred).length} />
          <Metric
            label="Top score"
            value={leadingTeam ? leadingTeam.score.toFixed(1) : "-"}
          />
          <Metric
            label="Top team"
            value={leadingTeam ? leadingTeam.team.teamNumber : "-"}
          />
        </div>
      </section>

      <section className="panel ranking-controls">
        <div className="section-head">
          <div>
            <h2>Ranking Model</h2>
            <p className="muted">
              Effective BPS converts scoring and feeding time into estimated game-piece
              output. Weights are normalized, so any scale works.
            </p>
          </div>
          <label className="field bps-field">
            <span>Effective BPS</span>
            <input
              value={effectiveBpsInput}
              inputMode="decimal"
              onChange={(e) => updateEffectiveBps(e.target.value)}
            />
          </label>
        </div>
        <div className="weight-grid">
          {WEIGHT_FIELDS.map(({ key, label }) => (
            <label className="field compact-field" key={key}>
              <span>{label}</span>
              <input
                value={weights[key]}
                inputMode="numeric"
                onChange={(e) => updateWeight(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <p className="muted small">
          Score = weighted normalized scoring pieces/match, feeding pieces/match,
          defense rating, driver rating, steal capability, auto rate, reliability,
          and low foul-risk.
        </p>
      </section>

      <section className="panel">
        <div className="section-head section-head--stacked">
          <div>
            <h2>Team Rankings</h2>
            <p className="muted">
              Every summarized team stat is visible in this table. Scroll sideways
              on smaller screens.
            </p>
          </div>
          <label className="search">
            <IconSearch size={16} />
            <input
              placeholder="Filter team"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
            />
          </label>
        </div>
        {filtered.length > 0 ? (
          <div className="table-wrap ranking-table-wrap">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Score</th>
                  <th>M</th>
                  <th>Scored</th>
                  <th>Fed</th>
                  <th>Driving time</th>
                  <th>Intake time</th>
                  <th>Scoring time</th>
                  <th>Feeding time</th>
                  <th>Defense time</th>
                  <th>Blocked</th>
                  <th>Beached</th>
                  <th>Missing</th>
                  <th>Driver</th>
                  <th>Defense</th>
                  <th>Steal</th>
                  <th>Auto</th>
                  <th>Reliability</th>
                  <th>Immobile</th>
                  <th>Incap</th>
                  <th>Incap ratio</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    className={selectedTeam === row.team.teamNumber ? "selected-row" : ""}
                    key={row.team.teamNumber}
                  >
                    <td>#{row.rank}</td>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => setSelectedTeam(row.team.teamNumber)}
                      >
                        {row.team.teamNumber}
                      </button>
                    </td>
                    <td className="score-cell">{row.score.toFixed(1)}</td>
                    <td>{row.team.matches}</td>
                    <td>{formatPieces(row.scoringPiecesPerMatch)}/m</td>
                    <td>{formatPieces(row.feedingPiecesPerMatch)}/m</td>
                    <td>{formatMatchTime(row.team.drivingMs)}</td>
                    <td>{formatMatchTime(row.team.intakingMs)}</td>
                    <td>{formatMatchTime(row.team.scoringMs)}</td>
                    <td>{formatMatchTime(row.team.feedingMs)}</td>
                    <td>{formatMatchTime(row.team.defenseMs)}</td>
                    <td>{formatMatchTime(row.team.blockedMs)}</td>
                    <td>{formatMatchTime(row.team.beachedMs)}</td>
                    <td>{formatMatchTime(row.team.missingMs)}</td>
                    <td>{formatAverage(row.team.driverAvg)}</td>
                    <td>{formatAverage(row.team.defenseAvg)}</td>
                    <td>{formatSteal(row.team.stealMax)}</td>
                    <td>{formatPercent(row.autoRate)}</td>
                    <td>{formatPercent(row.reliabilityScore)}</td>
                    <td>{formatPercent(row.immobileRate)}</td>
                    <td>{row.team.incapCount}</td>
                    <td>{formatPercent(incapRatio(row.team))}</td>
                    <td>{row.team.notableCount}N / {row.team.foulConcernCount}F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">No submitted matches yet.</div>
        )}
      </section>

      {selectedAggregate && (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Team {selectedAggregate.teamNumber}</h2>
              <p className="muted">
                Raw totals and match evidence behind the ranking.
              </p>
            </div>
            {selectedRanked && (
              <div className="rank-badge">
                <span>Rank #{selectedRanked.rank}</span>
                <strong>{selectedRanked.score.toFixed(1)}</strong>
              </div>
            )}
          </div>
          <div className="team-detail-stats team-detail-stats--wide">
            <DetailStat label="Matches" value={selectedAggregate.matches} />
            <DetailStat
              label="Scored @ BPS"
              value={formatPieces((selectedAggregate.scoringMs / 1000) * effectiveBps)}
            />
            <DetailStat
              label="Fed @ BPS"
              value={formatPieces((selectedAggregate.feedingMs / 1000) * effectiveBps)}
            />
            <DetailStat label="Driver" value={formatAverage(selectedAggregate.driverAvg)} />
            <DetailStat label="Defense" value={formatAverage(selectedAggregate.defenseAvg)} />
            <DetailStat label="Steal" value={formatSteal(selectedAggregate.stealMax)} />
            <DetailStat
              label="Auto"
              value={`${selectedAggregate.autoSuccess}/${selectedAggregate.autoAttempts}`}
            />
            <DetailStat
              label="Reliability"
              value={selectedRanked ? formatPercent(selectedRanked.reliabilityScore) : "-"}
            />
            <DetailStat
              label="Incap ratio"
              value={formatPercent(incapRatio(selectedAggregate))}
            />
            <DetailStat label="Driving time" value={formatMatchTime(selectedAggregate.drivingMs)} />
            <DetailStat label="Intake time" value={formatMatchTime(selectedAggregate.intakingMs)} />
            <DetailStat label="Scoring time" value={formatMatchTime(selectedAggregate.scoringMs)} />
            <DetailStat label="Feeding time" value={formatMatchTime(selectedAggregate.feedingMs)} />
            <DetailStat label="Defense time" value={formatMatchTime(selectedAggregate.defenseMs)} />
            <DetailStat label="Blocked" value={formatMatchTime(selectedAggregate.blockedMs)} />
            <DetailStat label="Beached" value={formatMatchTime(selectedAggregate.beachedMs)} />
            <DetailStat label="Missing" value={formatMatchTime(selectedAggregate.missingMs)} />
            <DetailStat
              label="Immobile"
              value={formatMatchTime(
                selectedAggregate.blockedMs +
                  selectedAggregate.beachedMs +
                  selectedAggregate.missingMs,
              )}
            />
          </div>

          <div className="table-wrap top-space">
            <table className="match-evidence-table">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Scout</th>
                  <th>Drive</th>
                  <th>Intake</th>
                  <th>Score</th>
                  <th>Feed</th>
                  <th>Defense</th>
                  <th>Blocked</th>
                  <th>Beached</th>
                  <th>Missing</th>
                  <th>Driver</th>
                  <th>Def</th>
                  <th>Auto</th>
                  <th>BPS est.</th>
                  <th>Steal</th>
                  <th>Flags</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {selectedAggregate.submissions.map((submission) => {
                  const observedMs = observedMatchMs(submission);
                  const summary = summarizeIntervals(submission.actionIntervals, observedMs);
                  return (
                    <tr key={submission.id}>
                      <td>Q{submission.matchNumber || "?"}</td>
                      <td>{submission.scouterName || "-"}</td>
                      <td>{formatMatchTime(summary.drivingMs)}</td>
                      <td>{formatMatchTime(summary.intakingMs)}</td>
                      <td>
                        {formatMatchTime(summary.scoringMs)} /{" "}
                        {formatPieces((summary.scoringMs / 1000) * effectiveBps)}
                      </td>
                      <td>
                        {formatMatchTime(summary.feedingMs)} /{" "}
                        {formatPieces((summary.feedingMs / 1000) * effectiveBps)}
                      </td>
                      <td>{formatMatchTime(summary.defenseMs)}</td>
                      <td>{formatMatchTime(summary.blockedMs)}</td>
                      <td>{formatMatchTime(summary.beachedMs)}</td>
                      <td>{formatMatchTime(summary.missingMs)}</td>
                      <td>{submission.postMatch.driverSkill || "-"}</td>
                      <td>
                        {submission.postMatch.defenseEffectiveness === "not_observed"
                          ? "-"
                          : submission.postMatch.defenseEffectiveness || "-"}
                      </td>
                      <td>
                        {formatAuto(
                          submission.postMatch.autoAttempted,
                          submission.postMatch.autoSuccessful,
                        )}
                      </td>
                      <td>{submission.postMatch.bpsEstimate}</td>
                      <td>{formatSteal(submission.postMatch.canSteal)}</td>
                      <td>{formatFlags(submission)}</td>
                      <td className="note-cell">{submission.postMatch.note || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="team-detail-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function rankTeams(
  aggregates: TeamAggregate[],
  effectiveBps: number,
  weights: RankingWeights,
): RankedTeam[] {
  const rawRows = aggregates.map((team) => {
    const scoringPieces = (team.scoringMs / 1000) * effectiveBps;
    const feedingPieces = (team.feedingMs / 1000) * effectiveBps;
    const immobileMs = team.blockedMs + team.beachedMs + team.missingMs;
    const immobileRate = team.totalObservedMs > 0 ? immobileMs / team.totalObservedMs : 0;
    const incapRate = team.matches > 0 ? team.incapCount / team.matches : 0;
    const foulRate = team.matches > 0 ? team.foulConcernCount / team.matches : 0;

    return {
      team,
      scoringPieces,
      feedingPieces,
      scoringPiecesPerMatch: perMatch(scoringPieces, team.matches),
      feedingPiecesPerMatch: perMatch(feedingPieces, team.matches),
      immobileMs,
      immobileRate,
      reliabilityScore: clamp01(1 - immobileRate * 0.75 - incapRate * 0.65),
      autoRate: team.autoAttempts > 0 ? team.autoSuccess / team.autoAttempts : 0,
      lowFoulRisk: clamp01(1 - foulRate),
    };
  });

  const maxScoring = Math.max(...rawRows.map((row) => row.scoringPiecesPerMatch), 0);
  const maxFeeding = Math.max(...rawRows.map((row) => row.feedingPiecesPerMatch), 0);
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;

  return rawRows
    .map((row) => {
      const score =
        ((normalize(row.scoringPiecesPerMatch, maxScoring) * weights.scoring) +
          (normalize(row.feedingPiecesPerMatch, maxFeeding) * weights.feeding) +
          (ratingScore(row.team.defenseAvg) * weights.defense) +
          (ratingScore(row.team.driverAvg) * weights.driver) +
          (stealScore(row.team.stealMax) * weights.steal) +
          (row.autoRate * weights.auto) +
          (row.reliabilityScore * weights.reliability) +
          (row.lowFoulRisk * weights.lowFoulRisk)) /
        totalWeight *
        100;

      return { ...row, rank: 0, score };
    })
    .sort((a, b) => b.score - a.score || Number(a.team.teamNumber) - Number(b.team.teamNumber))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function loadWeights(): RankingWeights {
  try {
    const stored = localStorage.getItem(WEIGHTS_STORAGE_KEY);
    if (!stored) return DEFAULT_WEIGHTS;
    const parsed = JSON.parse(stored) as Partial<RankingWeights>;
    return { ...DEFAULT_WEIGHTS, ...parsed };
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

function observedMatchMs(submission: MatchSubmission) {
  const intervalEndMs = submission.actionIntervals.reduce(
    (latest, interval) => Math.max(latest, interval.endMs ?? interval.startMs),
    0,
  );
  return Math.max(submission.elapsedMs, intervalEndMs);
}

function perMatch(value: number, matches: number) {
  return matches > 0 ? value / matches : 0;
}

function incapRatio(team: TeamAggregate) {
  return team.matches > 0 ? team.incapCount / team.matches : 0;
}

function normalize(value: number, max: number) {
  return max > 0 ? value / max : 0;
}

function ratingScore(value: number | null) {
  return value == null ? 0 : clamp01(value / 5);
}

function stealScore(value: TeamAggregate["stealMax"] | MatchSubmission["postMatch"]["canSteal"]) {
  if (value === "full") return 1;
  if (value === "partial") return 0.6;
  return 0;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function formatPieces(value: number) {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}

function formatPercent(value: number) {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function formatSteal(value: TeamAggregate["stealMax"] | MatchSubmission["postMatch"]["canSteal"]) {
  if (value === "not_observed") return "Not obs.";
  return value;
}

function formatAuto(
  attempted: MatchSubmission["postMatch"]["autoAttempted"],
  successful: MatchSubmission["postMatch"]["autoSuccessful"],
) {
  if (attempted !== "yes") return attempted;
  return successful;
}

function formatFlags(submission: MatchSubmission) {
  const flags = submission.eventMarks.map((mark) => mark.type.replace("_", " "));
  if (submission.incap.occurred && !flags.includes("incap")) flags.push("incap");
  return flags.length ? flags.join(", ") : "-";
}
