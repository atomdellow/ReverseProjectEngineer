<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <h1 class="text-xl font-bold text-gray-900">
              Reverse Project Engineer
            </h1>
          </div>
          <div class="flex items-center space-x-4">
            <router-link
              v-for="item in navigation"
              :key="item.name"
              :to="item.path"
              class="px-3 py-2 rounded-md text-sm font-medium transition-colors"
              :class="$route.path === item.path 
                ? 'bg-primary-100 text-primary-700' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
            >
              {{ item.name }}
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
const navigation = [
  { name: 'Dashboard', path: '/' },
  { name: 'Analyze', path: '/analyze' },
  { name: 'Preview', path: '/preview' },
  { name: 'Apply', path: '/apply' },
  { name: 'Settings', path: '/settings' }
]
</script>