import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWeather } from "@/components/dashboard/WeatherContext";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { FERTILIZERS, CROPS, CropData, FertilizerRec } from "@/lib/predictorEngine";
import { farmProfileService, CompleteFarmProfile } from "@/services/farmProfileService";
import { getActiveFarmerId } from "@/lib/supabase";
import {
  farmIntelligenceService,
  getFarmerFertRecKey,
  FERT_REC_KEY,
} from "@/services/farmIntelligenceService";
import {
  FlaskConical,
  Sprout,
  Tractor,
  Layers,
  Droplets,
  Thermometer,
  CloudRain,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Info,
  Scale,
  Clock,
  Printer,
  Calendar,
  Leaf,
  Loader2,
  MapPin,
} from "lucide-react";

interface FertilizerRecommendationProps {
  onNavigate?: (module: string) => void;
}

type FieldSource = 'profile' | 'weather' | 'manual';

const SOIL_TYPES = [
  'Loamy', 'Alluvial', 'Black', 'Red', 'Laterite', 'Clay', 'Sandy Loam', 'Clay Loam'
];

function getNpkRating(val: number, type: 'N' | 'P' | 'K'): "low" | "medium" | "high" {
  const limits = { N: [50, 100], P: [30, 70], K: [40, 90] }[type];
  if (val < limits[0]) return "low";
  if (val <= limits[1]) return "medium";
  return "high";
}

function findMatchingCropId(currentCropsStr?: string): string | null {
  if (!currentCropsStr) return null;
  const lower = currentCropsStr.toLowerCase();
  for (const crop of CROPS) {
    if (lower.includes(crop.id) || lower.includes(crop.name.toLowerCase().split(' ')[0])) {
      return crop.id;
    }
  }
  return null;
}

export function FertilizerRecommendation({ onNavigate }: FertilizerRecommendationProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { weatherData } = useWeather();
  const resultsRef = useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState<CompleteFarmProfile>(() =>
    farmProfileService.getFarmProfile(user)
  );

  // Sync profile when storage changes
  useEffect(() => {
    setProfile(farmProfileService.getFarmProfile(user));
    const unsubscribe = farmProfileService.onProfileChange((updated) => {
      setProfile(updated);
    });
    return unsubscribe;
  }, [user]);

  // Determine initial values & source origins without fabricating missing data
  const matchedCropId = findMatchingCropId(profile.farm.currentCrops);

  // Helper to load previously analyzed fertilizer recommendation if present
  const getSavedFertRec = () => {
    return farmIntelligenceService.getStoredFertilizerRecommendation(user?.id);
  };

  const initialSaved = getSavedFertRec();

  // Form State
  const [selectedCropId, setSelectedCropId] = useState<string>(() => initialSaved?.cropId || matchedCropId || "");
  const [cropOrigin, setCropOrigin] = useState<FieldSource>(() => initialSaved?.cropId ? 'manual' : (matchedCropId ? 'profile' : 'manual'));

  const [landArea, setLandArea] = useState<string>(() =>
    initialSaved?.inputs?.area !== undefined && initialSaved?.inputs?.area !== null
      ? initialSaved.inputs.area.toString()
      : (profile.farm.farmSize && profile.farm.farmSize > 0 ? profile.farm.farmSize.toString() : "")
  );
  const [areaOrigin, setAreaOrigin] = useState<FieldSource>(() =>
    initialSaved?.inputs?.area !== undefined ? 'manual' : (profile.farm.farmSize && profile.farm.farmSize > 0 ? 'profile' : 'manual')
  );

  const [areaUnit, setAreaUnit] = useState<"acres" | "hectares">(() =>
    initialSaved?.inputs?.unit === "hectares" ? "hectares" : (profile.farm.farmSizeUnit === "Hectares" ? "hectares" : "acres")
  );

  // Soil & Nutrient State
  const [soilType, setSoilType] = useState<string>(() => initialSaved?.inputs?.soilType || profile.soil.soilType || "");
  const [soilTypeOrigin, setSoilTypeOrigin] = useState<FieldSource>(() =>
    initialSaved?.inputs?.soilType ? 'manual' : (profile.soil.soilType ? 'profile' : 'manual')
  );

  const [nitrogen, setNitrogen] = useState<string>(() =>
    initialSaved?.inputs?.nitrogen !== undefined && initialSaved?.inputs?.nitrogen !== null
      ? initialSaved.inputs.nitrogen.toString()
      : (profile.soil.nitrogen && profile.soil.nitrogen > 0 ? profile.soil.nitrogen.toString() : "")
  );
  const [nitrogenOrigin, setNitrogenOrigin] = useState<FieldSource>(() =>
    initialSaved?.inputs?.nitrogen !== undefined ? 'manual' : (profile.soil.nitrogen && profile.soil.nitrogen > 0 ? 'profile' : 'manual')
  );

  const [phosphorus, setPhosphorus] = useState<string>(() =>
    initialSaved?.inputs?.phosphorus !== undefined && initialSaved?.inputs?.phosphorus !== null
      ? initialSaved.inputs.phosphorus.toString()
      : (profile.soil.phosphorus && profile.soil.phosphorus > 0 ? profile.soil.phosphorus.toString() : "")
  );
  const [phosphorusOrigin, setPhosphorusOrigin] = useState<FieldSource>(() =>
    initialSaved?.inputs?.phosphorus !== undefined ? 'manual' : (profile.soil.phosphorus && profile.soil.phosphorus > 0 ? 'profile' : 'manual')
  );

  const [potassium, setPotassium] = useState<string>(() =>
    initialSaved?.inputs?.potassium !== undefined && initialSaved?.inputs?.potassium !== null
      ? initialSaved.inputs.potassium.toString()
      : (profile.soil.potassium && profile.soil.potassium > 0 ? profile.soil.potassium.toString() : "")
  );
  const [potassiumOrigin, setPotassiumOrigin] = useState<FieldSource>(() =>
    initialSaved?.inputs?.potassium !== undefined ? 'manual' : (profile.soil.potassium && profile.soil.potassium > 0 ? 'profile' : 'manual')
  );

  const [ph, setPh] = useState<string>(() =>
    initialSaved?.inputs?.ph !== undefined && initialSaved?.inputs?.ph !== null
      ? initialSaved.inputs.ph.toString()
      : (profile.soil.ph && profile.soil.ph > 0 ? profile.soil.ph.toString() : "")
  );
  const [phOrigin, setPhOrigin] = useState<FieldSource>(() =>
    initialSaved?.inputs?.ph !== undefined ? 'manual' : (profile.soil.ph && profile.soil.ph > 0 ? 'profile' : 'manual')
  );

  // Environmental State
  const [temperature, setTemperature] = useState<string>(() => {
    if (initialSaved?.inputs?.temperature !== undefined && initialSaved?.inputs?.temperature !== null) {
      return initialSaved.inputs.temperature.toString();
    }
    if (weatherData?.main?.temp) return Math.round(weatherData.main.temp).toString();
    if (profile.conditions.temperature && profile.conditions.temperature > 0) return profile.conditions.temperature.toString();
    return "";
  });
  const [tempOrigin, setTempOrigin] = useState<FieldSource>(() => {
    if (initialSaved?.inputs?.temperature !== undefined) return 'manual';
    if (weatherData?.main?.temp) return 'weather';
    if (profile.conditions.temperature && profile.conditions.temperature > 0) return 'profile';
    return 'manual';
  });

  const [humidity, setHumidity] = useState<string>(() => {
    if (initialSaved?.inputs?.humidity !== undefined && initialSaved?.inputs?.humidity !== null) {
      return initialSaved.inputs.humidity.toString();
    }
    if (weatherData?.main?.humidity) return weatherData.main.humidity.toString();
    if (profile.conditions.humidity && profile.conditions.humidity > 0) return profile.conditions.humidity.toString();
    return "";
  });
  const [humidityOrigin, setHumidityOrigin] = useState<FieldSource>(() => {
    if (initialSaved?.inputs?.humidity !== undefined) return 'manual';
    if (weatherData?.main?.humidity) return 'weather';
    if (profile.conditions.humidity && profile.conditions.humidity > 0) return 'profile';
    return 'manual';
  });

  const [rainfall, setRainfall] = useState<string>(() =>
    initialSaved?.inputs?.rainfall !== undefined && initialSaved?.inputs?.rainfall !== null
      ? initialSaved.inputs.rainfall.toString()
      : (profile.conditions.rainfall && profile.conditions.rainfall > 0 ? profile.conditions.rainfall.toString() : "")
  );
  const [rainfallOrigin, setRainfallOrigin] = useState<FieldSource>(() =>
    initialSaved?.inputs?.rainfall !== undefined ? 'manual' : (profile.conditions.rainfall && profile.conditions.rainfall > 0 ? 'profile' : 'manual')
  );

  // Update weather if not manually overridden
  useEffect(() => {
    if (weatherData && !getSavedFertRec()) {
      if (tempOrigin !== 'manual') {
        setTemperature(Math.round(weatherData.main.temp).toString());
        setTempOrigin('weather');
      }
      if (humidityOrigin !== 'manual') {
        setHumidity(weatherData.main.humidity.toString());
        setHumidityOrigin('weather');
      }
    }
  }, [weatherData]);

  // Execution & Results State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [hasResults, setHasResults] = useState<boolean>(() => Boolean(initialSaved));
  const [error, setError] = useState<string | null>(null);

  // Submitted snapshot for input transparency
  const [submittedSnapshot, setSubmittedSnapshot] = useState<{
    cropName: string;
    cropId: string;
    area: number;
    unit: string;
    soilType: string;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    ph: number;
    temperature: number | null;
    humidity: number | null;
    rainfall: number | null;
  } | null>(() => {
    if (initialSaved?.inputs && initialSaved?.cropId) {
      return {
        cropName: initialSaved.cropName || initialSaved.inputs.cropName || 'Crop',
        cropId: initialSaved.cropId,
        area: initialSaved.inputs.area || 1,
        unit: initialSaved.inputs.unit || 'acres',
        soilType: initialSaved.inputs.soilType || 'Standard Agricultural Soil',
        nitrogen: initialSaved.inputs.nitrogen || 0,
        phosphorus: initialSaved.inputs.phosphorus || 0,
        potassium: initialSaved.inputs.potassium || 0,
        ph: initialSaved.inputs.ph || 6.5,
        temperature: initialSaved.inputs.temperature ?? null,
        humidity: initialSaved.inputs.humidity ?? null,
        rainfall: initialSaved.inputs.rainfall ?? null,
      };
    }
    return null;
  });

  const navigateToProfile = () => {
    if (onNavigate) {
      onNavigate("profile");
    } else {
      navigate("/profile");
    }
  };

  const handleReset = () => {
    const prof = farmProfileService.getFarmProfile(user);
    const mCrop = findMatchingCropId(prof.farm.currentCrops);
    setSelectedCropId(mCrop || "");
    setCropOrigin(mCrop ? 'profile' : 'manual');

    setLandArea(prof.farm.farmSize ? prof.farm.farmSize.toString() : "");
    setAreaOrigin(prof.farm.farmSize ? 'profile' : 'manual');
    setAreaUnit(prof.farm.farmSizeUnit === "Hectares" ? "hectares" : "acres");

    setSoilType(prof.soil.soilType || "");
    setSoilTypeOrigin(prof.soil.soilType ? 'profile' : 'manual');

    setNitrogen(prof.soil.nitrogen ? prof.soil.nitrogen.toString() : "");
    setNitrogenOrigin(prof.soil.nitrogen ? 'profile' : 'manual');

    setPhosphorus(prof.soil.phosphorus ? prof.soil.phosphorus.toString() : "");
    setPhosphorusOrigin(prof.soil.phosphorus ? 'profile' : 'manual');

    setPotassium(prof.soil.potassium ? prof.soil.potassium.toString() : "");
    setPotassiumOrigin(prof.soil.potassium ? 'profile' : 'manual');

    setPh(prof.soil.ph ? prof.soil.ph.toString() : "");
    setPhOrigin(prof.soil.ph ? 'profile' : 'manual');

    if (weatherData?.main?.temp) {
      setTemperature(Math.round(weatherData.main.temp).toString());
      setTempOrigin('weather');
    } else {
      setTemperature(prof.conditions.temperature ? prof.conditions.temperature.toString() : "");
      setTempOrigin(prof.conditions.temperature ? 'profile' : 'manual');
    }

    if (weatherData?.main?.humidity) {
      setHumidity(weatherData.main.humidity.toString());
      setHumidityOrigin('weather');
    } else {
      setHumidity(prof.conditions.humidity ? prof.conditions.humidity.toString() : "");
      setHumidityOrigin(prof.conditions.humidity ? 'profile' : 'manual');
    }

    setRainfall(prof.conditions.rainfall ? prof.conditions.rainfall.toString() : "");
    setRainfallOrigin(prof.conditions.rainfall ? 'profile' : 'manual');

    setSubmittedSnapshot(null);
    setHasResults(false);
    setError(null);
  };

  const handleGetRecommendation = async () => {
    setError(null);

    // Validation
    if (!selectedCropId) {
      setError("Please select a target crop before requesting recommendations.");
      return;
    }

    const areaNum = parseFloat(landArea);
    if (isNaN(areaNum) || areaNum <= 0) {
      setError("Please enter a valid cultivation area (greater than 0).");
      return;
    }

    const nNum = parseFloat(nitrogen) || 0;
    const pNum = parseFloat(phosphorus) || 0;
    const kNum = parseFloat(potassium) || 0;
    const phNum = parseFloat(ph) || 6.5;

    if (nNum < 0 || pNum < 0 || kNum < 0) {
      setError("Nutrient values (N, P, K) cannot be negative.");
      return;
    }

    if (ph.trim() !== "" && (phNum < 0 || phNum > 14)) {
      setError("Soil pH must be a valid number between 0 and 14.");
      return;
    }

    setIsAnalyzing(true);

    try {
      // Simulate asynchronous analysis while preserving the existing calculation model
      await new Promise((resolve) => setTimeout(resolve, 450));

      const matchedCrop = CROPS.find((c) => c.id === selectedCropId);
      if (!matchedCrop || !FERTILIZERS[selectedCropId]) {
        throw new Error(`Fertilizer formulations not found for selected crop (${selectedCropId}).`);
      }

      setSubmittedSnapshot({
        cropName: matchedCrop.name,
        cropId: selectedCropId,
        area: areaNum,
        unit: areaUnit,
        soilType: soilType || "Standard Agricultural Soil",
        nitrogen: nNum,
        phosphorus: pNum,
        potassium: kNum,
        ph: phNum,
        temperature: temperature ? parseFloat(temperature) : null,
        humidity: humidity ? parseFloat(humidity) : null,
        rainfall: rainfall ? parseFloat(rainfall) : null,
      });

      setHasResults(true);

      const rawFerts = FERTILIZERS[selectedCropId] || [];
      const areaInHa = areaUnit === "acres" ? areaNum / 2.471 : areaNum;
      const enrichedFerts = rawFerts.map((f) => {
        const match = f.dosage.match(/(\d+)(?:[–-](\d+))?\s*(kg\/ha|g\/L|kg\/tree)/);
        let totalKg: number | null = null;
        if (match && match[3] === 'kg/ha') {
          const min = parseFloat(match[1]);
          const max = match[2] ? parseFloat(match[2]) : min;
          const avgPerHa = (min + max) / 2;
          totalKg = Math.round(avgPerHa * areaInHa);
        }
        return {
          name: f.name,
          dosage: f.dosage,
          quantity: totalKg,
          unit: 'kg',
          applicationTime: f.applicationTime,
          nutrients: f.nutrients,
        };
      });

      try {
        const targetFarmerId = user?.id || getActiveFarmerId();
        const toPersist = {
          cropName: matchedCrop.name,
          cropId: selectedCropId,
          fertilizers: enrichedFerts,
          inputs: {
            cropName: matchedCrop.name,
            area: areaNum,
            unit: areaUnit,
            soilType: soilType || "Standard Agricultural Soil",
            nitrogen: nNum,
            phosphorus: pNum,
            potassium: kNum,
            ph: phNum,
            temperature: temperature ? parseFloat(temperature) : null,
            humidity: humidity ? parseFloat(humidity) : null,
            rainfall: rainfall ? parseFloat(rainfall) : null,
          },
          analyzedAt: new Date().toISOString(),
          farmer_id: targetFarmerId,
        };

        localStorage.setItem(FERT_REC_KEY, JSON.stringify(toPersist));
        if (targetFarmerId && targetFarmerId !== 'farmer_main') {
          localStorage.setItem(getFarmerFertRecKey(targetFarmerId), JSON.stringify(toPersist));
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('fieldwise:intelligence_updated'));
        }
      } catch (e) {
        console.warn('Could not persist fertilizer recommendation:', e);
      }

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: any) {
      console.error("Fertilizer recommendation failed:", err);
      setError("We couldn't generate a recommendation right now. Please check your inputs and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Calculations for results
  const currentCropObj = CROPS.find((c) => c.id === (submittedSnapshot?.cropId || selectedCropId)) || CROPS[0];
  const activeCropFertilizers: FertilizerRec[] = FERTILIZERS[submittedSnapshot?.cropId || selectedCropId] || [];

  const areaInHectares = submittedSnapshot
    ? submittedSnapshot.unit === "acres"
      ? submittedSnapshot.area / 2.471
      : submittedSnapshot.area
    : (parseFloat(landArea) || 1) / (areaUnit === "acres" ? 2.471 : 1);

  // Parse dosage string (e.g., "130–150 kg/ha" -> avg 140 kg/ha)
  const calculateTotalQuantity = (dosageStr: string) => {
    const match = dosageStr.match(/(\d+)(?:[–-](\d+))?\s*(kg\/ha|g\/L|kg\/tree)/);
    if (!match) return { raw: dosageStr, totalKg: null, bags: null, perUnit: dosageStr };

    const min = parseFloat(match[1]);
    const max = match[2] ? parseFloat(match[2]) : min;
    const avgPerHa = (min + max) / 2;
    const unit = match[3];

    if (unit === "kg/ha") {
      const totalKg = Math.round(avgPerHa * areaInHectares);
      const bags = Math.ceil(totalKg / 45); // standard 45kg bag
      return { raw: dosageStr, totalKg, bags, perUnit: `${min}–${max} kg/ha` };
    }

    return { raw: dosageStr, totalKg: null, bags: null, perUnit: dosageStr };
  };

  // Soil adjustment notes derived from inputs
  const soilNitrogenVal = submittedSnapshot ? submittedSnapshot.nitrogen : parseFloat(nitrogen) || 0;
  const soilPhosphorusVal = submittedSnapshot ? submittedSnapshot.phosphorus : parseFloat(phosphorus) || 0;
  const soilPotassiumVal = submittedSnapshot ? submittedSnapshot.potassium : parseFloat(potassium) || 0;

  const nRating = getNpkRating(soilNitrogenVal, 'N');
  const pRating = getNpkRating(soilPhosphorusVal, 'P');
  const kRating = getNpkRating(soilPotassiumVal, 'K');

  const getSoilAdjustmentNotes = () => {
    const notes: string[] = [];
    if (nRating === "low") {
      notes.push("Soil Nitrogen is Low: Increase basal Nitrogen dosage by 15–20% for vigorous early vegetative growth.");
    } else if (nRating === "high") {
      notes.push("Soil Nitrogen is High: Reduce Urea application by 15% to prevent excessive vegetative growth and lodging.");
    } else {
      notes.push("Soil Nitrogen is Medium/Optimal: Standard basal and split Nitrogen application recommended.");
    }

    if (pRating === "low") {
      notes.push("Soil Phosphorus is Low: Apply recommended DAP/SSP completely at basal time with deep root placement.");
    } else if (pRating === "high") {
      notes.push("Soil Phosphorus is High: Phosphorus reserves adequate; standard maintenance basal dose suffices.");
    }

    if (kRating === "low") {
      notes.push("Soil Potassium is Low: Apply MOP in splits to enhance drought resilience and grain weight.");
    }

    return notes;
  };

  const renderSourceBadge = (source: FieldSource) => {
    if (source === 'weather') {
      return (
        <span className="inline-flex items-center text-[10px] font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800">
          From Weather
        </span>
      );
    }
    if (source === 'profile') {
      return (
        <span className="inline-flex items-center text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
          From My Farm
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[10px] font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
        Enter manually
      </span>
    );
  };

  const isProfileIncomplete =
    !profile.farmer.state ||
    !profile.farm.farmSize ||
    !profile.farm.currentCrops ||
    !profile.soil.soilType;

  const locationDisplay = profile.farmer.district
    ? `${profile.farmer.district}, ${profile.farmer.state}`
    : profile.farmer.state || user?.location;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* ── 1. PAGE HEADER ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <FlaskConical className="h-3.5 w-3.5" />
            <span>AI-Assisted Fertilizer Advisory</span>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
            • Nutrient Scheduling &amp; Bag Calculator
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Fertilizer Recommendation
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-3xl leading-relaxed">
          Get an AI-assisted fertilizer recommendation based on your crop and available farm conditions.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Recommended based on the available farm conditions. Consider soil testing and local agricultural guidance before applying fertilizer.
        </p>
      </div>

      {/* ── 2. FARM CONTEXT ── */}
      <Card className="border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <CardHeader className="bg-gray-50/60 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Tractor className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Farm Context
              </CardTitle>
              {profile.farm.farmName && (
                <Badge variant="outline" className="text-xs font-normal text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700">
                  {profile.farm.farmName}
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={navigateToProfile}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium self-start sm:self-auto"
            >
              <span>Update My Farm</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Location */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                <MapPin className="h-3 w-3 text-emerald-600" />
                <span>Location</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                {locationDisplay || "Not available"}
              </div>
            </div>

            {/* Current crop */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                <Sprout className="h-3 w-3 text-green-600" />
                <span>Current crop</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                {profile.farm.currentCrops || "Not available"}
              </div>
            </div>

            {/* Farm size */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                <Layers className="h-3 w-3 text-amber-600" />
                <span>Farm size</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                {profile.farm.farmSize ? `${profile.farm.farmSize} ${profile.farm.farmSizeUnit}` : "Not available"}
              </div>
            </div>

            {/* Soil type */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                <FlaskConical className="h-3 w-3 text-teal-600" />
                <span>Soil type</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                {profile.soil.soilType ? `${profile.soil.soilType} Soil` : "Not available"}
              </div>
            </div>

            {/* Irrigation type */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 col-span-2 sm:col-span-1">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                <Droplets className="h-3 w-3 text-sky-600" />
                <span>Irrigation</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                {profile.farm.irrigationType || "Not available"}
              </div>
            </div>
          </div>

          {/* Missing profile banner */}
          {isProfileIncomplete && (
            <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Complete your farm profile for more relevant recommendations.</span>
              </div>
              <Button
                variant="link"
                size="sm"
                onClick={navigateToProfile}
                className="text-amber-900 dark:text-amber-200 font-semibold p-0 h-auto self-start sm:self-auto"
              >
                Update My Farm →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. INPUT SECTION ── */}
      <Card className="border border-gray-200 dark:border-gray-800 shadow-sm">
        <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
                Model Inputs
              </div>
              <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
                Fertilizer &amp; Plot Parameters
              </CardTitle>
              <CardDescription className="text-xs">
                Provide your target crop and soil parameters to calibrate precise nutrient schedules and bag requirements.
              </CardDescription>
            </div>

            {/* Source Origin Legend */}
            <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span> From My Farm
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500"></span> From Weather
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-gray-400"></span> Enter manually
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-6">
          {/* GROUP A: CROP INFORMATION */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Sprout className="h-3.5 w-3.5 text-emerald-600" />
              Crop Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Target Crop Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cropSelect" className="text-xs font-medium">
                    Target Crop <span className="text-red-500">*</span>
                  </Label>
                  {renderSourceBadge(cropOrigin)}
                </div>
                <Select
                  value={selectedCropId}
                  onValueChange={(val) => {
                    setSelectedCropId(val);
                    setCropOrigin('manual');
                  }}
                >
                  <SelectTrigger id="cropSelect" className="h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Not available — enter manually" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {Object.keys(FERTILIZERS).map((cropKey) => {
                      const cObj = CROPS.find((c) => c.id === cropKey);
                      return (
                        <SelectItem key={cropKey} value={cropKey}>
                          {cObj?.icon || "🌱"} {cObj?.name || cropKey.toUpperCase()}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Cultivation Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="landArea" className="text-xs font-medium">
                    Cultivation Plot Area <span className="text-red-500">*</span>
                  </Label>
                  {renderSourceBadge(areaOrigin)}
                </div>
                <div className="flex gap-2">
                  <Input
                    id="landArea"
                    type="number"
                    min={0.1}
                    step={0.5}
                    placeholder="Not available — enter manually"
                    value={landArea}
                    onChange={(e) => {
                      setLandArea(e.target.value);
                      setAreaOrigin('manual');
                    }}
                    className="h-10 text-xs sm:text-sm flex-1"
                  />
                  <Select
                    value={areaUnit}
                    onValueChange={(val: "acres" | "hectares") => setAreaUnit(val)}
                  >
                    <SelectTrigger className="w-28 h-10 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acres">Acres</SelectItem>
                      <SelectItem value="hectares">Hectares</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* GROUP B: SOIL / NUTRIENT INFORMATION */}
          <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5 text-teal-600" />
              Soil &amp; Nutrient Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Soil Type */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="soilType" className="text-xs font-medium">Soil Type</Label>
                  {renderSourceBadge(soilTypeOrigin)}
                </div>
                <Select
                  value={soilType}
                  onValueChange={(val) => {
                    setSoilType(val);
                    setSoilTypeOrigin('manual');
                  }}
                >
                  <SelectTrigger id="soilType" className="h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Not available — enter manually" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOIL_TYPES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st} Soil
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Nitrogen */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="nitrogen" className="text-xs font-medium">Nitrogen (N)</Label>
                  {renderSourceBadge(nitrogenOrigin)}
                </div>
                <div className="relative">
                  <Input
                    id="nitrogen"
                    type="number"
                    min={0}
                    max={300}
                    placeholder="e.g. 85"
                    value={nitrogen}
                    onChange={(e) => {
                      setNitrogen(e.target.value);
                      setNitrogenOrigin('manual');
                    }}
                    className="h-10 text-xs sm:text-sm pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">kg/ha</span>
                </div>
              </div>

              {/* Phosphorus */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="phosphorus" className="text-xs font-medium">Phosphorus (P)</Label>
                  {renderSourceBadge(phosphorusOrigin)}
                </div>
                <div className="relative">
                  <Input
                    id="phosphorus"
                    type="number"
                    min={0}
                    max={200}
                    placeholder="e.g. 52"
                    value={phosphorus}
                    onChange={(e) => {
                      setPhosphorus(e.target.value);
                      setPhosphorusOrigin('manual');
                    }}
                    className="h-10 text-xs sm:text-sm pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">kg/ha</span>
                </div>
              </div>

              {/* Potassium */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="potassium" className="text-xs font-medium">Potassium (K)</Label>
                  {renderSourceBadge(potassiumOrigin)}
                </div>
                <div className="relative">
                  <Input
                    id="potassium"
                    type="number"
                    min={0}
                    max={200}
                    placeholder="e.g. 60"
                    value={potassium}
                    onChange={(e) => {
                      setPotassium(e.target.value);
                      setPotassiumOrigin('manual');
                    }}
                    className="h-10 text-xs sm:text-sm pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">kg/ha</span>
                </div>
              </div>

              {/* Soil pH */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ph" className="text-xs font-medium">Soil pH</Label>
                  {renderSourceBadge(phOrigin)}
                </div>
                <Input
                  id="ph"
                  type="number"
                  min={3.5}
                  max={9.5}
                  step={0.1}
                  placeholder="e.g. 6.8"
                  value={ph}
                  onChange={(e) => {
                    setPh(e.target.value);
                    setPhOrigin('manual');
                  }}
                  className="h-10 text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* GROUP C: ENVIRONMENTAL CONDITIONS */}
          <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <CloudRain className="h-3.5 w-3.5 text-sky-600" />
              Environmental Conditions
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Temperature */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temp" className="text-xs font-medium">Temperature</Label>
                  {renderSourceBadge(tempOrigin)}
                </div>
                <div className="relative">
                  <Input
                    id="temp"
                    type="number"
                    placeholder="Not available — enter manually"
                    value={temperature}
                    onChange={(e) => {
                      setTemperature(e.target.value);
                      setTempOrigin('manual');
                    }}
                    className="h-10 text-xs sm:text-sm pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">°C</span>
                </div>
              </div>

              {/* Humidity */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="hum" className="text-xs font-medium">Relative Humidity</Label>
                  {renderSourceBadge(humidityOrigin)}
                </div>
                <div className="relative">
                  <Input
                    id="hum"
                    type="number"
                    placeholder="Not available — enter manually"
                    value={humidity}
                    onChange={(e) => {
                      setHumidity(e.target.value);
                      setHumidityOrigin('manual');
                    }}
                    className="h-10 text-xs sm:text-sm pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">%</span>
                </div>
              </div>

              {/* Annual Rainfall / Moisture */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rain" className="text-xs font-medium">Annual Rainfall</Label>
                  {renderSourceBadge(rainfallOrigin)}
                </div>
                <div className="relative">
                  <Input
                    id="rain"
                    type="number"
                    placeholder="Not available — enter manually"
                    value={rainfall}
                    onChange={(e) => {
                      setRainfall(e.target.value);
                      setRainfallOrigin('manual');
                    }}
                    className="h-10 text-xs sm:text-sm pr-10"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">mm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isAnalyzing}
              className="w-full sm:w-auto text-xs flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>

            <Button
              type="button"
              onClick={handleGetRecommendation}
              disabled={isAnalyzing}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 shadow-sm flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing your farm conditions...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Get Fertilizer Recommendation
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 5 & 6. RESULTS SECTION ── */}
      <div ref={resultsRef}>
        {isAnalyzing && (
          <Card className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm p-8 text-center space-y-3">
            <Loader2 className="h-8 w-8 text-emerald-600 animate-spin mx-auto" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Analyzing your farm conditions...
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Evaluating crop nutrient requirements and calculating exact split dosages for your plot area.
            </p>
          </Card>
        )}

        {!isAnalyzing && hasResults && submittedSnapshot && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Results Title Banner */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Recommended Fertilizer
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Targeted nutrient management schedule for {currentCropObj.name} ({submittedSnapshot.area} {submittedSnapshot.unit} ≈ {areaInHectares.toFixed(2)} ha).
                </p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                Analysis Complete
              </Badge>
            </div>

            {/* Target Crop Summary Card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-3 shadow-xs">
                <span className="text-3xl p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800">
                  {currentCropObj.icon || "🌱"}
                </span>
                <div>
                  <div className="text-[11px] text-gray-400 uppercase font-medium">Selected Crop</div>
                  <div className="text-base font-bold text-gray-900 dark:text-white">{currentCropObj.name}</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Season: {currentCropObj.season}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-3 shadow-xs">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-100 dark:border-emerald-800">
                  <Scale className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[11px] text-gray-400 uppercase font-medium">Plot Area</div>
                  <div className="text-base font-bold text-gray-900 dark:text-white">
                    {submittedSnapshot.area} {submittedSnapshot.unit}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">≈ {areaInHectares.toFixed(2)} Hectares</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-3 shadow-xs">
                <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 border border-teal-100 dark:border-teal-800">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[11px] text-gray-400 uppercase font-medium">Formulation Regimes</div>
                  <div className="text-base font-bold text-gray-900 dark:text-white">
                    {activeCropFertilizers.length} Key Products
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">Calibrated split application</div>
                </div>
              </div>
            </div>

            {/* Recommended Formulations Cards */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4 text-emerald-600" />
                Prescribed Nutrient Formulations &amp; Dosages
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeCropFertilizers.map((item, index) => {
                  const calc = calculateTotalQuantity(item.dosage);
                  return (
                    <Card key={index} className="border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                      <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-bold flex items-center justify-center text-xs">
                              #{index + 1}
                            </div>
                            <div>
                              <CardTitle className="text-base text-gray-900 dark:text-white font-bold">
                                {item.name}
                              </CardTitle>
                              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                {item.nutrients}
                              </span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-800 dark:text-emerald-300">
                            {item.dosage}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 space-y-3">
                        {/* Application timing */}
                        <div>
                          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-emerald-600" />
                            Application Stage &amp; Timing
                          </p>
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700">
                            {item.applicationTime}
                          </p>
                        </div>

                        {/* Calculated Bag Requirement */}
                        {calc.bags !== null && (
                          <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-between">
                            <div>
                              <span className="text-[11px] text-emerald-900 dark:text-emerald-200 font-medium">Total Quantity for Plot</span>
                              <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                                ~{calc.totalKg} kg
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[11px] text-emerald-900 dark:text-emerald-200 font-medium">Standard Bags</span>
                              <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                                {calc.bags} bags (45 kg)
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Soil-Adjusted Agronomic Notes */}
            <Card className="border border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-emerald-600" />
                  Soil Health Calibration Notes
                </CardTitle>
                <CardDescription className="text-xs">
                  Dosage adjustments based on your soil NPK status: Nitrogen ({nRating}), Phosphorus ({pRating}), Potassium ({kRating}).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {getSoilAdjustmentNotes().map((note, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* ── 7. INPUT TRANSPARENCY ── */}
            <Card className="border border-gray-200 dark:border-gray-800 shadow-sm bg-gray-50/50 dark:bg-gray-900/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-sm font-bold text-gray-900 dark:text-white">
                    Recommendation based on
                  </CardTitle>
                </div>
                <CardDescription className="text-xs">
                  This recommendation is based on the conditions provided to the existing prediction model:
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div className="text-[10px] text-gray-400 uppercase">Target Crop</div>
                    <div className="font-bold text-gray-900 dark:text-white truncate">{submittedSnapshot.cropName}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div className="text-[10px] text-gray-400 uppercase">Cultivation Area</div>
                    <div className="font-bold text-gray-900 dark:text-white">{submittedSnapshot.area} {submittedSnapshot.unit}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div className="text-[10px] text-gray-400 uppercase">Soil Type</div>
                    <div className="font-bold text-gray-900 dark:text-white truncate">{submittedSnapshot.soilType}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div className="text-[10px] text-gray-400 uppercase">Nitrogen (N)</div>
                    <div className="font-bold text-gray-900 dark:text-white">{submittedSnapshot.nitrogen} kg/ha ({nRating})</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div className="text-[10px] text-gray-400 uppercase">Phosphorus (P)</div>
                    <div className="font-bold text-gray-900 dark:text-white">{submittedSnapshot.phosphorus} kg/ha ({pRating})</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div className="text-[10px] text-gray-400 uppercase">Potassium (K)</div>
                    <div className="font-bold text-gray-900 dark:text-white">{submittedSnapshot.potassium} kg/ha ({kRating})</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div className="text-[10px] text-gray-400 uppercase">Soil pH</div>
                    <div className="font-bold text-gray-900 dark:text-white">{submittedSnapshot.ph}</div>
                  </div>
                  {submittedSnapshot.temperature !== null && (
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <div className="text-[10px] text-gray-400 uppercase">Temperature</div>
                      <div className="font-bold text-gray-900 dark:text-white">{submittedSnapshot.temperature}°C</div>
                    </div>
                  )}
                  {submittedSnapshot.humidity !== null && (
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <div className="text-[10px] text-gray-400 uppercase">Humidity</div>
                      <div className="font-bold text-gray-900 dark:text-white">{submittedSnapshot.humidity}%</div>
                    </div>
                  )}
                  {submittedSnapshot.rainfall !== null && (
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <div className="text-[10px] text-gray-400 uppercase">Annual Rainfall</div>
                      <div className="font-bold text-gray-900 dark:text-white">{submittedSnapshot.rainfall} mm</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── 8. EXPLANATION & AGRICULTURAL NOTICE ── */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2.5 leading-relaxed">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <strong className="text-gray-700 dark:text-gray-300">Agricultural Guidance: </strong>
                This recommendation is based on the conditions provided to the existing prediction model. Consider soil testing and local agricultural guidance before applying fertilizer. Split applications should be synchronized with irrigation or expected rain events.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FertilizerRecommendation;
