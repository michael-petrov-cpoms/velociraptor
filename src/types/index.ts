import type { Timestamp } from 'firebase/firestore'

/**
 * Represents a scrum team in Velociraptor.
 *
 * Teams track their capacity and velocity over time through logged sprints.
 */
export interface Team {
  /** Firestore auto-generated document ID */
  id: string
  /** Team display name (1-50 characters) */
  name: string
  /** Total team size including non-developers (for display) */
  memberCount: number
  /** Number of developers (used for velocity calculations) */
  developerCount: number
  /** Standard sprint length in days (1-30) */
  sprintLengthDays: number
  /** Optional baseline velocity in points per sprint (for new teams without history) */
  baselineVelocity?: number
  /** Timestamp when the team was created */
  createdAt: Timestamp
}

/**
 * Represents a completed sprint logged against a team.
 *
 * Sprints capture historical data used to calculate future velocity recommendations.
 * The sprintLengthDays and developerCount are snapshots from the team at logging time,
 * preserving accuracy even if team configuration changes later.
 */
export interface Sprint {
  /** Firestore auto-generated document ID */
  id: string
  /** Reference to the parent Team's ID */
  teamId: string
  /** The date the sprint ended */
  endDate: Timestamp
  /** Story points completed (min 0, allows 0.5 increments) */
  pointsCompleted: number
  /** Sum of individual person-days of leave (allows 0.5 increments) */
  leaveDays: number
  /** Snapshot of team's sprint length at time of logging */
  sprintLengthDays: number
  /** Snapshot of team's developer count at time of logging */
  developerCount: number
  /** Timestamp when the sprint was logged */
  createdAt: Timestamp
}
