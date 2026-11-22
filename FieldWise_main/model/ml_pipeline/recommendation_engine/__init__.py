"""
FieldWise Phase 3C.5: Recommendation Engine Package
===================================================
Production-grade, rule-based crop recommendation engine adhering to the
Phase 3C.4.2.2.1 approved agronomic specification.
"""

from .schemas import (
    LifeCycle,
    BroadSeason,
    PlantingWindowEvidenceStatus,
    IrrigationAccess,
    SoilMoistureEpistemicTier,
    ProvenanceTier,
    ConfidenceTier,
    Tier1Status,
    WaterGatingStatus,
    ExecutionStatus,
    LocationInput,
    TemporalInput,
    ClimateWaterInput,
    EdaphicInput,
    STCRCalibrationRecord,
    TrustedVerificationRecord,
    RecommendationQuery,
    PlantingWindowDefinition,
    CropCatalogueEntry,
    WaterAssessmentResult,
    Tier1GateResult,
    Tier1EvaluationResult,
    Tier2Components,
    FertilizerPrescription,
    CropRecommendation,
    ExcludedCandidate,
    DCIResult,
    QuerySummary,
    RecommendationResult,
)
from .catalogue import CanonicalCropCatalogue
from .engine import CropRecommendationEngine
from .stcr_registry import STCRCalibrationRegistry
from .provenance_registry import TrustedVerificationRegistry

__version__ = "2.2.0-CLOSURE"
__all__ = [
    "CropRecommendationEngine",
    "CanonicalCropCatalogue",
    "RecommendationQuery",
    "LocationInput",
    "TemporalInput",
    "ClimateWaterInput",
    "EdaphicInput",
    "RecommendationResult",
    "CropRecommendation",
    "ExcludedCandidate",
    "ExecutionStatus",
    "ConfidenceTier",
    "Tier1Status",
    "WaterGatingStatus",
    "ProvenanceTier",
    "STCRCalibrationRecord",
    "STCRCalibrationRegistry",
    "TrustedVerificationRecord",
    "TrustedVerificationRegistry",
]
