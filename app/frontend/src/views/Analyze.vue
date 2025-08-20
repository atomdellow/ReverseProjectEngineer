<template>
  <div class="space-y-6">
    <div class="card">
      <div class="card-header">
        <h2 class="text-2xl font-bold text-gray-900">Analyze Repository</h2>
        <p class="text-gray-600">Analyze your codebase structure and dependencies</p>
      </div>

      <form @submit.prevent="runAnalysis" class="space-y-6">
        <!-- Repository Paths -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Repository Paths
          </label>
          <textarea
            v-model="form.repositoryPaths"
            class="input h-32"
            placeholder="Enter repository paths, one per line&#10;/path/to/repo1&#10;/path/to/repo2"
            required
          ></textarea>
          <p class="mt-1 text-sm text-gray-500">
            Enter the full paths to the repositories you want to analyze
          </p>
        </div>

        <!-- Analysis Settings -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Max Depth
            </label>
            <input
              v-model.number="form.settings.maxDepth"
              type="number"
              min="1"
              max="20"
              class="input"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Languages (optional)
            </label>
            <input
              v-model="languageInput"
              type="text"
              class="input"
              placeholder="JavaScript, TypeScript, Python"
            />
            <p class="mt-1 text-sm text-gray-500">
              Comma-separated list. Leave empty to analyze all supported languages.
            </p>
          </div>
        </div>

        <!-- Checkboxes -->
        <div class="space-y-3">
          <label class="flex items-center">
            <input
              v-model="form.settings.includeTests"
              type="checkbox"
              class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span class="ml-2 text-sm text-gray-700">Include test files</span>
          </label>

          <label class="flex items-center">
            <input
              v-model="form.settings.includeNodeModules"
              type="checkbox"
              class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span class="ml-2 text-sm text-gray-700">Include node_modules</span>
          </label>
        </div>

        <!-- Submit Button -->
        <div class="flex justify-end">
          <button
            type="submit"
            :disabled="loading"
            class="btn-primary"
            :class="{ 'opacity-50 cursor-not-allowed': loading }"
          >
            {{ loading ? 'Analyzing...' : 'Start Analysis' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Results -->
    <div v-if="result" class="card">
      <div class="card-header">
        <h3 class="text-lg font-medium text-gray-900">Analysis Results</h3>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="text-center">
          <div class="text-3xl font-bold text-primary-600">{{ result.summary.components }}</div>
          <div class="text-sm text-gray-500">Components</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-green-600">{{ result.summary.modules }}</div>
          <div class="text-sm text-gray-500">Modules</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-purple-600">{{ result.summary.artifacts }}</div>
          <div class="text-sm text-gray-500">Artifacts</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-yellow-600">{{ result.summary.relations }}</div>
          <div class="text-sm text-gray-500">Relations</div>
        </div>
      </div>

      <div class="flex justify-end space-x-3">
        <router-link
          :to="`/preview?sessionId=${result.sessionId}`"
          class="btn-primary"
        >
          Preview Jira Sync
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'

const analysisStore = useAnalysisStore()

const loading = ref(false)
const result = ref(null)

const form = ref({
  repositoryPaths: '',
  settings: {
    maxDepth: 10,
    includeTests: true,
    includeNodeModules: false
  }
})

const languageInput = ref('')

const repositoryPathsArray = computed(() => {
  return form.value.repositoryPaths
    .split('\n')
    .map(path => path.trim())
    .filter(path => path.length > 0)
})

const languagesArray = computed(() => {
  return languageInput.value
    .split(',')
    .map(lang => lang.trim())
    .filter(lang => lang.length > 0)
})

async function runAnalysis() {
  loading.value = true
  try {
    const analysisResult = await analysisStore.runAnalysis({
      repositoryPaths: repositoryPathsArray.value,
      settings: {
        ...form.value.settings,
        languages: languagesArray.value
      }
    })
    result.value = analysisResult
  } catch (error) {
    console.error('Analysis failed:', error)
    // Handle error
  } finally {
    loading.value = false
  }
}
</script>