<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="container">
    <h1>Teams</h1>
    <p>This is where the team list will be displayed.</p>

    <div class="placeholder-nav">
      <p>Test navigation:</p>
      <RouterLink to="/team/sample-team-123">
        <f-button text="View Sample Team" type="primary" />
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.placeholder-nav {
  margin-top: 2rem;
}
</style>
