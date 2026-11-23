import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useWeather } from "@/components/dashboard/WeatherContext";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { predictApi, V2ApiError } from "@/lib/api";
import { CropPredictionResult, CROPS, FERTILIZERS, CropData } from "@/lib/predictorEngine";
import { savePredictionToSupabase, fetchLatestPredictionFromSupabase, getActiveFarmerId } from "@/lib/supabase";
import { PredictionFormV2 } from "../v2/PredictionFormV2";
import { PredictionResultsV2 } from "../v2/PredictionResultsV2";
import { V2PredictRequest, V2PredictResponse } from "@/types/v2Prediction";
import {
  farmProfileService,
  CompleteFarmProfile,
} from "@/services/farmProfileService";
import {
  farmIntelligenceService,
  getFarmerCropRecKey,
  CROP_REC_KEY,
} from "@/services/farmIntelligenceService";
import {
  Sprout,
  MapPin,
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
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Compass,
  Tractor,
  Loader2,
  Calendar,
  Scale,
  Award,
} from "lucide-react";

interface CropRecommendationProps {
  onNavigate?: (module: string) => void;
}

interface ModelInputs {
  rainfall: number;
  temperature: number;
  humidity: number;
  soilType: string;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  state: string;
}

type FieldSource = 'profile' | 'weather' | 'manual';

const SOIL_TYPES = [
  'Loamy', 'Alluvial', 'Black', 'Red', 'Laterite', 'Clay', 'Sandy Loam', 'Clay Loam'
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Bihar', 'Gujarat', 'Haryana', 'Karnataka',
  'Madhya Pradesh', 'Maharashtra', 'Punjab', 'Rajasthan',
  'Tamil Nadu', 'Uttar Pradesh', 'West Bengal',
];

function findCrop(cropInput: any): CropData {
  if (typeof cropInput === 'object' && cropInput !== null && Array.isArray(cropInput.soilTypes)) {
    return {
      id: cropInput.id || 'crop_custom',
      name: cropInput.name || 'Recommended Crop',
      season: cropInput.season || 'All Season',
      minRainfall: cropInput.minRainfall ?? 100,
      maxRainfall: cropInput.maxRainfall ?? 200,
      minTemperature: cropInput.minTemperature ?? 18,
      maxTemperature: cropInput.maxTemperature ?? 30,
      minHumidity: cropInput.minHumidity ?? 50,
      maxHumidity: cropInput.maxHumidity ?? 80,
      soilTypes: Array.isArray(cropInput.soilTypes) ? cropInput.soilTypes : ['Loamy', 'Alluvial', 'Clay Loam'],
      nitrogenRange: Array.isArray(cropInput.nitrogenRange) ? cropInput.nitrogenRange : [60, 100],
      phosphorusRange: Array.isArray(cropInput.phosphorusRange) ? cropInput.phosphorusRange : [40, 60],
      potassiumRange: Array.isArray(cropInput.potassiumRange) ? cropInput.potassiumRange : [40, 60],
      phRange: Array.isArray(cropInput.phRange) ? cropInput.phRange : [6.0, 7.5],
      yieldPerHectare: cropInput.yieldPerHectare ?? 3.5,
      icon: cropInput.icon || '🌱',
      description: cropInput.description || '',
    };
  }

  const rawName = typeof cropInput === 'string'
    ? cropInput
    : (cropInput?.name || cropInput?.id || cropInput?.cropName || 'Wheat');

  const normalized = String(rawName).toLowerCase().trim();

  const found = CROPS.find(c => {
    const cId = c.id.toLowerCase();
    const cName = c.name.toLowerCase();
    const cBaseName = cName.split(/[\s(]/)[0];
    return (
      cId === normalized ||
      cName === normalized ||
      normalized.includes(cId) ||
      normalized.includes(cBaseName) ||
      cName.includes(normalized)
    );
  });

  if (found) {
    return found;
  }

  return {
    id: 'crop_custom',
    name: String(rawName || 'Recommended Crop'),
    season: 'All Season',
    minRainfall: 80,
    maxRainfall: 160,
    minTemperature: 18,
    maxTemperature: 30,
    minHumidity: 50,
    maxHumidity: 80,
    soilTypes: ['Loamy', 'Alluvial', 'Black', 'Sandy Loam', 'Clay Loam'],
    nitrogenRange: [60, 100],
    phosphorusRange: [40, 60],
    potassiumRange: [40, 60],
    phRange: [6.0, 7.5],
    yieldPerHectare: 3.5,
    icon: '🌱',
    description: `Optimal agronomic thresholds for ${rawName}.`,
  };
}

function normalizePrediction(raw: any): CropPredictionResult {
  const crop = findCrop(raw?.crop || raw?.name || raw?.cropName);
  const rawConf = raw?.confidence;
  const numConf = typeof rawConf === 'number'
    ? rawConf
    : (Number(String(rawConf || '95').replace(/[^0-9.]/g, '')) || 95);

  return {
    crop,
    confidence: Math.round(numConf * 10) / 10,
    yieldPrediction: raw?.yieldPrediction || crop.yieldPerHectare,
    scoreBreakdown: raw?.scoreBreakdown || {
      rainfall: 20,
      temperature: 20,
      humidity: 15,
      soil: 20,
      nitrogen: 8,
      phosphorus: 6,
      potassium: 6,
      phBonus: 5,
    },
    fertilizers: Array.isArray(raw?.fertilizers) && raw.fertilizers.length > 0
      ? raw.fertilizers
      : (FERTILIZERS[crop.id] || []),
  };
}

export const CropRecommendation = ({ onNavigate }: CropRecommendationProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { weatherData, loading: weatherLoading } = useWeather();
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

  // Restore latest prediction from Supabase if not in localStorage on login
  useEffect(() => {
    if (!user || !user.id || user.id === 'farmer_main') return;
    const existing = getSavedCropRec();
    if (!existing) {
      const initiatingId = user.id;
      const activeAtStart = getActiveFarmerId();
      const isIdentityStale = (): boolean => {
        const current = getActiveFarmerId();
        if (activeAtStart !== 'farmer_main' && current !== activeAtStart) return true;
        if (current !== 'farmer_main' && current !== initiatingId) return true;
        return false;
      };

      fetchLatestPredictionFromSupabase(initiatingId).then((savedDbPred) => {
        if (isIdentityStale()) return;

        if (savedDbPred && savedDbPred.recommended_crop) {
          const restoredPred: CropPredictionResult = normalizePrediction({
            crop: savedDbPred.recommended_crop,
            confidence: savedDbPred.confidence || '95%',
          });
          const restoredInputs: ModelInputs = {
            rainfall: savedDbPred.rainfall !== null && savedDbPred.rainfall !== undefined ? savedDbPred.rainfall : 150,
            temperature: savedDbPred.temperature !== null && savedDbPred.temperature !== undefined ? savedDbPred.temperature : 25,
            humidity: savedDbPred.humidity !== null && savedDbPred.humidity !== undefined ? savedDbPred.humidity : 65,
            soilType: profile.soil?.soilType || 'Loamy',
            nitrogen: savedDbPred.nitrogen !== null && savedDbPred.nitrogen !== undefined ? savedDbPred.nitrogen : 80,
            phosphorus: savedDbPred.phosphorus !== null && savedDbPred.phosphorus !== undefined ? savedDbPred.phosphorus : 50,
            potassium: savedDbPred.potassium !== null && savedDbPred.potassium !== undefined ? savedDbPred.potassium : 50,
            ph: savedDbPred.ph !== null && savedDbPred.ph !== undefined ? savedDbPred.ph : 6.5,
            state: profile.farmer?.state || 'Punjab',
          };

          if (isIdentityStale()) return;

          setPredictionResults([restoredPred]);
          setSubmittedInputs(restoredInputs);
          setInputs(restoredInputs);

          try {
            const toPersist = {
              predictions: [restoredPred],
              inputs: restoredInputs,
              topCrop: savedDbPred.recommended_crop,
              cropName: savedDbPred.recommended_crop,
              confidence: savedDbPred.confidence || '95%',
              suitabilityScore: savedDbPred.confidence || '95%',
              analyzedAt: savedDbPred.created_at || new Date().toISOString(),
              farmer_id: initiatingId,
            };
            if (isIdentityStale()) return;

            localStorage.setItem(CROP_REC_KEY, JSON.stringify(toPersist));
            if (initiatingId && initiatingId !== 'farmer_main') {
              localStorage.setItem(getFarmerCropRecKey(initiatingId), JSON.stringify(toPersist));
            }
          } catch {}

          if (!isIdentityStale() && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('fieldwise:intelligence_updated'));
          }
        }
      }).catch((e) => console.warn('[CropRecommendation] Prediction restoration notice:', e));
    }
  }, [user?.id]);

  // Helper to retrieve previously analyzed crop recommendation if present
  const getSavedCropRec = () => {
    return farmIntelligenceService.getStoredCropRecommendation(user?.id);
  };

  // Model Inputs State
  const [inputs, setInputs] = useState<ModelInputs>(() => {
    const saved = getSavedCropRec();
    if (saved?.inputs) {
      return saved.inputs;
    }
    const prof = farmProfileService.getFarmProfile(user);
    return {
      rainfall: prof.conditions.rainfall || 150,
      temperature: weatherData ? Math.round(weatherData.main.temp) : (prof.conditions.temperature || 25),
      humidity: weatherData ? weatherData.main.humidity : (prof.conditions.humidity || 65),
      soilType: prof.soil.soilType || 'Loamy',
      nitrogen: prof.soil.nitrogen || 80,
      phosphorus: prof.soil.phosphorus || 50,
      potassium: prof.soil.potassium || 50,
      ph: prof.soil.ph || 6.5,
      state: INDIAN_STATES.includes(prof.farmer.state) ? prof.farmer.state : 'Punjab',
    };
  });

  // Track the source origin of each field for UI transparency badges
  const [origins, setOrigins] = useState<Record<keyof ModelInputs, FieldSource>>(() => {
    const saved = getSavedCropRec();
    if (saved?.inputs) {
      return {
        rainfall: 'manual',
        temperature: 'manual',
        humidity: 'manual',
        soilType: 'manual',
        nitrogen: 'manual',
        phosphorus: 'manual',
        potassium: 'manual',
        ph: 'manual',
        state: 'manual',
      };
    }
    return {
      rainfall: 'profile',
      temperature: weatherData ? 'weather' : 'profile',
      humidity: weatherData ? 'weather' : 'profile',
      soilType: 'profile',
      nitrogen: 'profile',
      phosphorus: 'profile',
      potassium: 'profile',
      ph: 'profile',
      state: 'profile',
    };
  });

  // Update weather inputs when weatherData loads if user hasn't edited manually
  useEffect(() => {
    if (weatherData && !getSavedCropRec()) {
      setInputs((prev) => ({
        ...prev,
        temperature: origins.temperature === 'manual' ? prev.temperature : Math.round(weatherData.main.temp),
        humidity: origins.humidity === 'manual' ? prev.humidity : weatherData.main.humidity,
      }));
      setOrigins((prev) => ({
        ...prev,
        temperature: prev.temperature === 'manual' ? 'manual' : 'weather',
        humidity: prev.humidity === 'manual' ? 'manual' : 'weather',
      }));
    }
  }, [weatherData]);

  // Prediction State (persisted across tab switches)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [predictionResults, setPredictionResults] = useState<CropPredictionResult[] | null>(() => {
    const saved = getSavedCropRec();
    if (saved && Array.isArray(saved.predictions) && saved.predictions.length > 0) {
      return saved.predictions.map(normalizePrediction);
    }
    return null;
  });
  const [submittedInputs, setSubmittedInputs] = useState<ModelInputs | null>(() => {
    const saved = getSavedCropRec();
    return saved?.inputs || null;
  });
  const [error, setError] = useState<string | null>(null);
  const [showAlternatives, setShowAlternatives] = useState<boolean>(false);

  // ── Engine V2 State (Phase 3C.6.3) ──
  const [engineVersion, setEngineVersion] = useState<'v2' | 'v1'>('v2');
  const [v2Response, setV2Response] = useState<V2PredictResponse | null>(null);
  const [v2Error, setV2Error] = useState<V2ApiError | Error | null>(null);
  const [isAnalyzingV2, setIsAnalyzingV2] = useState<boolean>(false);
  const [v2LastPayload, setV2LastPayload] = useState<V2PredictRequest | null>(null);
  const v2ResultsRef = useRef<HTMLDivElement>(null);

  const handleAnalyzeV2 = async (payload: V2PredictRequest) => {
    setV2Error(null);
    setIsAnalyzingV2(true);
    setV2LastPayload(payload);
    try {
      const res = await predictApi.predictV2(payload);
      setV2Response(res);
      setTimeout(() => {
        v2ResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err: any) {
      console.error('V2 Prediction error:', err);
      setV2Error(err);
      setTimeout(() => {
        v2ResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } finally {
      setIsAnalyzingV2(false);
    }
  };

  const handleInputChange = (field: keyof ModelInputs, value: any) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
    setOrigins((prev) => ({ ...prev, [field]: 'manual' }));
  };

  const handleReset = () => {
    setPredictionResults(null);
    setSubmittedInputs(null);
    const prof = farmProfileService.getFarmProfile(user);
    setInputs({
      rainfall: prof.conditions.rainfall || 150,
      temperature: weatherData ? Math.round(weatherData.main.temp) : (prof.conditions.temperature || 25),
      humidity: weatherData ? weatherData.main.humidity : (prof.conditions.humidity || 65),
      soilType: prof.soil.soilType || 'Loamy',
      nitrogen: prof.soil.nitrogen || 80,
      phosphorus: prof.soil.phosphorus || 50,
      potassium: prof.soil.potassium || 50,
      ph: prof.soil.ph || 6.5,
      state: INDIAN_STATES.includes(prof.farmer.state) ? prof.farmer.state : 'Punjab',
    });
    setOrigins({
      rainfall: 'profile',
      temperature: weatherData ? 'weather' : 'profile',
      humidity: weatherData ? 'weather' : 'profile',
      soilType: 'profile',
      nitrogen: 'profile',
      phosphorus: 'profile',
      potassium: 'profile',
      ph: 'profile',
      state: 'profile',
    });
    setError(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fieldwise:intelligence_updated'));
    }
  };

  const handleAnalyze = async () => {
    setError(null);

    // Client-side input validation
    if (inputs.rainfall < 0 || inputs.rainfall > 1000 || isNaN(inputs.rainfall)) {
      setError("Rainfall must be a valid number between 0 and 1000 mm.");
      return;
    }
    if (inputs.temperature < 0 || inputs.temperature > 50 || isNaN(inputs.temperature)) {
      setError("Temperature must be a valid number between 0 and 50°C.");
      return;
    }
    if (inputs.humidity < 0 || inputs.humidity > 100 || isNaN(inputs.humidity)) {
      setError("Humidity must be a valid number between 0 and 100%.");
      return;
    }
    if (!inputs.soilType?.trim()) {
      setError("Soil type is required.");
      return;
    }
    if (inputs.nitrogen < 0 || inputs.nitrogen > 300 || isNaN(inputs.nitrogen)) {
      setError("Nitrogen must be a valid number between 0 and 300 kg/ha.");
      return;
    }
    if (inputs.phosphorus < 0 || inputs.phosphorus > 200 || isNaN(inputs.phosphorus)) {
      setError("Phosphorus must be a valid number between 0 and 200 kg/ha.");
      return;
    }
    if (inputs.potassium < 0 || inputs.potassium > 300 || isNaN(inputs.potassium)) {
      setError("Potassium must be a valid number between 0 and 300 kg/ha.");
      return;
    }
    if (inputs.ph < 3 || inputs.ph > 10 || isNaN(inputs.ph)) {
      setError("Soil pH must be a valid number between 3 and 10.");
      return;
    }
    if (!inputs.state?.trim()) {
      setError("State selection is required.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await predictApi.predict(inputs);
      const rawPredictions = res.data?.predictions || [];
      const predictions = rawPredictions.map(normalizePrediction);
      setPredictionResults(predictions);
      setSubmittedInputs({ ...inputs });

      try {
        const top = predictions[0];
        const topName = typeof top?.crop === 'object' && top?.crop !== null
          ? (top.crop.name || 'Crop')
          : (top?.crop || null);

        const targetFarmerId = user?.id || getActiveFarmerId();
        const toStore = {
          predictions,
          inputs: { ...inputs },
          topCrop: topName,
          cropName: topName,
          confidence: top?.confidence || null,
          suitabilityScore: top?.confidence || null,
          analyzedAt: new Date().toISOString(),
          farmer_id: targetFarmerId,
        };

        localStorage.setItem(CROP_REC_KEY, JSON.stringify(toStore));
        if (targetFarmerId && targetFarmerId !== 'farmer_main') {
          localStorage.setItem(getFarmerCropRecKey(targetFarmerId), JSON.stringify(toStore));
        }

        // Sync prediction to Supabase
        savePredictionToSupabase({
          farmer_id: targetFarmerId,
          recommended_crop: String(topName || 'Crop Recommendation'),
          confidence: String(top?.confidence || '95%'),
          nitrogen: Number(inputs.nitrogen) || null,
          phosphorus: Number(inputs.phosphorus) || null,
          potassium: Number(inputs.potassium) || null,
          ph: Number(inputs.ph) || null,
          rainfall: Number(inputs.rainfall) || null,
          temperature: Number(inputs.temperature) || null,
          humidity: Number(inputs.humidity) || null,
        }).catch((err) => console.warn('Supabase crop prediction save error:', err));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('fieldwise:intelligence_updated'));
        }
      } catch (e) {
        console.warn('Could not persist crop recommendation:', e);
      }

      if (predictions.length === 0) {
        setError("No crops met the minimum suitability threshold for these specific conditions. Try adjusting rainfall, temperature, or nutrient levels.");
      }

      // Smooth scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err: any) {
      console.error("Prediction error:", err);
      const validationMsgs = err?.response?.data?.errors?.map((e: any) => e.msg).join(", ");
      setError(validationMsgs || err?.response?.data?.message || err?.message || "Failed to analyze farm conditions. Please check your network and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const navigateToProfile = () => {
    if (onNavigate) {
      onNavigate("profile");
    } else {
      navigate("/profile");
    }
  };

  const renderSourceBadge = (source: FieldSource) => {
    if (source === 'weather') {
      return (
        <span className="inline-flex items-center text-[10px] font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800">
          From weather data
        </span>
      );
    }
    if (source === 'profile') {
      return (
        <span className="inline-flex items-center text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
          From your farm profile
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[10px] font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
        Enter manually
      </span>
    );
  };

  // Check if profile has missing pieces
  const isProfileIncomplete =
    !profile.farmer.state ||
    !profile.farm.farmSize ||
    !profile.soil.soilType ||
    !profile.farm.currentCrops;

  const locationDisplay = profile.farmer.district
    ? `${profile.farmer.district}, ${profile.farmer.state}`
    : profile.farmer.state || user?.location;

  const primaryRec = predictionResults && predictionResults.length > 0 ? normalizePrediction(predictionResults[0]) : null;
  const alternativeRecs = predictionResults && predictionResults.length > 1 ? predictionResults.slice(1).map(normalizePrediction) : [];

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* ── 1. HEADER SECTION ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <Sprout className="h-3.5 w-3.5" />
            <span>AI-Assisted Crop Recommendation</span>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
            • Agronomic Decision Support
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Crop Recommendation
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-3xl leading-relaxed">
          Find crops that may suit your farm conditions and available environmental information.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Recommended based on the available farm conditions. Use this result as decision support and consider local agricultural guidance.
        </p>
      </div>

      {/* ── ENGINE VERSION SWITCHER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/60 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Recommendation Engine</span>
            <Badge variant="outline" className={engineVersion === 'v2' ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'text-gray-500'}>
              {engineVersion === 'v2' ? 'Phase 3C.5 Core Engine' : 'Legacy Heuristic Engine'}
            </Badge>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {engineVersion === 'v2'
              ? 'Multi-dimensional agronomic suitability scoring, water assessment, baseline RDF fertilizer arithmetic, and data-confidence metrics.'
              : 'Classic 7-parameter environmental model.'}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-white dark:bg-gray-900 shrink-0">
          <button
            type="button"
            onClick={() => setEngineVersion('v2')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              engineVersion === 'v2'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Engine V2 (Recommended)
          </button>
          <button
            type="button"
            onClick={() => setEngineVersion('v1')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              engineVersion === 'v1'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Engine V1 (Legacy)
          </button>
        </div>
      </div>

      {engineVersion === 'v2' ? (
        <div className="space-y-8">
          <PredictionFormV2
            onSubmit={handleAnalyzeV2}
            isLoading={isAnalyzingV2}
            user={user}
          />
          <div ref={v2ResultsRef}>
            <PredictionResultsV2
              response={v2Response}
              error={v2Error}
              onRetry={() => v2LastPayload && handleAnalyzeV2(v2LastPayload)}
            />
          </div>
        </div>
      ) : (
        <>
      {/* ── 2. YOUR FARM PROFILE SUMMARY ── */}
      <Card className="border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <CardHeader className="bg-gray-50/60 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Tractor className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Your Farm
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
              <span>Edit My Farm Profile</span>
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
                {locationDisplay || "Not specified"}
              </div>
            </div>

            {/* Farm size */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                <Layers className="h-3 w-3 text-amber-600" />
                <span>Farm size</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                {profile.farm.farmSize ? `${profile.farm.farmSize} ${profile.farm.farmSizeUnit}` : "Not specified"}
              </div>
            </div>

            {/* Current crop */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                <Sprout className="h-3 w-3 text-green-600" />
                <span>Current crop</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                {profile.farm.currentCrops || "None listed"}
              </div>
            </div>

            {/* Soil type */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                <FlaskConical className="h-3 w-3 text-teal-600" />
                <span>Soil type</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                {profile.soil.soilType ? `${profile.soil.soilType} Soil` : "Not specified"}
              </div>
            </div>

            {/* Irrigation type */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 col-span-2 sm:col-span-1">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                <Droplets className="h-3 w-3 text-sky-600" />
                <span>Irrigation</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                {profile.farm.irrigationType || "Not specified"}
              </div>
            </div>
          </div>

          {/* Missing profile banner */}
          {isProfileIncomplete && (
            <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Complete your farm profile to improve recommendations.</span>
              </div>
              <Button
                variant="link"
                size="sm"
                onClick={navigateToProfile}
                className="text-amber-900 dark:text-amber-200 font-semibold p-0 h-auto self-start sm:self-auto"
              >
                Complete My Farm Profile →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. AVAILABLE FARM CONDITIONS (Form inputs with source attribution) ── */}
      <Card className="border border-gray-200 dark:border-gray-800 shadow-sm">
        <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
                Model Inputs
              </div>
              <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
                Available Farm Conditions
              </CardTitle>
              <CardDescription className="text-xs">
                Pre-filled from your farm profile and weather data. Adjust any value as needed before analysis.
              </CardDescription>
            </div>

            {/* Source Origin Legend */}
            <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Profile
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500"></span> Weather
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-gray-400"></span> Manual
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-6">
          {/* Group 1: Soil Chemistry & Nutrients */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5 text-teal-600" />
              Soil Characteristics &amp; NPK Nutrients
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Soil Type */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="soilType" className="text-xs font-medium">Soil Type</Label>
                  {renderSourceBadge(origins.soilType)}
                </div>
                <Select
                  value={inputs.soilType}
                  onValueChange={(val) => handleInputChange("soilType", val)}
                >
                  <SelectTrigger id="soilType" className="h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Select soil" />
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

              {/* Soil pH */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ph" className="text-xs font-medium">
                    Soil pH: <span className="font-bold text-gray-900 dark:text-white">{typeof inputs.ph === 'number' && !isNaN(inputs.ph) ? inputs.ph.toFixed(1) : Number(inputs.ph || 6.5).toFixed(1)}</span>
                  </Label>
                  {renderSourceBadge(origins.ph)}
                </div>
                <Input
                  id="ph"
                  type="number"
                  min={4.0}
                  max={9.5}
                  step={0.1}
                  value={inputs.ph}
                  onChange={(e) => handleInputChange("ph", parseFloat(e.target.value) || 6.5)}
                  className="h-10 text-xs sm:text-sm"
                />
              </div>

              {/* Nitrogen (N) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="nitrogen" className="text-xs font-medium">
                    Nitrogen (N)
                  </Label>
                  {renderSourceBadge(origins.nitrogen)}
                </div>
                <div className="relative">
                  <Input
                    id="nitrogen"
                    type="number"
                    min={0}
                    max={200}
                    value={inputs.nitrogen}
                    onChange={(e) => handleInputChange("nitrogen", parseInt(e.target.value) || 0)}
                    className="h-10 text-xs sm:text-sm pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">kg/ha</span>
                </div>
              </div>

              {/* Phosphorus (P) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="phosphorus" className="text-xs font-medium">
                    Phosphorus (P)
                  </Label>
                  {renderSourceBadge(origins.phosphorus)}
                </div>
                <div className="relative">
                  <Input
                    id="phosphorus"
                    type="number"
                    min={0}
                    max={150}
                    value={inputs.phosphorus}
                    onChange={(e) => handleInputChange("phosphorus", parseInt(e.target.value) || 0)}
                    className="h-10 text-xs sm:text-sm pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">kg/ha</span>
                </div>
              </div>

              {/* Potassium (K) */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="potassium" className="text-xs font-medium">
                    Potassium (K)
                  </Label>
                  {renderSourceBadge(origins.potassium)}
                </div>
                <div className="relative">
                  <Input
                    id="potassium"
                    type="number"
                    min={0}
                    max={200}
                    value={inputs.potassium}
                    onChange={(e) => handleInputChange("potassium", parseInt(e.target.value) || 0)}
                    className="h-10 text-xs sm:text-sm pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">kg/ha</span>
                </div>
              </div>
            </div>
          </div>

          {/* Group 2: Climate & Geography */}
          <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <CloudRain className="h-3.5 w-3.5 text-sky-600" />
              Environmental &amp; Climate Conditions
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Temperature */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature" className="text-xs font-medium">
                    Avg Temperature
                  </Label>
                  {renderSourceBadge(origins.temperature)}
                </div>
                <div className="relative">
                  <Input
                    id="temperature"
                    type="number"
                    min={5}
                    max={50}
                    value={inputs.temperature}
                    onChange={(e) => handleInputChange("temperature", parseInt(e.target.value) || 0)}
                    className="h-10 text-xs sm:text-sm pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">°C</span>
                </div>
              </div>

              {/* Humidity */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="humidity" className="text-xs font-medium">
                    Relative Humidity
                  </Label>
                  {renderSourceBadge(origins.humidity)}
                </div>
                <div className="relative">
                  <Input
                    id="humidity"
                    type="number"
                    min={10}
                    max={100}
                    value={inputs.humidity}
                    onChange={(e) => handleInputChange("humidity", parseInt(e.target.value) || 0)}
                    className="h-10 text-xs sm:text-sm pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">%</span>
                </div>
              </div>

              {/* Annual Rainfall */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rainfall" className="text-xs font-medium">
                    Annual Rainfall
                  </Label>
                  {renderSourceBadge(origins.rainfall)}
                </div>
                <div className="relative">
                  <Input
                    id="rainfall"
                    type="number"
                    min={50}
                    max={2500}
                    value={inputs.rainfall}
                    onChange={(e) => handleInputChange("rainfall", parseInt(e.target.value) || 0)}
                    className="h-10 text-xs sm:text-sm pr-10"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">mm</span>
                </div>
              </div>

              {/* State / Region */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="state" className="text-xs font-medium">State / Region</Label>
                  {renderSourceBadge(origins.state)}
                </div>
                <Select
                  value={inputs.state}
                  onValueChange={(val) => handleInputChange("state", val)}
                >
                  <SelectTrigger id="state" className="h-10 text-xs sm:text-sm">
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
              onClick={handleAnalyze}
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
                  Analyze My Farm
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
              Evaluating your {inputs.soilType} soil chemistry, NPK balance, and climate suitability thresholds.
            </p>
          </Card>
        )}

        {!isAnalyzing && primaryRec && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Results Title Banner */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Crop Recommendation
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Recommended based on the available farm conditions.
                </p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                AI Analysis Complete
              </Badge>
            </div>

            {/* Primary Recommendation Card */}
            <Card className="border-2 border-emerald-500/60 dark:border-emerald-500/40 shadow-md overflow-hidden bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-emerald-950/20">
              <div className="h-2 bg-emerald-600" />
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-3xl flex items-center justify-center shadow-inner shrink-0">
                      {primaryRec.crop?.icon || "🌱"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          Primary Recommendation
                        </span>
                        <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">
                          {primaryRec.crop?.season || "All Season"} Season
                        </Badge>
                      </div>
                      <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                        {primaryRec.crop?.name || "Recommended Crop"}
                      </h3>
                      {primaryRec.crop?.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 max-w-xl">
                          {primaryRec.crop.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Confidence / Match Badge */}
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center shrink-0">
                    <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                      Suitability Match
                    </div>
                    <div className="text-xl font-extrabold text-emerald-800 dark:text-emerald-200">
                      {primaryRec.confidence}%
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">
                      Est. Yield: ~{primaryRec.yieldPrediction} t/ha
                    </div>
                  </div>
                </div>

                {/* ── WHY THIS RECOMMENDATION? ── */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-emerald-600" />
                    Why this recommendation?
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Evaluated against the exact physiological thresholds of {primaryRec.crop?.name || 'this crop'}:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Soil Match */}
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 space-y-1">
                      <div className="font-semibold text-gray-900 dark:text-white flex items-center justify-between">
                        <span>Soil Compatibility</span>
                        {Array.isArray(primaryRec.crop?.soilTypes) && primaryRec.crop.soilTypes.some(st => typeof st === 'string' && st.toLowerCase() === String(inputs?.soilType || '').toLowerCase()) ? (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px] h-4">Compatible</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-4">Moderate</Badge>
                        )}
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                        Your <strong>{inputs.soilType}</strong> soil is evaluated against {primaryRec.crop?.name || 'the recommended crop'}'s preferred soils: {Array.isArray(primaryRec.crop?.soilTypes) ? primaryRec.crop.soilTypes.join(", ") : inputs.soilType}.
                      </p>
                    </div>

                    {/* Temperature Match */}
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 space-y-1">
                      <div className="font-semibold text-gray-900 dark:text-white flex items-center justify-between">
                        <span>Temperature Suitability</span>
                        <span className="text-gray-500 text-[11px]">{inputs.temperature}°C</span>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                        Optimal temperature range is <strong>{primaryRec.crop?.minTemperature ?? 18}°C – {primaryRec.crop?.maxTemperature ?? 30}°C</strong>. Current input is {inputs.temperature}°C.
                      </p>
                    </div>

                    {/* Rainfall Match */}
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 space-y-1">
                      <div className="font-semibold text-gray-900 dark:text-white flex items-center justify-between">
                        <span>Rainfall Requirement</span>
                        <span className="text-gray-500 text-[11px]">{inputs.rainfall} mm</span>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                        Optimal annual rainfall is <strong>{primaryRec.crop?.minRainfall ?? 80} – {primaryRec.crop?.maxRainfall ?? 160} mm</strong>. Your farm baseline is {inputs.rainfall} mm.
                      </p>
                    </div>

                    {/* Nutrient Balance */}
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 space-y-1">
                      <div className="font-semibold text-gray-900 dark:text-white flex items-center justify-between">
                        <span>Nutrient (NPK) &amp; pH Balance</span>
                        <span className="text-gray-500 text-[11px]">pH {typeof inputs?.ph === 'number' && !isNaN(inputs.ph) ? inputs.ph.toFixed(1) : Number(inputs?.ph || 6.5).toFixed(1)}</span>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                        Target NPK: N {Array.isArray(primaryRec.crop?.nitrogenRange) ? primaryRec.crop.nitrogenRange.join("-") : '60-100'}, P {Array.isArray(primaryRec.crop?.phosphorusRange) ? primaryRec.crop.phosphorusRange.join("-") : '40-60'}, K {Array.isArray(primaryRec.crop?.potassiumRange) ? primaryRec.crop.potassiumRange.join("-") : '40-60'} kg/ha. Soil pH optimal range: {Array.isArray(primaryRec.crop?.phRange) ? primaryRec.crop.phRange.join("–") : '6.0–7.5'}.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recommended Fertilizers for this Crop */}
                {Array.isArray(primaryRec.fertilizers) && primaryRec.fertilizers.length > 0 && (
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <FlaskConical className="h-3.5 w-3.5 text-teal-600" />
                        Nutrient Management for {primaryRec.crop?.name || 'this crop'}
                      </h4>
                      <button
                        type="button"
                        onClick={() => onNavigate ? onNavigate("fertilizer-recommendation") : navigate("/?module=fertilizer-recommendation")}
                        className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                      >
                        <span>Open Fertilizer AI Calculator</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {primaryRec.fertilizers.map((f, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-teal-50/40 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 text-xs">
                          <div className="font-semibold text-teal-900 dark:text-teal-200">{f.name}</div>
                          <div className="text-[11px] text-gray-600 dark:text-gray-300">Dose: {f.dosage}</div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{f.applicationTime}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── ALTERNATIVE SUITABLE CROPS (If multiple matches returned) ── */}
            {alternativeRecs.length > 0 && (
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAlternatives((prev) => !prev)}
                  className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 flex items-center gap-1.5 p-0 h-auto"
                >
                  {showAlternatives ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span>{showAlternatives ? "Hide" : "Show"} Alternative Suitable Crops ({alternativeRecs.length})</span>
                </Button>

                {showAlternatives && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in duration-200">
                    {alternativeRecs.map((alt, idx) => (
                      <Card key={idx} className="border border-gray-200 dark:border-gray-800 shadow-xs p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{alt.crop?.icon || "🌱"}</span>
                            <span className="font-semibold text-sm text-gray-900 dark:text-white">
                              {alt.crop?.name || "Suitable Crop"}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {alt.confidence}% match
                          </Badge>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                          {alt.crop?.description}
                        </p>
                        <div className="text-[10px] text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800 flex justify-between">
                          <span>Season: {alt.crop?.season || "All Season"}</span>
                          <span>Est. Yield: ~{alt.yieldPrediction} t/ha</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 7. MODEL TRANSPARENCY SECTION ── */}
            {submittedInputs && (
              <Card className="border border-gray-200 dark:border-gray-800 shadow-sm bg-gray-50/50 dark:bg-gray-900/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <CardTitle className="text-sm font-bold text-gray-900 dark:text-white">
                      Recommendation based on
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    The recommendation engine evaluated these exact 9 parameters without unverified assumptions:
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <div className="text-[10px] text-gray-400 uppercase">Nitrogen (N)</div>
                      <div className="font-bold text-gray-900 dark:text-white">{submittedInputs.nitrogen} kg/ha</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <div className="text-[10px] text-gray-400 uppercase">Phosphorus (P)</div>
                      <div className="font-bold text-gray-900 dark:text-white">{submittedInputs.phosphorus} kg/ha</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <div className="text-[10px] text-gray-400 uppercase">Potassium (K)</div>
                      <div className="font-bold text-gray-900 dark:text-white">{submittedInputs.potassium} kg/ha</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <div className="text-[10px] text-gray-400 uppercase">Temperature</div>
                      <div className="font-bold text-gray-900 dark:text-white">{submittedInputs.temperature}°C</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <div className="text-[10px] text-gray-400 uppercase">Humidity</div>
                      <div className="font-bold text-gray-900 dark:text-white">{submittedInputs.humidity}%</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <div className="text-[10px] text-gray-400 uppercase">Soil pH</div>
                      <div className="font-bold text-gray-900 dark:text-white">{typeof submittedInputs.ph === 'number' && !isNaN(submittedInputs.ph) ? submittedInputs.ph.toFixed(1) : Number(submittedInputs.ph || 6.5).toFixed(1)}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <div className="text-[10px] text-gray-400 uppercase">Rainfall</div>
                      <div className="font-bold text-gray-900 dark:text-white">{submittedInputs.rainfall} mm</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <div className="text-[10px] text-gray-400 uppercase">Soil Type</div>
                      <div className="font-bold text-gray-900 dark:text-white">{submittedInputs.soilType}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 col-span-2 sm:col-span-1">
                      <div className="text-[10px] text-gray-400 uppercase">Region / State</div>
                      <div className="font-bold text-gray-900 dark:text-white">{submittedInputs.state}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── 8. SAFETY / DECISION SUPPORT DISCLAIMER ── */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2.5 leading-relaxed">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <strong className="text-gray-700 dark:text-gray-300">Agricultural Decision Support Notice: </strong>
                This AI-assisted recommendation is generated based on the provided environmental and soil conditions. Use this result as decision support and consult local Krishi Vigyan Kendra (KVK) officers, state extension advisory, and current market demand before making planting investments.
              </div>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

export default CropRecommendation;