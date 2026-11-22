import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { detectPlantDisease } from "@/services/geminiService";
import { DiseaseDetectionResult } from "@/types/cropPrediction";
import { farmProfileService, CompleteFarmProfile } from "@/services/farmProfileService";
import expertSupportService from "@/services/expertSupportService";
import { getActiveFarmerId } from "@/lib/supabase";
import {
  farmIntelligenceService,
  getFarmerDiseaseRecKey,
  DISEASE_REC_KEY,
} from "@/services/farmIntelligenceService";
import {
  Upload,
  Camera,
  Image as ImageIcon,
  Trash2,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Leaf,
  Sprout,
  ShieldCheck,
  Tractor,
  MapPin,
  User,
  ArrowRight,
  Clock,
  Loader2,
  Info,
  Stethoscope,
  ExternalLink,
  Eye,
  Check
} from "lucide-react";

interface DiseaseDetectionProps {
  onNavigate?: (module: string) => void;
}

interface ImageMetadata {
  name: string;
  size: number;
  type: string;
}

interface ScanHistoryItem {
  id: string;
  plant: string;
  diseaseName: string;
  isHealthy: boolean;
  confidence: string | null;
  timestamp: string;
  thumbnail: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parsePlantName(diseaseName: string): string {
  if (!diseaseName) return "Plant / Crop";
  if (diseaseName.includes(':')) {
    return diseaseName.split(':')[0].trim();
  }
  const knownCrops = [
    'Tomato', 'Wheat', 'Rice', 'Potato', 'Apple', 'Corn', 'Maize',
    'Cotton', 'Soybean', 'Grape', 'Pepper', 'Chilli', 'Orange',
    'Citrus', 'Sugarcane', 'Banana', 'Mango', 'Onion', 'Mustard', 'Blueberry',
    'Taro', 'Colocasia', 'Elephant Ear', 'Ginger', 'Turmeric', 'Cabbage', 'Cauliflower', 'Brinjal', 'Eggplant', 'Groundnut'
  ];
  for (const crop of knownCrops) {
    if (diseaseName.toLowerCase().includes(crop.toLowerCase())) {
      return crop;
    }
  }
  const firstWord = diseaseName.split(' ')[0];
  if (firstWord && firstWord.toLowerCase() !== 'healthy') {
    return firstWord;
  }
  return "Plant / Crop";
}

function getDetectionStatus(diseaseName: string): { label: string; isHealthy: boolean; isUnclear: boolean; isInvalid: boolean } {
  const lower = (diseaseName || '').toLowerCase().trim();
  if (lower === 'healthy' || lower.includes('healthy')) {
    return { label: "Healthy Crop", isHealthy: true, isUnclear: false, isInvalid: false };
  }
  if (lower === 'invalid image' || lower.includes('invalid image') || lower.includes('no leaf') || lower.includes('not a plant')) {
    return { label: "Invalid Image (No Plant Leaf Detected)", isHealthy: false, isUnclear: true, isInvalid: true };
  }
  if (lower === 'uncertain' || lower.includes('uncertain') || lower.includes('unclear')) {
    return { label: "Uncertain Diagnosis (Insufficient Visual Evidence)", isHealthy: false, isUnclear: true, isInvalid: false };
  }
  return { label: "Possible Disease Detected", isHealthy: false, isUnclear: false, isInvalid: false };
}

function formatConfidenceValue(conf: number | string | undefined): string | null {
  if (conf === undefined || conf === null || conf === '') return null;
  if (typeof conf === 'number') {
    return `${Math.round(conf)}%`;
  }
  const clean = conf.toString().trim();
  return clean.endsWith('%') ? clean : `${clean}%`;
}

export function DiseaseDetection({ onNavigate }: DiseaseDetectionProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Farm Profile state
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

  // Image Upload & Analysis state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [fileMetadata, setFileMetadata] = useState<ImageMetadata | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DiseaseDetectionResult | null>(() => {
    const saved = farmIntelligenceService.getStoredDiseaseDetection(user?.id);
    if (saved && saved.diseaseName) {
      return {
        diseaseName: saved.diseaseName,
        confidenceScore: saved.confidenceScore,
        confidence: saved.confidenceScore ? `${saved.confidenceScore}%` : undefined,
        cropName: saved.cropName,
        symptomsObserved: saved.symptomsObserved,
        preventionTips: saved.preventionTips,
      } as any;
    }
    return null;
  });
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const activeRequestIdRef = useRef<number>(0);

  // Navigate to My Farm Profile
  const handleNavigateToProfile = () => {
    if (onNavigate) {
      onNavigate("profile");
    } else {
      navigate("/profile");
    }
  };

  // Navigate to Expert Agricultural Support
  const handleNavigateToExperts = () => {
    if (analysisResult) {
      expertSupportService.setPendingDiseaseContext({
        crop: analysisResult.cropName || profile?.farm?.currentCrops || "Crop",
        diseaseName: analysisResult.diseaseName,
        confidence: analysisResult.confidenceScore || 0,
        symptoms: analysisResult.symptomsObserved || analysisResult.symptoms,
      });
    }
    if (onNavigate) {
      onNavigate("expert-consultation");
    } else {
      navigate("/expert-consultation");
    }
  };

  // Process chosen file with strict validation and race-condition invalidation
  const processFile = (file: File) => {
    // Invalidate any in-flight analysis immediately
    activeRequestIdRef.current++;

    // Clear previous prediction and errors on new file selection
    setAnalysisResult(null);
    setAnalysisError(null);

    const validMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validMimes.includes(file.type.toLowerCase()) && !file.type.startsWith("image/")) {
      setAnalysisError("Please select a valid image file (JPEG, PNG, or WEBP).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAnalysisError("Image size exceeds 10MB limit. Please choose a smaller file.");
      return;
    }

    if (file.size < 50) {
      setAnalysisError("Selected image file is empty or corrupted. Please choose a valid image.");
      return;
    }

    setFileMetadata({
      name: file.name,
      size: file.size,
      type: file.type || "image/jpeg",
    });

    const reader = new FileReader();
    reader.onload = (e) => {
      const resultUrl = e.target?.result as string;
      if (!resultUrl) {
        setAnalysisError("Failed to decode image data. Please select another image.");
        return;
      }
      setSelectedImage(resultUrl);
    };
    reader.onerror = () => {
      setAnalysisError("Failed to read image file from disk. Please try again.");
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset file input value so re-selecting same file triggers change
    e.target.value = "";
  };

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const handleRemoveImage = () => {
    // Invalidate any in-flight request
    activeRequestIdRef.current++;
    setSelectedImage(null);
    setFileMetadata(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // Perform AI analysis using Gemini 2.5 Flash
  const handleAnalyze = async () => {
    if (!selectedImage || isAnalyzing) return;

    const currentReqId = ++activeRequestIdRef.current;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);

    try {
      // Pass the selected image data directly to the Gemini vision service
      const result: DiseaseDetectionResult = await detectPlantDisease(
        selectedImage,
        fileMetadata?.type || "image/jpeg",
        fileMetadata?.name
      );

      // Guard against race conditions: ensure newest request controls displayed result
      if (currentReqId !== activeRequestIdRef.current) {
        console.log(`[DiseaseDetection] Discarded stale request #${currentReqId}`);
        return;
      }

      if (!result || !result.diseaseName) {
        throw new Error("Invalid model response received from Gemini.");
      }

      setAnalysisResult(result);

      // Persist to Farm Intelligence only if a real plant diagnosis or healthy status is determined
      if (result.diseaseName !== "Invalid Image" && result.diseaseName !== "Uncertain") {
        try {
          const targetFarmerId = user?.id || getActiveFarmerId();
          const toPersist = {
            cropName: result.cropName || result.plant || profile?.farm?.currentCrops || "Plant",
            diseaseName: result.diseaseName,
            confidenceScore: result.confidenceScore || (typeof result.confidence === "number" ? result.confidence : 0),
            symptomsObserved: result.symptomsObserved || result.symptoms || [],
            preventionTips: result.preventionTips || result.prevention || [],
            analyzedAt: new Date().toISOString(),
            farmer_id: targetFarmerId,
          };

          localStorage.setItem(DISEASE_REC_KEY, JSON.stringify(toPersist));
          if (targetFarmerId && targetFarmerId !== "farmer_main") {
            localStorage.setItem(getFarmerDiseaseRecKey(targetFarmerId), JSON.stringify(toPersist));
          }

          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("fieldwise:intelligence_updated"));
          }
        } catch (e) {
          console.warn("Could not persist disease detection:", e);
        }
      }

      // Add to session history
      const statusInfo = getDetectionStatus(result.diseaseName);
      setScanHistory((prev) => [
        {
          id: Date.now().toString(),
          plant: result.plant || result.plantName || parsePlantName(result.diseaseName),
          diseaseName: result.diseaseName,
          isHealthy: statusInfo.isHealthy,
          confidence: formatConfidenceValue(result.confidence),
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          thumbnail: selectedImage,
        },
        ...prev.slice(0, 4), // Keep last 5 scans
      ]);

      // Scroll smoothly to result on mobile / small screens
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: any) {
      if (currentReqId === activeRequestIdRef.current) {
        console.error("Plant disease detection failed:", err);
        setAnalysisError(err?.message || "Unable to analyze the image right now. Please try again.");
      }
    } finally {
      if (currentReqId === activeRequestIdRef.current) {
        setIsAnalyzing(false);
      }
    }
  };

  // Status and details from actual result
  const statusInfo = analysisResult ? getDetectionStatus(analysisResult.diseaseName) : null;
  const plantName = analysisResult ? (analysisResult.plant || analysisResult.plantName || parsePlantName(analysisResult.diseaseName)) : null;
  const confidenceStr = analysisResult ? formatConfidenceValue(analysisResult.confidence) : null;

  // Farm context details
  const hasFarmerName = Boolean(profile.farmer?.fullName);
  const farmLocation = profile.farmer?.district
    ? `${profile.farmer.district}, ${profile.farmer.state}`
    : profile.farmer?.state || user?.location;
  const currentCrop = profile.farm?.currentCrops;
  const isProfileIncomplete = !farmLocation || !currentCrop;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ── PAGE HEADER ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <Leaf className="h-3.5 w-3.5" />
            <span>AI-Assisted Plant Disease Detection</span>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
            • Leaf &amp; Canopy Diagnostic Support
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          AI-Assisted Plant Disease Detection
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-3xl leading-relaxed">
          Upload a clear plant or leaf image to analyze possible disease patterns.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          This advisory tool provides AI-assisted indications based on visible symptoms. It does not provide guaranteed diagnoses or crop recovery claims.
        </p>
      </div>

      {/* ── FARM CONTEXT ── */}
      <Card className="border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <CardHeader className="bg-gray-50/60 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-800 py-3 px-4 sm:px-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Tractor className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Farm Context
              </CardTitle>
              {profile.farm?.farmName && (
                <Badge variant="outline" className="text-xs font-normal text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700">
                  {profile.farm.farmName}
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={handleNavigateToProfile}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium self-start sm:self-auto"
            >
              <span>Update My Farm</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Farmer Name */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                <User className="h-3 w-3 text-emerald-600" />
                <span>Farmer</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                {hasFarmerName ? profile.farmer.fullName : "Not available"}
              </div>
            </div>

            {/* Farm Location */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                <MapPin className="h-3 w-3 text-emerald-600" />
                <span>Farm Location</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                {farmLocation || "Not available"}
              </div>
            </div>

            {/* Current Crop */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                <Sprout className="h-3 w-3 text-green-600" />
                <span>Current Crop</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                {currentCrop || "Not available"}
              </div>
            </div>
          </div>

          {/* Incomplete profile banner */}
          {isProfileIncomplete && (
            <div className="mt-3.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Complete your farm profile for more relevant recommendations.</span>
              </div>
              <Button
                variant="link"
                size="sm"
                onClick={handleNavigateToProfile}
                className="text-amber-900 dark:text-amber-200 font-semibold p-0 h-auto self-start sm:self-auto"
              >
                Update My Farm →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── TWO-COLUMN MAIN WORKSPACE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN: IMAGE UPLOAD & PREVIEW (5 Cols) ── */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-emerald-600" />
                    Plant Image
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Select or photograph a leaf showing clear signs of distress.
                  </CardDescription>
                </div>
                {selectedImage && (
                  <Badge variant="outline" className="text-[11px] text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                    Ready to Analyze
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* UPLOAD / DROP AREA */}
              {!selectedImage ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all duration-200 ${
                    isDragging
                      ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 scale-[0.99]"
                      : "border-gray-300 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 hover:border-emerald-400"
                  }`}
                >
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mb-3">
                    <Upload className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                    Upload Plant Image
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-4">
                    Drag and drop your image here, or choose a file from your device.
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 px-4 shadow-sm"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Browse Files
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => cameraInputRef.current?.click()}
                      className="border-gray-300 dark:border-gray-700 text-xs h-9 px-3"
                    >
                      <Camera className="h-3.5 w-3.5 mr-1.5 text-gray-600 dark:text-gray-300" />
                      Use Camera
                    </Button>
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-200/80 dark:border-gray-800/80 flex items-center justify-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
                    <span>Supported: JPG, PNG, WEBP</span>
                    <span>•</span>
                    <span>Max: 5MB</span>
                  </div>
                </div>
              ) : (
                /* PREVIEW CONTAINER */
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-black/5 dark:bg-black/30 group">
                    <img
                      src={selectedImage}
                      alt="Plant Leaf Sample"
                      className="w-full h-64 sm:h-72 object-contain bg-gray-900/5 dark:bg-gray-950"
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handleRemoveImage}
                        disabled={isAnalyzing}
                        className="h-8 w-8 p-0 bg-white/90 dark:bg-gray-900/90 hover:bg-red-50 text-gray-700 hover:text-red-600 shadow-sm backdrop-blur-xs"
                        title="Remove image"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Metadata display */}
                  {fileMetadata && (
                    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs">
                      <div className="truncate max-w-[220px]">
                        <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">
                          {fileMetadata.name}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {formatFileSize(fileMetadata.size)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isAnalyzing}
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs h-7 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-2"
                      >
                        Change Image
                      </Button>
                    </div>
                  )}

                  {/* Primary CTA: Analyze Plant */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                    <Button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11 text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Analyzing your plant image...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Analyze Plant</span>
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRemoveImage}
                      disabled={isAnalyzing}
                      className="border-gray-200 dark:border-gray-700 text-xs h-11 px-3"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Photography Tips Card */}
          <Card className="border border-gray-200 dark:border-gray-800 shadow-sm bg-gray-50/50 dark:bg-gray-900/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-emerald-600" />
                Photography Guidance
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-gray-600 dark:text-gray-400 space-y-2">
              <div className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Sharp Focus:</strong> Keep the affected leaf or lesion in crisp focus.</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Natural Light:</strong> Capture in daylight without strong flash reflections.</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Close Framing:</strong> Fill the view with the leaf and symptom pattern.</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT COLUMN: ANALYSIS, RESULTS & EMPTY STATE (7 Cols) ── */}
        <div ref={resultsRef} className="lg:col-span-7 space-y-4">
          {/* LOADING STATE */}
          {isAnalyzing && (
            <Card className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm p-8 sm:p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  Analyzing your plant image...
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Evaluating foliar discoloration, lesion shapes, and fungal/bacterial pattern markers.
                </p>
              </div>
              <div className="pt-2">
                <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-300 text-xs">
                  Running diagnostic inference
                </Badge>
              </div>
            </Card>
          )}

          {/* ERROR STATE */}
          {!isAnalyzing && analysisError && (
            <Card className="border border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20 shadow-sm p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-red-900 dark:text-red-200">
                    Analysis Incomplete
                  </h3>
                  <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed font-medium">
                    {analysisError}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2.5">
                <Button
                  type="button"
                  onClick={handleAnalyze}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 px-4 font-semibold"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Try Again
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-red-200 text-red-800 text-xs h-9"
                >
                  Upload Different Image
                </Button>
              </div>
            </Card>
          )}

          {/* EMPTY STATE (Before image selected or analyzed) */}
          {!isAnalyzing && !analysisError && !analysisResult && (
            <Card className="border border-dashed border-gray-300 dark:border-gray-800 shadow-xs p-8 sm:p-12 text-center space-y-4 bg-gray-50/40 dark:bg-gray-900/20">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-800">
                <Leaf className="h-8 w-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  Upload a clear leaf or plant image to begin.
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                  For better results, use a clear image with the affected leaf visible.
                </p>
              </div>

              <div className="pt-3 max-w-sm mx-auto text-left bg-white dark:bg-gray-800/70 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2 text-xs text-gray-600 dark:text-gray-300">
                <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider">
                  <Info className="h-3.5 w-3.5 text-emerald-600" />
                  Expected Diagnostic Flow:
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-[10px]">1</span>
                  <span>Select or snap a photo of the affected plant leaf</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-[10px]">2</span>
                  <span>Click "Analyze Plant" to run AI detection</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-[10px]">3</span>
                  <span>Review disease status, symptoms, and agronomic care</span>
                </div>
              </div>
            </Card>
          )}

          {/* ── ACTUAL MODEL RESULT CARD ── */}
          {!isAnalyzing && analysisResult && statusInfo && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
              <Card className={`border shadow-sm overflow-hidden ${
                statusInfo.isHealthy
                  ? "border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800"
                  : statusInfo.isUnclear
                  ? "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                  : "border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800"
              }`}>
                {/* Result Top Banner */}
                <CardHeader className={`py-4 px-5 border-b ${
                  statusInfo.isHealthy
                    ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900"
                    : statusInfo.isUnclear
                    ? "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                    : "bg-amber-50/70 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900"
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        statusInfo.isHealthy
                          ? "bg-emerald-600 text-white"
                          : statusInfo.isUnclear
                          ? "bg-gray-600 text-white"
                          : "bg-amber-600 text-white"
                      }`}>
                        {statusInfo.isHealthy ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : statusInfo.isUnclear ? (
                          <Eye className="h-5 w-5" />
                        ) : (
                          <AlertTriangle className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          Detection Outcome
                        </div>
                        <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">
                          {statusInfo.label}
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {confidenceStr && (
                        <Badge variant="outline" className={`text-xs font-semibold px-2.5 py-1 ${
                          statusInfo.isHealthy
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                        }`}>
                          Confidence: {confidenceStr}
                        </Badge>
                      )}
                      {(analysisResult.severity || analysisResult.severityLevel) && (
                        <Badge variant="outline" className="text-xs capitalize border-gray-300 dark:border-gray-700">
                          Severity: {analysisResult.severity || analysisResult.severityLevel}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 sm:p-6 space-y-5">
                  {/* Primary Output Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Plant */}
                    <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-0.5">
                        Plant / Crop
                      </div>
                      <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                        {plantName || "Identified Crop"}
                      </div>
                    </div>

                    {/* Result */}
                    <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-0.5">
                        Predicted Condition / Class
                      </div>
                      <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate" title={analysisResult.diseaseName}>
                        {analysisResult.diseaseName}
                      </div>
                    </div>
                  </div>

                  {/* Description if provided */}
                  {analysisResult.description && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Observed Condition
                      </div>
                      <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50/60 dark:bg-gray-900/40 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800">
                        {analysisResult.description}
                      </p>
                    </div>
                  )}

                  {/* Action Recommendation if provided */}
                  {(analysisResult.action || analysisResult.actionRequired) && (
                    <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/70 space-y-1 text-xs text-amber-900 dark:text-amber-200">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>Recommended Immediate Action:</span>
                      </div>
                      <p className="pl-5 leading-relaxed text-amber-800 dark:text-amber-300">
                        {analysisResult.action || analysisResult.actionRequired}
                      </p>
                    </div>
                  )}

                  {/* Symptoms & Diagnostic Features */}
                  {analysisResult.symptoms && analysisResult.symptoms.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Visible Symptoms &amp; Diagnostic Markers</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {analysisResult.symptoms.map((symptom, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 flex items-start gap-2 text-gray-700 dark:text-gray-300"
                          >
                            <span className="text-emerald-600 font-bold shrink-0 mt-0.5">•</span>
                            <span>{symptom}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Treatment / Care information if provided */}
                  {analysisResult.treatment && analysisResult.treatment.length > 0 ? (
                    <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Agronomic Treatment &amp; Management Steps</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        {analysisResult.treatment.map((step, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/60 flex items-start gap-2 text-emerald-950 dark:text-emerald-200"
                          >
                            <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Fallback when backend does not provide treatment fields */
                    <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Use this result as an AI-assisted indication and consider confirming the issue with an agricultural expert before taking major crop-treatment decisions.
                    </div>
                  )}

                  {/* Prevention Guidelines if provided */}
                  {analysisResult.prevention && analysisResult.prevention.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Preventative Measures for Future Cycles</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                        {analysisResult.prevention.map((prev, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{prev}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ── MODEL TRANSPARENCY ── */}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-emerald-600" />
                      About this analysis
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-gray-900/60 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                      This result is generated by an AI image classification model. Image quality, lighting, crop variety, and visible symptoms can affect the result.
                    </p>
                  </div>

                  {/* Secondary CTAs */}
                  <div className="pt-2 flex flex-wrap gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        handleRemoveImage();
                        fileInputRef.current?.click();
                      }}
                      className="text-xs h-9"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Scan Another Leaf
                    </Button>
                    <Button
                      type="button"
                      onClick={handleNavigateToExperts}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-4 font-semibold ml-auto"
                    >
                      <Stethoscope className="h-3.5 w-3.5 mr-1.5" />
                      Need Human Assistance? Consult Agricultural Support
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ── SESSION RECENT SCANS (Farmer convenience) ── */}
      {scanHistory.length > 0 && (
        <Card className="border border-gray-200 dark:border-gray-800 shadow-sm mt-8">
          <CardHeader className="py-3 px-5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                Recent Scans (Current Session)
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {scanHistory.length} Scanned
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {scanHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/30 flex items-center gap-3"
                >
                  <img
                    src={item.thumbnail}
                    alt={item.plant}
                    className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {item.plant}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate" title={item.diseaseName}>
                      {item.diseaseName}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
                      <span>{item.timestamp}</span>
                      <span className={item.isHealthy ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                        {item.isHealthy ? "Healthy" : "Distressed"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default DiseaseDetection;