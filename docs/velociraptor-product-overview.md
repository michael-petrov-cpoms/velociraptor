# Velociraptor

A sprint capacity planning tool for scrum teams at Raptor Technologies.

Built with Vue.

---

## What It Does

Velociraptor helps teams answer one question at the start of every sprint: **"How many points should we commit to?"**

It learns from your team's history. Each sprint you log what you completed and how many leave days you had. Over time, Velociraptor builds an accurate picture of your team's true velocity and adjusts recommendations based on upcoming availability.

No more guessing. No more overcommitting because half the team is on holiday.

---

## User Journey

### First Time Setup

1. User opens Velociraptor
2. User creates their team:
   - Team name (e.g., "Backend Team")
   - Total team members (for display)
   - Number of developers (for velocity calculations — excludes QA, PM, etc.)
   - Sprint length in days
   - Expected velocity (optional) — a baseline for teams without history
3. Team appears in the team list
4. If no baseline was set, user is prompted to start logging sprints to build history

### Logging a Completed Sprint

At the end of each sprint:

1. User selects their team
2. User enters:
   - Sprint end date
   - Points completed
   - Total leave days taken during the sprint
3. Data is saved
4. User can see their sprint history growing

### Planning a New Sprint

At the start of sprint planning:

1. User selects their team
2. User enters expected leave days for the upcoming sprint
3. Velociraptor displays:
   - Recommended points to commit
   - How this compares to the team's average
   - The capacity percentage (e.g., "Team is at 85% capacity")

### Managing Teams

Users can:

- View all teams
- Edit team details (name, members, developers, sprint length)
- View sprint history for any team
- Edit or delete logged sprints (to fix mistakes)
- Delete teams if no longer needed

---

## Key Screens

1. **Home / Team List** — Overview of all teams with quick stats
2. **Team Detail** — Sprint history and team settings
3. **Log Sprint** — Form to record a completed sprint
4. **Plan Sprint** — The capacity calculator with recommendation

---

## How the Recommendation Works

Velociraptor normalises each sprint's performance based on actual availability. The formula calculates **velocity per day** for the team:

1. Users enter total person-days of leave (e.g., 2 developers × 3 days off = 6 leave days). Half-days are supported.
2. Leave days are converted to "equivalent team days" by dividing by developer count
3. Available days = sprint length - equivalent leave days
4. Velocity per day = points completed / available days
5. Recommended points are **rounded down** to provide a conservative estimate

A sprint where the team completed 32 points with reduced availability is treated the same as a sprint with 40 points at full capacity — they represent the same productivity rate.

Velociraptor uses a **rolling average of up to 5 data points** to calculate recommendations.

### New Teams and Manual Baselines

For new or project-based teams without historical data, Velociraptor uses the manually entered baseline velocity (expected points per sprint) for recommendations.

As the team logs completed sprints, the baseline is **blended** with real data:
- 0 sprints → baseline only
- 1 sprint → average of baseline + sprint
- 2 sprints → average of baseline + 2 sprints
- ...and so on

Once a team has 5 or more sprints logged, the baseline drops out automatically and only real sprint data is used. This gradual transition prevents a single unusual sprint from dramatically shifting the recommendations.

---

## Data Storage

All data is stored in Firebase Firestore. This allows data to persist across devices and browsers.

### Data Model

- **Teams**: Name, total member count, developer count, sprint length, optional baseline velocity
- **Sprints**: End date, points completed, leave days (as sum of individual person-days), snapshots of sprint length and developer count at time of logging

---

## Future Possibilities

- Export sprint history
- Multiple sprint length support per team
- Confidence indicators based on data volume
- Team comparisons
- Integration with Jira or other sprint tools
