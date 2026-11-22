"""
FieldWise Phase 3C.5: Input Validation & Normalization Module
============================================================
Performs strict schema validation, type-checking, bounds checking,
and canonical normalization on RecommendationQuery payloads.

Safety Invariants Enforced:
  - Missing information must NEVER silently become a favorable value.
  - UNKNOWN remains distinct from PASS.
  - Rejects biologically impossible inputs (e.g. negative rainfall, pH > 14).
  - Flags critical data absence for deterministic INSUFFICIENT_DATA rejection.
"""

from typing import List, Tuple, Optional
from .schemas import (
    RecommendationQuery,
    LocationInput,
    TemporalInput,
    ClimateWaterInput,
    EdaphicInput,
)


class InputValidationError(ValueError):
    """Raised when an input violates physical or grammatical constraints."""
    pass


STATE_NORMALIZATION_MAP = {
    "pb": "Punjab",
    "punjab": "Punjab",
    "up": "Uttar Pradesh",
    "uttar pradesh": "Uttar Pradesh",
    "wb": "West Bengal",
    "west bengal": "West Bengal",
    "rj": "Rajasthan",
    "rajasthan": "Rajasthan",
    "mh": "Maharashtra",
    "maharashtra": "Maharashtra",
    "hr": "Haryana",
    "haryana": "Haryana",
    "as": "Assam",
    "assam": "Assam",
    "mp": "Madhya Pradesh",
    "madhya pradesh": "Madhya Pradesh",
    "gj": "Gujarat",
    "gujarat": "Gujarat",
    "bihar": "Bihar",
    "br": "Bihar",
    "karnataka": "Karnataka",
    "ka": "Karnataka",
    "tamil nadu": "Tamil Nadu",
    "tn": "Tamil Nadu",
    "andhra pradesh": "Andhra Pradesh",
    "ap": "Andhra Pradesh",
    "telangana": "Telangana",
    "ts": "Telangana",
    "odisha": "Odisha",
    "orissa": "Odisha",
}

SOIL_TEXTURE_NORMALIZATION = {
    "sandy": "Sandy",
    "sand": "Sandy",
    "sandy loam": "Sandy Loam",
    "sandy_loam": "Sandy Loam",
    "loamy": "Loamy",
    "loam": "Loamy",
    "clay loam": "Clay Loam",
    "clay_loam": "Clay Loam",
    "clay": "Clay",
    "heavy clay": "Clay",
    "black vertisol": "Black Vertisol",
    "vertisol": "Black Vertisol",
    "black cotton": "Black Vertisol",
    "deep vertisol": "Black Vertisol",
    "red sandy": "Red Sandy",
    "red sandy loam": "Red Sandy",
    "alluvial": "Alluvial",
    "alluvial soil": "Alluvial",
}


class InputValidator:
    """
    Validates and normalizes input queries before eligibility and scoring evaluation.
    """

    @classmethod
    def validate_and_normalize(cls, query: RecommendationQuery) -> Tuple[RecommendationQuery, List[str]]:
        """
        Validates all fields and returns (normalized_query, list_of_warnings).
        Raises InputValidationError if an input is physically impossible or corrupted.
        """
        warnings: List[str] = []

        # 1. Location Validation
        if not query.location.state or not query.location.state.strip():
            raise InputValidationError("Location state is required.")
        raw_state = query.location.state.strip().lower()
        normalized_state = STATE_NORMALIZATION_MAP.get(raw_state, query.location.state.strip())
        query.location.state = normalized_state

        # 2. Temporal Validation
        month = query.temporal.sowing_month
        if month is None or not isinstance(month, int) or month < 1 or month > 12:
            raise InputValidationError(f"Invalid sowing_month: {month}. Must be an integer between 1 and 12.")

        if query.temporal.sowing_date:
            parts = query.temporal.sowing_date.split("-")
            if len(parts) == 3:
                try:
                    int(parts[0])
                    m = int(parts[1])
                    d = int(parts[2])
                    if m != month:
                        warnings.append(f"sowing_date month ({m}) differs from sowing_month ({month}). Using sowing_month.")
                except ValueError:
                    warnings.append(f"Could not parse sowing_date: {query.temporal.sowing_date}")

        # 3. Climate & Water Validation
        cw = query.climate_and_water
        if cw.seasonal_rainfall_amount is not None:
            if cw.seasonal_rainfall_amount < 0:
                raise InputValidationError(f"Negative seasonal_rainfall_amount: {cw.seasonal_rainfall_amount} mm.")
            if cw.seasonal_rainfall_amount > 12000.0:
                warnings.append(f"Extremely high seasonal rainfall ({cw.seasonal_rainfall_amount} mm). Mawsynram/Cherrapunji range.")

        if cw.irrigation_water_quantity_mm is not None:
            if cw.irrigation_water_quantity_mm < 0:
                raise InputValidationError(f"Negative irrigation_water_quantity_mm: {cw.irrigation_water_quantity_mm} mm.")

        if cw.monthly_rainfall is not None:
            for i, p in enumerate(cw.monthly_rainfall):
                if p < 0:
                    raise InputValidationError(f"Negative monthly rainfall in month {i+1}: {p} mm.")

        if cw.temperature_mean is not None:
            if cw.temperature_mean < -20.0 or cw.temperature_mean > 60.0:
                raise InputValidationError(f"Physiologically impossible mean temperature: {cw.temperature_mean}°C.")

        if cw.relative_humidity is not None:
            if cw.relative_humidity < 0.0 or cw.relative_humidity > 100.0:
                raise InputValidationError(f"Invalid relative humidity: {cw.relative_humidity}%. Must be 0-100%.")

        # 4. Edaphic Validation
        ed = query.edaphic
        if ed.soil_ph is not None:
            if ed.soil_ph < 2.0 or ed.soil_ph > 12.0:
                raise InputValidationError(f"Physiologically impossible soil pH: {ed.soil_ph}. Must be between 2.0 and 12.0.")

        if ed.soil_texture:
            norm_tex = SOIL_TEXTURE_NORMALIZATION.get(ed.soil_texture.strip().lower(), ed.soil_texture.strip())
            ed.soil_texture = norm_tex

        if ed.has_soil_test:
            if ed.soil_nitrogen is not None and ed.soil_nitrogen < 0:
                raise InputValidationError(f"Negative soil nitrogen: {ed.soil_nitrogen} kg/ha.")
            if ed.soil_phosphorus is not None and ed.soil_phosphorus < 0:
                raise InputValidationError(f"Negative soil phosphorus: {ed.soil_phosphorus} kg/ha.")
            if ed.soil_potassium is not None and ed.soil_potassium < 0:
                raise InputValidationError(f"Negative soil potassium: {ed.soil_potassium} kg/ha.")

        return query, warnings

    @classmethod
    def check_data_adequacy(cls, query: RecommendationQuery) -> Tuple[bool, Optional[str]]:
        """
        Determines whether the query has enough essential information to proceed to biological scoring.
        Returns (is_adequate, failure_reason).
        """
        if query.temporal.sowing_month is None:
            return False, "Sowing month omitted. Biological feasibility cannot be established without temporal context."

        cw = query.climate_and_water
        if cw.seasonal_rainfall_amount is None and (cw.irrigation_access is None or cw.irrigation_access == "None_Rainfed"):
            return False, "Rainfall amount is omitted for rainfed cultivation. Water sufficiency cannot be calculated."

        return True, None
