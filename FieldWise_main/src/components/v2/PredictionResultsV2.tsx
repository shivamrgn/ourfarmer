import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Award,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Droplets,
  FlaskConical,
  Scale,
  Sparkles,
  Sprout,
  TrendingUp,
  Waves,
  ShieldCheck,
  Info,
  Calendar,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { V2PredictResponse, V2EngineData, V2CropRecommendation } from '@/types/v2Prediction';
import { V2ApiError } from '@/lib/api';

interface PredictionResultsV2Props {
  response: V2PredictResponse | null;
  error: V2ApiError | Error | null;
  onRetry?: () => void;
}

export function PredictionResultsV2({ response, error, onRetry }: PredictionResultsV2Props) {
  const [expandedCrop, setExpandedCrop] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState<boolean>(false);

  const recommendations = response?.data?.recommendations;

  // When recommendations become available, select the first crop only if no valid crop is currently expanded.
  // Preserves existing user selection on subsequent renders and handles empty arrays safely.
  useEffect(() => {
    if (recommendations && recommendations.length > 0) {
      setExpandedCrop((current) => {
        if (current && recommendations.some((r) => r.crop_id === current)) {
          return current;
        }
        return recommendations[0].crop_id;
      });
    } else {
      setExpandedCrop(null);
    }
  }, [recommendations]);

  // ── 1. Error Display ────────────────────────────────────────────────────────
  if (error) {
    const apiErr = error as V2ApiError;
    const status = apiErr.status || 0;
    const code = apiErr.code || 'UNKNOWN_ERROR';
    const message = apiErr.message || 'An error occurred while communicating with the recommendation engine.';

    let errorCategory = 'Server / Engine Error';
    let guidance = 'Please review your inputs or try again later.';

    if (status === 401) {
      errorCategory = 'Authentication Required / Session Expired (HTTP 401)';
      guidance = 'Your session has expired or authentication is invalid. Please log in again to save recommendations to your farm history.';
    } else if (status === 400) {
      errorCategory = 'Input Type / Schema Violation (HTTP 400)';
      guidance = 'Please verify that all numeric fields contain valid numbers, sowing month is an integer between 1 and 12, and duration values are positive integers.';
    } else if (status === 422) {
      errorCategory = 'Agronomic Rule Rejection (HTTP 422)';
      guidance = 'The recommendation engine rejected this specific combination of agronomic inputs (e.g. conflicting rainfall period types or impossible soil parameters).';
    } else if (status === 502) {
      errorCategory = 'Engine Output Validation Gateway Error (HTTP 502)';
      guidance = 'The recommendation engine returned an unparseable response, oversized buffer, or output violating the frozen contract.';
    } else if (status === 503) {
      errorCategory = 'Recommendation Engine Unavailable (HTTP 503)';
      guidance = 'The Python execution environment or recommendation engine CLI process could not be spawned on the server.';
    } else if (status === 504) {
      errorCategory = 'Execution Timeout (HTTP 504)';
      guidance = 'The recommendation engine exceeded its maximum execution time window (10,000 ms) and was terminated.';
    } else if (code === 'NETWORK_ERROR' || status === 0) {
      errorCategory = 'Network Connection Error';
      guidance = 'Could not reach the FieldWise V2 backend API server. Please check your network connection.';
    }

    return (
      <Card className="border-2 border-red-300 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5 text-red-700 dark:text-red-400">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <div>
              <CardTitle className="text-base font-bold">{errorCategory}</CardTitle>
              <CardDescription className="text-xs text-red-800/80 dark:text-red-300/80">
                Code: <code className="font-mono">{code}</code> | Status: {status || 'Connection Refused'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 text-xs font-mono text-red-900 dark:text-red-200 whitespace-pre-wrap">
            {message}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300">{guidance}</p>
          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="border-red-300 text-red-700 dark:text-red-300 hover:bg-red-100/50"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Retry Analysis
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── 2. Empty Initial State ──────────────────────────────────────────────────
  if (!response || !response.data) {
    return (
      <Card className="border-dashed border-2 border-gray-200 dark:border-gray-800 p-8 text-center bg-gray-50/40 dark:bg-gray-900/20">
        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <Sprout className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
          No V2 Engine Analysis Run Yet
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Select your planned sowing month, verify water and edaphic inputs in the form above, and click
          &quot;Evaluate Crops with Engine V2&quot; to inspect multi-factorial agronomic suitability.
        </p>
      </Card>
    );
  }

  const data: V2EngineData = response.data;
  const status = data.status;
  const summary = data.query_summary;
  const recs = data.recommendations || [];
  const excluded = data.excluded_candidates || [];

  // ── 3. INSUFFICIENT_DATA Presentation ───────────────────────────────────────
  if (status === 'INSUFFICIENT_DATA') {
    return (
      <Card className="border-2 border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm overflow-hidden">
        <CardHeader className="bg-amber-100/60 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800 pb-3">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Evaluation Inconclusive • Engine Status: INSUFFICIENT_DATA
              </div>
              <CardTitle className="text-lg font-bold">
                Insufficient Data for Reliable Agronomic Evaluation
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800/80 space-y-2">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
              Diagnostic Reason
            </h4>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {data.diagnostics?.reason ||
                'Missing critical seasonal water availability or soil parameters preventing reliable gate evaluation.'}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              In accordance with agronomic safety standards, the recommendation engine refuses to guess or manufacture
              crop recommendations without adequate moisture or edaphic data. Zero crops have been recommended.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Data Completeness Index (DCI): </span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{summary?.data_completeness_index ?? 0}%</span>
              <Progress value={summary?.data_completeness_index ?? 0} className="h-1.5 mt-2" />
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Actionable Suggestions: </span>
              <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                Provide either your estimated seasonal crop-growth rainfall or select your irrigation infrastructure access.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── 4. NO_RECOMMENDATION_SUITABLE Presentation ─────────────────────────────
  if (status === 'NO_RECOMMENDATION_SUITABLE') {
    return (
      <Card className="border-2 border-orange-300 dark:border-orange-800 bg-orange-50/40 dark:bg-orange-950/20 shadow-sm overflow-hidden">
        <CardHeader className="bg-orange-100/60 dark:bg-orange-900/40 border-b border-orange-200 dark:border-orange-800 pb-3">
          <div className="flex items-center gap-2.5 text-orange-900 dark:text-orange-200">
            <AlertCircle className="h-6 w-6 shrink-0 text-orange-600" />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
                Tier 1 / Threshold Gate • Engine Status: NO_RECOMMENDATION_SUITABLE
              </div>
              <CardTitle className="text-lg font-bold">
                No Crops Met Agronomic Viability Threshold Under Current Conditions
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            All evaluated candidate crops failed strict physiological survival criteria (Tier 1 agronomic gates) or scored
            below the minimum viability threshold (40.0 / 100). Zero viable crops are recommended to protect the farmer against
            preventable crop failure.
          </p>

          {/* Land Reclamation Advisory */}
          {data.land_reclamation_advisory && (
            <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-800 space-y-1.5">
              <h4 className="text-xs font-bold text-orange-900 dark:text-orange-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-orange-600" />
                Authoritative Land Reclamation &amp; Management Advisory
              </h4>
              <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white leading-relaxed">
                {data.land_reclamation_advisory}
              </p>
            </div>
          )}

          {/* Candidate Evaluations Below Threshold */}
          {recs.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Evaluated Crops Scoring Below Viability Threshold (&lt; 40.0)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recs.map((c) => (
                  <div
                    key={c.crop_id}
                    className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">{c.canonical_name}</span>
                    <Badge variant="outline" className="text-orange-700 dark:text-orange-300 border-orange-300">
                      Suitability: {c.suitability_score.toFixed(1)} / 100 (Unviable)
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── 5. SUCCESS Presentation ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Metadata & Governance Banner ── */}
      <Card className="border border-emerald-200 dark:border-emerald-800 shadow-sm overflow-hidden">
        <CardHeader className="bg-emerald-50/70 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-800 py-3 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                V2
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>Agronomic Recommendations</span>
                  <Badge className="bg-emerald-600 text-white text-[10px]">SUCCESS</Badge>
                </CardTitle>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Engine Version: {data.engine_version} • Evaluated: {summary?.location || 'Unknown'} (
                  {summary?.season || 'Season'} Season)
                </p>
              </div>
            </div>

            {/* DCI & Provenance Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[11px] border-emerald-300 text-emerald-800 dark:text-emerald-200 bg-white dark:bg-gray-900">
                <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                DCI: {summary?.data_completeness_index?.toFixed(0)}%
              </Badge>
              <Badge variant="outline" className="text-[11px] border-sky-300 text-sky-800 dark:text-sky-200 bg-white dark:bg-gray-900">
                <ShieldCheck className="h-3 w-3 mr-1 text-sky-600" />
                Evidence Tier: {summary?.evidence_confidence_tier || 'FARMER_DECLARED'}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4 bg-emerald-50/30 dark:bg-emerald-950/10 text-[11px] text-gray-600 dark:text-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-emerald-100 dark:border-emerald-800/60">
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>
              <strong>Suitability Score Meaning:</strong> Reflects multi-factorial agronomic compatibility under evaluated
              soil, moisture, and temperature limits. It is <em>not</em> a statistical probability or certainty metric.
            </span>
          </div>
          <span className="text-[10px] text-gray-400 shrink-0">
            Water Regime: {summary?.water_regime_evaluated || 'Evaluated'}
          </span>
        </CardContent>
      </Card>

      {/* ── Recommended Crops Cards ── */}
      <div className="space-y-4">
        {recs.map((rec: V2CropRecommendation, index: number) => {
          const isExpanded = expandedCrop === rec.crop_id;
          const isBestMatch = index === 0;

          return (
            <Card
              key={rec.crop_id}
              className={`border-2 transition-all duration-200 shadow-sm overflow-hidden ${
                isBestMatch
                  ? 'border-emerald-500 shadow-emerald-500/10'
                  : 'border-gray-200 dark:border-gray-800 hover:border-emerald-300'
              }`}
            >
              {/* Crop Header */}
              <CardHeader
                className="p-4 sm:p-5 cursor-pointer bg-white dark:bg-gray-900 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                onClick={() => setExpandedCrop(isExpanded ? null : rec.crop_id)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-xl shadow-sm">
                      {isBestMatch ? '🥇' : `#${index + 1}`}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
                          {rec.canonical_name}
                        </CardTitle>
                        {isBestMatch && (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-semibold">
                            Best Agronomic Match
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] text-gray-500">
                          Tier 1: {rec.tier1_status || 'PASS'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Evaluated for {summary?.season} season planting
                      </p>
                    </div>
                  </div>

                  {/* Suitability Score Box */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                    <div className="text-left sm:text-right">
                      <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                        {rec.suitability_score.toFixed(1)}{' '}
                        <span className="text-xs font-normal text-gray-500">/ 100</span>
                      </div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                        Agronomic Suitability
                      </div>
                    </div>

                    <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* Suitability Meter Bar */}
                <div className="mt-3">
                  <Progress value={rec.suitability_score} className="h-2 bg-gray-100 dark:bg-gray-800" />
                </div>
              </CardHeader>

              {/* Crop Details (Expanded) */}
              {isExpanded && (
                <CardContent className="p-4 sm:p-6 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 space-y-5">
                  {/* Water Assessment Panel */}
                  {rec.water_assessment && (
                    <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-sky-100 dark:border-sky-900 shadow-2xs space-y-2">
                      <h4 className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Droplets className="h-3.5 w-3.5 text-sky-600" />
                        Crop Water Balance Assessment
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-2.5 rounded-lg bg-sky-50/60 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900">
                          <div className="text-[10px] text-gray-500">Crop Water Demand</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">
                            {rec.water_assessment.crop_water_demand_mm?.toFixed(0) ?? 'N/A'} mm
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-sky-50/60 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900">
                          <div className="text-[10px] text-gray-500">Effective Water Available</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">
                            {rec.water_assessment.effective_water_available_mm?.toFixed(0) ?? 'N/A'} mm
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-sky-50/60 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900">
                          <div className="text-[10px] text-gray-500">Water Balance Ratio</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">
                            {rec.water_assessment.water_balance_ratio?.toFixed(2) ?? 'N/A'}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-sky-50/60 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900">
                          <div className="text-[10px] text-gray-500">Net Irrigation Needed</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">
                            {rec.water_assessment.irrigation_requirement_net_mm?.toFixed(0) ?? '0'} mm
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fertilizer Guidance Panel (Baseline RDF Arithmetic) */}
                  {rec.fertilizer_prescription && (
                    <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-teal-100 dark:border-teal-900 shadow-2xs space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                          <FlaskConical className="h-3.5 w-3.5 text-teal-600" />
                          Nutrient Requirements &amp; Fertilizer Guidance
                        </h4>
                        <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                          Status: {rec.fertilizer_prescription.status} (Farmer-Declared)
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                        <div className="p-2.5 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900 text-center">
                          <div className="text-[10px] text-gray-500 font-semibold">Nitrogen (N)</div>
                          <div className="text-base font-bold text-teal-700 dark:text-teal-300">
                            {rec.fertilizer_prescription.nitrogen_kg_ha?.toFixed(0) ?? '0'}{' '}
                            <span className="text-[10px] font-normal text-gray-500">kg/ha</span>
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900 text-center">
                          <div className="text-[10px] text-gray-500 font-semibold">Phosphorus (P)</div>
                          <div className="text-base font-bold text-teal-700 dark:text-teal-300">
                            {rec.fertilizer_prescription.phosphorus_kg_ha?.toFixed(0) ?? '0'}{' '}
                            <span className="text-[10px] font-normal text-gray-500">kg/ha</span>
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900 text-center">
                          <div className="text-[10px] text-gray-500 font-semibold">Potassium (K)</div>
                          <div className="text-base font-bold text-teal-700 dark:text-teal-300">
                            {rec.fertilizer_prescription.potassium_kg_ha?.toFixed(0) ?? '0'}{' '}
                            <span className="text-[10px] font-normal text-gray-500">kg/ha</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-500 dark:text-gray-400 pt-1">
                        Calculation basis: Standard state university Recommended Dose of Fertilizer (RDF) soil-test adjustment
                        arithmetic based on farmer-declared soil test values. STCR target-yield equations require registered calibration records.
                      </p>
                    </div>
                  )}

                  {/* Reference Yield Range (Only where supplied by engine, NEVER point estimate) */}
                  {rec.yield_range && Array.isArray(rec.yield_range) && (
                    <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs flex items-center justify-between">
                      <span className="text-gray-500">Reference Expected Yield Range:</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {rec.yield_range[0]} – {rec.yield_range[1]} t/ha (Indicative range; not a guaranteed point estimate)
                      </span>
                    </div>
                  )}

                  {/* Agronomic Warnings & Risks */}
                  {rec.risk_warnings && rec.risk_warnings.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>Agronomic Risk Notices &amp; Warnings:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                        {rec.risk_warnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* ── Excluded Candidates Accordion ── */}
      {excluded.length > 0 && (
        <Card className="border border-gray-200 dark:border-gray-800 overflow-hidden shadow-2xs">
          <CardHeader
            className="p-4 cursor-pointer bg-gray-50/70 dark:bg-gray-900/40 hover:bg-gray-100/60 dark:hover:bg-gray-800/40 transition-colors"
            onClick={() => setShowExcluded(!showExcluded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-gray-500" />
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Why Other Crops Were Not Recommended ({excluded.length} candidate crops excluded)
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{showExcluded ? 'Hide' : 'Show details'}</span>
                {showExcluded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
              </div>
            </div>
          </CardHeader>

          {showExcluded && (
            <CardContent className="p-4 space-y-2.5 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[11px] text-gray-500 mb-2">
                Candidates that failed Tier 1 physiological gates (e.g. extreme thermal stress, severe soil reaction limits,
                or critical water deficits).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {excluded.map((cand) => (
                  <div
                    key={cand.crop_id}
                    className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 dark:text-white">{cand.canonical_name}</span>
                      <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50 dark:bg-red-950/40">
                        {cand.tier1_status}
                      </Badge>
                    </div>
                    {cand.failing_rules && cand.failing_rules.length > 0 && (
                      <p className="text-[11px] text-gray-600 dark:text-gray-400">
                        {cand.failing_rules.map((r) => r.reason).join('; ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

export default PredictionResultsV2;
