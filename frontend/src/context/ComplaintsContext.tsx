import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { complaintsAPI, CreateComplaintData } from '../services/api';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Types
export interface InsightRequest {
  id: string;
  user: string;
  userId: string;
  avatar: string;
  time: string;
  message: string;
  hasReply: boolean;
  reply?: string;
  replyTime?: string;
  attachments?: Array<{
    url: string;
    name: string;
    type: string;
    size?: number;
  }>;
}

export interface StatusHistoryItem {
  status: string;
  date: string;
  note?: string;
}

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  submittedDate: string;
  location: string;
  coordinates: [number, number];
  votes: number;
  views: number;
  viewedBy: string[];
  comments: number;
  priorityScore: string;
  images: string[];
  statusHistory: StatusHistoryItem[];
  insightRequests: InsightRequest[];
  rejectionReason?: string;
  userId?: string;
  userDisplayName?: string;
  userEmail?: string;
  isAnonymous?: boolean;
  votedBy?: string[];
}

export interface ComplaintFilters {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

interface ComplaintsContextType {
  complaints: Complaint[];
  userComplaints: Complaint[];
  votedComplaints: Complaint[];
  loading: boolean;
  error: string | null;
  totalComplaints: number;
  currentPage: number;
  totalPages: number;
  fetchComplaints: (filters?: ComplaintFilters) => Promise<void>;
  fetchUserComplaints: (filters?: ComplaintFilters) => Promise<void>;
  fetchVotedComplaints: (filters?: ComplaintFilters) => Promise<void>;
  getComplaintById: (id: string) => Promise<Complaint | null>;
  createComplaint: (data: CreateComplaintData) => Promise<Complaint>;
  deleteComplaint: (id: string) => Promise<void>;
  updateComplaint: (id: string, data: Partial<Complaint> & { coordinates?: [number, number] | { latitude: number; longitude: number } }) => Promise<void>;
  voteComplaint: (id: string) => Promise<void>;
  addInsightRequest: (complaintId: string, message: string, attachments?: Array<{url: string, name: string, type: string, size?: number}>) => Promise<void>;
  addInsightReply: (complaintId: string, requestId: string, reply: string) => Promise<void>;
  addPhoto: (complaintId: string, photo: File) => Promise<void>;
  markAsSolved: (id: string) => Promise<void>;
  refreshComplaints: () => Promise<void>;
}

const ComplaintsContext = createContext<ComplaintsContextType | undefined>(undefined);

export const ComplaintsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [votedComplaints, setVotedComplaints] = useState<Complaint[]>([]);
  const [userComplaints, setUserComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalComplaints, setTotalComplaints] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Helper function to convert Firebase Timestamp to string
  const convertTimestampToString = (timestamp: any): string => {
    if (!timestamp) return new Date().toISOString();

    // Handle Firebase Timestamp objects
    if (typeof timestamp === 'object' && '_seconds' in timestamp) {
      return new Date(timestamp._seconds * 1000).toISOString();
    }

    // Handle regular date strings or Date objects
    return typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString();
  };

  // Transform API response to frontend Complaint format
  const transformComplaint = (data: any): Complaint => ({
    id: data.id,
    title: data.title,
    description: data.description,
    category: data.category,
    status: data.status,
    submittedDate: convertTimestampToString(data.submittedDate || data.createdAt),
    location: data.location,
    coordinates: data.coordinates ? [data.coordinates.latitude, data.coordinates.longitude] : [0, 0],
    votes: data.votes || 0,
    views: data.views || 0,
    viewedBy: data.viewedBy || [],
    comments: data.insightRequests?.length || 0,
    priorityScore: data.priorityScore || 'Medium',
    images: data.images || [],
    statusHistory: (data.statusHistory || []).map((item: any) => ({
      status: item.status,
      date: convertTimestampToString(item.date),
      note: item.note
    })),
    insightRequests: (data.insightRequests || []).map((req: any) => ({
      id: req.id,
      user: req.userName || req.user || 'Anonymous',
      userId: req.userId,
      avatar: req.userAvatar || req.avatar || req.userName?.charAt(0) || 'U',
      time: req.createdAt ? new Date(req.createdAt._seconds * 1000).toLocaleDateString() : 'Recently',
      message: req.message,
      hasReply: req.hasReply || false,
      reply: req.reply,
      replyTime: req.repliedAt ? new Date(req.repliedAt._seconds * 1000).toLocaleDateString() : undefined,
      attachments: req.attachments || []
    })),
    rejectionReason: data.rejectionReason,
    userId: data.userId,
    userDisplayName: data.userName || data.userDisplayName,
    userEmail: data.userEmail,
    isAnonymous: data.isAnonymous,
    votedBy: data.votedBy || [],
  });

  // Fetch all complaints
  const fetchComplaints = useCallback(async (filters: ComplaintFilters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await complaintsAPI.getAll(filters);
      // Backend returns { success, data: { complaints, pagination } }
      const complaintsData = response.data?.complaints || response.complaints || [];
      const transformedComplaints = complaintsData.map(transformComplaint);
      setComplaints(transformedComplaints);
      const pagination = response.data?.pagination || response;
      setTotalComplaints(pagination.totalItems || transformedComplaints.length);
      setCurrentPage(pagination.currentPage || 1);
      setTotalPages(pagination.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch complaints');
      console.error('Error fetching complaints:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch user's complaints
  const fetchUserComplaints = useCallback(async (filters: ComplaintFilters = {}) => {
    setError(null);
    try {
      const response = await complaintsAPI.getUserComplaints(filters);
      // Backend returns { success, data: { complaints, pagination } }
      const complaintsData = response.data?.complaints || response.complaints || [];
      const transformedComplaints = complaintsData.map(transformComplaint);
      setUserComplaints(transformedComplaints);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch user complaints');
      console.error('Error fetching user complaints:', err);
    }
  }, []);

  // Fetch complaints voted by user
  const fetchVotedComplaints = useCallback(async (filters: ComplaintFilters = {}) => {
    setError(null);
    try {
      const response = await complaintsAPI.getVotedComplaints(filters);
      // Backend returns { success, data: { complaints, pagination } }
      const complaintsData = response.data?.complaints || response.complaints || [];
      const transformedComplaints = complaintsData.map(transformComplaint);
      setVotedComplaints(transformedComplaints);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch voted complaints');
      console.error('Error fetching voted complaints:', err);
    }
  }, []);

  // Get single complaint by ID
  const getComplaintById = async (id: string): Promise<Complaint | null> => {
    try {
      const response = await complaintsAPI.getById(id);
      // Backend returns { success, data: complaintObject }
      const complaintData = response.data || response.complaint;
      return transformComplaint(complaintData);
    } catch (err: any) {
      console.error('Error fetching complaint:', err);
      return null;
    }
  };

  // Create new complaint
  const createComplaint = async (data: CreateComplaintData): Promise<Complaint> => {
    setLoading(true);
    setError(null);
    try {
      const response = await complaintsAPI.create(data);
      // Backend returns { success, data: complaintObject }
      const complaintData = response.data || response.complaint;
      const newComplaint = transformComplaint(complaintData);
      setComplaints((prev) => [newComplaint, ...prev]);
      setUserComplaints((prev) => [newComplaint, ...prev]);
      return newComplaint;
    } catch (err: any) {
      setError(err.message || 'Failed to create complaint');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete complaint
  const deleteComplaint = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await complaintsAPI.delete(id);
      setComplaints((prev) => prev.filter((c) => c.id !== id));
      setUserComplaints((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete complaint');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update complaint
  const updateComplaint = async (id: string, data: Partial<Complaint> & { coordinates?: [number, number] | { latitude: number; longitude: number } }): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      // Convert coordinates to object format for API if it's an array
      const apiData: any = { ...data };
      if (data.coordinates) {
        if (Array.isArray(data.coordinates)) {
          apiData.coordinates = {
            latitude: data.coordinates[0],
            longitude: data.coordinates[1]
          };
        }
      }
      
      const response = await complaintsAPI.update(id, apiData);
      // Backend returns { success, data: complaintObject, message }
      const complaintData = response.data;
      
      if (complaintData) {
        const updatedComplaint = transformComplaint(complaintData);
        setComplaints((prev) =>
          prev.map((c) => (c.id === id ? updatedComplaint : c))
        );
        setUserComplaints((prev) =>
          prev.map((c) => (c.id === id ? updatedComplaint : c))
        );
      } else {
        // If backend doesn't return complaint, refetch to sync state
        const refreshedComplaint = await complaintsAPI.getById(id);
        const updatedComplaint = transformComplaint(refreshedComplaint.data);
        setComplaints((prev) =>
          prev.map((c) => (c.id === id ? updatedComplaint : c))
        );
        setUserComplaints((prev) =>
          prev.map((c) => (c.id === id ? updatedComplaint : c))
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update complaint');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Vote for complaint
  const voteComplaint = async (id: string): Promise<void> => {
    try {
      const response = await complaintsAPI.vote(id);
      // Backend returns { success, data: { votes, votedBy } }
      const voteData = response.data || response;
      setComplaints((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, votes: voteData.votes, votedBy: voteData.votedBy } : c
        )
      );
      setUserComplaints((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, votes: voteData.votes, votedBy: voteData.votedBy } : c
        )
      );
    } catch (err: any) {
      console.error('Error voting:', err);
      throw err;
    }
  };

  // Add insight request
  const addInsightRequest = async (complaintId: string, message: string, attachments?: Array<{url: string, name: string, type: string, size?: number}>): Promise<void> => {
    try {
      const response = await complaintsAPI.addInsight(complaintId, message, attachments);
      // Backend returns { success, data: insightRequestObject, message }
      // We need to update the complaint's insightRequests array
      const newInsightRequest = response.data;
      
      setComplaints((prev) =>
        prev.map((c) => {
          if (c.id === complaintId) {
            return {
              ...c,
              insightRequests: [...(c.insightRequests || []), newInsightRequest],
              comments: (c.comments || 0) + 1
            };
          }
          return c;
        })
      );
    } catch (err: any) {
      console.error('Error adding insight:', err);
      throw err;
    }
  };

  // Reply to insight request
  const addInsightReply = async (complaintId: string, requestId: string, reply: string): Promise<void> => {
    try {
      await complaintsAPI.replyToInsight(complaintId, requestId, reply);
      // Backend returns { success, message } - update locally
      
      const updateInsightRequests = (complaints: Complaint[]) =>
        complaints.map((c) => {
          if (c.id === complaintId) {
            return {
              ...c,
              insightRequests: (c.insightRequests || []).map((insight) => {
                if (insight.id === requestId) {
                  return {
                    ...insight,
                    reply,
                    hasReply: true,
                    replyTime: new Date().toISOString()
                  };
                }
                return insight;
              })
            };
          }
          return c;
        });

      setComplaints(updateInsightRequests);
      setUserComplaints(updateInsightRequests);
    } catch (err: any) {
      console.error('Error replying to insight:', err);
      throw err;
    }
  };

  // Add photo to complaint
  const addPhoto = async (complaintId: string, photo: File): Promise<void> => {
    try {
      const response = await complaintsAPI.addPhoto(complaintId, photo);
      // Backend returns { success, data: complaintObject }
      const complaintData = response.data || response.complaint;
      const updatedComplaint = transformComplaint(complaintData);
      setComplaints((prev) =>
        prev.map((c) => (c.id === complaintId ? updatedComplaint : c))
      );
      setUserComplaints((prev) =>
        prev.map((c) => (c.id === complaintId ? updatedComplaint : c))
      );
    } catch (err: any) {
      console.error('Error adding photo:', err);
      throw err;
    }
  };

  // Refresh complaints
  const refreshComplaints = async (): Promise<void> => {
    await fetchComplaints();
  };

  // Mark complaint as solved
  const markAsSolved = async (id: string): Promise<void> => {
    try {
      await complaintsAPI.markAsSolved(id);
      
      // Update the complaint in local state
      const updateComplaintStatus = (complaint: Complaint) => {
        if (complaint.id === id) {
          return { ...complaint, status: 'RESOLVED' };
        }
        return complaint;
      };
      
      setComplaints((prev) => prev.map(updateComplaintStatus));
      setUserComplaints((prev) => prev.map(updateComplaintStatus));
      setVotedComplaints((prev) => prev.map(updateComplaintStatus));
    } catch (err: any) {
      console.error('Error marking complaint as solved:', err);
      throw err;
    }
  };

  // Track current user ID to detect actual user changes
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Clear user-specific data only when user actually changes (different user or logout)
  useEffect(() => {
    if (!auth) return;
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const newUserId = user?.uid || null;
      
      // Only clear if user actually changed (not just re-authenticated)
      if (currentUserId !== null && currentUserId !== newUserId) {
        setUserComplaints([]);
        setVotedComplaints([]);
      }
      
      setCurrentUserId(newUserId);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  // Initial fetch
  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  return (
    <ComplaintsContext.Provider
      value={{
        complaints,
        userComplaints,
        votedComplaints,
        loading,
        error,
        totalComplaints,
        currentPage,
        totalPages,
        fetchComplaints,
        fetchUserComplaints,
        fetchVotedComplaints,
        getComplaintById,
        createComplaint,
        deleteComplaint,
        updateComplaint,
        voteComplaint,
        addInsightRequest,
        addInsightReply,
        addPhoto,
        markAsSolved,
        refreshComplaints,
      }}
    >
      {children}
    </ComplaintsContext.Provider>
  );
};

export const useComplaints = () => {
  const context = useContext(ComplaintsContext);
  if (!context) {
    throw new Error('useComplaints must be used within a ComplaintsProvider');
  }
  return context;
};
