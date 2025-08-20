export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Component extends BaseEntity {
  name: string;
  description?: string;
  path: string;
  type: 'component';
  modules: string[]; // Module IDs
  artifacts: string[]; // Artifact IDs
  dependencies: string[]; // Component IDs
  firstSeenAt: Date;
  lastChangedAt: Date;
  commitCount: number;
  tags: string[];
  sessionId: string;
}

export interface Module extends BaseEntity {
  name: string;
  description?: string;
  path: string;
  type: 'module';
  componentId: string;
  artifacts: string[]; // Artifact IDs
  dependencies: string[]; // Module IDs
  firstSeenAt: Date;
  lastChangedAt: Date;
  commitCount: number;
  tags: string[];
  sessionId: string;
}

export interface Artifact extends BaseEntity {
  name: string;
  path: string;
  type: 'artifact';
  language: string;
  role: 'controller' | 'service' | 'model' | 'test' | 'config' | 'view' | 'component' | 'utility' | 'unknown';
  moduleId?: string;
  componentId?: string;
  size: number; // bytes
  lines: number;
  dependencies: string[]; // Artifact IDs
  exports: string[]; // exported symbols
  imports: string[]; // imported symbols/modules
  firstSeenAt: Date;
  lastChangedAt: Date;
  commitCount: number;
  sessionId: string;
}

export interface Relation extends BaseEntity {
  type: 'imports' | 'invokes' | 'owns' | 'tests' | 'configOf' | 'blocks' | 'depends';
  sourceId: string;
  sourceType: 'component' | 'module' | 'artifact';
  targetId: string;
  targetType: 'component' | 'module' | 'artifact';
  strength: number; // 0-1, computed weight
  sessionId: string;
}

export interface AnalysisSession extends BaseEntity {
  sessionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  repositoryPaths: string[];
  includeGlobs: string[];
  excludeGlobs: string[];
  settings: AnalysisSettings;
  startedAt?: Date;
  finishedAt?: Date;
  error?: string;
  stats: AnalysisStats;
}

export interface AnalysisSettings {
  maxDepth: number;
  includeTests: boolean;
  includeNodeModules: boolean;
  languages: string[];
  customRules?: Record<string, any>;
}

export interface AnalysisStats {
  componentsFound: number;
  modulesFound: number;
  artifactsFound: number;
  relationsFound: number;
  languagesDetected: string[];
  processingTimeMs: number;
}

export interface JiraMapping extends BaseEntity {
  name: string;
  projectKey: string;
  isDefault: boolean;
  customFields: {
    actualStart?: string;
    actualFinish?: string;
    originalEstimate?: string;
    [key: string]: string | undefined;
  };
  issueTypes: {
    component: string; // Epic
    module: string; // Story
    artifactDefault: string; // Task
    test: string; // Test
    bug: string; // Bug
    request: string; // Request
  };
  linking: {
    dependency: string; // blocks
    ownership: string; // parent/child
  };
  worklog: {
    maxDailySeconds: number;
    bucketMinutes: number;
  };
  rateLimit: {
    maxPerMinute: number;
  };
  rules: MappingRule[];
}

export interface MappingRule {
  condition: {
    entityType: 'component' | 'module' | 'artifact';
    tagMatches?: string[];
    pathMatches?: string[];
    nameMatches?: string[];
  };
  action: {
    issueType: string;
    parentRule?: string;
    customFields?: Record<string, any>;
  };
}

export interface JiraSyncJob extends BaseEntity {
  sessionId: string;
  mappingId: string;
  type: 'preview' | 'apply';
  status: 'pending' | 'running' | 'completed' | 'failed';
  dryRun: boolean;
  startedAt?: Date;
  finishedAt?: Date;
  progress: {
    total: number;
    processed: number;
    created: number;
    updated: number;
    linked: number;
    errors: number;
  };
  results: JiraSyncResult[];
  error?: string;
}

export interface JiraSyncResult {
  entityId: string;
  entityType: 'component' | 'module' | 'artifact';
  action: 'create' | 'update' | 'skip' | 'error';
  jiraKey?: string;
  jiraId?: string;
  fingerprint: string;
  error?: string;
  changes?: Record<string, any>;
}

export interface WorklogEntry {
  issueKey: string;
  started: string; // ISO datetime
  timeSpentSeconds: number;
  description: string;
  authorAccountId?: string;
}

export interface GitCommitInfo {
  sha: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  filesChanged: string[];
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  type: 'component' | 'module' | 'artifact';
  name: string;
  path: string;
  size: number;
  depth: number;
  tags: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'imports' | 'invokes' | 'owns' | 'tests' | 'configOf';
  strength: number;
}

export interface AuditLog extends BaseEntity {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, any>;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

export interface Secrets extends BaseEntity {
  name: string;
  encryptedValue: string;
  description?: string;
  expiresAt?: Date;
  lastUsed?: Date;
}

// Error types
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

export class JiraError extends AppError {
  constructor(message: string, statusCode: number = 500, jiraError?: any) {
    super(message, statusCode, 'JIRA_ERROR', jiraError);
    this.name = 'JiraError';
  }
}