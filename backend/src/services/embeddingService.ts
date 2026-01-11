/**
 * Embedding Service for Semantic Duplicate Detection
 * 
 * Uses TensorFlow.js with Universal Sentence Encoder to generate
 * 512-dimensional embeddings for complaint text.
 * 
 * This service:
 * - Loads the USE model once and keeps it in memory
 * - Provides text normalization utilities
 * - Generates embeddings for complaint text
 * - Computes cosine similarity between embeddings
 * - Finds similar complaints in Firestore
 */

import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import { db } from '../config/firebase';

// Service state
let model: use.UniversalSentenceEncoder | null = null;
let isModelLoading = false;
let modelLoadPromise: Promise<void> | null = null;

// Configuration
export const EMBEDDING_CONFIG = {
  dimensions: 512,
  version: 1,
  modelName: 'universal-sentence-encoder',
  defaultThreshold: 0.82,
  maxMatches: 5,
  maxDocsToQuery: 1000,
  recentMonths: 12, // Filter complaints from last 12 months
  // Geographic distance settings
  maxDistanceKm: 0.25, // Maximum distance in km for high location scores (250 meters)
  hardDistanceCutoffKm: 0.5, // Hard cutoff: complaints beyond 500m are NEVER duplicates
  locationWeight: 0.3, // Weight given to location proximity (0-1)
  semanticWeight: 0.7, // Weight given to semantic similarity (0-1)
};

/**
 * Service health status
 */
export interface EmbeddingServiceHealth {
  ready: boolean;
  modelName: string;
  embeddingDimension: number;
  memoryUsageMB: number;
}

/**
 * Similar complaint match result
 */
export interface SimilarMatch {
  id: string;
  title: string;
  similarity: number;
  category: string;
  status: string;
  createdAt: Date;
  distanceKm?: number; // Geographic distance in kilometers
  locationScore?: number; // Location proximity score (0-1)
  combinedScore?: number; // Combined semantic + location score
}

/**
 * Duplicate check result
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matches: SimilarMatch[];
  stats: {
    checked: number;
    processingTimeMs: number;
  };
}

/**
 * Normalizes text for consistent embedding generation.
 * - Converts to lowercase
 * - Trims whitespace
 * - Collapses multiple spaces/newlines into single space
 * - Removes special characters that don't add semantic meaning
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .trim()
    .replace(/[\r\n\t]+/g, ' ')     // Replace newlines/tabs with space
    .replace(/\s+/g, ' ')            // Collapse multiple spaces
    .replace(/[^\w\s.,!?'-]/g, ' ')  // Remove special chars except basic punctuation
    .replace(/\s+/g, ' ')            // Collapse spaces again after removal
    .trim();
}

/**
 * Extracts key terms from location string for better matching.
 * Removes common location words that don't add semantic value.
 */
function extractLocationTerms(location: string): string {
  const stopWords = ['street', 'st', 'road', 'rd', 'avenue', 'ave', 'lane', 'ln', 'drive', 'dr', 
                     'building', 'bldg', 'floor', 'flat', 'apartment', 'apt', 'unit', 'block',
                     'near', 'behind', 'opposite', 'next', 'beside', 'area', 'sector', 'phase',
                     'no', 'number', 'plot', 'house'];
  
  const normalized = normalizeText(location);
  const words = normalized.split(' ').filter(word => 
    word.length > 2 && !stopWords.includes(word) && !/^\d+$/.test(word)
  );
  
  return words.join(' ');
}

/**
 * Creates the combined text format for embedding.
 * 
 * IMPORTANT: The text structure is optimized for the Universal Sentence Encoder:
 * - Title is repeated for emphasis (most important for matching)
 * - Category is included to help distinguish sectors
 * - Description provides context
 * - Location terms help with semantic location matching
 * 
 * Format:
 *   [TITLE] <title>
 *   [CATEGORY] <category>
 *   [ISSUE] <title> - <description summary>
 *   [LOCATION] <location terms>
 */
export function createEmbeddingText(
  title: string,
  category: string,
  description: string,
  location?: string
): string {
  const normalizedTitle = normalizeText(title);
  const normalizedCategory = normalizeText(category);
  const normalizedDescription = normalizeText(description);
  
  // Truncate description to first 500 chars for embedding (avoid noise from long descriptions)
  const descriptionSummary = normalizedDescription.length > 500 
    ? normalizedDescription.substring(0, 500) 
    : normalizedDescription;
  
  // Build the embedding text with weighted sections
  const parts: string[] = [];
  
  // Title section - most important, add twice for emphasis
  parts.push(`[TITLE] ${normalizedTitle}`);
  
  // Category section - helps distinguish sectors
  parts.push(`[CATEGORY] ${normalizedCategory}`);
  
  // Combined issue statement - title + description for context
  parts.push(`[ISSUE] ${normalizedTitle}. ${descriptionSummary}`);
  
  // Location section - if provided
  if (location) {
    const locationTerms = extractLocationTerms(location);
    if (locationTerms) {
      parts.push(`[LOCATION] ${locationTerms}`);
    }
  }
  
  return parts.join('\n');
}

/**
 * Loads the Universal Sentence Encoder model.
 * This should be called once on server startup.
 * Subsequent calls will return immediately if model is already loaded.
 */
export async function loadModel(): Promise<void> {
  // Return immediately if model is already loaded
  if (model) {
    return;
  }
  
  // If model is currently loading, wait for it
  if (isModelLoading && modelLoadPromise) {
    return modelLoadPromise;
  }
  
  isModelLoading = true;
  
  modelLoadPromise = (async () => {
    try {
      console.log('🧠 Loading Universal Sentence Encoder model...');
      const startTime = Date.now();
      
      // Set TensorFlow.js backend
      await tf.ready();
      console.log(`   TensorFlow.js backend: ${tf.getBackend()}`);
      
      // Load the Universal Sentence Encoder
      model = await use.load();
      
      const loadTime = Date.now() - startTime;
      console.log(`✅ USE model loaded successfully in ${loadTime}ms`);
      
      // Warm up the model with a test embedding
      await warmupModel();
      
    } catch (error) {
      console.error('❌ Failed to load USE model:', error);
      model = null;
      throw error;
    } finally {
      isModelLoading = false;
    }
  })();
  
  return modelLoadPromise;
}

/**
 * Warms up the model by generating a test embedding.
 * This helps ensure faster response times for the first real request.
 */
async function warmupModel(): Promise<void> {
  if (!model) return;
  
  try {
    console.log('🔥 Warming up embedding model...');
    const startTime = Date.now();
    
    const testText = createEmbeddingText(
      'Road pothole causing accidents',
      'Infrastructure',
      'There is a large pothole on the main road that is causing accidents and vehicle damage.',
      'Main Street, Downtown'
    );
    const embeddings = await model.embed([testText]);
    
    // Verify embedding dimensions
    const shape = embeddings.shape;
    if (shape[1] !== EMBEDDING_CONFIG.dimensions) {
      console.warn(`⚠️ Unexpected embedding dimension: ${shape[1]} (expected ${EMBEDDING_CONFIG.dimensions})`);
    }
    
    // Clean up test tensor
    embeddings.dispose();
    
    const warmupTime = Date.now() - startTime;
    console.log(`✅ Model warm-up complete in ${warmupTime}ms`);
  } catch (error) {
    console.error('⚠️ Model warm-up failed:', error);
  }
}

/**
 * Checks if the embedding model is ready for use.
 */
export function isModelReady(): boolean {
  return model !== null;
}

/**
 * Gets the health status of the embedding service.
 */
export function getServiceHealth(): EmbeddingServiceHealth {
  const memoryInfo = tf.memory();
  
  return {
    ready: isModelReady(),
    modelName: EMBEDDING_CONFIG.modelName,
    embeddingDimension: EMBEDDING_CONFIG.dimensions,
    memoryUsageMB: Math.round((memoryInfo.numBytes || 0) / (1024 * 1024) * 100) / 100,
  };
}

/**
 * Generates an embedding for the given text.
 * Returns a 512-dimensional float array.
 * 
 * @throws Error if model is not loaded
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!model) {
    throw new Error('Embedding model not loaded. Call loadModel() first.');
  }
  
  try {
    const embeddings = await model.embed([text]);
    const embeddingArray = await embeddings.array();
    
    // Clean up tensor to prevent memory leaks
    embeddings.dispose();
    
    return embeddingArray[0];
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Generates an embedding for a complaint from its components.
 * Includes location in the embedding for better semantic matching.
 */
export async function generateComplaintEmbedding(
  title: string,
  category: string,
  description: string,
  location?: string
): Promise<number[]> {
  const text = createEmbeddingText(title, category, description, location);
  return generateEmbedding(text);
}

/**
 * Calculates the geographic distance between two coordinates using the Haversine formula.
 * Returns distance in kilometers.
 * 
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // If coordinates are invalid (0,0 or missing), return infinity
  if (
    (lat1 === 0 && lon1 === 0) ||
    (lat2 === 0 && lon2 === 0) ||
    !isFinite(lat1) || !isFinite(lon1) || !isFinite(lat2) || !isFinite(lon2)
  ) {
    return Infinity;
  }
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Converts degrees to radians.
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculates a location proximity score based on distance.
 * Returns a value between 0 and 1, where 1 means same location.
 * Uses exponential decay based on maxDistanceKm.
 * 
 * @param distanceKm - Distance in kilometers
 * @returns Proximity score (0-1)
 */
export function calculateLocationScore(distanceKm: number): number {
  if (!isFinite(distanceKm) || distanceKm < 0) {
    return 0;
  }
  
  if (distanceKm === 0) {
    return 1;
  }
  
  // Exponential decay: score = e^(-distance/maxDistance)
  // At maxDistance, score ≈ 0.37
  // At 2*maxDistance, score ≈ 0.14
  const score = Math.exp(-distanceKm / EMBEDDING_CONFIG.maxDistanceKm);
  return Math.round(score * 10000) / 10000; // Round to 4 decimal places
}

/**
 * Combines semantic similarity and location proximity into a single score.
 * 
 * @param semanticSimilarity - Cosine similarity score (0-1)
 * @param locationScore - Location proximity score (0-1)
 * @returns Combined score (0-1)
 */
export function calculateCombinedScore(
  semanticSimilarity: number,
  locationScore: number
): number {
  const combined =
    EMBEDDING_CONFIG.semanticWeight * semanticSimilarity +
    EMBEDDING_CONFIG.locationWeight * locationScore;
  
  return Math.round(combined * 10000) / 10000; // Round to 4 decimal places
}

/**
 * Computes cosine similarity between two embeddings.
 * Returns a value between -1 and 1, where 1 means identical.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (magnitude === 0) {
    return 0;
  }
  
  return dotProduct / magnitude;
}

/**
 * Finds similar complaints in Firestore based on semantic similarity and geographic proximity.
 * 
 * Algorithm:
 * 1. Query complaints in the same category
 * 2. If coordinates provided, apply 500m hard cutoff (complaints beyond this are NEVER duplicates)
 * 3. Calculate semantic similarity using cosine similarity on embeddings
 * 4. Calculate location score based on distance
 * 5. Combine scores using weighted average
 * 6. Return matches above threshold, sorted by combined score
 * 
 * @param embedding - The embedding of the new complaint to check
 * @param category - The category to filter by (for performance)
 * @param coordinates - Geographic coordinates {latitude, longitude} for location-based matching
 * @param threshold - Minimum similarity score (default: 0.82)
 * @param maxResults - Maximum number of matches to return (default: 5)
 * @returns Array of similar complaints sorted by combined score (highest first)
 */
export async function findSimilarComplaints(
  embedding: number[],
  category: string,
  coordinates?: { latitude: number; longitude: number },
  threshold: number = EMBEDDING_CONFIG.defaultThreshold,
  maxResults: number = EMBEDDING_CONFIG.maxMatches
): Promise<{ matches: SimilarMatch[]; checked: number }> {
  const complaintsCollection = db.collection('complaints');
  
  // Log coordinates for debugging
  console.log('\n🔍 Starting duplicate detection...');
  console.log(`   Category: ${category}`);
  console.log(`   Threshold: ${threshold}`);
  if (coordinates) {
    console.log(`   Coordinates: (${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)})`);
    console.log(`   Hard distance cutoff: ${EMBEDDING_CONFIG.hardDistanceCutoffKm * 1000}m`);
  } else {
    console.log(`   ⚠️ No coordinates provided - using semantic matching only`);
  }
  
  // Calculate the date cutoff for recent complaints
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - EMBEDDING_CONFIG.recentMonths);
  
  try {
    // Query complaints in same category
    let query = complaintsCollection
      .where('category', '==', category)
      .limit(EMBEDDING_CONFIG.maxDocsToQuery);
    
    const snapshot = await query.get();
    console.log(`   Found ${snapshot.size} complaints in category "${category}"`);
    
    const matches: SimilarMatch[] = [];
    let checked = 0;
    let skippedNoEmbedding = 0;
    let skippedDistance = 0;
    let skippedThreshold = 0;
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      
      // Skip deleted complaints
      if (data.isDeleted) return;
      
      // Skip complaints without embeddings or wrong version
      if (!data.embedding || !Array.isArray(data.embedding)) {
        skippedNoEmbedding++;
        return;
      }
      if (data.embeddingVersion !== EMBEDDING_CONFIG.version) {
        skippedNoEmbedding++;
        return;
      }
      
      // Filter by date in memory
      const createdAt = data.createdAt?.toDate();
      if (createdAt && createdAt < cutoffDate) return;
      
      checked++;
      
      // HARD DISTANCE FILTER: Apply cutoff first
      // If locations are more than the threshold apart, skip entirely
      let distanceKm: number | undefined;
      
      if (coordinates && data.coordinates) {
        distanceKm = calculateDistance(
          coordinates.latitude,
          coordinates.longitude,
          data.coordinates.latitude,
          data.coordinates.longitude
        );
        
        // Skip if beyond hard cutoff - these are NOT duplicates regardless of text similarity
        if (isFinite(distanceKm) && distanceKm > EMBEDDING_CONFIG.hardDistanceCutoffKm) {
          skippedDistance++;
          return;
        }
      }
      
      // Compute semantic similarity
      const similarity = cosineSimilarity(embedding, data.embedding);
      
      // Calculate location score if distance was calculated
      let locationScore: number | undefined;
      let combinedScore = similarity;
      
      if (distanceKm !== undefined && isFinite(distanceKm)) {
        locationScore = calculateLocationScore(distanceKm);
        combinedScore = calculateCombinedScore(similarity, locationScore);
        distanceKm = Math.round(distanceKm * 1000) / 1000; // Round to 3 decimal places
      }
      
      // Check if above threshold
      if (combinedScore >= threshold) {
        matches.push({
          id: doc.id,
          title: data.title,
          similarity: Math.round(similarity * 10000) / 10000,
          category: data.category,
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date(),
          distanceKm,
          locationScore: locationScore !== undefined ? Math.round(locationScore * 10000) / 10000 : undefined,
          combinedScore: Math.round(combinedScore * 10000) / 10000,
        });
      } else {
        skippedThreshold++;
      }
    });
    
    // Log summary
    console.log(`\n   📊 Processing summary:`);
    console.log(`      Checked: ${checked}`);
    console.log(`      Skipped (no embedding): ${skippedNoEmbedding}`);
    console.log(`      Skipped (distance > ${EMBEDDING_CONFIG.hardDistanceCutoffKm * 1000}m): ${skippedDistance}`);
    console.log(`      Skipped (below threshold): ${skippedThreshold}`);
    console.log(`      Matches found: ${matches.length}`);
    
    // Sort by combined score (highest first) and limit results
    matches.sort((a, b) => (b.combinedScore || b.similarity) - (a.combinedScore || a.similarity));
    
    // Log matches
    if (matches.length > 0) {
      console.log(`\n   🎯 Top matches:`);
      matches.slice(0, maxResults).forEach((match, i) => {
        console.log(`      ${i + 1}. "${match.title.substring(0, 40)}..."`);
        console.log(`         Semantic: ${(match.similarity * 100).toFixed(1)}%, ` +
                    `Location: ${match.locationScore !== undefined ? (match.locationScore * 100).toFixed(1) + '%' : 'N/A'}, ` +
                    `Combined: ${(match.combinedScore! * 100).toFixed(1)}%` +
                    (match.distanceKm !== undefined ? `, Distance: ${(match.distanceKm * 1000).toFixed(0)}m` : ''));
      });
    }
    
    return {
      matches: matches.slice(0, maxResults),
      checked,
    };
  } catch (error) {
    console.error('Error finding similar complaints:', error);
    throw new Error('Failed to search for similar complaints');
  }
}

/**
 * Checks if a new complaint is a duplicate of existing complaints.
 * This is the main function to call for duplicate detection.
 * Combines semantic similarity with geographic proximity for better matching.
 * 
 * @param title - Complaint title
 * @param category - Complaint category
 * @param description - Complaint description
 * @param location - Location name/address (optional)
 * @param coordinates - Geographic coordinates (optional but recommended)
 * @param threshold - Similarity threshold (default: 0.82)
 * @returns DuplicateCheckResult with matches and stats
 */
export async function checkForDuplicates(
  title: string,
  category: string,
  description: string,
  location?: string,
  coordinates?: { latitude: number; longitude: number },
  threshold: number = EMBEDDING_CONFIG.defaultThreshold
): Promise<DuplicateCheckResult> {
  const startTime = Date.now();
  
  // Generate embedding for the new complaint (includes location in text)
  const embedding = await generateComplaintEmbedding(title, category, description, location);
  
  // Find similar complaints (uses coordinates for geographic filtering)
  const { matches, checked } = await findSimilarComplaints(embedding, category, coordinates, threshold);
  
  const processingTimeMs = Date.now() - startTime;
  
  return {
    isDuplicate: matches.length > 0,
    matches,
    stats: {
      checked,
      processingTimeMs,
    },
  };
}

/**
 * Stores the embedding for a complaint in Firestore.
 * Called after complaint creation to enable future duplicate detection.
 * Includes location in the embedding for better semantic matching.
 */
export async function storeComplaintEmbedding(
  complaintId: string,
  title: string,
  category: string,
  description: string,
  location?: string
): Promise<void> {
  try {
    const embedding = await generateComplaintEmbedding(title, category, description, location);
    
    await db.collection('complaints').doc(complaintId).update({
      embedding,
      embeddingVersion: EMBEDDING_CONFIG.version,
    });
    
    console.log(`✅ Stored embedding for complaint ${complaintId}`);
  } catch (error) {
    console.error(`❌ Failed to store embedding for complaint ${complaintId}:`, error);
    // Don't throw - embedding failure shouldn't break complaint creation
  }
}

// Export configuration for external use
export { tf };

/**
 * Test utility function to compare two complaints and see their similarity score.
 * Useful for debugging and testing the embedding system.
 * 
 * @param complaint1 - First complaint data
 * @param complaint2 - Second complaint data
 * @returns Similarity analysis with detailed breakdown
 */
export async function testSimilarity(
  complaint1: { title: string; category: string; description: string; location?: string; coordinates?: { latitude: number; longitude: number } },
  complaint2: { title: string; category: string; description: string; location?: string; coordinates?: { latitude: number; longitude: number } }
): Promise<{
  semanticSimilarity: number;
  distanceKm: number | null;
  locationScore: number | null;
  combinedScore: number;
  embedding1Text: string;
  embedding2Text: string;
  wouldBeDuplicate: boolean;
  breakdown: {
    titleMatch: string;
    categoryMatch: boolean;
    descriptionOverlap: string;
    locationWithinRange: boolean | null;
  };
}> {
  // Create embedding texts
  const text1 = createEmbeddingText(complaint1.title, complaint1.category, complaint1.description, complaint1.location);
  const text2 = createEmbeddingText(complaint2.title, complaint2.category, complaint2.description, complaint2.location);
  
  // Generate embeddings
  const embedding1 = await generateEmbedding(text1);
  const embedding2 = await generateEmbedding(text2);
  
  // Calculate semantic similarity
  const semanticSimilarity = cosineSimilarity(embedding1, embedding2);
  
  // Calculate distance if coordinates provided
  let distanceKm: number | null = null;
  let locationScore: number | null = null;
  let locationWithinRange: boolean | null = null;
  
  if (complaint1.coordinates && complaint2.coordinates) {
    distanceKm = calculateDistance(
      complaint1.coordinates.latitude,
      complaint1.coordinates.longitude,
      complaint2.coordinates.latitude,
      complaint2.coordinates.longitude
    );
    
    if (isFinite(distanceKm)) {
      locationScore = calculateLocationScore(distanceKm);
      locationWithinRange = distanceKm <= EMBEDDING_CONFIG.hardDistanceCutoffKm;
    }
  }
  
  // Calculate combined score
  const combinedScore = locationScore !== null 
    ? calculateCombinedScore(semanticSimilarity, locationScore)
    : semanticSimilarity;
  
  // Determine if it would be flagged as duplicate
  const wouldBeDuplicate = combinedScore >= EMBEDDING_CONFIG.defaultThreshold && 
    (locationWithinRange === null || locationWithinRange === true);
  
  // Analyze breakdown
  const titleWords1 = new Set(normalizeText(complaint1.title).split(' '));
  const titleWords2 = new Set(normalizeText(complaint2.title).split(' '));
  const titleOverlap = [...titleWords1].filter(w => titleWords2.has(w)).length;
  const titleMatchPercent = Math.round((titleOverlap / Math.max(titleWords1.size, titleWords2.size)) * 100);
  
  const descWords1 = new Set(normalizeText(complaint1.description).split(' '));
  const descWords2 = new Set(normalizeText(complaint2.description).split(' '));
  const descOverlap = [...descWords1].filter(w => descWords2.has(w)).length;
  const descMatchPercent = Math.round((descOverlap / Math.max(descWords1.size, descWords2.size)) * 100);
  
  return {
    semanticSimilarity: Math.round(semanticSimilarity * 10000) / 10000,
    distanceKm: distanceKm !== null ? Math.round(distanceKm * 1000) / 1000 : null,
    locationScore: locationScore !== null ? Math.round(locationScore * 10000) / 10000 : null,
    combinedScore: Math.round(combinedScore * 10000) / 10000,
    embedding1Text: text1,
    embedding2Text: text2,
    wouldBeDuplicate,
    breakdown: {
      titleMatch: `${titleMatchPercent}% word overlap`,
      categoryMatch: normalizeText(complaint1.category) === normalizeText(complaint2.category),
      descriptionOverlap: `${descMatchPercent}% word overlap`,
      locationWithinRange,
    },
  };
}
