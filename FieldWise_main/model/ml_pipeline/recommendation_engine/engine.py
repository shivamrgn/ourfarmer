"""
FieldWise Phase 3C.5: Crop Recommendation Engine Core Orchestrator
==================================================================
The primary entry point and orchestrator for the FieldWise 19-Crop
Rule-Based Agronomic Recommendation Engine.

Adheres strictly to Phase 3C.4.2.2.1 approved specifications:
  - 19-crop canonical catalogue single source of truth
  - Two-tier gating and non-compensatory Liebig ranking
  - Decoupled physical water accounting
  - 6-domain Data Completeness Index (DCI)
  - Explicit uncertainty and provisional status handling
  - Fertilizer safety with mandatory DAP nitrogen credit
"""

import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path

from .schemas import (
    RecommendationQuery,
    RecommendationResult,
    CropRecommendation,
    ExcludedCandidate,
    ExecutionStatus,
    Tier1Status,
    QuerySummary,
    ConfidenceTier,
)
from .catalogue import CanonicalCropCatalogue
from .input_validator import InputValidator, InputValidationError
from .planting_window import PlantingWindowResolver
from .water_assessment import WaterAssessmentModule
from .tier1_eligibility import Tier1EligibilityEvaluator
from .tier2_scoring import Tier2ScoringModule
from .dci_confidence import DCIConfidenceEvaluator
from .ranking import RecommendationRanker
from .explanations import ExplanationGenerator


class CropRecommendationEngine:
    """
    FieldWise Rule-Based Crop Recommendation Engine (Version 2.2.0-CLOSURE).
    Independently testable, pure-python, zero-dependency recommendation engine.
    """

    VERSION = "2.2.0-CLOSURE"

    def __init__(self, catalogue_path: Optional[Path] = None):
        self.catalogue = CanonicalCropCatalogue(catalogue_path=catalogue_path)

    def recommend(self, query: RecommendationQuery) -> RecommendationResult:
        """
        Executes end-to-end crop recommendation pipeline.
        """
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # 1. Validation & Normalization
        try:
            query, validation_warnings = InputValidator.validate_and_normalize(query)
        except InputValidationError as e:
            return RecommendationResult(
                status=ExecutionStatus.VALIDATION_ERROR,
                engine_version=self.VERSION,
                execution_timestamp=timestamp,
                query_summary=QuerySummary(
                    location=getattr(query.location, "state", "Unknown"),
                    season=getattr(query.temporal, "cultivation_season", "Unknown"),
                    planting_system_evaluated="None",
                    water_regime_evaluated="None",
                    data_completeness_index=0.0,
                    evidence_confidence_tier=ConfidenceTier.INSUFFICIENT_DATA.value,
                ),
                recommendations=[],
                excluded_candidates=[],
                diagnostics={"error": str(e)},
                land_reclamation_advisory=None,
            )

        # 2. Check Data Adequacy
        is_adequate, adequacy_reason = InputValidator.check_data_adequacy(query)
        if not is_adequate:
            return RecommendationResult(
                status=ExecutionStatus.INSUFFICIENT_DATA,
                engine_version=self.VERSION,
                execution_timestamp=timestamp,
                query_summary=QuerySummary(
                    location=query.location.state,
                    season=query.temporal.cultivation_season or "Omitted",
                    planting_system_evaluated="None",
                    water_regime_evaluated="None",
                    data_completeness_index=0.0,
                    evidence_confidence_tier=ConfidenceTier.INSUFFICIENT_DATA.value,
                ),
                recommendations=[],
                excluded_candidates=[],
                diagnostics={"rejection_reason": adequacy_reason},
                land_reclamation_advisory=None,
            )

        # 3. Compute Data Completeness Index (DCI)
        dci_result = DCIConfidenceEvaluator.evaluate(query)
        if dci_result.dci_score < 0.500:
            return RecommendationResult(
                status=ExecutionStatus.INSUFFICIENT_DATA,
                engine_version=self.VERSION,
                execution_timestamp=timestamp,
                query_summary=QuerySummary(
                    location=query.location.state,
                    season=query.temporal.cultivation_season or f"Month {query.temporal.sowing_month}",
                    planting_system_evaluated="None",
                    water_regime_evaluated="Incomplete Data",
                    data_completeness_index=dci_result.dci_score,
                    evidence_confidence_tier=dci_result.confidence_tier.value,
                ),
                recommendations=[],
                excluded_candidates=[],
                diagnostics={
                    "rejection_reason": (
                        f"Data Completeness Index (DCI = {dci_result.dci_score:.3f}) is below minimum "
                        "scientific threshold (0.500). Essential inputs missing."
                    ),
                    "domain_completeness": dci_result.domain_completeness,
                },
                land_reclamation_advisory=None,
            )

        # 4. Evaluate Candidates Across All 19 Canonical Crops
        candidates: List[CropRecommendation] = []
        excluded: List[ExcludedCandidate] = []

        active_window_evaluated_str = "None"
        water_regime_str = (
            f"{query.climate_and_water.irrigation_access} "
            f"({query.climate_and_water.irrigation_water_quantity_mm or 0} mm + Rain {query.climate_and_water.seasonal_rainfall_amount or 0} mm)"
        )

        for crop in self.catalogue.get_all_crops():
            # Step A: Planting-Window Resolution
            win_status, active_win, win_reason = PlantingWindowResolver.resolve(
                crop, query.temporal, query.location
            )
            if active_win and active_window_evaluated_str == "None":
                active_window_evaluated_str = f"{active_win.planting_system} ({active_win.sowing_date_range})"

            # Step B: Water Assessment
            water_res = WaterAssessmentModule.assess_water(
                crop,
                query.climate_and_water,
                active_win,
                query.edaphic.soil_texture,
            )

            # Step C: Tier 1 Biological Eligibility Gating
            tier1_res = Tier1EligibilityEvaluator.evaluate(
                crop,
                query,
                water_res,
                active_win,
                win_status,
                win_reason,
            )

            # Step D: Branch Based on Tier 1 Outcome
            if tier1_res.overall_status == Tier1Status.DISQUALIFIED:
                excluded.append(
                    ExcludedCandidate(
                        crop_id=crop.crop_id,
                        canonical_name=crop.canonical_name,
                        tier1_status=tier1_res.overall_status,
                        failing_rules=tier1_res.failing_rules,
                        warnings=tier1_res.warnings,
                    )
                )
            else:
                # Step E: Tier 2 Liebig Scoring
                suit_score, components = Tier2ScoringModule.calculate_suitability(
                    crop, query, water_res
                )

                # Explanations, Warnings, Fertilizer
                advisory = ExplanationGenerator.generate_advisory(
                    crop, query, components, water_res, active_win
                )
                risk_warn = ExplanationGenerator.generate_risk_warnings(
                    crop, query, components, water_res
                )
                fert_pres = ExplanationGenerator.generate_fertilizer_prescription(
                    crop, query
                )

                # Assign candidate evidence confidence tier
                candidate_confidence = dci_result.confidence_tier
                if tier1_res.overall_status == Tier1Status.CONDITIONALLY_ELIGIBLE:
                    # If candidate has unmeasured water or provisional window, cap confidence
                    if candidate_confidence in [ConfidenceTier.HIGH_CONFIDENCE, ConfidenceTier.HIGH_CONFIDENCE_ESTIMATED_FERTILITY]:
                        candidate_confidence = ConfidenceTier.PROVISIONAL_EVALUATION

                candidates.append(
                    CropRecommendation(
                        rank=0,  # Assigned during ranking
                        crop_id=crop.crop_id,
                        canonical_name=crop.canonical_name,
                        crop_life_cycle=crop.crop_life_cycle,
                        suitability_score=suit_score,
                        evidence_confidence_tier=candidate_confidence,
                        tier1_status=tier1_res.overall_status,
                        tier2_components=components,
                        active_planting_window=active_win,
                        water_assessment=water_res,
                        expected_yield_range_t_ha=crop.reference_yield_range_t_ha,
                        agronomic_advisory=advisory,
                        risk_warnings=risk_warn,
                        fertilizer_prescription=fert_pres,
                    )
                )

        # 5. Deterministic Ranking & Environmental Hostility Evaluation
        status, ranked_recs, reclamation_advisory = RecommendationRanker.rank_candidates(
            candidates, excluded, query
        )

        query_summary = QuerySummary(
            location=f"{query.location.district or ''}, {query.location.state} ({query.location.agro_climatic_zone or 'Zone Unspecified'})".strip(" ,"),
            season=query.temporal.cultivation_season or f"Month {query.temporal.sowing_month}",
            planting_system_evaluated=active_window_evaluated_str,
            water_regime_evaluated=water_regime_str,
            data_completeness_index=dci_result.dci_score,
            evidence_confidence_tier=dci_result.confidence_tier.value,
        )

        return RecommendationResult(
            status=status,
            engine_version=self.VERSION,
            execution_timestamp=timestamp,
            query_summary=query_summary,
            recommendations=ranked_recs,
            excluded_candidates=excluded,
            diagnostics={
                "dci_details": dci_result.domain_completeness,
                "validation_warnings": validation_warnings,
                "total_candidates_evaluated": self.catalogue.total_crops,
                "eligible_count": len(ranked_recs),
                "excluded_count": len(excluded),
            },
            land_reclamation_advisory=reclamation_advisory,
        )
