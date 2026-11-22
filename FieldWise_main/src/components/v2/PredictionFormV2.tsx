import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CloudRain,
  Thermometer,
  Droplets,
  Mountain,
  FlaskConical,
  Loader2,
  Sparkles,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Waves,
  ShieldCheck,
  Info,
  Scale,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { farmProfileService, CompleteFarmProfile } from '@/services/farmProfileService';
import { V2PredictRequest, V2FormValues, V2IrrigationAccess, V2RainfallPeriodType } from '@/types/v2Prediction';

interface PredictionFormV2Props {
  onSubmit: (payload: V2PredictRequest) => void;
  isLoading: boolean;
  user?: any;
  initialValues?: Partial<V2FormValues>;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

const SOIL_TEXTURES = [
  'Clay Loam', 'Sandy Loam', 'Loam', 'Clay', 'Sandy', 'Black', 'Alluvial',
];

const SOWING_MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const isNumeric = (val: unknown): val is number =>
  typeof val === 'number' && !isNaN(val) && isFinite(val);

/**
 * Safely serializes optional numeric inputs.
 * - null, undefined, or empty/whitespace string serialize strictly as null.
 * - Legitimate 0 and negative finite numbers serialize as numbers.
 * - Invalid nonblank strings (e.g. 'abc') or non-finite numbers serialize as NaN
 *   so existing validation rules catch them rather than silently converting to zero or null.
 */
export function serializeOptionalNumeric(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return null;
    const num = Number(trimmed);
    return isFinite(num) ? num : NaN;
  }
  if (typeof val === 'number') {
    return isFinite(val) ? val : NaN;
  }
  return NaN;
}

/**
 * Safely serializes optional string inputs.
 * - null, undefined, or empty/whitespace string serialize strictly as null.
 * - Non-empty string serializes trimmed.
 */
export function serializeOptionalString(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return String(val);
}

/**
 * Safely serializes tri-state boolean has_soil_test.
 * - true -> true
 * - false -> false
 * - null or undefined -> null
 */
export function serializeOptionalBoolean(val: unknown): boolean | null {
  if (val === true) return true;
  if (val === false) return false;
  return null;
}

/**
 * Pure request builder for Engine V2.
 * Serializes optional inputs to null without introducing fabricated defaults.
 */
export function buildV2PredictRequest(formData: Partial<V2FormValues>): V2PredictRequest {
  const sowingMonthVal = serializeOptionalNumeric(formData.sowing_month);
  const irriPeriodVal = serializeOptionalNumeric(formData.irrigation_period_days);
  const rainPeriodVal = serializeOptionalNumeric(formData.rainfall_period_days);

  return {
    state: (formData.state || '').trim(),
    sowing_month: sowingMonthVal !== null && !isNaN(sowingMonthVal) ? sowingMonthVal : (sowingMonthVal as any),
    district: serializeOptionalString(formData.district),
    agro_climatic_zone: serializeOptionalString(formData.agro_climatic_zone),
    cultivation_season: serializeOptionalString(formData.cultivation_season),

    // Edaphic
    soil_ph: serializeOptionalNumeric(formData.soil_ph),
    soil_texture: serializeOptionalString(formData.soil_texture),
    has_soil_test: serializeOptionalBoolean(formData.has_soil_test),
    nitrogen: serializeOptionalNumeric(formData.nitrogen),
    phosphorus: serializeOptionalNumeric(formData.phosphorus),
    potassium: serializeOptionalNumeric(formData.potassium),
    organic_carbon: serializeOptionalNumeric(formData.organic_carbon),
    nutrient_basis: serializeOptionalString(formData.nutrient_basis),

    // Climate & Water
    irrigation_access: (serializeOptionalString(formData.irrigation_access) as V2IrrigationAccess) || null,
    irrigation_water_quantity_mm: serializeOptionalNumeric(formData.irrigation_water_quantity_mm),
    irrigation_period_days: irriPeriodVal !== null && !isNaN(irriPeriodVal) ? Math.round(irriPeriodVal) : null,

    seasonal_rainfall_amount: serializeOptionalNumeric(formData.seasonal_rainfall_amount),
    annual_rainfall: serializeOptionalNumeric(formData.annual_rainfall),
    rainfall_period_type: (serializeOptionalString(formData.rainfall_period_type) as V2RainfallPeriodType) || null,
    rainfall_period_days: rainPeriodVal !== null && !isNaN(rainPeriodVal) ? Math.round(rainPeriodVal) : null,

    temperature: serializeOptionalNumeric(formData.temperature),
    temperature_min_night: serializeOptionalNumeric(formData.temperature_min_night),
    temperature_max_day: serializeOptionalNumeric(formData.temperature_max_day),
    humidity: serializeOptionalNumeric(formData.humidity),
  };
}

export function PredictionFormV2({ onSubmit, isLoading, user, initialValues }: PredictionFormV2Props) {
  // Safe unselected initialization:
  // State and Sowing month start strictly unselected (required for submission).
  // All environmental and edaphic fields start null/unselected when not explicitly supplied.
  // Missing irrigation access starts strictly null (UNKNOWN).
  // has_soil_test starts strictly unchecked (false, USER_DECLARED).
  const [formData, setFormData] = useState<V2FormValues>(() => ({
    state: initialValues?.state ?? '',
    district: initialValues?.district ?? '',
    agro_climatic_zone: initialValues?.agro_climatic_zone ?? '',
    sowing_month: initialValues?.sowing_month !== undefined ? initialValues.sowing_month : null,
    cultivation_season: initialValues?.cultivation_season ?? '',

    irrigation_access: initialValues?.irrigation_access !== undefined ? initialValues.irrigation_access : null,
    irrigation_water_quantity_mm:
      initialValues?.irrigation_water_quantity_mm !== undefined ? initialValues.irrigation_water_quantity_mm : null,
    irrigation_period_days:
      initialValues?.irrigation_period_days !== undefined ? initialValues.irrigation_period_days : null,

    seasonal_rainfall_amount:
      initialValues?.seasonal_rainfall_amount !== undefined ? initialValues.seasonal_rainfall_amount : null,
    annual_rainfall: initialValues?.annual_rainfall !== undefined ? initialValues.annual_rainfall : null,
    rainfall_period_type: initialValues?.rainfall_period_type !== undefined ? initialValues.rainfall_period_type : null,
    rainfall_period_days: initialValues?.rainfall_period_days !== undefined ? initialValues.rainfall_period_days : null,

    temperature: initialValues?.temperature !== undefined ? initialValues.temperature : null,
    temperature_min_night:
      initialValues?.temperature_min_night !== undefined ? initialValues.temperature_min_night : null,
    temperature_max_day:
      initialValues?.temperature_max_day !== undefined ? initialValues.temperature_max_day : null,
    humidity: initialValues?.humidity !== undefined ? initialValues.humidity : null,

    soil_texture: initialValues?.soil_texture ?? '',
    soil_ph: initialValues?.soil_ph !== undefined ? initialValues.soil_ph : null,
    has_soil_test: initialValues?.has_soil_test !== undefined ? initialValues.has_soil_test : false,
    nitrogen: initialValues?.nitrogen !== undefined ? initialValues.nitrogen : null,
    phosphorus: initialValues?.phosphorus !== undefined ? initialValues.phosphorus : null,
    potassium: initialValues?.potassium !== undefined ? initialValues.potassium : null,
    organic_carbon: initialValues?.organic_carbon !== undefined ? initialValues.organic_carbon : null,
    nutrient_basis: initialValues?.nutrient_basis ?? '',
  }));

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [prefilledNotice, setPrefilledNotice] = useState<string | null>(null);

  // Handle Prefill from Farm Profile
  // Adheres to Phase 3C.6.3.1 safety rules:
  // - Never replace missing profile values with fabricated defaults.
  // - Preserve zero as a valid supplied numeric value; do not use value || fallback.
  // - Sowing month remains unselected (null).
  // - Soil-test declaration remains false (never infer from profile history).
  // - Irrigation remains UNKNOWN unless explicit supported type exists.
  // - Do not infer nutrient reporting basis from presence of NPK numbers.
  const handlePrefillProfile = () => {
    const prof: CompleteFarmProfile = farmProfileService.getFarmProfile(user);

    setFormData((prev) => {
      // Map irrigation access ONLY if explicit supported type exists
      let mappedIrrigation: V2IrrigationAccess | null = prev.irrigation_access;
      const pIrr = prof?.farm?.irrigationType;
      if (pIrr === 'Rainfed') {
        mappedIrrigation = 'None_Rainfed';
      } else if (pIrr === 'Drip') {
        mappedIrrigation = 'Drip';
      } else if (pIrr === 'Sprinkler') {
        mappedIrrigation = 'Sprinkler';
      } else if (pIrr === 'Canal') {
        mappedIrrigation = 'Canal';
      } else if (pIrr === 'Borewell / Tube-well') {
        mappedIrrigation = 'Tubewell_Borewell';
      }

      const pState = prof?.farmer?.state?.trim();
      const pDist = prof?.farmer?.district?.trim();
      const pZone = prof?.conditions?.agroZone?.trim();
      const pSoil = prof?.soil?.soilType;

      return {
        ...prev,
        // State & Geography
        state: pState && INDIAN_STATES.includes(pState) ? pState : prev.state,
        district: pDist || prev.district,
        agro_climatic_zone: pZone || prev.agro_climatic_zone,

        // Sowing month remains strictly unselected per safety invariant
        sowing_month: prev.sowing_month,

        // Irrigation: explicit supported mapping or remain null (UNKNOWN)
        irrigation_access: mappedIrrigation,

        // Annual rainfall stored as annual context ONLY, never mapped to seasonal
        annual_rainfall: isNumeric(prof?.conditions?.rainfall) ? prof.conditions.rainfall : prev.annual_rainfall,

        // Climate: preserve legitimate 0, never replace missing with defaults
        temperature: isNumeric(prof?.conditions?.temperature) ? prof.conditions.temperature : prev.temperature,
        humidity: isNumeric(prof?.conditions?.humidity) ? prof.conditions.humidity : prev.humidity,

        // Edaphic: texture only if in supported taxonomy
        soil_texture: pSoil && SOIL_TEXTURES.includes(pSoil) ? pSoil : prev.soil_texture,
        soil_ph: isNumeric(prof?.soil?.ph) ? prof.soil.ph : prev.soil_ph,

        // Nutrients: preserve legitimate 0, never replace missing with defaults
        nitrogen: isNumeric(prof?.soil?.nitrogen) ? prof.soil.nitrogen : prev.nitrogen,
        phosphorus: isNumeric(prof?.soil?.phosphorus) ? prof.soil.phosphorus : prev.phosphorus,
        potassium: isNumeric(prof?.soil?.potassium) ? prof.soil.potassium : prev.potassium,
        organic_carbon: isNumeric(prof?.soil?.organicCarbon) ? prof.soil.organicCarbon : prev.organic_carbon,

        // Safety rules:
        // 1. has_soil_test remains false (never inferred from profile history)
        has_soil_test: false,
        // 2. nutrient_basis remains unselected (do not infer from presence of NPK numbers)
        nutrient_basis: prev.nutrient_basis,
      };
    });

    setPrefilledNotice(
      'Compatible farm profile values prefilled (user-declared). Sowing month, soil-test declaration, and nutrient reporting basis remain unselected for explicit farmer entry.'
    );
  };

  const handleReset = () => {
    setFormData({
      state: '',
      district: '',
      agro_climatic_zone: '',
      sowing_month: null,
      cultivation_season: '',
      irrigation_access: null,
      irrigation_water_quantity_mm: null,
      irrigation_period_days: null,
      seasonal_rainfall_amount: null,
      annual_rainfall: null,
      rainfall_period_type: null,
      rainfall_period_days: null,
      temperature: null,
      temperature_min_night: null,
      temperature_max_day: null,
      humidity: null,
      soil_texture: '',
      soil_ph: null,
      has_soil_test: false,
      nitrogen: null,
      phosphorus: null,
      potassium: null,
      organic_carbon: null,
      nutrient_basis: '',
    });
    setFieldErrors({});
    setGeneralError(null);
    setPrefilledNotice(null);
  };

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    const errors: Record<string, string> = {};

    // 1. Mandatory state
    if (!formData.state?.trim()) {
      errors.state = 'State / Region is required for agronomic localization.';
    }

    // 2. Mandatory sowing_month (starts unselected)
    if (formData.sowing_month === null || formData.sowing_month === undefined) {
      errors.sowing_month = 'Planned sowing month is required. Please select a month (1–12).';
    } else if (
      !Number.isInteger(formData.sowing_month) ||
      formData.sowing_month < 1 ||
      formData.sowing_month > 12
    ) {
      errors.sowing_month = 'Sowing month must be an integer between 1 and 12.';
    }

    // 3. Whole-day validation
    if (formData.irrigation_period_days !== null && formData.irrigation_period_days !== undefined) {
      if (
        !Number.isInteger(formData.irrigation_period_days) ||
        formData.irrigation_period_days <= 0
      ) {
        errors.irrigation_period_days = 'Irrigation period must be an integer greater than 0.';
      }
    }

    if (formData.rainfall_period_days !== null && formData.rainfall_period_days !== undefined) {
      if (
        !Number.isInteger(formData.rainfall_period_days) ||
        formData.rainfall_period_days <= 0
      ) {
        errors.rainfall_period_days = 'Rainfall period must be an integer greater than 0.';
      }
    }

    // 4. Edaphic bounds
    if (formData.soil_ph !== null && formData.soil_ph !== undefined) {
      if (isNaN(formData.soil_ph) || formData.soil_ph < 2.0 || formData.soil_ph > 12.0) {
        errors.soil_ph = 'Soil pH must be a finite number between 2.0 and 12.0.';
      }
    }

    if (formData.nitrogen !== null && formData.nitrogen !== undefined) {
      if (isNaN(formData.nitrogen) || formData.nitrogen < 0) {
        errors.nitrogen = 'Nitrogen cannot be negative.';
      }
    }

    if (formData.phosphorus !== null && formData.phosphorus !== undefined) {
      if (isNaN(formData.phosphorus) || formData.phosphorus < 0) {
        errors.phosphorus = 'Phosphorus cannot be negative.';
      }
    }

    if (formData.potassium !== null && formData.potassium !== undefined) {
      if (isNaN(formData.potassium) || formData.potassium < 0) {
        errors.potassium = 'Potassium cannot be negative.';
      }
    }

    if (formData.seasonal_rainfall_amount !== null && formData.seasonal_rainfall_amount !== undefined) {
      if (isNaN(formData.seasonal_rainfall_amount) || formData.seasonal_rainfall_amount < 0) {
        errors.seasonal_rainfall_amount = 'Seasonal rainfall cannot be negative.';
      }
    }

    if (formData.annual_rainfall !== null && formData.annual_rainfall !== undefined) {
      if (isNaN(formData.annual_rainfall) || formData.annual_rainfall < 0) {
        errors.annual_rainfall = 'Annual rainfall cannot be negative.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setGeneralError('Please resolve the highlighted validation errors before submission.');
      return;
    }

    setFieldErrors({});

    // Build strict JSON typed V2 request payload using safe null-preserving serializer
    const payload: V2PredictRequest = buildV2PredictRequest(formData);

    onSubmit(payload);
  };

  return (
    <Card className="border border-emerald-200 dark:border-emerald-800 shadow-sm overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border-b border-emerald-100 dark:border-emerald-800 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 mb-1">
              <Sparkles className="h-3 w-3" />
              <span>Phase 3C.6 Engine V2 Interface</span>
            </div>
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
              Agronomic Decision Input Form
            </CardTitle>
            <CardDescription className="text-xs text-gray-600 dark:text-gray-400">
              Provide seasonal moisture, soil reaction, and environmental parameters for multi-factorial evaluation.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrefillProfile}
              className="text-xs border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
            >
              Prefill Compatible Farm Profile
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {prefilledNotice && (
          <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>{prefilledNotice}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-6">
        <form onSubmit={validateAndSubmit} noValidate className="space-y-6">
          {/* ── 1. LOCATION & TEMPORAL SOWING WINDOW ── */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <Mountain className="h-4 w-4 text-emerald-600" />
              Location &amp; Planned Sowing Period (Mandatory)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* State */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-state" className="text-xs font-semibold">
                  State / Region <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.state}
                  onValueChange={(val) => setFormData((p) => ({ ...p, state: val }))}
                >
                  <SelectTrigger id="v2-state" className="h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Select Indian State" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.state && (
                  <p className="text-[11px] text-red-600 font-medium">{fieldErrors.state}</p>
                )}
              </div>

              {/* District */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-district" className="text-xs font-semibold">
                  District <span className="text-gray-400 font-normal">(Optional)</span>
                </Label>
                <Input
                  id="v2-district"
                  type="text"
                  placeholder="e.g. Ludhiana"
                  value={formData.district}
                  onChange={(e) => setFormData((p) => ({ ...p, district: e.target.value }))}
                  className="h-10 text-xs sm:text-sm"
                />
              </div>

              {/* Planned Sowing Month (Mandatory, starts unselected) */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-sowing-month" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Planned Sowing Month <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.sowing_month !== null ? String(formData.sowing_month) : ''}
                  onValueChange={(val) =>
                    setFormData((p) => ({ ...p, sowing_month: val ? parseInt(val, 10) : null }))
                  }
                >
                  <SelectTrigger
                    id="v2-sowing-month"
                    className={`h-10 text-xs sm:text-sm ${
                      formData.sowing_month === null ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <SelectValue placeholder="Select sowing month..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SOWING_MONTHS.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m.value} — {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.sowing_month ? (
                  <p className="text-[11px] text-red-600 font-medium">{fieldErrors.sowing_month}</p>
                ) : (
                  <p className="text-[10px] text-gray-500">Unselected by default. Must be explicitly chosen.</p>
                )}
              </div>

              {/* Cultivation Season */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-season" className="text-xs font-semibold">
                  Cultivation Season <span className="text-gray-400 font-normal">(Optional)</span>
                </Label>
                <Select
                  value={formData.cultivation_season}
                  onValueChange={(val) => setFormData((p) => ({ ...p, cultivation_season: val }))}
                >
                  <SelectTrigger id="v2-season" className="h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Auto-derive or select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kharif">Kharif (Monsoon)</SelectItem>
                    <SelectItem value="Rabi">Rabi (Winter)</SelectItem>
                    <SelectItem value="Zaid">Zaid (Summer)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── 2. WATER & IRRIGATION REGIME (Water Safety Governance) ── */}
          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Waves className="h-4 w-4 text-sky-600" />
                Water Regime &amp; Irrigation Infrastructure
              </h3>
              <span className="text-[11px] text-gray-400">
                Missing irrigation stays UNKNOWN; explicit rainfed is farmer-declared.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Irrigation Access */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="v2-irrigation" className="text-xs font-semibold">
                  Irrigation Access / Infrastructure
                </Label>
                <Select
                  value={formData.irrigation_access || 'UNKNOWN'}
                  onValueChange={(val) =>
                    setFormData((p) => ({
                      ...p,
                      irrigation_access: val === 'UNKNOWN' ? null : (val as V2IrrigationAccess),
                    }))
                  }
                >
                  <SelectTrigger id="v2-irrigation" className="h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Select irrigation access" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNKNOWN">-- Select Access (Default: Unknown) --</SelectItem>
                    <SelectItem value="None_Rainfed">None / Rainfed (Farmer-Declared Rainfed)</SelectItem>
                    <SelectItem value="Canal">Canal Irrigation</SelectItem>
                    <SelectItem value="Tubewell_Borewell">Tubewell / Borewell</SelectItem>
                    <SelectItem value="Drip">Drip Irrigation System</SelectItem>
                    <SelectItem value="Sprinkler">Sprinkler Irrigation System</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-gray-500">
                  Selecting None explicitly marks land rainfed; leaving unselected preserves unknown status.
                </p>
              </div>

              {/* Irrigation Depth */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-irr-depth" className="text-xs font-semibold">
                  Irrigation Water Depth
                </Label>
                <div className="relative">
                  <Input
                    id="v2-irr-depth"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="e.g. 100"
                    value={formData.irrigation_water_quantity_mm ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        irrigation_water_quantity_mm: e.target.value !== '' ? parseFloat(e.target.value) : null,
                      }))
                    }
                    className="h-10 text-xs sm:text-sm pr-10"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">mm</span>
                </div>
              </div>

              {/* Irrigation Period Days (Strict whole-day integer) */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-irr-days" className="text-xs font-semibold">
                  Irrigation Duration
                </Label>
                <div className="relative">
                  <Input
                    id="v2-irr-days"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="e.g. 90"
                    value={formData.irrigation_period_days ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        irrigation_period_days: e.target.value !== '' ? parseInt(e.target.value, 10) : null,
                      }))
                    }
                    className="h-10 text-xs sm:text-sm pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">days</span>
                </div>
                {fieldErrors.irrigation_period_days && (
                  <p className="text-[11px] text-red-600 font-medium">{fieldErrors.irrigation_period_days}</p>
                )}
              </div>
            </div>

            {/* Rainfall Inputs (Strict separation: Seasonal vs Annual) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {/* Seasonal Rainfall Amount */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-seasonal-rain" className="text-xs font-semibold text-sky-700 dark:text-sky-400">
                  Seasonal Rainfall (Crop Season)
                </Label>
                <div className="relative">
                  <Input
                    id="v2-seasonal-rain"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="e.g. 250"
                    value={formData.seasonal_rainfall_amount ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        seasonal_rainfall_amount: e.target.value !== '' ? parseFloat(e.target.value) : null,
                      }))
                    }
                    className="h-10 text-xs sm:text-sm pr-10"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">mm</span>
                </div>
                <p className="text-[10px] text-sky-600 dark:text-sky-400">
                  Crop-season depth only. Used in USDA-SCS effective moisture math.
                </p>
                {fieldErrors.seasonal_rainfall_amount && (
                  <p className="text-[11px] text-red-600 font-medium">{fieldErrors.seasonal_rainfall_amount}</p>
                )}
              </div>

              {/* Annual Rainfall Context */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-annual-rain" className="text-xs font-semibold">
                  Annual Rainfall (Macro Context)
                </Label>
                <div className="relative">
                  <Input
                    id="v2-annual-rain"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="e.g. 650"
                    value={formData.annual_rainfall ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        annual_rainfall: e.target.value !== '' ? parseFloat(e.target.value) : null,
                      }))
                    }
                    className="h-10 text-xs sm:text-sm pr-10"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">mm</span>
                </div>
                <p className="text-[10px] text-gray-500">
                  Annual total. Stored for macro context; never applied to seasonal balance.
                </p>
                {fieldErrors.annual_rainfall && (
                  <p className="text-[11px] text-red-600 font-medium">{fieldErrors.annual_rainfall}</p>
                )}
              </div>

              {/* Rainfall Period Classification */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-rain-period-type" className="text-xs font-semibold">
                  Rainfall Period Source
                </Label>
                <Select
                  value={formData.rainfall_period_type || 'NONE'}
                  onValueChange={(val) =>
                    setFormData((p) => ({
                      ...p,
                      rainfall_period_type: val === 'NONE' ? null : (val as V2RainfallPeriodType),
                    }))
                  }
                >
                  <SelectTrigger id="v2-rain-period-type" className="h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Period Classification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">-- Unclassified / General --</SelectItem>
                    <SelectItem value="Crop_Season_Measured">Crop_Season_Measured (On-farm gauge)</SelectItem>
                    <SelectItem value="Seasonal_Estimated">Seasonal_Estimated (Local forecast)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-gray-500">Establishes evidence provenance tier.</p>
              </div>

              {/* Rainfall Period Days */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-rain-days" className="text-xs font-semibold">
                  Rainfall Period Duration
                </Label>
                <div className="relative">
                  <Input
                    id="v2-rain-days"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="e.g. 120"
                    value={formData.rainfall_period_days ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        rainfall_period_days: e.target.value !== '' ? parseInt(e.target.value, 10) : null,
                      }))
                    }
                    className="h-10 text-xs sm:text-sm pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">days</span>
                </div>
                {fieldErrors.rainfall_period_days && (
                  <p className="text-[11px] text-red-600 font-medium">{fieldErrors.rainfall_period_days}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── 3. CLIMATE & ATMOSPHERE ── */}
          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-amber-600" />
              Thermal &amp; Atmospheric Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Mean Temperature */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-temp" className="text-xs font-semibold">
                  Mean Temperature
                </Label>
                <div className="relative">
                  <Input
                    id="v2-temp"
                    type="number"
                    step={0.5}
                    value={formData.temperature ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        temperature: e.target.value !== '' ? parseFloat(e.target.value) : null,
                      }))
                    }
                    className="h-10 text-xs sm:text-sm pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">°C</span>
                </div>
              </div>

              {/* Min Night Temp */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-temp-min" className="text-xs font-semibold">
                  Min Night Temperature
                </Label>
                <div className="relative">
                  <Input
                    id="v2-temp-min"
                    type="number"
                    step={0.5}
                    placeholder="e.g. 12"
                    value={formData.temperature_min_night ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        temperature_min_night: e.target.value !== '' ? parseFloat(e.target.value) : null,
                      }))
                    }
                    className="h-10 text-xs sm:text-sm pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">°C</span>
                </div>
              </div>

              {/* Max Day Temp */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-temp-max" className="text-xs font-semibold">
                  Max Day Temperature
                </Label>
                <div className="relative">
                  <Input
                    id="v2-temp-max"
                    type="number"
                    step={0.5}
                    placeholder="e.g. 36"
                    value={formData.temperature_max_day ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        temperature_max_day: e.target.value !== '' ? parseFloat(e.target.value) : null,
                      }))
                    }
                    className="h-10 text-xs sm:text-sm pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">°C</span>
                </div>
              </div>

              {/* Relative Humidity */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-humidity" className="text-xs font-semibold">
                  Relative Humidity
                </Label>
                <div className="relative">
                  <Input
                    id="v2-humidity"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={formData.humidity ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        humidity: e.target.value !== '' ? parseFloat(e.target.value) : null,
                      }))
                    }
                    className="h-10 text-xs sm:text-sm pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 4. EDAPHIC / SOIL & FERTILIZER PROVENANCE ── */}
          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-teal-600" />
                Edaphic Soil Chemistry &amp; Nutrient Provenance
              </h3>
              <span className="text-[11px] text-gray-400">
                Checkbox = Farmer-Declared availability, NOT verified lab certificate.
              </span>
            </div>

            {/* Farmer-Declared Soil Test Checkbox */}
            <div className="p-3.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 flex items-start gap-3">
              <Checkbox
                id="v2-soil-test"
                checked={formData.has_soil_test}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({ ...p, has_soil_test: Boolean(checked) }))
                }
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="v2-soil-test" className="text-xs font-bold text-teal-900 dark:text-teal-200 cursor-pointer">
                  I have conducted a soil test for this land (Farmer-Declared Soil Health Card)
                </Label>
                <p className="text-[11px] text-teal-800/80 dark:text-teal-300/80">
                  Enables baseline Recommended Dose of Fertilizer (RDF) soil adjustments. In accordance with safety rules,
                  this declaration is classified as <span className="font-semibold">USER_DECLARED</span> and does not confer
                  independently accredited laboratory verification.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Soil Texture */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-texture" className="text-xs font-semibold">
                  Soil Texture
                </Label>
                <Select
                  value={formData.soil_texture}
                  onValueChange={(val) => setFormData((p) => ({ ...p, soil_texture: val }))}
                >
                  <SelectTrigger id="v2-texture" className="h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Select Texture" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOIL_TEXTURES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Soil pH */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-ph" className="text-xs font-semibold">
                  Soil pH Level
                </Label>
                <Input
                  id="v2-ph"
                  type="number"
                  step={0.1}
                  min={2.0}
                  max={12.0}
                  value={formData.soil_ph ?? ''}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      soil_ph: e.target.value !== '' ? parseFloat(e.target.value) : null,
                    }))
                  }
                  className="h-10 text-xs sm:text-sm"
                />
                {fieldErrors.soil_ph && (
                  <p className="text-[11px] text-red-600 font-medium">{fieldErrors.soil_ph}</p>
                )}
              </div>

              {/* Nitrogen */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-n" className="text-xs font-semibold">
                  Available Nitrogen (N)
                </Label>
                <div className="relative">
                  <Input
                    id="v2-n"
                    type="number"
                    step={1}
                    min={0}
                    value={formData.nitrogen ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        nitrogen: e.target.value !== '' ? parseFloat(e.target.value) : null,
                      }))
                    }
                    className="h-10 text-xs sm:text-sm pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">kg/ha</span>
                </div>
                {fieldErrors.nitrogen && (
                  <p className="text-[11px] text-red-600 font-medium">{fieldErrors.nitrogen}</p>
                )}
              </div>

              {/* Phosphorus */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-p" className="text-xs font-semibold">
                  Available Phosphorus (P)
                </Label>
                <div className="relative">
                  <Input
                    id="v2-p"
                    type="number"
                    step={1}
                    min={0}
                    value={formData.phosphorus ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        phosphorus: e.target.value !== '' ? parseFloat(e.target.value) : null,
                      }))
                    }
                    className="h-10 text-xs sm:text-sm pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">kg/ha</span>
                </div>
                {fieldErrors.phosphorus && (
                  <p className="text-[11px] text-red-600 font-medium">{fieldErrors.phosphorus}</p>
                )}
              </div>

              {/* Potassium */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-k" className="text-xs font-semibold">
                  Available Potassium (K)
                </Label>
                <div className="relative">
                  <Input
                    id="v2-k"
                    type="number"
                    step={1}
                    min={0}
                    value={formData.potassium ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        potassium: e.target.value !== '' ? parseFloat(e.target.value) : null,
                      }))
                    }
                    className="h-10 text-xs sm:text-sm pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">kg/ha</span>
                </div>
                {fieldErrors.potassium && (
                  <p className="text-[11px] text-red-600 font-medium">{fieldErrors.potassium}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Organic Carbon */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-oc" className="text-xs font-semibold">
                  Organic Carbon (OC %)
                </Label>
                <div className="relative">
                  <Input
                    id="v2-oc"
                    type="number"
                    step={0.01}
                    min={0}
                    max={100}
                    value={formData.organic_carbon ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        organic_carbon: e.target.value !== '' ? parseFloat(e.target.value) : null,
                      }))
                    }
                    className="h-10 text-xs sm:text-sm pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-gray-400">%</span>
                </div>
              </div>

              {/* Nutrient Basis */}
              <div className="space-y-1.5">
                <Label htmlFor="v2-nutrient-basis" className="text-xs font-semibold">
                  Nutrient Reporting Basis
                </Label>
                <Select
                  value={formData.nutrient_basis}
                  onValueChange={(val) => setFormData((p) => ({ ...p, nutrient_basis: val }))}
                >
                  <SelectTrigger id="v2-nutrient-basis" className="h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Reporting Basis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHC_Available_kg_ha">SHC Available kg/ha (Standard Indian SHC)</SelectItem>
                    <SelectItem value="Elemental_kg_ha">Elemental N-P-K kg/ha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* General Error Alert */}
          {generalError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Submission Action */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-gray-500">
              Evaluated crops will be ranked by multi-factorial agronomic suitability (0–100 scale).
            </div>

            <Button
              type="submit"
              disabled={isLoading || formData.sowing_month === null || !formData.state}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 shadow-sm flex items-center justify-center gap-2 h-11"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Evaluating Agronomic Criteria with Engine V2...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Evaluate Crops with Engine V2
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default PredictionFormV2;
