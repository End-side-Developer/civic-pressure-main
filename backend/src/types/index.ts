// Complaint Types
export interface InsightRequest {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  message: string;
  reply?: string;
  hasReply: boolean;
  createdAt: Date;
  repliedAt?: Date;
  attachments?: Array<{
    url: string;
    name: string;
    type: string;
    size?: number;
  }>;
}

export interface StatusHistoryItem {
  status: string;
  date: Date;
  note?: string;
  updatedBy?: string;
}

export interface Complaint {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  isAnonymous: boolean;
  title: string;
  description: string;
  category: string;
  status: 'PENDING REVIEW' | 'UNDER REVIEW' | 'IN PROGRESS' | 'RESOLVED' | 'REJECTED';
  location: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  images: string[];
  votes: number;
  votedBy: string[]; // Array of user IDs who voted
  views: number;
  viewedBy: string[]; // Array of user IDs who viewed
  priorityScore: 'Low' | 'Medium' | 'High' | 'Critical';
  statusHistory: StatusHistoryItem[];
  insightRequests: InsightRequest[];
  rejectionReason?: string;
  comments?: number; // Count of comments on this complaint
  // Embedding fields for duplicate detection
  embedding?: number[]; // 512-dimensional embedding vector
  embeddingVersion?: number; // Version of embedding model used
  createdAt: Date;
  updatedAt: Date;
}

// User Types
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  bio?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
  totalComplaints: number;
  resolvedComplaints: number;
  totalVotesReceived: number;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: 'COMPLAINT_UPDATE' | 'NEW_VOTE' | 'INSIGHT_REQUEST' | 'INSIGHT_REPLY' | 'STATUS_CHANGE' | 'WEEKLY_DIGEST';
  title: string;
  message: string;
  complaintId?: string;
  isRead: boolean;
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Request Types
export interface CreateComplaintRequest {
  title: string;
  description: string;
  category: string;
  location: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  isAnonymous: boolean;
}

export interface UpdateComplaintRequest {
  title?: string;
  description?: string;
  category?: string;
  status?: Complaint['status'];
  rejectionReason?: string;
  location?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  } | [number, number] | string;
  images?: string[];
  existingImages?: string[] | string;
}

export interface CreateInsightRequest {
  message: string;
}

export interface ReplyInsightRequest {
  reply: string;
}
