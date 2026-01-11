/**
 * Migration Script: Backfill Embeddings for Existing Complaints
 * 
 * This script:
 * 1. Loads the Universal Sentence Encoder model
 * 2. Iterates through all existing complaints
 * 3. Skips complaints that already have embeddings
 * 4. Generates and stores embeddings in batches
 * 5. Logs progress and statistics
 * 
 * Usage:
 *   npx ts-node src/scripts/migrateEmbeddings.ts
 * 
 * Or with npm script:
 *   npm run migrate:embeddings
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Initialize Firebase Admin if not already initialized
const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'civic-pressure';
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;

    const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: storageBucket,
      });
      console.log('✅ Firebase Admin initialized with service account file');
    } else {
      throw new Error('Service account key file not found');
    }
  }
  return admin;
};

// Import embedding service (after Firebase init)
import {
  loadModel,
  generateComplaintEmbedding,
  isModelReady,
  EMBEDDING_CONFIG,
} from '../services/embeddingService';

// Configuration
const BATCH_SIZE = 10; // Process complaints in batches of 10
const DELAY_BETWEEN_BATCHES_MS = 100; // Small delay to prevent overwhelming the system

interface MigrationStats {
  total: number;
  processed: number;
  skipped: number;
  failed: number;
  startTime: number;
}

/**
 * Sleeps for the specified number of milliseconds
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Formats duration in milliseconds to human-readable string
 */
const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
};

/**
 * Logs progress with statistics
 */
const logProgress = (stats: MigrationStats): void => {
  const elapsed = Date.now() - stats.startTime;
  const completed = stats.processed + stats.skipped + stats.failed;
  const remaining = stats.total - completed;
  const rate = completed > 0 ? (elapsed / completed) : 0;
  const eta = remaining > 0 ? formatDuration(rate * remaining) : '0s';
  
  console.log(`
📊 Progress: ${completed}/${stats.total} (${Math.round((completed / stats.total) * 100)}%)
   ├─ Processed: ${stats.processed}
   ├─ Skipped (already has embedding): ${stats.skipped}
   ├─ Failed: ${stats.failed}
   ├─ Elapsed: ${formatDuration(elapsed)}
   └─ ETA: ${eta}
`);
};

/**
 * Processes a batch of complaints
 */
const processBatch = async (
  db: admin.firestore.Firestore,
  complaints: admin.firestore.QueryDocumentSnapshot[],
  stats: MigrationStats
): Promise<void> => {
  const batch = db.batch();
  const updates: Array<{
    ref: admin.firestore.DocumentReference;
    embedding: number[];
  }> = [];

  for (const doc of complaints) {
    const data = doc.data();
    const complaintId = doc.id;

    // Skip if already has embedding with current version
    if (data.embedding && data.embeddingVersion === EMBEDDING_CONFIG.version) {
      stats.skipped++;
      continue;
    }

    // Skip deleted complaints
    if (data.isDeleted) {
      stats.skipped++;
      continue;
    }

    try {
      // Generate embedding
      const embedding = await generateComplaintEmbedding(
        data.title || '',
        data.category || '',
        data.description || ''
      );

      updates.push({
        ref: doc.ref,
        embedding,
      });

      stats.processed++;
    } catch (error) {
      console.error(`❌ Failed to generate embedding for ${complaintId}:`, error);
      stats.failed++;
    }
  }

  // Commit batch update
  if (updates.length > 0) {
    for (const update of updates) {
      batch.update(update.ref, {
        embedding: update.embedding,
        embeddingVersion: EMBEDDING_CONFIG.version,
      });
    }

    try {
      await batch.commit();
      console.log(`✅ Batch committed: ${updates.length} embeddings stored`);
    } catch (error) {
      console.error('❌ Batch commit failed:', error);
      stats.failed += updates.length;
      stats.processed -= updates.length;
    }
  }
};

/**
 * Main migration function
 */
const migrateEmbeddings = async (): Promise<void> => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🔄 Embedding Migration Script                            ║
║                                                            ║
║   This script will generate embeddings for all existing    ║
║   complaints that don't have them yet.                     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

  try {
    // Initialize Firebase
    initializeFirebase();
    const db = admin.firestore();

    // Load embedding model
    console.log('📦 Loading embedding model...');
    await loadModel();

    if (!isModelReady()) {
      throw new Error('Failed to load embedding model');
    }
    console.log('✅ Embedding model ready\n');

    // Get all complaints
    console.log('📋 Fetching complaints from Firestore...');
    const complaintsSnapshot = await db.collection('complaints').get();
    
    const allComplaints = complaintsSnapshot.docs;
    console.log(`📋 Found ${allComplaints.length} complaints\n`);

    if (allComplaints.length === 0) {
      console.log('ℹ️ No complaints to process. Exiting.');
      return;
    }

    // Initialize stats
    const stats: MigrationStats = {
      total: allComplaints.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      startTime: Date.now(),
    };

    // Process in batches
    console.log(`🚀 Starting migration (batch size: ${BATCH_SIZE})\n`);

    for (let i = 0; i < allComplaints.length; i += BATCH_SIZE) {
      const batch = allComplaints.slice(i, i + BATCH_SIZE);
      
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allComplaints.length / BATCH_SIZE)}`);
      
      await processBatch(db, batch, stats);
      
      // Log progress every 5 batches
      if ((i / BATCH_SIZE + 1) % 5 === 0 || i + BATCH_SIZE >= allComplaints.length) {
        logProgress(stats);
      }

      // Small delay between batches to prevent overwhelming the system
      if (i + BATCH_SIZE < allComplaints.length) {
        await sleep(DELAY_BETWEEN_BATCHES_MS);
      }
    }

    // Final summary
    const totalTime = Date.now() - stats.startTime;
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ✅ Migration Complete!                                   ║
║                                                            ║
║   Summary:                                                 ║
║   • Total complaints: ${stats.total.toString().padEnd(34)}║
║   • Successfully processed: ${stats.processed.toString().padEnd(27)}║
║   • Skipped (already had embedding): ${stats.skipped.toString().padEnd(18)}║
║   • Failed: ${stats.failed.toString().padEnd(43)}║
║   • Total time: ${formatDuration(totalTime).padEnd(38)}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

    // Exit with appropriate code
    process.exit(stats.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migrateEmbeddings();
