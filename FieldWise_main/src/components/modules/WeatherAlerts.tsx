import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CloudSun,
  CloudRain,
  Sun,
  Cloud,
  Thermometer,
  Droplets,
  Wind,
  Compass,
  MapPin,
  Search,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldCheck,
  Calendar,
  Layers,
  Activity,
  ArrowRight,
  Loader2,
  ExternalLink,
  Eye,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useWeather } from "@/components/dashboard/WeatherContext";
import { farmProfileService } from "@/services/farmProfileService";

interface WeatherAlertsProps {
  onNavigate?: (module: string) => void;
}

export function WeatherAlerts({ onNavigate }: WeatherAlertsProps) {
  const {
    liveWeather,
    weatherForecast,
    locationName,
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
  } = useWeather();

  const [searchCity, setSearchCity] = useState("");
  const [selectedInsightTab, setSelectedInsightTab] = useState<"temperature" | "precipitation" | "solar">("temperature");

  const profile = farmProfileService.getFarmProfile();
  const district = profile.farmer?.district;
  const state = profile.farmer?.state;
  const farmLocationStr = [district, state].filter(Boolean).join(", ");
  const isProfileIncomplete = !farmLocationStr;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchCity.trim()) {
      fetchWeatherByCity(searchCity.trim());
      setSearchCity("");
    }
  };

  // Weather conditions summary strictly grounded in actual readings
  const farmingInsights = useMemo(() => {
    if (!liveWeather) return [];

    const insights = [];

    // 1. Precipitation Outlook
    const hasUpcomingRain = (weatherForecast?.daily?.[0]?.precipitationMm ?? 0) > 0 || (liveWeather.rainfallMm ?? 0) > 0;
    const maxProb = weatherForecast?.daily?.[0]?.rainProbability;

    if (hasUpcomingRain || (maxProb && maxProb >= 40)) {
      insights.push({
        title: "Precipitation Expected in Upcoming Window",
        message: `Rain is anticipated in the forecast${maxProb ? ` (${maxProb}% probability)` : ""}. Ensure field drainage channels are cleared to prevent waterlogging.`,
        severity: "warning",
        category: "Moisture & Drainage",
      });
    } else {
      insights.push({
        title: "Dry Canopy & Clear Field Window",
        message: "No immediate rainfall detected in current observation. Field operations such as tillage, weeding, and harvesting can proceed under stable atmospheric conditions.",
        severity: "optimal",
        category: "Field Operations",
      });
    }

    // 2. Wind Speed & Chemical Spraying
    if (liveWeather.windSpeed > 18) {
      insights.push({
        title: "Elevated Wind Velocity Detected",
        message: `Current wind speed is ${liveWeather.windSpeed} km/h (${liveWeather.windDirectionText || "variable"}). Spray drift hazard is elevated; delay agrochemical foliar applications until wind moderates below 15 km/h.`,
        severity: "warning",
        category: "Spray Drift Advisory",
      });
    } else {
      insights.push({
        title: "Favorable Spraying Wind Window",
        message: `Wind speed is calm at ${liveWeather.windSpeed} km/h (${liveWeather.windDirectionText || "variable"}). Wind velocity is suitable for uniform foliar pesticide and nutrient droplet deposition.`,
        severity: "optimal",
        category: "Foliar Spray Window",
      });
    }

    // 3. Temperature & Plant Transpiration
    if (liveWeather.temperature >= 35) {
      insights.push({
        title: "High Heat & Elevated Evapotranspiration",
        message: `Ambient temperature is ${liveWeather.temperature}°C (feels like ${liveWeather.feelsLike}°C). Crop transpiration rates are high; verify soil moisture reserves and irrigate during cooler early morning or dusk hours.`,
        severity: "warning",
        category: "Heat Management",
      });
    } else if (liveWeather.temperature <= 10) {
      insights.push({
        title: "Cool Temperature Phase",
        message: `Ambient temperature is ${liveWeather.temperature}°C. Cool soil conditions slow metabolic nutrient uptake; ensure cold-sensitive seedling protection.`,
        severity: "info",
        category: "Thermal Regimes",
      });
    } else {
      insights.push({
        title: "Moderate Thermal Conditions",
        message: `Current temperature is ${liveWeather.temperature}°C with ${liveWeather.feelsLike}°C apparent temperature. Conducive thermal range for normal metabolic and photosynthetic crop activity.`,
        severity: "optimal",
        category: "Crop Physiology",
      });
    }

    // 4. Humidity & Pathogen Pressure
    if (liveWeather.humidity >= 80) {
      insights.push({
        title: "High Relative Humidity (Foliar Pathogen Risk)",
        message: `Relative humidity is elevated at ${liveWeather.humidity}%. Prolonged leaf wetness and high atmospheric moisture favor fungal spore germination (e.g. blights and rusts). Increase crop scouting frequency.`,
        severity: "info",
        category: "Pathology Advisory",
      });
    } else if (liveWeather.humidity <= 30) {
      insights.push({
        title: "Low Atmospheric Humidity",
        message: `Relative humidity is dry at ${liveWeather.humidity}%. Fast soil surface moisture evaporation expected; maintain mulch cover where applicable.`,
        severity: "info",
        category: "Soil Moisture Conservation",
      });
    }

    return insights;
  }, [liveWeather, weatherForecast]);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* ── 1. HEADER ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <CloudSun className="h-3.5 w-3.5" />
            <span>Weather Intelligence</span>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
            • Real-Time Meteorology &amp; Agroclimatology
          </span>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Weather Intelligence
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed mt-0.5">
            Understand current weather, upcoming conditions, and environmental trends around your farm.
          </p>
        </div>

        {/* Profile location incomplete warning */}
        {isProfileIncomplete && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Complete your Farm Profile to enable location-based weather intelligence.</span>
            </div>
            <Button
              variant="link"
              size="sm"
              onClick={() => onNavigate?.("profile")}
              className="text-amber-900 dark:text-amber-200 font-semibold p-0 h-auto self-start sm:self-auto"
            >
              Update My Farm →
            </Button>
          </div>
        )}

        {/* Quick search and GPS bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search Indian district or mandi (e.g. Vadodara, Ludhiana, Karnal)..."
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </form>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={useCurrentLocation}
              className="text-xs h-9 w-full sm:w-auto text-gray-700 dark:text-gray-300"
            >
              <MapPin className="h-3.5 w-3.5 mr-1 text-emerald-600" />
              Use GPS
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refreshWeather}
              disabled={openWeatherLoading}
              className="text-xs h-9 w-full sm:w-auto text-gray-700 dark:text-gray-300"
              title="Refresh meteorological observation"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${openWeatherLoading ? "animate-spin text-emerald-600" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* ── 2. CURRENT WEATHER — OPENWEATHER ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
              Live Observation Feed
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Thermometer className="h-5 w-5 text-emerald-600" />
              Current Weather
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              {liveWeather?.source === "OpenWeather" ? "OpenWeather Live Feed" : "Open-Meteo Ground Feed"}
            </Badge>
            {liveWeather?.timestamp && (
              <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
                Updated {liveWeather.timestamp}
              </span>
            )}
          </div>
        </div>

        {/* LOADING SKELETON */}
        {openWeatherLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-1 border border-gray-200 dark:border-gray-800 p-6 space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-12 w-32" />
              <Skeleton className="h-4 w-40" />
            </Card>
            <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Card key={idx} className="border border-gray-200 dark:border-gray-800 p-4 space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-20" />
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {!openWeatherLoading && openWeatherError && (
          <Card className="border border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20 p-6 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-red-600 mx-auto" />
            <h3 className="text-sm font-bold text-red-900 dark:text-red-200">
              Current weather information is temporarily unavailable.
            </h3>
            <p className="text-xs text-red-700 dark:text-red-300 max-w-md mx-auto">
              Please check your connection or location query and try again.
            </p>
            <div className="pt-2">
              <Button
                type="button"
                size="sm"
                onClick={refreshWeather}
                className="bg-red-600 hover:bg-red-700 text-white text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Try Again
              </Button>
            </div>
          </Card>
        )}

        {/* ACTUAL DATA DISPLAY */}
        {!openWeatherLoading && !openWeatherError && liveWeather && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Primary Hero Card */}
            <Card className="lg:col-span-4 border border-gray-200 dark:border-gray-800 shadow-sm bg-gradient-to-br from-emerald-50/40 via-white to-sky-50/30 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {liveWeather.cityName}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Updated {liveWeather.timestamp}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    {liveWeather.condition.toLowerCase().includes("rain") ? (
                      <CloudRain className="h-9 w-9 text-sky-600" />
                    ) : liveWeather.condition.toLowerCase().includes("cloud") ? (
                      <Cloud className="h-9 w-9 text-slate-500" />
                    ) : (
                      <Sun className="h-9 w-9 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <div className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                      {liveWeather.temperature}°C
                    </div>
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 capitalize">
                      {liveWeather.description}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Feels like {liveWeather.feelsLike}°C
                    </div>
                  </div>
                </div>

                {liveWeather.tempMax !== undefined && liveWeather.tempMin !== undefined && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
                    <span>Today's Range</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {liveWeather.tempMin}°C min • {liveWeather.tempMax}°C max
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Observation Parameters Grid */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Humidity */}
              <div className="p-4 rounded-xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-xs space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 flex items-center gap-1">
                  <Droplets className="h-3.5 w-3.5 text-sky-600" />
                  <span>Humidity</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {liveWeather.humidity}%
                </div>
                <div className="text-[11px] text-gray-500">
                  {liveWeather.humidity > 70 ? "Humid canopy" : liveWeather.humidity < 40 ? "Dry ambient" : "Moderate moisture"}
                </div>
              </div>

              {/* Wind */}
              <div className="p-4 rounded-xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-xs space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 flex items-center gap-1">
                  <Wind className="h-3.5 w-3.5 text-teal-600" />
                  <span>Wind Velocity</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {liveWeather.windSpeed} <span className="text-xs font-normal text-gray-400">km/h</span>
                </div>
                <div className="text-[11px] text-gray-500 flex items-center gap-1">
                  <Compass className="h-3 w-3 text-gray-400" />
                  <span>{liveWeather.windDirectionText ? `Direction: ${liveWeather.windDirectionText}` : "Steady wind"}</span>
                </div>
              </div>

              {/* Precipitation / Rainfall */}
              <div className="p-4 rounded-xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-xs space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 flex items-center gap-1">
                  <CloudRain className="h-3.5 w-3.5 text-blue-600" />
                  <span>Precipitation</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {liveWeather.rainfallMm} <span className="text-xs font-normal text-gray-400">mm</span>
                </div>
                <div className="text-[11px] text-gray-500">
                  {liveWeather.rainfallMm > 0 ? "Rain recorded" : "No rainfall detected"}
                </div>
              </div>

              {/* Cloud Coverage */}
              <div className="p-4 rounded-xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-xs space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 flex items-center gap-1">
                  <Cloud className="h-3.5 w-3.5 text-slate-500" />
                  <span>Cloud Cover</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {liveWeather.cloudCoverage}%
                </div>
                <div className="text-[11px] text-gray-500">
                  {liveWeather.cloudCoverage < 25 ? "Clear sunlight" : liveWeather.cloudCoverage < 70 ? "Partly cloudy" : "Heavy overcast"}
                </div>
              </div>

              {/* Atmospheric Pressure */}
              <div className="p-4 rounded-xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-xs space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5 text-purple-600" />
                  <span>Surface Pressure</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {liveWeather.pressure ? `${liveWeather.pressure} ` : "1012 "}
                  <span className="text-xs font-normal text-gray-400">hPa</span>
                </div>
                <div className="text-[11px] text-gray-500">
                  Stable barometric status
                </div>
              </div>

              {/* Visibility / Air Clarity */}
              <div className="p-4 rounded-xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-xs space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Visibility</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {liveWeather.visibilityKm !== undefined ? `${liveWeather.visibilityKm} ` : "10 "}
                  <span className="text-xs font-normal text-gray-400">km</span>
                </div>
                <div className="text-[11px] text-gray-500">
                  Clear visual horizon
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 3. FORECAST — OPENWEATHER ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
              Atmospheric Outlook
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
              Multi-Day Farm Forecast
            </h2>
          </div>
          <Badge variant="outline" className="text-xs">
            {weatherForecast?.source || "OpenWeather"} Modeling
          </Badge>
        </div>

        {/* SKELETON */}
        {openWeatherLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Card key={idx} className="border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-8 w-14" />
                <Skeleton className="h-3 w-20" />
              </Card>
            ))}
          </div>
        )}

        {/* FORECAST CARDS */}
        {!openWeatherLoading && weatherForecast && weatherForecast.daily.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-3 overflow-x-auto pb-1">
              {weatherForecast.daily.map((day, idx) => (
                <Card
                  key={idx}
                  className={`border shadow-xs hover:border-emerald-300 transition-colors ${
                    idx === 0
                      ? "border-emerald-200 bg-emerald-50/20 dark:border-emerald-800/60 dark:bg-emerald-950/20"
                      : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/70"
                  }`}
                >
                  <CardContent className="p-3.5 text-center space-y-2">
                    <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      {idx === 0 ? "Today" : day.dayName}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {day.displayDate}
                    </div>

                    <div className="py-1">
                      {day.condition.toLowerCase().includes("rain") ? (
                        <CloudRain className="h-7 w-7 text-sky-600 mx-auto" />
                      ) : day.condition.toLowerCase().includes("cloud") ? (
                        <Cloud className="h-7 w-7 text-slate-400 mx-auto" />
                      ) : (
                        <Sun className="h-7 w-7 text-amber-500 mx-auto" />
                      )}
                    </div>

                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                      {day.tempMax}° <span className="text-xs font-normal text-gray-400">{day.tempMin}°</span>
                    </div>

                    <div className="text-[11px] font-medium text-gray-600 dark:text-gray-400 truncate" title={day.condition}>
                      {day.condition}
                    </div>

                    {day.rainProbability !== undefined && day.rainProbability > 0 && (
                      <div className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 flex items-center justify-center gap-0.5">
                        <Droplets className="h-3 w-3" />
                        <span>{day.rainProbability}% Rain</span>
                      </div>
                    )}

                    {day.precipitationMm > 0 && (
                      <div className="text-[10px] text-gray-500">
                        {day.precipitationMm} mm
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Hourly 24-hr Horizon scrollable strip */}
            {weatherForecast.hourly.length > 0 && (
              <Card className="border border-gray-200 dark:border-gray-800 shadow-xs bg-gray-50/40 dark:bg-gray-900/30">
                <CardHeader className="py-2.5 px-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-700 dark:text-gray-300">
                      24-Hour Timeline (3-Hour Increments)
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Wind &amp; Temperature Horizon
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin">
                    {weatherForecast.hourly.map((h, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-center min-w-[90px] shrink-0 space-y-1"
                      >
                        <div className="text-[11px] font-medium text-gray-500">{h.time}</div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{h.temp}°C</div>
                        <div className="text-[10px] text-gray-400 truncate">{h.condition}</div>
                        <div className="text-[10px] text-teal-600 flex items-center justify-center gap-0.5 font-medium">
                          <Wind className="h-2.5 w-2.5" />
                          <span>{h.windSpeed} km/h</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </section>

      {/* ── 4. ENVIRONMENTAL & HISTORICAL INSIGHTS — NASA POWER ── */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
              NASA POWER Climatology
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600" />
              Environmental &amp; Historical Insights
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-2xl mt-0.5">
              Historical environmental data can help understand longer-term conditions around your farm.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge variant="outline" className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border-indigo-200">
              NASA POWER (MERRA-2)
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refreshNasaData}
              disabled={nasaLoading}
              className="text-xs h-8"
              title="Refresh NASA dataset"
            >
              <RotateCcw className={`h-3 w-3 ${nasaLoading ? "animate-spin text-indigo-600" : ""}`} />
            </Button>
          </div>
        </div>

        {/* LOADING SKELETON */}
        {nasaLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border border-gray-200 dark:border-gray-800 p-4 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-24" />
                </Card>
              ))}
            </div>
            <Card className="border border-gray-200 dark:border-gray-800 p-6 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-64 w-full" />
            </Card>
          </div>
        )}

        {/* ERROR STATE */}
        {!nasaLoading && nasaError && (
          <Card className="border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 p-6 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-amber-600 mx-auto" />
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Historical environmental data is temporarily unavailable.
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-300 max-w-md mx-auto">
              NASA POWER agroclimatology feeds are momentarily unreachable for this coordinate grid.
            </p>
            <div className="pt-2">
              <Button
                type="button"
                size="sm"
                onClick={refreshNasaData}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Try Again
              </Button>
            </div>
          </Card>
        )}

        {/* ACTUAL NASA POWER DATA */}
        {!nasaLoading && !nasaError && nasaData && (
          <div className="space-y-4">
            {/* Period Label Banner */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                <span>{nasaData.periodLabel}</span>
              </div>
              <span className="text-[11px] text-gray-400">
                Resolution: 0.5° × 0.625° Global Grid
              </span>
            </div>

            {/* Summary Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                <div className="text-[10px] uppercase font-semibold text-gray-400 mb-0.5">30-Day Mean Temp</div>
                <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  {nasaData.summary.avgTemp}°C
                </div>
                <div className="text-[11px] text-gray-500">
                  {nasaData.summary.minTemp}°C min • {nasaData.summary.maxTemp}°C max
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                <div className="text-[10px] uppercase font-semibold text-gray-400 mb-0.5">Total Precipitation</div>
                <div className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">
                  {nasaData.summary.totalPrecipitation} mm
                </div>
                <div className="text-[11px] text-gray-500">
                  Cumulative 30-day rain
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                <div className="text-[10px] uppercase font-semibold text-gray-400 mb-0.5">Mean Relative Humidity</div>
                <div className="text-lg sm:text-xl font-bold text-sky-600 dark:text-sky-400">
                  {nasaData.summary.avgHumidity}%
                </div>
                <div className="text-[11px] text-gray-500">
                  At 2m atmospheric boundary
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                <div className="text-[10px] uppercase font-semibold text-gray-400 mb-0.5">Mean Solar Radiation</div>
                <div className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400">
                  {nasaData.summary.avgSolarRadiation} <span className="text-xs font-normal text-gray-400">MJ/m²/d</span>
                </div>
                <div className="text-[11px] text-gray-500">
                  All-sky surface shortwave
                </div>
              </div>
            </div>

            {/* Historical Charts Container */}
            <Card className="border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-bold text-gray-900 dark:text-white">
                      Historical Agrometeorology Trends
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Daily satellite observations aggregated across the 30-day assimilation window.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-1.5 p-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedInsightTab("temperature")}
                      className={`px-3 py-1 rounded-md font-medium transition-all ${
                        selectedInsightTab === "temperature"
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Temperature
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedInsightTab("precipitation")}
                      className={`px-3 py-1 rounded-md font-medium transition-all ${
                        selectedInsightTab === "precipitation"
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Rainfall
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedInsightTab("solar")}
                      className={`px-3 py-1 rounded-md font-medium transition-all ${
                        selectedInsightTab === "solar"
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Solar
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-6">
                {/* 1. TEMPERATURE TREND CHART */}
                {selectedInsightTab === "temperature" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 pb-2">
                      <span>Daily Thermal Range (Max, Mean, Min)</span>
                      <span>Unit: °C</span>
                    </div>
                    <div className="h-64 sm:h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={nasaData.records} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="nasaTempGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                          <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 10 }} domain={["dataMin - 2", "dataMax + 2"]} />
                          <Tooltip
                            contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                            formatter={(value: any, name: string) => [
                              `${value} °C`,
                              name === "tempMax" ? "Maximum" : name === "tempMin" ? "Minimum" : "Mean Temperature",
                            ]}
                          />
                          <Area type="monotone" dataKey="tempMax" stroke="#f59e0b" fill="none" strokeWidth={1.5} name="tempMax" />
                          <Area type="monotone" dataKey="tempMean" stroke="#10b981" fill="url(#nasaTempGrad)" strokeWidth={2} name="tempMean" />
                          <Area type="monotone" dataKey="tempMin" stroke="#3b82f6" fill="none" strokeWidth={1.5} name="tempMin" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* 2. PRECIPITATION TREND CHART */}
                {selectedInsightTab === "precipitation" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 pb-2">
                      <span>Daily Precipitation (PRECTOTCORR) &amp; Relative Humidity</span>
                      <span>Precipitation: mm/day • Humidity: %</span>
                    </div>
                    <div className="h-64 sm:h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={nasaData.records} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                          <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis yAxisId="left" tick={{ fontSize: 10 }} unit="mm" />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                            formatter={(value: any, name: string) => [
                              name === "precipitation" ? `${value} mm` : `${value}%`,
                              name === "precipitation" ? "Precipitation" : "Relative Humidity",
                            ]}
                          />
                          <Bar yAxisId="left" dataKey="precipitation" fill="#3b82f6" radius={[4, 4, 0, 0]} name="precipitation" />
                          <Line yAxisId="right" type="monotone" dataKey="humidity" stroke="#10b981" strokeWidth={2} dot={false} name="humidity" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* 3. SOLAR RADIATION CHART */}
                {selectedInsightTab === "solar" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 pb-2">
                      <span>All-Sky Surface Shortwave Downward Irradiance</span>
                      <span>Unit: MJ/m²/day</span>
                    </div>
                    <div className="h-64 sm:h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={nasaData.records} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="nasaSolarGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                          <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                            formatter={(value: any) => [`${value} MJ/m²/day`, "Solar Radiation"]}
                          />
                          <Area type="monotone" dataKey="solarRadiation" stroke="#f59e0b" fill="url(#nasaSolarGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* ── 7. FARMING WEATHER INSIGHTS ── */}
      <section className="space-y-4 pt-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
            Operational Guidance
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Weather Conditions for Farm Planning
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Factual conditions summarizing immediate operational considerations based strictly on live atmospheric data.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {farmingInsights.map((insight, idx) => (
            <Card
              key={idx}
              className={`border shadow-xs ${
                insight.severity === "warning"
                  ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20"
                  : insight.severity === "optimal"
                  ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20"
                  : "border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20"
              }`}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {insight.category}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      insight.severity === "warning"
                        ? "border-amber-300 text-amber-800 dark:text-amber-300"
                        : insight.severity === "optimal"
                        ? "border-emerald-300 text-emerald-800 dark:text-emerald-300"
                        : "border-blue-300 text-blue-800 dark:text-blue-300"
                    }`}
                  >
                    {insight.severity === "warning" ? "Notice" : insight.severity === "optimal" ? "Favorable" : "Advisory"}
                  </Badge>
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  {insight.title}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {insight.message}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── 5. DATA SOURCE TRANSPARENCY ── */}
      <section className="pt-4 border-t border-gray-200 dark:border-gray-800">
        <Card className="border border-gray-200 dark:border-gray-800 shadow-xs bg-gray-50/50 dark:bg-gray-900/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Data Sources &amp; Transparency
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Clear attribution of meteorological and climatological sources powering Weather Intelligence:
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 space-y-1">
              <div className="font-bold text-gray-900 dark:text-white flex items-center justify-between">
                <span>OpenWeather</span>
                <Badge variant="outline" className="text-[10px]">Real-Time &amp; Forecast</Badge>
              </div>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Provides near-real-time atmospheric observation: current temperature, relative humidity, wind velocity, cloud coverage, precipitation, and 5-day / 3-hour forecasts.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 space-y-1">
              <div className="font-bold text-gray-900 dark:text-white flex items-center justify-between">
                <span>NASA POWER</span>
                <Badge variant="outline" className="text-[10px]">Agroclimatology &amp; History</Badge>
              </div>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Prediction Of Worldwide Energy Resources (NASA Langley Research Center). Synthesizes MERRA-2 and GEOS-IT global satellite models for solar radiation, thermal ranges, and historical moisture patterns.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default WeatherAlerts;