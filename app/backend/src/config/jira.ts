import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { env } from './env';
import { logger } from '../core/utils';

export interface JiraConfig {
  baseURL: string;
  email?: string;
  apiToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
}

export class JiraClient {
  private client: AxiosInstance;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private rateLimitDelay = 1000; // Base delay in ms
  private maxRetries = 3;

  constructor(config: JiraConfig) {
    this.client = axios.create({
      baseURL: `${config.baseURL}/rest/api/3`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Set up authentication
    if (config.email && config.apiToken) {
      const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
      this.client.defaults.headers.common['Authorization'] = `Basic ${auth}`;
    } else if (config.oauthClientId && config.oauthClientSecret) {
      // OAuth implementation would go here
      logger.warn('OAuth authentication not yet implemented');
    }

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Jira API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Jira API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for rate limiting and retries
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Jira API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error) => {
        const { config, response } = error;
        
        if (!config || config.__retryCount >= this.maxRetries) {
          return Promise.reject(error);
        }

        config.__retryCount = config.__retryCount || 0;

        // Handle rate limiting (429) and server errors (>=500)
        if (response?.status === 429 || (response?.status >= 500)) {
          const retryAfter = response.headers['retry-after'];
          const delay = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : this.rateLimitDelay * Math.pow(2, config.__retryCount);

          logger.warn(`Jira API rate limited/error. Retrying after ${delay}ms`);
          
          await this.delay(delay);
          config.__retryCount++;
          
          return this.client(config);
        }

        logger.error('Jira API Response Error:', {
          status: response?.status,
          statusText: response?.statusText,
          url: config?.url,
          data: response?.data,
        });
        
        return Promise.reject(error);
      }
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add jitter to delay to avoid thundering herd
   */
  private addJitter(delay: number): number {
    return delay + Math.random() * 1000;
  }

  /**
   * Make a rate-limited request
   */
  async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const response = await this.client.request<T>(config);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          logger.error('Request queue processing error:', error);
        }
        
        // Add delay between requests to respect rate limits
        await this.delay(this.addJitter(this.rateLimitDelay));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Convenience methods for common HTTP operations
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }
}

// Create default Jira client instance
export const createJiraClient = (): JiraClient => {
  return new JiraClient({
    baseURL: env.ATLASSIAN_SITE,
    email: env.JIRA_EMAIL,
    apiToken: env.JIRA_API_TOKEN,
    oauthClientId: env.JIRA_OAUTH_CLIENT_ID,
    oauthClientSecret: env.JIRA_OAUTH_CLIENT_SECRET,
  });
};