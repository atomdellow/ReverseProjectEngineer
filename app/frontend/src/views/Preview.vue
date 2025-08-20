<template>
  <div class="space-y-6">
    <div class="card">
      <div class="card-header">
        <h2 class="text-2xl font-bold text-gray-900">Preview Jira Sync</h2>
        <p class="text-gray-600">Preview what issues will be created in Jira</p>
      </div>
      
      <div class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
        </svg>
        <h3 class="mt-4 text-lg font-medium text-gray-900">Preview Coming Soon</h3>
        <p class="mt-2 text-gray-500">
          This feature will show you a preview of Jira issues that would be created
          from your analyzed codebase.
        </p>
        <div class="mt-6">
          <router-link to="/analyze" class="btn-primary">
            Start Analysis First
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Preview component logic will be implemented here
</script>