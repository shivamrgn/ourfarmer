"""
FieldWise Phase 3C.5: Planting-Window Resolution Module
======================================================
Resolves query temporal and geographic context against the canonical
crop planting windows defined in the 19-crop catalogue.

Features:
  - Six-field temporal model evaluation
  - Multi-season arable and perennial life-cycle handling
  - Agro-climatic regional filtering
  - Calendar wrap-around handling (e.g. Nov-Jan windows)
  - Clear agronomic justification for non-matching candidates
"""

from typing import Tuple, Optional, List
from .schemas import (
    CropCatalogueEntry,
    PlantingWindowDefinition,
    TemporalInput,
    LocationInput,
)

# Standard regional zone mappings
ZONE_STATE_MAP = {
    "North_Western_Plains_Zone": ["Punjab", "Haryana", "Rajasthan", "Uttar Pradesh", "Delhi", "Jammu and Kashmir"],
    "Northern_Irrigated_Punjab_Haryana": ["Punjab", "Haryana", "Rajasthan"],
    "Northern_Plains_Punjab_Haryana": ["Punjab", "Haryana", "Delhi"],
    "Northern_and_Western_Plains": ["Punjab", "Haryana", "Rajasthan", "Uttar Pradesh"],
    "North_Western_and_Central_Plains": ["Punjab", "Haryana", "Rajasthan", "Uttar Pradesh", "Madhya Pradesh"],
    "Indo_Gangetic_Plains": ["Punjab", "Haryana", "Uttar Pradesh", "Bihar", "West Bengal"],
    "Plains_Zone": ["Punjab", "Haryana", "Uttar Pradesh", "Bihar", "West Bengal", "Rajasthan", "Madhya Pradesh", "Maharashtra"],
    "Central_Zone_MP_Gujarat": ["Madhya Pradesh", "Gujarat", "Maharashtra", "Rajasthan", "Chhattisgarh"],
    "Central_Vertisol_Zone": ["Madhya Pradesh", "Maharashtra", "Gujarat", "Andhra Pradesh", "Karnataka"],
    "Central_Vertisol_Plateau": ["Madhya Pradesh", "Maharashtra", "Karnataka", "Telangana"],
    "Central_and_Northern_India": ["Madhya Pradesh", "Uttar Pradesh", "Rajasthan", "Haryana", "Punjab", "Maharashtra", "Bihar"],
    "Eastern_and_Central_Plains": ["Bihar", "West Bengal", "Uttar Pradesh", "Madhya Pradesh", "Odisha", "Assam"],
    "Eastern_India_WB_Assam_Bihar": ["West Bengal", "Assam", "Bihar", "Odisha", "Jharkhand"],
    "Assam_West_Bengal": ["Assam", "West Bengal", "Tripura", "Meghalaya"],
    "Tropical_Maharashtra_Karnataka": ["Maharashtra", "Karnataka", "Tamil Nadu", "Andhra Pradesh", "Telangana", "Gujarat"],
    "Subtropical_UP_Bihar": ["Uttar Pradesh", "Bihar", "Haryana", "Punjab", "Uttarakhand"],
    "Saurashtra_Gujarat": ["Gujarat", "Rajasthan", "Maharashtra"],
    "Gujarat_AP_TamilNadu": ["Gujarat", "Andhra Pradesh", "Tamil Nadu", "Karnataka", "Telangana"],
    "Western_and_Southern_India": ["Maharashtra", "Gujarat", "Karnataka", "Tamil Nadu", "Andhra Pradesh", "Telangana", "Madhya Pradesh"],
    "Peninsular_Tropical_Belts": ["Maharashtra", "Karnataka", "Tamil Nadu", "Andhra Pradesh", "Kerala", "Gujarat", "Bihar", "West Bengal"],
    "All_India_Orchard_Tracts": ["Punjab", "Haryana", "Uttar Pradesh", "Bihar", "West Bengal", "Maharashtra", "Gujarat", "Andhra Pradesh", "Karnataka"],
    "Deccan_Plateau": ["Maharashtra", "Karnataka", "Telangana", "Andhra Pradesh", "Madhya Pradesh"],
    "Maharashtra_Karnataka_Vertisols": ["Maharashtra", "Karnataka", "Telangana", "Andhra Pradesh"],
    "Southern_and_Western_India": ["Maharashtra", "Karnataka", "Andhra Pradesh", "Telangana", "Tamil Nadu", "Gujarat"],
    "Northern_Plains": ["Punjab", "Haryana", "Uttar Pradesh", "Bihar", "Rajasthan"],
    "Arid_and_Semi_Arid_Plains": ["Rajasthan", "Gujarat", "Haryana", "Punjab", "Maharashtra", "Karnataka", "Andhra Pradesh"],
    "Gujarat_Tamil_Nadu": ["Gujarat", "Tamil Nadu", "Andhra Pradesh", "Karnataka"],
    "All_Rice_Ecosystems": [],  # All states
    "All_India": [],  # All states
}


class PlantingWindowResolver:
    """
    Evaluates whether a candidate crop has an active, agronomic planting window
    compatible with the farmer's temporal and regional cultivation query.
    """

    @classmethod
    def is_month_in_window(cls, month: int, start: int, end: int) -> bool:
        """Handles standard and year-wrap windows (e.g. Nov to Feb)."""
        if start <= end:
            return start <= month <= end
        else:
            # Wrap around: e.g. Nov (11) to Feb (2) -> 11, 12, 1, 2
            return month >= start or month <= end

    @classmethod
    def is_region_compatible(cls, state: str, region_or_zone: str) -> bool:
        if not region_or_zone or region_or_zone in ["All_India", "All_Rice_Ecosystems", "All_India_Orchard_Tracts"]:
            return True
        allowed_states = ZONE_STATE_MAP.get(region_or_zone, [])
        if not allowed_states:
            return True
        return any(s.lower() == state.lower() for s in allowed_states)

    @classmethod
    def resolve(
        cls,
        crop: CropCatalogueEntry,
        temporal: TemporalInput,
        location: LocationInput,
    ) -> Tuple[str, Optional[PlantingWindowDefinition], str]:
        """
        Resolves the query against crop windows.
        Returns (status: "PASS" | "FAIL" | "UNKNOWN", matched_window, justification).
        """
        sowing_month = temporal.sowing_month
        state = location.state
        desired_system = temporal.planting_system
        desired_season = temporal.cultivation_season

        if sowing_month is None:
            return "UNKNOWN", None, f"{crop.canonical_name}: Sowing month omitted; window compatibility unknown."

        # Candidate windows for this crop
        matching_windows: List[PlantingWindowDefinition] = []

        for window in crop.planting_windows:
            # 1. Month match
            month_match = cls.is_month_in_window(sowing_month, window.sowing_month_start, window.sowing_month_end)
            if not month_match:
                continue

            # 2. Region match
            region_match = cls.is_region_compatible(state, window.region_or_zone)
            if not region_match:
                continue

            # 3. Planting system match (if user specified a specific one)
            if desired_system and desired_system.strip():
                if desired_system.strip().lower() != window.planting_system.lower():
                    # Check if partial match
                    if desired_system.strip().lower() not in window.planting_system.lower():
                        continue

            # 4. Season match (if user specified broad season)
            if desired_season and desired_season.strip():
                # Some crops can match if their broad season is compatible
                user_season = desired_season.strip().lower()
                win_season = window.broad_season.lower()
                if user_season != win_season:
                    # Allow Annual_Special or Perennial_Orchard to match any valid sowing window
                    if win_season not in ["annual_special", "perennial_orchard"] and user_season not in ["annual_special", "perennial_orchard"]:
                        # e.g. Boro in Rabi/Boro_Special
                        if not (user_season == "rabi" and win_season == "boro_special"):
                            continue

            matching_windows.append(window)

        if matching_windows:
            # Pick best match (prefer verified evidence)
            best_window = next((w for w in matching_windows if w.window_evidence_status == "VERIFIED"), matching_windows[0])
            justification = (
                f"{crop.canonical_name}: Active planting window '{best_window.window_id}' "
                f"({best_window.planting_system}, {best_window.broad_season}) in {best_window.region_or_zone} "
                f"covers month {sowing_month} ({best_window.sowing_date_range})."
            )
            return "PASS", best_window, justification

        # If no window matched, provide clear physiological/calendar failure rationale
        supported_months = []
        for w in crop.planting_windows:
            supported_months.append(f"{w.planting_system} ({w.sowing_date_range}, months {w.sowing_month_start}-{w.sowing_month_end})")
        
        failure_reason = (
            f"{crop.canonical_name} ({crop.crop_life_cycle}): Month {sowing_month} in {state} is outside verified "
            f"planting windows: {'; '.join(supported_months)}."
        )
        return "FAIL", None, failure_reason
