# FieldWise — Phase 3C.6.2.2.1: V2 API Integration Contract Specification

**Document Reference**: `FieldWise_main/model/ml_pipeline/reports/phase_3c_6_2_2_v2_contract.md`  
**Phase**: 3C.6.2.2.1 Backend Bridge Contract Closure  
**Execution Timestamp**: November 2026  
**Status**: APPROVED RECONCILED SPECIFICATION  

---

## 1. Executive Summary & Purpose

The V2 Crop Recommendation API (`POST /api/v2/predict`) exposes the frozen Phase 3C.5 agronomic recommendation engine to the FieldWise application. It is implemented as a dedicated, versioned Express route that communicates with the standalone Python adapter CLI (`adapter_cli.py`) over standard I/O streams using secure `child_process.spawn`.

### Core Architectural Guarantees
1. **Parallel Existence with V1**: The legacy `/api/predict` route remains 100% untouched and operational with zero change to its heuristic predictor or response format.
2. **Strict JSON Numeric Validation**: For all documented numeric fields, the V2 route strictly accepts actual JSON numbers and rejects strings, booleans, arrays, objects, `NaN`, and $+/- \text{Infinity}$ with HTTP 400 Bad Request. Null and omitted values are preserved where the contract permits them. Numeric zeros (`0`, `0.0`) and finite negative values are preserved without silent coercion or rejection.
3. **Agronomic Integrity**: Crop recommendations are ranked by multi-factorial agronomic suitability scores ([0.0, 100.0]). Suitability scores are **never** mapped or converted into statistical probabilities or legacy confidence scores.
4. **Execution Status Preservation & Strict Validation**: The bridge validates the engine output against the frozen adapter contract before returning success, strictly requiring `status` to be exactly one of:
   - `SUCCESS`: One or more crops satisfy Tier 1 agronomic gates and achieve suitability $\ge 40.0$.
   - `INSUFFICIENT_DATA`: Missing critical edaphic or seasonal moisture parameters prevent reliable evaluation.
   - `NO_RECOMMENDATION_SUITABLE`: All evaluated crops fail Tier 1 gates or score below the 40.0 viability threshold. Accompanied by authoritative land reclamation and management advisories.
   Malformed or invalid engine output is never manufactured or defaulted; it returns a controlled bridge error and HTTP 502 Bad Gateway.
5. **Provenance & Evidence Rigor**: Checkbox declarations (e.g. `has_soil_test=true`) remain classified under the `USER_DECLARED` evidence tier. Fertilizer calculations generate baseline RDF arithmetic (`BASELINE_RDF_ARITHMETIC`) and are never elevated to `VERIFIED_STCR_GENERATED` without independent laboratory verification records.
6. **Rainfall & Water Safety**: Missing irrigation access remains `UNKNOWN` and is never silently defaulted to rainfed. Generic rainfall values are not conflated with seasonal rainfall totals, and annual rainfall totals are strictly isolated from seasonal crop-water calculations.

---

## 2. HTTP Endpoint Specification

- **Method**: `POST`
- **Route**: `/api/v2/predict`
- **Headers**: `Content-Type: application/json`, `Accept: application/json`

---

## 3. Canonical Request Schema & Strict Numeric Type Rules

### 3.1 Strict JSON Numeric Validation Policy
Every documented numeric field across top-level payloads and nested contract locations (`climate_and_water`, `edaphic`) obeys the following strict typing rules:
- **Accepted**: Actual JSON numbers (`typeof val === 'number' && Number.isFinite(val)`). Valid zeros (`0`, `0.0`) and finite negative values are accepted without distortion.
- **Rejected with HTTP 400 Bad Request**:
  - Numeric strings (e.g. `"24.0"`, `"120"`, `"0"`, `"7.2"`)
  - Booleans (e.g. `true`, `false`)
  - Objects (e.g. `{ value: 45 }`)
  - Arrays (e.g. `[150]`)
  - Non-finite numbers (`NaN`, `Infinity`, `-Infinity`)
- **Preserved**: `null` and omitted fields are preserved where the contract permits them.

### 3.2 Field Catalog

| Field Name | Type | Contract Scope | Default | Description & Strict Type Enforcement |
| :--- | :---: | :---: | :---: | :--- |
| `state` | `string` | Top-level / `location` | None | **Mandatory**. Indian State / UT name. Must be a non-empty string. |
| `district` | `string` | Top-level / `location` | `null` | District name for regional agronomic localization. |
| `sowing_month` | `integer` | Top-level / `temporal` | None | **Mandatory**. Planned sowing month (1 to 12). Must be an actual integer. Strings, booleans, and floats (e.g. 10.5) rejected with 400. |
| `cultivation_season` | `string` | Top-level / `temporal` | `null` | Cultivation season (e.g., `"Kharif"`, `"Rabi"`, `"Zaid"`). |
| `soil_ph` / `ph` | `number` | Top-level / `edaphic` | `null` | Soil reaction pH. Strict finite JSON number [2.0, 12.0]. |
| `soil_texture` | `string` | Top-level / `edaphic` | `null` | Textural class (e.g., `"Clay Loam"`, `"Sandy Loam"`, `"Loam"`). |
| `has_soil_test` | `boolean` | Top-level / `edaphic` | `false` | Strict JSON boolean (`true` or `false`). Strings (`"true"`) rejected with 400. |
| `nitrogen` / `soil_nitrogen` | `number` | Top-level / `edaphic` | `null` | Available nitrogen. Strict finite JSON number $\ge 0.0$. |
| `phosphorus` / `soil_phosphorus` | `number` | Top-level / `edaphic` | `null` | Available phosphorus. Strict finite JSON number $\ge 0.0$. |
| `potassium` / `soil_potassium` | `number` | Top-level / `edaphic` | `null` | Available potassium. Strict finite JSON number $\ge 0.0$. |
| `organic_carbon` / `organic_carbon_pct` | `number` | Top-level / `edaphic` | `null` | Organic carbon %. Strict finite JSON number [0.0, 100.0]. |
| `nutrient_basis` | `string` | Top-level / `edaphic` | `null` | Unit basis (e.g., `"SHC_Available_kg_ha"`). Required for baseline RDF arithmetic. |
| `irrigation_access` | `string` | Top-level / `climate_and_water` | `null` | Infrastructure: `"None_Rainfed"`, `"Canal"`, `"Tubewell_Borewell"`, `"Drip"`, `"Sprinkler"`. Missing selection remains `UNKNOWN`. |
| `irrigation_water_quantity_mm` | `number` | Top-level / `climate_and_water` | `null` | Irrigation depth in mm. Strict finite JSON number $\ge 0.0$. |
| `irrigation_period_days` | `integer` | Top-level / `climate_and_water` | `null` | Duration. Strict positive whole-day integer ($> 0$). Floats rejected with 400. |
| `seasonal_rainfall_amount` | `number` | Top-level / `climate_and_water` | `null` | Seasonal rainfall in mm. Strict finite JSON number $\ge 0.0$. |
| `seasonal_rainfall_mm` | `number` | Top-level / `climate_and_water` | `null` | Accepted alias for `seasonal_rainfall_amount`. Strict finite JSON number. |
| `annual_rainfall` / `annual_rainfall_amount` / `annual_rainfall_mm` | `number` | Top-level / `climate_and_water` | `null` | Annual rainfall total in mm. Stored for macro context only. Strict finite number. |
| `rainfall` | `number` | Top-level / `climate_and_water` | `null` | Generic unclassified rainfall depth in mm. Strict finite JSON number $\ge 0.0$. |
| `rainfall_period_type` | `string` | Top-level / `climate_and_water` | `null` | Period classification (e.g., `"Crop_Season_Measured"`, `"Seasonal_Estimated"`). |
| `rainfall_period_days` | `integer` | Top-level / `climate_and_water` | `null` | Duration. Strict positive whole-day integer ($> 0$). Floats rejected with 400. |
| `monthly_rainfall` | `array` | Top-level / `climate_and_water` | `null` | Array of monthly rainfall values. Each element must be a strict finite JSON number. |
| `temperature` / `temperature_mean` | `number` | Top-level / `climate_and_water` | `null` | Mean temperature in °C. Strict finite JSON number. |
| `temperature_min_night` | `number` | Top-level / `climate_and_water` | `null` | Minimum night temperature in °C. Strict finite JSON number. |
| `temperature_max_day` | `number` | Top-level / `climate_and_water` | `null` | Maximum day temperature in °C. Strict finite JSON number. |
| `humidity` / `relative_humidity` | `number` | Top-level / `climate_and_water` | `null` | Relative humidity %. Strict finite JSON number [0.0, 100.0]. |
| `soil_moisture_mm` | `number` | Top-level / `climate_and_water` | `null` | Soil moisture storage in mm. Strict finite JSON number $\ge 0.0$. |
| `awc_mm_m` | `number` | Top-level / `climate_and_water` | `null` | Available water capacity in mm/m. Strict finite JSON number $\ge 0.0$. |
| `rooting_depth_m` | `number` | Top-level / `climate_and_water` | `null` | Effective rooting depth in meters. Strict finite JSON number $\ge 0.0$. |
| `target_yield_t_ha` | `number` | Top-level | `null` | Target yield in t/ha for STCR. Strict finite JSON number $> 0.0$. |
| `has_stcr_calibration` | `boolean` | Top-level | `false` | Strict JSON boolean (`true` or `false`). |
| `verification_records` | `array` | Top-level | `[]` | List of trusted verification record objects. |

---

## 4. Response Schemas and Representative Examples

### 4.1 Response Envelope Structure
```typescript
interface V2PredictResponse {
  success: boolean;
  version: "2.2.0-CLOSURE";
  status: "SUCCESS" | "INSUFFICIENT_DATA" | "NO_RECOMMENDATION_SUITABLE";
  data: {
    status: "SUCCESS" | "INSUFFICIENT_DATA" | "NO_RECOMMENDATION_SUITABLE";
    engine_version: string;
    execution_timestamp: string;
    query_summary: {
      location: string;
      season: string;
      planting_system_evaluated: string;
      water_regime_evaluated: string;
      data_completeness_index: number;
      evidence_confidence_tier: string;
    };
    recommendations: Array<{
      crop_id: string;
      canonical_name: string;
      suitability_score: number;
      rank: number;
      tier1_status?: string;
      tier2_components?: object;
      water_assessment?: object;
      fertilizer_prescription?: object;
      agronomic_advisory?: string[];
      risk_warnings?: string[];
    }>;
    excluded_candidates: Array<{
      crop_id: string;
      canonical_name: string;
      tier1_status: string;
      failing_rules: Array<{ rule: string; reason: string }>;
    }>;
    diagnostics?: object;
    land_reclamation_advisory?: string | null;
  };
}
```

### 4.2 Representative Output for `SUCCESS`
```json
{
  "success": true,
  "version": "2.2.0-CLOSURE",
  "status": "SUCCESS",
  "data": {
    "status": "SUCCESS",
    "engine_version": "2.2.0-CLOSURE",
    "execution_timestamp": "2026-11-21T11:00:00Z",
    "query_summary": {
      "location": "Punjab, Ludhiana",
      "season": "Rabi",
      "planting_system_evaluated": "Sole_Crop",
      "water_regime_evaluated": "Irrigated",
      "data_completeness_index": 85.0,
      "evidence_confidence_tier": "FARMER_DECLARED"
    },
    "recommendations": [
      {
        "crop_id": "wheat",
        "canonical_name": "Wheat",
        "suitability_score": 82.4,
        "rank": 1,
        "tier1_status": "PASS",
        "water_assessment": {
          "crop_water_demand_mm": 400.0,
          "effective_water_available_mm": 418.0,
          "water_balance_ratio": 1.045
        },
        "fertilizer_prescription": {
          "status": "BASELINE_RDF_ARITHMETIC",
          "evidence_level": "USER_DECLARED",
          "nitrogen_kg_ha": 120.0,
          "phosphorus_kg_ha": 60.0,
          "potassium_kg_ha": 40.0
        }
      }
    ],
    "excluded_candidates": [],
    "land_reclamation_advisory": null
  }
}
```

### 4.3 Representative Output for `INSUFFICIENT_DATA`
```json
{
  "success": true,
  "version": "2.2.0-CLOSURE",
  "status": "INSUFFICIENT_DATA",
  "data": {
    "status": "INSUFFICIENT_DATA",
    "engine_version": "2.2.0-CLOSURE",
    "execution_timestamp": "2026-11-21T11:00:00Z",
    "query_summary": {
      "location": "Punjab",
      "season": "Rabi",
      "planting_system_evaluated": "Sole_Crop",
      "water_regime_evaluated": "Rainfed",
      "data_completeness_index": 35.0,
      "evidence_confidence_tier": "INSUFFICIENT_DATA"
    },
    "recommendations": [],
    "excluded_candidates": [],
    "diagnostics": {
      "reason": "Missing seasonal moisture data"
    },
    "land_reclamation_advisory": null
  }
}
```

### 4.4 Representative Output for `NO_RECOMMENDATION_SUITABLE`
```json
{
  "success": true,
  "version": "2.2.0-CLOSURE",
  "status": "NO_RECOMMENDATION_SUITABLE",
  "data": {
    "status": "NO_RECOMMENDATION_SUITABLE",
    "engine_version": "2.2.0-CLOSURE",
    "execution_timestamp": "2026-11-21T11:00:00Z",
    "query_summary": {
      "location": "Haryana",
      "season": "Rabi",
      "planting_system_evaluated": "Sole_Crop",
      "water_regime_evaluated": "Rainfed",
      "data_completeness_index": 70.0,
      "evidence_confidence_tier": "FARMER_DECLARED"
    },
    "recommendations": [
      {
        "crop_id": "barley",
        "canonical_name": "Barley",
        "suitability_score": 34.2,
        "rank": 1
      }
    ],
    "excluded_candidates": [],
    "land_reclamation_advisory": "Severe alkaline/sodic conditions (pH 9.2) and critical moisture deficit. Apply agricultural gypsum and Sesbania green manure."
  }
}
```

---

## 5. HTTP Status Code Mapping Matrix

| HTTP Status | Internal Bridge Condition | Response Error Code | Client Diagnostic Meaning |
| :---: | :--- | :--- | :--- |
| **`200 OK`** | Normal engine evaluation (`SUCCESS`, `INSUFFICIENT_DATA`, `NO_RECOMMENDATION_SUITABLE`). | None | Evaluated successfully with verified contract structure. |
| **`400 Bad Request`** | Outer schema or numeric type violation. Missing mandatory inputs, non-integer sowing month, numeric strings, booleans, objects, arrays, NaN, or Infinity. | `INVALID_REQUEST` | Client supplied malformed or unacceptable parameters. |
| **`422 Unprocessable`** | Engine-level agronomic validation error (e.g., conflicting seasonal rainfall aliases). | `ENGINE_VALIDATION_ERROR` | Parameter combination rejected by recommendation engine. |
| **`502 Bad Gateway`** | Process buffer overflow, empty output, malformed JSON, or response failing contract validation (e.g. `{}`, missing status, unknown status). | `OUTPUT_LIMIT_EXCEEDED` / `INVALID_ENGINE_OUTPUT` | Python engine emitted invalid or unparseable output. |
| **`503 Unavailable`** | Process spawn failure (e.g., Python binary missing, `ENOENT`). | `SERVICE_UNAVAILABLE` | Python execution environment could not be spawned. |
| **`504 Timeout`** | Execution exceeded timeout window (`FIELDWISE_BRIDGE_TIMEOUT_MS`, default 10,000ms). | `EXECUTION_TIMEOUT` | Process terminated after exceeding execution threshold. |
| **`500 Server Error`** | Unhandled server exception or unexpected signal termination. | `INTERNAL_ENGINE_ERROR` | An unhandled exception occurred within the Node.js backend. |

---

## 6. Server Environment Configuration Variables

| Variable Name | Fallback Variable | Default Value | Description |
| :--- | :--- | :---: | :--- |
| `FIELDWISE_PYTHON_PATH` | `PYTHON_PATH` | `'python3'` | Absolute or system PATH executable for Python 3 runtime. |
| `FIELDWISE_BRIDGE_TIMEOUT_MS` | `RECOMMENDATION_ENGINE_TIMEOUT_MS` | `10000` (10s) | Bounded child process execution timeout in milliseconds. |
| `FIELDWISE_BRIDGE_MAX_STDOUT_BYTES` | `RECOMMENDATION_ENGINE_MAX_BUFFER_BYTES` | `10485760` (10MB) | Independent maximum stdout stream buffer capacity. |
| `FIELDWISE_BRIDGE_MAX_STDERR_BYTES` | None | `1048576` (1MB) | Independent maximum stderr stream buffer capacity. |
