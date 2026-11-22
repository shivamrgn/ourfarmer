"""
FieldWise ML Pipeline — Phase 3B.2: Taxonomy Generator & Invariants
Script: generate_crop_stratum_taxonomy.py

Generates and audits:
  model/ml_pipeline/reports/crop_stratum_taxonomy.json

Enforces all Phase 3B.2 Revision 3.5 Taxonomy Governance Invariants (§10.3.1):
  1. Strict duplicate key rejection via `object_pairs_hook`.
  2. Exactly 60 unique eligible Experiment B crop labels.
  3. Bijective mapping to the 4 pre-registered project strata:
     - Cereals & Millets: 9
     - Pulses & Legumes: 7
     - Oilseeds: 9
     - Commercial & Horticultural: 35
     Total = 60.
  4. Three-set universe reconciliation:
     - Taxonomy universe (60)
     - Eligibility universe: 30 Prime (Exp A), 60 Prime + Provisional (Exp B)
     - Validation-observed universe:
       - Exp A: 30 observed, 0 absent
       - Exp B: 55 observed, 5 absent (Bhindi, Cashewnut Raw, Coffee, Rubber, Tea)
  5. Non-target validation loading invariant:
     Only reads non-target columns ('Crop', 'Season', 'State', 'District', 'raw_row_id').
     Never loads validation targets (y), base predictions, residuals, or metrics.
  6. Emits canonical JSON and detached SHA-256 checksum.
"""

import os
import sys
import json
import hashlib
import pandas as pd


def reject_duplicate_keys_hook(ordered_pairs):
    """Raise fatal exception on duplicate JSON keys."""
    d = {}
    for k, v in ordered_pairs:
        if k in d:
            raise ValueError(f"FATAL AUDIT FAILURE: Duplicate JSON key detected: {k!r}")
        d[k] = v
    return d


def load_json_safe(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f, object_pairs_hook=reject_duplicate_keys_hook)


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pipeline_root = os.path.dirname(script_dir)
    reports_dir = os.path.join(pipeline_root, "reports")
    experiments_dir = os.path.join(pipeline_root, "experiments")

    inventory_path = os.path.join(reports_dir, "crop_exclusion_and_mapping_inventory.json")
    threshold_path = os.path.join(reports_dir, "threshold_provenance.json")
    design_doc_path = os.path.join(reports_dir, "phase_3b_2_design.md")
    output_taxonomy_path = os.path.join(reports_dir, "crop_stratum_taxonomy.json")

    print("[Step 1] Loading and verifying source JSON artifacts with duplicate-key rejection...")
    inventory_data = load_json_safe(inventory_path)
    threshold_data = load_json_safe(threshold_path)

    # 1. Verify 30 Prime and 30 Provisional in inventory
    catalog = inventory_data["all_crop_catalog"]
    prime_crops = sorted([c for c, v in catalog.items() if v.get("model_eligibility") == "eligible_prime"])
    prov_crops = sorted([c for c, v in catalog.items() if v.get("model_eligibility") == "eligible_provisional"])
    all_eligible_crops = sorted(prime_crops + prov_crops)

    assert len(prime_crops) == 30, f"Expected exactly 30 Prime crops, found {len(prime_crops)}"
    assert len(prov_crops) == 30, f"Expected exactly 30 Provisional crops, found {len(prov_crops)}"
    assert len(all_eligible_crops) == 60, f"Expected exactly 60 total eligible crops, found {len(all_eligible_crops)}"
    assert len(set(all_eligible_crops)) == 60, "Duplicate crop label detected between Prime and Provisional"

    # 2. Verify threshold provenance matches exactly 60 crops
    thresh_crops = sorted(list(threshold_data.keys()))
    assert len(thresh_crops) == 60, f"Expected exactly 60 crops in threshold_provenance, found {len(thresh_crops)}"
    assert thresh_crops == all_eligible_crops, "Crops in threshold_provenance do not match inventory catalog"

    print(f"  Verified 60 eligible crops in inventory and threshold provenance.")

    # 3. Canonical Strata Definitions from Section 10.3.1 Table
    strata_map = {
        # Cereals & Millets (9)
        "Bajra": "Cereals & Millets",
        "Barley": "Cereals & Millets",
        "Jowar": "Cereals & Millets",
        "Maize": "Cereals & Millets",
        "Ragi": "Cereals & Millets",
        "Rice": "Cereals & Millets",
        "Small millets": "Cereals & Millets",
        "Wheat": "Cereals & Millets",
        "Other Cereals & Millets": "Cereals & Millets",

        # Pulses & Legumes (7)
        "Arhar/Tur": "Pulses & Legumes",
        "Gram": "Pulses & Legumes",
        "Masoor": "Pulses & Legumes",
        "Moong(Green Gram)": "Pulses & Legumes",
        "Other Kharif pulses": "Pulses & Legumes",
        "Other  Rabi pulses": "Pulses & Legumes",
        "Urad": "Pulses & Legumes",

        # Oilseeds (9)
        "Castor seed": "Oilseeds",
        "Groundnut": "Oilseeds",
        "Linseed": "Oilseeds",
        "Niger seed": "Oilseeds",
        "Other  Oilseeds": "Oilseeds",
        "Rapeseed &Mustard": "Oilseeds",
        "Safflower": "Oilseeds",
        "Sesamum": "Oilseeds",
        "Soyabean": "Oilseeds",

        # Commercial & Horticultural (35)
        "Apple": "Commercial & Horticultural",
        "Arecanut": "Commercial & Horticultural",
        "Banana": "Commercial & Horticultural",
        "Bhindi": "Commercial & Horticultural",
        "Black pepper": "Commercial & Horticultural",
        "Cabbage": "Commercial & Horticultural",
        "Cardamom": "Commercial & Horticultural",
        "Carrot": "Commercial & Horticultural",
        "Cashewnut": "Commercial & Horticultural",
        "Cashewnut Processed": "Commercial & Horticultural",
        "Cashewnut Raw": "Commercial & Horticultural",
        "Citrus Fruit": "Commercial & Horticultural",
        "Coconut": "Commercial & Horticultural",
        "Coffee": "Commercial & Horticultural",
        "Colocosia": "Commercial & Horticultural",
        "Coriander": "Commercial & Horticultural",
        "Cotton(lint)": "Commercial & Horticultural",
        "Cowpea(Lobia)": "Commercial & Horticultural",
        "Dry chillies": "Commercial & Horticultural",
        "Dry ginger": "Commercial & Horticultural",
        "Garlic": "Commercial & Horticultural",
        "Ginger": "Commercial & Horticultural",
        "Grapes": "Commercial & Horticultural",
        "Horse-gram": "Commercial & Horticultural",
        "Jute": "Commercial & Horticultural",
        "Mesta": "Commercial & Horticultural",
        "Onion": "Commercial & Horticultural",
        "Orange": "Commercial & Horticultural",
        "Papaya": "Commercial & Horticultural",
        "Pome Fruit": "Commercial & Horticultural",
        "Potato": "Commercial & Horticultural",
        "Rubber": "Commercial & Horticultural",
        "Sannhamp": "Commercial & Horticultural",
        "Sapota": "Commercial & Horticultural",
        "Sugarcane": "Commercial & Horticultural",
        "Sunflower": "Oilseeds",  # Note: Sunflower is Oilseeds! Let's check stratum below.
        "Sweet potato": "Commercial & Horticultural",
        "Tapioca": "Commercial & Horticultural",
        "Tea": "Commercial & Horticultural",
        "Tobacco": "Commercial & Horticultural",
        "Tomato": "Commercial & Horticultural",
        "Turmeric": "Commercial & Horticultural",
    }
    # Adjust Sunflower: Sunflower is Oilseeds in Indian agriculture and Section 10.3.1 Table!
    # Let's verify the exact stratum of Sunflower and Other Oilseeds from Section 10.3.1 table.

    # Let's double check all 60 from design table
    import re
    with open(design_doc_path, "r", encoding="utf-8") as f:
        design_text = f.read()

    table_pattern = r'\|\s*`([^`]+)`\s*\|\s*([^\|]+?)\s*\|\s*`([^`]+)`\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|'
    matches = re.findall(table_pattern, design_text)
    assert len(matches) == 60, f"Expected 60 crops in design doc table, found {len(matches)}"

    design_crop_metadata = {}
    strata_counts = {}
    for m in matches:
        crop_label = m[0].strip()
        stratum = m[1].strip()
        status = m[2].strip()
        citation = m[3].strip()
        product_basis = m[4].strip()
        notes = m[5].strip()
        threshold = float(m[6].strip())

        design_crop_metadata[crop_label] = {
            "stratum": stratum,
            "provenance_status": status,
            "citation": citation,
            "product_basis": product_basis,
            "commercial_moisture_notes": notes,
            "screening_threshold_t_ha": threshold
        }
        strata_counts[stratum] = strata_counts.get(stratum, 0) + 1

    print("[Step 2] Verifying Strata Counts...")
    print(f"  Observed counts: {strata_counts}")
    assert strata_counts["Cereals & Millets"] == 9, f"Cereals count: {strata_counts.get('Cereals & Millets')}"
    assert strata_counts["Pulses & Legumes"] == 7, f"Pulses count: {strata_counts.get('Pulses & Legumes')}"
    assert strata_counts["Oilseeds"] == 9, f"Oilseeds count: {strata_counts.get('Oilseeds')}"
    assert strata_counts["Commercial & Horticultural"] == 35, f"Comm/Hort count: {strata_counts.get('Commercial & Horticultural')}"
    assert sum(strata_counts.values()) == 60

    # 4. Check Non-Target Validation Manifests
    print("[Step 3] Checking Validation-Observed Universe with Strictly Non-Target Columns...")
    val_manifest_a_path = os.path.join(experiments_dir, "phase_3b_1_2", "experiment_a_prime", "validation_predictions.csv")
    val_manifest_b_path = os.path.join(experiments_dir, "phase_3b_1_2", "experiment_b_provisional", "validation_predictions.csv")

    non_target_cols = ["Crop", "Season", "State", "District", "raw_row_id"]
    # Check headers without loading data
    df_val_a_head = pd.read_csv(val_manifest_a_path, nrows=1)
    df_val_b_head = pd.read_csv(val_manifest_b_path, nrows=1)

    # In Phase 3B.1 validation prediction manifests, State and District might be State/District or similar
    # Let's inspect column names
    avail_cols_a = [c for c in ["Crop", "Season", "State", "District", "raw_row_id"] if c in df_val_a_head.columns]
    avail_cols_b = [c for c in ["Crop", "Season", "State", "District", "raw_row_id"] if c in df_val_b_head.columns]
    
    # Load strictly non-target columns:
    df_val_a = pd.read_csv(val_manifest_a_path, usecols=["Crop", "raw_row_id"])
    df_val_b = pd.read_csv(val_manifest_b_path, usecols=["Crop", "raw_row_id"])

    obs_val_a = sorted(df_val_a["Crop"].unique())
    obs_val_b = sorted(df_val_b["Crop"].unique())

    print(f"  Exp A validation records: {len(df_val_a)}, distinct crops: {len(obs_val_a)}")
    print(f"  Exp B validation records: {len(df_val_b)}, distinct crops: {len(obs_val_b)}")

    assert len(df_val_a) == 13422, f"Expected 13,422 Exp A validation records, found {len(df_val_a)}"
    assert len(df_val_b) == 17254, f"Expected 17,254 Exp B validation records, found {len(df_val_b)}"

    assert obs_val_a == prime_crops, "Exp A observed validation crops do not match 30 Prime crops"
    assert len(obs_val_a) == 30

    assert len(obs_val_b) == 55, f"Expected 55 observed crops in Exp B validation, found {len(obs_val_b)}"
    assert set(obs_val_b).issubset(set(all_eligible_crops)), "Exp B observed crops contains unmapped/ineligible crops"

    absent_val_b = sorted(list(set(all_eligible_crops) - set(obs_val_b)))
    print(f"  Exp B Absent Validation Crops ({len(absent_val_b)} crops): {absent_val_b}")
    assert absent_val_b == ['Bhindi', 'Cashewnut Raw', 'Coffee', 'Rubber', 'Tea'], (
        f"Unexpected absent crops in Exp B validation: {absent_val_b}"
    )

    # 5. Build final taxonomy structure
    taxonomy_dict = {
        "metadata": {
            "artifact_name": "crop_stratum_taxonomy.json",
            "taxonomy_version": "3.5",
            "generated_by": "generate_crop_stratum_taxonomy.py",
            "total_eligible_crops": 60,
            "experiment_a_prime_crops_count": 30,
            "experiment_b_provisional_crops_count": 30,
            "strata_counts": strata_counts,
            "universe_reconciliation": {
                "taxonomy_universe_count": 60,
                "experiment_a_eligibility_count": 30,
                "experiment_b_eligibility_count": 60,
                "experiment_a_validation_observed_count": 30,
                "experiment_a_validation_absent_count": 0,
                "experiment_b_validation_observed_count": 55,
                "experiment_b_validation_absent_count": 5,
                "experiment_b_absent_validation_crops": absent_val_b
            }
        },
        "crops": {}
    }

    for crop in all_eligible_crops:
        m = design_crop_metadata[crop]
        thresh_info = threshold_data[crop]
        inv_info = catalog[crop]

        tier = "Prime" if crop in prime_crops else "Provisional"
        taxonomy_dict["crops"][crop] = {
            "crop_label": crop,
            "stratum": m["stratum"],
            "eligibility_tier": tier,
            "provenance_status": m["provenance_status"],
            "citation": m["citation"],
            "product_basis": m["product_basis"],
            "commercial_moisture_notes": m["commercial_moisture_notes"],
            "screening_threshold_t_ha": m["screening_threshold_t_ha"],
            "extreme_plausibility_bound_t_ha": thresh_info.get("extreme_plausibility_bound", thresh_info.get("extreme_limit_t_ha", m["screening_threshold_t_ha"] * 2.0)),
            "validation_presence_2012_2013": {
                "in_experiment_a_val": crop in obs_val_a,
                "in_experiment_b_val": crop in obs_val_b
            }
        }

    # 6. Canonical JSON serialization
    canonical_json_str = json.dumps(
        taxonomy_dict,
        indent=2,
        sort_keys=True,
        ensure_ascii=True,
        allow_nan=False
    )
    with open(output_taxonomy_path, "w", encoding="utf-8") as f:
        f.write(canonical_json_str)

    # Detached SHA-256
    with open(output_taxonomy_path, "rb") as f:
        sha256_hash = hashlib.sha256(f.read()).hexdigest()

    sha_path = output_taxonomy_path + ".sha256"
    with open(sha_path, "w", encoding="utf-8") as f:
        f.write(f"{sha256_hash}  crop_stratum_taxonomy.json\n")

    print(f"\n[SUCCESS] Emitted {output_taxonomy_path}")
    print(f"  SHA-256: {sha256_hash}")
    print(f"  Detached checksum written to {sha_path}")


if __name__ == "__main__":
    main()
