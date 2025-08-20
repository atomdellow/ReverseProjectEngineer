import { AxiosResponse } from 'axios';
import { createJiraClient, JiraClient } from '../config/jira';
import { logger } from '../core/utils';
import { JiraError } from '../core/errors';

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    issuetype: {
      id: string;
      name: string;
    };
    project: {
      id: string;
      key: string;
    };
    parent?: {
      id: string;
      key: string;
    };
    status: {
      id: string;
      name: string;
    };
    assignee?: {
      accountId: string;
      displayName: string;
    };
    priority?: {
      id: string;
      name: string;
    };
    labels: string[];
    created: string;
    updated: string;
    duedate?: string;
    [key: string]: any; // For custom fields
  };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description: string;
  subtask: boolean;
  hierarchyLevel: number;
}

export interface JiraField {
  id: string;
  name: string;
  custom: boolean;
  schema?: {
    type: string;
    system?: string;
  };
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
  };
}

export interface CreateIssueRequest {
  fields: {
    project: {
      key: string;
    };
    summary: string;
    description?: string;
    issuetype: {
      name: string;
    };
    parent?: {
      key: string;
    };
    labels?: string[];
    priority?: {
      name: string;
    };
    duedate?: string;
    assignee?: {
      accountId: string;
    };
    [key: string]: any; // For custom fields
  };
}

export interface BulkCreateIssueRequest {
  issueUpdates: CreateIssueRequest[];
}

export interface SearchRequest {
  jql: string;
  startAt?: number;
  maxResults?: number;
  fields?: string[];
  expand?: string[];
}

export class JiraClientService {
  private client: JiraClient;

  constructor() {
    this.client = createJiraClient();
  }

  /**
   * Get all projects accessible to the user
   */
  async getProjects(): Promise<JiraProject[]> {
    try {
      const response: AxiosResponse<JiraProject[]> = await this.client.get('/project');
      return response.data;
    } catch (error) {
      throw new JiraError('Failed to get projects', error.response?.status, error.response?.data);
    }
  }

  /**
   * Get a specific project by key
   */
  async getProject(projectKey: string): Promise<JiraProject> {
    try {
      const response: AxiosResponse<JiraProject> = await this.client.get(`/project/${projectKey}`);
      return response.data;
    } catch (error) {
      throw new JiraError(`Failed to get project ${projectKey}`, error.response?.status, error.response?.data);
    }
  }

  /**
   * Get issue types for a project
   */
  async getIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
    try {
      const response: AxiosResponse<JiraIssueType[]> = await this.client.get(`/project/${projectKey}/statuses`);
      
      // Extract unique issue types from statuses
      const issueTypes = new Map<string, JiraIssueType>();
      
      response.data.forEach((statusGroup: any) => {
        if (statusGroup.issueTypes) {
          statusGroup.issueTypes.forEach((issueType: any) => {
            issueTypes.set(issueType.id, {
              id: issueType.id,
              name: issueType.name,
              description: issueType.description || '',
              subtask: issueType.subtask || false,
              hierarchyLevel: issueType.hierarchyLevel || 0
            });
          });
        }
      });

      return Array.from(issueTypes.values());
    } catch (error) {
      throw new JiraError(`Failed to get issue types for ${projectKey}`, error.response?.status, error.response?.data);
    }
  }

  /**
   * Get all available fields
   */
  async getFields(): Promise<JiraField[]> {
    try {
      const response: AxiosResponse<JiraField[]> = await this.client.get('/field');
      return response.data;
    } catch (error) {
      throw new JiraError('Failed to get fields', error.response?.status, error.response?.data);
    }
  }

  /**
   * Search for issues using JQL
   */
  async searchIssues(searchRequest: SearchRequest): Promise<{
    issues: JiraIssue[];
    total: number;
    startAt: number;
    maxResults: number;
  }> {
    try {
      const response = await this.client.post('/search', searchRequest);
      return {
        issues: response.data.issues,
        total: response.data.total,
        startAt: response.data.startAt,
        maxResults: response.data.maxResults
      };
    } catch (error) {
      throw new JiraError('Failed to search issues', error.response?.status, error.response?.data);
    }
  }

  /**
   * Get a specific issue by key
   */
  async getIssue(issueKey: string, expand?: string[]): Promise<JiraIssue> {
    try {
      const params: any = {};
      if (expand && expand.length > 0) {
        params.expand = expand.join(',');
      }

      const response: AxiosResponse<JiraIssue> = await this.client.get(`/issue/${issueKey}`, { params });
      return response.data;
    } catch (error) {
      throw new JiraError(`Failed to get issue ${issueKey}`, error.response?.status, error.response?.data);
    }
  }

  /**
   * Create a single issue
   */
  async createIssue(createRequest: CreateIssueRequest): Promise<JiraIssue> {
    try {
      logger.debug(`Creating issue: ${createRequest.fields.summary}`);
      const response: AxiosResponse<{ id: string; key: string; self: string }> = await this.client.post('/issue', createRequest);
      
      // Fetch the created issue to get full details
      return await this.getIssue(response.data.key);
    } catch (error) {
      const errorMessage = error.response?.data?.errors 
        ? Object.values(error.response.data.errors).join('; ')
        : error.message;
      throw new JiraError(`Failed to create issue: ${errorMessage}`, error.response?.status, error.response?.data);
    }
  }

  /**
   * Create multiple issues in bulk
   */
  async createIssuesBulk(createRequests: CreateIssueRequest[]): Promise<{
    issues: Array<{ id: string; key: string; self: string }>;
    errors: Array<{ status: number; elementErrors: any }>;
  }> {
    try {
      const bulkRequest: BulkCreateIssueRequest = {
        issueUpdates: createRequests
      };

      logger.debug(`Creating ${createRequests.length} issues in bulk`);
      const response = await this.client.post('/issue/bulk', bulkRequest);
      
      return {
        issues: response.data.issues || [],
        errors: response.data.errors || []
      };
    } catch (error) {
      throw new JiraError('Failed to create issues in bulk', error.response?.status, error.response?.data);
    }
  }

  /**
   * Update an existing issue
   */
  async updateIssue(issueKey: string, updateRequest: { fields: Record<string, any> }): Promise<void> {
    try {
      logger.debug(`Updating issue: ${issueKey}`);
      await this.client.put(`/issue/${issueKey}`, updateRequest);
    } catch (error) {
      throw new JiraError(`Failed to update issue ${issueKey}`, error.response?.status, error.response?.data);
    }
  }

  /**
   * Get available transitions for an issue
   */
  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    try {
      const response = await this.client.get(`/issue/${issueKey}/transitions`);
      return response.data.transitions;
    } catch (error) {
      throw new JiraError(`Failed to get transitions for ${issueKey}`, error.response?.status, error.response?.data);
    }
  }

  /**
   * Transition an issue to a new status
   */
  async transitionIssue(issueKey: string, transitionId: string, fields?: Record<string, any>): Promise<void> {
    try {
      const transitionRequest: any = {
        transition: {
          id: transitionId
        }
      };

      if (fields) {
        transitionRequest.fields = fields;
      }

      logger.debug(`Transitioning issue ${issueKey} with transition ${transitionId}`);
      await this.client.post(`/issue/${issueKey}/transitions`, transitionRequest);
    } catch (error) {
      throw new JiraError(`Failed to transition issue ${issueKey}`, error.response?.status, error.response?.data);
    }
  }

  /**
   * Add a worklog to an issue
   */
  async addWorklog(issueKey: string, worklog: {
    started: string; // ISO datetime
    timeSpentSeconds: number;
    comment?: string;
    authorAccountId?: string;
  }): Promise<void> {
    try {
      logger.debug(`Adding worklog to ${issueKey}: ${worklog.timeSpentSeconds}s`);
      await this.client.post(`/issue/${issueKey}/worklog`, worklog);
    } catch (error) {
      throw new JiraError(`Failed to add worklog to ${issueKey}`, error.response?.status, error.response?.data);
    }
  }

  /**
   * Link two issues
   */
  async linkIssues(linkType: string, inwardIssueKey: string, outwardIssueKey: string, comment?: string): Promise<void> {
    try {
      const linkRequest = {
        type: {
          name: linkType
        },
        inwardIssue: {
          key: inwardIssueKey
        },
        outwardIssue: {
          key: outwardIssueKey
        },
        comment: comment ? {
          body: comment
        } : undefined
      };

      logger.debug(`Linking issues: ${outwardIssueKey} ${linkType} ${inwardIssueKey}`);
      await this.client.post('/issueLink', linkRequest);
    } catch (error) {
      throw new JiraError(`Failed to link issues`, error.response?.status, error.response?.data);
    }
  }

  /**
   * Search for issues by fingerprint to check for existing issues
   */
  async findIssueByFingerprint(fingerprint: string, projectKey: string): Promise<JiraIssue | null> {
    try {
      const jql = `project = "${projectKey}" AND text ~ "${fingerprint}"`;
      const searchResult = await this.searchIssues({
        jql,
        maxResults: 1,
        fields: ['summary', 'description', 'status', 'issuetype']
      });

      return searchResult.issues.length > 0 ? searchResult.issues[0] : null;
    } catch (error) {
      logger.warn(`Failed to search for fingerprint ${fingerprint}:`, error.message);
      return null;
    }
  }

  /**
   * Test the connection to Jira
   */
  async testConnection(): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const response = await this.client.get('/myself');
      return {
        success: true,
        user: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get server information
   */
  async getServerInfo(): Promise<any> {
    try {
      const response = await this.client.get('/serverInfo');
      return response.data;
    } catch (error) {
      throw new JiraError('Failed to get server info', error.response?.status, error.response?.data);
    }
  }
}