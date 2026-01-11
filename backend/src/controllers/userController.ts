import { Request, Response } from 'express';
import { db, storage } from '../config/firebase';
import { UserProfile, ApiResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';

const usersCollection = db.collection('users');

// Upload profile image to Firebase Storage
const uploadProfileImage = async (file: Express.Multer.File, userId: string): Promise<string> => {
  try {
    const bucket = storage.bucket();
    
    // Check if bucket is properly configured
    if (!bucket.name) {
      throw new Error('Firebase Storage bucket is not configured. Please set FIREBASE_STORAGE_BUCKET in your environment variables or enable Firebase Storage in the Firebase Console.');
    }
    
    console.log('📤 Uploading to bucket:', bucket.name);
    
    const fileName = `profiles/${userId}/${uuidv4()}-${file.originalname}`;
    const fileUpload = bucket.file(fileName);

    await fileUpload.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    // Make the file public and get URL
    await fileUpload.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    
    console.log('✅ File uploaded successfully:', publicUrl);
    return publicUrl;
  } catch (error: any) {
    console.error('❌ Firebase Storage upload error:', error);
    
    // Provide user-friendly error messages
    if (error.code === 404 || (error.message && error.message.includes('does not exist'))) {
      throw new Error('Firebase Storage is not enabled for this project. Please enable it in the Firebase Console at https://console.firebase.google.com/project/civic-pressure/storage');
    }
    
    if (error.code === 403) {
      throw new Error('Permission denied. Please check Firebase Storage security rules.');
    }
    
    throw new Error(`Storage upload failed: ${error.message || 'Unknown error'}`);
  }
};

// Create or update user profile (called after Firebase Auth signup)
export const createOrUpdateProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { displayName, phone, bio, address, photoURL } = req.body;

    const userRef = usersCollection.doc(req.user.uid);
    const userDoc = await userRef.get();

    const now = new Date();

    if (userDoc.exists) {
      // Update existing profile
      const updateData: Partial<UserProfile> = {
        updatedAt: now,
      };

      if (displayName !== undefined) updateData.displayName = displayName;
      if (phone !== undefined) updateData.phone = phone;
      if (bio !== undefined) updateData.bio = bio;
      if (address !== undefined) updateData.address = address;
      if (photoURL !== undefined) updateData.photoURL = photoURL;

      await userRef.update(updateData);

      const updatedDoc = await userRef.get();
      res.json({
        success: true,
        data: { uid: req.user.uid, ...updatedDoc.data() },
        message: 'Profile updated successfully',
      });
    } else {
      // Create new profile
      const newProfile: UserProfile = {
        uid: req.user.uid,
        email: req.user.email || '',
        displayName: displayName || req.user.name || 'User',
        photoURL: photoURL || '',
        phone: phone || '',
        bio: bio || '',
        address: address || '',
        createdAt: now,
        updatedAt: now,
        totalComplaints: 0,
        resolvedComplaints: 0,
        totalVotesReceived: 0,
      };

      await userRef.set(newProfile);

      res.status(201).json({
        success: true,
        data: newProfile,
        message: 'Profile created successfully',
      });
    }
  } catch (error) {
    console.error('Error creating/updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create/update profile',
    });
  }
};

// Get current user's profile
export const getProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const userDoc = await usersCollection.doc(req.user.uid).get();

    if (!userDoc.exists) {
      // Create a basic profile if it doesn't exist
      const basicProfile: UserProfile = {
        uid: req.user.uid,
        email: req.user.email || '',
        displayName: req.user.name || 'User',
        photoURL: '',
        phone: '',
        bio: '',
        address: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        totalComplaints: 0,
        resolvedComplaints: 0,
        totalVotesReceived: 0,
      };

      await usersCollection.doc(req.user.uid).set(basicProfile);

      return res.json({
        success: true,
        data: basicProfile,
      });
    }

    res.json({
      success: true,
      data: { uid: req.user.uid, ...userDoc.data() },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
    });
  }
};

// Get user's statistics
export const getUserStats = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const complaintsRef = db.collection('complaints');

    // Get user's complaints
    const userComplaints = await complaintsRef.where('userId', '==', req.user.uid).get();

    let totalComplaints = 0;
    let pendingComplaints = 0;
    let inProgressComplaints = 0;
    let resolvedComplaints = 0;
    let rejectedComplaints = 0;
    let totalVotes = 0;
    let totalViews = 0;

    userComplaints.forEach((doc) => {
      const data = doc.data();
      totalComplaints++;
      totalVotes += data.votes || 0;
      totalViews += data.views || 0;

      switch (data.status) {
        case 'PENDING REVIEW':
        case 'UNDER REVIEW':
          pendingComplaints++;
          break;
        case 'IN PROGRESS':
          inProgressComplaints++;
          break;
        case 'RESOLVED':
          resolvedComplaints++;
          break;
        case 'REJECTED':
          rejectedComplaints++;
          break;
      }
    });

    res.json({
      success: true,
      data: {
        totalComplaints,
        pendingComplaints,
        inProgressComplaints,
        resolvedComplaints,
        rejectedComplaints,
        totalVotes,
        totalViews,
        resolutionRate: totalComplaints > 0 
          ? Math.round((resolvedComplaints / totalComplaints) * 100) 
          : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user statistics',
    });
  }
};

// Get public profile of another user
export const getPublicProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const userDoc = await usersCollection.doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const userData = userDoc.data() as UserProfile;

    // Return only public information
    const publicProfile = {
      uid: userData.uid,
      displayName: userData.displayName,
      photoURL: userData.photoURL,
      bio: userData.bio,
      totalComplaints: userData.totalComplaints,
      resolvedComplaints: userData.resolvedComplaints,
      totalVotesReceived: userData.totalVotesReceived,
      createdAt: userData.createdAt,
    };

    res.json({
      success: true,
      data: publicProfile,
    });
  } catch (error) {
    console.error('Error fetching public profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
    });
  }
};

// Delete user account and all associated data
export const deleteAccount = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Delete user's complaints
    const complaintsRef = db.collection('complaints');
    const userComplaints = await complaintsRef.where('userId', '==', req.user.uid).get();

    const batch = db.batch();

    userComplaints.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete user profile
    batch.delete(usersCollection.doc(req.user.uid));

    await batch.commit();

    res.json({
      success: true,
      message: 'Account and all associated data deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account',
    });
  }
};

// Upload profile photo
export const uploadProfilePhoto = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided. Please select an image to upload.',
      });
    }

    console.log('Uploading profile photo for user:', req.user.uid);
    console.log('File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // Upload the image
    const photoURL = await uploadProfileImage(req.file, req.user.uid);

    console.log('Photo uploaded successfully:', photoURL);

    // Update user profile with new photo URL
    const userRef = usersCollection.doc(req.user.uid);
    await userRef.update({
      photoURL,
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      data: { photoURL },
      message: 'Profile photo uploaded successfully',
    });
  } catch (error: any) {
    console.error('Error uploading profile photo:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload profile photo',
    });
  }
};

// Get notification settings
export const getNotificationSettings = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const userDoc = await usersCollection.doc(req.user.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const userData = userDoc.data();
    const notificationSettings = userData?.notificationSettings || {
      complaintUpdates: true,
      voteNotifications: true,
      weeklyDigest: false,
    };

    res.json({
      success: true,
      data: notificationSettings,
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification settings',
    });
  }
};

// Update notification settings
export const updateNotificationSettings = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { complaintUpdates, voteNotifications, weeklyDigest } = req.body;

    const userRef = usersCollection.doc(req.user.uid);

    const notificationSettings = {
      complaintUpdates: complaintUpdates ?? true,
      voteNotifications: voteNotifications ?? true,
      weeklyDigest: weeklyDigest ?? false,
    };

    await userRef.update({
      notificationSettings,
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      data: notificationSettings,
      message: 'Notification settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification settings',
    });
  }
};

// Change password (handled by Firebase Auth, this is just validation)
export const changePassword = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Password changes are handled by Firebase Auth on the client side
    // This endpoint can be used to log the password change event
    res.json({
      success: true,
      message: 'Password change request processed. Please complete the change through Firebase Auth.',
    });
  } catch (error) {
    console.error('Error processing password change:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password change request',
    });
  }
};
