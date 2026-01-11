/**
 * AI Routes
 * 
 * Routes for AI-powered features including description improvement.
 */

import { Router } from 'express';
import { improveDescriptionHandler, getAIHealth } from '../controllers/aiController';
import { verifyToken } from '../middleware/auth';

const router = Router();

// Health check endpoint (public)
router.get('/health', getAIHealth);

// Improve description endpoint (requires authentication)
router.post('/improve-description', verifyToken, improveDescriptionHandler);

export default router;
