import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Circle, Autocomplete } from '@react-google-maps/api';
import { MapPin, Navigation, Search, AlertCircle, X, Info } from 'lucide-react';

// Google Maps API Key - Replace with your actual API key
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

// Libraries to load
const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ['places'];

// Map container style
const containerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '600px',
  borderRadius: '0.75rem',
};

// Default center (Dubai)
const defaultCenter = {
  lat: 25.276987,
  lng: 55.296249,
};

// Map options
const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
  clickableIcons: false,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

interface GoogleMapPickerProps {
  onLocationSelect: (location: string, coordinates: [number, number]) => void;
  initialLocation?: [number, number];
  initialAddress?: string;
  hideSearchControls?: boolean;
}

const GoogleMapPicker: React.FC<GoogleMapPickerProps> = ({
  onLocationSelect,
  initialLocation,
  initialAddress = '',
  hideSearchControls = false,
}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral>(
    initialLocation ? { lat: initialLocation[0], lng: initialLocation[1] } : defaultCenter
  );
  const [locationAddress, setLocationAddress] = useState(initialAddress);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(true);
  
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  // Reverse geocode to get address from coordinates
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (!isLoaded) return;
    
    const geocoder = new google.maps.Geocoder();
    try {
      const response = await geocoder.geocode({ location: { lat, lng } });
      if (response.results[0]) {
        const address = response.results[0].formatted_address;
        setLocationAddress(address);
        onLocationSelect(address, [lat, lng]);
      } else {
        const coordString = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setLocationAddress(coordString);
        onLocationSelect(coordString, [lat, lng]);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      const coordString = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setLocationAddress(coordString);
      onLocationSelect(coordString, [lat, lng]);
    }
  }, [isLoaded, onLocationSelect]);

  // Handle map click
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
      setLocationAccuracy(null);
      reverseGeocode(lat, lng);
    }
  }, [reverseGeocode]);

  // Handle map load
  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  // Handle map unmount
  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

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
        setMarkerPosition({ lat, lng });
        setLocationAccuracy(null);
        
        if (map) {
          map.panTo({ lat, lng });
          map.setZoom(17);
        }
        
        const address = place.formatted_address || place.name || `${lat}, ${lng}`;
        setLocationAddress(address);
        setSearchQuery('');
        onLocationSelect(address, [lat, lng]);
      }
    }
  }, [map, onLocationSelect]);

  // Detect current location with high accuracy
  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetecting(true);
    setLocationAccuracy(null);

    let bestAccuracy = Infinity;
    let updateCount = 0;
    let watchId: number;

    const stopWatching = (latitude: number, longitude: number, accuracy: number, reason: string) => {
      navigator.geolocation.clearWatch(watchId);
      setMarkerPosition({ lat: latitude, lng: longitude });
      setLocationAccuracy(accuracy);
      
      if (map) {
        map.panTo({ lat: latitude, lng: longitude });
        map.setZoom(17);
      }
      
      reverseGeocode(latitude, longitude);
      setIsDetecting(false);
      console.log(`${reason} - Final location: ${latitude}, ${longitude} (Accuracy: ${accuracy}m)`);
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        updateCount++;
        console.log(`Update #${updateCount} - Lat: ${latitude}, Lng: ${longitude}, Accuracy: ${accuracy}m`);

        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
          setMarkerPosition({ lat: latitude, lng: longitude });
          setLocationAccuracy(accuracy);

          if (map) {
            map.panTo({ lat: latitude, lng: longitude });
          }

          if (accuracy <= 50) {
            stopWatching(latitude, longitude, accuracy, '✓ Excellent accuracy achieved');
            return;
          }

          if (updateCount >= 5 && accuracy <= 100) {
            stopWatching(latitude, longitude, accuracy, '✓ Good accuracy after multiple readings');
            return;
          }
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        navigator.geolocation.clearWatch(watchId);
        setIsDetecting(false);
        setLocationAccuracy(null);

        let errorMessage = 'Unable to detect location. ';
        switch (error.code) {
          case 1:
            errorMessage += 'Please allow location access in your browser settings.';
            break;
          case 2:
            errorMessage += 'GPS/Location services unavailable. Try enabling location services or clicking on the map.';
            break;
          case 3:
            errorMessage += 'Could not get precise location in time. Try using the search box or clicking on the map.';
            break;
          default:
            errorMessage += 'Please check your browser and system location settings.';
        }
        alert(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
    );

    // Fallback timeout after 15 seconds
    const fallbackTimeout = setTimeout(() => {
      if (bestAccuracy < Infinity) {
        console.log(`⏱ Timeout reached - Using best available accuracy: ${bestAccuracy}m`);
        setIsDetecting(false);
        navigator.geolocation.clearWatch(watchId);
      } else {
        navigator.geolocation.clearWatch(watchId);
        setIsDetecting(false);
        setLocationAccuracy(null);
        alert('Could not detect location. Please use the search box or click directly on the map.');
      }
    }, 15000);

    return () => clearTimeout(fallbackTimeout);
  }, [map, reverseGeocode]);

  // Update marker position when initialLocation changes
  useEffect(() => {
    if (initialLocation) {
      setMarkerPosition({ lat: initialLocation[0], lng: initialLocation[1] });
      if (map) {
        map.panTo({ lat: initialLocation[0], lng: initialLocation[1] });
      }
    }
  }, [initialLocation, map]);

  // Error state
  if (loadError) {
    return (
      <div className="h-full min-h-[600px] bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Failed to load Google Maps
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Please check your API key and try again.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (!isLoaded) {
    return (
      <div className="h-full min-h-[600px] bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {/* Location Tooltip */}
      {!hideSearchControls && showTooltip && (
        <div className="absolute top-4 left-4 right-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200">📍 How to Select Location</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 mt-1 space-y-1">
              <li>• Click anywhere on the map to place a marker</li>
              <li>• Search for an address using the search box</li>
              <li>• Click "DETECT" to use your current location</li>
            </ul>
          </div>
          <button
            onClick={() => setShowTooltip(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Search Box */}
      {!hideSearchControls && (
        <div className="absolute top-4 left-4 right-4 z-10 space-y-3" style={{ top: showTooltip ? '140px' : '16px' }}>
          <div className="relative">
            <Autocomplete
              onLoad={onAutocompleteLoad}
              onPlaceChanged={onPlaceChanged}
              options={{
                types: ['geocode', 'establishment'],
              }}
            >
              <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div className="pl-4 text-gray-400">
                  <Search className="w-5 h-5" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a location..."
                  className="flex-1 px-3 py-3 border-0 focus:ring-0 focus:outline-none placeholder-gray-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </Autocomplete>
          </div>

          {/* Selected Location Display */}
          <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="pl-4 text-gray-400">
              <MapPin className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={locationAddress}
              placeholder="Selected location will appear here..."
              className="flex-1 px-3 py-3 border-0 focus:ring-0 focus:outline-none placeholder-gray-400 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
              readOnly
            />
            <button
              type="button"
              onClick={detectLocation}
              disabled={isDetecting}
              className="px-4 py-3 text-blue-600 font-semibold hover:bg-blue-50 dark:hover:bg-gray-700 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800"
              title="Use my current location"
            >
              <Navigation className="w-4 h-4" />
              {isDetecting ? 'DETECTING...' : 'DETECT'}
            </button>
          </div>

          {/* Location Accuracy Display */}
          {locationAccuracy !== null && (
            <div
              className={`p-3 rounded-lg flex items-start gap-2 shadow-lg ${
                locationAccuracy <= 100
                  ? 'bg-green-50 border border-green-200'
                  : locationAccuracy <= 500
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <AlertCircle
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  locationAccuracy <= 100
                    ? 'text-green-600'
                    : locationAccuracy <= 500
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              />
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    locationAccuracy <= 100
                      ? 'text-green-800'
                      : locationAccuracy <= 500
                      ? 'text-yellow-800'
                      : 'text-red-800'
                  }`}
                >
                  Accuracy:{' '}
                  {locationAccuracy < 1000
                    ? `${Math.round(locationAccuracy)}m`
                    : `${(locationAccuracy / 1000).toFixed(1)}km`}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {locationAccuracy <= 100
                    ? '✓ Good accuracy - Location is precise'
                    : locationAccuracy <= 500
                    ? '⚠ Moderate accuracy - Consider clicking on map to adjust'
                    : '⚠ Low accuracy - Please click on the map to set exact location'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Google Map */}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={markerPosition}
        zoom={15}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        options={mapOptions}
      >
        {/* Marker */}
        <Marker
          position={markerPosition}
          animation={google.maps.Animation.DROP}
        />

        {/* Accuracy Circle */}
        {locationAccuracy !== null && (
          <Circle
            center={markerPosition}
            radius={locationAccuracy}
            options={{
              strokeColor: locationAccuracy <= 100 ? '#10b981' : locationAccuracy <= 500 ? '#f59e0b' : '#ef4444',
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: locationAccuracy <= 100 ? '#10b981' : locationAccuracy <= 500 ? '#f59e0b' : '#ef4444',
              fillOpacity: 0.15,
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
};

export default GoogleMapPicker;
