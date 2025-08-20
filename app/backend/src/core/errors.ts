export {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  JiraError
} from './types';

export class AnalysisError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'ANALYSIS_ERROR', details);
    this.name = 'AnalysisError';
  }
}

export class GitError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'GIT_ERROR', details);
    this.name = 'GitError';
  }
}

export class QueueError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'QUEUE_ERROR', details);
    this.name = 'QueueError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_ERROR', { retryAfter });
    this.name = 'RateLimitError';
  }
}