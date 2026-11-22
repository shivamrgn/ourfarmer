// Mock dataset simulating government agricultural data
// In a real project, this would come from ML model predictions

export interface CropData {
  id: string;
  name: string;
  season: 'Kharif' | 'Rabi' | 'Zaid';
  minRainfall: number;
  maxRainfall: number;
  minTemperature: number;
  maxTemperature: number;
  soilTypes: string[];
  nitrogenRange: [number, number];
  phosphorusRange: [number, number];
  potassiumRange: [number, number];
  phRange: [number, number];
  yieldPerHectare: number;
  icon: string;
}

export interface FertilizerRecommendation {
  name: string;
  dosage: string;
  applicationTime: string;
  nutrients: string;
}

export interface PredictionResult {
  crop: CropData;
  confidence: number;
  yieldPrediction: number;
  fertilizers: FertilizerRecommendation[];
}

export const crops: CropData[] = [
  {
    id: 'rice',
    name: 'Rice',
    season: 'Kharif',
    minRainfall: 150,
    maxRainfall: 300,
    minTemperature: 20,
    maxTemperature: 35,
    soilTypes: ['Clay', 'Alluvial', 'Loamy'],
    nitrogenRange: [80, 120],
    phosphorusRange: [40, 60],
    potassiumRange: [40, 60],
    phRange: [5.5, 7.0],
    yieldPerHectare: 4.5,
    icon: '🌾',
  },
  {
    id: 'wheat',
    name: 'Wheat',
    season: 'Rabi',
    minRainfall: 50,
    maxRainfall: 100,
    minTemperature: 10,
    maxTemperature: 25,
    soilTypes: ['Loamy', 'Clay Loam', 'Sandy Loam'],
    nitrogenRange: [100, 150],
    phosphorusRange: [50, 80],
    potassiumRange: [40, 60],
    phRange: [6.0, 7.5],
    yieldPerHectare: 3.5,
    icon: '🌿',
  },
  {
    id: 'maize',
    name: 'Maize',
    season: 'Kharif',
    minRainfall: 80,
    maxRainfall: 150,
    minTemperature: 18,
    maxTemperature: 32,
    soilTypes: ['Sandy Loam', 'Loamy', 'Alluvial'],
    nitrogenRange: [120, 180],
    phosphorusRange: [60, 80],
    potassiumRange: [40, 60],
    phRange: [5.5, 7.5],
    yieldPerHectare: 5.0,
    icon: '🌽',
  },
  {
    id: 'cotton',
    name: 'Cotton',
    season: 'Kharif',
    minRainfall: 60,
    maxRainfall: 110,
    minTemperature: 21,
    maxTemperature: 35,
    soilTypes: ['Black', 'Alluvial', 'Red'],
    nitrogenRange: [60, 100],
    phosphorusRange: [30, 50],
    potassiumRange: [30, 50],
    phRange: [6.0, 8.0],
    yieldPerHectare: 2.0,
    icon: '🌱',
  },
  {
    id: 'sugarcane',
    name: 'Sugarcane',
    season: 'Kharif',
    minRainfall: 150,
    maxRainfall: 250,
    minTemperature: 20,
    maxTemperature: 35,
    soilTypes: ['Loamy', 'Clay Loam', 'Alluvial'],
    nitrogenRange: [150, 250],
    phosphorusRange: [60, 100],
    potassiumRange: [80, 120],
    phRange: [6.0, 7.5],
    yieldPerHectare: 80.0,
    icon: '🎋',
  },
  {
    id: 'soybean',
    name: 'Soybean',
    season: 'Kharif',
    minRainfall: 60,
    maxRainfall: 100,
    minTemperature: 20,
    maxTemperature: 30,
    soilTypes: ['Loamy', 'Black', 'Clay Loam'],
    nitrogenRange: [20, 40],
    phosphorusRange: [60, 80],
    potassiumRange: [40, 60],
    phRange: [6.0, 7.0],
    yieldPerHectare: 2.5,
    icon: '🫘',
  },
  {
    id: 'groundnut',
    name: 'Groundnut',
    season: 'Kharif',
    minRainfall: 50,
    maxRainfall: 100,
    minTemperature: 20,
    maxTemperature: 30,
    soilTypes: ['Sandy Loam', 'Red', 'Alluvial'],
    nitrogenRange: [15, 25],
    phosphorusRange: [40, 60],
    potassiumRange: [30, 50],
    phRange: [5.5, 7.0],
    yieldPerHectare: 2.0,
    icon: '🥜',
  },
  {
    id: 'potato',
    name: 'Potato',
    season: 'Rabi',
    minRainfall: 40,
    maxRainfall: 80,
    minTemperature: 15,
    maxTemperature: 25,
    soilTypes: ['Sandy Loam', 'Loamy', 'Alluvial'],
    nitrogenRange: [150, 200],
    phosphorusRange: [80, 120],
    potassiumRange: [100, 150],
    phRange: [5.0, 6.5],
    yieldPerHectare: 25.0,
    icon: '🥔',
  },
];

export const fertilizers: Record<string, FertilizerRecommendation[]> = {
  rice: [
    { name: 'Urea', dosage: '100-120 kg/ha', applicationTime: 'Split: 50% basal, 25% tillering, 25% panicle', nutrients: 'Nitrogen (46%)' },
    { name: 'DAP', dosage: '50-60 kg/ha', applicationTime: 'Basal application', nutrients: 'N (18%), P (46%)' },
    { name: 'MOP', dosage: '40-50 kg/ha', applicationTime: 'Basal application', nutrients: 'Potassium (60%)' },
  ],
  wheat: [
    { name: 'Urea', dosage: '130-150 kg/ha', applicationTime: 'Split: 50% basal, 25% CRI, 25% booting', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '75 kg/ha', applicationTime: 'Basal application', nutrients: 'P (16%), S (11%)' },
    { name: 'MOP', dosage: '40 kg/ha', applicationTime: 'Basal application', nutrients: 'Potassium (60%)' },
  ],
  maize: [
    { name: 'Urea', dosage: '180-200 kg/ha', applicationTime: 'Split: 33% each at sowing, knee-high, tasseling', nutrients: 'Nitrogen (46%)' },
    { name: 'DAP', dosage: '65 kg/ha', applicationTime: 'Basal application', nutrients: 'N (18%), P (46%)' },
    { name: 'MOP', dosage: '50 kg/ha', applicationTime: 'Basal application', nutrients: 'Potassium (60%)' },
  ],
  cotton: [
    { name: 'Urea', dosage: '80-100 kg/ha', applicationTime: 'Split in 3 doses', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '50 kg/ha', applicationTime: 'Basal application', nutrients: 'P (16%), S (11%)' },
    { name: 'MOP', dosage: '40 kg/ha', applicationTime: 'Basal application', nutrients: 'Potassium (60%)' },
  ],
  sugarcane: [
    { name: 'Urea', dosage: '250-300 kg/ha', applicationTime: 'Split in 3-4 doses', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '100 kg/ha', applicationTime: 'Basal application', nutrients: 'P (16%), S (11%)' },
    { name: 'MOP', dosage: '120 kg/ha', applicationTime: 'Basal application', nutrients: 'Potassium (60%)' },
  ],
  soybean: [
    { name: 'Urea', dosage: '20-25 kg/ha', applicationTime: 'Basal (low due to nitrogen fixation)', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '80 kg/ha', applicationTime: 'Basal application', nutrients: 'P (16%), S (11%)' },
    { name: 'MOP', dosage: '50 kg/ha', applicationTime: 'Basal application', nutrients: 'Potassium (60%)' },
  ],
  groundnut: [
    { name: 'Urea', dosage: '15-20 kg/ha', applicationTime: 'Basal (low due to nitrogen fixation)', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '60 kg/ha', applicationTime: 'Basal application', nutrients: 'P (16%), S (11%)' },
    { name: 'Gypsum', dosage: '200 kg/ha', applicationTime: 'At flowering', nutrients: 'Calcium, Sulfur' },
  ],
  potato: [
    { name: 'Urea', dosage: '200-220 kg/ha', applicationTime: 'Split: 50% basal, 50% earthing up', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '125 kg/ha', applicationTime: 'Basal application', nutrients: 'P (16%), S (11%)' },
    { name: 'MOP', dosage: '150 kg/ha', applicationTime: 'Basal application', nutrients: 'Potassium (60%)' },
  ],
};

export const soilTypes = [
  'Alluvial',
  'Black',
  'Red',
  'Laterite',
  'Clay',
  'Loamy',
  'Sandy Loam',
  'Clay Loam',
];

export const states = [
  'Andhra Pradesh',
  'Bihar',
  'Gujarat',
  'Haryana',
  'Karnataka',
  'Madhya Pradesh',
  'Maharashtra',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Uttar Pradesh',
  'West Bengal',
];

// Prediction algorithm (simplified version of ML model logic)
export function predictCrops(
  rainfall: number,
  temperature: number,
  humidity: number,
  soilType: string,
  nitrogen: number,
  phosphorus: number,
  potassium: number,
  ph: number
): PredictionResult[] {
  const results: PredictionResult[] = [];

  crops.forEach((crop) => {
    let score = 0;
    let factors = 0;

    // Rainfall matching
    if (rainfall >= crop.minRainfall && rainfall <= crop.maxRainfall) {
      score += 25;
    } else {
      const diff = Math.min(
        Math.abs(rainfall - crop.minRainfall),
        Math.abs(rainfall - crop.maxRainfall)
      );
      score += Math.max(0, 25 - diff * 0.2);
    }
    factors++;

    // Temperature matching
    if (temperature >= crop.minTemperature && temperature <= crop.maxTemperature) {
      score += 25;
    } else {
      const diff = Math.min(
        Math.abs(temperature - crop.minTemperature),
        Math.abs(temperature - crop.maxTemperature)
      );
      score += Math.max(0, 25 - diff * 2);
    }
    factors++;

    // Soil type matching
    if (crop.soilTypes.includes(soilType)) {
      score += 20;
    }
    factors++;

    // NPK matching
    if (nitrogen >= crop.nitrogenRange[0] && nitrogen <= crop.nitrogenRange[1]) {
      score += 10;
    }
    if (phosphorus >= crop.phosphorusRange[0] && phosphorus <= crop.phosphorusRange[1]) {
      score += 10;
    }
    if (potassium >= crop.potassiumRange[0] && potassium <= crop.potassiumRange[1]) {
      score += 10;
    }
    factors += 3;

    // pH matching
    if (ph >= crop.phRange[0] && ph <= crop.phRange[1]) {
      score += 10;
    }
    factors++;

    const confidence = Math.min(98, Math.max(10, score));
    const yieldVariation = 0.7 + (confidence / 100) * 0.5;
    const yieldPrediction = crop.yieldPerHectare * yieldVariation;

    if (confidence > 40) {
      results.push({
        crop,
        confidence,
        yieldPrediction: Math.round(yieldPrediction * 10) / 10,
        fertilizers: fertilizers[crop.id] || [],
      });
    }
  });

  return results.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}
