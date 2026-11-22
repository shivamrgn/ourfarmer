/**
 * Expert Agricultural Support Service
 * Grounded strictly in official Indian agricultural institutions and helplines:
 * - ICAR Krishi Vigyan Kendras (KVKs) (kvk.icar.gov.in)
 * - Kisan Call Center (1551 / 1800-180-1551)
 * - ICAR & MeitY Kisan Sarathi (kisansarathi.in)
 * - State Agricultural Universities (PAU, JAU, MPKV, AAU, TNAU, etc.)
 * - State Agriculture Departments (mkisan.gov.in, agricoop.nic.in)
 */

export type SupportType = 'all' | 'nearby' | 'online' | 'government' | 'knowledge';

export type SupportCategory =
  | 'All Categories'
  | 'Crop & Farming Practices'
  | 'Plant Disease'
  | 'Soil & Fertility'
  | 'Irrigation & Water'
  | 'Crop Protection'
  | 'Government Schemes'
  | 'Agricultural Insurance'
  | 'Farm Equipment'
  | 'Market / Mandi Guidance'
  | 'General Agricultural Support';

export interface VerifiedSupportOrg {
  id: string;
  name: string;
  short_name?: string;
  organization: string;
  type: 'nearby' | 'online' | 'government' | 'knowledge';
  category: string[];
  verification_level: 'Official Government Source' | 'Verified Agricultural Institution';
  state: string;
  district: string;
  coverage?: string;
  address?: string;
  phone?: string;
  alternate_phone?: string;
  email?: string;
  website_url: string;
  official_portal_label?: string;
  timings?: string;
  languages?: string;
  description: string;
  services: string[];
  is_toll_free?: boolean;
  is_active: boolean;
}

export interface PreparedInquiry {
  id: string;
  farmer_name: string;
  phone?: string;
  state?: string;
  district?: string;
  crop?: string;
  category: string;
  problem_description: string;
  image_url?: string;
  status: 'prepared';
  formatted_summary?: string;
  created_at: string;
}

export interface InquiryResponse {
  success: boolean;
  inquiryId: string;
  status: string;
  message: string;
  formattedSummary: string;
  channels: Array<{
    name: string;
    phone?: string;
    url?: string;
    type: string;
    timing?: string;
  }>;
}

// ── VERIFIED OFFICIAL AGRICULTURAL SUPPORT REGISTRY ───────────────────────────
export const VERIFIED_SUPPORT_ORGANIZATIONS: VerifiedSupportOrg[] = [
  // ── NATIONAL ONLINE & HELPLINE SUPPORT ───────────────────────────────────────
  {
    id: 'kcc-national',
    name: 'Kisan Call Center (KCC)',
    short_name: 'Kisan Call Center',
    organization: 'Ministry of Agriculture & Farmers Welfare, Govt of India',
    type: 'online',
    category: ['General Agricultural Support', 'Crop & Farming Practices', 'Plant Disease', 'Soil & Fertility', 'Government Schemes'],
    verification_level: 'Official Government Source',
    state: 'All India',
    district: 'All Districts',
    coverage: 'Nationwide (All States & UTs)',
    phone: '1800-180-1551',
    alternate_phone: '1551 (Toll-Free Short Code)',
    email: 'kisan-callcentre@gov.in',
    website_url: 'https://mkisan.gov.in',
    official_portal_label: 'mkisan.gov.in',
    timings: '6:00 AM to 10:00 PM, 365 Days a Year',
    languages: '22 Local Indian Languages (Hindi, Punjabi, Gujarati, Marathi, Bengali, Telugu, Tamil, Kannada, etc.)',
    description: 'Toll-free telephonic agricultural advisory connecting farmers across India to Level-1 agricultural graduates and subject-matter specialists at state agricultural universities.',
    services: [
      'Crop pest and disease diagnosis assistance',
      'Fertilizer and pesticide dosage recommendations',
      'Weather-based crop advisory and sowing guidance',
      'Information on government subsidies and PM-KISAN/PMFBY',
      'Escalation to state university agronomists for complex issues'
    ],
    is_toll_free: true,
    is_active: true
  },
  {
    id: 'kisan-sarathi',
    name: 'Kisan Sarathi Digital Advisory Platform',
    short_name: 'Kisan Sarathi',
    organization: 'ICAR & Ministry of Electronics & IT (MeitY)',
    type: 'online',
    category: ['Crop & Farming Practices', 'Crop Protection', 'Plant Disease', 'General Agricultural Support'],
    verification_level: 'Official Government Source',
    state: 'All India',
    district: 'All Districts',
    coverage: 'Nationwide (Digital Multi-Media Advisory)',
    phone: '14443',
    website_url: 'https://kisansarathi.in',
    official_portal_label: 'kisansarathi.in',
    timings: '24/7 Digital Platform (Advisories during working hours)',
    languages: 'Multilingual Digital Advisory',
    description: 'National digital agricultural platform jointly launched by ICAR and MeitY enabling farmers to interact directly with scientists of their assigned district Krishi Vigyan Kendra (KVK).',
    services: [
      'Personalized multimedia farm advisory from district KVK scientists',
      'Direct query submission to assigned district KVK',
      'Localized weather and pest alerts',
      'Demonstration of climate-resilient farming technologies'
    ],
    is_toll_free: true,
    is_active: true
  },
  {
    id: 'icar-kvk-portal',
    name: 'ICAR National Krishi Vigyan Kendra Network',
    short_name: 'ICAR-KVK National Portal',
    organization: 'Indian Council of Agricultural Research (ICAR)',
    type: 'knowledge',
    category: ['General Agricultural Support', 'Crop & Farming Practices', 'Soil & Fertility', 'Farm Equipment'],
    verification_level: 'Verified Agricultural Institution',
    state: 'All India',
    district: 'All Districts',
    coverage: '731+ KVKs across all Indian districts',
    phone: '011-25841760',
    website_url: 'https://kvk.icar.gov.in',
    official_portal_label: 'kvk.icar.gov.in',
    timings: 'Office Hours: 9:30 AM to 5:00 PM (Monday to Friday)',
    languages: 'English, Hindi, and Regional State Languages',
    description: 'Central portal networking all 731 Krishi Vigyan Kendras across India, established by ICAR for agricultural technology assessment, farm demonstration, and capacity development.',
    services: [
      'Locate assigned district KVK and nodal scientists',
      'Access district-specific agro-climatic advisories',
      'Training programs on seeds, organic farming, and mechanization',
      'On-farm testing of crop varieties and technologies'
    ],
    is_toll_free: false,
    is_active: true
  },
  {
    id: 'pmfby-grievance',
    name: 'PMFBY Crop Loss Intimation & Insurance Support',
    short_name: 'PMFBY Crop Insurance Support',
    organization: 'Ministry of Agriculture & Farmers Welfare',
    type: 'online',
    category: ['Agricultural Insurance', 'Government Schemes'],
    verification_level: 'Official Government Source',
    state: 'All India',
    district: 'All Districts',
    coverage: 'Nationwide (All Notified Insurance Districts)',
    phone: '14447',
    alternate_phone: '1800-200-5142',
    email: 'help.agri-insurance@gov.in',
    website_url: 'https://pmfby.gov.in',
    official_portal_label: 'pmfby.gov.in',
    timings: '24/7 Helpline for Crop Loss Intimation',
    languages: 'Hindi, English, and State Official Languages',
    description: 'Official national crop insurance helpline dedicated to reporting localized natural calamity crop losses (within 72 hours of damage) and tracking claims.',
    services: [
      'Intimate localized crop damage within mandatory 72-hour window',
      'Track status of insurance claim applications',
      'File insurance company dispute and non-disbursement grievances',
      'Confirm notified crops and threshold yields for your district'
    ],
    is_toll_free: true,
    is_active: true
  },
  {
    id: 'enam-helpdesk',
    name: 'e-NAM National Mandi Helpdesk',
    short_name: 'e-NAM Mandi Support',
    organization: 'Small Farmers Agribusiness Consortium (SFAC), MoA&FW',
    type: 'online',
    category: ['Market / Mandi Guidance', 'Government Schemes'],
    verification_level: 'Official Government Source',
    state: 'All India',
    district: 'All Districts',
    coverage: '1,361+ Integrated Mandis Nationwide',
    phone: '1800-270-0224',
    email: 'nam@sfac.in',
    website_url: 'https://enam.gov.in',
    official_portal_label: 'enam.gov.in',
    timings: '9:00 AM to 6:00 PM (Monday to Saturday)',
    languages: 'English, Hindi, and Major State Languages',
    description: 'National helpline for farmers trading agricultural produce across e-NAM connected APMC markets, providing assaying and online payment resolution.',
    services: [
      'Assistance with online commodity bidding and auction tracking',
      'Verification of digital payments directly into bank account',
      'Quality assaying laboratory coordination at mandi gate',
      'Inter-mandi and inter-state trade guidance'
    ],
    is_toll_free: true,
    is_active: true
  },
  {
    id: 'vikaspedia-agri',
    name: 'Vikaspedia Agriculture Multilingual Knowledge Portal',
    short_name: 'Vikaspedia Agri Portal',
    organization: 'Ministry of Electronics and Information Technology (MeitY)',
    type: 'knowledge',
    category: ['General Agricultural Support', 'Crop & Farming Practices', 'Soil & Fertility', 'Government Schemes'],
    verification_level: 'Official Government Source',
    state: 'All India',
    district: 'All Districts',
    coverage: 'Nationwide Online Knowledge Base',
    website_url: 'https://vikaspedia.in/agriculture',
    official_portal_label: 'vikaspedia.in/agriculture',
    timings: '24/7 Online Knowledge Repository',
    languages: '23 Indian Languages',
    description: 'Government of India digital initiative delivering exhaustive package of practices for cereals, pulses, fruits, and commercial crops along with organic farming manuals.',
    services: [
      'Package of practices for Kharif, Rabi, and Zaid crops in 23 languages',
      'Comprehensive guides on organic pest repellents and composting',
      'Post-harvest preservation and value addition techniques',
      'State-wise directory of agricultural department schemes'
    ],
    is_toll_free: false,
    is_active: true
  },

  // ── STATE-SPECIFIC VERIFIED KVKs & INSTITUTIONS ─────────────────────────────
  // PUNJAB
  {
    id: 'kvk-punjab-ludhiana',
    name: 'ICAR - Krishi Vigyan Kendra, Ludhiana',
    short_name: 'KVK Ludhiana (PAU)',
    organization: 'Punjab Agricultural University (PAU) & ICAR',
    type: 'nearby',
    category: ['Crop & Farming Practices', 'Plant Disease', 'Soil & Fertility', 'Farm Equipment', 'General Agricultural Support'],
    verification_level: 'Verified Agricultural Institution',
    state: 'Punjab',
    district: 'Ludhiana',
    address: 'KVK Ludhiana, Punjab Agricultural University Campus, Ferozepur Road, Ludhiana, Punjab - 141004',
    phone: '0161-2401960',
    alternate_phone: '0161-2401495 (PAU Helpline)',
    email: 'kvkludhiana@pau.edu',
    website_url: 'https://pau.edu',
    official_portal_label: 'pau.edu',
    timings: '9:00 AM to 5:00 PM (Monday to Friday)',
    description: 'Premier agricultural science centre hosted by Punjab Agricultural University providing technical testing, certified wheat and paddy seeds, and crop residue machinery advisory.',
    services: [
      'Diagnostic visits for wheat rust and paddy false smut',
      'Soil and tubewell water testing for salinity and nutrients',
      'Training on Happy Seeder, Super Seeder, and zero-tillage drill calibration',
      'Availability of certified PAU seeds and bio-fertilizer cultures'
    ],
    is_toll_free: false,
    is_active: true
  },
  {
    id: 'dept-punjab-agri',
    name: 'Punjab State Department of Agriculture & Farmers Welfare',
    short_name: 'Punjab Agriculture Department',
    organization: 'Government of Punjab',
    type: 'government',
    category: ['Government Schemes', 'Farm Equipment', 'Crop & Farming Practices'],
    verification_level: 'Official Government Source',
    state: 'Punjab',
    district: 'All Districts',
    address: 'Kheti Bhawan, Phase 6, Industrial Area, Mohali, Punjab - 160055',
    phone: '1800-180-1551',
    alternate_phone: '0172-2970605',
    email: 'agri.punjab@punjab.gov.in',
    website_url: 'https://agri.punjab.gov.in',
    official_portal_label: 'agri.punjab.gov.in',
    timings: '9:00 AM to 5:00 PM (Monday to Friday)',
    description: 'Nodal state department responsible for agricultural extension, crop diversification incentives, subsidized machinery sanctioning, and seed quality inspection in Punjab.',
    services: [
      'Crop Residue Management (CRM) machinery subsidy applications',
      'Verification of subsidized certified wheat and oilseed allotments',
      'District Agriculture Officer (DAO) assistance and extension officers',
      'Tubewell power connection agricultural certification'
    ],
    is_toll_free: true,
    is_active: true
  },

  // GUJARAT
  {
    id: 'kvk-gujarat-rajkot',
    name: 'ICAR - Krishi Vigyan Kendra, Rajkot (Targhadia)',
    short_name: 'KVK Rajkot (JAU)',
    organization: 'Junagadh Agricultural University (JAU) & ICAR',
    type: 'nearby',
    category: ['Crop & Farming Practices', 'Irrigation & Water', 'Crop Protection', 'Plant Disease'],
    verification_level: 'Verified Agricultural Institution',
    state: 'Gujarat',
    district: 'Rajkot',
    address: 'Main Dry Farming Research Station, JAU, Targhadia, Rajkot, Gujarat - 360003',
    phone: '0281-2784242',
    alternate_phone: '0281-2784240',
    email: 'kvktarghadia@jau.in',
    website_url: 'https://jau.in',
    official_portal_label: 'jau.in',
    timings: '8:30 AM to 5:00 PM (Monday to Saturday, 2nd/4th Sat closed)',
    description: 'Dry farming research and extension hub serving Saurashtra region farmers with practical guidance on groundnut, cotton, and castor pest control, micro-irrigation, and watershed management.',
    services: [
      'Integrated Pest Management (IPM) for cotton pink bollworm',
      'Drip and sprinkler irrigation scheduling for Saurashtra soil types',
      'Soil testing and micro-nutrient (Zinc, Iron) deficiency correction',
      'High-yield groundnut seed production and treatment clinics'
    ],
    is_toll_free: false,
    is_active: true
  },
  {
    id: 'univ-gujarat-aau',
    name: 'Anand Agricultural University (AAU) Farmer Advisory Cell',
    short_name: 'Anand Agricultural University (AAU)',
    organization: 'Government of Gujarat & ICAR',
    type: 'nearby',
    category: ['Crop & Farming Practices', 'Plant Disease', 'Soil & Fertility', 'General Agricultural Support'],
    verification_level: 'Verified Agricultural Institution',
    state: 'Gujarat',
    district: 'Anand',
    address: 'Directorate of Extension Education, AAU Campus, Anand, Gujarat - 388110',
    phone: '02692-261310',
    alternate_phone: '1800-233-0222 (Gujarat Urja & Agri Toll-Free)',
    email: 'dee@aau.in',
    website_url: 'https://www.aau.in',
    official_portal_label: 'aau.in',
    timings: '9:00 AM to 5:30 PM (Working days)',
    description: 'Pioneering agricultural and dairy research university offering clinical plant pathology diagnosis, bio-fertilizer sales, and agro-meteorological advisory across Central Gujarat.',
    services: [
      'Plant disease sample examination and pathogen culture identification',
      'Liquid bio-fertilizer (Rhizobium, Azotobacter, PSB) supply',
      'Horticultural crop grafting and disease-resistant saplings',
      'Farmer toll-free agricultural guidance helpline'
    ],
    is_toll_free: false,
    is_active: true
  },
  {
    id: 'dept-gujarat-ikhedut',
    name: 'Gujarat State Department of Agriculture (iKhedut Portal)',
    short_name: 'Gujarat Agriculture Department',
    organization: 'Department of Agriculture, Farmers Welfare & Co-operation, Govt of Gujarat',
    type: 'government',
    category: ['Government Schemes', 'Irrigation & Water', 'Farm Equipment'],
    verification_level: 'Official Government Source',
    state: 'Gujarat',
    district: 'All Districts',
    address: 'Krishi Bhavan, Sector 10A, Gandhinagar, Gujarat - 382010',
    phone: '1800-180-1551',
    email: 'support.ikhedut@gujarat.gov.in',
    website_url: 'https://ikhedut.gujarat.gov.in',
    official_portal_label: 'ikhedut.gujarat.gov.in',
    timings: '10:30 AM to 6:10 PM (Working days)',
    description: 'Nodal portal managing single-window agricultural scheme disbursements, daytime electricity scheduling under Kisan Suryodaya Yojana, and tractor subsidy sanctions.',
    services: [
      'iKhedut portal scheme application verification and status checking',
      'Subsidy for solar pump sets, water storage ponds, and PVC pipes',
      'Organic farming incentives and Gau-Aadharit Krishi assistance',
      'District Agricultural Officer (DAO) contact and camp dates'
    ],
    is_toll_free: true,
    is_active: true
  },

  // MAHARASHTRA
  {
    id: 'kvk-maharashtra-nashik',
    name: 'ICAR - Krishi Vigyan Kendra, Nashik (YCMOU)',
    short_name: 'KVK Nashik',
    organization: 'YCMOU & ICAR',
    type: 'nearby',
    category: ['Crop & Farming Practices', 'Plant Disease', 'Irrigation & Water', 'Crop Protection'],
    verification_level: 'Verified Agricultural Institution',
    state: 'Maharashtra',
    district: 'Nashik',
    address: 'YCMOU Campus, Dnyangangotri, Near Gangapur Dam, Nashik, Maharashtra - 422222',
    phone: '0253-2230717',
    email: 'kvk_nashik@yahoo.co.in',
    website_url: 'https://ycmoukvknashik.org',
    official_portal_label: 'ycmoukvknashik.org',
    timings: '9:30 AM to 5:30 PM (Monday to Saturday)',
    description: 'Specialized horticulture and commercial crop KVK delivering actionable guidance for onion storage, grape export compliance, pomegranate bacterial blight, and drip fertigation.',
    services: [
      'Diagnostic clinic for onion thrips, purple blotch, and grape downy mildew',
      'Drip irrigation fertigation schedules and water testing',
      'Low-cost onion storage structure (Kanda Chawl) engineering plans',
      'Biological pest control culture production (Trichoderma, Metarhizium)'
    ],
    is_toll_free: false,
    is_active: true
  },
  {
    id: 'univ-maharashtra-mpkv',
    name: 'Mahatma Phule Krishi Vidyapeeth (MPKV), Rahuri',
    short_name: 'MPKV Rahuri',
    organization: 'Government of Maharashtra & ICAR',
    type: 'nearby',
    category: ['Crop & Farming Practices', 'Plant Disease', 'Soil & Fertility', 'General Agricultural Support'],
    verification_level: 'Verified Agricultural Institution',
    state: 'Maharashtra',
    district: 'Ahmednagar',
    address: 'MPKV, Rahuri, Ahmednagar District, Maharashtra - 413722',
    phone: '02426-243208',
    alternate_phone: '02426-243237',
    email: 'registrar.mpkv@gov.in',
    website_url: 'https://mpkv.ac.in',
    official_portal_label: 'mpkv.ac.in',
    timings: '9:30 AM to 5:45 PM (Working days)',
    description: 'Premier state agricultural university in Western Maharashtra known for sugarcane varieties, pomegranate wilt research, and climate-resilient dryland farming technologies.',
    services: [
      'Release and availability of breeder seeds for sugarcane, soybean, and gram',
      'Plant health clinic and soil testing laboratory reports',
      'Weekly weather-based Agro-Advisory Bulletin for Western Maharashtra',
      'Organic farming inputs and microbial consortium distribution'
    ],
    is_toll_free: false,
    is_active: true
  },
  {
    id: 'dept-maharashtra-krishi',
    name: 'Maharashtra State Department of Agriculture (MahaAgri)',
    short_name: 'MahaAgri Department',
    organization: 'Government of Maharashtra',
    type: 'government',
    category: ['Government Schemes', 'Agricultural Insurance', 'Farm Equipment'],
    verification_level: 'Official Government Source',
    state: 'Maharashtra',
    district: 'All Districts',
    address: 'Commissionerate of Agriculture, Krishi Bhavan, Shivajinagar, Pune, Maharashtra - 411005',
    phone: '1800-233-4000',
    alternate_phone: '1800-180-1551',
    email: 'commagri.pune@maharashtra.gov.in',
    website_url: 'https://krishi.maharashtra.gov.in',
    official_portal_label: 'krishi.maharashtra.gov.in',
    timings: '9:45 AM to 6:15 PM (Monday to Friday)',
    description: 'State department orchestrating MahaDBT agricultural schemes, PMFBY district coordination, farm pond sanctions (Magel Tyala Shettale), and crop damage compensation.',
    services: [
      'MahaDBT Farmer login profile verification and lottery sanctions',
      'PMFBY crop loss settlement oversight and insurance officer contacts',
      'Taluka Agriculture Officer (TAO) assistance and Krishi Sahayak visits',
      'Drip and sprinkler subsidy approvals under state mission'
    ],
    is_toll_free: true,
    is_active: true
  },

  // MADHYA PRADESH
  {
    id: 'kvk-mp-sehore',
    name: 'ICAR - Krishi Vigyan Kendra, Sehore',
    short_name: 'KVK Sehore',
    organization: 'RVSKVV, Gwalior & ICAR',
    type: 'nearby',
    category: ['Crop & Farming Practices', 'Plant Disease', 'Soil & Fertility'],
    verification_level: 'Verified Agricultural Institution',
    state: 'Madhya Pradesh',
    district: 'Sehore',
    address: 'RAK College of Agriculture Campus, Sehore, Madhya Pradesh - 466001',
    phone: '07562-227521',
    email: 'kvksehore@rvskvv.net',
    website_url: 'https://rvskvv.net',
    official_portal_label: 'rvskvv.net',
    timings: '10:00 AM to 5:00 PM (Monday to Friday)',
    description: 'Key central MP agricultural station specialized in soybean yellow mosaic virus control, certified chickpea/wheat seed distribution, and balanced NPK fertilizer management.',
    services: [
      'Soybean and wheat disease identification and management advice',
      'Soil nutrient analysis and micronutrient balance advice',
      'Seed treatment protocols for wilt and root rot prevention',
      'Training on ridge-and-furrow planting for drainage'
    ],
    is_toll_free: false,
    is_active: true
  },
  {
    id: 'dept-mp-krishi',
    name: 'Madhya Pradesh Kisan Kalyan Tatha Krishi Vikas Vibhag',
    short_name: 'MP Krishi Department',
    organization: 'Government of Madhya Pradesh',
    type: 'government',
    category: ['Government Schemes', 'Crop & Farming Practices'],
    verification_level: 'Official Government Source',
    state: 'Madhya Pradesh',
    district: 'All Districts',
    address: 'Vindhyachal Bhawan, Bhopal, Madhya Pradesh - 462004',
    phone: '0755-2551500',
    alternate_phone: '181 (CM Helpline MP)',
    email: 'mpkrishi@mp.gov.in',
    website_url: 'https://mpkrishi.mp.gov.in',
    official_portal_label: 'mpkrishi.mp.gov.in',
    timings: '10:00 AM to 5:30 PM (Working days)',
    description: 'State agricultural ministry administering Mukhyamantri Kisan Kalyan Yojana payments, certified seed production, and district fertilizer quota management.',
    services: [
      'Mukhyamantri Kisan Kalyan registration verification with SAARA portal',
      'District agricultural extension and Gram Sevak coordination',
      'Certified seed allotment and subsidy distribution',
      'Soil testing card distribution tracking'
    ],
    is_toll_free: false,
    is_active: true
  },

  // HARYANA
  {
    id: 'kvk-haryana-karnal',
    name: 'ICAR - Krishi Vigyan Kendra, Karnal (NDRI Campus)',
    short_name: 'KVK Karnal',
    organization: 'NDRI / CCSHAU & ICAR',
    type: 'nearby',
    category: ['Crop & Farming Practices', 'Plant Disease', 'Farm Equipment', 'Soil & Fertility'],
    verification_level: 'Verified Agricultural Institution',
    state: 'Haryana',
    district: 'Karnal',
    address: 'ICAR-NDRI Campus, Karnal, Haryana - 132001',
    phone: '0184-2267568',
    email: 'kvkkarnal@gmail.com',
    website_url: 'https://ndri.res.in',
    official_portal_label: 'ndri.res.in',
    timings: '9:00 AM to 5:00 PM (Monday to Friday)',
    description: 'Agricultural and dairy technology center serving farmers in the Indo-Gangetic plain with direct-seeded rice (DSR), wheat yellow rust management, and in-situ straw management.',
    services: [
      'Field inspection and treatment advice for wheat yellow rust and aphid attack',
      'Calibration of Happy Seeder, Mulcher, and Zero-Till seed drills',
      'Soil health card interpretation and saline soil reclamation',
      'Dairy nutrition and high-yielding green fodder agronomy'
    ],
    is_toll_free: false,
    is_active: true
  },
  {
    id: 'dept-haryana-agri',
    name: 'Haryana Agriculture & Farmers Welfare Department',
    short_name: 'Haryana Agriculture Department',
    organization: 'Government of Haryana',
    type: 'government',
    category: ['Government Schemes', 'Market / Mandi Guidance', 'Farm Equipment'],
    verification_level: 'Official Government Source',
    state: 'Haryana',
    district: 'All Districts',
    address: 'Krishi Bhawan, Sector 21, Panchkula, Haryana - 134112',
    phone: '1800-180-2117',
    alternate_phone: '0172-2571553',
    email: 'agriharyana2009@gmail.com',
    website_url: 'https://agriharyana.gov.in',
    official_portal_label: 'agriharyana.gov.in',
    timings: '9:00 AM to 5:00 PM (Monday to Friday)',
    description: 'Nodal state department managing Meri Fasal Mera Byora crop procurement, crop residue machinery incentives, and drought/flood compensation.',
    services: [
      'Meri Fasal Mera Byora portal registration verification',
      'Subsidized stubble management machinery sanctions',
      'Crop diversification incentive (Mera Pani Meri Virasat) payments',
      'Deputy Director of Agriculture (DDA) district extension contacts'
    ],
    is_toll_free: true,
    is_active: true
  },

  // UTTAR PRADESH
  {
    id: 'kvk-up-varanasi',
    name: 'ICAR - Krishi Vigyan Kendra, Varanasi (IIVR)',
    short_name: 'KVK Varanasi (IIVR)',
    organization: 'Indian Institute of Vegetable Research (IIVR) & ICAR',
    type: 'nearby',
    category: ['Crop & Farming Practices', 'Plant Disease', 'Soil & Fertility'],
    verification_level: 'Verified Agricultural Institution',
    state: 'Uttar Pradesh',
    district: 'Varanasi',
    address: 'ICAR-IIVR, PO Jakhini, Shahanshahpur, Varanasi, Uttar Pradesh - 221305',
    phone: '0542-2635247',
    email: 'kvkvaranasi@gmail.com',
    website_url: 'https://iivr.icar.gov.in',
    official_portal_label: 'iivr.icar.gov.in',
    timings: '9:30 AM to 5:00 PM (Monday to Saturday)',
    description: 'Leading eastern UP agricultural science centre specialized in vegetable nursery production, integrated pest management for horticultural and pulse crops, and micro-nutrient soil clinics.',
    services: [
      'Nursery management and virus disease diagnosis in vegetables',
      'Soil testing and balanced organic manure recommendations',
      'Training on drip fertigation for high-value vegetable farming',
      'Distribution of certified seeds developed by ICAR-IIVR'
    ],
    is_toll_free: false,
    is_active: true
  },

  // RAJASTHAN
  {
    id: 'kvk-rajasthan-jaipur',
    name: 'ICAR - Krishi Vigyan Kendra, Jaipur (SKNAU Durgapura)',
    short_name: 'KVK Jaipur (Durgapura)',
    organization: 'Sri Karan Narendra Agriculture University (SKNAU) & ICAR',
    type: 'nearby',
    category: ['Crop & Farming Practices', 'Irrigation & Water', 'Soil & Fertility'],
    verification_level: 'Verified Agricultural Institution',
    state: 'Rajasthan',
    district: 'Jaipur',
    address: 'Agriculture Research Station Campus, Durgapura, Jaipur, Rajasthan - 302018',
    phone: '0141-2550229',
    email: 'kvkjaipur@sknau.ac.in',
    website_url: 'https://sknau.ac.in',
    official_portal_label: 'sknau.ac.in',
    timings: '10:00 AM to 5:00 PM (Monday to Saturday)',
    description: 'Arid zone agriculture extension station guiding farmers on mustard, bajra, and clusterbean production, sprinkler irrigation water budgeting, and saline water management.',
    services: [
      'Water budgeting and sprinkler irrigation design for arid soils',
      'Mustard aphid and white rust treatment recommendations',
      'Organic input preparation and vermicompost training',
      'Seed testing and drought-tolerant crop advisory'
    ],
    is_toll_free: false,
    is_active: true
  },

  // KARNATAKA
  {
    id: 'kvk-karnataka-bengaluru',
    name: 'ICAR - Krishi Vigyan Kendra, Bengaluru Rural (Hadonahalli)',
    short_name: 'KVK Bengaluru Rural (UASB)',
    organization: 'University of Agricultural Sciences, Bangalore & ICAR',
    type: 'nearby',
    category: ['Crop & Farming Practices', 'Plant Disease', 'Irrigation & Water', 'Soil & Fertility'],
    verification_level: 'Verified Agricultural Institution',
    state: 'Karnataka',
    district: 'Bengaluru Rural',
    address: 'Hadonahalli, Tubagere Hobli, Doddaballapura Taluk, Bengaluru Rural, Karnataka - 561203',
    phone: '080-27622288',
    alternate_phone: '080-23330153 (UASB Farmer Helpdesk)',
    email: 'kvkbrural@gmail.com',
    website_url: 'https://uasbangalore.edu.in',
    official_portal_label: 'uasbangalore.edu.in',
    timings: '9:00 AM to 5:00 PM (Working days)',
    description: 'Technology transfer and diagnostic clinic hosted by UAS Bangalore specializing in ragi blast, maize fall armyworm, horticulture greenhouse farming, and bio-pesticides.',
    services: [
      'Diagnostic clinic for fall armyworm and fruit borer infestations',
      'Micro-irrigation and precision farming for horticultural crops',
      'Soil health testing and leaf tissue analysis for nutrient deficiency',
      'Production and supply of bio-agents (Trichoderma, Pseudomonas)'
    ],
    is_toll_free: false,
    is_active: true
  },

  // TAMIL NADU
  {
    id: 'kvk-tn-coimbatore',
    name: 'ICAR - Krishi Vigyan Kendra, Coimbatore (TNAU)',
    short_name: 'KVK Coimbatore (TNAU)',
    organization: 'Tamil Nadu Agricultural University (TNAU) & ICAR',
    type: 'nearby',
    category: ['Crop & Farming Practices', 'Plant Disease', 'Soil & Fertility', 'General Agricultural Support'],
    verification_level: 'Verified Agricultural Institution',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    address: 'TNAU Campus, Marudhamalai Road, Coimbatore, Tamil Nadu - 641003',
    phone: '0422-6611200',
    alternate_phone: '0422-2456542',
    email: 'kvkcbe@tnau.ac.in',
    website_url: 'https://tnau.ac.in',
    official_portal_label: 'tnau.ac.in',
    timings: '9:00 AM to 5:00 PM (Monday to Friday)',
    description: 'Renowned agricultural research station connected with TNAU delivering diagnostic plant pathology clinics, precision paddy cultivation, drip fertigation, and bio-input guidance.',
    services: [
      'Crop disease diagnostic clinic and leaf sample culture analysis',
      'TNAU Agritech portal weather and market price advisory',
      'Supply of TNAU pulse booster, groundnut rich, and certified seeds',
      'Drip fertigation guidance for banana, coconut, and sugarcane'
    ],
    is_toll_free: false,
    is_active: true
  }
];

const INQUIRIES_STORAGE_KEY = 'cropswild_expert_inquiries';
const PENDING_DISEASE_INQUIRY_KEY = 'cropswild_pending_disease_inquiry';

class ExpertSupportService {
  /**
   * Retrieves verified support organizations based on location, type, and category
   */
  async getSupportOrganizations(params?: {
    category?: string;
    state?: string;
    district?: string;
    type?: SupportType;
    search?: string;
  }): Promise<VerifiedSupportOrg[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.category && params.category !== 'All Categories') {
        searchParams.append('category', params.category);
      }
      if (params?.state && params.state !== 'All States') {
        searchParams.append('state', params.state);
      }
      if (params?.district) {
        searchParams.append('district', params.district);
      }
      if (params?.type && params.type !== 'all') {
        searchParams.append('type', params.type);
      }
      if (params?.search && params.search.trim() !== '') {
        searchParams.append('search', params.search.trim());
      }

      const queryString = searchParams.toString();
      const endpoint = `/api/expert-support${queryString ? `?${queryString}` : ''}`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(endpoint, {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        const json = await response.json();
        if (json && Array.isArray(json.data) && json.data.length > 0) {
          return this.rankAndFilterLocally(json.data, params);
        }
      }
    } catch {
      // Clean fallback to verified local registry
    }

    return this.rankAndFilterLocally(VERIFIED_SUPPORT_ORGANIZATIONS, params);
  }

  /**
   * Ranks organizations locally prioritizing the farmer's state and district
   */
  private rankAndFilterLocally(
    list: VerifiedSupportOrg[],
    params?: {
      category?: string;
      state?: string;
      district?: string;
      type?: SupportType;
      search?: string;
    }
  ): VerifiedSupportOrg[] {
    let result = [...list];

    // Category filter
    if (params?.category && params.category !== 'All Categories') {
      const targetCat = params.category.toLowerCase();
      result = result.filter(org =>
        org.category.some(c => c.toLowerCase() === targetCat)
      );
    }

    // Type filter
    if (params?.type && params.type !== 'all') {
      result = result.filter(org => org.type === params.type);
    }

    // State filter
    if (params?.state && params.state !== 'All States' && params.state.trim() !== '') {
      const targetState = params.state.toLowerCase().trim();
      result = result.filter(org =>
        org.state.toLowerCase() === 'all india' ||
        org.state.toLowerCase().includes(targetState) ||
        targetState.includes(org.state.toLowerCase())
      );
    }

    // Search query
    if (params?.search && params.search.trim() !== '') {
      const q = params.search.toLowerCase().trim();
      result = result.filter(org =>
        org.name.toLowerCase().includes(q) ||
        (org.short_name && org.short_name.toLowerCase().includes(q)) ||
        org.organization.toLowerCase().includes(q) ||
        org.description.toLowerCase().includes(q) ||
        org.state.toLowerCase().includes(q) ||
        org.district.toLowerCase().includes(q) ||
        org.services.some(s => s.toLowerCase().includes(q))
      );
    }

    // Ranking: Prioritize farmer's district first, then state, then national
    const farmerDistrict = params?.district?.toLowerCase().trim();
    const farmerState = params?.state?.toLowerCase().trim();

    result.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      if (farmerDistrict && a.district.toLowerCase().includes(farmerDistrict)) scoreA += 10;
      if (farmerDistrict && b.district.toLowerCase().includes(farmerDistrict)) scoreB += 10;

      if (farmerState && a.state.toLowerCase().includes(farmerState)) scoreA += 5;
      if (farmerState && b.state.toLowerCase().includes(farmerState)) scoreB += 5;

      if (a.is_toll_free) scoreA += 2;
      if (b.is_toll_free) scoreB += 2;

      return scoreB - scoreA;
    });

    return result;
  }

  /**
   * Prepares and securely records a farmer's problem inquiry
   */
  async prepareInquiry(inquiryData: {
    farmer_name: string;
    phone?: string;
    state?: string;
    district?: string;
    crop?: string;
    category: string;
    problem_description: string;
    image_url?: string;
  }): Promise<InquiryResponse> {
    const defaultResponse: InquiryResponse = {
      success: true,
      inquiryId: `CW-${Date.now().toString().slice(-6)}`,
      status: 'prepared',
      message: 'Your question has been prepared and saved to your Farm Records. You can present this structured summary to your local KVK scientist or read it to a Kisan Call Center officer at 1551.',
      formattedSummary: [
        `FARM AGRICULTURAL INQUIRY`,
        `---------------------------------------`,
        `Category: ${inquiryData.category}`,
        `Crop: ${inquiryData.crop || 'Not specified'}`,
        `Location: ${inquiryData.district ? `${inquiryData.district}, ` : ''}${inquiryData.state || 'India'}`,
        `Farmer: ${inquiryData.farmer_name}`,
        `Problem Description:`,
        `${inquiryData.problem_description}`,
        `---------------------------------------`,
        `Recommended Channels:`,
        `• Call Kisan Call Center (1551 / 1800-180-1551) Toll-Free`,
        `• Visit your District Krishi Vigyan Kendra (KVK)`,
        `• Submit online at ICAR Kisan Sarathi (kisansarathi.in)`
      ].join('\n'),
      channels: [
        {
          name: 'Kisan Call Center',
          phone: '1800-180-1551',
          type: 'Toll-Free Phone',
          timing: '6:00 AM - 10:00 PM (365 Days)'
        },
        {
          name: 'District Krishi Vigyan Kendra (KVK)',
          url: 'https://kvk.icar.gov.in',
          type: 'Physical Institutional Visit'
        },
        {
          name: 'ICAR Kisan Sarathi Portal',
          url: 'https://kisansarathi.in',
          type: 'Digital Multi-Media Advisory'
        }
      ]
    };

    // Save locally to storage
    this.saveInquiryLocally({
      id: defaultResponse.inquiryId,
      farmer_name: inquiryData.farmer_name,
      phone: inquiryData.phone,
      state: inquiryData.state,
      district: inquiryData.district,
      crop: inquiryData.crop,
      category: inquiryData.category,
      problem_description: inquiryData.problem_description,
      image_url: inquiryData.image_url,
      status: 'prepared',
      formatted_summary: defaultResponse.formattedSummary,
      created_at: new Date().toISOString()
    });

    // Try posting to backend
    try {
      const response = await fetch('/api/expert-support/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inquiryData)
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success) {
          return json;
        }
      }
    } catch {
      // Use local saved inquiry response
    }

    return defaultResponse;
  }

  /**
   * Saves an inquiry to browser localStorage
   */
  private saveInquiryLocally(inquiry: PreparedInquiry): void {
    try {
      const existing = this.getInquiryHistory();
      const updated = [inquiry, ...existing].slice(0, 10);
      localStorage.setItem(INQUIRIES_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[Expert Support] Local storage save failed:', e);
    }
  }

  /**
   * Retrieves saved inquiries from localStorage
   */
  getInquiryHistory(): PreparedInquiry[] {
    try {
      const raw = localStorage.getItem(INQUIRIES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Saves disease scan context for seamless transfer from Disease Detection
   */
  setPendingDiseaseContext(data: {
    crop: string;
    diseaseName: string;
    confidence: number;
    symptoms?: string[];
  }): void {
    try {
      sessionStorage.setItem(PENDING_DISEASE_INQUIRY_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Session storage error:', e);
    }
  }

  /**
   * Reads and clears pending disease inquiry context
   */
  consumePendingDiseaseContext(): {
    crop: string;
    diseaseName: string;
    confidence: number;
    symptoms?: string[];
  } | null {
    try {
      const raw = sessionStorage.getItem(PENDING_DISEASE_INQUIRY_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(PENDING_DISEASE_INQUIRY_KEY);
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Official support categories
   */
  getCategories(): SupportCategory[] {
    return [
      'All Categories',
      'Crop & Farming Practices',
      'Plant Disease',
      'Soil & Fertility',
      'Irrigation & Water',
      'Crop Protection',
      'Government Schemes',
      'Agricultural Insurance',
      'Farm Equipment',
      'Market / Mandi Guidance',
      'General Agricultural Support'
    ];
  }
}

export const expertSupportService = new ExpertSupportService();
export default expertSupportService;
