/**
 * AI Controller
 * 
 * Handles AI-related requests including complaint description improvement.
 * Includes rate limiting to prevent abuse.
 */

import { Request, Response } from 'express';
import { improveDescription, isAIServiceAvailable, getAIServiceHealth } from '../services/aiService';

// Simple in-memory rate limiting (per user)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = {
  maxRequests: 10, // Maximum 10 requests
  windowMs: 60000, // Per minute
};

/**
 * Check rate limit for a user
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new rate limit window
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    });
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1, resetIn: RATE_LIMIT.windowMs };
  }

  if (userLimit.count >= RATE_LIMIT.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: userLimit.resetTime - now,
    };
  }

  userLimit.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT.maxRequests - userLimit.count,
    resetIn: userLimit.resetTime - now,
  };
}

/**
 * Improve complaint description using AI
 * POST /api/ai/improve-description
 */
export async function improveDescriptionHandler(req: Request, res: Response): Promise<void> {
  try {
    // Check if AI service is available
    if (!isAIServiceAvailable()) {
      res.status(503).json({
        success: false,
        error: 'AI service is not available. Please try again later.',
      });
      return;
    }

    // Get user ID for rate limiting
    const userId = (req as any).user?.uid || req.ip || 'anonymous';

    // Check rate limit
    const rateLimitResult = checkRateLimit(userId);
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitResult.resetIn / 1000).toString());

    if (!rateLimitResult.allowed) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait before trying again.',
        retryAfterSeconds: Math.ceil(rateLimitResult.resetIn / 1000),
      });
      return;
    }

    // Validate request body
    const { description, title, sector } = req.body;

    if (!description || typeof description !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Description is required and must be a string.',
      });
      return;
    }

    // Call AI service
    const result = await improveDescription(
      description,
      title || '',
      sector || ''
    );

    if (result.success) {
      res.json({
        success: true,
        improvedDescription: result.improvedDescription,
        processingTimeMs: result.processingTimeMs,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error('Error in improveDescriptionHandler:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    });
  }
}

/**
 * Get AI service health status
 * GET /api/ai/health
 */
export function getAIHealth(req: Request, res: Response): void {
  const health = getAIServiceHealth();
  res.json({
    status: health.available ? 'healthy' : 'unavailable',
    model: health.model,
  });
}
