# Match Scouting Data Input UX Plan

This document defines the scouting data-entry experience for match scouters. It is intentionally separate from the technical plan so the app can be built around the actual scouter workflow instead of a long generic form.

The goal is a fast, low-typing, phone-first interface that captures the evidence Team 9470 needs for second-pick, third-pick, backup-pick, and role-fit decisions.

## Primary UX Decision

Design primary orientation: portrait phone.

Reasons:

- Most scouters will hold a phone in the stands.
- Portrait is easier to use one-handed.
- Large vertical button groups are easier to hit while watching the field.
- It keeps match identity, timer, and current action visible without a cramped landscape toolbar.
- Landscape should still work, but it should be a responsive enhancement, not the primary design target.

Minimum touch target: large buttons that can be hit without precision. No live-match typing.

## Interaction Principles

- Split entry into stages: match selection, pre-match, during match, post-match.
- Each stage should show only the controls needed at that moment.
- Every live-match control should be a button, toggle, segmented control, rating, or stepper.
- All live entries must be reversible with an obvious undo or edit-last action.
- The app should autosave after every input.
- Avoid duplicate live controls. If action time already captures a useful signal, do not add a separate flag for the same behavior.
- The match identity should stay visible after selection: match, team, alliance, and station when known.
- Scouters should be allowed to mark "unknown" instead of guessing.
- Post-match should resolve incomplete fields before submit.

## Stage 1: Match Selection

Purpose: make sure the scouter is recording the right robot in the right qualification match before the match starts.

The match scouting flow is for qualification matches. Playoff scouting should be handled through strategy notes or direct observation, not this match-scouter workflow.

The first screen should offer three entry paths:

1. Assigned match and robot
   - Default path when assignments exist.
   - Shows the scouter's next assigned match, team, alliance, and station.
   - Scouter taps `Start Scouting` after verifying.

2. Current match
   - Used when the scouter wants to pick from the currently active or next scheduled match.
   - Shows the match and six robots.
   - Scouter taps the robot they are responsible for.

3. Manual or offline selection
   - Used when assignments, schedule data, or network access are wrong.
   - Required inputs: division/event if known, match number if known, alliance color if known, team number.
   - Station is useful but should not block entry if unknown.
   - Unknown fields can be corrected later.

After selection, show a confirmation screen:

- Large identity summary: `Qual 42 - Red - Team 1234`
- Optional station: `Red 2`
- Scouter name/device label
- Buttons: `Confirm`, `Edit`, `Practice Mode`

Once confirmed, the identity summary stays pinned at the top of every stage.

## Stage 2: Pre-Match

Purpose: capture setup information before the match starts, especially auto starting pose.

Required controls:

- Starting pose field map
  - Use a simple 2D field diagram with five large tappable zones.
  - The five zones should be visually obvious but unlabeled in the main UI.
  - Include separate `Unknown` and `Not on field` buttons outside the field diagram.
  - Store the selected zone as a stable zone id, not as display text.

- Auto expectation, if known
  - `No auto`
  - `Basic auto`
  - `Depot auto`
  - `8-preload compatible`
  - `Unknown`

- Robot status before start
  - `Present`
  - `Not present`
  - `Connection/problem visible`
  - `Unknown`

The pre-match screen should have a single primary button: `Start Match`.

If a match starts before pre-match is complete, the scouter should be able to tap `Start Match` anyway. Missing pre-match fields are resolved in post-match.

## Stage 3: During Match

Purpose: capture objective live behavior without forcing the scouter to type or count low-value details.

The during-match screen should be the simplest and largest screen in the app.

### Layout

Top:

- Match identity
- Match timer
- Save status
- `Undo` button

Middle:

- Current action button grid

Bottom:

- Failure/state buttons
- Incap button only if the robot is truly disabled

### Current Action

Current action is the primary live input. It records what the robot is mainly doing right now.

Use hold buttons, not tap-to-toggle buttons. The default action is `Driving`. While the scouter holds another action, that action is recorded. When they release, the action returns to `Driving`. This avoids long accidental intervals when a scouter forgets to turn a mode off.

Buttons:

- `Driving`
- `Intaking`
- `Scoring`
- `Feeding`
- `Defense`
- `Blocked`
- `Beached`

Behavior:

- One current action is active at a time.
- `Driving` is the default action when no other action is being held.
- Holding an action starts that interval. Releasing it ends that interval and returns to `Driving`.
- `Blocked` means the robot is being prevented from doing its intended action by an opponent.
- `Beached` means the robot is stuck on balls or field elements and can recover or might recover quickly.
- The app stores action intervals with timestamps.
- The current action grid should be large enough that a scouter can press and hold a button while mostly watching the match.
- The app should derive "played defense", "fed", and "scored/attempted scoring role" from action intervals, while still allowing post-match correction.
- Each action should have a simple SVG icon plus a short text label. The icon should help recognition, but the label should remain visible for training and accessibility.

Open decision: if dual-role behavior is common, keep current action as the main role. Do not require scouters to track two simultaneous timelines.

### SVG Icon Set

The live screen needs simple inline SVG icons for fast recognition. Use one visual style: 24px viewBox, thick rounded strokes, no detailed illustrations, and no color-only meaning.

Required icons:

- `Driving`: forward arrow or small chassis with motion line
- `Intaking`: ball with inward arrows
- `Scoring`: ball moving into a target
- `Feeding`: ball moving from robot to partner arrow
- `Defense`: shield or blocking wall
- `Blocked`: robot facing a stop bar or closed path
- `Beached`: chassis over two balls
- `Notable`: flag or star marker
- `Foul concern`: warning card or whistle
- `Incap`: broken plug or disabled robot

These should be implemented as reusable app icons, not image files, so they work offline and can inherit button color/state.

### Live Flags

Live flags should be rare. Do not crowd the match screen with observations that can already be inferred from action time.

Recommended live controls:

- `Notable`
- `Foul concern`
- `Incap`

Behavior:

- Buttons should act as quick marks, not long forms.
- `Notable` opens a post-match required reason, not a live text field.
- `Foul concern` means the scouter noticed a possible foul or card-relevant behavior worth reviewing later.
- `Incap` is reserved for robots that partially or fully lose function. Fast recoverable stuck-on-balls moments should use `Beached` unless the robot cannot recover.

### Incap Flow

The `Incap` button must be large and visually distinct.

When tapped:

1. Current action becomes `Incap`.
2. Timer continues.
3. A compact severity sheet opens with large buttons:
   - `Partial incap`: robot can move but cannot score, intake, or perform its main role.
   - `Full incap`: robot cannot move or is effectively dead.
   - `Unknown`
4. A compact observable-status sheet opens with large buttons:
   - `RSL off`
   - `RSL on`
   - `RSL unknown`
   - `Tipped`
   - `Stuck on field element`
   - `Piece jammed`
   - `Mechanism not moving`
   - `Unknown`
5. Scouter can tap `Recovered` if the robot returns to play.

Post-match should ask for clarification only if incap was marked and no severity or observable status was selected.

### During-Match Non-Goals

Do not require match scouters to:

- Type notes during the match.
- Enter detailed offensive scoring counts unless the team later decides those counts are strategically necessary.
- Classify every game piece interaction perfectly.
- Resolve qualitative ratings before the buzzer.

## Stage 4: Post-Match

Purpose: convert the scouter's observations into reviewable strategy data while the match is still fresh.

Post-match should be required before final submit, but it should stay short.

### Required Review

Show a compact summary first:

- Match/team identity
- Auto starting pose
- Auto expectation/result
- Current-action timeline summary
- Fed observed
- Stealing capability
- Defense observed
- Blocked time
- Beached time
- Incap observed
- BPS estimate
- Notable flag

Each item should be tappable for correction.

### Auto Result

Required fields:

- `Auto attempted`: yes/no/unknown
- `Auto successful`: yes/no/partial/unknown
- `8-preload compatible observed`: yes/no/unknown
- `Depot auto observed`: yes/no/unknown

### Driver Skill Rating

Use a 1 to 5 rating with anchored labels:

- `1`: poor control or decision-making
- `2`: below average
- `3`: average/usable
- `4`: strong
- `5`: excellent, composed under pressure

This is qualitative, so it should be calibrated during practice day.

### BPS Estimate

BPS estimate should be post-match, not live-match. It is a quick approximation while the match is fresh.

Recommended control:

- `<5`
- `10`
- `20`
- `25+`
- `Unknown`

Do not make BPS a free-text field. If the labels do not produce consistent scouting during practice calibration, remove or simplify the field.

### Defense And Role Review

Ask only what is relevant based on observed behavior. Avoid redundant capability flags that ask the scouter to restate what the action timeline and ratings already show.

Fields:

- `Defense effectiveness`: 1 to 5, or `not observed`
- `Can feed effectively`: yes/no/maybe/not observed
- `Can steal`: none/partial/full/not observed

### Reliability And Failure

If incap or visible failure was recorded:

- Confirm incap occurred: yes/no
- Severity: partial/full/unknown
- Observable status: RSL off, RSL on, RSL unknown, tipped, stuck on field element, piece jammed, mechanism not moving, unknown
- Recovered: yes/no
- Approximate duration: short/medium/long/full match

If no incap was recorded, do not force extra reliability questions unless the scouter taps `Add concern`.

### Notable Match

Notable match should be a simple flag with required reason only when selected.

Reason buttons:

- `Failure/reliability`
- `Strong defense`
- `Strong feeding`
- `Strong stealing`
- `Driver skill`
- `Fouls/cards`
- `Auto compatibility`
- `Data uncertainty`
- `Other`

Optional note:

- Short text only.
- Use after the required reason buttons, not before.

### Submit

The submit screen should show:

- `Saved locally`
- `Ready to sync/export`
- Any missing required fields

Primary button: `Submit Match`.

After submit:

- Show a clear completed state.
- Offer `Scout Next Match`.
- Allow `Edit Submission` for corrections.

## Field Priority

Live required:

- Hold-based current action
- Incap if it happens
- Rare live flags: notable, foul concern

Pre-match required:

- Match/team identity
- Starting pose, or unknown

Post-match required:

- Auto attempted/successful
- BPS estimate, or unknown, if the team keeps the field
- Driver skill rating
- Defense and role-review fields when observed
- Incap severity and observable status if incap occurred
- Notable reason if notable was selected

Optional:

- Short notes
- Station
- Detailed counts only if added later after calibration

## Data Stored From This UX

The app should preserve raw inputs, not just summaries.

Store:

- Match identity
- Team identity
- Scouter/device identity
- Pre-match starting pose
- Auto expectation and result
- Action interval timeline
- Notable and foul-concern event marks
- BPS estimate
- Incap start/end/severity/observable status/recovered
- Post-match ratings
- Capability flags
- Optional note
- Timestamps for creation, edits, and submission

Derived later:

- Played defense
- Defense duration
- Fed observed
- Stealing observed or capability marked
- Blocked duration
- Beached duration
- Incap count/rate
- Driver skill average
- Defense rating average
- Role-fit filters
- Notable-match queue

## Practice-Day Calibration

Before real qualification scouting, practice day should verify:

- Scouters understand current-action switching.
- Scouters agree on what counts as feeding, stealing, and defense.
- Driver skill examples are calibrated for ratings 1 through 5.
- Full defense, partial stealing, and full stealing have shared definitions.
- BPS estimate ranges are either calibrated or removed.
- The post-match flow can be completed quickly before the next match.

If a field causes confusion during calibration and does not affect picklist decisions, remove or simplify it.
