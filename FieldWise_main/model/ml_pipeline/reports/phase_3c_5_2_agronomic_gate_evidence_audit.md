# FieldWise — Phase 3C.5.2: Agronomic Gate Evidence & Lethal Limits Audit

**Document ID**: `FW-P3C5.2-AG-AUDIT-01`  
**Phase**: `Phase 3C.5.2 (Evidence Confidence and Agronomic Gate Safety)`  
**Baseline Date**: `2026-11-20`  
**Status**: `APPROVED_SPECIFICATION`  
**Classification**: `Technical Specification & Agronomic Evidence Audit`

---

## 1. Executive Summary & Purpose

Phase 3C.5.1 identified that the recommendation engine contained certain unsupported blanket universal hard exclusions in Tier 1:
1. A blanket disqualification for all crops at soil pH $\ge 9.0$.
2. Blanket hard exclusions based on diurnal temperature extremes ($T_{\min} \le 2^\circ\text{C}$ and $T_{\max} \ge 36^\circ\text{C}$).

Under the foundational Phase 3C.4 specification and agronomic safety principles:
- **Tier 1 (Agronomic Gating)** evaluates **absolute biological emergence viability** — whether the plant can physically germinate, emerge, and survive the initial vegetative establishment phase under the prevailing baseline environment.
- **Tier 2 (Suitability Scoring)** evaluates **commercial and economic performance** using non-compensatory Liebig minimum formulations and calibrated penalties.
- A **HARD_EXCLUSION** in Tier 1 requires rigorous, peer-reviewed or ICAR/CSSRI source-backed evidence that 100% biological crop death occurs.
- Where evidence indicates yield depression, heat stress, growth delay, or chilling injury rather than total biological mortality, the engine must emit **`WARNING_ONLY`** and apply a suitability discount in Tier 2, **NOT** invent a Tier 1 hard exclusion.

This audit details the full elimination of blanket universal gates and formalizes the crop-specific lethal limits derived directly from `phase_3c_4_eligibility_rules.csv` and `phase_3c_4_2_hard_exclusion_evidence_audit.csv`.

---

## 2. Diurnal Temperature Extremes & Thermal Gate Architecture

### 2.1 The Biological Viability Principle
Diurnal temperature extremes (daily maximum $T_{\max}$ and nightly minimum $T_{\min}$) represent transient microclimatic fluctuations. While severe diurnal fluctuations depress crop growth, photosynthetic efficiency, and reproductive grain filling, they do not automatically prevent seed germination and seedling emergence when the **mean temperature ($T_{\text{mean}}$)** is within the crop's physiological survival envelope $[T_{\min,\text{sow}}, T_{\max,\text{sow}}]$.

### 2.2 Cold Extremes ($T_{\min}$) Rules
1. **Freezing Frost ($T_{\min} < 0.0^\circ\text{C}$)**:
   - Frost-intolerant tropical perennials (**Banana**, **Mango**) suffer lethal cellular collapse, pseudostem necrosis, and graft mortality at sub-zero temperatures ($< 0.0^\circ\text{C}$). This constitutes a verified **Tier 1 Hard Exclusion** (`FAIL` on `G_thermal` with rule `RULE-CROP-FROST-01`).
   - For all other crops, sub-freezing temperatures trigger a high-priority vegetative frost warning (`WARNING_ONLY`).
2. **Chilling Temperatures ($0.0^\circ\text{C} \le T_{\min} < 2.0^\circ\text{C}$)**:
   - For tropical crops (**Banana**, **Mango**, **Sugarcane**, **Cotton**, **Rice**), night temperatures $< 2.0^\circ\text{C}$ induce severe physiological chilling injury, metabolic deceleration, and temporary growth arrest.
   - However, since viable seed or rhizomes do not experience 100% cellular death at $1.5^\circ\text{C}$, this is treated as a **`WARNING_ONLY`** (`Severe chilling warning`) and penalized in Tier 2, **NOT** a Tier 1 hard exclusion.
3. **Mild Chilling ($2.0^\circ\text{C} \le T_{\min} < 5.0^\circ\text{C}$)**:
   - Emits an emergence delay advisory warning (`WARNING_ONLY`).

### 2.3 Heat Extremes ($T_{\max}$) Rules
1. **Cool-Season Rabi Crops (Wheat, Barley, Chickpea, Lentil, Mustard, Potato)**:
   - At $T_{\max} > 36.0^\circ\text{C}$, cool-season crops suffer acute heat stress and reproductive desiccation.
   - However, during the sowing/emergence window, if daily mean temperature is within viable boundaries (e.g., $T_{\text{mean}} = 20^\circ\text{C}$), daytime spikes to $37.0^\circ\text{C}$ do not cause 100% germination failure, especially under irrigated conditions where soil evaporative cooling moderates seedbed temperatures.
   - Therefore, $T_{\max} > 36.0^\circ\text{C}$ generates a high-severity heat stress warning (`WARNING_ONLY`) and triggers non-compensatory Tier 2 penalties, but does **NOT** disqualify the crop in Tier 1.
2. **Canopy Scorching ($T_{\max} > 42.0^\circ\text{C}$)**:
   - Emits a canopy scorch and reproductive abortion warning (`WARNING_ONLY`).
3. **Mean Temperature Violations ($T_{\text{mean}} < T_{\min,\text{sow}}$ or $T_{\text{mean}} > T_{\max,\text{sow}}$)**:
   - Strictly enforced as Tier 1 Hard Exclusions (`FAIL` on `G_thermal` with rule `RULE-CROP-TEMP-01`).

---

## 3. Soil pH Lethal Limits & Sodicity Gating

### 3.1 Removal of Blanket pH $\ge 9.0$ Gate
In Phase 3C.5, a blanket check `elif soil_ph >= 9.0: FAIL` was executed before evaluating crop-specific rules. This violated agronomic reality and published ICAR-CSSRI (Central Soil Salinity Research Institute) benchmarks:
- **Barley (*Hordeum vulgare*)** is recognized by CSSRI as one of the most sodicity-tolerant cereal crops in India, capable of survival and grain production in alkali soils up to pH $9.0$ (with ESP up to $30\text{--}35\%$).
- **Cotton (*Gossypium hirsutum*)** exhibits high alkali tolerance up to pH $9.0$ in deep alluvial/black soils.
- Conversely, crops such as **Tea** (lethal at pH $> 6.0$), **Coffee** (lethal at pH $> 6.8$), and **Jute** (lethal at pH $> 7.5$) succumb to mortality at much lower pH thresholds.

### 3.2 Crop-Specific Lethal Limits
All Tier 1 pH evaluations are now governed strictly by each crop's specific lethal survival limits documented in `phase_3c_4_eligibility_rules.csv`:

| Crop ID | Canonical Crop Name | Optimal pH Range | Absolute Lethal pH Minimum | Absolute Lethal pH Maximum | Agronomic Source / Authority |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `rice` | Rice | 5.5 – 7.0 | 4.2 | 8.8 | ICAR Rice Knowledge Management Portal; CSSRI |
| `wheat` | Wheat | 6.0 – 7.5 | 5.0 | 8.6 | ICAR-IIWBR Karnal; CSSRI Alkali Guidelines |
| `barley` | Barley | 6.5 – 8.0 | 5.5 | 9.0 | ICAR-CSSRI Karnal Bulletin No. 7; ICAR-IIWBR |
| `maize` | Maize | 5.8 – 7.2 | 4.8 | 8.2 | ICAR-IIMR Ludhiana; FAO Crop Water & Soil |
| `millets` | Pearl Millet / Sorghum | 6.0 – 8.0 | 5.0 | 8.8 | ICAR-IIMR Hyderabad; ICRISAT Dryland Series |
| `chickpea` | Chickpea | 6.0 – 7.5 | 5.5 | 8.5 | ICAR-IIPR Kanpur; CSSRI Legume Research |
| `pigeonpea`| Pigeonpea (Arhar) | 5.5 – 7.5 | 5.0 | 8.5 | ICAR-IIPR Kanpur; ICRISAT Bulletins |
| `mungbean` | Mungbean (Green Gram)| 6.2 – 7.2 | 5.3 | 8.5 | ICAR-IIPR Kanpur Pulse Production Manual |
| `blackgram`| Blackgram (Urad) | 6.0 – 7.5 | 5.3 | 8.5 | ICAR-IIPR Kanpur Pulse Production Manual |
| `lentil` | Lentil (Masoor) | 6.0 – 7.5 | 5.5 | 8.2 | ICAR-IIPR Kanpur; FAO Legume Production |
| `groundnut`| Groundnut | 6.0 – 7.0 | 5.0 | 8.2 | ICAR-DGR Junagadh; TNAU Agronomy Guide |
| `mustard` | Rapeseed & Mustard | 6.0 – 7.5 | 5.2 | 8.5 | ICAR-DRMR Bharatpur Mustard Handbook |
| `soybean` | Soybean | 6.0 – 7.5 | 5.0 | 8.5 | ICAR-IISR Indore Soybean Production Series |
| `cotton` | Cotton | 6.0 – 8.0 | 5.5 | 9.0 | ICAR-CICR Nagpur; Central Salinity Research |
| `jute` | Jute | 6.0 – 7.2 | 4.8 | 7.5 | ICAR-CRIJAF Barrackpore Jute Compendium |
| `sugarcane`| Sugarcane | 6.0 – 7.5 | 4.5 | 8.8 | ICAR-IISR Lucknow; TNAU Agritech Portal |
| `potato` | Potato | 5.0 – 6.5 | 4.5 | 7.8 | ICAR-CPRI Shimla Potato Handbook |
| `banana` | Banana | 6.0 – 7.5 | 4.5 | 8.5 | ICAR-NRCB Tiruchirappalli Banana Guidelines |
| `mango` | Mango | 5.5 – 7.5 | 4.5 | 8.5 | ICAR-CISH Lucknow Mango Cultivation Guide |

### 3.3 Severe Alkalinity & Sodicity Reclamation Advisory
- **At pH 8.9**: Barley (limit 9.0) and Cotton (limit 9.0) PASS Tier 1, whereas Wheat (limit 8.6) and Pulses (limits 8.2–8.5) strictly FAIL Tier 1.
- **At pH $\ge 9.0$**: A high-priority sodicity alert is generated recommending exchangeable sodium remediation.
- **At pH $\ge 9.2$**: Because the highest physiological limit across all 19 canonical crops is 9.0, **100% of crops fail Tier 1**. The engine returns `NO_RECOMMENDATION_SUITABLE` and automatically attaches an evidence-backed Land Reclamation Advisory recommending agricultural gypsum ($CaSO_4 \cdot 2H_2O$) at 50% gypsum requirement (GR) followed by leaching and organic matter incorporation.

---

## 4. Verification & Audit Trail

1. **Deterministic Execution**:
   - Evaluated across all 19 canonical crops under both acid ($pH < 4.5$) and alkali ($pH > 8.0$) scenarios.
   - Tested under contrasting diurnal regimes ($T_{\min} = 1.5^\circ\text{C}$, $T_{\max} = 37.0^\circ\text{C}$, $T_{\min} = -1.5^\circ\text{C}$).
2. **Acceptance Test Matrix Alignment**:
   - `TEST-04-S4`: Proves universal failure at pH 9.2 with Gypsum advisory.
   - `TEST-11`: Confirms bitwise verification of `phase_3c_4_2_hard_exclusion_evidence_audit.csv` and `phase_3c_4_eligibility_rules.csv`.
   - `TestPhase3C52Regressions`: Confirms Barley passes while Wheat fails at pH 8.9, and proves Wheat/Banana pass with warnings under diurnal extremes.
