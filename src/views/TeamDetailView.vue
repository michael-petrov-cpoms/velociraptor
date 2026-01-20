<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
const teamId = route.params.id
</script>

<template>
  <div class="container">
    <h1>Team Detail</h1>
    <p>
      <strong>Team ID:</strong> {{ teamId }}
    </p>
    <p>This is where team info and sprint history will be displayed.</p>

    <div class="placeholder-nav">
      <p>Actions:</p>
      <div class="button-group">
        <RouterLink :to="`/team/${teamId}/log`">
          <f-button text="Log Sprint" type="primary" />
        </RouterLink>
        <RouterLink :to="`/team/${teamId}/plan`">
          <f-button text="Plan Sprint" type="secondary" />
        </RouterLink>
      </div>

      <p style="margin-top: 1rem">Navigation:</p>
      <RouterLink to="/">
        <f-button text="Back to Teams" type="text" />
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.placeholder-nav {
  margin-top: 2rem;
}

.button-group {
  display: flex;
  gap: 1rem;
  justify-content: center;
}
</style>
