import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { notificationsAPI, usersAPI } from '../services/api';
import { useAuth } from './AuthContext';

// Types
export interface Notification {
  id: string;
  userId: string;
  type: 'COMPLAINT_UPDATE' | 'NEW_VOTE' | 'INSIGHT_REQUEST' | 'INSIGHT_REPLY' | 'STATUS_CHANGE' | 'WEEKLY_DIGEST';
  title: string;
  message: string;
  complaintId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationSettings {
  complaintUpdates: boolean;
  voteNotifications: boolean;
  weeklyDigest: boolean;
}

export interface NotificationFilters {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  settings: NotificationSettings;
  loading: boolean;
  error: string | null;
  totalNotifications: number;
  currentPage: number;
  totalPages: number;
  fetchNotifications: (filters?: NotificationFilters) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const defaultSettings: NotificationSettings = {
  complaintUpdates: true,
  voteNotifications: true,
  weeklyDigest: false,
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch notifications
  const fetchNotifications = useCallback(async (filters: NotificationFilters = {}) => {
    if (!currentUser) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await notificationsAPI.getAll(filters);
      const data = response.data || response;
      
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setTotalNotifications(data.pagination?.totalItems || 0);
      setCurrentPage(data.pagination?.currentPage || 1);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Mark single notification as read
  const markAsRead = async (id: string) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('Error marking notification as read:', err);
      throw err;
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Error marking all notifications as read:', err);
      throw err;
    }
  };

  // Delete notification
  const deleteNotification = async (id: string) => {
    try {
      await notificationsAPI.delete(id);
      const notification = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setTotalNotifications(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('Error deleting notification:', err);
      throw err;
    }
  };

  // Fetch notification settings
  const fetchSettings = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const response = await usersAPI.getNotificationSettings();
      if (response.data) {
        setSettings(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching notification settings:', err);
    }
  }, [currentUser]);

  // Update notification settings
  const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      await usersAPI.updateNotificationSettings(updatedSettings);
      setSettings(updatedSettings);
    } catch (err: any) {
      console.error('Error updating notification settings:', err);
      throw err;
    }
  };

  // Refresh notifications
  const refreshNotifications = async () => {
    await fetchNotifications({ page: 1, limit: 20 });
  };

  // Initial fetch when user logs in
  useEffect(() => {
    if (currentUser) {
      fetchNotifications({ page: 1, limit: 20 });
      fetchSettings();
    } else {
      // Reset state when user logs out
      setNotifications([]);
      setUnreadCount(0);
      setSettings(defaultSettings);
    }
  }, [currentUser, fetchNotifications, fetchSettings]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!currentUser) return;

    const pollInterval = setInterval(() => {
      fetchNotifications({ page: 1, limit: 20 });
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [currentUser, fetchNotifications]);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        settings,
        loading,
        error,
        totalNotifications,
        currentPage,
        totalPages,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        fetchSettings,
        updateSettings,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};
