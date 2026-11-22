# FieldWise — Phase 3C.4: Scoring Architecture Specification

**Specification Version**: 1.5.0-FINAL-WATER-RECONCILIATION (Phase 3C.4.2.2.1)  
**Phase**: Phase 3C.4 / Phase 3C.4.2.2.1 (Effective Rainfall and Rainfed Water Reconciliation)  
**Status**: DESIGN-ONLY SPECIFICATION (Read-Only Application Preservation Enforced)  
**Target Integration**: Future Phase 3C.5 Implementation  

---

## 1. Executive Summary

Phase 3C.3 proved that FieldWise's legacy scoring engine (`model/predictor.js` and `src/lib/predictorEngine.ts`) suffered from a **critical additive scoring pathology**: by summing 8 independent continuous features into a 110-point scale, the system allowed favorable scores from unrelated factors (e.g. nitrogen, phosphorus, humidity) to override fatal biological constraints (e.g. severe drought, extreme frost, or lethal soil alkalinity). In empirical stress tests, cool-season winter pulses (Lentil, Chickpea) were recommended in a 38°C desert summer with 50%–55% confidence, and Wheat was recommended in a 1200 mm submerged wetland with 51.7% confidence.

This document establishes the **Two-Tier Hybrid Scoring Architecture** for FieldWise, updated in Phase 3C.4.2 to resolve all uncertainty, missing data, and score comparability requirements. It preserves the approved mathematical formulation (Boolean Gating followed by Liebig-weighted geometric aggregation), while providing formal specifications on:
1. `UNKNOWN` eligibility gating outcomes (never a confirmed pass).
2. The Data Completeness Index ($DCI$) formulation.
3. The absolute non-comparability of scores across disparate data-completeness tiers.
4. Deterministic behavior when all candidate crops hold provisional status.
5. The definitive boundary between `NO_RECOMMENDATION_SUITABLE` (hostile conditions) and `INSUFFICIENT_DATA` (missing inputs).
6. Strict prohibition against describing heuristic suitability scores as calibrated probabilities.

---

## 2. Comparative Evaluation of Candidate Architectures

To identify the optimal recommendation engine structure, four alternative architectures were evaluated:

| Architecture | Mathematical Formulation | Agronomic Strengths | Critical Vulnerabilities | Evaluation Verdict |
| :--- | :--- | :--- | :--- | :---: |
| **Option 1: Legacy Additive Scoring** | $S = \sum_{i=1}^M w_i s_i(\mathbf{x})$ | Simple to compute; continuous decay via Gaussian functions. | **Violates Liebig's Law of the Minimum**. Fatal deficits on critical variables are compensated by surplus in unrelated features. | ❌ **REJECTED (Dangerous)** |
| **Option 2: Gated Additive Scoring** | $S = \mathcal{E}(\mathbf{x}) \cdot \sum_{i=1}^M w_i s_i(\mathbf{x})$ where $\mathcal{E} \in \{0, 1\}$ | Prevents completely lethal crops from being recommended. | Within the eligible set, compensatory pathology persists: severe moisture stress can still be masked by high phosphorus fertility. | ⚠️ **INSUFFICIENT** |
| **Option 3: Pure Multiplicative (Cobb-Douglas / Liebig Min)** | $S = \prod_{i=1}^M s_i^{w_i}$ or $S = \min_i s_i$ | Strictly respects limiting factors; any factor dropping to 0 zeroes the entire score. | Hyper-sensitive to single noisy sensor readings or missing secondary inputs; poor ranking differentiation among near-optimal crops. | ⚠️ **UNBALANCED** |
| **Option 4: Two-Tier Hybrid Architecture (Recommended)** | **Tier 1**: Boolean Eligibility Filter $\mathcal{E}(c, \mathbf{x}) \in \{0, 1\}$<br>**Tier 2**: Liebig-Weighted Geometric Suitability Ranking | **Guarantees zero fatal recommendations** via Tier 1 hard gating; smooth multi-criteria ranking in Tier 2 with non-compensatory penalty. | Requires structured input contract with explicit irrigation and seasonal context. | ✅ **RECOMMENDED (Approved)** |

---

## 3. Mathematical Formalization of the Two-Tier Hybrid Architecture

```
[User Input Query: Location, Temporal System, Water Regime, Climate, Soil, Nutrients]
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ TIER 1: AGRONOMIC ELIGIBILITY & SAFETY GATING                                 │
│                                                                               │
│  For each crop c in 19 Canonical Crops:                                       │
│    E_season   = Compatible(c.planting_windows, Input.temporal)                │
│    E_thermal  = Input.sowing_temp between c.sowing_temp_survival_limits       │
│    E_soil     = Input.soil_texture in c.compatible_soils                      │
│    E_ph       = Input.soil_ph between (c.ph_min - 0.5) and (c.ph_max + 0.5)   │
│    E_water    = WaterSufficiency(c, Input.water_regime)                       │
│                                                                               │
│    Gating Outcomes: ELIGIBLE, INELIGIBLE, UNKNOWN / PROVISIONAL               │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
         E(c, x) = INELIGIBLE      E(c, x) = UNKNOWN    E(c, x) = ELIGIBLE
                    │                   │                   │
                    ▼                   ▼                   ▼
    ┌─────────────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
    │ STATUS: INELIGIBLE      │ │ STATUS:         │ │ TIER 2: LIEBIG-WEIGHTED │
    │ Suitability Score = 0.0 │ │ PROVISIONAL     │ │ SUITABILITY RANKING     │
    │ Log specific failing    │ │ Flag high water │ │ Compute component scores│
    │ biological rules        │ │ or season risk  │ │   s_clim, s_wat, s_soil,│
    │                         │ │ Max conf=MEDIUM │ │   s_nutr, s_ph in [0,100│
    └─────────────────────────┘ └────────┬────────┘ └───────────┬─────────────┘
                                         │                      │
                                         └──────────┬───────────┘
                                                    │
                                                    ▼
                                    ┌───────────────────────────────┐
                                    │ GEOMETRIC AGGREGATION         │
                                    │ Final Suitability Index (0-100│
                                    │ Displayed with DCI & Conf Tier│
                                    └───────────────────────────────┘
```

### 3.1 Tier 1: Biological Eligibility Gating Rules
Let $\mathcal{C} = \{c_1, c_2, \dots, c_{19}\}$ be the 19 canonical crops. For an input query $\mathbf{x}$, each candidate crop $c$ is evaluated across five biological survival gates:

1. **Temporal & Planting Window Gate**:
   $$\mathcal{G}_{\text{season}}(c, \mathbf{x}) = \begin{cases} \text{PASS} & \text{if } \text{Match}(\mathbf{x}.\text{temporal}, c.\text{planting\_windows}) \\ \text{FAIL} & \text{if incompatible (e.g. Wheat in July, Aman rice in December)} \\ \text{UNKNOWN} & \text{if temporal parameters missing or region unlisted} \end{cases}$$
2. **Thermal Emergence Gate**:
   Evaluates sowing-stage temperature against lethal germination survival bounds:
   $$\mathcal{G}_{\text{thermal}}(c, \mathbf{x}) = \begin{cases} \text{PASS} & \text{if } c.T_{\text{sow\_min}} \le \mathbf{x}.T_{\text{sow\_mean}} \le c.T_{\text{sow\_max}} \\ \text{FAIL} & \text{otherwise} \end{cases}$$
   *(Note: Reproductive/flowering heat stress, such as Rice floret sterility >38°C or Maize tassel drying >40°C, is evaluated strictly as Tier 2 soft penalties or UI advisories, NEVER as sowing-stage hard exclusions).*
3. **Soil Texture Whitelist Gate**:
   $$\mathcal{G}_{\text{soil}}(c, \mathbf{x}) = \begin{cases} \text{PASS} & \text{if } \mathbf{x}.\text{soil\_texture} \in c.\text{compatible\_soils} \\ \text{PASS\_WITH\_ADVISORY} & \text{otherwise (triggers Tier 2 soft penalty)} \end{cases}$$
   *(Note: Following the Phase 3C.4.2.2 evidence re-audit under the strict biological lethality standard, textural and drainage mismatches are evaluated via Tier 2 soft penalties and management advisories, not lethal hard exclusions).*
4. **Soil pH Survival Gate**:
   $$\mathcal{G}_{\text{pH}}(c, \mathbf{x}) = \begin{cases} \text{PASS} & \text{if } (c.\text{pH}_{\min} - 0.5) \le \mathbf{x}.\text{soil\_ph} \le (c.\text{pH}_{\max} + 0.5) \\ \text{PASS\_WITH\_PH\_STRESS\_WARNING} & \text{otherwise (triggers Tier 2 soft penalty)} \end{cases}$$
   *(Note: Re-audited in Phase 3C.4.2.2: sub-optimal pH induces nutrient chlorosis and yield loss rather than 100% biological mortality, handled via Tier 2 soft penalty).*
5. **Water Sufficiency Gate**:
   - **Governing Architecture**: Evaluated strictly under decoupled water semantics ($ET_c$, $P_{\text{eff}}$, $NIR$, $GIR$). Natural rainfall must **NEVER** be compared directly against $ET_c$ to disqualify an irrigated crop.
   - **Rainfed Regime (`irrigation_access = 'None_Rainfed'`)**:
     $$\mathcal{G}_{\text{water}}(c, \mathbf{x}) = \begin{cases} 
     \text{SCREENING\_THRESHOLD\_MET} & \text{if } \mathbf{x}.R_{\text{seasonal}} \ge c.\text{rainfed\_threshold\_mm} \\ 
     \text{WATER\_DEFICIT\_WARNING} & \text{if } \mathbf{x}.R_{\text{seasonal}} < c.\text{rainfed\_threshold\_mm} \text{ (triggers Tier 2 soft penalty)} \\ 
     \text{UNKNOWN} & \text{if } \mathbf{x}.R_{\text{seasonal}} \text{ is missing or unmeasured} 
     \end{cases}$$
     *(CRITICAL GOVERNANCE MANDATE: SCREENING_THRESHOLD_MET indicates gross precipitation meets regional benchmarks; it is NOT proof of crop water sufficiency and NEVER automatically produces PASS_VERIFIED. If effective rainfall is empirically estimated via monthly USDA-SCS, status is CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE; if monthly distribution is missing, status is CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK. Rainfed screening thresholds NEVER independently produce HARD_EXCLUSION or Tier 1 FAIL).*
   - **Irrigated Regime with Measured Quantity**:
     Total net water reaching the root zone is calculated as $W_{\text{net}} = NIR_{\text{delivered}} + P_{\text{eff}} = (GIR \times \eta_{\text{appl}}) + P_{\text{eff}}$.
     $$\mathcal{G}_{\text{water}}(c, \mathbf{x}) = \begin{cases} \text{PASS\_VERIFIED} & \text{if } W_{\text{net}} \ge c.ET_{c,\min} \text{ and } P_{\text{eff}} \text{ is directly measured/certified} \\ \text{CONDITIONALLY\_ELIGIBLE\_WITH\_PROVISIONAL\_WATER\_BALANCE} & \text{if } W_{\text{net}} \ge c.ET_{c,\min} \text{ and } P_{\text{eff}} \text{ is estimated (e.g. USDA-SCS)} \\ \text{PASS\_WITH\_WATER\_DEFICIT\_WARNING} & \text{if } W_{\text{net}} < c.ET_{c,\min} \text{ (triggers Tier 2 Liebig soft penalty)} \end{cases}$$
     *(Note: If delivered root water is below minimum ETc, the crop is NOT fatally failed in Tier 1; instead, it incurs a severe Liebig soft penalty in Tier 2 alongside moisture deficit advisories. Effective rainfall is never assumed 100% or estimated via flat multipliers).*
   - **Irrigated Regime with Unmeasured Quantity ($I_{\text{quantity\_mm}} = \text{null}$)**:
     $$\mathcal{G}_{\text{water}}(c, \mathbf{x}) = \begin{cases} \text{SCREENING\_THRESHOLD\_MET\_UNMEASURED\_IRRIGATION\_ADVISORY} & \text{if } \mathbf{x}.R_{\text{seasonal}} \ge c.\text{rainfed\_threshold\_mm} \\ \text{UNKNOWN} & \text{otherwise (irrigation access present, but volumetric sufficiency unmeasured)} \end{cases}$$
     *(Note: When outcome is `UNKNOWN`, status becomes `CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK`. The engine NEVER auto-passes or invents flat irrigation depths).*

---

## 4. Scoring and Uncertainty Consistency Principles

### 4.1 UNKNOWN Eligibility is Never a Confirmed Pass
A core governance rule established in Phase 3C.4.2 and affirmed in Phase 3C.4.2.1 is:
- If a biological rule cannot be definitively evaluated due to missing input data (e.g. unmeasured irrigation quantity, unstated sowing month, unverified district window), the outcome is **`UNKNOWN`** or **`PROVISIONAL`**.
- An `UNKNOWN` outcome **MUST NEVER be treated as a confirmed PASS**.
- A candidate crop with an `UNKNOWN` gating status cannot receive a `HIGH_CONFIDENCE` recommendation badge. Its confidence tier is capped at `PROVISIONAL_EVALUATION` or `MODERATE_ESTIMATED`.
- The user interface must display an explicit advisory banner detailing the exact missing parameter.

### 4.2 Data Completeness Index ($DCI$) Formulation
The engine computes a formal Data Completeness Index tracking the proportion of weight derived from measured primary data versus imputed or defaulted inputs:

$$DCI = \sum_{k=1}^{6} w_k \cdot c_k \quad \in [0.00, 1.00]$$

Where the 6 orthogonal domains and their verified weights are:
$$\begin{aligned}
w_{\text{temporal}} &= 0.15 \quad &\text{(Sowing date, month, and regional planting window)} \\
w_{\text{climate}} &= 0.20 \quad &\text{(Mean temperature and relative humidity)} \\
w_{\text{water}} &= 0.25 \quad &\text{(Seasonal rainfall and volumetric irrigation applied)} \\
w_{\text{soil}} &= 0.15 \quad &\text{(Soil texture class and drainage characteristics)} \\
w_{\text{ph}} &= 0.10 \quad &\text{(Soil reaction / potentiometric pH)} \\
w_{\text{nutrients}} &= 0.15 \quad &\text{(Available N, P, K from Soil Health Card)}
\end{aligned}$$

$$\sum_{k=1}^{6} w_k = 0.15 + 0.20 + 0.25 + 0.15 + 0.10 + 0.15 = 1.000$$

**Domain Measurement Criteria ($c_k \in [0, 1]$)**:
1. $c_1$ (Temporal): $1.00$ for exact sowing date (`YYYY-MM-DD`); $0.60$ for broad season only; $0.00$ if omitted.
2. $c_2$ (Climate): $1.00$ for measured temperature and humidity; $0.50$ for single parameter; $0.00$ if omitted.
3. $c_3$ (Water): $1.00$ for measured rain + measured $GIR$ (or rainfed with gauged rain); $0.40$ for confirmed irrigation access but unmeasured volumetric depth ($I_{\text{quantity\_mm}} = \text{null}$); $0.00$ if omitted.
4. $c_4$ (Soil Texture): $1.00$ for lab mechanical analysis; $0.50$ for regional map estimate; $0.00$ if omitted.
5. $c_5$ (Soil pH): $1.00$ for potentiometric lab measurement; $0.00$ if omitted.
6. $c_6$ (Soil NPK): $1.00$ for quantitative SHC test; $0.50$ for qualitative fertility class; $0.00$ if omitted (imputed $s_{\text{nutrients}} = 70.0$).

**Four Reproducible Worked Benchmark Calculations**:
- **Benchmark 1 (Gold Standard Full Profile)**: All 6 measured $\implies DCI = \mathbf{1.000}$ (`HIGH_CONFIDENCE`).
- **Benchmark 2 (Commercial Irrigated Wheat, Missing SHC NPK)**: $c_1=1.0, c_2=1.0, c_3=1.0, c_4=1.0, c_5=1.0, c_6=0.0 \implies DCI = \mathbf{0.850}$ (`HIGH_CONFIDENCE_ESTIMATED_FERTILITY`).
- **Benchmark 3 (Typical Smallholder Profile)**: Broad Kharif ($c_1=0.60$), tubewell unmeasured ($c_3=0.40$), lab texture ($c_4=1.0$), lab pH ($c_5=1.0$), no SHC ($c_6=0.0$) $\implies DCI = 0.090 + 0.200 + 0.100 + 0.150 + 0.100 + 0.000 = \mathbf{0.640}$ (`PROVISIONAL_EVALUATION`). *(If pH estimated $c_5=0.50 \implies DCI = \mathbf{0.590}$)*.
- **Benchmark 4 (Rainfed Dryland Farmer)**: Date verified ($c_1=1.0$), rain gauge ($c_3=1.0$), regional soil texture ($c_4=0.50$), lab pH ($c_5=1.0$), no SHC ($c_6=0.0$) $\implies DCI = 0.15 + 0.20 + 0.25 + 0.075 + 0.10 + 0.00 = \mathbf{0.775}$ (`MODERATE_ESTIMATED`).

**Strict Rejection Boundary**:
- If $DCI < 0.500$, the engine halts with **`INSUFFICIENT_DATA`**.

### 4.3 Absolute Non-Comparability of Scores
**CRITICAL GOVERNANCE PRINCIPLE**: Scores generated with different sets of missing inputs are **NOT directly comparable**!
- An agronomic suitability score of $88.5$ computed with $DCI = 1.00$ reflects a verified physiological alignment backed by laboratory soil testing and measured irrigation depth.
- An agronomic suitability score of $88.5$ computed with $DCI = 0.70$ relies on imputed baseline fertility ($s_{\text{nutrients}} = 70.0$) and unmeasured water delivery.
- Sorting both candidates on a single naive leaderboard produces misleading recommendations.
- **Architectural Mandate**: Recommendations must always be presented as the 2D tuple:
  $$\big[\text{Agronomic Suitability Index (0–100)},\; \text{Evidence Confidence Tier}\big]$$
  Crops with lower $DCI$ must display their provisional status alongside the numerical score.

### 4.4 Behavior When All Candidates Are Provisional
When the query parameters contain unverified elements (e.g. unknown agro-climatic district, unmeasured irrigation depth, or regional planting window unverified in ICAR literature):
1. The engine executes deterministic Tier 2 geometric scoring across all eligible candidates.
2. The entire candidate set is flagged as **`PROVISIONAL_EVALUATION`**.
3. The UI presents the ranked list with a prominent, non-dismissible advisory banner:
   > ⚠️ **Provisional Evaluation Notice**: Recommendations are based on regional baseline assumptions because local water discharge or district-specific planting windows are unmeasured. Verify local borewell capacity and consult your Krishi Vigyan Kendra (KVK) before procurement.
4. No crop in the result set may display a `PRODUCTION_READY` or `HIGH_CONFIDENCE` badge.

### 4.5 Deterministic Boundary: NO_RECOMMENDATION_SUITABLE versus INSUFFICIENT_DATA
The engine enforces a strict, deterministic boundary between environmental hostility and input data deficiency:

```
┌──────────────────────────────────────┬──────────────────────────────────────┐
│ STATUS: NO_RECOMMENDATION_SUITABLE   │ STATUS: INSUFFICIENT_DATA            │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 1. Complete, valid inputs provided   │ 1. Essential inputs missing or       │
│    by the user.                      │    uncalibrated.                     │
│ 2. The agro-climatic environment is  │ 2. Biological feasibility cannot be  │
│    genuinely hostile:                │    computed.                         │
│    - Extreme heat (48°C)             │ 3. Missing critical inputs:          │
│    - Severe sodicity (pH > 9.0)      │    - Sowing month omitted            │
│    - Toxic acidity (pH < 4.2)        │    - Soil pH omitted                 │
│    - Hyper-arid rainfed drought      │    - Arid rain with unstated water   │
│ 3. All 19 crops fail Tier 1 gating   │ 4. System halts before scoring;      │
│    or suitability score < 40.0.      │    prompts user to enter essential   │
│ 4. Protects farmer from catastrophic │    agricultural parameters.          │
│    investment loss; outputs soil/land│                                      │
│    reclamation advice.               │                                      │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### 4.6 Strict Prohibition of Calibrated Probability Claims
The suitability score is an index of physiological alignment derived from Liebig limiting factors and Gaussian environmental distances.
- It is **NOT** a posterior probability distribution $P(\text{Success} \mid \mathbf{x})$.
- It **MUST NEVER** be presented as "Probability of Success: 85%" or "Model Confidence: 92%".
- In all user interfaces, API documentation, and code comments, it must be designated strictly as:
  $$\textbf{Agronomic Suitability Index (0–100)}$$

---

## 5. Mathematical Aggregation Formulae (Tier 2)

For crops passing Tier 1 gating, suitability is computed across five component scores:

1. **Climate Suitability ($s_{\text{climate}} \in [0, 100]$)**:
   $$s_{\text{climate}}(c, \mathbf{x}) = 60 \cdot \exp\left(-\frac{\Delta_T^2}{2\sigma_T^2}\right) + 40 \cdot \exp\left(-\frac{\Delta_H^2}{2\sigma_H^2}\right)$$
2. **Water Adequacy ($s_{\text{water}} \in [0, 100]$)**:
   - Evaluated consistently with Tier 1 decoupled water semantics:
     - *Rainfed Cultivation*: $W = \mathbf{x}.R_{\text{seasonal}}$, scored against rainfed screening threshold ($c.\text{rainfed\_threshold\_mm}$) and optimal seasonal water ($c.\text{optimal\_seasonal\_water\_mm}$).
     - *Irrigated Cultivation with Measured Application*: $W = P_{\text{eff}} + (GIR \times \eta_{\text{appl}})$, scored against $c.ET_{c,\min}$ and $c.ET_{c,\text{opt}}$.
     - *Irrigated Cultivation with Unmeasured Volume*: Assigned baseline provisional score $s_{\text{water}} = 70.0\text{ points}$, with water completeness penalized ($c_3 = 0.40$) and flagged as `CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK`.
   $$s_{\text{water}}(c, \mathbf{x}) = \begin{cases} 
   100 & \text{if } W \ge c.W_{\text{optimal}} \\
   100 \cdot \left(\frac{W - c.W_{\min}}{c.W_{\text{optimal}} - c.W_{\min}}\right)^{0.75} & \text{if } c.W_{\min} \le W < c.W_{\text{optimal}} \\
   10.0 + 40.0 \cdot \max\left(0.0, \frac{W}{c.W_{\min}}\right) & \text{if } 0 < W < c.W_{\min} \text{ (moisture stress soft penalty)} \\
   70.0 & \text{if } \text{unmeasured irrigation (provisional)}
   \end{cases}$$
3. **Edaphic Texture Suitability ($s_{\text{soil}} \in [0, 100]$)**:
   - Primary optimal texture: $100\text{ points}$.
   - Secondary acceptable texture: $75\text{ points}$.
   - Marginal texture: $50\text{ points}$.
4. **Soil Fertility Alignment ($s_{\text{nutrients}} \in [0, 100]$)**:
   - Evaluated against DAC&FW Low/Medium/High fertility limits.
   - Missing soil test fallback: $70.0\text{ points}$ with $DCI$ reduction.
5. **Soil Reaction ($s_{\text{ph}} \in [0, 100]$)**:
   - Within preferred range $[c.\text{pH}_{\min}, c.\text{pH}_{\max}]$: $100\text{ points}$.
   - Within buffer $[c.\text{pH}_{\min}-0.5, c.\text{pH}_{\min})$ or $(c.\text{pH}_{\max}, c.\text{pH}_{\max}+0.5]$: Linear decay from $100$ down to $50\text{ points}$.

### 5.1 Non-Compensatory Liebig Aggregation
$$\text{CoreSuitability}(c, \mathbf{x}) = s_{\text{climate}}^{0.30} \cdot s_{\text{water}}^{0.30} \cdot s_{\text{soil}}^{0.20} \cdot s_{\text{nutrients}}^{0.10} \cdot s_{\text{ph}}^{0.10}$$

$$\text{LiebigPenaltyFactor}(c, \mathbf{x}) = \left( \frac{\min(s_{\text{climate}}, s_{\text{water}}, s_{\text{soil}}, s_{\text{ph}})}{100} \right)^{0.25}$$

$$\text{SuitabilityIndex}(c, \mathbf{x}) = \text{CoreSuitability}(c, \mathbf{x}) \times \text{LiebigPenaltyFactor}(c, \mathbf{x})$$

The Liebig factor ensures that if any physical component is marginal (e.g. $s_{\text{water}} = 40$), the overall suitability is penalized non-linearly, preventing high fertility or ideal temperature from masking acute moisture deficit.
