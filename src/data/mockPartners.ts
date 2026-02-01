// Comprehensive Mock Partner Database with realistic local company names
// Organized by country with authentic naming conventions

export interface MockPartner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
  partner_type: string;
  lat: number;
  lng: number;
  certifications: string[];
  services: string[];
}

const PARTNER_TYPES = ["freight_forwarder", "customs_broker", "carrier", "nvocc", "3pl", "courier"];
const CERTIFICATIONS = ["IATA", "BASC", "ISO", "C-TPAT", "AEO"];
const SERVICES = ["air_freight", "ocean_fcl", "ocean_lcl", "road_freight", "rail_freight", "project_cargo", "dangerous_goods", "perishables", "pharma", "ecommerce", "relocations", "customs_broker", "warehousing", "nvocc"];

// Helper to pick random items from array
const pickRandom = <T>(arr: T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

let idCounter = 1;

// Partner generator with realistic local names
function createPartner(
  company_name: string,
  city: string,
  country_code: string,
  country_name: string,
  lat: number,
  lng: number,
  email_domain: string
): MockPartner {
  return {
    id: String(idCounter++),
    company_name,
    city,
    country_code,
    country_name,
    email: `info@${email_domain}`,
    partner_type: PARTNER_TYPES[Math.floor(Math.random() * PARTNER_TYPES.length)],
    lat,
    lng,
    certifications: pickRandom(CERTIFICATIONS, Math.floor(Math.random() * 3) + 1),
    services: pickRandom(SERVICES, Math.floor(Math.random() * 4) + 2),
  };
}

export const MOCK_PARTNERS: MockPartner[] = [
  // === EUROPE ===
  // United Kingdom (GB)
  createPartner("Global Freight Solutions Ltd", "London", "GB", "United Kingdom", 51.5074, -0.1278, "gfs.co.uk"),
  createPartner("British Cargo Express", "Manchester", "GB", "United Kingdom", 53.4808, -2.2426, "bce.co.uk"),
  createPartner("London Logistics Partners", "London", "GB", "United Kingdom", 51.5074, -0.1278, "llp.co.uk"),
  createPartner("Thames Valley Transport", "Reading", "GB", "United Kingdom", 51.4543, -0.9781, "tvt.co.uk"),
  
  // Germany (DE)
  createPartner("Hamburg Shipping GmbH", "Hamburg", "DE", "Germany", 53.5511, 9.9937, "hsg.de"),
  createPartner("Frankfurt Logistics AG", "Frankfurt", "DE", "Germany", 50.1109, 8.6821, "flag.de"),
  createPartner("Munich Transport GmbH", "Munich", "DE", "Germany", 48.1351, 11.582, "mtg.de"),
  createPartner("Berlin Cargo Services", "Berlin", "DE", "Germany", 52.52, 13.405, "bcs.de"),
  
  // France (FR)
  createPartner("Paris Freight SARL", "Paris", "FR", "France", 48.8566, 2.3522, "parisfreight.fr"),
  createPartner("Marseille Maritime", "Marseille", "FR", "France", 43.2965, 5.3698, "marseille-maritime.fr"),
  createPartner("Lyon Logistique", "Lyon", "FR", "France", 45.764, 4.8357, "lyon-log.fr"),
  
  // Netherlands (NL)
  createPartner("Rotterdam Port Services BV", "Rotterdam", "NL", "Netherlands", 51.9244, 4.4777, "rps.nl"),
  createPartner("Amsterdam Freight BV", "Amsterdam", "NL", "Netherlands", 52.3676, 4.9041, "afbv.nl"),
  createPartner("Dutch Cargo Solutions", "Utrecht", "NL", "Netherlands", 52.0907, 5.1214, "dcs.nl"),
  
  // Italy (IT)
  createPartner("Milan Intermodal SpA", "Milan", "IT", "Italy", 45.4642, 9.19, "mis.it"),
  createPartner("Rome Cargo Services", "Rome", "IT", "Italy", 41.9028, 12.4964, "rcs.it"),
  createPartner("Genova Shipping Srl", "Genoa", "IT", "Italy", 44.4056, 8.9463, "genova-ship.it"),
  
  // Spain (ES)
  createPartner("Madrid Cargo SL", "Madrid", "ES", "Spain", 40.4168, -3.7038, "mc.es"),
  createPartner("Barcelona Logistics SA", "Barcelona", "ES", "Spain", 41.3851, 2.1734, "bcn-log.es"),
  createPartner("Valencia Port Services", "Valencia", "ES", "Spain", 39.4699, -0.3763, "vps.es"),
  
  // Switzerland (CH)
  createPartner("Swiss Air Cargo AG", "Zurich", "CH", "Switzerland", 47.3769, 8.5417, "swissaircargo.ch"),
  createPartner("Geneva Logistics SA", "Geneva", "CH", "Switzerland", 46.2044, 6.1432, "geneva-log.ch"),
  createPartner("Basel Freight Services", "Basel", "CH", "Switzerland", 47.5596, 7.5886, "bfs.ch"),
  
  // Belgium (BE)
  createPartner("Antwerp Port Logistics", "Antwerp", "BE", "Belgium", 51.2194, 4.4025, "apl.be"),
  createPartner("Brussels Cargo NV", "Brussels", "BE", "Belgium", 50.8503, 4.3517, "brussels-cargo.be"),
  
  // Austria (AT)
  createPartner("Vienna Transport GmbH", "Vienna", "AT", "Austria", 48.2082, 16.3738, "vtg.at"),
  createPartner("Salzburg Logistics", "Salzburg", "AT", "Austria", 47.8095, 13.055, "slg.at"),
  
  // Poland (PL)
  createPartner("Warsaw Freight Sp. z o.o.", "Warsaw", "PL", "Poland", 52.2297, 21.0122, "wf.pl"),
  createPartner("Gdansk Port Services", "Gdansk", "PL", "Poland", 54.352, 18.6466, "gps.pl"),
  
  // Portugal (PT)
  createPartner("Lisbon Cargo Lda", "Lisbon", "PT", "Portugal", 38.7223, -9.1393, "lisbon-cargo.pt"),
  createPartner("Porto Logistics", "Porto", "PT", "Portugal", 41.1579, -8.6291, "porto-log.pt"),
  
  // Greece (GR)
  createPartner("Piraeus Shipping SA", "Piraeus", "GR", "Greece", 37.9475, 23.6469, "piraeus-ship.gr"),
  createPartner("Athens Cargo AE", "Athens", "GR", "Greece", 37.9838, 23.7275, "athens-cargo.gr"),
  
  // Sweden (SE)
  createPartner("Stockholm Freight AB", "Stockholm", "SE", "Sweden", 59.3293, 18.0686, "sfa.se"),
  createPartner("Gothenburg Logistics", "Gothenburg", "SE", "Sweden", 57.7089, 11.9746, "glog.se"),
  
  // Norway (NO)
  createPartner("Oslo Shipping AS", "Oslo", "NO", "Norway", 59.9139, 10.7522, "osa.no"),
  createPartner("Bergen Freight", "Bergen", "NO", "Norway", 60.3913, 5.3221, "bergen-freight.no"),
  
  // Denmark (DK)
  createPartner("Copenhagen Cargo ApS", "Copenhagen", "DK", "Denmark", 55.6761, 12.5683, "cph-cargo.dk"),
  
  // Finland (FI)
  createPartner("Helsinki Logistics Oy", "Helsinki", "FI", "Finland", 60.1699, 24.9384, "hel-log.fi"),
  
  // Ireland (IE)
  createPartner("Dublin Freight Ltd", "Dublin", "IE", "Ireland", 53.3498, -6.2603, "dublinfreight.ie"),
  
  // Czech Republic (CZ)
  createPartner("Prague Cargo s.r.o.", "Prague", "CZ", "Czech Republic", 50.0755, 14.4378, "prague-cargo.cz"),
  
  // Hungary (HU)
  createPartner("Budapest Logistics Kft", "Budapest", "HU", "Hungary", 47.4979, 19.0402, "bp-log.hu"),
  
  // Romania (RO)
  createPartner("Bucharest Freight SRL", "Bucharest", "RO", "Romania", 44.4268, 26.1025, "buc-freight.ro"),
  
  // Ukraine (UA)
  createPartner("Kyiv Cargo LLC", "Kyiv", "UA", "Ukraine", 50.4501, 30.5234, "kyiv-cargo.ua"),
  createPartner("Odessa Port Services", "Odessa", "UA", "Ukraine", 46.4825, 30.7233, "ops.ua"),
  
  // Russia (RU)
  createPartner("Moscow Freight Services", "Moscow", "RU", "Russia", 55.7558, 37.6173, "mfs.ru"),
  createPartner("St Petersburg Logistics", "St Petersburg", "RU", "Russia", 59.9311, 30.3609, "spb-log.ru"),
  createPartner("Vladivostok Cargo", "Vladivostok", "RU", "Russia", 43.1332, 131.9113, "vlad-cargo.ru"),
  
  // Turkey (TR)
  createPartner("Istanbul Lojistik A.Ş.", "Istanbul", "TR", "Turkey", 41.0082, 28.9784, "istanbul-log.com.tr"),
  createPartner("Izmir Freight", "Izmir", "TR", "Turkey", 38.4237, 27.1428, "izmir-freight.com.tr"),
  
  // === ASIA ===
  // China (CN)
  createPartner("Shanghai Express Logistics", "Shanghai", "CN", "China", 31.2304, 121.4737, "sel.cn"),
  createPartner("Beijing Cargo Services", "Beijing", "CN", "China", 39.9042, 116.4074, "bcs.cn"),
  createPartner("Guangzhou Shipping Co", "Guangzhou", "CN", "China", 23.1291, 113.2644, "gzsc.cn"),
  createPartner("Shenzhen Freight", "Shenzhen", "CN", "China", 22.5431, 114.0579, "szf.cn"),
  createPartner("Ningbo Port Logistics", "Ningbo", "CN", "China", 29.8683, 121.544, "npl.cn"),
  
  // Japan (JP)
  createPartner("Tokyo Logistics Corp", "Tokyo", "JP", "Japan", 35.6762, 139.6503, "tlc.jp"),
  createPartner("Osaka Freight Services", "Osaka", "JP", "Japan", 34.6937, 135.5023, "ofs.jp"),
  createPartner("Yokohama Shipping", "Yokohama", "JP", "Japan", 35.4437, 139.638, "yokohama-ship.jp"),
  
  // South Korea (KR)
  createPartner("Seoul Air Cargo", "Seoul", "KR", "South Korea", 37.5665, 126.978, "sac.kr"),
  createPartner("Busan Port Logistics", "Busan", "KR", "South Korea", 35.1796, 129.0756, "bpl.kr"),
  
  // India (IN)
  createPartner("Mumbai Express Logistics", "Mumbai", "IN", "India", 19.076, 72.8777, "mel.in"),
  createPartner("Delhi Cargo Services", "New Delhi", "IN", "India", 28.6139, 77.209, "dcs.in"),
  createPartner("Chennai Freight", "Chennai", "IN", "India", 13.0827, 80.2707, "chennai-freight.in"),
  createPartner("Bangalore Logistics", "Bangalore", "IN", "India", 12.9716, 77.5946, "blr-log.in"),
  
  // Singapore (SG)
  createPartner("Singapore Air Cargo Pte Ltd", "Singapore", "SG", "Singapore", 1.3521, 103.8198, "sac.sg"),
  createPartner("Lion City Logistics", "Singapore", "SG", "Singapore", 1.3521, 103.8198, "lcl.sg"),
  
  // Hong Kong (HK)
  createPartner("Hong Kong Freight Ltd", "Hong Kong", "HK", "Hong Kong", 22.3193, 114.1694, "hkf.hk"),
  createPartner("Victoria Harbour Logistics", "Hong Kong", "HK", "Hong Kong", 22.3193, 114.1694, "vhl.hk"),
  
  // Taiwan (TW)
  createPartner("Taipei Cargo Services", "Taipei", "TW", "Taiwan", 25.033, 121.5654, "tcs.tw"),
  createPartner("Kaohsiung Port Logistics", "Kaohsiung", "TW", "Taiwan", 22.6273, 120.3014, "kpl.tw"),
  
  // Thailand (TH)
  createPartner("Bangkok Freight Co Ltd", "Bangkok", "TH", "Thailand", 13.7563, 100.5018, "bfc.co.th"),
  createPartner("Laem Chabang Port Services", "Chonburi", "TH", "Thailand", 13.0833, 100.8833, "lcps.co.th"),
  
  // Vietnam (VN)
  createPartner("Ho Chi Minh Logistics", "Ho Chi Minh City", "VN", "Vietnam", 10.8231, 106.6297, "hcm-log.vn"),
  createPartner("Hanoi Cargo Services", "Hanoi", "VN", "Vietnam", 21.0285, 105.8542, "hanoi-cargo.vn"),
  
  // Malaysia (MY)
  createPartner("Kuala Lumpur Freight", "Kuala Lumpur", "MY", "Malaysia", 3.139, 101.6869, "klf.my"),
  createPartner("Port Klang Logistics", "Port Klang", "MY", "Malaysia", 3.0319, 101.3685, "pkl.my"),
  
  // Indonesia (ID)
  createPartner("Jakarta Freight Services", "Jakarta", "ID", "Indonesia", -6.2088, 106.8456, "jfs.co.id"),
  createPartner("Surabaya Cargo", "Surabaya", "ID", "Indonesia", -7.2575, 112.7521, "surabaya-cargo.co.id"),
  
  // Philippines (PH)
  createPartner("Manila Freight Inc", "Manila", "PH", "Philippines", 14.5995, 120.9842, "mfi.ph"),
  createPartner("Cebu Cargo Services", "Cebu City", "PH", "Philippines", 10.3157, 123.8854, "ccs.ph"),
  
  // Pakistan (PK)
  createPartner("Karachi Port Logistics", "Karachi", "PK", "Pakistan", 24.8607, 67.0011, "kpl.pk"),
  createPartner("Lahore Freight Services", "Lahore", "PK", "Pakistan", 31.5204, 74.3587, "lfs.pk"),
  
  // Bangladesh (BD)
  createPartner("Dhaka Cargo Ltd", "Dhaka", "BD", "Bangladesh", 23.8103, 90.4125, "dcl.bd"),
  createPartner("Chittagong Port Services", "Chittagong", "BD", "Bangladesh", 22.3569, 91.7832, "cps.bd"),
  
  // Sri Lanka (LK)
  createPartner("Colombo Freight Services", "Colombo", "LK", "Sri Lanka", 6.9271, 79.8612, "cfs.lk"),
  
  // Kazakhstan (KZ)
  createPartner("Almaty Logistics", "Almaty", "KZ", "Kazakhstan", 43.238, 76.9458, "almaty-log.kz"),
  
  // Afghanistan (AF)
  createPartner("Kabul Freight Services", "Kabul", "AF", "Afghanistan", 34.5553, 69.2075, "kfs.af"),
  createPartner("Afghan Cargo Express", "Herat", "AF", "Afghanistan", 34.3529, 62.2043, "ace.af"),
  
  // Cambodia (KH)
  createPartner("Phnom Penh Logistics", "Phnom Penh", "KH", "Cambodia", 11.5564, 104.9282, "ppl.kh"),
  createPartner("Sihanoukville Port Services", "Sihanoukville", "KH", "Cambodia", 10.6093, 103.5296, "sps.kh"),
  
  // === MIDDLE EAST ===
  // UAE (AE)
  createPartner("Dubai Cargo Hub LLC", "Dubai", "AE", "UAE", 25.2048, 55.2708, "dch.ae"),
  createPartner("Abu Dhabi Logistics", "Abu Dhabi", "AE", "UAE", 24.4539, 54.3773, "adl.ae"),
  createPartner("Jebel Ali Freight", "Dubai", "AE", "UAE", 25.0, 55.0, "jaf.ae"),
  
  // Saudi Arabia (SA)
  createPartner("Riyadh Freight Services", "Riyadh", "SA", "Saudi Arabia", 24.7136, 46.6753, "rfs.sa"),
  createPartner("Jeddah Port Logistics", "Jeddah", "SA", "Saudi Arabia", 21.4858, 39.1925, "jpl.sa"),
  createPartner("Dammam Cargo", "Dammam", "SA", "Saudi Arabia", 26.4207, 50.0888, "dammam-cargo.sa"),
  
  // Qatar (QA)
  createPartner("Doha Freight Services", "Doha", "QA", "Qatar", 25.2854, 51.531, "dfs.qa"),
  createPartner("Qatar Cargo Solutions", "Doha", "QA", "Qatar", 25.2854, 51.531, "qcs.qa"),
  
  // Kuwait (KW)
  createPartner("Kuwait City Logistics", "Kuwait City", "KW", "Kuwait", 29.3759, 47.9774, "kcl.kw"),
  
  // Bahrain (BH)
  createPartner("Manama Freight Co", "Manama", "BH", "Bahrain", 26.0667, 50.5577, "mfc.bh"),
  
  // Oman (OM)
  createPartner("Muscat Logistics LLC", "Muscat", "OM", "Oman", 23.588, 58.3829, "muscat-log.om"),
  
  // Lebanon (LB)
  createPartner("Beirut Freight SARL", "Beirut", "LB", "Lebanon", 33.8938, 35.5018, "beirut-freight.lb"),
  createPartner("Lebanese Cargo Services", "Beirut", "LB", "Lebanon", 33.8938, 35.5018, "lcs.lb"),
  
  // Jordan (JO)
  createPartner("Amman Logistics", "Amman", "JO", "Jordan", 31.9454, 35.9284, "amman-log.jo"),
  createPartner("Aqaba Port Services", "Aqaba", "JO", "Jordan", 29.5267, 35.0078, "aps.jo"),
  
  // Israel (IL)
  createPartner("Tel Aviv Freight Ltd", "Tel Aviv", "IL", "Israel", 32.0853, 34.7818, "taf.il"),
  createPartner("Haifa Port Logistics", "Haifa", "IL", "Israel", 32.7940, 34.9896, "hpl.il"),
  
  // Iran (IR)
  createPartner("Tehran Cargo Services", "Tehran", "IR", "Iran", 35.6892, 51.389, "tcs.ir"),
  
  // Iraq (IQ)
  createPartner("Baghdad Freight", "Baghdad", "IQ", "Iraq", 33.3152, 44.3661, "baghdad-freight.iq"),
  
  // === AMERICAS ===
  // United States (US)
  createPartner("New York Freight Inc", "New York", "US", "United States", 40.7128, -74.006, "nyf.com"),
  createPartner("LA Cargo Solutions", "Los Angeles", "US", "United States", 34.0522, -118.2437, "lacs.com"),
  createPartner("Chicago Logistics LLC", "Chicago", "US", "United States", 41.8781, -87.6298, "cll.com"),
  createPartner("Miami Port Services", "Miami", "US", "United States", 25.7617, -80.1918, "mps.com"),
  createPartner("Houston Freight Corp", "Houston", "US", "United States", 29.7604, -95.3698, "hfc.com"),
  createPartner("Atlanta Cargo", "Atlanta", "US", "United States", 33.749, -84.388, "atl-cargo.com"),
  
  // Canada (CA)
  createPartner("Toronto Freight Services", "Toronto", "CA", "Canada", 43.6532, -79.3832, "tfs.ca"),
  createPartner("Vancouver Port Logistics", "Vancouver", "CA", "Canada", 49.2827, -123.1207, "vpl.ca"),
  createPartner("Montreal Cargo", "Montreal", "CA", "Canada", 45.5017, -73.5673, "mtl-cargo.ca"),
  
  // Mexico (MX)
  createPartner("Ciudad de México Logística", "Mexico City", "MX", "Mexico", 19.4326, -99.1332, "cdmx-log.mx"),
  createPartner("Guadalajara Freight", "Guadalajara", "MX", "Mexico", 20.6597, -103.3496, "gdl-freight.mx"),
  createPartner("Monterrey Cargo", "Monterrey", "MX", "Mexico", 25.6866, -100.3161, "mty-cargo.mx"),
  
  // Brazil (BR)
  createPartner("São Paulo Transporte Ltda", "São Paulo", "BR", "Brazil", -23.5505, -46.6333, "spt.com.br"),
  createPartner("Rio Cargo Express", "Rio de Janeiro", "BR", "Brazil", -22.9068, -43.1729, "rce.com.br"),
  createPartner("Santos Port Logistics", "Santos", "BR", "Brazil", -23.9608, -46.3336, "spl.com.br"),
  
  // Argentina (AR)
  createPartner("Buenos Aires Freight SA", "Buenos Aires", "AR", "Argentina", -34.6037, -58.3816, "baf.com.ar"),
  createPartner("Rosario Logistics", "Rosario", "AR", "Argentina", -32.9442, -60.6505, "rosario-log.com.ar"),
  createPartner("Mendoza Cargo", "Mendoza", "AR", "Argentina", -32.8895, -68.8458, "mendoza-cargo.com.ar"),
  
  // Chile (CL)
  createPartner("Santiago Freight Ltda", "Santiago", "CL", "Chile", -33.4489, -70.6693, "sfl.cl"),
  createPartner("Valparaíso Port Services", "Valparaíso", "CL", "Chile", -33.0472, -71.6127, "vps.cl"),
  
  // Colombia (CO)
  createPartner("Bogotá Logistics SAS", "Bogotá", "CO", "Colombia", 4.711, -74.0721, "bogota-log.co"),
  createPartner("Cartagena Freight", "Cartagena", "CO", "Colombia", 10.391, -75.4794, "cartagena-freight.co"),
  
  // Peru (PE)
  createPartner("Lima Cargo SAC", "Lima", "PE", "Peru", -12.0464, -77.0428, "lima-cargo.pe"),
  createPartner("Callao Port Logistics", "Callao", "PE", "Peru", -12.0432, -77.1428, "cpl.pe"),
  
  // Ecuador (EC)
  createPartner("Guayaquil Freight SA", "Guayaquil", "EC", "Ecuador", -2.1894, -79.8891, "gf.ec"),
  createPartner("Quito Logistics", "Quito", "EC", "Ecuador", -0.1807, -78.4678, "quito-log.ec"),
  
  // Venezuela (VE)
  createPartner("Caracas Cargo CA", "Caracas", "VE", "Venezuela", 10.4806, -66.9036, "caracas-cargo.ve"),
  
  // Uruguay (UY)
  createPartner("Montevideo Freight SA", "Montevideo", "UY", "Uruguay", -34.9011, -56.1645, "mvd-freight.uy"),
  
  // Paraguay (PY)
  createPartner("Asunción Logistics", "Asunción", "PY", "Paraguay", -25.2637, -57.5759, "asuncion-log.py"),
  
  // Bolivia (BO)
  createPartner("La Paz Cargo", "La Paz", "BO", "Bolivia", -16.5, -68.15, "lapaz-cargo.bo"),
  
  // Panama (PA)
  createPartner("Panama Canal Logistics", "Panama City", "PA", "Panama", 8.9824, -79.5199, "pcl.pa"),
  createPartner("Colón Free Zone Freight", "Colón", "PA", "Panama", 9.3597, -79.8999, "czf.pa"),
  
  // Costa Rica (CR)
  createPartner("San José Freight SA", "San José", "CR", "Costa Rica", 9.9281, -84.0907, "sjf.cr"),
  
  // Guatemala (GT)
  createPartner("Guatemala City Logistics", "Guatemala City", "GT", "Guatemala", 14.6349, -90.5069, "gcl.gt"),
  
  // Dominican Republic (DO)
  createPartner("Santo Domingo Cargo", "Santo Domingo", "DO", "Dominican Republic", 18.4861, -69.9312, "sdc.do"),
  
  // Puerto Rico (PR)
  createPartner("San Juan Freight Inc", "San Juan", "PR", "Puerto Rico", 18.4655, -66.1057, "sjf.pr"),
  
  // Jamaica (JM)
  createPartner("Kingston Port Logistics", "Kingston", "JM", "Jamaica", 18.1096, -77.2975, "kpl.jm"),
  
  // Trinidad and Tobago (TT)
  createPartner("Port of Spain Cargo", "Port of Spain", "TT", "Trinidad and Tobago", 10.6918, -61.2225, "posc.tt"),
  
  // === AFRICA ===
  // South Africa (ZA)
  createPartner("Cape Town Freight Pty Ltd", "Cape Town", "ZA", "South Africa", -33.9249, 18.4241, "ctf.za"),
  createPartner("Johannesburg Logistics", "Johannesburg", "ZA", "South Africa", -26.2041, 28.0473, "jhb-log.za"),
  createPartner("Durban Port Services", "Durban", "ZA", "South Africa", -29.8587, 31.0218, "dps.za"),
  
  // Egypt (EG)
  createPartner("Cairo Cargo Services", "Cairo", "EG", "Egypt", 30.0444, 31.2357, "ccs.eg"),
  createPartner("Alexandria Port Logistics", "Alexandria", "EG", "Egypt", 31.2001, 29.9187, "apl.eg"),
  createPartner("Port Said Freight", "Port Said", "EG", "Egypt", 31.2653, 32.3019, "psf.eg"),
  
  // Morocco (MA)
  createPartner("Casablanca Freight SARL", "Casablanca", "MA", "Morocco", 33.5731, -7.5898, "cf.ma"),
  createPartner("Tangier Port Logistics", "Tangier", "MA", "Morocco", 35.7595, -5.834, "tpl.ma"),
  
  // Nigeria (NG)
  createPartner("Lagos Freight Services", "Lagos", "NG", "Nigeria", 6.5244, 3.3792, "lfs.ng"),
  createPartner("Apapa Port Logistics", "Lagos", "NG", "Nigeria", 6.4488, 3.3589, "apl.ng"),
  
  // Kenya (KE)
  createPartner("Nairobi Cargo Ltd", "Nairobi", "KE", "Kenya", -1.2921, 36.8219, "ncl.ke"),
  createPartner("Mombasa Port Services", "Mombasa", "KE", "Kenya", -4.0435, 39.6682, "mps.ke"),
  
  // Ghana (GH)
  createPartner("Accra Freight Ltd", "Accra", "GH", "Ghana", 5.6037, -0.187, "afl.gh"),
  createPartner("Tema Port Logistics", "Tema", "GH", "Ghana", 5.6698, -0.0166, "tpl.gh"),
  
  // Tanzania (TZ)
  createPartner("Dar es Salaam Cargo", "Dar es Salaam", "TZ", "Tanzania", -6.7924, 39.2083, "dsc.tz"),
  
  // Ethiopia (ET)
  createPartner("Addis Ababa Logistics", "Addis Ababa", "ET", "Ethiopia", 9.0054, 38.7636, "aal.et"),
  
  // Côte d'Ivoire (CI)
  createPartner("Abidjan Port Freight", "Abidjan", "CI", "Côte d'Ivoire", 5.36, -4.0083, "apf.ci"),
  
  // Senegal (SN)
  createPartner("Dakar Freight SARL", "Dakar", "SN", "Senegal", 14.7167, -17.4677, "df.sn"),
  
  // Tunisia (TN)
  createPartner("Tunis Cargo Services", "Tunis", "TN", "Tunisia", 36.8065, 10.1815, "tcs.tn"),
  
  // Algeria (DZ)
  createPartner("Algiers Port Logistics", "Algiers", "DZ", "Algeria", 36.7538, 3.0588, "apl.dz"),
  
  // Angola (AO)
  createPartner("Luanda Freight Services", "Luanda", "AO", "Angola", -8.8399, 13.2894, "lfs.ao"),
  
  // Mauritius (MU)
  createPartner("Port Louis Cargo", "Port Louis", "MU", "Mauritius", -20.1609, 57.5012, "plc.mu"),
  
  // === OCEANIA ===
  // Australia (AU)
  createPartner("Sydney Freight Partners", "Sydney", "AU", "Australia", -33.8688, 151.2093, "sfp.com.au"),
  createPartner("Melbourne Cargo Co", "Melbourne", "AU", "Australia", -37.8136, 144.9631, "mcc.com.au"),
  createPartner("Brisbane Logistics", "Brisbane", "AU", "Australia", -27.4698, 153.0251, "bris-log.com.au"),
  createPartner("Perth Freight Services", "Perth", "AU", "Australia", -31.9505, 115.8605, "pfs.com.au"),
  
  // New Zealand (NZ)
  createPartner("Auckland Freight Ltd", "Auckland", "NZ", "New Zealand", -36.8509, 174.7645, "afl.co.nz"),
  createPartner("Wellington Logistics", "Wellington", "NZ", "New Zealand", -41.2865, 174.7762, "wlog.co.nz"),
  
  // Fiji (FJ)
  createPartner("Suva Port Services", "Suva", "FJ", "Fiji", -18.1416, 178.4419, "sps.fj"),
  
  // Papua New Guinea (PG)
  createPartner("Port Moresby Freight", "Port Moresby", "PG", "Papua New Guinea", -9.4438, 147.1803, "pmf.pg"),
];

// Get unique countries from partners
export const getCountriesWithPartners = () => {
  return MOCK_PARTNERS.reduce((acc, p) => {
    if (!acc[p.country_code]) {
      acc[p.country_code] = {
        code: p.country_code,
        name: p.country_name,
        count: 0,
        lat: p.lat,
        lng: p.lng,
      };
    }
    acc[p.country_code].count++;
    return acc;
  }, {} as Record<string, { code: string; name: string; count: number; lat: number; lng: number }>);
};

export const COUNTRIES_WITH_PARTNERS = getCountriesWithPartners();
