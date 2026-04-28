import { IconDatabase, IconDownload, IconUpload } from "../icons";
import type { EventSchedule, MatchSubmission } from "../types";

export function DataView({
  submissions,
  schedules,
  tbaEventKey,
  tbaStatus,
  supabaseConfigured,
  supabaseStatus,
  setTbaEventKey,
  fetchTbaSchedule,
  syncSupabase,
  exportJson,
  importJson,
  seedTestEvent,
}: {
  submissions: MatchSubmission[];
  schedules: EventSchedule[];
  tbaEventKey: string;
  tbaStatus: string;
  supabaseConfigured: boolean;
  supabaseStatus: string;
  setTbaEventKey: (eventKey: string) => void;
  fetchTbaSchedule: () => void;
  syncSupabase: () => void;
  exportJson: () => void;
  importJson: (file: File) => void;
  seedTestEvent?: () => void;
}) {
  const pending = submissions.filter((s) => s.syncStatus !== "synced").length;
  const failed = submissions.filter((s) => s.syncStatus === "failed").length;
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
        {seedTestEvent && (
          <div className="button-row top-space">
            <button className="button ghost" onClick={seedTestEvent}>
              Seed fake live event
            </button>
            <span className="sync-message">Dev only. Replaces cached fake schedule.</span>
          </div>
        )}
      </section>

      <section className="panel data-card">
        <h2>Supabase</h2>
        <p className="muted">
          Opportunistic backend sync. Local save still happens first.
        </p>
        <div className="button-row">
          <button className="button primary" onClick={syncSupabase} disabled={!supabaseConfigured}>
            <IconDatabase size={16} /> Sync Now
          </button>
          <span className="sync-message">{supabaseStatus}</span>
        </div>
        {!supabaseConfigured && (
          <p className="muted small">
            Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sync.
          </p>
        )}
      </section>

      <section className="panel data-card">
        <h2>Sync Status</h2>
        <div className="data-stat">
          <span className="muted">Pending sync</span>
          <strong>{pending}</strong>
        </div>
        <div className="data-stat">
          <span className="muted">Failed sync</span>
          <strong>{failed}</strong>
        </div>
        <div className="data-stat">
          <span className="muted">Total records</span>
          <strong>{submissions.length}</strong>
        </div>
        <p className="muted small">
          Supabase sync is isolated. JSON export/import remains the fallback.
        </p>
      </section>
    </div>
  );
}
