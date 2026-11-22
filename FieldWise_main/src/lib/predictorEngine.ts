export interface CropData {
  id: string;
  name: string;
  season: string;
  minRainfall: number;
  maxRainfall: number;
  minTemperature: number;
  maxTemperature: number;
  minHumidity: number;
  maxHumidity: number;
  soilTypes: string[];
  nitrogenRange: [number, number];
  phosphorusRange: [number, number];
  potassiumRange: [number, number];
  phRange: [number, number];
  yieldPerHectare: number;
  icon: string;
  description: string;
}

export interface FertilizerRec {
  name: string;
  dosage: string;
  applicationTime: string;
  nutrients: string;
}

export interface CropPredictionResult {
  crop: CropData;
  confidence: number;
  yieldPrediction: number;
  scoreBreakdown: {
    rainfall: number;
    temperature: number;
    humidity: number;
    soil: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    phBonus: number;
  };
  fertilizers: FertilizerRec[];
}

export interface PredictionInputs {
  rainfall: number;
  temperature: number;
  humidity: number;
  soilType: string;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  state?: string;
}

export const CROPS: CropData[] = [
  {
    id: 'rice',
    name: 'Rice (Paddy)',
    season: 'Kharif',
    minRainfall: 150, maxRainfall: 300,
    minTemperature: 20, maxTemperature: 35,
    minHumidity: 70, maxHumidity: 95,
    soilTypes: ['Clay', 'Alluvial', 'Loamy', 'Clay Loam'],
    nitrogenRange: [80, 120],
    phosphorusRange: [40, 60],
    potassiumRange: [40, 60],
    phRange: [5.5, 7.0],
    yieldPerHectare: 4.5,
    icon: '🌾',
    description: 'Major Kharif staple crop, requires high water availability and standing irrigation',
  },
  {
    id: 'wheat',
    name: 'Wheat',
    season: 'Rabi',
    minRainfall: 50, maxRainfall: 100,
    minTemperature: 10, maxTemperature: 25,
    minHumidity: 40, maxHumidity: 70,
    soilTypes: ['Loamy', 'Clay Loam', 'Sandy Loam', 'Alluvial'],
    nitrogenRange: [100, 150],
    phosphorusRange: [50, 80],
    potassiumRange: [40, 60],
    phRange: [6.0, 7.5],
    yieldPerHectare: 3.5,
    icon: '🌿',
    description: 'Primary Rabi staple crop of North and Central India, thrives in cool winters',
  },
  {
    id: 'maize',
    name: 'Maize (Corn)',
    season: 'Kharif',
    minRainfall: 80, maxRainfall: 150,
    minTemperature: 18, maxTemperature: 32,
    minHumidity: 50, maxHumidity: 80,
    soilTypes: ['Sandy Loam', 'Loamy', 'Alluvial'],
    nitrogenRange: [120, 180],
    phosphorusRange: [60, 80],
    potassiumRange: [40, 60],
    phRange: [5.5, 7.5],
    yieldPerHectare: 5.0,
    icon: '🌽',
    description: 'High-yield multipurpose cereal crop used for human food, poultry feed and starch',
  },
  {
    id: 'cotton',
    name: 'Cotton',
    season: 'Kharif',
    minRainfall: 60, maxRainfall: 110,
    minTemperature: 21, maxTemperature: 35,
    minHumidity: 40, maxHumidity: 70,
    soilTypes: ['Black', 'Alluvial', 'Red', 'Clay'],
    nitrogenRange: [60, 100],
    phosphorusRange: [30, 50],
    potassiumRange: [30, 50],
    phRange: [6.0, 8.0],
    yieldPerHectare: 2.2,
    icon: '☁️',
    description: 'Major cash crop known as White Gold, requires deep moisture-retentive black soil',
  },
  {
    id: 'sugarcane',
    name: 'Sugarcane',
    season: 'Annual',
    minRainfall: 120, maxRainfall: 250,
    minTemperature: 20, maxTemperature: 35,
    minHumidity: 60, maxHumidity: 85,
    soilTypes: ['Loamy', 'Clay Loam', 'Alluvial', 'Black'],
    nitrogenRange: [150, 250],
    phosphorusRange: [60, 90],
    potassiumRange: [60, 120],
    phRange: [6.5, 7.5],
    yieldPerHectare: 70.0,
    icon: '🎋',
    description: 'Long-duration cash crop requiring heavy feeding and reliable year-round irrigation',
  },
  {
    id: 'soybean',
    name: 'Soybean',
    season: 'Kharif',
    minRainfall: 65, maxRainfall: 100,
    minTemperature: 20, maxTemperature: 30,
    minHumidity: 55, maxHumidity: 80,
    soilTypes: ['Black', 'Loamy', 'Clay Loam'],
    nitrogenRange: [20, 40],
    phosphorusRange: [60, 80],
    potassiumRange: [40, 60],
    phRange: [6.0, 7.5],
    yieldPerHectare: 2.0,
    icon: '🫘',
    description: 'Protein and oilseed powerhouse legume that enriches soil through nitrogen fixation',
  },
  {
    id: 'groundnut',
    name: 'Groundnut (Peanut)',
    season: 'Kharif',
    minRainfall: 50, maxRainfall: 90,
    minTemperature: 22, maxTemperature: 32,
    minHumidity: 50, maxHumidity: 75,
    soilTypes: ['Sandy Loam', 'Red', 'Loamy'],
    nitrogenRange: [20, 40],
    phosphorusRange: [40, 60],
    potassiumRange: [30, 50],
    phRange: [6.0, 7.0],
    yieldPerHectare: 2.5,
    icon: '🥜',
    description: 'Subterranean oilseed legume ideal for well-drained sandy loam soils',
  },
  {
    id: 'potato',
    name: 'Potato',
    season: 'Rabi',
    minRainfall: 40, maxRainfall: 70,
    minTemperature: 15, maxTemperature: 24,
    minHumidity: 60, maxHumidity: 80,
    soilTypes: ['Sandy Loam', 'Loamy', 'Alluvial'],
    nitrogenRange: [120, 180],
    phosphorusRange: [80, 100],
    potassiumRange: [100, 150],
    phRange: [5.2, 6.5],
    yieldPerHectare: 25.0,
    icon: '🥔',
    description: 'High-calorie tuber crop responsive to cool night temperatures and balanced potash',
  },
  {
    id: 'chickpea',
    name: 'Chickpea (Gram)',
    season: 'Rabi',
    minRainfall: 30, maxRainfall: 60,
    minTemperature: 15, maxTemperature: 25,
    minHumidity: 30, maxHumidity: 60,
    soilTypes: ['Sandy Loam', 'Loamy', 'Clay Loam', 'Black'],
    nitrogenRange: [20, 30],
    phosphorusRange: [40, 60],
    potassiumRange: [20, 30],
    phRange: [6.0, 8.0],
    yieldPerHectare: 1.8,
    icon: '🧆',
    description: 'Key pulse crop of rainfed areas, very drought-tolerant and soil-enhancing',
  },
  {
    id: 'lentil',
    name: 'Lentil (Masoor)',
    season: 'Rabi',
    minRainfall: 30, maxRainfall: 50,
    minTemperature: 12, maxTemperature: 22,
    minHumidity: 40, maxHumidity: 65,
    soilTypes: ['Loamy', 'Clay Loam', 'Alluvial'],
    nitrogenRange: [20, 30],
    phosphorusRange: [30, 50],
    potassiumRange: [20, 30],
    phRange: [6.0, 7.5],
    yieldPerHectare: 1.2,
    icon: '🥣',
    description: 'Quick maturing cool-season pulse requiring low moisture and minimal inputs',
  },
  {
    id: 'mustard',
    name: 'Mustard (Rapeseed)',
    season: 'Rabi',
    minRainfall: 25, maxRainfall: 50,
    minTemperature: 10, maxTemperature: 22,
    minHumidity: 40, maxHumidity: 65,
    soilTypes: ['Loamy', 'Sandy Loam', 'Alluvial'],
    nitrogenRange: [60, 90],
    phosphorusRange: [30, 50],
    potassiumRange: [20, 40],
    phRange: [6.0, 7.5],
    yieldPerHectare: 1.6,
    icon: '🌼',
    description: 'Leading winter oilseed with high sulphur demand for pungent oil synthesis',
  },
  {
    id: 'tomato',
    name: 'Tomato',
    season: 'Annual',
    minRainfall: 40, maxRainfall: 80,
    minTemperature: 18, maxTemperature: 28,
    minHumidity: 50, maxHumidity: 75,
    soilTypes: ['Sandy Loam', 'Loamy', 'Red', 'Alluvial'],
    nitrogenRange: [100, 150],
    phosphorusRange: [60, 80],
    potassiumRange: [60, 100],
    phRange: [6.0, 7.0],
    yieldPerHectare: 35.0,
    icon: '🍅',
    description: 'High-value horticulture vegetable crop yielding consistent cash returns with proper staking',
  },
  {
    id: 'onion',
    name: 'Onion',
    season: 'Rabi',
    minRainfall: 35, maxRainfall: 75,
    minTemperature: 13, maxTemperature: 25,
    minHumidity: 45, maxHumidity: 70,
    soilTypes: ['Sandy Loam', 'Loamy', 'Alluvial'],
    nitrogenRange: [80, 120],
    phosphorusRange: [50, 70],
    potassiumRange: [80, 100],
    phRange: [6.0, 7.5],
    yieldPerHectare: 20.0,
    icon: '🧅',
    description: 'Shallow rooted bulb crop that demands friable soil and steady potassium levels',
  },
  {
    id: 'sunflower',
    name: 'Sunflower',
    season: 'Zaid',
    minRainfall: 50, maxRainfall: 80,
    minTemperature: 20, maxTemperature: 30,
    minHumidity: 40, maxHumidity: 70,
    soilTypes: ['Black', 'Loamy', 'Sandy Loam'],
    nitrogenRange: [60, 80],
    phosphorusRange: [40, 60],
    potassiumRange: [30, 40],
    phRange: [6.5, 8.0],
    yieldPerHectare: 1.8,
    icon: '🌻',
    description: 'Hardy photo-insensitive oilseed crop suitable for intercropping and summer cultivation',
  },
  {
    id: 'barley',
    name: 'Barley',
    season: 'Rabi',
    minRainfall: 20, maxRainfall: 50,
    minTemperature: 8, maxTemperature: 20,
    minHumidity: 30, maxHumidity: 60,
    soilTypes: ['Sandy Loam', 'Loamy', 'Clay Loam'],
    nitrogenRange: [40, 60],
    phosphorusRange: [20, 30],
    potassiumRange: [15, 25],
    phRange: [6.5, 8.5],
    yieldPerHectare: 3.0,
    icon: '🌾',
    description: 'Highly salinity-tolerant cereal crop grown for malting, animal feed and forage',
  },
  {
    id: 'millets',
    name: 'Millets (Bajra / Jowar)',
    season: 'Kharif',
    minRainfall: 20, maxRainfall: 60,
    minTemperature: 25, maxTemperature: 38,
    minHumidity: 30, maxHumidity: 65,
    soilTypes: ['Sandy Loam', 'Red', 'Black', 'Laterite'],
    nitrogenRange: [40, 80],
    phosphorusRange: [20, 40],
    potassiumRange: [20, 40],
    phRange: [5.5, 8.0],
    yieldPerHectare: 2.2,
    icon: '🌾',
    description: 'Climate-resilient super grain thriving in arid and semi-arid conditions with low water footprint',
  },
];

export const FERTILIZERS: Record<string, FertilizerRec[]> = {
  rice: [
    { name: 'Urea', dosage: '100–120 kg/ha', applicationTime: 'Split: 50% basal, 25% tillering, 25% panicle initiation', nutrients: 'Nitrogen (46%)' },
    { name: 'DAP', dosage: '50–60 kg/ha', applicationTime: 'Basal application before transplanting', nutrients: 'N (18%), P₂O₅ (46%)' },
    { name: 'MOP', dosage: '40–50 kg/ha', applicationTime: 'Basal application before transplanting', nutrients: 'K₂O (60%)' },
    { name: 'Zinc Sulphate', dosage: '25 kg/ha', applicationTime: 'Basal application (if Zn deficiency)', nutrients: 'Zn (21%), S (23%)' },
  ],
  wheat: [
    { name: 'Urea', dosage: '130–150 kg/ha', applicationTime: 'Split: 50% basal, 25% CRI stage, 25% late jointing', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '75 kg/ha', applicationTime: 'Full basal application', nutrients: 'P₂O₅ (16%), S (11%)' },
    { name: 'MOP', dosage: '40 kg/ha', applicationTime: 'Full basal application', nutrients: 'K₂O (60%)' },
  ],
  maize: [
    { name: 'Urea', dosage: '180–200 kg/ha', applicationTime: 'Split: 33% at sowing, 33% knee-high, 33% tasseling', nutrients: 'Nitrogen (46%)' },
    { name: 'DAP', dosage: '65 kg/ha', applicationTime: 'Full basal at sowing', nutrients: 'N (18%), P₂O₅ (46%)' },
    { name: 'MOP', dosage: '50 kg/ha', applicationTime: 'Full basal at sowing', nutrients: 'K₂O (60%)' },
  ],
  cotton: [
    { name: 'Urea', dosage: '80–100 kg/ha', applicationTime: 'Split: 30% basal, 40% at squaring, 30% at boll formation', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '50 kg/ha', applicationTime: 'Full basal application', nutrients: 'P₂O₅ (16%), S (11%)' },
    { name: 'MOP', dosage: '40 kg/ha', applicationTime: 'Full basal application', nutrients: 'K₂O (60%)' },
    { name: 'Boron', dosage: '1 kg/ha', applicationTime: 'Foliar spray at flowering', nutrients: 'Boron (17%)' },
  ],
  sugarcane: [
    { name: 'Urea', dosage: '250–300 kg/ha', applicationTime: 'Split: 33% at planting, 33% at 60 days, 34% at 120 days', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '100 kg/ha', applicationTime: 'Full basal at planting', nutrients: 'P₂O₅ (16%), S (11%)' },
    { name: 'MOP', dosage: '120 kg/ha', applicationTime: 'Full basal at planting', nutrients: 'K₂O (60%)' },
  ],
  soybean: [
    { name: 'Urea', dosage: '20–25 kg/ha', applicationTime: 'Basal only (low N due to nitrogen fixation)', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '80 kg/ha', applicationTime: 'Full basal application', nutrients: 'P₂O₅ (16%), S (11%)' },
    { name: 'MOP', dosage: '50 kg/ha', applicationTime: 'Full basal application', nutrients: 'K₂O (60%)' },
    { name: 'Rhizobium Bio-fertilizer', dosage: '200 g/10 kg seed', applicationTime: 'Seed treatment before sowing', nutrients: 'Biological Nitrogen Fixation' },
  ],
  groundnut: [
    { name: 'Urea', dosage: '15–20 kg/ha', applicationTime: 'Basal only (low N due to nitrogen fixation)', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '60 kg/ha', applicationTime: 'Full basal application', nutrients: 'P₂O₅ (16%), S (11%)' },
    { name: 'Gypsum', dosage: '200 kg/ha', applicationTime: 'Top dressing at flowering / pegging stage', nutrients: 'Ca (23%), S (18%)' },
    { name: 'MOP', dosage: '40 kg/ha', applicationTime: 'Full basal application', nutrients: 'K₂O (60%)' },
  ],
  potato: [
    { name: 'Urea', dosage: '200–220 kg/ha', applicationTime: 'Split: 50% basal, 50% at earthing up (30–35 days)', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '125 kg/ha', applicationTime: 'Full basal at planting', nutrients: 'P₂O₅ (16%), S (11%)' },
    { name: 'MOP', dosage: '150 kg/ha', applicationTime: 'Full basal at planting', nutrients: 'K₂O (60%)' },
  ],
  chickpea: [
    { name: 'DAP', dosage: '50–60 kg/ha', applicationTime: 'Full basal application', nutrients: 'N (18%), P₂O₅ (46%)' },
    { name: 'MOP', dosage: '20–30 kg/ha', applicationTime: 'Full basal application', nutrients: 'K₂O (60%)' },
    { name: 'Rhizobium Bio-fertilizer', dosage: '200 g/10 kg seed', applicationTime: 'Seed treatment before sowing', nutrients: 'Biological Nitrogen Fixation' },
    { name: 'Sulphur', dosage: '20 kg/ha', applicationTime: 'Basal application', nutrients: 'Sulphur (90%)' },
  ],
  lentil: [
    { name: 'DAP', dosage: '40–50 kg/ha', applicationTime: 'Full basal application', nutrients: 'N (18%), P₂O₅ (46%)' },
    { name: 'MOP', dosage: '15–20 kg/ha', applicationTime: 'Full basal application', nutrients: 'K₂O (60%)' },
    { name: 'Rhizobium Bio-fertilizer', dosage: '200 g/10 kg seed', applicationTime: 'Seed treatment before sowing', nutrients: 'Biological Nitrogen Fixation' },
  ],
  mustard: [
    { name: 'Urea', dosage: '80–100 kg/ha', applicationTime: 'Split: 50% basal, 50% at first irrigation (25–30 days)', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '50 kg/ha', applicationTime: 'Full basal application', nutrients: 'P₂O₅ (16%), S (11%)' },
    { name: 'Gypsum / Elemental Sulphur', dosage: '20–25 kg/ha', applicationTime: 'Basal application', nutrients: 'Sulphur (ensures high oil yield)' },
    { name: 'MOP', dosage: '30 kg/ha', applicationTime: 'Full basal application', nutrients: 'K₂O (60%)' },
  ],
  tomato: [
    { name: 'Urea', dosage: '120–150 kg/ha', applicationTime: 'Split: 33% basal, 33% at 30 days, 34% at fruit setting', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '90 kg/ha', applicationTime: 'Full basal before transplanting', nutrients: 'P₂O₅ (16%), S (11%)' },
    { name: 'MOP', dosage: '60 kg/ha', applicationTime: 'Split: 50% basal, 50% at flowering', nutrients: 'K₂O (60%)' },
    { name: 'Calcium Nitrate', dosage: '15 kg/ha', applicationTime: 'Foliar spray (prevents blossom end rot)', nutrients: 'Ca (19%), N (15.5%)' },
  ],
  onion: [
    { name: 'Urea', dosage: '100–120 kg/ha', applicationTime: 'Split: 50% basal, 50% at 30 days after transplanting', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '60 kg/ha', applicationTime: 'Full basal application', nutrients: 'P₂O₅ (16%), S (11%)' },
    { name: 'MOP', dosage: '80 kg/ha', applicationTime: 'Full basal application', nutrients: 'K₂O (60%)' },
  ],
  sunflower: [
    { name: 'Urea', dosage: '60–80 kg/ha', applicationTime: 'Split: 50% basal, 50% at button stage', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '60 kg/ha', applicationTime: 'Full basal application', nutrients: 'P₂O₅ (16%), S (11%)' },
    { name: 'MOP', dosage: '30 kg/ha', applicationTime: 'Full basal application', nutrients: 'K₂O (60%)' },
    { name: 'Borax', dosage: '2 kg/ha', applicationTime: 'Foliar spray at ray floret stage (enhances seed filling)', nutrients: 'Boron (11%)' },
  ],
  barley: [
    { name: 'Urea', dosage: '60–80 kg/ha', applicationTime: 'Split: 50% basal, 50% at first irrigation', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '40 kg/ha', applicationTime: 'Full basal application', nutrients: 'P₂O₅ (16%), S (11%)' },
    { name: 'MOP', dosage: '20 kg/ha', applicationTime: 'Full basal application', nutrients: 'K₂O (60%)' },
  ],
  millets: [
    { name: 'Urea', dosage: '60–80 kg/ha', applicationTime: 'Split: 50% basal, 50% at 30 days after sowing', nutrients: 'Nitrogen (46%)' },
    { name: 'SSP', dosage: '40 kg/ha', applicationTime: 'Full basal application', nutrients: 'P₂O₅ (16%), S (11%)' },
    { name: 'MOP', dosage: '25 kg/ha', applicationTime: 'Full basal application', nutrients: 'K₂O (60%)' },
  ],
};

function gaussianRangeScore(value: number, min: number, max: number, maxScore: number): number {
  if (value >= min && value <= max) return maxScore;
  const rangeWidth = max - min;
  const sigma = Math.max(rangeWidth / 2, 1);
  const delta = value < min ? min - value : value - max;
  const gaussScore = maxScore * Math.exp(-(delta * delta) / (2 * sigma * sigma));
  return Math.max(0, gaussScore);
}

function npkScore(value: number, min: number, max: number, maxScore: number): number {
  if (value >= min && value <= max) return maxScore;
  const tolerance = (max - min) * 0.25 + 10;
  if (value >= min - tolerance && value <= max + tolerance) {
    const dist = value < min ? min - value : value - max;
    return maxScore * (1 - dist / tolerance) * 0.6;
  }
  return 0;
}

function pHBonus(ph: number, phRange: [number, number]): number {
  if (ph >= phRange[0] && ph <= phRange[1]) return 10;
  const dist = ph < phRange[0] ? phRange[0] - ph : ph - phRange[1];
  if (dist <= 0.5) return 5;
  return 0;
}

export function predictCropsEngine(inputs: PredictionInputs): CropPredictionResult[] {
  const {
    rainfall,
    temperature,
    humidity,
    soilType,
    nitrogen,
    phosphorus,
    potassium,
    ph,
  } = inputs;

  const results: CropPredictionResult[] = [];

  for (const crop of CROPS) {
    const rainfallScore = gaussianRangeScore(rainfall, crop.minRainfall, crop.maxRainfall, 22);
    const temperatureScore = gaussianRangeScore(temperature, crop.minTemperature, crop.maxTemperature, 22);
    const humidityScore = gaussianRangeScore(humidity, crop.minHumidity, crop.maxHumidity, 16);

    const soilScore = crop.soilTypes.some(st => st.toLowerCase() === soilType.toLowerCase()) ? 20 : 0;

    const nScore = npkScore(nitrogen, crop.nitrogenRange[0], crop.nitrogenRange[1], 8);
    const pScore = npkScore(phosphorus, crop.phosphorusRange[0], crop.phosphorusRange[1], 6);
    const kScore = npkScore(potassium, crop.potassiumRange[0], crop.potassiumRange[1], 6);

    const phBonusVal = pHBonus(ph, crop.phRange);

    const rawScore = rainfallScore + temperatureScore + humidityScore
      + soilScore + nScore + pScore + kScore + phBonusVal;

    const maxPossible = 110;
    const confidence = Math.min(99, Math.max(5, (rawScore / maxPossible) * 100));

    const yieldMultiplier = 0.65 + (confidence / 100) * 0.45;
    const yieldPrediction = Math.round(crop.yieldPerHectare * yieldMultiplier * 10) / 10;

    if (confidence > 35) {
      results.push({
        crop,
        confidence: Math.round(confidence * 10) / 10,
        yieldPrediction,
        scoreBreakdown: {
          rainfall: Math.round(rainfallScore * 10) / 10,
          temperature: Math.round(temperatureScore * 10) / 10,
          humidity: Math.round(humidityScore * 10) / 10,
          soil: soilScore,
          nitrogen: Math.round(nScore * 10) / 10,
          phosphorus: Math.round(pScore * 10) / 10,
          potassium: Math.round(kScore * 10) / 10,
          phBonus: phBonusVal,
        },
        fertilizers: FERTILIZERS[crop.id] || [],
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence).slice(0, 6);
}
