import React, { useState, useEffect, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Mail,
  Check,
  CheckCheck,
  Trash2,
  ThumbsUp,
  MessageSquare,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Settings,
  RefreshCw,
  X,
} from 'lucide-react';
import { useNotifications, Notification } from '../../context/NotificationsContext';
import { useAuth } from '../../context/AuthContext';
import { complaintsAPI } from '../../services/api';
import NotificationSettings from './NotificationSettings';

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'NEW_VOTE':
      return <ThumbsUp className="w-5 h-5 text-blue-500" />;
    case 'COMPLAINT_UPDATE':
    case 'STATUS_CHANGE':
      return <AlertCircle className="w-5 h-5 text-orange-500" />;
    case 'INSIGHT_REQUEST':
    case 'INSIGHT_REPLY':
      return <MessageSquare className="w-5 h-5 text-purple-500" />;
    case 'WEEKLY_DIGEST':
      return <Mail className="w-5 h-5 text-green-500" />;
    default:
      return <Bell className="w-5 h-5 text-gray-500" />;
  }
};

const getNotificationTypeLabel = (type: Notification['type']) => {
  switch (type) {
    case 'NEW_VOTE':
      return 'Vote';
    case 'COMPLAINT_UPDATE':
      return 'Update';
    case 'STATUS_CHANGE':
      return 'Status';
    case 'INSIGHT_REQUEST':
      return 'Request';
    case 'INSIGHT_REPLY':
      return 'Reply';
    case 'WEEKLY_DIGEST':
      return 'Digest';
    default:
      return 'Notification';
  }
};

const getNotificationTypeBgColor = (type: Notification['type']) => {
  switch (type) {
    case 'NEW_VOTE':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'COMPLAINT_UPDATE':
    case 'STATUS_CHANGE':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'INSIGHT_REQUEST':
    case 'INSIGHT_REPLY':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'WEEKLY_DIGEST':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
};

const formatTimeAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    notifications,
    unreadCount,
    loading,
    totalNotifications,
    currentPage,
    totalPages,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  } = useNotifications();

  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [fullReplyMessage, setFullReplyMessage] = useState<string>('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  // Fetch notifications on filter change
  useEffect(() => {
    fetchNotifications({
      page: 1,
      limit: 20,
      unreadOnly: filter === 'unread',
    });
  }, [filter, fetchNotifications]);

  // Fetch full reply message when notification is selected
  useEffect(() => {
    const fetchReplyMessage = async () => {
      if (selectedNotification && selectedNotification.type === 'INSIGHT_REPLY' && selectedNotification.complaintId) {
        try {
          const response = await complaintsAPI.getById(selectedNotification.complaintId);
          const complaint = response.data;
          
          // Find the insight request that matches the current user
          const userInsight = complaint.insightRequests?.find(
            (insight: any) => insight.userId === currentUser?.uid && insight.hasReply
          );
          
          if (userInsight && userInsight.reply) {
            setFullReplyMessage(userInsight.reply);
          } else {
            setFullReplyMessage(selectedNotification.message);
          }
        } catch (error) {
          console.error('Error fetching reply message:', error);
          setFullReplyMessage(selectedNotification.message);
        }
      }
    };
    
    fetchReplyMessage();
  }, [selectedNotification, currentUser]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshNotifications();
    setIsRefreshing(false);
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    
    // For insight reply, show popup with the reply message
    if (notification.type === 'INSIGHT_REPLY') {
      setSelectedNotification(notification);
      return;
    }
    
    // Navigate to complaint if complaintId exists
    if (notification.complaintId) {
      // For insight requests, navigate to profile complaint detail page (owner's view)
      if (notification.type === 'INSIGHT_REQUEST') {
        navigate(`/profile/complaint/${notification.complaintId}`);
      } else {
        navigate(`/complaint/${notification.complaintId}`);
      }
    }
  };

  const handlePageChange = (page: number) => {
    fetchNotifications({
      page,
      limit: 20,
      unreadOnly: filter === 'unread',
    });
  };

  if (!currentUser) {
    return null;
  }

  if (showSettings) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      }>
        <NotificationSettings onBack={() => setShowSettings(false)} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <div className="container mx-auto px-3 xs:px-4 md:px-6 py-4 xs:py-6 md:py-8 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 xs:gap-4 mb-4 xs:mb-6 md:mb-8">
          <div className="flex items-center gap-3 xs:gap-4">
            <div className="p-2 xs:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg xs:rounded-xl">
              <Bell className="w-6 h-6 xs:w-8 xs:h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl xs:text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
              <p className="text-xs xs:text-sm text-gray-500 dark:text-gray-400">
                {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 xs:gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg active:scale-95 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 xs:px-4 py-2.5 min-h-[44px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg active:scale-95 transition"
            >
              <Settings className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-medium">Settings</span>
            </button>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg xs:rounded-xl shadow-sm p-3 xs:p-4 mb-4 xs:mb-6">
          <div className="flex flex-col xs:flex-row items-stretch xs:items-center justify-between gap-3 xs:gap-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 xs:gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 xs:flex-initial px-3 xs:px-4 py-2 min-h-[44px] rounded-lg font-medium text-xs xs:text-sm transition ${
                  filter === 'all'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                All ({totalNotifications})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`flex-1 xs:flex-initial px-3 xs:px-4 py-2 min-h-[44px] rounded-lg font-medium text-xs xs:text-sm transition ${
                  filter === 'unread'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Bulk Actions */}
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center justify-center gap-2 px-3 xs:px-4 py-2 min-h-[44px] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg active:scale-95 transition text-xs xs:text-sm font-medium"
              >
                <CheckCheck className="w-4 h-4 flex-shrink-0" />
                <span className="hidden xs:inline">Mark all as read</span>
                <span className="xs:hidden">Read all</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg xs:rounded-xl shadow-sm overflow-hidden">
          {loading && notifications.length === 0 ? (
            <div className="p-8 xs:p-12 text-center">
              <div className="animate-spin w-8 h-8 xs:w-10 xs:h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3 xs:mb-4"></div>
              <p className="text-sm xs:text-base text-gray-500 dark:text-gray-400">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 xs:p-12 text-center">
              <Bell className="w-12 h-12 xs:w-16 xs:h-16 text-gray-300 dark:text-gray-600 mx-auto mb-3 xs:mb-4" />
              <h3 className="text-base xs:text-lg font-medium text-gray-900 dark:text-white mb-1.5 xs:mb-2">
                No notifications yet
              </h3>
              <p className="text-sm xs:text-base text-gray-500 dark:text-gray-400">
                {filter === 'unread'
                  ? "You're all caught up! No unread notifications."
                  : "When you get notifications, they'll appear here."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex items-start gap-2.5 xs:gap-4 p-3 xs:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer active:bg-gray-100 dark:active:bg-gray-700 transition ${
                    !notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 p-1.5 xs:p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${getNotificationTypeBgColor(
                          notification.type
                        )}`}
                      >
                        {getNotificationTypeLabel(notification.type)}
                      </span>
                      {!notification.isRead && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      )}
                    </div>
                    <h3 className={`text-sm xs:text-base font-medium ${!notification.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {notification.title}
                    </h3>
                    <p className="text-xs xs:text-sm text-gray-500 dark:text-gray-400 mt-0.5 xs:mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-3 xs:gap-4 mt-1.5 xs:mt-2 text-[10px] xs:text-xs text-gray-400 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        {formatTimeAgo(notification.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 xs:gap-2 flex-shrink-0">
                    {!notification.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(notification.id);
                        }}
                        className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg active:scale-95 transition"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(notification.id, e)}
                      className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg active:scale-95 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col xs:flex-row items-center justify-between gap-3 p-3 xs:p-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs xs:text-sm text-gray-500 dark:text-gray-400">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Insight Reply Modal */}
      {selectedNotification && selectedNotification.type === 'INSIGHT_REPLY' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 xs:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 xs:p-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 xs:gap-3">
                <div className="p-1.5 xs:p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <MessageSquare className="w-4 h-4 xs:w-5 xs:h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-base xs:text-lg font-semibold text-gray-900 dark:text-white">Insight Reply</h3>
              </div>
              <button
                onClick={() => setSelectedNotification(null)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg active:scale-95 transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-4 xs:p-6 overflow-y-auto max-h-[50vh]">
              <h4 className="text-sm xs:text-base font-medium text-gray-900 dark:text-white mb-2">
                {selectedNotification.title}
              </h4>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 xs:p-4">
                <p className="text-xs xs:text-sm text-gray-600 dark:text-gray-400 mb-1.5 xs:mb-2">Reply:</p>
                <p className="text-sm xs:text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {fullReplyMessage || selectedNotification.message}
                </p>
              </div>
              <p className="text-[10px] xs:text-xs text-gray-400 dark:text-gray-500 mt-2 xs:mt-3 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(selectedNotification.createdAt)}
              </p>
            </div>
            
            {/* Modal Footer */}
            <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 xs:gap-3 p-3 xs:p-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setSelectedNotification(null)}
                className="px-4 py-2.5 min-h-[44px] text-sm xs:text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg active:scale-95 transition"
              >
                Close
              </button>
              {selectedNotification.complaintId && (
                <button
                  onClick={() => {
                    navigate(`/complaint/${selectedNotification.complaintId}`);
                    setSelectedNotification(null);
                  }}
                  className="px-4 py-2.5 min-h-[44px] text-sm xs:text-base bg-blue-600 text-white hover:bg-blue-700 rounded-lg active:scale-95 transition font-medium"
                >
                  View Complaint
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
