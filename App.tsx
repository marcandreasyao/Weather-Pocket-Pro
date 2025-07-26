import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppData, LocationData, OwmCurrentWeather, OwmForecast, OwmForecastItem, TomorrowCurrentData, TomorrowForecastData, TomorrowForecastTimeline, Units, WeatherProvider, ActiveTab, ModalContent } from './types';
import { fetchWeatherData, fetchCitySuggestions, formatTime, degreesToCardinal, getAccuWeatherIconUrl, getThemeClassName } from './services/api';
import { SearchIcon, LocationIcon, HomeIcon, BookmarkIcon, RemoveFavoriteIcon, ThermometerIcon, HumidityIcon, WindIcon, WindDirectionIcon as WindDirSvg, PressureIcon, UvIndexIcon, SunriseIcon, SunsetIcon } from './components/Icons';
import { MapTabs, MapModal } from './components/MapComponents';

declare var Awesomplete: any; // From script tag

const useFavorites = (currentCityName: string | null) => {
    const [favorites, setFavorites] = useState<string[]>([]);
    const [isFavorite, setIsFavorite] = useState(false);

    useEffect(() => {
        try {
            const storedFavorites = localStorage.getItem('weatherAppFavorites');
            const loadedFavorites = storedFavorites ? JSON.parse(storedFavorites) : [];
            setFavorites(loadedFavorites);
        } catch (e) { console.error("Could not load favorites:", e); }
    }, []);

    useEffect(() => {
        setIsFavorite(!!currentCityName && favorites.includes(currentCityName));
    }, [currentCityName, favorites]);

    const toggleFavorite = useCallback(() => {
        if (!currentCityName) return;
        const newFavorites = favorites.includes(currentCityName)
            ? favorites.filter(fav => fav !== currentCityName)
            : [...favorites, currentCityName];
        setFavorites(newFavorites);
        try {
            localStorage.setItem('weatherAppFavorites', JSON.stringify(newFavorites));
        } catch (e) { console.error("Could not save favorites:", e); }
    }, [currentCityName, favorites]);
    
    const removeFavorite = (city: string) => {
        const newFavorites = favorites.filter(fav => fav !== city);
        setFavorites(newFavorites);
        localStorage.setItem('weatherAppFavorites', JSON.stringify(newFavorites));
    };

    return { favorites, isFavorite, toggleFavorite, removeFavorite };
};

const SkeletonLoader: React.FC = () => (
    <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <div className="bg-gray-300/40 p-6 rounded-xl">
            <div className="h-6 bg-gray-400/50 rounded w-3/4 mb-5"></div>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <div className="h-12 bg-gray-400/50 rounded w-24 mb-2"></div>
                    <div className="h-5 bg-gray-400/50 rounded w-32"></div>
                </div>
                <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-400/50 rounded-full"></div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4">
                {[...Array(7)].map((_, i) => <div key={i} className="h-4 bg-gray-400/50 rounded w-full"></div>)}
            </div>
        </div>
        <div className="bg-gray-300/40 p-4 rounded-xl">
             <div className="flex space-x-4 border-b border-gray-400/30 mb-4">
                <div className="h-8 bg-gray-400/50 rounded w-1/3"></div>
                <div className="h-8 bg-gray-400/50 rounded w-1/3"></div>
            </div>
            <div className="h-[350px] bg-gray-400/50 rounded-lg"></div>
        </div>
        <div className="md:col-span-2 bg-gray-300/40 p-6 rounded-xl">
             <div className="h-6 bg-gray-400/50 rounded w-1/3 mb-5"></div>
             <div className="flex space-x-3 overflow-x-hidden pb-4">
                 {[...Array(7)].map((_, i) => <div key={i} className="flex-shrink-0 w-24 h-32 bg-gray-400/50 rounded-xl"></div>)}
             </div>
        </div>
    </div>
);


const Header: React.FC<{
    onSearch: (city: string) => void;
    onGeolocate: () => void;
    units: Units;
    setUnits: (units: Units) => void;
    provider: WeatherProvider;
    setProvider: (provider: WeatherProvider) => void;
    favorites: string[];
    removeFavorite: (city: string) => void;
}> = ({ onSearch, onGeolocate, units, setUnits, provider, setProvider, favorites, removeFavorite }) => {
    const [city, setCity] = useState('');
    const [showFavorites, setShowFavorites] = useState(false);
    const [showProviderDropdown, setShowProviderDropdown] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const favoritesRef = useRef<HTMLDivElement>(null);
    const providerRef = useRef<HTMLDivElement>(null);
    const awesompleteRef = useRef<any>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (favoritesRef.current && !favoritesRef.current.contains(event.target as Node)) {
                setShowFavorites(false);
            }
            if (providerRef.current && !providerRef.current.contains(event.target as Node)) {
                setShowProviderDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        if (inputRef.current && !awesompleteRef.current) {
            awesompleteRef.current = new Awesomplete(inputRef.current, {
                minChars: 3,
                maxItems: 10,
                autoFirst: true,
                filter: () => true,
                sort: false,
                container: () => {
                    const container = document.createElement('div');
                    container.className = 'awesomplete-custom';
                    return container;
                }
            });

            inputRef.current.addEventListener('awesomplete-selectcomplete', (e: any) => {
                const selectedValue = e.text.value;
                setCity(selectedValue);
                onSearch(selectedValue);
            });

            inputRef.current.addEventListener('awesomplete-close', () => {
                if (!inputRef.current?.value.trim()) {
                    clearSuggestions();
                }
            });
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            if (awesompleteRef.current) {
                awesompleteRef.current.destroy();
                awesompleteRef.current = null;
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const debounce = (func: (...args: any[]) => void, delay: number) => {
        let timeoutId: NodeJS.Timeout;
        return (...args: any[]) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func(...args);
            }, delay);
        };
    };

    const fetchSuggestions = useCallback(
        debounce(async (query: string) => {
            if (query.length >= 3) {
                try {
                    const suggestions = await fetchCitySuggestions(query);
                    if (awesompleteRef.current) {
                        awesompleteRef.current.list = suggestions;
                    }
                } catch (error) {
                    console.error("Failed to fetch city suggestions:", error);
                }
            } else {
                if (awesompleteRef.current) {
                    awesompleteRef.current.list = [];
                }
            }
        }, 300),
        []
    );

    const clearSuggestions = () => {
        if (awesompleteRef.current) {
            awesompleteRef.current.list = [];
            awesompleteRef.current.close();
        }
    };

    const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setCity(query);
        
        if (query.trim() === '') {
            clearSuggestions();
        } else {
            fetchSuggestions(query);
        }
    };
    
    const handleSearchClick = () => {
        const trimmedCity = city.trim();
        if (trimmedCity) {
            onSearch(trimmedCity);
            clearSuggestions();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Always prevent default to handle all cases
            
            const isAwesompleteActive = awesompleteRef.current && 
                                      !awesompleteRef.current.ul.hidden && 
                                      awesompleteRef.current.index !== -1;

            if (isAwesompleteActive) {
                // Let Awesomplete handle the selection
                awesompleteRef.current.select();
            } else {
                handleSearchClick();
            }
        } else if (e.key === 'Escape') {
            clearSuggestions();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            // Let default behavior for navigation
            if (awesompleteRef.current && awesompleteRef.current.ul.childNodes.length > 0) {
                return;
            }
            e.preventDefault();
        }
    };

    return (
        <>
            {/* <div className="w-full flex justify-center">
                <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 bg-gradient-to-r from-[#007AFF] via-[#004999] to-[#16A14A] inline-block text-transparent bg-clip-text">Weather Pocket Pro</h1>
            </div> */}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6 md:mb-8 text-center">Weather Pocket Pro</h1>
            <div className="mb-6 md:mb-8 flex flex-col sm:flex-row items-center justify-center sm:justify-start w-full gap-4 sm:gap-3">
                {/* Search Group */}
                <div className="relative flex items-center gap-3 w-full sm:w-auto min-w-[280px] sm:min-w-0">
                    <div className="search-input-wrapper w-full sm:w-[280px] relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={city}
                            onChange={handleCityChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Enter city name..."
                            className="search-input text-gray-800 w-full pr-8 min-h-[44px] sm:min-h-0"
                            aria-label="City Name Input with Autocomplete"
                        />
                        {city && (
                            <button
                                onClick={() => {
                                    setCity('');
                                    clearSuggestions();
                                    if (inputRef.current) {
                                        inputRef.current.focus();
                                    }
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                title="Clear search"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                </svg>
                            </button>
                        )}
                    </div>
                    <button id="searchButton" onClick={handleSearchClick} className="action-button flex-shrink-0 [&>svg]:mr-0" title="Search">
                        <SearchIcon />
                    </button>
                </div>

                {/* Controls Group */}
                <div className="flex items-center justify-center sm:justify-start flex-wrap gap-4 sm:gap-3 w-full sm:w-auto sm:ml-auto">
                    <button id="locationButton" onClick={onGeolocate} className="action-button flex-shrink-0 min-w-[140px] sm:min-w-0 min-h-[44px] sm:min-h-0">
                        <LocationIcon />
                        <span className="inline ml-1.5">My Location</span>
                    </button>
                     <div className="favorites-dropdown" ref={favoritesRef}>
                        <button id="favoritesButton" title="View favorite locations" className={`action-button flex-shrink-0 ${favorites.length > 0 ? 'has-favorites' : ''}`} onClick={() => setShowFavorites(!showFavorites)}>
                            <HomeIcon />
                        </button>
                         {showFavorites && (
                            <ul id="favoritesList" className="show">
                                {favorites.length > 0 ? favorites.map(fav => (
                                    <li key={fav} onClick={() => { onSearch(fav); setShowFavorites(false); }}>
                                        <span>{fav}</span>
                                        <button className="remove-favorite-btn" title={`Remove ${fav}`} onClick={(e) => { e.stopPropagation(); removeFavorite(fav);}}>
                                            <RemoveFavoriteIcon />
                                        </button>
                                    </li>
                                )) : <li className="text-center text-gray-500 pointer-events-none">No favorites saved.</li>}
                            </ul>
                        )}
                    </div>
                    <label className="unit-toggle-label flex-shrink-0" title="Switch Units">
                        <input type="checkbox" checked={units === 'imperial'} onChange={e => setUnits(e.target.checked ? 'imperial' : 'metric')} className="unit-toggle-input" />
                        <span className="unit-toggle-button"></span>
                        <span className="unit-toggle-text unit-toggle-text-metric">Metr.</span>
                        <span className="unit-toggle-text unit-toggle-text-imperial">Imp.</span>
                    </label>
                    <div className="provider-dropdown relative">
                        <button
                            type="button"
                            onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                            className="action-button flex-shrink-0 min-w-[160px] sm:min-w-[180px] min-h-[44px] sm:min-h-[42px] flex items-center justify-between px-3"
                            title="Select weather provider"
                        >
                            <span className="flex items-center gap-2">
                                {provider === 'owm' ? (
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-5.5l4.88-4.88-1.41-1.41L10 11.68 7.71 9.39l-1.42 1.42L10 14.5z"/>
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79zM1 10.5h3v2H1zM11 .55h2V3.5h-2zm8.04 2.495l1.408 1.407-1.79 1.79-1.407-1.408zm-1.8 15.115l1.79 1.8 1.41-1.41-1.8-1.79zM20 10.5h3v2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm-1 4h2v2.95h-2zm-7.45-.96l1.41 1.41 1.79-1.8-1.41-1.41z"/>
                                    </svg>
                                )}
                                {provider === 'owm' ? 'Standard' : 'Advanced'}
                                {/* {provider === 'owm' ? 'OpenWeatherMap' : 'Tomorrow.io'} */}
                                {/* <span className="text-xs text-gray-500">
                                    {provider === 'owm' ? '(Standard)' : '(Advanced)'}
                                </span> */}
                            </span>
                            <svg className={`w-4 h-4 transition-transform ${showProviderDropdown ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                        {showProviderDropdown && (
                            <ul className="provider-list absolute right-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                <li
                                    className={`flex items-center gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors ${provider === 'owm' ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}`}
                                    onClick={() => { setProvider('owm'); setShowProviderDropdown(false); }}
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-5.5l4.88-4.88-1.41-1.41L10 11.68 7.71 9.39l-1.42 1.42L10 14.5z"/>
                                    </svg>
                                    Standard
                                    {/* Standard (OpenWeatherMap) */}
                                </li>
                                <li
                                    className={`flex items-center gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors ${provider === 'tomorrow' ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}`}
                                    onClick={() => { setProvider('tomorrow'); setShowProviderDropdown(false); }}
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79zM1 10.5h3v2H1zM11 .55h2V3.5h-2zm8.04 2.495l1.408 1.407-1.79 1.79-1.407-1.408zm-1.8 15.115l1.79 1.8 1.41-1.41-1.8-1.79zM20 10.5h3v2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm-1 4h2v2.95h-2zm-7.45-.96l1.41 1.41 1.79-1.8-1.41-1.41z"/>
                                    </svg>
                                    Advanced 
                                    {/* Advanced (Tomorrow.io) */}
                                </li>
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};


const CurrentWeather: React.FC<{
    data: AppData | null;
    provider: WeatherProvider;
    units: Units;
    isFavorite: boolean;
    toggleFavorite: () => void;
}> = ({ data, provider, units, isFavorite, toggleFavorite }) => {
    const tempUnit = units === 'metric' ? '°C' : '°F';
    const speedUnit = units === 'metric' ? 'm/s' : 'mph';
    
    if (!data?.owm?.current) {
        return <div className="weather-card p-6 min-h-[310px]"></div>; // Return an empty card of similar size to avoid layout shift
    }

    const owm = data.owm.current;
    const tomorrow = data.tomorrow?.current?.data?.values;
    let displayData;

    if (provider === 'tomorrow' && tomorrow) {
        displayData = {
            locationName: `${owm.name}, ${owm.sys.country}`,
            temperature: `${Math.round(tomorrow.temperature)}`,
            description: owm.weather[0].description,
            icon: getAccuWeatherIconUrl(owm.weather[0].icon),
            feelsLike: `${Math.round(tomorrow.temperatureApparent)}`,
            humidity: `${Math.round(tomorrow.humidity)}`,
            windSpeed: tomorrow.windSpeed.toFixed(1),
            windDirection: degreesToCardinal(tomorrow.windDirection),
            windDeg: tomorrow.windDirection,
            pressure: `${Math.round(tomorrow.pressureSeaLevel)}`,
            uvIndex: tomorrow.uvIndex !== undefined ? tomorrow.uvIndex : 'N/A',
            sunrise: formatTime(owm.sys.sunrise, owm.timezone),
            sunset: formatTime(owm.sys.sunset, owm.timezone),
        };
    } else { // Default to OWM data
        displayData = {
            locationName: `${owm.name}, ${owm.sys.country}`,
            temperature: `${Math.round(owm.main.temp)}`,
            description: owm.weather[0].description,
            icon: getAccuWeatherIconUrl(owm.weather[0].icon),
            feelsLike: `${Math.round(owm.main.feels_like)}`,
            humidity: `${owm.main.humidity}`,
            windSpeed: owm.wind.speed.toFixed(1),
            windDirection: degreesToCardinal(owm.wind.deg),
            windDeg: owm.wind.deg,
            pressure: `${owm.main.pressure}`,
            uvIndex: owm.uvi !== undefined ? owm.uvi : 'N/A',
            sunrise: formatTime(owm.sys.sunrise, owm.timezone),
            sunset: formatTime(owm.sys.sunset, owm.timezone),
        };
    }

    return (
        <div className="weather-card p-6">
            <button id="favoriteButton" className={`icon-button ${isFavorite ? 'favorited' : ''}`} title={isFavorite ? 'Remove bookmark' : 'Bookmark this location'} onClick={toggleFavorite}>
                <BookmarkIcon />
            </button>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">{displayData.locationName}</h2>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-6xl md:text-7xl font-bold text-gray-900">{displayData.temperature}{tempUnit}</p>
                    <p className="text-xl text-gray-700 mt-1 capitalize">{displayData.description}</p>
                </div>
                <img src={displayData.icon} alt={displayData.description} className="w-24 h-24 md:w-32 md:h-32 drop-shadow-lg object-contain" />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-gray-600 mt-4">
                <p className="flex items-center"><ThermometerIcon /><span className="font-medium text-gray-700 mr-1">Feels like:</span> {displayData.feelsLike}{tempUnit}</p>
                <p className="flex items-center"><HumidityIcon /><span className="font-medium text-gray-700 mr-1">Humidity:</span> {displayData.humidity}%</p>
                <p className="flex items-center"><WindIcon /><span className="font-medium text-gray-700 mr-1">Wind:</span> {displayData.windSpeed} {speedUnit} ({displayData.windDirection}) <WindDirSvg deg={displayData.windDeg} /></p>
                <p className="flex items-center"><PressureIcon /><span className="font-medium text-gray-700 mr-1">Pressure:</span> {displayData.pressure} hPa</p>
                <p className="flex items-center"><UvIndexIcon /><span className="font-medium text-gray-700 mr-1">UV Index:</span> {displayData.uvIndex}</p>
                <p className="flex items-center"><SunriseIcon /><span className="font-medium text-gray-700 mr-1">Sunrise:</span> {displayData.sunrise}</p>
                <p className="flex items-center"><SunsetIcon /><span className="font-medium text-gray-700 mr-1">Sunset:</span> {displayData.sunset}</p>
            </div>
        </div>
    );
};

const HourlyForecast: React.FC<{ data: AppData | null; provider: WeatherProvider; units: Units; }> = ({ data, provider, units }) => {
    let hourlyItems: any[] = [];
    
    if (provider === 'tomorrow' && data?.tomorrow?.forecast?.timelines?.hourly && data?.owm?.forecast?.list) {
        const owmForecastList = data.owm.forecast.list;
        hourlyItems = data.tomorrow.forecast.timelines.hourly.slice(0, 16).map((item: TomorrowForecastTimeline) => {
            const itemTime = new Date(item.time).getTime();
            // Find closest OWM forecast item for the icon
            const closestOwmItem = owmForecastList.reduce((prev, curr) => {
                return (Math.abs(new Date(curr.dt * 1000).getTime() - itemTime) < Math.abs(new Date(prev.dt * 1000).getTime() - itemTime) ? curr : prev);
            });
            
            return {
                time: new Date(item.time).toLocaleTimeString(navigator.language, { hour: 'numeric', hour12: true }),
                temp: Math.round(item.values.temperature || 0),
                icon: getAccuWeatherIconUrl(closestOwmItem.weather[0].icon),
                description: `Code: ${item.values.weatherCode}`,
                pop: Math.round(item.values.precipitationProbability || 0),
            };
        });
    } else if (data?.owm?.forecast) { // Default to OWM provider
        hourlyItems = data.owm.forecast.list.slice(0, 16).map((item: OwmForecastItem) => ({
            time: new Date(item.dt * 1000).toLocaleTimeString(navigator.language, { hour: 'numeric', hour12: true }),
            temp: Math.round(item.main.temp),
            icon: getAccuWeatherIconUrl(item.weather[0].icon),
            description: item.weather[0].description,
            pop: Math.round(item.pop * 100),
        }));
    }

    if(hourlyItems.length === 0) return <div className="md:col-span-2 weather-card p-6"><h2 className="text-2xl font-semibold text-gray-700 mb-4">Hourly Forecast</h2><p>Hourly forecast data not available.</p></div>

    return (
        <div className="md:col-span-2 weather-card p-6">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Hourly Forecast</h2>
            <div className="hourly-container flex space-x-3 overflow-x-auto pb-4">
                {hourlyItems.map((item, index) => (
                    <div key={index} className="hourly-card flex-shrink-0 w-24 text-center p-3 rounded-lg">
                        <p className="text-xs font-medium text-gray-600">{item.time}</p>
                        <img src={item.icon} alt={item.description} className="w-10 h-10 mx-auto drop-shadow-lg object-contain" />
                        <p className="text-lg font-semibold text-gray-800">{item.temp}°</p>
                        {item.pop > 5 ? <p className="text-xs text-blue-600 font-medium mt-1">{item.pop}%</p> : <p className="text-xs text-transparent mt-1">.</p>}
                    </div>
                ))}
            </div>
        </div>
    );
}

const DailyForecast: React.FC<{ data: AppData | null; provider: WeatherProvider; units: Units; }> = ({ data, provider, units }) => {
    let dailyItems: any[] = [];
    const tempUnit = units === 'metric' ? '°C' : '°F';

    if (provider === 'tomorrow' && data?.tomorrow?.forecast?.timelines?.daily && data?.owm?.forecast?.list) {
        const owmForecastList = data.owm.forecast.list;
        dailyItems = data.tomorrow.forecast.timelines.daily.slice(0, 5).map(item => {
            const itemDate = new Date(item.time).toISOString().split('T')[0];
            const owmIconsForDay: { [key: string]: number } = {};
            owmForecastList
                .filter(owmItem => new Date(owmItem.dt * 1000).toISOString().split('T')[0] === itemDate)
                .forEach(owmItem => {
                    const icon = owmItem.weather[0].icon;
                    owmIconsForDay[icon] = (owmIconsForDay[icon] || 0) + 1;
                });
            const repIcon = Object.keys(owmIconsForDay).length > 0
                ? Object.keys(owmIconsForDay).reduce((a, b) => owmIconsForDay[a] > owmIconsForDay[b] ? a : b)
                : null;
            return {
                day: new Date(item.time).toLocaleDateString(navigator.language, { weekday: 'short' }),
                maxTemp: Math.round(item.values.temperatureMax || 0),
                minTemp: Math.round(item.values.temperatureMin || 0),
                icon: getAccuWeatherIconUrl(repIcon),
                description: `Code: ${item.values.weatherCode}`
            };
        });
    } else if (data?.owm?.forecast) { // Default to OWM logic
        const dailyData: { [key:string]: any } = {};
        const today = new Date();
        today.setHours(0,0,0,0);

        data.owm.forecast.list.forEach(item => {
            const itemDate = new Date(item.dt * 1000);
            itemDate.setHours(0,0,0,0);
            if (itemDate.getTime() <= today.getTime()) return; 

            const day = itemDate.toISOString().split('T')[0];
            if (!dailyData[day]) {
                dailyData[day] = { temps: [], icons: {} };
            }
            dailyData[day].temps.push(item.main.temp);
            const icon = item.weather[0].icon;
            dailyData[day].icons[icon] = (dailyData[day].icons[icon] || 0) + 1;
        });

        dailyItems = Object.keys(dailyData).slice(0, 5).map(day => {
            const dayData = dailyData[day];
            const repIcon = Object.keys(dayData.icons).reduce((a, b) => dayData.icons[a] > dayData.icons[b] ? a : b);
            return {
                day: new Date(`${day}T00:00:00`).toLocaleDateString(navigator.language, { weekday: 'short' }),
                maxTemp: Math.round(Math.max(...dayData.temps)),
                minTemp: Math.round(Math.min(...dayData.temps)),
                icon: getAccuWeatherIconUrl(repIcon),
                description: 'Daily forecast'
            }
        });
    }

    if(dailyItems.length === 0) return <div className="md:col-span-2 weather-card p-6"><h2 className="text-2xl font-semibold text-gray-700 mb-4">5-Day Forecast</h2><p>Daily forecast data not available.</p></div>
    
    return (
        <div className="md:col-span-2 weather-card p-6">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">5-Day Forecast</h2>
            <div className="forecast-container grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pb-4">
                {dailyItems.map((item, index) => (
                    <div key={index} className="forecast-card flex flex-col text-center p-4 rounded-xl transition-transform duration-200 ease-in-out hover:scale-105 hover:shadow-lg">
                        <p className="font-semibold text-blue-800 text-sm mb-1">{item.day}</p>
                        <img src={item.icon} alt={item.description} className="w-20 h-20 mx-auto my-1 drop-shadow-lg object-contain"/>
                        <p className="text-lg font-medium text-gray-800 mt-1">
                            <span className="text-red-600">{item.maxTemp}°</span> / <span className="text-blue-600">{item.minTemp}{tempUnit}</span>
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const WelcomeMessage: React.FC = () => (
    <div className="text-center py-16 text-gray-500 fade-in min-h-[500px] flex flex-col justify-center items-center" role="main">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-blue-300 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
        <h2 className="text-2xl font-medium mb-2 text-gray-900">Welcome to Weather Pocket Pro</h2>
        <p className="max-w-md">
            To get started, search for a city by name or use the 
            <span className="font-semibold text-gray-600"> "My Location" </span> 
            button to see the weather for your current position.
        </p>
    </div>
);

const App: React.FC = () => {
    const [data, setData] = useState<AppData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [units, setUnits] = useState<Units>('metric');
    const [provider, setProvider] = useState<WeatherProvider>('owm');
    const [activeTab, setActiveTab] = useState<ActiveTab>('map');
    const [modalContent, setModalContent] = useState<ModalContent>(null);
    const [lastQuery, setLastQuery] = useState<string | null>(null);

    const { favorites, isFavorite, toggleFavorite, removeFavorite } = useFavorites(data?.location?.name || null);

    const executeFetch = useCallback(async (query: string, p: WeatherProvider, u: Units) => {
        setLoading(true);
        setError(null);
        try {
            const weatherData = await fetchWeatherData(p, query, u);
            setData(weatherData);
            setLastQuery(query);
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSearch = (city: string) => {
        if (city.trim()) executeFetch(`q=${encodeURIComponent(city.trim())}`, provider, units);
    };

    const handleGeolocate = useCallback(() => {
        setLoading(true);
        setError(null);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                executeFetch(`lat=${latitude}&lon=${longitude}`, provider, units);
            },
            (err) => {
                setError(`Geolocation error: ${err.message}. Please search for a city.`);
                setLoading(false);
            }
        );
    }, [provider, units, executeFetch]);
    
    useEffect(() => {
        const savedUnits = localStorage.getItem('weatherAppUnits') as Units;
        if(savedUnits) setUnits(savedUnits);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        localStorage.setItem('weatherAppUnits', units);
        if(lastQuery) {
            executeFetch(lastQuery, provider, units);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [provider, units]);

    useEffect(() => {
        const theme = getThemeClassName(data?.owm?.current);
        const body = document.getElementById('appBody');
        if (body) {
            body.className = `min-h-screen flex items-center justify-center p-4 md:p-6 overflow-hidden ${theme}`;
        }
    }, [data]);

    return (
        <div className="main-container p-6 md:p-8 w-full max-w-6xl">
            <Header onSearch={handleSearch} onGeolocate={handleGeolocate} units={units} setUnits={setUnits} provider={provider} setProvider={setProvider} favorites={favorites} removeFavorite={removeFavorite} />
            
            {error && !loading && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}
            
            {loading && <SkeletonLoader />}
            
            {!loading && data && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 fade-in">
                    <CurrentWeather data={data} provider={provider} units={units} isFavorite={isFavorite} toggleFavorite={toggleFavorite} />
                    <MapTabs activeTab={activeTab} setActiveTab={setActiveTab} setModalContent={setModalContent} location={data.location}/>
                    <HourlyForecast data={data} provider={provider} units={units} />
                    <DailyForecast data={data} provider={provider} units={units} />
                </div>
            )}
            
            {!loading && !data && !error && (
                <WelcomeMessage />
            )}

            <footer className="app-footer">
                <span>Designed by Marc Andréas Yao</span>
                <span>Copyright © {new Date().getFullYear()}</span>
            </footer>

            {modalContent && <MapModal modalContent={modalContent} location={data?.location || null} onClose={() => setModalContent(null)} />}
        </div>
    );
};

export default App;
