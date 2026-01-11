import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'civic-pressure';
    // Firebase Storage bucket can be in different formats
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;

    console.log('🔧 Initializing Firebase Admin...');
    console.log('   Project ID:', projectId);
    console.log('   Storage Bucket:', storageBucket);

    // Try multiple ways to initialize Firebase Admin

    // Option 1: Service account JSON file
    const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: storageBucket,
      });
      console.log('✅ Firebase Admin initialized with service account file');
      console.log('⚠️  IMPORTANT: Make sure Firebase Storage is enabled in your Firebase Console');
      console.log('   1. Go to https://console.firebase.google.com/project/' + projectId + '/storage');
      console.log('   2. Click "Get Started" if Storage is not enabled');
      console.log('   3. Choose "Start in production mode" or set up security rules');
      return admin;
    }

    // Option 2: Environment variables
    if (process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      !process.env.FIREBASE_PRIVATE_KEY.includes('YOUR_PRIVATE_KEY')) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        storageBucket: storageBucket,
      });
      console.log('✅ Firebase Admin initialized with environment variables');
      return admin;
    }

    // Option 3: Application default credentials (for development)
    try {
      admin.initializeApp({
        projectId: projectId,
        storageBucket: storageBucket,
      });
      console.log('✅ Firebase Admin initialized with default credentials');
    } catch (error) {
      console.error('⚠️ Firebase Admin initialization failed. Please set up credentials.');
      console.error('Options:');
      console.error('  1. Place serviceAccountKey.json in the backend folder');
      console.error('  2. Set FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL in .env');
      console.error('  3. Run: gcloud auth application-default login');
      throw error;
    }
  }

  return admin;
};

// Initialize and export
const firebaseAdmin = initializeFirebase();
export const db = admin.firestore();
export const storage = admin.storage();
export const auth = admin.auth();

export default firebaseAdmin;
