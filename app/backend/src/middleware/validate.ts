import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ValidationError } from '../core/errors';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      
      // Update request with validated data
      req.body = result.body || req.body;
      req.query = result.query || req.query;
      req.params = result.params || req.params;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        next(new ValidationError('Validation failed', validationErrors));
      } else {
        next(error);
      }
    }
  };
}

// Common validation schemas
export const schemas = {
  // Analysis schemas
  runAnalysis: z.object({
    body: z.object({
      repositoryPaths: z.array(z.string()).min(1, 'At least one repository path is required'),
      includeGlobs: z.array(z.string()).optional(),
      excludeGlobs: z.array(z.string()).optional(),
      settings: z.object({
        maxDepth: z.number().min(1).max(20).default(10),
        includeTests: z.boolean().default(true),
        includeNodeModules: z.boolean().default(false),
        languages: z.array(z.string()).default([])
      }).optional()
    })
  }),

  getAnalysis: z.object({
    params: z.object({
      sessionId: z.string().min(1, 'Session ID is required')
    })
  }),

  // Jira schemas
  jiraPreview: z.object({
    body: z.object({
      sessionId: z.string().min(1, 'Session ID is required'),
      mappingId: z.string().min(1, 'Mapping ID is required')
    })
  }),

  jiraApply: z.object({
    body: z.object({
      sessionId: z.string().min(1, 'Session ID is required'),
      mappingId: z.string().min(1, 'Mapping ID is required'),
      dryRun: z.boolean().default(false),
      rateLimit: z.object({
        maxPerMinute: z.number().min(1).max(60).default(15)
      }).optional()
    })
  }),

  jiraConfig: z.object({
    body: z.object({
      atlassianSite: z.string().url('Must be a valid URL'),
      projectKey: z.string().min(1, 'Project key is required'),
      email: z.string().email().optional(),
      apiToken: z.string().optional(),
      oauthClientId: z.string().optional(),
      oauthClientSecret: z.string().optional()
    }).refine(
      data => (data.email && data.apiToken) || (data.oauthClientId && data.oauthClientSecret),
      'Either email/apiToken or oauthClientId/oauthClientSecret must be provided'
    )
  }),

  createMapping: z.object({
    body: z.object({
      name: z.string().min(1, 'Name is required'),
      projectKey: z.string().min(1, 'Project key is required'),
      isDefault: z.boolean().default(false),
      customFields: z.object({
        actualStart: z.string().optional(),
        actualFinish: z.string().optional(),
        originalEstimate: z.string().optional()
      }).optional(),
      issueTypes: z.object({
        component: z.string().default('Epic'),
        module: z.string().default('Story'),
        artifactDefault: z.string().default('Task'),
        test: z.string().default('Test'),
        bug: z.string().default('Bug'),
        request: z.string().default('Request')
      }).optional(),
      worklog: z.object({
        maxDailySeconds: z.number().min(3600).max(86400).default(21600),
        bucketMinutes: z.number().min(15).max(480).default(60)
      }).optional(),
      rateLimit: z.object({
        maxPerMinute: z.number().min(1).max(60).default(45)
      }).optional()
    })
  }),

  // Generic schemas
  paginationQuery: z.object({
    query: z.object({
      page: z.string().transform(val => parseInt(val)).refine(val => val > 0).default('1'),
      limit: z.string().transform(val => parseInt(val)).refine(val => val > 0 && val <= 100).default('20')
    })
  }),

  idParam: z.object({
    params: z.object({
      id: z.string().min(1, 'ID is required')
    })
  })
};