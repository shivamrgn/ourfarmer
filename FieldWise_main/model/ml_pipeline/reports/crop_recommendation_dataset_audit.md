# FieldWise Crop Recommendation Dataset Audit & Preparation Report

## 1. Provenance & Dataset Classification

| Category | Description | Datasets Identified | Status / Limitations |
| :--- | :--- | :--- | :--- |
| **Category A: Measured Observations** | Real-world multi-sensor or agricultural research station trial measurements ($N, P, K, pH, T, H, R, \text{Soil}$) | Soil Health Card grid data, AICRP (All India Coordinated Research Projects) trial reports | Scattered across departmental portals; no unified public CSV containing simultaneous 9-feature records per farmer. |
| **Category B: Published Agronomic Ranges** | Expert-established physiological requirements from ICAR, SAUs, FAO EcoCrop | ICAR Agronomy Handbook, TNAU Agritech Portal, FieldWise `cropDatabase.js` | Established and consolidated into `canonical_crop_taxonomy.json` across all 19 canonical crops. |
| **Category C: Augmented Benchmark Dataset** | Augmented agricultural data compiled and engineered from Indian soil, fertilizer, and climatic research | `kaggle_crop_recommendation_benchmark.csv` (2,200 rows, Atharva Ingle, Apache 2.0 license: https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset) | 22 classes, exactly 100 rows/crop. Lacks Soil Type and State. Covers only 7 FieldWise staples. |

## 2. Crop Taxonomy Harmonization & Classification Tracks

- **Total Canonical FieldWise Crops**: **19 crops**
- **Overlap with 2,200 Benchmark**: **7 crops** (banana, chickpea, cotton, lentil, maize, mango, rice)
- **FieldWise Crops Missing from Benchmark (12 crops)**:
  - barley, groundnut, jowar, millets, mustard, onion, potato, soybean, sugarcane, sunflower, tomato, wheat
  *(These 12 missing crops include India's biggest staples: Wheat, Sugarcane, Potato, Mustard, Onion, Tomato, Soybean, Jowar, Barley, Bajra/Millets, Sunflower, Groundnut)*
- **Benchmark Crops Not in FieldWise (15 crops)**:
  - apple, blackgram, coconut, coffee, grapes, jute, kidneybeans, mothbeans, mungbean, muskmelon, orange, papaya, pigeonpeas, pomegranate, watermelon
  *(Specialized fruits and plantation crops outside core FieldWise catalog)*

### Architectural Separation:
1. **7-Class Benchmark ML Classifier Track**:
   - Covers strictly the 7 overlapping crops (`banana, chickpea, cotton, lentil, maize, mango, rice`).
   - Trained on the 2,200-row benchmark dataset (Atharva Ingle, Apache 2.0) with stratified train/validation/test splits.
   - Evaluates machine learning algorithms (Random Forest, Gradient Boosting, Multi-layer Perceptrons) and establishes baseline classification mechanics.
   - **Crucial**: Benchmark cross-validation accuracy (~99%) is evaluated purely within this augmented benchmark domain and is NOT claimed as empirical real-world farm accuracy.
2. **19-Crop Agronomic Recommendation Engine Track**:
   - Covers all 19 FieldWise canonical crops.
   - Operates on validated physiological envelopes and multi-criteria scoring functions derived from ICAR and TNAU agronomic packages of practices (`canonical_crop_taxonomy.json`).
   - Incorporates **Soil Type** and **State / Agro-Ecological Region** as hard agronomic filtering rules.
   - No synthetic observations are fabricated for the 12 missing crops to create a pseudo-ML 19-class model.

### Additional Real Agricultural Datasets Required for 12 Missing Crops:
- **ICAR AICRP (All India Coordinated Research Projects)**: Multi-location agronomic trials for Wheat, Mustard, Soybean, Sugarcane, Potato, Tomato, Onion.
- **ICRISAT Semi-Arid Tropics Open Data Repository**: Sorghum (Jowar), Pearl Millet (Bajra), Groundnut, Chickpea, Pigeonpea trial records.
- **Soil Health Card (SHC) Portal Data**: Farm-level geo-tagged soil test records ($N, P, K, pH$, micronutrients) with farmer-reported harvested crop.
- **DAC&FW Cost of Cultivation Studies (CACP)**: Comprehensive plot-level input-output survey datasets across representative Indian districts.

## 3. Feature Availability for the 9 Frontend Inputs

| Frontend Input | Category A (Real Measured) | Category B (Agronomic Bounds) | Category C (Benchmark CSV) | Action in Pipeline |
| :--- | :--- | :--- | :--- | :--- |
| 1. Nitrogen (N) | Available in Soil Health Cards | [15, 250] kg/ha defined | 0 – 140 kg/ha present | Included |
| 2. Phosphorus (P) | Available in Soil Health Cards | [30, 100] kg/ha defined | 5 – 145 kg/ha present | Included |
| 3. Potassium (K) | Available in Soil Health Cards | [15, 250] kg/ha defined | 5 – 205 kg/ha present | Included |
| 4. Temperature | Available in IMD / OpenWeather | [10, 38] °C defined | 8.8 – 43.7 °C present | Included |
| 5. Relative Humidity | Available in IMD / OpenWeather | [30, 95] % defined | 14.3 – 99.9 % present | Included |
| 6. Soil pH | Available in Soil Health Cards | [5.0, 8.0] defined | 3.5 – 9.9 present | Included |
| 7. Rainfall | Available in IMD / NASA POWER | [30, 300] mm defined | 20.2 – 298.6 mm present | Included |
| 8. Soil Type | Available in NBSS&LUP maps | Categorical lists defined | ❌ **MISSING** | Regional agro-filter rule |
| 9. State / Region | Administrative boundary | Major states mapped | ❌ **MISSING** | Regional suitability constraint |

## 4. Scientific Conclusion & Protocol
The 2,200 benchmark dataset is **Category C (Augmented Agricultural Benchmark)** released under the **Apache 2.0 license** by Atharva Ingle. It only covers **7 of the 19 FieldWise crops** and omits **Soil Type and State**. 

FieldWise strictly avoids fabricating false observations for the 12 unsupported staple crops. Instead, FieldWise maintains a rigorous two-tier architecture:
1. An experimental ML classifier for the 7 benchmark overlapping crops to validate ML methodologies, feature importance, and probability calibration.
2. A comprehensive 19-crop agronomic recommendation engine powered by ICAR physiological bounds, NBSS&LUP soil compatibility, and state agro-climatic zones, until official multi-source research station trial datasets (ICAR AICRP / ICRISAT / SHC) are acquired and integrated.
