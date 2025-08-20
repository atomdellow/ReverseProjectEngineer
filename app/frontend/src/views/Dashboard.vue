<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="card">
      <div class="card-header">
        <h2 class="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p class="text-gray-600">Overview of your project analysis and Jira sync activities</p>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div class="bg-white p-6 rounded-lg shadow border">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-500">Components</p>
              <p class="text-2xl font-semibold text-gray-900">{{ stats.components }}</p>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow border">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-500">Modules</p>
              <p class="text-2xl font-semibold text-gray-900">{{ stats.modules }}</p>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow border">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <svg class="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1.447.894L12 15.382l-2.553 1.512A1 1 0 018 16V4z" clip-rule="evenodd"/>
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-500">Artifacts</p>
              <p class="text-2xl font-semibold text-gray-900">{{ stats.artifacts }}</p>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow border">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg class="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clip-rule="evenodd"/>
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-500">Relations</p>
              <p class="text-2xl font-semibold text-gray-900">{{ stats.relations }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Recent Analysis Sessions -->
      <div class="card">
        <div class="card-header">
          <h3 class="text-lg font-medium text-gray-900">Recent Analysis Sessions</h3>
        </div>
        <div class="space-y-4">
          <div 
            v-for="session in recentSessions" 
            :key="session.id"
            class="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
          >
            <div>
              <p class="font-medium text-gray-900">{{ session.name }}</p>
              <p class="text-sm text-gray-500">{{ formatDate(session.createdAt) }}</p>
            </div>
            <div class="flex items-center space-x-2">
              <span 
                class="px-2 py-1 text-xs font-medium rounded-full"
                :class="getStatusClass(session.status)"
              >
                {{ session.status }}
              </span>
              <button class="btn-secondary text-sm">View</button>
            </div>
          </div>
          <div v-if="recentSessions.length === 0" class="text-center py-8 text-gray-500">
            No analysis sessions yet. <router-link to="/analyze" class="text-primary-600 hover:underline">Start your first analysis</router-link>
          </div>
        </div>
      </div>

      <!-- Recent Jira Sync Jobs -->
      <div class="card">
        <div class="card-header">
          <h3 class="text-lg font-medium text-gray-900">Recent Jira Sync Jobs</h3>
        </div>
        <div class="space-y-4">
          <div 
            v-for="job in recentJobs" 
            :key="job.id"
            class="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
          >
            <div>
              <p class="font-medium text-gray-900">{{ job.name }}</p>
              <p class="text-sm text-gray-500">{{ formatDate(job.createdAt) }}</p>
            </div>
            <div class="flex items-center space-x-2">
              <span 
                class="px-2 py-1 text-xs font-medium rounded-full"
                :class="getStatusClass(job.status)"
              >
                {{ job.status }}
              </span>
              <button class="btn-secondary text-sm">View</button>
            </div>
          </div>
          <div v-if="recentJobs.length === 0" class="text-center py-8 text-gray-500">
            No sync jobs yet. <router-link to="/preview" class="text-primary-600 hover:underline">Preview your first sync</router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="card">
      <div class="card-header">
        <h3 class="text-lg font-medium text-gray-900">Quick Actions</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <router-link 
          to="/analyze"
          class="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
        >
          <div class="text-center w-full">
            <svg class="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            <h4 class="mt-2 font-medium text-gray-900">Start Analysis</h4>
            <p class="text-sm text-gray-500">Analyze a new codebase</p>
          </div>
        </router-link>

        <router-link 
          to="/preview"
          class="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
        >
          <div class="text-center w-full">
            <svg class="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
            <h4 class="mt-2 font-medium text-gray-900">Preview Sync</h4>
            <p class="text-sm text-gray-500">Preview Jira issue creation</p>
          </div>
        </router-link>

        <router-link 
          to="/settings"
          class="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
        >
          <div class="text-center w-full">
            <svg class="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <h4 class="mt-2 font-medium text-gray-900">Configure</h4>
            <p class="text-sm text-gray-500">Setup Jira integration</p>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'

const dashboardStore = useDashboardStore()

const stats = ref({
  components: 0,
  modules: 0,
  artifacts: 0,
  relations: 0
})

const recentSessions = ref([])
const recentJobs = ref([])

onMounted(async () => {
  try {
    await dashboardStore.loadDashboardData()
    stats.value = dashboardStore.stats
    recentSessions.value = dashboardStore.recentSessions
    recentJobs.value = dashboardStore.recentJobs
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  }
})

function formatDate(date: string) {
  return new Date(date).toLocaleDateString()
}

function getStatusClass(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'running':
      return 'bg-blue-100 text-blue-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
</script>