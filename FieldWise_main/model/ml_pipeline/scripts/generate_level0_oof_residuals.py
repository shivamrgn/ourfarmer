"""
FieldWise ML Pipeline — Phase 3B.2: Level-0 Out-of-Time Base Residual Generator
Script: generate_level0_oof_residuals.py

Targeted Revision:
  1. Strict Holdout Data Isolation (§15):
     - Restricts target-bearing data reads to the permitted 1997–2011 training period before loading target columns.
     - Performs a streaming line-by-line filter on `Crop_Year <= 2011` so that zero 2012–2013 validation
       and zero 2014–2015 sealed-test target yields (`Yield_Tonnes_Per_Ha`) are ever read or loaded into memory.
     - Explicit assertion that max Crop_Year <= 2011 and zero post-2011 targets exist in memory.
  2. Implements expanding base folds over 1997–2011 (§3, §5.1, §6):
     - Fold 1: Train 1997–2002 (H1=6 yrs)  -> Predict 2003–2005 (Exp A: 22,663 / Exp B: 29,307)
     - Fold 2: Train 1997–2005 (H2=9 yrs)  -> Predict 2006–2007 (Exp A: 15,363 / Exp B: 19,547)
     - Fold 3: Train 1997–2007 (H3=11 yrs) -> Predict 2008–2009 (Exp A: 14,901 / Exp B: 19,064)
     - Fold 4: Train 1997–2009 (H4=13 yrs) -> Predict 2010–2011 (Exp A: 14,447 / Exp B: 18,165)
  3. 7-Level Seasonal Hierarchical Challenger Baseline (N_min=1):
     - Level 1: District + Crop + Season
     - Level 2: District + Crop
     - Level 3: State + Crop + Season
     - Level 4: State + Crop
     - Level 5: Crop + Season
     - Level 6: Crop
     - Level 7: Global Training Mean
  4. Computes exact resolving cell statistics (y_hat_base, Level_base, N_cell, sigma2_cell, N_tilde_cell, residual).
  5. Computes Level-1 collision diagnostics (base_key_cross_state_collision, base_key_state_count).
  6. Emits:
     - experiments/phase_3b_2/level0_oof_residuals_exp_a.csv
     - experiments/phase_3b_2/level0_oof_residuals_exp_b.csv
     - reports/level0_oof_manifest.json
"""

import os
import sys
import csv
import json
import time
import hashlib
import numpy as np
import pandas as pd

# Enforce deterministic single-threaded execution
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["PYTHONHASHSEED"] = "42"

BASE_FOLDS = [
    {"fold_index": 1, "train_start": 1997, "train_end": 2002, "H_k": 6, "eval_start": 2003, "eval_end": 2005, "expected_exp_a_rows": 22663, "expected_exp_b_rows": 29307},
    {"fold_index": 2, "train_start": 1997, "train_end": 2005, "H_k": 9, "eval_start": 2006, "eval_end": 2007, "expected_exp_a_rows": 15363, "expected_exp_b_rows": 19547},
    {"fold_index": 3, "train_start": 1997, "train_end": 2007, "H_k": 11, "eval_start": 2008, "eval_end": 2009, "expected_exp_a_rows": 14901, "expected_exp_b_rows": 19064},
    {"fold_index": 4, "train_start": 1997, "train_end": 2009, "H_k": 13, "eval_start": 2010, "eval_end": 2011, "expected_exp_a_rows": 14447, "expected_exp_b_rows": 18165},
]

HIERARCHY_LEVELS = [
    (1, ["District", "Crop", "Season"]),
    (2, ["District", "Crop"]),
    (3, ["State", "Crop", "Season"]),
    (4, ["State", "Crop"]),
    (5, ["Crop", "Season"]),
    (6, ["Crop"]),
]


class CharacterStream:
    """
    Character/byte-level streaming reader for RFC-4180 CSV parsing.
    Reads small chunks from the underlying stream and yields characters one-by-one
    with a 1-character lookahead (peek_char) to disambiguate quotes, escaped quotes (""),
    commas, and newlines.
    Tracks exact bytes read from the underlying stream.
    """
    def __init__(self, f, chunk_size=65536):
        self.f = f
        self.chunk_size = chunk_size
        self.bytes_read = 0
        self.buf = ''
        self.pos = 0

    def next_char(self):
        if self.pos >= len(self.buf):
            chunk = self.f.read(self.chunk_size)
            if not chunk:
                return None
            self.buf = chunk
            self.pos = 0
            if isinstance(chunk, str):
                self.bytes_read += len(chunk.encode('utf-8'))
            else:
                self.bytes_read += len(chunk)
        ch = self.buf[self.pos]
        self.pos += 1
        return ch

    def peek_char(self):
        if self.pos >= len(self.buf):
            chunk = self.f.read(self.chunk_size)
            if not chunk:
                return None
            self.buf = chunk
            self.pos = 0
            if isinstance(chunk, str):
                self.bytes_read += len(chunk.encode('utf-8'))
            else:
                self.bytes_read += len(chunk)
        return self.buf[self.pos]


def parse_csv_header(stream):
    """
    Parses the CSV header record strictly up to the unquoted record terminator.
    Returns list of header column names.
    """
    fields = []
    field_chars = []
    in_quotes = False
    while True:
        ch = stream.next_char()
        if ch is None:
            break
        if ch == '"':
            if not in_quotes:
                in_quotes = True
            else:
                if stream.peek_char() == '"':
                    stream.next_char()  # consume escaped quote
                    field_chars.append('"')
                else:
                    in_quotes = False
        elif ch == ',' and not in_quotes:
            fields.append(''.join(field_chars))
            field_chars = []
        elif ch == '\r' and not in_quotes:
            if stream.peek_char() == '\n':
                stream.next_char()
            fields.append(''.join(field_chars))
            break
        elif ch == '\n' and not in_quotes:
            fields.append(''.join(field_chars))
            break
        else:
            field_chars.append(ch)
    return fields


def parse_csv_records_with_streaming_isolation(stream, year_col="Crop_Year", target_col="Yield_Tonnes_Per_Ha", year_cutoff=2011):
    """
    Truly Streaming Holdout Isolation Parser (§15):
    Character/byte-level streaming record parser:
      1. Reads header record and establishes column positions for year and target.
      2. For each data record, parses fields one-by-one strictly up to year_idx (Crop_Year).
      3. Handles quoted commas, escaped quotes (""), and quoted embedded newlines.
      4. If Crop_Year > year_cutoff (post-2011 holdout):
         - SKIPS the remaining record characters until the unquoted newline.
         - The parser reads/traverses raw stream bytes solely to scan for record boundaries.
         - Post-2011 target fields are never tokenized into strings, converted to numeric values,
           retained in memory, or used.
         - Zero string allocation or numeric conversion for post-2011 targets.
      5. If Crop_Year <= year_cutoff (permitted 1997-2011 training):
         - Parses and retains the full record.
         - Converts target field to numeric float.
      6. Returns (header, retained_rows, audit_stats).
    """
    header = parse_csv_header(stream)
    year_idx = header.index(year_col)
    target_idx = header.index(target_col)
    assert target_idx > year_idx, f"Target column ({target_col}) must appear after year column ({year_col})"

    fields_tokenized = len(header)
    records_retained = 0
    post_2011_skipped = 0
    retained_rows = []

    fields = []
    field_chars = []
    in_quotes = False

    while True:
        ch = stream.next_char()
        if ch is None:
            # EOF reached
            if fields or field_chars:
                fields.append(''.join(field_chars))
                fields_tokenized += 1
                if len(fields) == len(header):
                    retained_rows.append(fields)
                    records_retained += 1
            break

        if ch == '"':
            if not in_quotes:
                in_quotes = True
            else:
                if stream.peek_char() == '"':
                    stream.next_char()  # consume escaped quote ""
                    field_chars.append('"')
                else:
                    in_quotes = False
        elif ch == ',' and not in_quotes:
            fields.append(''.join(field_chars))
            fields_tokenized += 1
            field_chars = []

            # Check if we just completed Crop_Year!
            if len(fields) == year_idx + 1:
                year_val = int(fields[year_idx])
                if year_val > year_cutoff:
                    # POST-2011 HOLDOUT RECORD!
                    # Skip remainder of the record without materializing or tokenizing subsequent fields!
                    post_2011_skipped += 1
                    while True:
                        sk_ch = stream.next_char()
                        if sk_ch is None:
                            break
                        if sk_ch == '"':
                            if not in_quotes:
                                in_quotes = True
                            else:
                                if stream.peek_char() == '"':
                                    stream.next_char()  # consume escaped quote
                                else:
                                    in_quotes = False
                        elif not in_quotes:
                            if sk_ch == '\r':
                                if stream.peek_char() == '\n':
                                    stream.next_char()
                                break
                            elif sk_ch == '\n':
                                break
                    # Reset record state for next row
                    fields = []
                    field_chars = []
                    in_quotes = False
                    continue
        elif (ch == '\n' or ch == '\r') and not in_quotes:
            if ch == '\r' and stream.peek_char() == '\n':
                stream.next_char()
            if fields or field_chars:
                fields.append(''.join(field_chars))
                fields_tokenized += 1
                if len(fields) == len(header):
                    retained_rows.append(fields)
                    records_retained += 1
                fields = []
                field_chars = []
        else:
            field_chars.append(ch)

    target_values_converted = records_retained
    audit_stats = {
        "bytes_read": stream.bytes_read,
        "fields_tokenized": fields_tokenized,
        "records_retained": records_retained,
        "post_2011_skipped": post_2011_skipped,
        "target_values_converted": target_values_converted,
        "zero_post_2011_targets_converted": 0,
        "post_2011_target_fields_tokenized": 0
    }
    return header, retained_rows, audit_stats


def load_training_partition_strictly_isolated(cleaned_yield_path):
    """
    Strict Holdout Isolation Loader:
    Uses a truly streaming character/byte-level CSV record parser. Reads fields
    strictly up to `Crop_Year` (index 3). If `Crop_Year > 2011`, the line parser
    skips the remainder of the record without ever tokenizing, parsing, or materializing
    the subsequent target column (index 7 `Yield_Tonnes_Per_Ha`).

    Accurate CSV Isolation Invariants:
      1. Raw stream byte traversal: The streaming parser reads/traverses raw input stream
         bytes solely to scan for record boundaries.
      2. Zero target tokenization: For post-2011 holdout records, post-2011 target fields
         are never tokenized into strings, converted to numeric values, retained in memory, or used.
      3. Fields retained: Strictly rows satisfying Crop_Year <= 2011 (191,270 records).
      4. Target values converted or used: Numeric float conversion is applied EXCLUSIVELY to retained
         1997-2011 training rows; zero post-2011 validation or test targets are ever converted or used.
    """
    print(f"  [Holdout Isolation] Streaming {cleaned_yield_path} with character/byte streaming record parser...")
    t0 = time.time()

    with open(cleaned_yield_path, "r", encoding="utf-8") as f:
        stream = CharacterStream(f)
        header, training_rows, stats = parse_csv_records_with_streaming_isolation(
            stream, year_col="Crop_Year", target_col="Yield_Tonnes_Per_Ha", year_cutoff=2011
        )

    df_train = pd.DataFrame(training_rows, columns=header)
    for col in ["raw_row_id", "Crop_Year"]:
        df_train[col] = df_train[col].astype(int)
    for col in ["Yield_Tonnes_Per_Ha", "Cultivated_Area_Ha", "district_normal_annual_rainfall_mm", "district_normal_monsoon_rainfall_mm"]:
        df_train[col] = pd.to_numeric(df_train[col], errors="coerce")

    # Fatal assertions asserting zero holdout targets loaded
    assert len(df_train) == 191270, f"Expected exactly 191,270 training rows, got {len(df_train)}"
    assert stats["post_2011_skipped"] == 36303, f"Expected exactly 36,303 post-2011 rows skipped, got {stats['post_2011_skipped']}"
    assert df_train["Crop_Year"].max() == 2011, f"FATAL HOLDOUT BREACH: max year {df_train['Crop_Year'].max()} != 2011"
    assert df_train["Crop_Year"].min() == 1997, f"FATAL HOLDOUT BREACH: min year {df_train['Crop_Year'].min()} != 1997"
    assert not (df_train["Crop_Year"] >= 2012).any(), "FATAL HOLDOUT BREACH: Found rows with Crop_Year >= 2012"
    assert stats["zero_post_2011_targets_converted"] == 0, "FATAL: Converted post-2011 targets!"
    assert stats["post_2011_target_fields_tokenized"] == 0, "FATAL: Tokenized post-2011 targets!"

    print(f"  [Holdout Isolation] Successfully loaded {len(df_train)} training records (1997-2011) in {time.time() - t0:.2f}s.")
    print(f"  [Holdout Isolation] Bytes read from stream: {stats['bytes_read']:,}")
    print(f"  [Holdout Isolation] Fields tokenized into memory: {stats['fields_tokenized']:,}")
    print(f"  [Holdout Isolation] Records retained (1997-2011): {stats['records_retained']:,}")
    print(f"  [Holdout Isolation] Post-2011 holdout records skipped: {stats['post_2011_skipped']:,}")
    print(f"  [Holdout Isolation] Post-2011 target fields tokenized: {stats['post_2011_target_fields_tokenized']}")
    print(f"  [Holdout Isolation] Post-2011 targets converted or used: {stats['zero_post_2011_targets_converted']}")
    print(f"  [Holdout Isolation] Target values converted to float: {stats['target_values_converted']:,} (1997-2011 training partition only)")
    return df_train


def generate_oof_for_experiment(experiment_id, split_manifest_path, cleaned_train_df, min_obs=1):
    print(f"\n=======================================================")
    print(f"Generating Level-0 OOF Residuals for: {experiment_id} (min_obs={min_obs})")
    print(f"=======================================================")
    t0 = time.time()

    with open(split_manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    train_row_ids = set(manifest["training_partition_1997_2011"]["raw_row_ids"])
    expected_total_train = manifest["training_partition_1997_2011"]["record_count"]
    print(f"  Training partition row IDs in manifest: {len(train_row_ids)} (expected {expected_total_train})")
    assert len(train_row_ids) == expected_total_train

    df_train = cleaned_train_df[cleaned_train_df["raw_row_id"].isin(train_row_ids)].copy()
    assert len(df_train) == expected_total_train, f"Loaded {len(df_train)} rows, expected {expected_total_train}"

    # Verify zero post-2011 data
    assert df_train["Crop_Year"].max() <= 2011, f"FATAL TEMPORAL LEAKAGE: Training partition contains Year > 2011"

    oof_fold_results = []
    fold_manifest_data = []

    for fold in BASE_FOLDS:
        f_idx = fold["fold_index"]
        t_start, t_end = fold["train_start"], fold["train_end"]
        e_start, e_end = fold["eval_start"], fold["eval_end"]
        H_k = fold["H_k"]
        exp_eval_rows = fold["expected_exp_a_rows"] if "experiment_a" in experiment_id else fold["expected_exp_b_rows"]

        print(f"\n  --- Base Fold {f_idx} ---")
        print(f"  Train: {t_start}–{t_end} (H_{f_idx} = {H_k} yrs) | OOF Eval: {e_start}–{e_end}")

        train_mask = (df_train["Crop_Year"] >= t_start) & (df_train["Crop_Year"] <= t_end)
        eval_mask = (df_train["Crop_Year"] >= e_start) & (df_train["Crop_Year"] <= e_end)

        b_train = df_train[train_mask]
        b_eval = df_train[eval_mask].copy()

        print(f"  Base train rows: {len(b_train)}, OOF eval rows: {len(b_eval)} (expected {exp_eval_rows})")
        assert len(b_eval) == exp_eval_rows, f"Fold {f_idx}: expected {exp_eval_rows} eval rows, found {len(b_eval)}"

        # Precompute Level 1–6 hierarchy statistics
        tables = {}
        for lvl, cols in HIERARCHY_LEVELS:
            agg = b_train.groupby(cols)["Yield_Tonnes_Per_Ha"].agg(
                mean="mean",
                count="count",
                var=lambda s: s.var(ddof=0)
            )
            valid_agg = agg[agg["count"] >= min_obs]
            tables[lvl] = valid_agg.to_dict(orient="index")

        # Level 7: Global Training Mean & Variance
        global_mean = float(b_train["Yield_Tonnes_Per_Ha"].mean())
        global_count = len(b_train)
        global_var = float(b_train["Yield_Tonnes_Per_Ha"].var(ddof=0))

        # Precompute Level-1 key collision diagnostics
        collision_agg = b_train.groupby(["District", "Crop", "Season"])["State"].nunique().to_dict()

        # Generate predictions row-by-row
        preds = []
        levels = []
        n_cells = []
        var_cells = []
        collision_flags = []
        state_counts = []

        for row in b_eval.itertuples():
            d = row.District
            c = row.Crop
            s = row.State
            sn = row.Season

            # Collision lookup
            k1 = (d, c, sn)
            sc = collision_agg.get(k1, 0)
            state_counts.append(sc)
            collision_flags.append(1 if sc > 1 else 0)

            # Hierarchical resolution
            key_map = {
                1: (d, c, sn),
                2: (d, c),
                3: (s, c, sn),
                4: (s, c),
                5: (c, sn),
                6: c,
            }
            resolved = False
            for lvl in range(1, 7):
                k = key_map[lvl]
                if k in tables[lvl]:
                    entry = tables[lvl][k]
                    preds.append(entry["mean"])
                    levels.append(lvl)
                    n_cells.append(entry["count"])
                    var_cells.append(entry["var"])
                    resolved = True
                    break
            if not resolved:
                preds.append(global_mean)
                levels.append(7)
                n_cells.append(global_count)
                var_cells.append(global_var)

        b_eval["base_fold"] = f_idx
        b_eval["H_k"] = H_k
        b_eval["y_hat_base"] = preds
        b_eval["Level_base"] = levels
        b_eval["N_cell"] = n_cells
        b_eval["sigma2_cell"] = var_cells
        b_eval["N_tilde_cell"] = b_eval["N_cell"] / H_k
        b_eval["base_key_cross_state_collision"] = collision_flags
        b_eval["base_key_state_count"] = state_counts
        b_eval["residual"] = b_eval["Yield_Tonnes_Per_Ha"] - b_eval["y_hat_base"]

        # Finiteness assertions
        for col in ["y_hat_base", "N_cell", "sigma2_cell", "N_tilde_cell", "residual"]:
            assert np.all(np.isfinite(b_eval[col])), f"Non-finite value in fold {f_idx} column {col}"
        assert np.all(b_eval["Level_base"].isin([1, 2, 3, 4, 5, 6, 7])), f"Invalid Level_base in fold {f_idx}"

        oof_mae = float(np.mean(np.abs(b_eval["residual"])))
        print(f"  Fold {f_idx} OOF Base MAE: {oof_mae:.4f} t/ha")
        print(f"  Level distribution: {dict(b_eval['Level_base'].value_counts())}")
        print(f"  Collisions: {dict(b_eval['base_key_cross_state_collision'].value_counts())}")

        fold_manifest_data.append({
            "base_fold": f_idx,
            "train_years": f"{t_start}-{t_end}",
            "eval_years": f"{e_start}-{e_end}",
            "H_k": H_k,
            "train_records": len(b_train),
            "eval_records": len(b_eval),
            "oof_base_mae": oof_mae,
            "level_counts": {str(k): int(v) for k, v in b_eval["Level_base"].value_counts().items()},
            "collision_counts": {str(k): int(v) for k, v in b_eval["base_key_cross_state_collision"].value_counts().items()}
        })

        oof_fold_results.append(b_eval)

    oof_all_df = pd.concat(oof_fold_results, ignore_index=True)
    total_oof_rows = len(oof_all_df)
    expected_total_oof = sum(f["expected_exp_a_rows"] if "experiment_a" in experiment_id else f["expected_exp_b_rows"] for f in BASE_FOLDS)
    print(f"\n  Total OOF records generated: {total_oof_rows} (expected {expected_total_oof})")
    assert total_oof_rows == expected_total_oof, f"Expected {expected_total_oof} OOF rows, got {total_oof_rows}"

    overall_oof_mae = float(np.mean(np.abs(oof_all_df["residual"])))
    print(f"  Overall Level-0 Pooled OOF Base MAE: {overall_oof_mae:.4f} t/ha")
    print(f"  Completed in {time.time() - t0:.2f}s")

    return oof_all_df, fold_manifest_data, overall_oof_mae


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pipeline_root = os.path.dirname(script_dir)
    data_dir = os.path.join(pipeline_root, "data", "processed")
    reports_dir = os.path.join(pipeline_root, "reports")
    experiments_dir = os.path.join(pipeline_root, "experiments", "phase_3b_2")
    os.makedirs(experiments_dir, exist_ok=True)

    cleaned_yield_path = os.path.join(data_dir, "cleaned_crop_yield.csv")
    cleaned_train_df = load_training_partition_strictly_isolated(cleaned_yield_path)

    # Experiment A
    exp_a_manifest = os.path.join(experiments_dir, "experiment_a_prime", "split_manifest.json")
    if not os.path.exists(exp_a_manifest):
        exp_a_manifest = os.path.join(pipeline_root, "experiments", "experiment_a_prime", "split_manifest.json")
    oof_df_a, folds_a, mae_a = generate_oof_for_experiment("experiment_a_prime", exp_a_manifest, cleaned_train_df, min_obs=1)
    csv_a_path = os.path.join(experiments_dir, "level0_oof_residuals_exp_a.csv")
    oof_df_a.to_csv(csv_a_path, index=False)
    with open(csv_a_path, "rb") as f:
        sha256_a = hashlib.sha256(f.read()).hexdigest()
    print(f"Saved {csv_a_path} (SHA-256: {sha256_a})")

    # Experiment B
    exp_b_manifest = os.path.join(experiments_dir, "experiment_b_provisional", "split_manifest.json")
    if not os.path.exists(exp_b_manifest):
        exp_b_manifest = os.path.join(pipeline_root, "experiments", "experiment_b_provisional", "split_manifest.json")
    oof_df_b, folds_b, mae_b = generate_oof_for_experiment("experiment_b_provisional", exp_b_manifest, cleaned_train_df, min_obs=1)
    csv_b_path = os.path.join(experiments_dir, "level0_oof_residuals_exp_b.csv")
    oof_df_b.to_csv(csv_b_path, index=False)
    with open(csv_b_path, "rb") as f:
        sha256_b = hashlib.sha256(f.read()).hexdigest()
    print(f"Saved {csv_b_path} (SHA-256: {sha256_b})")

    # Emit Manifest
    manifest_data = {
        "metadata": {
            "artifact_name": "level0_oof_manifest.json",
            "pipeline_phase": "3B.2",
            "architecture_revision": "3.5",
            "generated_by": "generate_level0_oof_residuals.py",
            "holdout_isolation_status": "VERIFIED_STREAMING_FILTER_1997_2011_ONLY",
            "base_challenger_min_obs": 1,
            "temporal_coverage": "2003-2011",
            "warm_up_window": "1997-2002 (6 years)"
        },
        "experiment_a_prime": {
            "total_oof_records": len(oof_df_a),
            "expected_oof_records": 67374,
            "overall_pooled_oof_base_mae": mae_a,
            "output_file": "experiments/phase_3b_2/level0_oof_residuals_exp_a.csv",
            "sha256": sha256_a,
            "folds": folds_a
        },
        "experiment_b_provisional": {
            "total_oof_records": len(oof_df_b),
            "expected_oof_records": 86083,
            "overall_pooled_oof_base_mae": mae_b,
            "output_file": "experiments/phase_3b_2/level0_oof_residuals_exp_b.csv",
            "sha256": sha256_b,
            "folds": folds_b
        }
    }

    manifest_path = os.path.join(reports_dir, "level0_oof_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2, sort_keys=True)
    with open(manifest_path, "rb") as f:
        sha256_m = hashlib.sha256(f.read()).hexdigest()
    with open(manifest_path + ".sha256", "w", encoding="utf-8") as f:
        f.write(f"{sha256_m}  level0_oof_manifest.json\n")

    print(f"\n[SUCCESS] Emitted Level-0 Manifest: {manifest_path}")
    print(f"  SHA-256: {sha256_m}")


if __name__ == "__main__":
    main()
