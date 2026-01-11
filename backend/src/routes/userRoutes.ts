import { Router } from 'express';
import {
  createOrUpdateProfile,
  getProfile,
  getUserStats,
  getPublicProfile,
  deleteAccount,
  uploadProfilePhoto,
  getNotificationSettings,
  updateNotificationSettings,
  changePassword,
} from '../controllers/userController';
import { verifyToken } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// Protected routes (require authentication)
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, createOrUpdateProfile);
router.post('/profile/photo', verifyToken, upload.single('photo'), uploadProfilePhoto);
router.get('/stats', verifyToken, getUserStats);
router.delete('/account', verifyToken, deleteAccount);

// Notification settings
router.get('/notifications/settings', verifyToken, getNotificationSettings);
router.put('/notifications/settings', verifyToken, updateNotificationSettings);

// Password change
router.post('/change-password', verifyToken, changePassword);

// Public routes
router.get('/:userId/public', getPublicProfile);

export default router;
