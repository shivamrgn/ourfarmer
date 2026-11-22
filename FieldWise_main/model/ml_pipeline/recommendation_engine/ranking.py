"""
FieldWise Phase 3C.5: Recommendation Ranking & Threshold Module
===============================================================
Ranks eligible crops deterministically and enforces the strict
environmental hostility boundary (NO_RECOMMENDATION_SUITABLE).

Ranking Rules:
  1. Primary: Agronomic Suitability Index (0-100) descending
  2. Secondary Tie-breaker: Confidence Tier rank descending
  3. Tertiary Tie-breaker: Canonical Name ascending (alphabetical)

Strict Safety Invariants:
  - Deterministic: 100% identical outputs for identical queries.
  - Scores are NEVER presented as probabilities.
  - Low suitability (< 40.0) or zero passing crops triggers NO_RECOMMENDATION_SUITABLE.
"""

from typing import List, Tuple, Optional
from .schemas import (
    CropRecommendation,
    ExcludedCandidate,
    ExecutionStatus,
    ConfidenceTier,
    RecommendationQuery,
)

TIER_ORDER = {
    ConfidenceTier.HIGH_CONFIDENCE: 4,
    ConfidenceTier.HIGH_CONFIDENCE_ESTIMATED_FERTILITY: 3,
    ConfidenceTier.MODERATE_ESTIMATED: 2,
    ConfidenceTier.PROVISIONAL_EVALUATION: 1,
    ConfidenceTier.INSUFFICIENT_DATA: 0,
}


class RecommendationRanker:
    """
    Ranks candidates and enforces the NO_RECOMMENDATION_SUITABLE boundary.
    """

    SUITABILITY_VIABILITY_THRESHOLD = 40.0

    @classmethod
    def rank_candidates(
        cls,
        candidates: List[CropRecommendation],
        excluded: List[ExcludedCandidate],
        query: RecommendationQuery,
    ) -> Tuple[ExecutionStatus, List[CropRecommendation], Optional[str]]:
        """
        Sorts candidates and checks if any crop meets the minimum viability standard.
        Returns (ExecutionStatus, ranked_recommendations, land_reclamation_advisory).
        """
        # Sort deterministically
        def sort_key(c: CropRecommendation):
            tier_val = TIER_ORDER.get(c.evidence_confidence_tier, 0)
            return (-c.suitability_score, -tier_val, c.canonical_name)

        sorted_candidates = sorted(candidates, key=sort_key)

        # Assign 1-based ranks
        for i, rec in enumerate(sorted_candidates):
            rec.rank = i + 1

        # Check if any candidate meets the minimum agronomic viability threshold (40.0)
        if not sorted_candidates or sorted_candidates[0].suitability_score < cls.SUITABILITY_VIABILITY_THRESHOLD:
            # Low suitability hostility: crops evaluated but depressed below viability threshold (40.0)
            reclamation_advisory = cls._generate_reclamation_advisory(query)
            return (
                ExecutionStatus.NO_RECOMMENDATION_SUITABLE,
                sorted_candidates,
                reclamation_advisory,
            )

        return ExecutionStatus.SUCCESS, sorted_candidates, None

    @classmethod
    def _generate_reclamation_advisory(cls, query: RecommendationQuery) -> str:
        ph = query.edaphic.soil_ph
        rain = query.climate_and_water.seasonal_rainfall_amount
        irr = query.climate_and_water.irrigation_access

        if ph is not None and ph >= 9.0:
            return (
                f"Severe soil sodicity/alkalinity detected (pH {ph} >= 9.0). Soil conditions pose severe physiological "
                "and structural constraints for standard arable crops. Gypsum application (based on Gypsum Requirement test), "
                "incorporation of organic matter/pressmud, and green manuring with Sesbania (dhaincha) are recommended "
                "to ameliorate soil structure and reduce sodicity risk prior to commercial crop cultivation."
            )
        if ph is not None and ph < 4.5:
            return (
                f"Severe soil acidity detected (pH {ph} < 4.5). Soil conditions pose elevated risk of aluminum and manganese "
                "toxicity along with restricted nutrient availability. Agricultural limestone or dolomite application "
                "recommended to raise pH into the favorable arable range (5.5 - 7.5)."
            )
        if rain is not None and rain < 150.0 and (irr is None or irr.lower() in ["none_rainfed", "rainfed", "none"]):
            return (
                f"Hyper-arid drought conditions (rainfall {rain} mm with no irrigation). Arable field crops cannot complete their "
                "life cycle without supplemental water. Dryland agroforestry, rainwater harvesting (bunding/farm ponds), or "
                "drought-hardy desert pulses/grasses recommended."
            )
        return (
            "The agro-climatic environment poses extreme physiological stress. No canonical crop achieved the minimum "
            f"agronomic viability threshold (Suitability Index >= {cls.SUITABILITY_VIABILITY_THRESHOLD}/100). Review local soil "
            "amelioration options with your district Krishi Vigyan Kendra (KVK)."
        )
