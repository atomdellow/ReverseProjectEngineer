import { defineStore } from 'pinia'
import axios from 'axios'

interface DashboardStats {
  components: number
  modules: number
  artifacts: number
  relations: number
}

interface AnalysisSession {
  id: string
  name: string
  status: string
  createdAt: string
}

interface SyncJob {
  id: string
  name: string
  status: string
  createdAt: string
}

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    stats: {
      components: 0,
      modules: 0,
      artifacts: 0,
      relations: 0
    } as DashboardStats,
    recentSessions: [] as AnalysisSession[],
    recentJobs: [] as SyncJob[],
    loading: false,
    error: null as string | null
  }),

  actions: {
    async loadDashboardData() {
      this.loading = true
      this.error = null

      try {
        // For now, use mock data
        // In a real implementation, these would be API calls
        this.stats = {
          components: 12,
          modules: 34,
          artifacts: 156,
          relations: 89
        }

        this.recentSessions = [
          {
            id: '1',
            name: 'E-commerce Frontend',
            status: 'completed',
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '2', 
            name: 'Backend API Services',
            status: 'running',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          }
        ]

        this.recentJobs = [
          {
            id: '1',
            name: 'E-commerce Sync',
            status: 'completed',
            createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
          }
        ]
      } catch (error: any) {
        this.error = error.message || 'Failed to load dashboard data'
      } finally {
        this.loading = false
      }
    }
  }
})