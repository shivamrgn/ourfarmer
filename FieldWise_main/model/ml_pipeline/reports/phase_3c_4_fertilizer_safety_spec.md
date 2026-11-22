# FieldWise — Phase 3C.4: Fertilizer & Soil-Nutrient Safety Specification

**Specification Version**: 1.1.0-CONSOLIDATED-CORRECTIONS (Phase 3C.4.1)  
**Phase**: Phase 3C.4 / Phase 3C.4.1 (Recommendation Engine Safety Redesign Specification)  
**Status**: DESIGN-ONLY SPECIFICATION (Read-Only Application Preservation Enforced)  
**Target Integration**: Future Phase 3C.5 Implementation  

---

## 1. Executive Summary

Phase 3C.3 revealed severe systemic defects in FieldWise's current fertilizer and nutrient architecture:
1. **Semantic Conflation**: The input form prompts for "Soil Nitrogen, Phosphorus, Potassium" but evaluates inputs against Recommended Dose of Fertilizers (RDF), causing high-fertility soils (e.g. Medium Available N = 320 kg/ha) to receive 0 points.
2. **Arbitrary Prescriptions**: Heuristic NPK proximity scores are treated as quantitative fertilizer advice without accounting for soil laboratory extraction methods or regional agronomic guidelines.
3. **Database Divergence**: Backend (`model/fertilizerDatabase.js`) and frontend (`src/lib/predictorEngine.ts`) prescribe conflicting fertilizer dosages, conflicting nutrient carriers, and differing split application timings.
4. **Blanket Multipliers & DAP Double-Counting**: Previous specifications attempted to apply blanket percentage adjustments (+25% / -25%) and failed to deduct Nitrogen supplied by Di-Ammonium Phosphate (DAP) when calculating supplementary Urea, leading to severe Nitrogen over-application.

This document establishes the **Fertilizer & Soil-Nutrient Safety Specification** for FieldWise, updated to incorporate all mandatory Phase 3C.4.1 corrections. It strictly decouples soil laboratory measurements from crop fertilizer requirements, defines rigorous stoichiometric conversions, deducts DAP nitrogen contributions, and mandates that commercial fertilizer bag prescriptions must only be generated when backed by verified regional Soil-Test Crop Response (STCR) equations.

---

## 2. Decoupling the Four Fundamental Agronomic Nutrient Concepts

FieldWise formally defines four distinct, non-interchangeable agronomic concepts that must never be conflated:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Measured Available Soil Nutrients (Soil Health Card Laboratory Test)     │
│    - What the soil currently contains and can release to plant roots.      │
│    - Measured in kg/ha or ppm of available N, Olsen P2O5, and Exch. K2O.   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Crop Nutrient Requirement & Biological Uptake                            │
│    - Total physiological nutrient mass absorbed by the crop per ton of     │
│      economic yield plus stover/straw over its vegetative & grain cycle.    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Recommended Dose of Fertilizers (RDF)                                    │
│    - State Agricultural University / ICAR recommended nutrient application  │
│      package for high yield on average benchmark soils in a specific region.│
│    - Expressed in elemental/oxide kg/ha (N, P2O5, K2O).                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Actual Commercial Fertilizer Product Prescription                        │
│    - Physical bags of commercial fertilizer (Urea, DAP, SSP, MOP) purchased.│
│    - Calculated based on product concentrations, DAP nitrogen credits,      │
│      application stage splits, and calibrated regional STCR target yields. │
└─────────────────────────────────────────────────────────────────────────────┘
```

**MANDATORY GOVERNANCE RULE**: The recommendation engine MUST NEVER prescribe commercial fertilizer quantities based on heuristic crop match scores. All quantitative commercial prescriptions must follow verified regional Soil-Test Crop Response (STCR) target yield equations or state package of practices. Where verified equations are unavailable, the system MUST return advisory-only guidance or state that a reliable fertilizer prescription cannot be generated.

---

## 3. National Soil Health Card (DAC&FW) Standard Rating Limits

When a farmer provides laboratory soil test readings, the engine classifies soil fertility status according to the standard operational rating limits defined by the Ministry of Agriculture & Farmers Welfare, Government of India (2015):

| Parameter | Standard Analytical Method | Low Fertility | Medium Fertility | High Fertility | Units |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Available Nitrogen (N)** | Subbiah & Asija Alkaline Permanganate ($\text{KMnO}_4$) | $< 280$ | $280 - 560$ | $> 560$ | $\text{kg/ha}$ |
| **Available Phosphorus ($P_2O_5$)** | Olsen's Sodium Bicarbonate ($0.5\text{M } \text{NaHCO}_3$) | $< 23$ | $23 - 56$ | $> 56$ | $\text{kg/ha}$ |
| **Available Potassium ($K_2O$)** | Neutral Normal Ammonium Acetate ($\text{NH}_4\text{OAc}$) | $< 140$ | $140 - 330$ | $> 330$ | $\text{kg/ha}$ |
| **Organic Carbon (OC)** | Walkley & Black Chromic Acid Titration | $< 0.50$ | $0.50 - 0.75$ | $> 0.75$ | $\%$ |
| **Available Sulphur (S)** | $0.15\% \text{ CaCl}_2$ Extraction / Turbidimetric | $< 10.0$ | $10.0 - 20.0$ | $> 20.0$ | $\text{ppm (mg/kg)}$ |
| **Available Zinc (Zn)** | DTPA Extraction Method | $< 0.60$ | $0.60 - 1.20$ | $> 1.20$ | $\text{ppm (mg/kg)}$ |
| **Available Boron (B)** | Hot Water Soluble Method | $< 0.50$ | $0.50 - 1.00$ | $> 1.00$ | $\text{ppm (mg/kg)}$ |

---

## 4. Removal of Blanket Multipliers & Regional STCR Protocol

### 4.1 Prohibition of Arbitrary Multipliers
The independent Phase 3C.4 review mandated the complete elimination of arbitrary blanket multipliers:
- ❌ **NO Blanket 125% RDF for Low Fertility**: Soil nutrient dynamics depend on soil clay content, fixation capacity, and buffer power; applying a flat 125% across all soil types is unscientific.
- ❌ **NO Blanket 100% RDF for Medium Fertility**: Medium fertility soils vary in mineralization rates.
- ❌ **NO Blanket 75% RDF for High Fertility**: High fertility soils in vertisols versus sandy tracts release nutrients differently; arbitrary 25% deductions risk nutrient depletion.

### 4.2 Verified Soil-Test Crop Response (STCR) Target Yield Equations
Under the ICAR All India Coordinated Research Project on STCR, customized nutrient fertilizer doses ($FN, FP, FK$) are calculated using calibrated linear equations parameterized for specific crops, soil types, and agro-climatic zones:

$$FN = A_N \cdot T - B_N \cdot SN$$
$$FP_2O_5 = A_P \cdot T - B_P \cdot SP$$
$$FK_2O = A_K \cdot T - B_K \cdot SK$$

where:
- $T$ = Target economic yield (t/ha or q/ha).
- $SN, SP, SK$ = Soil test available nutrient readings from the laboratory (kg/ha).
- $A_N, A_P, A_K$ = Nutrient requirement coefficients per unit of yield.
- $B_N, B_P, B_K$ = Soil nutrient contribution efficiency coefficients.

### 4.3 Fallback Protocol Where Regional STCR Equations Are Unavailable
Where verified, peer-reviewed STCR coefficients are unavailable for a specific crop in a given agro-climatic zone:
1. **Advisory Guidance Only**: The system displays the standard State Agricultural University Package of Practices (POP) baseline recommended dose (RDF) in kg/ha.
2. **Explicit Disclaimer**:
   > ℹ️ **Advisory Only**: Verified Soil-Test Crop Response (STCR) equations are not available for this crop in this district. Commercial bag prescriptions cannot be generated safely without calibrated regional equations. Apply state standard RDF or consult your local Krishi Vigyan Kendra (KVK).
3. **No Fabricated Bags**: The engine MUST NOT generate commercial bag numbers when regional calibration is missing.

---

## 5. Commercial Fertilizer Formulations & Stoichiometric Calculations

Farmers purchase physical commercial fertilizers manufactured to specific nutrient grades. Commercial bag calculations must adhere strictly to chemical stoichiometry and nutrient concentrations.

### 5.1 Commercial Fertilizer Product Concentration Matrix

| Commercial Fertilizer | Chemical Formula / Grade | Nitrogen (N) | Phosphate ($P_2O_5$) | Potash ($K_2O$) | Secondary & Micronutrients |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Urea** | $\text{CO(NH}_2)_2$ (Prilled/Neem-Coated) | **46.0%** | 0.0% | 0.0% | — |
| **Di-Ammonium Phosphate (DAP)** | $(\text{NH}_4)_2\text{HPO}_4$ | **18.0%** | **46.0%** | 0.0% | — |
| **Single Super Phosphate (SSP)** | $\text{Ca(H}_2\text{PO}_4)_2 + \text{CaSO}_4$ | 0.0% | **16.0%** | 0.0% | **11.0% Sulphur, 19.0% Calcium** |
| **Muriate of Potash (MOP)** | $\text{KCl}$ | 0.0% | 0.0% | **60.0%** | Chloride ($48.0\% \text{ Cl}^-$) |
| **Zinc Sulphate (Heptahydrate)** | $\text{ZnSO}_4 \cdot 7\text{H}_2\text{O}$ | 0.0% | 0.0% | 0.0% | **21.0% Zinc, 10.5% Sulphur** |
| **Agricultural Gypsum** | $\text{CaSO}_4 \cdot 2\text{H}_2\text{O}$ | 0.0% | 0.0% | 0.0% | **18.0% Sulphur, 23.0% Calcium** |

### 5.2 Elemental versus Oxide Stoichiometric Conversions
Agronomic laboratory reports and international literature frequently switch between elemental and oxide forms. FieldWise enforces standard stoichiometric conversion factors:

$$\text{Elemental P} = P_2O_5 \times \frac{2 \times 30.97}{141.94} = P_2O_5 \times 0.4364$$
$$P_2O_5 = \text{Elemental P} \times 2.2915$$

$$\text{Elemental K} = K_2O \times \frac{2 \times 39.10}{94.20} = K_2O \times 0.8302$$
$$K_2O = \text{Elemental K} \times 1.2046$$

---

## 6. Mathematical Deduction of DAP Nitrogen Contribution

A major agronomic hazard in amateur fertilizer calculators is prescribing Urea and DAP independently:
- Di-Ammonium Phosphate (DAP) contains **18% Nitrogen** and **46% Phosphate ($P_2O_5$)**.
- When DAP is applied at basal sowing to satisfy the phosphorus requirement, it unavoidably delivers substantial nitrogen.
- If Urea is calculated separately as $\text{Dose}_N / 0.46$ without subtracting the nitrogen supplied by DAP, the crop receives **20 to 35 kg/ha of excess pure Nitrogen**.
- In Rice and Wheat, this excess Nitrogen triggers severe vegetative lodging, leaf blast disease (*Magnaporthe oryzae*), delayed maturity, and ground-water nitrate pollution.

### 6.1 Exact Formulation for DAP and Supplementary Urea
Let the target nutrient doses determined by verified STCR or regional POP be $\text{Dose}_N$, $\text{Dose}_{P_2O_5}$, and $\text{Dose}_{K_2O}$ (all in kg/ha).

1. **Calculate DAP Quantity from Phosphate Target**:
   $$\text{DAP}_{\text{applied}} = \frac{\text{Dose}_{P_2O_5}}{0.46} \quad (\text{kg/ha})$$

2. **Calculate Nitrogen Delivered by DAP**:
   $$N_{\text{from\_DAP}} = \text{DAP}_{\text{applied}} \times 0.18 = \text{Dose}_{P_2O_5} \times \frac{0.18}{0.46} \approx 0.3913 \times \text{Dose}_{P_2O_5} \quad (\text{kg/ha})$$

3. **Calculate Net Supplementary Nitrogen Required from Urea**:
   $$N_{\text{supplementary}} = \max\left(0.0, \, \text{Dose}_N - N_{\text{from\_DAP}}\right) \quad (\text{kg/ha})$$

4. **Calculate Supplementary Urea Quantity**:
   $$\text{Urea}_{\text{required}} = \frac{N_{\text{supplementary}}}{0.46} \quad (\text{kg/ha})$$

5. **Calculate Muriate of Potash (MOP) Quantity**:
   $$\text{MOP}_{\text{required}} = \frac{\text{Dose}_{K_2O}}{0.60} \quad (\text{kg/ha})$$

### 6.2 Worked Numerical Example (Wheat in Punjab / Haryana)
- **Target Doses**: $\text{Dose}_N = 120\text{ kg/ha}$, $\text{Dose}_{P_2O_5} = 60\text{ kg/ha}$, $\text{Dose}_{K_2O} = 40\text{ kg/ha}$.
- **Step 1 (DAP)**: $\text{DAP} = 60 / 0.46 = \mathbf{130.43\text{ kg/ha}}$ ($\approx 2.6\text{ bags of } 50\text{ kg}$).
- **Step 2 ($N$ from DAP)**: $N_{\text{from\_DAP}} = 130.43 \times 0.18 = \mathbf{23.48\text{ kg/ha N}}$.
- **Step 3 (Net Supplementary N)**: $N_{\text{supplementary}} = 120 - 23.48 = \mathbf{96.52\text{ kg/ha N}}$.
- **Step 4 (Supplementary Urea)**: $\text{Urea} = 96.52 / 0.46 = \mathbf{209.83\text{ kg/ha}}$ ($\approx 4.7\text{ bags of } 45\text{ kg}$).
  *(Note: If DAP nitrogen were ignored, naive calculation would prescribe $120 / 0.46 = 260.87\text{ kg/ha}$ Urea, adding an excess of $51.0\text{ kg/ha}$ of physical Urea!).*
- **Step 5 (MOP)**: $\text{MOP} = 40 / 0.60 = \mathbf{66.67\text{ kg/ha}}$ ($\approx 1.3\text{ bags of } 50\text{ kg}$).

---

## 7. Split Application Timing & Physiological Placement

Fertilizer efficiency depends critically on timing. Applying 100% Nitrogen at sowing causes denitrification and leaching losses exceeding 60%. FieldWise prescribes stage-specific application splits:

```
┌──────────────┬────────────────────────────┬─────────────────────────────────────────────────────────┐
│ Crop ID      │ Commercial Products        │ Split Application Timing & Physiological Placement       │
├──────────────┼────────────────────────────┼─────────────────────────────────────────────────────────┤
│ rice         │ Urea: 210 kg/ha            │ Basal: 100% DAP, 100% MOP, 33% Urea prior to puddling.  │
│              │ DAP: 130 kg/ha, MOP: 67    │ 1st Topdress: 33% Urea at active tillering (21-25 DAT). │
│              │ + ZnSO4: 25 kg/ha          │ 2nd Topdress: 34% Urea at panicle initiation (40-45 DAT)│
├──────────────┼────────────────────────────┼─────────────────────────────────────────────────────────┤
│ wheat        │ Urea: 210 kg/ha            │ Basal: 100% DAP, 100% MOP, 33% Urea drilled with seed. │
│              │ DAP: 130 kg/ha, MOP: 67    │ 1st Topdress: 33% Urea at Crown Root Initiation (21 DAS)│
│              │                            │ 2nd Topdress: 34% Urea at 2nd irrigation / jointing.    │
├──────────────┼────────────────────────────┼─────────────────────────────────────────────────────────┤
│ maize        │ Urea: 210 kg/ha            │ Basal: 100% DAP, 100% MOP, 25% Urea drilled at sowing. │
│              │ DAP: 130 kg/ha, MOP: 67    │ 1st Topdress: 50% Urea at knee-high stage (V6).         │
│              │                            │ 2nd Topdress: 25% Urea at tasseling / silking stage.    │
├──────────────┼────────────────────────────┼─────────────────────────────────────────────────────────┤
│ cotton       │ Urea: 180 kg/ha            │ Basal: 100% DAP, 100% MOP, 20% Urea in seed furrow.    │
│              │ DAP: 109 kg/ha, MOP: 83    │ Splits: 40% Urea at square formation; 40% at flowering.│
├──────────────┼────────────────────────────┼─────────────────────────────────────────────────────────┤
│ potato       │ Urea: 260 kg/ha            │ Basal: 100% DAP, 100% MOP, 50% Urea in furrows.        │
│              │ DAP: 174 kg/ha, MOP: 167   │ Topdress: 50% Urea at first earthing-up (25-30 DAS).    │
├──────────────┼────────────────────────────┼─────────────────────────────────────────────────────────┤
│ pulses       │ Starter Urea: 20-30 kg/ha  │ Basal: 100% DAP, 100% MOP drilled below seed with       │
│ (chickpea,   │ DAP: 87 kg/ha, MOP: 33     │ Rhizobium seed inoculation; omit late nitrogen topdress │
│ lentil)      │                            │ to prevent vegetative rankness & nodule suppression.    │
└──────────────┴────────────────────────────┴─────────────────────────────────────────────────────────┘
```

---

## 8. Summary of Safety Mandates for Phase 3C.5 Implementation

1. **Decouple Soil Test from RDF**: Never treat available soil nutrient test results as external fertilizer requirements.
2. **Eliminate Blanket Multipliers**: Disallow $+25\% / -25\%$ blanket multipliers.
3. **Mandatory DAP Nitrogen Credit**: Deduct $18\%$ of applied DAP mass from elemental Nitrogen targets before computing supplementary Urea.
4. **Enforce Stoichiometry**: Convert elemental P and K to oxide equivalents ($P_2O_5, K_2O$) using exact atomic ratios.
5. **No Speculative Prescriptions**: When verified regional STCR equations are absent, output advisory guidance only.
