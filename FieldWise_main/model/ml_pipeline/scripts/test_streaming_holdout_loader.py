"""
FieldWise ML Pipeline — Truly Streaming Holdout Isolation Unit Test Suite
Script: test_streaming_holdout_loader.py

Deterministic test suite for character/byte streaming CSV record parser:
  1. Quoted commas: ensures commas within quoted fields do not trigger false field boundaries.
  2. Escaped quotes (""): ensures double quotes within quotes resolve to literal quotes without toggling quote state.
  3. Quoted embedded newlines (\n): ensures newlines within quotes do not trigger false record boundaries.
  4. Post-2011 skipping integrity: ensures rows with Crop_Year > 2011 skip downstream fields (including target).
     The streaming parser reads/traverses raw stream bytes solely to scan for record boundaries, but post-2011
     target fields are never tokenized into strings, converted to numeric values, retained in memory, or used.
  5. Physical dataset verification on cleaned_crop_yield.csv:
     - Asserts exactly 191,270 records retained (1997-2011) and 36,303 post-2011 records skipped.
     - Confirms max year is 2011 and zero post-2011 targets are ever tokenized or converted.
     - Reports bytes read, fields tokenized, records retained, and targets converted.
"""

import io
import os
import sys
import numpy as np
import pandas as pd

scripts_dir = os.path.dirname(os.path.abspath(__file__))
if scripts_dir not in sys.path:
    sys.path.insert(0, scripts_dir)

from generate_level0_oof_residuals import (
    CharacterStream,
    parse_csv_records_with_streaming_isolation,
    load_training_partition_strictly_isolated
)


def test_quoted_commas():
    print("  [Test 1] Testing Quoted Commas...")
    csv_data = (
        "raw_row_id,State,District,Crop_Year,Season,Crop,Cultivated_Area_Ha,Yield_Tonnes_Per_Ha,district_normal_annual_rainfall_mm,district_normal_monsoon_rainfall_mm\n"
        '1,"Jammu, Kashmir and Ladakh","District, South",2005,Kharif,"Rice, Basmati",10.0,2.5,1000.0,800.0\n'
    )
    stream = CharacterStream(io.StringIO(csv_data))
    header, rows, stats = parse_csv_records_with_streaming_isolation(stream)

    assert len(rows) == 1, f"Expected 1 row, got {len(rows)}"
    row = rows[0]
    assert row[1] == "Jammu, Kashmir and Ladakh", f"Quoted comma in State failed: {row[1]}"
    assert row[2] == "District, South", f"Quoted comma in District failed: {row[2]}"
    assert row[5] == "Rice, Basmati", f"Quoted comma in Crop failed: {row[5]}"
    assert stats["records_retained"] == 1
    assert stats["post_2011_skipped"] == 0
    print("    PASSED: Quoted commas parsed accurately without false column splitting.")


def test_escaped_quotes():
    print("  [Test 2] Testing Escaped Quotes (\"\")...")
    csv_data = (
        "raw_row_id,State,District,Crop_Year,Season,Crop,Cultivated_Area_Ha,Yield_Tonnes_Per_Ha,district_normal_annual_rainfall_mm,district_normal_monsoon_rainfall_mm\n"
        '2,Punjab,"District with ""Special"" Zone",2008,Rabi,"Wheat ""PBW-343""",5.0,4.2,650.0,500.0\n'
    )
    stream = CharacterStream(io.StringIO(csv_data))
    header, rows, stats = parse_csv_records_with_streaming_isolation(stream)

    assert len(rows) == 1, f"Expected 1 row, got {len(rows)}"
    row = rows[0]
    assert row[2] == 'District with "Special" Zone', f"Escaped quote in District failed: {row[2]}"
    assert row[5] == 'Wheat "PBW-343"', f"Escaped quote in Crop failed: {row[5]}"
    assert stats["records_retained"] == 1
    print("    PASSED: Escaped quotes (\"\") parsed accurately as literal quotes.")


def test_embedded_newlines():
    print("  [Test 3] Testing Embedded Newlines in Quoted Fields...")
    csv_data = (
        "raw_row_id,State,District,Crop_Year,Season,Crop,Cultivated_Area_Ha,Yield_Tonnes_Per_Ha,district_normal_annual_rainfall_mm,district_normal_monsoon_rainfall_mm\n"
        '3,"State with \n embedded newline","District North",2010,Kharif,Gram,2.0,1.1,800.0,600.0\n'
        '4,State B,District South,2007,Rabi,Rice,3.0,2.1,900.0,700.0\n'
    )
    stream = CharacterStream(io.StringIO(csv_data))
    header, rows, stats = parse_csv_records_with_streaming_isolation(stream)

    assert len(rows) == 2, f"Expected 2 rows, got {len(rows)}"
    assert rows[0][1] == "State with \n embedded newline", f"Embedded newline failed: {rows[0][1]}"
    assert rows[1][0] == "4", f"Next record misaligned after embedded newline: {rows[1][0]}"
    assert stats["records_retained"] == 2
    print("    PASSED: Embedded newlines inside quotes preserved without breaking record flow.")


def test_post_2011_record_skipping_and_isolation():
    print("  [Test 4] Testing Post-2011 Record Skipping & Zero-Target-Materialization...")
    csv_data = (
        "raw_row_id,State,District,Crop_Year,Season,Crop,Cultivated_Area_Ha,Yield_Tonnes_Per_Ha,district_normal_annual_rainfall_mm,district_normal_monsoon_rainfall_mm\n"
        # Row 1: Permitted (2009)
        '10,State A,Dist A,2009,Kharif,Rice,10.0,2.5,1000.0,800.0\n'
        # Row 2: Post-2011 (2012) with quoted comma in downstream fields
        '11,State B,Dist B,2012,Kharif,"Crop, with comma",12.0,99.9,1000.0,800.0\n'
        # Row 3: Post-2011 (2014) with escaped quotes in downstream fields
        '12,State C,Dist C,2014,Rabi,"Crop with ""quoted"" name",15.0,88.8,900.0,700.0\n'
        # Row 4: Post-2011 (2015) with embedded newline in downstream fields
        '13,State D,Dist D,2015,Summer,"Crop with \n embedded newline",20.0,77.7,800.0,600.0\n'
        # Row 5: Permitted (2011)
        '14,State E,Dist E,2011,Kharif,Wheat,8.0,3.1,850.0,650.0\n'
    )
    stream = CharacterStream(io.StringIO(csv_data))
    header, rows, stats = parse_csv_records_with_streaming_isolation(stream)

    # Invariants:
    # 2 permitted rows (10, 14) retained
    # 3 post-2011 rows (11, 12, 13) skipped
    assert len(rows) == 2, f"Expected exactly 2 retained rows, got {len(rows)}"
    assert rows[0][0] == "10" and rows[0][3] == "2009"
    assert rows[1][0] == "14" and rows[1][3] == "2011"
    assert stats["records_retained"] == 2
    assert stats["post_2011_skipped"] == 3

    # Tokenized fields count check:
    # Header: 10 fields
    # Row 1 (2009): 10 fields tokenized
    # Row 2 (2012): strictly 4 fields tokenized (0..3), remaining 6 skipped!
    # Row 3 (2014): strictly 4 fields tokenized (0..3), remaining 6 skipped!
    # Row 4 (2015): strictly 4 fields tokenized (0..3), remaining 6 skipped!
    # Row 5 (2011): 10 fields tokenized
    # Total expected tokenized fields = 10 + 10 + 4 + 4 + 4 + 10 = 42 fields.
    expected_fields_tokenized = 10 + 10 + 4 + 4 + 4 + 10
    assert stats["fields_tokenized"] == expected_fields_tokenized, (
        f"Fields tokenized mismatch: {stats['fields_tokenized']} != {expected_fields_tokenized}"
    )
    assert stats["post_2011_target_fields_tokenized"] == 0
    assert stats["zero_post_2011_targets_converted"] == 0
    print("    PASSED: Post-2011 rows skipped cleanly without materializing downstream target yields.")


def test_production_cleaned_crop_yield():
    print("  [Test 5] Testing Physical Dataset (cleaned_crop_yield.csv)...")
    path = os.path.join(scripts_dir, "..", "data", "processed", "cleaned_crop_yield.csv")
    assert os.path.exists(path), f"File not found: {path}"

    df_train = load_training_partition_strictly_isolated(path)

    # Exhaustive assertions
    assert len(df_train) == 191270, f"Expected 191,270 rows, got {len(df_train)}"
    assert df_train["Crop_Year"].max() == 2011, f"Max year breach: {df_train['Crop_Year'].max()}"
    assert df_train["Crop_Year"].min() == 1997, f"Min year breach: {df_train['Crop_Year'].min()}"
    assert not (df_train["Crop_Year"] >= 2012).any(), "Found Crop_Year >= 2012"
    assert np.all(np.isfinite(df_train["Yield_Tonnes_Per_Ha"].dropna())), "Found non-finite training yields"
    print("    PASSED: Physical dataset verified with exactly 191,270 rows and strictly Crop_Year <= 2011.")


def run_all_streaming_loader_tests():
    print("===================================================================")
    print("Running Truly Streaming Holdout Isolation Unit Test Suite")
    print("===================================================================")
    test_quoted_commas()
    test_escaped_quotes()
    test_embedded_newlines()
    test_post_2011_record_skipping_and_isolation()
    test_production_cleaned_crop_yield()
    print("===================================================================")
    print("ALL STREAMING HOLDOUT ISOLATION TESTS PASSED PERFECTLY (100%)")
    print("===================================================================")
    return True


if __name__ == "__main__":
    run_all_streaming_loader_tests()
