# FieldWise — Phase 3C.4: Canonical Input Contract Specification

**Specification Version**: 1.5.0-FINAL-WATER-RECONCILIATION (Phase 3C.4.2.2.1)  
**Phase**: Phase 3C.4 / Phase 3C.4.2.2.1 (Effective Rainfall and Rainfed Water Reconciliation)  
**Status**: DESIGN-ONLY SPECIFICATION (Read-Only Application Preservation Enforced)  
**Target Integration**: Future Phase 3C.5 Implementation  

---

## 1. Overview & Objective

Phase 3C.3 proved that FieldWise's existing recommendation input interface suffered from critical semantic ambiguities:
1. Conflating annual rainfall, seasonal rainfall, and monthly rainfall into an uncalibrated scalar.
2. Silently interpreting Recommended Dose of Fertilizers (RDF) as soil test nutrient targets.
3. Completely omitting cultivation season, intended sowing date, and regional planting windows.
4. Conflating qualitative irrigation infrastructure access with guaranteed volumetric water delivery.
5. Assuming all farmers have laboratory soil tests, with zero defined missing-data behavior.
6. Forcing diverse planting systems (Boro rice, Adsali sugarcane, Spring maize) into rigid broad season buckets (Kharif, Rabi, Zaid).

This document establishes the **Canonical Input Contract** for FieldWise, updated to Phase 3C.4.2 to resolve all season/planting window incompatibilities and decouple water availability accounting. It formally specifies every location, climate, temporal, edaphic, and water input required to make an agronomically defensible crop recommendation.

---

## 2. Decoupled Season & Planting-Window Data Model

### 2.1 The Architectural Disconnect in Broad Seasons
Prior iterations categorized cultivation exclusively into three broad seasons: `Kharif`, `Rabi`, and `Zaid` (plus a vague `Annual` bucket). This created direct agronomic contradictions:
- **Boro Rice**: Sown in nursery beds in November–December, transplanted into puddled fields in December–January, and harvested in April–May in West Bengal, Assam, and Bihar. Classifying Boro as `Kharif` fails because Kharif begins in June; classifying it as `Rabi` fails standard rice thermal checks; classifying it as `Zaid` fails because Zaid begins in March.
- **Adsali Sugarcane**: Planted in July–August in Maharashtra and Karnataka and grown for 15–18 months. Classifying it as an annual crop conflates it with 10–12 month `Eksali` or Spring canes.
- **Tomato & Vegetable Crops**: Cultivated across three overlapping overlapping cycles (Autumn-Winter, Spring-Summer, Rainy season) depending on altitude, pest pressures, and frost risks.
- **Perennial Fruit Trees (Mango, Banana)**: Mango is a permanent orchard tree taking 4–7 years to first commercial bearing with phenological cycles (flowering in Feb–Mar, fruiting in May–Jul), while Banana is a 11–13 month giant herbaceous crop planted year-round under assured irrigation.

### 2.2 Formal Six-Field Temporal & Cultivation Data Model
To resolve this without breaking simple interfaces, the temporal contract is factored into six distinct architectural dimensions:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    TEMPORAL & CULTIVATION CONTRACT DIMENSIONS                   │
├─────────────────────────────────────────────────┬───────────────────────────────┤
│ 1. broad_season (Enum)                          │ Kharif, Rabi, Zaid,           │
│                                                 │ Boro_Special, Annual_Special, │
│                                                 │ Perennial_Orchard             │
├─────────────────────────────────────────────────┼───────────────────────────────┤
│ 2. planting_system (String / Enum)              │ Aman, Boro, Aus, Timely_Sown, │
│                                                 │ Late_Sown, Adsali, Eksali,    │
│                                                 │ Spring, Summer, Main_Crop,    │
│                                                 │ Standard_Orchard              │
├─────────────────────────────────────────────────┼───────────────────────────────┤
│ 3. region_or_agro_climatic_zone (Location)      │ State, District,              │
│                                                 │ ICAR Agro-Climatic Zone       │
├─────────────────────────────────────────────────┼───────────────────────────────┤
│ 4. sowing_date_or_month_range (Date/Range)      │ sowing_month (1-12),          │
│                                                 │ sowing_date (YYYY-MM-DD),     │
│                                                 │ window_range (e.g. Nov 1-15)  │
├─────────────────────────────────────────────────┼───────────────────────────────┤
│ 5. crop_life_cycle (Enum)                       │ Annual_Seasonal,              │
│                                                 │ Long_Duration_Annual,         │
│                                                 │ Perennial_Orchard             │
├─────────────────────────────────────────────────┼───────────────────────────────┤
│ 6. window_evidence_status (Enum)                │ VERIFIED, PROVISIONAL,        │
│                                                 │ UNKNOWN                       │
└─────────────────────────────────────────────────┴───────────────────────────────┘
```

### 2.3 Life Cycle Categories
Every candidate crop belongs to exactly one life cycle category:
1. **`Annual_Seasonal`** (e.g. Wheat, Rice, Maize, Mustard, Chickpea, Lentil, Soybean, Cotton, Groundnut, Potato, Barley, Millets, Jowar, Sunflower, Onion, Tomato):
   - Single distinct season cycle (90 to 180 days).
   - Evaluated strictly against sowing-stage temperature, seasonal rainfall/irrigation, and designated regional planting window.
2. **`Long_Duration_Annual`** (e.g. Sugarcane):
   - Spans 10 to 18 months, crossing multiple meteorological seasons.
   - Evaluated against initial establishment conditions and multi-season cumulative water availability.
3. **`Perennial_Orchard`** (e.g. Mango, Banana):
   - Permanent or multi-year cultivation requiring multi-year land commitment.
   - Mango requires distinct evaluation: vegetative planting vs reproductive floral induction.
   - Banana requires 11–13 month frost-free warm humid conditions with high water continuity.

---

## 3. Resolution Matrix: User Input Scenarios

The engine deterministically resolves temporal eligibility depending on what inputs the user supplies:

| User Input Combination | Engine Resolution Logic | Resulting Window Status | Advisory / Uncertainty Behavior |
| :--- | :--- | :---: | :--- |
| **1. Season Only** (e.g. "Rabi") | 1. Maps `broad_season` to default regional planting system for each crop in user's state/zone.<br>2. Adopts midpoint calendar month of that season (e.g. Rabi $\to$ November). | `PROVISIONAL` | Prompts user to confirm specific sowing month. Flags: *"Cultivated window assumed as mid-season normal; specify exact sowing date for precision germination checks."* |
| **2. Sowing Date Only** (e.g. "Nov 10") | 1. Extracts calendar month ($m = 11$).<br>2. Automatically derives `broad_season` from state agricultural calendar (Nov in Punjab $\to$ `Rabi`; Nov in Assam $\to$ `Boro_Special` or `Rabi`).<br>3. Matches date against verified regional windows. | `VERIFIED` | Evaluates precise timely vs late sowing window boundaries. |
| **3. Both Season and Sowing Date** | 1. Cross-validates compatibility between season and date.<br>2. If compatible: executes full regional window matching.<br>3. If conflicting (e.g. "Kharif" with "December 15"): halts with validation error prompting correction. | `VERIFIED` | Highest precision evaluation. |
| **4. Unknown Planting Window** (Crop not established in region) | 1. Crop lacks verified package of practices for the specified zone/district.<br>2. Does not invent speculative window.<br>3. Evaluates generic physiological thermal limits. | `PROVISIONAL` | Marks recommendation badge as `PROVISIONAL`. Displays advisory: *"No locally verified ICAR/SAU planting window for this crop in your district; feasibility evaluated on general thermal bounds."* |
| **5. Region with No Verified Planting Window** (Unsupported State/District) | 1. System falls back to macro-climatic agro-zone default.<br>2. If macro-zone unknown: marks window as `UNKNOWN`.<br>3. Decrements Data Completeness Index ($DCI \le 0.70$). | `UNKNOWN` | Capped at `PROVISIONAL_EVALUATION` confidence tier. |

---

## 4. Worked Crop-Specific Examples

### 4.1 Rice (*Oryza sativa*)
Rice possesses three distinct agro-climatic cultivation systems in India:
- **Aman (Main Kharif)**:
  - *Broad Season*: `Kharif`
  - *Planting System*: `Aman_Lowland`
  - *Supported Regions*: All rice ecologies (Eastern IGP, Peninsular, Western Coastal).
  - *Sowing / Transplanting Window*: Nursery sowing: Jun 15 – Jul 10; Transplanting: Jul 15 – Aug 10.
  - *Evidence*: ICAR-IIRR Tech. Bull. 92/2021.
  - *Thermal & Water Check*: Monsoon dependent ($ET_c \approx 1100\text{–}1350\text{ mm}$); warm humid ($25\text{–}35^\circ\text{C}$).
- **Boro (Winter / Spring Rice)**:
  - *Broad Season*: `Boro_Special` (also matches Rabi winter queries in specific ecologies).
  - *Planting System*: `Boro_Deepwater_Receding`
  - *Supported Regions*: West Bengal, Assam, Bihar, Odisha, Eastern UP.
  - *Sowing / Transplanting Window*: Nursery sowing: Nov 15 – Dec 15; Transplanting: Dec 20 – Jan 20; Harvest: Apr – May.
  - *Evidence*: ICAR-IIRR Tech. Bull. 92/2021; AAU/UBKV Boro Rice Packages. Cold-tolerant varieties (e.g. Gautam, Krishna Hamsa).
  - *Thermal & Water Check*: Requires assured irrigation (canals/shallow tubewells); seedling stage tolerant to low night temperatures ($10\text{–}15^\circ\text{C}$); flowering occurs during rising spring temperatures ($25\text{–}32^\circ\text{C}$).
- **Aus (Autumn / Pre-Monsoon Rice)**:
  - *Broad Season*: `Zaid` / `Pre_Monsoon`
  - *Planting System*: `Aus_Direct_Seeded`
  - *Supported Regions*: Assam, West Bengal, Coastal Odisha.
  - *Sowing Window*: Direct seeding / early transplanting: Mar 15 – Apr 30; Harvest: Jul – Aug.
  - *Evidence*: AAU Package of Practices (2019). Utilizes pre-monsoon Nor'wester showers.

### 4.2 Wheat (*Triticum aestivum*)
Wheat is an obligatory cool-season winter crop sensitive to terminal heat:
- **North-Western Plains Zone (NWPZ: Punjab, Haryana, Western UP, Rajasthan)**:
  - *Timely Sown Window*: Nov 1 – Nov 15 (Optimum tillering and vernalization; 135–145 days duration).
  - *Late Sown Window*: Nov 20 – Dec 15 (Requires late-sown cultivars like PBW-771, DBW-107; duration compressed to 110–120 days; yield potential penalized by 1.5% per day of delay past Nov 20).
  - *Evidence*: ICAR-IIWBR Wheat Production Technologies (2022).
- **Central Zone (CZ: Madhya Pradesh, Chhattisgarh, Gujarat, Southern Rajasthan)**:
  - *Sowing Window*: Oct 25 – Nov 15. Winter is significantly shorter and warmer; later sowing incurs catastrophic terminal heat (>35°C during February–March grain filling).
  - *Evidence*: ICAR-IIWBR Bull. 55 (2022).

### 4.3 Sugarcane (*Saccharum officinarum*)
Sugarcane represents a multi-season, long-duration annual crop ($ET_c = 1200\text{–}2200\text{ mm}$):
- **Adsali Planting System (Tropical Maharashtra, Karnataka)**:
  - *Broad Season*: `Annual_Special` (Adsali Cycle).
  - *Planting Window*: Jul 15 – Aug 31.
  - *Crop Life Cycle*: `Long_Duration_Annual` (15–18 months duration).
  - *Evidence*: Vasantdada Sugar Institute (VSI) Agronomy Manual (2020). Produces 20–30% higher cane tonnage due to extended vegetative growth across two monsoons.
- **Eksali / Autumn Planting (Subtropical UP, Haryana, Bihar)**:
  - *Planting Window*: Oct 1 – Oct 31. Duration: 12–13 months. Sown before winter chill; intercropped with mustard or potato.
  - *Evidence*: ICAR-IISR Tech. Bull. 48/2021.
- **Spring Planting (All India)**:
  - *Planting Window*: Feb 15 – Mar 25. Duration: 10–12 months. Planted after winter harvest.
  - *Evidence*: ICAR-IISR Tech. Bull. 48/2021.

### 4.4 Tomato (*Solanum lycopersicum*)
Tomato is cultivated across multiple specialized seasons:
- *Autumn-Winter Crop*: Sown in nursery Jun–Jul; transplanted Jul–Aug; harvest Nov–Jan. (Major plains crop).
- *Spring-Summer Crop*: Sown in nursery Nov–Dec (protected from frost); transplanted Jan–Feb; harvest Apr–May.
- *Rainy Season Crop (Hills / South India)*: Transplanted May–Jun for off-season supply.
- *Evidence*: ICAR-IIHR Tomato Package of Practices (2020).
- *Thermal Constraint*: Sensitive to night chilling (<10°C reduces pollen viability) and daytime heat (>36°C causes blossom drop).

### 4.5 Banana (*Musa acuminata*)
Banana is a heavy feeder with an 11–14 month crop life cycle:
- *Crop Life Cycle*: `Long_Duration_Annual` / Semi-perennial.
- *Planting Systems*: June–July (Monsoon onset) or September–October (Post-monsoon) under assured drip irrigation.
- *Harvest Cycle*: 10–12 months to shooting; 3 months from shooting to harvest.
- *Evidence*: ICAR-NRCB Banana Production Manual (2021).
- *Thermal Constraint*: Lethal frost/chilling (<8°C causes permanent bunch choke); optimal $25\text{–}32^\circ\text{C}$.

### 4.6 Mango (*Mangifera indica*)
Mango represents an obligatory perennial fruit orchard tree:
- *Crop Life Cycle*: `Perennial_Orchard`.
- *Establishment Phase*: Vegetative graft planting during monsoon (Jul–Aug); requires 4–7 years to reach commercial fruit-bearing capacity.
- *Bearing Phenology*:
  - Vegetative Rest: Oct – Dec (Requires cool, dry weather to induce flower bud differentiation).
  - Floral Induction & Anthesis: Jan – Mar (Requires frost-free, dry conditions; rain causes powdery mildew and blossom drop).
  - Fruit Development & Harvest: Mar – Jul.
- *Evidence*: ICAR-CISH Mango Monograph (2020).
- *Readiness Classification*: `RESTRICTED_ORCHARD_PROVISIONAL`. Cannot be scored on the same seasonal arable ladder as annual wheat or rice.

---

## 5. Comprehensive Input Field Dictionary

| Field Name | Type | Physical Units | Valid Range | Status | Missing-Value Behavior | Current UI Support | UI / API Change Required |
| :--- | :---: | :---: | :---: | :--- | :--- | :---: | :---: |
| `state` | `string (enum)` | ISO-IN State Code | 28 States & 8 UTs | **Required** | Validation Error (Form submission blocked). | Yes | None (Already present). |
| `district` | `string (enum)` | District Name | Valid districts in `state` | **Optional** | Fallback to state-level agro-climatic zone default; warning logged. | No | **Yes (New dropdown required).** |
| `agro_climatic_zone` | `string (enum)` | ICAR / Planning Comm. | 15 National Zones | *Derived* | Automatically derived from `state` and `district`. | No | Backend derivation service. |
| `sowing_month` | `integer` | Calendar Month (1–12) | $1 \le m \le 12$ | **Required** | Validation Error (Must specify intended sowing month). | No | **Yes (New dropdown required).** |
| `sowing_date` | `string (ISO-8601)` | `YYYY-MM-DD` | Valid calendar date | **Optional** | Defaults to 15th of `sowing_month` if omitted. | No | Optional date picker. |
| `cultivation_season` | `string (enum)` | Broad Agro-Season | `Kharif`, `Rabi`, `Zaid`, `Boro_Special`, `Annual_Special`, `Perennial_Orchard` | **Required** | Derived automatically from `sowing_month` and regional calendar if omitted. | No | **Yes (Selector required).** |
| `planting_system` | `string (enum)` | Agronomic System | `Standard`, `Aman`, `Boro`, `Aus`, `Adsali`, `Eksali`, `Timely_Sown`, `Late_Sown`, `Spring`, `Summer` | **Optional** | Resolved automatically to dominant regional system if omitted. | No | Advanced drawer dropdown. |
| `seasonal_rainfall_amount` | `float` | Millimeters (mm) | $0.0 \le R \le 5000.0$ | **Required** | Validation Error if negative or null. | Yes | Renamed to prevent annual conflation. |
| `rainfall_period_type` | `string (enum)` | Temporal Duration | `Crop_Season_Measured`, `Monthly_Average`, `Annual_Normal`, `Unspecified` | **Required** | If not `Crop_Season_Measured`, flags uncertainty; prompts for seasonal data. | No | **Yes (Radio/Dropdown required).** |
| `rainfall_source` | `string (enum)` | Data Provenance | `On_Farm_Rain_Gauge`, `IMD_Station_Gridded`, `Weather_API`, `Farmer_Estimate`, `Unknown` | **Optional** | Defaults to `Farmer_Estimate` with confidence flag. | No | Optional API integration. |
| `irrigation_access` | `string (enum)` | Infrastructure Regime | `None_Rainfed`, `Canal_Gravity`, `Tubewell_Borewell`, `Farm_Pond_Tank`, `Drip_Microirrigation`, `Sprinkler`, `Unknown` | **Required** | Safe Default: `None_Rainfed` with high water scrutiny. | No | **Yes (Mandatory selector).** |
| `irrigation_water_quantity_mm` | `float` | Depth in mm | $0.0 \le I \le 3000.0$ | **Optional** | If omitted, treated as **UNMEASURED** (null). **Zero fixed mm assumed.** | No | **Yes (Numeric input field).** |
| `irrigation_quantity_basis` | `string (enum)` | Volumetric Basis | `Measured_Flow_Meter`, `Estimated_Hours_Pump_Capacity`, `Unknown_Unmeasured` | *Conditional* | Defaults to `Unknown_Unmeasured` when quantity is null. | No | Advanced drawer toggle. |
| `temperature_mean` | `float` | Degrees Celsius (°C) | $-10.0 \le T \le 55.0$ | **Required** | Validation Error if out of bounds or null. | Yes | None (Existing input). |
| `temperature_min_night` | `float` | Degrees Celsius (°C) | $-15.0 \le T_{\min} \le 45.0$ | **Optional** | If omitted, chilling rules flag caution based on seasonal zone normals. | No | Advanced drawer toggle. |
| `temperature_max_day` | `float` | Degrees Celsius (°C) | $0.0 \le T_{\max} \le 55.0$ | **Optional** | If omitted, terminal heat rules flag advisory based on seasonal zone normals. | No | Advanced drawer toggle. |
| `relative_humidity` | `float` | Percentage (%) | $5.0 \le H \le 100.0$ | **Required** | Validation Error if outside $[5, 100]$. | Yes | None (Existing input). |
| `soil_texture` | `string (enum)` | USDA / ICAR Texture | `Clay`, `Clay Loam`, `Loamy`, `Sandy Loam`, `Sandy`, `Black Vertisol`, `Red Sandy`, `Alluvial` | **Required** | Validation Error (Must select compatible soil class). | Yes | Dropdown standardisation. |
| `soil_ph` | `float` | Standard pH scale | $3.0 \le \text{pH} \le 11.0$ | **Required** | Validation Error if $< 3.0$ or $> 11.0$. | Yes | None (Existing input). |
| `has_soil_test` | `boolean` | Flag | `true`, `false` | **Required** | Defaults to `false` if nutrient values are omitted. | No | **Yes (Toggle checkbox).** |
| `soil_nitrogen` | `float` | Defined by `nutrient_basis` | $0.0 \le N \le 1500.0$ | *Conditional* | If `has_soil_test=false`: defaults to neutral rating ($s_{\text{nutrients}} = 70.0$, $DCI$ reduced). | Yes | Decoupled from Crop RDF. |
| `soil_phosphorus` | `float` | Defined by `nutrient_basis` | $0.0 \le P \le 250.0$ | *Conditional* | If `has_soil_test=false`: defaults to neutral rating ($s_{\text{nutrients}} = 70.0$, $DCI$ reduced). | Yes | Decoupled from Crop RDF. |
| `soil_potassium` | `float` | Defined by `nutrient_basis` | $0.0 \le K \le 1000.0$ | *Conditional* | If `has_soil_test=false`: defaults to neutral rating ($s_{\text{nutrients}} = 70.0$, $DCI$ reduced). | Yes | Decoupled from Crop RDF. |
| `nutrient_basis` | `string (enum)` | Analytical Method | `SHC_Available_kg_ha`, `Laboratory_PPM`, `Qualitative_Tier` | *Conditional* | Defaults to `SHC_Available_kg_ha` if numbers entered; otherwise `Qualitative_Tier`. | No | **Yes (Unit selector).** |

---

## 6. Water Availability Contract & Semantics Disambiguation

### 6.1 Removal of Unsupported Fixed Assumptions
The independent review identified critical flaws in previous water models that must never be reintroduced:
- ❌ **NO Flat Partially Irrigated Quantity**: The previous assumption that `Partially_Irrigated_Protective = 120 mm` is completely removed. Canal availability, tubewell yield, and electricity supply vary by hundreds of millimeters across regions.
- ❌ **NO Flat Assured Irrigation Quantity**: The previous assumption that `Assured_Irrigation = 600–1800 mm` is completely removed. Having a borewell does not guarantee water delivered without depth and pump discharge measurements.
- ❌ **NO Fixed Annual-to-Seasonal Fractions**: The previous assumption that seasonal rain is a flat $75\%$ of annual rainfall is completely removed. Rainfall distribution varies drastically from peninsular winter monsoons (Tamil Nadu) to Western Disturbances in the North.
- ❌ **NO Universal Flat Rainfall Exclusions**: Crops like Rice, Wheat, Cotton, Sugarcane, and Banana in irrigated tracts (e.g. Punjab, Haryana, Western UP, Maharashtra) regularly produce record yields in low-rainfall environments because water is supplied via canal or groundwater. Disqualifying them via universal flat rainfall thresholds is agronomic error.
- ❌ **NO Invented Effective Rainfall**: Effective rainfall must not be synthesized via blanket percentage multipliers (e.g. flat $75\%$ or $80\%$). If unmeasured, it remains explicitly unmeasured.

### 6.2 Formal Definitions of the Six Decoupled Water Concepts
To prevent semantic conflation across agronomic literature, hydrologic modelling, and user input interfaces, the redesign defines six decoupled water concepts:

1. **Total Crop Evapotranspiration ($ET_c$) [mm/season]**:
   - Represents the complete physiological, consumptive water requirement of a disease-free, well-fertilized crop growing under non-limiting soil water conditions across its entire growth cycle.
   - Formula: $ET_c = K_c 	imes ET_0$, where $ET_0$ is FAO Penman-Monteith reference evapotranspiration and $K_c$ is the crop coefficient across initial, development, mid-season, and late-season stages.
   - Units: Cumulative millimeters of water depth per cultivation season ($	ext{mm/season}$).
   - **Governing Rule**: $ET_c$ measures consumptive demand, NOT rainfall supply. Under irrigated conditions, seasonal rainfall is frequently a fraction of $ET_c$ (e.g. Punjab wheat $ET_c = 250–350	ext{ mm}$ while winter rain is $40–80	ext{ mm}$). Natural seasonal rainfall must **NEVER** be compared directly against $ET_c$ to disqualify an irrigated crop.

2. **Effective Rainfall ($P_{\text{eff}}$) [mm/season]**:
   - Represents the portion of cumulative precipitation that infiltrates and is stored in the active crop root zone available for transpiration, excluding surface runoff, deep percolation below rooting depth, and direct canopy interception evaporation.
   - Units: Cumulative millimeters per cultivation season ($	ext{mm/season}$).
   - **Governing Rule**: Evaluated strictly through monthly hydrological time-steps using the USDA-SCS method when monthly rainfall data is provided. When only seasonal aggregate rainfall is known without monthly temporal distribution, effective rainfall CANNOT be calculated and is categorized as `UNMEASURED_EFFECTIVE_RAIN`.

3. **Net Irrigation Requirement ($NIR$) [mm/season]**:
   - The depth of water required exclusively at the root zone to satisfy crop evapotranspiration without moisture stress, after crediting effective rainfall and usable antecedent soil moisture.
   - Formula: $NIR = \max\big(0,\; ET_c - P_{\text{eff}} - W_{\text{soil,init}}\big)$, where $W_{\text{soil,init}}$ is usable antecedent root-zone soil water storage at planting.
   - Units: Net millimeters per season ($	ext{mm/season}$).

4. **Gross Irrigation Applied ($GIR$) [mm/season]**:
   - The total depth of water withdrawn from the source (canal turnout, tubewell discharge, farm pond) and applied to the field surface, accounting for application and conveyance losses.
   - Formula: $GIR = \frac{NIR}{\eta_{\text{appl}}}$, where $\eta_{\text{appl}} \in (0, 1.0]$ is the irrigation application efficiency:
     - Surface / Border / Basin flood irrigation: $\eta_{\text{appl}} \approx 0.60 - 0.70$ (alluvial sandy loam/loam).
     - Furrow / Surge irrigation: $\eta_{\text{appl}} \approx 0.70 - 0.75$.
     - Pressurized Sprinkler irrigation: $\eta_{\text{appl}} \approx 0.75 - 0.82$.
     - Pressurized Drip micro-irrigation: $\eta_{\text{appl}} \approx 0.85 - 0.92$.
   - Units: Gross millimeters per season ($	ext{mm/season}$) or cubic meters per hectare ($1\text{ mm} = 10\text{ m}^3/\text{ha}$).

5. **Measured Irrigation Quantity ($I_{\text{meas}}$) & Measurement Period**:
   - Direct volumetric water delivery reported by the user, verified by flow meter, canal rotational allocation (warabandi hours $\times$ discharge), or tubewell operating hours $	imes$ rated discharge ($Q$).
   - Units: Cumulative millimeters ($	ext{mm}$) applied over the defined crop growth period (e.g. "320 mm applied across 4 irrigations between sowing and dough stage").
   - **Temporal Horizon Rule**: The measurement period of irrigation must match the crop growth duration. If irrigation is recorded for only a fraction of the season (e.g. 30 days of a 135-day crop), the engine flags a temporal mismatch and assigns provisional status.

6. **Water Availability or Irrigation Access Without Measured Quantity**:
   - Qualitative presence of irrigation infrastructure (e.g. `Canal_Gravity`, `Tubewell_Borewell`, `Farm_Pond_Tank`, `Drip_Microirrigation`) without measured volumetric depth ($I_{\text{quantity\_mm}} = \text{null}$).
   - **Governing Rule**: Irrigation access indicates the operational capacity to apply water, but does NOT certify volumetric sufficiency. The engine returns an **`UNKNOWN`** water sufficiency outcome and assigns recommendation status **`CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK`**. It **NEVER** assumes 100% water delivery or auto-passes the water gate.

---

### 6.3 Effective Rainfall Calculation Methodology & Temporal Limitations

#### 6.3.1 Exact Formulation of the USDA-SCS Monthly Method
The USDA Soil Conservation Service (SCS) method (FAO Irrigation & Drainage Paper 24; TR-21; FAO CROPWAT) is strictly an **empirical monthly formulation** developed using 50 years of precipitation records across 22 experimental stations for standard agricultural crops with average usable soil water storage depth $D \approx 75\text{ mm}$ (3 inches).

For each month $m \in \{1, 2, \dots, N_{\text{months}}\}$ of the crop growing season with monthly precipitation $P_m$ (mm/month):
$$P_{\text{eff},m} = \begin{cases}
\frac{P_m \cdot (125.0 - 0.2 \cdot P_m)}{125.0} & \text{if } P_m \le 250.0\text{ mm/month} \\[8pt]
125.0 + 0.1 \cdot P_m & \text{if } P_m > 250.0\text{ mm/month}
\end{cases}$$

The total seasonal effective rainfall is the **sum of monthly effective rainfalls**:
$$P_{\text{eff,seasonal}} = \sum_{m=1}^{N_{\text{months}}} P_{\text{eff},m}$$

The seasonal hydrological loss (surface runoff and deep percolation below root zone) is:
$$\text{Loss}_{\text{seasonal}} = P_{\text{seasonal}} - P_{\text{eff,seasonal}} = \sum_{m=1}^{N_{\text{months}}} (P_m - P_{\text{eff},m})$$

#### 6.3.2 Strict Prohibition Against Applying Monthly Equations to Seasonal Aggregates
**CRITICAL MATHEMATICAL MANDATE**: The USDA-SCS equation was empirically calibrated for monthly rainfall depths ($0–350\text{ mm/month}$). Applying this formula directly to an aggregated seasonal precipitation sum (e.g. $1,150\text{ mm}$) is a **severe mathematical error**:
- If applied directly to $P = 1,150.0\text{ mm}$:
  $$P_{\text{eff,invalid}} = 125.0 + 0.1 \times 1150.0 = \mathbf{240.0\text{ mm}}$$
- When correctly calculated by summing the 4 monthly monsoon components ($350, 350, 300, 150\text{ mm}$):
  $$P_{\text{eff,monthly}} = 160.0 + 160.0 + 155.0 + 114.0 = \mathbf{589.0\text{ mm}}$$
- **Discrepancy**: $589.0\text{ mm} - 240.0\text{ mm} = \mathbf{349.0\text{ mm}}$!
Direct seasonal application falsely treats an entire 4-month rainy season as a single catastrophic 30-day flood, throwing away $349\text{ mm}$ of usable rainfall. The engine **strictly prohibits** evaluating USDA-SCS on seasonal totals.

#### 6.3.3 Limitations and Assumptions
1. **Upland Drainage Assumption**: USDA-SCS assumes freely draining upland soils. Any rain exceeding infiltration and profile storage runs off.
2. **Lowland Bunded Paddy Exception**: In bunded rice fields (paddy), perimeter bunds (15–25 cm height) impound standing water, capturing up to $70–80\%$ of monsoonal rainfall. However, without field-specific measurements of spillway height and percolation rates, applying arbitrary flat retention percentages is unverified.
3. **Missing Monthly Distribution Policy**: If a user provides only seasonal rainfall ($P_{\text{seasonal}}$) without monthly distribution, effective rainfall CANNOT be calculated defensibly. The engine marks effective rainfall as `UNKNOWN`, reports total rainfall as gross precipitation, and assigns status **`CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK`** or **`CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE`**.

---

### 6.4 Correct Rainfed Status Semantics

The redesign defines five explicit, unambiguous outcomes for rainfed water evaluation:

| Status Outcome | Condition / Evaluation Trigger | Agronomic Meaning & UI Representation | Gating Action |
| :--- | :--- | :--- | :---: |
| **`SCREENING_THRESHOLD_MET`** | $R_{\text{seasonal}} \ge c.\text{rainfed\_threshold\_mm}$ | Gross seasonal rainfall meets or exceeds regional benchmark. **Not proof of water sufficiency or guaranteed yield.** | **Passes Tier 1 Gate** (Provisional evaluation in Tier 2) |
| **`WATER_DEFICIT_WARNING`** | $R_{\text{seasonal}} < c.\text{rainfed\_threshold\_mm}$ | Gross seasonal rainfall falls below benchmark. Indicates moisture stress risk. | **Passes Tier 1 Gate** (Triggers Tier 2 Liebig soft penalty; **NEVER Tier 1 FAIL**) |
| **`CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE`** | Root water balance evaluated via empirical effective rain (USDA-SCS) or estimated soil storage. | Water balance appears adequate based on empirical models, but lacks field-measured daily hydrologic verification. | **Eligible** with provisional confidence badge |
| **`CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK`** | Irrigation access present but volume unmeasured ($I = \text{null}$), or monthly rain distribution missing. | Infrastructure exists or rain is recorded, but volumetric sufficiency cannot be verified. | **Eligible** with high water risk warning |
| **`UNKNOWN`** | Essential precipitation or water regime inputs omitted from query. | System cannot evaluate hydrological feasibility. | **Gating Incomplete** (Prompt user for water inputs) |

**Key Governance Rules**:
- Rainfed screening thresholds represent economic yield risk boundaries, **NEVER universal hard exclusions or Tier 1 FAIL**.
- Exceeding a screening threshold **MUST NEVER automatically produce `PASS_VERIFIED`**.

---

### 6.5 Residual Soil Moisture & Profile Storage Specification

In dryland farming, especially for post-monsoon Rabi crops (Chickpea, Rabi Sorghum, Safflower, Mustard), crops extract substantial moisture stored in the soil profile from receding monsoon rains.

The redesign formalizes four distinct epistemic categories for soil water storage:

| Epistemic Tier | Data Requirement & Measurement Protocol | System Treatment & Calculation Rule |
| :--- | :--- | :--- |
| **`MEASURED`** | Direct gravimetric soil sampling, time-domain reflectometry (TDR), or calibrated capacitance probe at sowing. | Available water: $W_{\text{soil,init}} = (\theta_v - \theta_{\text{PWP}}) \times Z_r$. Credited 100% in net water balance equation: $NIR = \max(0, ET_c - P_{\text{eff}} - W_{\text{soil,init}})$. |
| **`SOURCE_BACKED_ESTIMATED`** | Verified soil texture class from Soil Health Card and documented regional rooting depth $Z_r$. | Available Water Capacity ($AWC$, mm/m):<br>- Sand: 40–80 mm/m<br>- Sandy Loam: 90–130 mm/m<br>- Loam / Silt Loam: 140–190 mm/m<br>- Clay Loam: 150–200 mm/m<br>- Deep Vertisol (Black Cotton): 180–240 mm/m.<br>Credited with conservative post-monsoon recharge fraction (up to 75% of field capacity). |
| **`PROVISIONAL`** | Regional baseline estimate (e.g. district soil map) without site-specific profile test. | Storage capacity estimated, capped at 50% of maximum $AWC$. Gating status marked `PROVISIONAL_SOIL_MOISTURE`. |
| **`UNKNOWN`** | Soil texture or depth omitted. | **Zero soil moisture credited.** The engine **DOES NOT invent storage values** or assume rainfall is the sole moisture source. Issues advisory prompting soil moisture check. |

---

### 6.6 Worked Water Calculation Examples (Independently Verified)

#### Worked Example A: Rainfed Aman Rice (*Oryza sativa*) in West Bengal
- **Farmer Profile**:
  - Location: Burdwan, West Bengal (Lower Gangetic Plain).
  - Cultivation Season: Kharif (Aman rice system, transplanted).
  - Crop Growth Period: July 1 to October 31 (120 days).
  - Irrigation Infrastructure: `irrigation_access = 'None_Rainfed'` ($I_{\text{quantity\_mm}} = 0$).
  - Measured Monthly Rainfall ($P_m$):
    - July ($m=1$): $350.0\text{ mm}$
    - August ($m=2$): $350.0\text{ mm}$
    - September ($m=3$): $300.0\text{ mm}$
    - October ($m=4$): $150.0\text{ mm}$
    - Total Gross Seasonal Rainfall: $P_{\text{seasonal}} = 350.0 + 350.0 + 300.0 + 150.0 = \mathbf{1150.0\text{ mm}}$.
- **Monthly Effective Rainfall Arithmetic (USDA-SCS Formula)**:
  - July ($P_1 = 350.0 > 250\text{ mm}$): $P_{\text{eff},1} = 125.0 + 0.1 \times 350.0 = \mathbf{160.0\text{ mm}}$ (Runoff loss: $190.0\text{ mm}$).
  - August ($P_2 = 350.0 > 250\text{ mm}$): $P_{\text{eff},2} = 125.0 + 0.1 \times 350.0 = \mathbf{160.0\text{ mm}}$ (Runoff loss: $190.0\text{ mm}$).
  - September ($P_3 = 300.0 > 250\text{ mm}$): $P_{\text{eff},3} = 125.0 + 0.1 \times 300.0 = \mathbf{155.0\text{ mm}}$ (Runoff loss: $145.0\text{ mm}$).
  - October ($P_4 = 150.0 \le 250\text{ mm}$): $P_{\text{eff},4} = \frac{150.0 \times (125.0 - 0.2 \times 150.0)}{125.0} = \frac{150.0 \times 95.0}{125.0} = \mathbf{114.0\text{ mm}}$ (Runoff loss: $36.0\text{ mm}$).
- **Seasonal Effective Rainfall Total**:
  $$P_{\text{eff,seasonal}} = 160.0 + 160.0 + 155.0 + 114.0 = \mathbf{589.0\text{ mm}}$$
  $$\text{Runoff and Deep Percolation Loss} = 1150.0 - 589.0 = \mathbf{561.0\text{ mm}} \quad (48.78\%)$$
- **Water Balance against Aman Rice Physiological Demand**:
  - Consumptive Evapotranspiration: $ET_{c,\min} = 450.0\text{ mm}$, $ET_{c,\text{opt}} = 700.0\text{ mm}$.
  - Net Root Water Available: $W_{\text{net}} = P_{\text{eff,seasonal}} = 589.0\text{ mm}$.
  - Margin over Minimum Survival/Yield Demand: $589.0 - 450.0 = \mathbf{+139.0\text{ mm}}$ (surplus).
  - Margin relative to Optimal Ponded Demand: $589.0 - 700.0 = \mathbf{-111.0\text{ mm}}$ (slight deficit without field bund storage).
- **Gating & Status Semantics**:
  - Rainfed screening threshold: $1150.0\text{ mm} \ge 800.0\text{ mm} \implies$ **`SCREENING_THRESHOLD_MET`**.
  - Final Recommendation Status: **`CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE`** (due to empirical USDA-SCS estimation and unmeasured field bund retention; **NEVER `PASS_VERIFIED`**).
  - Missing Data Fallback Check: If monthly rainfall distribution were unavailable (only seasonal $1,150\text{ mm}$ provided), effective rainfall could not be calculated, resulting in `UNKNOWN` effective rainfall and status `CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK`.

#### Worked Example B: Irrigated Wheat (*Triticum aestivum*) in Ludhiana, Punjab
- **Farmer Profile**:
  - Location: Ludhiana, Punjab (Trans-Gangetic Plain).
  - Sowing Date: November 10 (Rabi timely sown, 135-day duration).
  - Measured Seasonal Rainfall: $P_{\text{measured}} = 65.0\text{ mm}$ (Western Disturbances, Nov–March).
  - Irrigation Infrastructure: `irrigation_access = 'Tubewell_Borewell'`.
  - Measured Gross Irrigation: $GIR = 320.0\text{ mm}$ (4 irrigations $\times$ 80 mm border flood).
  - Application Efficiency: Surface border flood $\eta_{\text{appl}} = 0.70$ (alluvial sandy loam).
- **Evaluation & Independent Arithmetic**:
  - Wheat Evapotranspiration: $ET_{c,\min} = 250.0\text{ mm}$, $ET_{c,\text{opt}} = 320.0\text{ mm}$.
  - Net Irrigation Delivered: $NIR_{\text{delivered}} = GIR \times \eta_{\text{appl}} = 320.0 \times 0.70 = \mathbf{224.0\text{ mm}}$.
  - Effective Rainfall (USDA-SCS for $P \le 250\text{ mm}$):
    $$P_{\text{eff}} = \frac{65.0 \times (125.0 - 0.2 \times 65.0)}{125.0} = \frac{65.0 \times 112.0}{125.0} = \mathbf{58.24\text{ mm}}$$
  - Total Net Water Available at Root Zone:
    $$W_{\text{net}} = NIR_{\text{delivered}} + P_{\text{eff}} = 224.0 + 58.24 = \mathbf{282.24\text{ mm}}$$
  - Deficit against Optimal $ET_c = 320.0\text{ mm}$: $320.0 - 282.24 = \mathbf{37.76\text{ mm}}$ ($88.2\%$ of optimal $ET_c$ satisfied; exceeds $ET_{c,\min} = 250.0\text{ mm}$).
  - Tier 2 Water Score:
    $$s_{\text{water}} = 100 \times \left(\frac{282.24 - 250.0}{320.0 - 250.0}\right)^{0.75} = 100 \times \left(\frac{32.24}{70.0}\right)^{0.75} = \mathbf{55.91\text{ points}}$$
  - Recommendation Status: **`CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE`** (due to empirical $P_{\text{eff}}$ and moderate irrigation deficit).

#### Worked Example C: Crop with Unknown Irrigation Quantity (Mustard in Rajasthan)
- **Farmer Profile**:
  - Location: Bharatpur, Rajasthan.
  - Sowing Date: October 20 (Rabi season).
  - Measured Seasonal Rainfall: $P_{\text{measured}} = 35.0\text{ mm}$.
  - Irrigation Infrastructure: `irrigation_access = 'Tubewell_Borewell'`.
  - Irrigation Quantity: $I_{\text{quantity\_mm}} = \text{null}$ (unmeasured).
- **Evaluation & Independent Arithmetic**:
  - Mustard Rainfed Screening Threshold: $200.0\text{ mm}$.
  - Rainfall Deficit: $35.0\text{ mm} < 200.0\text{ mm} \implies$ **`WATER_DEFICIT_WARNING`** on rainfall alone.
  - Irrigation Access Present: Tubewell indicated, but delivered volumetric depth is unmeasured.
  - Water Sufficiency Outcome: **`UNKNOWN`** (engine never invents default 120 mm or 600 mm).
  - Water Completeness: $c_3 = 0.40$; Provisional Water Score: $s_{\text{water}} = 70.0$.
  - Recommendation Status: **`CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK`**.
  - Advisory Banner: *"Irrigation access indicated, but delivered depth is unmeasured. Verify tubewell yield before sowing."*

#### Worked Example D: Rainfed Post-Monsoon Chickpea on Vertisol in Maharashtra
- **Farmer Profile**:
  - Location: Ahmednagar, Maharashtra (Scarcity Zone).
  - Cultivation Season: Rabi (post-monsoon, October sowing).
  - Measured In-Season Rainfall: $P_{\text{seasonal}} = 45.0\text{ mm}$.
  - Irrigation Infrastructure: `irrigation_access = 'None_Rainfed'`.
  - Soil Type: Deep Vertisol (Black Cotton Soil, clay).
- **Evaluation & Independent Arithmetic**:
  - Chickpea Rainfed Screening Threshold: $250.0\text{ mm}$.
  - Rainfall Deficit: $45.0\text{ mm} < 250.0\text{ mm} \implies$ **`WATER_DEFICIT_WARNING`**.
  - **Governing Rule**: Rainfed screening threshold **DOES NOT cause Tier 1 FAIL or HARD_EXCLUSION**!
  - Residual Soil Moisture Accounting:
    - Deep Vertisol Available Water Capacity: $AWC = 200.0\text{ mm/m}$.
    - Effective Rooting Depth: $Z_r = 1.2\text{ m}$.
    - Profile Water Holding Capacity: $AWC \times Z_r = 200.0 \times 1.2 = \mathbf{240.0\text{ mm}}$.
    - Where measured profile storage exists ($W_{\text{soil,init}} = 160.0\text{ mm}$), total water equals $160.0 + 40.0 = 200.0\text{ mm}$, fully satisfying Chickpea's minimum $ET_c = 200.0\text{ mm}$.
    - Where soil moisture is UNMEASURED, the engine does NOT invent $160\text{ mm}$; it flags status **`CONDITIONALLY_ELIGIBLE_WITH_HIGH_WATER_RISK`** and penalizes $s_{\text{water}}$:
      $$s_{\text{water}} = 10.0 + 40.0 \times \left(\frac{45.0}{250.0}\right) = \mathbf{17.20\text{ points}}$$
    - Non-compensatory Liebig factor $(17.20 / 100)^{0.25} = 0.644$ lowers overall suitability to $\approx 35–38$ (`MARGINAL_SUITABILITY_HIGH_RISK`).

---

## 7. Data Completeness Index ($DCI$) Formal Specification

### 7.1 Decoupled 6-Domain Formulation
The independent review established that DCI must track input measurement completeness across all operational data dimensions, preventing unearned confidence badges while avoiding double-counting:

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

### 7.2 Domain Measurement Scoring Criteria ($c_k$)

1. **Temporal & Planting Window Completeness ($c_1 \in [0, 1]$)**:
   - $c_1 = 1.00$: Exact sowing date (`YYYY-MM-DD`) or calendar week provided and matched to a verified ICAR regional planting window.
   - $c_1 = 0.60$: Only broad cultivation season (`Kharif`, `Rabi`, `Zaid`) provided without exact sowing date; window matched provisionally.
   - $c_1 = 0.00$: Sowing date and season completely omitted.

2. **Climate Specification Completeness ($c_2 \in [0, 1]$)**:
   - $c_2 = 1.00$: Both mean temperature (°C) and relative humidity (%) measured from on-farm sensor, local AWS, or IMD gridded reanalysis.
   - $c_2 = 0.50$: Only temperature is measured; relative humidity is estimated from historical regional normals (or vice versa).
   - $c_2 = 0.00$: Temperature and humidity both omitted.

3. **Water Supply Measurement Completeness ($c_3 \in [0, 1]$)**:
   - *For Rainfed Systems (`irrigation_access = 'None_Rainfed'`)*:
     - $c_3 = 1.00$: Seasonal rainfall measured via local rain gauge or IMD station.
     - $c_3 = 0.50$: Seasonal rainfall estimated from district annual historical normals.
     - $c_3 = 0.00$: Rainfall data missing.
   - *For Irrigated Systems (`irrigation_access != 'None_Rainfed'`)*:
     - $c_3 = 1.00$: Both seasonal rainfall and volumetric irrigation applied ($GIR$ in mm, measured via flow meter or calibrated pump hours $\times$ discharge) are provided.
     - $c_3 = 0.40$: Seasonal rainfall is measured and irrigation access is confirmed (`Tubewell_Borewell`, `Canal_Gravity`), but volumetric irrigation depth is unmeasured ($I_{\text{quantity\_mm}} = \text{null}$).
     - $c_3 = 0.00$: Rainfall and irrigation access both omitted.

4. **Soil Physical / Texture Completeness ($c_4 \in [0, 1]$)**:
   - $c_4 = 1.00$: Soil texture class determined via laboratory mechanical analysis or ICAR-NBSS&LUP verified soil survey.
   - $c_4 = 0.50$: Soil texture class estimated from farmer feel method or district general soil map.
   - $c_4 = 0.00$: Soil texture omitted.

5. **Soil Chemical Reaction / pH Completeness ($c_5 \in [0, 1]$)**:
   - $c_5 = 1.00$: Soil pH measured via laboratory potentiometric 1:2.5 soil:water suspension.
   - $c_5 = 0.00$: Soil pH omitted.

6. **Soil Available Macronutrients Completeness ($c_6 \in [0, 1]$)**:
   - $c_6 = 1.00$: Quantitative available Nitrogen, Phosphorus, Potassium measured from an official Soil Health Card (SHC) within 3 years.
   - $c_6 = 0.50$: Partial nutrient test (e.g. only N and P tested) or qualitative fertility rating (`Low`, `Medium`, `High`) provided.
   - $c_6 = 0.00$: Soil Health Card data completely omitted (engine applies neutral default $s_{\text{nutrients}} = 70.0$).

### 7.3 Prevention of Double-Counting
Missing information affects either the parameter completeness domain or the scoring domain, never both:
- Missing exact planting date penalizes ONLY $c_1$ ($1.00 \to 0.60$), not climate or water.
- Unmeasured irrigation volume penalizes ONLY $c_3$ ($1.00 \to 0.40$), resulting in an `UNKNOWN` water gate outcome without subtracting points from soil or nutrients.
- Missing Soil Health Card penalizes ONLY $c_6$ ($1.00 \to 0.00$) while setting $s_{\text{nutrients}} = 70.0$, ensuring transparent traceability.

### 7.4 Four Reproducible Worked Benchmark Calculations

| Scenario | Description | $c_1$ | $c_2$ | $c_3$ | $c_4$ | $c_5$ | $c_6$ | Recalculated $DCI$ | Confidence Tier Assigned |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Benchmark 1** | **Gold Standard Full Profile**: Lab SHC, metered tubewell irrigation, verified sowing date Nov 10, local AWS weather. | $1.00$ | $1.00$ | $1.00$ | $1.00$ | $1.00$ | $1.00$ | **$1.000$** | `HIGH_CONFIDENCE` |
| **Benchmark 2** | **Commercial Irrigated Wheat, Missing SHC**: Sowing date Nov 15 verified, metered irrigation, lab pH & texture, but no SHC NPK. | $1.00$ | $1.00$ | $1.00$ | $1.00$ | $1.00$ | $0.00$ | **$0.850$** | `HIGH_CONFIDENCE_ESTIMATED_FERTILITY` |
| **Benchmark 3** | **Typical Smallholder Profile**: Broad Kharif season only (no exact date), tubewell present but unmeasured volume, no SHC. | $0.60$ | $1.00$ | $0.40$ | $1.00$ | $1.00$ | $0.00$ | **$0.640$** | `PROVISIONAL_EVALUATION` |
| **Benchmark 4** | **Rainfed Dryland Farmer**: Verified sowing date July 5, local rain gauge, no irrigation needed, regional soil survey texture, no SHC. | $1.00$ | $1.00$ | $1.00$ | $0.50$ | $1.00$ | $0.00$ | **$0.775$** | `MODERATE_ESTIMATED` |

**Arithmetic Verification for Benchmark 3**:
$$\begin{aligned}
DCI &= 0.15(0.60) + 0.20(1.00) + 0.25(0.40) + 0.15(1.00) + 0.10(1.00) + 0.15(0.00) \\
&= 0.090 + 0.200 + 0.100 + 0.150 + 0.100 + 0.000 = \mathbf{0.640}
\end{aligned}$$
*(If pH is also estimated from regional soil atlas, $c_5 = 0.50 \implies DCI = 0.640 - 0.050 = \mathbf{0.590}$)*.

### 7.5 Strict Rejection Boundary
- If $DCI < 0.500$, the engine halts and raises **`INSUFFICIENT_DATA`**. Recommendation generation is refused because more than 50% of the decision weight would rely on unverified assumptions.

---

## 8. JSON API Payload Specification

### 8.1 Request Contract (`POST /api/recommend`)

```json
{
  "location": {
    "state": "PB",
    "district": "Ludhiana",
    "agro_climatic_zone": "Trans-Gangetic Plains"
  },
  "temporal": {
    "sowing_month": 11,
    "sowing_date": "2026-11-10",
    "cultivation_season": "Rabi",
    "planting_system": "Timely_Sown"
  },
  "climate_and_water": {
    "seasonal_rainfall_amount": 45.0,
    "rainfall_period_type": "Crop_Season_Measured",
    "rainfall_source": "IMD_Station_Gridded",
    "irrigation_access": "Tubewell_Borewell",
    "irrigation_water_quantity_mm": 250.0,
    "irrigation_quantity_basis": "Estimated_Hours_Pump_Capacity",
    "temperature_mean": 18.5,
    "temperature_min_night": 9.0,
    "temperature_max_day": 24.5,
    "relative_humidity": 58.0
  },
  "edaphic": {
    "soil_texture": "Loamy",
    "soil_ph": 7.4,
    "has_soil_test": true,
    "nutrient_basis": "SHC_Available_kg_ha",
    "soil_nitrogen": 310.0,
    "soil_phosphorus": 32.0,
    "soil_potassium": 220.0
  }
}
```

### 7.2 Response Contract (`POST /api/recommend`)

```json
{
  "status": "SUCCESS",
  "engine_version": "2.1.0-CLOSURE",
  "execution_timestamp": "2026-11-19T14:45:00Z",
  "query_summary": {
    "location": "Ludhiana, Punjab (Trans-Gangetic Plains)",
    "season": "Rabi",
    "planting_system_evaluated": "Timely_Sown NWPZ (Nov 1-15)",
    "water_regime_evaluated": "Tubewell_Borewell (Estimated 250 mm + Rain 45 mm)",
    "data_completeness_index": 0.95,
    "evidence_confidence_tier": "HIGH_CONFIDENCE"
  },
  "recommendations": [
    {
      "rank": 1,
      "crop_id": "wheat",
      "canonical_name": "Wheat",
      "crop_life_cycle": "Annual_Seasonal",
      "suitability_score": 91.4,
      "recommendation_readiness": "PRODUCTION_READY",
      "tier1_status": "ELIGIBLE",
      "tier2_components": {
        "climate_score": 94.0,
        "water_score": 88.5,
        "soil_score": 100.0,
        "nutrient_score": 92.0,
        "ph_score": 100.0,
        "liebig_penalty_factor": 0.969
      },
      "expected_yield_range_t_ha": [4.2, 5.0],
      "agronomic_advisory": [
        "Optimal timely sowing window Nov 1-15 active in NWPZ.",
        "Ensure crown root initiation (CRI) irrigation at 21 days after sowing."
      ],
      "fertilizer_prescription": {
        "status": "VERIFIED_STCR_GENERATED",
        "rdf_n_p2o5_k2o_kg_ha": [120, 60, 40],
        "adjusted_dose_kg_ha": [120, 60, 40],
        "commercial_products": {
          "dap_kg_ha": 130.4,
          "dap_nitrogen_credit_kg_ha": 23.5,
          "urea_supplementary_kg_ha": 210.0,
          "mop_kg_ha": 66.7
        },
        "stoichiometric_notes": "Urea quantity reflects net nitrogen after deducting 23.5 kg/ha N supplied by DAP."
      }
    }
  ],
  "excluded_candidates": [
    {
      "crop_id": "rice",
      "canonical_name": "Rice (Paddy)",
      "tier1_status": "DISQUALIFIED",
      "failing_rules": [
        {
          "rule_id": "RULE-RICE-SEAS-01",
          "dimension": "planting_system",
          "reason": "Main Aman rice requires warm monsoon Kharif season; winter Rabi conditions in Punjab cause chilling failure."
        }
      ]
    }
  ]
}
```
