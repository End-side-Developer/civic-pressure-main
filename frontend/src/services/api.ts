import { auth } from '../config/firebase';

// Remove trailing slash from base URL if present
const rawApiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const API_BASE_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

// Get the current user's ID token for authentication
const getAuthToken = async (): Promise<string | null> => {
  const user = auth?.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

// Base fetch function with authentication
const apiFetch = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = await getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
};

// File upload fetch (multipart/form-data)
const apiUpload = async <T>(
  endpoint: string,
  formData: FormData
): Promise<T> => {
  const token = await getAuthToken();

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error('Server returned invalid response');
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || `Upload failed with status ${response.status}`);
  }

  return data;
};

// ============== COMPLAINTS API ==============

export interface ComplaintFilters {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface CreateComplaintData {
  title: string;
  description: string;
  category: string;
  location: string;
  coordinates: { latitude: number; longitude: number };
  isAnonymous: boolean;
  images?: File[];
}

export const complaintsAPI = {
  // Get all complaints with filters
  getAll: async (filters: ComplaintFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
    return apiFetch<any>(`/complaints?${params.toString()}`);
  },

  // Get single complaint by ID
  getById: async (id: string) => {
    return apiFetch<any>(`/complaints/${id}`);
  },

  // Create new complaint with images
  create: async (data: CreateComplaintData) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('category', data.category);
    formData.append('location', data.location);
    formData.append('coordinates', JSON.stringify(data.coordinates));
    formData.append('isAnonymous', String(data.isAnonymous));

    if (data.images) {
      data.images.forEach((image) => {
        formData.append('images', image);
      });
    }

    return apiUpload<any>('/complaints', formData);
  },

  // Update complaint (without new files)
  update: async (id: string, data: Partial<CreateComplaintData>) => {
    return apiFetch<any>(`/complaints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Update complaint with new files
  updateWithFiles: async (id: string, data: Partial<CreateComplaintData> & { newImages?: File[], existingImages?: string[] }) => {
    const formData = new FormData();
    
    if (data.title) formData.append('title', data.title);
    if (data.description) formData.append('description', data.description);
    if (data.category) formData.append('category', data.category);
    if (data.location) formData.append('location', data.location);
    if (data.coordinates) formData.append('coordinates', JSON.stringify(data.coordinates));
    if (data.existingImages) formData.append('existingImages', JSON.stringify(data.existingImages));

    if (data.newImages) {
      data.newImages.forEach((image) => {
        formData.append('images', image);
      });
    }

    const token = await (async () => {
      const { auth } = await import('../config/firebase');
      const user = auth?.currentUser;
      if (!user) return null;
      try {
        return await user.getIdToken();
      } catch (error) {
        console.error('Error getting auth token:', error);
        return null;
      }
    })();

    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/complaints/${id}`, {
      method: 'PUT',
      headers,
      body: formData,
    });

    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(responseData.error || 'Failed to update complaint');
    }
    return responseData;
  },

  // Delete complaint
  delete: async (id: string) => {
    return apiFetch<any>(`/complaints/${id}`, {
      method: 'DELETE',
    });
  },

  // Vote for a complaint
  vote: async (id: string) => {
    return apiFetch<any>(`/complaints/${id}/vote`, {
      method: 'POST',
    });
  },

  // Check for duplicate complaints (semantic similarity)
  checkDuplicate: async (data: { 
    title: string; 
    category: string; 
    description: string; 
    location?: string;
    coordinates?: { latitude: number; longitude: number };
    threshold?: number;
  }) => {
    return apiFetch<{
      success: boolean;
      data: {
        isDuplicate: boolean;
        matches: Array<{
          id: string;
          title: string;
          similarity: number;
          category: string;
          status: string;
          distanceKm?: number;
          locationScore?: number;
          combinedScore?: number;
        }>;
        stats: {
          checked: number;
          processingTimeMs: number;
        };
      };
    }>('/complaints/check-duplicate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Add insight request
  addInsight: async (id: string, message: string, attachments?: Array<{url: string, name: string, type: string, size?: number}>) => {
    return apiFetch<any>(`/complaints/${id}/insights`, {
      method: 'POST',
      body: JSON.stringify({ message, attachments }),
    });
  },

  // Reply to insight request
  replyToInsight: async (complaintId: string, insightId: string, reply: string) => {
    return apiFetch<any>(`/complaints/${complaintId}/insights/${insightId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply }),
    });
  },

  // Add photo to complaint
  addPhoto: async (id: string, image: File) => {
    const formData = new FormData();
    formData.append('image', image);
    return apiUpload<any>(`/complaints/${id}/photos`, formData);
  },

  // Get platform statistics
  getPlatformStats: async () => {
    return apiFetch<{
      success: boolean;
      data: {
        totalComplaints: number;
        resolvedComplaints: number;
        uniqueVoters: number;
        sectorsCovered: number;
      };
    }>('/complaints/platform/stats');
  },

  // Mark complaint as solved
  markAsSolved: async (id: string) => {
    return apiFetch<any>(`/complaints/${id}/mark-solved`, {
      method: 'POST',
    });
  },

  // Report a complaint
  report: async (id: string, reason: string) => {
    return apiFetch<any>(`/complaints/${id}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Get comments for a complaint
  getComments: async (id: string, page: number = 1, limit: number = 20) => {
    return apiFetch<{
      success: boolean;
      data: Array<{
        id: string;
        complaintId: string;
        userId: string;
        userName: string;
        userEmail: string;
        userAvatar: string;
        content: string;
        createdAt: string;
        updatedAt: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
      };
    }>(`/complaints/${id}/comments?page=${page}&limit=${limit}`);
  },

  // Add comment to a complaint
  addComment: async (id: string, content: string) => {
    return apiFetch<any>(`/complaints/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  // Delete a comment
  deleteComment: async (complaintId: string, commentId: string) => {
    return apiFetch<any>(`/complaints/${complaintId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  },

  // Like/unlike a comment
  likeComment: async (complaintId: string, commentId: string) => {
    return apiFetch<any>(`/complaints/${complaintId}/comments/${commentId}/like`, {
      method: 'POST',
    });
  },

  // Get user's own complaints
  getUserComplaints: async (filters: ComplaintFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
    return apiFetch<any>(`/complaints/user/my-complaints?${params.toString()}`);
  },

  // Get complaints voted by user
  getVotedComplaints: async (filters: ComplaintFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
    return apiFetch<any>(`/complaints/user/voted-complaints?${params.toString()}`);
  },
};

// ============== USER API ==============

export interface UpdateProfileData {
  displayName?: string;
  phone?: string;
  bio?: string;
  address?: string;
  photoURL?: string;
}

export const usersAPI = {
  // Get current user's profile
  getProfile: async () => {
    return apiFetch<any>('/users/profile');
  },

  // Update profile
  updateProfile: async (data: UpdateProfileData) => {
    return apiFetch<any>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Upload profile photo
  uploadProfilePhoto: async (photo: File) => {
    const formData = new FormData();
    formData.append('photo', photo);
    return apiUpload<any>('/users/profile/photo', formData);
  },

  // Get user statistics
  getStats: async () => {
    return apiFetch<any>('/users/stats');
  },

  // Get public profile
  getPublicProfile: async (userId: string) => {
    return apiFetch<any>(`/users/${userId}/public`);
  },

  // Delete account
  deleteAccount: async () => {
    return apiFetch<any>('/users/account', {
      method: 'DELETE',
    });
  },

  // Get notification settings
  getNotificationSettings: async () => {
    return apiFetch<any>('/users/notifications/settings');
  },

  // Update notification settings
  updateNotificationSettings: async (settings: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    complaintUpdates?: boolean;
    voteNotifications?: boolean;
    weeklyDigest?: boolean;
  }) => {
    return apiFetch<any>('/users/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  // Change password (validation only, actual change happens via Firebase)
  changePassword: async () => {
    return apiFetch<any>('/users/change-password', {
      method: 'POST',
    });
  },
};

// ============== NOTIFICATIONS API ==============

export interface NotificationFilters {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export const notificationsAPI = {
  // Get notifications
  getAll: async (filters: NotificationFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    });
    return apiFetch<any>(`/notifications?${params.toString()}`);
  },

  // Mark notification as read
  markAsRead: async (id: string) => {
    return apiFetch<any>(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    return apiFetch<any>('/notifications/read-all', {
      method: 'PUT',
    });
  },

  // Delete notification
  delete: async (id: string) => {
    return apiFetch<any>(`/notifications/${id}`, {
      method: 'DELETE',
    });
  },
};

// Contact API
export const contactAPI = {
  // Submit contact form
  submitContactForm: async (data: { name: string; email: string; subject?: string; message: string }) => {
    return apiFetch<any>('/contact', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============== AI API ==============

export interface ImproveDescriptionRequest {
  description: string;
  title?: string;
  sector?: string;
}

export interface ImproveDescriptionResponse {
  success: boolean;
  improvedDescription?: string;
  error?: string;
  processingTimeMs?: number;
  retryAfterSeconds?: number;
}

export const aiAPI = {
  // Improve complaint description using AI
  improveDescription: async (data: ImproveDescriptionRequest): Promise<ImproveDescriptionResponse> => {
    try {
      return await apiFetch<ImproveDescriptionResponse>('/ai/improve-description', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to improve description',
      };
    }
  },

  // Check AI service health
  getHealth: async () => {
    return apiFetch<{ status: string; model: string }>('/ai/health');
  },
};

const api = {
  complaints: complaintsAPI,
  users: usersAPI,
  notifications: notificationsAPI,
  contact: contactAPI,
  ai: aiAPI,
};

export default api;
