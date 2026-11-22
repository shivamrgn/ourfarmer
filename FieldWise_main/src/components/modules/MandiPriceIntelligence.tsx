import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  Info,
  Scale,
  Building2,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  ShieldAlert,
  Sprout,
  Store,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  mandiIntelligenceService,
  MandiRecord,
  MandiTrendPoint,
} from "@/services/marketPricesService";
import { farmProfileService, CompleteFarmProfile } from "@/services/farmProfileService";
import { useAuth } from "@/context/AuthContext";

interface MandiPriceIntelligenceProps {
  onNavigate?: (module: string) => void;
  className?: string;
}

export function MandiPriceIntelligence({
  onNavigate,
  className,
}: MandiPriceIntelligenceProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CompleteFarmProfile>(() =>
    farmProfileService.getFarmProfile(user)
  );

  // Sync profile reactively
  useEffect(() => {
    const unsub = farmProfileService.onProfileChange((updated) => {
      setProfile(updated);
    });
    return unsub;
  }, []);

  // Mode: By default true (Demo Reference Mode) so farmer can inspect real APMC benchmark data, with toggle for live gateway
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

  // Filter states
  const [selectedCommodity, setSelectedCommodity] = useState<string>("Wheat");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedMarket, setSelectedMarket] = useState<string>("all");

  // Sorting
  const [sortBy, setSortBy] = useState<"highest" | "lowest" | "name">("highest");

  // Fetch state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [records, setRecords] = useState<MandiRecord[]>([]);
  const [activeSource, setActiveSource] = useState<string>("");
  const [isLiveActive, setIsLiveActive] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Pre-select crop from farmer's profile if available
  useEffect(() => {
    if (profile.farm.currentCrops) {
      const cropsList = profile.farm.currentCrops
        .split(",")
        .map((c) => c.trim().toLowerCase());
      const available = mandiIntelligenceService.getAvailableCommodities();
      const matched = available.find((comm) =>
        cropsList.some((farmerCrop) => comm.toLowerCase().includes(farmerCrop) || farmerCrop.includes(comm.toLowerCase()))
      );
      if (matched) {
        setSelectedCommodity(matched);
      }
    }
  }, [profile.farm.currentCrops]);

  // Load data based on filters
  const loadMandiData = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const result = await mandiIntelligenceService.getMandiRecords({
        commodity: selectedCommodity,
        state: selectedState,
        district: selectedDistrict,
        market: selectedMarket,
        isDemoMode,
      });

      setRecords(result.records);
      setActiveSource(result.source);
      setIsLiveActive(result.isLive);
      if (result.error) {
        setApiError(result.error);
      }
    } catch {
      setApiError("Market data is temporarily unavailable.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMandiData();
  }, [selectedCommodity, selectedState, selectedDistrict, selectedMarket, isDemoMode]);

  // Available filter options
  const commoditiesList = useMemo(
    () => mandiIntelligenceService.getAvailableCommodities(),
    []
  );

  const statesList = useMemo(
    () => mandiIntelligenceService.getAvailableStates(selectedCommodity),
    [selectedCommodity]
  );

  const districtsList = useMemo(
    () => mandiIntelligenceService.getAvailableDistricts(selectedState, selectedCommodity),
    [selectedState, selectedCommodity]
  );

  const marketsList = useMemo(
    () =>
      mandiIntelligenceService.getAvailableMarkets(
        selectedState,
        selectedDistrict,
        selectedCommodity
      ),
    [selectedState, selectedDistrict, selectedCommodity]
  );

  // Trends & price change calculations (from real records only)
  const trendData = useMemo(() => {
    return mandiIntelligenceService.getCommodityTrend(selectedCommodity, isDemoMode);
  }, [selectedCommodity, isDemoMode]);

  // Primary market price record
  const primaryRecord = records.length > 0 ? records[0] : null;

  // Sorted comparison list
  const sortedRecords = useMemo(() => {
    const list = [...records];
    if (sortBy === "highest") {
      list.sort((a, b) => b.modalPrice - a.modalPrice);
    } else if (sortBy === "lowest") {
      list.sort((a, b) => a.modalPrice - b.modalPrice);
    } else if (sortBy === "name") {
      list.sort((a, b) => a.market.localeCompare(b.market));
    }
    return list;
  }, [records, sortBy]);

  // Farmer's crop comparison check
  const isViewingFarmerCrop = useMemo(() => {
    if (!profile.farm.currentCrops) return false;
    const farmerCrops = profile.farm.currentCrops
      .toLowerCase()
      .split(",")
      .map((c) => c.trim());
    return farmerCrops.some((c) => c.includes(selectedCommodity.toLowerCase()) || selectedCommodity.toLowerCase().includes(c));
  }, [profile.farm.currentCrops, selectedCommodity]);

  const hasFarmLocation = Boolean(profile.farmer.district || profile.farmer.state);
  const farmLocationDisplay = [profile.farmer.district, profile.farmer.state]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={`p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto ${className || ""}`}>
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-6 border-b border-border/60">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-3">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Mandi Price Intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            MANDI PRICE INTELLIGENCE
          </h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
            Check available market prices and understand recent price trends for your crops.
          </p>
        </div>

        {/* Live vs Demo Mode Toggle */}
        <div className="flex items-center gap-2 self-start flex-wrap">
          <div className="flex items-center p-1 bg-muted rounded-xl text-xs font-semibold">
            <button
              onClick={() => setIsDemoMode(false)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                !isDemoMode
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Live Gateway
            </button>
            <button
              onClick={() => setIsDemoMode(true)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                isDemoMode
                  ? "bg-card text-emerald-700 dark:text-emerald-300 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Demo Reference
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadMandiData}
            disabled={isLoading}
            className="gap-2 text-xs font-semibold border-border hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
            <span>{isLoading ? "Updating..." : "Refresh"}</span>
          </Button>
        </div>
      </div>

      {/* ── DEMO MODE NOTICE (STRICTLY LABELED AS PER RULE #11) ── */}
      {isDemoMode && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs">
          <div className="flex items-start gap-2.5">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-200">
                Demo Mode — Not Live Market Data
              </span>
              <p className="text-amber-800/80 dark:text-amber-300/80 mt-0.5 text-[11px] leading-relaxed">
                Displaying verified historical APMC benchmark records (Agmarknet) for decision-workflow demonstration. These reflect historical bulletin quotes and not today's live transactions.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-semibold text-amber-800 bg-amber-100/70 border-amber-300 shrink-0">
            Reference Benchmark
          </Badge>
        </div>
      )}

      {/* ── SECTION 1: FARM CONTEXT ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <Sprout className="h-4 w-4 text-emerald-600" />
            <span>Farm Context</span>
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            Source: My Farm Profile
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Current Crop */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Your Saved Crop
              </span>
              <div className="text-sm font-bold text-foreground mt-1 truncate">
                {profile.farm.currentCrops || "No crop specified"}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 block">
                {profile.farm.currentCrops
                  ? "Linked to market selector"
                  : "Save your crop in My Farm"}
              </span>
            </div>

            {/* Location */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Farm Location
              </span>
              <div className="text-sm font-bold text-foreground mt-1 truncate">
                {hasFarmLocation ? farmLocationDisplay : "Location not set"}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 block">
                {hasFarmLocation ? "Default regional filter" : "Set district in My Farm"}
              </span>
            </div>

            {/* Farm Size & Soil */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Farm Size &amp; Soil
              </span>
              <div className="text-sm font-bold text-foreground mt-1">
                {profile.farm.farmSize ? `${profile.farm.farmSize} ${profile.farm.farmSizeUnit}` : "—"} • {profile.soil.soilType || "Unset"}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Contextual production baseline
              </span>
            </div>
          </div>

          {!profile.farm.currentCrops && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 text-xs">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-emerald-900 dark:text-emerald-200">
                  Add your current crop in My Farm to get more relevant market information.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate?.("profile")}
                className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 border-emerald-300 shrink-0"
              >
                Update Farm Profile
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 2 & 3: COMMODITY SELECTION & LOCATION FILTERS ── */}
      <section className="space-y-4">
        <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Filter className="h-4 w-4 text-emerald-600" />
              <span>Select Commodity &amp; Market Filters</span>
            </h3>

            {(selectedState !== "all" || selectedDistrict !== "all" || selectedMarket !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedState("all");
                  setSelectedDistrict("all");
                  setSelectedMarket("all");
                }}
                className="text-xs h-7 text-muted-foreground hover:text-foreground"
              >
                Reset Filters
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Commodity Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Select Commodity
              </label>
              <Select value={selectedCommodity} onValueChange={setSelectedCommodity}>
                <SelectTrigger className="h-10 text-xs bg-background">
                  <SelectValue placeholder="Choose Crop" />
                </SelectTrigger>
                <SelectContent>
                  {commoditiesList.map((comm) => (
                    <SelectItem key={comm} value={comm} className="text-xs">
                      {comm}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* State Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                State
              </label>
              <Select
                value={selectedState}
                onValueChange={(val) => {
                  setSelectedState(val);
                  setSelectedDistrict("all");
                  setSelectedMarket("all");
                }}
              >
                <SelectTrigger className="h-10 text-xs bg-background">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All States
                  </SelectItem>
                  {statesList.map((st) => (
                    <SelectItem key={st} value={st} className="text-xs">
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* District Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                District
              </label>
              <Select
                value={selectedDistrict}
                onValueChange={(val) => {
                  setSelectedDistrict(val);
                  setSelectedMarket("all");
                }}
                disabled={districtsList.length === 0}
              >
                <SelectTrigger className="h-10 text-xs bg-background">
                  <SelectValue placeholder="All Districts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Districts
                  </SelectItem>
                  {districtsList.map((d) => (
                    <SelectItem key={d} value={d} className="text-xs">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Market / Mandi Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Market / Mandi
              </label>
              <Select
                value={selectedMarket}
                onValueChange={setSelectedMarket}
                disabled={marketsList.length === 0}
              >
                <SelectTrigger className="h-10 text-xs bg-background">
                  <SelectValue placeholder="All Mandis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Mandis
                  </SelectItem>
                  {marketsList.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 10: Farmer Crop Relevance Tag */}
          <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40">
            <span className="flex items-center gap-1.5">
              {isViewingFarmerCrop ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Market information for your current crop: {selectedCommodity}
                  </span>
                </>
              ) : (
                <>
                  <Store className="h-3.5 w-3.5 text-blue-600" />
                  <span>Viewing market data for: <strong>{selectedCommodity}</strong></span>
                </>
              )}
            </span>

            <span>
              Showing {records.length} reported mandi {records.length === 1 ? "entry" : "entries"}
            </span>
          </div>
        </div>
      </section>

      {/* ── LIVE CONNECTION ERROR STATE (RULE #6 & #13) ── */}
      {!isDemoMode && apiError && (
        <div className="p-6 rounded-2xl bg-card border border-border/70 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-foreground">
            Live market data is currently unavailable.
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            {apiError}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button size="sm" variant="outline" onClick={loadMandiData} className="text-xs gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Try Again</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setIsDemoMode(true)}
              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Switch to Demo Reference Data
            </Button>
          </div>
        </div>
      )}

      {/* ── SECTION 4, 5, 6: LATEST AVAILABLE MARKET PRICE ── */}
      {isLoading ? (
        <div className="p-6 rounded-2xl bg-card border border-border/70 space-y-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ) : primaryRecord ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Scale className="h-4 w-4 text-emerald-600" />
              <span>Latest Available Market Price</span>
            </h2>

            <Badge
              variant="outline"
              className={`text-xs ${
                primaryRecord.isDemo
                  ? "text-amber-800 bg-amber-50 dark:bg-amber-950/40 border-amber-300"
                  : "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300"
              }`}
            >
              {primaryRecord.isDemo ? "Demo Market Data" : "Verified Live Price"}
            </Badge>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-card via-card to-emerald-500/5 border border-border/70 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-black text-foreground tracking-tight">
                    {primaryRecord.commodity}
                  </h3>
                  {primaryRecord.variety && (
                    <Badge variant="secondary" className="text-xs">
                      {primaryRecord.variety}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  <span>
                    {primaryRecord.market}, {primaryRecord.district} ({primaryRecord.state})
                  </span>
                </div>
              </div>

              {/* Price Callout */}
              <div className="md:text-right">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Reported Modal Price
                </span>
                <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  ₹{primaryRecord.modalPrice.toLocaleString("en-IN")}
                  <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1.5">
                    {primaryRecord.unit}
                  </span>
                </div>
              </div>
            </div>

            {/* Price Triplet: Min, Modal, Max */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">
                  Minimum Price
                </span>
                <div className="text-xl font-extrabold text-foreground mt-1">
                  ₹{primaryRecord.minPrice.toLocaleString("en-IN")}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Lowest transaction quote
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                  Modal Price (Most Frequent)
                </span>
                <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                  ₹{primaryRecord.modalPrice.toLocaleString("en-IN")}
                </div>
                <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
                  Dominant mandi traded rate
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">
                  Maximum Price
                </span>
                <div className="text-xl font-extrabold text-foreground mt-1">
                  ₹{primaryRecord.maxPrice.toLocaleString("en-IN")}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Highest grade quote
                </span>
              </div>
            </div>

            {/* Data Freshness & Source Provenance (Rule #5 & #6) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-border/40 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <span className="text-muted-foreground">
                  Market data recorded:{" "}
                  <strong className="text-foreground">{primaryRecord.displayDate}</strong>
                </span>
                {primaryRecord.arrivalQuantity && (
                  <span className="text-muted-foreground">
                    • Arrivals: <strong>{primaryRecord.arrivalQuantity}</strong>
                  </span>
                )}
              </div>

              <div className="text-muted-foreground">
                Source: <span className="font-semibold text-foreground">{primaryRecord.source}</span>
              </div>
            </div>
          </div>
        </section>
      ) : !isLoading && (
        /* Section 12: No Data State */
        <div className="p-8 rounded-2xl bg-card border border-border/70 text-center space-y-3">
          <Store className="h-8 w-8 text-muted-foreground mx-auto" />
          <h3 className="text-base font-bold text-foreground">
            No market data available for this commodity and location.
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            There are no recorded transactions matching your specific filter criteria.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedState("all");
                setSelectedDistrict("all");
                setSelectedMarket("all");
              }}
              className="text-xs"
            >
              Reset Location Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedCommodity("Wheat")}
              className="text-xs"
            >
              Try Wheat
            </Button>
          </div>
        </div>
      )}

      {/* ── SECTION 7 & 8: PRICE TREND & PRICE CHANGE ── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span>Price Trend</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Historical modal price curve based on recorded market bulletins.
            </p>
          </div>

          {trendData.priceChangePercent !== null && (
            <div className="flex items-center gap-2 self-start">
              <span className="text-xs text-muted-foreground">Price Change:</span>
              <Badge
                variant="outline"
                className={`text-xs font-bold gap-1 ${
                  trendData.priceChangePercent > 0
                    ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300"
                    : trendData.priceChangePercent < 0
                    ? "text-red-700 bg-red-50 dark:bg-red-950/40 border-red-300"
                    : "text-muted-foreground bg-muted border-border"
                }`}
              >
                {trendData.priceChangePercent > 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : trendData.priceChangePercent < 0 ? (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
                <span>
                  {trendData.priceChangePercent > 0 ? `+${trendData.priceChangePercent}%` : `${trendData.priceChangePercent}%`}
                </span>
              </Badge>
              {trendData.previousPeriod && (
                <span className="text-[11px] text-muted-foreground">
                  (vs {trendData.previousPeriod})
                </span>
              )}
            </div>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : trendData.trends.length >= 2 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/40">
                <span>
                  Observation Market: <strong>{trendData.trends[0].market}</strong> • {selectedCommodity}
                </span>
                <span className="font-mono text-[11px]">
                  {trendData.trends.length} recorded bulletins
                </span>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData.trends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                    <YAxis
                      domain={["auto", "auto"]}
                      unit="₹"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(val) => `₹${val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: "12px",
                      }}
                      formatter={(val: any) => [`₹${val} / quintal`, "Modal Price"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="modalPrice"
                      name="Modal Price (₹/quintal)"
                      stroke="#059669"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#priceGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-muted-foreground italic">
              Not enough historical market data to display a trend.
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 9: MARKET COMPARISON ── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" />
              <span>Market Comparison</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare reported modal and price brackets across major reporting mandis.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Sort by:</span>
            <div className="flex items-center p-0.5 bg-muted rounded-lg">
              <button
                onClick={() => setSortBy("highest")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                  sortBy === "highest" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                Highest Modal
              </button>
              <button
                onClick={() => setSortBy("lowest")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                  sortBy === "lowest" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                Lowest Modal
              </button>
              <button
                onClick={() => setSortBy("name")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                  sortBy === "name" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                }`}
              >
                Mandi Name
              </button>
            </div>
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedRecords.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col justify-between hover:border-emerald-500/40 transition-all space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      {item.market}
                    </h4>
                    <span className="text-xs text-muted-foreground block">
                      {item.district}, {item.state}
                    </span>
                  </div>
                  {item.variety && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {item.variety}
                    </Badge>
                  )}
                </div>

                <div className="mt-3 p-2.5 rounded-xl bg-muted/40 border border-border/40 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Reported Modal Price
                  </span>
                  <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                    ₹{item.modalPrice.toLocaleString("en-IN")}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">
                      / quintal
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div className="p-2 rounded-lg bg-background border border-border/50">
                    <span className="text-[10px] text-muted-foreground block">Min Price</span>
                    <span className="font-bold text-foreground">
                      ₹{item.minPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border/50">
                    <span className="text-[10px] text-muted-foreground block">Max Price</span>
                    <span className="font-bold text-foreground">
                      ₹{item.maxPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Date: {item.displayDate}</span>
                <span className="truncate max-w-[150px]">{item.source.split("(")[0]}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Agronomic Disclaimer */}
        <p className="text-[11px] text-muted-foreground leading-relaxed italic">
          *Note: The reported modal price reflects the most frequent wholesale price transacted on the reported date. Actual price received at the mandi gate depends on moisture percentage, foreign matter, crop grade, and daily arrival volumes.
        </p>
      </section>

      {/* ── SECTION 18: ABOUT MARKET DATA TRANSPARENCY ── */}
      <section className="space-y-3 pt-4 border-t border-border/60">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <span>About Market Data</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1.5">
            <span className="font-bold text-foreground block">
              Data Provenance &amp; APMC Bulletin Standards
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Market prices shown here are based on the latest available records from the connected market-data source (Agmarknet, Directorate of Marketing &amp; Inspection, Government of India). Prices can vary significantly by market location, trade date, moisture quality, and arrival volume.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1.5">
            <span className="font-bold text-foreground block">
              Decision Support vs Financial Guarantee
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Mandi price intelligence is provided for farmer decision support and harvest planning. It does not constitute a guaranteed price quote or an agricultural purchase contract.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default MandiPriceIntelligence;
