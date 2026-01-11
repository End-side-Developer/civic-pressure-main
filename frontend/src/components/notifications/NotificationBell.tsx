import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  Trash2,
  ThumbsUp,
  MessageSquare,
  AlertCircle,
  Clock,
  X,
} from 'lucide-react';
import { useNotifications, Notification } from '../../context/NotificationsContext';
import { useAuth } from '../../context/AuthContext';
import { complaintsAPI } from '../../services/api';

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'NEW_VOTE':
      return <ThumbsUp className="w-4 h-4 text-blue-500" />;
    case 'COMPLAINT_UPDATE':
    case 'STATUS_CHANGE':
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    case 'INSIGHT_REQUEST':
    case 'INSIGHT_REPLY':
      return <MessageSquare className="w-4 h-4 text-purple-500" />;
    default:
      return <Bell className="w-4 h-4 text-gray-500" />;
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

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [fullReplyMessage, setFullReplyMessage] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    
    // For insight reply, show popup with the reply message
    if (notification.type === 'INSIGHT_REPLY') {
      setIsOpen(false);
      setSelectedNotification(notification);
      return;
    }
    
    setIsOpen(false);
    if (notification.complaintId) {
      // For insight requests, navigate to profile complaint detail page (owner's view)
      if (notification.type === 'INSIGHT_REQUEST') {
        navigate(`/profile/complaint/${notification.complaintId}`);
      } else {
        navigate(`/complaint/${notification.complaintId}`);
      }
    }
  };

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markAsRead(id);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNotification(id);
  };

  const recentNotifications = notifications.slice(0, 5);

  const handleBellClick = () => {
    // On mobile screens (< 640px), navigate to notifications page
    // On larger screens, toggle dropdown
    if (window.innerWidth < 640) {
      navigate('/notifications');
    } else {
      setIsOpen(!isOpen);
    }
  };

  return (
    <>
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleBellClick}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 xs:-top-1 xs:-right-1 w-4 xs:w-5 h-4 xs:h-5 bg-red-500 text-white text-[10px] xs:text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="fixed xs:absolute inset-x-2 xs:inset-x-auto xs:right-0 top-14 xs:top-auto xs:mt-2 w-auto xs:w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border-0 xs:border xs:border-gray-100 dark:xs:border-gray-700 z-[60] overflow-hidden max-h-[calc(100vh-70px)] xs:max-h-[500px]">
          {/* Header */}
          <div className="flex items-center justify-between px-3 xs:px-4 py-2.5 xs:py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-sm xs:text-base text-gray-900 dark:text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline py-1 px-2 active:scale-95"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded min-h-[36px] min-w-[36px] flex items-center justify-center active:scale-95"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 xs:max-h-96 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <div className="p-4 xs:p-6 text-center">
                <Bell className="w-8 xs:w-10 h-8 xs:h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400 text-xs xs:text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex items-start gap-2 xs:gap-3 p-2.5 xs:p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition active:bg-gray-100 dark:active:bg-gray-700 ${
                      !notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="flex-shrink-0 p-1 xs:p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs xs:text-sm font-medium truncate ${
                        !notification.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-[10px] xs:text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        {formatTimeAgo(notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 xs:gap-1 flex-shrink-0">
                      {!notification.isRead && (
                        <button
                          onClick={(e) => handleMarkAsRead(notification.id, e)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition min-h-[32px] min-w-[32px] flex items-center justify-center active:scale-95"
                          title="Mark as read"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDelete(notification.id, e)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition min-h-[32px] min-w-[32px] flex items-center justify-center active:scale-95"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 dark:border-gray-700 p-2">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 xs:py-2 text-xs xs:text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition active:scale-[0.98] min-h-[44px] xs:min-h-0"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>

      {/* Insight Reply Modal */}
      {selectedNotification && selectedNotification.type === 'INSIGHT_REPLY' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-3 xs:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 xs:p-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 xs:gap-3">
                <div className="p-1.5 xs:p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex-shrink-0">
                  <MessageSquare className="w-4 xs:w-5 h-4 xs:h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold text-sm xs:text-base text-gray-900 dark:text-white">Insight Reply</h3>
              </div>
              <button
                onClick={() => setSelectedNotification(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95"
              >
                <X className="w-4 xs:w-5 h-4 xs:h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-4 xs:p-6 overflow-y-auto max-h-[50vh]">
              <h4 className="font-medium text-sm xs:text-base text-gray-900 dark:text-white mb-2">
                {selectedNotification.title}
              </h4>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 xs:p-4">
                <p className="text-xs xs:text-sm text-gray-600 dark:text-gray-400 mb-2">Reply:</p>
                <p className="text-sm xs:text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                  {fullReplyMessage || selectedNotification.message}
                </p>
              </div>
              <p className="text-[10px] xs:text-xs text-gray-400 dark:text-gray-500 mt-3 flex items-center gap-1">
                <Clock className="w-3 h-3 flex-shrink-0" />
                {formatTimeAgo(selectedNotification.createdAt)}
              </p>
            </div>
            
            {/* Modal Footer */}
            <div className="flex flex-col xs:flex-row justify-end gap-2 xs:gap-3 p-3 xs:p-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setSelectedNotification(null)}
                className="px-4 py-2.5 xs:py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition active:scale-95 min-h-[44px] xs:min-h-0"
              >
                Close
              </button>
              {selectedNotification.complaintId && (
                <button
                  onClick={() => {
                    navigate(`/complaint/${selectedNotification.complaintId}`);
                    setSelectedNotification(null);
                  }}
                  className="px-4 py-2.5 xs:py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition active:scale-95 min-h-[44px] xs:min-h-0"
                >
                  View Complaint
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationBell;
