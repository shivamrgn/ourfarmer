
const fertilizers = {
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
        { name: 'MOP', dosage: '30 kg/ha', applicationTime: 'Full basal application', nutrients: 'K₂O (60%)' },
        { name: 'Boron', dosage: '1.5 kg/ha', applicationTime: 'Foliar spray at bud initiation', nutrients: 'Boron (17%)' },
    ],
    tomato: [
        { name: 'Urea', dosage: '200–250 kg/ha', applicationTime: 'Split: 33% basal, 33% at flowering, 34% at fruiting', nutrients: 'Nitrogen (46%)' },
        { name: 'SSP', dosage: '125 kg/ha', applicationTime: 'Full basal application', nutrients: 'P₂O₅ (16%), S (11%)' },
        { name: 'MOP', dosage: '100 kg/ha', applicationTime: 'Split: 50% basal, 50% at fruit set', nutrients: 'K₂O (60%)' },
        { name: 'Calcium Nitrate', dosage: '5 g/L', applicationTime: 'Foliar spray to prevent blossom end rot', nutrients: 'Ca (19%), N (15.5%)' },
    ],
    onion: [
        { name: 'Urea', dosage: '120–130 kg/ha', applicationTime: 'Split: 50% basal, 25% at 30 days, 25% at 45 days', nutrients: 'Nitrogen (46%)' },
        { name: 'SSP', dosage: '75 kg/ha', applicationTime: 'Full basal application', nutrients: 'P₂O₅ (16%), S (11%)' },
        { name: 'MOP', dosage: '80 kg/ha', applicationTime: 'Full basal application', nutrients: 'K₂O (60%)' },
    ],
    banana: [
        { name: 'Urea', dosage: '300–350 kg/ha/year', applicationTime: 'Split: 6 doses at bimonthly intervals', nutrients: 'Nitrogen (46%)' },
        { name: 'SSP', dosage: '150 kg/ha/year', applicationTime: 'Split: 2 doses at 2 & 5 months', nutrients: 'P₂O₅ (16%), S (11%)' },
        { name: 'MOP', dosage: '400 kg/ha/year', applicationTime: 'Split: 4 doses at quarterly intervals', nutrients: 'K₂O (60%)' },
    ],
    mango: [
        { name: 'Urea', dosage: '1.5 kg/tree/year (adult)', applicationTime: 'Split: June–July and Oct–Nov', nutrients: 'Nitrogen (46%)' },
        { name: 'SSP', dosage: '1 kg/tree/year', applicationTime: 'October–November before monsoon break', nutrients: 'P₂O₅ (16%), S (11%)' },
        { name: 'MOP', dosage: '1 kg/tree/year', applicationTime: 'October–November before monsoon break', nutrients: 'K₂O (60%)' },
    ],
    jowar: [
        { name: 'Urea', dosage: '65–85 kg/ha', applicationTime: 'Split: 50% basal, 50% at knee-high stage', nutrients: 'Nitrogen (46%)' },
        { name: 'SSP', dosage: '50 kg/ha', applicationTime: 'Full basal application', nutrients: 'P₂O₅ (16%), S (11%)' },
        { name: 'MOP', dosage: '30 kg/ha', applicationTime: 'Full basal application', nutrients: 'K₂O (60%)' },
    ],
};

module.exports = { fertilizers };
