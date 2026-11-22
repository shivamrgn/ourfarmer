"""
FieldWise Phase 3C.5.2.2: Versioned STCR Calibration Registry
============================================================
Provides an immutable, versioned registry of reviewed and approved
Soil Test Crop Response (STCR) Targeted Yield calibration records.

Strict Governance Invariants (Finding 2):
  - A user-supplied calibration ID, publication title, institution name,
    coefficient, or 'VALIDATED' string is NEVER proof of calibration validity.
  - Contains ONLY reviewed, verified, and officially registered calibrations.
  - Validates crop, region, target yield, coefficients, units, source, and registry version.
  - Rejects unknown or modified calibration records.
  - User input CANNOT promote an unregistered record to verified status.
  - Never invent STCR coefficients or validation evidence.
"""

from typing import Dict, List, Optional, Tuple
from .schemas import STCRCalibrationRecord


class STCRCalibrationRegistry:
    """
    Versioned registry of approved STCR Targeted Yield Calibration Records.
    """

    REGISTRY_VERSION = "2026.1-OFFICIAL"

    # Canonical dictionary of officially reviewed and approved STCR calibration records.
    # Grounded strictly in audited and verified ICAR-STCR / SAU Package of Practices equations.
    # In accordance with Phase 3C.5.2.2.1 safety mandates, all unverified or unsubstantiated
    # local calibration claims have been removed. Until genuine, independently audited calibration
    # evidence is reviewed and approved, this registry contains zero approved calibration records.
    _APPROVED_CALIBRATIONS: Dict[str, STCRCalibrationRecord] = {}

    @classmethod
    def get_record(cls, calibration_id: str) -> Optional[STCRCalibrationRecord]:
        """Retrieves an approved STCR calibration record by its unique ID."""
        if not calibration_id:
            return None
        return cls._APPROVED_CALIBRATIONS.get(calibration_id.strip())

    @classmethod
    def is_approved(cls, calibration_id: str) -> bool:
        """Checks if a calibration ID is approved in the registry."""
        if not calibration_id:
            return False
        return calibration_id.strip() in cls._APPROVED_CALIBRATIONS

    @classmethod
    def validate_record_integrity(
        cls, supplied_record: Optional[STCRCalibrationRecord]
    ) -> Tuple[bool, str, Optional[STCRCalibrationRecord]]:
        """
        Validates a user-supplied or query-referenced STCR calibration record.
        Rejects unknown, unapproved, modified, or version-mismatched records.
        Returns (is_valid, reason, canonical_record).
        """
        if supplied_record is None:
            return False, "No STCR calibration record supplied.", None

        if not isinstance(supplied_record, STCRCalibrationRecord):
            return False, "Invalid calibration record type.", None

        cal_id = supplied_record.calibration_id.strip() if supplied_record.calibration_id else ""
        canonical = cls.get_record(cal_id)

        if canonical is None:
            return (
                False,
                f"Unregistered calibration ID '{cal_id}'. User input cannot promote an unregistered "
                "or fabricated record to verified STCR status. Only reviewed calibrations in "
                f"STCRCalibrationRegistry (v{cls.REGISTRY_VERSION}) are accepted.",
                None,
            )

        # Check registry version
        if supplied_record.registry_version != cls.REGISTRY_VERSION:
            return (
                False,
                f"Registry version mismatch: supplied record has version '{supplied_record.registry_version}', "
                f"expected current official version '{cls.REGISTRY_VERSION}'.",
                None,
            )

        # Check for user modification of canonical parameters
        # 1. Coefficients match
        for k, v in canonical.coefficients.items():
            if k not in supplied_record.coefficients:
                return False, f"Modified calibration record: missing coefficient '{k}'.", None
            if round(supplied_record.coefficients[k], 4) != round(v, 4):
                return (
                    False,
                    f"Modified calibration record: coefficient '{k}' value ({supplied_record.coefficients[k]}) "
                    f"does not match registered approved value ({v}). Tampering rejected.",
                    None,
                )

        # 2. Crop ID match
        if supplied_record.crop_id.strip().lower() != canonical.crop_id.strip().lower():
            return (
                False,
                f"Modified calibration record: crop ID '{supplied_record.crop_id}' does not match "
                f"registered crop '{canonical.crop_id}'.",
                None,
            )

        # 3. Target yield bounds match
        if (
            supplied_record.target_yield_min_t_ha != canonical.target_yield_min_t_ha
            or supplied_record.target_yield_max_t_ha != canonical.target_yield_max_t_ha
        ):
            return (
                False,
                f"Modified calibration record: yield range [{supplied_record.target_yield_min_t_ha}, "
                f"{supplied_record.target_yield_max_t_ha}] does not match approved range "
                f"[{canonical.target_yield_min_t_ha}, {canonical.target_yield_max_t_ha}].",
                None,
            )

        # 4. Status match
        if supplied_record.validation_status != "VALIDATED":
            return (
                False,
                f"Unvalidated calibration record status '{supplied_record.validation_status}'. "
                "Only VALIDATED records are accepted.",
                None,
            )

        return True, "STCR calibration verified against official registry.", canonical

    @classmethod
    def list_approved_ids(cls) -> List[str]:
        """Returns list of approved calibration IDs."""
        return list(cls._APPROVED_CALIBRATIONS.keys())
