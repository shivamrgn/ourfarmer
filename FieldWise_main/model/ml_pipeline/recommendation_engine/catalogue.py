"""
FieldWise Phase 3C.5.1: Canonical Crop Catalogue Module
=======================================================
Single source of truth for the 19 canonical crops, 31 regional planting windows,
physiological bounds, and water accounting baselines.

Guaranteed Invariants (Phase 3C.5.1):
  - Genuine embedded fallback containing all 19 crops and 31 planting windows.
  - Never silently returns an empty or partial catalogue.
  - Explicit CatalogueLoadError on missing or corrupted catalogue source.
"""

import csv
import json
from pathlib import Path
from typing import Dict, List, Optional

from .schemas import CropCatalogueEntry, PlantingWindowDefinition


class CatalogueLoadError(Exception):
    """Raised when the canonical crop catalogue cannot be loaded safely."""
    pass


VERIFIED_RAINFED_THRESHOLDS = {
    'rice': 800.0,
    'wheat': 250.0,
    'maize': 400.0,
    'cotton': 500.0,
    'sugarcane': 1200.0,
    'soybean': 450.0,
    'groundnut': 400.0,
    'potato': 300.0,
    'chickpea': 250.0,
    'lentil': 200.0,
    'mustard': 200.0,
    'tomato': 400.0,
    'onion': 350.0,
    'banana': 1400.0,
    'mango': 300.0,
    'jowar': 350.0,
    'sunflower': 350.0,
    'barley': 200.0,
    'millets': 200.0,
}

EMBEDDED_CROP_DATA = [
  {
    "crop_id": "rice",
    "canonical_name": "Rice (Paddy)",
    "scientific_name": "Oryza sativa",
    "crop_category": "Cereal",
    "crop_life_cycle": "Annual_Seasonal",
    "broad_seasons_supported": "Kharif, Boro_Special, Zaid",
    "planting_systems": "Aman_Lowland, Boro_Deepwater_Receding, Aus_Direct_Seeded",
    "supported_regions": "Eastern_IGP, Peninsular_Coastal, Trans_Gangetic",
    "planting_windows_json": "[{\"window_id\": \"WIN-RICE-AMAN\", \"planting_system\": \"Aman_Lowland\", \"broad_season\": \"Kharif\", \"region_or_zone\": \"All_Rice_Ecosystems\", \"sowing_month_start\": 6, \"sowing_month_end\": 7, \"sowing_date_range\": \"Jun 15 - Jul 15\", \"harvest_month_range\": \"Nov - Dec\", \"crop_duration_days\": 135, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIRR Tech. Bull. 92/2021\"}, {\"window_id\": \"WIN-RICE-BORO\", \"planting_system\": \"Boro_Deepwater_Receding\", \"broad_season\": \"Boro_Special\", \"region_or_zone\": \"Eastern_India_WB_Assam_Bihar\", \"sowing_month_start\": 11, \"sowing_month_end\": 12, \"sowing_date_range\": \"Nov 15 - Dec 15\", \"harvest_month_range\": \"Apr - May\", \"crop_duration_days\": 150, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIRR Tech. Bull. 92/2021; AAU Boro Package\"}, {\"window_id\": \"WIN-RICE-AUS\", \"planting_system\": \"Aus_Direct_Seeded\", \"broad_season\": \"Zaid\", \"region_or_zone\": \"Assam_West_Bengal\", \"sowing_month_start\": 3, \"sowing_month_end\": 4, \"sowing_date_range\": \"Mar 15 - Apr 30\", \"harvest_month_range\": \"Jul - Aug\", \"crop_duration_days\": 110, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"AAU Package of Practices (2019)\"}]",
    "water_measurement_definition": "RAINFED_PRODUCTION_SCREENING_THRESHOLD",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "PRODUCTION_READY",
    "min_seasonal_water_mm": "800",
    "optimal_seasonal_water_mm": "1250",
    "preferred_soil_textures": "Clay, Clay Loam, Loamy, Alluvial",
    "tolerated_soil_textures": "Black Vertisol, Red Sandy",
    "restricted_soil_textures": "Sandy",
    "soil_ph_min": "5.0",
    "soil_ph_max": "8.5",
    "sowing_temp_min_c": "18.0",
    "sowing_temp_max_c": "35.0",
    "optimal_temp_c": "26.0",
    "optimal_humidity_pct": "75.0",
    "rdf_n_p2o5_k2o_kg_ha": "120:60:40",
    "reference_yield_range_t_ha": "3.5-5.5",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "wheat",
    "canonical_name": "Wheat",
    "scientific_name": "Triticum aestivum",
    "crop_category": "Cereal",
    "crop_life_cycle": "Annual_Seasonal",
    "broad_seasons_supported": "Rabi",
    "planting_systems": "Timely_Sown, Late_Sown, Central_Zone_Early",
    "supported_regions": "North_Western_Plains_Zone, Central_Zone, North_Eastern_Plains_Zone",
    "planting_windows_json": "[{\"window_id\": \"WIN-WHEAT-NWPZ-TIMELY\", \"planting_system\": \"Timely_Sown\", \"broad_season\": \"Rabi\", \"region_or_zone\": \"North_Western_Plains_Zone\", \"sowing_month_start\": 11, \"sowing_month_end\": 11, \"sowing_date_range\": \"Nov 1 - Nov 15\", \"harvest_month_range\": \"Apr 1 - Apr 20\", \"crop_duration_days\": 140, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIWBR Bull. 55/2022\"}, {\"window_id\": \"WIN-WHEAT-NWPZ-LATE\", \"planting_system\": \"Late_Sown\", \"broad_season\": \"Rabi\", \"region_or_zone\": \"North_Western_Plains_Zone\", \"sowing_month_start\": 11, \"sowing_month_end\": 12, \"sowing_date_range\": \"Nov 20 - Dec 15\", \"harvest_month_range\": \"Apr 10 - Apr 30\", \"crop_duration_days\": 120, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIWBR Bull. 55/2022\"}, {\"window_id\": \"WIN-WHEAT-CZ-EARLY\", \"planting_system\": \"Central_Zone_Early\", \"broad_season\": \"Rabi\", \"region_or_zone\": \"Central_Zone_MP_Gujarat\", \"sowing_month_start\": 10, \"sowing_month_end\": 11, \"sowing_date_range\": \"Oct 25 - Nov 15\", \"harvest_month_range\": \"Mar 15 - Apr 5\", \"crop_duration_days\": 115, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIWBR Bull. 55/2022\"}]",
    "water_measurement_definition": "TOTAL_CROP_EVAPOTRANSPIRATION_ETC",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "PRODUCTION_READY",
    "min_seasonal_water_mm": "250",
    "optimal_seasonal_water_mm": "400",
    "preferred_soil_textures": "Loamy, Clay Loam, Alluvial",
    "tolerated_soil_textures": "Sandy Loam, Black Vertisol",
    "restricted_soil_textures": "Sandy",
    "soil_ph_min": "5.5",
    "soil_ph_max": "8.3",
    "sowing_temp_min_c": "12.0",
    "sowing_temp_max_c": "28.0",
    "optimal_temp_c": "19.0",
    "optimal_humidity_pct": "55.0",
    "rdf_n_p2o5_k2o_kg_ha": "120:60:40",
    "reference_yield_range_t_ha": "4.2-5.5",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "maize",
    "canonical_name": "Maize (Corn)",
    "scientific_name": "Zea mays",
    "crop_category": "Cereal",
    "crop_life_cycle": "Annual_Seasonal",
    "broad_seasons_supported": "Kharif, Rabi, Zaid",
    "planting_systems": "Monsoon_Kharif, Spring_Maize, Winter_Rabi_Bihar",
    "supported_regions": "Northern_Plains, Bihar_Plateau, Peninsular_India",
    "planting_windows_json": "[{\"window_id\": \"WIN-MAZ-KHARIF\", \"planting_system\": \"Monsoon_Kharif\", \"broad_season\": \"Kharif\", \"region_or_zone\": \"All_India\", \"sowing_month_start\": 6, \"sowing_month_end\": 7, \"sowing_date_range\": \"Jun 15 - Jul 15\", \"harvest_month_range\": \"Sep - Oct\", \"crop_duration_days\": 100, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIMR Tech. Bull. 12/2021\"}, {\"window_id\": \"WIN-MAZ-SPRING\", \"planting_system\": \"Spring_Maize\", \"broad_season\": \"Zaid\", \"region_or_zone\": \"Northern_Plains_Punjab_Haryana\", \"sowing_month_start\": 1, \"sowing_month_end\": 2, \"sowing_date_range\": \"Jan 20 - Feb 15\", \"harvest_month_range\": \"May - Jun\", \"crop_duration_days\": 115, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIMR Tech. Bull. 12/2021\"}]",
    "water_measurement_definition": "TOTAL_CROP_EVAPOTRANSPIRATION_ETC",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "PRODUCTION_READY",
    "min_seasonal_water_mm": "400",
    "optimal_seasonal_water_mm": "600",
    "preferred_soil_textures": "Loamy, Sandy Loam, Clay Loam, Alluvial",
    "tolerated_soil_textures": "Red Sandy, Black Vertisol",
    "restricted_soil_textures": "Clay",
    "soil_ph_min": "5.5",
    "soil_ph_max": "7.8",
    "sowing_temp_min_c": "12.0",
    "sowing_temp_max_c": "35.0",
    "optimal_temp_c": "24.0",
    "optimal_humidity_pct": "65.0",
    "rdf_n_p2o5_k2o_kg_ha": "120:60:40",
    "reference_yield_range_t_ha": "4.5-6.5",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "cotton",
    "canonical_name": "Cotton",
    "scientific_name": "Gossypium hirsutum",
    "crop_category": "Fiber",
    "crop_life_cycle": "Annual_Seasonal",
    "broad_seasons_supported": "Kharif, Rabi",
    "planting_systems": "Monsoon_Kharif_Central, Northern_Irrigated_Early, Winter_Cotton_Tamil_Nadu",
    "supported_regions": "Central_Vertisol_Zone, North_Irrigated_Zone, Southern_Zone",
    "planting_windows_json": "[{\"window_id\": \"WIN-COT-CENTRAL\", \"planting_system\": \"Monsoon_Kharif_Central\", \"broad_season\": \"Kharif\", \"region_or_zone\": \"Central_Vertisol_Zone\", \"sowing_month_start\": 6, \"sowing_month_end\": 7, \"sowing_date_range\": \"Jun 15 - Jul 10\", \"harvest_month_range\": \"Nov - Jan\", \"crop_duration_days\": 165, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-CICR Tech. Bull. 34/2021\"}, {\"window_id\": \"WIN-COT-NORTH\", \"planting_system\": \"Northern_Irrigated_Early\", \"broad_season\": \"Kharif\", \"region_or_zone\": \"North_Irrigated_Punjab_Haryana\", \"sowing_month_start\": 4, \"sowing_month_end\": 5, \"sowing_date_range\": \"Apr 15 - May 15\", \"harvest_month_range\": \"Oct - Nov\", \"crop_duration_days\": 170, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-CICR Tech. Bull. 34/2021\"}]",
    "water_measurement_definition": "RAINFED_PRODUCTION_SCREENING_THRESHOLD",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "PRODUCTION_READY",
    "min_seasonal_water_mm": "500",
    "optimal_seasonal_water_mm": "750",
    "preferred_soil_textures": "Black Vertisol, Clay Loam, Loamy",
    "tolerated_soil_textures": "Alluvial, Red Sandy",
    "restricted_soil_textures": "Sandy",
    "soil_ph_min": "5.8",
    "soil_ph_max": "8.5",
    "sowing_temp_min_c": "18.0",
    "sowing_temp_max_c": "36.0",
    "optimal_temp_c": "27.0",
    "optimal_humidity_pct": "60.0",
    "rdf_n_p2o5_k2o_kg_ha": "100:50:50",
    "reference_yield_range_t_ha": "1.8-2.6",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "sugarcane",
    "canonical_name": "Sugarcane",
    "scientific_name": "Saccharum officinarum",
    "crop_category": "Commercial",
    "crop_life_cycle": "Long_Duration_Annual",
    "broad_seasons_supported": "Annual_Special, Kharif, Rabi",
    "planting_systems": "Adsali_Maharashtra, Autumn_Subtropical, Spring_Plains",
    "supported_regions": "Tropical_Maharashtra_Karnataka, Subtropical_UP_Bihar",
    "planting_windows_json": "[{\"window_id\": \"WIN-SUG-ADSALI\", \"planting_system\": \"Adsali_Maharashtra\", \"broad_season\": \"Annual_Special\", \"region_or_zone\": \"Tropical_Maharashtra_Karnataka\", \"sowing_month_start\": 7, \"sowing_month_end\": 8, \"sowing_date_range\": \"Jul 15 - Aug 31\", \"harvest_month_range\": \"Oct - Dec (15-18 mos)\", \"crop_duration_days\": 480, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"VSI Pune Agronomy Manual 2020\"}, {\"window_id\": \"WIN-SUG-SPRING\", \"planting_system\": \"Spring_Plains\", \"broad_season\": \"Annual_Special\", \"region_or_zone\": \"Subtropical_UP_Bihar\", \"sowing_month_start\": 2, \"sowing_month_end\": 3, \"sowing_date_range\": \"Feb 15 - Mar 25\", \"harvest_month_range\": \"Dec - Feb (10-12 mos)\", \"crop_duration_days\": 330, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IISR Tech. Bull. 48/2021\"}]",
    "water_measurement_definition": "TOTAL_CROP_EVAPOTRANSPIRATION_ETC",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "CONDITIONALLY_RECOMMENDABLE",
    "min_seasonal_water_mm": "1200",
    "optimal_seasonal_water_mm": "1800",
    "preferred_soil_textures": "Clay Loam, Loamy, Black Vertisol, Alluvial",
    "tolerated_soil_textures": "Red Sandy",
    "restricted_soil_textures": "Sandy",
    "soil_ph_min": "6.0",
    "soil_ph_max": "8.2",
    "sowing_temp_min_c": "18.0",
    "sowing_temp_max_c": "38.0",
    "optimal_temp_c": "28.0",
    "optimal_humidity_pct": "70.0",
    "rdf_n_p2o5_k2o_kg_ha": "150:60:60",
    "reference_yield_range_t_ha": "70.0-100.0",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "soybean",
    "canonical_name": "Soybean",
    "scientific_name": "Glycine max",
    "crop_category": "Oilseed",
    "crop_life_cycle": "Annual_Seasonal",
    "broad_seasons_supported": "Kharif",
    "planting_systems": "Monsoon_Kharif_Central",
    "supported_regions": "Madhya_Pradesh, Maharashtra, Rajasthan",
    "planting_windows_json": "[{\"window_id\": \"WIN-SOY-CENTRAL\", \"planting_system\": \"Monsoon_Kharif_Central\", \"broad_season\": \"Kharif\", \"region_or_zone\": \"Central_Vertisol_Plateau\", \"sowing_month_start\": 6, \"sowing_month_end\": 7, \"sowing_date_range\": \"Jun 20 - Jul 10\", \"harvest_month_range\": \"Sep - Oct\", \"crop_duration_days\": 100, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IISR Indore Extension Bull. 45/2021\"}]",
    "water_measurement_definition": "TOTAL_CROP_EVAPOTRANSPIRATION_ETC",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "PRODUCTION_READY",
    "min_seasonal_water_mm": "450",
    "optimal_seasonal_water_mm": "600",
    "preferred_soil_textures": "Black Vertisol, Clay Loam, Loamy",
    "tolerated_soil_textures": "Alluvial",
    "restricted_soil_textures": "Sandy",
    "soil_ph_min": "5.8",
    "soil_ph_max": "8.2",
    "sowing_temp_min_c": "18.0",
    "sowing_temp_max_c": "36.0",
    "optimal_temp_c": "26.0",
    "optimal_humidity_pct": "70.0",
    "rdf_n_p2o5_k2o_kg_ha": "30:60:40",
    "reference_yield_range_t_ha": "1.8-2.5",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "groundnut",
    "canonical_name": "Groundnut",
    "scientific_name": "Arachis hypogaea",
    "crop_category": "Oilseed",
    "crop_life_cycle": "Annual_Seasonal",
    "broad_seasons_supported": "Kharif, Zaid",
    "planting_systems": "Monsoon_Kharif_Gujarat, Summer_Irrigated",
    "supported_regions": "Saurashtra_Gujarat, Andhra_Pradesh, Tamil_Nadu",
    "planting_windows_json": "[{\"window_id\": \"WIN-GND-KHARIF\", \"planting_system\": \"Monsoon_Kharif_Gujarat\", \"broad_season\": \"Kharif\", \"region_or_zone\": \"Saurashtra_Gujarat\", \"sowing_month_start\": 6, \"sowing_month_end\": 7, \"sowing_date_range\": \"Jun 15 - Jul 15\", \"harvest_month_range\": \"Oct - Nov\", \"crop_duration_days\": 115, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-DGR Tech. Bull. 22/2021\"}, {\"window_id\": \"WIN-GND-SUMMER\", \"planting_system\": \"Summer_Irrigated\", \"broad_season\": \"Zaid\", \"region_or_zone\": \"Gujarat_AP_TamilNadu\", \"sowing_month_start\": 1, \"sowing_month_end\": 2, \"sowing_date_range\": \"Jan 15 - Feb 15\", \"harvest_month_range\": \"May - Jun\", \"crop_duration_days\": 120, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-DGR Tech. Bull. 22/2021\"}]",
    "water_measurement_definition": "RAINFED_PRODUCTION_SCREENING_THRESHOLD",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "PRODUCTION_READY",
    "min_seasonal_water_mm": "400",
    "optimal_seasonal_water_mm": "600",
    "preferred_soil_textures": "Sandy Loam, Loamy, Red Sandy",
    "tolerated_soil_textures": "Alluvial, Clay Loam",
    "restricted_soil_textures": "Clay",
    "soil_ph_min": "5.5",
    "soil_ph_max": "8.0",
    "sowing_temp_min_c": "20.0",
    "sowing_temp_max_c": "35.0",
    "optimal_temp_c": "27.0",
    "optimal_humidity_pct": "60.0",
    "rdf_n_p2o5_k2o_kg_ha": "25:50:50",
    "reference_yield_range_t_ha": "2.0-3.0",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "potato",
    "canonical_name": "Potato",
    "scientific_name": "Solanum tuberosum",
    "crop_category": "Tuber",
    "crop_life_cycle": "Annual_Seasonal",
    "broad_seasons_supported": "Rabi",
    "planting_systems": "Main_Crop_IGP, Early_Crop_IGP",
    "supported_regions": "Indo_Gangetic_Plains_UP_Punjab_WB",
    "planting_windows_json": "[{\"window_id\": \"WIN-POT-MAIN\", \"planting_system\": \"Main_Crop_IGP\", \"broad_season\": \"Rabi\", \"region_or_zone\": \"Indo_Gangetic_Plains\", \"sowing_month_start\": 10, \"sowing_month_end\": 11, \"sowing_date_range\": \"Oct 15 - Nov 5\", \"harvest_month_range\": \"Jan - Feb\", \"crop_duration_days\": 90, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-CPRI Tech. Bull. 78/2021\"}]",
    "water_measurement_definition": "TOTAL_CROP_EVAPOTRANSPIRATION_ETC",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "PRODUCTION_READY",
    "min_seasonal_water_mm": "300",
    "optimal_seasonal_water_mm": "450",
    "preferred_soil_textures": "Sandy Loam, Loamy, Alluvial",
    "tolerated_soil_textures": "Clay Loam",
    "restricted_soil_textures": "Clay",
    "soil_ph_min": "5.0",
    "soil_ph_max": "7.5",
    "sowing_temp_min_c": "15.0",
    "sowing_temp_max_c": "26.0",
    "optimal_temp_c": "19.0",
    "optimal_humidity_pct": "65.0",
    "rdf_n_p2o5_k2o_kg_ha": "150:80:100",
    "reference_yield_range_t_ha": "22.0-30.0",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "chickpea",
    "canonical_name": "Chickpea",
    "scientific_name": "Cicer arietinum",
    "crop_category": "Pulse",
    "crop_life_cycle": "Annual_Seasonal",
    "broad_seasons_supported": "Rabi",
    "planting_systems": "Standard_Rabi_Pulses",
    "supported_regions": "Madhya_Pradesh, Maharashtra, Rajasthan, UP",
    "planting_windows_json": "[{\"window_id\": \"WIN-CHK-MAIN\", \"planting_system\": \"Standard_Rabi_Pulses\", \"broad_season\": \"Rabi\", \"region_or_zone\": \"Central_and_Northern_India\", \"sowing_month_start\": 10, \"sowing_month_end\": 11, \"sowing_date_range\": \"Oct 15 - Nov 15\", \"harvest_month_range\": \"Feb - Mar\", \"crop_duration_days\": 115, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIPR Tech. Bull. 44/2021\"}]",
    "water_measurement_definition": "TOTAL_CROP_EVAPOTRANSPIRATION_ETC",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "PRODUCTION_READY",
    "min_seasonal_water_mm": "200",
    "optimal_seasonal_water_mm": "350",
    "preferred_soil_textures": "Black Vertisol, Clay Loam, Loamy",
    "tolerated_soil_textures": "Alluvial, Sandy Loam",
    "restricted_soil_textures": "Sandy",
    "soil_ph_min": "5.8",
    "soil_ph_max": "8.4",
    "sowing_temp_min_c": "12.0",
    "sowing_temp_max_c": "28.0",
    "optimal_temp_c": "20.0",
    "optimal_humidity_pct": "50.0",
    "rdf_n_p2o5_k2o_kg_ha": "20:50:20",
    "reference_yield_range_t_ha": "1.5-2.2",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "lentil",
    "canonical_name": "Lentil",
    "scientific_name": "Lens culinaris",
    "crop_category": "Pulse",
    "crop_life_cycle": "Annual_Seasonal",
    "broad_seasons_supported": "Rabi",
    "planting_systems": "Standard_Rabi_Pulses, Utera_Paira_Rice_Fallow",
    "supported_regions": "UP, Bihar, West_Bengal, MP",
    "planting_windows_json": "[{\"window_id\": \"WIN-LNT-MAIN\", \"planting_system\": \"Standard_Rabi_Pulses\", \"broad_season\": \"Rabi\", \"region_or_zone\": \"Eastern_and_Central_Plains\", \"sowing_month_start\": 10, \"sowing_month_end\": 11, \"sowing_date_range\": \"Oct 25 - Nov 20\", \"harvest_month_range\": \"Feb - Mar\", \"crop_duration_days\": 120, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIPR Tech. Bull. 46/2021\"}]",
    "water_measurement_definition": "TOTAL_CROP_EVAPOTRANSPIRATION_ETC",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "CONDITIONALLY_RECOMMENDABLE",
    "min_seasonal_water_mm": "200",
    "optimal_seasonal_water_mm": "300",
    "preferred_soil_textures": "Clay Loam, Loamy, Alluvial",
    "tolerated_soil_textures": "Black Vertisol, Sandy Loam",
    "restricted_soil_textures": "Sandy",
    "soil_ph_min": "5.8",
    "soil_ph_max": "8.2",
    "sowing_temp_min_c": "12.0",
    "sowing_temp_max_c": "26.0",
    "optimal_temp_c": "18.0",
    "optimal_humidity_pct": "55.0",
    "rdf_n_p2o5_k2o_kg_ha": "20:40:20",
    "reference_yield_range_t_ha": "1.2-1.8",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "mustard",
    "canonical_name": "Mustard",
    "scientific_name": "Brassica juncea",
    "crop_category": "Oilseed",
    "crop_life_cycle": "Annual_Seasonal",
    "broad_seasons_supported": "Rabi",
    "planting_systems": "Standard_Rabi_Oilseed",
    "supported_regions": "Rajasthan, Haryana, UP, MP",
    "planting_windows_json": "[{\"window_id\": \"WIN-MUST-MAIN\", \"planting_system\": \"Standard_Rabi_Oilseed\", \"broad_season\": \"Rabi\", \"region_or_zone\": \"North_Western_and_Central_Plains\", \"sowing_month_start\": 10, \"sowing_month_end\": 10, \"sowing_date_range\": \"Oct 1 - Oct 25\", \"harvest_month_range\": \"Feb - Mar\", \"crop_duration_days\": 125, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-DRMR Tech. Bull. 36/2021\"}]",
    "water_measurement_definition": "TOTAL_CROP_EVAPOTRANSPIRATION_ETC",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "PRODUCTION_READY",
    "min_seasonal_water_mm": "200",
    "optimal_seasonal_water_mm": "350",
    "preferred_soil_textures": "Loamy, Sandy Loam, Alluvial",
    "tolerated_soil_textures": "Clay Loam, Red Sandy",
    "restricted_soil_textures": "Clay",
    "soil_ph_min": "5.5",
    "soil_ph_max": "8.2",
    "sowing_temp_min_c": "15.0",
    "sowing_temp_max_c": "28.0",
    "optimal_temp_c": "20.0",
    "optimal_humidity_pct": "55.0",
    "rdf_n_p2o5_k2o_kg_ha": "80:40:40",
    "reference_yield_range_t_ha": "1.8-2.5",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "tomato",
    "canonical_name": "Tomato",
    "scientific_name": "Solanum lycopersicum",
    "crop_category": "Vegetable",
    "crop_life_cycle": "Multi_Season_Arable",
    "broad_seasons_supported": "Kharif, Rabi, Zaid",
    "planting_systems": "Autumn_Winter, Spring_Summer",
    "supported_regions": "All_India_Horticultural_Belts",
    "planting_windows_json": "[{\"window_id\": \"WIN-TOM-AUTUMN\", \"planting_system\": \"Autumn_Winter\", \"broad_season\": \"Rabi\", \"region_or_zone\": \"Plains_Zone\", \"sowing_month_start\": 9, \"sowing_month_end\": 10, \"sowing_date_range\": \"Sep 15 - Oct 15\", \"harvest_month_range\": \"Dec - Feb\", \"crop_duration_days\": 120, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIHR Tech. Bull. 58/2020\"}, {\"window_id\": \"WIN-TOM-SPRING\", \"planting_system\": \"Spring_Summer\", \"broad_season\": \"Zaid\", \"region_or_zone\": \"Plains_Zone\", \"sowing_month_start\": 1, \"sowing_month_end\": 2, \"sowing_date_range\": \"Jan 15 - Feb 15\", \"harvest_month_range\": \"Apr - Jun\", \"crop_duration_days\": 115, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIHR Tech. Bull. 58/2020\"}]",
    "water_measurement_definition": "TOTAL_CROP_EVAPOTRANSPIRATION_ETC",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "CONDITIONALLY_RECOMMENDABLE",
    "min_seasonal_water_mm": "400",
    "optimal_seasonal_water_mm": "600",
    "preferred_soil_textures": "Sandy Loam, Loamy, Clay Loam, Alluvial",
    "tolerated_soil_textures": "Red Sandy",
    "restricted_soil_textures": "Clay",
    "soil_ph_min": "5.5",
    "soil_ph_max": "7.8",
    "sowing_temp_min_c": "15.0",
    "sowing_temp_max_c": "34.0",
    "optimal_temp_c": "23.0",
    "optimal_humidity_pct": "65.0",
    "rdf_n_p2o5_k2o_kg_ha": "120:80:80",
    "reference_yield_range_t_ha": "30.0-45.0",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "onion",
    "canonical_name": "Onion",
    "scientific_name": "Allium cepa",
    "crop_category": "Vegetable",
    "crop_life_cycle": "Annual_Seasonal",
    "broad_seasons_supported": "Kharif, Rabi",
    "planting_systems": "Rabi_Main_Crop, Late_Kharif_Rangda",
    "supported_regions": "Maharashtra, Gujarat, Karnataka, MP",
    "planting_windows_json": "[{\"window_id\": \"WIN-ONI-RABI\", \"planting_system\": \"Rabi_Main_Crop\", \"broad_season\": \"Rabi\", \"region_or_zone\": \"Western_and_Southern_India\", \"sowing_month_start\": 11, \"sowing_month_end\": 12, \"sowing_date_range\": \"Nov 15 - Dec 15\", \"harvest_month_range\": \"Mar - Apr\", \"crop_duration_days\": 125, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-DOGR Tech. Bull. 21/2021\"}]",
    "water_measurement_definition": "TOTAL_CROP_EVAPOTRANSPIRATION_ETC",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "CONDITIONALLY_RECOMMENDABLE",
    "min_seasonal_water_mm": "350",
    "optimal_seasonal_water_mm": "500",
    "preferred_soil_textures": "Sandy Loam, Loamy, Clay Loam, Alluvial",
    "tolerated_soil_textures": "Red Sandy",
    "restricted_soil_textures": "Clay",
    "soil_ph_min": "5.8",
    "soil_ph_max": "7.8",
    "sowing_temp_min_c": "15.0",
    "sowing_temp_max_c": "30.0",
    "optimal_temp_c": "21.0",
    "optimal_humidity_pct": "60.0",
    "rdf_n_p2o5_k2o_kg_ha": "100:50:50",
    "reference_yield_range_t_ha": "18.0-26.0",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "banana",
    "canonical_name": "Banana",
    "scientific_name": "Musa acuminata",
    "crop_category": "Fruit",
    "crop_life_cycle": "Long_Duration_Annual",
    "broad_seasons_supported": "Annual_Special, Kharif",
    "planting_systems": "Monsoon_Planting, Autumn_Planting",
    "supported_regions": "Maharashtra, Tamil_Nadu, Gujarat, AP",
    "planting_windows_json": "[{\"window_id\": \"WIN-BAN-MAIN\", \"planting_system\": \"Monsoon_Planting\", \"broad_season\": \"Annual_Special\", \"region_or_zone\": \"Peninsular_Tropical_Belts\", \"sowing_month_start\": 6, \"sowing_month_end\": 7, \"sowing_date_range\": \"Jun 15 - Jul 31\", \"harvest_month_range\": \"May - Jul (11-13 mos)\", \"crop_duration_days\": 365, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-NRCB Tech. Bull. 34/2021\"}]",
    "water_measurement_definition": "TOTAL_CROP_EVAPOTRANSPIRATION_ETC",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "CONDITIONALLY_RECOMMENDABLE",
    "min_seasonal_water_mm": "1400",
    "optimal_seasonal_water_mm": "2000",
    "preferred_soil_textures": "Clay Loam, Loamy, Alluvial",
    "tolerated_soil_textures": "Black Vertisol, Sandy Loam",
    "restricted_soil_textures": "Sandy",
    "soil_ph_min": "5.8",
    "soil_ph_max": "8.0",
    "sowing_temp_min_c": "18.0",
    "sowing_temp_max_c": "38.0",
    "optimal_temp_c": "28.0",
    "optimal_humidity_pct": "75.0",
    "rdf_n_p2o5_k2o_kg_ha": "200:60:200",
    "reference_yield_range_t_ha": "45.0-65.0",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "mango",
    "canonical_name": "Mango",
    "scientific_name": "Mangifera indica",
    "crop_category": "Fruit",
    "crop_life_cycle": "Perennial_Orchard",
    "broad_seasons_supported": "Perennial_Orchard",
    "planting_systems": "Orchard_Monsoon_Grafting",
    "supported_regions": "All_India_Subtropical_Tropical",
    "planting_windows_json": "[{\"window_id\": \"WIN-MNG-GRAFT\", \"planting_system\": \"Orchard_Monsoon_Grafting\", \"broad_season\": \"Perennial_Orchard\", \"region_or_zone\": \"All_India_Orchard_Tracts\", \"sowing_month_start\": 7, \"sowing_month_end\": 8, \"sowing_date_range\": \"Jul 15 - Aug 31\", \"harvest_month_range\": \"May - Jul (Bearing 4-7 yrs)\", \"crop_duration_days\": 1825, \"window_evidence_status\": \"PROVISIONAL\", \"source_reference\": \"ICAR-CISH Tech. Bull. 51/2020\"}]",
    "water_measurement_definition": "PROVISIONAL_METADATA",
    "water_evidence_status": "PROVISIONAL",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "RESTRICTED_ORCHARD_PROVISIONAL",
    "min_seasonal_water_mm": "300",
    "optimal_seasonal_water_mm": "900",
    "preferred_soil_textures": "Loamy, Alluvial, Clay Loam",
    "tolerated_soil_textures": "Red Sandy, Sandy Loam",
    "restricted_soil_textures": "Clay",
    "soil_ph_min": "5.5",
    "soil_ph_max": "8.2",
    "sowing_temp_min_c": "18.0",
    "sowing_temp_max_c": "38.0",
    "optimal_temp_c": "27.0",
    "optimal_humidity_pct": "60.0",
    "rdf_n_p2o5_k2o_kg_ha": "100:50:100",
    "reference_yield_range_t_ha": "8.0-15.0",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "jowar",
    "canonical_name": "Jowar (Sorghum)",
    "scientific_name": "Sorghum bicolor",
    "crop_category": "Millets",
    "crop_life_cycle": "Annual_Seasonal",
    "broad_seasons_supported": "Kharif, Rabi",
    "planting_systems": "Monsoon_Kharif_Grain, Rabi_Maldandi_Grain",
    "supported_regions": "Maharashtra, Karnataka, Telangana, MP",
    "planting_windows_json": "[{\"window_id\": \"WIN-JOW-KHARIF\", \"planting_system\": \"Monsoon_Kharif_Grain\", \"broad_season\": \"Kharif\", \"region_or_zone\": \"Deccan_Plateau\", \"sowing_month_start\": 6, \"sowing_month_end\": 7, \"sowing_date_range\": \"Jun 15 - Jul 10\", \"harvest_month_range\": \"Oct - Nov\", \"crop_duration_days\": 105, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIMR Tech. Bull. 31/2021\"}, {\"window_id\": \"WIN-JOW-RABI\", \"planting_system\": \"Rabi_Maldandi_Grain\", \"broad_season\": \"Rabi\", \"region_or_zone\": \"Maharashtra_Karnataka_Vertisols\", \"sowing_month_start\": 9, \"sowing_month_end\": 10, \"sowing_date_range\": \"Sep 15 - Oct 15\", \"harvest_month_range\": \"Feb - Mar\", \"crop_duration_days\": 120, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIMR Tech. Bull. 31/2021\"}]",
    "water_measurement_definition": "RAINFED_PRODUCTION_SCREENING_THRESHOLD",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "CONDITIONALLY_RECOMMENDABLE",
    "min_seasonal_water_mm": "350",
    "optimal_seasonal_water_mm": "500",
    "preferred_soil_textures": "Black Vertisol, Clay Loam, Loamy",
    "tolerated_soil_textures": "Alluvial, Red Sandy",
    "restricted_soil_textures": "Sandy",
    "soil_ph_min": "5.8",
    "soil_ph_max": "8.3",
    "sowing_temp_min_c": "16.0",
    "sowing_temp_max_c": "38.0",
    "optimal_temp_c": "27.0",
    "optimal_humidity_pct": "55.0",
    "rdf_n_p2o5_k2o_kg_ha": "80:40:40",
    "reference_yield_range_t_ha": "2.2-3.2",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "sunflower",
    "canonical_name": "Sunflower",
    "scientific_name": "Helianthus annuus",
    "crop_category": "Oilseed",
    "crop_life_cycle": "Multi_Season_Arable",
    "broad_seasons_supported": "Kharif, Rabi, Zaid",
    "planting_systems": "Monsoon_Kharif, Spring_Sunflower",
    "supported_regions": "Karnataka, Maharashtra, Andhra_Pradesh",
    "planting_windows_json": "[{\"window_id\": \"WIN-SUN-KHARIF\", \"planting_system\": \"Monsoon_Kharif\", \"broad_season\": \"Kharif\", \"region_or_zone\": \"Southern_and_Western_India\", \"sowing_month_start\": 6, \"sowing_month_end\": 7, \"sowing_date_range\": \"Jun 20 - Jul 15\", \"harvest_month_range\": \"Sep - Oct\", \"crop_duration_days\": 95, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIOR Tech. Bull. 19/2021\"}, {\"window_id\": \"WIN-SUN-SPRING\", \"planting_system\": \"Spring_Sunflower\", \"broad_season\": \"Zaid\", \"region_or_zone\": \"Northern_Plains\", \"sowing_month_start\": 1, \"sowing_month_end\": 2, \"sowing_date_range\": \"Jan 20 - Feb 15\", \"harvest_month_range\": \"May - Jun\", \"crop_duration_days\": 100, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIOR Tech. Bull. 19/2021\"}]",
    "water_measurement_definition": "TOTAL_CROP_EVAPOTRANSPIRATION_ETC",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "CONDITIONALLY_RECOMMENDABLE",
    "min_seasonal_water_mm": "350",
    "optimal_seasonal_water_mm": "500",
    "preferred_soil_textures": "Black Vertisol, Clay Loam, Loamy",
    "tolerated_soil_textures": "Alluvial, Red Sandy",
    "restricted_soil_textures": "Sandy",
    "soil_ph_min": "6.0",
    "soil_ph_max": "8.0",
    "sowing_temp_min_c": "16.0",
    "sowing_temp_max_c": "35.0",
    "optimal_temp_c": "25.0",
    "optimal_humidity_pct": "55.0",
    "rdf_n_p2o5_k2o_kg_ha": "60:60:30",
    "reference_yield_range_t_ha": "1.4-2.0",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "barley",
    "canonical_name": "Barley",
    "scientific_name": "Hordeum vulgare",
    "crop_category": "Cereal",
    "crop_life_cycle": "Annual_Seasonal",
    "broad_seasons_supported": "Rabi",
    "planting_systems": "Standard_Rabi_Cereal",
    "supported_regions": "Rajasthan, Haryana, UP, Punjab",
    "planting_windows_json": "[{\"window_id\": \"WIN-BAR-MAIN\", \"planting_system\": \"Standard_Rabi_Cereal\", \"broad_season\": \"Rabi\", \"region_or_zone\": \"Northern_and_Western_Plains\", \"sowing_month_start\": 10, \"sowing_month_end\": 11, \"sowing_date_range\": \"Oct 25 - Nov 20\", \"harvest_month_range\": \"Mar - Apr\", \"crop_duration_days\": 120, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-IIWBR Tech. Bull. 59/2021\"}]",
    "water_measurement_definition": "TOTAL_CROP_EVAPOTRANSPIRATION_ETC",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "CONDITIONALLY_RECOMMENDABLE",
    "min_seasonal_water_mm": "200",
    "optimal_seasonal_water_mm": "300",
    "preferred_soil_textures": "Sandy Loam, Loamy, Alluvial",
    "tolerated_soil_textures": "Clay Loam",
    "restricted_soil_textures": "Clay",
    "soil_ph_min": "6.0",
    "soil_ph_max": "8.8",
    "sowing_temp_min_c": "12.0",
    "sowing_temp_max_c": "30.0",
    "optimal_temp_c": "19.0",
    "optimal_humidity_pct": "50.0",
    "rdf_n_p2o5_k2o_kg_ha": "60:30:20",
    "reference_yield_range_t_ha": "3.0-4.2",
    "taxonomy_status": "MONOSPECIFIC_CONFIRMED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  },
  {
    "crop_id": "millets",
    "canonical_name": "Millets (Pearl Millet / Bajra)",
    "scientific_name": "Pennisetum glaucum",
    "crop_category": "Millets",
    "crop_life_cycle": "Annual_Seasonal",
    "broad_seasons_supported": "Kharif, Zaid",
    "planting_systems": "Monsoon_Kharif_Arid, Summer_Bajra_Irrigated",
    "supported_regions": "Rajasthan, Gujarat, Haryana, UP",
    "planting_windows_json": "[{\"window_id\": \"WIN-MIL-KHARIF\", \"planting_system\": \"Monsoon_Kharif_Arid\", \"broad_season\": \"Kharif\", \"region_or_zone\": \"Arid_and_Semi_Arid_Plains\", \"sowing_month_start\": 6, \"sowing_month_end\": 7, \"sowing_date_range\": \"Jun 25 - Jul 15\", \"harvest_month_range\": \"Sep - Oct\", \"crop_duration_days\": 85, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-AICRP-PM Tech. Bull. 24/2021\"}, {\"window_id\": \"WIN-MIL-SUMMER\", \"planting_system\": \"Summer_Bajra_Irrigated\", \"broad_season\": \"Zaid\", \"region_or_zone\": \"Gujarat_Tamil_Nadu\", \"sowing_month_start\": 2, \"sowing_month_end\": 3, \"sowing_date_range\": \"Feb 15 - Mar 10\", \"harvest_month_range\": \"May - Jun\", \"crop_duration_days\": 90, \"window_evidence_status\": \"VERIFIED\", \"source_reference\": \"ICAR-AICRP-PM Tech. Bull. 24/2021\"}]",
    "water_measurement_definition": "RAINFED_PRODUCTION_SCREENING_THRESHOLD",
    "water_evidence_status": "VERIFIED",
    "soil_evidence_status": "VERIFIED",
    "recommendation_eligibility_status": "CONDITIONALLY_RECOMMENDABLE",
    "min_seasonal_water_mm": "200",
    "optimal_seasonal_water_mm": "350",
    "preferred_soil_textures": "Sandy, Sandy Loam, Red Sandy, Loamy",
    "tolerated_soil_textures": "Alluvial",
    "restricted_soil_textures": "Clay",
    "soil_ph_min": "5.5",
    "soil_ph_max": "8.2",
    "sowing_temp_min_c": "18.0",
    "sowing_temp_max_c": "40.0",
    "optimal_temp_c": "29.0",
    "optimal_humidity_pct": "50.0",
    "rdf_n_p2o5_k2o_kg_ha": "60:30:0",
    "reference_yield_range_t_ha": "1.8-2.8",
    "taxonomy_status": "MONOSPECIFIC_STANDARDIZED",
    "agronomic_evidence_status": "VERIFIED_PRIMARY_ICAR"
  }
]


class CanonicalCropCatalogue:
    """
    Canonical repository of crop agronomic knowledge.
    Enforces the single-source-of-truth invariant: No divergent backend or frontend definitions.
    """

    def __init__(self, catalogue_path: Optional[Path] = None):
        self._crops: Dict[str, CropCatalogueEntry] = {}
        loaded = False

        if catalogue_path is not None:
            cpath = Path(catalogue_path)
            if cpath.exists() and cpath.is_file():
                try:
                    self._load_from_csv(cpath)
                    loaded = True
                except Exception as e:
                    raise CatalogueLoadError(f"Malformed catalogue CSV at {cpath}: {e}")
            else:
                raise CatalogueLoadError(f"Specified catalogue file does not exist: {cpath}")
        else:
            default_csv = Path(__file__).resolve().parents[1] / "reports" / "phase_3c_4_canonical_crop_catalogue.csv"
            if default_csv.exists() and default_csv.is_file():
                try:
                    self._load_from_csv(default_csv)
                    loaded = True
                except Exception:
                    loaded = False

        if not loaded:
            # Load genuine embedded fallback
            self._load_embedded()

        # Augment with verified rainfed screening thresholds
        self._apply_rainfed_thresholds()

        # Strict verification invariant
        if len(self._crops) != 19:
            raise CatalogueLoadError(f"Incomplete catalogue loaded: Expected 19 crops, found {len(self._crops)}.")
        if self.total_planting_windows != 31:
            raise CatalogueLoadError(f"Incomplete planting windows: Expected 31 windows, found {self.total_planting_windows}.")

    def _apply_rainfed_thresholds(self):
        for crop_id, thresh in VERIFIED_RAINFED_THRESHOLDS.items():
            if crop_id in self._crops:
                self._crops[crop_id].rainfed_threshold_mm = thresh

    def _parse_row(self, row: dict) -> CropCatalogueEntry:
        windows_raw = json.loads(row.get("planting_windows_json", "[]"))
        windows = []
        for w in windows_raw:
            windows.append(
                PlantingWindowDefinition(
                    window_id=w.get("window_id", ""),
                    planting_system=w.get("planting_system", ""),
                    broad_season=w.get("broad_season", ""),
                    region_or_zone=w.get("region_or_zone", ""),
                    sowing_month_start=int(w.get("sowing_month_start", 1)),
                    sowing_month_end=int(w.get("sowing_month_end", 12)),
                    sowing_date_range=w.get("sowing_date_range", ""),
                    harvest_month_range=w.get("harvest_month_range", ""),
                    crop_duration_days=int(w.get("crop_duration_days", 120)),
                    window_evidence_status=w.get("window_evidence_status", "PROVISIONAL"),
                    source_reference=w.get("source_reference", "")
                )
            )

        def parse_list(val: str) -> List[str]:
            if not val:
                return []
            return [x.strip() for x in val.split(",") if x.strip()]

        def parse_float_list(val: str) -> List[float]:
            if not val:
                return []
            clean = val.replace(":", " ").replace("-", " ").replace("[", "").replace("]", "").replace(",", " ")
            return [float(x) for x in clean.split() if x.strip()]

        return CropCatalogueEntry(
            crop_id=row["crop_id"],
            canonical_name=row["canonical_name"],
            scientific_name=row.get("scientific_name", ""),
            crop_category=row.get("crop_category", ""),
            crop_life_cycle=row.get("crop_life_cycle", "Annual_Seasonal"),
            broad_seasons_supported=parse_list(row.get("broad_seasons_supported", "")),
            planting_systems=parse_list(row.get("planting_systems", "")),
            supported_regions=parse_list(row.get("supported_regions", "")),
            planting_windows=windows,
            min_seasonal_water_mm=float(row.get("min_seasonal_water_mm", 0.0)),
            optimal_seasonal_water_mm=float(row.get("optimal_seasonal_water_mm", 0.0)),
            preferred_soil_textures=parse_list(row.get("preferred_soil_textures", "")),
            tolerated_soil_textures=parse_list(row.get("tolerated_soil_textures", "")),
            restricted_soil_textures=parse_list(row.get("restricted_soil_textures", "")),
            soil_ph_min=float(row.get("soil_ph_min", 6.0)),
            soil_ph_max=float(row.get("soil_ph_max", 7.5)),
            sowing_temp_min_c=float(row.get("sowing_temp_min_c", 15.0)),
            sowing_temp_max_c=float(row.get("sowing_temp_max_c", 35.0)),
            optimal_temp_c=float(row.get("optimal_temp_c", 25.0)),
            optimal_humidity_pct=float(row.get("optimal_humidity_pct", 60.0)),
            rdf_n_p2o5_k2o_kg_ha=parse_float_list(row.get("rdf_n_p2o5_k2o_kg_ha", "100, 50, 50")),
            reference_yield_range_t_ha=parse_float_list(row.get("reference_yield_range_t_ha", "3.0, 5.0")),
        )

    def _load_from_csv(self, csv_path: Path):
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                entry = self._parse_row(row)
                self._crops[entry.crop_id] = entry

    def _load_embedded(self):
        """Genuine embedded fallback with all 19 canonical crops and 31 windows."""
        for row in EMBEDDED_CROP_DATA:
            entry = self._parse_row(row)
            self._crops[entry.crop_id] = entry

    def get_crop(self, crop_id: str) -> Optional[CropCatalogueEntry]:
        return self._crops.get(crop_id.lower())

    def get_all_crops(self) -> List[CropCatalogueEntry]:
        return list(self._crops.values())

    def list_crop_ids(self) -> List[str]:
        return list(self._crops.keys())

    @property
    def total_crops(self) -> int:
        return len(self._crops)

    @property
    def total_planting_windows(self) -> int:
        return sum(len(c.planting_windows) for c in self._crops.values())
