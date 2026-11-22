import React, { useState, useEffect } from "react";
import {
  Layers,
  Sprout,
  FlaskConical,
  CloudSun,
  Thermometer,
  Droplets,
  Sun,
  Wind,
  Satellite,
  Compass,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  FileText,
  ShieldCheck,
  Activity,
  Sparkles,
  BarChart3,
  TrendingUp,
  Info,
  Radio,
  Clock,
  ChevronRight,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWeather } from "@/components/dashboard/WeatherContext";
import { farmProfileService, CompleteFarmProfile } from "@/services/farmProfileService";
import { useAuth } from "@/context/AuthContext";

interface SoilEnvironmentIntelligenceProps {
  onNavigate?: (module: string) => void;
}

export function SoilEnvironmentIntelligence({ onNavigate }: SoilEnvironmentIntelligenceProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CompleteFarmProfile>(() =>
    farmProfileService.getFarmProfile(user)
  );

  const {
    liveWeather,
    locationName,
    coordinates,
    openWeatherLoading,
    openWeatherError,
    nasaData,
    nasaLoading,
    nasaError,
    refreshWeather,
    refreshNasaData,
  } = useWeather();

  const [activeTrendTab, setActiveTrendTab] = useState<"temp" | "precip" | "solar" | "humidity">("temp");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync profile reactively whenever updated elsewhere
  useEffect(() => {
    const unsub = farmProfileService.onProfileChange((updated) => {
      setProfile(updated);
    });
    return unsub;
  }, []);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([refreshWeather(), refreshNasaData()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Profile data extraction (strict check on real presence)
  const farmLocation = [profile.farmer.district, profile.farmer.state]
    .filter(Boolean)
    .join(", ");
  const hasFarmLocation = Boolean(farmLocation && farmLocation.trim() !== "");
  const hasFarmSize = Boolean(profile.farm.farmSize && profile.farm.farmSize > 0);
  const hasCurrentCrop = Boolean(profile.farm.currentCrops && profile.farm.currentCrops.trim() !== "");
  const hasSoilType = Boolean(profile.soil.soilType && profile.soil.soilType.trim() !== "");
  const hasIrrigation = Boolean(profile.farm.irrigationType && profile.farm.irrigationType.trim() !== "");

  const hasMissingFarmContext =
    !hasFarmLocation || !hasFarmSize || !hasCurrentCrop || !hasSoilType || !hasIrrigation;

  // Soil parameters check
  const hasPh = typeof profile.soil.ph === "number" && profile.soil.ph > 0;
  const hasN = typeof profile.soil.nitrogen === "number" && profile.soil.nitrogen > 0;
  const hasP = typeof profile.soil.phosphorus === "number" && profile.soil.phosphorus > 0;
  const hasK = typeof profile.soil.potassium === "number" && profile.soil.potassium > 0;
  const hasOrganicCarbon =
    typeof profile.soil.organicCarbon === "number" && profile.soil.organicCarbon > 0;
  const hasSoilTestDate = Boolean(
    profile.soil.lastTestedDate && profile.soil.lastTestedDate.trim() !== ""
  );

  const isSoilProfileIncomplete = !hasSoilType || !hasPh || !hasN || !hasP || !hasK;

  // Format soil test date
  const formattedTestDate = React.useMemo(() => {
    if (!profile.soil.lastTestedDate) return null;
    try {
      const d = new Date(profile.soil.lastTestedDate);
      if (isNaN(d.getTime())) return profile.soil.lastTestedDate;
      return d.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return profile.soil.lastTestedDate;
    }
  }, [profile.soil.lastTestedDate]);

  // Agronomic interpretation for pH
  const getPhInterpretation = (ph: number) => {
    if (ph < 5.5) return { label: "Strongly Acidic", color: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-300" };
    if (ph < 6.5) return { label: "Moderately Acidic", color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300" };
    if (ph <= 7.5) return { label: "Optimal / Neutral", color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300" };
    if (ph <= 8.5) return { label: "Moderately Alkaline", color: "text-blue-700 bg-blue-50 dark:bg-blue-950/40 border-blue-300" };
    return { label: "Strongly Alkaline", color: "text-purple-700 bg-purple-50 dark:bg-purple-950/40 border-purple-300" };
  };

  // NPK ratings
  const getNpkLevel = (val: number, type: "N" | "P" | "K") => {
    if (type === "N") {
      if (val < 50) return { label: "Low", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200" };
      if (val <= 120) return { label: "Medium", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200" };
      return { label: "High", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200" };
    }
    if (type === "P") {
      if (val < 30) return { label: "Low", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200" };
      if (val <= 70) return { label: "Medium", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200" };
      return { label: "High", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200" };
    }
    if (type === "K") {
      if (val < 40) return { label: "Low", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200" };
      if (val <= 100) return { label: "Medium", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200" };
      return { label: "High", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200" };
    }
    return { label: "Standard", color: "text-gray-600 bg-gray-50 border-gray-200" };
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-6 border-b border-border/60">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-3">
            <Layers className="h-3.5 w-3.5" />
            <span>Farm Intelligence Layer</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            SOIL &amp; ENVIRONMENT INTELLIGENCE
          </h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
            Understand the soil and environmental conditions around your farm using available farm data and trusted external sources.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="gap-2 text-xs font-semibold border-border hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh Data"}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => onNavigate?.("profile")}
            className="gap-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <span>Update Farm Profile</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── 4-TIER PROVENANCE LEGEND ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-card border border-border/60 text-xs shadow-sm">
        <div className="flex items-center gap-2 p-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
          <div>
            <span className="font-semibold block text-foreground">1. Farmer Input</span>
            <span className="text-[11px] text-muted-foreground">Self-reported / Soil Card</span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
          <div>
            <span className="font-semibold block text-foreground">2. Measured / API</span>
            <span className="text-[11px] text-muted-foreground">OpenWeather &amp; NASA</span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-purple-500 shrink-0" />
          <div>
            <span className="font-semibold block text-foreground">3. Satellite Telemetry</span>
            <span className="text-[11px] text-muted-foreground">Surface Remote Sensing</span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
          <div>
            <span className="font-semibold block text-foreground">4. AI Estimates</span>
            <span className="text-[11px] text-muted-foreground">Verified Models Only</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: FARM CONTEXT ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600" />
            <span>Farm Context</span>
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            Source: Farmer Profile (My Farm)
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Farm Location */}
            {hasFarmLocation && (
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Farm Location
                </span>
                <span className="text-sm font-bold text-foreground mt-1 block truncate">
                  {farmLocation}
                </span>
                <Badge variant="outline" className="mt-2 text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                  Source: Farmer Input
                </Badge>
              </div>
            )}

            {/* Farm Size */}
            {hasFarmSize && (
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Farm Size
                </span>
                <span className="text-sm font-bold text-foreground mt-1 block">
                  {profile.farm.farmSize} {profile.farm.farmSizeUnit}
                </span>
                <Badge variant="outline" className="mt-2 text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                  Source: Farmer Input
                </Badge>
              </div>
            )}

            {/* Current Crop */}
            {hasCurrentCrop && (
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Current Crop
                </span>
                <span className="text-sm font-bold text-foreground mt-1 block truncate">
                  {profile.farm.currentCrops}
                </span>
                <Badge variant="outline" className="mt-2 text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                  Source: Farmer Input
                </Badge>
              </div>
            )}

            {/* Soil Type */}
            {hasSoilType && (
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Soil Type
                </span>
                <span className="text-sm font-bold text-foreground mt-1 block">
                  {profile.soil.soilType}
                </span>
                <Badge variant="outline" className="mt-2 text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                  Source: Farmer Input
                </Badge>
              </div>
            )}

            {/* Irrigation Type */}
            {hasIrrigation && (
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Irrigation Type
                </span>
                <span className="text-sm font-bold text-foreground mt-1 block">
                  {profile.farm.irrigationType}
                </span>
                <Badge variant="outline" className="mt-2 text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                  Source: Farmer Input
                </Badge>
              </div>
            )}
          </div>

          {/* Missing Context Callout */}
          {hasMissingFarmContext && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    Complete your Farm Profile to improve farm intelligence.
                  </p>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/70 mt-0.5">
                    Adding missing farm specifications enhances agronomic precision for Crop and Fertilizer AI recommendations.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate?.("profile")}
                className="text-xs font-semibold border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 shrink-0"
              >
                Update Farm Profile
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 2 & 3: YOUR SOIL & DATA STATUS ── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Sprout className="h-4 w-4 text-emerald-600" />
              <span>Your Soil</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Physical and chemical properties entered from your farm records or laboratory Soil Health Card.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isSoilProfileIncomplete ? (
              <Badge variant="outline" className="text-xs font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/50 border-amber-300 gap-1.5 py-1">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                <span>Soil Data Incomplete</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 gap-1.5 py-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Soil Baseline Active</span>
              </Badge>
            )}
          </div>
        </div>

        {/* Soil Parameters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Soil Type */}
          <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Soil Type
                </span>
                <Layers className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-3">
                {hasSoilType ? (
                  <>
                    <div className="text-2xl font-black text-foreground">
                      {profile.soil.soilType}
                    </div>
                    <span className="text-xs text-muted-foreground mt-0.5 block">
                      Texture classification
                    </span>
                  </>
                ) : (
                  <div className="text-sm font-medium text-muted-foreground italic">
                    Not specified
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Source:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {hasSoilType ? "Farmer Input" : "Unknown"}
              </span>
            </div>
          </div>

          {/* Soil pH */}
          <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Soil pH
                </span>
                <FlaskConical className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-3">
                {hasPh ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-foreground">
                        {profile.soil.ph.toFixed(1)}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getPhInterpretation(profile.soil.ph).color}`}>
                        {getPhInterpretation(profile.soil.ph).label}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-0.5 block">
                      Scale: 0 (Acidic) to 14 (Alkaline)
                    </span>
                  </>
                ) : (
                  <div className="text-sm font-medium text-muted-foreground italic">
                    Not tested
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Source:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {hasPh ? "Farmer Input" : "Unknown"}
              </span>
            </div>
          </div>

          {/* Available Primary Nutrients (N-P-K) */}
          <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col justify-between sm:col-span-2 lg:col-span-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Primary Nutrients (NPK)
                </span>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3">
                {/* Nitrogen */}
                <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground">Nitrogen (N)</span>
                    {hasN && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${getNpkLevel(profile.soil.nitrogen, "N").color}`}>
                        {getNpkLevel(profile.soil.nitrogen, "N").label}
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-black text-foreground mt-1">
                    {hasN ? `${profile.soil.nitrogen}` : "—"}
                    <span className="text-[11px] font-normal text-muted-foreground ml-1">kg/ha</span>
                  </div>
                </div>

                {/* Phosphorus */}
                <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground">Phosphorus (P)</span>
                    {hasP && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${getNpkLevel(profile.soil.phosphorus, "P").color}`}>
                        {getNpkLevel(profile.soil.phosphorus, "P").label}
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-black text-foreground mt-1">
                    {hasP ? `${profile.soil.phosphorus}` : "—"}
                    <span className="text-[11px] font-normal text-muted-foreground ml-1">kg/ha</span>
                  </div>
                </div>

                {/* Potassium */}
                <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground">Potassium (K)</span>
                    {hasK && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${getNpkLevel(profile.soil.potassium, "K").color}`}>
                        {getNpkLevel(profile.soil.potassium, "K").label}
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-black text-foreground mt-1">
                    {hasK ? `${profile.soil.potassium}` : "—"}
                    <span className="text-[11px] font-normal text-muted-foreground ml-1">kg/ha</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Source:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {hasN || hasP || hasK ? "Farmer Input / Soil Card" : "Unknown"}
              </span>
            </div>
          </div>
        </div>

        {/* Additional Soil Properties & In-Situ Sensors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Organic Carbon */}
          <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Organic Carbon
              </span>
              <div className="mt-2">
                {hasOrganicCarbon ? (
                  <div className="text-xl font-bold text-foreground">
                    {profile.soil.organicCarbon}%
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    Not recorded in profile
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Source:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {hasOrganicCarbon ? "Farmer Input" : "—"}
              </span>
            </div>
          </div>

          {/* Soil Moisture (In-situ / Telemetry) */}
          <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Soil Moisture (In-Situ)
                </span>
                <Droplets className="h-4 w-4 text-cyan-600" />
              </div>
              <div className="mt-2">
                <div className="text-sm font-semibold text-muted-foreground">
                  No In-Situ Sensor Linked
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Direct volumetric water content requires an IoT soil probe or verified field telemetry.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Source:</span>
              <span className="text-muted-foreground font-mono text-[10px]">
                Hardware Probe (Unconnected)
              </span>
            </div>
          </div>

          {/* Soil Temperature (In-situ / Telemetry) */}
          <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Soil Temperature (Root Depth)
                </span>
                <Thermometer className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-2">
                <div className="text-sm font-semibold text-muted-foreground">
                  No Sub-surface Sensor Linked
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Sub-surface root temperature requires ground probe telemetry at 10cm–30cm depth.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Source:</span>
              <span className="text-muted-foreground font-mono text-[10px]">
                Hardware Probe (Unconnected)
              </span>
            </div>
          </div>
        </div>

        {/* Soil Status Notice & Action */}
        {isSoilProfileIncomplete && (
          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Some soil information is missing.
                </h3>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5 max-w-2xl leading-relaxed">
                  Adding soil test results can improve the accuracy of farm recommendations. You can record your Soil Health Card values anytime in your profile.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => onNavigate?.("profile")}
              className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shrink-0"
            >
              Update Soil Information
            </Button>
          </div>
        )}
      </section>

      {/* ── SECTION 4: SOIL TEST INFORMATION ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-600" />
            <span>Soil Test Information</span>
          </h2>
          <span className="text-xs text-muted-foreground">
            Official Laboratory / Soil Health Card record
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-sm">
          {hasSoilTestDate ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-foreground">
                    Test Date: <span className="font-bold">{formattedTestDate}</span>
                  </span>
                </div>
                <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 w-fit">
                  Source: Laboratory Soil Health Card
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                    pH Level
                  </span>
                  <span className="font-bold text-sm text-foreground mt-0.5 block">
                    {hasPh ? profile.soil.ph.toFixed(1) : "—"}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                    Nitrogen (N)
                  </span>
                  <span className="font-bold text-sm text-foreground mt-0.5 block">
                    {hasN ? `${profile.soil.nitrogen} kg/ha` : "—"}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                    Phosphorus (P)
                  </span>
                  <span className="font-bold text-sm text-foreground mt-0.5 block">
                    {hasP ? `${profile.soil.phosphorus} kg/ha` : "—"}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                    Potassium (K)
                  </span>
                  <span className="font-bold text-sm text-foreground mt-0.5 block">
                    {hasK ? `${profile.soil.potassium} kg/ha` : "—"}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                    Organic Carbon
                  </span>
                  <span className="font-bold text-sm text-foreground mt-0.5 block">
                    {hasOrganicCarbon ? `${profile.soil.organicCarbon}%` : "—"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    No soil test data available.
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Add a soil test result when available for more accurate soil-based recommendations.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate?.("profile")}
                className="text-xs font-semibold shrink-0"
              >
                Add Soil Test Record
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 5 & 6: ENVIRONMENTAL CONDITIONS ── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <CloudSun className="h-4 w-4 text-blue-600" />
              <span>Environmental Conditions</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Measured atmospheric parameters and solar irradiance for farm context and agroclimatological monitoring.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-mono">
              Coordinates: {coordinates ? `${coordinates.lat.toFixed(2)}°N, ${coordinates.lon.toFixed(2)}°E` : "Location default"}
            </span>
          </div>
        </div>

        {/* Environmental Context Notice */}
        <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 text-xs text-blue-950 dark:text-blue-200 flex items-center gap-2.5">
          <Info className="h-4 w-4 text-blue-600 shrink-0" />
          <span>
            <strong>Distinction:</strong> Weather Intelligence covers short-term forecasts and rain warnings. Soil &amp; Environment tracks ongoing environmental conditions and solar energy baselines.
          </span>
        </div>

        {/* Real Environmental Cards Grid */}
        {openWeatherLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 rounded-2xl bg-card border border-border/70 space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-36" />
              </div>
            ))}
          </div>
        ) : openWeatherError && !liveWeather ? (
          <div className="p-6 rounded-2xl bg-card border border-border/70 text-center space-y-3">
            <AlertCircle className="h-6 w-6 text-amber-500 mx-auto" />
            <p className="text-sm font-semibold text-foreground">
              Current atmospheric conditions are temporarily unavailable.
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {openWeatherError}
            </p>
            <Button size="sm" variant="outline" onClick={refreshWeather} className="text-xs gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Try Again</span>
            </Button>
          </div>
        ) : liveWeather ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Air Temperature */}
            <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Air Temperature
                  </span>
                  <Thermometer className="h-4 w-4 text-amber-500" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-foreground">
                    {liveWeather.temperature}°C
                  </div>
                  <span className="text-xs text-muted-foreground mt-0.5 block">
                    Feels like {liveWeather.feelsLike}°C • {liveWeather.condition}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Source:</span>
                <span className="font-semibold text-blue-700 dark:text-blue-400">
                  {liveWeather.source}
                </span>
              </div>
            </div>

            {/* Relative Humidity */}
            <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Relative Humidity
                  </span>
                  <Droplets className="h-4 w-4 text-cyan-500" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-foreground">
                    {liveWeather.humidity}%
                  </div>
                  <span className="text-xs text-muted-foreground mt-0.5 block">
                    Vapor pressure ratio
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Source:</span>
                <span className="font-semibold text-blue-700 dark:text-blue-400">
                  {liveWeather.source}
                </span>
              </div>
            </div>

            {/* Solar Radiation (NASA POWER) */}
            <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Solar Radiation
                  </span>
                  <Sun className="h-4 w-4 text-amber-500" />
                </div>
                <div className="mt-3">
                  {nasaLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : nasaData ? (
                    <>
                      <div className="text-2xl font-black text-foreground">
                        {nasaData.summary.avgSolarRadiation}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          MJ/m²/day
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground mt-0.5 block">
                        Surface Downwelling (30d mean)
                      </span>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">Unavailable</div>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Source:</span>
                <span className="font-semibold text-blue-700 dark:text-blue-400">
                  NASA POWER
                </span>
              </div>
            </div>

            {/* Precipitation & Wind */}
            <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Precipitation &amp; Wind
                  </span>
                  <Wind className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-foreground">
                    {liveWeather.rainfall} mm
                  </div>
                  <span className="text-xs text-muted-foreground mt-0.5 block">
                    Wind: {liveWeather.windSpeed} km/h • {liveWeather.windDirection}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Source:</span>
                <span className="font-semibold text-blue-700 dark:text-blue-400">
                  {liveWeather.source}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── SECTION 7 & 8: SATELLITE / REMOTE SENSING & NDVI ── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Satellite className="h-4 w-4 text-purple-600" />
              <span>Satellite &amp; Remote Sensing</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Earth observation satellite telemetry, vegetation index (NDVI), and multispectral surface imaging.
            </p>
          </div>

          <Badge variant="outline" className="text-xs font-mono text-purple-700 bg-purple-50 dark:bg-purple-950/40 border-purple-300 w-fit">
            Status: Pending Farm Geofence
          </Badge>
        </div>

        {/* Honest Unconnected State as mandated by Rule #7 */}
        <div className="p-6 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60">
            <div className="flex items-start gap-3">
              <Radio className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h3 className="text-sm font-bold text-purple-950 dark:text-purple-200">
                  Satellite insights will appear when satellite data is available for your farm.
                </h3>
                <p className="text-xs text-purple-900/80 dark:text-purple-300/80 mt-1 max-w-2xl leading-relaxed">
                  Remote sensing indices such as NDVI (Normalized Difference Vegetation Index) require linking farm polygon geofencing with earth observation missions (Sentinel-2 or Landsat).
                </p>
              </div>
            </div>
          </div>

          {/* Scientific Transparency Card regarding Satellite Capabilities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-xs space-y-2">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                What Satellite Data Measures
              </span>
              <p className="text-muted-foreground leading-relaxed text-[11px]">
                Multispectral satellites measure top-of-canopy solar reflectance across Visible (Red) and Near-Infrared (NIR) spectrums to compute vegetation vigor, canopy coverage, and leaf area density.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-xs space-y-2">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                What Satellite Data Does NOT Measure
              </span>
              <p className="text-muted-foreground leading-relaxed text-[11px]">
                Optical satellite sensors cannot measure chemical soil parameters such as pH, Nitrogen, Phosphorus, or Potassium below the surface. These require physical soil tests.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 9: ENVIRONMENTAL TRENDS (NASA POWER 30-DAY DATA) ── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              <span>Environmental Trends</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Historical agroclimatological trends from NASA POWER (MERRA-2 assimilation dataset).
            </p>
          </div>

          {/* Tab selector */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-xl self-start">
            <button
              onClick={() => setActiveTrendTab("temp")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTrendTab === "temp"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Temperature
            </button>
            <button
              onClick={() => setActiveTrendTab("precip")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTrendTab === "precip"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Rainfall
            </button>
            <button
              onClick={() => setActiveTrendTab("solar")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTrendTab === "solar"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Solar Radiation
            </button>
            <button
              onClick={() => setActiveTrendTab("humidity")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTrendTab === "humidity"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Humidity
            </button>
          </div>
        </div>

        {/* Trend Content */}
        <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pb-3 border-b border-border/50">
            <div>
              <span className="text-muted-foreground">Data Period: </span>
              <span className="font-bold text-foreground">
                {nasaData?.periodLabel || "Last 30-Day Observation Window"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-semibold text-blue-700 bg-blue-50 dark:bg-blue-950/40 border-blue-300">
                Source: NASA POWER
              </Badge>
              <span className="text-muted-foreground text-[11px]">
                {nasaData?.records.length ?? 0} daily points
              </span>
            </div>
          </div>

          {nasaLoading ? (
            <div className="space-y-3 py-10">
              <Skeleton className="h-60 w-full rounded-xl" />
              <div className="flex justify-center">
                <span className="text-xs text-muted-foreground animate-pulse">
                  Loading NASA agroclimatology dataset...
                </span>
              </div>
            </div>
          ) : nasaError && !nasaData ? (
            <div className="py-12 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="text-sm font-semibold text-foreground">
                Environmental history is temporarily unavailable.
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {nasaError}
              </p>
              <Button size="sm" variant="outline" onClick={refreshNasaData} className="text-xs gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Try Again</span>
              </Button>
            </div>
          ) : nasaData && nasaData.records.length > 0 ? (
            <div className="space-y-4">
              {/* Summary Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                  <span className="text-muted-foreground text-[11px] block">Mean Temp</span>
                  <span className="text-lg font-bold text-foreground mt-0.5 block">
                    {nasaData.summary.avgTemp}°C
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Min: {nasaData.summary.minTemp}°C / Max: {nasaData.summary.maxTemp}°C
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                  <span className="text-muted-foreground text-[11px] block">Total Rainfall</span>
                  <span className="text-lg font-bold text-foreground mt-0.5 block">
                    {nasaData.summary.totalPrecipitation} mm
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    30-day cumulative precipitation
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                  <span className="text-muted-foreground text-[11px] block">Avg Solar Radiation</span>
                  <span className="text-lg font-bold text-foreground mt-0.5 block">
                    {nasaData.summary.avgSolarRadiation} MJ/m²
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Daily surface irradiance
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                  <span className="text-muted-foreground text-[11px] block">Avg Humidity</span>
                  <span className="text-lg font-bold text-foreground mt-0.5 block">
                    {nasaData.summary.avgHumidity}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Mean relative humidity
                  </span>
                </div>
              </div>

              {/* Chart Container */}
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  {activeTrendTab === "temp" ? (
                    <AreaChart data={nasaData.records} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                      <YAxis unit="°C" domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                      <Area
                        type="monotone"
                        dataKey="tempMean"
                        name="Mean Temp (°C)"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#tempGradient)"
                      />
                      <Line
                        type="monotone"
                        dataKey="tempMax"
                        name="Max Temp (°C)"
                        stroke="#ef4444"
                        strokeWidth={1.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="tempMin"
                        name="Min Temp (°C)"
                        stroke="#3b82f6"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </AreaChart>
                  ) : activeTrendTab === "precip" ? (
                    <BarChart data={nasaData.records} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                      <YAxis unit="mm" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                      <Bar dataKey="precipitation" name="Rainfall (mm/day)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : activeTrendTab === "solar" ? (
                    <AreaChart data={nasaData.records} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#eab308" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#eab308" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                      <YAxis unit=" MJ" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                      <Area
                        type="monotone"
                        dataKey="solarRadiation"
                        name="Solar Irradiance (MJ/m²/day)"
                        stroke="#eab308"
                        strokeWidth={2}
                        fill="url(#solarGradient)"
                      />
                    </AreaChart>
                  ) : (
                    <LineChart data={nasaData.records} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                      <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                      <Line
                        type="monotone"
                        dataKey="humidity"
                        name="Relative Humidity (%)"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground italic">
              No historical trend records found for this coordinate.
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 10: DATA AVAILABILITY ── */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Data Availability</span>
        </h2>
        <p className="text-xs text-muted-foreground">
          Clear overview of what data streams Crops Wild actually has for your farm.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-card border border-border/70 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Farmer Soil Input
              </span>
              <span className="text-[11px] text-muted-foreground">
                Self-reported profile properties
              </span>
            </div>
            <Badge
              variant="outline"
              className={
                isSoilProfileIncomplete
                  ? "text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-300"
                  : "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300"
              }
            >
              {isSoilProfileIncomplete ? "Incomplete" : "Available"}
            </Badge>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border/70 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Soil Health Card / Test
              </span>
              <span className="text-[11px] text-muted-foreground">
                Certified laboratory record
              </span>
            </div>
            <Badge
              variant="outline"
              className={
                hasSoilTestDate
                  ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300"
                  : "text-muted-foreground bg-muted border-border"
              }
            >
              {hasSoilTestDate ? "Available" : "Not Available"}
            </Badge>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border/70 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Atmospheric Weather
              </span>
              <span className="text-[11px] text-muted-foreground">
                Real-time station observations
              </span>
            </div>
            <Badge
              variant="outline"
              className={
                liveWeather
                  ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300"
                  : "text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-300"
              }
            >
              {liveWeather ? "Available" : "Connecting"}
            </Badge>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border/70 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Agroclimatology &amp; Solar
              </span>
              <span className="text-[11px] text-muted-foreground">
                NASA POWER 30-day baseline
              </span>
            </div>
            <Badge
              variant="outline"
              className={
                nasaData
                  ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300"
                  : "text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-300"
              }
            >
              {nasaData ? "Available" : "Loading"}
            </Badge>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border/70 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Satellite Remote Sensing
              </span>
              <span className="text-[11px] text-muted-foreground">
                Sentinel-2 / Landsat NDVI
              </span>
            </div>
            <Badge variant="outline" className="text-muted-foreground bg-muted border-border">
              Not Available
            </Badge>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border/70 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                In-Situ Soil Moisture Probe
              </span>
              <span className="text-[11px] text-muted-foreground">
                Hardware field sensor
              </span>
            </div>
            <Badge variant="outline" className="text-muted-foreground bg-muted border-border">
              Not Available
            </Badge>
          </div>
        </div>
      </section>

      {/* ── SECTION 11: AI ESTIMATES TRANSPARENCY ── */}
      <section className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">
                AI Estimation Layer
              </h3>
              <Badge variant="outline" className="text-[10px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-300">
                AI Estimated: None Active
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-3xl leading-relaxed">
              Crops Wild strictly avoids synthetic machine learning approximations for chemical soil properties (pH, Nitrogen, Phosphorus, Potassium). All nutrient values are derived only from verified farmer inputs or certified Soil Health Card laboratory testing.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 12: CONNECTION TO CROP & FERTILIZER AI ── */}
      <section className="space-y-4">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-card to-cyan-500/10 border border-emerald-500/20 shadow-sm space-y-5">
          <div>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
              Farm Intelligence Pipeline
            </span>
            <h3 className="text-lg font-extrabold text-foreground mt-0.5">
              Power Your Agricultural Advisory
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Your verified farm context, soil texture ({profile.soil.soilType || "Unset"}), and current environmental parameters automatically feed into Crops Wild AI engines for targeted recommendations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => onNavigate?.("crop-recommendation")}
              className="gap-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Sprout className="h-4 w-4" />
              <span>Run Crop Recommendation</span>
            </Button>

            <Button
              onClick={() => onNavigate?.("fertilizer-recommendation")}
              variant="outline"
              className="gap-2 text-xs font-semibold border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
            >
              <FlaskConical className="h-4 w-4 text-emerald-600" />
              <span>Run Fertilizer Recommendation</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ── SECTION 16: DATA SOURCES & PROVENANCE TRANSPARENCY ── */}
      <section className="space-y-3 pt-4 border-t border-border/60">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Data Sources &amp; Provenance</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-card border border-border/60">
            <span className="font-bold text-foreground block">
              1. Farmer Profile &amp; Soil Test
            </span>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Self-reported farmer records, acreage, and Soil Health Card laboratory testing data saved in My Farm.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border/60">
            <span className="font-bold text-foreground block">
              2. OpenWeather / Open-Meteo
            </span>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Near-real-time atmospheric measurements including air temperature, humidity, wind velocity, and precipitation.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border/60">
            <span className="font-bold text-foreground block">
              3. NASA POWER (Agroclimatology)
            </span>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              NASA Langley Research Center MERRA-2 and GEOS-IT global satellite assimilation models for historical solar radiation and thermal baselines.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default SoilEnvironmentIntelligence;
