import { formatAverage } from "../domain";
import { IconSearch } from "../icons";
import { Metric } from "./Input";
import type { MatchSubmission, TeamAggregate } from "../types";

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
  const filtered = aggregates.filter((t) => t.teamNumber.includes(teamFilter.trim()));

  return (
    <div className="grid">
      <section className="panel">
        <h1>Dashboard</h1>
        <p className="muted">Evidence-first summaries from local and imported records.</p>
        <div className="metric-grid">
          <Metric label="Submissions" value={latest.length} />
          <Metric label="Teams" value={aggregates.length} />
          <Metric
            label="Notable"
            value={latest.filter((s) => s.eventMarks.some((m) => m.type === "notable")).length}
          />
          <Metric label="Incap" value={latest.filter((s) => s.incap.occurred).length} />
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Teams</h2>
          <label className="search">
            <IconSearch size={16} />
            <input
              placeholder="Filter…"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
            />
          </label>
        </div>
        {filtered.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>M</th>
                  <th>Inc</th>
                  <th>Def</th>
                  <th>Drv</th>
                  <th>Feed</th>
                  <th>Steal</th>
                  <th>Auto</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((team) => (
                  <tr
                    className={selectedTeam === team.teamNumber ? "selected-row" : ""}
                    key={team.teamNumber}
                  >
                    <td>
                      <button className="link-button" onClick={() => setSelectedTeam(team.teamNumber)}>
                        {team.teamNumber}
                      </button>
                    </td>
                    <td>{team.matches}</td>
                    <td>{team.incapCount}</td>
                    <td>{formatAverage(team.defenseAvg)}</td>
                    <td>{formatAverage(team.driverAvg)}</td>
                    <td>{team.feedCount}</td>
                    <td>{team.stealMax}</td>
                    <td>{team.autoSuccess}/{team.autoAttempts}</td>
                    <td>{team.notableCount + team.foulConcernCount}</td>
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
          <h2>Team {selectedAggregate.teamNumber}</h2>
          <div className="grid">
            {selectedAggregate.submissions.map((s) => (
              <article className="submission-card" key={s.id}>
                <strong>Qual {s.matchNumber || "?"}</strong>
                <span className="muted small">
                  Defense {s.postMatch.defenseEffectiveness || "n/a"} · Driver{" "}
                  {s.postMatch.driverSkill || "n/a"} · Steal {s.postMatch.canSteal}
                </span>
                {s.eventMarks.length > 0 && (
                  <span className="small">
                    Flags: {s.eventMarks.map((m) => m.type).join(", ")}
                  </span>
                )}
                {s.postMatch.note && <span className="small">{s.postMatch.note}</span>}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
