import { Router } from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notificationController';
import { verifyToken } from '../middleware/auth';

const router = Router();

// All notification routes require authentication
router.get('/', verifyToken, getNotifications);
router.put('/:id/read', verifyToken, markAsRead);
router.put('/read-all', verifyToken, markAllAsRead);
router.delete('/:id', verifyToken, deleteNotification);

export default router;
