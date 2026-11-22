# FieldWise — Crop Recommendation Engine (Version 2.2.0-CLOSURE)
## Phase 3C.5: Isolated Rule-Based Engine Implementation

The **FieldWise Crop Recommendation Engine** is an agronomic, rule-based inference system designed to replace legacy, uncalibrated ML classifiers with physiologically verified, source-backed agricultural decision logic.

It is implemented as a standalone, zero-dependency Python package located strictly under:
```text
FieldWise_main/model/ml_pipeline/recommendation_engine/
```

> [!IMPORTANT]
> **Production Codebase Isolation**: In strict accordance with Phase 3C.4 and Phase 3C.5 governance, this engine operates in complete isolation. Existing production application files (`model/predictor.js`, `model/cropDatabase.js`, `model/fertilizerDatabase.js`, `src/lib/predictorEngine.ts`, and `src/lib/api.ts`) remain read-only and untouched.

---

## 1. Architectural Architecture

The engine is structured as a two-tier hybrid inference pipeline:

```
[User Input Query: Location, Temporal Context, Water Regime, Climate, Soil, Nutrients]
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ INPUT VALIDATION & NORMALIZATION (input_validator.py)                         │
│  - Type & boundary validation (pH 2-12, temp -20 to 60°C, non-negative water) │
│  - Text enum & state canonical normalization                                  │
│  - Data adequacy check (halts if temporal month or water regime omitted)      │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ DATA COMPLETENESS INDEX (DCI) & CONFIDENCE (dci_confidence.py)                │
│  - Computes 6-domain completeness: DCI = sum(w_k * c_k) in [0.00, 1.00]       │
│  - Enforces rejection boundary: DCI < 0.500 -> INSUFFICIENT_DATA             │
│  - Assigns Evidence Confidence Tier: HIGH, MODERATE, PROVISIONAL              │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ TIER 1: AGRONOMIC ELIGIBILITY & SAFETY GATING (tier1_eligibility.py)           │
│                                                                               │
│  Evaluates each candidate crop c across five biological survival gates:       │
│    1. Temporal & Planting Window Gate (planting_window.py)                    │
│    2. Thermal Emergence & Germination Gate (sowing temp min/max)              │
│    3. Soil Texture Compatibility Gate (rejects restricted textures)           │
│    4. Soil Reaction (pH) Survival Gate (preferred range +/- 0.5 buffer)       │
│    5. Water Survival Gate (water_assessment.py: rainfed / irrigated checks)   │
│                                                                               │
│  Gating Outcomes: ELIGIBLE, DISQUALIFIED, CONDITIONALLY_ELIGIBLE              │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
        Tier 1 Status: DISQUALIFIED             Tier 1 Status: ELIGIBLE /
                    │                           CONDITIONALLY_ELIGIBLE
                    ▼                                       │
    ┌───────────────────────────────┐                       ▼
    │ Excluded Candidate Logged     │   ┌───────────────────────────────────────┐
    │ - Records failing gate        │   │ TIER 2: LIEBIG-WEIGHTED RANKING       │
    │ - Attaches biological rule ID │   │ (tier2_scoring.py)                    │
    │ - Zero suitability score      │   │ - s_climate: Gaussian temp & humidity │
    └───────────────────────────────┘   │ - s_water: Decoupled root adequacy    │
                                        │ - s_soil: Preferred / tolerated texture│
                                        │ - s_nutrients: DAC&FW SHC alignment   │
                                        │ - s_ph: Preferred & buffer decay      │
                                        │ - Liebig Non-Compensatory Product:    │
                                        │   SuitabilityIndex = Core * Penalty   │
                                        └───────────────────┬───────────────────┘
                                                            │
                                                            ▼
                                        ┌───────────────────────────────────────┐
                                        │ EXPLANATIONS & FERTILIZER PRESCRIPTION│
                                        │ (explanations.py)                     │
                                        │ - Identifies Liebig limiting factor   │
                                        │ - Generates risk advisories           │
                                        │ - Safe STCR fertilizer stoichiometry  │
                                        │   (deducts 18% DAP Nitrogen credit)   │
                                        │ - Withholds bags if SHC test absent   │
                                        └───────────────────┬───────────────────┘
                                                            │
                                                            ▼
                                        ┌───────────────────────────────────────┐
                                        │ DETERMINISTIC RANKING (ranking.py)    │
                                        │ - Ranks by Suitability Index (desc)   │
                                        │ - Secondary tie-breaker: Conf Tier    │
                                        │ - Enforces environmental hostility    │
                                        │   (Top score < 40 -> NO_REC_SUITABLE) │
                                        └───────────────────┬───────────────────┘
                                                            │
                                                            ▼
                                        ┌───────────────────────────────────────┐
                                        │ FINAL OUTPUT PAYLOAD                  │
                                        │ 2D Tuple: [Suitability, Conf Tier]    │
                                        │ Strictly labeled Index, NEVER Prob    │
                                        └───────────────────────────────────────┘
```

---

## 2. Core Agronomic Rules & Mathematical Specifications

### 2.1 The 19-Crop Single Source of Truth
The catalogue implements the 19 canonical crops across 4 life-cycle categories and 31 regional planting windows:
- **14 Annual Seasonal**: Rice, Wheat, Maize, Cotton, Soybean, Groundnut, Potato, Chickpea, Lentil, Mustard, Onion, Jowar, Barley, Millets.
- **2 Long-Duration Annual**: Sugarcane, Banana.
- **2 Multi-Season Arable**: Tomato, Sunflower.
- **1 Perennial Orchard**: Mango.

### 2.2 Decoupled Water Accounting Model
1. **Separation of Concepts**:
   - $ET_c$: Consumptive crop evapotranspiration ($ET_{c,\min}, ET_{c,\text{opt}}$).
   - $P_{\text{eff}}$: Monthly effective rainfall aggregated via USDA-SCS empirical equations.
   - $NIR_{\text{delivered}} = GIR \times \eta_{\text{appl}}$: Net delivered root-zone water segregated from gross pump discharge ($GIR$). Application efficiencies: Drip ($\eta=0.90$), Sprinkler ($\eta=0.75$), Furrow/Border/Canal/Tubewell ($\eta=0.70$).
2. **Rainfed Screening Semantics**:
   - $P_{\text{seasonal}} \ge \text{threshold} \implies$ `SCREENING_THRESHOLD_MET` (assigned `CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE`, never `PASS_VERIFIED`).
   - $P_{\text{seasonal}} < \text{threshold} \implies$ `WATER_DEFICIT_WARNING` (triggers Tier 2 Liebig soft penalty, **never** Tier 1 hard exclusion).
3. **Monthly USDA-SCS Aggregation**:
   - Direct application of monthly empirical equations to seasonal aggregates is strictly prohibited.
   - When monthly rain $[P_1, P_2, \dots, P_m]$ is provided:
     $$\text{For } P_m \le 250\text{ mm}: \quad P_{\text{eff},m} = \frac{P_m (125.0 - 0.2 P_m)}{125.0}$$
     $$\text{For } P_m > 250\text{ mm}: \quad P_{\text{eff},m} = 125.0 + 0.1 P_m$$
     $$P_{\text{eff}} = \sum_{m} P_{\text{eff},m}, \quad \text{Runoff / Drainage Loss} = \sum_{m} P_m - P_{\text{eff}}$$
4. **Residual Soil Moisture Epistemic Model**:
   - 4 Epistemic Tiers: `MEASURED`, `SOURCE_BACKED_ESTIMATED`, `PROVISIONAL`, `UNKNOWN`.
   - Deep Vertisols store $AWC = 200\text{ mm/m} \times 1.2\text{ m} = 240.0\text{ mm}$.
   - Unmeasured moisture is **never fabricated**; triggers `CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK`.
5. **Unmeasured Irrigation**:
   - When irrigation access is confirmed but volume is unmeasured, the water gate returns `UNKNOWN` with provisional score $s_{\text{water}} = 70.0$ and status `CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK`.

### 2.3 Six-Domain Data Completeness Index ($DCI$)
$$DCI = \sum_{k=1}^{6} w_k \cdot c_k \quad \in [0.00, 1.00]$$

| Domain | Weight ($w_k$) | Measurement Criteria ($c_k$) |
| :--- | :---: | :--- |
| **Temporal** | 0.15 | 1.00 for exact date (`YYYY-MM-DD`); 0.60 for month only; 0.00 if omitted |
| **Climate** | 0.20 | 1.00 for measured temp and humidity; 0.50 for single parameter; 0.00 if omitted |
| **Water** | 0.25 | 1.00 for measured rain + measured GIR; 0.40 for unmeasured irrigation; 0.00 if omitted |
| **Soil Texture**| 0.15 | 1.00 for mechanical lab test; 0.50 for regional map estimate; 0.00 if omitted |
| **Soil pH** | 0.10 | 1.00 for potentiometric lab pH; 0.50 for strip; 0.00 if omitted |
| **Nutrients** | 0.15 | 1.00 for quantitative SHC test; 0.50 for qualitative fertility; 0.00 if omitted |

- **Rejection Boundary**: If $DCI < 0.500$, execution halts with `INSUFFICIENT_DATA`.

### 2.4 Tier 2 Non-Compensatory Liebig Aggregation
$$\text{CoreSuitability}(c, \mathbf{x}) = s_{\text{climate}}^{0.30} \cdot s_{\text{water}}^{0.30} \cdot s_{\text{soil}}^{0.20} \cdot s_{\text{nutrients}}^{0.10} \cdot s_{\text{ph}}^{0.10}$$
$$\text{LiebigPenaltyFactor}(c, \mathbf{x}) = \left(\frac{\min(s_{\text{climate}}, s_{\text{water}}, s_{\text{soil}}, s_{\text{ph}})}{100.0}\right)^{0.25}$$
$$\text{SuitabilityIndex}(c, \mathbf{x}) = \text{CoreSuitability}(c, \mathbf{x}) \times \text{LiebigPenaltyFactor}(c, \mathbf{x})$$

The Liebig factor ensures that an acute deficit in one physical component cannot be masked by favorable fertility or temperature.

### 2.5 Fertilizer Safety & Stoichiometric DAP Nitrogen Credit
- **Withholding Mandate**: When laboratory soil-test data is unavailable (`has_soil_test=False`), physical commercial fertilizer bag quantities are strictly **withheld**. Only state POP baseline RDF in kg/ha is provided with advisory guidance.
- **Stoichiometric DAP Nitrogen Credit**: When soil test is provided, DAP applied for phosphate delivers $18\%$ elemental Nitrogen:
  $$N_{\text{from\_DAP}} = \text{DAP}_{\text{applied}} \times 0.18$$
  $$N_{\text{supplementary}} = \max\left(0.0, \, \text{Target}_N - N_{\text{from\_DAP}}\right)$$
  $$\text{Urea}_{\text{supplementary}} = \frac{N_{\text{supplementary}}}{0.46}$$
  This prevents applying $50\text{ kg/ha}$ of excess physical Urea, protecting crops from blast disease, lodging, and nitrate runoff.

---

## 3. Package Structure

```text
FieldWise_main/model/ml_pipeline/recommendation_engine/
├── __init__.py               # Package metadata and public class exports
├── catalogue.py              # CanonicalCropCatalogue (19 crops, 31 windows, thresholds)
├── schemas.py                # Type-safe dataclasses and enums for inputs, outputs, scores
├── input_validator.py        # Strict validation, normalization, and bounds checking
├── planting_window.py        # Six-field temporal and agro-climatic window resolver
├── water_assessment.py       # Decoupled physical water accounting & USDA-SCS aggregation
├── tier1_eligibility.py      # Five biological survival gates (Boolean eligibility)
├── tier2_scoring.py          # Gaussian distance, Liebig aggregation, and soft penalties
├── dci_confidence.py         # 6-domain DCI calculation and confidence tier classification
├── ranking.py                # Deterministic sorting and environmental hostility evaluator
├── explanations.py           # Agronomic diagnostics, risk warnings, and DAP-credited fertilizer
├── engine.py                 # CropRecommendationEngine main coordinator
├── README.md                 # Architecture, mathematical formulas, and usage guide
└── tests/
    ├── __init__.py
    ├── test_acceptance_matrix.py # All 18 functional acceptance tests (TEST-01 to TEST-18)
    ├── test_edge_cases.py        # 9 edge-case, boundary, and determinism test suites
    └── run_all_tests.py          # Unified CLI runner and report generator
```

---

## 4. Usage Guide

### Basic Python Invocation

```python
from recommendation_engine import (
    CropRecommendationEngine,
    RecommendationQuery,
    LocationInput,
    TemporalInput,
    ClimateWaterInput,
    EdaphicInput,
)

# 1. Initialize engine
engine = CropRecommendationEngine()

# 2. Formulate query
query = RecommendationQuery(
    location=LocationInput(state="Punjab", district="Ludhiana"),
    temporal=TemporalInput(sowing_month=11, sowing_date="2026-11-10", cultivation_season="Rabi"),
    climate_and_water=ClimateWaterInput(
        seasonal_rainfall_amount=50.0,
        temperature_mean=18.0,
        relative_humidity=60.0,
        irrigation_access="Tubewell_Borewell",
        irrigation_water_quantity_mm=280.0,
        irrigation_type="Surface_Furrow",
    ),
    edaphic=EdaphicInput(
        soil_texture="Loamy",
        soil_ph=7.4,
        has_soil_test=True,
        soil_nitrogen=310.0,
        soil_phosphorus=32.0,
        soil_potassium=220.0,
    )
)

# 3. Generate recommendations
result = engine.recommend(query)

print("Execution Status:", result.status)
print("Data Completeness Index:", result.query_summary.data_completeness_index)
print("Confidence Tier:", result.query_summary.evidence_confidence_tier)

for rec in result.recommendations:
    print(f"Rank {rec.rank}: {rec.canonical_name}")
    print(f"  Suitability Index: {rec.suitability_score}/100 [{rec.evidence_confidence_tier.value}]")
    print(f"  Limiting Factor Sub-Scores: Climate={rec.tier2_components.climate_score}, Water={rec.tier2_components.water_score}")
    if rec.fertilizer_prescription:
        print("  Fertilizer Commercial Bags:", rec.fertilizer_prescription.commercial_products)
```

---

## 5. Verification & Testing

To run the complete automated test suite (27 tests: 18 acceptance tests + 9 edge-case suites):

```bash
# From workspace root
python3 FieldWise_main/model/ml_pipeline/recommendation_engine/tests/run_all_tests.py

# Or via standard unittest runner
python3 -m unittest discover -s FieldWise_main/model/ml_pipeline/recommendation_engine/tests -p "test_*.py"

# Or from an external working directory (e.g. /tmp) to verify directory portability
cd /tmp && python3 -m unittest discover -s /Users/shivamkumar/farmingFinal/FieldWise_main/model/ml_pipeline/recommendation_engine/tests -p "test_*.py"
```

### Verification Invariants Enforced
- **100% Pass Rate**: 27 / 27 tests pass deterministically.
- **Zero Probability Claims**: Scores are designated exclusively as *Agronomic Suitability Index (0–100)*.
- **Zero Production Mutations**: Live application code remains 100% untouched.
- **Portability**: Pure standard library implementation; zero third-party dependencies required.
