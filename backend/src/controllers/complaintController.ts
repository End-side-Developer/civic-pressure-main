import { Request, Response } from 'express';
import { db, storage } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';
import { Complaint, StatusHistoryItem, ApiResponse, CreateComplaintRequest, UpdateComplaintRequest, Notification } from '../types';
import { generateFileName } from '../middleware/upload';
import { createNotification } from './notificationController';
import { storeComplaintEmbedding, isModelReady } from '../services/embeddingService';

const complaintsCollection = db.collection('complaints');
const usersCollection = db.collection('users');

// Helper to check user notification settings and send notification if enabled
const sendUserNotification = async (
  userId: string,
  settingKey: 'complaintUpdates' | 'voteNotifications',
  type: Notification['type'],
  title: string,
  message: string,
  complaintId?: string
): Promise<void> => {
  try {
    // Get user's notification settings
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    const settings = userData?.notificationSettings || {
      complaintUpdates: true,
      voteNotifications: true,
      weeklyDigest: false,
    };

    // Check if the specific notification type is enabled
    if (settings[settingKey]) {
      await createNotification(userId, type, title, message, complaintId);
    }
  } catch (error) {
    console.error('Error sending user notification:', error);
    // Don't throw - notification failure shouldn't break the main operation
  }
};

// Helper to calculate priority score
const calculatePriorityScore = (votes: number, views: number, daysOld: number): Complaint['priorityScore'] => {
  const score = (votes * 3) + (views * 0.5) + (daysOld * 2);
  if (score >= 500) return 'Critical';
  if (score >= 200) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
};

// Upload image to Firebase Storage with base64 fallback
const uploadImage = async (file: Express.Multer.File, complaintId: string): Promise<string> => {
  try {
    const bucket = storage.bucket();
    const fileName = `complaints/${complaintId}/${generateFileName(file.originalname)}`;
    const fileUpload = bucket.file(fileName);

    await fileUpload.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    // Make the file public and get URL
    await fileUpload.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    console.log('✅ Image uploaded to Firebase Storage:', url);
    return url;
  } catch (storageError: any) {
    console.log('⚠️ Firebase Storage upload failed, using base64 fallback');
    console.log('⚠️ Storage error:', storageError.message);

    // Fallback: Convert to base64 data URL and store directly
    const base64Data = file.buffer.toString('base64');
    const dataUrl = `data:${file.mimetype};base64,${base64Data}`;
    console.log('✅ Image converted to base64 (length:', dataUrl.length, ')');
    return dataUrl;
  }
};

// Get all complaints with pagination and filters
export const getAllComplaints = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      category,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search
    } = req.query;

    let query: FirebaseFirestore.Query = complaintsCollection;

    // Apply filters
    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }
    if (category && category !== 'all') {
      query = query.where('category', '==', category);
    }

    // Apply sorting
    const validSortFields = ['createdAt', 'votes', 'views', 'priorityScore'];
    const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'createdAt';
    query = query.orderBy(sortField, sortOrder === 'asc' ? 'asc' : 'desc');

    // Get total count for pagination
    const totalSnapshot = await query.get();
    const total = totalSnapshot.size;

    // Apply pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    query = query.offset(offset).limit(limitNum);

    const snapshot = await query.get();
    let complaints: Complaint[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Skip deleted complaints
      if (data.isDeleted) return;
      
      // Mask user info if anonymous
      const complaint: Complaint = {
        ...data,
        id: doc.id,
        userName: data.isAnonymous ? 'Anonymous' : data.userName,
        userEmail: data.isAnonymous ? '' : data.userEmail,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as Complaint;
      complaints.push(complaint);
    });

    // Apply search filter in memory (Firestore doesn't support full-text search)
    if (search) {
      const searchLower = (search as string).toLowerCase();
      complaints = complaints.filter(
        (c) =>
          c.title.toLowerCase().includes(searchLower) ||
          c.description.toLowerCase().includes(searchLower) ||
          c.location.toLowerCase().includes(searchLower)
      );
    }

    const response: ApiResponse = {
      success: true,
      data: {
        complaints,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch complaints',
    });
  }
};

// Get single complaint by ID
export const getComplaintById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await complaintsCollection.doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    const data = doc.data()!;

    // Check if complaint is deleted
    if (data.isDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    // Get viewer identifier - use userId if authenticated, otherwise use IP address or anonymous
    const viewerId = req.user?.uid || req.ip || 'anonymous';
    const viewedBy = Array.isArray(data.viewedBy) ? data.viewedBy : [];
    
    // Only increment view count if this user hasn't viewed before
    let updatedViewedBy = viewedBy;
    let viewCount = data.views || 0;
    
    if (!viewedBy.includes(viewerId)) {
      updatedViewedBy = [...viewedBy, viewerId];
      viewCount = updatedViewedBy.length;
      
      // Update the complaint with new view data
      await complaintsCollection.doc(id).update({
        views: viewCount,
        viewedBy: updatedViewedBy,
      });
    }

    const complaint: Complaint = {
      ...data,
      id: doc.id,
      userName: data.isAnonymous ? 'Anonymous' : data.userName,
      userEmail: data.isAnonymous ? '' : data.userEmail,
      views: viewCount,
      viewedBy: updatedViewedBy,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
    } as Complaint;

    res.json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    console.error('Error fetching complaint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch complaint',
    });
  }
};

// Create new complaint
export const createComplaint = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { title, description, category, location } = req.body as CreateComplaintRequest;

    // Parse coordinates (sent as JSON string from FormData)
    let coordinates = req.body.coordinates;
    if (typeof coordinates === 'string') {
      try {
        coordinates = JSON.parse(coordinates);
      } catch (e) {
        coordinates = { latitude: 0, longitude: 0 };
      }
    }

    // Parse isAnonymous (sent as string "true"/"false" from FormData)
    const isAnonymous = req.body.isAnonymous === 'true' || req.body.isAnonymous === true;

    // Validate required fields
    if (!title || !description || !category || !location) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, description, category, location',
      });
    }

    const complaintId = uuidv4();
    const now = new Date();

    // Upload images if any
    const imageUrls: string[] = [];
    console.log('📸 Files received:', req.files ? (Array.isArray(req.files) ? req.files.length : 'Not an array') : 'No files');
    if (req.files && Array.isArray(req.files)) {
      console.log('📸 Processing', req.files.length, 'files');
      for (const file of req.files) {
        try {
          console.log('📸 Uploading file:', file.originalname, 'Size:', file.size, 'Type:', file.mimetype);
          const url = await uploadImage(file, complaintId);
          console.log('📸 Upload success:', url);
          imageUrls.push(url);
        } catch (uploadError: any) {
          console.error('❌ Error uploading image:', uploadError.message || uploadError);
          console.error('❌ Full error:', JSON.stringify(uploadError, null, 2));
          // Continue without this image instead of failing completely
        }
      }
    }
    console.log('📸 Final image URLs:', imageUrls);

    const initialStatus: StatusHistoryItem = {
      status: 'PENDING REVIEW',
      date: now,
      note: 'Complaint submitted successfully',
    };

    const newComplaint: Omit<Complaint, 'id'> = {
      userId: req.user.uid,
      userName: req.user.name || 'User',
      userEmail: req.user.email || '',
      isAnonymous: isAnonymous || false,
      title,
      description,
      category: category.toUpperCase(),
      status: 'PENDING REVIEW',
      location,
      coordinates: coordinates || { latitude: 0, longitude: 0 },
      images: imageUrls,
      votes: 0,
      votedBy: [],
      views: 0,
      viewedBy: [],
      priorityScore: 'Low',
      statusHistory: [initialStatus],
      insightRequests: [],
      createdAt: now,
      updatedAt: now,
    };

    await complaintsCollection.doc(complaintId).set(newComplaint);

    // Send confirmation notification to user
    await sendUserNotification(
      req.user.uid,
      'complaintUpdates',
      'COMPLAINT_UPDATE',
      'Complaint Submitted Successfully',
      `Your complaint "${title}" has been submitted and is pending review.`,
      complaintId
    );

    // Generate and store embedding for duplicate detection (non-blocking)
    // Now includes location data for better semantic matching
    if (isModelReady()) {
      storeComplaintEmbedding(complaintId, title, category, description, location)
        .catch((err) => console.error('Failed to store embedding:', err));
    }

    // Update user's total complaints count
    const userRef = usersCollection.doc(req.user.uid);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      await userRef.update({
        totalComplaints: (userDoc.data()?.totalComplaints || 0) + 1,
      });
    }

    res.status(201).json({
      success: true,
      data: { id: complaintId, ...newComplaint },
      message: 'Complaint created successfully',
    });
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create complaint',
    });
  }
};

// Update complaint
export const updateComplaint = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { id } = req.params;
    const updates = req.body as UpdateComplaintRequest;

    const doc = await complaintsCollection.doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    const complaint = doc.data()!;

    // Check if user owns the complaint (or is admin)
    if (complaint.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this complaint',
      });
    }

    const updateData: any = {
      ...updates,
      updatedAt: new Date(),
    };

    // Handle coordinates if provided - ensure proper format
    if (updates.coordinates) {
      // If coordinates is a string (from FormData), parse it
      let coords = updates.coordinates;
      if (typeof coords === 'string') {
        try {
          coords = JSON.parse(coords);
        } catch (e) {
          coords = { latitude: 0, longitude: 0 };
        }
      }
      // If coordinates is an array [lat, lng], convert to object
      if (Array.isArray(coords)) {
        updateData.coordinates = {
          latitude: coords[0],
          longitude: coords[1]
        };
      } else {
        updateData.coordinates = coords;
      }
    }

    // Handle existing images if provided (from FormData)
    let existingImages: string[] = [];
    if (updates.existingImages) {
      if (typeof updates.existingImages === 'string') {
        try {
          existingImages = JSON.parse(updates.existingImages);
        } catch (e) {
          existingImages = [];
        }
      } else if (Array.isArray(updates.existingImages)) {
        existingImages = updates.existingImages;
      }
    }

    // Upload new images if any
    const newImageUrls: string[] = [];
    console.log('📸 Update - Files received:', req.files ? (Array.isArray(req.files) ? req.files.length : 'Not an array') : 'No files');
    if (req.files && Array.isArray(req.files)) {
      console.log('📸 Update - Processing', req.files.length, 'new files');
      for (const file of req.files) {
        try {
          console.log('📸 Update - Uploading file:', file.originalname, 'Size:', file.size, 'Type:', file.mimetype);
          const url = await uploadImage(file, id);
          console.log('📸 Update - Upload success:', url);
          newImageUrls.push(url);
        } catch (uploadError: any) {
          console.error('❌ Error uploading image:', uploadError.message || uploadError);
        }
      }
    }

    // Combine existing images with new images
    if (existingImages.length > 0 || newImageUrls.length > 0) {
      updateData.images = [...existingImages, ...newImageUrls];
      // Remove the existingImages field from update data since we've handled it
      delete updateData.existingImages;
    }

    // Add to status history if status changed
    const statusChanged = updates.status && updates.status !== complaint.status;
    if (statusChanged && updates.status) {
      const statusUpdate: StatusHistoryItem = {
        status: updates.status,
        date: new Date(),
        note: updates.rejectionReason || `Status changed to ${updates.status}`,
      };
      updateData.statusHistory = [...(complaint.statusHistory || []), statusUpdate];
    }

    await complaintsCollection.doc(id).update(updateData);

    // Send notification if status was changed
    if (statusChanged && complaint.userId) {
      const statusMessage = updates.status === 'REJECTED' 
        ? `Your complaint "${complaint.title}" has been rejected. ${updates.rejectionReason ? `Reason: ${updates.rejectionReason}` : ''}`
        : `Your complaint "${complaint.title}" status has been updated to: ${updates.status}`;
      
      await sendUserNotification(
        complaint.userId,
        'complaintUpdates',
        'STATUS_CHANGE',
        'Complaint Status Update',
        statusMessage,
        id
      );
    }

    // Regenerate embedding if title, description, category, or location changed
    if (isModelReady() && (updates.title || updates.description || updates.category || updates.location)) {
      const updatedData = await complaintsCollection.doc(id).get();
      const data = updatedData.data();
      if (data) {
        storeComplaintEmbedding(
          id,
          data.title,
          data.category,
          data.description,
          data.location
        ).catch((err) => console.error('Failed to regenerate embedding:', err));
      }
    }

    // Fetch the updated complaint to return
    const updatedDoc = await complaintsCollection.doc(id).get();
    const updatedComplaint = {
      ...updatedDoc.data(),
      id: updatedDoc.id,
      createdAt: updatedDoc.data()?.createdAt?.toDate(),
      updatedAt: updatedDoc.data()?.updatedAt?.toDate(),
    };

    res.json({
      success: true,
      data: updatedComplaint,
      message: 'Complaint updated successfully',
    });
  } catch (error) {
    console.error('Error updating complaint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update complaint',
    });
  }
};

// Delete complaint
export const deleteComplaint = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { id } = req.params;

    const doc = await complaintsCollection.doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    const complaint = doc.data()!;

    // Check if user owns the complaint
    if (complaint.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this complaint',
      });
    }

    // Soft delete - mark as deleted instead of removing from database
    // Keep images in storage for data retention
    await complaintsCollection.doc(id).update({
      isDeleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    });

    // Update user's total complaints count
    const userRef = usersCollection.doc(req.user.uid);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      await userRef.update({
        totalComplaints: Math.max((userDoc.data()?.totalComplaints || 1) - 1, 0),
      });
    }

    res.json({
      success: true,
      message: 'Complaint deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting complaint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete complaint',
    });
  }
};

// Vote for a complaint
export const voteComplaint = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { id } = req.params;
    const doc = await complaintsCollection.doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    const complaint = doc.data()!;
    const votedBy = complaint.votedBy || [];

    // Check if user already voted
    if (votedBy.includes(req.user.uid)) {
      // Remove vote
      const newVotedBy = votedBy.filter((uid: string) => uid !== req.user!.uid);
      const newVotes = Math.max((complaint.votes || 1) - 1, 0);
      await complaintsCollection.doc(id).update({
        votes: newVotes,
        votedBy: newVotedBy,
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        data: { voted: false, votes: newVotes, totalVotes: newVotes, votedBy: newVotedBy },
        message: 'Vote removed',
      });
    } else {
      // Add vote
      const newVotes = (complaint.votes || 0) + 1;
      const newVotedBy = [...votedBy, req.user.uid];
      await complaintsCollection.doc(id).update({
        votes: newVotes,
        votedBy: newVotedBy,
        updatedAt: new Date(),
      });

      // Update complaint owner's total votes received
      if (complaint.userId) {
        const ownerRef = usersCollection.doc(complaint.userId);
        const ownerDoc = await ownerRef.get();
        if (ownerDoc.exists) {
          await ownerRef.update({
            totalVotesReceived: (ownerDoc.data()?.totalVotesReceived || 0) + 1,
          });
        }

        // Send notification to complaint owner (only if not voting on own complaint)
        if (complaint.userId !== req.user.uid) {
          await sendUserNotification(
            complaint.userId,
            'voteNotifications',
            'NEW_VOTE',
            'New vote on your complaint',
            `Your complaint "${complaint.title}" received a new vote. Total votes: ${newVotes}`,
            id
          );
        }
      }

      res.json({
        success: true,
        data: { voted: true, votes: newVotes, totalVotes: newVotes, votedBy: newVotedBy },
        message: 'Vote added',
      });
    }
  } catch (error) {
    console.error('Error voting complaint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to vote',
    });
  }
};

// Add insight request to complaint
export const addInsightRequest = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { id } = req.params;
    const { message, attachments } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }

    const doc = await complaintsCollection.doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    const complaint = doc.data()!;

    // Prevent users from sending insight requests to their own complaints
    if (complaint.userId === req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'You cannot send an insight request to your own complaint',
      });
    }

    const insightRequest = {
      id: uuidv4(),
      userId: req.user.uid,
      userName: req.user.name || 'User',
      message,
      hasReply: false,
      createdAt: new Date(),
      attachments: attachments || [],
    };

    await complaintsCollection.doc(id).update({
      insightRequests: [...(complaint.insightRequests || []), insightRequest],
      updatedAt: new Date(),
    });

    // Send notification to complaint owner about the insight request
    if (complaint.userId) {
      await sendUserNotification(
        complaint.userId,
        'complaintUpdates',
        'INSIGHT_REQUEST',
        'New insight request',
        `${req.user.name || 'Someone'} requested insights on your complaint "${complaint.title}"`,
        id
      );
    }

    res.json({
      success: true,
      data: insightRequest,
      message: 'Insight request added',
    });
  } catch (error) {
    console.error('Error adding insight request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add insight request',
    });
  }
};

// Reply to insight request
export const replyToInsight = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { id, insightId } = req.params;
    const { reply } = req.body;

    if (!reply) {
      return res.status(400).json({
        success: false,
        error: 'Reply is required',
      });
    }

    const doc = await complaintsCollection.doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    const complaint = doc.data()!;

    // Check if user owns the complaint
    if (complaint.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Only complaint owner can reply to insight requests',
      });
    }

    const insightToReply = (complaint.insightRequests || []).find((insight: any) => insight.id === insightId);
    
    const updatedInsights = (complaint.insightRequests || []).map((insight: any) => {
      if (insight.id === insightId) {
        return {
          ...insight,
          reply,
          hasReply: true,
          repliedAt: new Date(),
        };
      }
      return insight;
    });

    await complaintsCollection.doc(id).update({
      insightRequests: updatedInsights,
      updatedAt: new Date(),
    });

    // Send notification to the person who requested the insight
    if (insightToReply && insightToReply.userId) {
      // Include the reply content in the notification message
      const replyPreview = reply.length > 150 ? reply.substring(0, 150) + '...' : reply;
      await sendUserNotification(
        insightToReply.userId,
        'complaintUpdates',
        'INSIGHT_REPLY',
        'Reply to your insight request',
        `Reply on "${complaint.title}": ${replyPreview}`,
        id
      );
    }

    res.json({
      success: true,
      message: 'Reply added successfully',
    });
  } catch (error) {
    console.error('Error replying to insight:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reply',
    });
  }
};

// Add photo to existing complaint
export const addPhotoToComplaint = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { id } = req.params;

    const doc = await complaintsCollection.doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    const complaint = doc.data()!;

    // Check if user owns the complaint
    if (complaint.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to add photos to this complaint',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
    }

    const imageUrl = await uploadImage(req.file, id);

    await complaintsCollection.doc(id).update({
      images: [...(complaint.images || []), imageUrl],
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      data: { imageUrl },
      message: 'Photo added successfully',
    });
  } catch (error) {
    console.error('Error adding photo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add photo',
    });
  }
};

// Get user's complaints
export const getUserComplaints = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { page = 1, limit = 10, status } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    // Use simple where query - no orderBy to avoid index requirement
    const snapshot = await complaintsCollection.where('userId', '==', req.user.uid).get();
    
    let complaints: Complaint[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Skip deleted complaints
      if (data.isDeleted) return;
      
      complaints.push({
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as Complaint);
    });

    // Filter by status if provided
    if (status && status !== 'all') {
      complaints = complaints.filter(c => c.status === status);
    }

    // Sort by createdAt descending in memory
    complaints.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const total = complaints.length;

    // Apply pagination
    const offset = (pageNum - 1) * limitNum;
    complaints = complaints.slice(offset, offset + limitNum);

    res.json({
      success: true,
      data: {
        complaints,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching user complaints:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user complaints',
    });
  }
};

// Get complaints voted by user
export const getVotedComplaints = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Single query - no duplicate database call
    const snapshot = await complaintsCollection.where('votedBy', 'array-contains', req.user.uid).get();
    
    let complaints: Complaint[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Skip deleted complaints
      if (data.isDeleted) return;
      
      complaints.push({
        ...data,
        id: doc.id,
        userName: data.isAnonymous ? 'Anonymous' : data.userName,
        userEmail: data.isAnonymous ? '' : data.userEmail,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as Complaint);
    });

    const total = complaints.length;

    // Sort by votes descending
    complaints.sort((a, b) => (b.votes || 0) - (a.votes || 0));

    // Apply pagination in memory
    complaints = complaints.slice(offset, offset + limitNum);

    res.json({
      success: true,
      data: {
        complaints,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching voted complaints:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch voted complaints',
    });
  }
};

// Mark complaint as solved (only complaint owner can do this)
export const markAsSolved = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { id } = req.params;
    const doc = await complaintsCollection.doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    const complaint = doc.data()!;

    // Verify the user is the owner of the complaint
    if (complaint.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You can only mark your own complaints as solved',
      });
    }

    // Update status to RESOLVED
    const now = new Date();
    const statusUpdate: StatusHistoryItem = {
      status: 'RESOLVED',
      date: now,
      note: 'Marked as solved by complaint owner',
      updatedBy: req.user.email || req.user.uid,
    };

    const updatedStatusHistory = [...(complaint.statusHistory || []), statusUpdate];

    await complaintsCollection.doc(id).update({
      status: 'RESOLVED',
      statusHistory: updatedStatusHistory,
      updatedAt: now,
    });

    res.json({
      success: true,
      message: 'Complaint marked as solved',
      data: {
        status: 'RESOLVED',
        statusHistory: updatedStatusHistory,
      },
    });
  } catch (error) {
    console.error('Error marking complaint as solved:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark complaint as solved',
    });
  }
};

// Report a complaint
export const reportComplaint = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Report reason is required',
      });
    }

    // Get the complaint
    const complaintDoc = await complaintsCollection.doc(id).get();
    if (!complaintDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    const complaint = complaintDoc.data() as Complaint;

    // Don't allow users to report their own complaints
    if (complaint.userId === userId) {
      return res.status(400).json({
        success: false,
        error: 'You cannot report your own complaint',
      });
    }

    // Get reporter's information
    const reporterDoc = await usersCollection.doc(userId).get();
    const reporterData = reporterDoc.exists ? reporterDoc.data() : {};
    const reporterName = reporterData?.displayName || reporterData?.name || 'Anonymous';
    const reporterEmail = reporterData?.email || '';

    const reportId = uuidv4();
    const now = new Date();

    // Create report document
    const report = {
      id: reportId,
      complaintId: id,
      reportedBy: userId,
      reporterName: reporterName,
      reporterEmail: reporterEmail,
      reason: reason.trim(),
      createdAt: now,
      status: 'pending', // pending, reviewed, resolved
    };

    // Store report in subcollection
    await complaintsCollection.doc(id).collection('reports').doc(reportId).set(report);

    res.json({
      success: true,
      message: 'Report submitted successfully',
      data: report,
    });
  } catch (error) {
    console.error('Error reporting complaint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit report',
    });
  }
};

// Get platform statistics
export const getPlatformStats = async (req: Request, res: Response) => {
  try {
    // Get all complaints
    const complaintsSnapshot = await complaintsCollection.get();
    const complaints = complaintsSnapshot.docs.map(doc => doc.data() as Complaint);
    
    // Calculate stats
    const totalComplaints = complaints.length;
    const resolvedComplaints = complaints.filter(c => 
      c.status?.toUpperCase() === 'RESOLVED' || 
      c.status?.toLowerCase() === 'solved'
    ).length;
    
    // Get unique voters count
    const allVoterIds = new Set<string>();
    complaints.forEach(complaint => {
      if (complaint.votedBy && Array.isArray(complaint.votedBy)) {
        complaint.votedBy.forEach(voterId => allVoterIds.add(voterId));
      }
    });
    const uniqueVoters = allVoterIds.size;
    
    // Get unique sectors count
    const sectors = new Set<string>();
    complaints.forEach(complaint => {
      if (complaint.category) {
        sectors.add(complaint.category.toUpperCase());
      }
    });
    const sectorsCovered = sectors.size;

    res.json({
      success: true,
      data: {
        totalComplaints,
        resolvedComplaints,
        uniqueVoters,
        sectorsCovered,
      },
    });
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch platform statistics',
    });
  }
};

// Add comment to a complaint
export const addComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = (req as any).user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Comment content is required',
      });
    }

    // Get the complaint
    const complaintDoc = await complaintsCollection.doc(id).get();
    if (!complaintDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    // Get commenter's information
    const userDoc = await usersCollection.doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const userName = userData?.displayName || userData?.name || 'Anonymous';
    const userEmail = userData?.email || '';
    const userAvatar = userData?.photoURL || '';

    const commentId = uuidv4();
    const now = new Date();

    // Create comment document
    const comment = {
      id: commentId,
      complaintId: id,
      userId: userId,
      userName: userName,
      userEmail: userEmail,
      userAvatar: userAvatar,
      content: content.trim(),
      createdAt: now,
      updatedAt: now,
    };

    // Store comment in subcollection
    await complaintsCollection.doc(id).collection('comments').doc(commentId).set(comment);

    // Update comment count in complaint
    const complaint = complaintDoc.data() as Complaint;
    await complaintsCollection.doc(id).update({
      comments: (complaint.comments || 0) + 1,
    });

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        ...comment,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add comment',
    });
  }
};

// Get comments for a complaint
export const getComments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Check if complaint exists
    const complaintDoc = await complaintsCollection.doc(id).get();
    if (!complaintDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    // Get comments from subcollection
    const commentsSnapshot = await complaintsCollection
      .doc(id)
      .collection('comments')
      .orderBy('createdAt', 'desc')
      .limit(Number(limit))
      .get();

    const comments = commentsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      };
    });

    res.json({
      success: true,
      data: comments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: comments.length,
      },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comments',
    });
  }
};

// Delete a comment
export const deleteComment = async (req: Request, res: Response) => {
  try {
    const { id, commentId } = req.params;
    const userId = (req as any).user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Check if complaint exists
    const complaintDoc = await complaintsCollection.doc(id).get();
    if (!complaintDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    // Get the comment
    const commentDoc = await complaintsCollection.doc(id).collection('comments').doc(commentId).get();
    if (!commentDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found',
      });
    }

    const comment = commentDoc.data();
    
    // Only allow the comment owner to delete
    if (comment?.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own comments',
      });
    }

    // Delete the comment
    await complaintsCollection.doc(id).collection('comments').doc(commentId).delete();

    // Update comment count in complaint
    const complaint = complaintDoc.data() as Complaint;
    await complaintsCollection.doc(id).update({
      comments: Math.max((complaint.comments || 1) - 1, 0),
    });

    res.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete comment',
    });
  }
};

// Like/Unlike a comment
export const likeComment = async (req: Request, res: Response) => {
  try {
    const { id, commentId } = req.params;
    const userId = (req as any).user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Check if complaint exists
    const complaintDoc = await complaintsCollection.doc(id).get();
    if (!complaintDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    // Get the comment
    const commentRef = complaintsCollection.doc(id).collection('comments').doc(commentId);
    const commentDoc = await commentRef.get();
    
    if (!commentDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found',
      });
    }

    const comment = commentDoc.data();
    const likedBy = comment?.likedBy || [];
    const hasLiked = likedBy.includes(userId);

    let updatedLikedBy: string[];
    let updatedLikes: number;

    if (hasLiked) {
      // Unlike: remove user from likedBy array
      updatedLikedBy = likedBy.filter((id: string) => id !== userId);
      updatedLikes = Math.max((comment?.likes || 1) - 1, 0);
    } else {
      // Like: add user to likedBy array
      updatedLikedBy = [...likedBy, userId];
      updatedLikes = (comment?.likes || 0) + 1;
    }

    // Update the comment
    await commentRef.update({
      likes: updatedLikes,
      likedBy: updatedLikedBy,
    });

    res.json({
      success: true,
      message: hasLiked ? 'Comment unliked successfully' : 'Comment liked successfully',
      data: {
        likes: updatedLikes,
        likedBy: updatedLikedBy,
      },
    });
  } catch (error) {
    console.error('Error liking comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to like comment',
    });
  }
};
