import { Router } from 'express';
import {
  getAllComplaints,
  getComplaintById,
  createComplaint,
  updateComplaint,
  deleteComplaint,
  voteComplaint,
  addInsightRequest,
  replyToInsight,
  addPhotoToComplaint,
  getUserComplaints,
  getVotedComplaints,
  markAsSolved,
  reportComplaint,
  getPlatformStats,
  addComment,
  getComments,
  deleteComment,
  likeComment,
} from '../controllers/complaintController';
import {
  checkDuplicate,
  getEmbeddingHealth,
} from '../controllers/duplicateController';
import { verifyToken, optionalAuth } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// Public routes (with optional auth for personalized data)
router.get('/', optionalAuth, getAllComplaints);

// Platform stats (public)
router.get('/platform/stats', getPlatformStats);

// Embedding service health check (public)
router.get('/embedding-health', getEmbeddingHealth);

// Duplicate check (protected - requires auth)
router.post('/check-duplicate', verifyToken, checkDuplicate);

// Protected routes - User-specific (must come BEFORE /:id routes to avoid conflicts)
router.get('/user/my-complaints', verifyToken, getUserComplaints);
router.get('/user/voted-complaints', verifyToken, getVotedComplaints);

// Single complaint routes
router.get('/:id', optionalAuth, getComplaintById);
router.post('/', verifyToken, upload.array('images', 5), createComplaint);
router.put('/:id', verifyToken, upload.array('images', 5), updateComplaint);
router.delete('/:id', verifyToken, deleteComplaint);

// Voting
router.post('/:id/vote', verifyToken, voteComplaint);

// Mark as solved
router.post('/:id/mark-solved', verifyToken, markAsSolved);

// Report complaint
router.post('/:id/report', verifyToken, reportComplaint);

// Insight requests
router.post('/:id/insights', verifyToken, addInsightRequest);
router.post('/:id/insights/:insightId/reply', verifyToken, replyToInsight);

// Add photos
router.post('/:id/photos', verifyToken, upload.single('image'), addPhotoToComplaint);

// Comments
router.get('/:id/comments', optionalAuth, getComments);
router.post('/:id/comments', verifyToken, addComment);
router.delete('/:id/comments/:commentId', verifyToken, deleteComment);
router.post('/:id/comments/:commentId/like', verifyToken, likeComment);

export default router;
