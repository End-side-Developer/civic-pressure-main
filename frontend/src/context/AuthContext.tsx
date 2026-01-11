import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../config/firebase';
import { usersAPI } from '../services/api';
                     
interface UserProfile {
  displayName: string;
  email: string;
  photoURL: string | null;
  phone?: string;
  bio?: string;
  address?: string;
  createdAt?: string;
}

interface UserStats {
  totalComplaints: number;
  resolvedComplaints: number;
  pendingComplaints: number;
  totalVotes: number;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  userStats: UserStats | null;
  loading: boolean;
  isConfigured: boolean;
  pendingLinkEmail: string | null;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  linkPasswordToCurrentUser: (password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  refreshUserStats: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingLinkEmail, setPendingLinkEmail] = useState<string | null>(null);

  // Store for pending email/password credential to link after Google sign-in
  const [pendingCredential, setPendingCredential] = useState<{
  email: string;
  password: string;
} | null>(null);

  // Fetch user profile from backend
  const fetchUserProfile = async () => {
    try {
      const response = await usersAPI.getProfile();
      setUserProfile(response.data || response.profile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  // Fetch user stats from backend
  const fetchUserStats = async () => {
    try {
      const response = await usersAPI.getStats();
      setUserStats(response.data || response.stats || response);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  // Sync user to backend (creates or updates profile)
  const syncUserToBackend = async (user: User) => {
    try {
      await usersAPI.updateProfile({
        displayName: user.displayName || undefined,
        photoURL: user.photoURL || undefined,
      });
      await fetchUserProfile();
      await fetchUserStats();
    } catch (error) {
      console.error('Error syncing user to backend:', error);
    }
  };

  const signup = async (email: string, password: string, displayName: string) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase is not configured. Please add your Firebase credentials to the .env file.');
    }
    try {
      // First check if email exists with Google provider
      const methods = await fetchSignInMethodsForEmail(auth, email);
      
      if (methods.includes('google.com') && !methods.includes('password')) {
        // User has Google account but no password - store credentials and prompt for Google sign-in
        setPendingCredential({ email, password });
        setPendingLinkEmail(email);
        throw new Error('LINK_WITH_GOOGLE:This email is already registered with Google. Please click "Continue with Google" to sign in and link your password.');
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
        await syncUserToBackend(userCredential.user);
      }
    } catch (error: any) {
      if (error.message?.startsWith('LINK_WITH_GOOGLE:')) {
        throw error;
      }
      
      let errorMessage = 'Failed to create account';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          // Check what providers exist
          try {
            const methods = await fetchSignInMethodsForEmail(auth, email);
            if (methods.includes('google.com')) {
              setPendingCredential({ email, password });
              setPendingLinkEmail(email);
              errorMessage = 'LINK_WITH_GOOGLE:This email is registered with Google. Click "Continue with Google" to sign in and link your password.';
            } else {
              errorMessage = 'Email address is already in use. Try signing in instead.';
            }
          } catch {
            errorMessage = 'Email address is already in use';
          }
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Use at least 6 characters';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Email/password sign-up is not enabled. Please contact support';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection';
          break;
        default:
          errorMessage = error.message || 'Failed to create account';
      }
      
      throw new Error(errorMessage);
    }
  };

  const login = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase is not configured. Please add your Firebase credentials to the .env file.');
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await syncUserToBackend(userCredential.user);
      // Clear any pending credentials on successful login
      setPendingCredential({ email, password });
      setPendingLinkEmail(null);
    } catch (error: any) {
      let errorMessage = 'Failed to sign in';
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        try {
          const methods = await fetchSignInMethodsForEmail(auth, email);
          if (!methods.includes('password') && methods.includes('google.com')) {
            if (methods.includes('google.com')) {
              // Store credentials for linking after Google sign-in
              setPendingCredential({ email, password });
              setPendingLinkEmail(email);
              errorMessage = 'LINK_WITH_GOOGLE:This email uses Google Sign-In. Click "Continue with Google" to sign in and link your password for future use.';
            } else {
              errorMessage = `This email uses a different sign-in method: ${methods.join(', ')}`;
            }
          } else {
            errorMessage = 'Invalid email or password';
          }
        } catch {
          errorMessage = 'Invalid email or password';
        }
      } else {
        switch (error.code) {
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This account has been disabled';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many failed attempts. Please try again later';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your connection';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/password sign-in is not enabled. Please contact support';
            break;
          default:
            errorMessage = error.message || 'Failed to sign in';
        }
      }
      
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase is not configured.');
    }
    await signOut(auth);
    setUserProfile(null);
    setUserStats(null);
    setPendingCredential(null);
    setPendingLinkEmail(null);
  };

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase is not configured. Please add your Firebase credentials to the .env file.');
    }
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      const result = await signInWithPopup(auth, provider);
      await result.user.reload();
      
      // If there was a pending email/password credential, link it to this Google account
      if (pendingCredential && result.user.email === pendingCredential.email) {
        try {
          const credential = EmailAuthProvider.credential(
            pendingCredential.email,
            pendingCredential.password
          );
          await linkWithCredential(result.user, credential);
          console.log('âœ… Successfully linked email/password to Google account! You can now use either method to sign in.');
        } catch (linkError: any) {
          if (linkError.code === 'auth/provider-already-linked') {
            console.log('Email/password already linked to this account');
          } else if (linkError.code === 'auth/credential-already-in-use') {
            console.log('These credentials are already in use by another account');
          } else {
            console.error('Could not link credentials:', linkError.code, linkError.message);
          }
        }
        setPendingCredential(null);
        setPendingLinkEmail(null);
      }
      
      // Sync to backend after Google sign-in
      await syncUserToBackend(result.user);
    } catch (error: any) {
      let errorMessage = 'Failed to sign in with Google';
      
      switch (error.code) {
        case 'auth/account-exists-with-different-credential':
          errorMessage = 'An account already exists with this email using email/password. Please sign in with email/password first.';
          break;
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in was cancelled';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Pop-up was blocked. Please allow pop-ups and try again';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection';
          break;
        default:
          errorMessage = error.message || 'Failed to sign in with Google';
      }
      
      throw new Error(errorMessage);
    }
  };

  // Function to reset password
  const resetPassword = async (email: string) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase is not configured. Please add your Firebase credentials to the .env file.');
    }
    try {
      // Action code settings to improve email deliverability and user experience
      const actionCodeSettings = {
        url: window.location.origin + '/login', // Redirect to login page after password reset
        handleCodeInApp: false,
      };
      
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
    } catch (error: any) {
      let errorMessage = 'Failed to send reset email';
      
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many requests. Please try again later';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection';
          break;
        default:
          errorMessage = error.message || 'Failed to send reset email';
      }
      
      throw new Error(errorMessage);
    }
  };

  // Function to link password to current Google user
  const linkPasswordToCurrentUser = async (password: string) => {
    if (!auth?.currentUser || !auth.currentUser.email) {
      throw new Error('No user is currently signed in');
    }
    
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
      await linkWithCredential(auth.currentUser, credential);
      console.log('âœ… Password linked successfully! You can now use either Google or email/password to sign in.');
    } catch (error: any) {
      let errorMessage = 'Failed to link password';
      
      switch (error.code) {
        case 'auth/provider-already-linked':
          errorMessage = 'Password is already linked to this account';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Use at least 6 characters';
          break;
        case 'auth/requires-recent-login':
          errorMessage = 'Please sign out and sign in again before linking a password';
          break;
        default:
          errorMessage = error.message || 'Failed to link password';
      }
      
      throw new Error(errorMessage);
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    try {
      const profileData: {
        displayName?: string;
        phone?: string;
        bio?: string;
        address?: string;
        photoURL?: string;
      } = {};
      
      // Only include fields that are provided and handle null values
      if (data.displayName !== undefined) profileData.displayName = data.displayName;
      if (data.phone !== undefined) profileData.phone = data.phone;
      if (data.bio !== undefined) profileData.bio = data.bio;
      if (data.address !== undefined) profileData.address = data.address;
      if (data.photoURL !== undefined && data.photoURL !== null) profileData.photoURL = data.photoURL;
      
      // Call the API to update profile in backend
      await usersAPI.updateProfile(profileData);
      
      // Refresh the profile to get updated data from backend
      await fetchUserProfile();
      
      // If photoURL was updated, also update Firebase Auth user profile
      if (data.photoURL && auth?.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: data.photoURL });
        // Force refresh the current user
        await auth.currentUser.reload();
        setCurrentUser({ ...auth.currentUser });
      }
      
      // If displayName was updated, also update Firebase Auth user profile
      if (data.displayName && auth?.currentUser) {
        await updateProfile(auth.currentUser, { displayName: data.displayName });
        await auth.currentUser.reload();
        setCurrentUser({ ...auth.currentUser });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const refreshUserProfile = async () => {
    await fetchUserProfile();
  };

  const refreshUserStats = async () => {
    await fetchUserStats();
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile();
        await fetchUserStats();
      } else {
        setUserProfile(null);
        setUserStats(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    userProfile,
    userStats,
    loading,
    isConfigured: isFirebaseConfigured,
    pendingLinkEmail,
    signup,
    login,
    logout,
    signInWithGoogle,
    linkPasswordToCurrentUser,
    resetPassword,
    updateUserProfile,
    refreshUserProfile,
    refreshUserStats,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
