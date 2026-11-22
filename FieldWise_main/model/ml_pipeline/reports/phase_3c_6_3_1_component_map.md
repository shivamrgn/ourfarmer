# FieldWise — Phase 3C.6.3.1: V2 Input Defaults, Provenance Closure & Component Map

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_3_1_component_map.md`  
**Phase**: 3C.6.3.1 V2 Input Default and Provenance Closure  
**Execution Timestamp**: November 2026  
**Status**: APPROVED RECONCILED IMPLEMENTATION  

---

## 1. Executive Summary

Phase 3C.6.3.1 eliminates fabricated agronomic and environmental measurement defaults from `PredictionFormV2.tsx`. In the previous iteration (Phase 3C.6.3), default values such as Punjab, 25°C temperature, 65% humidity, Loam soil texture, pH 6.8, N 80, P 40, K 40, OC 0.65%, and `SHC_Available_kg_ha` reporting basis were present when no user profile was provided or when fields were omitted.

Because the V2 recommendation engine relies on strict data provenance to produce calibrated agronomic suitability scores, water balance diagnostics, and STCR fertilizer recommendations, supplying fabricated numbers as defaults corrupts the decision boundary.

Under Phase 3C.6.3.1:
1. **All fabricated defaults are eliminated**. Unsupplied measurement fields initialize strictly to `null` (or `''` for string dropdowns).
2. **Explicit farm-profile prefill is preserved**: Only explicitly declared profile attributes populate the form; unsupplied profile fields remain unselected / `null`.
3. **Zero (`0`, `0.0`) is strictly preserved**: Legitimate zero measurements are distinguished from `null` or missing entries using type-safe numeric guards (`isNumeric`).
4. **Mandatory validation gates**: The submit button remains disabled until mandatory parameters (`state` and `sowing_month`) are explicitly chosen.
5. **No implicit nutrient basis**: The presence of NPK numbers never implies an SHC reporting basis or certified soil test.
6. **Form Reset integrity**: `handleReset()` clears all inputs to `null` / unselected, never reviving fabricated defaults.
7. **Clean payload construction**: Unsupplied values are sent as `null` or omitted in strict conformance with the V2 JSON API contract.

---

## 2. Agronomic Parameter Semantics & Initialization Matrix

| Parameter | Type | Default State (No Profile) | Farm Profile Prefill Rule | Validation & Agronomic Invariant | Submission Mapping |
| :--- | :---: | :---: | :---: | :--- | :---: |
| **State / Region** | `string` | `''` (Unselected) | Explicit `profile.location` or `''` | **Mandatory**. Submit disabled while unselected. | Trimmed string |
| **Planned Sowing Month** | `number` | `null` (Unselected) | Always `null` (Never auto-set) | **Mandatory** (`1`–`12`). Submit disabled while unselected. Never defaults to current calendar month. | Integer `1`–`12` |
| **District / Zone** | `string` | `null` | Explicit `profile.district` or `null` | Optional regional modifier. | Trimmed string or `null` |
| **Cultivation Season** | `string` | `null` (Auto-derive) | Optional user override or `null` | When `null`, engine derives season from sowing month. | Valid season string or `null` |
| **Irrigation Access** | `string` | `null` (UNKNOWN) | Mapped only if explicit (`Rainfed` → `None_Rainfed`, `Drip`, `Sprinkler`, `Canal`, `Tubewell_Borewell`) | **Default UNKNOWN (`null`)**. Missing irrigation must never default to rainfed or irrigated. | Supported enum string or `null` |
| **Irrigation Depth** | `number` | `null` | Optional numeric or `null` | Positive finite number (`> 0`). | Number (`mm`) or `null` |
| **Irrigation Period** | `number` | `null` | Optional integer or `null` | **Whole days (`> 0`)**. Non-integers rejected. | Integer (`days`) or `null` |
| **Seasonal Rainfall** | `number` | `null` | Explicit measurement or `null` | **Lifecycle moisture**. Strictly separated from annual rainfall. | Non-negative number (`mm`) or `null` |
| **Annual Rainfall** | `number` | `null` | Explicit measurement or `null` | **Macro-climatic annual**. Never conflated with seasonal rainfall. | Non-negative number (`mm`) or `null` |
| **Soil Test Available** | `boolean` | `false` (Unchecked) | Always `false` (Never inferred) | **Farmer-Declared SHC**. Conveys `USER_DECLARED` provenance only; does not infer lab certification. | Boolean `true`/`false` |
| **Soil Texture** | `string` | `''` (Unselected) | Explicit `profile.soilType` or `''` | No fabricated default (was "Loam"). | Trimmed string or `null` |
| **Soil Reaction (pH)** | `number` | `null` | Explicit `profile.ph` or `null` | Safe range `2.0`–`12.0`. Zero is preserved if entered. | Number or `null` |
| **Available N** | `number` | `null` | Explicit `profile.nitrogen` or `null` | Non-negative number (`kg/ha`). Zero preserved. | Number (`kg/ha`) or `null` |
| **Available P** | `number` | `null` | Explicit `profile.phosphorus` or `null` | Non-negative number (`kg/ha`). Zero preserved. | Number (`kg/ha`) or `null` |
| **Available K** | `number` | `null` | Explicit `profile.potassium` or `null` | Non-negative number (`kg/ha`). Zero preserved. | Number (`kg/ha`) or `null` |
| **Organic Carbon** | `number` | `null` | Explicit `profile.organicCarbon` or `null` | Safe range `0.0`–`10.0%`. Zero preserved. | Number (`%`) or `null` |
| **Nutrient Basis** | `string` | `''` (Unselected) | Always `''` (Never inferred from NPK) | Must not be defaulted to `SHC_Available_kg_ha`. Omitted when unselected. | Valid basis string or `null` |
| **Min Temp (Night)** | `number` | `null` | Explicit or `null` | Thermal physiological constraint. | Number (°C) or `null` |
| **Max Temp (Day)** | `number` | `null` | Explicit or `null` | Thermal physiological constraint. | Number (°C) or `null` |
| **Mean Temperature** | `number` | `null` | Explicit `profile.temperature` or `null` | Safe range `-10` to `60°C`. Zero preserved. | Number (°C) or `null` |
| **Relative Humidity** | `number` | `null` | Explicit `profile.humidity` or `null` | Safe range `0` to `100%`. Zero preserved. | Number (`%`) or `null` |

---

## 3. Explicit Farm-Profile Prefill Architecture

### 3.1 Type-Safe Numeric Guard (`isNumeric`)
In JavaScript/TypeScript, standard truthiness checks (`val || fallback`) discard legitimate numeric zeros (e.g. `0 || 25` yields `25`), corrupting zero measurements (such as 0°C temperature, 0 kg/ha residual nitrogen, or 0 mm rainfall).

`PredictionFormV2.tsx` implements strict numeric guarding:
```typescript
const isNumeric = (val: unknown): val is number => {
  return typeof val === 'number' && !isNaN(val) && isFinite(val);
};
```

### 3.2 Controlled Prefill Logic
When user profile data (`profile`) is provided via props:
1. **State**: Pre-filled only if `profile.location` matches a valid state string; otherwise initialized to `''`.
2. **Sowing Month**: Never pre-filled from profile or system clock (`sowing_month: null`).
3. **Soil Texture**: Pre-filled only if `profile.soilType` matches a known texture; otherwise initialized to `''`.
4. **Soil Reaction (pH)**: Pre-filled with `profile.ph` if `isNumeric(profile.ph)`; otherwise `null`.
5. **Edaphic Nutrients (N, P, K, OC)**: Pre-filled with `profile[key]` if `isNumeric(profile[key])`; otherwise `null`.
6. **Soil Test Availability**: Always initialized to `false`. Profile history never implies a certified soil test.
7. **Nutrient Reporting Basis**: Always initialized to `''`. The presence of numeric NPK values never implies an SHC or laboratory basis.
8. **Irrigation Access**: Pre-filled only if `profile.irrigation` matches a recognized irrigation category (`Rainfed` → `None_Rainfed`, `Drip`, `Sprinkler`, `Canal`, `Borewell / Tube-well` → `Tubewell_Borewell`); otherwise `null` (UNKNOWN).

---

## 4. Reset & Payload Construction Invariants

### 4.1 Reset Invariant (`handleReset`)
Clicking the form reset button invokes `handleReset()`, which restores all state variables to their clean unselected defaults:
- `state`: `''`
- `sowing_month`: `null`
- `temperature`: `null`
- `humidity`: `null`
- `soil_texture`: `''`
- `soil_ph`: `null`
- `nitrogen`: `null`
- `phosphorus`: `null`
- `potassium`: `null`
- `organic_carbon`: `null`
- `nutrient_basis`: `''`
- `has_soil_test`: `false`
- `irrigation_access`: `null`
- All other optional fields: `null`

Fabricated values (Punjab, 25°C, 65%, Loam, 6.8, 80/40/40, SHC_Available_kg_ha) are **never restored**.

### 4.2 Payload Construction
When submitting to `predictApi.predictV2`, the request payload is constructed with strict provenance preservation:
```typescript
const payload: V2PredictRequest = {
  state: formData.state.trim(),
  sowing_month: formData.sowing_month!,
  district: formData.district?.trim() || null,
  season: formData.season || null,
  irrigation_access: formData.irrigation_access || null,
  irrigation_depth_mm: isNumeric(formData.irrigation_depth_mm) ? formData.irrigation_depth_mm : null,
  irrigation_period_days: isNumeric(formData.irrigation_period_days) ? Math.round(formData.irrigation_period_days) : null,
  seasonal_rainfall_amount: isNumeric(formData.seasonal_rainfall_amount) ? formData.seasonal_rainfall_amount : null,
  annual_rainfall: isNumeric(formData.annual_rainfall) ? formData.annual_rainfall : null,
  has_soil_test: Boolean(formData.has_soil_test),
  soil_texture: formData.soil_texture?.trim() || null,
  soil_ph: isNumeric(formData.soil_ph) ? formData.soil_ph : null,
  nitrogen: isNumeric(formData.nitrogen) ? formData.nitrogen : null,
  phosphorus: isNumeric(formData.phosphorus) ? formData.phosphorus : null,
  potassium: isNumeric(formData.potassium) ? formData.potassium : null,
  organic_carbon: isNumeric(formData.organic_carbon) ? formData.organic_carbon : null,
  nutrient_basis: formData.nutrient_basis?.trim() || null,
  temperature: isNumeric(formData.temperature) ? formData.temperature : null,
  humidity: isNumeric(formData.humidity) ? formData.humidity : null,
  temperature_min_night: isNumeric(formData.temperature_min_night) ? formData.temperature_min_night : null,
  temperature_max_day: isNumeric(formData.temperature_max_day) ? formData.temperature_max_day : null,
};
```
No fallback strings or numbers are inserted during payload creation. Missing parameters are transmitted as `null` or omitted according to the V2 API schema.
