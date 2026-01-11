import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  LogOut,
  Edit3,
  Calendar,
  MessageSquare,
  Share2,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  X,
  Check,
  ThumbsUp,
  Trash2,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import { useComplaints, Complaint } from '../../context/ComplaintsContext';
import { useAuth } from '../../context/AuthContext';
import { usersAPI } from '../../services/api';

// Helper function to check if URL is a valid displayable image
const isDisplayableImage = (url: string): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  // Check if it's a PDF or other non-image file
  if (lowerUrl.includes('.pdf') || lowerUrl.includes('application/pdf')) return false;
  // Check for common image extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  return imageExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('image/');
};

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { userComplaints, votedComplaints, fetchUserComplaints, fetchVotedComplaints } = useComplaints();
  const { currentUser, userProfile, userStats, logout, updateUserProfile, refreshUserProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('my-complaints');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [votedCurrentPage, setVotedCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [isLoadingComplaints, setIsLoadingComplaints] = useState(true);
  const [profileErrors, setProfileErrors] = useState<{ name?: string }>({});

  // Helper function to format dates
  const formatDate = (dateStr: any): string => {
    try {
      // Handle Firebase Timestamp objects
      if (dateStr && typeof dateStr === 'object' && '_seconds' in dateStr) {
        const date = new Date(dateStr._seconds * 1000);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      // Handle regular date strings
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Unknown date';
    }
  };

  // Redirect to login if not authenticated and fetch data
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    setIsLoadingComplaints(true);
    
    // Fetch all data in parallel for better performance
    Promise.all([
      fetchUserComplaints({ limit: 100 }),
      fetchVotedComplaints({ limit: 100 })
    ]).finally(() => {
      setIsLoadingComplaints(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, navigate]);

  // Modal states
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareComplaint, setShareComplaint] = useState<Complaint | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Edit profile form state - initialize with real user data
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
  });

  // Update profile data when user profile loads
  useEffect(() => {
    if (currentUser || userProfile) {
      setProfileData({
        name: userProfile?.displayName || currentUser?.displayName || '',
        email: userProfile?.email || currentUser?.email || '',
        phone: userProfile?.phone || '',
        bio: userProfile?.bio || '',
      });
    }
  }, [currentUser, userProfile]);

  // Filter complaints based on search - ONLY use userComplaints for user's own complaints
  const filteredComplaints = useMemo(() => {
    // Only show user's own complaints - never fallback to all complaints
    return userComplaints.filter(
      (complaint) =>
        complaint.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        complaint.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        complaint.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, userComplaints]);

  // Pagination
  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage);
  const paginatedComplaints = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredComplaints.slice(start, start + itemsPerPage);
  }, [filteredComplaints, currentPage]);

  // Filter and paginate voted complaints
  const filteredVotedComplaints = useMemo(() => {
    return votedComplaints.filter(
      (complaint) =>
        complaint.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        complaint.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        complaint.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, votedComplaints]);

  const votedTotalPages = Math.ceil(filteredVotedComplaints.length / itemsPerPage);
  const paginatedVotedComplaints = useMemo(() => {
    const start = (votedCurrentPage - 1) * itemsPerPage;
    return filteredVotedComplaints.slice(start, start + itemsPerPage);
  }, [filteredVotedComplaints, votedCurrentPage]);

  // Handle share
  const handleShare = (complaint: Complaint) => {
    setShareComplaint(complaint);
    setShowShareModal(true);
    setCopiedLink(false);
  };

  const copyToClipboard = () => {
    const url = `${window.location.origin}/complaint/${shareComplaint?.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Validate profile data
  const validateProfile = (): boolean => {
    const errors: { name?: string } = {};
    
    if (!profileData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Format phone number with Indian country code
  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If it starts with +91, keep it
    if (cleaned.startsWith('+91')) {
      return cleaned;
    }
    
    // If it starts with 91, add +
    if (cleaned.startsWith('91') && cleaned.length > 10) {
      return '+' + cleaned;
    }
    
    // If it's just digits (10 digit Indian number), add +91
    if (cleaned.length === 10 && !cleaned.startsWith('+')) {
      return '+91' + cleaned;
    }
    
    return cleaned;
  };

  // Handle phone input change
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // If the field is empty or user is starting fresh, add +91 prefix
    if (!value || value === '+') {
      value = '+91';
    }
    
    // Ensure +91 prefix is maintained
    if (!value.startsWith('+91')) {
      // If user tries to delete the prefix, restore it
      if (value.startsWith('+9')) {
        value = '+91';
      } else if (value.startsWith('+')) {
        value = '+91' + value.slice(1).replace(/^91/, '');
      } else if (value.startsWith('91')) {
        value = '+' + value;
      } else {
        value = '+91' + value.replace(/^\+/, '');
      }
    }
    
    // Limit to +91 plus 10 digits
    if (value.length > 13) {
      value = value.slice(0, 13);
    }
    
    setProfileData({ ...profileData, phone: value });
  };

  // Handle save profile
  const handleSaveProfile = async () => {
    // Validate required fields
    if (!validateProfile()) {
      return;
    }

    setIsSavingProfile(true);
    try {
      // Format phone number before saving
      const formattedPhone = profileData.phone ? formatPhoneNumber(profileData.phone) : '';
      
      // Build the update payload
      const updatePayload: {
        displayName: string;
        phone: string;
        bio: string;
      } = {
        displayName: profileData.name.trim(),
        phone: formattedPhone,
        bio: profileData.bio.trim(),
      };

      await updateUserProfile(updatePayload);
      await refreshUserProfile();
      
      setShowEditProfileModal(false);
      setProfileErrors({});
    } catch (error: any) {
      console.error('Error saving profile:', error);
      alert(`Failed to save profile: ${error.message || 'Please try again.'}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle delete account
  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await usersAPI.deleteAccount();
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteAccountModal(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'INFRASTRUCTURE':
        return 'bg-orange-100 text-orange-700';
      case 'PUBLIC SAFETY':
        return 'bg-blue-100 text-blue-700';
      case 'SANITATION':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
            <Clock className="w-3 h-3" />
            PENDING REVIEW
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
            <CheckCircle className="w-3 h-3" />
            RESOLVED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
            <XCircle className="w-3 h-3" />
            REJECTED
          </span>
        );
      default:
        return null;
    }
  };

  const getVoteIcon = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case 'REJECTED':
        return <XCircle className="w-5 h-5 text-gray-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      {/* Header */}
      <div className="container mx-auto px-3 xs:px-4 md:px-6 pt-3 xs:pt-4 md:pt-8 pb-2 md:pb-4">
        <h1 className="text-xl xs:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>
        <p className="text-xs xs:text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">Manage your complaints and voting history</p>
      </div>

      <div className="container mx-auto px-3 xs:px-4 md:px-6 py-3 xs:py-4 md:py-8">
        <div className="flex flex-col lg:flex-row gap-3 xs:gap-4 md:gap-6 lg:gap-8">
          {/* Left Sidebar */}
          <div className="w-full lg:w-72 lg:flex-shrink-0">
            {/* Profile Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-3 xs:p-4 md:p-6">
              {/* Avatar */}
              <div className="flex justify-center mb-3 md:mb-4">
                <div className="relative">
                  {(userProfile?.photoURL || currentUser?.photoURL) ? (
                    <img
                      src={userProfile?.photoURL || currentUser?.photoURL || ''}
                      alt="Profile"
                      className="w-16 h-16 xs:w-20 xs:h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 xs:w-20 xs:h-20 md:w-24 md:h-24 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl xs:text-2xl md:text-3xl font-bold border-4 border-white shadow-lg">
                      {(profileData.name || currentUser?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* User Info */}
              <div className="text-center mb-3 md:mb-4">
                <h2 className="text-base xs:text-lg md:text-xl font-semibold text-gray-900 dark:text-white truncate px-2">
                  {profileData.name || currentUser?.displayName || 'User'}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-[10px] xs:text-xs md:text-sm truncate px-2">
                  {profileData.email || currentUser?.email}
                </p>
                <div className="flex items-center justify-center gap-1 mt-2 text-blue-600 text-[10px] xs:text-xs md:text-sm">
                  <span>⭐</span>
                  <span>MEMBER SINCE {currentUser?.metadata?.creationTime 
                    ? new Date(currentUser.metadata.creationTime).getFullYear() 
                    : new Date().getFullYear()}</span>
                </div>
              </div>

              {/* Edit Profile Button */}
              <button
                onClick={() => setShowEditProfileModal(true)}
                className="w-full py-2 px-3 xs:px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-xs xs:text-sm md:text-base text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit Profile
              </button>
            </div>

            {/* Stats Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 mt-4">
              <div className="flex justify-around">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-blue-600">
                    {userStats?.totalComplaints || filteredComplaints.length || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Complaints</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Submitted</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-500">
                    {userStats?.resolvedComplaints || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Solved</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Complaints</div>
                </div>
              </div>
            </div>

            {/* Account Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 mt-4">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 sm:mb-4">
                Account
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/notifications')}
                  className="w-full flex items-center gap-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg transition"
                >
                  <Bell className="w-5 h-5" />
                  <span>Notifications</span>
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <div className="flex min-w-max sm:min-w-0">
                  <button
                    onClick={() => setActiveTab('my-complaints')}
                    className={`px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium flex items-center gap-1.5 sm:gap-2 border-b-2 transition whitespace-nowrap ${
                      activeTab === 'my-complaints'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <span className="text-base sm:text-lg">📄</span>
                    <span className="hidden xs:inline">My Complaints</span>
                    <span className="xs:hidden">My</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('voted-complaints')}
                    className={`px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium flex items-center gap-1.5 sm:gap-2 border-b-2 transition whitespace-nowrap ${
                      activeTab === 'voted-complaints'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <span className="text-base sm:text-lg">👥</span>
                    <span className="hidden xs:inline">Voted Complaints</span>
                    <span className="xs:hidden">Voted</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium flex items-center gap-1.5 sm:gap-2 border-b-2 transition whitespace-nowrap ${
                      activeTab === 'settings'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <span className="text-base sm:text-lg">⚙️</span>
                    <span className="hidden xs:inline">Settings</span>
                    <span className="xs:hidden">Set</span>
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-4 sm:p-6">
                {activeTab === 'my-complaints' && (
                  <>
                    {/* Header with Search and New Complaint */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Recent Submissions</h3>
                      <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 sm:gap-3">
                        <div className="relative flex-1 xs:flex-initial">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full xs:w-48 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <Link
                          to="/complaint"
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm sm:text-base font-medium hover:bg-blue-700 transition"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="hidden xs:inline\">New Complaint</span>
                          <span className="xs:hidden\">New</span>
                        </Link>
                      </div>
                    </div>

                    {/* Complaints List */}
                    <div className="space-y-4">
                      {isLoadingComplaints ? (
                        <div className="flex justify-center items-center py-12">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                      ) : paginatedComplaints.length > 0 ? (
                        paginatedComplaints.map((complaint) => (
                          <div
                            key={complaint.id}
                            onClick={() => navigate(`/profile/complaint/${complaint.id}`)}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition cursor-pointer bg-white dark:bg-gray-800"
                          >
                            <div className="flex gap-4">
                              {/* Image */}
                              {complaint.images && complaint.images.length > 0 && complaint.images[0] && isDisplayableImage(complaint.images[0]) ? (
                                <img
                                  src={complaint.images[0]}
                                  alt={complaint.title}
                                  className="w-32 h-24 object-cover rounded-lg flex-shrink-0"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.parentElement?.classList.add('image-error');
                                  }}
                                />
                              ) : complaint.images && complaint.images.length > 0 && complaint.images[0] ? (
                                <div className="w-32 h-24 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0 flex items-center justify-center">
                                  <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                </div>
                              ) : (
                                <div className="w-32 h-24 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0 flex items-center justify-center">
                                  <ImageIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                </div>
                              )}

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                {/* Tags */}
                                <div className="flex items-center gap-2 mb-2">
                                  <span
                                    className={`px-2 py-1 text-xs font-medium rounded ${getCategoryColor(
                                      complaint.category
                                    )}`}
                                  >
                                    {complaint.category}
                                  </span>
                                  {getStatusBadge(complaint.status)}
                                </div>

                                {/* Title */}
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                  {complaint.title}
                                </h4>

                                {/* Description */}
                                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                                  {complaint.description}
                                </p>

                                {/* Footer */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-4 h-4" />
                                      Submitted {formatDate(complaint.submittedDate)}
                                    </span>
                                    {complaint.comments > 0 && (
                                      <span className="flex items-center gap-1">
                                        <MessageSquare className="w-4 h-4" />
                                        {complaint.comments} Comments
                                      </span>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleShare(complaint);
                                      }}
                                      className="flex items-center gap-1 hover:text-blue-600 transition"
                                    >
                                      <Share2 className="w-4 h-4" />
                                      Share
                                    </button>
                                  </div>
                                  {complaint.rejectionReason && (
                                    <span className="text-red-500 text-sm flex items-center gap-1">
                                      <XCircle className="w-4 h-4" />
                                      {complaint.rejectionReason}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Vote Count */}
                              <div className="flex flex-col items-center justify-center px-4">
                                {getVoteIcon(complaint.status)}
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                  {complaint.votes}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Votes</span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-gray-500 dark:text-gray-400">No complaints posted till now.</p>
                        </div>
                      )}
                    </div>

                    {/* Pagination */}
                    {filteredComplaints.length > 0 && (
                      <div className="flex justify-center items-center gap-2 mt-6">
                        <button
                          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4 dark:text-gray-400" />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-10 h-10 rounded-lg font-medium transition ${
                              currentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4 dark:text-gray-400" />
                        </button>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'voted-complaints' && (
                  <>
                    {/* Header */}
                    <div className="flex flex-col xs:flex-row items-stretch xs:items-center justify-between gap-3 mb-4 xs:mb-6">
                      <h3 className="text-base xs:text-lg font-semibold text-gray-900 dark:text-white">Complaints You've Voted For</h3>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full xs:w-48 pl-10 pr-4 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Voted Complaints List */}
                    <div className="space-y-4">
                      {isLoadingComplaints ? (
                        <div className="flex justify-center items-center py-12">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                      ) : paginatedVotedComplaints.length > 0 ? (
                        paginatedVotedComplaints.map((complaint) => (
                            <div
                              key={complaint.id}
                              onClick={() => navigate(`/complaint/${complaint.id}`)}
                              className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 xs:p-4 hover:shadow-md active:bg-gray-50 dark:active:bg-gray-700 transition cursor-pointer bg-white dark:bg-gray-800"
                            >
                              <div className="flex flex-col xs:flex-row gap-3 xs:gap-4">
                                {/* Image */}
                                {complaint.images && complaint.images.length > 0 && complaint.images[0] && isDisplayableImage(complaint.images[0]) ? (
                                  <img
                                    src={complaint.images[0]}
                                    alt={complaint.title}
                                    className="w-full xs:w-24 h-32 xs:h-20 object-cover rounded-lg flex-shrink-0"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      target.parentElement?.classList.add('image-error');
                                    }}
                                  />
                                ) : complaint.images && complaint.images.length > 0 && complaint.images[0] ? (
                                  <div className="w-full xs:w-24 h-32 xs:h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0 flex items-center justify-center">
                                    <FileText className="w-8 h-8 xs:w-6 xs:h-6 text-gray-400 dark:text-gray-500" />
                                  </div>
                                ) : (
                                  <div className="w-full xs:w-24 h-32 xs:h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0 flex items-center justify-center">
                                    <ImageIcon className="w-8 h-8 xs:w-6 xs:h-6 text-gray-400 dark:text-gray-500" />
                                  </div>
                                )}

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  {/* Tags */}
                                  <div className="flex flex-wrap items-center gap-1.5 xs:gap-2 mb-2">
                                    <span
                                      className={`px-2 py-0.5 xs:py-1 text-[10px] xs:text-xs font-medium rounded ${getCategoryColor(
                                        complaint.category
                                      )}`}
                                    >
                                      {complaint.category}
                                    </span>
                                    {getStatusBadge(complaint.status)}
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 xs:py-1 bg-blue-100 text-blue-700 text-[10px] xs:text-xs font-medium rounded">
                                      <ThumbsUp className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
                                      Voted
                                    </span>
                                  </div>

                                  {/* Title */}
                                  <h4 className="text-sm xs:text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1">
                                    {complaint.title}
                                  </h4>

                                  {/* Description */}
                                  <p className="text-xs xs:text-sm text-gray-600 dark:text-gray-400 mb-2 xs:mb-3 line-clamp-2">
                                    {complaint.description}
                                  </p>

                                  {/* Footer */}
                                  <div className="flex flex-wrap items-center gap-2 xs:gap-4 text-xs xs:text-sm text-gray-500 dark:text-gray-400">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3.5 h-3.5 xs:w-4 xs:h-4 flex-shrink-0" />
                                      <span className="hidden xs:inline">{formatDate(complaint.submittedDate)}</span>
                                      <span className="xs:hidden">{new Date(complaint.submittedDate).toLocaleDateString()}</span>
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleShare(complaint);
                                      }}
                                      className="flex items-center gap-1 hover:text-blue-600 active:scale-95 transition p-1 -m-1"
                                    >
                                      <Share2 className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
                                      <span className="hidden xs:inline">Share</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Vote Count */}
                                <div className="flex xs:flex-col items-center justify-between xs:justify-center px-3 xs:px-4 py-2 xs:py-0 border-t xs:border-t-0 xs:border-l border-gray-100 dark:border-gray-700 mt-2 xs:mt-0 -mx-3 xs:mx-0 -mb-3 xs:mb-0 bg-gray-50 xs:bg-transparent dark:bg-gray-700/50 xs:dark:bg-transparent rounded-b-lg xs:rounded-none">
                                  <div className="flex xs:flex-col items-center gap-2 xs:gap-0">
                                    <ThumbsUp className="w-4 h-4 xs:w-5 xs:h-5 text-blue-500" />
                                    <span className="text-lg xs:text-2xl font-bold text-gray-900 dark:text-white">
                                      {complaint.votes}
                                    </span>
                                  </div>
                                  <span className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400">Votes</span>
                                </div>
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="text-center py-8 xs:py-12">
                          <ThumbsUp className="w-10 h-10 xs:w-12 xs:h-12 text-gray-300 mx-auto mb-3 xs:mb-4" />
                          <p className="text-sm xs:text-base text-gray-500 dark:text-gray-400">You haven't voted for any complaints yet.</p>
                          <Link
                            to="/home"
                            className="inline-flex items-center gap-2 mt-3 xs:mt-4 px-4 py-2.5 min-h-[44px] bg-blue-600 text-white rounded-lg text-sm xs:text-base font-medium hover:bg-blue-700 active:scale-95 transition"
                          >
                            Browse Complaints
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Pagination */}
                    {filteredVotedComplaints.length > 0 && (
                      <div className="flex justify-center items-center gap-2 mt-6">
                        <button
                          onClick={() => setVotedCurrentPage((prev) => Math.max(prev - 1, 1))}
                          disabled={votedCurrentPage === 1}
                          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4 dark:text-gray-400" />
                        </button>
                        {Array.from({ length: votedTotalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => setVotedCurrentPage(page)}
                            className={`w-10 h-10 rounded-lg font-medium transition ${
                              votedCurrentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => setVotedCurrentPage((prev) => Math.min(prev + 1, votedTotalPages))}
                          disabled={votedCurrentPage === votedTotalPages}
                          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4 dark:text-gray-400" />
                        </button>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'settings' && (
                  <div className="space-y-4 xs:space-y-6">
                    <h3 className="text-base xs:text-lg font-semibold text-gray-900 dark:text-white">Account Settings</h3>
                    
                    {/* Profile Settings */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 xs:p-4">
                      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm xs:text-base font-medium text-gray-900 dark:text-white">Profile Information</h4>
                          <p className="text-xs xs:text-sm text-gray-500 dark:text-gray-400">Update your name, email and profile picture</p>
                        </div>
                        <button
                          onClick={() => setShowEditProfileModal(true)}
                          className="px-4 py-2.5 min-h-[44px] text-sm xs:text-base text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg active:scale-95 transition font-medium"
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    {/* Notification Settings */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 xs:p-4">
                      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm xs:text-base font-medium text-gray-900 dark:text-white">Notifications</h4>
                          <p className="text-xs xs:text-sm text-gray-500 dark:text-gray-400">Manage your notification preferences</p>
                        </div>
                        <button
                          onClick={() => navigate('/notifications')}
                          className="px-4 py-2.5 min-h-[44px] text-sm xs:text-base text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg active:scale-95 transition font-medium"
                        >
                          Manage
                        </button>
                      </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="border border-red-200 dark:border-red-800 rounded-lg p-3 xs:p-4 bg-red-50 dark:bg-red-900/20">
                      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm xs:text-base font-medium text-red-700 dark:text-red-400">Delete Account</h4>
                          <p className="text-xs xs:text-sm text-red-500 dark:text-red-400">Permanently delete your account and all data</p>
                        </div>
                        <button 
                          onClick={() => setShowDeleteAccountModal(true)}
                          className="px-4 py-2.5 min-h-[44px] text-sm xs:text-base text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg active:scale-95 transition font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CTA Banner - Hidden on phone view */}
            <div className="hidden md:flex bg-indigo-50 dark:bg-gray-800 rounded-xl p-6 mt-6 items-center justify-between border border-indigo-100 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Have something to report?</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Your voice matters. Submit a new complaint today.
                </p>
              </div>
              <Link
                to="/complaint"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition whitespace-nowrap"
              >
                Submit Complaint
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 xs:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-3 xs:p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg xs:text-xl font-semibold text-gray-900 dark:text-white">Edit Profile</h2>
              <button
                onClick={() => {
                  setShowEditProfileModal(false);
                }}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg active:scale-95 transition"
              >
                <X className="w-5 h-5 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4 xs:p-6 space-y-3 xs:space-y-4">
              {/* Profile Picture */}
              <div className="flex justify-center">
                <div className="relative">
                  {(userProfile?.photoURL || currentUser?.photoURL) ? (
                    <img
                      src={userProfile?.photoURL || currentUser?.photoURL || ''}
                      alt="Profile"
                      className="w-20 h-20 xs:w-24 xs:h-24 rounded-full object-cover border-4 border-gray-100"
                    />
                  ) : (
                    <div className="w-20 h-20 xs:w-24 xs:h-24 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl xs:text-3xl font-bold border-4 border-gray-100">
                      {(profileData.name || currentUser?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div>
                <label className="block text-xs xs:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => {
                    setProfileData({ ...profileData, name: e.target.value });
                    if (profileErrors.name) {
                      setProfileErrors({ ...profileErrors, name: undefined });
                    }
                  }}
                  className={`w-full px-3 xs:px-4 py-2.5 min-h-[44px] border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-sm xs:text-base text-gray-900 dark:text-white ${
                    profileErrors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Enter your full name"
                />
                {profileErrors.name && (
                  <p className="text-[10px] xs:text-xs text-red-500 mt-1">{profileErrors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-xs xs:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  disabled
                  className="w-full px-3 xs:px-4 py-2.5 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-sm xs:text-base text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
                <p className="text-[10px] xs:text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="block text-xs xs:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={profileData.phone || '+91'}
                    onChange={handlePhoneChange}
                    onFocus={(e) => {
                      if (!e.target.value) {
                        setProfileData({ ...profileData, phone: '+91' });
                      }
                    }}
                    placeholder="+91 XXXXXXXXXX"
                    maxLength={13}
                    className="w-full px-3 xs:px-4 py-2.5 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-sm xs:text-base text-gray-900 dark:text-white"
                  />
                </div>
                <p className="text-[10px] xs:text-xs text-gray-500 mt-1">Indian phone number with country code (+91)</p>
              </div>
              <div>
                <label className="block text-xs xs:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
                <textarea
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  rows={3}
                  className="w-full px-3 xs:px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-sm xs:text-base text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse xs:flex-row gap-2 xs:gap-3 p-3 xs:p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowEditProfileModal(false);
                  setProfileErrors({});
                  // Reset profile data to current values
                  setProfileData({
                    name: userProfile?.displayName || currentUser?.displayName || '',
                    email: userProfile?.email || currentUser?.email || '',
                    phone: userProfile?.phone || '',
                    bio: userProfile?.bio || '',
                  });
                }}
                className="flex-1 px-4 py-2.5 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg text-sm xs:text-base text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile || !profileData.name.trim()}
                className="flex-1 px-4 py-2.5 min-h-[44px] bg-blue-600 text-white rounded-lg text-sm xs:text-base hover:bg-blue-700 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSavingProfile ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 xs:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="flex items-center justify-between p-3 xs:p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg xs:text-xl font-semibold text-red-600 dark:text-red-400">Delete Account</h2>
              <button
                onClick={() => setShowDeleteAccountModal(false)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg active:scale-95 transition"
              >
                <X className="w-5 h-5 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4 xs:p-6">
              <div className="flex items-center justify-center mb-3 xs:mb-4">
                <div className="w-14 h-14 xs:w-16 xs:h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <Trash2 className="w-7 h-7 xs:w-8 xs:h-8 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <p className="text-center text-sm xs:text-base text-gray-600 dark:text-gray-400 mb-1.5 xs:mb-2">
                Are you sure you want to delete your account?
              </p>
              <p className="text-center text-xs xs:text-sm text-gray-500 dark:text-gray-500 mb-3 xs:mb-4">
                This action cannot be undone. All your complaints, votes, and data will be permanently removed.
              </p>
            </div>
            <div className="flex flex-col-reverse xs:flex-row gap-2 xs:gap-3 p-3 xs:p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowDeleteAccountModal(false)}
                className="flex-1 px-4 py-2.5 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg text-sm xs:text-base text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="flex-1 px-4 py-2.5 min-h-[44px] bg-red-600 text-white rounded-lg text-sm xs:text-base hover:bg-red-700 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingAccount ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Account'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && shareComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 xs:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="flex items-center justify-between p-3 xs:p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg xs:text-xl font-semibold text-gray-900 dark:text-white">Share Complaint</h2>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg active:scale-95 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 xs:p-6 space-y-3 xs:space-y-4">
              <p className="text-xs xs:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{shareComplaint.title}</p>
              
              {/* Share Link */}
              <div className="flex flex-col xs:flex-row gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/complaint/${shareComplaint.id}`}
                  className="flex-1 px-3 xs:px-4 py-2.5 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-xs xs:text-sm text-gray-600 dark:text-gray-300"
                />
                <button
                  onClick={copyToClipboard}
                  className={`px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium active:scale-95 transition ${
                    copiedLink
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copiedLink ? (
                    <span className="flex items-center gap-1">
                      <Check className="w-4 h-4" /> Copied
                    </span>
                  ) : (
                    'Copy'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
