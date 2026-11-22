import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { farmProfileService } from '@/services/farmProfileService';
import { fetchNasaPowerData, NasaPowerDataset } from '@/services/nasaPowerService';
import {
  fetchLiveCurrentWeather,
  fetchWeatherForecast,
  resolveCoordinates,
  LiveWeatherData,
  WeatherForecastDataset,
} from '@/services/weatherService';

export interface OpenWeatherData {
  main: {
    temp: number;
    humidity: number;
    feels_like: number;
    temp_min?: number;
    temp_max?: number;
    pressure?: number;
  };
  weather: {
    id?: number;
    main: string;
    description: string;
    icon?: string;
  }[];
  wind: {
    speed: number;
    deg?: number;
  };
  clouds?: {
    all: number;
  };
  rain?: {
    "1h"?: number;
    "3h"?: number;
  };
  visibility: number;
  name: string;
  sys: {
    country: string;
  };
  dt?: number;
}

export interface OpenMeteoData {
  current: {
    weather_code: number;
  };
  daily: {
    time: string[];
    uv_index_max: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    precipitation_probability_max: number[];
    rain_sum: number[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
  };
}

export interface WeatherContextType {
  // Real-time weather properties (Backwards compatible)
  weatherData: OpenWeatherData | null;
  forecastData: OpenMeteoData | null;
  locationName: string;
  loading: boolean;
  error: string | null;

  // New Weather Intelligence properties
  liveWeather: LiveWeatherData | null;
  weatherForecast: WeatherForecastDataset | null;
  coordinates: { lat: number; lon: number } | null;
  openWeatherLoading: boolean;
  openWeatherError: string | null;

  // NASA POWER Agroclimatology properties
  nasaData: NasaPowerDataset | null;
  nasaLoading: boolean;
  nasaError: string | null;

  // Actions
  fetchWeatherByCity: (city: string) => Promise<void>;
  useCurrentLocation: () => void;
  refreshWeather: () => Promise<void>;
  refreshNasaData: () => Promise<void>;
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined);

const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || '';

export const WeatherProvider = ({ children }: { children: ReactNode }) => {
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [locationName, setLocationName] = useState<string>('Ludhiana, Punjab');

  // OpenWeather / Live weather state
  const [weatherData, setWeatherData] = useState<OpenWeatherData | null>(null);
  const [forecastData, setForecastData] = useState<OpenMeteoData | null>(null);
  const [liveWeather, setLiveWeather] = useState<LiveWeatherData | null>(null);
  const [weatherForecast, setWeatherForecast] = useState<WeatherForecastDataset | null>(null);
  const [openWeatherLoading, setOpenWeatherLoading] = useState<boolean>(true);
  const [openWeatherError, setOpenWeatherError] = useState<string | null>(null);

  // NASA POWER state (independent)
  const [nasaData, setNasaData] = useState<NasaPowerDataset | null>(null);
  const [nasaLoading, setNasaLoading] = useState<boolean>(true);
  const [nasaError, setNasaError] = useState<string | null>(null);

  // General loading & error
  const loading = openWeatherLoading;
  const error = openWeatherError;

  // Fetch OpenWeather / Live weather
  const fetchCurrentWeatherWithForecast = useCallback(async (lat: number, lon: number, cityName: string) => {
    setOpenWeatherLoading(true);
    setOpenWeatherError(null);

    try {
      // 1. Fetch current weather
      const current = await fetchLiveCurrentWeather(lat, lon, cityName, OPENWEATHER_API_KEY);
      setLiveWeather(current);

      // Backwards compatible OpenWeatherData adapter
      const legacyOpenWeather: OpenWeatherData = {
        main: {
          temp: current.temperature,
          humidity: current.humidity,
          feels_like: current.feelsLike,
          temp_min: current.tempMin,
          temp_max: current.tempMax,
          pressure: current.pressure,
        },
        weather: [
          {
            main: current.condition,
            description: current.description,
            icon: current.iconCode,
          },
        ],
        wind: {
          speed: current.windSpeed,
          deg: current.windDirectionDeg,
        },
        clouds: {
          all: current.cloudCoverage,
        },
        rain: {
          "1h": current.rainfallMm,
        },
        visibility: current.visibilityKm ? current.visibilityKm * 1000 : 10000,
        name: current.cityName,
        sys: {
          country: current.country,
        },
        dt: current.updatedEpoch,
      };
      setWeatherData(legacyOpenWeather);

      // 2. Fetch forecast
      const forecast = await fetchWeatherForecast(lat, lon, OPENWEATHER_API_KEY);
      setWeatherForecast(forecast);

      // Backwards compatible forecastData adapter for old consumers
      const legacyForecast: OpenMeteoData = {
        current: {
          weather_code: 0,
        },
        daily: {
          time: forecast.daily.map((d) => d.date),
          uv_index_max: forecast.daily.map(() => 6),
          temperature_2m_max: forecast.daily.map((d) => d.tempMax),
          temperature_2m_min: forecast.daily.map((d) => d.tempMin),
          weather_code: forecast.daily.map(() => 0),
          precipitation_probability_max: forecast.daily.map((d) => d.rainProbability ?? 0),
          rain_sum: forecast.daily.map((d) => d.precipitationMm),
        },
        hourly: {
          time: forecast.hourly.map((h) => `${h.date} ${h.time}`),
          temperature_2m: forecast.hourly.map((h) => h.temp),
        },
      };
      setForecastData(legacyForecast);
    } catch (err: any) {
      console.error("OpenWeather / weather fetch failed:", err);
      setOpenWeatherError("Current weather information is temporarily unavailable.");
    } finally {
      setOpenWeatherLoading(false);
    }
  }, []);

  // Fetch NASA POWER independently
  const fetchNasaPower = useCallback(async (lat: number, lon: number) => {
    setNasaLoading(true);
    setNasaError(null);

    try {
      const dataset = await fetchNasaPowerData(lat, lon, 30);
      setNasaData(dataset);
    } catch (err: any) {
      console.error("NASA POWER fetch failed:", err);
      setNasaError("Historical environmental data is temporarily unavailable.");
    } finally {
      setNasaLoading(false);
    }
  }, []);

  // Sync with coordinates
  useEffect(() => {
    if (coordinates) {
      fetchCurrentWeatherWithForecast(coordinates.lat, coordinates.lon, locationName);
      fetchNasaPower(coordinates.lat, coordinates.lon);
    }
  }, [coordinates, fetchCurrentWeatherWithForecast, fetchNasaPower, locationName]);

  // Initial farm profile sync
  useEffect(() => {
    const initLocationFromProfile = async () => {
      const profile = farmProfileService.getFarmProfile();
      const district = profile.farmer?.district;
      const state = profile.farmer?.state;
      const farmLocStr = [district, state].filter(Boolean).join(", ");

      const targetLocation = farmLocStr || "Ludhiana, Punjab";
      setLocationName(targetLocation);

      const resolved = await resolveCoordinates(targetLocation, OPENWEATHER_API_KEY);
      if (resolved) {
        setCoordinates({ lat: resolved.lat, lon: resolved.lon });
        setLocationName(resolved.resolvedName || targetLocation);
      } else {
        // Fallback default coordinates (Ludhiana / Punjab agricultural center)
        setCoordinates({ lat: 30.9010, lon: 75.8573 });
      }
    };

    initLocationFromProfile();

    const unsubscribe = farmProfileService.onProfileChange(async (updatedProfile) => {
      const district = updatedProfile.farmer?.district;
      const state = updatedProfile.farmer?.state;
      const farmLocStr = [district, state].filter(Boolean).join(", ");
      if (farmLocStr) {
        setLocationName(farmLocStr);
        const resolved = await resolveCoordinates(farmLocStr, OPENWEATHER_API_KEY);
        if (resolved) {
          setCoordinates({ lat: resolved.lat, lon: resolved.lon });
          setLocationName(resolved.resolvedName || farmLocStr);
        }
      }
    });

    return unsubscribe;
  }, []);

  const fetchWeatherByCity = async (city: string) => {
    const clean = city.trim();
    if (!clean) return;

    setOpenWeatherLoading(true);
    setNasaLoading(true);
    setOpenWeatherError(null);
    setNasaError(null);

    const resolved = await resolveCoordinates(clean, OPENWEATHER_API_KEY);
    if (resolved) {
      setLocationName(resolved.resolvedName || clean);
      setCoordinates({ lat: resolved.lat, lon: resolved.lon });
    } else {
      setOpenWeatherError(`Could not find coordinates for: ${clean}`);
      setOpenWeatherLoading(false);
      setNasaLoading(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setOpenWeatherError("Geolocation is not supported by your browser.");
      return;
    }

    setOpenWeatherLoading(true);
    setNasaLoading(true);
    setOpenWeatherError(null);
    setNasaError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoordinates({ lat: latitude, lon: longitude });
        setLocationName("Your Current Location");
      },
      (err) => {
        console.warn("Geolocation denied or failed:", err);
        setOpenWeatherError("Geolocation access was denied. Enter your farm location manually.");
        setOpenWeatherLoading(false);
        setNasaLoading(false);
      },
      { timeout: 10000 }
    );
  };

  const refreshWeather = async () => {
    if (coordinates) {
      await fetchCurrentWeatherWithForecast(coordinates.lat, coordinates.lon, locationName);
    }
  };

  const refreshNasaData = async () => {
    if (coordinates) {
      await fetchNasaPower(coordinates.lat, coordinates.lon);
    }
  };

  const value: WeatherContextType = {
    weatherData,
    forecastData,
    locationName,
    loading,
    error,
    liveWeather,
    weatherForecast,
    coordinates,
    openWeatherLoading,
    openWeatherError,
    nasaData,
    nasaLoading,
    nasaError,
    fetchWeatherByCity,
    useCurrentLocation,
    refreshWeather,
    refreshNasaData,
  };

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
};

export const useWeather = () => {
  const context = useContext(WeatherContext);
  if (context === undefined) {
    throw new Error('useWeather must be used within a WeatherProvider');
  }
  return context;
};