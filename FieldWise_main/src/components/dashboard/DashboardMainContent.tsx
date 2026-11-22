import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWeather } from "@/components/dashboard/WeatherContext";
import { useAuth } from "@/context/AuthContext";
import {
  farmProfileService,
  CompleteFarmProfile,
} from "@/services/farmProfileService";
import {
  farmIntelligenceService,
  FarmActivityItem,
  StoredCropRecommendation,
  StoredFertilizerRecommendation,
  StoredDiseaseDetection,
} from "@/services/farmIntelligenceService";
import {
  Sprout,
  FlaskConical,
  ScanEye,
  Activity,
  CloudSun,
  Droplets,
  Layers,
  TrendingUp,
  Landmark,
  Headphones,
  Loader2,
  MapPin,
  Wind,
  ArrowRight,
  Clock,
  LayoutDashboard,
  CheckCircle2,
  User,
} from "lucide-react";

interface DashboardMainContentProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
}

// Helper: greeting based on hour
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const DashboardMainContent = ({
  activeModule,
  setActiveModule,
}: DashboardMainContentProps) => {
  const { weatherData, loading: weatherLoading, error: weatherError } =
    useWeather();
  const { user } = useAuth();
  const currentFarmerId = user?.id;

  const [profile, setProfile] = useState<CompleteFarmProfile>(() =>
    farmProfileService.getFarmProfile(user, currentFarmerId)
  );
  const [cropRec, setCropRec] = useState<StoredCropRecommendation | null>(() =>
    farmIntelligenceService.getStoredCropRecommendation(currentFarmerId)
  );
  const [fertRec, setFertRec] = useState<StoredFertilizerRecommendation | null>(() =>
    farmIntelligenceService.getStoredFertilizerRecommendation(currentFarmerId)
  );
  const [diseaseRec, setDiseaseRec] = useState<StoredDiseaseDetection | null>(() =>
    farmIntelligenceService.getStoredDiseaseDetection(currentFarmerId)
  );
  const [activities, setActivities] = useState<FarmActivityItem[]>(() =>
    farmIntelligenceService.getRecentActivities(farmProfileService.getFarmProfile(user, currentFarmerId), currentFarmerId)
  );

  useEffect(() => {
    let isCurrent = true;

    const refreshDashboardData = () => {
      if (!isCurrent) return;
      const p = farmProfileService.getFarmProfile(user, currentFarmerId);
      setProfile(p);
      setCropRec(farmIntelligenceService.getStoredCropRecommendation(currentFarmerId));
      setFertRec(farmIntelligenceService.getStoredFertilizerRecommendation(currentFarmerId));
      setDiseaseRec(farmIntelligenceService.getStoredDiseaseDetection(currentFarmerId));
      setActivities(farmIntelligenceService.getRecentActivities(p, currentFarmerId));
    };

    refreshDashboardData();

    const unsubscribeProfile = farmProfileService.onProfileChange((updated) => {
      if (!isCurrent) return;
      setProfile(updated);
      setActivities(farmIntelligenceService.getRecentActivities(updated, currentFarmerId));
    });

    const handleIntelligenceUpdate = () => {
      if (!isCurrent) return;
      refreshDashboardData();
    };

    window.addEventListener("fieldwise:intelligence_updated", handleIntelligenceUpdate);
    window.addEventListener("storage", handleIntelligenceUpdate);

    return () => {
      isCurrent = false;
      unsubscribeProfile();
      window.removeEventListener("fieldwise:intelligence_updated", handleIntelligenceUpdate);
      window.removeEventListener("storage", handleIntelligenceUpdate);
    };
  }, [user?.id]);

  // Only render home content when activeModule === "home"
  if (activeModule !== "home" && activeModule !== "farm-intelligence") {
    return null;
  }

  const farmerName =
    profile.farmer.fullName?.split(" ")[0] ||
    user?.full_name?.split(" ")[0] ||
    user?.username ||
    "Farmer";

  const displayLocation =
    profile.farmer.district && profile.farmer.state
      ? `${profile.farmer.district}, ${profile.farmer.state}`
      : user?.location || undefined;

  return (
    <div className="min-h-full bg-[#f8faf9] dark:bg-gray-950 transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">

        {/* ── SECTION A: Welcome Hero Banner ── */}
        <div 
          style={{ 
            backgroundColor: '#0a2316', 
            backgroundImage: 'radial-gradient(rgba(52, 211, 153, 0.12) 1.2px, transparent 1.2px)', 
            backgroundSize: '20px 20px' 
          }}
          className="rounded-2xl p-6 sm:p-8 text-white shadow-md border border-[#163a23] relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold mb-3 shadow-xs">
              <Sprout className="h-3.5 w-3.5 text-emerald-400" />
              <span>Crops Wild Intelligence Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              {getGreeting()}, {farmerName} 👋
            </h1>
            <p className="mt-2 text-emerald-100/80 text-sm sm:text-base leading-relaxed">
              Understand your farm. Get data-driven insights and make informed decisions.
            </p>
            {displayLocation && (
              <p className="mt-3 flex items-center gap-1.5 text-xs sm:text-sm text-emerald-200/90 font-medium">
                <MapPin className="h-4 w-4 text-emerald-400" />
                <span>{displayLocation}</span>
              </p>
            )}
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            <div className="flex items-center gap-2 text-xs text-emerald-200/90 bg-white/10 backdrop-blur-md border border-white/15 px-4 py-2.5 rounded-xl shadow-xs">
              <LayoutDashboard className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold">Farm Intelligence Dashboard</span>
            </div>
            <button
              onClick={() => setActiveModule("farm-intelligence")}
              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 hover:shadow-md"
            >
              <span>Explore AI Insights</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── SECTION B: Farm Snapshot ── */}
        <section>
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                Farm Snapshot
              </h2>
            </div>
            <button
              onClick={() => setActiveModule("profile")}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline flex items-center gap-1"
            >
              <span>Edit My Farm Profile</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Location */}
            <SnapshotCard
              icon={<MapPin className="h-4 w-4 text-green-500" />}
              label="Location"
              value={displayLocation}
              empty="Add location"
              onClick={() => setActiveModule("profile")}
            />

            {/* Farm Size */}
            <SnapshotCard
              icon={<Layers className="h-4 w-4 text-amber-500" />}
              label="Farm Size"
              value={
                profile.farm.farmSize
                  ? `${profile.farm.farmSize} ${profile.farm.farmSizeUnit}`
                  : user?.farm_size || undefined
              }
              empty="Add farm size"
              onClick={() => setActiveModule("profile")}
            />

            {/* Current Crop */}
            <SnapshotCard
              icon={<Sprout className="h-4 w-4 text-emerald-600" />}
              label="Current Crop"
              value={profile.farm.currentCrops || undefined}
              empty="Set crop"
              onClick={() => setActiveModule("profile")}
            />

            {/* Soil Type & pH */}
            <SnapshotCard
              icon={<FlaskConical className="h-4 w-4 text-teal-500" />}
              label="Soil & pH"
              value={
                profile.soil.soilType
                  ? `${profile.soil.soilType} • pH ${profile.soil.ph}`
                  : undefined
              }
              empty="Add soil info"
              onClick={() => setActiveModule("profile")}
            />

            {/* Soil NPK Profile */}
            <SnapshotCard
              icon={<Layers className="h-4 w-4 text-emerald-500" />}
              label="Soil NPK"
              value={
                profile.soil.nitrogen
                  ? `${profile.soil.nitrogen}-${profile.soil.phosphorus}-${profile.soil.potassium}`
                  : undefined
              }
              empty="Set NPK"
              onClick={() => setActiveModule("profile")}
            />

            {/* Live Weather */}
            <SnapshotCard
              icon={<CloudSun className="h-4 w-4 text-sky-500" />}
              label="Live Weather"
              value={
                weatherLoading
                  ? undefined
                  : weatherData
                  ? `${Math.round(weatherData.main.temp)}°C • ${weatherData.main.humidity}% RH`
                  : undefined
              }
              empty={
                weatherLoading
                  ? "Loading…"
                  : weatherError
                  ? "Unavailable"
                  : "No data"
              }
              loading={weatherLoading}
              onClick={() => setActiveModule("weather")}
            />
          </div>
        </section>

        {/* ── ARCHITECTURE PATHWAY BANNER (My Farm → Save Profile → Farm Intelligence → AI Tools) ── */}
        <div className="rounded-2xl border border-emerald-900/15 dark:border-emerald-800/40 bg-gradient-to-r from-emerald-50/90 via-white to-white dark:from-emerald-950/40 dark:via-gray-900 dark:to-gray-900 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3.5">
            <div className="h-9 w-9 rounded-xl bg-[#0a2316] text-white flex items-center justify-center shrink-0 shadow-xs border border-emerald-600/40">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>My Farm Profile Connected</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 font-semibold border border-emerald-200 dark:border-emerald-800">
                  {profile.farm.farmName || "Primary Holding"}
                </span>
              </div>
              <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
                Soil parameters (pH {profile.soil.ph}, NPK {profile.soil.nitrogen}-{profile.soil.phosphorus}-{profile.soil.potassium}) automatically power Crop AI, Fertilizer AI, and Disease Detection below.
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveModule("profile")}
            className="text-xs font-semibold border-2 border-emerald-700/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 shrink-0 self-start md:self-center shadow-xs"
          >
            Review Farm Profile
          </Button>
        </div>

        {/* ── SECTION C: Farm Intelligence (AI Tools) ── */}
        <section>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Farm Intelligence
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Use AI-powered tools to understand your farm and make better-informed decisions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <IntelligenceCard
              icon={<Sprout className="h-5 w-5 text-green-600" />}
              iconBg="bg-green-50 dark:bg-green-950"
              title="Crop Recommendation"
              description="Find suitable crops based on your farm conditions, soil type, and local climate."
              cta="Get Recommendations"
              latestResult={
                cropRec
                  ? `Latest: ${
                      typeof cropRec.topCrop === "object" && cropRec.topCrop !== null
                        ? (cropRec.topCrop as any).name
                        : cropRec.topCrop ||
                          cropRec.cropName ||
                          (typeof cropRec.predictions?.[0]?.crop === "object" && cropRec.predictions[0]?.crop !== null
                            ? (cropRec.predictions[0]?.crop as any).name
                            : cropRec.predictions?.[0]?.crop) ||
                          "Crop"
                    } (${cropRec.confidence ?? cropRec.suitabilityScore ?? cropRec.predictions?.[0]?.confidence ?? 0}% match)`
                  : undefined
              }
              onClick={() => setActiveModule("crop-recommendation")}
            />
            <IntelligenceCard
              icon={<FlaskConical className="h-5 w-5 text-teal-600" />}
              iconBg="bg-teal-50 dark:bg-teal-950"
              title="Fertilizer Recommendation"
              description="Get data-driven fertilizer schedules based on ICAR guidelines and available farm information."
              cta="Get Recommendation"
              latestResult={
                fertRec
                  ? `Latest: ${fertRec.cropName || "Crop"} (${fertRec.inputs?.area || 1} ${fertRec.inputs?.unit || "Acre"})`
                  : undefined
              }
              onClick={() => setActiveModule("fertilizer-recommendation")}
            />
            <IntelligenceCard
              icon={<ScanEye className="h-5 w-5 text-rose-600" />}
              iconBg="bg-rose-50 dark:bg-rose-950"
              title="Plant Disease Detection"
              description="Upload a plant image and check for possible disease symptoms using AI vision analysis."
              cta="Detect Disease"
              latestResult={diseaseRec ? `Latest: ${diseaseRec.diseaseName} on ${diseaseRec.cropName}` : undefined}
              onClick={() => setActiveModule("disease-detection")}
            />
            <IntelligenceCard
              icon={<Activity className="h-5 w-5 text-violet-600" />}
              iconBg="bg-violet-50 dark:bg-violet-950"
              title="Farm Intelligence"
              description="Bring farm data together to understand current conditions, signals, and actionable insights."
              cta="Explore Intelligence"
              latestResult={cropRec || fertRec || diseaseRec ? "Multi-Source Synthesized" : "Ready for Analysis"}
              onClick={() => setActiveModule("farm-intelligence")}
            />
          </div>
        </section>

        {/* ── SECTION D: Real-World Farm Data ── */}
        <section>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Real-World Farm Data
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Stay connected to the information that can affect your farm decisions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Weather Intelligence */}
            <WeatherDataCard
              weatherData={weatherData}
              weatherLoading={weatherLoading}
              weatherError={weatherError}
              onNavigate={() => setActiveModule("weather")}
            />

            {/* Mandi Prices */}
            <DataCard
              icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
              title="Mandi Prices"
              description="Check reported modal rates, price ranges, and APMC trends for your crops."
              cta="View Prices"
              onClick={() => setActiveModule("mandi")}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-800 dark:text-gray-200">
                  <span>Crop: {profile.farm.currentCrops ? profile.farm.currentCrops.split(",")[0].trim() : "Wheat"}</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">Agmarknet Records</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Track minimum, maximum, and modal wholesale rates across regional APMC mandis.
                </p>
              </div>
            </DataCard>

            {/* Soil & Environment */}
            <DataCard
              icon={<Layers className="h-4 w-4 text-emerald-600" />}
              title="Soil & Environment"
              description="Understand soil chemistry, nutrient baselines, and environmental conditions."
              cta="View Intelligence"
              onClick={() => setActiveModule("soil-environment")}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-800 dark:text-gray-200">
                  <span>Soil: {profile.soil.soilType || "Unset"}</span>
                  <span>{profile.soil.ph ? `pH ${profile.soil.ph.toFixed(1)}` : "pH Unset"}</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  {profile.soil.nitrogen
                    ? `NPK: ${profile.soil.nitrogen}-${profile.soil.phosphorus}-${profile.soil.potassium} kg/ha • Verified inputs`
                    : "Add soil test values in My Farm to power AI models."}
                </p>
              </div>
            </DataCard>

            {/* Government Schemes */}
            <DataCard
              icon={<Landmark className="h-4 w-4 text-emerald-600" />}
              title="Government Schemes"
              description="Explore agricultural schemes, insurance, credit, and subsidies for your farm."
              cta="Explore Benefits"
              onClick={() => setActiveModule("government-schemes")}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-800 dark:text-gray-200">
                  <span>State: {profile.farmer.state || "All India"}</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">15 Official Programs</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Discover PM-KISAN, PMFBY, KCC, micro-irrigation, and machinery subsidies.
                </p>
              </div>
            </DataCard>
          </div>
        </section>

        {/* ── SECTION E: Farmer Support ── */}
        <section>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Farmer Support
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Get support beyond AI-powered recommendations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SupportCard
              icon={<Landmark className="h-5 w-5 text-indigo-600" />}
              iconBg="bg-indigo-50 dark:bg-indigo-950"
              title="Government & Agricultural Programs"
              description="Discover schemes, subsidies and support programs designed for farmers."
              bullets={[
                "Government schemes & programs",
                "Crop insurance information",
                "Agricultural subsidies",
                "Farmer support initiatives",
              ]}
              cta="Explore Support"
              onClick={() => setActiveModule("government-schemes")}
            />
            <SupportCard
              icon={<Headphones className="h-5 w-5 text-green-600" />}
              iconBg="bg-green-50 dark:bg-green-950"
              title="Expert Agricultural Support"
              description="Connect with verified agricultural institutions, district KVKs, and official helplines."
              bullets={[
                "Toll-Free Kisan Call Center (1551)",
                "Assigned district Krishi Vigyan Kendras (KVKs)",
                "ICAR Kisan Sarathi multimedia platform",
                "Structured farm problem preparation",
              ]}
              cta="Find Expert Support"
              onClick={() => setActiveModule("expert-consultation")}
            />
          </div>
        </section>

        {/* ── SECTION F: Recent Activity ── */}
        <section>
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-4 w-1.5 rounded-full bg-[#0a2316] dark:bg-emerald-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Recent Activity
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your real activity across Crops Wild modules.
            </p>
          </div>

          {activities.length > 0 ? (
            <div className="space-y-2.5">
              {activities.map((act) => {
                const icon =
                  act.type === "crop" ? (
                    <Sprout className="h-4 w-4 text-emerald-600" />
                  ) : act.type === "fertilizer" ? (
                    <FlaskConical className="h-4 w-4 text-teal-600" />
                  ) : act.type === "disease" ? (
                    <ScanEye className="h-4 w-4 text-rose-600" />
                  ) : (
                    <User className="h-4 w-4 text-blue-600" />
                  );

                const formattedTime = new Date(act.timestamp).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={act.id}
                    onClick={() => setActiveModule(act.module)}
                    className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 border border-gray-200/90 dark:border-gray-800 rounded-xl shadow-xs hover:shadow-md hover:border-emerald-600/40 dark:hover:border-emerald-600/50 hover:-translate-y-0.5 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-emerald-50/70 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform border border-emerald-100/50 dark:border-gray-700">
                        {icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-emerald-800 dark:group-hover:text-emerald-300 transition-colors">
                            {act.title}
                          </p>
                          {act.statusBadge && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-gray-800 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200/60 dark:border-gray-700">
                              {act.statusBadge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {act.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap font-medium">
                        {formattedTime}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="border border-gray-200/90 dark:border-gray-800 shadow-sm rounded-2xl bg-white dark:bg-gray-900">
              <CardContent className="py-10 text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-50 dark:bg-gray-800 mb-3 border border-emerald-100 dark:border-gray-700">
                  <Clock className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                </div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  No recent activity yet
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
                  Your crop recommendations, fertilizer schedules, disease checks, and farm analyses will appear here once you run them.
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* ── SECTION G: Final CTA ── */}
        <section
          className="relative overflow-hidden rounded-2xl border border-emerald-900/40 p-6 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-lg text-white"
          style={{
            backgroundColor: '#0a2316',
            backgroundImage: 'radial-gradient(rgba(16, 185, 129, 0.12) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          <div className="min-w-0 z-10">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-2">
              <Sprout className="h-3.5 w-3.5" />
              Ready to unlock higher farm yields?
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Ready to understand your farm?
            </h3>
            <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-lg leading-relaxed">
              Complete your farm profile to get more relevant agricultural insights, personalized soil recommendations, and real-time mandi prices.
            </p>
          </div>
          <Button
            onClick={() => setActiveModule("profile")}
            className="bg-emerald-500 hover:bg-emerald-400 text-[#0a2316] font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg gap-2 shrink-0 whitespace-nowrap z-10 transition-all hover:scale-[1.02]"
          >
            Complete My Farm Profile
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SnapshotCardProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  empty: string;
  loading?: boolean;
  onClick?: () => void;
}

function SnapshotCard({
  icon,
  label,
  value,
  empty,
  loading,
  onClick,
}: SnapshotCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white dark:bg-gray-900 border border-gray-200/90 dark:border-gray-800 hover:border-emerald-600/70 dark:hover:border-emerald-500 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/50 group"
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="p-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100/60 dark:border-emerald-800/60 shrink-0 group-hover:scale-105 transition-transform">
          {icon}
        </div>
        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-hover:text-emerald-800 dark:group-hover:text-emerald-300 transition-colors">
          {label}
        </span>
      </div>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
      ) : value ? (
        <p className="text-sm font-bold text-gray-950 dark:text-white truncate">
          {value}
        </p>
      ) : (
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 italic">
          {empty}
        </p>
      )}
    </button>
  );
}

interface IntelligenceCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  cta: string;
  onClick?: () => void;
  comingSoon?: boolean;
  latestResult?: string;
}

function IntelligenceCard({
  icon,
  iconBg,
  title,
  description,
  cta,
  onClick,
  comingSoon,
  latestResult,
}: IntelligenceCardProps) {
  return (
    <Card className="border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-gray-900 rounded-2xl group overflow-hidden">
      <CardContent className="p-5 sm:p-6 flex flex-col h-full">
        <div className="flex items-start gap-3.5 mb-3">
          <div
            className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0 border border-gray-100/80 dark:border-gray-800 shadow-xs group-hover:scale-105 transition-transform`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors">
                {title}
              </h3>
              {comingSoon && (
                <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5">
                  Coming soon
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed flex-1 mb-4">
          {description}
        </p>
        {latestResult && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold truncate flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{latestResult}</span>
          </div>
        )}
        <Button
          size="sm"
          variant={comingSoon ? "ghost" : "default"}
          className={
            comingSoon
              ? "text-gray-300 dark:text-gray-600 cursor-default pointer-events-none border-0 px-0 justify-start"
              : "w-full bg-[#0a2316] hover:bg-[#133d26] text-white font-semibold shadow-xs hover:shadow-md transition-all gap-1.5 text-xs py-2 rounded-xl"
          }
          onClick={!comingSoon ? onClick : undefined}
          disabled={comingSoon}
        >
          {comingSoon ? "Not available yet" : cta}
          {!comingSoon && <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── WeatherDataCard ─────────────────────────────────────────────────────────
interface WeatherDataCardProps {
  weatherData: {
    main: { temp: number; humidity: number; feels_like: number };
    weather: { main: string; description: string }[];
    wind: { speed: number };
    name: string;
    sys: { country: string };
  } | null;
  weatherLoading: boolean;
  weatherError: string | null;
  onNavigate: () => void;
}

function WeatherDataCard({
  weatherData,
  weatherLoading,
  weatherError,
  onNavigate,
}: WeatherDataCardProps) {
  return (
    <Card
      className="border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all bg-white dark:bg-gray-900 rounded-2xl cursor-pointer group"
      onClick={onNavigate}
    >
      <div className="p-4 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-900/60">
              <CloudSun className="h-4 w-4 text-sky-600" />
            </div>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
              Weather Intelligence
            </span>
          </div>
          {weatherData && !weatherLoading && (
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/60 dark:border-emerald-800/60 rounded-full px-2 py-0.5">
              Live
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1">
          {weatherLoading && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" /> Loading…
            </div>
          )}
          {!weatherLoading && weatherData && (
            <div className="space-y-1 mt-1">
              <p className="text-2xl font-black text-gray-950 dark:text-white leading-none tracking-tight">
                {Math.round(weatherData.main.temp)}°C
              </p>
              <p className="text-[11px] text-gray-600 dark:text-gray-400 capitalize font-medium">
                {weatherData.weather[0]?.description}
              </p>
              <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-800">
                <span className="flex items-center gap-1 font-medium">
                  <Droplets className="h-3 w-3 text-blue-500" />
                  {weatherData.main.humidity}%
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <Wind className="h-3 w-3 text-teal-500" />
                  {weatherData.wind?.speed} m/s
                </span>
              </div>
            </div>
          )}
          {!weatherLoading && !weatherData && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              {weatherError
                ? "Weather data unavailable."
                : "Monitor current weather conditions and forecasts for your farm."}
            </p>
          )}
        </div>

        {/* Footer link */}
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold mt-3 flex items-center gap-1 group-hover:gap-1.5 transition-all">
          View Weather <ArrowRight className="h-3 w-3" />
        </p>
      </div>
    </Card>
  );
}

// ── DataCard ─────────────────────────────────────────────────────────────────
interface DataCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  cta?: string;
  onClick?: () => void;
  comingSoon?: boolean;
}

function DataCard({
  icon,
  title,
  description: _description,
  children,
  cta,
  onClick,
  comingSoon,
}: DataCardProps) {
  const inner = (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/60">
            {icon}
          </div>
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
            {title}
          </span>
        </div>
        {comingSoon && (
          <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5">
            Coming soon
          </span>
        )}
      </div>
      <div className="flex-1 text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
        {children}
      </div>
      {!comingSoon && onClick && cta && (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold mt-3 flex items-center gap-1 group-hover:gap-1.5 transition-all">
          {cta} <ArrowRight className="h-3 w-3" />
        </p>
      )}
    </div>
  );

  if (comingSoon) {
    return (
      <Card className="border border-dashed border-gray-200 dark:border-gray-700 shadow-none bg-gray-50/50 dark:bg-gray-900/50 opacity-70 rounded-2xl">
        {inner}
      </Card>
    );
  }

  return (
    <Card
      className="border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all bg-white dark:bg-gray-900 rounded-2xl cursor-pointer group"
      onClick={onClick}
    >
      {inner}
    </Card>
  );
}

// ── SupportCard ───────────────────────────────────────────────────────────────
interface SupportCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
  onClick: () => void;
}

function SupportCard({
  icon,
  iconBg,
  title,
  description,
  bullets,
  cta,
  onClick,
}: SupportCardProps) {
  return (
    <Card className="border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-white dark:bg-gray-900 rounded-2xl group">
      <CardContent className="p-5 sm:p-6 flex flex-col h-full">
        {/* Card header */}
        <div className="flex items-start gap-3.5 mb-3">
          <div
            className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0 mt-0.5 border border-gray-100/80 dark:border-gray-800 shadow-xs group-hover:scale-105 transition-transform`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors">
              {title}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Bullets */}
        <ul className="space-y-2 mb-5 flex-1">
          {bullets.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300 font-medium"
            >
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
              {b}
            </li>
          ))}
        </ul>

        <Button
          size="sm"
          variant="outline"
          className="w-full border-2 border-emerald-800/30 hover:border-emerald-800 hover:bg-[#0a2316] hover:text-white text-[#0a2316] dark:text-emerald-300 dark:border-emerald-700/50 dark:hover:bg-emerald-950 font-bold rounded-xl transition-all shadow-xs gap-1.5 text-xs py-2 mt-auto"
          onClick={onClick}
        >
          {cta}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default DashboardMainContent;