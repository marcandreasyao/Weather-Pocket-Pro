
import React, { useEffect, useRef } from 'react';
import { LocationData, ActiveTab, ModalContent } from '../types';
import { ExpandIcon, CloseIcon } from './Icons';

declare var L: any; // From leaflet.js script
const OWM_API_KEY = '041fbadab5535ba6219544663f5cb1a1';

interface WeatherMapProps {
  location: LocationData | null;
  isModal: boolean;
  activeTab?: ActiveTab;
}

export const WeatherMap: React.FC<WeatherMapProps> = ({ location, isModal, activeTab }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!location || !mapContainerRef.current) return;

    const { lat, lon, name } = location;
    
    if (!mapRef.current) {
        mapRef.current = L.map(mapContainerRef.current, { zoomControl: false }).setView([lat, lon], 9);
        L.control.zoom({ position: 'topright' }).addTo(mapRef.current);

        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' });
        const satelliteLayer = L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
        
        const baseMaps = { "Street Map": osmLayer, "Satellite": satelliteLayer };
        const weatherAttrib = '&copy; <a href="https://openweathermap.org/">OWM</a>';
        
        const cloudsLayer = L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`, { opacity: 0.7, attribution: weatherAttrib });
        const precipitationLayer = L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`, { opacity: 0.7, attribution: weatherAttrib });

        const overlayMaps = {
            "Clouds": cloudsLayer,
            "Precipitation": precipitationLayer,
        };

        osmLayer.addTo(mapRef.current);
        cloudsLayer.addTo(mapRef.current);
        precipitationLayer.addTo(mapRef.current);

        L.control.layers(baseMaps, overlayMaps, { position: 'topright' }).addTo(mapRef.current);
        L.marker([lat, lon]).addTo(mapRef.current).bindPopup(`<b>${name}</b>`);
    } else {
        mapRef.current.setView([lat, lon], 9);
        // Update marker
        mapRef.current.eachLayer((layer: any) => {
            if (layer instanceof L.Marker) {
                layer.setLatLng([lat, lon]).bindPopup(`<b>${name}</b>`);
            }
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 300); // A small delay can help ensure the container has resized.
    }
  }, [isModal, activeTab]);

  if (!location) {
    return <div id="weatherMap" className="flex items-center justify-center"><p className="text-center text-gray-500 p-4">Map will load after location is determined.</p></div>;
  }

  return <div id="weatherMap" ref={mapContainerRef} />;
};

interface DataMapProps {
    location: LocationData | null;
}

export const DataMap: React.FC<DataMapProps> = ({ location }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        let dynamicParams = location ? `&lat=${location.lat.toFixed(5)}&lon=${location.lon.toFixed(5)}` : "&geoloc=detect";
        const baseUrl = "https://www.meteoblue.com/en/weather/maps/widget?";
        const params = `windAnimation=1&gust=0&satellite=1&cloudsAndPrecipitation=0&temperature=1&sunshine=1&extremeForecastIndex=1${dynamicParams}&tempunit=C&windunit=km%252Fh&lengthunit=metric&zoom=7&autowidth=auto`;
        const newSrc = baseUrl + params;

        if (iframeRef.current && iframeRef.current.src !== newSrc) {
            iframeRef.current.src = newSrc;
        }
    }, [location]);

    return (
        <div id="meteoblueMapContainer" className="maps-custom-design">
            <iframe
                ref={iframeRef}
                src="about:blank"
                frameBorder="0"
                scrolling="NO"
                allowTransparency={true}
                sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
                style={{ width: '100%', height: '100%' }}
                title="Meteoblue Weather Map"
            ></iframe>
        </div>
    );
};


interface MapModalProps {
  modalContent: ModalContent;
  location: LocationData | null;
  onClose: () => void;
}

export const MapModal: React.FC<MapModalProps> = ({ modalContent, location, onClose }) => {
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
           if (event.key === 'Escape') {
              onClose();
           }
        };
        window.addEventListener('keydown', handleEsc);
        document.body.classList.add('modal-open');

        return () => {
          window.removeEventListener('keydown', handleEsc);
          document.body.classList.remove('modal-open');
        };
    }, [onClose]);

    if (!modalContent) return null;

    return (
        <div id="mapModalOverlay" className="visible" onClick={onClose}>
            <div id="mapModalContent" onClick={e => e.stopPropagation()}>
                <button id="closeMapModalButton" className="icon-button" title="Close Map" onClick={onClose}>
                    <CloseIcon />
                </button>
                <div id="modalMapContentContainer">
                    {modalContent === 'map' && <WeatherMap location={location} isModal={true} />}
                    {modalContent === 'data' && <DataMap location={location} />}
                </div>
            </div>
        </div>
    );
};

interface MapTabsProps {
    activeTab: ActiveTab;
    setActiveTab: (tab: ActiveTab) => void;
    setModalContent: (content: ModalContent) => void;
    location: LocationData | null;
}

export const MapTabs: React.FC<MapTabsProps> = ({ activeTab, setActiveTab, setModalContent, location }) => {
    return (
        <div className="weather-card p-4 tab-container">
            <div className="tab-buttons">
                <button className={`tab-button ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>Weather Map</button>
                <button className={`tab-button ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>Weather Data</button>
            </div>
            <div style={{ display: activeTab === 'map' ? 'block' : 'none' }} className="relative">
                <button id="expandMapButton" className="icon-button" title="Expand Map" onClick={() => setModalContent('map')}>
                    <ExpandIcon />
                </button>
                <WeatherMap location={location} isModal={false} activeTab={activeTab} />
                <p className="text-xs text-gray-500 mt-3 text-center">Map: © OpenStreetMap/ESRI | Weather: © OpenWeatherMap</p>
            </div>
            <div style={{ display: activeTab === 'data' ? 'block' : 'none' }} className="relative">
                <button id="expandDataButton" className="icon-button" title="Expand Data View" onClick={() => setModalContent('data')}>
                    <ExpandIcon />
                </button>
                <DataMap location={location} />
                <p className="text-xs text-gray-500 mt-3 text-center">Data & Map: © meteoblue</p>
            </div>
        </div>
    );
};