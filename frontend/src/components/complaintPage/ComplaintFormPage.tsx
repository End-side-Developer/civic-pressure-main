import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Search, Navigation, MapPin, AlertCircle, Sparkles, Check, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useComplaints } from '../../context/ComplaintsContext';
import GoogleMapPicker from './GoogleMapPicker';
import DuplicateCheckPanel, { DuplicateCheckResult } from './DuplicateCheckPanel';
import { complaintsAPI, aiAPI } from '../../services/api';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ['places'];

declare global {
  interface Window {
    google: typeof google;
  }
}

declare global {
  interface Window {
    google: typeof google;
  }
}

const ComplaintFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { createComplaint, loading } = useComplaints();

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!currentUser) {
      alert('Please login to submit a complaint');
      navigate('/login');
    }
  }, [currentUser, navigate]);

  const [formData, setFormData] = useState({
    title: '',
    sector: '',
    customSector: '',
    description: '',
    location: '',
    anonymous: false,
    files: [] as File[],
  });

  const sectors = [
    'TRANSPORT',
    'UTILITIES',
    'MUNICIPAL',
    'INFRASTRUCTURE',
    'ELECTRICITY',
    'WATER SUPPLY',
    'SANITATION',
    'EDUCATION',
    'HEALTHCARE',
    'ENVIRONMENT',
    'PUBLIC SAFETY',
    'HOUSING',
    'LAW & ORDER',
    'DIGITAL SERVICES',
    'WASTE MANAGEMENT',
    'TRAFFIC',
    'ANIMAL WELFARE',
    'EMPLOYMENT',
    'OTHER'
  ];


  const [mapLocation, setMapLocation] = useState<[number, number]>([25.276987, 55.296249]); // Dubai coordinates
  const [isDetecting, setIsDetecting] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Duplicate check state
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  // AI improvement state
  const [isImprovingDescription, setIsImprovingDescription] = useState(false);
  const [improvedDescription, setImprovedDescription] = useState<string | null>(null);
  const [originalDescription, setOriginalDescription] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiComparison, setShowAiComparison] = useState(false);

  // Check if form has enough data for duplicate check
  const canCheckDuplicates = 
    formData.title.trim().length >= 5 &&
    (formData.sector !== '' || formData.customSector.trim() !== '') &&
    formData.description.trim().length >= 20;

  // Clear duplicate check result when form data changes
  useEffect(() => {
    setDuplicateResult(null);
    setDuplicateError(null);
  }, [formData.title, formData.sector, formData.customSector, formData.description]);

  // Clear AI improvement when description changes manually
  useEffect(() => {
    if (improvedDescription && formData.description !== improvedDescription) {
      // Only reset if user manually edits (not when we apply AI improvement)
      if (!showAiComparison) {
        setImprovedDescription(null);
        setOriginalDescription(null);
        setAiError(null);
      }
    }
  }, [formData.description, improvedDescription, showAiComparison]);

  // Handle AI description improvement
  const handleImproveDescription = async () => {
    if (formData.description.trim().length < 10) {
      setAiError('Please enter at least 10 characters before improving.');
      return;
    }

    setIsImprovingDescription(true);
    setAiError(null);
    setImprovedDescription(null);
    setOriginalDescription(formData.description);

    try {
      const category = formData.sector === 'OTHER' ? formData.customSector : formData.sector;
      const response = await aiAPI.improveDescription({
        description: formData.description,
        title: formData.title,
        sector: category,
      });

      if (response.success && response.improvedDescription) {
        setImprovedDescription(response.improvedDescription);
        setShowAiComparison(true);
      } else {
        setAiError(response.error || 'Failed to improve description. Please try again.');
      }
    } catch (error: any) {
      console.error('Error improving description:', error);
      setAiError(error.message || 'Failed to improve description. Please try again.');
    } finally {
      setIsImprovingDescription(false);
    }
  };

  // Apply improved description
  const handleApplyImprovement = () => {
    if (improvedDescription) {
      setFormData(prev => ({ ...prev, description: improvedDescription }));
      setShowAiComparison(false);
      setImprovedDescription(null);
      setOriginalDescription(null);
    }
  };

  // Revert to original description
  const handleRevertDescription = () => {
    if (originalDescription) {
      setFormData(prev => ({ ...prev, description: originalDescription }));
    }
    setShowAiComparison(false);
    setImprovedDescription(null);
    setOriginalDescription(null);
  };

  // Handle duplicate check
  const handleCheckDuplicates = async () => {
    if (!canCheckDuplicates) return;

    setIsCheckingDuplicates(true);
    setDuplicateError(null);
    setDuplicateResult(null);

    try {
      const category = formData.sector === 'OTHER' ? formData.customSector : formData.sector;
      const response = await complaintsAPI.checkDuplicate({
        title: formData.title,
        category: category,
        description: formData.description,
        location: formData.location,
        coordinates: {
          latitude: mapLocation[0],
          longitude: mapLocation[1],
        },
      });

      if (response.success && response.data) {
        setDuplicateResult(response.data);
      } else {
        setDuplicateError('Failed to check for duplicates');
      }
    } catch (error: any) {
      console.error('Error checking duplicates:', error);
      setDuplicateError(error.message || 'Failed to check for duplicates');
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  // Helper function to handle file preview
  const handleFilePreview = (file: File) => {
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

  // Reverse geocode to get address from coordinates
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    console.log('🗺️ Reverse geocoding:', { lat, lng, isLoaded });
    
    // Set coordinates immediately even if geocoding fails
    const coordString = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    setFormData((prev) => ({ ...prev, location: coordString }));
    
    if (!isLoaded) {
      console.warn('⚠️ Google Maps not loaded yet, using coordinates only');
      return;
    }
    
    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });
      if (response.results[0]) {
        const address = response.results[0].formatted_address;
        console.log('✅ Address found:', address);
        setFormData((prev) => ({ ...prev, location: address }));
      } else {
        console.log('⚠️ No address found, keeping coordinates');
      }
    } catch (error) {
      console.error('❌ Geocoding error:', error);
      // Coordinates already set above
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

    // Use watchPosition for better accuracy - it continuously tracks and improves
    let watchId: number;
    let bestAccuracy = Infinity;
    let bestPosition: { lat: number; lng: number; acc: number } | null = null;
    let updateCount = 0;
    const maxWaitTime = 15000; // 15 seconds max
    const startTime = Date.now();

    const finishDetection = (latitude: number, longitude: number, accuracy: number) => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      
      console.log('✅ Final location:', { latitude, longitude, accuracy });
      setMapLocation([latitude, longitude]);
      setLocationAccuracy(accuracy);
      reverseGeocode(latitude, longitude);
      setIsDetecting(false);
      
      // Show accuracy info if not perfect
      if (accuracy > 100) {
        setTimeout(() => {
          alert(
            `Location detected with ${accuracy < 1000 ? Math.round(accuracy) + 'm' : (accuracy / 1000).toFixed(1) + 'km'} accuracy.\n\n` +
            'You can click on the map to adjust the marker for better precision.'
          );
        }, 300);
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      console.error('Geolocation error:', error);
      if (watchId) navigator.geolocation.clearWatch(watchId);
      setIsDetecting(false);
      
      // Use best position if we got one
      if (bestPosition && bestAccuracy < 10000) {
        finishDetection(bestPosition.lat, bestPosition.lng, bestPosition.acc);
        return;
      }
      
      let errorMessage = 'Location detection failed.\n\n';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage += 'Location permission was denied.\n\nPlease allow location access in your browser settings and try again.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage += 'Location information is unavailable.\n\nPlease use the search box or click on the map to select your location.';
          break;
        case error.TIMEOUT:
          errorMessage += 'Location request timed out.\n\nPlease try again or use the search box to select your location.';
          break;
        default:
          errorMessage += 'Please use the search box or click on the map to select your location.';
      }
      alert(errorMessage);
    };

    // Start watching position for continuous updates
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const elapsed = Date.now() - startTime;
        updateCount++;
        
        console.log(`📍 Position update #${updateCount}:`, { 
          latitude: latitude.toFixed(6), 
          longitude: longitude.toFixed(6), 
          accuracy: Math.round(accuracy),
          elapsed: `${(elapsed/1000).toFixed(1)}s`
        });

        // Track best position
        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
          bestPosition = { lat: latitude, lng: longitude, acc: accuracy };
          
          // Live update the map with improving position
          setMapLocation([latitude, longitude]);
          setLocationAccuracy(accuracy);
        }

        // Excellent accuracy - stop immediately
        if (accuracy <= 50) {
          console.log('🎯 Excellent accuracy achieved!');
          finishDetection(latitude, longitude, accuracy);
          return;
        }

        // Good accuracy - stop after getting it
        if (accuracy <= 100 && updateCount >= 2) {
          console.log('✅ Good accuracy achieved');
          finishDetection(latitude, longitude, accuracy);
          return;
        }

        // Acceptable accuracy after several tries
        if (accuracy <= 500 && updateCount >= 4) {
          console.log('👍 Acceptable accuracy');
          finishDetection(latitude, longitude, accuracy);
          return;
        }

        // If we've been trying for a while with poor accuracy, use best we have
        if (elapsed > 10000 && bestPosition) {
          console.log('⏱️ Time limit reached, using best position');
          finishDetection(bestPosition.lat, bestPosition.lng, bestPosition.acc);
          return;
        }

        // Max updates reached
        if (updateCount >= 8 && bestPosition) {
          console.log('📊 Max updates, using best position');
          finishDetection(bestPosition.lat, bestPosition.lng, bestPosition.acc);
          return;
        }
      },
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );

    // Absolute timeout
    setTimeout(() => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      
      if (bestPosition) {
        console.log('⏰ Absolute timeout - using best position');
        setMapLocation([bestPosition.lat, bestPosition.lng]);
        setLocationAccuracy(bestPosition.acc);
        reverseGeocode(bestPosition.lat, bestPosition.lng);
        setIsDetecting(false);
        
        if (bestAccuracy > 100) {
          alert(
            `Location detected with ${bestAccuracy < 1000 ? Math.round(bestAccuracy) + 'm' : (bestAccuracy / 1000).toFixed(1) + 'km'} accuracy.\n\n` +
            'Click on the map to adjust for better precision.'
          );
        }
      } else {
        setIsDetecting(false);
        alert(
          'Could not detect your location.\n\n' +
          'Please check that:\n' +
          '1. Location services are enabled on your device\n' +
          '2. Browser has permission to access location\n\n' +
          'You can also search for your address or click on the map.'
        );
      }
    }, maxWaitTime);
  }, [reverseGeocode]);

  // Handle autocomplete load
  const onAutocompleteLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  // Handle place selection from autocomplete
  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setMapLocation([lat, lng]);
        setLocationAccuracy(null);
        
        const address = place.formatted_address || place.name || `${lat}, ${lng}`;
        setFormData((prev) => ({ ...prev, location: address }));
      }
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggleAnonymous = () => {
    setFormData((prev) => ({ ...prev, anonymous: !prev.anonymous }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      const invalidFiles = Array.from(files).filter(file => file.size > MAX_FILE_SIZE);
      
      if (invalidFiles.length > 0) {
        alert(`Some files exceed the 5MB limit:\n${invalidFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB)`).join('\n')}`);
        e.target.value = ''; // Reset input
        return;
      }
      
      setFormData((prev) => ({
        ...prev,
        files: [...prev.files, ...Array.from(files)],
      }));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files) {
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      const invalidFiles = Array.from(files).filter(file => file.size > MAX_FILE_SIZE);
      
      if (invalidFiles.length > 0) {
        alert(`Some files exceed the 5MB limit:\n${invalidFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB)`).join('\n')}`);
        return;
      }
      
      setFormData((prev) => ({
        ...prev,
        files: [...prev.files, ...Array.from(files)],
      }));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const removeFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  // Handle location selection from GoogleMapPicker
  const handleLocationSelect = (address: string, coordinates: [number, number]) => {
    setFormData((prev) => ({ ...prev, location: address }));
    setMapLocation(coordinates);
    setLocationAccuracy(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      alert('Please login to submit a complaint');
      navigate('/login');
      return;
    }

    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Please fill in the required fields (Title and Description)');
      return;
    }

    try {
      const category = formData.sector === 'OTHER' ? formData.customSector : formData.sector;
      
      await createComplaint({
        title: formData.title,
        description: formData.description,
        category: category,
        location: formData.location || 'Location not specified',
        coordinates: {
          latitude: mapLocation[0],
          longitude: mapLocation[1],
        },
        isAnonymous: formData.anonymous,
        images: formData.files,
      });

      alert('Complaint submitted successfully!');
      // Reset form
      setFormData({
        title: '',
        sector: '',
        customSector: '',
        description: '',
        location: '',
        anonymous: false,
        files: [],
      });
      
      // Navigate to home page to see the new complaint
      navigate('/home');
    } catch (error: any) {
      console.error('Error submitting complaint:', error);
      alert(error.message || 'Failed to submit complaint. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <div className="container mx-auto px-3 xs:px-4 md:px-6 py-3 xs:py-4 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 xs:gap-4 md:gap-6 lg:gap-8">
          {/* Left Side - Form */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 xs:p-4 md:p-6 lg:p-8">
            <h1 className="text-lg xs:text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1 xs:mb-2">Report an Issue</h1>
            <p className="text-xs xs:text-sm md:text-base text-gray-600 dark:text-gray-400 mb-4 xs:mb-6 md:mb-8">
              Help us improve your community by detailing the problem below.
              Your report matters.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3 xs:space-y-4 md:space-y-6">
              {/* Title Field */}
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
                  className="w-full px-3 xs:px-4 py-2.5 xs:py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-gray-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm xs:text-base"
                />
              </div>

              {/* Sector Field */}
              <div>
                <label className="block text-xs xs:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5 xs:mb-2">
                  Sector/Category<span className="text-red-500">*</span>
                </label>
                <select
                  name="sector"
                  value={formData.sector}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value, customSector: '' })}
                  className="w-full px-3 xs:px-4 py-2.5 xs:py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm xs:text-base"
                  required
                >
                  <option value="">Select a sector</option>
                  {sectors.map((sector) => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
                
                {/* Custom Sector Input - Shows when "Other" is selected */}
                {formData.sector === 'OTHER' && (
                  <div className="mt-2 xs:mt-3">
                    <input
                      type="text"
                      value={formData.customSector}
                      onChange={(e) => setFormData({ ...formData, customSector: e.target.value })}
                      className="w-full px-3 xs:px-4 py-2.5 xs:py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm xs:text-base"
                      placeholder="Please specify the sector"
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-1">
                      Enter a custom sector name for your complaint
                    </p>
                  </div>
                )}
              </div>

              {/* Description Field */}
              <div>
                <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 xs:gap-0 mb-1.5 xs:mb-2">
                  <label className="block text-xs xs:text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Description<span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleImproveDescription}
                    disabled={isImprovingDescription || formData.description.trim().length < 10}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 xs:py-1.5 text-xs xs:text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 min-h-[40px] xs:min-h-0"
                    title={formData.description.trim().length < 10 ? "Enter at least 10 characters to improve" : "Improve description with AI"}
                  >
                    <Sparkles className={`w-4 h-4 flex-shrink-0 ${isImprovingDescription ? 'animate-pulse' : ''}`} />
                    <span>{isImprovingDescription ? 'Improving...' : 'Improve with AI'}</span>
                  </button>
                </div>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Describe the issue in detail including time and impact..."
                  className="w-full px-3 xs:px-4 py-2.5 xs:py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-gray-400 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm xs:text-base"
                />
                
                {/* AI Error Message */}
                {aiError && (
                  <div className="mt-2 p-2 xs:p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-xs xs:text-sm text-red-600 dark:text-red-400">{aiError}</p>
                  </div>
                )}

                {/* AI Improvement Comparison Modal */}
                {showAiComparison && improvedDescription && (
                  <div className="mt-3 xs:mt-4 p-3 xs:p-4 bg-gradient-to-r from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
                    <div className="flex items-center gap-2 mb-2 xs:mb-3">
                      <Sparkles className="w-4 xs:w-5 h-4 xs:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <h4 className="font-semibold text-sm xs:text-base text-gray-800 dark:text-gray-200">AI-Improved Description</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3 xs:gap-4 mb-3 xs:mb-4">
                      {/* Original */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1.5 xs:mb-2">Original</p>
                        <div className="p-2 xs:p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 text-xs xs:text-sm text-gray-700 dark:text-gray-300 max-h-32 xs:max-h-40 overflow-y-auto">
                          {originalDescription}
                        </div>
                      </div>
                      
                      {/* Improved */}
                      <div>
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase mb-1.5 xs:mb-2">✨ Improved</p>
                        <div className="p-2 xs:p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-300 dark:border-blue-600 text-xs xs:text-sm text-gray-700 dark:text-gray-300 max-h-32 xs:max-h-40 overflow-y-auto">
                          {improvedDescription}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col xs:flex-row items-stretch xs:items-center justify-end gap-2 xs:gap-3">
                      <button
                        type="button"
                        onClick={handleRevertDescription}
                        className="flex items-center justify-center gap-1.5 px-3 xs:px-4 py-2.5 xs:py-2 text-xs xs:text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition active:scale-95 min-h-[44px] xs:min-h-0"
                      >
                        <RotateCcw className="w-4 h-4 flex-shrink-0" />
                        <span>Keep Original</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyImprovement}
                        className="flex items-center justify-center gap-1.5 px-3 xs:px-4 py-2.5 xs:py-2 text-xs xs:text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition active:scale-95 min-h-[44px] xs:min-h-0"
                      >
                        <Check className="w-4 h-4 flex-shrink-0" />
                        <span>Use Improved</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Location Search Field */}
              <div>
                <label className="block text-xs xs:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5 xs:mb-2">
                  Location
                </label>
                <div className="space-y-2 xs:space-y-3">
                  {/* Search Input with Autocomplete */}
                  {isLoaded && (
                    <Autocomplete
                      onLoad={onAutocompleteLoad}
                      onPlaceChanged={onPlaceChanged}
                      options={{
                        types: ['geocode', 'establishment'],
                      }}
                    >
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                          <Search className="w-4 xs:w-5 h-4 xs:h-5" />
                        </div>
                        <input
                          type="text"
                          placeholder="Search for a location..."
                          className="w-full pl-9 xs:pl-10 pr-3 xs:pr-4 py-2.5 xs:py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-gray-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm xs:text-base"
                        />
                      </div>
                    </Autocomplete>
                  )}

                  {/* Selected Location Display with Detect Button */}
                  <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-700">
                    <div className="pl-2 xs:pl-3 text-gray-400 flex-shrink-0">
                      <MapPin className="w-4 xs:w-5 h-4 xs:h-5" />
                    </div>
                    <input
                      type="text"
                      value={formData.location}
                      placeholder="Selected location..."
                      className="flex-1 px-2 xs:px-3 py-2.5 xs:py-3 border-0 focus:ring-0 focus:outline-none placeholder-gray-400 bg-transparent text-gray-900 dark:text-white text-sm xs:text-base min-w-0 truncate"
                      readOnly
                    />
                    <button
                      type="button"
                      onClick={detectLocation}
                      disabled={isDetecting}
                      className="px-2 xs:px-4 py-2.5 xs:py-3 text-blue-600 font-semibold hover:bg-blue-50 dark:hover:bg-gray-600 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-600 text-xs xs:text-sm active:scale-95 flex-shrink-0 min-h-[44px]"
                      title="Use my current location"
                    >
                      <Navigation className="w-4 h-4 flex-shrink-0" />
                      <span className="hidden xs:inline">{isDetecting ? 'DETECTING...' : 'DETECT'}</span>
                    </button>
                  </div>

                  {/* Location Accuracy Display */}
                  {locationAccuracy !== null && (
                    <div
                      className={`p-2 xs:p-3 rounded-lg flex items-start gap-2 ${
                        locationAccuracy <= 100
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                          : locationAccuracy <= 500
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                      }`}
                    >
                      <AlertCircle
                        className={`w-4 xs:w-5 h-4 xs:h-5 flex-shrink-0 mt-0.5 ${
                          locationAccuracy <= 100
                            ? 'text-green-600 dark:text-green-400'
                            : locationAccuracy <= 500
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs xs:text-sm font-medium ${
                            locationAccuracy <= 100
                              ? 'text-green-800 dark:text-green-300'
                              : locationAccuracy <= 500
                              ? 'text-yellow-800 dark:text-yellow-300'
                              : 'text-red-800 dark:text-red-300'
                          }`}
                        >
                          Accuracy:{' '}
                          {locationAccuracy < 1000
                            ? `${Math.round(locationAccuracy)}m`
                            : `${(locationAccuracy / 1000).toFixed(1)}km`}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {locationAccuracy <= 100
                            ? '✓ Good accuracy - Location is precise'
                            : locationAccuracy <= 500
                            ? '⚠ Moderate - Adjust on map'
                            : '⚠ Low accuracy - Click map to set'}
                        </p>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Search, detect location, or tap map to select
                  </p>
                </div>
              </div>

              {/* Anonymous Toggle */}
              <div className="flex items-center justify-between py-2 gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-sm xs:text-base text-gray-800 dark:text-gray-200">Submit Anonymously</h4>
                  <p className="text-xs xs:text-sm text-gray-500 dark:text-gray-400">Your name will not be displayed</p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAnonymous}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                    formData.anonymous ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      formData.anonymous ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-xs xs:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5 xs:mb-2">
                  Evidence (Optional)
                </label>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg p-4 xs:p-6 md:p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition active:scale-[0.99] min-h-[120px] flex items-center justify-center"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-10 xs:w-12 h-10 xs:h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-2 xs:mb-3">
                      <Upload className="w-5 xs:w-6 h-5 xs:h-6 text-gray-400" />
                    </div>
                    <p className="text-xs xs:text-sm text-gray-600 dark:text-gray-400">
                      <span className="text-blue-600 font-medium">Tap to upload</span> or drag
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG or PDF (MAX. 5MB)</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".svg,.png,.jpg,.jpeg,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {/* File Preview */}
                {formData.files.length > 0 && (
                  <div className="mt-2 xs:mt-3 space-y-2">
                    {formData.files.map((file, index) => {
                      const isImage = file.type.startsWith('image/');
                      const fileUrl = URL.createObjectURL(file);
                      
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 xs:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg group"
                        >
                          <div className="flex items-center gap-2 xs:gap-3 flex-1 min-w-0">
                            {isImage ? (
                              <div 
                                className="w-8 xs:w-10 h-8 xs:h-10 rounded overflow-hidden cursor-pointer hover:opacity-80 transition flex-shrink-0 active:scale-95"
                                onClick={() => handleFilePreview(file)}
                                title="Tap to preview"
                              >
                                <img 
                                  src={fileUrl} 
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div 
                                className="w-8 xs:w-10 h-8 xs:h-10 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition flex-shrink-0 active:scale-95"
                                onClick={() => handleFilePreview(file)}
                                title="Tap to preview"
                              >
                                <Upload className="w-4 xs:w-5 h-4 xs:h-5 text-blue-600 dark:text-blue-400" />
                              </div>
                            )}
                            <span 
                              className="text-xs xs:text-sm text-gray-700 dark:text-gray-300 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition"
                              onClick={() => handleFilePreview(file)}
                              title="Tap to preview"
                            >
                              {file.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-gray-400 hover:text-red-500 transition ml-2 p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center active:scale-95"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Duplicate Check Panel */}
              <DuplicateCheckPanel
                isChecking={isCheckingDuplicates}
                result={duplicateResult}
                error={duplicateError}
                onCheckDuplicates={handleCheckDuplicates}
                canCheck={canCheckDuplicates}
              />

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || (duplicateResult?.isDuplicate === true)}
                className={`w-full py-3 xs:py-4 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 xs:gap-2 text-sm xs:text-base min-h-[48px] active:scale-[0.98] px-3 xs:px-4 ${
                  duplicateResult?.isDuplicate
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                <span className="truncate">
                  {loading ? 'Submitting...' : duplicateResult?.isDuplicate ? 'Duplicate Found' : 'Submit Complaint'}
                </span>
                {!loading && !duplicateResult?.isDuplicate && <span className="flex-shrink-0">➤</span>}
              </button>
              {duplicateResult?.isDuplicate && (
                <p className="text-xs xs:text-sm text-amber-600 dark:text-amber-400 text-center mt-2">
                  Please vote for an existing complaint instead.
                </p>
              )}
            </form>
          </div>

          {/* Right Side - Map */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden lg:sticky lg:top-8 lg:self-start h-[300px] xs:h-[350px] md:h-[450px] lg:h-full lg:min-h-[600px] order-first lg:order-last">
            <GoogleMapPicker
              onLocationSelect={handleLocationSelect}
              initialLocation={mapLocation}
              initialAddress={formData.location}
              hideSearchControls={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplaintFormPage;
