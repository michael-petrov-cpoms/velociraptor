<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Timestamp } from 'firebase/firestore'
import { useTeamStore } from '@/stores/teamStore'
import { useSprintStore } from '@/stores/sprintStore'
import { useVelocityCalculator } from '@/composables/useVelocityCalculator'
import type { Team } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Route & Store Setup
// ─────────────────────────────────────────────────────────────────────────────

const route = useRoute()
const teamStore = useTeamStore()
const sprintStore = useSprintStore()

// ─────────────────────────────────────────────────────────────────────────────
// Computed State
// ─────────────────────────────────────────────────────────────────────────────

const teamId = computed(() => route.params.id as string)
const team = computed(() => teamStore.getTeamById(teamId.value))
const sprints = computed(() => sprintStore.getSprintsForTeam(teamId.value))
const isLoading = computed(() => teamStore.isLoading || sprintStore.isLoading)
const storeError = computed(() => teamStore.error || sprintStore.error)

// ─────────────────────────────────────────────────────────────────────────────
// Safe Team Wrapper
// ─────────────────────────────────────────────────────────────────────────────

const safeTeam = computed<Team>(
  () =>
    team.value ?? {
      id: '',
      name: '',
      memberCount: 0,
      developerCount: 1,
      sprintLengthDays: 1,
      createdAt: Timestamp.now(),
    },
)

// ─────────────────────────────────────────────────────────────────────────────
// Velocity Calculator
// ─────────────────────────────────────────────────────────────────────────────

const { calculatePlan, hasData, dataSourceDescription } = useVelocityCalculator(sprints, safeTeam)

// ─────────────────────────────────────────────────────────────────────────────
// Form State
// ─────────────────────────────────────────────────────────────────────────────

const expectedLeaveDays = ref<number | null>(null)
const hasInteracted = ref(false)

// ─────────────────────────────────────────────────────────────────────────────
// Live Calculation
// ─────────────────────────────────────────────────────────────────────────────

const planResult = computed(() => {
  if (expectedLeaveDays.value === null || expectedLeaveDays.value === undefined) {
    return null
  }
  if (typeof expectedLeaveDays.value !== 'number' || isNaN(expectedLeaveDays.value)) {
    return null
  }
  if (expectedLeaveDays.value < 0) {
    return null
  }
  return calculatePlan(expectedLeaveDays.value)
})

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

const leaveDaysError = computed(() => {
  if (!hasInteracted.value) return null
  if (
    expectedLeaveDays.value === null ||
    expectedLeaveDays.value === undefined ||
    (expectedLeaveDays.value as unknown) === ''
  ) {
    return null
  }
  if (expectedLeaveDays.value < 0) return 'Leave days cannot be negative'
  if (team.value && expectedLeaveDays.value !== null) {
    const availableDays =
      team.value.sprintLengthDays - expectedLeaveDays.value / team.value.developerCount
    if (availableDays < 1) {
      return 'Leave days too high — available days must be at least 1'
    }
  }
  return null
})

// ─────────────────────────────────────────────────────────────────────────────
// Display Computeds
// ─────────────────────────────────────────────────────────────────────────────

const capacityText = computed(() => {
  if (!planResult.value) return ''
  return `Team is at ${Math.round(planResult.value.capacityPercentage)}% capacity`
})

const comparisonText = computed(() => {
  if (!planResult.value) return ''
  if (planResult.value.comparisonDelta === 0) return 'Full capacity'
  return `${planResult.value.comparisonDelta} points vs full capacity`
})

const capacityBarWidth = computed(() => {
  if (!planResult.value) return 0
  return Math.max(0, Math.min(100, planResult.value.capacityPercentage))
})

const capacityBarColorClass = computed(() => {
  if (!planResult.value) return 'low'
  const pct = planResult.value.capacityPercentage
  if (pct >= 80) return 'high'
  if (pct >= 50) return 'medium'
  return 'low'
})

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

function onInput() {
  hasInteracted.value = true
}
</script>

<template>
  <div class="plan-sprint-view">
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container content-width">
      <f-loading-spinner />
    </div>

    <!-- Error State -->
    <div v-else-if="storeError" class="error-container content-width">
      <div class="error-card">
        <h2>Something went wrong</h2>
        <p>{{ storeError.message || 'Failed to load data' }}</p>
        <p class="error-hint">Try refreshing the page.</p>
      </div>
    </div>

    <!-- Team Not Found State -->
    <div v-else-if="!team" class="not-found content-width">
      <h1>Team Not Found</h1>
      <p>The team you're looking for doesn't exist or has been deleted.</p>
      <RouterLink to="/">
        <f-button text="Back to Teams" type="primary" />
      </RouterLink>
    </div>

    <!-- Content -->
    <div v-else class="plan-content content-width">
      <!-- Header -->
      <header class="page-header">
        <RouterLink :to="`/team/${teamId}`" class="back-link">
          &larr; Back to Team {{ team.name }}
        </RouterLink>
        <h1>Plan Sprint</h1>
      </header>

      <!-- Team Context Card -->
      <section class="team-context-card">
        <h2>Team Context</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Team</span>
            <span class="info-value">{{ team.name }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Sprint Length</span>
            <span class="info-value">{{ team.sprintLengthDays }} days</span>
          </div>
          <div class="info-item">
            <span class="info-label">Developers</span>
            <span class="info-value">{{ team.developerCount }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Data Source</span>
            <span class="info-value">{{ dataSourceDescription }}</span>
          </div>
        </div>
      </section>

      <!-- No Data State -->
      <section v-if="!hasData" class="no-data-card">
        <p>Log at least one sprint or set a baseline velocity to get planning recommendations.</p>
        <RouterLink :to="`/team/${teamId}/log`">
          <f-button text="Log a Sprint" type="primary" />
        </RouterLink>
      </section>

      <!-- Calculator -->
      <section v-else class="calculator">
        <!-- Input Card -->
        <div class="form-card">
          <div class="form-field">
            <label for="expected-leave-days" class="form-label"> Expected Leave Days </label>
            <input
              id="expected-leave-days"
              v-model.number="expectedLeaveDays"
              type="number"
              class="form-input"
              :class="{ 'has-error': leaveDaysError }"
              placeholder="e.g., 3"
              min="0"
              step="0.5"
              @input="onInput"
            />
            <p v-if="leaveDaysError" class="field-error" role="alert">
              {{ leaveDaysError }}
            </p>
            <p class="field-hint">Total person-days of leave expected across all developers</p>
          </div>
        </div>

        <!-- Results Card -->
        <div v-if="planResult" class="results-card">
          <div class="recommendation-hero">
            <span class="hero-number">{{ planResult.recommendedPoints }}</span>
            <span
              class="hero-label has-tooltip"
              data-tooltip="Calculated as: average velocity per day × available working days. Rounded down for a conservative estimate."
              >Recommended Points</span
            >
          </div>

          <div class="capacity-section">
            <div class="capacity-header">
              <span
                class="has-tooltip"
                data-tooltip="Percentage of available working days vs total sprint days. 100% means no leave."
                >Capacity</span
              >
              <span>{{ capacityText }}</span>
            </div>
            <div class="capacity-bar-track">
              <div
                class="capacity-bar-fill"
                :class="capacityBarColorClass"
                :style="{ width: `${capacityBarWidth}%` }"
              />
            </div>
          </div>

          <div class="comparison-section">
            <p>{{ comparisonText }}</p>
          </div>

          <div class="data-source">
            <p
              class="has-tooltip"
              data-tooltip="Shows which data points were used: recent sprints, baseline estimate, or both."
            >
              {{ dataSourceDescription }}
            </p>
          </div>
        </div>

        <!-- Placeholder when no interaction yet -->
        <div v-else-if="!hasInteracted" class="results-placeholder">
          <p>Enter expected leave days above to see your sprint recommendation.</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.plan-sprint-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
}

/* Loading State */
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

/* Error State */
.error-container {
  text-align: center;
  padding: 3rem 1rem;
}

.error-card {
  display: inline-block;
  padding: 1.5rem 2rem;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid var(--f-error-color, #dc2626);
  border-radius: 8px;
  color: var(--f-error-color, #dc2626);
  max-width: 500px;
}

.error-card h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.error-card p {
  margin: 0 0 0.5rem 0;
}

.error-card p:last-child {
  margin-bottom: 0;
}

.error-hint {
  font-size: 0.875rem;
  opacity: 0.8;
}

/* Not Found State */
.not-found {
  text-align: center;
  padding: 3rem 1rem;
}

.not-found h1 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  color: var(--f-text-primary, #333);
}

.not-found p {
  margin-bottom: 1.5rem;
  color: var(--f-text-secondary, #666);
}

/* Page Header */
.page-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.page-header h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--f-text-primary, #333);
}

/* Team Context Card */
.team-context-card {
  background: var(--f-background-primary, #fff);
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.team-context-card h2 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--f-text-primary, #333);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--f-text-secondary, #666);
}

.info-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--f-text-primary, #333);
}

/* No Data Card */
.no-data-card {
  background: var(--f-background-primary, #fff);
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
}

.no-data-card p {
  margin: 0 0 1.5rem 0;
  color: var(--f-text-secondary, #666);
  font-size: 1rem;
  line-height: 1.5;
}

/* Form Card */
.form-card {
  background: var(--f-background-primary, #fff);
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

/* Form Fields */
.form-field {
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--f-text-primary, #333);
}

.form-input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-size: 1rem;
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 4px;
  background: var(--f-background-primary, #fff);
  color: var(--f-text-primary, #333);
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--f-primary, #0066cc);
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
}

.form-input.has-error {
  border-color: var(--f-error-color, #dc2626);
}

.form-input.has-error:focus {
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.2);
}

.field-error {
  margin: 0.375rem 0 0 0;
  font-size: 0.8125rem;
  color: var(--f-error-color, #dc2626);
}

.field-hint {
  margin: 0.375rem 0 0 0;
  font-size: 0.8125rem;
  color: var(--f-text-secondary, #666);
}

/* Results Card */
.results-card {
  background: var(--f-background-primary, #fff);
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 8px;
  padding: 2rem;
}

/* Recommendation Hero */
.recommendation-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 2rem;
}

.hero-number {
  font-size: 3rem;
  font-weight: 700;
  color: var(--f-primary, #0066cc);
  line-height: 1;
}

.hero-label {
  font-size: 0.875rem;
  color: var(--f-text-secondary, #666);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Capacity Section */
.capacity-section {
  margin-bottom: 1.5rem;
}

.capacity-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: var(--f-text-secondary, #666);
}

.capacity-bar-track {
  height: 8px;
  background: var(--f-background-secondary, #e5e7eb);
  border-radius: 4px;
  overflow: hidden;
}

.capacity-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.capacity-bar-fill.high {
  background: var(--f-success-color, #16a34a);
}

.capacity-bar-fill.medium {
  background: var(--f-warning-color, #d97706);
}

.capacity-bar-fill.low {
  background: var(--f-error-color, #dc2626);
}

/* Comparison Section */
.comparison-section {
  margin-bottom: 1rem;
  text-align: center;
}

.comparison-section p {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--f-text-secondary, #666);
}

/* Data Source */
.data-source {
  text-align: center;
  border-top: 1px solid var(--f-border-color, #e0e0e0);
  padding-top: 1rem;
}

.data-source p {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--f-text-secondary, #666);
  font-style: italic;
}

/* Results Placeholder */
.results-placeholder {
  background: var(--f-background-primary, #fff);
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
}

.results-placeholder p {
  margin: 0;
  color: var(--f-text-secondary, #666);
  font-size: 0.9375rem;
}
</style>
