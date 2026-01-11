import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import complaintRoutes from './routes/complaintRoutes';
import userRoutes from './routes/userRoutes';
import notificationRoutes from './routes/notificationRoutes';
import contactRoutes from './routes/contactRoutes';
import aiRoutes from './routes/aiRoutes';
import { getServiceHealth } from './services/embeddingService';
import { getAIServiceHealth } from './services/aiService';

const app: Express = express();

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    "https://civic-pressure-frontend.vercel.app",
    process.env.FRONTEND_URL || '',
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const embeddingHealth = getServiceHealth();
  const aiHealth = getAIServiceHealth();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'civic-pressure-api',
    embedding: {
      ready: embeddingHealth.ready,
      modelName: embeddingHealth.modelName,
      dimension: embeddingHealth.embeddingDimension,
      memoryMB: embeddingHealth.memoryUsageMB,
    },
    ai: {
      available: aiHealth.available,
      model: aiHealth.model,
    },
  });
});

// API Routes
app.use('/api/complaints', complaintRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/ai', aiRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Global error handler:', err);

  // Multer file size error
  if (err.message === 'File too large') {
    return res.status(400).json({
      success: false,
      error: 'File size exceeds the 10MB limit',
    });
  }

  // Multer file type error
  if (err.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

export default app;
