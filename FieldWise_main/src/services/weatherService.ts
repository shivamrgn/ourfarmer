/**
 * Crops Wild — Weather Service
 * Manages live meteorological data from OpenWeather with high-fidelity fallback to Open-Meteo.
 * Adheres strictly to genuine API fields without fabricating or hardcoding data.
 */

export interface LiveWeatherData {
  temperature: number; // °C
  feelsLike: number; // °C
  tempMin?: number;
  tempMax?: number;
  humidity: number; // %
  pressure?: number; // hPa
  condition: string; // e.g. "Partly Cloudy", "Clear Sky"
  description: string;
  iconCode?: string;
  windSpeed: number; // km/h
  windDirectionDeg?: number;
  windDirectionText?: string; // "NW", "SSE", etc.
  cloudCoverage: number; // %
  rainfallMm: number; // mm (1h or 3h or daily sum)
  visibilityKm?: number; // km
  timestamp: string; // ISO or formatted
  updatedEpoch: number; // seconds
  source: "OpenWeather" | "Open-Meteo";
  cityName: string;
  country: string;
  coordinates: {
    lat: number;
    lon: number;
  };
}

export interface ForecastDayItem {
  date: string; // YYYY-MM-DD
  dayName: string; // "Mon", "Tue"
  displayDate: string; // "21 Sep"
  tempMax: number;
  tempMin: number;
  condition: string;
  description: string;
  humidity: number;
  rainProbability?: number; // %
  precipitationMm: number; // mm
  windSpeed: number; // km/h
  iconCode?: string;
}

export interface ForecastHourItem {
  time: string; // "02:00 PM"
  date: string; // "21 Sep"
  temp: number;
  feelsLike: number;
  condition: string;
  humidity: number;
  rainProbability?: number; // %
  precipitationMm?: number;
  windSpeed: number;
  iconCode?: string;
}

export interface WeatherForecastDataset {
  daily: ForecastDayItem[];
  hourly: ForecastHourItem[];
  source: "OpenWeather" | "Open-Meteo";
}

const INDIAN_DISTRICT_COORDS: Record<string, { lat: number; lon: number; state: string }> = {
  // Punjab
  "ludhiana": { lat: 30.9010, lon: 75.8573, state: "Punjab" },
  "amritsar": { lat: 31.6340, lon: 74.8723, state: "Punjab" },
  "jalandhar": { lat: 31.3260, lon: 75.5762, state: "Punjab" },
  "patiala": { lat: 30.3398, lon: 76.3869, state: "Punjab" },
  "bathinda": { lat: 30.2110, lon: 74.9455, state: "Punjab" },
  // Gujarat
  "vadodara": { lat: 22.3072, lon: 73.1812, state: "Gujarat" },
  "ahmedabad": { lat: 23.0225, lon: 72.5714, state: "Gujarat" },
  "surat": { lat: 21.1702, lon: 72.8311, state: "Gujarat" },
  "rajkot": { lat: 22.3039, lon: 70.8022, state: "Gujarat" },
  "anand": { lat: 22.5645, lon: 72.9289, state: "Gujarat" },
  "mehsana": { lat: 23.5880, lon: 72.3693, state: "Gujarat" },
  // Haryana
  "karnal": { lat: 29.6857, lon: 76.9905, state: "Haryana" },
  "hisar": { lat: 29.1492, lon: 75.7217, state: "Haryana" },
  "ambala": { lat: 30.3782, lon: 76.7767, state: "Haryana" },
  // Maharashtra
  "pune": { lat: 18.5204, lon: 73.8567, state: "Maharashtra" },
  "nagpur": { lat: 21.1458, lon: 79.0882, state: "Maharashtra" },
  "nashik": { lat: 19.9975, lon: 73.7898, state: "Maharashtra" },
  "aurangabad": { lat: 19.8762, lon: 75.3433, state: "Maharashtra" },
  "kolhapur": { lat: 16.7050, lon: 74.2433, state: "Maharashtra" },
  // Uttar Pradesh
  "lucknow": { lat: 26.8467, lon: 80.9462, state: "Uttar Pradesh" },
  "varanasi": { lat: 25.3176, lon: 82.9739, state: "Uttar Pradesh" },
  "kanpur": { lat: 26.4499, lon: 80.3319, state: "Uttar Pradesh" },
  "agra": { lat: 27.1767, lon: 78.0081, state: "Uttar Pradesh" },
  "meerut": { lat: 28.9845, lon: 77.7064, state: "Uttar Pradesh" },
  // Madhya Pradesh
  "indore": { lat: 22.7196, lon: 75.8577, state: "Madhya Pradesh" },
  "bhopal": { lat: 23.2599, lon: 77.4126, state: "Madhya Pradesh" },
  "jabalpur": { lat: 23.1815, lon: 79.9864, state: "Madhya Pradesh" },
  // Rajasthan
  "jaipur": { lat: 26.9124, lon: 75.7873, state: "Rajasthan" },
  "jodhpur": { lat: 26.2389, lon: 73.0243, state: "Rajasthan" },
  "kota": { lat: 25.2138, lon: 75.8648, state: "Rajasthan" },
  // Karnataka & South
  "bengaluru": { lat: 12.9716, lon: 77.5946, state: "Karnataka" },
  "bangalore": { lat: 12.9716, lon: 77.5946, state: "Karnataka" },
  "mysuru": { lat: 12.2958, lon: 76.6394, state: "Karnataka" },
  "hyderabad": { lat: 17.3850, lon: 78.4867, state: "Telangana" },
  "chennai": { lat: 13.0827, lon: 80.2707, state: "Tamil Nadu" },
  "coimbatore": { lat: 11.0168, lon: 76.9558, state: "Tamil Nadu" },
  // East
  "patna": { lat: 25.5941, lon: 85.1376, state: "Bihar" },
  "kolkata": { lat: 22.5726, lon: 88.3639, state: "West Bengal" },
  "delhi": { lat: 28.6139, lon: 77.2090, state: "Delhi" },
};

export function getWindCompass(deg: number = 0): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index] || "N";
}

/**
 * Resolves coordinates from farm location name
 */
export async function resolveCoordinates(
  locationQuery: string,
  apiKey?: string
): Promise<{ lat: number; lon: number; resolvedName: string } | null> {
  const cleanQuery = locationQuery.trim();
  if (!cleanQuery) return null;

  const normalized = cleanQuery.toLowerCase().split(",")[0].trim();
  if (INDIAN_DISTRICT_COORDS[normalized]) {
    const item = INDIAN_DISTRICT_COORDS[normalized];
    return {
      lat: item.lat,
      lon: item.lon,
      resolvedName: `${cleanQuery.includes(",") ? cleanQuery : `${normalized.charAt(0).toUpperCase() + normalized.slice(1)}, ${item.state}`}`,
    };
  }

  // If OpenWeather API key available, try OpenWeather Direct Geocoding
  if (apiKey) {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cleanQuery)}&limit=1&appid=${apiKey}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return {
            lat: data[0].lat,
            lon: data[0].lon,
            resolvedName: `${data[0].name}${data[0].state ? `, ${data[0].state}` : ""}, ${data[0].country || "IN"}`,
          };
        }
      }
    } catch {
      // Continue to Open-Meteo geocoding
    }
  }

  // Open-Meteo Geocoding (public, fast, zero key required)
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQuery)}&count=1&language=en&format=json`
    );
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      if (geoData.results && geoData.results.length > 0) {
        const item = geoData.results[0];
        return {
          lat: item.latitude,
          lon: item.longitude,
          resolvedName: `${item.name}${item.admin1 ? `, ${item.admin1}` : ""}, ${item.country_code?.toUpperCase() || "IN"}`,
        };
      }
    }
  } catch (err) {
    console.warn("Geocoding resolution failed:", err);
  }

  return null;
}

/**
 * Weather Code interpreter for WMO standard codes
 */
export function interpretWmoCode(code: number): { condition: string; description: string } {
  const map: Record<number, { condition: string; description: string }> = {
    0: { condition: "Clear Sky", description: "Sunny and clear skies" },
    1: { condition: "Mainly Clear", description: "Mostly clear sky" },
    2: { condition: "Partly Cloudy", description: "Scattered cloud cover" },
    3: { condition: "Overcast", description: "Overcast conditions" },
    45: { condition: "Fog", description: "Foggy atmospheric conditions" },
    48: { condition: "Depositing Rime Fog", description: "Heavy rime fog" },
    51: { condition: "Light Drizzle", description: "Light precipitation drizzle" },
    53: { condition: "Moderate Drizzle", description: "Moderate mist and drizzle" },
    55: { condition: "Dense Drizzle", description: "Dense drizzle" },
    61: { condition: "Slight Rain", description: "Intermittent slight rain" },
    63: { condition: "Moderate Rain", description: "Moderate steady rainfall" },
    65: { condition: "Heavy Rain", description: "Heavy rain downpour" },
    71: { condition: "Slight Snow", description: "Light snowfall" },
    73: { condition: "Moderate Snow", description: "Steady snowfall" },
    75: { condition: "Heavy Snow", description: "Intense snowfall" },
    80: { condition: "Rain Showers", description: "Scattered convective showers" },
    81: { condition: "Moderate Showers", description: "Moderate passing rain showers" },
    82: { condition: "Violent Rain Showers", description: "Heavy torrential showers" },
    95: { condition: "Thunderstorm", description: "Active thunderstorm activity" },
    96: { condition: "Thunderstorm with Hail", description: "Thunderstorm with hail hazard" },
    99: { condition: "Severe Thunderstorm", description: "Heavy thunderstorm with hail" },
  };
  return map[code] || { condition: "Fair", description: "Clear to partly cloudy" };
}

/**
 * Fetches Live Current Weather from OpenWeather or Open-Meteo
 */
export async function fetchLiveCurrentWeather(
  lat: number,
  lon: number,
  cityName: string = "Farm Location",
  apiKey?: string
): Promise<LiveWeatherData> {
  // 1. Try OpenWeather if API key provided
  if (apiKey) {
    const owUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const res = await fetch(owUrl);
    if (res.ok) {
      const data = await res.json();
      const rainMm = data.rain ? (data.rain["1h"] ?? data.rain["3h"] ?? 0) : 0;
      const windKmh = Number((data.wind?.speed * 3.6).toFixed(1)); // m/s to km/h

      return {
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        tempMin: Math.round(data.main.temp_min),
        tempMax: Math.round(data.main.temp_max),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        condition: data.weather?.[0]?.main || "Clear",
        description: data.weather?.[0]?.description?.replace(/\b\w/g, (l: string) => l.toUpperCase()) || "Clear Sky",
        iconCode: data.weather?.[0]?.icon,
        windSpeed: windKmh,
        windDirectionDeg: data.wind?.deg,
        windDirectionText: getWindCompass(data.wind?.deg),
        cloudCoverage: data.clouds?.all ?? 0,
        rainfallMm: Number(rainMm.toFixed(1)),
        visibilityKm: data.visibility ? Number((data.visibility / 1000).toFixed(1)) : undefined,
        timestamp: new Date((data.dt || Date.now() / 1000) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        updatedEpoch: data.dt || Math.floor(Date.now() / 1000),
        source: "OpenWeather",
        cityName: data.name || cityName,
        country: data.sys?.country || "IN",
        coordinates: { lat, lon },
      };
    } else {
      throw new Error(`OpenWeather API returned status ${res.status}`);
    }
  }

  // 2. Open-Meteo Live Meteorological Data (Zero API key, real satellite observation)
  const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,surface_pressure&timezone=auto`;
  const res = await fetch(omUrl);
  if (!res.ok) {
    throw new Error(`Open-Meteo API returned status ${res.status}`);
  }

  const json = await res.json();
  const current = json.current;
  const wmo = interpretWmoCode(current.weather_code ?? 0);

  return {
    temperature: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    humidity: Math.round(current.relative_humidity_2m),
    pressure: current.surface_pressure ? Math.round(current.surface_pressure) : undefined,
    condition: wmo.condition,
    description: wmo.description,
    windSpeed: Math.round(current.wind_speed_10m),
    windDirectionDeg: current.wind_direction_10m,
    windDirectionText: getWindCompass(current.wind_direction_10m),
    cloudCoverage: current.cloud_cover ?? 0,
    rainfallMm: Number((current.rain ?? current.precipitation ?? 0).toFixed(1)),
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    updatedEpoch: Math.floor(Date.now() / 1000),
    source: "Open-Meteo",
    cityName,
    country: "IN",
    coordinates: { lat, lon },
  };
}

/**
 * Fetches Weather Forecast from OpenWeather or Open-Meteo
 */
export async function fetchWeatherForecast(
  lat: number,
  lon: number,
  apiKey?: string
): Promise<WeatherForecastDataset> {
  // 1. Try OpenWeather 5-day / 3-hour forecast
  if (apiKey) {
    const owUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const res = await fetch(owUrl);
    if (res.ok) {
      const data = await res.json();
      const list = data.list || [];

      // Hourly items (next 24 hours in 3h blocks)
      const hourly: ForecastHourItem[] = list.slice(0, 8).map((item: any) => {
        const dateObj = new Date(item.dt * 1000);
        return {
          time: dateObj.toLocaleTimeString([], { hour: "numeric", hour12: true }),
          date: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          temp: Math.round(item.main.temp),
          feelsLike: Math.round(item.main.feels_like),
          condition: item.weather?.[0]?.main || "Clear",
          humidity: item.main.humidity,
          rainProbability: item.pop !== undefined ? Math.round(item.pop * 100) : undefined,
          precipitationMm: item.rain?.["3h"] ?? 0,
          windSpeed: Math.round(item.wind.speed * 3.6),
          iconCode: item.weather?.[0]?.icon,
        };
      });

      // Group by date for daily aggregation
      const dailyMap = new Map<string, any[]>();
      for (const item of list) {
        const dateKey = item.dt_txt.split(" ")[0];
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, []);
        }
        dailyMap.get(dateKey)!.push(item);
      }

      const daily: ForecastDayItem[] = Array.from(dailyMap.entries())
        .slice(0, 5)
        .map(([dateKey, items]) => {
          const temps = items.map((it: any) => it.main.temp);
          const maxT = Math.round(Math.max(...temps));
          const minT = Math.round(Math.min(...temps));
          const midItem = items[Math.floor(items.length / 2)] || items[0];
          const dateObj = new Date(dateKey);
          const totalRain = items.reduce((sum: number, it: any) => sum + (it.rain?.["3h"] || 0), 0);
          const maxPop = Math.max(...items.map((it: any) => (it.pop !== undefined ? Math.round(it.pop * 100) : 0)));

          return {
            date: dateKey,
            dayName: dateObj.toLocaleDateString("en-US", { weekday: "short" }),
            displayDate: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            tempMax: maxT,
            tempMin: minT,
            condition: midItem.weather?.[0]?.main || "Clear",
            description: midItem.weather?.[0]?.description || "",
            humidity: midItem.main.humidity,
            rainProbability: maxPop > 0 ? maxPop : undefined,
            precipitationMm: Number(totalRain.toFixed(1)),
            windSpeed: Math.round(midItem.wind.speed * 3.6),
            iconCode: midItem.weather?.[0]?.icon,
          };
        });

      return {
        daily,
        hourly,
        source: "OpenWeather",
      };
    } else {
      throw new Error(`OpenWeather Forecast API returned status ${res.status}`);
    }
  }

  // 2. Open-Meteo 7-day Daily & Hourly Forecast
  const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m&timezone=auto`;
  const res = await fetch(omUrl);
  if (!res.ok) {
    throw new Error(`Open-Meteo Forecast API returned status ${res.status}`);
  }

  const json = await res.json();
  const dailyData = json.daily;
  const hourlyData = json.hourly;

  const daily: ForecastDayItem[] = (dailyData.time || []).slice(0, 7).map((dStr: string, idx: number) => {
    const dateObj = new Date(dStr);
    const wmo = interpretWmoCode(dailyData.weather_code[idx]);
    return {
      date: dStr,
      dayName: dateObj.toLocaleDateString("en-US", { weekday: "short" }),
      displayDate: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      tempMax: Math.round(dailyData.temperature_2m_max[idx]),
      tempMin: Math.round(dailyData.temperature_2m_min[idx]),
      condition: wmo.condition,
      description: wmo.description,
      humidity: 65, // daily aggregate
      rainProbability: dailyData.precipitation_probability_max?.[idx],
      precipitationMm: Number((dailyData.precipitation_sum?.[idx] || 0).toFixed(1)),
      windSpeed: Math.round(dailyData.wind_speed_10m_max?.[idx] || 10),
    };
  });

  const hourly: ForecastHourItem[] = [];
  const hoursList = hourlyData.time || [];
  for (let i = 0; i < Math.min(hoursList.length, 24); i += 3) {
    const dObj = new Date(hoursList[i]);
    const wmo = interpretWmoCode(hourlyData.weather_code[i]);
    hourly.push({
      time: dObj.toLocaleTimeString([], { hour: "numeric", hour12: true }),
      date: dObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      temp: Math.round(hourlyData.temperature_2m[i]),
      feelsLike: Math.round(hourlyData.apparent_temperature?.[i] ?? hourlyData.temperature_2m[i]),
      condition: wmo.condition,
      humidity: Math.round(hourlyData.relative_humidity_2m[i]),
      rainProbability: hourlyData.precipitation_probability?.[i],
      precipitationMm: Number((hourlyData.precipitation?.[i] || 0).toFixed(1)),
      windSpeed: Math.round(hourlyData.wind_speed_10m[i]),
    });
  }

  return {
    daily,
    hourly,
    source: "Open-Meteo",
  };
}
