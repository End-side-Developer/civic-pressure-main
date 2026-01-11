import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Calendar,
  Share2,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  X,
  Upload,
  Camera,
  Paperclip,
  FileText,
  Download,
  Image,
} from 'lucide-react';
import { useComplaints, Complaint } from '../../context/ComplaintsContext';
import { useAuth } from '../../context/AuthContext';
import ComplaintLocationMap from '../complaintPage/ComplaintLocationMap';

const getStatusInfo = (status: string) => {
  switch (status.toUpperCase()) {
    case 'RESOLVED':
      return {
        bg: 'bg-green-100',
        text: 'text-green-700',
        label: 'RESOLVED',
        icon: <CheckCircle className="w-3 h-3" />,
      };
    case 'IN PROGRESS':
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        label: 'IN PROGRESS',
        icon: <Clock className="w-3 h-3" />,
      };
    case 'PENDING REVIEW':
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        label: '★ PENDING REVIEW',
        icon: null,
      };
    case 'REJECTED':
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        label: 'REJECTED',
        icon: <X className="w-3 h-3" />,
      };
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        label: 'OPEN',
        icon: null,
      };
  }
};

const ProfileComplaintDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { complaints, userComplaints, getComplaintById, deleteComplaint, addInsightReply, addPhoto, markAsSolved } = useComplaints();
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [replyingToRequest, setReplyingToRequest] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [markingSolved, setMarkingSolved] = useState(false);
  const [showAllInsights, setShowAllInsights] = useState(false);

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
                  body { margin: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; background: #000; }
                  img { max-width: 100%; max-height: 90vh; object-fit: contain; }
                  .download-btn { position: fixed; top: 20px; right: 20px; padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; box-shadow: 0 4px 6px rgba(0,0,0,0.3); z-index: 1000; }
                  .download-btn:hover { background: #1d4ed8; }
                </style>
              </head>
              <body>
                <button class="download-btn" onclick="downloadFile()">Download</button>
                <img src="${url}" alt="${fileName || 'Image'}" />
                <script>
                  function downloadFile() {
                    const link = document.createElement('a');
                    link.href = '${url}';
                    link.download = '${fileName || 'image'}';
                    link.click();
                  }
                </script>
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
                  .download-btn { position: fixed; top: 20px; right: 20px; padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; box-shadow: 0 4px 6px rgba(0,0,0,0.3); z-index: 1000; }
                  .download-btn:hover { background: #1d4ed8; }
                </style>
              </head>
              <body>
                <button class="download-btn" onclick="downloadFile()">Download</button>
                <iframe src="${url}"></iframe>
                <script>
                  function downloadFile() {
                    const link = document.createElement('a');
                    link.href = '${url}';
                    link.download = '${fileName || 'document'}';
                    link.click();
                  }
                </script>
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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  // Fetch complaint on mount
  useEffect(() => {
    const fetchComplaint = async () => {
      if (!id || !currentUser) return;
      setLoading(true);

      // First check if it's in userComplaints (user's own complaints)
      let found = userComplaints.find((c) => c.id === id);

      // If not in userComplaints, check complaints and verify ownership
      if (!found) {
        found = complaints.find((c) => c.id === id);
      }

      if (found) {
        // Verify the user owns this complaint
        if (found.userId !== currentUser.uid) {
          // Redirect to public complaint view if not owner
          navigate(`/complaint/${id}`);
          return;
        }
        setComplaint(found);
        setLoading(false);
      } else {
        // Fetch from API
        try {
          const data = await getComplaintById(id);
          if (data) {
            // Verify ownership
            if (data.userId !== currentUser.uid) {
              navigate(`/complaint/${id}`);
              return;
            }
            setComplaint(data);
          }
        } catch (error) {
          console.error('Error fetching complaint:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchComplaint();
  }, [id, complaints, userComplaints, getComplaintById, currentUser, navigate]);

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
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            Complaint Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The complaint you're looking for doesn't exist or has been deleted.
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Back to Profile
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(complaint.status);

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/complaint/${complaint.id}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    deleteComplaint(complaint.id);
    setShowDeleteModal(false);
    navigate('/profile');
  };

  const handleEdit = () => {
    navigate(`/profile/complaint/${complaint.id}/edit`);
  };

  const handleReply = async (requestId: string) => {
    if (!replyText.trim()) return;
    try {
      await addInsightReply(complaint.id, requestId, replyText);
      // Refetch to get updated data
      const updatedComplaint = await getComplaintById(complaint.id);
      if (updatedComplaint) {
        setComplaint(updatedComplaint);
      }
      setReplyText('');
      setReplyingToRequest(null);
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Failed to send reply. Please try again.');
    }
  };

  const handleUploadPhoto = () => {
    fileInputRef.current?.click();
  };

  const handleMarkAsSolved = async () => {
    if (!complaint) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to mark this complaint as solved? This action will update the status to RESOLVED.'
    );
    
    if (!confirmed) return;
    
    try {
      setMarkingSolved(true);
      await markAsSolved(complaint.id);
      // Update local state
      setComplaint({ ...complaint, status: 'RESOLVED' });
      alert('Complaint marked as solved successfully!');
    } catch (error) {
      console.error('Error marking as solved:', error);
      alert('Failed to mark complaint as solved. Please try again.');
    } finally {
      setMarkingSolved(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && complaint) {
      try {
        await addPhoto(complaint.id, file);
        // Refetch to get updated images
        const updatedComplaint = await getComplaintById(complaint.id);
        if (updatedComplaint) {
          setComplaint(updatedComplaint);
        }
        alert('Photo uploaded successfully!');
      } catch (error) {
        console.error('Error uploading photo:', error);
        alert('Failed to upload photo. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Breadcrumb Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-3 xs:px-4 md:px-6 py-3 xs:py-4">
          <nav className="flex items-center gap-1.5 xs:gap-2 text-xs xs:text-sm overflow-x-auto">
            <button
              onClick={() => navigate('/profile')}
              className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              My Profile
            </button>
            <span className="text-gray-400">›</span>
            <button
              onClick={() => navigate('/profile')}
              className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              My Complaints
            </button>
            <span className="text-gray-400">›</span>
            <span className="text-gray-900 dark:text-white font-medium">Details</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-3 xs:px-4 md:px-6 py-4 xs:py-6">
        {/* Title Section */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4 xs:mb-6">
          <div>
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 xs:gap-2 mb-2 xs:mb-3">
              <span className="px-2 xs:px-3 py-0.5 xs:py-1 bg-orange-100 text-orange-700 text-[10px] xs:text-xs font-bold rounded-full">
                {complaint.category}
              </span>
              <span
                className={`px-2 xs:px-3 py-0.5 xs:py-1 ${statusInfo.bg} ${statusInfo.text} text-[10px] xs:text-xs font-bold rounded-full flex items-center gap-1`}
              >
                {statusInfo.label}
              </span>
              {complaint.isAnonymous ? (
                <span className="px-2 xs:px-3 py-0.5 xs:py-1 bg-gray-100 text-gray-600 text-[10px] xs:text-xs font-bold rounded-full">
                  🔒 <span className="hidden xs:inline">Submitted </span>Anonymous
                </span>
              ) : (
                <span className="px-2 xs:px-3 py-0.5 xs:py-1 bg-blue-100 text-blue-700 text-[10px] xs:text-xs font-bold rounded-full">
                  👤 <span className="hidden xs:inline">Identity </span>Visible
                </span>
              )}
              <span className="px-2 xs:px-3 py-0.5 xs:py-1 bg-green-100 text-green-700 text-[10px] xs:text-xs font-semibold rounded-full">
                Posted by you
              </span>
            </div>

            {/* Title */}
            <h1 className="text-xl xs:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 xs:mb-3">
              {complaint.title}
            </h1>

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-2 xs:gap-4 text-xs xs:text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 xs:w-4 xs:h-4 flex-shrink-0" />
                <span className="truncate"><span className="hidden xs:inline">Submitted on </span>{formatDate(complaint.submittedDate)}</span>
              </div>
              <div className="flex items-center gap-1 min-w-0 flex-1 xs:flex-initial">
                <MapPin className="w-3.5 h-3.5 xs:w-4 xs:h-4 flex-shrink-0" />
                <span className="truncate">{complaint.location}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 xs:gap-3 w-full lg:w-auto">
            {complaint.status !== 'RESOLVED' && (
              <button
                onClick={handleMarkAsSolved}
                disabled={markingSolved}
                className="flex-1 xs:flex-initial flex items-center justify-center gap-1.5 xs:gap-2 px-3 xs:px-4 md:px-5 py-2.5 min-h-[44px] bg-green-600 text-white rounded-lg hover:bg-green-700 active:scale-95 transition-all text-sm xs:text-base font-semibold shadow-lg shadow-green-500/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span className="hidden xs:inline">{markingSolved ? 'Marking...' : 'Mark as Solved'}</span>
                <span className="xs:hidden">{markingSolved ? '...' : 'Solved'}</span>
              </button>
            )}
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 xs:gap-2 px-3 xs:px-4 md:px-5 py-2.5 min-h-[44px] border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-transparent rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-95 transition-all text-sm xs:text-base font-semibold"
            >
              <Share2 className="w-4 h-4 flex-shrink-0" />
              <span>Share</span>
            </button>
            <button
              onClick={handleEdit}
              className="flex-1 xs:flex-initial flex items-center justify-center gap-1.5 xs:gap-2 px-3 xs:px-4 md:px-5 py-2.5 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all text-sm xs:text-base font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl"
            >
              <Edit className="w-4 h-4 flex-shrink-0" />
              <span className="hidden xs:inline">Edit Complaint</span>
              <span className="xs:hidden">Edit</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 xs:gap-6">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-2 space-y-6">
            {/* Attachments Section */}
            {complaint.images && complaint.images.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl xs:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="border-b border-gray-100 dark:border-gray-700 p-4 xs:p-6">
                  <h3 className="font-semibold text-sm xs:text-base text-gray-900 dark:text-white mb-3 xs:mb-4 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 xs:w-5 xs:h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                    Attachments
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 xs:gap-4">
                    {complaint.images.map((photo, index) => {
                      // Check if it's an image or other file type
                      const isImage =
                        photo.startsWith('data:image/') ||
                        photo.includes('images.unsplash.com') ||
                        /\.(jpg|jpeg|png|gif|webp|svg)/i.test(photo);

                      if (isImage) {
                        return (
                          <div 
                            key={index} 
                            className="aspect-video rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                            onClick={() => handleFileOpen(photo, `image-${index + 1}`)}
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
                
                {/* Add Photo Section */}
                <div className="p-3 xs:p-4 bg-gray-50 dark:bg-gray-700/50">
                  <button
                    onClick={handleUploadPhoto}
                    className="w-full py-2.5 xs:py-3 min-h-[44px] rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 active:scale-[0.98] transition flex items-center justify-center gap-2 bg-white dark:bg-gray-800"
                  >
                    <Camera className="w-4 h-4 xs:w-5 xs:h-5 text-blue-600 flex-shrink-0" />
                    <span className="text-xs xs:text-sm text-gray-600 dark:text-gray-400 font-medium">
                      Add Photo or Document
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Description Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl xs:rounded-2xl shadow-sm p-4 xs:p-6">
              <h3 className="text-base xs:text-lg font-bold text-gray-900 dark:text-white mb-3 xs:mb-4">Description</h3>
              <p className="text-sm xs:text-base text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                {complaint.description}
              </p>
            </div>

            {/* Complaint Location */}
            {complaint.coordinates && complaint.coordinates.length === 2 && (
              <ComplaintLocationMap
                coordinates={complaint.coordinates}
                location={complaint.location}
              />
            )}
          </div>

          {/* Sidebar - Right Side */}
          <div className="space-y-4 xs:space-y-6">
            {/* Insight Requests */}
            <div className="bg-white dark:bg-gray-800 rounded-xl xs:rounded-2xl shadow-sm p-4 xs:p-6">
              <div className="flex items-center justify-between mb-3 xs:mb-4">
                <h3 className="text-base xs:text-lg font-bold text-gray-900 dark:text-white">
                  Insight Requests
                </h3>
                {complaint.insightRequests.length > 0 && (
                  <span className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-full">
                    {complaint.insightRequests.length} Pending
                  </span>
                )}
              </div>

              {complaint.insightRequests.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No insight requests yet.</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Other users or officials have requested more information to help process your
                    complaint.
                  </p>

                  {(showAllInsights ? [...complaint.insightRequests].reverse() : [...complaint.insightRequests].reverse().slice(0, 2)).map((request) => (
                    <div
                      key={request.id}
                      className="p-3 xs:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg xs:rounded-xl"
                    >
                      <div className="flex items-start gap-2 xs:gap-3">
                        <div className="w-8 h-8 xs:w-9 xs:h-9 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-[10px] xs:text-xs flex-shrink-0">
                          {request.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-900 dark:text-white text-sm">
                              {request.user}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {request.time}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300 italic">
                            "{request.message}"
                          </p>
                          
                          {/* Attachments */}
                          {request.attachments && request.attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                Attachments ({request.attachments.length})
                              </p>
                              <div className="grid grid-cols-1 gap-2">
                                {request.attachments.map((attachment, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-600 transition-all group"
                                  >
                                    {/* File Icon */}
                                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                      {attachment.type.startsWith('image/') ? (
                                        <Image className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                      ) : (
                                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                      )}
                                    </div>
                                    
                                    {/* File Info */}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {attachment.name}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {attachment.size ? `${(attachment.size / 1024).toFixed(1)} KB` : 'File'}
                                      </p>
                                    </div>
                                    
                                    {/* Download Button */}
                                    <a
                                      href={attachment.url}
                                      download={attachment.name}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleFileOpen(attachment.url, attachment.name);
                                      }}
                                      className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center justify-center group-hover:scale-110"
                                      title="Download attachment"
                                    >
                                      <Download className="w-4 h-4" />
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {!request.hasReply && replyingToRequest !== request.id && (
                          <button
                            onClick={() => setReplyingToRequest(null)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {replyingToRequest === request.id ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Type your reply..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleReply(request.id)}
                              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-semibold shadow-md hover:shadow-lg"
                            >
                              Send Reply
                            </button>
                            <button
                              onClick={() => {
                                setReplyingToRequest(null);
                                setReplyText('');
                              }}
                              className="px-5 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all text-sm font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          {request.hasReply ? (
                            <span className="text-green-600 text-sm font-medium">✓ Replied</span>
                          ) : request.user === 'Jane Doe' ? (
                            <button
                              onClick={handleUploadPhoto}
                              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                            >
                              <Upload className="w-4 h-4" />
                              Upload Photo
                            </button>
                          ) : (
                            <button
                              onClick={() => setReplyingToRequest(request.id)}
                              className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-transparent rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all text-sm font-semibold"
                            >
                              Reply
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {/* See More / See Less Button */}
                  {complaint.insightRequests.length > 2 && (
                    <button
                      onClick={() => setShowAllInsights(!showAllInsights)}
                      className="w-full px-4 py-2.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all text-sm font-semibold border border-blue-200 dark:border-blue-800"
                    >
                      {showAllInsights ? 'See Less' : `See More (${complaint.insightRequests.length - 2} more)`}
                    </button>
                  )}                </div>
              )}
            </div>

            {/* Community Impact */}
            <div className="bg-white dark:bg-gray-800 rounded-xl xs:rounded-2xl shadow-sm p-4 xs:p-6">
              <h3 className="text-xs xs:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 xs:mb-4">
                Community Impact
              </h3>
              <div className="grid grid-cols-2 gap-3 xs:gap-4 mb-3 xs:mb-4">
                <div className="text-center">
                  <div className="text-2xl xs:text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {complaint.votes}
                  </div>
                  <div className="text-xs xs:text-sm text-gray-500 dark:text-gray-400">Total Votes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl xs:text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {complaint.views}
                  </div>
                  <div className="text-xs xs:text-sm text-gray-500 dark:text-gray-400">Views</div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Priority Score</span>
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded ${complaint.priorityScore === 'High'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                      }`}
                  >
                    {complaint.priorityScore}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${complaint.priorityScore === 'High' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}
                    style={{ width: complaint.priorityScore === 'High' ? '85%' : '45%' }}
                  />
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Top 10% of complaints in this sector this week.
                </p>
              </div>
            </div>

            {/* Status History */}
            <div className="bg-white dark:bg-gray-800 rounded-xl xs:rounded-2xl shadow-sm p-4 xs:p-6">
              <h3 className="text-xs xs:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 xs:mb-4">
                Status History
              </h3>
              <div className="space-y-3 xs:space-y-4">
                {complaint.statusHistory.map((status, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${index === 0 ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                      />
                      {index < complaint.statusHistory.length - 1 && (
                        <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        {status.status}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(status.date)}</div>
                      {status.note && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                          {status.note}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delete Button */}
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-red-600 text-white rounded-lg xs:rounded-xl hover:bg-red-700 active:scale-[0.98] transition-all text-sm xs:text-base font-semibold shadow-lg shadow-red-500/30 hover:shadow-xl"
            >
              <Trash2 className="w-4 h-4 flex-shrink-0" />
              Delete Complaint
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 xs:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl xs:rounded-2xl shadow-xl max-w-md w-full p-4 xs:p-6">
            <div className="flex items-center gap-2 xs:gap-3 mb-3 xs:mb-4">
              <div className="w-10 h-10 xs:w-12 xs:h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 xs:w-6 xs:h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg xs:text-xl font-bold text-gray-900 dark:text-white">Delete Complaint</h3>
            </div>
            <p className="text-sm xs:text-base text-gray-600 dark:text-gray-400 mb-4 xs:mb-6">
              Are you sure you want to delete this complaint? This action cannot be undone and all
              associated data will be permanently removed.
            </p>
            <div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 xs:px-6 py-2.5 xs:py-3 min-h-[44px] border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-transparent rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-95 transition-all text-sm xs:text-base font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 xs:px-6 py-2.5 xs:py-3 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all text-sm xs:text-base font-semibold shadow-lg shadow-blue-500/30"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 xs:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl xs:rounded-2xl shadow-xl max-w-md w-full p-4 xs:p-6">
            <div className="flex items-center justify-between mb-3 xs:mb-4">
              <h3 className="text-lg xs:text-xl font-bold text-gray-900 dark:text-white">Share Complaint</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg active:scale-95 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 xs:space-y-4">
              <div>
                <label className="block text-xs xs:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 xs:mb-2">
                  Share Link
                </label>
                <div className="flex flex-col xs:flex-row gap-2">
                  <input
                    type="text"
                    value={`${window.location.origin}/complaint/${complaint.id}`}
                    readOnly
                    className="flex-1 px-3 py-2.5 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-xs xs:text-sm"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-4 py-2.5 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition text-sm font-medium"
                  >
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileComplaintDetailPage;
