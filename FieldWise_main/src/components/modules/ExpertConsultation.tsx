import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { farmProfileService, CompleteFarmProfile } from "@/services/farmProfileService";
import expertSupportService, {
  VerifiedSupportOrg,
  SupportType,
  SupportCategory,
  PreparedInquiry
} from "@/services/expertSupportService";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// Lucide Icons
import {
  PhoneCall,
  ExternalLink,
  MapPin,
  Clock,
  ShieldCheck,
  Building2,
  FileQuestion,
  HelpCircle,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  RotateCcw,
  Sprout,
  Stethoscope,
  Info,
  Calendar,
  Send,
  Layers,
  ChevronRight,
  BookOpen,
  ArrowRight
} from "lucide-react";

interface ExpertConsultationProps {
  onNavigate?: (module: string) => void;
}

export function ExpertConsultation({ onNavigate }: ExpertConsultationProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // ── Farmer Profile State ──
  const [profile, setProfile] = useState<CompleteFarmProfile>(() =>
    farmProfileService.getFarmProfile(user)
  );

  useEffect(() => {
    setProfile(farmProfileService.getFarmProfile(user));
    const unsubscribe = farmProfileService.onProfileChange((updated) => {
      setProfile(updated);
    });
    return unsubscribe;
  }, [user]);

  // ── Support Directory State ──
  const [organizations, setOrganizations] = useState<VerifiedSupportOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<string>("directory");
  const [selectedType, setSelectedType] = useState<SupportType>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>(
    profile?.farmer?.state && profile.farmer.state.trim() !== ""
      ? profile.farmer.state
      : "All States"
  );

  // ── Question / Inquiry Form State ──
  const [inquiryCategory, setInquiryCategory] = useState<string>("Plant Disease");
  const [inquiryCrop, setInquiryCrop] = useState<string>(profile?.farm?.currentCrops || "Wheat");
  const [inquiryDescription, setInquiryDescription] = useState<string>("");
  const [inquiryImage, setInquiryImage] = useState<string | null>(null);
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);
  const [preparedResult, setPreparedResult] = useState<{
    inquiryId: string;
    formattedSummary: string;
  } | null>(null);
  const [inquiryHistory, setInquiryHistory] = useState<PreparedInquiry[]>([]);

  // Disease Detection Context Banner
  const [diseaseContext, setDiseaseContext] = useState<{
    crop: string;
    diseaseName: string;
    confidence: number;
    symptoms?: string[];
  } | null>(null);

  // Load pending disease context if arrived from Disease Detection
  useEffect(() => {
    const pending = expertSupportService.consumePendingDiseaseContext();
    if (pending) {
      setDiseaseContext(pending);
      setActiveTab("inquiry");
      setInquiryCategory("Plant Disease");
      if (pending.crop) setInquiryCrop(pending.crop);
      setInquiryDescription(
        `AI-assisted leaf scan indicated possible signs of ${pending.diseaseName} (${pending.confidence}% confidence). Symptoms observed: ${
          pending.symptoms?.join(", ") || "leaf discoloration"
        }. Requesting human agronomic review from KVK / agronomist on verified field management.`
      );
    }
  }, []);

  // Update crop/state when profile loads
  useEffect(() => {
    if (profile?.farmer?.state) {
      setSelectedState(profile.farmer.state);
    }
    if (profile?.farm?.currentCrops && !diseaseContext) {
      setInquiryCrop(profile.farm.currentCrops);
    }
  }, [profile, diseaseContext]);

  // Load Inquiry History
  useEffect(() => {
    setInquiryHistory(expertSupportService.getInquiryHistory());
  }, []);

  // ── Fetch Support Organizations ──
  const fetchOrganizations = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await expertSupportService.getSupportOrganizations({
        category: selectedCategory,
        state: selectedState,
        district: profile?.farmer?.district,
        type: selectedType,
        search: searchQuery,
      });
      setOrganizations(data);
    } catch {
      setLoadError("Unable to load agricultural support information right now.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [selectedCategory, selectedType, selectedState, searchQuery, profile?.farmer?.district]);

  // Navigation helper
  const handleNavigateToProfile = () => {
    if (onNavigate) {
      onNavigate("profile");
    } else {
      navigate("/profile");
    }
  };

  // Inquiry Submission Handler
  const handlePrepareInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryDescription.trim()) {
      toast({
        title: "Problem description required",
        description: "Please provide a brief description of the issue on your farm.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingInquiry(true);
    try {
      const res = await expertSupportService.prepareInquiry({
        farmer_name: profile?.farmer?.fullName || user?.name || "Farmer",
        phone: profile?.farmer?.phone || "",
        state: profile?.farmer?.state || "",
        district: profile?.farmer?.district || "",
        crop: inquiryCrop,
        category: inquiryCategory,
        problem_description: inquiryDescription,
        image_url: inquiryImage || undefined,
      });

      setPreparedResult({
        inquiryId: res.inquiryId,
        formattedSummary: res.formattedSummary,
      });

      setInquiryHistory(expertSupportService.getInquiryHistory());

      toast({
        title: "Inquiry Prepared & Saved",
        description: "Your question has been structured and recorded to your Farm Records.",
      });
    } catch {
      toast({
        title: "Preparation Failed",
        description: "Could not save your inquiry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingInquiry(false);
    }
  };

  const handleCopySummary = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "You can now paste this inquiry into WhatsApp, an email to your local KVK, or read it to 1551.",
    });
  };

  const categories = expertSupportService.getCategories();

  const isLocationMissing =
    !profile?.farmer?.state ||
    profile.farmer.state.trim() === "" ||
    !profile?.farmer?.district ||
    profile.farmer.district.trim() === "";

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 w-full min-w-0 overflow-x-hidden">
      {/* ── HEADER ── */}
      <div className="border-b border-gray-200 dark:border-gray-800 pb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Indian Agricultural Institutions
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-1">
              Expert Agricultural Support
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-3xl">
              Find trusted agricultural support and connect with verified agricultural resources when you need help beyond AI insights.
            </p>
          </div>

          {/* Quick Helpline Badge */}
          <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 shadow-xs w-full sm:w-auto min-w-0">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <PhoneCall className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Kisan Call Center (Toll-Free)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="tel:1551"
                  className="text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-emerald-600 hover:underline"
                >
                  1551
                </a>
                <span className="text-xs text-gray-500 dark:text-gray-400">or 1800-180-1551</span>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                6:00 AM – 10:00 PM (22 Indian Languages)
              </div>
            </div>
          </div>
        </div>

        {/* AI Limit & Human Verification Callout */}
        <div className="mt-4 p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p>
            <strong>Agronomic Advisory Notice:</strong> While Crops Wild AI provides rapid insights on crops, diseases, and weather, complex crop infections, soil reclamation, and statutory scheme claims require direct consultation with official Krishi Vigyan Kendra (KVK) scientists, state extension officers, or the Kisan Call Center.
          </p>
        </div>
      </div>

      {/* ── 1. FARM CONTEXT ── */}
      <Card className="border border-gray-200 dark:border-gray-800 shadow-xs bg-linear-to-r from-gray-50 to-white dark:from-gray-900/60 dark:to-gray-900 w-full min-w-0">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Your Farm Profile Context
                </div>
                {isLocationMissing ? (
                  <div className="text-sm font-medium text-amber-700 dark:text-amber-400 mt-0.5">
                    Add your farm location to discover nearby Krishi Vigyan Kendras (KVKs) and district agricultural support.
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-800 dark:text-gray-200 mt-0.5 font-medium break-words">
                    <span>
                      <strong>Location:</strong> {profile.farmer.district}, {profile.farmer.state}
                    </span>
                    {profile.farm.currentCrops && (
                      <span>
                        <strong>Current Crop:</strong> {profile.farm.currentCrops}
                      </span>
                    )}
                    {profile.farm.farmSize > 0 && (
                      <span>
                        <strong>Farm Size:</strong> {profile.farm.farmSize} {profile.farm.farmSizeUnit}
                      </span>
                    )}
                    {profile.farm.farmingMethod && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-md text-gray-600 dark:text-gray-400">
                        {profile.farm.farmingMethod}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNavigateToProfile}
              className="text-xs font-medium shrink-0 self-start sm:self-center"
            >
              Update Farm Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── DISEASE DETECTION TRANSITION BANNER (if active) ── */}
      {diseaseContext && (
        <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 w-full min-w-0">
          <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="font-semibold text-sm">
            Transition from Disease Detection
          </AlertTitle>
          <AlertDescription className="text-xs mt-1">
            You were analyzing a potential issue on <strong>{diseaseContext.crop}</strong> ({diseaseContext.diseaseName},{" "}
            {diseaseContext.confidence}% AI confidence score). Below you can prepare a formal question to present to a KVK scientist or contact your local agricultural extension center.
          </AlertDescription>
        </Alert>
      )}

      {/* ── NAVIGATION TABS ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full min-w-0">
        <div className="w-full border-b border-gray-200 dark:border-gray-800 overflow-x-auto no-scrollbar scroll-smooth">
          <TabsList className="bg-transparent p-0 gap-1 sm:gap-2 border-none inline-flex min-w-full sm:min-w-0 justify-start">
            <TabsTrigger
              value="directory"
              className="data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 rounded-none px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0"
            >
              <Building2 className="w-4 h-4 mr-1.5 sm:mr-2 shrink-0" />
              <span>Verified Directory</span>
              <span className="hidden sm:inline">&nbsp;of Institutions</span>
            </TabsTrigger>
            <TabsTrigger
              value="inquiry"
              className="data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 rounded-none px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0"
            >
              <FileQuestion className="w-4 h-4 mr-1.5 sm:mr-2 shrink-0" />
              <span>Describe Farm Problem</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 rounded-none px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0"
            >
              <Clock className="w-4 h-4 mr-1.5 sm:mr-2 shrink-0" />
              <span>Inquiry Records</span>
              <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold">
                {inquiryHistory.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── TAB 1: DIRECTORY OF VERIFIED INSTITUTIONS ── */}
        <TabsContent value="directory" className="space-y-6 m-0">
          {/* Support Type Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full min-w-0">
            {[
              { id: "all", label: "All Support", icon: Layers, desc: "All official channels" },
              { id: "nearby", label: "Nearby KVKs & SAUs", icon: MapPin, desc: "District science centres" },
              { id: "online", label: "Online & Helplines", icon: PhoneCall, desc: "Toll-free 1551 & digital" },
              { id: "government", label: "State Departments", icon: Building2, desc: "State agriculture ministries" },
              { id: "knowledge", label: "Agri Knowledge", icon: BookOpen, desc: "ICAR & Vikaspedia portals" },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = selectedType === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedType(item.id as SupportType)}
                  className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all min-w-0 ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/50 shadow-xs"
                      : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-emerald-600" : "text-gray-500"}`} />
                    <span className={`text-xs font-semibold truncate ${isSelected ? "text-emerald-800 dark:text-emerald-300" : "text-gray-700 dark:text-gray-300"}`}>
                      {item.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-1 truncate">
                    {item.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Filters Bar: Search & Category */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-gray-50/80 dark:bg-gray-900/60 p-3 rounded-xl border border-gray-200 dark:border-gray-800 w-full min-w-0">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by center name, district, or service (e.g., KVK, soil test)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs bg-white dark:bg-gray-950 h-9 w-full min-w-0"
              />
            </div>

            {/* Category Dropdown */}
            <div className="w-full sm:w-60">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="text-xs bg-white dark:bg-gray-950 h-9">
                  <SelectValue placeholder="Filter by Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-xs">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* State Filter */}
            <div className="w-full sm:w-44">
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="text-xs bg-white dark:bg-gray-950 h-9">
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "All States",
                    "Punjab",
                    "Gujarat",
                    "Maharashtra",
                    "Madhya Pradesh",
                    "Haryana",
                    "Uttar Pradesh",
                    "Rajasthan",
                    "Karnataka",
                    "Tamil Nadu",
                    "All India"
                  ].map((st) => (
                    <SelectItem key={st} value={st} className="text-xs">
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(selectedCategory !== "All Categories" || selectedType !== "all" || searchQuery !== "") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCategory("All Categories");
                  setSelectedType("all");
                  setSearchQuery("");
                }}
                className="text-xs text-gray-500 hover:text-gray-700 h-9 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset
              </Button>
            )}
          </div>

          {/* Results Summary Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-gray-500 dark:text-gray-400 px-1">
            <span>
              Showing <strong>{organizations.length}</strong> verified official agricultural support entities
              {selectedState !== "All States" && ` in ${selectedState}`}
            </span>
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              100% Official Indian Government & ICAR Data
            </span>
          </div>

          {/* Organization Cards List */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <Card key={n} className="border border-gray-200 dark:border-gray-800 p-5">
                  <Skeleton className="h-5 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-16 w-full mb-3" />
                  <Skeleton className="h-8 w-1/3" />
                </Card>
              ))}
            </div>
          ) : loadError ? (
            <Card className="border border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20 p-8 text-center">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {loadError}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-md mx-auto">
                Could not connect to the agricultural support directory. You can still reach the national Kisan Call Center directly at 1551.
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button size="sm" onClick={fetchOrganizations}>
                  Try Again
                </Button>
                <a href="tel:1551">
                  <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-600">
                    Call 1551 Helpline
                  </Button>
                </a>
              </div>
            </Card>
          ) : organizations.length === 0 ? (
            <Card className="border border-gray-200 dark:border-gray-800 p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                No verified agricultural support found for this query
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-md mx-auto">
                No verified agricultural support found for your specific filter in {selectedState}. You can connect with national online advisory services or explore all states.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedState("All States");
                    setSelectedCategory("All Categories");
                    setSelectedType("all");
                    setSearchQuery("");
                  }}
                  className="text-xs"
                >
                  View All National Support
                </Button>
                <a href="tel:1551">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                    <PhoneCall className="w-3.5 h-3.5 mr-1.5" />
                    Call Kisan Call Center (1551)
                  </Button>
                </a>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {organizations.map((org) => {
                const isNearby = org.type === "nearby";
                const isDistrictMatch =
                  profile?.farmer?.district &&
                  org.district.toLowerCase().includes(profile.farmer.district.toLowerCase());

                return (
                  <Card
                    key={org.id}
                    className={`border transition-all duration-200 flex flex-col justify-between ${
                      isDistrictMatch
                        ? "border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-xs"
                        : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700"
                    }`}
                  >
                    <CardHeader className="p-4 sm:p-5 pb-3">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold py-0.5 ${
                            org.verification_level === "Official Government Source"
                              ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800"
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3 mr-1 inline" />
                          {org.verification_level}
                        </Badge>

                        {isDistrictMatch && (
                          <Badge className="bg-emerald-600 text-white text-[10px] py-0 px-2 font-medium">
                            Matches Your District ({profile.farmer.district})
                          </Badge>
                        )}

                        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400">
                          {org.type === "nearby"
                            ? "Physical Center"
                            : org.type === "online"
                            ? "Online / Helpline"
                            : org.type === "government"
                            ? "State Department"
                            : "Knowledge Base"}
                        </span>
                      </div>

                      {/* Name & Host Organization */}
                      <CardTitle className="text-base font-bold text-gray-900 dark:text-gray-100 leading-snug">
                        {org.name}
                      </CardTitle>
                      <CardDescription className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                        {org.organization}
                      </CardDescription>

                      {/* Description */}
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 line-clamp-3">
                        {org.description}
                      </p>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
                      {/* Address / Coverage */}
                      <div className="text-xs space-y-1 bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                        {org.address ? (
                          <div className="flex items-start gap-1.5 text-gray-700 dark:text-gray-300">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{org.address}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span>{org.coverage || `${org.district}, ${org.state}`}</span>
                          </div>
                        )}

                        {org.timings && (
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span>{org.timings}</span>
                          </div>
                        )}

                        {org.phone && (
                          <div className="flex items-center gap-1.5 text-gray-900 dark:text-gray-100 font-semibold">
                            <PhoneCall className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{org.phone}</span>
                            {org.is_toll_free && (
                              <span className="text-[10px] font-normal text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-1.5 rounded">
                                Toll-Free
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Services Bullet Points */}
                      {org.services && org.services.length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                            Verified Services:
                          </div>
                          <ul className="text-[11px] text-gray-600 dark:text-gray-300 space-y-0.5">
                            {org.services.slice(0, 3).map((srv, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-emerald-600 font-bold shrink-0">•</span>
                                <span className="line-clamp-1">{srv}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-gray-100 dark:border-gray-800">
                        {org.phone && (
                          <a
                            href={`tel:${org.phone.replace(/[^0-9+]/g, "")}`}
                            className="inline-flex items-center justify-center text-xs font-semibold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors gap-1.5"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            Call Support
                          </a>
                        )}

                        <a
                          href={org.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center text-xs font-medium px-3 py-1.5 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-gray-700 dark:text-gray-300 transition-colors gap-1 ml-auto"
                        >
                          <span>{org.official_portal_label || "Official Website"}</span>
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── TAB 2: PREPARE YOUR QUESTION ── */}
        <TabsContent value="inquiry" className="space-y-6 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Inquiry Form */}
            <div className="lg:col-span-2">
              <Card className="border border-gray-200 dark:border-gray-800 shadow-xs">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                    <FileQuestion className="w-4 h-4" />
                    Structured Problem Preparation
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Describe Your Farm Problem
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-600 dark:text-gray-400">
                    Prepare a structured question with your crop, location, and symptoms. You can then present this summary directly to a KVK scientist or read it over the phone to a Kisan Call Center officer at 1551.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 pt-3">
                  <form onSubmit={handlePrepareInquiry} className="space-y-4">
                    {/* Category Selection */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                        Problem Category *
                      </label>
                      <Select value={inquiryCategory} onValueChange={setInquiryCategory}>
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue placeholder="Select problem category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories
                            .filter((c) => c !== "All Categories")
                            .map((cat) => (
                              <SelectItem key={cat} value={cat} className="text-xs">
                                {cat}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Crop and Location Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                          Current Crop
                        </label>
                        <Input
                          value={inquiryCrop}
                          onChange={(e) => setInquiryCrop(e.target.value)}
                          placeholder="e.g. Wheat, Cotton, Rice, Soybean"
                          className="text-xs h-9"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                          Farm Location
                        </label>
                        <Input
                          value={
                            profile?.farmer?.district
                              ? `${profile.farmer.district}, ${profile.farmer.state}`
                              : "India"
                          }
                          disabled
                          className="text-xs h-9 bg-gray-50 dark:bg-gray-800 text-gray-500"
                        />
                      </div>
                    </div>

                    {/* Detailed Problem Description */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                        Describe What You Are Observing on the Farm *
                      </label>
                      <Textarea
                        rows={5}
                        value={inquiryDescription}
                        onChange={(e) => setInquiryDescription(e.target.value)}
                        placeholder="Detail the issue: When did it start? Which part of the plant is affected (leaves, roots, stem)? What fertilizers or sprays were applied? Any recent weather changes (excessive rain, drought)?"
                        className="text-xs"
                      />
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        Specific details help KVK agronomists provide exact chemical dosages or cultural management solutions.
                      </div>
                    </div>

                    {/* Disclaimer on Question Handling */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-100 dark:border-gray-800 text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
                      <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-emerald-600" />
                        Agricultural Record Guarantee
                      </div>
                      <p>
                        Crops Wild records and formats your inquiry in a standard agricultural report. We do not generate synthetic consultant responses. You will be provided with official helplines and nearby KVK centers to present this question.
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-3">
                      <Button
                        type="submit"
                        disabled={isSubmittingInquiry}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-5 h-9"
                      >
                        {isSubmittingInquiry ? (
                          "Preparing..."
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5 mr-1.5" />
                            Prepare & Save Question
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Prepared Result Card (after submitting) */}
              {preparedResult && (
                <Card className="mt-6 border-2 border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md">
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <CardTitle className="text-base font-bold text-gray-900 dark:text-gray-100">
                          Question Formatted & Logged ({preparedResult.inquiryId})
                        </CardTitle>
                      </div>
                      <Badge className="bg-emerald-600 text-white text-[10px]">
                        Saved in Records
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-gray-600 dark:text-gray-400">
                      Use the formatted summary below when calling the Kisan Call Center or visiting your district KVK scientist.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 pt-1 space-y-3">
                    <pre className="bg-gray-900 text-gray-100 p-3.5 rounded-lg text-xs font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
                      {preparedResult.formattedSummary}
                    </pre>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopySummary(preparedResult.formattedSummary)}
                        className="text-xs font-semibold"
                      >
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Copy Formatted Summary
                      </Button>

                      <a href="tel:1551">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
                          <PhoneCall className="w-3.5 h-3.5 mr-1.5" />
                          Call Kisan Call Center (1551)
                        </Button>
                      </a>

                      <a
                        href="https://kisansarathi.in"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center hover:underline"
                      >
                        Submit to ICAR Kisan Sarathi
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right: How to Seek Official Human Support */}
            <div className="space-y-4">
              <Card className="border border-gray-200 dark:border-gray-800 p-5 bg-linear-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
                <CardTitle className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Official Resolution Paths
                </CardTitle>
                <div className="space-y-3.5 text-xs">
                  <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                    <div className="font-bold text-gray-900 dark:text-gray-100">
                      1. Kisan Call Center (KCC)
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-[11px] mt-0.5">
                      Dial <strong>1551</strong> (free from any mobile). You will be connected to an agriculture graduate speaking your regional language.
                    </p>
                    <a
                      href="tel:1551"
                      className="mt-2 inline-flex items-center text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
                    >
                      Call Toll-Free 1551 <ChevronRight className="w-3 h-3 ml-0.5" />
                    </a>
                  </div>

                  <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                    <div className="font-bold text-gray-900 dark:text-gray-100">
                      2. Visit District KVK
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-[11px] mt-0.5">
                      Every district in India has an assigned Krishi Vigyan Kendra. Bring an affected plant sample in a sealed plastic bag for clinical inspection.
                    </p>
                    <button
                      onClick={() => setActiveTab("directory")}
                      className="mt-2 inline-flex items-center text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
                    >
                      View Assigned KVK <ChevronRight className="w-3 h-3 ml-0.5" />
                    </button>
                  </div>

                  <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                    <div className="font-bold text-gray-900 dark:text-gray-100">
                      3. Digital Submission (Kisan Sarathi)
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-[11px] mt-0.5">
                      Upload high-resolution images of your affected crops to ICAR scientists via the official Kisan Sarathi portal.
                    </p>
                    <a
                      href="https://kisansarathi.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
                    >
                      Open kisansarathi.in <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                </div>
              </Card>

              {/* Sample Collection Tip */}
              <Card className="border border-emerald-200 dark:border-emerald-800/60 p-4 bg-emerald-50/30 dark:bg-emerald-950/20 text-xs">
                <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mb-1">
                  <Sprout className="w-4 h-4" />
                  Field Sampling Best Practice
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-[11px] leading-relaxed">
                  When taking leaf or plant samples to a KVK diagnostic laboratory, collect samples showing the boundary between healthy and diseased tissue rather than dead leaves.
                </p>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 3: INQUIRY RECORDS HISTORY ── */}
        <TabsContent value="history" className="space-y-4 m-0">
          <Card className="border border-gray-200 dark:border-gray-800 shadow-xs">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Prepared Farm Inquiries
              </CardTitle>
              <CardDescription className="text-xs text-gray-600 dark:text-gray-400">
                Log of your structured problem summaries prepared for consultation with official agricultural authorities.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {inquiryHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                  <FileQuestion className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  No inquiries prepared yet. Click "Describe Farm Problem" to create your first inquiry summary.
                </div>
              ) : (
                <div className="space-y-3">
                  {inquiryHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col sm:flex-row justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            #{item.id}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {item.category}
                          </Badge>
                          {item.crop && (
                            <Badge variant="secondary" className="text-[10px]">
                              {item.crop}
                            </Badge>
                          )}
                          <span className="text-[10px] text-gray-400">
                            {new Date(item.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 mt-1">
                          {item.problem_description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                        {item.formatted_summary && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopySummary(item.formatted_summary!)}
                            className="text-xs h-8"
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy Text
                          </Button>
                        )}
                        <a href="tel:1551">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                          >
                            <PhoneCall className="w-3 h-3 mr-1" />
                            Call 1551
                          </Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── 16. DATA SOURCE TRANSPARENCY & DISCLAIMER ── */}
      <Card className="border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 text-xs text-gray-600 dark:text-gray-400">
        <CardContent className="p-4 sm:p-5">
          <div className="font-semibold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-emerald-600" />
            About Agricultural Support & Transparency
          </div>
          <p className="leading-relaxed">
            Crops Wild helps Indian farmers discover verified agricultural support resources, official Krishi Vigyan Kendras (KVKs), and government helplines. Center availability, services, and official contact numbers may change over time, so please verify details through the respective official portal before visiting. Crops Wild is an independent agricultural intelligence platform and not an official government organization or government portal.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default ExpertConsultation;
