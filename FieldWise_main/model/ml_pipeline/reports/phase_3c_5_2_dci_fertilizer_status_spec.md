# FieldWise — Phase 3C.5.2: DCI Provenance & Fertilizer Status Specification

**Document ID**: `FW-P3C5.2-SPEC-02`  
**Phase**: `Phase 3C.5.2 (Evidence Confidence and Agronomic Gate Safety)`  
**Baseline Date**: `2026-11-20`  
**Status**: `APPROVED_SPECIFICATION`  
**Classification**: `Technical Specification & Provenance Semantics`

---

## 1. Executive Summary & Purpose

During the independent audit of Phase 3C.5.1, two critical issues relating to evidence integrity and advisory claims were identified:
1. **DCI Evidence Provenance Inconsistencies**:
   - The Data Completeness Index (DCI) allowed queries with `has_soil_test=True` to assume that soil texture and soil pH were laboratory measured, receiving $c_k = 1.00$.
   - Missing rainfall source and missing irrigation quantity basis defaulted to gauged or measured status.
   - This violated the core epistemic requirement that unstated or missing metadata must never imply laboratory or gauged precision.
2. **Fertilizer Prescription Status Over-Claims**:
   - The engine assigned the status `VERIFIED_STCR_GENERATED` to calculations that applied state-level Recommended Dose of Fertilizer (RDF) percentage adjustments ($\pm 25\%$).
   - General stoichiometric product calculations (converting N, P$_2$O$_5$, K$_2$O to Urea, DAP, and MOP) do not constitute verified polynomial Soil Test Crop Response (STCR) targeted yield equations.
   - Missing nutrient basis (`nutrient_basis = None`) was silently processed if NPK numbers were entered.

This specification formalizes the strict provenance tiers for all six DCI domains and defines the unambiguous status classification for fertilizer prescriptions.

---

## 2. Six-Domain DCI Provenance Semantics

The Data Completeness Index ($DCI$) is computed as:
$$DCI = \sum_{k=1}^{6} w_k \cdot c_k$$
with weights:
$$w_{\text{temporal}} = 0.15,\; w_{\text{climate}} = 0.20,\; w_{\text{water}} = 0.25,\; w_{\text{soil}} = 0.15,\; w_{\text{ph}} = 0.10,\; w_{\text{nutrients}} = 0.15$$
and rejection boundary $DCI < 0.500 \implies \text{INSUFFICIENT\_DATA}$.

### 2.1 Strict Domain Completeness ($c_k$) Scoring Matrix

| Domain ($k$) | Weight ($w_k$) | Evidence Provenance Level | Score ($c_k$) | Semantic Classification & Provenance Rules |
| :--- | :---: | :--- | :---: | :--- |
| **1. Temporal** | 0.15 | Exact sowing date (`YYYY-MM-DD`) | **1.00** | Direct calendar date; enables precise phenological window matching. |
| | | Sowing month only (`sowing_month`) | **0.60** | Broad monthly or seasonal estimation. |
| | | Temporal omitted | **0.00** | Missing temporal data. |
| **2. Climate** | 0.20 | Temperature + Relative Humidity | **1.00** | Measured daily/seasonal thermal and humidity metrics. |
| | | Single parameter provided | **0.50** | Temperature or humidity provided in isolation. |
| | | Climate omitted | **0.00** | Missing climatic data. |
| **3. Water** | 0.25 | Gauged rain + Flow-meter irrigation | **1.00** | IMD/on-farm rain gauge + calibrated flow meter / V-notch weir. |
| | | Measured rainfed (Gauged rain) | **1.00** | Confirmed rainfed with verified IMD / on-farm rain gauge. |
| | | Estimated pump hours irrigation | **0.75** | Hours run $\times$ pump HP capacity (uncalibrated discharge). |
| | | Estimated rainfall | **0.60** | Farmer or regional rainfall estimate. |
| | | Unstated irrigation quantity basis | **0.60** | Irrigation quantity provided but basis/calibration unstated. |
| | | Unstated rainfed rainfall source | **0.50** | Rainfed rainfall provided without source (NEVER defaults to gauged). |
| | | Unmeasured irrigation access | **0.40** | Irrigation infrastructure present, volume completely unknown. |
| | | Water omitted | **0.00** | Missing water data. |
| **4. Soil Texture** | 0.15 | Laboratory mechanical analysis | **1.00** | Pipette or hydrometer sedimentation analysis (IS 2720 Part 4). |
| | | Field feel / Regional map / Unstated | **0.50** | Ribbon/feel test, regional soil map, or unstated method (`has_soil_test=True` does NOT prove texture lab analysis). |
| | | Texture omitted | **0.00** | Missing texture data. |
| **5. Soil pH** | 0.10 | Laboratory potentiometric analysis | **1.00** | Glass electrode 1:2.5 soil-water suspension (IS 2720 Part 26) with certified lab. |
| | | Field strip / Pocket pen / Unstated | **0.50** | Colorimetric strip, portable tester, or unstated method (`has_soil_test=True` does NOT prove potentiometric lab method). |
| | | pH omitted | **0.00** | Missing pH data. |
| **6. Nutrients** | 0.15 | Complete certified lab SHC | **1.00** | All 3 N, P, K measured on `SHC_Available_kg_ha` with certified lab source. |
| | | Complete SHC with unstated lab | **0.75** | All 3 N, P, K on `SHC_Available_kg_ha`, but lab accreditation unstated. |
| | | Incomplete or unverified basis | **0.50** | Qualitative classes, partial nutrients (1 or 2 present), or unverified basis. |
| | | Nutrients omitted | **0.00** | Missing nutrient data (evaluated on 50.0 provisional baseline in Tier 2). |

### 2.2 Mathematical Differentiation Proof
Identical input values ($P=220\text{ mm}, \text{pH}=7.4, \text{texture}=\text{Loamy}, \text{NPK}=(310, 32, 220)$) evaluate as follows:
- **Verified Provenance Query**:
  $$DCI = 0.15(1.0) + 0.20(1.0) + 0.25(1.0) + 0.15(1.0) + 0.10(1.0) + 0.15(1.0) = \mathbf{1.000} \implies \text{HIGH\_CONFIDENCE}$$
- **Unstated Metadata Query** (`has_soil_test=True`, but method fields omitted):
  $$DCI = 0.15(1.0) + 0.20(1.0) + 0.25(1.0) + 0.15(0.50) + 0.10(0.50) + 0.15(1.0) = \mathbf{0.875} \implies \text{HIGH\_CONFIDENCE\_ESTIMATED\_FERTILITY}$$
- **Provisional Rainfed Farmer Profile**:
  $$DCI = 0.15(1.0) + 0.20(1.0) + 0.25(0.50) + 0.15(0.50) + 0.10(0.50) + 0.15(0.00) = \mathbf{0.600} \implies \text{PROVISIONAL\_EVALUATION}$$

---

## 3. Fertilizer Prescription Status Semantics

### 3.1 Status Classification Hierarchy

| Status Code | Conditions for Assignment | Commercial Product Bag Output | Stoichiometric Notes Content |
| :--- | :--- | :---: | :--- |
| **`BASELINE_RDF_ARITHMETIC`** | Complete quantitative soil test on `SHC_Available_kg_ha` basis; state RDF adjusted $\pm 25\%$ for Low/High fertility. | **Emitted** (Urea, DAP, MOP in kg/ha and 50 kg bags) | Fully explains 18% DAP N credit deduction, net Urea calculation, and MOP potassium stoichiometry. |
| **`WITHHELD_UNVERIFIED_NUTRIENT_BASIS`** | `nutrient_basis` is omitted (`None`), qualitative (`Qualitative_Fertility_Class`), or non-standard. | **Withheld** (`{}`) | Explains that commercial product bags cannot be safely computed without verified quantitative units (kg/ha). |
| **`WITHHELD_INCOMPLETE_SOIL_TEST`** | `has_soil_test=True`, but one or more of N, P, or K is missing (`None`). | **Withheld** (`{}`) | Identifies missing nutrient components and requires complete NPK test. |
| **`WITHHELD_MISSING_SOIL_TEST`** | `has_soil_test=False` or soil test card completely omitted. | **Withheld** (`{}`) | Advises farmer to obtain accredited Soil Health Card before purchasing chemical fertilizers. |

### 3.2 Stoichiometric Invariant & DAP Nitrogen Credit Deduction
When `BASELINE_RDF_ARITHMETIC` is assigned:
1. Phosphorus requirement ($P_2O_5$) is satisfied via DAP ($46\%\; P_2O_5, 18\%\; N$):
   $$\text{DAP}_{\text{kg/ha}} = \frac{P_2O_5}{0.46}$$
2. The nitrogen supplied by DAP is credited towards total nitrogen:
   $$N_{\text{from DAP}} = \text{DAP}_{\text{kg/ha}} \times 0.18$$
3. Supplementary Urea ($46\%\; N$) satisfies only the remaining net nitrogen:
   $$N_{\text{net}} = \max(0.0, N_{\text{target}} - N_{\text{from DAP}})$$
   $$\text{Urea}_{\text{kg/ha}} = \frac{N_{\text{net}}}{0.46}$$
4. Potassium requirement ($K_2O$) is satisfied via MOP ($60\%\; K_2O$):
   $$\text{MOP}_{\text{kg/ha}} = \frac{K_2O}{0.60}$$

**Example (Wheat NWPZ Medium Fertility: 120 N – 60 P$_2$O$_5$ – 40 K$_2$O)**:
- DAP = $60 / 0.46 = 130.4\text{ kg/ha}$ ($2.6$ bags of 50 kg)
- DAP N Credit = $130.4 \times 0.18 = 23.5\text{ kg/ha N}$
- Net N = $120.0 - 23.5 = 96.5\text{ kg/ha N}$
- Supplementary Urea = $96.5 / 0.46 = 209.8\text{ kg/ha}$ ($4.2$ bags of 50 kg)
- MOP = $40.0 / 0.60 = 66.7\text{ kg/ha}$ ($1.3$ bags of 50 kg)
- Preserves balanced plant nutrition and prevents toxic urea over-application.
