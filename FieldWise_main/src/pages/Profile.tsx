import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useWeather } from "@/components/dashboard/WeatherContext";
import { useNavigate } from "react-router-dom";
import {
  farmProfileService,
  CompleteFarmProfile,
  defaultFarmProfile,
} from "@/services/farmProfileService";
import { notificationService } from "@/services/notificationService";
import {
  User,
  UserCheck,
  Layers,
  CloudSun,
  FlaskConical,
  CheckCircle2,
  Sparkles,
  Save,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Sprout,
  ScanEye,
  Droplets,
  Thermometer,
  Activity,
  Check,
  ChevronRight,
  Info,
  ShieldCheck,
  Sun,
  Compass,
  Tractor,
  RotateCcw,
  Loader2,
} from "lucide-react";

interface ProfilePageProps {
  onNavigate?: (module: string) => void;
}

const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana",
  "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const SOIL_TYPES = [
  "Loamy", "Alluvial", "Black", "Red", "Laterite", "Clay", "Sandy Loam", "Clay Loam"
];

const FARMING_METHODS: Array<CompleteFarmProfile['farm']['farmingMethod']> = [
  "Conventional", "Organic", "Natural / ZBNF", "Mixed"
];

const IRRIGATION_TYPES: Array<CompleteFarmProfile['farm']['irrigationType']> = [
  "Drip", "Sprinkler", "Canal", "Borewell / Tube-well", "Rainfed"
];

const TOPOGRAPHY_TYPES: Array<CompleteFarmProfile['conditions']['topography']> = [
  "Plains / Flatlands", "Gentle Slopes", "Terraced / Hilly", "Plateau"
];

const FieldBadge = ({ type }: { type: 'required' | 'recommended' | 'optional' }) => {
  if (type === 'required') {
    return (
      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800 px-1.5 py-0.5 rounded-sm ml-1.5">
        Required
      </span>
    );
  }
  if (type === 'recommended') {
    return (
      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 px-1.5 py-0.5 rounded-sm ml-1.5">
        Recommended
      </span>
    );
  }
  return (
    <span className="text-[10px] font-normal text-gray-500 bg-gray-50 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded-sm ml-1.5">
      Optional
    </span>
  );
};

export const ProfilePage = ({ onNavigate }: ProfilePageProps) => {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { weatherData, locationName } = useWeather();

  const [profile, setProfile] = useState<CompleteFarmProfile>(() => {
    return farmProfileService.getFarmProfile(user);
  });

  const [activeTab, setActiveTab] = useState<string>("farmer-info");
  const [isSaved, setIsSaved] = useState<boolean>(() => farmProfileService.isProfileSaved());
  const [showPathway, setShowPathway] = useState<boolean>(() => farmProfileService.isProfileSaved());
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const handleDetectLiveLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation Unsupported",
        description: "Your browser does not support GPS location detection.",
        variant: "destructive",
      });
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          let detectedDistrict = "";
          let detectedState = "";
          let detectedVillage = "";

          // 1. Try BigDataCloud reverse geocode API (client-side, CORS enabled)
          try {
            const res = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            if (res.ok) {
              const data = await res.json();
              detectedDistrict = data.city || data.locality || (data.localityInfo?.administrative?.[2]?.name) || "";
              detectedState = data.principalSubdivision || "";
              detectedVillage = data.localityInfo?.administrative?.[3]?.name || "";
            }
          } catch (e) {
            console.warn("BigDataCloud reverse geocode failed:", e);
          }

          // 2. Nominatim fallback if needed
          if (!detectedDistrict && !detectedState) {
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
              );
              if (res.ok) {
                const data = await res.json();
                const addr = data.address || {};
                detectedDistrict = addr.city || addr.town || addr.county || addr.district || "";
                detectedState = addr.state || "";
                detectedVillage = addr.village || addr.suburb || "";
              }
            } catch (e) {
              console.warn("Nominatim reverse geocode failed:", e);
            }
          }

          if (!detectedDistrict && !detectedState) {
            detectedDistrict = `Lat: ${latitude.toFixed(3)}`;
            detectedState = `Lon: ${longitude.toFixed(3)}`;
          }

          // Match state with INDIAN_STATES if possible
          const matched = INDIAN_STATES.find(
            (s) => s.toLowerCase() === detectedState.trim().toLowerCase()
          );
          const finalState = matched || detectedState.trim() || profile.farmer.state;
          const finalDistrict = detectedDistrict.trim() || profile.farmer.district;
          const finalVillage = detectedVillage.trim() || profile.farmer.village;

          // Update local profile
          const updatedProfile: CompleteFarmProfile = {
            ...profile,
            farmer: {
              ...profile.farmer,
              district: finalDistrict,
              state: finalState,
              village: finalVillage,
            },
          };
          setProfile(updatedProfile);

          // Save to farmProfileService (preserves current saved state)
          farmProfileService.saveFarmProfile(updatedProfile, isSaved, user?.id);

          // Sync core fields to auth user
          await updateUser({
            location: `${finalDistrict}, ${finalState}`,
          });

          toast({
            title: "Live Location Detected! 📍",
            description: `Updated address to ${finalDistrict}, ${finalState}.`,
          });
        } catch (err: any) {
          toast({
            title: "Location Detection Failed",
            description: err?.message || "Could not resolve your live location address.",
            variant: "destructive",
          });
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (err) => {
        setIsDetectingLocation(false);
        let msg = "Could not access location. Please check browser permissions.";
        if (err.code === 1) msg = "Location access was denied. Please allow location permissions in your browser.";
        toast({
          title: "Location Access Denied",
          description: msg,
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Sync profile when user changes or when loadAndRestoreProfile finishes
  useEffect(() => {
    const loaded = farmProfileService.getFarmProfile(user, user?.id);
    setProfile(loaded);
    const saved = farmProfileService.isProfileSaved(user?.id);
    setIsSaved(saved);
    setShowPathway(saved);

    const unsubscribe = farmProfileService.onProfileChange((updated) => {
      setProfile(updated);
      setIsSaved(true);
      setShowPathway(true);
    });
    return unsubscribe;
  }, [user]);

  const completionPercentage = farmProfileService.calculateProfileCompletion(profile);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    // Validation checks for required and numeric fields
    if (!profile.farmer.fullName || !profile.farmer.fullName.trim()) {
      toast({
        title: "Validation Error",
        description: "Farmer Full Name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!profile.farmer.phone || !profile.farmer.phone.trim()) {
      toast({
        title: "Validation Error",
        description: "Mobile contact number is required.",
        variant: "destructive",
      });
      return;
    }

    if (!profile.farmer.state || !profile.farmer.state.trim()) {
      toast({
        title: "Validation Error",
        description: "State / Province is required.",
        variant: "destructive",
      });
      return;
    }

    if (!profile.farmer.district || !profile.farmer.district.trim()) {
      toast({
        title: "Validation Error",
        description: "District / Tehsil is required.",
        variant: "destructive",
      });
      return;
    }

    if (typeof profile.farm.farmSize !== "number" || isNaN(profile.farm.farmSize) || profile.farm.farmSize <= 0) {
      toast({
        title: "Validation Error",
        description: "Total Farm Land Area must be a positive number greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (!profile.soil.soilType || !profile.soil.soilType.trim()) {
      toast({
        title: "Validation Error",
        description: "Primary Soil Type is required.",
        variant: "destructive",
      });
      return;
    }

    if (profile.soil.ph !== undefined && profile.soil.ph !== null && (profile.soil.ph < 0 || profile.soil.ph > 14)) {
      toast({
        title: "Validation Error",
        description: "Soil pH must be between 0 and 14.",
        variant: "destructive",
      });
      return;
    }

    if (
      (profile.soil.nitrogen !== undefined && profile.soil.nitrogen < 0) ||
      (profile.soil.phosphorus !== undefined && profile.soil.phosphorus < 0) ||
      (profile.soil.potassium !== undefined && profile.soil.potassium < 0)
    ) {
      toast({
        title: "Validation Error",
        description: "Soil nutrient values (Nitrogen, Phosphorus, Potassium) cannot be negative.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // 1. Save complete profile in farmProfileService (Supabase cloud first, then localStorage + reactive event)
      const saveRes = await farmProfileService.saveFarmProfile(profile, true, user?.id);
      if (!saveRes.success) {
        toast({
          title: "Save Failed",
          description: saveRes.error || "Failed to persist farm profile to cloud database.",
          variant: "destructive",
        });
        return;
      }

      // 2. Sync core fields to auth user
      await updateUser({
        full_name: profile.farmer.fullName,
        phone: profile.farmer.phone,
        location: `${profile.farmer.district}, ${profile.farmer.state}`,
        farm_size: `${profile.farm.farmSize} ${profile.farm.farmSizeUnit}`,
      });

      setIsSaved(true);
      setShowPathway(true);

      // Add persistent in-app notification
      const activeUserId = user?.id || user?.email || 'user_default';
      notificationService.addNotification(activeUserId, {
        title: "Farm Profile Synchronized! 🌾",
        message: `Your soil (${profile.soil.soilType || 'Loamy'}, pH ${profile.soil.ph || '6.8'}) and crop holdings are updated. AI models are calibrated.`,
        type: 'advisory',
        actionModule: 'farm-intelligence',
        actionLabel: 'View Intelligence',
      });

      toast({
        title: "Farm Profile Saved!",
        description: "Your farmer details, farm conditions, and soil data are now linked to Farm Intelligence.",
      });

      // Auto-scroll slightly or bring pathway into view
      setTimeout(() => {
        const pathwayElement = document.getElementById("farm-intelligence-pathway");
        if (pathwayElement) {
          pathwayElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    } finally {
      setSaving(false);
    }
  };

  const handleNavigateToModule = (module: string) => {
    if (onNavigate) {
      onNavigate(module);
    } else {
      // Standalone route fallback
      if (module === "home") {
        navigate("/");
      } else {
        navigate(`/?module=${module}`);
      }
    }
  };

  const handleAutoFillWeather = () => {
    if (!weatherData) {
      toast({
        title: "Weather data loading",
        description: "Live weather data is currently unavailable to auto-fill.",
      });
      return;
    }

    setProfile(prev => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        temperature: Math.round(weatherData.main.temp),
        humidity: weatherData.main.humidity,
      }
    }));

    toast({
      title: "Weather Linked",
      description: `Updated temperature (${Math.round(weatherData.main.temp)}°C) and humidity (${weatherData.main.humidity}%) from live weather.`,
    });
  };

  const initials = (profile.farmer.fullName || user?.username || "Farmer")
    .split(" ")
    .map(s => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Helper for pH status
  const getPhStatus = (ph: number) => {
    if (!ph || ph <= 0) return { label: "Not Calibrated", color: "text-gray-500 bg-gray-100 dark:bg-gray-800 border-gray-200" };
    if (ph < 6.0) return { label: "Acidic Soil", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200" };
    if (ph <= 7.5) return { label: "Optimal pH (Neutral)", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200" };
    return { label: "Alkaline Soil", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200" };
  };

  // Helper for NPK ratings
  const getNpkRating = (val: number, type: 'N' | 'P' | 'K') => {
    if (!val || val <= 0) return { label: "Uncalibrated", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" };
    const limits = {
      N: { low: 50, high: 100 },
      P: { low: 30, high: 70 },
      K: { low: 40, high: 90 },
    }[type];

    if (val < limits.low) return { label: "Low", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" };
    if (val <= limits.high) return { label: "Optimal", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" };
    return { label: "High", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" };
  };

  const phStatus = getPhStatus(profile.soil.ph);

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 w-full min-w-0 overflow-x-hidden">
      {/* ── WORKFLOW STEPPER INDICATOR ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 shadow-sm min-w-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 mb-1">
              <Check className="h-3 w-3" /> {isSaved ? "Step 3 of 4: Profile Saved & Synced" : "Step 2 of 4: Profile Configuration"}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              My Farm &amp; Farmer Profile
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Provide your farm details to power personalized AI recommendations across Crop, Fertilizer, and Disease intelligence.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/60 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 shrink-0">
            <div className="text-right">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Profile Readiness</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {completionPercentage}% Complete
              </div>
            </div>
            <div className="w-20">
              <Progress value={completionPercentage} className="h-2.5 bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        </div>

        {/* Visual Architecture Breadcrumb */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-start text-xs overflow-x-auto no-scrollbar pb-1 gap-2 w-full min-w-0">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            <span>1. Login</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <div className={`flex items-center gap-1.5 ${isSaved ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800'} shrink-0`}>
            {isSaved ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <UserCheck className="h-4 w-4" />}
            <span>2. My Farm Profile</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <div className={`flex items-center gap-1.5 ${isSaved ? 'text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800' : 'text-gray-500 dark:text-gray-400'} shrink-0`}>
            {isSaved ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Save className="h-3.5 w-3.5" />}
            <span>3. Save Profile</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <div className={`flex items-center gap-1.5 ${isSaved ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-500 dark:text-gray-400'} shrink-0`}>
            <Sparkles className={`h-3.5 w-3.5 ${isSaved ? 'text-emerald-600' : 'text-amber-500'}`} />
            <span>4. Farm Intelligence AI</span>
          </div>
        </div>
      </div>

      {/* ── PROFILE HEADER HERO CARD ── */}
      <Card className="overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="h-28 bg-gradient-to-r from-emerald-700 via-green-600 to-teal-700 relative">
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <Badge className="bg-black/25 backdrop-blur-sm text-white border-white/20 text-xs">
              <Tractor className="h-3.5 w-3.5 mr-1" />
              {profile.farm.farmName || "Primary Agricultural Holding"}
            </Badge>
          </div>
        </div>

        <CardContent className="p-6 pt-0 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label className="-mt-12 relative z-20 cursor-pointer group shrink-0">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Farmer Avatar"
                    className="h-24 w-24 rounded-2xl ring-4 ring-white dark:ring-gray-900 object-cover shadow-md"
                  />
                ) : (
                  <Avatar className="h-24 w-24 rounded-2xl ring-4 ring-white dark:ring-gray-900 shadow-md">
                    <AvatarFallback className="bg-emerald-600 text-white text-2xl font-bold rounded-2xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-medium">
                  Change
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>

              <div className="pt-2 sm:pt-3 space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                    {profile.farmer.fullName || user?.full_name || user?.username || "Farmer Name"}
                  </h2>
                  <Badge variant="outline" className="text-emerald-700 border-emerald-300 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30">
                    Active Farmer
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    {profile.farmer.district || "District"}, {profile.farmer.state || "State"}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-gray-400" />
                    {profile.farm.farmSize > 0 ? `${profile.farm.farmSize} ${profile.farm.farmSizeUnit}` : "Area Unset"}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <FlaskConical className="h-3.5 w-3.5 text-gray-400" />
                    {profile.soil.soilType ? `${profile.soil.soilType} Soil` : "Soil Uncalibrated"}
                  </span>
                </p>
              </div>
            </div>

            {/* Quick Action Button in Header */}
            <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all flex items-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── CELEBRATORY FARM INTELLIGENCE PATHWAY (Appears after save or when active) ── */}
      {(showPathway || isSaved) && (
        <div
          id="farm-intelligence-pathway"
          className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white dark:from-emerald-950/40 dark:via-gray-900 dark:to-gray-900 p-5 sm:p-6 shadow-md transition-all animate-in fade-in slide-in-from-top-4"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-semibold shadow-sm mb-2">
                <Sparkles className="h-3.5 w-3.5" /> Profile Synchronized!
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Your Farm Profile is Ready for Farm Intelligence
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 max-w-2xl">
                Soil parameters (pH {profile.soil.ph}, NPK {profile.soil.nitrogen}-{profile.soil.phosphorus}-{profile.soil.potassium}) and farm size ({profile.farm.farmSize} {profile.farm.farmSizeUnit}) are now linked. Select an intelligence module to run AI predictions:
              </p>
            </div>

            <Button
              onClick={() => handleNavigateToModule("home")}
              className="bg-emerald-700 hover:bg-emerald-800 text-white shrink-0 shadow-sm flex items-center gap-2"
            >
              Farm Intelligence Hub
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* Crop AI Card */}
            <div
              onClick={() => handleNavigateToModule("crop-recommendation")}
              className="group cursor-pointer p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800/80 hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                    <Sprout className="h-5 w-5" />
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px]">
                    Auto-Fill NPK
                  </Badge>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-emerald-600 transition-colors">
                  Crop AI Recommendation
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Pre-loads your {profile.soil.soilType} soil, NPK, and rainfall to discover highest-yield crops.
                </p>
              </div>
              <div className="mt-3 flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
                Launch Crop AI →
              </div>
            </div>

            {/* Fertilizer AI Card */}
            <div
              onClick={() => handleNavigateToModule("fertilizer-recommendation")}
              className="group cursor-pointer p-4 rounded-xl border border-teal-200 dark:border-teal-800 bg-white dark:bg-gray-800/80 hover:border-teal-500 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-lg bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold">
                    <FlaskConical className="h-5 w-5" />
                  </div>
                  <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 text-[10px]">
                    {profile.farm.farmSize} {profile.farm.farmSizeUnit}
                  </Badge>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-teal-600 transition-colors">
                  Fertilizer AI Optimizer
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Calculates precise Urea/DAP bags tailored for your soil deficiencies and acreage.
                </p>
              </div>
              <div className="mt-3 flex items-center text-xs font-semibold text-teal-600 dark:text-teal-400 group-hover:translate-x-1 transition-transform">
                Launch Fertilizer AI →
              </div>
            </div>

            {/* Disease AI Card */}
            <div
              onClick={() => handleNavigateToModule("disease-detection")}
              className="group cursor-pointer p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800/80 hover:border-amber-500 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
                    <ScanEye className="h-5 w-5" />
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">
                    Visual Diagnostic
                  </Badge>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-amber-600 transition-colors">
                  Plant Disease AI
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Instant scan for crop leaves with diagnosis and remedies suited for {profile.farmer.state}.
                </p>
              </div>
              <div className="mt-3 flex items-center text-xs font-semibold text-amber-600 dark:text-amber-400 group-hover:translate-x-1 transition-transform">
                Launch Disease AI →
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 4 CORE FARM PROFILE SECTIONS (Tabs) ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full min-w-0">
        <div className="w-full overflow-x-auto no-scrollbar scroll-smooth pb-1">
          <TabsList className="inline-flex min-w-full md:grid md:grid-cols-4 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl h-auto gap-1">
            <TabsTrigger
              value="farmer-info"
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow-sm text-xs sm:text-sm font-medium shrink-0 whitespace-nowrap"
            >
              <User className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>1. About You<span className="hidden sm:inline"> &amp; Location</span></span>
            </TabsTrigger>

            <TabsTrigger
              value="farm-details"
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow-sm text-xs sm:text-sm font-medium shrink-0 whitespace-nowrap"
            >
              <Tractor className="h-4 w-4 text-amber-600 shrink-0" />
              <span>2. Your Farm</span>
            </TabsTrigger>

            <TabsTrigger
              value="farm-conditions"
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow-sm text-xs sm:text-sm font-medium shrink-0 whitespace-nowrap"
            >
              <CloudSun className="h-4 w-4 text-sky-600 shrink-0" />
              <span>3. Farm Conditions</span>
            </TabsTrigger>

            <TabsTrigger
              value="soil-info"
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow-sm text-xs sm:text-sm font-medium shrink-0 whitespace-nowrap"
            >
              <FlaskConical className="h-4 w-4 text-teal-600 shrink-0" />
              <span>4. Soil Information</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── TAB 1: ABOUT YOU & LOCATION ── */}
        <TabsContent value="farmer-info" className="space-y-6 focus-visible:outline-none">
          <Card className="border border-gray-200 dark:border-gray-800">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                    <User className="h-5 w-5 text-emerald-600" />
                    About You &amp; Location
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Personal identity and geographic coordinates of your agricultural holding.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                  Section 1
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Subsection A: About You */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-gray-800">
                  <User className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                    About You
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-semibold flex items-center">
                      Full Name / Farmer Name <FieldBadge type="required" />
                    </Label>
                    <Input
                      id="fullName"
                      value={profile.farmer.fullName}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          farmer: { ...profile.farmer, fullName: e.target.value },
                        })
                      }
                      placeholder="e.g. Ramesh Patel"
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold flex items-center">
                      Mobile / WhatsApp Contact <FieldBadge type="required" />
                    </Label>
                    <Input
                      id="phone"
                      value={profile.farmer.phone}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          farmer: { ...profile.farmer, phone: e.target.value },
                        })
                      }
                      placeholder="+91 98765 43210"
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold flex items-center">
                      Email Address <FieldBadge type="optional" />
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.farmer.email}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          farmer: { ...profile.farmer, email: e.target.value },
                        })
                      }
                      placeholder="farmer@cropswild.ai"
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="experienceYears" className="text-xs font-semibold flex items-center">
                      Farming Experience (Years) <FieldBadge type="optional" />
                    </Label>
                    <Input
                      id="experienceYears"
                      type="number"
                      value={profile.farmer.experienceYears}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          farmer: { ...profile.farmer, experienceYears: e.target.value },
                        })
                      }
                      placeholder="e.g. 15"
                      className="h-10"
                    />
                  </div>
                </div>
              </div>

              {/* Subsection B: Location */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                      Location
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDetectLiveLocation}
                    disabled={isDetectingLocation}
                    className="h-8 text-xs font-medium text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1.5"
                  >
                    <Compass className={`h-3.5 w-3.5 ${isDetectingLocation ? "animate-spin text-emerald-600" : ""}`} />
                    {isDetectingLocation ? "Detecting GPS..." : "📍 Detect Live Location"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="state" className="text-xs font-semibold flex items-center">
                      State / Province <FieldBadge type="required" />
                    </Label>
                    <Select
                      value={profile.farmer.state}
                      onValueChange={(val) =>
                        setProfile({
                          ...profile,
                          farmer: { ...profile.farmer, state: val },
                        })
                      }
                    >
                      <SelectTrigger id="state" className="h-10">
                        <SelectValue placeholder="Select State" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="district" className="text-xs font-semibold flex items-center">
                      District / Tehsil <FieldBadge type="required" />
                    </Label>
                    <Input
                      id="district"
                      value={profile.farmer.district}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          farmer: { ...profile.farmer, district: e.target.value },
                        })
                      }
                      placeholder="e.g. Ludhiana, Nashik, Karnal"
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="village" className="text-xs font-semibold flex items-center">
                      Village / Gram Panchayat <FieldBadge type="optional" />
                    </Label>
                    <Input
                      id="village"
                      value={profile.farmer.village || ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          farmer: { ...profile.farmer, village: e.target.value },
                        })
                      }
                      placeholder="e.g. Samrala, Baramati, Karnal Rural"
                      className="h-10"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-500">Provide required location fields for localized weather and mandi prices</span>
                <Button
                  onClick={() => setActiveTab("farm-details")}
                  variant="outline"
                  className="flex items-center gap-1.5 self-end sm:self-auto"
                >
                  Next: Your Farm
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: YOUR FARM ── */}
        <TabsContent value="farm-details" className="space-y-6 focus-visible:outline-none">
          <Card className="border border-gray-200 dark:border-gray-800">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                    <Tractor className="h-5 w-5 text-amber-600" />
                    Your Farm &amp; Infrastructure
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Acreage, farming methodology, and existing crop history.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-amber-700 border-amber-300">
                  Section 2
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="farmName" className="text-xs font-semibold flex items-center">
                    Farm Name / Land Identifier <FieldBadge type="recommended" />
                  </Label>
                  <Input
                    id="farmName"
                    value={profile.farm.farmName}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        farm: { ...profile.farm, farmName: e.target.value },
                      })
                    }
                    placeholder="e.g. Patel Organic Green Farm"
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="farmSize" className="text-xs font-semibold flex items-center">
                    Total Farm Land Area <FieldBadge type="required" />
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="farmSize"
                      type="number"
                      min={0.1}
                      step={0.5}
                      value={profile.farm.farmSize > 0 ? profile.farm.farmSize : ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          farm: {
                            ...profile.farm,
                            farmSize: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="e.g. 15"
                      className="h-10 flex-1"
                    />
                    <Select
                      value={profile.farm.farmSizeUnit}
                      onValueChange={(val: any) =>
                        setProfile({
                          ...profile,
                          farm: { ...profile.farm, farmSizeUnit: val },
                        })
                      }
                    >
                      <SelectTrigger className="w-28 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Acres">Acres</SelectItem>
                        <SelectItem value="Hectares">Hectares</SelectItem>
                        <SelectItem value="Bighas">Bighas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="farmingMethod" className="text-xs font-semibold flex items-center">
                    Farming Method <FieldBadge type="recommended" />
                  </Label>
                  <Select
                    value={profile.farm.farmingMethod}
                    onValueChange={(val: any) =>
                      setProfile({
                        ...profile,
                        farm: { ...profile.farm, farmingMethod: val },
                      })
                    }
                  >
                    <SelectTrigger id="farmingMethod" className="h-10">
                      <SelectValue placeholder="Select Method" />
                    </SelectTrigger>
                    <SelectContent>
                      {FARMING_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="irrigationType" className="text-xs font-semibold flex items-center">
                    Primary Irrigation Infrastructure <FieldBadge type="recommended" />
                  </Label>
                  <Select
                    value={profile.farm.irrigationType}
                    onValueChange={(val: any) =>
                      setProfile({
                        ...profile,
                        farm: { ...profile.farm, irrigationType: val },
                      })
                    }
                  >
                    <SelectTrigger id="irrigationType" className="h-10">
                      <SelectValue placeholder="Select Irrigation" />
                    </SelectTrigger>
                    <SelectContent>
                      {IRRIGATION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="currentCrops" className="text-xs font-semibold flex items-center">
                    Current Crops Planted <FieldBadge type="recommended" />
                  </Label>
                  <Input
                    id="currentCrops"
                    value={profile.farm.currentCrops}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        farm: { ...profile.farm, currentCrops: e.target.value },
                      })
                    }
                    placeholder="e.g. Wheat, Rice, Cotton"
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="previousCrops" className="text-xs font-semibold flex items-center">
                    Previous Crops Grown (Crop Rotation History) <FieldBadge type="optional" />
                  </Label>
                  <Input
                    id="previousCrops"
                    value={profile.farm.previousCrops}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        farm: { ...profile.farm, previousCrops: e.target.value },
                      })
                    }
                    placeholder="e.g. Rice, Mustard, Legumes (pulses)"
                    className="h-10"
                  />
                  <p className="text-[11px] text-gray-500">
                    Knowing your previous crop allows the AI to calculate biological nitrogen fixation and avoid pest cycles.
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-800">
                <Button
                  onClick={() => setActiveTab("farmer-info")}
                  variant="ghost"
                  className="text-xs"
                >
                  ← Back: Farmer Info
                </Button>
                <Button
                  onClick={() => setActiveTab("farm-conditions")}
                  variant="outline"
                  className="flex items-center gap-1.5"
                >
                  Next: Farm Conditions
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: FARM CONDITIONS ── */}
        <TabsContent value="farm-conditions" className="space-y-6 focus-visible:outline-none">
          <Card className="border border-gray-200 dark:border-gray-800">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                    <CloudSun className="h-5 w-5 text-sky-600" />
                    Farm Conditions &amp; Climate
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Agro-climatic zone, water availability, rainfall, and regional weather factors.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleAutoFillWeather}
                    variant="outline"
                    size="sm"
                    className="text-xs border-sky-300 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 flex items-center gap-1.5"
                  >
                    <CloudSun className="h-3.5 w-3.5" />
                    Link Live Weather
                  </Button>
                  <Badge variant="outline" className="text-sky-700 border-sky-300">
                    Section 3
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="agroZone" className="text-xs font-semibold flex items-center">
                    Agro-Climatic Zone <FieldBadge type="optional" />
                  </Label>
                  <Input
                    id="agroZone"
                    value={profile.conditions.agroZone}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        conditions: { ...profile.conditions, agroZone: e.target.value },
                      })
                    }
                    placeholder="e.g. Trans-Gangetic Plains, Semi-Arid Zone"
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="waterAvailability" className="text-xs font-semibold flex items-center">
                    Water Availability &amp; Reliability <FieldBadge type="recommended" />
                  </Label>
                  <Select
                    value={profile.conditions.waterAvailability}
                    onValueChange={(val: any) =>
                      setProfile({
                        ...profile,
                        conditions: { ...profile.conditions, waterAvailability: val },
                      })
                    }
                  >
                    <SelectTrigger id="waterAvailability" className="h-10">
                      <SelectValue placeholder="Select Water Reliability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">High (Perennial Canal / Deep Borewell)</SelectItem>
                      <SelectItem value="Moderate">Moderate (Seasonal Water / Shared Tube-well)</SelectItem>
                      <SelectItem value="Low / Rainfed">Low / Rainfed (Monsoon Dependent)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="rainfall" className="text-xs font-semibold flex items-center">
                      Annual Rainfall (mm) <FieldBadge type="recommended" />
                    </Label>
                    <span className="text-xs font-bold text-sky-600">
                      {profile.conditions.rainfall > 0 ? `${profile.conditions.rainfall} mm` : "Unset"}
                    </span>
                  </div>
                  <Input
                    id="rainfall"
                    type="number"
                    min={100}
                    max={3000}
                    step={10}
                    value={profile.conditions.rainfall}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        conditions: {
                          ...profile.conditions,
                          rainfall: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="temperature" className="text-xs font-semibold flex items-center">
                      Avg Growing Season Temperature (°C) <FieldBadge type="recommended" />
                    </Label>
                    <span className="text-xs font-bold text-sky-600">
                      {profile.conditions.temperature > 0 ? `${profile.conditions.temperature}°C` : "Unset"}
                    </span>
                  </div>
                  <Input
                    id="temperature"
                    type="number"
                    min={5}
                    max={50}
                    placeholder="e.g. 25"
                    value={profile.conditions.temperature > 0 ? profile.conditions.temperature : ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        conditions: {
                          ...profile.conditions,
                          temperature: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="topography" className="text-xs font-semibold flex items-center">
                    Farm Topography / Terrain <FieldBadge type="optional" />
                  </Label>
                  <Select
                    value={profile.conditions.topography}
                    onValueChange={(val: any) =>
                      setProfile({
                        ...profile,
                        conditions: { ...profile.conditions, topography: val },
                      })
                    }
                  >
                    <SelectTrigger id="topography" className="h-10">
                      <SelectValue placeholder="Select Topography" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOPOGRAPHY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="humidity" className="text-xs font-semibold flex items-center">
                    Average Relative Humidity (%) <FieldBadge type="recommended" />
                  </Label>
                  <Input
                    id="humidity"
                    type="number"
                    min={10}
                    max={100}
                    value={profile.conditions.humidity}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        conditions: {
                          ...profile.conditions,
                          humidity: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    className="h-10"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <Button
                  onClick={() => setActiveTab("farm-details")}
                  variant="ghost"
                  className="text-xs self-start sm:self-auto"
                >
                  ← Back: Farm Details
                </Button>
                <Button
                  onClick={() => setActiveTab("soil-info")}
                  variant="outline"
                  className="flex items-center gap-1.5 self-end sm:self-auto"
                >
                  Next: Soil Information
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 4: SOIL INFORMATION ── */}
        <TabsContent value="soil-info" className="space-y-6 focus-visible:outline-none">
          <Card className="border border-gray-200 dark:border-gray-800">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 min-w-0">
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-lg flex flex-wrap items-center gap-2 text-gray-900 dark:text-white break-words">
                    <FlaskConical className="h-5 w-5 text-teal-600 shrink-0" />
                    <span>Soil Information &amp; Nutrient Profile (NPK)</span>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-0.5">
                    Soil chemistry, pH balance, and N-P-K nutrient concentrations for precision guidance.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-teal-700 border-teal-300 self-start sm:self-auto shrink-0">
                  Section 4
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-5 sm:space-y-6 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Soil Type */}
                <div className="space-y-1.5">
                  <Label htmlFor="soilType" className="text-xs font-semibold flex items-center">
                    Primary Soil Type <FieldBadge type="required" />
                  </Label>
                  <Select
                    value={profile.soil.soilType}
                    onValueChange={(val) =>
                      setProfile({
                        ...profile,
                        soil: { ...profile.soil, soilType: val },
                      })
                    }
                  >
                    <SelectTrigger id="soilType" className="h-10">
                      <SelectValue placeholder="Select Soil Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOIL_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t} Soil
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-gray-500">
                    Different crops thrive in specific soil textures like Loamy or Black Cotton soils.
                  </p>
                </div>

                {/* Last Tested Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="lastTestedDate" className="text-xs font-semibold flex items-center">
                    Soil Health Card / Test Date <FieldBadge type="optional" />
                  </Label>
                  <Input
                    id="lastTestedDate"
                    type="date"
                    value={profile.soil.lastTestedDate || ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        soil: { ...profile.soil, lastTestedDate: e.target.value },
                      })
                    }
                    className="h-10"
                  />
                  <p className="text-[11px] text-gray-500">
                    Regular testing every 2–3 years ensures balanced fertilizer dosing.
                  </p>
                </div>

                {/* Soil pH Slider with Indicator */}
                <div className="space-y-3 md:col-span-2 p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <Label className="text-xs font-semibold flex items-center">
                        Soil pH Level <FieldBadge type="recommended" />
                      </Label>
                      <p className="text-[11px] text-gray-500">Range: 4.0 (Highly Acidic) to 9.5 (Highly Alkaline)</p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {profile.soil.ph > 0 ? profile.soil.ph.toFixed(1) : "—"}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${phStatus.color}`}>
                        {phStatus.label}
                      </span>
                    </div>
                  </div>

                  <Slider
                    value={[profile.soil.ph > 0 ? profile.soil.ph : 6.5]}
                    min={4.0}
                    max={9.5}
                    step={0.1}
                    onValueChange={([val]) =>
                      setProfile({
                        ...profile,
                        soil: { ...profile.soil, ph: val },
                      })
                    }
                    className="py-2"
                  />

                  <div className="flex justify-between text-[10px] text-gray-400 font-medium">
                    <span>4.0 (Acidic)</span>
                    <span className="text-emerald-600 font-semibold">6.5 - 7.5 (Optimal Range)</span>
                    <span>9.5 (Alkaline)</span>
                  </div>
                </div>

                {/* Nitrogen (N) Slider */}
                <div className="space-y-3 p-3.5 sm:p-4 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/30 dark:bg-teal-950/20 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <Label className="text-xs font-semibold text-teal-900 dark:text-teal-200 flex items-center">
                      Nitrogen (N) Content <FieldBadge type="recommended" />
                    </Label>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-teal-700 dark:text-teal-300">
                        {profile.soil.nitrogen > 0 ? `${profile.soil.nitrogen} kg/ha` : "Uncalibrated"}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${getNpkRating(profile.soil.nitrogen, 'N').color}`}>
                        {getNpkRating(profile.soil.nitrogen, 'N').label}
                      </span>
                    </div>
                  </div>
                  <Slider
                    value={[profile.soil.nitrogen]}
                    min={0}
                    max={200}
                    step={5}
                    onValueChange={([val]) =>
                      setProfile({
                        ...profile,
                        soil: { ...profile.soil, nitrogen: val },
                      })
                    }
                  />
                  <p className="text-[10px] text-gray-500">Crucial for vegetative growth, leafy mass &amp; chlorophyll.</p>
                </div>

                {/* Phosphorus (P) Slider */}
                <div className="space-y-3 p-3.5 sm:p-4 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/30 dark:bg-purple-950/20 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <Label className="text-xs font-semibold text-purple-900 dark:text-purple-200 flex items-center">
                      Phosphorus (P) Content <FieldBadge type="recommended" />
                    </Label>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-purple-700 dark:text-purple-300">
                        {profile.soil.phosphorus > 0 ? `${profile.soil.phosphorus} kg/ha` : "Uncalibrated"}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${getNpkRating(profile.soil.phosphorus, 'P').color}`}>
                        {getNpkRating(profile.soil.phosphorus, 'P').label}
                      </span>
                    </div>
                  </div>
                  <Slider
                    value={[profile.soil.phosphorus]}
                    min={0}
                    max={150}
                    step={2}
                    onValueChange={([val]) =>
                      setProfile({
                        ...profile,
                        soil: { ...profile.soil, phosphorus: val },
                      })
                    }
                  />
                  <p className="text-[10px] text-gray-500">Essential for deep root development, tillering &amp; early flowering.</p>
                </div>

                {/* Potassium (K) Slider */}
                <div className="space-y-3 p-3.5 sm:p-4 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/30 dark:bg-sky-950/20 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <Label className="text-xs font-semibold text-sky-900 dark:text-sky-200 flex items-center">
                      Potassium (K) Content <FieldBadge type="recommended" />
                    </Label>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-sky-700 dark:text-sky-300">
                        {profile.soil.potassium > 0 ? `${profile.soil.potassium} kg/ha` : "Uncalibrated"}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${getNpkRating(profile.soil.potassium, 'K').color}`}>
                        {getNpkRating(profile.soil.potassium, 'K').label}
                      </span>
                    </div>
                  </div>
                  <Slider
                    value={[profile.soil.potassium]}
                    min={0}
                    max={200}
                    step={5}
                    onValueChange={([val]) =>
                      setProfile({
                        ...profile,
                        soil: { ...profile.soil, potassium: val },
                      })
                    }
                  />
                  <p className="text-[10px] text-gray-500">Drives drought resistance, grain filling, and disease resilience.</p>
                </div>

                {/* Organic Carbon */}
                <div className="space-y-3 p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/20 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <Label className="text-xs font-semibold flex items-center">
                      Organic Carbon (%) <FieldBadge type="optional" />
                    </Label>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      {profile.soil.organicCarbon}%
                    </span>
                  </div>
                  <Slider
                    value={[profile.soil.organicCarbon]}
                    min={0.1}
                    max={3.0}
                    step={0.05}
                    onValueChange={([val]) =>
                      setProfile({
                        ...profile,
                        soil: { ...profile.soil, organicCarbon: Math.round(val * 100) / 100 },
                      })
                    }
                  />
                  <p className="text-[10px] text-gray-500">Healthy Indian agricultural soil targets 0.75% to 1.5% organic carbon.</p>
                </div>
              </div>

              {/* SAVE PROFILE ACTION FOOTER */}
              <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
                <Button
                  onClick={() => setActiveTab("farm-conditions")}
                  variant="ghost"
                  className="text-xs self-start sm:self-auto"
                >
                  ← Back: Farm Conditions
                </Button>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto min-w-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setProfile(defaultFarmProfile);
                      toast({ title: "Reset to default demo profile" });
                    }}
                    className="w-full sm:w-auto text-xs flex items-center justify-center gap-1.5 h-10"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </Button>

                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 sm:px-6 shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm h-10 min-w-0 text-center whitespace-normal sm:whitespace-nowrap"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    <span>{saving ? "SAVING TO CLOUD..." : "SAVE PROFILE & CONNECT INTELLIGENCE"}</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfilePage;
