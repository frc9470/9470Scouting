# Champs Scouting App Technical Plan

This document turns the scouting context into a minimal technical plan. The goal is not to build a perfect scouting platform. The goal is to give Team 9470 reliable, event-usable data for second-pick, third-pick, backup-pick, and defensive strategy decisions at Championship.

## Design Philosophy

The system should separate objective data from qualitative strategy signals.

Objective data should be treated as evidence. It should be constrained, repeatable, and easy to aggregate. Examples include whether a robot died, whether it played defense, whether it fed, whether it stole, whether an auto ran successfully, and whether a match should be reviewed.

Qualitative data should not pretend to be precise. It should help experienced strategy people decide where to spend attention. Examples include driver skill, defensive effectiveness, notable-match comments, and whether a team looked strategically compatible with 9470.

The app should optimize for:

- Fast match entry under event pressure
- Reliable operation with poor or inconsistent internet
- Low training burden for scouters
- Clean nightly review for strategy leads
- Easy exports and backups
- A longer-than-expected P2 and backup-pick list
- Opportunistic live sync that improves coordination without becoming a point of failure

The app should avoid:

- Overcollecting data that will not affect picklist decisions
- Complex scoring formulas that hide the underlying evidence
- Making match scouters type long notes every match
- Depending on perfect live sync
- Building a large admin system if a spreadsheet or checklist is enough

## Companion UX Spec

The exact match-scouting data-entry flow is defined in `docs/match-scouting-input-ux.md`.

That UX spec should be treated as the source of truth for the match scouter interface. This technical plan keeps the system scope, data surfaces, and build order, while the UX spec defines how scouters actually move through match selection, pre-match setup, live match input, and post-match review.

Technical implications from the UX spec:

- Build portrait phone first.
- Treat qualification match scouting as the main match-entry flow.
- Split scouting into match selection, pre-match, during-match, and post-match stages.
- Store raw action intervals and event marks, not only summary booleans.
- Use local autosave after every meaningful input.
- Require post-match review before final submit.
- Keep all live-match controls button-based; no typing during live play.
- Derive objective summaries from raw inputs wherever possible.
- Keep qualitative fields short and review-oriented.

## Accepted Sync Direction

The chosen direction is option 2: offline-first app with live sync plus CSV/JSON backup.

Live sync is valuable, but it is not allowed to be required for collecting match data. The app should work during a match with no internet, store data durably on the device, and then sync whenever connectivity exists. If Houston venue connectivity is bad, a valid operating model is:

- Scout during the day fully offline or partially synced.
- Export or sync during breaks when possible.
- At the hotel each night, open each scouting device and let pending data upload.
- Use manual JSON/CSV export/import for any device that fails to sync.

This means "live sync" should be implemented as an opportunistic queue, not as real-time collaboration that the scouting workflow depends on.

## Primary Users

### Match Scouter

Needs:

- Know which match, alliance, and team they are responsible for
- Enter data quickly during and immediately after a match
- Recover from refreshes, dead battery, or temporary network loss
- Submit with confidence that the data was saved somewhere

### Scout Lead

Needs:

- Assign scouters to teams, matches, and shifts
- See missing or duplicate submissions
- Reassign coverage quickly when someone is absent
- Manage pit scouting status
- Mark teams as DNP, concern, review, or picklist candidate

This can be low tech for the MVP. A spreadsheet, printed schedule, or simple admin table may be enough if the data-entry and review surfaces are strong.

### Strategy Team

Needs:

- Convert raw scouting into nightly decisions
- See reliability concerns clearly
- Find candidates who fit 9470's actual alliance role needs
- Watch back only the matches that matter
- Build, defend, and revise a picklist quickly
- Maintain enough backup depth for late-event changes

The strategy team is the main customer for the data model. If a field does not help strategy make a Thursday DNP decision, a Friday picklist decision, or a Saturday backup/role decision, it should be questioned.

## Nightly Strategy Workflows

### Wednesday Night Or Practice Day: Calibration

Goal:

- Make scouters consistent enough that the data is usable.

App needs:

- A simple practice-mode flow or test event data
- Clear definitions for each rating and flag
- Example descriptions for defense, stealing, feeding, incap, and notable matches
- A way to discard or label practice data separately from real quals data

Output:

- Scouters understand the form
- Scout lead knows which fields caused confusion
- Rating scales are calibrated before Thursday

### Thursday Night: DNP And Reliability Review

Goal:

- Identify teams that are too risky for second-pick, third-pick, or backup-pick consideration.

Most important views:

- Team reliability table
- Incap/failure log
- Electrical/mechanical pit-risk summary
- Missing-data report
- Notable matches that involve failures, disconnects, or major inconsistency

Useful decisions:

- DNP
- Reliability concern
- Needs pit follow-up
- Needs match video review
- Still viable

The Thursday workflow should not require a full picklist. It should quickly answer: "Who can we no longer trust?"

### Friday Night: Picklist Construction

Goal:

- Build a defensible picklist for likely alliance scenarios.

Most important views:

- Candidate list sorted by role fit, reliability, and availability
- Defense/feeding/stealing summary by team
- Driver skill distribution and notes
- Auto compatibility summary
- EPA or external offense metric alongside scouting-derived fit
- Notable-match queue for candidate verification
- Comparison view for two or three similar teams

Useful decisions:

- P2 candidate
- P3 candidate
- Backup candidate
- Do-not-pick
- Needs strategy discussion
- Needs first-pick collaboration if 9470 is A1 or A2

The Friday workflow should expose evidence, not just a score. Strategy should be able to say why one team is above another.

### Saturday: Playoffs, Einstein, And Backup Pivots

Goal:

- Move quickly when alliance selection, declines, robot failures, or bracket conditions change.

Most important views:

- Long backup list
- Availability and picked-status tracking
- Last-known reliability status
- Role-fit filters
- Quick notes from strategy lead
- Candidate search by team number

Useful decisions:

- Next available backup
- Defensive role assignment
- Feeding role assignment
- Auto compatibility check
- Teams to avoid after new failures

Saturday mode should be fast, searchable, and tolerant of incomplete data.

## Core App Surfaces

### 1. Match Scouting Entry

The match scouting entry should be a qualification-match-only, stage-based, button-first phone interface:

1. Match selection
2. Pre-match
3. During match
4. Post-match

MVP fields:

- Event division
- Match number
- Team number
- Alliance color
- Starting position / auto starting pose
- Current action interval timeline
- Post-match BPS estimate, if retained after practice calibration
- Auto attempted
- Auto successful
- Compatible 8-preload auto observed
- Depot auto observed
- Feeding time / fed observed
- Stealing capability observed
- Stealing level: none, partial, full
- Played defense
- Defense rating: 1 to 5
- Clamp time or defended duration, if the team chooses to track it
- Driver skill rating: 1 to 5
- Incap occurred
- Incap severity: partial, full, or unknown
- Incap observable status, such as RSL off/on/unknown, tipped, stuck, piece jammed, or mechanism not moving
- Fouls/cards concern
- Notable match
- Notable reason
- Short optional note

Important behavior:

- Saves locally while filling the form
- Works on phones
- Requires no live-match typing
- Uses hold-based live action buttons with `Driving` as the default state
- Uses buttons, toggles, ratings, and short enums
- Uses portrait phone as the primary layout, with landscape support as a responsive enhancement
- Shows submission status: saved locally, synced, export needed, or error
- Allows correction after submit

### 2. Pit Scouting Entry

MVP fields:

- Team number
- Claimed autos
- Auto reliability estimate
- Can make or modify autos at event
- Electrical quality concern
- Mechanical robustness concern
- Drivebase or drivetrain concern
- Known repair issue
- Short pit notes
- Pit scout confidence

Important behavior:

- Separate from match scouting
- Clearly marks claims versus observed match evidence
- Supports follow-up flags for scout lead

### 3. Scout Lead Operations

MVP functions:

- Load or enter match schedule
- Assign scouters by match/team/shift
- Show coverage grid
- Show missing submissions
- Show duplicate submissions
- Show scouter workload
- Mark data as reviewed
- Export raw data

Low-tech acceptable alternatives:

- Shift schedule maintained in Google Sheets
- Assignments distributed as screenshots or printed cards
- App only validates missing submissions after data comes in

The first build should avoid spending too much time on perfect shift automation. The highest value is preventing lost data and surfacing missing coverage.

### 4. Strategy Dashboard

MVP views:

- Team list
- Team detail page
- Reliability/DNP board
- Candidate filter view
- Notable-match review queue
- Picklist workspace
- Raw-data export

Useful team summary columns:

- Team number
- Matches scouted
- Reliability status
- Incap count
- Pit risk
- Defense average
- Defense sample count
- Driver skill average
- Feeding observed
- Stealing level observed
- Auto compatibility
- Notable match count
- EPA or external offense metric, if imported
- Strategy tag

Useful strategy tags:

- P2 candidate
- P3 candidate
- Backup candidate
- DNP
- Reliability concern
- Needs review
- Needs pit follow-up
- Picked/unavailable

## Technical Approach

### Mobile Platform Decision

The recommended MVP remains a phone-first web app/PWA, but this is a pragmatic choice, not because mobile web is inherently the best input surface.

Why web/PWA is likely best for this event:

- Every student and mentor can open it from a URL or QR code.
- Updates can ship instantly without App Store, TestFlight, or device-management friction.
- It works across iPhones, Android phones, tablets, and laptops.
- It is easier to connect to a simple hosted sync backend.
- It can still save locally with IndexedDB when offline.
- It avoids needing to install and test a native app on every scouting device before Champs.

Mobile web risks:

- Browser chrome takes screen space.
- Accidental scrolling can interfere with hold buttons.
- Long-press behavior can select text or open context menus.
- `touchcancel` and app switching can end button holds unexpectedly.
- iOS Safari behavior needs real-device testing.
- Screen lock, low-power mode, and reloads can interrupt the live-match flow.

Mitigations required if using web/PWA:

- Design portrait-first with large touch targets.
- Use Pointer Events rather than separate mouse/touch handlers.
- Use pointer capture for hold-based action buttons.
- Set `touch-action` deliberately on live controls.
- Disable text selection and callouts on live-match buttons.
- Autosave every action interval and event mark immediately.
- Treat cancelled touches as action end events, not as errors.
- Provide an obvious `Undo` and post-match correction path.
- Test on real iPhones and Android phones before practice day.
- Add an installable PWA shell if time allows, so the app can run full-screen from the home screen.

Native app alternatives:

- A native iOS/Android app would likely feel better for hold buttons and full-screen live input.
- React Native or Flutter could work, but build, signing, device install, and update logistics are higher risk on short notice.
- A native-only app would make it harder to support every mentor/student device.

Decision:

- Build web/PWA first.
- Validate hold-button input on real phones early.
- If hold buttons feel unreliable in mobile browsers, keep the web app but switch the live input model to tap-to-set current action with a large `Driving` reset button and clear active-state timer.
- Do not switch to native unless real-device testing shows mobile web cannot support the live match workflow.

### Recommended MVP Architecture

Build a small offline-first web app.

Recommended stack:

- Vite for the frontend unless there is a specific server-rendering reason to use Next.js
- React for UI
- TypeScript for the app data contracts
- IndexedDB for local durable storage
- Dexie as the IndexedDB wrapper
- Supabase, Firebase, or a simple hosted API for opportunistic sync
- CSV/JSON export as a required backup path
- Optional Google Sheets import/export for strategy review

Implementation decision:

- Use Vite + React + TypeScript.
- Deploy as a static app.
- Keep the app compatible with Vercel and GitHub Pages.
- Use Dexie/IndexedDB locally before adding backend sync.

The central principle: every device must save locally first, then sync or export. A live backend is useful, but it cannot be the only place data exists. The app should be deployable as a static web app plus a small backend service, so it can be hosted quickly and cached by phones.

Recommended implementation shape:

- React single-page app
- IndexedDB local database
- Service worker or PWA caching if time allows
- Sync queue table in local storage
- Hosted backend table for submitted scouting records
- Dashboard reads from local data plus synced/imported records
- Manual import/export always available

### Sync Model

Minimum reliable model:

- Each submission gets a unique id
- Each submission includes device id, scouter name, team, match, and timestamp
- Data is written locally first
- Sync pushes pending submissions when internet is available
- Duplicate detection is based on match number, team number, and scouter assignment
- Exports are available from every device
- Sync status is visible per device and per submission
- Failed sync attempts do not block continued scouting

Possible sync backends:

- Supabase
- Firebase
- A simple server with SQLite/Postgres
- Google Sheets API

Recommended sync backend:

- Supabase if the team wants the fastest normal web-app path.
- Use append-only tables for raw submissions.
- Keep aggregation in the app at first.
- Add authentication only if it can be done without slowing the MVP; otherwise use a shared event code or obscured event-specific route for the short event window.

Nightly hotel-sync workflow:

- Scout lead opens the sync status screen.
- Each device shows pending, synced, and failed submission counts.
- Devices upload over hotel WiFi.
- Scout lead exports all server data after upload.
- Any unsynced device exports JSON/CSV manually.
- Dashboard imports missing files and deduplicates by submission id.

Required fallback:

- No live backend
- Each device exports JSON/CSV at breaks
- Scout lead imports files into the analysis dashboard

This fallback is less smooth but highly robust if venue internet is bad.

### Sync Conflict Rules

Most data should be append-only. Avoid editing shared records in place unless necessary.

Rules:

- Raw match submissions are append-only after final submit.
- Corrections create a new version referencing the previous submission id.
- The dashboard uses the latest non-deleted version for aggregates.
- Strategy tags and picklist entries can be edited by scout leads.
- If two submissions exist for the same team and match, show both and mark the conflict for review.
- Imports and sync use the same merge path.

### Data Model

Core tables or collections:

- `teams`
- `matches`
- `assignments`
- `match_submissions`
- `match_drafts`
- `action_intervals`
- `event_marks`
- `pit_submissions`
- `team_tags`
- `review_items`
- `picklist_entries`
- `scouters`
- `devices`
- `sync_queue`

Important identifiers:

- Team number
- Match number
- Division/event id
- Alliance color
- Station, when known
- Scouter id
- Device id
- Submission id
- Draft id
- Version id

The data model should preserve raw submissions. Aggregates can be recalculated.

Minimum `match_submission` payload:

- Match/team identity
- Scouter/device identity
- Pre-match starting pose and robot status
- Auto expectation and result
- Action interval timeline
- Notable and foul-concern marks
- Incap start/end/severity/observable status/recovered
- Post-match ratings and role review
- BPS estimate, if retained after calibration
- Optional note
- Created, updated, submitted, and synced timestamps

### Analysis Model

Keep scoring transparent.

Derived fields can include:

- Incap count
- Incap rate
- Matches scouted
- Defense average
- Defense duration
- Blocked duration
- Beached duration
- Driver skill average
- Feeding observed rate or feeding duration
- Stealing max observed level
- Auto success rate
- Notable-match count
- Reliability warning count
- Foul/card concern count
- BPS estimate distribution, if retained after calibration
- Data completeness status

Avoid using one master score as the only ordering mechanism. Strategy should be able to filter and sort by the actual evidence.

## Objective Versus Qualitative Fields

Objective fields:

- Did the robot become incapacitated?
- How long was the robot incapacitated, if known?
- Did it feed, based on action intervals or post-match review?
- Did it play defense, based on action intervals or post-match review?
- How much time was spent defending, blocked, or beached?
- Was auto attempted?
- Was auto successful?
- Was a notable match flagged?
- Was a foul/card concern flagged?
- Did pit scouting observe an electrical or mechanical concern?

Semi-objective fields:

- Defense rating
- Driver skill rating
- Stealing level
- Can feed effectively
- Auto reliability estimate
- Pit scout confidence

Qualitative fields:

- Notable reason
- Incap observable-status details
- Driver notes
- Pit notes
- Strategy lead notes

Design rule:

- Objective fields should be easy to aggregate.
- Qualitative fields should be easy to review.
- Semi-objective fields need calibration examples.

## MVP Scope

Build first:

- Data contracts from the UX spec
- IndexedDB local storage
- Stage-based match scouting form
- Hold-based action interval recording
- Local autosave and sync queue
- Export/import raw data
- Minimal opportunistic live sync
- Sync status screen
- Team summary dashboard
- Team detail view
- DNP/reliability board
- Notable-match review queue

Build second:

- Pit scouting form
- Scout lead coverage grid
- Picklist workspace
- External EPA import
- Google Sheets export for strategy review

Defer unless time remains:

- Full shift automation
- User authentication
- Complex permissions
- Advanced predictive scoring
- Video integration
- Fully automated schedule ingestion

## Event Reliability Requirements

The app should handle:

- Poor cell service
- No venue WiFi
- Devices going offline mid-match
- Accidental refresh
- Duplicate submissions
- Scouter swaps
- Missing data
- Late schedule changes
- Long days with low battery

Required safeguards:

- Local autosave
- Clear saved/synced status
- Manual export
- Import and merge
- Duplicate detection
- Simple data correction
- Raw data always visible
- Nightly sync status review
- Device-level pending submission counts
- Practice-mode data separation

## Initial Build Subtasks

1. Freeze the match scouting data contract from `docs/match-scouting-input-ux.md`.
2. Define exact pit scouting fields.
3. Create project skeleton.
4. Implement IndexedDB tables for drafts, submissions, action intervals, event marks, and sync queue.
5. Implement submission ids, device ids, version ids, and import/export merge rules.
6. Build stage-based match scouting entry.
7. Build hold-based action interval recording with undo.
8. Build post-match review and required-field validation.
9. Build JSON/CSV export and import.
10. Build minimal live sync and sync status screen.
11. Build team aggregation logic from raw records.
12. Build strategy dashboard views.
13. Build reliability/DNP board.
14. Build notable-match queue.
15. Add pit scouting.
16. Add scout lead coverage tools.
17. Add picklist workspace and EPA import.

## Recommended Next Decision

The MVP sync strategy is selected:

1. Offline-first app with live sync plus CSV/JSON backup

Next technical decision:

- Pick the sync backend.
- Supabase is the leading recommendation for speed unless the team already has Firebase or another backend ready.
- The fallback path remains export/import, so the first implementation should keep sync isolated behind a small adapter.
