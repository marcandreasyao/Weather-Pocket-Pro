import { OwmCurrentWeather, OwmForecast, TomorrowCurrentData, TomorrowForecastData, Units, WeatherProvider, AppData, LocationData } from '../types';

// --- API Configuration ---
const OWM_API_KEY = '041fbadab5535ba6219544663f5cb1a1';
const TOMORROW_API_KEY = 'VndlVwE6B2ougfMdNoq5YQBW3Cj41GrG';
const OWM_API_BASE = 'https://api.openweathermap.org/data/2.5';
const GEO_API_BASE = 'https://api.openweathermap.org/geo/1.0';
const TOMORROW_API_BASE = "https://api.tomorrow.io/v4/weather";

// --- Fetching Functions ---

async function fetchOwmData(query: string, units: Units): Promise<AppData> {
  const unitsParam = `&units=${units}`;
  const weatherUrl = `${OWM_API_BASE}/weather?${query}&appid=${OWM_API_KEY}${unitsParam}`;
  const forecastUrl = `${OWM_API_BASE}/forecast?${query}&appid=${OWM_API_KEY}${unitsParam}`;
  
  const [weatherResult, forecastResult] = await Promise.allSettled([
    fetch(weatherUrl),
    fetch(forecastUrl),
  ]);

  if (weatherResult.status === 'rejected' || !weatherResult.value.ok) {
    const errorData = weatherResult.status === 'fulfilled' ? await weatherResult.value.json().catch(() => ({})) : {};
    throw new Error(errorData.message || 'Could not fetch current weather.');
  }
  
  const current: OwmCurrentWeather = await weatherResult.value.json();
  const location: LocationData = { lat: current.coord.lat, lon: current.coord.lon, name: `${current.name}, ${current.sys.country}`};

  if (forecastResult.status === 'rejected' || !forecastResult.value.ok) {
     console.warn('Could not fetch forecast data.');
     return { owm: { current, forecast: { list: [], city: { timezone: 0 } } }, location };
  }
  
  const forecast: OwmForecast = await forecastResult.value.json();
  return { owm: { current, forecast }, location };
}

async function fetchTomorrowData(query: string, units: Units): Promise<AppData> {
    let lat, lon;
    if (query.startsWith('lat=')) {
        const params = new URLSearchParams(query);
        lat = parseFloat(params.get('lat') || '0');
        lon = parseFloat(params.get('lon') || '0');
    } else {
        const city = decodeURIComponent(query.slice(2));
        const geoUrl = `${GEO_API_BASE}/direct?q=${encodeURIComponent(city)}&limit=1&appid=${OWM_API_KEY}`;
        const geoRes = await fetch(geoUrl);
        if (!geoRes.ok) throw new Error('Could not find city for geocoding.');
        const geoData = await geoRes.json();
        if (!geoData || geoData.length === 0) throw new Error('City not found for Tomorrow.io');
        lat = geoData[0].lat;
        lon = geoData[0].lon;
    }

    const locationString = `${lat},${lon}`;
    const realtimeUrl = `${TOMORROW_API_BASE}/realtime?location=${locationString}&apikey=${TOMORROW_API_KEY}&units=${units}`;
    const forecastUrl = `${TOMORROW_API_BASE}/forecast?location=${locationString}&apikey=${TOMORROW_API_KEY}&timesteps=1h,1d&units=${units}`;

    const owmQuery = `lat=${lat}&lon=${lon}`;
    const owmUnitsParam = `&units=${units}`;
    const owmWeatherUrl = `${OWM_API_BASE}/weather?${owmQuery}&appid=${OWM_API_KEY}${owmUnitsParam}`;
    const owmForecastUrl = `${OWM_API_BASE}/forecast?${owmQuery}&appid=${OWM_API_KEY}${owmUnitsParam}`;

    const [currentRes, forecastRes, owmWeatherResult, owmForecastResult] = await Promise.all([
        fetch(realtimeUrl),
        fetch(forecastUrl),
        fetch(owmWeatherUrl),
        fetch(owmForecastUrl)
    ]);

    if (!currentRes.ok || !forecastRes.ok) throw new Error('Failed to fetch Tomorrow.io weather data.');
    if (!owmWeatherResult.ok) throw new Error('Could not fetch OpenWeatherMap data for visual layer.');
    
    const tomorrowCurrent: TomorrowCurrentData = await currentRes.json();
    const tomorrowForecast: TomorrowForecastData = await forecastRes.json();
    const owmCurrent: OwmCurrentWeather = await owmWeatherResult.json();
    
    let owmForecast: OwmForecast;
    if (owmForecastResult.ok) {
        owmForecast = await owmForecastResult.json();
    } else {
        console.warn('Could not fetch OWM forecast data for icons.');
        owmForecast = { list: [], city: { timezone: owmCurrent.timezone || 0 } };
    }

    const location: LocationData = { lat: owmCurrent.coord.lat, lon: owmCurrent.coord.lon, name: `${owmCurrent.name}, ${owmCurrent.sys.country}` };

    return {
        owm: { current: owmCurrent, forecast: owmForecast },
        tomorrow: { current: tomorrowCurrent, forecast: tomorrowForecast },
        location,
    };
}

export async function fetchWeatherData(provider: WeatherProvider, query: string, units: Units): Promise<AppData> {
    if (provider === 'tomorrow') {
        return fetchTomorrowData(query, units);
    }
    return fetchOwmData(query, units);
}


export async function fetchCitySuggestions(query: string): Promise<string[]> {
    if (!query || query.length < 3) return [];
    const url = `${GEO_API_BASE}/direct?q=${encodeURIComponent(query)}&limit=5&appid=${OWM_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error("Error fetching suggestions:", response.statusText);
            return [];
        }
        const data = await response.json();
        if (data && Array.isArray(data)) {
            const suggestions = data
                .filter((city: any) => city.name && city.country)
                .map((city: any): string => {
                    const parts = [city.name];
                    if (city.state) {
                        parts.push(city.state);
                    }
                    parts.push(city.country);
                    return parts.join(', ');
                });
            return Array.from(new Set(suggestions));
        }
        return [];
    } catch (error) {
        console.error("Error fetching suggestions:", error);
        return [];
    }
}

// --- Utility Functions ---

export function formatTime(unixTimestamp: number, timezoneOffsetSeconds: number): string {
  if (!unixTimestamp) return '--:--';
  const date = new Date((unixTimestamp + timezoneOffsetSeconds) * 1000);
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function degreesToCardinal(deg: number): string {
  if (typeof deg !== 'number') return '--';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}

export function getAccuWeatherIconUrl(owmIcon: string | null): string {
    const mapping: { [key: string]: number } = {
        "01d": 1, "01n": 33, "02d": 3, "02n": 35, "03d": 6, "03n": 38,
        "04d": 7, "04n": 7, "09d": 12, "09n": 39, "10d": 18, "10n": 40,
        "11d": 15, "11n": 41, "13d": 22, "13n": 44, "50d": 11, "50n": 11
    };
    const code = owmIcon ? mapping[owmIcon] : null;
    if (code === null || code === undefined) {
        return 'https://placehold.co/64x64/e2e8f0/a0aec0?text=Icon';
    }
    const codeStr = String(code).padStart(2, '0');
    return `https://developer.accuweather.com/sites/default/files/${codeStr}-s.png`;
}


export function getThemeClassName(owmData?: OwmCurrentWeather): string {
    if (!owmData) return 'theme-clear-day';

    const { weather, dt, sys } = owmData;
    const now = new Date(dt * 1000);
    const sunrise = new Date(sys.sunrise * 1000);
    const sunset = new Date(sys.sunset * 1000);
    
    const magicHourWindow = 45 * 60 * 1000; // 45 minutes for magic hour

    const isSunriseMagicHour = now >= sunrise && now <= new Date(sunrise.getTime() + magicHourWindow);
    const isSunsetMagicHour = now >= new Date(sunset.getTime() - magicHourWindow) && now <= sunset;
    const isDawn = now >= new Date(sunrise.getTime() - magicHourWindow) && now < sunrise;

    const isDay = now > sunrise && now < sunset;
    const icon = weather[0].icon; // e.g., "01d", "10n"
    const weatherCode = parseInt(icon.substring(0, 2), 10);

    // Specific time-of-day themes take precedence over weather
    if (isDawn) return 'theme-dawn dark';
    if (isSunriseMagicHour) return 'theme-sunrise';
    if (isSunsetMagicHour) return 'theme-sunset';

    const themeSuffix = isDay ? '-day' : '-night dark';

    switch (weatherCode) {
        case 1: return `theme-clear${themeSuffix}`;
        case 2: return `theme-few-clouds${themeSuffix}`;
        case 3: return `theme-scattered-clouds${themeSuffix}`;
        case 4: return `theme-broken-clouds${themeSuffix}`;
        case 9:
        case 10: return `theme-rain${themeSuffix}`;
        case 11: return `theme-storm${themeSuffix}`;
        case 13: return `theme-snow${themeSuffix}`;
        case 50: return `theme-fog${themeSuffix}`;
        default: return `theme-clear${themeSuffix}`;
    }
}