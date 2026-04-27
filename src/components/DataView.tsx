import { IconDatabase, IconDownload, IconUpload } from "../icons";
import type { EventSchedule, MatchSubmission } from "../types";

export function DataView({
  submissions,
  schedules,
  tbaEventKey,
  tbaStatus,
  setTbaEventKey,
  fetchTbaSchedule,
  exportJson,
  importJson,
}: {
  submissions: MatchSubmission[];
  schedules: EventSchedule[];
  tbaEventKey: string;
  tbaStatus: string;
  setTbaEventKey: (eventKey: string) => void;
  fetchTbaSchedule: () => void;
  exportJson: () => void;
  importJson: (file: File) => void;
}) {
  const pending = submissions.filter((s) => s.syncStatus !== "synced").length;
  const latestSchedule = schedules[0];

  return (
    <div className="grid">
      <section className="panel data-card">
        <h1>TBA Schedule</h1>
        <p className="muted">Pull match schedule data into local storage for faster match selection.</p>
        <label className="field">
          <span>Event key</span>
          <input
            value={tbaEventKey}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="2026cada"
            onChange={(e) => setTbaEventKey(e.target.value)}
          />
        </label>
        <div className="button-row">
          <button className="button primary" onClick={fetchTbaSchedule}>
            <IconDatabase size={16} /> Pull TBA
          </button>
          <span className="sync-message">{tbaStatus}</span>
        </div>
        {latestSchedule && (
          <p className="muted small">
            Loaded {latestSchedule.matchCount} matches from {latestSchedule.eventKey.toUpperCase()}.
          </p>
        )}
      </section>

      <section className="panel data-card">
        <h1>Data</h1>
        <p className="muted">Export/import is the guaranteed fallback.</p>
        <div className="button-row">
          <button className="button primary" onClick={exportJson}>
            <IconDownload size={16} /> Export
          </button>
          <label className="button file-button">
            <IconUpload size={16} /> Import
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importJson(file);
              }}
            />
          </label>
        </div>
      </section>

      <section className="panel data-card">
        <h2>Sync Status</h2>
        <div className="data-stat">
          <span className="muted">Pending sync</span>
          <strong>{pending}</strong>
        </div>
        <div className="data-stat">
          <span className="muted">Total records</span>
          <strong>{submissions.length}</strong>
        </div>
        <p className="muted small">
          Backend sync adapter is isolated. Local save and export/import are the reliable layer.
        </p>
      </section>
    </div>
  );
}
