<template>
  <div class="space-y-6">
    <div class="card">
      <div class="card-header">
        <h2 class="text-2xl font-bold text-gray-900">Apply Jira Sync</h2>
        <p class="text-gray-600">Execute the Jira sync and create issues</p>
      </div>
      
      <div class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        <h3 class="mt-4 text-lg font-medium text-gray-900">Apply Coming Soon</h3>
        <p class="mt-2 text-gray-500">
          This feature will execute the actual creation of Jira issues
          based on your analyzed codebase.
        </p>
        <div class="mt-6">
          <router-link to="/preview" class="btn-primary">
            Preview First
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Apply component logic will be implemented here
</script>