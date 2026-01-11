import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { Notification, ApiResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';

const notificationsCollection = db.collection('notifications');

// Get user's notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build base query
    let baseQuery: FirebaseFirestore.Query = notificationsCollection
      .where('userId', '==', req.user.uid);

    // Get all user notifications first for counting
    const allNotificationsSnapshot = await baseQuery.get();
    
    // Filter and sort in memory to avoid complex Firestore index requirements
    let allNotifications = allNotificationsSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
    })) as Notification[];

    // Sort by createdAt descending
    allNotifications.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    // Calculate unread count
    const unreadCount = allNotifications.filter(n => !n.isRead).length;

    // Apply unread filter if requested
    if (unreadOnly === 'true') {
      allNotifications = allNotifications.filter(n => !n.isRead);
    }

    const total = allNotifications.length;

    // Apply pagination
    const notifications = allNotifications.slice(offset, offset + limitNum);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
    });
  }
};

// Mark notification as read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { id } = req.params;

    const doc = await notificationsCollection.doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    const notification = doc.data()!;

    if (notification.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this notification',
      });
    }

    await notificationsCollection.doc(id).update({
      isRead: true,
    });

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification',
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const unreadNotifications = await notificationsCollection
      .where('userId', '==', req.user.uid)
      .where('isRead', '==', false)
      .get();

    const batch = db.batch();

    unreadNotifications.forEach((doc) => {
      batch.update(doc.ref, { isRead: true });
    });

    await batch.commit();

    res.json({
      success: true,
      message: `${unreadNotifications.size} notifications marked as read`,
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notifications',
    });
  }
};

// Delete notification
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { id } = req.params;

    const doc = await notificationsCollection.doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    const notification = doc.data()!;

    if (notification.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this notification',
      });
    }

    await notificationsCollection.doc(id).delete();

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification',
    });
  }
};

// Helper function to create a notification (used internally)
export const createNotification = async (
  userId: string,
  type: Notification['type'],
  title: string,
  message: string,
  complaintId?: string
) => {
  try {
    // Check for duplicate notifications created in the last 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60000);
    const recentNotifications = await notificationsCollection
      .where('userId', '==', userId)
      .where('type', '==', type)
      .get();

    // Check if an identical notification was just created
    const isDuplicate = recentNotifications.docs.some(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
      return (
        data.title === title &&
        data.message === message &&
        data.complaintId === complaintId &&
        createdAt >= sixtySecondsAgo
      );
    });

    if (isDuplicate) {
      console.log('Duplicate notification prevented:', { userId, type, title, complaintId });
      return null;
    }

    const notification: Omit<Notification, 'id'> = {
      userId,
      type,
      title,
      message,
      complaintId,
      isRead: false,
      createdAt: new Date(),
    };

    const id = uuidv4();
    await notificationsCollection.doc(id).set(notification);

    return { id, ...notification };
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};
