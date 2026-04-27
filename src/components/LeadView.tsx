import {
  coveredAssignmentIds,
  duplicateSubmissionKeys,
  missingAssignments,
} from "../assignments";
import { IconCheck, IconFlag } from "../icons";
import { Metric } from "./Input";
import type { EventSchedule, MatchSubmission, ScoutAssignment, ScouterProfile } from "../types";

export function LeadView({
  activeSchedule,
  scouters,
  assignments,
  submissions,
  newScouterName,
  setNewScouterName,
  addScouter,
  removeScouter,
  generateAssignments,
}: {
  activeSchedule: EventSchedule | null;
  scouters: ScouterProfile[];
  assignments: ScoutAssignment[];
  submissions: MatchSubmission[];
  newScouterName: string;
  setNewScouterName: (name: string) => void;
  addScouter: () => void;
  removeScouter: (id: string) => void;
  generateAssignments: () => void;
}) {
  const covered = coveredAssignmentIds(assignments, submissions);
  const missing = missingAssignments(assignments, submissions);
  const duplicates = duplicateSubmissionKeys(submissions);
  const activeScouters = scouters.filter((scouter) => scouter.active);
  const workload = activeScouters.map((scouter) => ({
    scouter,
    count: assignments.filter((assignment) => assignment.scouterId === scouter.id).length,
  }));

  return (
    <div className="grid">
      <section className="panel">
        <h1>Lead</h1>
        <p className="muted">Build local scouter assignments from the loaded TBA schedule.</p>
        <div className="metric-grid">
          <Metric label="Scouters" value={activeScouters.length} />
          <Metric label="Assignments" value={assignments.length} />
          <Metric label="Covered" value={covered.size} />
          <Metric label="Missing" value={missing.length} />
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Scouters</h2>
          <span className="muted small">{activeScouters.length} active</span>
        </div>
        <div className="inline-form">
          <label className="field">
            <span>Name</span>
            <input
              value={newScouterName}
              placeholder="Add scouter"
              onChange={(event) => setNewScouterName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addScouter();
              }}
            />
          </label>
          <button className="button primary" onClick={addScouter}>Add</button>
        </div>
        {scouters.length > 0 ? (
          <div className="scouter-list top-space">
            {scouters.map((scouter) => (
              <div className="scouter-row" key={scouter.id}>
                <span>{scouter.name}</span>
                <button className="link-button" onClick={() => removeScouter(scouter.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty top-space">Add scouters before generating assignments.</div>
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Assignments</h2>
            <p className="muted">
              {activeSchedule
                ? `${activeSchedule.eventKey.toUpperCase()} qualification schedule`
                : "Load a TBA schedule first"}
            </p>
          </div>
          <button className="button primary" onClick={generateAssignments} disabled={!activeSchedule || activeScouters.length === 0}>
            <IconFlag size={16} /> Generate
          </button>
        </div>

        {workload.length > 0 && (
          <div className="workload-grid">
            {workload.map(({ scouter, count }) => (
              <div className="workload-pill" key={scouter.id}>
                <span>{scouter.name}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        )}

        {assignments.length > 0 ? (
          <div className="assignment-list top-space">
            {assignments.slice(0, 18).map((assignment) => (
              <article className={`assignment-row ${assignment.alliance}`} key={assignment.id}>
                <div>
                  <strong>{assignment.label} · {assignment.station.toUpperCase()}</strong>
                  <span className="muted small">Team {assignment.teamNumber} · {assignment.scouterName}</span>
                </div>
                {covered.has(assignment.id) && <IconCheck size={18} />}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty top-space">No assignments generated yet.</div>
        )}
      </section>

      {(missing.length > 0 || duplicates.length > 0) && (
        <section className="panel">
          <h2>Coverage Exceptions</h2>
          {missing.length > 0 && (
            <div className="exception-block">
              <h3>Missing</h3>
              <div className="assignment-list">
                {missing.slice(0, 12).map((assignment) => (
                  <article className={`assignment-row ${assignment.alliance}`} key={assignment.id}>
                    <div>
                      <strong>{assignment.label} · Team {assignment.teamNumber}</strong>
                      <span className="muted small">{assignment.station.toUpperCase()} · {assignment.scouterName}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
          {duplicates.length > 0 && (
            <div className="exception-block">
              <h3>Duplicates</h3>
              <div className="assignment-list">
                {duplicates.map((duplicate) => (
                  <article className="assignment-row" key={`${duplicate.matchNumber}-${duplicate.teamNumber}`}>
                    <div>
                      <strong>Q{duplicate.matchNumber} · Team {duplicate.teamNumber}</strong>
                      <span className="muted small">{duplicate.count} submissions</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
