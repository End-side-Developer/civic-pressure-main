import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ThumbsUp,
  Flag,
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  Send,
  MessageSquare,
  Share2,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Trash2,
  Heart
} from 'lucide-react';
import { useComplaints, Complaint } from '../../context/ComplaintsContext';
import { useAuth } from '../../context/AuthContext';
import { complaintsAPI } from '../../services/api';
import ComplaintLocationMap from '../complaintPage/ComplaintLocationMap';

const getSectorColor = (category: string): string => {
  const colors: { [key: string]: string } = {
    TRANSPORT: 'bg-blue-500',
    UTILITIES: 'bg-yellow-500',
    MUNICIPAL: 'bg-purple-500',
    INFRASTRUCTURE: 'bg-orange-500',
    ELECTRICITY: 'bg-amber-500',
    'WATER SUPPLY': 'bg-cyan-500',
    SANITATION: 'bg-red-500',
    EDUCATION: 'bg-indigo-500',
    HEALTHCARE: 'bg-pink-500',
    ENVIRONMENT: 'bg-green-500',
    'PUBLIC SAFETY': 'bg-blue-500',
    HOUSING: 'bg-teal-500',
    'LAW & ORDER': 'bg-slate-500',
    'DIGITAL SERVICES': 'bg-violet-500',
    'WASTE MANAGEMENT': 'bg-lime-500',
    TRAFFIC: 'bg-rose-500',
    'ANIMAL WELFARE': 'bg-emerald-500',
    EMPLOYMENT: 'bg-fuchsia-500',
  };
  return colors[category] || 'bg-gray-500';
};

const getStatusInfo = (status: string): { bg: string; text: string; label: string; icon: React.ReactNode } => {
  const normalizedStatus = status?.toLowerCase() || '';
  switch (normalizedStatus) {
    case 'solved':
    case 'resolved':
      return {
        bg: 'bg-green-100',
        text: 'text-green-700',
        label: 'Resolved',
        icon: <CheckCircle className="w-5 h-5" />
      };
    case 'in-progress':
    case 'in progress':
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        label: 'In Progress',
        icon: <Clock className="w-5 h-5" />
      };
    case 'pending review':
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        label: 'Pending Review',
        icon: <Clock className="w-5 h-5" />
      };
    default:
      return {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        label: 'Open',
        icon: <AlertCircle className="w-5 h-5" />
      };
  }
};

const ComplaintDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getComplaintById, voteComplaint, addInsightRequest } = useComplaints();
  const { currentUser } = useAuth();

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVoted, setIsVoted] = useState(false);
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [insightForm, setInsightForm] = useState({
    message: '',
    attachments: [] as { name: string; size: number; type: string; data: string }[]
  });
  const [insightSubmitted, setInsightSubmitted] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Array<{
    id: string;
    complaintId: string;
    userId: string;
    userName: string;
    userEmail: string;
    userAvatar: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    likes?: number;
    likedBy?: string[];
  }>>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Helper function to open image in modal
  const handleImageClick = (url: string, fileName?: string) => {
    const isImage = url.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg)/i.test(url) || url.includes('images.unsplash.com');
    
    if (isImage) {
      setSelectedImage({ url, name: fileName || 'Image' });
      setShowImageModal(true);
    } else {
      // For non-images, use the original handleFileOpen
      handleFileOpen(url, fileName);
    }
  };

  // Helper function to handle file opening
  const handleFileOpen = (url: string, fileName?: string) => {
    if (url.startsWith('data:')) {
      // For data URLs, open in a new window with proper display
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        const isImage = url.startsWith('data:image/');
        if (isImage) {
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${fileName || 'Image'}</title>
                <style>
                  body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000; }
                  img { max-width: 100%; max-height: 100vh; object-fit: contain; }
                </style>
              </head>
              <body>
                <img src="${url}" alt="${fileName || 'Image'}" />
              </body>
            </html>
          `);
        } else {
          // For non-image data URLs (PDFs, documents, etc.)
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${fileName || 'Document'}</title>
                <style>
                  body { margin: 0; padding: 0; }
                  iframe { width: 100vw; height: 100vh; border: none; }
                </style>
              </head>
              <body>
                <iframe src="${url}"></iframe>
              </body>
            </html>
          `);
        }
        newWindow.document.close();
      }
    } else {
      // For regular URLs (Firebase Storage, etc.), open in new tab
      window.open(url, '_blank');
    }
  };

  useEffect(() => {
    const fetchComplaint = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await getComplaintById(id);
        setComplaint(data);
        // Check if user has already voted
        if (currentUser && data?.votedBy?.includes(currentUser.uid)) {
          setIsVoted(true);
        }
      } catch (error) {
        console.error('Error fetching complaint:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchComplaint();
  }, [id, getComplaintById, currentUser]);

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      if (!id) return;
      setLoadingComments(true);
      try {
        const response = await complaintsAPI.getComments(id);
        if (response.success) {
          setComments(response.data);
        }
      } catch (error) {
        console.error('Error fetching comments:', error);
      } finally {
        setLoadingComments(false);
      }
    };
    fetchComments();
  }, [id]);

  // Handle add comment
  const handleAddComment = async () => {
    if (!currentUser) {
      alert('Please login to add a comment');
      return;
    }
    if (!newComment.trim()) {
      return;
    }
    
    setSubmittingComment(true);
    try {
      const response = await complaintsAPI.addComment(id!, newComment.trim());
      if (response.success) {
        setComments([response.data, ...comments]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Handle delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      const response = await complaintsAPI.deleteComment(id!, commentId);
      if (response.success) {
        setComments(comments.filter(c => c.id !== commentId));
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment. Please try again.');
    }
  };

  // Handle like comment
  const handleLikeComment = async (commentId: string) => {
    if (!currentUser) {
      alert('Please login to like comments');
      return;
    }
    
    try {
      const response = await complaintsAPI.likeComment(id!, commentId);
      if (response.success) {
        setComments(comments.map(c => 
          c.id === commentId 
            ? { ...c, likes: response.data.likes, likedBy: response.data.likedBy }
            : c
        ));
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  // Format comment date
  const formatCommentDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading complaint...</p>
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Complaint Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">The complaint you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/home')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(complaint.status);

  const handleVote = async () => {
    if (!currentUser) {
      alert('Please login to vote');
      return;
    }
    try {
      await voteComplaint(complaint.id);
      // Refetch complaint to get updated vote data
      const updatedComplaint = await getComplaintById(complaint.id);
      if (updatedComplaint) {
        setComplaint(updatedComplaint);
        setIsVoted(updatedComplaint.votedBy?.includes(currentUser.uid) || false);
      }
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleInsightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert('Please login to submit an insight');
      return;
    }
    try {
      // Transform attachments from data format to url format
      const transformedAttachments = insightForm.attachments.map(att => ({
        url: att.data,
        name: att.name,
        type: att.type,
        size: att.size
      }));
      
      await addInsightRequest(complaint.id, insightForm.message, transformedAttachments);
      setInsightSubmitted(true);
      setTimeout(() => {
        setShowInsightModal(false);
        setInsightSubmitted(false);
        setInsightForm({ message: '', attachments: [] });
      }, 2000);
    } catch (error) {
      console.error('Failed to submit insight:', error);
      alert('Failed to submit insight. Please try again.');
    }
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleCopyLink = () => {
    const complaintUrl = window.location.href;
    navigator.clipboard.writeText(complaintUrl).then(() => {
      setCopiedSuccess(true);
      setTimeout(() => {
        setCopiedSuccess(false);
      }, 2000);
    }).catch(() => {
      alert('Failed to copy link');
    });
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert('Please login to report');
      return;
    }
    if (!reportReason.trim()) {
      alert('Please provide a reason for reporting');
      return;
    }
    try {
      await complaintsAPI.report(complaint.id, reportReason.trim());
      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
        setReportReason('');
      }, 2000);
    } catch (error: any) {
      console.error('Failed to report:', error);
      alert(error.message || 'Failed to submit report. Please try again.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const filePromises: Promise<{ name: string; size: number; type: string; data: string }>[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        filePromises.push(
          new Promise((resolve) => {
            reader.onload = (e) => {
              resolve({
                name: file.name,
                size: file.size,
                type: file.type,
                data: e.target?.result as string
              });
            };
            reader.readAsDataURL(file);
          })
        );
      }

      Promise.all(filePromises).then((newFiles) => {
        setInsightForm({
          ...insightForm,
          attachments: [...insightForm.attachments, ...newFiles]
        });
      });
    }
  };

  const removeAttachment = (index: number) => {
    setInsightForm({
      ...insightForm,
      attachments: insightForm.attachments.filter((_, i) => i !== index)
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5" />;
    }
    return <FileText className="w-5 h-5" />;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      {/* Back Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-3 xs:px-4 md:px-6 py-2.5 xs:py-3 md:py-4">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-1.5 xs:gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white active:scale-95 transition font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4 xs:w-5 xs:h-5" />
            <span>Back</span>
          </button>
        </div>
      </div>

      <div className="container mx-auto px-3 xs:px-4 md:px-6 py-3 xs:py-4 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 xs:gap-4 md:gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-3 xs:space-y-4 md:space-y-6">
            {/* Complaint Header Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-3 xs:p-4 md:p-6">
                {/* Status and Sector Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-2 xs:mb-3 md:mb-4">
                  <span className={`${getSectorColor(complaint.category)} text-white text-[10px] xs:text-xs md:text-sm px-2 xs:px-3 md:px-4 py-0.5 xs:py-1 md:py-1.5 rounded-md md:rounded-lg font-medium truncate max-w-[120px] xs:max-w-[150px] md:max-w-none`}>
                    {complaint.category}
                  </span>
                  <span className={`${statusInfo.bg} ${statusInfo.text} text-[10px] xs:text-xs md:text-sm px-2 xs:px-3 md:px-4 py-0.5 xs:py-1 md:py-1.5 rounded-md md:rounded-lg font-semibold flex items-center gap-1 xs:gap-1.5 md:gap-2`}>
                    {statusInfo.icon}
                    {statusInfo.label}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-lg xs:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2 xs:mb-3 md:mb-4 break-words">
                  {complaint.title}
                </h1>

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-2 xs:gap-3 md:gap-4 text-[10px] xs:text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-3 xs:mb-4 md:mb-6">
                  <div className="flex items-center gap-1 xs:gap-1.5 md:gap-2">
                    <User className="w-3 h-3 xs:w-3.5 xs:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                    <span className="truncate max-w-[80px] xs:max-w-[100px] md:max-w-none"><strong>{complaint.isAnonymous ? 'Anon' : (complaint.userDisplayName || 'User')}</strong></span>
                  </div>
                  <div className="flex items-center gap-1 xs:gap-1.5 md:gap-2">
                    <Calendar className="w-3 h-3 xs:w-3.5 xs:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                    <span>{new Date(complaint.submittedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-1 xs:gap-1.5 md:gap-2 max-w-full">
                    <MapPin className="w-3 h-3 xs:w-3.5 xs:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                    <span className="truncate max-w-[100px] xs:max-w-[150px] md:max-w-[250px] lg:max-w-none">{complaint.location}</span>
                  </div>
                </div>

                {/* Description */}
                <div className="prose prose-sm md:prose prose-gray dark:prose-invert max-w-none">
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-xs xs:text-sm md:text-base break-words">
                    {complaint.description}
                  </p>
                </div>
              </div>

              {/* Attachments Section */}
              {complaint.images && complaint.images.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                    <Paperclip className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
                    Attachments
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {complaint.images.map((photo, index) => {
                      // Check if it's an image or other file type
                      // Support Firebase Storage URLs, base64 data URLs, and common image patterns
                      const isImage =
                        photo.startsWith('data:image/') ||  // Base64 data URL
                        photo.includes('images.unsplash.com') ||
                        /\.(jpg|jpeg|png|gif|webp|svg)/i.test(photo);

                      if (isImage) {
                        return (
                          <div 
                            key={index} 
                            className="aspect-video rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                            onClick={() => handleImageClick(photo, `image-${index + 1}`)}
                            title="Click to open image"
                          >
                            <img
                              src={photo}
                              alt={`Evidence ${index + 1}`}
                              className="w-full h-full object-cover hover:scale-105 transition duration-300"
                            />
                          </div>
                        );
                      } else {
                        // Extract file extension and name
                        let fileName = photo.split('/').pop() || 'Document';

                        // Handle data URLs (fallback when storage upload fails)
                        if (photo.startsWith('data:')) {
                          const mimeType = photo.split(';')[0].split(':')[1];
                          const ext = mimeType.split('/')[1] || 'file';
                          fileName = `Attached Document.${ext}`;
                        } else {
                          // Handle UUID-prefixed filenames from backend
                          // Pattern: UUID (36 chars) + hyphen
                          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;
                          if (uuidPattern.test(fileName)) {
                            fileName = fileName.replace(uuidPattern, '');
                          }
                        }

                        const fileExt = fileName.split('.').pop()?.toUpperCase() || 'FILE';

                        return (
                          <div 
                            key={index} 
                            className="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition cursor-pointer group"
                            onClick={() => handleFileOpen(photo, fileName)}
                            title="Click to open document"
                          >
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {fileName}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                {fileExt} Document • Click to view
                              </p>
                            </div>
                            <div className="text-gray-400 group-hover:text-blue-600 transition">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex flex-wrap items-center gap-4">
                <button
                  onClick={handleVote}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all ${isVoted
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                    }`}
                >
                  <ThumbsUp className={`w-5 h-5 ${isVoted ? 'fill-current' : ''}`} />
                  <span>Upvote ({complaint.votes})</span>
                </button>

                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-semibold bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition text-sm sm:text-base"
                >
                  <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Share</span>
                </button>

                {/* Only show report button if user is not the complaint owner */}
                {currentUser && complaint.userId !== currentUser.uid && (
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-semibold bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition text-sm sm:text-base"
                  >
                    <Flag className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Report</span>
                  </button>
                )}
              </div>
            </div>

            {/* Location Map */}
            {complaint.coordinates && complaint.coordinates.length === 2 && (
              <ComplaintLocationMap
                coordinates={complaint.coordinates}
                location={complaint.location}
              />
            )}

            {/* Updates Timeline */}
            {complaint.statusHistory && complaint.statusHistory.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 flex items-center gap-2">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  Status Updates
                </h3>
                <div className="space-y-4">
                  {complaint.statusHistory.map((update, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                        {index < complaint.statusHistory.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 mt-1"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{formatDate(update.date)}</p>
                        <p className="text-gray-700 dark:text-gray-300">{update.note || update.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                Comments ({comments.length})
              </h3>

              {/* Add Comment Form */}
              {currentUser ? (
                <div className="mb-6">
                  <div className="flex gap-3">
                    <img
                      src={currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || 'User')}&background=3b82f6&color=fff`}
                      alt="Your avatar"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        rows={3}
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={handleAddComment}
                          disabled={submittingComment || !newComment.trim()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {submittingComment ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Posting...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Post Comment
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                  <p className="text-gray-600 dark:text-gray-400 mb-2">Please login to add a comment</p>
                  <button
                    onClick={() => navigate('/login')}
                    className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  >
                    Login now
                  </button>
                </div>
              )}

              {/* Comments List */}
              {loadingComments ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : comments.length > 0 ? (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <img
                        src={comment.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.userName || 'User')}&background=3b82f6&color=fff`}
                        alt={comment.userName}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-gray-900 dark:text-white truncate">
                              {comment.userName || 'Anonymous'}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                              {formatCommentDate(comment.createdAt)}
                            </span>
                          </div>
                          {currentUser && currentUser.uid === comment.userId && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="p-1 text-gray-400 hover:text-red-500 transition flex-shrink-0"
                              title="Delete comment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                          {comment.content}
                        </p>
                        {/* Like Button */}
                        <div className="flex items-center gap-4 mt-2">
                          <button
                            onClick={() => handleLikeComment(comment.id)}
                            className={`flex items-center gap-1.5 text-sm transition ${
                              comment.likedBy?.includes(currentUser?.uid || '')
                                ? 'text-red-500 hover:text-red-600'
                                : 'text-gray-500 dark:text-gray-400 hover:text-red-500'
                            }`}
                            disabled={!currentUser}
                          >
                            <Heart 
                              className={`w-4 h-4 ${
                                comment.likedBy?.includes(currentUser?.uid || '') ? 'fill-current' : ''
                              }`} 
                            />
                            {comment.likes && comment.likes > 0 ? (
                              <span className="font-medium">{comment.likes}</span>
                            ) : null}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No comments yet. Be the first to comment!</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Request Insight Card - Only show to users who are NOT the owner */}
            {currentUser && complaint.userId !== currentUser.uid && (
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold">Have an Insight?</h3>
                </div>
                <p className="text-blue-100 mb-6 text-sm leading-relaxed">
                  If you have valuable information or suggestions that could help resolve this issue, share it with the complaint author.
                </p>
                <button
                  onClick={() => setShowInsightModal(true)}
                  className="w-full py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Send Insight Request
                </button>
              </div>
            )}

            {/* Your Complaint Notice - Show only to the owner */}
            {currentUser && complaint.userId === currentUser.uid && (
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold">Your Complaint</h3>
                </div>
                <p className="text-green-100 mb-6 text-sm leading-relaxed">
                  This is your complaint. You can view and manage insight requests from other users in your profile page.
                </p>
                <button
                  onClick={() => navigate(`/profile/complaint/${complaint.id}`)}
                  className="w-full py-3 bg-white text-green-600 rounded-lg font-semibold hover:bg-green-50 transition flex items-center justify-center gap-2"
                >
                  Manage Complaint
                </button>
              </div>
            )}

            {/* Complaint Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Complaint Statistics</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Total Votes</span>
                  <span className="font-bold text-gray-900 dark:text-white">{complaint.votes.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Date Posted</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatDate(complaint.submittedDate)}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Last Updated</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatDate(complaint.submittedDate)}</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-600 dark:text-gray-400">Status Updates</span>
                  <span className="font-bold text-gray-900 dark:text-white">{complaint.statusHistory?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* Author Info */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Posted By</h3>
                {currentUser && complaint.userId === currentUser.uid && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                    Posted by you
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {complaint.isAnonymous ? 'A' : (complaint.userDisplayName?.charAt(0) || 'U')}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{complaint.isAnonymous ? 'Anonymous' : (complaint.userDisplayName || 'User')}</p>
                  {!complaint.isAnonymous && complaint.userEmail ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{complaint.userEmail}</p>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Community Member</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Insight Request Modal */}
      {showInsightModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
            {!insightSubmitted ? (
              <>
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Send Insight to Author</h2>
                    <button
                      onClick={() => setShowInsightModal(false)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Your insight will be sent to <strong>{complaint.isAnonymous ? 'the complaint author' : complaint.userDisplayName}</strong> for their review.
                  </p>
                </div>

                <form onSubmit={handleInsightSubmit} className="p-6 space-y-4">

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Your Insight / Suggestion *
                    </label>
                    <textarea
                      value={insightForm.message}
                      onChange={(e) => setInsightForm({ ...insightForm, message: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Share your insight, information, or suggestions that could help resolve this issue..."
                      rows={5}
                      required
                    />
                  </div>

                  {/* Attachments Section */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Attachments (Optional)
                    </label>

                    {/* Upload Button */}
                    <div className="mb-3">
                      <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
                        <Paperclip className="w-5 h-5 text-gray-500" />
                        <span className="text-sm font-medium text-gray-600">
                          Add files or images
                        </span>
                        <input
                          type="file"
                          multiple
                          accept="image/*,.pdf,.doc,.docx,.txt"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-gray-500 mt-1 ml-1">
                        Supported: Images, PDF, DOC, TXT (Max 10MB per file)
                      </p>
                    </div>

                    {/* Attached Files List */}
                    {insightForm.attachments.length > 0 && (
                      <div className="space-y-2">
                        {insightForm.attachments.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="text-blue-600 flex-shrink-0">
                                {getFileIcon(file.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAttachment(index)}
                              className="ml-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition flex-shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInsightModal(false)}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                      <Send className="w-5 h-5" />
                      Send Insight
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Insight Sent!</h3>
                <p className="text-gray-600">
                  Your insight has been sent to {complaint.isAnonymous ? 'the complaint author' : complaint.userDisplayName}. They will review it and may contact you.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <button
            onClick={() => setShowImageModal(false)}
            className="absolute top-4 right-4 p-2 bg-white dark:bg-gray-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition z-10"
            title="Close"
          >
            <X className="w-6 h-6 text-gray-900 dark:text-white" />
          </button>

          <div 
            className="relative max-w-7xl max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage.url}
              alt={selectedImage.name}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">
                  Share Complaint
                </h3>
                <button
                  onClick={() => {
                    setShowShareModal(false);
                    setCopiedSuccess(false);
                  }}
                  className="p-1 hover:bg-gray-700 rounded-lg transition"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Share Link
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={window.location.href}
                    readOnly
                    className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                  >
                    {copiedSuccess ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Flag className="w-6 h-6 text-red-600" />
                  Report Complaint
                </h3>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {!reportSubmitted ? (
                <form onSubmit={handleReport}>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Reason for reporting
                    </label>
                    <textarea
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Please describe why you're reporting this complaint..."
                      required
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowReportModal(false)}
                      className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
                    >
                      Submit Report
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Report Submitted!</h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    Thank you for reporting. We'll review this complaint.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplaintDetailPage;
