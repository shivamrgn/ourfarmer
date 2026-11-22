import React, { useState, useEffect, useMemo } from "react";
import {
  Landmark,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MapPin,
  Sprout,
  FileText,
  Phone,
  Calendar,
  Building2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Info,
  Clock,
  ChevronRight,
  Layers,
  HelpCircle,
  DollarSign,
  Scale,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  governmentSchemesService,
  GovernmentScheme,
} from "@/services/governmentSchemesService";
import { farmProfileService, CompleteFarmProfile } from "@/services/farmProfileService";
import { useAuth } from "@/context/AuthContext";

interface GovernmentSchemesProps {
  onNavigate?: (module: string) => void;
}

export function GovernmentSchemes({ onNavigate }: GovernmentSchemesProps) {
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

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedState, setSelectedState] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");

  // Data states
  const [schemes, setSchemes] = useState<GovernmentScheme[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [states, setStates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Detail Modal state
  const [activeScheme, setActiveScheme] = useState<GovernmentScheme | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Load initial data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [schemesData, catData, statesData] = await Promise.all([
        governmentSchemesService.getSchemes({
          category: selectedCategory,
          state: selectedState,
          level: selectedLevel,
          search: searchQuery,
        }),
        governmentSchemesService.getCategories(),
        governmentSchemesService.getStates(),
      ]);

      setSchemes(schemesData);
      setCategories(catData.categories);
      setStates(statesData.states);
    } catch {
      // Fallback already handled inside service
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedState, selectedLevel, searchQuery]);

  // Extract farmer profile parameters
  const farmLocation = [profile.farmer.district, profile.farmer.state]
    .filter(Boolean)
    .join(", ");
  const hasFarmLocation = Boolean(farmLocation && farmLocation.trim() !== "");
  const hasCurrentCrop = Boolean(profile.farm.currentCrops && profile.farm.currentCrops.trim() !== "");
  const hasFarmSize = Boolean(profile.farm.farmSize && profile.farm.farmSize > 0);

  // Personalized scheme matching based on farmer profile
  const personalizedResults = useMemo(() => {
    const landHectares =
      profile.farm.farmSizeUnit === "Hectares"
        ? profile.farm.farmSize
        : profile.farm.farmSizeUnit === "Acres"
        ? profile.farm.farmSize * 0.404686
        : profile.farm.farmSize * 0.161874; // Bighas to Ha approx

    return governmentSchemesService.getPersonalizedSchemes(
      profile.farmer.state,
      profile.farm.currentCrops,
      landHectares,
      profile.farm.irrigationType
    );
  }, [profile]);

  const handleOpenDetail = (scheme: GovernmentScheme) => {
    setActiveScheme(scheme);
    setIsDetailOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-6 border-b border-border/60">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-3">
            <Landmark className="h-3.5 w-3.5" />
            <span>Government Programs &amp; Farmer Welfare</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            GOVERNMENT SCHEMES &amp; FARMER BENEFITS
          </h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
            Discover government programs, subsidies, insurance, credit support, and other agricultural benefits that may be relevant to your farm.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start flex-wrap">
          <Badge variant="outline" className="text-xs font-semibold border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 py-1.5 px-3">
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
            <span>Official Government Sources</span>
          </Badge>
        </div>
      </div>

      {/* ── SECTION 1: FARMER CONTEXT ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <Sprout className="h-4 w-4 text-emerald-600" />
            <span>Your Farm Context</span>
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            Source: My Farm Profile
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Location */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Location (State &amp; District)
              </span>
              <div className="text-sm font-bold text-foreground mt-1 truncate">
                {hasFarmLocation ? farmLocation : "Not specified"}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 block">
                {hasFarmLocation ? "Filters state-specific schemes" : "Add location in My Farm"}
              </span>
            </div>

            {/* Current Crop */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Current Crop(s)
              </span>
              <div className="text-sm font-bold text-foreground mt-1 truncate">
                {hasCurrentCrop ? profile.farm.currentCrops : "Not specified"}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 block">
                {hasCurrentCrop ? "Matches crop insurance & MSP" : "Add crops in My Farm"}
              </span>
            </div>

            {/* Farm Size */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Farm Size &amp; Category
              </span>
              <div className="text-sm font-bold text-foreground mt-1">
                {hasFarmSize ? `${profile.farm.farmSize} ${profile.farm.farmSizeUnit}` : "—"} • {profile.farm.farmingMethod || "Conventional"}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Determines Small/Marginal Farmer priority
              </span>
            </div>

            {/* Irrigation */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Irrigation Type
              </span>
              <div className="text-sm font-bold text-foreground mt-1">
                {profile.farm.irrigationType || "Not specified"}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Matches micro-irrigation subsidies
              </span>
            </div>
          </div>

          {/* Missing profile banner */}
          {(!hasFarmLocation || !hasCurrentCrop || !hasFarmSize) && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    Complete your Farm Profile to discover more relevant programs.
                  </p>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    Adding your district, crops, and landholding allows Crops Wild to surface targeted state subsidies and credit schemes.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate?.("profile")}
                className="text-xs font-semibold border-amber-300 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 shrink-0"
              >
                Update Farm Profile
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 4: POTENTIALLY RELEVANT PROGRAMS ── */}
      {personalizedResults.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>Potentially Relevant to Your Farm</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Programs that match your saved state ({profile.farmer.state || "India"}), crop, or landholding.
              </p>
            </div>

            <Badge variant="outline" className="text-[11px] text-muted-foreground w-fit">
              *Matches profile attributes (Not a confirmed eligibility decision)
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {personalizedResults.slice(0, 3).map(({ scheme, relevanceTags }) => (
              <div
                key={scheme.id}
                className="p-5 rounded-2xl bg-gradient-to-br from-card via-card to-emerald-500/5 border border-emerald-500/30 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-500/60 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      {scheme.category}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                      {scheme.level} Government
                    </Badge>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-foreground leading-snug">
                      {scheme.short_name || scheme.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {scheme.description}
                    </p>
                  </div>

                  {/* Benefit Callout */}
                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40 text-xs">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Benefit
                    </span>
                    <span className="font-extrabold text-foreground mt-0.5 block text-[13px]">
                      {scheme.benefits.split(".")[0]}
                    </span>
                  </div>

                  {/* Matching Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {relevanceTags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-muted-foreground">
                    May be relevant
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenDetail(scheme)}
                    className="h-8 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 p-0 gap-1"
                  >
                    <span>View Scheme</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── SECTION 2 & 11: SEARCH & FILTERS ── */}
      <section className="space-y-4">
        <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search schemes by name, benefit, or keyword (e.g., PM-KISAN, subsidy, insurance, solar)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 text-xs bg-background"
              />
            </div>

            {(selectedCategory !== "all" || selectedState !== "all" || selectedLevel !== "all" || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedState("all");
                  setSelectedLevel("all");
                  setSearchQuery("");
                }}
                className="text-xs h-9 text-muted-foreground hover:text-foreground self-start sm:self-auto"
              >
                Reset All Filters
              </Button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Category Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Category
              </label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-10 text-xs bg-background">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* State Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                State Program
              </label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="h-10 text-xs bg-background">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  {states.map((st) => (
                    <SelectItem key={st} value={st === "All States" ? "all" : st} className="text-xs">
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Level Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Government Level
              </label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="h-10 text-xs bg-background">
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Levels (Central &amp; State)
                  </SelectItem>
                  <SelectItem value="Central" className="text-xs">
                    Central Government
                  </SelectItem>
                  <SelectItem value="State" className="text-xs">
                    State Government
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40">
            <span>
              Showing <strong>{schemes.length}</strong> official programs
            </span>
            <span className="text-[11px]">
              Click any card to read official eligibility &amp; application steps
            </span>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: SCHEME LIST ── */}
      <section className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="p-5 rounded-2xl bg-card border border-border/70 space-y-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : schemes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schemes.map((scheme) => (
              <div
                key={scheme.id}
                className="p-5 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-500/50 transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      {scheme.category}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        scheme.level === "Central"
                          ? "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/40"
                          : "border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/40"
                      }`}
                    >
                      {scheme.level} Government
                    </Badge>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {scheme.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {scheme.description}
                    </p>
                  </div>

                  {/* Benefits Snippet */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Benefit Highlights
                    </span>
                    <span className="font-bold text-foreground text-xs leading-snug block line-clamp-2">
                      {scheme.benefits}
                    </span>
                  </div>

                  {/* Applicability Meta */}
                  <div className="text-[11px] text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                      <span>{scheme.applicable_states.join(", ")}</span>
                    </div>
                    {scheme.ministry && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{scheme.ministry}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenDetail(scheme)}
                    className="text-xs font-semibold h-8 flex-1"
                  >
                    View Details
                  </Button>

                  <a
                    href={scheme.official_apply_url || scheme.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 text-xs font-semibold h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                  >
                    <span>Official Portal</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Section 14: No Data State */
          <div className="p-10 rounded-2xl bg-card border border-border/70 text-center space-y-3">
            <Landmark className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="text-base font-bold text-foreground">
              No matching schemes found for your current filters.
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Try choosing "All Categories", selecting "All States", or clearing the search query.
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedState("all");
                  setSelectedLevel("all");
                  setSearchQuery("");
                }}
                className="text-xs"
              >
                Reset All Filters
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ── SCHEME DETAIL VIEW MODAL (DIALOG) ── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-6">
          {activeScheme && (
            <>
              <DialogHeader className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-semibold">
                    {activeScheme.category}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {activeScheme.level} Government
                  </Badge>
                  {activeScheme.last_verified && (
                    <span className="text-[11px] text-muted-foreground font-mono ml-auto">
                      Verified: {activeScheme.last_verified}
                    </span>
                  )}
                </div>

                <DialogTitle className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {activeScheme.name}
                </DialogTitle>

                {activeScheme.ministry && (
                  <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{activeScheme.ministry}</span>
                  </DialogDescription>
                )}
              </DialogHeader>

              {/* Overview */}
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                  Program Overview
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  {activeScheme.description}
                </p>
              </div>

              {/* Who it is for */}
              {activeScheme.who_is_it_for && (
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 text-xs space-y-1">
                  <span className="font-bold text-foreground uppercase tracking-wider text-[11px] block">
                    Who It Is For
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    {activeScheme.who_is_it_for}
                  </p>
                </div>
              )}

              {/* Benefits */}
              <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-xs space-y-1.5">
                <span className="font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                  What the Scheme Provides (Benefits)
                </span>
                <p className="text-emerald-950 dark:text-emerald-100 font-medium leading-relaxed">
                  {activeScheme.benefits}
                </p>
                {activeScheme.subsidy_percentage && (
                  <span className="inline-block mt-1 font-bold text-emerald-800 dark:text-emerald-300 text-[11px]">
                    Subsidy Scale: {activeScheme.subsidy_percentage}
                  </span>
                )}
              </div>

              {/* Eligibility Criteria */}
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5 text-blue-600" />
                  Official Eligibility Criteria
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  {activeScheme.eligibility_criteria}
                </p>
                <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Note: Eligibility cannot be automatically confirmed from your current profile. Please verify official criteria before applying.
                  </span>
                </div>
              </div>

              {/* Required Documents */}
              {activeScheme.required_documents.length > 0 && (
                <div className="space-y-2 text-xs">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-purple-600" />
                    Documents Usually Required
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                    {activeScheme.required_documents.map((doc, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/40">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{doc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* How to Apply */}
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-600" />
                  How to Apply
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  {activeScheme.application_process}
                </p>
              </div>

              {/* Helpline Contact */}
              {activeScheme.contact_info && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-emerald-600" />
                    <span>
                      Helpline: <strong>{activeScheme.contact_info.phone || "1800-180-1551 (Kisan Call Center)"}</strong>
                    </span>
                  </div>
                  {activeScheme.contact_info.email && (
                    <span className="text-muted-foreground truncate max-w-[200px]">
                      {activeScheme.contact_info.email}
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons with Verified Government Links */}
              <div className="pt-4 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <a
                  href={activeScheme.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto text-xs font-semibold inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg border border-border hover:bg-muted text-foreground transition-colors"
                >
                  <span>View Official Portal</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                <a
                  href={activeScheme.official_apply_url || activeScheme.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto text-xs font-semibold inline-flex items-center justify-center gap-1.5 py-2 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                >
                  <span>Apply on Official Portal</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── SECTION 16: FARMER SAFETY & TRUST DISCLAIMER ── */}
      <section className="space-y-3 pt-4 border-t border-border/60">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Important Notice &amp; Official Disclaimers</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1.5">
            <span className="font-bold text-foreground block">
              Program Guidelines Can Change
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Government schemes, subsidy rates, and eligibility criteria are subject to periodic state and central notifications. Always verify the latest guidelines and notification deadlines on the official government website before applying.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border/60 space-y-1.5">
            <span className="font-bold text-foreground block">
              Independent Decision Support Platform
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Crops Wild is an independent agricultural intelligence and advisory platform, not an official government portal. Crops Wild does not collect government fees, process official applications, or disburse public funds.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default GovernmentSchemes;