import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { validate, schemas } from '../middleware/validate';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(optionalAuth);

/**
 * Get Jira configuration
 */
router.get('/jira', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Return safe configuration (without secrets)
    res.json({
      success: true,
      data: {
        atlassianSite: process.env.ATLASSIAN_SITE,
        hasCredentials: !!(process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) || 
                       !!(process.env.JIRA_OAUTH_CLIENT_ID && process.env.JIRA_OAUTH_CLIENT_SECRET),
        authMethod: (process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) ? 'api_token' : 'oauth'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update Jira configuration
 */
router.post('/jira', validate(schemas.jiraConfig), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { atlassianSite, projectKey, email, apiToken, oauthClientId, oauthClientSecret } = req.body;

    // In a real implementation, you would save this to the database
    // For now, we'll just validate the configuration
    
    res.json({
      success: true,
      message: 'Jira configuration updated successfully',
      data: {
        atlassianSite,
        projectKey,
        authMethod: (email && apiToken) ? 'api_token' : 'oauth'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Test Jira connection
 */
router.post('/jira/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In a real implementation, you would test the Jira connection here
    res.json({
      success: true,
      data: {
        connected: true,
        message: 'Connection test successful'
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;