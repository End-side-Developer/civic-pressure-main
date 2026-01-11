/**
 * Duplicate Detection Controller
 * 
 * Handles API endpoints for semantic duplicate detection of complaints.
 * Uses the embedding service to check for similar existing complaints.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import {
  checkForDuplicates,
  isModelReady,
  getServiceHealth,
  EMBEDDING_CONFIG,
} from '../services/embeddingService';
import { ApiResponse } from '../types';

// Zod schema for input validation
const checkDuplicateSchema = z.object({
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must be at most 200 characters'),
  category: z
    .string()
    .min(1, 'Category is required')
    .max(100, 'Category must be at most 100 characters'),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(5000, 'Description must be at most 5000 characters'),
  location: z
    .string()
    .optional(),
  coordinates: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
  threshold: z
    .number()
    .min(0.5, 'Threshold must be at least 0.5')
    .max(1.0, 'Threshold must be at most 1.0')
    .optional(),
});

/**
 * Response type for duplicate check endpoint
 */
interface DuplicateCheckResponse {
  isDuplicate: boolean;
  matches: Array<{
    id: string;
    title: string;
    similarity: number;
    category: string;
    status: string;
    distanceKm?: number;
    locationScore?: number;
    combinedScore?: number;
  }>;
  stats: {
    checked: number;
    processingTimeMs: number;
  };
}

/**
 * POST /api/complaints/check-duplicate
 * 
 * Checks if a complaint is semantically similar to existing complaints.
 * Combines semantic similarity with geographic proximity for better duplicate detection.
 * Protected by Firebase auth middleware.
 * 
 * Request body:
 * - title: string (required, 5-200 chars)
 * - category: string (required, 1-100 chars)
 * - description: string (required, 20-5000 chars)
 * - location: string (optional, location name/address)
 * - coordinates: object (optional, {latitude: number, longitude: number})
 * - threshold: number (optional, 0.5-1.0, default: 0.82)
 * 
 * Response:
 * - isDuplicate: boolean
 * - matches: array of similar complaints with semantic and location scores
 * - stats: checking statistics
 */
export const checkDuplicate = async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      } as ApiResponse);
    }

    // Check if embedding model is ready
    if (!isModelReady()) {
      return res.status(503).json({
        success: false,
        error: 'Duplicate detection service is not ready. Please try again later.',
      } as ApiResponse);
    }

    // Validate input
    const validationResult = checkDuplicateSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      // Zod v4 uses .issues instead of .errors
      const errors = validationResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        data: { errors },
      } as ApiResponse);
    }

    const { title, category, description, location, coordinates, threshold } = validationResult.data;

    // Perform duplicate check with location data
    const result = await checkForDuplicates(
      title,
      category,
      description,
      location,
      coordinates,
      threshold ?? EMBEDDING_CONFIG.defaultThreshold
    );

    // Format response (include location metrics)
    const response: ApiResponse<DuplicateCheckResponse> = {
      success: true,
      data: {
        isDuplicate: result.isDuplicate,
        matches: result.matches.map((match) => ({
          id: match.id,
          title: match.title,
          similarity: match.similarity,
          category: match.category,
          status: match.status,
          distanceKm: match.distanceKm,
          locationScore: match.locationScore,
          combinedScore: match.combinedScore,
        })),
        stats: result.stats,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to check for duplicates',
    } as ApiResponse);
  }
};

/**
 * GET /api/complaints/embedding-health
 * 
 * Health check endpoint for the embedding service.
 * Reports model status, memory usage, and configuration.
 */
export const getEmbeddingHealth = async (req: Request, res: Response) => {
  try {
    const health = getServiceHealth();

    res.json({
      success: true,
      data: {
        status: health.ready ? 'ready' : 'loading',
        modelName: health.modelName,
        embeddingDimension: health.embeddingDimension,
        memoryUsageMB: health.memoryUsageMB,
        config: {
          defaultThreshold: EMBEDDING_CONFIG.defaultThreshold,
          maxMatches: EMBEDDING_CONFIG.maxMatches,
          recentMonths: EMBEDDING_CONFIG.recentMonths,
          maxDistanceKm: EMBEDDING_CONFIG.maxDistanceKm,
          locationWeight: EMBEDDING_CONFIG.locationWeight,
          semanticWeight: EMBEDDING_CONFIG.semanticWeight,
        },
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Error getting embedding health:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get embedding service health',
    } as ApiResponse);
  }
};
