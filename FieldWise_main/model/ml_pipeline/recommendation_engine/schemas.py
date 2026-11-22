"""
FieldWise Phase 3C.5: Recommendation Engine Schema Definitions
==============================================================
Data classes and enums formalizing the Canonical Input Contract (v1.5.0)
and Recommendation Output Schema.

Adheres strictly to Phase 3C.4.2.2.1 specification:
  - Six-field temporal cultivation model
  - Decoupled six water accounting concepts
  - Epistemic tiers for water and soil moisture
  - 2D output tuple: [Suitability Index (0-100), Evidence Confidence Tier]
  - Explicit non-compensatory Liebig sub-scores
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any, Tuple


class LifeCycle(str, Enum):
    ANNUAL_SEASONAL = "Annual_Seasonal"
    LONG_DURATION_ANNUAL = "Long_Duration_Annual"
    MULTI_SEASON_ARABLE = "Multi_Season_Arable"
    PERENNIAL_ORCHARD = "Perennial_Orchard"


class BroadSeason(str, Enum):
    KHARIF = "Kharif"
    RABI = "Rabi"
    ZAID = "Zaid"
    BORO_SPECIAL = "Boro_Special"
    ANNUAL_SPECIAL = "Annual_Special"
    PERENNIAL_ORCHARD = "Perennial_Orchard"


class PlantingWindowEvidenceStatus(str, Enum):
    VERIFIED = "VERIFIED"
    PROVISIONAL = "PROVISIONAL"
    UNKNOWN = "UNKNOWN"


class IrrigationAccess(str, Enum):
    NONE_RAINFED = "None_Rainfed"
    TUBEWELL_BOREWELL = "Tubewell_Borewell"
    CANAL_GRAVITY = "Canal_Gravity"
    DRIP_MICRO = "Drip_Micro"
    SPRINKLER = "Sprinkler"
    TANK_SURFACE = "Tank_Surface"
    OPEN_WELL = "Open_Well"


class SoilMoistureEpistemicTier(str, Enum):
    MEASURED = "MEASURED"
    SOURCE_BACKED_ESTIMATED = "SOURCE_BACKED_ESTIMATED"
    PROVISIONAL = "PROVISIONAL"
    UNKNOWN = "UNKNOWN"


class ProvenanceTier(str, Enum):
    INDEPENDENTLY_VERIFIED = "INDEPENDENTLY_VERIFIED"
    SOURCE_REFERENCED = "SOURCE_REFERENCED"
    USER_DECLARED = "USER_DECLARED"
    ESTIMATED = "ESTIMATED"
    PROVISIONAL = "PROVISIONAL"
    UNKNOWN = "UNKNOWN"


class ConfidenceTier(str, Enum):
    HIGH_CONFIDENCE = "HIGH_CONFIDENCE"
    HIGH_CONFIDENCE_ESTIMATED_FERTILITY = "HIGH_CONFIDENCE_ESTIMATED_FERTILITY"
    MODERATE_ESTIMATED = "MODERATE_ESTIMATED"
    PROVISIONAL_EVALUATION = "PROVISIONAL_EVALUATION"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class Tier1Status(str, Enum):
    ELIGIBLE = "ELIGIBLE"
    DISQUALIFIED = "DISQUALIFIED"
    CONDITIONALLY_ELIGIBLE = "CONDITIONALLY_ELIGIBLE"


class WaterGatingStatus(str, Enum):
    SCREENING_THRESHOLD_MET = "SCREENING_THRESHOLD_MET"
    WATER_DEFICIT_WARNING = "WATER_DEFICIT_WARNING"
    CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK = "CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK"
    CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE = "CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE"
    CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK = "CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK"
    TEMPORAL_MISMATCH_PROVISIONAL = "TEMPORAL_MISMATCH_PROVISIONAL"
    PASS_VERIFIED = "PASS_VERIFIED"
    UNKNOWN = "UNKNOWN"


class ExecutionStatus(str, Enum):
    SUCCESS = "SUCCESS"
    NO_RECOMMENDATION_SUITABLE = "NO_RECOMMENDATION_SUITABLE"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    VALIDATION_ERROR = "VALIDATION_ERROR"


# -------------------------------------------------------------------------
# INPUT CONTRACT DATA CLASSES
# -------------------------------------------------------------------------

@dataclass
class LocationInput:
    state: str
    district: Optional[str] = None
    agro_climatic_zone: Optional[str] = None


@dataclass
class TemporalInput:
    sowing_month: int  # 1 - 12
    sowing_date: Optional[str] = None  # YYYY-MM-DD
    cultivation_season: Optional[str] = None  # Broad season (Kharif, Rabi, Zaid, etc.)
    planting_system: Optional[str] = None  # Specific system (e.g. Aman, Boro, Timely_Sown)


@dataclass
class ClimateWaterInput:
    seasonal_rainfall_amount: Optional[float] = None  # Gross mm
    rainfall_period_type: Optional[str] = None  # "Crop_Season_Measured", "Monthly_Measured", "Annual_Estimated"
    rainfall_source: Optional[str] = None  # "IMD_Station_Gridded", "On_Farm_Rain_Gauge", "Farmer_Estimated", "Unstated"
    monthly_rainfall: Optional[List[float]] = None  # Monthly rainfall breakdown in mm
    irrigation_access: Optional[str] = "None_Rainfed"  # IrrigationAccess enum or string
    irrigation_water_quantity_mm: Optional[float] = None  # Gross mm applied
    irrigation_quantity_basis: Optional[str] = None  # "Measured_Flow_Meter", "Calibrated_V_Notch", "Estimated_Hours", "Unstated"
    irrigation_type: Optional[str] = None  # "Surface_Furrow", "Drip", "Sprinkler", etc.
    irrigation_period_days: Optional[int] = None  # Duration over which irrigation was measured
    rainfall_period_days: Optional[int] = None  # Duration over which rainfall was measured
    temperature_mean: Optional[float] = None  # Mean °C
    temperature_min_night: Optional[float] = None  # Min night °C
    temperature_max_day: Optional[float] = None  # Max day °C
    relative_humidity: Optional[float] = None  # % (0-100)
    soil_moisture_tier: Optional[str] = "UNKNOWN"  # SoilMoistureEpistemicTier
    soil_moisture_mm: Optional[float] = None  # Measured root zone moisture
    awc_mm_m: Optional[float] = None  # Available Water Capacity (e.g. 200 mm/m for Vertisols)
    rooting_depth_m: Optional[float] = None  # Effective rooting depth in meters
    # Traceable Provenance Verification Metadata (Finding 3):
    station_id: Optional[str] = None  # Traceable meteorological station / rain-gauge ID
    measurement_date_start: Optional[str] = None  # YYYY-MM-DD
    measurement_date_end: Optional[str] = None  # YYYY-MM-DD
    irrigation_meter_id: Optional[str] = None  # Traceable calibrated flow-meter ID
    source_reference: Optional[str] = None  # Verifiable external source citation / dataset ID


@dataclass
class EdaphicInput:
    soil_texture: Optional[str] = None  # e.g. "Loamy", "Clay Loam", "Sandy", "Black Vertisol"
    texture_measurement_method: Optional[str] = None  # "Lab_Mechanical_Analysis", "Field_Feel_Method", "Regional_Map_Estimate", "Unstated"
    soil_ph: Optional[float] = None  # Potentiometric pH (1:2.5 soil-water)
    ph_measurement_method: Optional[str] = None  # "Lab_Potentiometric_1_2_5", "Field_Colorimetric_Strip", "Regional_Map_Estimate", "Unstated"
    has_soil_test: bool = False  # Laboratory SHC available
    soil_test_source: Optional[str] = None  # "Certified_Soil_Testing_Lab", "Portable_Kit", "Unverified"
    nutrient_basis: Optional[str] = None  # "SHC_Available_kg_ha", "Qualitative_Fertility_Class", "Unstated"
    soil_nitrogen: Optional[float] = None  # kg/ha available N
    soil_phosphorus: Optional[float] = None  # kg/ha available P2O5
    soil_potassium: Optional[float] = None  # kg/ha available K2O
    organic_carbon_pct: Optional[float] = None  # %
    # Traceable Provenance Verification Metadata (Finding 3):
    lab_accreditation_number: Optional[str] = None  # NABL / ICAR accredited lab certificate code
    sample_id: Optional[str] = None  # Unique soil sample ID from testing lab
    test_date: Optional[str] = None  # YYYY-MM-DD
    source_reference: Optional[str] = None  # Verifiable Soil Health Card portal record / publication


@dataclass
class STCRCalibrationRecord:
    """
    Structured STCR Targeted Yield Calibration Record (Finding 2).
    Requires complete provenance, applicability constraints, verified coefficients,
    and official versioned registry validation.
    """
    calibration_id: str
    crop_id: str
    applicable_regions: List[str]
    source_institution: str
    publication_reference: str
    coefficients: Dict[str, float]  # fn_t, fn_sn, fp_t, fp_sp, fk_t, fk_sk
    coefficient_units: str
    target_yield_min_t_ha: float
    target_yield_max_t_ha: float
    validation_status: str  # Must be "VALIDATED" or "OFFICIALLY_VERIFIED"
    validation_evidence: str
    registry_version: str = "2026.1-OFFICIAL"


@dataclass
class TrustedVerificationRecord:
    """
    Cryptographically / administratively verifiable evidence record from a trusted authority (Finding 3).
    Required to elevate an observation to INDEPENDENTLY_VERIFIED status.
    A station ID or laboratory name alone cannot establish independent verification without a trusted record.
    """
    verification_authority_id: str     # e.g. "AUTH-ICAR-SHC-REGISTRY", "AUTH-IMD-AWS-NETWORK"
    authority_name: str                # e.g. "ICAR / DAC&FW National Soil Health Card Digital Portal"
    source_identifier: str             # Verifiable registry / datasource ID
    observation_or_sample_id: str      # Must match query's sample_id, station_id, or irrigation_meter_id
    verification_status: str           # Must be "OFFICIALLY_VERIFIED" or "TRUSTED_AUTHORITY_CONFIRMED"
    applicable_date_start: str         # YYYY-MM-DD
    applicable_date_end: str           # YYYY-MM-DD
    digital_signature_or_token: str = ""  # Verifiable audit token / certificate hash


@dataclass
class RecommendationQuery:
    location: LocationInput
    temporal: TemporalInput
    climate_and_water: ClimateWaterInput
    edaphic: EdaphicInput
    # STCR Calibration Integration (Finding 2):
    stcr_calibration_id: Optional[str] = None
    stcr_calibration: Optional[STCRCalibrationRecord] = None
    target_yield_t_ha: Optional[float] = None
    has_stcr_calibration: bool = False
    # Trusted Verification Records (Finding 3):
    verification_records: List[TrustedVerificationRecord] = field(default_factory=list)


# -------------------------------------------------------------------------
# INTERMEDIATE & OUTPUT DATA CLASSES
# -------------------------------------------------------------------------

@dataclass
class PlantingWindowDefinition:
    window_id: str
    planting_system: str
    broad_season: str
    region_or_zone: str
    sowing_month_start: int
    sowing_month_end: int
    sowing_date_range: str
    harvest_month_range: str
    crop_duration_days: int
    window_evidence_status: str
    source_reference: str


@dataclass
class CropCatalogueEntry:
    crop_id: str
    canonical_name: str
    scientific_name: str
    crop_category: str
    crop_life_cycle: str
    broad_seasons_supported: List[str]
    planting_systems: List[str]
    supported_regions: List[str]
    planting_windows: List[PlantingWindowDefinition]
    min_seasonal_water_mm: float
    optimal_seasonal_water_mm: float
    preferred_soil_textures: List[str]
    tolerated_soil_textures: List[str]
    restricted_soil_textures: List[str]
    soil_ph_min: float
    soil_ph_max: float
    sowing_temp_min_c: float
    sowing_temp_max_c: float
    optimal_temp_c: float
    optimal_humidity_pct: float
    rdf_n_p2o5_k2o_kg_ha: List[float]
    reference_yield_range_t_ha: List[float]
    rainfed_threshold_mm: float = 0.0


@dataclass
class WaterAssessmentResult:
    water_gating_status: WaterGatingStatus
    effective_rainfall_mm: Optional[float]
    net_irrigation_delivered_mm: Optional[float]
    gross_irrigation_applied_mm: Optional[float]
    total_net_water_mm: Optional[float]
    deficit_against_optimal_mm: Optional[float]
    deficit_against_min_mm: Optional[float]
    runoff_and_drainage_loss_mm: Optional[float]
    irrigation_efficiency: float
    soil_moisture_accounted_mm: float
    soil_moisture_tier: SoilMoistureEpistemicTier
    provisional_water_score: float
    warnings: List[str] = field(default_factory=list)


@dataclass
class Tier1GateResult:
    gate_name: str
    status: str  # "PASS", "FAIL", "UNKNOWN"
    reason: str


@dataclass
class Tier1EvaluationResult:
    overall_status: Tier1Status
    gate_results: Dict[str, Tier1GateResult]
    failing_rules: List[Dict[str, str]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class Tier2Components:
    climate_score: float
    water_score: float
    soil_score: float
    nutrient_score: float
    ph_score: float
    core_suitability: float
    liebig_penalty_factor: float


@dataclass
class FertilizerPrescription:
    status: str  # "VERIFIED_STCR_GENERATED", "BASELINE_RDF_ARITHMETIC", "WITHHELD_MISSING_SOIL_TEST"
    rdf_n_p2o5_k2o_kg_ha: List[float]
    adjusted_dose_kg_ha: Optional[List[float]] = None
    commercial_products: Dict[str, float] = field(default_factory=dict)
    stoichiometric_notes: str = ""
    disclaimers: List[str] = field(default_factory=list)
    calibration_details: Optional[Dict[str, Any]] = None


@dataclass
class CropRecommendation:
    rank: int
    crop_id: str
    canonical_name: str
    crop_life_cycle: str
    suitability_score: float  # Agronomic Suitability Index (0-100)
    evidence_confidence_tier: ConfidenceTier
    tier1_status: Tier1Status
    tier2_components: Tier2Components
    active_planting_window: Optional[PlantingWindowDefinition]
    water_assessment: WaterAssessmentResult
    expected_yield_range_t_ha: List[float]
    agronomic_advisory: List[str] = field(default_factory=list)
    risk_warnings: List[str] = field(default_factory=list)
    fertilizer_prescription: Optional[FertilizerPrescription] = None


@dataclass
class ExcludedCandidate:
    crop_id: str
    canonical_name: str
    tier1_status: Tier1Status
    failing_rules: List[Dict[str, str]]
    warnings: List[str] = field(default_factory=list)


@dataclass
class DCIResult:
    dci_score: float
    domain_completeness: Dict[str, float]
    confidence_tier: ConfidenceTier
    measured_dimensions: List[str]
    imputed_dimensions: List[str]
    domain_provenance: Dict[str, ProvenanceTier] = field(default_factory=dict)
    overall_provenance: ProvenanceTier = ProvenanceTier.UNKNOWN


@dataclass
class QuerySummary:
    location: str
    season: str
    planting_system_evaluated: str
    water_regime_evaluated: str
    data_completeness_index: float
    evidence_confidence_tier: str


@dataclass
class RecommendationResult:
    status: ExecutionStatus
    engine_version: str
    execution_timestamp: str
    query_summary: QuerySummary
    recommendations: List[CropRecommendation]
    excluded_candidates: List[ExcludedCandidate]
    diagnostics: Dict[str, Any] = field(default_factory=dict)
    land_reclamation_advisory: Optional[str] = None
