import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  MONGO_URI: z.string().default('mongodb://localhost:27017/rpe'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  APP_SECRET: z.string().min(32),
  ATLASSIAN_SITE: z.string().url(),
  JIRA_EMAIL: z.string().email().optional(),
  JIRA_API_TOKEN: z.string().optional(),
  JIRA_OAUTH_CLIENT_ID: z.string().optional(),
  JIRA_OAUTH_CLIENT_SECRET: z.string().optional(),
  CONFLUENCE_SPACE_KEY: z.string().optional(),
  CONFLUENCE_ROOT_PAGE_ID: z.string().optional(),
  API_KEY: z.string().default('dev-api-key'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export type Environment = z.infer<typeof envSchema>;

let env: Environment;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('Environment validation failed:', error);
  process.exit(1);
}

export { env };

export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';