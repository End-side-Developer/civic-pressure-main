import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, X, MapPin, Navigation, Eye, Search } from 'lucide-react';
import { useJsApiLoader } from '@react-google-maps/api';
import { useComplaints, Complaint } from '../../context/ComplaintsContext';
import { useAuth } from '../../context/AuthContext';
import { complaintsAPI } from '../../services/api';
import GoogleMapPicker from '../complaintPage/GoogleMapPicker';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ['places'];

const EditComplaintPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const { complaints, userComplaints, getComplaintById, updateComplaint } = useComplaints();
  const { currentUser } = useAuth();

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const [existingComplaint, setExistingComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    sector: '',
    description: '',
    location: '',
    files: [] as File[],
    existingImages: [] as string[],
  });

  const [mapLocation, setMapLocation] = useState<[number, number]>([25.276987, 55.296249]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Reverse geocode to get address from coordinates
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (!isLoaded) {
      const coordString = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setFormData((prev) => ({ ...prev, location: coordString }));
      console.warn('⚠️ Google Maps not loaded yet, using coordinates only');
      return;
    }
    
    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });
      if (response.results[0]) {
        const address = response.results[0].formatted_address;
        // Only set the address, not coordinates
        setFormData((prev) => ({ ...prev, location: address }));
      } else {
        // Fallback to coordinates if no address found
        const coordString = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setFormData((prev) => ({ ...prev, location: coordString }));
      }
    } catch (error) {
      console.error('❌ Geocoding error:', error);
      // Fallback to coordinates on error
      const coordString = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setFormData((prev) => ({ ...prev, location: coordString }));
    }
  }, [isLoaded]);

  // Detect current location with high accuracy
  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetecting(true);
    setLocationAccuracy(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        
        if (accuracy > 10000) {
          setIsDetecting(false);
          alert(
            `Location accuracy is very low (${(accuracy / 1000).toFixed(1)}km).\n\n` +
            'This usually happens on desktop computers or when GPS is disabled.\n\n' +
            'Please use one of these options instead:\n' +
            '1. Search for your address in the search box\n' +
            '2. Click directly on the map to select your exact location'
          );
          return;
        }
        
        if (accuracy < 1000) {
          setMapLocation([latitude, longitude]);
          setLocationAccuracy(accuracy);
          reverseGeocode(latitude, longitude);
          setIsDetecting(false);
        } else {
          startWatchingPosition();
        }
      },
      (error) => {
        setIsDetecting(false);
        let errorMessage = 'Location detection failed.\n\n';
        switch (error.code) {
          case 1:
            errorMessage += 'Please allow location access in your browser and try again.';
            break;
          case 2:
            errorMessage += 'GPS is not available. Please use the map or search box to select your location.';
            break;
          case 3:
            errorMessage += 'Location request timed out. Please use the map or search box.';
            break;
          default:
            errorMessage += 'Please use the map or search box to select your location.';
        }
        alert(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );

    function startWatchingPosition() {
      let bestAccuracy = Infinity;
      let bestPosition: { lat: number; lng: number; acc: number } | null = null;
      let updateCount = 0;
      let watchId: number;

      const stopWatching = (latitude: number, longitude: number, accuracy: number) => {
        navigator.geolocation.clearWatch(watchId);
        
        if (accuracy > 5000) {
          setIsDetecting(false);
          alert(
            `Best accuracy available is ${(accuracy / 1000).toFixed(1)}km - too low for precise location.\n\n` +
            'Please use the map or search box to select your exact location instead.'
          );
          return;
        }
        
        setMapLocation([latitude, longitude]);
        setLocationAccuracy(accuracy);
        reverseGeocode(latitude, longitude);
        setIsDetecting(false);
        
        if (accuracy > 500) {
          setTimeout(() => {
            alert(
              `Location set with ${Math.round(accuracy)}m accuracy.\n\n` +
              'For better precision, please click on the map to adjust the marker to your exact location.'
            );
          }, 500);
        }
      };

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          updateCount++;

          if (accuracy < bestAccuracy) {
            bestAccuracy = accuracy;
            bestPosition = { lat: latitude, lng: longitude, acc: accuracy };
            
            if (accuracy < 5000) {
              setMapLocation([latitude, longitude]);
              setLocationAccuracy(accuracy);
            }
          }

          if (accuracy <= 100) {
            stopWatching(latitude, longitude, accuracy);
            return;
          }

          if (updateCount >= 3 && accuracy <= 500) {
            stopWatching(latitude, longitude, accuracy);
            return;
          }

          if (updateCount >= 5) {
            if (bestPosition) {
              stopWatching(bestPosition.lat, bestPosition.lng, bestPosition.acc);
            }
            return;
          }
        },
        (error) => {
          console.error('Watch position error:', error);
          navigator.geolocation.clearWatch(watchId);
          setIsDetecting(false);
          if (bestPosition && bestPosition.acc < 5000) {
            setMapLocation([bestPosition.lat, bestPosition.lng]);
            setLocationAccuracy(bestPosition.acc);
            reverseGeocode(bestPosition.lat, bestPosition.lng);
          } else {
            alert('Unable to get accurate location. Please select manually on the map.');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    }
  }, [reverseGeocode]);

  const handleLocationSelect = (location: string, coordinates: [number, number]) => {
    setFormData((prev) => ({ ...prev, location }));
    setMapLocation(coordinates);
  };

  // Handle place selection from autocomplete
  const handlePlaceSelect = () => {
    const autocomplete = autocompleteRef.current;
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address || place.name || '';
        setMapLocation([lat, lng]);
        setFormData((prev) => ({ ...prev, location: address }));
      }
    }
  };

  // Initialize autocomplete when Google Maps is loaded
  useEffect(() => {
    if (isLoaded && searchInputRef.current && !autocompleteRef.current) {
      autocompleteRef.current = new google.maps.places.Autocomplete(searchInputRef.current, {
        fields: ['formatted_address', 'geometry', 'name'],
      });
      autocompleteRef.current.addListener('place_changed', handlePlaceSelect);
    }
  }, [isLoaded]);

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
        // Verify ownership
        if (found.userId !== currentUser.uid) {
          alert('You can only edit your own complaints.');
          navigate('/profile');
          return;
        }
        setExistingComplaint(found);
        setLoading(false);
      } else {
        // Fetch from API
        try {
          const data = await getComplaintById(id);
          if (data) {
            // Verify ownership
            if (data.userId !== currentUser.uid) {
              alert('You can only edit your own complaints.');
              navigate('/profile');
              return;
            }
            setExistingComplaint(data);
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

  // Initialize form data when complaint is found
  useEffect(() => {
    if (existingComplaint && !isInitialized) {
      setFormData({
        title: existingComplaint.title,
        sector: existingComplaint.category,
        description: existingComplaint.description,
        location: existingComplaint.location,
        files: [],
        existingImages: existingComplaint.images || [],
      });
      setMapLocation(existingComplaint.coordinates as [number, number]);
      setIsInitialized(true);
    }
  }, [existingComplaint, isInitialized]);

  const sectors = [
    'Transport',
    'Utilities',
    'Municipal',
    'Infrastructure',
    'Electricity',
    'Water Supply',
    'Sanitation',
    'Education',
    'Healthcare',
    'Environment',
    'Public Safety',
    'Housing',
    'Law & Order',
    'Digital Services',
    'Waste Management',
    'Traffic',
    'Animal Welfare',
    'Employment',
  ];

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

  if (!existingComplaint) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            Complaint Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The complaint you're trying to edit doesn't exist.
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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setFormData((prev) => ({
        ...prev,
        files: [...prev.files, ...Array.from(files)],
      }));
    }
  };

  const removeNewFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  const removeExistingImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      existingImages: prev.existingImages.filter((_, i) => i !== index),
    }));
  };

  // Helper function to handle existing image/file viewing (URL)
  const handleFileView = (url: string) => {
    const newWindow = window.open('', '_blank');
    
    if (newWindow) {
      // Determine if it's an image based on URL extension
      const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url) || url.includes('firebasestorage');
      
      if (isImage) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Image Preview</title>
              <style>
                body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000; }
                img { max-width: 100%; max-height: 100vh; object-fit: contain; }
              </style>
            </head>
            <body>
              <img src="${url}" alt="Image Preview" />
            </body>
          </html>
        `);
      } else {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Document Preview</title>
              <style>
                body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                .container { max-width: 800px; margin: 0 auto; }
                h1 { color: #333; }
                iframe { width: 100%; height: 80vh; border: 1px solid #ddd; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Document Preview</h1>
                <iframe src="${url}"></iframe>
              </div>
            </body>
          </html>
        `);
      }
      newWindow.document.close();
    }
  };

  // Helper function to handle new file preview (File object)
  const handleNewFilePreview = (file: File) => {
    const fileUrl = URL.createObjectURL(file);
    const newWindow = window.open('', '_blank');
    
    if (newWindow) {
      if (file.type.startsWith('image/')) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${file.name}</title>
              <style>
                body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000; }
                img { max-width: 100%; max-height: 100vh; object-fit: contain; }
              </style>
            </head>
            <body>
              <img src="${fileUrl}" alt="${file.name}" />
            </body>
          </html>
        `);
      } else {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${file.name}</title>
              <style>
                body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                .container { max-width: 800px; margin: 0 auto; }
                h1 { color: #333; }
                iframe { width: 100%; height: 80vh; border: 1px solid #ddd; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>${file.name}</h1>
                <p>File type: ${file.type || 'Unknown'}</p>
                <iframe src="${fileUrl}"></iframe>
              </div>
            </body>
          </html>
        `);
      }
      newWindow.document.close();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submitted with data:', formData);
    console.log('Map location:', mapLocation);
    
    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Please fill in the required fields (Title and Description)');
      return;
    }

    if (!formData.sector || formData.sector.trim() === '') {
      alert('Please select a sector');
      return;
    }

    // Update complaint using API with file support
    if (id) {
      try {
        console.log('Updating complaint with ID:', id);
        
        // Use the API directly to support file uploads
        const response = await complaintsAPI.updateWithFiles(id, {
          title: formData.title,
          category: formData.sector.toUpperCase(),
          description: formData.description,
          location: formData.location,
          coordinates: {
            latitude: mapLocation[0],
            longitude: mapLocation[1]
          },
          existingImages: formData.existingImages,
          newImages: formData.files,
        });

        console.log('API response:', response);

        // Update the local state via context to reflect changes immediately
        if (response.success && response.data) {
          console.log('Updating local context with:', response.data);
          // Refresh the complaints context
          await updateComplaint(id, {
            title: formData.title,
            category: formData.sector.toUpperCase(),
            description: formData.description,
            location: formData.location,
            coordinates: {
              latitude: mapLocation[0],
              longitude: mapLocation[1]
            } as any,
            images: response.data.images || [...formData.existingImages],
          });
        }

        alert('Complaint updated successfully!');
        navigate(`/profile/complaint/${id}`);
      } catch (error) {
        console.error('Failed to update complaint:', error);
        alert(`Failed to update complaint: ${error instanceof Error ? error.message : 'Please try again.'}`);
      }
    }
  };

  const handleCancel = () => {
    navigate(`/profile/complaint/${id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-3 xs:px-4 md:px-6 py-3 xs:py-4">
          <nav className="flex items-center gap-1.5 xs:gap-2 text-xs xs:text-sm text-gray-600 dark:text-gray-400 overflow-x-auto">
            <button
              onClick={() => navigate('/profile')}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition whitespace-nowrap"
            >
              <span className="hidden xs:inline">My Profile</span>
              <span className="xs:hidden">Profile</span>
            </button>
            <span>/</span>
            <button
              onClick={() => navigate('/profile')}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition whitespace-nowrap"
            >
              <span className="hidden xs:inline">My Complaints</span>
              <span className="xs:hidden">Complaints</span>
            </button>
            <span>/</span>
            <button
              onClick={() => navigate(`/profile/complaint/${id}`)}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              Details
            </button>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">Edit</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-3 xs:px-4 md:px-6 py-4 xs:py-6 md:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 xs:p-6 md:p-8">
            <h1 className="text-xl xs:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1 xs:mb-2">
              Edit Complaint
            </h1>
            <p className="text-sm xs:text-base text-gray-600 dark:text-gray-400 mb-4 xs:mb-6 md:mb-8">
              Update the details of your complaint below.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 xs:space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xs:gap-6">
                {/* Left Column - Form */}
                <div className="space-y-4 xs:space-y-6">
                  {/* Title */}
                  <div>
                    <label className="block text-xs xs:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5 xs:mb-2">
                      Complaint Title<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder="e.g., Deep Pothole on Main St."
                      className="w-full px-3 xs:px-4 py-2.5 xs:py-3 min-h-[44px] border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white dark:bg-gray-700 text-sm xs:text-base text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs xs:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5 xs:mb-2">
                      Category<span className="text-red-500">*</span>
                    </label>
                    <select
                      name="sector"
                      value={formData.sector}
                      onChange={handleInputChange}
                      className="w-full px-3 xs:px-4 py-2.5 xs:py-3 min-h-[44px] border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white dark:bg-gray-700 text-sm xs:text-base text-gray-900 dark:text-white"
                      required
                    >
                      {sectors.map((sector) => (
                        <option key={sector} value={sector}>
                          {sector}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs xs:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5 xs:mb-2">
                      Description<span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={5}
                      placeholder="Describe the issue in detail..."
                      className="w-full px-3 xs:px-4 py-2.5 xs:py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none bg-white dark:bg-gray-700 text-sm xs:text-base text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-xs xs:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5 xs:mb-2">
                      Location
                    </label>
                    
                    {/* Search Location */}
                    <div className="mb-2 xs:mb-3">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="w-4 h-4 xs:w-5 xs:h-5 text-gray-400" />
                        </div>
                        <input
                          ref={searchInputRef}
                          type="text"
                          placeholder="Search for an address..."
                          className="w-full pl-9 xs:pl-10 pr-3 xs:pr-4 py-2.5 xs:py-3 min-h-[44px] border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white dark:bg-gray-700 text-sm xs:text-base text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Selected Location Display */}
                    <div className="flex flex-col xs:flex-row items-stretch xs:items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
                      <div className="hidden xs:flex pl-4 text-gray-400">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        placeholder="Click on map to select location..."
                        className="flex-1 px-3 py-2.5 xs:py-3 min-h-[44px] border-0 focus:ring-0 focus:outline-none bg-transparent text-sm xs:text-base text-gray-900 dark:text-white"
                        readOnly
                      />
                      <button
                        type="button"
                        onClick={detectLocation}
                        disabled={isDetecting}
                        className="px-3 xs:px-4 py-2.5 xs:py-3 min-h-[44px] text-blue-600 text-xs xs:text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-95 transition flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed border-t xs:border-t-0 xs:border-l border-gray-200 dark:border-gray-600"
                      >
                        <Navigation className={`w-3.5 h-3.5 xs:w-4 xs:h-4 ${isDetecting ? 'animate-spin' : ''}`} />
                        {isDetecting ? 'DETECTING...' : 'DETECT'}
                      </button>
                    </div>
                  </div>

                  {/* Images */}
                  <div>
                    <label className="block text-xs xs:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5 xs:mb-2">
                      Update Evidence
                    </label>

                    {/* Existing Images */}
                    {formData.existingImages.length > 0 && (
                      <div className="mb-2 xs:mb-3">
                        <p className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400 mb-1.5 xs:mb-2">
                          Current images:
                        </p>
                        <div className="grid grid-cols-2 xs:grid-cols-3 gap-2">
                          {formData.existingImages.map((image, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={image}
                                alt={`Existing ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg cursor-pointer"
                                onClick={() => handleFileView(image)}
                              />
                              <button
                                type="button"
                                onClick={() => handleFileView(image)}
                                className="absolute top-1 left-1 p-1.5 bg-blue-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                                title="View image"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeExistingImage(index)}
                                className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Upload New Images */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg p-4 xs:p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-[0.98] transition"
                    >
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 xs:w-12 xs:h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-2 xs:mb-3">
                          <Upload className="w-5 h-5 xs:w-6 xs:h-6 text-gray-400" />
                        </div>
                        <p className="text-sm xs:text-base text-gray-600 dark:text-gray-400">
                          <span className="text-blue-600 font-medium">Click to upload</span> new
                          images
                        </p>
                        <p className="text-[10px] xs:text-xs text-gray-400 mt-1">PNG, JPG (MAX. 5MB)</p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>

                    {/* New Files Preview */}
                    {formData.files.length > 0 && (
                      <div className="mt-2 xs:mt-3">
                        <p className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400 mb-1.5 xs:mb-2">New images to upload:</p>
                        <div className="grid grid-cols-2 xs:grid-cols-3 gap-2">
                          {formData.files.map((file, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`New ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg cursor-pointer"
                                onClick={() => handleNewFilePreview(file)}
                              />
                              <button
                                type="button"
                                onClick={() => handleNewFilePreview(file)}
                                className="absolute top-1 left-1 p-1.5 bg-blue-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                                title="View image"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeNewFile(index)}
                                className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate rounded-b-lg">
                                {file.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Map */}
                <div>
                  <label className="block text-xs xs:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5 xs:mb-2">
                    Select Location on Map
                  </label>
                  <div className="h-[300px] xs:h-[400px] lg:h-[600px] bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600">
                    {isLoaded ? (
                      <GoogleMapPicker
                        onLocationSelect={handleLocationSelect}
                        initialLocation={mapLocation}
                        initialAddress={formData.location}
                        hideSearchControls={true}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                          <p className="text-gray-600 dark:text-gray-400">Loading map...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {locationAccuracy && (
                    <p className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400 mt-2">
                      📍 Location accuracy: {Math.round(locationAccuracy)}m
                    </p>
                  )}
                  <p className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400 mt-2">
                    💡 Search for an address, click on the map, or use the detect button to update the location
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse xs:flex-row items-stretch xs:items-center gap-3 xs:gap-4 pt-4 xs:pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 xs:py-4 min-h-[44px] rounded-lg text-sm xs:text-base font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-[0.98] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-3 xs:py-4 min-h-[44px] rounded-lg text-sm xs:text-base font-semibold hover:bg-blue-700 active:scale-[0.98] transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditComplaintPage;
