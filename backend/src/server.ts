import app from './app';
import dotenv from 'dotenv';
import { loadModel, isModelReady } from './services/embeddingService';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

// Initialize embedding model before starting server
const startServer = async () => {
  try {
    // Load embedding model (non-blocking warning if it fails)
    console.log('🧠 Initializing embedding service...');
    await loadModel();
    
    if (isModelReady()) {
      console.log('✅ Embedding service ready for duplicate detection');
    } else {
      console.warn('⚠️ Embedding service not ready - duplicate detection will be unavailable');
    }
  } catch (error) {
    console.warn('⚠️ Failed to load embedding model:', error);
    console.warn('⚠️ Server will start without duplicate detection capability');
  }

  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏛️  Civic Pressure API Server                           ║
║                                                           ║
║   Server running on: http://localhost:${PORT}               ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(26)}║
║                                                           ║
║   API Endpoints:                                          ║
║   • GET  /health                   - Health check         ║
║   • GET  /api/complaints           - List complaints      ║
║   • POST /api/complaints           - Create complaint     ║
║   • POST /api/complaints/check-duplicate - Check dupes    ║
║   • GET  /api/complaints/embedding-health - Model status  ║
║   • GET  /api/users/profile        - Get user profile     ║
║   • GET  /api/notifications        - Get notifications    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
};

startServer();
