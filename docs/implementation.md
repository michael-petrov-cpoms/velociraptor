# Velociraptor Implementation Guide

A portable guide for building the sprint capacity planning tool. Mark steps `[x]` as complete.

---

## Technical Specifications

### Data Model

**Team**
```typescript
interface Team {
  id: string                  // Firestore auto-generated
  name: string                // 1-50 characters
  memberCount: number         // Total team size (for display)
  developerCount: number      // Developers only (for velocity calculation)
  sprintLengthDays: number    // 1-30 days
  baselineVelocity?: number   // Optional, points PER SPRINT (not per day)
  createdAt: Timestamp
}
```

**Sprint**
```typescript
interface Sprint {
  id: string                  // Firestore auto-generated
  teamId: string
  endDate: Timestamp
  pointsCompleted: number     // min 0 (0-point sprints allowed with warning)
  leaveDays: number           // Sum of individual person-days, allows 0.5 increments
  sprintLengthDays: number    // Snapshot from team at time of logging
  developerCount: number      // Snapshot from team at time of logging
  createdAt: Timestamp
}
```

### Velocity Formula

**For logging a completed sprint:**
```
equivalentLeaveDays = leaveDays / developerCount
availableDays = sprintLengthDays - equivalentLeaveDays
velocityPerDay = pointsCompleted / availableDays
```

**For planning an upcoming sprint:**
```
availableDaysNextSprint = sprintLengthDays - (expectedLeaveDays / developerCount)
recommendedPoints = floor(averageVelocityPerDay × availableDaysNextSprint)
fullCapacityPoints = floor(averageVelocityPerDay × sprintLengthDays)
capacityPercentage = (availableDaysNextSprint / sprintLengthDays) × 100
comparisonDelta = recommendedPoints - fullCapacityPoints  // negative when reduced capacity
```

**Algorithm details:**
- **Average method**: Rolling average of up to 5 data points, sorted by `endDate` descending
- **Leave days**: Users enter total person-days of leave (e.g., 2 people × 3 days = 6). Half-days (0.5) allowed.
- **Baseline blending**: If baseline exists, treat it as one data point in the average:
  - 0 sprints + baseline → use baseline only
  - 1 sprint + baseline → average of (baseline + sprint) / 2
  - 2 sprints + baseline → average of (baseline + 2 sprints) / 3
  - ...up to 4 sprints + baseline → average of 5 data points
  - 5+ sprints → baseline drops out, use last 5 sprints only
- **No baseline**: If no baseline set, average only the available sprints (1-5)
- **Recommended points**: Always round DOWN to nearest integer (conservative estimate)

**Baseline conversion:** `baselineVelocityPerDay = baselineVelocity / sprintLengthDays`

### Validation Rules

| Field | Rule |
|-------|------|
| `team.name` | Required, 1-50 characters |
| `team.memberCount` | Required, integer, min 1 |
| `team.developerCount` | Required, integer, min 1, ≤ memberCount |
| `team.sprintLengthDays` | Required, integer, min 1, max 30 |
| `team.baselineVelocity` | Optional, min 0 (unit: points per sprint), allows 0.5 increments |
| `sprint.endDate` | Required, must be ≤ today (can't log future sprints) |
| `sprint.pointsCompleted` | Required, min 0, allows 0.5 increments (show warning if 0) |
| `sprint.leaveDays` | Required, min 0, allows 0.5 increments |
| `sprint.leaveDays` | Must result in availableDays ≥ 1 (prevents division edge case) |

**Derived validation:**
```
availableDays = sprintLengthDays - (leaveDays / developerCount)
if (availableDays < 1) → validation error: "Leave days too high"
```

### Known Limitations (MVP)

| Limitation | Notes |
|------------|-------|
| **No authentication** | Anyone with URL can access. Secure with Firebase Auth post-MVP. |
| **No offline support** | Requires internet connection. Firestore offline can be added later. |
| **Desktop-focused** | Mobile responsive design deferred to post-MVP. |
| **Last-write-wins** | No conflict resolution for concurrent edits. |

---

## Pre-build Prerequisites

### FeatherUI Registry Access (One-time Setup)

Before Step 1.2, the user must configure GitLab registry access for `@raptor/feather-ui`.

👉 **See [`feather-installation-instructions.md`](./feather-installation-instructions.md)** for complete setup instructions including:
- How to get a GitLab Personal Access Token
- Setting up the `GITLAB_TOKEN` environment variable
- Creating `.yarnrc.yml` for the private registry

---

## Phase 1: Project Foundation

### Step 1.1: Scaffold Vue Project ✓
- [x] Create Vue 3 project with Vite (`npm create vue@latest`)
- [x] Enable TypeScript, Vue Router, Pinia, Vitest, ESLint
- [x] Run `npm install` and verify `npm run dev` works
- [x] Commit: "chore: scaffold Vue 3 project"

### Step 1.2: Add FeatherUI ✓

> 📖 **Reference**: See [`feather-installation-instructions.md`](./feather-installation-instructions.md) for complete code examples

- [x] Install FeatherUI and Sass (`yarn add @raptor/feather-ui` and `yarn add -D sass`)
- [x] Update `src/main.ts`:
  - Import FeatherUI CSS: `import '@raptor/feather-ui/feather-ui.css'`
  - Import and register FeatherUI plugin: `import FeatherUI, { FEATHER_LOCALE_KEY } from '@raptor/feather-ui'`
  - Import icons: `import IconsPath from '@raptor/feather-ui/icons.svg'`
  - Use plugin: `.use(FeatherUI)`
  - Provide locale: `.provide(FEATHER_LOCALE_KEY, 'en-gb')`
  - Provide icons: `.provide('iconsSvgPath', IconsPath)`
- [x] Update `vite.config.ts`:
  - Add `optimizeDeps: { exclude: ['@raptor/feather-ui'] }`
  - Add SCSS preprocessor config: `css: { preprocessorOptions: { scss: { additionalData: '@import "@raptor/feather-ui/_base.scss";' } } }`
- [x] Add TypeScript declaration in `env.d.ts`: `declare module '@raptor/feather-ui'`
- [x] Create test component with `<f-button text="Test" type="primary" />` to verify styling works
- [x] Commit: "feat: add FeatherUI component library"

### Step 1.3: Firebase Setup ✓
- [x] Create Firebase project in console
- [x] Enable Firestore database
- [x] Install firebase and vuefire packages (`npm install firebase vuefire`)
- [x] Create `src/firebase/config.ts` with initialization
- [x] Create `.env.local` file with Firebase config (add to .gitignore)
- [x] Commit: "chore: configure Firebase project"

### Step 1.4: Define Types ✓
- [x] Create `src/types/index.ts`
- [x] Define `Team` interface (see Data Model above)
- [x] Define `Sprint` interface (see Data Model above)
- [x] Commit: "feat: add TypeScript types for Team and Sprint"

### Step 1.5: Set Up Router ✓
- [x] Define routes: `/` (home), `/team/:id`, `/team/:id/log`, `/team/:id/plan`
- [x] Create placeholder view components
- [x] Test navigation works
- [x] Note: Create Team, Edit Team, Edit Sprint are modals (no dedicated routes)
- [x] Commit: "feat: configure vue-router with app routes"

---

## Phase 2: Core Data & Logic

### Step 2.1: Firestore Collections ✓
- [x] Create `teams` collection in Firestore
- [x] Create `sprints` collection (with teamId field for querying)
- [x] Set up Firestore security rules (allow read/write for MVP — see Known Limitations)
- [x] Test read/write from Firebase console
- [x] Commit: "feat: set up Firestore collections"

### Step 2.2: Team Store (Pinia + VueFire) ✓
- [x] Create `src/stores/teamStore.ts`
- [x] Use VueFire's `useCollection` for reactive Firestore binding
- [x] Implement: addTeam, updateTeam, deleteTeam, getTeamById
- [x] On deleteTeam: also delete all sprints with matching teamId (client-side cascade)
- [x] Write unit tests for store actions (mock Firestore)
- [x] Commit: "feat: add team store with Firestore"

### Step 2.3: Sprint Store (Pinia + VueFire) ✓
- [x] Create `src/stores/sprintStore.ts`
- [x] Implement: addSprint, updateSprint, deleteSprint, getSprintsForTeam
- [x] Query sprints by teamId, order by `endDate` descending
- [x] Write unit tests
- [x] Commit: "feat: add sprint store with Firestore"

### Step 2.4: Velocity Calculator ✓
- [x] Create `src/composables/useVelocityCalculator.ts`
- [x] Implement normalised velocity calculation using the formula above
- [x] Take last 5 sprints by `endDate` descending
- [x] For baseline: convert `baselineVelocity / sprintLengthDays` to get velocity per day
- [x] Handle edge case: no sprints and no baseline (return null/prompt user)
- [x] Write unit tests for calculation edge cases:
  - Team with 0 sprints, no baseline → returns null
  - Team with 0 sprints, with baseline → uses baseline only
  - Team with 1 sprint, with baseline → blends (baseline + sprint) / 2
  - Team with 4 sprints, with baseline → blends all 5 data points
  - Team with 5+ sprints → baseline drops out, uses last 5 sprints only
  - Team with 1-4 sprints, no baseline → averages available sprints only
  - Sprint with high leave days (near limit)
  - Sprint with 0 points → included in average (drags it down)
- [x] Commit: "feat: add velocity calculation composable"

---

## Phase 3: UI Screens

### Step 3.1: Home / Team List ✓
- [x] Create `src/views/HomeView.vue`
- [x] Display list of teams using FeatherUI layout components
- [x] Show quick stats per team:
  - Sprint count (number of logged sprints)
  - Last velocity (most recent sprint's raw `pointsCompleted`, or "No sprints" if none)
- [x] Add "Create Team" button (opens modal)
- [x] Handle loading state while fetching from Firestore
- [x] Handle empty state (no teams yet)
- [x] Write component tests
- [x] Commit: "feat: implement team list home screen"

### Step 3.2: Create Team Modal ✓
- [x] Create `src/components/CreateTeamModal.vue`
- [x] Form fields: name, memberCount, developerCount, sprintLengthDays, baselineVelocity (optional)
- [x] Label baselineVelocity as "Expected points per sprint" for clarity
- [x] Use FeatherUI `<f-button>` with custom styled form inputs (native inputs with FeatherUI CSS variables)
- [x] Implement validation per rules above (on submit only, with cross-field validation)
- [x] Display validation errors with FeatherUI styling
- [x] Write component tests (42 tests covering rendering, validation, submission, close behavior, accessibility)
- [x] Commit: "feat: add create team modal"

### Step 3.3: Team Detail View ✓
- [x] Create `src/views/TeamDetailView.vue`
- [x] Display team info (name, members, developers, sprint length)
- [x] Display sprint history table, sorted by endDate descending
- [x] Show note if sprint's developerCount differs from current team config
- [x] Add edit team / delete team buttons (edit opens modal)
- [x] Add edit/delete buttons for each sprint in history (edit opens modal)
- [x] Navigation to Log Sprint and Plan Sprint
- [x] Handle loading state
- [x] Write component tests
- [x] Commit: "feat: implement team detail view"

### Step 3.4: Edit Team Modal ✓
- [x] Create `src/components/EditTeamModal.vue`
- [x] Pre-fill form with existing team data
- [x] Same validation as create form
- [x] Write component tests
- [x] Commit: "feat: add edit team modal"

### Step 3.5: Log Sprint Form ✓
- [x] Create `src/views/LogSprintView.vue`
- [x] Form: endDate (native date input), pointsCompleted, leaveDays
- [x] Allow 0.5 increments for leaveDays (half-days)
- [x] Auto-populate sprintLengthDays and developerCount from team
- [x] Validate availableDays ≥ 1
- [x] Show confirmation warning if pointsCompleted is 0
- [x] Save sprint and redirect to team detail
- [x] Write component tests
- [x] Commit: "feat: add log sprint form"

### Step 3.6: Edit Sprint Modal ✓
- [x] Create `src/components/EditSprintModal.vue`
- [x] Pre-fill with existing sprint data
- [x] Editable fields: `endDate`, `pointsCompleted`, `leaveDays`
- [x] Read-only fields: `sprintLengthDays`, `developerCount` (snapshots preserved from original logging)
- [x] Same validation as log sprint
- [x] Write component tests
- [x] Commit: "feat: add edit sprint modal"

### Step 3.7: Plan Sprint Calculator ✓
- [x] Create `src/views/PlanSprintView.vue`
- [x] Input: expected leave days for upcoming sprint (allow 0.5 increments)
- [x] Display calculations (see Velocity Formula section):
  - **Recommended points**: `recommendedPoints` (rounded down)
  - **Capacity %**: `capacityPercentage` (e.g., "Team is at 85% capacity")
  - **Comparison**: `comparisonDelta` (e.g., "-5 points vs full capacity" or "Full capacity")
- [x] Create custom capacity visualization bar (styled div or CSS progress)
- [x] Handle teams with no history:
  - If baseline exists: use baseline, show "Based on baseline estimate"
  - If no baseline: show message to log sprints first
- [x] Write component tests
- [x] Commit: "feat: implement sprint planning calculator"

---

## Phase 4: Polish & Deploy

### Step 4.1: Error Handling & Loading States ✓
- [x] Add loading spinners (`<f-loading-spinner>` from FeatherUI)
- [x] Add error messages for failed Firestore operations
- [x] Add confirmation dialogs for delete actions (team and sprint)
- [x] Handle network errors gracefully
- [x] Commit: "feat: add error handling and confirmation dialogs"

### Step 4.2: UI Polish & Tooltips ✓
- [x] Style "Back to Teams" link as a proper styled link (not bare text)
- [x] Style "Delete Team" button with danger/destructive appearance
- [x] Increase sprint history Edit/Delete button size (larger padding + font)
- [x] Add tooltip to "Baseline Velocity" in Team Configuration card
- [x] Add tooltip to "Recommended Points" in Plan Sprint results
- [x] Add tooltips to other key metrics (Capacity %, Data Source, Leave Days)
- [x] Commit: "feat: polish UI buttons and add explanatory tooltips"

### Step 4.3: Final Testing
- [ ] Run full test suite, fix any failures
- [ ] Manual end-to-end testing of all flows:
  - Create team → Log sprints → Plan sprint
  - Edit team → Verify changes persist
  - Delete sprint → Verify recalculation
  - Delete team → Verify sprints cleaned up
  - Log 0-point sprint → Verify warning shown
  - High leave days → Verify validation prevents availableDays < 1
- [ ] Fix any bugs found
- [ ] Commit: "test: ensure all tests pass"

### Step 4.4: Firebase Hosting Deployment
- [ ] Install firebase-tools globally
- [ ] Run `firebase login` and `firebase init hosting`
- [ ] Configure dist directory and SPA rewrite
- [ ] Set up environment variables for production
- [ ] Run `npm run build && firebase deploy`
- [ ] Verify app works at deployed URL
- [ ] Commit: "chore: configure Firebase Hosting"
- [ ] Share deployed URL with team!

---

## Future Enhancements (Post-MVP)

- [ ] Firebase Authentication (secure data per user/team)
- [ ] Firestore offline persistence
- [ ] Mobile responsive design
- [ ] Accessibility improvements / "readable mode"
- [ ] Export sprint history (CSV)
- [ ] Confidence indicators based on data volume
- [ ] Outlier detection for unusual sprints

---

## Session Continuity

At the start of each session:
1. Check this file to see where we left off
2. State which step we're working on
3. Mark steps complete as we go
