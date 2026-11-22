# FieldWise — Phase 3C.3: Recommendation-Rule Safety & Architectural Failure Mode Audit

**Audit Date**: 2026-11-19T13:30:00Z  
**Phase**: Phase 3C.3 (Agronomic Validation of the 19-Crop Recommendation Engine)  
**Target Codebases**:  
- Backend Recommendation Engine: `model/predictor.js`, `model/cropDatabase.js`, `model/fertilizerDatabase.js`  
- Frontend Fallback Engine: `src/lib/predictorEngine.ts`, `src/lib/api.ts`  
- Canonical Reference: `model/ml_pipeline/reports/canonical_crop_taxonomy.json`  
**Execution Context**: Independent Safety Audit (Strictly Read-Only; Zero Production Code Changes)

---

## 1. Executive Summary

This report delivers a rigorous mathematical, algorithmic, and agronomic safety audit of FieldWise's existing rule-based crop recommendation engines. 

FieldWise currently operates a dual-engine architecture:
1. An **online backend engine** written in CommonJS (`model/predictor.js` powered by `model/cropDatabase.js`).
2. A **client-side offline fallback engine** written in TypeScript (`src/lib/predictorEngine.ts` wired through `src/lib/api.ts`).

Our audit reveals that while the continuous scoring functions (Gaussian distance decay and piecewise-linear NPK scoring) are mathematically smooth, **the engine exhibits critical agronomic vulnerabilities that make it unsafe for unconstrained farm advisory deployment**. 

### Core Safety Vulnerabilities Summary

| Risk Dimension | Severity | Empirical Mechanism | Practical Agricultural Consequence |
| :--- | :---: | :--- | :--- |
| **Additive Scoring Pathology** | **CRITICAL** | Violates Liebig's Law of the Minimum. Sums 8 independent attributes without hard failure gates. | A crop with 100% lethal conditions on 3 core factors (e.g., severe drought, extreme frost, or alkaline soil) can still score 50%–75% confidence. |
| **Omission of Cultivation Season** | **CRITICAL** | `inputs` object lacks a `season` field; neither engine filters by season during prediction. | Recommends winter Rabi crops (Wheat, Mustard, Chickpea, Onion) during scorching July Kharif monsoon heat. |
| **Water / Irrigation Semantic Distortion** | **CRITICAL** | Hardcodes 30–300 mm rainfall brackets (derived from synthetic Kaggle benchmark) as total water requirements. | High-rainfall paddy regions (1200 mm) have Rice penalized to zero rainfall score; arid farmers (40 mm rain, zero irrigation) are recommended high-water crops. |
| **NPK Unit & Measurement Confusion** | **HIGH** | Hardcodes Recommended Dose of Fertilizers (RDF in kg/ha) as targets for raw soil test inputs. | Farmers inputting normal Soil Health Card available nitrogen (e.g. 320 kg/ha Medium) or potassium (210 kg/ha) receive 0/20 nutrient points. |
| **Toxicity Blindness (Soil pH)** | **HIGH** | pH is implemented strictly as an optional +10 bonus; lethal acid/alkaline extremes receive zero penalty. | Extreme alkaline soil (pH 9.2) recommends sensitive crops (Mango, Chickpea, Groundnut) with 80%+ confidence. |
| **Catalog Asymmetry & Split-Brain** | **HIGH** | Backend defines 16 crops (has Banana, Mango, Jowar; lacks Sunflower, Barley, Millets); Frontend defines 16 crops (inverse). | Dropping internet connection flips available crop recommendations, alters base yields by up to 75%, and changes fertilizer advice. |

---

## 2. Mathematical Formalization of Engine Scoring Mechanics

Both `model/predictor.js` and `src/lib/predictorEngine.ts` implement identical mathematical scoring formulations. Let an input query be defined as a tuple:

$$\mathbf{x} = \langle R, T, H, \text{Soil}, N, P, K, \text{pH} \rangle$$

where:
- $R \in \mathbb{R}_{\ge 0}$: Rainfall (interpreted by user as annual or seasonal, but parsed by engine as uncalibrated scalar).
- $T \in \mathbb{R}$: Ambient temperature (°C).
- $H \in [0, 100]$: Relative humidity (%).
- $\text{Soil} \in \mathcal{S}$: Soil type string.
- $N, P, K \in \mathbb{R}_{\ge 0}$: Soil nutrients.
- $\text{pH} \in [0, 14]$: Soil pH.

### 2.1 Continuous Climate Scoring (Gaussian Decay)
For continuous variables $v \in \{R, T, H\}$ with target range $[v_{\min}, v_{\max}]$ and maximum factor score $S_{\max}$:

$$\Delta_v(x_v) = \begin{cases} 0 & \text{if } v_{\min} \le x_v \le v_{\max} \\ v_{\min} - x_v & \text{if } x_v < v_{\min} \\ x_v - v_{\max} & \text{if } x_v > v_{\max} \end{cases}$$

$$\sigma_v = \max\left(\frac{v_{\max} - v_{\min}}{2}, 1\right)$$

$$S_v(x_v) = S_{\max} \cdot \exp\left( -\frac{\Delta_v(x_v)^2}{2\sigma_v^2} \right)$$

Factor weights assigned:
- Rainfall: $S_{\max}^R = 22$ points.
- Temperature: $S_{\max}^T = 22$ points.
- Humidity: $S_{\max}^H = 16$ points.

### 2.2 Soil Type Matching (Step Function)
Let $\mathcal{W}_c \subset \mathcal{S}$ be the whitelist of compatible soil types for crop $c$:

$$S_{\text{soil}}(\text{Soil}) = \begin{cases} 20 & \text{if } \text{Soil} \in \mathcal{W}_c \\ 0 & \text{if } \text{Soil} \notin \mathcal{W}_c \end{cases}$$

### 2.3 Nutrient Partial Credit Scoring (Piecewise Linear)
For nutrient $u \in \{N, P, K\}$ with optimal range $[u_{\min}, u_{\max}]$ and maximum score $S_{\max}^u$:

$$\text{Tol}_u = 0.25 \cdot (u_{\max} - u_{\min}) + 10$$

$$S_u(x_u) = \begin{cases} 
S_{\max}^u & \text{if } u_{\min} \le x_u \le u_{\max} \\
S_{\max}^u \cdot \left(1 - \frac{\text{dist}_u}{\text{Tol}_u}\right) \cdot 0.60 & \text{if } 0 < \text{dist}_u \le \text{Tol}_u \\
0 & \text{if } \text{dist}_u > \text{Tol}_u
\end{cases}$$

where $\text{dist}_u = \max(0, u_{\min} - x_u, x_u - u_{\max})$.
Factor weights: $S_{\max}^N = 8, S_{\max}^P = 6, S_{\max}^K = 6$.

### 2.4 Soil pH Bonus Scoring
For $\text{pH}$ with target range $[\text{pH}_{\min}, \text{pH}_{\max}]$:

$$S_{\text{pH}}(x_{\text{pH}}) = \begin{cases} 
10 & \text{if } \text{pH}_{\min} \le x_{\text{pH}} \le \text{pH}_{\max} \\
5 & \text{if } 0 < \text{dist}_{\text{pH}} \le 0.5 \\
0 & \text{otherwise}
\end{cases}$$

### 2.5 Total Score, Confidence, and Yield Aggregation
The total raw score is strictly additive:

$$S_{\text{raw}}(\mathbf{x}) = S_R + S_T + S_H + S_{\text{soil}} + S_N + S_P + S_K + S_{\text{pH}}$$

Theoretical maximum: $S_{\text{total\_max}} = 22 + 22 + 16 + 20 + 8 + 6 + 6 + 10 = 110$.

Confidence percentage $C(\mathbf{x})$ is normalized:

$$C(\mathbf{x}) = \min\left(99, \max\left(5, \frac{S_{\text{raw}}(\mathbf{x})}{110} \times 100\right)\right)$$

Yield prediction scales linearly with confidence:

$$\hat{Y}(\mathbf{x}) = Y_{\text{base}} \times \left(0.65 + \frac{C(\mathbf{x})}{100} \times 0.45\right)$$

Selection Rule: All crops satisfying $C(\mathbf{x}) > 35\%$ are retained, sorted descending by $C(\mathbf{x})$, and the top 6 are returned to the user.

---

## 3. Structural Deficiencies & Agronomic Pathology

### 3.1 Violation of Liebig's Law of the Minimum
In plant physiology, Carl Sprengel and Justus von Liebig established that **crop growth and survival are dictated not by total resources available, but by the scarcest resource (limiting factor)**. If a critical ecological requirement—such as temperature, moisture, or soil aeration—falls outside the biological survival threshold, yield collapses to zero regardless of how abundant other factors are.

In FieldWise's additive architecture:
- Suppose a crop has **zero water** ($S_R = 0$).
- Suppose the soil is **totally incompatible** ($S_{\text{soil}} = 0$).
- But temperature, humidity, N, P, K, and pH match ($22 + 16 + 8 + 6 + 6 + 10 = 68$ points).
- Confidence: $C = \frac{68}{110} \times 100 = \mathbf{61.8\%}$!
- Because $61.8\% > 35\%$, the engine recommends this completely unviable crop with high confidence.

### 3.2 Omission of Cultivation Season
In India, the agricultural year is divided into three distinct agro-climatic seasons:
1. **Kharif (Monsoon)**: June/July to October/November. High heat, heavy monsoon rain, long daylight hours.
2. **Rabi (Winter)**: October/November to March/April. Mild warm days, cold nights, dry conditions, short photoperiod.
3. **Zaid (Summer)**: March to June. Extreme heat, desiccating winds, strictly dependent on irrigation.

While `cropDatabase.js` records a `season` string for each crop, **`predictCrops(inputs)` never inspects or accepts season as a parameter**. Consequently:
- Winter crops (Wheat, Barley, Mustard, Chickpea, Lentil) require cold temperatures (10–15°C) for tillering and vegetative vernalization.
- Under current logic, if a farmer enters July weather in Punjab (35°C, high humidity, 180 mm rainfall), FieldWise recommends Wheat with **67.6% confidence** and Onion with **72.2% confidence**. Sowing wheat in July leads to 100% crop death due to seed rot and absence of thermal vernalization.

### 3.3 Rainfall Semantic Distortion: Monthly vs. Seasonal
FieldWise defines rainfall brackets across all 19 crops ranging from 30 mm to 300 mm:
- `rice`: 150–300 mm
- `wheat`: 50–100 mm
- `sugarcane`: 120–250 mm
- `cotton`: 60–110 mm

**Agronomic Reality**:
- Rice requires **1200 to 2000 mm** of water across its 120-day cycle. 150–300 mm is the normal rainfall for a single peak monsoon month (e.g., July in West Bengal), or the depth of 2–3 flood irrigations.
- Sugarcane is a 12-to-18-month crop requiring **1500 to 2500 mm** of water. 150–250 mm covers less than 15% of its annual transpiration demand.
- Wheat requires **350 to 500 mm** of water. Winter rainfall from Western Disturbances in Punjab/Haryana averages 50–100 mm, but the crop requires 4 to 6 canal/tubewell irrigations to survive.

**The Fatal Consequence**:
1. If a farmer enters their actual annual or seasonal rainfall (e.g. 1000 mm in Assam or Kerala), Gaussian decay calculates $\Delta = 1000 - 300 = 700$ mm, driving $S_R \to 0.00$. The engine severely penalizes Rice for receiving normal paddy rainfall!
2. If an arid farmer enters 200 mm total rainfall with zero irrigation capacity, FieldWise awards **maximum 22/22 points** to Rice and Sugarcane, advising resource-poor dryland farmers to plant water-intensive commercial crops.

### 3.4 Conflation of Fertilizer Application Rates with Soil Test Availability
In India, the **Soil Health Card (SHC) Scheme** (Ministry of Agriculture & Farmers Welfare) evaluates soil samples using standardized laboratory extraction methods:
- **Available Nitrogen (N)**: Subbiah & Asija Alkaline Permanganate Method.
  - Low: $< 280$ kg/ha
  - Medium: $280 - 560$ kg/ha
  - High: $> 560$ kg/ha
- **Available Phosphorus ($P_2O_5$)**: Olsen's Method ($0.5\text{ M } \text{NaHCO}_3$).
  - Low: $< 23$ kg/ha
  - Medium: $23 - 56$ kg/ha
  - High: $> 56$ kg/ha
- **Available Potassium ($K_2O$)**: Neutral Normal Ammonium Acetate Method.
  - Low: $< 140$ kg/ha
  - Medium: $140 - 330$ kg/ha
  - High: $> 330$ kg/ha

FieldWise's form prompts the farmer to enter **Soil Nitrogen (N), Phosphorus (P), Potassium (K)**. However, the database parameters (e.g., Rice: N 80–120, P 40–60, K 40–60) represent **Recommended Dose of Fertilizers (RDF)** applied as chemical fertilizers (Urea, DAP, MOP), NOT soil laboratory test ratings!

If a farmer enters a standard fertile soil test result (Medium N = 320 kg/ha, Medium P = 28 kg/ha, Medium K = 210 kg/ha):
- $N = 320$ exceeds FieldWise's upper bound of 120 + tolerance ($120 + 20 = 140$). Score = **0.0 / 8 points**.
- $K = 210$ exceeds FieldWise's upper bound of 60 + tolerance ($60 + 15 = 75$). Score = **0.0 / 6 points**.
- Perfectly fertile agricultural land is penalized to 0 points on primary nutrients because the engine treats fertilizer dosages as soil availability ceilings!

### 3.5 Toxicity Blindness (Soil pH)
FieldWise scores soil pH exclusively as a bonus (+10 if in range, +5 if within 0.5 units, 0 otherwise). 

At pH $> 8.5$ (sodic/alkaline soils) or pH $< 4.5$ (acid sulfate soils):
- Micronutrients (Fe, Zn, Mn, Cu) become chemically precipitated and unavailable.
- Nodulation in legumes (Chickpea, Lentil, Soybean, Groundnut) via *Rhizobium* is completely inhibited.
- Aluminum and sodium toxicities destroy root apical meristems.

Because FieldWise awards 0 bonus points instead of imposing a fatal penalty, a crop facing a lethal pH of 9.2 or 4.0 loses only 10 points out of 110. The remaining 100 points allow the crop to score up to **90.9% confidence**.

---

## 4. Empirical Stress-Testing & Edge-Case Findings

We executed five deterministic stress-test scenarios across both the backend engine (`model/predictor.js`) and the frontend fallback engine (`src/lib/predictorEngine.ts`). The results demonstrate reproducible safety hazards.

```
+----------------------------------------------------------------------------------------------------+
| SCENARIO S1: Arid Desert Drought (Jaisalmer / Barmer Kharif)                                       |
| Inputs: Rainfall: 40mm, Temp: 38°C, Humidity: 25%, Soil: 'Sandy', N: 25, P: 15, K: 120, pH: 8.2    |
| Agronomic Reality: Severe desert drought. Only Pearl Millet (Bajra) or Moth Bean can survive.     |
+----------------------------------------------------------------------------------------------------+
| BACKEND ENGINE PREDICTIONS:                                                                        |
|   1. Lentil               | Confidence: 55.2% | Yield: 1.3 t/ha | Season: Rabi  [FATAL HAZARD]      |
|   2. Jowar (Sorghum)      | Confidence: 53.8% | Yield: 2.6 t/ha | Season: Kharif                    |
|   3. Chickpea             | Confidence: 50.0% | Yield: 1.3 t/ha | Season: Rabi  [FATAL HAZARD]      |
|   4. Cotton               | Confidence: 46.1% | Yield: 1.7 t/ha | Season: Kharif                    |
|   5. Mango                | Confidence: 40.1% | Yield: 9.9 t/ha | Season: Zaid  [FATAL HAZARD]      |
|   6. Tomato               | Confidence: 38.7% | Yield: 16.5 t/ha| Season: Rabi  [FATAL HAZARD]      |
|                                                                                                    |
| FRONTEND FALLBACK ENGINE PREDICTIONS:                                                              |
|   1. Millets (Bajra)      | Confidence: 61.8% | Yield: 2.0 t/ha | Season: Kharif                    |
|   2. Chickpea (Gram)      | Confidence: 46.3% | Yield: 1.5 t/ha | Season: Rabi  [FATAL HAZARD]      |
|   3. Cotton               | Confidence: 46.1% | Yield: 1.9 t/ha | Season: Kharif                    |
|   4. Barley               | Confidence: 45.0% | Yield: 2.6 t/ha | Season: Rabi  [FATAL HAZARD]      |
|   5. Groundnut (Peanut)   | Confidence: 36.6% | Yield: 2.0 t/ha | Season: Kharif                    |
+----------------------------------------------------------------------------------------------------+
```
*Agronomic Hazard Analysis for S1*:
- Backend recommends **Lentil (55.2%)** and **Chickpea (50.0%)**—cool-season winter legumes—for a 38°C desert summer with 40 mm rain!
- Backend recommends **Tomato (38.7%)** and **Mango (40.1%)** in arid sand.
- Frontend recommends **Chickpea (46.3%)** and **Barley (45.0%)**.
- If a marginal farmer in Rajasthan follows this advice, they face 100% crop failure and total financial ruin.

```
+----------------------------------------------------------------------------------------------------+
| SCENARIO S2: Monsoon High-Rainfall Paddy Wetland (Assam / West Bengal Lowlands)                    |
| Inputs: Rainfall: 1200mm, Temp: 29°C, Humidity: 88%, Soil: 'Clay', N: 100, P: 50, K: 50, pH: 6.0   |
| Agronomic Reality: Ideal lowland paddy ecosystem. Wetland rice thrives; upland crops drown.        |
+----------------------------------------------------------------------------------------------------+
| BACKEND ENGINE PREDICTIONS:                                                                        |
|   1. Rice                 | Confidence: 80.0% | Yield: 4.5 t/ha | Season: Kharif                    |
|   2. Mango                | Confidence: 59.9% | Yield: 11.0 t/ha| Season: Zaid  [ROOT ROT]          |
|   3. Cotton               | Confidence: 54.4% | Yield: 1.8 t/ha | Season: Kharif [WATERLOGGING]     |
|   4. Onion                | Confidence: 54.2% | Yield: 19.7 t/ha| Season: Rabi   [BULB ROT]         |
|   5. Jowar (Sorghum)      | Confidence: 53.7% | Yield: 2.6 t/ha | Season: Kharif [SEED ROT]         |
|   6. Wheat                | Confidence: 51.7% | Yield: 3.1 t/ha | Season: Rabi   [FATAL DROWNING]   |
+----------------------------------------------------------------------------------------------------+
```
*Agronomic Hazard Analysis for S2*:
- In a submerged wetland with 1200 mm monsoon rain, the backend recommends **Wheat (51.7% confidence)**, **Onion (54.2%)**, and **Cotton (54.4%)**.
- Wheat rots completely in waterlogged warm mud. Onion bulbs liquefy from bacterial soft rot (*Pectobacterium carotovorum*). Cotton suffers immediate root asphyxiation and damping off.
- Rice received only 80% confidence because its rainfall score decayed to zero ($1200 \gg 300$), relying entirely on soil, temperature, and nutrients for its score!

```
+----------------------------------------------------------------------------------------------------+
| SCENARIO S3: Peak Kharif Summer Sowing (Punjab July Monsoon Heat)                                  |
| Inputs: Rainfall: 180mm, Temp: 35°C, Humidity: 75%, Soil: 'Loamy', N: 120, P: 60, K: 50, pH: 7.0   |
| Agronomic Reality: Prime Kharif conditions for Paddy, Maize, Cotton. Rabi crops strictly unviable.|
+----------------------------------------------------------------------------------------------------+
| BACKEND PREDICTIONS: Rice (99%), Maize (92.1%), Sugarcane (87.9%), Banana (87.9%),                 |
|                      Mango (81.7%), Onion (72.2% [Season: Rabi])                                   |
| FRONTEND PREDICTIONS: Rice (99%), Maize (92.1%), Sugarcane (89.9%), Groundnut (69.4%),              |
|                       Wheat (67.6% [Season: Rabi]), Soybean (64.9%)                                |
+----------------------------------------------------------------------------------------------------+
```
*Agronomic Hazard Analysis for S3*:
- Frontend recommends **Wheat with 67.6% confidence** in July at 35°C!
- Backend recommends **Onion with 72.2% confidence** (tagged internally as Rabi).
- Demonstrates that season metadata is completely bypassed during inference.

```
+----------------------------------------------------------------------------------------------------+
| SCENARIO S4: Severe Soil Alkalinity / Sodic Soil (pH 9.2)                                          |
| Inputs: Rainfall: 90mm, Temp: 28°C, Humidity: 60%, Soil: 'Sandy Loam', N: 80, P: 40, K: 40, pH: 9.2|
| Agronomic Reality: Highly toxic alkaline soil. Severe micronutrient deficiency; pulses fail.       |
+----------------------------------------------------------------------------------------------------+
| BACKEND ENGINE PREDICTIONS:                                                                        |
|   1. Mango                | Confidence: 87.3% | Yield: 12.5 t/ha| (Severe chlorosis at pH 9.2)     |
|   2. Groundnut            | Confidence: 83.6% | Yield: 2.1 t/ha | (Nodulation failure at pH 9.2)   |
|   3. Chickpea             | Confidence: 80.6% | Yield: 1.5 t/ha | (Complete failure at pH 9.2)     |
|   4. Wheat                | Confidence: 78.5% | Yield: 3.5 t/ha | (Severe Zn/Mn deficiency)        |
|   5. Maize                | Confidence: 78.2% | Yield: 4.4 t/ha | (Chlorosis & stunting)           |
|   6. Onion                | Confidence: 77.6% | Yield: 22.0 t/ha| (Bulb failure)                   |
+----------------------------------------------------------------------------------------------------+
```
*Agronomic Hazard Analysis for S4*:
- At pH 9.2, Chickpea and Groundnut cannot form root nodules and suffer fatal iron chlorosis.
- Yet both score **80.6% and 83.6% confidence** because pH loss is capped at 10 bonus points!

```
+----------------------------------------------------------------------------------------------------+
| SCENARIO S5: Real-World Soil Health Card Test (Medium Fertile Plain)                               |
| Inputs: Rainfall: 220mm, Temp: 28°C, Humidity: 75%, Soil: 'Clay Loam', N: 320, P: 28, K: 210, pH:6.8|
| Agronomic Reality: Excellent fertile agricultural soil in irrigated plains.                       |
+----------------------------------------------------------------------------------------------------+
| BACKEND SCORE BREAKDOWN FOR RICE (Confidence: 64.3%):                                              |
|   Rainfall: 22.0 / 22 | Temp: 22.0 / 22 | Humidity: 16.0 / 16 | Soil: 0.0 / 20 (Clay Loam missing)  |
|   Nitrogen: 0.0 / 8   | Phosphorus: 0.7 / 6 | Potassium: 0.0 / 6 | pH Bonus: 10.0 / 10             |
|                                                                                                    |
| BACKEND SCORE BREAKDOWN FOR SUGARCANE (Confidence: 81.8%):                                         |
|   Rainfall: 22.0 / 22 | Temp: 22.0 / 22 | Humidity: 16.0 / 16 | Soil: 20.0 / 20                    |
|   Nitrogen: 0.0 / 8   | Phosphorus: 0.0 / 6 | Potassium: 0.0 / 6 | pH Bonus: 10.0 / 10             |
+----------------------------------------------------------------------------------------------------+
```
*Agronomic Hazard Analysis for S5*:
- Farmer provides high-fertility Soil Health Card readings ($N=320, K=210$).
- FieldWise awards **0.0 points for Nitrogen** and **0.0 points for Potassium** to both Rice and Sugarcane because it expected fertilizer application doses!
- Furthermore, Rice receives **0.0 points for Soil** in the backend because `cropDatabase.js` whitelists only `['Clay', 'Alluvial', 'Loamy']`, omitting `Clay Loam` (which frontend includes).

---

## 5. Architectural Split-Brain: Backend vs. Frontend Fallback

In `src/lib/api.ts`, if the backend server is unreachable or returns a network error, FieldWise transparently executes `predictCropsEngine(data)` in the browser:

```typescript
// src/lib/api.ts (lines 71-79)
} catch (err: any) {
    if (err?.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
    }
    // When backend is not running or unreachable, run the local Gaussian prediction engine
    const localPredictions = predictCropsEngine(data);
    return { data: { success: true, mode: 'offline_ml_engine', predictions: localPredictions } };
}
```

This design introduces a critical **Split-Brain Hazard**:

### 5.1 Asymmetric Crop Whitelists
- **Backend Only (3 crops)**: `banana`, `mango`, `jowar`.
- **Frontend Only (3 crops)**: `sunflower`, `barley`, `millets`.
- **Shared (13 crops)**: `rice`, `wheat`, `maize`, `cotton`, `sugarcane`, `soybean`, `groundnut`, `potato`, `chickpea`, `lentil`, `mustard`, `tomato`, `onion`.

If an online user in Karnataka receives a top recommendation for `banana` and `jowar`, and then their mobile connection drops and they re-submit, **Banana and Jowar disappear from the recommendations entirely**, replaced by `millets` and `sunflower`!

### 5.2 Divergent Yield Expectations
Base yields vary dramatically between the two files:
- **Tomato**: Backend base yield = $20.0\text{ t/ha}$; Frontend base yield = $35.0\text{ t/ha}$ (**+75.0% discrepancy**).
- **Sugarcane**: Backend = $80.0\text{ t/ha}$; Frontend = $70.0\text{ t/ha}$ (**-12.5% discrepancy**).
- **Cotton**: Backend = $2.0\text{ t/ha}$; Frontend = $2.2\text{ t/ha}$ (**+10.0% discrepancy**).
- **Soybean**: Backend = $2.5\text{ t/ha}$; Frontend = $2.0\text{ t/ha}$ (**-20.0% discrepancy**).
- **Groundnut**: Backend = $2.0\text{ t/ha}$; Frontend = $2.5\text{ t/ha}$ (**+25.0% discrepancy**).

A farmer planning financial cash flow will see their projected tomato revenue jump by 75% simply because their WiFi disconnected!

### 5.3 Divergent Fertilizer Prescriptions
In `model/fertilizerDatabase.js` versus `src/lib/predictorEngine.ts`:
- **Tomato**: Backend prescribes Urea 200–250 kg/ha, SSP 125 kg/ha, MOP 100 kg/ha; Frontend prescribes Urea 120–150 kg/ha, SSP 90 kg/ha, MOP 60 kg/ha. (Backend prescribes nearly double the fertilizer dose!).
- **Mustard**: Backend prescribes Boron foliar spray (1.5 kg/ha); Frontend substitutes Gypsum / Elemental Sulphur (20–25 kg/ha).
- **Onion**: Backend splits Urea 50% basal / 25% at 30d / 25% at 45d; Frontend splits Urea 50% basal / 50% at 30d.

---

## 6. Prescriptive Remediation Architecture

To transition FieldWise from an experimental demonstration to a defensible agricultural advisory engine, the following three-tier architectural refactoring must be implemented in future phases:

```
[User Input Query: Season, State, Soil Texture, Water/Irrigation, N, P, K, pH, Weather]
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ TIER 1: HARD AGRONOMIC FEASIBILITY GATING (Boolean Gating: PASS / FAIL)       │
│                                                                               │
│  1. Season Gate:       Crop.seasons.includes(Input.season)                    │
│  2. Water Gate:        Crop.min_water <= (Rainfall + IrrigationCapacity)       │
│  3. Soil Texture Gate: Crop.soil_types.includes(Input.soil_type)              │
│  4. pH Survival Gate:  (Crop.ph_min - 0.5) <= Input.pH <= (Crop.ph_max + 0.5) │
│  5. Thermal Gate:      Input.sowing_temp between Crop.germination_bounds      │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │ (Only PASS candidates proceed)
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ TIER 2: CALIBRATED SUITABILITY SCORING (Liebig-Constrained Geometric Scoring) │
│                                                                               │
│  - Replace additive sum with geometric mean or penalty-multiplied score:      │
│      Score = S_climate × S_soil × S_nutrient × S_ph                           │
│  - Any factor dropping to 0 collapses total suitability to 0.                 │
│  - True Soil Test Calibration: Map raw NPK (kg/ha) against Soil Health Card   │
│    ratings (Low/Medium/High) rather than hardcoded fertilizer application kg. │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ TIER 3: UNIFIED SINGLE SOURCE OF TRUTH (SSOT)                                 │
│                                                                               │
│  - Consolidate all 19 crops into a single shared JSON schema asset.           │
│  - Frontend predictorEngine.ts and backend predictor.js both import the same   │
│    validated taxonomy file. Zero divergent yields or fertilizer recipes.      │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Audit Verdict

| Evaluation Dimension | Safety Status | Final Verdict |
| :--- | :---: | :---: |
| **Backend Rule Engine Safety** | Compromised | **Requires Correction** |
| **Frontend Fallback Safety** | Compromised | **Requires Correction** |
| **Multi-Engine Consistency** | Disjoint | **Requires Correction** |
| **Production Readiness** | Unsafe for Live Farm Advisory | **Rejected** |

*Signed on behalf of FieldWise Audit Architecture*,  
**Phase 3C.3 Agronomic Validation Authority**
