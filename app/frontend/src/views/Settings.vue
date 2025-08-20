<template>
  <div class="space-y-6">
    <div class="card">
      <div class="card-header">
        <h2 class="text-2xl font-bold text-gray-900">Settings</h2>
        <p class="text-gray-600">Configure Jira integration and analysis preferences</p>
      </div>

      <!-- Jira Configuration -->
      <div class="space-y-6">
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-4">Jira Configuration</h3>
          
          <form class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Atlassian Site URL
              </label>
              <input
                v-model="jiraConfig.atlassianSite"
                type="url"
                class="input"
                placeholder="https://your-domain.atlassian.net"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Project Key
              </label>
              <input
                v-model="jiraConfig.projectKey"
                type="text"
                class="input"
                placeholder="PROJ"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  v-model="jiraConfig.email"
                  type="email"
                  class="input"
                  placeholder="your-email@example.com"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  API Token
                </label>
                <input
                  v-model="jiraConfig.apiToken"
                  type="password"
                  class="input"
                  placeholder="Your Jira API token"
                />
              </div>
            </div>

            <div class="flex justify-end space-x-3">
              <button
                type="button"
                @click="testConnection"
                class="btn-secondary"
                :disabled="testing"
              >
                {{ testing ? 'Testing...' : 'Test Connection' }}
              </button>
              <button
                type="submit"
                @click.prevent="saveJiraConfig"
                class="btn-primary"
                :disabled="saving"
              >
                {{ saving ? 'Saving...' : 'Save Configuration' }}
              </button>
            </div>
          </form>
        </div>

        <hr class="border-gray-200">

        <!-- Analysis Preferences -->
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-4">Analysis Preferences</h3>
          
          <div class="space-y-4">
            <label class="flex items-center">
              <input
                v-model="analysisConfig.includeTests"
                type="checkbox"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span class="ml-2 text-sm text-gray-700">Include test files by default</span>
            </label>

            <label class="flex items-center">
              <input
                v-model="analysisConfig.includeNodeModules"
                type="checkbox"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span class="ml-2 text-sm text-gray-700">Include node_modules by default</span>
            </label>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Default Max Depth
              </label>
              <input
                v-model.number="analysisConfig.maxDepth"
                type="number"
                min="1"
                max="20"
                class="input w-32"
              />
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <button
              @click="saveAnalysisConfig"
              class="btn-primary"
              :disabled="saving"
            >
              {{ saving ? 'Saving...' : 'Save Preferences' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const saving = ref(false)
const testing = ref(false)

const jiraConfig = ref({
  atlassianSite: '',
  projectKey: '',
  email: '',
  apiToken: ''
})

const analysisConfig = ref({
  includeTests: true,
  includeNodeModules: false,
  maxDepth: 10
})

async function testConnection() {
  testing.value = true
  try {
    // Mock test connection
    await new Promise(resolve => setTimeout(resolve, 2000))
    alert('Connection successful!')
  } catch (error) {
    alert('Connection failed!')
  } finally {
    testing.value = false
  }
}

async function saveJiraConfig() {
  saving.value = true
  try {
    // Mock save
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert('Jira configuration saved!')
  } catch (error) {
    alert('Failed to save configuration!')
  } finally {
    saving.value = false
  }
}

async function saveAnalysisConfig() {
  saving.value = true
  try {
    // Mock save
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert('Analysis preferences saved!')
  } catch (error) {
    alert('Failed to save preferences!')
  } finally {
    saving.value = false
  }
}
</script>