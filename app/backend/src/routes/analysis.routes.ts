import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { validate, schemas } from '../middleware/validate';
import { optionalAuth } from '../middleware/auth';
import { Analyzer } from '../analyzer';
import { AnalysisSession } from '../models/AnalysisSession';
import { Component } from '../models/Component';
import { Module } from '../models/Module';
import { Artifact } from '../models/Artifact';
import { Relation } from '../models/Relation';
import { logger } from '../core/utils';
import { NotFoundError } from '../core/errors';

const router = Router();

// Apply authentication to all routes
router.use(optionalAuth);

/**
 * Start a new analysis
 */
router.post('/run', validate(schemas.runAnalysis), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { repositoryPaths, includeGlobs, excludeGlobs, settings } = req.body;

    // Create analyzer with settings
    const analyzer = new Analyzer({
      maxDepth: settings?.maxDepth || 10,
      includeTests: settings?.includeTests ?? true,
      includeNodeModules: settings?.includeNodeModules ?? false,
      languages: settings?.languages || [],
      customRules: {
        includeGlobs: includeGlobs || [],
        excludeGlobs: excludeGlobs || []
      }
    });

    logger.info(`Starting analysis for paths: ${repositoryPaths.join(', ')}`);

    // Run analysis
    const result = await analyzer.analyze(repositoryPaths);

    // Save session to database
    const session = new AnalysisSession(result.session);
    await session.save();

    // Save entities to database
    const savedComponents = await Component.insertMany(result.components);
    const savedModules = await Module.insertMany(result.modules);
    const savedArtifacts = await Artifact.insertMany(result.artifacts);
    const savedRelations = await Relation.insertMany(result.relations);

    logger.info(`Analysis completed for session ${result.session.sessionId}`);

    res.json({
      success: true,
      data: {
        sessionId: result.session.sessionId,
        status: 'completed',
        stats: result.session.stats,
        summary: {
          components: savedComponents.length,
          modules: savedModules.length,
          artifacts: savedArtifacts.length,
          relations: savedRelations.length,
          patterns: result.stats.patterns
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Get analysis results by session ID
 */
router.get('/:sessionId', validate(schemas.getAnalysis), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    // Get session
    const session = await AnalysisSession.findOne({ sessionId });
    if (!session) {
      throw new NotFoundError('Analysis session', sessionId);
    }

    // Get entities
    const [components, modules, artifacts, relations] = await Promise.all([
      Component.find({ sessionId }).populate('modules').populate('artifacts'),
      Module.find({ sessionId }).populate('artifacts'),
      Artifact.find({ sessionId }),
      Relation.find({ sessionId })
    ]);

    res.json({
      success: true,
      data: {
        session,
        components,
        modules,
        artifacts,
        relations,
        summary: {
          components: components.length,
          modules: modules.length,
          artifacts: artifacts.length,
          relations: relations.length
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Get analysis sessions (with pagination)
 */
router.get('/', validate(schemas.paginationQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      AnalysisSession.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AnalysisSession.countDocuments()
    ]);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Get components for a session
 */
router.get('/:sessionId/components', validate(schemas.getAnalysis), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    const components = await Component.find({ sessionId })
      .populate('modules')
      .populate('artifacts')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: components
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Get modules for a session
 */
router.get('/:sessionId/modules', validate(schemas.getAnalysis), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    const modules = await Module.find({ sessionId })
      .populate('artifacts')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: modules
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Get artifacts for a session
 */
router.get('/:sessionId/artifacts', validate(schemas.getAnalysis), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    const artifacts = await Artifact.find({ sessionId })
      .sort({ path: 1 });

    res.json({
      success: true,
      data: artifacts
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Get relations for a session
 */
router.get('/:sessionId/relations', validate(schemas.getAnalysis), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    const relations = await Relation.find({ sessionId })
      .populate('source')
      .populate('target');

    res.json({
      success: true,
      data: relations
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Delete an analysis session and all related data
 */
router.delete('/:sessionId', validate(schemas.getAnalysis), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    // Delete all related data
    await Promise.all([
      AnalysisSession.deleteOne({ sessionId }),
      Component.deleteMany({ sessionId }),
      Module.deleteMany({ sessionId }),
      Artifact.deleteMany({ sessionId }),
      Relation.deleteMany({ sessionId })
    ]);

    logger.info(`Deleted analysis session ${sessionId}`);

    res.json({
      success: true,
      message: 'Analysis session deleted successfully'
    });

  } catch (error) {
    next(error);
  }
});

export default router;