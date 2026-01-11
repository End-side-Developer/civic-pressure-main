import { db } from '../config/firebase';

/**
 * Script to delete the separate insightRequests collection from Firestore
 * Run this once to clean up the database
 * 
 * Usage: npx ts-node src/scripts/deleteInsightRequestsCollection.ts
 */

const deleteCollection = async (collectionName: string, batchSize: number = 100) => {
  const collectionRef = db.collection(collectionName);
  const query = collectionRef.limit(batchSize);

  return new Promise<void>((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });
};

const deleteQueryBatch = async (
  query: FirebaseFirestore.Query,
  resolve: () => void,
  reject: (error: any) => void
) => {
  try {
    const snapshot = await query.get();

    if (snapshot.size === 0) {
      resolve();
      return;
    }

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`Deleted ${snapshot.size} documents`);

    // Recurse on the next process tick to avoid exploding the stack
    process.nextTick(() => {
      deleteQueryBatch(query, resolve, reject);
    });
  } catch (error) {
    reject(error);
  }
};

const main = async () => {
  try {
    console.log('🗑️  Starting deletion of insightRequests collection...');
    
    // Check if collection exists
    const snapshot = await db.collection('insightRequests').limit(1).get();
    
    if (snapshot.empty) {
      console.log('✅ Collection "insightRequests" is already empty or does not exist');
      process.exit(0);
    }

    console.log('📊 Found documents in insightRequests collection');
    console.log('⚠️  This will permanently delete the insightRequests collection');
    console.log('⏳ Starting deletion in 3 seconds...');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await deleteCollection('insightRequests');
    
    console.log('✅ Successfully deleted insightRequests collection');
    console.log('ℹ️  Insight requests are now only stored within complaint documents');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting collection:', error);
    process.exit(1);
  }
};

main();
