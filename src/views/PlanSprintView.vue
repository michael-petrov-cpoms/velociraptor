<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
const teamId = route.params.id
</script>

<template>
  <div class="container">
    <h1>Plan Sprint</h1>
    <p>
      <strong>Team ID:</strong> {{ teamId }}
    </p>
    <p>This is where the sprint planning calculator will be displayed.</p>

    <div class="placeholder-nav">
      <RouterLink :to="`/team/${teamId}`">
        <f-button text="Back to Team" type="text" />
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.placeholder-nav {
  margin-top: 2rem;
}
</style>
