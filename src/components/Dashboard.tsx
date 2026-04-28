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
        <div className="section-head section-head--stacked">
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
          <>
            {/* Desktop table — hidden on mobile */}
            <div className="table-wrap desktop-only">
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

            {/* Mobile card list — hidden on desktop */}
            <div className="team-card-list mobile-only">
              {filtered.map((team) => (
                <button
                  key={team.teamNumber}
                  className={`team-card ${selectedTeam === team.teamNumber ? "selected" : ""}`}
                  onClick={() => setSelectedTeam(team.teamNumber)}
                >
                  <div className="team-card-header">
                    <span className="team-card-number">{team.teamNumber}</span>
                    <span className="team-card-matches">{team.matches} match{team.matches !== 1 ? "es" : ""}</span>
                  </div>
                  <div className="team-card-stats">
                    <div className="team-card-stat">
                      <span className="team-card-stat-value">{formatAverage(team.driverAvg)}</span>
                      <span className="team-card-stat-label">Drv</span>
                    </div>
                    <div className="team-card-stat">
                      <span className="team-card-stat-value">{formatAverage(team.defenseAvg)}</span>
                      <span className="team-card-stat-label">Def</span>
                    </div>
                    <div className="team-card-stat">
                      <span className="team-card-stat-value">{team.autoSuccess}/{team.autoAttempts}</span>
                      <span className="team-card-stat-label">Auto</span>
                    </div>
                    <div className="team-card-stat">
                      <span className="team-card-stat-value">{team.incapCount}</span>
                      <span className="team-card-stat-label">Inc</span>
                    </div>
                  </div>
                  {(team.notableCount + team.foulConcernCount > 0 || team.feedCount > 0) && (
                    <div className="team-card-tags">
                      {team.feedCount > 0 && (
                        <span className="team-card-tag tag-feed">{team.feedCount} feed</span>
                      )}
                      {team.notableCount > 0 && (
                        <span className="team-card-tag tag-notable">{team.notableCount} notable</span>
                      )}
                      {team.foulConcernCount > 0 && (
                        <span className="team-card-tag tag-foul">{team.foulConcernCount} foul</span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="empty">No submitted matches yet.</div>
        )}
      </section>

      {selectedAggregate && (
        <section className="panel">
          <h2>Team {selectedAggregate.teamNumber}</h2>
          <div className="team-detail-stats">
            <div className="team-detail-stat">
              <strong>{formatAverage(selectedAggregate.driverAvg)}</strong>
              <span>Driver</span>
            </div>
            <div className="team-detail-stat">
              <strong>{formatAverage(selectedAggregate.defenseAvg)}</strong>
              <span>Defense</span>
            </div>
            <div className="team-detail-stat">
              <strong>{selectedAggregate.autoSuccess}/{selectedAggregate.autoAttempts}</strong>
              <span>Auto</span>
            </div>
            <div className="team-detail-stat">
              <strong>{selectedAggregate.stealMax}</strong>
              <span>Steal</span>
            </div>
            <div className="team-detail-stat">
              <strong>{selectedAggregate.incapCount}</strong>
              <span>Incap</span>
            </div>
            <div className="team-detail-stat">
              <strong>{selectedAggregate.feedCount}</strong>
              <span>Feed</span>
            </div>
          </div>
          <div className="grid top-space">
            {selectedAggregate.submissions.map((s) => (
              <article className="submission-card" key={s.id}>
                <div className="submission-card-head">
                  <strong>Qual {s.matchNumber || "?"}</strong>
                  <span className="muted small">{s.scouterName}</span>
                </div>
                <div className="submission-card-body">
                  <span className="submission-stat">
                    <span className="submission-stat-label">Def</span>
                    {s.postMatch.defenseEffectiveness || "—"}
                  </span>
                  <span className="submission-stat">
                    <span className="submission-stat-label">Drv</span>
                    {s.postMatch.driverSkill || "—"}
                  </span>
                  <span className="submission-stat">
                    <span className="submission-stat-label">Steal</span>
                    {s.postMatch.canSteal}
                  </span>
                </div>
                {s.eventMarks.length > 0 && (
                  <div className="submission-card-flags">
                    {s.eventMarks.map((m) => (
                      <span key={m.id} className={`team-card-tag tag-${m.type === "notable" ? "notable" : m.type === "foul_concern" ? "foul" : "incap"}`}>
                        {m.type.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                )}
                {s.postMatch.note && <p className="submission-card-note">{s.postMatch.note}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
