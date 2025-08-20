import { Router } from 'express';
import { Response } from 'express';

const router = Router();

router.get('/', async (req, res: Response) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      environment: process.env.NODE_ENV
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Health check failed',
        details: error.message
      }
    });
  }
});

export default router;