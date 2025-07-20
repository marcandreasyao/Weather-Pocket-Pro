
export type Units = 'metric' | 'imperial';
export type WeatherProvider = 'owm' | 'tomorrow';
export type ActiveTab = 'map' | 'data';
export type ModalContent = ActiveTab | null;

export interface Coordinates {
  lat: number;
  lon: number;
}

// OpenWeatherMap Types
export interface OwmCurrentWeather {
  coord: Coordinates;
  weather: {
    id: number;
    main: string;
    description: string;
    icon: string;
  }[];
  main: {
    temp: number;
    feels_like: number;
    pressure: number;
    humidity: number;
  };
  wind: {
    speed: number;
    deg: number;
  };
  sys: {
    country: string;
    sunrise: number;
    sunset: number;
  };
  dt: number;
  name: string;
  timezone: number;
  uvi?: number; // Not always present
}

export interface OwmForecastItem {
  dt: number;
  main: {
    temp: number;
    temp_min: number;
    temp_max: number;
  };
  weather: {
    description: string;
    icon: string;
  }[];
  pop: number; // Probability of precipitation
}

export interface OwmForecast {
  list: OwmForecastItem[];
  city: {
    timezone: number;
  };
}

// Tomorrow.io Types
export interface TomorrowCurrentData {
  data?: {
    time: string;
    values: {
      temperature: number;
      temperatureApparent: number;
      humidity: number;
      windSpeed: number;
      windDirection: number;
      pressureSeaLevel: number;
      uvIndex: number;
      weatherCode: number;
      sunriseTime: string;
      sunsetTime: string;
    };
  };
  location?: {
    name: string;
    lat: number;
    lon: number;
  };
}

export interface TomorrowForecastTimeline {
  time: string;
  values: {
    temperatureMin?: number;
    temperatureMax?: number;
    temperature?: number;
    precipitationProbabilityAvg?: number;
    precipitationProbability?: number;
    weatherCode?: number;
  };
}

export interface TomorrowForecastData {
  timelines?: {
    daily: TomorrowForecastTimeline[];
    hourly: TomorrowForecastTimeline[];
  };
}

// Combined application data structure
export interface LocationData extends Coordinates {
  name: string;
}

export interface AppData {
  owm?: {
    current: OwmCurrentWeather;
    forecast: OwmForecast;
  };
  tomorrow?: {
    current: TomorrowCurrentData;
    forecast: TomorrowForecastData;
  };
  location: LocationData;
}
