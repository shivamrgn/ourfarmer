"""
FieldWise Phase 3C.5: Tier 2 Liebig-Weighted Suitability Ranking Module
======================================================================
Computes the physiological alignment index for candidates passing Tier 1.

Features:
  - Gaussian climate distance: s_climate in [0, 100]
  - Decoupled physical water adequacy: s_water in [0, 100]
  - Edaphic texture suitability: s_soil in [0, 100]
  - DAC&FW National Soil Health Card nutrient alignment: s_nutrients in [0, 100]
  - Soil reaction buffer decay: s_ph in [0, 100]
  - Non-compensatory Liebig aggregation and penalty factor
  - Strict mathematical invariants: finite values, zero NaN/Inf, never labeled as probabilities
"""

import math
from typing import Dict, Optional, Tuple
from .schemas import (
    CropCatalogueEntry,
    RecommendationQuery,
    WaterAssessmentResult,
    Tier2Components,
)


class Tier2ScoringModule:
    """
    Computes component sub-scores and aggregates them using non-compensatory Liebig formulation.
    """

    SIGMA_TEMP = 6.0    # °C Gaussian spread
    SIGMA_HUMID = 20.0  # % Gaussian spread

    @classmethod
    def score_climate(cls, crop: CropCatalogueEntry, query: RecommendationQuery) -> float:
        """
        s_climate = 60 * exp(-Delta_T^2 / (2 * sigma_T^2)) + 40 * exp(-Delta_H^2 / (2 * sigma_H^2))
        """
        cw = query.climate_and_water
        t_mean = cw.temperature_mean
        humid = cw.relative_humidity

        if t_mean is None and humid is None:
            return 70.0  # Imputed baseline with DCI penalty

        score_t = 60.0
        if t_mean is not None:
            delta_t = abs(t_mean - crop.optimal_temp_c)
            score_t = 60.0 * math.exp(-(delta_t ** 2) / (2.0 * (cls.SIGMA_TEMP ** 2)))

        score_h = 40.0
        if humid is not None:
            delta_h = abs(humid - crop.optimal_humidity_pct)
            score_h = 40.0 * math.exp(-(delta_h ** 2) / (2.0 * (cls.SIGMA_HUMID ** 2)))

        return round(max(0.0, min(100.0, score_t + score_h)), 2)

    @classmethod
    def score_water(cls, crop: CropCatalogueEntry, water_result: WaterAssessmentResult) -> float:
        """
        Extracts verified water adequacy score from physical water assessment.
        """
        score = water_result.provisional_water_score
        return round(max(0.0, min(100.0, score)), 2)

    @classmethod
    def score_soil(cls, crop: CropCatalogueEntry, query: RecommendationQuery) -> float:
        """
        Preferred: 100 points
        Tolerated: 75 points
        Marginal:  50 points
        Missing:   70 points
        """
        soil_tex = query.edaphic.soil_texture
        if not soil_tex:
            return 70.0

        for pref in crop.preferred_soil_textures:
            if pref.lower() == soil_tex.lower():
                return 100.0

        for tol in crop.tolerated_soil_textures:
            if tol.lower() == soil_tex.lower():
                return 75.0

        return 50.0  # Marginal texture

    @classmethod
    def score_nutrients(cls, query: RecommendationQuery) -> float:
        """
        Evaluates soil test against DAC&FW operational rating limits:
          N:  < 280 Low (75), 280-560 Med (100), > 560 High (95)
          P:  < 23  Low (75), 23-56   Med (100), > 56  High (95)
          K:  < 140 Low (75), 140-330 Med (100), > 330 High (95)

        Strict Phase 3C.5.1 Safeguards:
          - Never invents favorable default P (35) or K (200) when measurements are missing.
          - Missing nutrients remain UNKNOWN and receive an unmeasured provisional baseline (50.0),
            preventing unearned nutrient suitability points.
          - Distinguishes MEASURED, PROVISIONAL, and UNAVAILABLE nutrient states.
        """
        ed = query.edaphic
        has_n = ed.soil_nitrogen is not None
        has_p = ed.soil_phosphorus is not None
        has_k = ed.soil_potassium is not None

        if not ed.has_soil_test or (not has_n and not has_p and not has_k):
            # Nutrient data completely unavailable: unmeasured provisional baseline (50.0)
            return 50.0

        def rate_n(n: float) -> float:
            return 75.0 if n < 280.0 else (100.0 if n <= 560.0 else 95.0)

        def rate_p(p: float) -> float:
            return 75.0 if p < 23.0 else (100.0 if p <= 56.0 else 95.0)

        def rate_k(k: float) -> float:
            return 75.0 if k < 140.0 else (100.0 if k <= 330.0 else 95.0)

        # Evaluate measured nutrients; missing nutrients receive unmeasured provisional baseline (50.0)
        # instead of unearned favourable defaults
        UNMEASURED_PROVISIONAL_RATING = 50.0

        sn = rate_n(ed.soil_nitrogen) if has_n else UNMEASURED_PROVISIONAL_RATING
        sp = rate_p(ed.soil_phosphorus) if has_p else UNMEASURED_PROVISIONAL_RATING
        sk = rate_k(ed.soil_potassium) if has_k else UNMEASURED_PROVISIONAL_RATING

        # Weighted combination: 40% N, 35% P, 25% K
        return round(0.40 * sn + 0.35 * sp + 0.25 * sk, 2)

    @classmethod
    def score_ph(cls, crop: CropCatalogueEntry, query: RecommendationQuery) -> float:
        """
        Within preferred [ph_min, ph_max]: 100 points
        Within buffer: linear decay down to 50 points
        Missing: 70 points
        """
        ph = query.edaphic.soil_ph
        if ph is None:
            return 70.0

        if crop.soil_ph_min <= ph <= crop.soil_ph_max:
            return 100.0

        if (crop.soil_ph_min - 0.5) <= ph < crop.soil_ph_min:
            # Buffer decay: 50 at min-0.5 up to 100 at min
            frac = (ph - (crop.soil_ph_min - 0.5)) / 0.5
            return round(50.0 + 50.0 * frac, 2)

        if crop.soil_ph_max < ph <= (crop.soil_ph_max + 0.5):
            # Buffer decay: 100 at max down to 50 at max+0.5
            frac = (ph - crop.soil_ph_max) / 0.5
            return round(100.0 - 50.0 * frac, 2)

        return 30.0  # Should be disqualified in Tier 1, but safe fallback

    @classmethod
    def calculate_suitability(
        cls,
        crop: CropCatalogueEntry,
        query: RecommendationQuery,
        water_result: WaterAssessmentResult,
    ) -> Tuple[float, Tier2Components]:
        """
        Executes Tier 2 Liebig scoring and aggregation.
        Returns (SuitabilityIndex, Tier2Components).
        """
        s_clim = cls.score_climate(crop, query)
        s_wat = cls.score_water(crop, water_result)
        s_soil = cls.score_soil(crop, query)
        s_nutr = cls.score_nutrients(query)
        s_ph = cls.score_ph(crop, query)

        # 1. Core Geometric Suitability
        # CoreSuitability = s_clim^0.30 * s_wat^0.30 * s_soil^0.20 * s_nutr^0.10 * s_ph^0.10
        # Protect against non-positive log/power
        c_clim = max(1.0, s_clim)
        c_wat = max(1.0, s_wat)
        c_soil = max(1.0, s_soil)
        c_nutr = max(1.0, s_nutr)
        c_ph = max(1.0, s_ph)

        core_suitability = (
            (c_clim ** 0.30) *
            (c_wat ** 0.30) *
            (c_soil ** 0.20) *
            (c_nutr ** 0.10) *
            (c_ph ** 0.10)
        )

        # 2. Liebig Penalty Factor
        # LiebigPenaltyFactor = (min(s_clim, s_wat, s_soil, s_ph) / 100.0)^0.25
        min_factor = min(c_clim, c_wat, c_soil, c_ph)
        liebig_penalty_factor = (min_factor / 100.0) ** 0.25

        # 3. Final Agronomic Suitability Index (0 - 100)
        final_index = round(max(0.0, min(100.0, core_suitability * liebig_penalty_factor)), 1)

        components = Tier2Components(
            climate_score=s_clim,
            water_score=s_wat,
            soil_score=s_soil,
            nutrient_score=s_nutr,
            ph_score=s_ph,
            core_suitability=round(core_suitability, 2),
            liebig_penalty_factor=round(liebig_penalty_factor, 3),
        )

        return final_index, components
