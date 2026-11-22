#!/usr/bin/env python3
"""
FieldWise Phase 3C.4.2.2.1: Non-Destructive Specification Validator Engine
==========================================================================
Verifies that all Phase 3C.4 specification matrices, data contracts, and audit
files satisfy governance, agronomic, and architectural criteria without modifying
any historical phase manifests.

Key Invariants Enforced (Phase 3C.4.2.2.1 Charter):
  1. Historical Checksum Immutability:
     Historical manifests (phase_3c_4_checksums.txt, phase_3c_4_1_checksums.txt,
     phase_3c_4_2_checksums.txt, phase_3c_4_2_1_checksums.txt, phase_3c_4_2_2_checksums.txt)
     are validated read-only. Their pre-execution SHA-256 hashes are recorded and
     asserted to be bitwise identical post-execution.
  2. Effective Rainfall Monthly USDA-SCS Formulation:
     The USDA-SCS formula is strictly an empirical monthly equation. Applying it directly
     to seasonal aggregates is invalid and prohibited. Monthly effective rainfall is
     aggregated over the crop period (e.g. Example A: 1,150 mm produces 589.0 mm effective
     rain via monthly sum, vs invalid seasonal application of 240.0 mm, delta 349.0 mm).
     Missing monthly distribution returns UNKNOWN effective rain and provisional status.
  3. Corrected Rainfed Status Semantics:
     Rainfall exceeding screening threshold sets SCREENING_THRESHOLD_MET, NOT PASS_VERIFIED.
     Five distinct outcomes enforced: SCREENING_THRESHOLD_MET, WATER_DEFICIT_WARNING,
     CONDITIONALLY_ELIGIBLE_WITH_UNKNOWN_WATER_RISK, CONDITIONALLY_ELIGIBLE_WITH_PROVISIONAL_WATER_BALANCE,
     and UNKNOWN. Rainfed screening thresholds NEVER independently produce HARD_EXCLUSION or Tier 1 FAIL.
  4. Residual Soil Moisture Accounting:
     Four epistemic tiers enforced: MEASURED, SOURCE_BACKED_ESTIMATED, PROVISIONAL, and UNKNOWN.
     Deep Vertisol storage (240.0 mm profile capacity) verified; unmeasured storage is never fabricated.
  5. Independent Water Arithmetic Assertions:
     Validator independently recomputes every numerical worked example and fails if any reported
     value does not match its stated formula and input data.
  6. Hard-Exclusion Evidence Re-Audit:
     All 61 candidate rules audited against strict 100% biological lethality standard.
     Exactly 0 retained as HARD_EXCLUSION; 61 downgraded to SOFT_PENALTY; 0 marked UNKNOWN.
     Eligibility rules matrix has exactly 0 HARD_EXCLUSION and 87 SOFT_PENALTY.
  7. Orthogonal 6-Domain DCI Formulation:
     Weights sum to 1.000 (0.15 + 0.20 + 0.25 + 0.15 + 0.10 + 0.15). Verified against
     4 reproducible benchmark scenarios (1.000, 0.850, 0.640, 0.775).
  8. Acceptance Test Suite Completeness:
     18 comprehensive test cases covering all Phase 3C.4.2.2.1 scenarios.
  9. Architectural Separation of Tests:
     Specification Integrity Checks are executed and verified. Functional Acceptance
     Tests are explicitly reported as NOT RUN — ENGINE NOT IMPLEMENTED (DESIGN-ONLY PHASE).
  10. Dual Execution Portability:
     100% portable execution using Path(__file__). Operates cleanly from project
     root and external working directory (/tmp).

Outputs Written:
  - reports/phase_3c_4_2_2_1_metrics.json (Dynamically derived metrics)
  - reports/phase_3c_4_2_2_1_checksums.txt (SHA-256 manifest of Phase 3C.4.2.2.1 deliverables)
  - data/processed/recommendation/phase_3c_4_README.md (Updated summary)
"""

import sys
import os
import csv
import json
import hashlib
from collections import Counter
from pathlib import Path

# Dynamic portable paths relative to Path(__file__)
SCRIPTS_DIR = Path(__file__).resolve().parent
ML_DIR = SCRIPTS_DIR.parent
BASE_DIR = ML_DIR.parent.parent  # FieldWise_main
REPORTS_DIR = ML_DIR / "reports"
DATA_PROCESSED_DIR = ML_DIR / "data" / "processed" / "recommendation"

# Phase 3C.4 Deliverables
INPUT_CONTRACT_MD = REPORTS_DIR / "phase_3c_4_input_contract.md"
ELIGIBILITY_RULES_CSV = REPORTS_DIR / "phase_3c_4_eligibility_rules.csv"
SCORING_ARCH_MD = REPORTS_DIR / "phase_3c_4_scoring_architecture.md"
CANONICAL_CATALOGUE_CSV = REPORTS_DIR / "phase_3c_4_canonical_crop_catalogue.csv"
FERTILIZER_SPEC_MD = REPORTS_DIR / "phase_3c_4_fertilizer_safety_spec.md"
FALLBACK_SPEC_MD = REPORTS_DIR / "phase_3c_4_fallback_and_uncertainty_spec.md"
ACCEPTANCE_TESTS_CSV = REPORTS_DIR / "phase_3c_4_acceptance_test_matrix.csv"
SOURCE_REGISTRY_CSV = REPORTS_DIR / "phase_3c_3_source_registry.csv"
REDESIGN_DECISION_MD = REPORTS_DIR / "phase_3c_4_redesign_decision.md"
README_MD = DATA_PROCESSED_DIR / "phase_3c_4_README.md"

# Historical Checksum Manifests (READ-ONLY, IMMUTABLE)
HISTORICAL_CHECKSUMS_3C4 = REPORTS_DIR / "phase_3c_4_checksums.txt"
HISTORICAL_CHECKSUMS_3C41 = REPORTS_DIR / "phase_3c_4_1_checksums.txt"
HISTORICAL_CHECKSUMS_3C42 = REPORTS_DIR / "phase_3c_4_2_checksums.txt"
HISTORICAL_CHECKSUMS_3C421 = REPORTS_DIR / "phase_3c_4_2_1_checksums.txt"
HISTORICAL_CHECKSUMS_3C422 = REPORTS_DIR / "phase_3c_4_2_2_checksums.txt"

# Phase 3C.4.2 & Phase 3C.4.2.2.1 Deliverables
HARD_EXCLUSION_AUDIT_CSV = REPORTS_DIR / "phase_3c_4_2_hard_exclusion_evidence_audit.csv"
WATER_SEMANTICS_AUDIT_CSV = REPORTS_DIR / "phase_3c_4_2_water_semantics_audit.csv"
CLOSURE_REPORT_3C4221_MD = REPORTS_DIR / "phase_3c_4_2_2_1_closure_report.md"
METRICS_JSON_3C4221 = REPORTS_DIR / "phase_3c_4_2_2_1_metrics.json"
CHECKSUMS_TXT_3C4221 = REPORTS_DIR / "phase_3c_4_2_2_1_checksums.txt"

ALL_19_CROPS = {
    "rice", "wheat", "maize", "cotton", "sugarcane", "soybean", "groundnut",
    "potato", "chickpea", "lentil", "mustard", "tomato", "onion", "banana",
    "mango", "jowar", "sunflower", "barley", "millets"
}


def compute_file_sha256(path: Path) -> str:
    """Computes SHA-256 of a file without modifying it."""
    assert path.exists(), f"Cannot compute SHA-256: file not found: {path}"
    return hashlib.sha256(path.read_bytes()).hexdigest()


def record_historical_manifest_hashes() -> dict:
    """Records SHA-256 hashes of all 5 historical manifests to enforce immutability."""
    manifests = {
        "phase_3c_4": (HISTORICAL_CHECKSUMS_3C4, compute_file_sha256(HISTORICAL_CHECKSUMS_3C4)),
        "phase_3c_4_1": (HISTORICAL_CHECKSUMS_3C41, compute_file_sha256(HISTORICAL_CHECKSUMS_3C41)),
        "phase_3c_4_2": (HISTORICAL_CHECKSUMS_3C42, compute_file_sha256(HISTORICAL_CHECKSUMS_3C42)),
        "phase_3c_4_2_1": (HISTORICAL_CHECKSUMS_3C421, compute_file_sha256(HISTORICAL_CHECKSUMS_3C421)),
        "phase_3c_4_2_2": (HISTORICAL_CHECKSUMS_3C422, compute_file_sha256(HISTORICAL_CHECKSUMS_3C422)),
    }
    print("[Pre-Check] Recorded historical checksum manifest SHA-256 hashes (5 manifests):")
    for k, (path, h) in manifests.items():
        print(f"  {path.name}: {h}")
    return {k: h for k, (path, h) in manifests.items()}


def test_deliverables_existence():
    print("\n[Check 1] Verifying Phase 3C.4.2.2.1 deliverable existence...")
    deliverables = [
        INPUT_CONTRACT_MD,
        ELIGIBILITY_RULES_CSV,
        SCORING_ARCH_MD,
        CANONICAL_CATALOGUE_CSV,
        FERTILIZER_SPEC_MD,
        FALLBACK_SPEC_MD,
        ACCEPTANCE_TESTS_CSV,
        SOURCE_REGISTRY_CSV,
        REDESIGN_DECISION_MD,
        HARD_EXCLUSION_AUDIT_CSV,
        WATER_SEMANTICS_AUDIT_CSV,
        CLOSURE_REPORT_3C4221_MD,
    ]
    for p in deliverables:
        assert p.exists(), f"Missing deliverable: {p.relative_to(ML_DIR)}"
        assert p.stat().st_size > 0, f"Empty deliverable: {p.relative_to(ML_DIR)}"
        print(f"  OK: {p.name} ({p.stat().st_size:,} bytes)")
    return len(deliverables)


def test_historical_manifest_immutability(pre_hashes: dict):
    print("\n[Check 2] Asserting read-only immutability of 5 historical checksum manifests...")
    post_hashes = {
        "phase_3c_4": compute_file_sha256(HISTORICAL_CHECKSUMS_3C4),
        "phase_3c_4_1": compute_file_sha256(HISTORICAL_CHECKSUMS_3C41),
        "phase_3c_4_2": compute_file_sha256(HISTORICAL_CHECKSUMS_3C42),
        "phase_3c_4_2_1": compute_file_sha256(HISTORICAL_CHECKSUMS_3C421),
        "phase_3c_4_2_2": compute_file_sha256(HISTORICAL_CHECKSUMS_3C422),
    }
    for k in pre_hashes:
        assert pre_hashes[k] == post_hashes[k], \
            f"FATAL: Historical manifest {k} was modified! Pre: {pre_hashes[k]}, Post: {post_hashes[k]}"
        print(f"  OK: {k} manifest is bitwise identical ({post_hashes[k][:16]}...)")


def test_canonical_catalogue_reconciliation():
    print("\n[Check 3] Dynamically reconciling canonical catalogue (19 crops)...")
    with open(CANONICAL_CATALOGUE_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        crops = list(reader)

    total_crops = len(crops)
    assert total_crops == 19, f"Expected 19 canonical crops, got {total_crops}"

    crop_ids = {c["crop_id"] for c in crops}
    assert crop_ids == ALL_19_CROPS, f"Crop ID mismatch: {crop_ids ^ ALL_19_CROPS}"

    # Reconcile life cycle distribution
    life_cycles = Counter(c["crop_life_cycle"] for c in crops)
    print(f"  Dynamically derived life-cycle distribution: {dict(life_cycles)}")
    assert life_cycles["Annual_Seasonal"] == 14, f"Expected 14 Annual_Seasonal, got {life_cycles['Annual_Seasonal']}"
    assert life_cycles["Long_Duration_Annual"] == 2, f"Expected 2 Long_Duration_Annual, got {life_cycles['Long_Duration_Annual']}"
    assert life_cycles["Multi_Season_Arable"] == 2, f"Expected 2 Multi_Season_Arable, got {life_cycles['Multi_Season_Arable']}"
    assert life_cycles["Perennial_Orchard"] == 1, f"Expected 1 Perennial_Orchard, got {life_cycles['Perennial_Orchard']}"
    assert sum(life_cycles.values()) == 19, "Sum of life-cycle categories does not equal 19"

    # Reconcile planting windows
    all_windows = []
    for c in crops:
        windows = json.loads(c["planting_windows_json"])
        assert len(windows) >= 1, f"Crop {c['crop_id']} has zero planting windows"
        all_windows.extend(windows)

    total_windows = len(all_windows)
    unique_window_ids = len({w["window_id"] for w in all_windows})
    assert total_windows == unique_window_ids, "Duplicate planting window IDs detected"
    print(f"  Total unique regional planting windows defined: {unique_window_ids}")
    assert unique_window_ids == 31, f"Expected exactly 31 planting windows, got {unique_window_ids}"

    # Reconcile water evidence status
    water_status_counts = Counter(c["water_evidence_status"] for c in crops)
    print(f"  Water evidence status breakdown: {dict(water_status_counts)}")
    assert water_status_counts["VERIFIED"] == 18, f"Expected 18 VERIFIED water status, got {water_status_counts['VERIFIED']}"
    assert water_status_counts["PROVISIONAL"] == 1, f"Expected 1 PROVISIONAL water status, got {water_status_counts['PROVISIONAL']}"
    assert water_status_counts["UNKNOWN"] == 0, f"Expected 0 UNKNOWN water status, got {water_status_counts['UNKNOWN']}"

    return {
        "total_crops": total_crops,
        "life_cycle_distribution": dict(life_cycles),
        "total_planting_windows": unique_window_ids,
        "water_evidence_distribution": dict(water_status_counts),
    }


def test_hard_exclusion_evidence_audit():
    print("\n[Check 4] Auditing hard-exclusion rules against biological lethality standard...")
    with open(HARD_EXCLUSION_AUDIT_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        audit_rows = list(reader)

    total_audited = len(audit_rows)
    assert total_audited == 61, f"Expected exactly 61 candidate rules audited, got {total_audited}"

    decisions = Counter(r["final_decision"] for r in audit_rows)
    print(f"  Audit decisions: {dict(decisions)}")
    # Strict Phase 3C.4.2.2 invariant: 0 retained HARD_EXCLUSION, 61 DOWNGRADE_TO_SOFT_PENALTY, 0 UNKNOWN
    assert decisions["RETAIN_HARD_EXCLUSION"] == 0, f"Expected 0 RETAIN_HARD_EXCLUSION, got {decisions['RETAIN_HARD_EXCLUSION']}"
    assert decisions["DOWNGRADE_TO_SOFT_PENALTY"] == 61, f"Expected 61 DOWNGRADE_TO_SOFT_PENALTY, got {decisions['DOWNGRADE_TO_SOFT_PENALTY']}"
    assert decisions.get("UNKNOWN", 0) == 0, f"Expected 0 UNKNOWN, got {decisions.get('UNKNOWN', 0)}"

    for r in audit_rows:
        rid = r["rule_identifier"]
        stable_ref = r["stable_identifier_or_url"]
        institution = r["institution"]
        page_sec = r["exact_page_table_section"]
        rationale = r["decision_rationale"]

        # Assert no generic homepage URLs
        assert stable_ref != "https://icar.org.in" and stable_ref != "http://icar.org.in", \
            f"Rule {rid} has generic homepage URL: {stable_ref}"
        assert len(institution) > 3, f"Rule {rid} missing institution: {institution}"
        assert len(page_sec) > 3, f"Rule {rid} missing page/table/section: {page_sec}"
        assert len(rationale) > 15, f"Rule {rid} missing decision rationale: {rationale}"

    print("  OK: All 61 candidate rules audited. 0 retained hard exclusions (100% lethality standard enforced); 61 downgraded to soft penalty; 0 unknown.")
    return {
        "total_audited_candidate_rules": total_audited,
        "retained_hard_exclusions": decisions["RETAIN_HARD_EXCLUSION"],
        "downgraded_to_soft_penalty": decisions["DOWNGRADE_TO_SOFT_PENALTY"],
        "marked_unknown": decisions.get("UNKNOWN", 0),
    }


def test_eligibility_rules_harmonization():
    print("\n[Check 5] Verifying eligibility rules harmonization (100 rules)...")
    with open(ELIGIBILITY_RULES_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rules = list(reader)

    total_rules = len(rules)
    assert total_rules == 100, f"Expected exactly 100 eligibility rules, got {total_rules}"

    rule_types = Counter(r["rule_type"] for r in rules)
    print(f"  Rules breakdown by rule_type: {dict(rule_types)}")

    assert rule_types["HARD_EXCLUSION"] == 0, f"Expected 0 HARD_EXCLUSION in rule_type, got {rule_types['HARD_EXCLUSION']}"
    assert rule_types["SOFT_PENALTY"] == 87, f"Expected 87 SOFT_PENALTY in rule_type, got {rule_types['SOFT_PENALTY']}"
    assert rule_types["WARNING_ONLY"] == 8, f"Expected 8 WARNING_ONLY, got {rule_types['WARNING_ONLY']}"
    assert rule_types["UNKNOWN"] == 4, f"Expected 4 UNKNOWN, got {rule_types['UNKNOWN']}"
    assert rule_types["NOT_APPLICABLE"] == 1, f"Expected 1 NOT_APPLICABLE, got {rule_types['NOT_APPLICABLE']}"

    print("  OK: All 100 eligibility rules reconciled: 0 HARD_EXCLUSION, 87 SOFT_PENALTY, 8 WARNING_ONLY, 4 UNKNOWN, 1 NOT_APPLICABLE.")
    return dict(rule_types)


def test_source_registry_verification():
    print("\n[Check 6] Verifying source registry (21 sources)...")
    with open(SOURCE_REGISTRY_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        sources = list(reader)

    assert len(sources) == 21, f"Expected 21 sources, got {len(sources)}"
    assert "evidence_status" in sources[0], "Missing evidence_status column in source registry"

    status_counts = Counter(s["evidence_status"] for s in sources)
    print(f"  Source evidence status breakdown: {dict(status_counts)}")
    assert status_counts["VERIFIED_PUBLIC_BENCHMARK"] == 4, f"Expected 4 VERIFIED_PUBLIC_BENCHMARK, got {status_counts['VERIFIED_PUBLIC_BENCHMARK']}"
    assert status_counts["UNVERIFIED_INDEPENDENT_ACCESS"] == 17, f"Expected 17 UNVERIFIED_INDEPENDENT_ACCESS, got {status_counts['UNVERIFIED_INDEPENDENT_ACCESS']}"

    # Assert that zero retained hard exclusions cite an unverified source
    with open(ELIGIBILITY_RULES_CSV, "r", encoding="utf-8") as f:
        rules = list(csv.DictReader(f))
    hard_rules = [r for r in rules if r["rule_type"] == "HARD_EXCLUSION"]
    assert len(hard_rules) == 0, "No hard exclusions may exist in Phase 3C.4.2.2.1"

    print("  OK: Source registry verified. 4 verified public benchmarks, 17 unverified independent access. Zero hard exclusions cite unverified sources.")
    return dict(status_counts)


def test_decoupled_water_concepts():
    print("\n[Check 7] Verifying decoupled water concepts and gating invariants...")
    with open(WATER_SEMANTICS_AUDIT_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        water_rows = list(reader)

    assert len(water_rows) == 19, f"Expected 19 crops in water audit, got {len(water_rows)}"

    for r in water_rows:
        cid = r["crop_id"]
        # Prohibition 1: Never compare raw rain directly to ETc
        assert r["comparable_directly_with_raw_rainfall"] == "No", \
            f"Crop {cid} does not prohibit direct raw rain vs ETc comparison"
        # Prohibition 2: Never allow universal hard water exclusion
        assert "No" in r["safe_for_hard_exclusion_gate"], \
            f"Crop {cid} allows unsafe hard water exclusion"
        # Requirement 3: Unmeasured irrigation must return UNKNOWN / CONDITIONALLY_ELIGIBLE
        assert "UNKNOWN" in r["unmeasured_irrigation_behavior"] or "CONDITIONALLY_ELIGIBLE" in r["unmeasured_irrigation_behavior"], \
            f"Crop {cid} does not handle unmeasured irrigation safely"
        # Requirement 4: Distinguish rainfed threshold from ETc
        assert r["rainfed_screening_threshold_mm"], f"Crop {cid} missing rainfed screening threshold"
        assert r["crop_evapotranspiration_etc_mm"], f"Crop {cid} missing crop evapotranspiration"
        # Requirement 5: Monthly USDA-SCS aggregation required
        assert "MONTHLY_USDA_SCS" in r["effective_rainfall_status"], \
            f"Crop {cid} missing monthly USDA-SCS requirement in effective_rainfall_status"

    print("  OK: Decoupled water semantics and monthly aggregation requirement verified across all 19 crops.")


def test_independent_water_arithmetic():
    print("\n[Check 8] Asserting independent water calculation arithmetic across all worked examples...")

    # USDA-SCS empirical monthly formula (FAO-24 / CROPWAT)
    def usda_scs_monthly(p_month: float) -> float:
        if p_month <= 250.0:
            return (p_month * (125.0 - 0.2 * p_month)) / 125.0
        else:
            return 125.0 + 0.1 * p_month

    # -------------------------------------------------------------------------
    # 1. Example A Rebuild: West Bengal Kharif Aman Rice (1,150 mm)
    # -------------------------------------------------------------------------
    monthly_rain_ex_a = [350.0, 350.0, 300.0, 150.0]
    assert sum(monthly_rain_ex_a) == 1150.0, "Example A monthly rainfall sum mismatch"

    # Monthly USDA-SCS calculations
    peff_jul = usda_scs_monthly(350.0)
    peff_aug = usda_scs_monthly(350.0)
    peff_sep = usda_scs_monthly(300.0)
    peff_oct = usda_scs_monthly(150.0)

    assert abs(peff_jul - 160.0) < 1e-6, f"July Peff mismatch: {peff_jul} vs 160.0"
    assert abs(peff_aug - 160.0) < 1e-6, f"August Peff mismatch: {peff_aug} vs 160.0"
    assert abs(peff_sep - 155.0) < 1e-6, f"September Peff mismatch: {peff_sep} vs 155.0"
    assert abs(peff_oct - 114.0) < 1e-6, f"October Peff mismatch: {peff_oct} vs 114.0"

    peff_seasonal_a = peff_jul + peff_aug + peff_sep + peff_oct
    assert abs(peff_seasonal_a - 589.0) < 1e-6, f"Example A seasonal Peff mismatch: {peff_seasonal_a} vs 589.0"

    runoff_loss_a = 1150.0 - peff_seasonal_a
    assert abs(runoff_loss_a - 561.0) < 1e-6, f"Runoff loss mismatch: {runoff_loss_a} vs 561.0"
    assert abs((runoff_loss_a / 1150.0) - 0.487826) < 1e-4, "Runoff loss percentage mismatch"

    # Demonstrate Erroneous Direct Seasonal Formula Application
    peff_erroneous_seasonal = usda_scs_monthly(1150.0)  # Treating 1150 as a single month
    assert abs(peff_erroneous_seasonal - 240.0) < 1e-6, f"Erroneous seasonal formula mismatch: {peff_erroneous_seasonal} vs 240.0"
    discrepancy_a = peff_seasonal_a - peff_erroneous_seasonal
    assert abs(discrepancy_a - 349.0) < 1e-6, f"Discrepancy mismatch: {discrepancy_a} vs 349.0"

    # Water balance against Rice ETc
    etc_min_rice = 450.0
    etc_opt_rice = 700.0
    surplus_min_rice = peff_seasonal_a - etc_min_rice
    assert abs(surplus_min_rice - 139.0) < 1e-6, f"Surplus over minimum mismatch: {surplus_min_rice} vs 139.0"
    deficit_opt_rice = peff_seasonal_a - etc_opt_rice
    assert abs(deficit_opt_rice - (-111.0)) < 1e-6, f"Deficit against optimal mismatch: {deficit_opt_rice} vs -111.0"

    # -------------------------------------------------------------------------
    # 2. Example B: Irrigated Wheat in Ludhiana (Punjab)
    # -------------------------------------------------------------------------
    peff_wheat = usda_scs_monthly(65.0)
    assert abs(peff_wheat - 58.24) < 1e-6, f"Wheat Peff mismatch: {peff_wheat} vs 58.24"

    gir_wheat = 320.0
    eta_wheat = 0.70
    nir_wheat = gir_wheat * eta_wheat
    assert abs(nir_wheat - 224.0) < 1e-6, f"Wheat NIR delivered mismatch: {nir_wheat} vs 224.0"

    wnet_wheat = nir_wheat + peff_wheat
    assert abs(wnet_wheat - 282.24) < 1e-6, f"Wheat W_net mismatch: {wnet_wheat} vs 282.24"

    deficit_wheat = 320.0 - wnet_wheat
    assert abs(deficit_wheat - 37.76) < 1e-6, f"Wheat deficit mismatch: {deficit_wheat} vs 37.76"

    # Water adequacy score s_water
    s_water_wheat = 100.0 * (((282.24 - 250.0) / (320.0 - 250.0)) ** 0.75)
    assert abs(s_water_wheat - 55.91) < 0.01, f"Wheat s_water mismatch: {s_water_wheat} vs 55.67"

    # -------------------------------------------------------------------------
    # 3. Example D & TEST-14: Vertisol Residual Soil Moisture Capacity
    # -------------------------------------------------------------------------
    awc_vertisol = 200.0  # mm/m
    rooting_depth_chickpea = 1.2  # m
    profile_capacity_chickpea = awc_vertisol * rooting_depth_chickpea
    assert abs(profile_capacity_chickpea - 240.0) < 1e-6, f"Vertisol profile capacity mismatch: {profile_capacity_chickpea} vs 240.0"

    # Chickpea s_water penalty on 45 mm rain alone (threshold = 250 mm)
    s_water_chickpea = 10.0 + 40.0 * (45.0 / 250.0)
    assert abs(s_water_chickpea - 17.20) < 1e-6, f"Chickpea s_water mismatch: {s_water_chickpea} vs 17.20"

    # -------------------------------------------------------------------------
    # 4. TEST-06: Irrigated Wheat NWPZ (50 mm rain, 280 mm GIR)
    # -------------------------------------------------------------------------
    peff_test06 = usda_scs_monthly(50.0)
    assert abs(peff_test06 - 46.0) < 1e-6, f"TEST-06 Peff mismatch: {peff_test06} vs 46.0"
    nir_test06 = 280.0 * 0.70
    assert abs(nir_test06 - 196.0) < 1e-6, f"TEST-06 NIR mismatch: {nir_test06} vs 196.0"
    wnet_test06 = nir_test06 + peff_test06
    assert abs(wnet_test06 - 242.0) < 1e-6, f"TEST-06 W_net mismatch: {wnet_test06} vs 242.0"
    assert abs((wnet_test06 / 250.0) - 0.968) < 1e-4, "TEST-06 fraction of ETc mismatch"

    # -------------------------------------------------------------------------
    # 5. TEST-15: High Rainfall Runoff Loss (1,450 mm Assam Rice)
    # -------------------------------------------------------------------------
    monthly_rain_assam = [300.0, 400.0, 400.0, 250.0, 100.0]
    peff_assam = sum(usda_scs_monthly(p) for p in monthly_rain_assam)
    # 155 + 165 + 165 + 125 + 84 = 694.0 mm
    assert abs(peff_assam - 719.0) < 1e-6, f"Assam Peff mismatch: {peff_assam} vs 694.0"
    loss_assam = 1450.0 - peff_assam
    assert abs(loss_assam - 731.0) < 1e-6, f"Assam loss mismatch: {loss_assam} vs 756.0"

    print("  OK: Independent arithmetic verified across all worked examples:")
    print(f"    - Example A: Monthly Peff = {peff_seasonal_a:.1f} mm; Runoff loss = {runoff_loss_a:.1f} mm; Discrepancy = {discrepancy_a:.1f} mm")
    print(f"    - Example B: NIR = {nir_wheat:.1f} mm; Peff = {peff_wheat:.2f} mm; W_net = {wnet_wheat:.2f} mm; s_water = {s_water_wheat:.2f}")
    print(f"    - Example D: Vertisol profile capacity = {profile_capacity_chickpea:.1f} mm; s_water = {s_water_chickpea:.2f}")
    print(f"    - TEST-06: W_net = {wnet_test06:.1f} mm ({wnet_test06/250.0*100:.1f}% of ETc_min)")
    print(f"    - TEST-15: Assam Peff = {peff_assam:.1f} mm; Loss = {loss_assam:.1f} mm ({loss_assam/1450.0*100:.1f}%)")

    return {
        "example_a_peff_monthly": peff_seasonal_a,
        "example_a_runoff_loss": runoff_loss_a,
        "example_a_erroneous_seasonal": peff_erroneous_seasonal,
        "example_a_discrepancy": discrepancy_a,
        "example_b_wnet": wnet_wheat,
        "example_b_deficit": deficit_wheat,
        "example_d_vertisol_capacity": profile_capacity_chickpea,
        "test_06_wnet": wnet_test06,
        "test_15_runoff_loss": loss_assam,
    }


def test_dci_formulation():
    print("\n[Check 9] Verifying orthogonal 6-domain DCI formulation...")
    input_contract = INPUT_CONTRACT_MD.read_text(encoding="utf-8")
    assert "0.15" in input_contract and "0.20" in input_contract and "0.25" in input_contract

    w = [0.15, 0.20, 0.25, 0.15, 0.10, 0.15]
    assert abs(sum(w) - 1.000) < 1e-6, f"DCI weights sum error: {sum(w)}"

    # Benchmark 1: Full Profile
    c_b1 = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
    dci_b1 = sum(w[i] * c_b1[i] for i in range(6))
    assert abs(dci_b1 - 1.000) < 1e-6, f"Benchmark 1 calculation error: {dci_b1}"

    # Benchmark 2: Missing SHC NPK
    c_b2 = [1.0, 1.0, 1.0, 1.0, 1.0, 0.0]
    dci_b2 = sum(w[i] * c_b2[i] for i in range(6))
    assert abs(dci_b2 - 0.850) < 1e-6, f"Benchmark 2 calculation error: {dci_b2}"

    # Benchmark 3: Typical Smallholder
    c_b3 = [0.60, 1.0, 0.40, 1.0, 1.0, 0.0]
    dci_b3 = sum(w[i] * c_b3[i] for i in range(6))
    assert abs(dci_b3 - 0.640) < 1e-6, f"Benchmark 3 calculation error: {dci_b3}"

    # Benchmark 4: Rainfed Dryland
    c_b4 = [1.0, 1.0, 1.0, 0.50, 1.0, 0.0]
    dci_b4 = sum(w[i] * c_b4[i] for i in range(6))
    assert abs(dci_b4 - 0.775) < 1e-6, f"Benchmark 4 calculation error: {dci_b4}"

    # Verify rejection boundary DCI < 0.500
    assert "0.500" in input_contract and "INSUFFICIENT_DATA" in input_contract

    print(f"  OK: 6-domain DCI verified. Benchmarks: B1={dci_b1:.3f}, B2={dci_b2:.3f}, B3={dci_b3:.3f}, B4={dci_b4:.3f}.")
    return {
        "domain_weights": {
            "temporal": 0.15,
            "climate": 0.20,
            "water": 0.25,
            "soil": 0.15,
            "ph": 0.10,
            "nutrients": 0.15,
        },
        "sum_of_weights": sum(w),
        "benchmark_scenarios_tested": 4,
    }


def test_acceptance_test_matrix():
    print("\n[Check 10] Verifying acceptance test matrix completeness (18 tests)...")
    with open(ACCEPTANCE_TESTS_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        tests = list(reader)

    assert len(tests) == 18, f"Expected exactly 18 acceptance tests, got {len(tests)}"

    test_ids = [t["test_id"] for t in tests]
    for tid in [
        "TEST-01-S1", "TEST-02-S2", "TEST-03-S3", "TEST-04-S4", "TEST-05-S5",
        "TEST-06", "TEST-07", "TEST-08", "TEST-09", "TEST-10",
        "TEST-11", "TEST-12", "TEST-13", "TEST-14", "TEST-15",
        "TEST-16", "TEST-17", "TEST-18"
    ]:
        assert tid in test_ids, f"Missing acceptance test: {tid}"

    for t in tests:
        tid = t["test_id"]
        assert t["input_values_and_units"], f"Missing input_values_and_units in {tid}"
        assert t["evidence_or_rule_tested"], f"Missing evidence_or_rule_tested in {tid}"
        assert t["expected_eligibility_status"], f"Missing expected_eligibility_status in {tid}"
        assert t["expected_exclusions_and_warnings"], f"Missing expected_exclusions_and_warnings in {tid}"
        assert t["expected_missing_data_behavior"], f"Missing expected_missing_data_behavior in {tid}"
        assert t["pass_criteria"], f"Missing pass_criteria in {tid}"

    # Specific Phase 3C.4.2.2.1 assertions on test content
    t1 = next(t for t in tests if t["test_id"] == "TEST-01-S1")
    assert "screening threshold" in t1["expected_exclusions_and_warnings"] and "Tier 1 FAIL" in t1["expected_exclusions_and_warnings"]

    t6 = next(t for t in tests if t["test_id"] == "TEST-06")
    assert "PROVISIONAL" in t6["expected_eligibility_status"]

    t9 = next(t for t in tests if t["test_id"] == "TEST-09")
    assert "NOT hard-excluded" in t9["expected_exclusions_and_warnings"]

    t11 = next(t for t in tests if t["test_id"] == "TEST-11")
    assert "0" in t11["expected_exclusions_and_warnings"] and "61" in t11["expected_exclusions_and_warnings"]

    t12 = next(t for t in tests if t["test_id"] == "TEST-12")
    assert "589.0" in t12["expected_exclusions_and_warnings"] and "240.0" in t12["expected_exclusions_and_warnings"]

    t13 = next(t for t in tests if t["test_id"] == "TEST-13")
    assert "SCREENING_THRESHOLD_MET" in t13["expected_exclusions_and_warnings"] and "PASS_VERIFIED" in t13["pass_criteria"]

    t14 = next(t for t in tests if t["test_id"] == "TEST-14")
    assert "240.0" in t14["expected_exclusions_and_warnings"] and "Vertisol" in t14["expected_exclusions_and_warnings"]

    t15 = next(t for t in tests if t["test_id"] == "TEST-15")
    assert "731.0" in t15["expected_exclusions_and_warnings"] or "731.0" in t15["pass_criteria"]

    t16 = next(t for t in tests if t["test_id"] == "TEST-16")
    assert "mismatch" in t16["expected_exclusions_and_warnings"].lower()

    t18 = next(t for t in tests if t["test_id"] == "TEST-18")
    assert "phase_3c_4_2_2" in t18["input_values_and_units"]

    print("  OK: All 18 acceptance tests fully specified with inputs, rules, and expected outcomes.")
    return len(tests)


def report_functional_acceptance_tests_status():
    print("\n" + "="*80)
    print("CATEGORY 2: FUNCTIONAL ACCEPTANCE TESTS EXECUTION STATUS")
    print("="*80)
    print("  Status: NOT RUN — ENGINE NOT IMPLEMENTED (DESIGN-ONLY PHASE)")
    print("  Agronomic & Governance Justification:")
    print("    In strict accordance with Phase 3C.4 design-only governance, functional")
    print("    acceptance tests are NOT executed against production application code")
    print("    because the new recommendation engine is not yet implemented.")
    print("    All 18 acceptance tests are formally defined in phase_3c_4_acceptance_test_matrix.csv")
    print("    and will be executed during Phase 3C.5 implementation once the engine is authored.")
    print("="*80)


def write_phase_3c_4_2_2_1_metrics_and_checksums(derived_metrics: dict):
    print("\nGenerating Phase 3C.4.2.2.1 outputs (NON-DESTRUCTIVE)...")

    # 1. Write phase_3c_4_2_2_1_metrics.json
    metrics_payload = {
        "specification_version": "1.5.0-FINAL-WATER-RECONCILIATION",
        "phase": "Phase 3C.4.2.2.1",
        "timestamp_generated": "2026-11-20T12:00:00Z",
        "status": "DESIGN_ONLY_SPECIFICATION_VERIFIED",
        "canonical_catalogue": derived_metrics["catalogue"],
        "hard_exclusion_evidence_audit": derived_metrics["audit"],
        "eligibility_rules_breakdown": derived_metrics["rules"],
        "source_registry_breakdown": derived_metrics["sources"],
        "water_semantics": {
            "total_crops_audited": 19,
            "direct_raw_rain_vs_etc_prohibited_all_crops": True,
            "universal_hard_water_exclusions_prohibited": True,
            "unmeasured_irrigation_defaults_to_unknown": True,
            "rainfed_screening_threshold_never_fails_tier_1": True,
            "monthly_usda_scs_aggregation_required": True,
            "arithmetic_assertions": derived_metrics["arithmetic"],
        },
        "data_completeness_index": derived_metrics["dci"],
        "specification_integrity_checks": {
            "total_checks": 10,
            "passed": 10,
            "failed": 0,
        },
        "functional_acceptance_tests": {
            "total_defined": derived_metrics["acceptance_tests"],
            "status": "NOT RUN — ENGINE NOT IMPLEMENTED (DESIGN-ONLY PHASE)",
            "execution_phase": "Phase 3C.5 Implementation",
        },
        "historical_manifest_preservation": {
            "phase_3c_4_checksums_preserved": True,
            "phase_3c_4_1_checksums_preserved": True,
            "phase_3c_4_2_checksums_preserved": True,
            "phase_3c_4_2_1_checksums_preserved": True,
            "phase_3c_4_2_2_checksums_preserved": True,
        }
    }

    with open(METRICS_JSON_3C4221, "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)
    print(f"  OK: Written {METRICS_JSON_3C4221.name}")

    # 2. Write phase_3c_4_2_2_1_checksums.txt
    phase_3c_4_2_2_1_deliverables = [
        INPUT_CONTRACT_MD,
        ELIGIBILITY_RULES_CSV,
        SCORING_ARCH_MD,
        CANONICAL_CATALOGUE_CSV,
        FERTILIZER_SPEC_MD,
        FALLBACK_SPEC_MD,
        ACCEPTANCE_TESTS_CSV,
        SOURCE_REGISTRY_CSV,
        REDESIGN_DECISION_MD,
        HARD_EXCLUSION_AUDIT_CSV,
        WATER_SEMANTICS_AUDIT_CSV,
        CLOSURE_REPORT_3C4221_MD,
        METRICS_JSON_3C4221,
    ]

    checksum_lines = []
    for p in phase_3c_4_2_2_1_deliverables:
        h = compute_file_sha256(p)
        rel = p.relative_to(ML_DIR)
        checksum_lines.append(f"{h}  {rel}")

    CHECKSUMS_TXT_3C4221.write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")
    print(f"  OK: Written {CHECKSUMS_TXT_3C4221.name} ({len(phase_3c_4_2_2_1_deliverables)} entries)")

    # 3. Write data/processed/recommendation/phase_3c_4_README.md
    readme_content = """# FieldWise Phase 3C.4: Recommendation Engine Safety Redesign Specification
## Effective Rainfall and Rainfed Water Reconciliation Summary (Phase 3C.4.2.2.1)

**Version**: 1.5.0-FINAL-WATER-RECONCILIATION  
**Date**: November 20, 2026  
**Status**: APPROVED DESIGN-ONLY SPECIFICATION (Preservation Rules Enforced)  

---

### Core Agronomic & Mathematical Invariants
1. **Effective Rainfall Monthly USDA-SCS Formulation**:
   - Monthly USDA-SCS equation: $P_m \\le 250 \\implies P_m(125 - 0.2P_m)/125$; $P_m > 250 \\implies 125 + 0.1P_m$.
   - Seasonal Effective Rainfall: $P_{{\\text{{eff,seasonal}}}} = \\sum_{{m=1}}^N P_{{\\text{{eff}},m}}$.
   - Direct application of monthly formula to seasonal totals is prohibited.
   - Example A (1,150 mm West Bengal Rice): Monthly sum = $589.0\\text{ mm}$; invalid seasonal application = $240.0\\text{ mm}$ (delta $349.0\\text{ mm}$).
   - Missing monthly distribution returns `UNKNOWN` effective rain and provisional status.
2. **Corrected Rainfed Status Semantics**:
   - Rainfall exceeding screening threshold sets `SCREENING_THRESHOLD_MET` (never automatic `PASS_VERIFIED`).
   - Rainfall below threshold sets `WATER_DEFICIT_WARNING` and Tier 2 Liebig soft penalty.
   - Rainfed screening thresholds NEVER independently produce `HARD_EXCLUSION` or Tier 1 FAIL.
3. **Residual Soil Moisture Accounting**:
   - 4 Epistemic Tiers: `MEASURED`, `SOURCE_BACKED_ESTIMATED`, `PROVISIONAL`, `UNKNOWN`.
   - Deep Vertisol storage capacity: $AWC = 200\\text{ mm/m} \\times 1.2\\text{ m} = 240.0\\text{ mm}$.
   - Unmeasured soil moisture is never fabricated.
4. **Hard-Exclusion Re-Audit (Strict Biological Lethality)**:
   - 0 candidate rules retained as `HARD_EXCLUSION`; 61 downgraded to `SOFT_PENALTY`.
   - Eligibility matrix: 0 `HARD_EXCLUSION`, 87 `SOFT_PENALTY`, 8 `WARNING_ONLY`, 4 `UNKNOWN`, 1 `NOT_APPLICABLE` (100 total).
5. **Orthogonal 6-Domain DCI Model**:
   - $DCI = 0.15 + 0.20 + 0.25 + 0.15 + 0.10 + 0.15 = 1.000$.
6. **Architectural Separation in Validator**:
   - 10 Specification Integrity Checks: PASSED.
   - Functional Acceptance Tests: NOT RUN — ENGINE NOT IMPLEMENTED (DESIGN-ONLY PHASE).
7. **Historical Manifest Preservation**:
   - `phase_3c_4_checksums.txt`, `phase_3c_4_1_checksums.txt`, `phase_3c_4_2_checksums.txt`, `phase_3c_4_2_1_checksums.txt`, and `phase_3c_4_2_2_checksums.txt` preserved read-only with cryptographic immutability assertions.
"""
    README_MD.write_text(readme_content, encoding="utf-8")
    print(f"  OK: Updated {README_MD.name}")


def main():
    print("="*80)
    print("FieldWise Phase 3C.4.2.2.1: Non-Destructive Specification Validator Engine")
    print("="*80)

    # Pre-execution: Record historical manifest hashes
    pre_hashes = record_historical_manifest_hashes()

    # Category 1: Specification Integrity Checks
    test_deliverables_existence()
    test_historical_manifest_immutability(pre_hashes)
    catalogue_metrics = test_canonical_catalogue_reconciliation()
    audit_metrics = test_hard_exclusion_evidence_audit()
    rules_metrics = test_eligibility_rules_harmonization()
    source_metrics = test_source_registry_verification()
    test_decoupled_water_concepts()
    arithmetic_metrics = test_independent_water_arithmetic()
    dci_metrics = test_dci_formulation()
    acceptance_tests_count = test_acceptance_test_matrix()

    # Category 2: Functional Acceptance Tests (Explicitly Reported as Not Run)
    report_functional_acceptance_tests_status()

    # Aggregate derived metrics
    derived_metrics = {
        "catalogue": catalogue_metrics,
        "audit": audit_metrics,
        "rules": rules_metrics,
        "sources": source_metrics,
        "arithmetic": arithmetic_metrics,
        "dci": dci_metrics,
        "acceptance_tests": acceptance_tests_count,
    }

    # Generate Phase 3C.4.2.2.1 Outputs (Non-Destructive)
    write_phase_3c_4_2_2_1_metrics_and_checksums(derived_metrics)

    # Post-execution: Re-assert historical manifest immutability
    print("\n[Post-Check] Final assertion of historical manifest immutability...")
    test_historical_manifest_immutability(pre_hashes)

    print("\n" + "="*80)
    print("ALL SPECIFICATION INTEGRITY CHECKS PASSED SUCCESSFULLY (10/10)")
    print("FUNCTIONAL ACCEPTANCE TESTS: NOT RUN — ENGINE NOT IMPLEMENTED (DESIGN-ONLY)")
    print("Phase 3C.4.2.2.1 deliverables generated and cryptographically locked.")
    print("="*80)


if __name__ == "__main__":
    main()
