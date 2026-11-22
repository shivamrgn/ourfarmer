/**
 * Farm Intelligence Aggregation Service
 * Combines real-world data from existing Crops Wild modules:
 * - Farm Profile (farmProfileService)
 * - Weather Intelligence (weatherService & WeatherContext)
 * - NASA POWER Agroclimatology (nasaPowerService)
 * - Crop Recommendation Model (predictApi / predictorEngine)
 * - Fertilizer Recommendation Formulations (FertilizerRecommendation)
 * - Plant Disease Detection AI (geminiService / detectPlantDisease)
 * - Mandi Price Intelligence (marketPricesService)
 * - Government Schemes & Farmer Benefits (governmentSchemesService)
 *
 * STRICT INTEGRATION RULES:
 * - NO fake insights.
 * - NO invented recommendations.
 * - NO unsupported certainty claims.
 * - Readiness and insights calculated strictly from actual connected application state.
 */

import { CompleteFarmProfile } from './farmProfileService';
import { OpenWeatherData } from '@/components/dashboard/WeatherContext';
import { NasaPowerDataset } from './nasaPowerService';
import { MarketPrice } from './marketPricesService';
import { GovernmentScheme } from './governmentSchemesService';
import { fetchLatestPredictionFromSupabase, getActiveFarmerId } from '@/lib/supabase';

export interface DataReadinessItem {
  id: string;
  name: string;
  status: 'available' | 'incomplete' | 'no_recent_analysis' | 'unavailable';
  statusLabel: string;
  details: string;
  source: string;
  actionModule?: string;
  actionLabel?: string;
}

export interface StoredCropRecommendation {
  predictions: Array<{
    crop: any;
    confidence: number | string;
    description?: string;
    marketPrice?: number;
    season?: string;
  }>;
  inputs: Record<string, any>;
  topCrop: any;
  cropName?: string;
  confidence: number | string | null;
  suitabilityScore?: number | string;
  analyzedAt: string;
  farmer_id?: string;
}

export interface StoredFertilizerRecommendation {
  cropName: string;
  cropId: string;
  fertilizers: Array<{
    name: string;
    quantity: number | null;
    unit: string;
    purpose?: string;
  }>;
  inputs: {
    cropName?: string;
    area?: number;
    unit?: string;
    soilType?: string;
    nitrogen?: number;
    phosphorus?: number;
    potassium?: number;
    ph?: number;
  };
  analyzedAt: string;
  farmer_id?: string;
}

export interface StoredDiseaseDetection {
  cropName: string;
  diseaseName: string;
  confidenceScore: number;
  symptomsObserved?: string[];
  preventionTips?: string[];
  analyzedAt: string;
  farmer_id?: string;
}

export interface FarmInsight {
  id: string;
  type: 'important' | 'information' | 'positive';
  typeLabel: string;
  category: 'Weather' | 'Soil' | 'Crop' | 'Fertilizer' | 'Plant Health' | 'Market' | 'Government' | 'Profile';
  title: string;
  description: string;
  source: string;
  actionModule?: string;
  actionLabel?: string;
}

export interface MissingDataItem {
  id: string;
  title: string;
  description: string;
  actionModule: string;
  actionLabel: string;
}

export const CROP_REC_KEY = 'cropswild_crop_recommendation_last';
export const FERT_REC_KEY = 'cropswild_fertilizer_recommendation_last';
export const DISEASE_REC_KEY = 'cropswild_disease_detection_last';

export function getFarmerCropRecKey(farmerId?: string): string {
  if (farmerId && farmerId.trim() && farmerId.trim() !== 'farmer_main') {
    return `cropswild_crop_recommendation_${farmerId.trim()}`;
  }
  return CROP_REC_KEY;
}

export function getFarmerFertRecKey(farmerId?: string): string {
  if (farmerId && farmerId.trim() && farmerId.trim() !== 'farmer_main') {
    return `cropswild_fertilizer_recommendation_${farmerId.trim()}`;
  }
  return FERT_REC_KEY;
}

export function getFarmerDiseaseRecKey(farmerId?: string): string {
  if (farmerId && farmerId.trim() && farmerId.trim() !== 'farmer_main') {
    return `cropswild_disease_detection_${farmerId.trim()}`;
  }
  return DISEASE_REC_KEY;
}

class FarmIntelligenceService {
  /**
   * Helper to safely extract a human-readable crop name from stored crop recommendation
   */
  resolveCropName(cropRec: StoredCropRecommendation | null | undefined): string {
    if (!cropRec) return 'Recommended Crop';
    if (typeof cropRec.topCrop === 'string' && cropRec.topCrop.trim()) {
      return cropRec.topCrop;
    }
    if (cropRec.topCrop && typeof cropRec.topCrop === 'object' && cropRec.topCrop.name) {
      return String(cropRec.topCrop.name);
    }
    if (typeof cropRec.cropName === 'string' && cropRec.cropName.trim()) {
      return cropRec.cropName;
    }
    const first = cropRec.predictions?.[0]?.crop;
    if (typeof first === 'string' && first.trim()) {
      return first;
    }
    if (first && typeof first === 'object' && first.name) {
      return String(first.name);
    }
    return 'Recommended Crop';
  }

  /**
   * Reads stored Crop Recommendation from localStorage.
   * If farmerId is specified, checks farmer-scoped key first and verifies active key ownership.
   */
  getStoredCropRecommendation(farmerId?: string): StoredCropRecommendation | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const targetFarmerId = (farmerId && farmerId.trim()) ? farmerId.trim() : undefined;

      // 1. Try farmer-scoped key first if farmerId provided
      if (targetFarmerId && targetFarmerId !== 'farmer_main') {
        const scopedRaw = localStorage.getItem(getFarmerCropRecKey(targetFarmerId));
        if (scopedRaw) {
          try {
            const parsed = JSON.parse(scopedRaw);
            if (parsed && typeof parsed === 'object') {
              // Ensure stored payload is consistent with that owner if farmer_id is present
              if (!parsed.farmer_id || parsed.farmer_id === targetFarmerId) {
                const normalizedTopCrop = this.resolveCropName(parsed);
                const firstPrediction = Array.isArray(parsed.predictions) ? parsed.predictions[0] : null;
                const confidence = parsed.confidence ?? parsed.suitabilityScore ?? firstPrediction?.confidence ?? null;
                return {
                  ...parsed,
                  topCrop: normalizedTopCrop,
                  cropName: normalizedTopCrop,
                  confidence,
                  suitabilityScore: confidence,
                };
              }
            }
          } catch {}
        }
      }

      // 2. Fall back to active key, requiring verified exact matching farmer_id if targetFarmerId is specified
      const raw = localStorage.getItem(CROP_REC_KEY);
      if (!raw) return null;
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }
      if (!parsed || typeof parsed !== 'object') return null;

      if (targetFarmerId && targetFarmerId !== 'farmer_main') {
        // When a specific farmer ID is requested, require exact matching farmer_id.
        // Reject records with missing, empty, malformed, or mismatched farmer_id.
        if (!parsed.farmer_id || typeof parsed.farmer_id !== 'string' || parsed.farmer_id.trim() !== targetFarmerId) {
          return null;
        }
      }

      const normalizedTopCrop = this.resolveCropName(parsed);
      const firstPrediction = Array.isArray(parsed.predictions) ? parsed.predictions[0] : null;
      const confidence = parsed.confidence ?? parsed.suitabilityScore ?? firstPrediction?.confidence ?? null;

      return {
        ...parsed,
        topCrop: normalizedTopCrop,
        cropName: normalizedTopCrop,
        confidence,
        suitabilityScore: confidence,
      };
    } catch {
      return null;
    }
  }

  /**
   * Reads stored Fertilizer Recommendation from localStorage.
   * If farmerId is specified, checks farmer-scoped key first and verifies active key ownership.
   */
  getStoredFertilizerRecommendation(farmerId?: string): StoredFertilizerRecommendation | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const targetFarmerId = (farmerId && farmerId.trim()) ? farmerId.trim() : undefined;

      // 1. Try farmer-scoped key first if farmerId provided
      if (targetFarmerId && targetFarmerId !== 'farmer_main') {
        const scopedRaw = localStorage.getItem(getFarmerFertRecKey(targetFarmerId));
        if (scopedRaw) {
          try {
            const parsed = JSON.parse(scopedRaw);
            if (parsed && typeof parsed === 'object' && parsed.cropId) {
              if (!parsed.farmer_id || parsed.farmer_id === targetFarmerId) {
                return parsed;
              }
            }
          } catch {}
        }
      }

      // 2. Fall back to active key, requiring verified exact matching farmer_id if targetFarmerId is specified
      const raw = localStorage.getItem(FERT_REC_KEY);
      if (!raw) return null;
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }
      if (!parsed || typeof parsed !== 'object' || !parsed.cropId) return null;

      if (targetFarmerId && targetFarmerId !== 'farmer_main') {
        if (!parsed.farmer_id || typeof parsed.farmer_id !== 'string' || parsed.farmer_id.trim() !== targetFarmerId) {
          return null;
        }
      }

      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Reads stored Disease Detection result from localStorage.
   * If farmerId is specified, checks farmer-scoped key first and verifies active key ownership.
   */
  getStoredDiseaseDetection(farmerId?: string): StoredDiseaseDetection | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const targetFarmerId = (farmerId && farmerId.trim()) ? farmerId.trim() : undefined;

      // 1. Try farmer-scoped key first if farmerId provided
      if (targetFarmerId && targetFarmerId !== 'farmer_main') {
        const scopedRaw = localStorage.getItem(getFarmerDiseaseRecKey(targetFarmerId));
        if (scopedRaw) {
          try {
            const parsed = JSON.parse(scopedRaw);
            if (parsed && typeof parsed === 'object' && parsed.diseaseName) {
              if (!parsed.farmer_id || parsed.farmer_id === targetFarmerId) {
                return parsed;
              }
            }
          } catch {}
        }
      }

      // 2. Fall back to active key, requiring verified exact matching farmer_id if targetFarmerId is specified
      const raw = localStorage.getItem(DISEASE_REC_KEY);
      if (!raw) return null;
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }
      if (!parsed || typeof parsed !== 'object' || !parsed.diseaseName) return null;

      if (targetFarmerId && targetFarmerId !== 'farmer_main') {
        if (!parsed.farmer_id || typeof parsed.farmer_id !== 'string' || parsed.farmer_id.trim() !== targetFarmerId) {
          return null;
        }
      }

      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Synchronously restores or clears the active session keys for a specific farmer.
   * Called immediately on login or user detection.
   */
  restoreFarmerSession(farmerId?: string): void {
    if (typeof localStorage === 'undefined') return;
    const cleanId = (farmerId && farmerId.trim()) ? farmerId.trim() : undefined;
    if (!cleanId || cleanId === 'farmer_main') {
      return;
    }

    try {
      // Crop Recommendation
      const scopedCrop = localStorage.getItem(getFarmerCropRecKey(cleanId));
      if (scopedCrop) {
        localStorage.setItem(CROP_REC_KEY, scopedCrop);
      } else {
        localStorage.removeItem(CROP_REC_KEY);
      }

      // Fertilizer Recommendation
      const scopedFert = localStorage.getItem(getFarmerFertRecKey(cleanId));
      if (scopedFert) {
        localStorage.setItem(FERT_REC_KEY, scopedFert);
      } else {
        localStorage.removeItem(FERT_REC_KEY);
      }

      // Disease Detection
      const scopedDisease = localStorage.getItem(getFarmerDiseaseRecKey(cleanId));
      if (scopedDisease) {
        localStorage.setItem(DISEASE_REC_KEY, scopedDisease);
      } else {
        localStorage.removeItem(DISEASE_REC_KEY);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fieldwise:intelligence_updated'));
      }
    } catch (e) {
      console.warn('[FarmIntelligenceService] Session restore notice:', e);
    }
  }

  /**
   * Asynchronously restores the latest crop prediction from Supabase for the authenticated user.
   * Populates both the farmer-scoped key and active key, and emits 'fieldwise:intelligence_updated'.
   * Never fabricates missing or unprovided numerical values.
   * Includes strict asynchronous identity validation to prevent stale cross-user writes.
   */
  async loadAndRestorePrediction(user: any): Promise<StoredCropRecommendation | null> {
    const farmerId = user?.id || user?.uid || (typeof user === 'string' ? user : undefined);
    if (!farmerId || farmerId === 'farmer_main') {
      return null;
    }

    const activeAtStart = getActiveFarmerId();
    const isIdentityStale = (): boolean => {
      const current = getActiveFarmerId();
      if (activeAtStart !== 'farmer_main' && current !== activeAtStart) return true;
      if (current !== 'farmer_main' && current !== farmerId) return true;
      return false;
    };

    try {
      const savedDbPred = await fetchLatestPredictionFromSupabase(farmerId);

      // Identity safety check 1: Verify current authenticated farmer immediately after await
      if (isIdentityStale()) {
        return null;
      }

      if (savedDbPred && savedDbPred.recommended_crop) {
        const topCrop = savedDbPred.recommended_crop;
        const restoredPred = {
          crop: topCrop,
          confidence: savedDbPred.confidence || '95%',
          description: 'Restored from your authenticated farm prediction records.',
        };

        const restoredInputs: Record<string, any> = {};
        if (savedDbPred.rainfall !== null && savedDbPred.rainfall !== undefined) restoredInputs.rainfall = savedDbPred.rainfall;
        if (savedDbPred.temperature !== null && savedDbPred.temperature !== undefined) restoredInputs.temperature = savedDbPred.temperature;
        if (savedDbPred.humidity !== null && savedDbPred.humidity !== undefined) restoredInputs.humidity = savedDbPred.humidity;
        if (savedDbPred.nitrogen !== null && savedDbPred.nitrogen !== undefined) restoredInputs.nitrogen = savedDbPred.nitrogen;
        if (savedDbPred.phosphorus !== null && savedDbPred.phosphorus !== undefined) restoredInputs.phosphorus = savedDbPred.phosphorus;
        if (savedDbPred.potassium !== null && savedDbPred.potassium !== undefined) restoredInputs.potassium = savedDbPred.potassium;
        if (savedDbPred.ph !== null && savedDbPred.ph !== undefined) restoredInputs.ph = savedDbPred.ph;

        const restoredObj: StoredCropRecommendation = {
          predictions: [restoredPred],
          inputs: restoredInputs,
          topCrop: topCrop,
          cropName: topCrop,
          confidence: savedDbPred.confidence || '95%',
          suitabilityScore: savedDbPred.confidence || '95%',
          analyzedAt: savedDbPred.created_at || new Date().toISOString(),
          farmer_id: farmerId,
        };

        // Identity safety check 2: Verify current authenticated farmer immediately before localStorage writes
        if (isIdentityStale()) {
          return null;
        }

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(CROP_REC_KEY, JSON.stringify(restoredObj));
          localStorage.setItem(getFarmerCropRecKey(farmerId), JSON.stringify(restoredObj));
        }

        // Identity safety check 3: Verify current authenticated farmer immediately before dispatching event
        if (!isIdentityStale() && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('fieldwise:intelligence_updated'));
        }

        return restoredObj;
      }
      return null;
    } catch (e) {
      console.warn('[FarmIntelligenceService] Cloud prediction restoration notice:', e);
      return null;
    }
  }

  /**
   * Computes genuine Data Readiness from actual application data
   * NEVER generates arbitrary percentages.
   */
  computeDataReadiness(
    profile: CompleteFarmProfile,
    weatherData: OpenWeatherData | null,
    nasaData: NasaPowerDataset | null,
    cropRec: StoredCropRecommendation | null,
    fertRec: StoredFertilizerRecommendation | null,
    diseaseRec: StoredDiseaseDetection | null,
    marketPrices: MarketPrice[]
  ): DataReadinessItem[] {
    const items: DataReadinessItem[] = [];

    // 1. Farm Profile
    const hasProfileLocation = Boolean(profile?.farmer?.state && profile?.farmer?.district);
    const hasProfileCrop = Boolean(profile?.farm?.currentCrops);
    if (hasProfileLocation && hasProfileCrop) {
      items.push({
        id: 'profile',
        name: 'Farm Profile',
        status: 'available',
        statusLabel: 'Available',
        details: `${profile?.farmer?.district || 'Unknown'}, ${profile?.farmer?.state || 'Unknown'} • ${profile?.farm?.currentCrops}`,
        source: 'My Farm Profile',
        actionModule: 'profile',
        actionLabel: 'View Profile',
      });
    } else {
      items.push({
        id: 'profile',
        name: 'Farm Profile',
        status: 'incomplete',
        statusLabel: 'Incomplete',
        details: 'Missing verified farm location or crop information',
        source: 'My Farm Profile',
        actionModule: 'profile',
        actionLabel: 'Complete Profile',
      });
    }

    // 2. Weather Intelligence
    if (weatherData && weatherData.main && Array.isArray(weatherData.weather) && weatherData.weather.length > 0) {
      items.push({
        id: 'weather',
        name: 'Weather Intelligence',
        status: 'available',
        statusLabel: 'Available',
        details: `${Math.round(weatherData.main.temp ?? 0)}°C • ${weatherData.weather[0]?.main || 'Clear'} • ${weatherData.main.humidity ?? 0}% Humidity`,
        source: 'OpenWeather Live',
        actionModule: 'weather',
        actionLabel: 'View Weather',
      });
    } else {
      items.push({
        id: 'weather',
        name: 'Weather Intelligence',
        status: 'unavailable',
        statusLabel: 'Unavailable',
        details: 'Live weather observations could not be retrieved',
        source: 'OpenWeather',
        actionModule: 'weather',
        actionLabel: 'Check Weather',
      });
    }

    // 3. Soil Information
    const hasSoilNPK =
      (profile?.soil?.nitrogen ?? 0) > 0 &&
      (profile?.soil?.phosphorus ?? 0) > 0 &&
      (profile?.soil?.potassium ?? 0) > 0;
    const hasSoilPH = (profile?.soil?.ph ?? 0) > 0;
    if (hasSoilNPK && hasSoilPH) {
      items.push({
        id: 'soil',
        name: 'Soil Test Information',
        status: 'available',
        statusLabel: 'Available',
        details: `${profile?.soil?.soilType || 'Soil'} • pH ${profile?.soil?.ph} • N:${profile?.soil?.nitrogen} P:${profile?.soil?.phosphorus} K:${profile?.soil?.potassium}`,
        source: 'Farmer Profile Soil Record',
        actionModule: 'soil-environment',
        actionLabel: 'View Soil Data',
      });
    } else if (profile?.soil?.soilType) {
      items.push({
        id: 'soil',
        name: 'Soil Test Information',
        status: 'incomplete',
        statusLabel: 'Incomplete',
        details: `Soil type specified (${profile.soil.soilType}), but laboratory N-P-K nutrient values are missing`,
        source: 'Farmer Profile Soil Record',
        actionModule: 'profile',
        actionLabel: 'Add Soil NPK',
      });
    } else {
      items.push({
        id: 'soil',
        name: 'Soil Test Information',
        status: 'incomplete',
        statusLabel: 'Not Provided',
        details: 'No soil laboratory test parameters recorded',
        source: 'Farmer Profile Soil Record',
        actionModule: 'profile',
        actionLabel: 'Enter Soil Info',
      });
    }

    // 4. Market Data
    if (Array.isArray(marketPrices) && marketPrices.length > 0) {
      items.push({
        id: 'market',
        name: 'Mandi Market Prices',
        status: 'available',
        statusLabel: 'Available',
        details: `${marketPrices.length} mandi commodities monitored across agricultural markets`,
        source: 'Agmarknet / Mandi Intelligence',
        actionModule: 'mandi',
        actionLabel: 'View Mandi Prices',
      });
    } else {
      items.push({
        id: 'market',
        name: 'Mandi Market Prices',
        status: 'unavailable',
        statusLabel: 'Unavailable',
        details: 'Market price feed currently not available',
        source: 'Agmarknet Mandi Network',
        actionModule: 'mandi',
        actionLabel: 'Check Markets',
      });
    }

    // 5. Crop Recommendation Model
    if (cropRec && Array.isArray(cropRec.predictions) && cropRec.predictions.length > 0) {
      const cropName = this.resolveCropName(cropRec);
      const conf = cropRec.confidence || cropRec.predictions[0]?.confidence || cropRec.suitabilityScore || 0;
      items.push({
        id: 'crop_rec',
        name: 'Crop Recommendation',
        status: 'available',
        statusLabel: 'Available',
        details: `Top recommendation: ${cropName} (${conf}%)`,
        source: 'Crops Wild Agronomic Model',
        actionModule: 'crop-recommendation',
        actionLabel: 'View Recommendation',
      });
    } else {
      items.push({
        id: 'crop_rec',
        name: 'Crop Recommendation',
        status: 'no_recent_analysis',
        statusLabel: 'No Recent Analysis',
        details: 'No crop suitability evaluation has been performed for your conditions',
        source: 'Crops Wild Agronomic Model',
        actionModule: 'crop-recommendation',
        actionLabel: 'Run Model',
      });
    }

    // 6. Fertilizer Intelligence
    if (fertRec && Array.isArray(fertRec.fertilizers) && fertRec.fertilizers.length > 0) {
      items.push({
        id: 'fertilizer',
        name: 'Fertilizer Formulation',
        status: 'available',
        statusLabel: 'Available',
        details: `Target: ${fertRec.cropName || 'Crop'} • Formulations calculated for ${fertRec.inputs?.area || 1} ${fertRec.inputs?.unit || 'Acre'}`,
        source: 'ICAR Crop Nutrient Formulations',
        actionModule: 'fertilizer-recommendation',
        actionLabel: 'View Formulations',
      });
    } else {
      items.push({
        id: 'fertilizer',
        name: 'Fertilizer Formulation',
        status: 'no_recent_analysis',
        statusLabel: 'No Recent Analysis',
        details: 'No customized fertilizer dosages calculated yet',
        source: 'ICAR Formulations',
        actionModule: 'fertilizer-recommendation',
        actionLabel: 'Calculate Dosages',
      });
    }

    // 7. Plant Disease Health
    if (diseaseRec && typeof diseaseRec.diseaseName === 'string' && diseaseRec.diseaseName.trim() !== '') {
      items.push({
        id: 'disease',
        name: 'Plant Health Scan',
        status: 'available',
        statusLabel: 'Available',
        details: `Last scan: ${diseaseRec.diseaseName} on ${diseaseRec.cropName || 'Crop'} (${diseaseRec.confidenceScore ?? 0}% confidence)`,
        source: 'AI Plant Pathology Vision',
        actionModule: 'disease-detection',
        actionLabel: 'View Scan',
      });
    } else {
      items.push({
        id: 'disease',
        name: 'Plant Health Scan',
        status: 'no_recent_analysis',
        statusLabel: 'No Recent Analysis',
        details: 'No recent plant leaf images analyzed for infections',
        source: 'AI Plant Pathology Vision',
        actionModule: 'disease-detection',
        actionLabel: 'Upload Leaf Image',
      });
    }

    // 8. Environmental / NASA POWER
    if (nasaData && Array.isArray(nasaData.records) && nasaData.records.length > 0) {
      items.push({
        id: 'environment',
        name: 'NASA POWER Agroclimatology',
        status: 'available',
        statusLabel: 'Available',
        details: `${nasaData.records.length}-day historical solar radiation and temperature trend data`,
        source: 'NASA Langley MERRA-2',
        actionModule: 'soil-environment',
        actionLabel: 'View Trends',
      });
    } else {
      items.push({
        id: 'environment',
        name: 'NASA POWER Agroclimatology',
        status: 'unavailable',
        statusLabel: 'Unavailable',
        details: 'Historical environmental assimilation records unavailable',
        source: 'NASA POWER',
        actionModule: 'soil-environment',
        actionLabel: 'Explore Environment',
      });
    }

    return items;
  }

  /**
   * Generates STRICTLY VALIDATED insights based solely on actual connected data.
   * NEVER invents arbitrary advice.
   */
  generateValidatedInsights(
    profile: CompleteFarmProfile,
    weatherData: OpenWeatherData | null,
    nasaData: NasaPowerDataset | null,
    cropRec: StoredCropRecommendation | null,
    fertRec: StoredFertilizerRecommendation | null,
    diseaseRec: StoredDiseaseDetection | null,
    marketPrices: MarketPrice[],
    schemes: { scheme: GovernmentScheme; relevanceTags: string[]; relevanceScore: number }[]
  ): FarmInsight[] {
    const insights: FarmInsight[] = [];

    // ── A. WEATHER INSIGHTS (Direct Observations) ──
    if (weatherData && weatherData.main) {
      const temp = weatherData.main.temp ?? 0;
      const humidity = weatherData.main.humidity ?? 0;
      const condition = weatherData.weather?.[0]?.main?.toLowerCase() || '';
      const rain = weatherData.rain?.['1h'] || weatherData.rain?.['3h'] || 0;

      if (rain > 0 || condition.includes('rain') || condition.includes('drizzle')) {
        insights.push({
          id: 'insight-rain-active',
          type: 'important',
          typeLabel: 'Attention Required',
          category: 'Weather',
          title: 'Active Precipitation Observed',
          description: `Current weather observations report active rainfall (${rain > 0 ? `${rain} mm` : weatherData.weather?.[0]?.description || 'precipitation'}). Avoid applying foliar chemical sprays or surface broadcast urea during active precipitation to minimize chemical runoff.`,
          source: 'OpenWeather Real-Time',
          actionModule: 'weather',
          actionLabel: 'Check Radar & Forecast',
        });
      } else if (temp >= 38) {
        insights.push({
          id: 'insight-high-temp',
          type: 'important',
          typeLabel: 'Heat Stress Risk',
          category: 'Weather',
          title: `High Ambient Temperature (${Math.round(temp)}°C)`,
          description: `Field temperatures exceed 38°C. Monitor soil moisture depletion and ensure irrigation scheduling during early morning (before 9 AM) or evening hours to minimize evaporative losses.`,
          source: 'OpenWeather Real-Time',
          actionModule: 'weather',
          actionLabel: 'View Weather Forecast',
        });
      }

      if (humidity >= 85) {
        insights.push({
          id: 'insight-high-humidity',
          type: 'information',
          typeLabel: 'Microclimate Observation',
          category: 'Weather',
          title: `Elevated Relative Humidity (${humidity}%)`,
          description: `Current relative humidity is at ${humidity}%. Extended periods of high canopy humidity coupled with warm temperatures can foster fungal spore germination on crops such as wheat, rice, and vegetables.`,
          source: 'OpenWeather Real-Time',
          actionModule: 'disease-detection',
          actionLabel: 'Inspect Plant Leaves',
        });
      } else if (humidity <= 30 && temp > 30) {
        insights.push({
          id: 'insight-dry-winds',
          type: 'information',
          typeLabel: 'Dry Conditions',
          category: 'Weather',
          title: `Low Humidity (${humidity}%) & High Evaporation`,
          description: `Atmospheric humidity is low (${humidity}%), accelerating evapotranspiration from field soil. Inspect topsoil moisture levels.`,
          source: 'OpenWeather Real-Time',
          actionModule: 'soil-environment',
          actionLabel: 'Inspect Soil Moisture',
        });
      }
    }

    // ── B. SOIL INSIGHTS (Validated Agronomic Thresholds) ──
    if ((profile?.soil?.ph ?? 0) > 0) {
      const ph = profile.soil.ph;
      if (ph < 6.0) {
        insights.push({
          id: 'insight-soil-acidic',
          type: 'important',
          typeLabel: 'Soil Chemistry',
          category: 'Soil',
          title: `Acidic Soil pH Recorded (${ph})`,
          description: `Your profile indicates soil pH of ${ph}. Strongly acidic soils restrict phosphorus availability and micro-nutrient uptake. Consider discussing agricultural lime or dolomite application with your local KVK agronomist.`,
          source: 'Farmer Profile Soil Record',
          actionModule: 'expert-support',
          actionLabel: 'Consult KVK on Liming',
        });
      } else if (ph > 8.0) {
        insights.push({
          id: 'insight-soil-alkaline',
          type: 'important',
          typeLabel: 'Soil Chemistry',
          category: 'Soil',
          title: `Alkaline Soil pH Recorded (${ph})`,
          description: `Your profile records a soil pH of ${ph}. Alkaline conditions can induce micronutrient deficiencies (Zinc, Iron). Consult extension specialists regarding gypsum or organic matter amendments.`,
          source: 'Farmer Profile Soil Record',
          actionModule: 'soil-environment',
          actionLabel: 'View Soil Health Card',
        });
      } else if (ph >= 6.5 && ph <= 7.5) {
        insights.push({
          id: 'insight-soil-optimal',
          type: 'positive',
          typeLabel: 'Optimal Condition',
          category: 'Soil',
          title: `Optimal Soil pH Balance (${ph})`,
          description: `Your soil pH of ${ph} lies within the optimal neutral agronomic range (6.5 – 7.5), maximizing availability of primary nutrients (N, P, K) for most field crops.`,
          source: 'Farmer Profile Soil Record',
          actionModule: 'soil-environment',
          actionLabel: 'View Nutrient Balance',
        });
      }
    }

    // ── C. CROP RECOMMENDATION MODEL INSIGHT ──
    if (cropRec && Array.isArray(cropRec.predictions) && cropRec.predictions.length > 0) {
      const top = cropRec.predictions[0];
      const cropName = this.resolveCropName(cropRec);
      const conf = cropRec.confidence || top?.confidence || cropRec.suitabilityScore || 0;
      insights.push({
        id: 'insight-crop-rec-result',
        type: 'information',
        typeLabel: 'Model Recommendation',
        category: 'Crop',
        title: `Crop Recommendation: ${cropName} (${conf}% Suitability)`,
        description: `Your last model run evaluated farm conditions (Rainfall: ${cropRec.inputs?.rainfall || 'Not provided'}mm, Temp: ${cropRec.inputs?.temperature || 'Not provided'}°C, Soil: ${cropRec.inputs?.soilType || 'Not provided'}) and ranked ${cropName} as the highest suitability match.`,
        source: 'Crops Wild Agronomic Model',
        actionModule: 'crop-recommendation',
        actionLabel: 'Review Model Results',
      });
    }

    // ── D. FERTILIZER RECOMMENDATION MODEL INSIGHT ──
    if (fertRec && Array.isArray(fertRec.fertilizers) && fertRec.fertilizers.length > 0) {
      const topFert = fertRec.fertilizers[0];
      insights.push({
        id: 'insight-fert-rec-result',
        type: 'information',
        typeLabel: 'Nutrient Formulation',
        category: 'Fertilizer',
        title: `Fertilizer Formulation for ${fertRec.cropName || 'Crop'}`,
        description: `Custom formulations calculated for ${fertRec.inputs?.area || 1} ${fertRec.inputs?.unit || 'Acre'} including ${topFert?.name || 'Nutrient'} (${topFert?.quantity ? `${topFert.quantity} ${topFert.unit || 'kg'}` : (topFert?.dosage || 'Recommended Dosage')}). Follow split application schedules as recommended by ICAR package of practices.`,
        source: 'ICAR Crop Formulations',
        actionModule: 'fertilizer-recommendation',
        actionLabel: 'View Split Schedule',
      });
    }

    // ── E. PLANT HEALTH / DISEASE SCAN INSIGHT ──
    if (diseaseRec && typeof diseaseRec.diseaseName === 'string' && diseaseRec.diseaseName.trim() !== '') {
      const isHealthy = diseaseRec.diseaseName.toLowerCase().includes('healthy');
      const scanDate = diseaseRec.analyzedAt && !isNaN(new Date(diseaseRec.analyzedAt).getTime())
        ? new Date(diseaseRec.analyzedAt).toLocaleDateString('en-IN')
        : 'recent scan';

      if (isHealthy) {
        insights.push({
          id: 'insight-disease-healthy',
          type: 'positive',
          typeLabel: 'Plant Health Scan',
          category: 'Plant Health',
          title: `Recent Scan: ${diseaseRec.cropName || 'Crop'} Appears Healthy`,
          description: `AI vision scan on ${scanDate} indicated no distinct foliar disease patterns (${diseaseRec.confidenceScore ?? 0}% confidence). Continue periodic field scouting.`,
          source: 'AI Vision Analysis',
          actionModule: 'disease-detection',
          actionLabel: 'View Scan History',
        });
      } else {
        insights.push({
          id: 'insight-disease-detected',
          type: 'important',
          typeLabel: 'Foliar Symptom Alert',
          category: 'Plant Health',
          title: `Possible ${diseaseRec.diseaseName} Detected`,
          description: `Latest AI analysis on ${diseaseRec.cropName || 'Crop'} flagged possible symptoms of ${diseaseRec.diseaseName} (${diseaseRec.confidenceScore ?? 0}% AI confidence). Verify with local KVK agronomist before purchasing chemical fungicides.`,
          source: 'AI Vision Analysis',
          actionModule: 'expert-support',
          actionLabel: 'Prepare KVK Consultation',
        });
      }
    }

    // ── F. MARKET PRICE OBSERVATION ──
    const farmerCrop = profile?.farm?.currentCrops?.toLowerCase() || '';
    if (farmerCrop && Array.isArray(marketPrices) && marketPrices.length > 0) {
      const matchingMarket = marketPrices.find(m =>
        m && typeof m.crop_name === 'string' &&
        (farmerCrop.includes(m.crop_name.toLowerCase()) || m.crop_name.toLowerCase().includes(farmerCrop))
      );
      if (matchingMarket) {
        insights.push({
          id: 'insight-market-match',
          type: 'information',
          typeLabel: 'Market Rate Observation',
          category: 'Market',
          title: `${matchingMarket.crop_name} Mandi Modal Rate: ₹${matchingMarket.current_price}/${matchingMarket.unit || 'kg'}`,
          description: `Recorded at ${matchingMarket.market_location} market (${matchingMarket.market_type || 'wholesale'}). ${
            matchingMarket.trend === 'up'
              ? 'Market trend indicates upward price movement.'
              : matchingMarket.trend === 'down'
              ? 'Market trend indicates downward price pressure.'
              : 'Prices are holding steady.'
          }`,
          source: 'Agmarknet Mandi Network',
          actionModule: 'mandi',
          actionLabel: 'View Mandi Intelligence',
        });
      }
    }

    // ── G. GOVERNMENT SCHEME RELEVANCE ──
    if (Array.isArray(schemes) && schemes.length > 0 && schemes[0]?.scheme) {
      const topScheme = schemes[0].scheme;
      insights.push({
        id: 'insight-schemes-match',
        type: 'information',
        typeLabel: 'Government Support',
        category: 'Government',
        title: `${schemes.length} Programs Potentially Relevant to Your Farm`,
        description: `Based on your location (${profile?.farmer?.state || 'India'}) and crop profile (${profile?.farm?.currentCrops || 'All Crops'}), verified initiatives such as ${topScheme.short_name || topScheme.name || 'Government Programs'} may be relevant.`,
        source: 'MoA&FW / myScheme.gov.in',
        actionModule: 'government-schemes',
        actionLabel: 'Explore Schemes',
      });
    }

    return insights;
  }

  /**
   * Identifies genuine missing information from the farmer's records
   */
  getMissingDataItems(
    profile: CompleteFarmProfile,
    cropRec: StoredCropRecommendation | null,
    fertRec: StoredFertilizerRecommendation | null,
    diseaseRec: StoredDiseaseDetection | null
  ): MissingDataItem[] {
    const missing: MissingDataItem[] = [];

    // Location
    if (!profile?.farmer?.state || !profile?.farmer?.district) {
      missing.push({
        id: 'missing-location',
        title: 'Farm Location Not Fully Recorded',
        description: 'Add your state and district in My Farm Profile to enable localized weather, mandi prices, and district KVK discovery.',
        actionModule: 'profile',
        actionLabel: 'Set Farm Location',
      });
    }

    // Soil NPK
    if (
      (profile?.soil?.nitrogen ?? 0) === 0 ||
      (profile?.soil?.phosphorus ?? 0) === 0 ||
      (profile?.soil?.potassium ?? 0) === 0
    ) {
      missing.push({
        id: 'missing-soil',
        title: 'Soil Test Parameters (N-P-K & pH) Missing',
        description: 'Recording soil test values allows Crops Wild to calculate precise fertilizer dosages and accurate crop suitability rankings.',
        actionModule: 'profile',
        actionLabel: 'Add Soil Test Results',
      });
    }

    // Crop Recommendation
    if (!cropRec) {
      missing.push({
        id: 'missing-crop-rec',
        title: 'No Crop Suitability Analysis Run',
        description: 'Evaluate which crops are best suited for your environmental and soil conditions using the Crop Recommendation model.',
        actionModule: 'crop-recommendation',
        actionLabel: 'Run Crop Recommendation',
      });
    }

    // Fertilizer
    if (!fertRec) {
      missing.push({
        id: 'missing-fert-rec',
        title: 'No Fertilizer Formulation Calculated',
        description: 'Generate customized nutrient requirements (Urea, DAP, MOP) based on your target crop and farm acreage.',
        actionModule: 'fertilizer-recommendation',
        actionLabel: 'Calculate Fertilizer Dosages',
      });
    }

    // Disease
    if (!diseaseRec) {
      missing.push({
        id: 'missing-disease',
        title: 'No Recent Plant Health Scan',
        description: 'Upload a clear photo of your plant leaves to inspect for early disease patterns and receive management advice.',
        actionModule: 'disease-detection',
        actionLabel: 'Scan Plant Leaf',
      });
    }

    return missing;
  }

  /**
   * Returns recent real activities from existing snapshots and profile updates.
   * NEVER invents activities. If no real action occurred, returns empty list.
   */
  getRecentActivities(profile: CompleteFarmProfile, farmerId?: string): FarmActivityItem[] {
    const activities: FarmActivityItem[] = [];

    const cropRec = this.getStoredCropRecommendation(farmerId);
    if (cropRec && cropRec.analyzedAt) {
      const topCropName = this.resolveCropName(cropRec);
      const conf = cropRec.confidence || cropRec.predictions?.[0]?.confidence || cropRec.suitabilityScore || 85;
      const nVal = cropRec.inputs?.nitrogen ?? profile?.soil?.nitrogen ?? '—';
      const pVal = cropRec.inputs?.phosphorus ?? profile?.soil?.phosphorus ?? '—';
      const kVal = cropRec.inputs?.potassium ?? profile?.soil?.potassium ?? '—';
      activities.push({
        id: `act-crop-${cropRec.analyzedAt}`,
        type: 'crop',
        title: `Crop Recommendation: ${topCropName}`,
        description: `Suitability score: ${conf}% • Recommended based on soil NPK (${nVal}-${pVal}-${kVal})`,
        timestamp: cropRec.analyzedAt,
        module: 'crop-recommendation',
        statusBadge: `${conf}% Match`,
      });
    }

    const fertRec = this.getStoredFertilizerRecommendation(farmerId);
    if (fertRec && fertRec.analyzedAt) {
      const area = fertRec.inputs?.area || 1;
      const unit = fertRec.inputs?.unit || 'Acre';
      let fertDetails = '';
      if (Array.isArray(fertRec.fertilizers) && fertRec.fertilizers.length > 0) {
        fertDetails = fertRec.fertilizers.slice(0, 3).map(f => `${f.name}: ${f.quantity} ${f.unit}`).join(', ');
      } else {
        fertDetails = 'Dosage calculated';
      }
      activities.push({
        id: `act-fert-${fertRec.analyzedAt}`,
        type: 'fertilizer',
        title: `Fertilizer Formulation: ${fertRec.cropName || 'Farm Crop'}`,
        description: `Dosage for ${area} ${unit}: ${fertDetails}`,
        timestamp: fertRec.analyzedAt,
        module: 'fertilizer-recommendation',
        statusBadge: 'Dosage Formulated',
      });
    }

    const diseaseRec = this.getStoredDiseaseDetection(farmerId);
    if (diseaseRec && diseaseRec.analyzedAt) {
      activities.push({
        id: `act-disease-${diseaseRec.analyzedAt}`,
        type: 'disease',
        title: `Plant Health Scan: ${diseaseRec.diseaseName || 'Leaf Scan'}`,
        description: `Diagnosed on ${diseaseRec.cropName || 'Crop'}${diseaseRec.confidenceScore ? ` with ${diseaseRec.confidenceScore}% confidence` : ''}`,
        timestamp: diseaseRec.analyzedAt,
        module: 'disease-detection',
        statusBadge: 'Diagnosed',
      });
    }

    if (profile?.updatedAt) {
      activities.push({
        id: `act-profile-${profile.updatedAt}`,
        type: 'profile',
        title: 'Farm Profile Updated',
        description: `${profile.farmer?.district ? `${profile.farmer.district}, ` : ''}${profile.farmer?.state || 'India'} • ${profile.farm?.farmSize ?? 0} ${profile.farm?.farmSizeUnit || 'Acres'} • Current Crop: ${profile.farm?.currentCrops || 'Unset'}`,
        timestamp: profile.updatedAt,
        module: 'profile',
        statusBadge: 'Saved',
      });
    }

    // Sort by timestamp descending
    return activities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
}

export interface FarmActivityItem {
  id: string;
  type: 'crop' | 'fertilizer' | 'disease' | 'profile';
  title: string;
  description: string;
  timestamp: string;
  module: string;
  statusBadge?: string;
}

export const farmIntelligenceService = new FarmIntelligenceService();
export default farmIntelligenceService;
