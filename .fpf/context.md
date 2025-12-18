# Project Context (A.2.6 Context Slice)

## Slice: Grounding (Infrastructure)
> The physical/virtual environment where the code runs.

- **Platform:** Firebase Hosting (production), local dev server (development)
- **Database:** Firebase Firestore (cloud-hosted NoSQL)
- **Authentication:** None (MVP) — Firebase Auth planned post-MVP
- **Offline Support:** None (MVP) — requires internet connection

## Slice: Tech Stack (Software)
> The capabilities available to us.

- **Language:** TypeScript 5.9
- **Framework:** Vue 3.5.25 (Composition API)
- **State Management:** Pinia 3.0.4 + VueFire
- **Router:** Vue Router 4.6.3
- **Build Tool:** Vite 7.2.4
- **Testing:** Vitest 4.0.14 + @vue/test-utils 2.4.6
- **Linting:** ESLint 9 + Prettier
- **Styling:** NES.css (8-bit retro theme) + Press Start 2P font
- **Node Version:** 20.19+ or 22.12+

## Slice: Product (Domain)
> What the software does.

- **Name:** Velociraptor
- **Purpose:** Sprint capacity planning tool for scrum teams
- **Organization:** Raptor Technologies (internal tool)
- **Core Feature:** Recommends sprint point commitment based on historical velocity, normalized for team availability/leave days
- **Algorithm:** Rolling average of up to 5 sprints, baseline blending for new teams, conservative (floor) rounding

## Slice: Data Model (Entities)
> The core data structures.

- **Team:** id, name, memberCount, developerCount, sprintLengthDays, baselineVelocity?, createdAt
- **Sprint:** id, teamId, endDate, pointsCompleted, leaveDays, sprintLengthDays (snapshot), developerCount (snapshot), createdAt

## Slice: Constraints (Normative)
> The rules we cannot break.

- **Budget:** Internal tool, Firebase free tier initially
- **Timeline:** MVP scope defined in implementation.md
- **Scale:** Multi-team support, single organization
- **Compliance:** None specified
- **Known Limitations (MVP):**
  - No authentication (anyone with URL can access)
  - No offline support
  - Desktop-focused (NES.css may not be fully responsive)
  - Last-write-wins (no conflict resolution)
  - Accessibility concerns (pixel font readability)

## Slice: Learning Context
> This is a learning project.

- **Learner:** User is learning Vue 3
- **Teaching Protocol:** Claude explains before implementing, uses official Vue/Pinia docs only
- **Evidence Labeling:** All statements must be labeled [FACT], [INFERRED], or [ASSUMED]
