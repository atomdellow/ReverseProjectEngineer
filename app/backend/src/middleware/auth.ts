import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { AuthenticationError } from '../core/errors';

export function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return next(new AuthenticationError('API key is required'));
  }
  
  if (apiKey !== env.API_KEY) {
    return next(new AuthenticationError('Invalid API key'));
  }
  
  next();
}

// Optional authentication for development
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  if (env.NODE_ENV === 'development') {
    // Skip authentication in development
    next();
  } else {
    authenticateApiKey(req, res, next);
  }
}