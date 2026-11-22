import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { farmProfileService, CompleteFarmProfile } from "@/services/farmProfileService";
import { useWeather } from "@/components/dashboard/WeatherContext";
import marketPricesService, { MarketPrice } from "@/services/marketPricesService";
import governmentSchemesService, { GovernmentScheme } from "@/services/governmentSchemesService";
import farmIntelligenceService, {
  DataReadinessItem,
  StoredCropRecommendation,
  StoredFertilizerRecommendation,
  StoredDiseaseDetection,
  FarmInsight,
  MissingDataItem,
} from "@/services/farmIntelligenceService";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

// Icons
import {
  Activity,
  Layers,
  CloudSun,
  Sprout,
  FlaskConical,
  ScanEye,
  TrendingUp,
  Landmark,
  Headphones,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Clock,
  RefreshCw,
  MapPin,
  Thermometer,
  Droplets,
  Wind,
  Sun,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileCheck,
  Calendar,
} from "lucide-react";

interface FarmIntelligenceProps {
  onNavigate?: (module: string) => void;
}

export function FarmIntelligence({ onNavigate }: FarmIntelligenceProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // ── 1. Weather Context ──
  const {
    weatherData,
    forecastData,
    nasaData,
    isLoading: isWeatherLoading,
    refreshWeather,
    isLiveOpenWeather,
  } = useWeather();

  // ── 2. Farm Profile State ──
  const [profile, setProfile] = useState<CompleteFarmProfile>(() =>
    farmProfileService.getFarmProfile(user)
  );

  useEffect(() => {
    setProfile(farmProfileService.getFarmProfile(user, user?.id));
    const unsubscribe = farmProfileService.onProfileChange((updated) => {
      setProfile(updated);
    });
    return unsubscribe;
  }, [user]);

  // ── 3. Module Snapshot Records ──
  const [cropRec, setCropRec] = useState<StoredCropRecommendation | null>(() =>
    farmIntelligenceService.getStoredCropRecommendation(user?.id)
  );
  const [fertRec, setFertRec] = useState<StoredFertilizerRecommendation | null>(() =>
    farmIntelligenceService.getStoredFertilizerRecommendation(user?.id)
  );
  const [diseaseRec, setDiseaseRec] = useState<StoredDiseaseDetection | null>(() =>
    farmIntelligenceService.getStoredDiseaseDetection(user?.id)
  );

  // ── 4. Market & Schemes State ──
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [isMarketLoading, setIsMarketLoading] = useState(false);
  const [schemes, setSchemes] = useState<
    { scheme: GovernmentScheme; relevanceTags: string[]; relevanceScore: number }[]
  >([]);

  // ── 5. General Dashboard State ──
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Navigation Helper
  const handleNav = (module: string) => {
    if (onNavigate) {
      onNavigate(module);
    } else {
      navigate(`/${module}`);
    }
  };

  // Fetch Market & Schemes
  const loadMarketAndSchemes = useCallback(async () => {
    setIsMarketLoading(true);
    try {
      // Mandi Prices
      const prices = await marketPricesService.getMarketPrices();
      setMarketPrices(prices || []);
    } catch (e) {
      console.warn("Market price load warning:", e);
    } finally {
      setIsMarketLoading(false);
    }

    try {
      // Government Schemes
      const matched = governmentSchemesService.getPersonalizedSchemes(
        profile.farmer.state,
        profile.farm.currentCrops,
        profile.farm.farmSize,
        profile.farm.irrigationType
      );
      setSchemes(matched || []);
    } catch (e) {
      console.warn("Schemes load warning:", e);
    }
  }, [profile]);

  useEffect(() => {
    loadMarketAndSchemes();
    const handleUpdate = () => {
      setCropRec(farmIntelligenceService.getStoredCropRecommendation(user?.id));
      setFertRec(farmIntelligenceService.getStoredFertilizerRecommendation(user?.id));
      setDiseaseRec(farmIntelligenceService.getStoredDiseaseDetection(user?.id));
    };
    handleUpdate();
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("fieldwise:intelligence_updated", handleUpdate);
    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("fieldwise:intelligence_updated", handleUpdate);
    };
  }, [loadMarketAndSchemes, user?.id]);

  // Refresh All Connected Data
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        refreshWeather(true),
        loadMarketAndSchemes(),
      ]);
      setCropRec(farmIntelligenceService.getStoredCropRecommendation(user?.id));
      setFertRec(farmIntelligenceService.getStoredFertilizerRecommendation(user?.id));
      setDiseaseRec(farmIntelligenceService.getStoredDiseaseDetection(user?.id));
      setLastUpdated(new Date());
      toast({
        title: "Farm Intelligence Refreshed",
        description: "Data synchronized from connected weather, market, and farm sources.",
      });
    } catch {
      toast({
        title: "Partial Refresh",
        description: "Some connected sources could not be refreshed. Available data remains visible.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Compute Data Readiness & Insights
  const readinessItems = farmIntelligenceService.computeDataReadiness(
    profile,
    weatherData,
    nasaData,
    cropRec,
    fertRec,
    diseaseRec,
    marketPrices
  );

  const insights = farmIntelligenceService.generateValidatedInsights(
    profile,
    weatherData,
    nasaData,
    cropRec,
    fertRec,
    diseaseRec,
    marketPrices,
    schemes
  );

  const missingItems = farmIntelligenceService.getMissingDataItems(
    profile,
    cropRec,
    fertRec,
    diseaseRec
  );

  // Group Insights by Priority
  const safeInsights = Array.isArray(insights) ? insights : [];
  const importantInsights = safeInsights.filter((i) => i.type === "important");
  const infoInsights = safeInsights.filter((i) => i.type === "information");
  const positiveInsights = safeInsights.filter((i) => i.type === "positive");

  // Matched Commodity for Farmer
  const farmerCropLower = profile?.farm?.currentCrops?.toLowerCase() || "";
  const matchingMarket = (farmerCropLower && Array.isArray(marketPrices))
    ? marketPrices.find(
        (m) =>
          m &&
          typeof m.crop_name === "string" &&
          (farmerCropLower.includes(m.crop_name.toLowerCase()) ||
            m.crop_name.toLowerCase().includes(farmerCropLower))
      )
    : undefined;

  const stateStr = profile?.farmer?.state ? String(profile.farmer.state).trim() : "";
  const distStr = profile?.farmer?.district ? String(profile.farmer.district).trim() : "";
  const isLocationMissing = !stateStr || !distStr;

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
      {/* ── HEADER ── */}
      <div className="border-b border-gray-200 dark:border-gray-800 pb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                Unified Farm Intelligence
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Live Integration Layer
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-1">
              Farm Intelligence
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-3xl">
              Bring your farm data together to understand current conditions, important signals, and actionable insights.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="text-xs h-9 font-medium"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`}
              />
              {isRefreshing ? "Refreshing..." : "Refresh Intelligence"}
            </Button>
            <Button
              size="sm"
              onClick={() => handleNav("profile")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-semibold"
            >
              Update Farm Profile
            </Button>
          </div>
        </div>

        {/* Aggregation Transparency Note */}
        <div className="mt-3.5 text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span>
            Data updated from connected sources:{" "}
            <strong>
              {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </strong>{" "}
            ({lastUpdated.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})
          </span>
        </div>
      </div>

      {/* ── 1. FARM OVERVIEW ── */}
      <Card className="border border-gray-200 dark:border-gray-800 shadow-xs bg-linear-to-r from-emerald-50/40 via-white to-gray-50 dark:from-emerald-950/20 dark:via-gray-900 dark:to-gray-900">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Active Farm Record
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {profile?.farmer?.fullName || "Farmer"}
                {profile?.farm?.farmName ? ` — ${profile.farm.farmName}` : ""}
              </h2>

              {isLocationMissing ? (
                <div className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Farm profile location is incomplete. Add your state and district to enable localized weather and mandi intelligence.
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-700 dark:text-gray-300 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <strong>Location:</strong> {profile?.farmer?.district || "District"}, {profile?.farmer?.state || "State"}
                  </span>
                  {profile?.farm?.currentCrops && (
                    <span className="flex items-center gap-1">
                      <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                      <strong>Current Crop:</strong> {profile.farm.currentCrops}
                    </span>
                  )}
                  {(profile?.farm?.farmSize ?? 0) > 0 && (
                    <span>
                      <strong>Farm Size:</strong> {profile.farm.farmSize} {profile.farm.farmSizeUnit || "Acres"}
                    </span>
                  )}
                  {profile?.farm?.irrigationType && (
                    <span>
                      <strong>Irrigation:</strong> {profile.farm.irrigationType}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleNav("profile")}
                className="text-xs h-8"
              >
                Edit Farm Details
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. FARM DATA READINESS ── */}
      <Card className="border border-gray-200 dark:border-gray-800 shadow-xs">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                Farm Data Readiness Overview
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Calculated directly from connected application modules and verified data sources.
              </CardDescription>
            </div>
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 hidden sm:inline">
              {(readinessItems || []).filter((i) => i.status === "available").length} of {(readinessItems || []).length} Available
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(readinessItems || []).map((item) => {
              const isAvailable = item.status === "available";
              const isIncomplete = item.status === "incomplete";

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                    isAvailable
                      ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/20"
                      : isIncomplete
                      ? "border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/20"
                      : "border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/40"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {item.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] py-0 px-1.5 font-semibold ${
                          isAvailable
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                            : isIncomplete
                            ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {isAvailable ? "✓ " : isIncomplete ? "⚠ " : "— "}
                        {item.statusLabel}
                      </Badge>
                    </div>

                    <p className="text-[11px] text-gray-600 dark:text-gray-300 line-clamp-2">
                      {item.details}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">{item.source}</span>
                    {item.actionModule && (
                      <button
                        onClick={() => handleNav(item.actionModule!)}
                        className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                      >
                        {item.actionLabel || "View"}
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── 3. CURRENT FARM CONDITIONS (Weather, Soil, Environment) ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Current Farm Conditions
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Real-time atmospheric and environmental parameters observed at your farm location.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* A. Weather Condition Card */}
          <Card className="border border-gray-200 dark:border-gray-800 p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <CloudSun className="w-4 h-4 text-emerald-600" />
                  Weather Observation
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {isLiveOpenWeather ? "OpenWeather Live" : "OpenWeather"}
                </Badge>
              </div>

              {weatherData && weatherData.main ? (
                <div className="space-y-3 mt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                      {Math.round(weatherData.main.temp ?? 0)}°C
                    </span>
                    <span className="text-xs text-gray-500 capitalize">
                      {weatherData.weather?.[0]?.description || "Fair"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                      <div className="text-[10px] text-gray-500">Humidity</div>
                      <div className="font-semibold text-gray-800 dark:text-gray-200">
                        {weatherData.main.humidity ?? 0}%
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                      <div className="text-[10px] text-gray-500">Rainfall (1h)</div>
                      <div className="font-semibold text-gray-800 dark:text-gray-200">
                        {typeof weatherData.rain?.["1h"] === "number" ? `${weatherData.rain["1h"]} mm` : "0.0 mm"}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                      <div className="text-[10px] text-gray-500">Wind Speed</div>
                      <div className="font-semibold text-gray-800 dark:text-gray-200">
                        {weatherData.wind?.speed ? `${weatherData.wind.speed} m/s` : "Normal"}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                      <div className="text-[10px] text-gray-500">Feels Like</div>
                      <div className="font-semibold text-gray-800 dark:text-gray-200">
                        {Math.round(weatherData.main.feels_like ?? weatherData.main.temp ?? 0)}°C
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-gray-500">
                  Weather observations temporarily unavailable.
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNav("weather")}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 mt-4 w-full justify-between"
            >
              View Weather Intelligence
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Card>

          {/* B. Soil Condition Card */}
          <Card className="border border-gray-200 dark:border-gray-800 p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Soil Parameters
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Farm Profile
                </Badge>
              </div>

              <div className="space-y-3 mt-1">
                <div>
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {profile?.soil?.soilType || "Standard Agricultural Soil"}
                  </span>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {(profile?.soil?.ph ?? 0) > 0 ? `pH ${profile?.soil?.ph}` : "pH not recorded"}
                    {profile?.soil?.lastTestedDate ? ` • Tested ${profile.soil.lastTestedDate}` : ""}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 text-center">
                    <div className="text-[10px] text-gray-500">Nitrogen (N)</div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200">
                      {(profile?.soil?.nitrogen ?? 0) > 0 ? `${profile.soil.nitrogen}` : "—"}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 text-center">
                    <div className="text-[10px] text-gray-500">Phosphorus (P)</div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200">
                      {(profile?.soil?.phosphorus ?? 0) > 0 ? `${profile.soil.phosphorus}` : "—"}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 text-center">
                    <div className="text-[10px] text-gray-500">Potassium (K)</div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200">
                      {(profile?.soil?.potassium ?? 0) > 0 ? `${profile.soil.potassium}` : "—"}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  {(profile?.soil?.organicCarbon ?? 0) > 0
                    ? `Organic Carbon: ${profile.soil.organicCarbon}%`
                    : "Organic carbon value not specified."}
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNav("soil-environment")}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 mt-4 w-full justify-between"
            >
              View Soil & Environment
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Card>

          {/* C. Environmental Trends (NASA POWER) Card */}
          <Card className="border border-gray-200 dark:border-gray-800 p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-emerald-600" />
                  Environmental Data
                </span>
                <Badge variant="outline" className="text-[10px]">
                  NASA POWER
                </Badge>
              </div>

              {nasaData && nasaData.summary ? (
                <div className="space-y-3 mt-1">
                  <div>
                    <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {typeof nasaData.summary.avgSolarRadiation === 'number'
                        ? `${nasaData.summary.avgSolarRadiation.toFixed(1)} MJ/m²/day`
                        : `${nasaData.summary.avgSolarRadiation || "—"} MJ/m²/day`}
                    </span>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Average All-Sky Solar Radiation ({nasaData.summary.daysCount || 30}-day average)
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                      <div className="text-[10px] text-gray-500">Average Temp</div>
                      <div className="font-semibold text-gray-800 dark:text-gray-200">
                        {typeof nasaData.summary.avgTemp === 'number'
                          ? `${nasaData.summary.avgTemp.toFixed(1)}°C`
                          : `${nasaData.summary.avgTemp || "—"}°C`}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                      <div className="text-[10px] text-gray-500">Historical Precip</div>
                      <div className="font-semibold text-gray-800 dark:text-gray-200">
                        {typeof nasaData.summary.totalPrecipitation === 'number'
                          ? `${nasaData.summary.totalPrecipitation.toFixed(1)} mm total`
                          : `${nasaData.summary.totalPrecipitation || "0"} mm total`}
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-gray-400">
                    Source: NASA Langley MERRA-2 Agroclimatology dataset.
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-gray-500">
                  NASA POWER assimilation records loading or unavailable.
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNav("soil-environment")}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 mt-4 w-full justify-between"
            >
              Explore Environmental Trends
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Card>
        </div>
      </div>

      {/* ── 4, 5, 6: AI INTELLIGENCE & MODEL RESULTS ── */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Model Results & Recommendations
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Results from Crops Wild machine learning and formulation engines.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 4. Crop Intelligence */}
          <Card className="border border-gray-200 dark:border-gray-800 p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Sprout className="w-4 h-4 text-emerald-600" />
                  Crop Intelligence
                </span>
                <Badge variant="outline" className="text-[10px]">
                  ML Predictor
                </Badge>
              </div>

              {cropRec && Array.isArray(cropRec.predictions) && cropRec.predictions.length > 0 ? (
                <div className="space-y-2.5 mt-2">
                  <div className="text-xs text-gray-500">
                    Latest Model Recommendation:
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-emerald-800 dark:text-emerald-300">
                      {typeof cropRec.topCrop === 'object' && cropRec.topCrop !== null
                        ? (cropRec.topCrop as any).name || "Recommended Crop"
                        : cropRec.topCrop ||
                          cropRec.cropName ||
                          (typeof cropRec.predictions[0]?.crop === 'object' && cropRec.predictions[0]?.crop !== null
                            ? (cropRec.predictions[0]?.crop as any).name
                            : cropRec.predictions[0]?.crop) ||
                          "Recommended Crop"}
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px]">
                      {cropRec.confidence || cropRec.predictions[0]?.confidence || cropRec.suitabilityScore || 0}% Match
                    </Badge>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                    {cropRec.predictions[0]?.description ||
                      (typeof cropRec.predictions[0]?.crop === 'object' && cropRec.predictions[0]?.crop !== null
                        ? (cropRec.predictions[0]?.crop as any).description
                        : null) ||
                      "Evaluated against current farm conditions."}
                  </p>

                  <div className="text-[10px] text-gray-400 pt-1">
                    Analyzed on{" "}
                    {cropRec.analyzedAt && !isNaN(new Date(cropRec.analyzedAt).getTime())
                      ? new Date(cropRec.analyzedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Recent analysis"}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-gray-500 space-y-2">
                  <Sprout className="w-8 h-8 text-gray-300 mx-auto" />
                  <p>No crop recommendation has been completed yet.</p>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNav("crop-recommendation")}
              className="text-xs font-semibold mt-4 w-full"
            >
              {cropRec ? "Review Crop Recommendations" : "Run Crop Recommendation"}
            </Button>
          </Card>

          {/* 5. Fertilizer Intelligence */}
          <Card className="border border-gray-200 dark:border-gray-800 p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <FlaskConical className="w-4 h-4 text-emerald-600" />
                  Fertilizer Intelligence
                </span>
                <Badge variant="outline" className="text-[10px]">
                  ICAR Formulations
                </Badge>
              </div>

              {fertRec && Array.isArray(fertRec.fertilizers) && fertRec.fertilizers.length > 0 ? (
                <div className="space-y-2 mt-2">
                  <div className="text-xs text-gray-500">
                    Latest Formulation for <strong>{fertRec.cropName || "Crop"}</strong>:
                  </div>

                  <div className="space-y-1.5">
                    {fertRec.fertilizers.slice(0, 2).map((f: any, idx: number) => {
                      const displayQty =
                        f?.quantity !== null && f?.quantity !== undefined && f?.quantity > 0
                          ? `${f.quantity} ${f.unit || "kg"}`
                          : f?.dosage || "Recommended Dose";
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs p-1.5 rounded-md bg-gray-50 dark:bg-gray-800/60"
                        >
                          <span className="font-semibold text-gray-800 dark:text-gray-200">{f?.name || "Nutrient"}</span>
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                            {displayQty}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-[10px] text-gray-400 pt-1">
                    Calculated for {fertRec.inputs?.area || 1} {fertRec.inputs?.unit || "Acre"} on{" "}
                    {fertRec.analyzedAt && !isNaN(new Date(fertRec.analyzedAt).getTime())
                      ? new Date(fertRec.analyzedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Recent analysis"}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-gray-500 space-y-2">
                  <FlaskConical className="w-8 h-8 text-gray-300 mx-auto" />
                  <p>No fertilizer analysis has been completed yet.</p>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNav("fertilizer-recommendation")}
              className="text-xs font-semibold mt-4 w-full"
            >
              {fertRec ? "View Fertilizer Recommendations" : "Analyze Fertilizer Needs"}
            </Button>
          </Card>

          {/* 6. Plant Health / Disease */}
          <Card className="border border-gray-200 dark:border-gray-800 p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <ScanEye className="w-4 h-4 text-emerald-600" />
                  Plant Health
                </span>
                <Badge variant="outline" className="text-[10px]">
                  AI Vision
                </Badge>
              </div>

              {diseaseRec && typeof diseaseRec.diseaseName === "string" && diseaseRec.diseaseName.trim() !== "" ? (
                <div className="space-y-2 mt-2">
                  <div className="text-xs text-gray-500">
                    Latest Leaf Scan ({diseaseRec.cropName || "Plant"}):
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                      {diseaseRec.diseaseName}
                    </span>
                    <Badge
                      className={`text-[10px] border-none ${
                        String(diseaseRec.diseaseName).toLowerCase().includes("healthy")
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {diseaseRec.confidenceScore ?? 0}% Confidence
                    </Badge>
                  </div>

                  <div className="text-[10px] text-gray-400 pt-1">
                    Scanned on{" "}
                    {diseaseRec.analyzedAt && !isNaN(new Date(diseaseRec.analyzedAt).getTime())
                      ? new Date(diseaseRec.analyzedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Recent analysis"}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-gray-500 space-y-2">
                  <ScanEye className="w-8 h-8 text-gray-300 mx-auto" />
                  <p>No recent plant disease analysis.</p>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNav("disease-detection")}
              className="text-xs font-semibold mt-4 w-full"
            >
              {diseaseRec ? "View Plant Pathology" : "Scan Plant Leaf"}
            </Button>
          </Card>
        </div>
      </div>

      {/* ── 9 & 10: MARKET & GOVERNMENT SIGNALS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mandi Market Signal */}
        <Card className="border border-gray-200 dark:border-gray-800 p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Mandi Market Signal
              </span>
              <Badge variant="outline" className="text-[10px]">
                Agmarknet Mandi Network
              </Badge>
            </div>

            {matchingMarket ? (
              <div className="space-y-2 mt-2">
                <div className="text-xs text-gray-500">
                  Current Modal Rate for <strong>{matchingMarket.crop_name}</strong>:
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    ₹{matchingMarket.current_price}
                  </span>
                  <span className="text-xs text-gray-500">per {matchingMarket.unit || "kg"}</span>
                  {matchingMarket.trend && (
                    <Badge
                      className={`text-[10px] ml-auto ${
                        matchingMarket.trend === "up"
                          ? "bg-emerald-100 text-emerald-800"
                          : matchingMarket.trend === "down"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {matchingMarket.trend === "up" ? "▲ Upward" : matchingMarket.trend === "down" ? "▼ Downward" : "Steady"}
                    </Badge>
                  )}
                </div>

                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Market: <strong>{matchingMarket.market_location}</strong> ({matchingMarket.market_type || "wholesale"})
                </div>
                <div className="text-[10px] text-gray-400">
                  Last Updated: {matchingMarket.last_updated && !isNaN(new Date(matchingMarket.last_updated).getTime())
                    ? new Date(matchingMarket.last_updated).toLocaleDateString("en-IN")
                    : "Recently"}
                </div>
              </div>
            ) : Array.isArray(marketPrices) && marketPrices.length > 0 && marketPrices[0]?.crop_name ? (
              <div className="space-y-2 mt-2">
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Monitoring {marketPrices.length} commodities across agricultural mandis. Your profile crop ({profile?.farm?.currentCrops || "Not specified"}) does not have a direct price match in current records.
                </div>
                <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  Sample: {marketPrices[0].crop_name} at ₹{marketPrices[0].current_price}/{marketPrices[0].unit || "kg"} ({marketPrices[0].market_location || "Mandi"})
                </div>
              </div>
            ) : (
              <div className="py-4 text-xs text-gray-500">
                Market data feed currently unavailable.
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNav("mandi")}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 mt-4 w-full justify-between"
          >
            View Mandi Price Intelligence
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Card>

        {/* Government Support Signal */}
        <Card className="border border-gray-200 dark:border-gray-800 p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-emerald-600" />
                Government Support Signal
              </span>
              <Badge variant="outline" className="text-[10px]">
                MoA&FW Portals
              </Badge>
            </div>

            {Array.isArray(schemes) && schemes.length > 0 && schemes[0]?.scheme ? (
              <div className="space-y-2 mt-2">
                <div className="text-xs text-gray-500">
                  Potentially Relevant Support:
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {schemes.length} Programs Potentially Relevant
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                  Identified based on your location ({profile?.farmer?.state || "India"}) and crop profile. Includes programs like {schemes[0].scheme.short_name || schemes[0].scheme.name || "Government Support"}.
                </p>
                <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                  Note: Potentially relevant based on profile matching; confirm formal eligibility on the official portal before applying.
                </div>
              </div>
            ) : (
              <div className="py-4 text-xs text-gray-500">
                Update farm location and crop profile to discover relevant schemes.
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNav("government-schemes")}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 mt-4 w-full justify-between"
          >
            Explore Government Schemes
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Card>
      </div>

      {/* ── 12 & 13: ACTIONABLE INSIGHTS ── */}
      <Card className="border border-gray-200 dark:border-gray-800 shadow-xs">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Actionable Farm Insights
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Signals synthesized strictly from your current data, model outputs, and validated agronomic thresholds.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {insights.length} Signals Generated
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 pt-3 space-y-4">
          {insights.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              No actionable insights generated yet. Complete your Farm Profile or run a Crop Recommendation to generate signals.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Important Priority */}
              {importantInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 text-xs flex flex-col sm:flex-row justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-600 text-white text-[10px] py-0 px-1.5 font-semibold">
                        {insight.typeLabel}
                      </Badge>
                      <span className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                        {insight.title}
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-xs leading-relaxed">
                      {insight.description}
                    </p>
                    <div className="text-[10px] text-gray-400">Source: {insight.source}</div>
                  </div>

                  {insight.actionModule && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleNav(insight.actionModule!)}
                      className="text-xs font-semibold shrink-0 self-start sm:self-center h-8"
                    >
                      {insight.actionLabel || "Review"}
                    </Button>
                  )}
                </div>
              ))}

              {/* Information & Positive Priority */}
              {[...infoInsights, ...positiveInsights].map((insight) => (
                <div
                  key={insight.id}
                  className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row justify-between gap-3 ${
                    insight.type === "positive"
                      ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/20"
                      : "border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] py-0 px-1.5 font-semibold ${
                          insight.type === "positive"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300"
                        }`}
                      >
                        {insight.typeLabel}
                      </Badge>
                      <span className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                        {insight.title}
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-xs leading-relaxed">
                      {insight.description}
                    </p>
                    <div className="text-[10px] text-gray-400">Source: {insight.source}</div>
                  </div>

                  {insight.actionModule && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleNav(insight.actionModule!)}
                      className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shrink-0 self-start sm:self-center h-8"
                    >
                      {insight.actionLabel || "View"}
                      <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 11. NEED HUMAN SUPPORT? (EXPERT SUPPORT CALLOUT) ── */}
      <Card className="border border-emerald-200 dark:border-emerald-800/80 bg-linear-to-r from-emerald-500/10 via-emerald-500/5 to-transparent">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Need Human Agricultural Support?
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 max-w-2xl leading-relaxed">
                  When dealing with severe crop pest infestations, complicated soil salinity, or formal insurance claims, consult local Krishi Vigyan Kendra (KVK) scientists or call the national Kisan Call Center (1551).
                </p>
              </div>
            </div>

            <Button
              onClick={() => handleNav("expert-support")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 self-start sm:self-center h-9 px-4"
            >
              Find Agricultural Support
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 17. IMPROVE YOUR FARM INTELLIGENCE (MISSING DATA) ── */}
      {Array.isArray(missingItems) && missingItems.length > 0 && (
        <Card className="border border-gray-200 dark:border-gray-800 shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-3 border-b border-gray-100 dark:border-gray-800">
            <CardTitle className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              Improve Your Farm Intelligence
            </CardTitle>
            <CardDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Providing these missing parameters enables higher precision for AI models and recommendations.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-3 space-y-2.5">
            {missingItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
              >
                <div>
                  <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {item.description}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleNav(item.actionModule)}
                  className="text-xs h-7 shrink-0 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                >
                  {item.actionLabel}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── 14. DATA SOURCES & PLATFORM TRANSPARENCY ── */}
      <Card className="border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 text-xs text-gray-600 dark:text-gray-400">
        <CardContent className="p-4 sm:p-5 space-y-2">
          <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-emerald-600" />
            Connected Data Sources & Methodology
          </div>
          <p className="leading-relaxed">
            The Farm Intelligence screen synthesizes data from multiple real-world agricultural networks:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div className="p-2 bg-white dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-800">
              <strong>OpenWeather:</strong> Live temperature, humidity, wind & precipitation
            </div>
            <div className="p-2 bg-white dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-800">
              <strong>NASA POWER:</strong> Historical MERRA-2 solar radiation & agroclimatology
            </div>
            <div className="p-2 bg-white dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-800">
              <strong>Agmarknet Mandi:</strong> Government wholesale commodity modal prices
            </div>
            <div className="p-2 bg-white dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-800">
              <strong>MoA&FW Portals:</strong> Verified Central & State government schemes
            </div>
          </div>
          <p className="text-[10px] text-gray-400 pt-1">
            Crops Wild is an independent agricultural intelligence system. Recommendations are intended for decision support and do not guarantee yield or financial outcome. Always verify statutory criteria on official portals.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default FarmIntelligence;
