"""
FieldWise Phase 3C.5.2.2: Trusted Verification Authority Registry
================================================================
Formalizes trusted verification authority governance to prevent fabricated
epistemic provenance claims.

Strict Verification Invariants (Finding 3):
  - A station ID alone CANNOT establish independent verification.
  - A laboratory name alone CANNOT establish independent verification.
  - Requires an actual trusted verification record from an accredited authority,
    matching observation/sample identifier, valid observation date/period,
    and official verification status.
  - User-provided strings or unverified metadata are NEVER promoted to
    INDEPENDENTLY_VERIFIED status (they remain USER_DECLARED).
  - Retains SOURCE_REFERENCED, USER_DECLARED, or UNKNOWN as appropriate.
"""

from typing import Dict, List, Optional, Tuple
from .schemas import TrustedVerificationRecord, ProvenanceTier


class TrustedVerificationRegistry:
    """
    Registry of recognized verification authorities and observation verification logic.
    """

    # Recognized national and state agricultural and meteorological verification authorities
    RECOGNIZED_AUTHORITIES: Dict[str, Dict[str, str]] = {
        "AUTH-ICAR-SHC-REGISTRY": {
            "name": "ICAR / DAC&FW National Soil Health Card Digital Portal",
            "jurisdiction": "National Soil Testing Laboratory Accreditation & Card Verification",
            "domain": "soil_and_nutrients",
        },
        "AUTH-IMD-AWS-NETWORK": {
            "name": "India Meteorological Department Automated Weather Station Network",
            "jurisdiction": "National Surface Meteorological Observation & Gridded Radar Data",
            "domain": "climate_and_rainfall",
        },
        "AUTH-CWC-HYDROLOGY": {
            "name": "Central Water Commission & State Irrigation Hydrometry Registry",
            "jurisdiction": "Calibrated Irrigation Discharge & Tubewell Flow Metering",
            "domain": "irrigation_water",
        },
        "AUTH-NABL-ACCREDITED-LAB": {
            "name": "National Accreditation Board for Testing and Calibration Laboratories (NABL)",
            "jurisdiction": "Certified Analytical Chemical and Edaphic Soil Testing Laboratories",
            "domain": "soil_and_nutrients",
        },
    }

    @classmethod
    def is_recognized_authority(cls, authority_id: str) -> bool:
        """Checks if authority ID is registered in the trusted authority directory."""
        if not authority_id:
            return False
        return authority_id.strip() in cls.RECOGNIZED_AUTHORITIES

    @classmethod
    def verify_observation(
        cls,
        expected_authority_type: str,
        observation_id: Optional[str],
        observation_date: Optional[str],
        verification_records: List[TrustedVerificationRecord],
    ) -> Tuple[bool, str, Optional[TrustedVerificationRecord]]:
        """
        Validates whether an observation ID (sample_id, station_id, meter_id) is
        grounded in an authentic, cryptographically verified TrustedVerificationRecord.

        Strict Phase 3C.5.2.2.1 Governance (Finding 3):
        - An authority allowlist or matching user-supplied observation ID is NEVER proof of
          independent verification.
        - Fabricated records or mock tokens cannot grant INDEPENDENTLY_VERIFIED status.
        - Real independent verification requires an operational cryptographic signature
          verification mechanism checked against a trusted public key.
        - In the absence of an authenticated digital signature and public key validation,
          observations cannot be awarded INDEPENDENTLY_VERIFIED status and remain USER_DECLARED.
        """
        if not observation_id:
            return False, "No observation or sample identifier provided.", None

        return (
            False,
            f"Observation ID '{observation_id}' cannot be independently verified: no cryptographic signature "
            "verification mechanism against a trusted authority public key is operational. Retained as USER_DECLARED.",
            None,
        )
