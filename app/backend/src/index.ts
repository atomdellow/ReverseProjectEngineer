import express from 'express';
import { connectDatabase } from './config/mongo';
import { env, isDevelopment } from './config/env';
import { logger } from './core/utils';

// Routes
import analysisRoutes from './routes/analysis.routes';
import jiraRoutes from './routes/jira.routes';
import configRoutes from './routes/config.routes';
import healthRoutes from './routes/health.routes';

// Middleware
import { errorHandler } from './middleware/errorHandler';

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();

    // Create Express app
    const app = express();

    // Middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // CORS for development
    if (isDevelopment) {
      app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      });
    }

    // Routes
    app.use('/api/analysis', analysisRoutes);
    app.use('/api/jira', jiraRoutes);
    app.use('/api/config', configRoutes);
    app.use('/api/health', healthRoutes);

    // Error handling
    app.use(errorHandler);

    // Start server
    app.listen(env.PORT, () => {
      logger.info(`Server started on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();