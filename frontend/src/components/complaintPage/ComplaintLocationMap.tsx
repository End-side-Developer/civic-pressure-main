import React from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { MapPin } from 'lucide-react';

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

// Libraries to load
const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ['places'];

// Map container style
const containerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '0.75rem',
};

// Map options
const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: true,
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

interface ComplaintLocationMapProps {
  coordinates: [number, number];
  location: string;
}

const ComplaintLocationMap: React.FC<ComplaintLocationMapProps> = ({
  coordinates,
  location,
}) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const center = {
    lat: coordinates[0],
    lng: coordinates[1],
  };

  if (loadError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
        <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
          <MapPin className="w-5 h-5" />
          <div>
            <p className="font-semibold">Unable to load map</p>
            <p className="text-sm text-red-600 dark:text-red-500">
              Please check your Google Maps API configuration
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-[400px] bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Loading map...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-blue-600" />
        Complaint Location
      </h3>
      
      {/* Location Address */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Address</p>
        <p className="text-gray-900 dark:text-white font-medium">{location}</p>
      </div>

      {/* Map Display */}
      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={15}
          options={mapOptions}
        >
          <Marker
            position={center}
            title={location}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#3B82F6',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            }}
          />
        </GoogleMap>
      </div>

      {/* Coordinates Info */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Latitude: {coordinates[0].toFixed(6)}</span>
        <span>Longitude: {coordinates[1].toFixed(6)}</span>
      </div>
    </div>
  );
};

export default ComplaintLocationMap;
