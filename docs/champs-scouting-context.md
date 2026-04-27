# Team 9470 Champs Scouting Context

Team 9470 is scouting for Championship with a primary focus on finding strong second-pick, third-pick, and backup-pick candidates. The highest-value targets are reliable robots that can play defense, feed, steal game pieces, and support flag-focused strategy.

This document captures the current scouting assumptions, desired pick traits, and objective flags that should guide future scouting-system design.

## Scouting System Options

- Spreadsheet
- Web app
- Spookies

## Scouting Capacity

Available people:

- 11 students
- 19 mentors

Likely staffing assumption:

- Higher load on students
- Mentors sub in occasionally
- Example active scouting crew: 4 students and 2 mentors

## Good Second Or Third Pick Profile

The target robot is not necessarily the highest scorer. A good second or third pick should raise alliance floor through reliability, defense, feeding, stealing, and compatibility with 9470's expected strategy.

Key traits:

1. Reliability
2. Stealing capability
3. Defense capability
4. Driver skill
5. Useful autonomous modes

## Objective Flags To Track

### Reliability

Reliability should be treated as a primary filter.

Useful flags:

- DNP list status
- Incap events
- Incap reason from match scouting
- Electrical risk from pit scouting
- Repeated comms, brownout, disconnect, or mechanical failure observations
- Match-to-match consistency

### Stealing Capability

Stealing is high value for the desired pick profile.

Useful flags:

- Full stealing capability preferred
- Partial stealing capability still valuable
- Can steal under pressure
- Can steal without disrupting alliance partners
- Can transition between stealing, feeding, and defense

### Defense Capability

Defense should be measured as objectively as possible, while still allowing qualitative driver notes.

Potential measurements:

- Defense rating
- Clamp time
- Ability to slow or deny a priority opponent
- Ability to defend without drawing fouls
- Ability to switch between defense and feeding

### Driver Skill

Driver skill should be captured with a simple rating.

Useful flag:

- Driver skill rating from 1 to 5

Rating should reflect control, decision-making, field awareness, ability to avoid fouls, and ability to execute under defense.

### Autonomous Modes

Auto evaluation should focus on compatibility and reliability more than theoretical maximum capability.

Useful flags:

- Compatible 8-preload auto
- Depot auto
- Pit scouting auto claims
- Current auto reliability
- Team experience making autos on the fly
- Ability to adapt autos for alliance strategy

## Offense Capability

There may be a need to account for additional offense capability, but the current assumption is that EPA or a similar external metric can be used for baseline offensive strength.

The scouting system should avoid overloading match scouters with redundant offensive data unless it produces better picklist decisions than EPA.

## Pit Scouting

Pit scouting should be separate from match scouting.

Pit scouting questions should be limited to information that can realistically be gathered and verified in the pits. It should focus on:

- Electrical quality and risk
- Mechanical robustness
- Claimed autos
- Auto reliability
- Experience creating or modifying autos at event
- Drivebase condition and maintainability
- Driver practice or operator confidence, if answerable

Pit scouting should not pretend to measure traits that are better observed in matches.

## Notable Match Flag

Bowen's idea: include a flag for whether a match is notable enough to watch back.

Purpose:

- Reduce scouter variability
- Focus review time on matches that materially affect the picklist
- Preserve context for unusual failures, exceptional defense, major strategic value, or suspicious data

Potential notable-match reasons:

- Robot died, tipped, disconnected, or was incapacitated
- Strong defensive performance
- Major feeding or stealing impact
- Driver looked unusually good or unusually poor
- Fouls or cards affected evaluation
- Auto was especially relevant to compatibility
- Scouting data seems inconsistent with what happened

## Picklist Schedule

### Wednesday: Practice

- Train scouters
- Test the scouting workflow
- Align on rating scales and examples
- Calibrate what counts as defense, feeding, stealing, incap, and notable-match behavior

### Thursday: Qualifications Day 1

- Scout qualification matches
- Hold DNP meeting at night
- Start identifying reliability risks and early second/third-pick candidates

### Friday: Qualifications Day 2

- Continue scouting
- Hold picklist meeting at night
- If 9470 is A1 or A2, reach out to expected first pick and collaborate on strategy
- Build and refine picklist

### Saturday: Division Playoffs And Einstein

- Lock in
- Use the prepared picklist, backup list, and strategic notes
- Track eliminations-relevant updates quickly

## Backup Pick Depth

Good backup picks matter more than initially assumed.

Implication:

- The P2 and backup-pick list needs to be longer than originally planned.
- Reliability and availability should stay visible late in the event.
- The system should make it easy to find acceptable fallback robots quickly.

