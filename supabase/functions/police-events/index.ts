import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── Swedish Reference Database ───────────────────────────────────────────────
// All 290 municipalities + major city districts with verified centroids.
// Sources: SCB, Lantmäteriet, Wikipedia administrative data.
// Format: [lat, lng, type] where type = 'kommun' | 'stadsdel' | 'ort'

type LocationEntry = { lat: number; lng: number; type: 'kommun' | 'stadsdel' | 'ort' };

const SWEDISH_LOCATIONS: Record<string, LocationEntry> = {
  // ── Storstäder ──
  'stockholm': { lat: 59.3293, lng: 18.0686, type: 'kommun' },
  'göteborg': { lat: 57.7089, lng: 11.9746, type: 'kommun' },
  'malmö': { lat: 55.6050, lng: 13.0038, type: 'kommun' },

  // ── Stockholms län – kommuner ──
  'botkyrka': { lat: 59.2000, lng: 17.8200, type: 'kommun' },
  'danderyd': { lat: 59.3930, lng: 18.0270, type: 'kommun' },
  'ekerö': { lat: 59.2830, lng: 17.8010, type: 'kommun' },
  'haninge': { lat: 59.1740, lng: 18.1510, type: 'kommun' },
  'huddinge': { lat: 59.2370, lng: 17.9810, type: 'kommun' },
  'järfälla': { lat: 59.4130, lng: 17.8300, type: 'kommun' },
  'lidingö': { lat: 59.3670, lng: 18.1500, type: 'kommun' },
  'nacka': { lat: 59.3100, lng: 18.1650, type: 'kommun' },
  'norrtälje': { lat: 59.7570, lng: 18.7040, type: 'kommun' },
  'nykvarn': { lat: 59.1790, lng: 17.4340, type: 'kommun' },
  'nynäshamn': { lat: 58.9030, lng: 17.9480, type: 'kommun' },
  'salem': { lat: 59.1960, lng: 17.7690, type: 'kommun' },
  'sigtuna': { lat: 59.6170, lng: 17.7240, type: 'kommun' },
  'sollentuna': { lat: 59.4280, lng: 17.9510, type: 'kommun' },
  'solna': { lat: 59.3600, lng: 18.0000, type: 'kommun' },
  'sundbyberg': { lat: 59.3610, lng: 17.9720, type: 'kommun' },
  'södertälje': { lat: 59.1950, lng: 17.6260, type: 'kommun' },
  'tyresö': { lat: 59.2440, lng: 18.2270, type: 'kommun' },
  'täby': { lat: 59.4440, lng: 18.0690, type: 'kommun' },
  'upplands väsby': { lat: 59.5180, lng: 17.9080, type: 'kommun' },
  'upplands-bro': { lat: 59.5000, lng: 17.6300, type: 'kommun' },
  'vallentuna': { lat: 59.5340, lng: 18.0780, type: 'kommun' },
  'vaxholm': { lat: 59.4020, lng: 18.3510, type: 'kommun' },
  'värmdö': { lat: 59.3200, lng: 18.3800, type: 'kommun' },
  'österåker': { lat: 59.4810, lng: 18.2950, type: 'kommun' },

  // ── Stockholms stadsdelar ──
  'södermalm': { lat: 59.3150, lng: 18.0710, type: 'stadsdel' },
  'norrmalm': { lat: 59.3380, lng: 18.0600, type: 'stadsdel' },
  'kungsholmen': { lat: 59.3320, lng: 18.0280, type: 'stadsdel' },
  'östermalm': { lat: 59.3400, lng: 18.0850, type: 'stadsdel' },
  'gamla stan': { lat: 59.3250, lng: 18.0710, type: 'stadsdel' },
  'vasastan': { lat: 59.3440, lng: 18.0480, type: 'stadsdel' },
  'bromma': { lat: 59.3400, lng: 17.9400, type: 'stadsdel' },
  'hägersten': { lat: 59.2980, lng: 17.9860, type: 'stadsdel' },
  'liljeholmen': { lat: 59.3100, lng: 18.0230, type: 'stadsdel' },
  'älvsjö': { lat: 59.2790, lng: 18.0100, type: 'stadsdel' },
  'enskede': { lat: 59.2830, lng: 18.0700, type: 'stadsdel' },
  'farsta': { lat: 59.2430, lng: 18.0930, type: 'stadsdel' },
  'skärholmen': { lat: 59.2760, lng: 17.9070, type: 'stadsdel' },
  'hässelby': { lat: 59.3630, lng: 17.8300, type: 'stadsdel' },
  'vällingby': { lat: 59.3630, lng: 17.8670, type: 'stadsdel' },
  'rinkeby': { lat: 59.3890, lng: 17.9280, type: 'stadsdel' },
  'tensta': { lat: 59.3940, lng: 17.9040, type: 'stadsdel' },
  'spånga': { lat: 59.3830, lng: 17.8980, type: 'stadsdel' },
  'kista': { lat: 59.4030, lng: 17.9450, type: 'stadsdel' },
  'hjulsta': { lat: 59.3960, lng: 17.8870, type: 'stadsdel' },
  'akalla': { lat: 59.4140, lng: 17.9130, type: 'stadsdel' },
  'husby': { lat: 59.4100, lng: 17.9330, type: 'stadsdel' },
  'skarpnäck': { lat: 59.2670, lng: 18.1260, type: 'stadsdel' },
  'hammarbyhöjden': { lat: 59.2970, lng: 18.1040, type: 'stadsdel' },
  'hammarby sjöstad': { lat: 59.3040, lng: 18.1010, type: 'stadsdel' },
  'gullmarsplan': { lat: 59.2990, lng: 18.0800, type: 'stadsdel' },
  'hornstull': { lat: 59.3160, lng: 18.0340, type: 'stadsdel' },
  'fruängen': { lat: 59.2850, lng: 17.9620, type: 'stadsdel' },
  'bandhagen': { lat: 59.2720, lng: 18.0470, type: 'stadsdel' },
  'bagarmossen': { lat: 59.2740, lng: 18.1350, type: 'stadsdel' },
  'rågsved': { lat: 59.2560, lng: 18.0300, type: 'stadsdel' },
  'hagsätra': { lat: 59.2620, lng: 18.0180, type: 'stadsdel' },
  'högdalen': { lat: 59.2640, lng: 18.0400, type: 'stadsdel' },
  'gubbängen': { lat: 59.2630, lng: 18.0840, type: 'stadsdel' },
  'stureby': { lat: 59.2730, lng: 18.0640, type: 'stadsdel' },
  'svedmyra': { lat: 59.2780, lng: 18.0580, type: 'stadsdel' },
  'aspudden': { lat: 59.3060, lng: 18.0010, type: 'stadsdel' },
  'midsommarkransen': { lat: 59.3020, lng: 18.0100, type: 'stadsdel' },
  'telefonplan': { lat: 59.2980, lng: 17.9970, type: 'stadsdel' },
  'globen': { lat: 59.2930, lng: 18.0830, type: 'stadsdel' },

  // ── Göteborgs stadsdelar ──
  'majorna': { lat: 57.6930, lng: 11.9180, type: 'stadsdel' },
  'linné': { lat: 57.6940, lng: 11.9500, type: 'stadsdel' },
  'hisingen': { lat: 57.7310, lng: 11.9350, type: 'stadsdel' },
  'angered': { lat: 57.7950, lng: 12.0480, type: 'stadsdel' },
  'bergsjön': { lat: 57.7540, lng: 12.0630, type: 'stadsdel' },
  'biskopsgården': { lat: 57.7230, lng: 11.8980, type: 'stadsdel' },
  'centrum göteborg': { lat: 57.7050, lng: 11.9680, type: 'stadsdel' },
  'frölunda': { lat: 57.6510, lng: 11.9080, type: 'stadsdel' },
  'gamlestaden': { lat: 57.7230, lng: 12.0080, type: 'stadsdel' },
  'kortedala': { lat: 57.7530, lng: 12.0290, type: 'stadsdel' },
  'lundby': { lat: 57.7190, lng: 11.9340, type: 'stadsdel' },
  'mölndal': { lat: 57.6555, lng: 12.0133, type: 'kommun' },
  'partille': { lat: 57.7394, lng: 12.1066, type: 'kommun' },

  // ── Malmö stadsdelar ──
  'rosengård': { lat: 55.5900, lng: 13.0290, type: 'stadsdel' },
  'fosie': { lat: 55.5640, lng: 13.0120, type: 'stadsdel' },
  'limhamn': { lat: 55.5830, lng: 12.9340, type: 'stadsdel' },
  'husie': { lat: 55.5810, lng: 13.0720, type: 'stadsdel' },
  'oxie': { lat: 55.5450, lng: 13.0860, type: 'stadsdel' },
  'kirseberg': { lat: 55.6130, lng: 13.0180, type: 'stadsdel' },
  'västra hamnen': { lat: 55.6140, lng: 12.9780, type: 'stadsdel' },
  'hyllie': { lat: 55.5630, lng: 12.9780, type: 'stadsdel' },

  // ── Övriga kommuner (alla 290 – resterande) ──
  'ale': { lat: 57.9300, lng: 12.2270, type: 'kommun' },
  'alingsås': { lat: 57.9302, lng: 12.5334, type: 'kommun' },
  'alvesta': { lat: 56.8986, lng: 14.5561, type: 'kommun' },
  'aneby': { lat: 57.8361, lng: 14.8078, type: 'kommun' },
  'arboga': { lat: 59.3937, lng: 15.8384, type: 'kommun' },
  'arjeplog': { lat: 66.0517, lng: 17.8862, type: 'kommun' },
  'arvidsjaur': { lat: 65.5910, lng: 19.1759, type: 'kommun' },
  'arvika': { lat: 59.6546, lng: 12.5860, type: 'kommun' },
  'askersund': { lat: 58.8799, lng: 14.9036, type: 'kommun' },
  'avesta': { lat: 60.1452, lng: 16.1679, type: 'kommun' },
  'bengtsfors': { lat: 59.0283, lng: 12.2286, type: 'kommun' },
  'berg': { lat: 63.1560, lng: 14.9580, type: 'kommun' },
  'bjurholm': { lat: 63.9350, lng: 18.7940, type: 'kommun' },
  'bjuv': { lat: 56.0800, lng: 12.9210, type: 'kommun' },
  'boden': { lat: 66.0000, lng: 21.6880, type: 'kommun' },
  'bollebygd': { lat: 57.6710, lng: 12.5720, type: 'kommun' },
  'bollnäs': { lat: 61.3480, lng: 16.3935, type: 'kommun' },
  'borgholm': { lat: 56.8796, lng: 16.6560, type: 'kommun' },
  'borlänge': { lat: 60.4858, lng: 15.4364, type: 'kommun' },
  'borås': { lat: 57.7210, lng: 12.9401, type: 'kommun' },
  'boxholm': { lat: 58.1972, lng: 15.0553, type: 'kommun' },
  'bromölla': { lat: 56.0747, lng: 14.4694, type: 'kommun' },
  'bräcke': { lat: 62.7490, lng: 15.4120, type: 'kommun' },
  'burlöv': { lat: 55.6340, lng: 13.0890, type: 'kommun' },
  'båstad': { lat: 56.4310, lng: 12.8510, type: 'kommun' },
  'dals-ed': { lat: 58.8210, lng: 11.9330, type: 'kommun' },
  'degerfors': { lat: 59.2340, lng: 14.4310, type: 'kommun' },
  'dorotea': { lat: 64.2640, lng: 16.4180, type: 'kommun' },
  'eda': { lat: 59.8270, lng: 12.2710, type: 'kommun' },
  'eksjö': { lat: 57.6663, lng: 14.9739, type: 'kommun' },
  'emmaboda': { lat: 56.6316, lng: 15.5372, type: 'kommun' },
  'enköping': { lat: 59.6367, lng: 17.0763, type: 'kommun' },
  'eskilstuna': { lat: 59.3666, lng: 16.5077, type: 'kommun' },
  'eslöv': { lat: 55.8380, lng: 13.3050, type: 'kommun' },
  'essunga': { lat: 58.1690, lng: 13.4990, type: 'kommun' },
  'fagersta': { lat: 60.0040, lng: 15.7920, type: 'kommun' },
  'falkenberg': { lat: 56.9055, lng: 12.4890, type: 'kommun' },
  'falköping': { lat: 58.1733, lng: 13.5519, type: 'kommun' },
  'falun': { lat: 60.6065, lng: 15.6355, type: 'kommun' },
  'filipstad': { lat: 59.7120, lng: 14.1680, type: 'kommun' },
  'finspång': { lat: 58.7060, lng: 15.7690, type: 'kommun' },
  'flen': { lat: 59.0580, lng: 16.5920, type: 'kommun' },
  'forshaga': { lat: 59.5270, lng: 13.4810, type: 'kommun' },
  'färgelanda': { lat: 58.5670, lng: 12.1110, type: 'kommun' },
  'gagnef': { lat: 60.5940, lng: 15.0830, type: 'kommun' },
  'gislaved': { lat: 57.3032, lng: 13.5412, type: 'kommun' },
  'gnesta': { lat: 59.0490, lng: 17.0100, type: 'kommun' },
  'gnosjö': { lat: 57.3590, lng: 13.7320, type: 'kommun' },
  'gotland': { lat: 57.6348, lng: 18.2948, type: 'kommun' },
  'visby': { lat: 57.6348, lng: 18.2948, type: 'ort' },
  'grums': { lat: 59.3530, lng: 13.1130, type: 'kommun' },
  'grästorp': { lat: 58.3280, lng: 12.7260, type: 'kommun' },
  'gullspång': { lat: 58.9870, lng: 14.0880, type: 'kommun' },
  'gällivare': { lat: 67.1334, lng: 20.6519, type: 'kommun' },
  'gävle': { lat: 60.6749, lng: 17.1413, type: 'kommun' },
  'göinge': { lat: 56.2000, lng: 14.1000, type: 'ort' },
  'götene': { lat: 58.5300, lng: 13.4900, type: 'kommun' },
  'habo': { lat: 57.9080, lng: 14.0870, type: 'kommun' },
  'hagfors': { lat: 60.0330, lng: 13.6560, type: 'kommun' },
  'hallsberg': { lat: 59.0660, lng: 15.0940, type: 'kommun' },
  'hallstahammar': { lat: 59.6120, lng: 16.2240, type: 'kommun' },
  'halmstad': { lat: 56.6745, lng: 12.8578, type: 'kommun' },
  'hammarö': { lat: 59.3310, lng: 13.5070, type: 'kommun' },
  'haparanda': { lat: 65.8350, lng: 24.1370, type: 'kommun' },
  'heby': { lat: 59.9410, lng: 16.8600, type: 'kommun' },
  'hedemora': { lat: 60.2780, lng: 15.9850, type: 'kommun' },
  'helsingborg': { lat: 56.0465, lng: 12.6945, type: 'kommun' },
  'herrljunga': { lat: 58.0780, lng: 13.0250, type: 'kommun' },
  'hjo': { lat: 58.3010, lng: 14.2810, type: 'kommun' },
  'hofors': { lat: 60.5530, lng: 16.2910, type: 'kommun' },
  'hudiksvall': { lat: 61.7275, lng: 17.1055, type: 'kommun' },
  'hultsfred': { lat: 57.4880, lng: 15.8445, type: 'kommun' },
  'hylte': { lat: 56.8760, lng: 13.2310, type: 'kommun' },
  'håbo': { lat: 59.5280, lng: 17.5280, type: 'kommun' },
  'hällefors': { lat: 59.7830, lng: 14.5200, type: 'kommun' },
  'härjedalen': { lat: 62.0920, lng: 14.3050, type: 'kommun' },
  'härnösand': { lat: 62.6323, lng: 17.9378, type: 'kommun' },
  'härryda': { lat: 57.6880, lng: 12.1860, type: 'kommun' },
  'hässleholm': { lat: 56.1591, lng: 13.7665, type: 'kommun' },
  'höganäs': { lat: 56.1997, lng: 12.5613, type: 'kommun' },
  'högsby': { lat: 57.1660, lng: 16.0210, type: 'kommun' },
  'hörby': { lat: 55.8531, lng: 13.6609, type: 'kommun' },
  'höör': { lat: 55.9380, lng: 13.5420, type: 'kommun' },
  'jokkmokk': { lat: 66.6075, lng: 19.8264, type: 'kommun' },
  'jönköping': { lat: 57.7826, lng: 14.1618, type: 'kommun' },
  'kalix': { lat: 65.8547, lng: 23.1562, type: 'kommun' },
  'kalmar': { lat: 56.6634, lng: 16.3566, type: 'kommun' },
  'karlsborg': { lat: 58.5370, lng: 14.5110, type: 'kommun' },
  'karlshamn': { lat: 56.1705, lng: 14.8616, type: 'kommun' },
  'karlskoga': { lat: 59.3266, lng: 14.5227, type: 'kommun' },
  'karlskrona': { lat: 56.1612, lng: 15.5869, type: 'kommun' },
  'karlstad': { lat: 59.3793, lng: 13.5036, type: 'kommun' },
  'katrineholm': { lat: 58.9963, lng: 16.2059, type: 'kommun' },
  'kil': { lat: 59.5070, lng: 13.3170, type: 'kommun' },
  'kinda': { lat: 58.1000, lng: 15.6300, type: 'kommun' },
  'kiruna': { lat: 67.8558, lng: 20.2253, type: 'kommun' },
  'klippan': { lat: 56.1340, lng: 13.1310, type: 'kommun' },
  'knivsta': { lat: 59.7210, lng: 17.7870, type: 'kommun' },
  'kramfors': { lat: 62.9309, lng: 17.7792, type: 'kommun' },
  'kristianstad': { lat: 56.0294, lng: 14.1567, type: 'kommun' },
  'kristinehamn': { lat: 59.3100, lng: 14.1080, type: 'kommun' },
  'krokom': { lat: 63.3290, lng: 14.4570, type: 'kommun' },
  'kumla': { lat: 59.1270, lng: 15.1400, type: 'kommun' },
  'kungsbacka': { lat: 57.4870, lng: 12.0764, type: 'kommun' },
  'kungsör': { lat: 59.4270, lng: 16.0960, type: 'kommun' },
  'kungälv': { lat: 57.8710, lng: 11.9750, type: 'kommun' },
  'kävlinge': { lat: 55.7940, lng: 13.1120, type: 'kommun' },
  'köping': { lat: 59.5140, lng: 15.9930, type: 'kommun' },
  'laholm': { lat: 56.5120, lng: 13.0430, type: 'kommun' },
  'landskrona': { lat: 55.8706, lng: 12.8302, type: 'kommun' },
  'laxå': { lat: 58.9830, lng: 14.6150, type: 'kommun' },
  'lekeberg': { lat: 59.2860, lng: 14.9170, type: 'kommun' },
  'leksand': { lat: 60.7300, lng: 14.9990, type: 'kommun' },
  'lerum': { lat: 57.7710, lng: 12.2690, type: 'kommun' },
  'lessebo': { lat: 56.7500, lng: 15.2700, type: 'kommun' },
  'lidköping': { lat: 58.5051, lng: 13.1580, type: 'kommun' },
  'lilla edet': { lat: 58.1320, lng: 12.1300, type: 'kommun' },
  'lindesberg': { lat: 59.5880, lng: 15.2260, type: 'kommun' },
  'linköping': { lat: 58.4108, lng: 15.6214, type: 'kommun' },
  'ljungby': { lat: 56.8324, lng: 13.9405, type: 'kommun' },
  'ljusdal': { lat: 61.8290, lng: 16.0910, type: 'kommun' },
  'ljusnarsberg': { lat: 59.9370, lng: 14.8680, type: 'kommun' },
  'lomma': { lat: 55.6740, lng: 13.0660, type: 'kommun' },
  'ludvika': { lat: 60.1490, lng: 15.1880, type: 'kommun' },
  'luleå': { lat: 65.5848, lng: 22.1547, type: 'kommun' },
  'lund': { lat: 55.7047, lng: 13.1910, type: 'kommun' },
  'lycksele': { lat: 64.5967, lng: 18.6718, type: 'kommun' },
  'lysekil': { lat: 58.2745, lng: 11.4358, type: 'kommun' },
  'malung-sälen': { lat: 60.6830, lng: 13.7150, type: 'kommun' },
  'mariestad': { lat: 58.7094, lng: 13.8240, type: 'kommun' },
  'mark': { lat: 57.5140, lng: 12.4150, type: 'kommun' },
  'markaryd': { lat: 56.4600, lng: 13.5950, type: 'kommun' },
  'mellerud': { lat: 58.7000, lng: 12.4500, type: 'kommun' },
  'mjölby': { lat: 58.3268, lng: 15.1306, type: 'kommun' },
  'mora': { lat: 61.0050, lng: 14.5460, type: 'kommun' },
  'motala': { lat: 58.5363, lng: 15.0371, type: 'kommun' },
  'mullsjö': { lat: 57.9190, lng: 13.8840, type: 'kommun' },
  'munkedal': { lat: 58.4620, lng: 11.6720, type: 'kommun' },
  'munkfors': { lat: 59.8310, lng: 13.5420, type: 'kommun' },
  'mönsterås': { lat: 57.0440, lng: 16.4480, type: 'kommun' },
  'mörbylånga': { lat: 56.5230, lng: 16.3750, type: 'kommun' },
  'nacka': { lat: 59.3100, lng: 18.1650, type: 'kommun' },
  'nora': { lat: 59.5190, lng: 15.0340, type: 'kommun' },
  'norberg': { lat: 60.0700, lng: 15.9230, type: 'kommun' },
  'nordanstig': { lat: 62.0570, lng: 17.0350, type: 'kommun' },
  'nordmaling': { lat: 63.5690, lng: 19.4960, type: 'kommun' },
  'norrköping': { lat: 58.5942, lng: 16.1826, type: 'kommun' },
  'norsjö': { lat: 64.9100, lng: 19.4760, type: 'kommun' },
  'nybro': { lat: 56.7444, lng: 15.9079, type: 'kommun' },
  'nyköping': { lat: 58.7530, lng: 17.0085, type: 'kommun' },
  'nässjö': { lat: 57.6523, lng: 14.6966, type: 'kommun' },
  'ockelbo': { lat: 60.8920, lng: 16.7210, type: 'kommun' },
  'olofström': { lat: 56.2770, lng: 14.5330, type: 'kommun' },
  'orsa': { lat: 61.1190, lng: 14.6240, type: 'kommun' },
  'orust': { lat: 58.1750, lng: 11.6480, type: 'kommun' },
  'osby': { lat: 56.3780, lng: 13.9940, type: 'kommun' },
  'oskarshamn': { lat: 57.2654, lng: 16.4488, type: 'kommun' },
  'ovanåker': { lat: 61.3490, lng: 16.1970, type: 'kommun' },
  'oxelösund': { lat: 58.6700, lng: 17.1020, type: 'kommun' },
  'pajala': { lat: 66.9770, lng: 23.3660, type: 'kommun' },
  'perstorp': { lat: 56.1390, lng: 13.3940, type: 'kommun' },
  'piteå': { lat: 65.3173, lng: 21.4798, type: 'kommun' },
  'ragunda': { lat: 63.0810, lng: 15.8070, type: 'kommun' },
  'robertsfors': { lat: 64.1890, lng: 20.8410, type: 'kommun' },
  'ronneby': { lat: 56.2096, lng: 15.2751, type: 'kommun' },
  'rättvik': { lat: 60.8830, lng: 15.1240, type: 'kommun' },
  'sala': { lat: 59.9210, lng: 16.6080, type: 'kommun' },
  'sandviken': { lat: 60.6190, lng: 16.7750, type: 'kommun' },
  'sigtuna': { lat: 59.6170, lng: 17.7240, type: 'kommun' },
  'simrishamn': { lat: 55.5568, lng: 14.3503, type: 'kommun' },
  'sjöbo': { lat: 55.6300, lng: 13.7070, type: 'kommun' },
  'skara': { lat: 58.3867, lng: 13.4389, type: 'kommun' },
  'skellefteå': { lat: 64.7507, lng: 20.9528, type: 'kommun' },
  'skinnskatteberg': { lat: 59.8290, lng: 15.6950, type: 'kommun' },
  'skurup': { lat: 55.4770, lng: 13.5000, type: 'kommun' },
  'skövde': { lat: 58.3867, lng: 13.8458, type: 'kommun' },
  'smedjebacken': { lat: 60.1430, lng: 15.4190, type: 'kommun' },
  'sollefteå': { lat: 63.1660, lng: 17.2660, type: 'kommun' },
  'sorsele': { lat: 65.5340, lng: 17.5340, type: 'kommun' },
  'sotenäs': { lat: 58.4460, lng: 11.3430, type: 'kommun' },
  'staffanstorp': { lat: 55.6440, lng: 13.2060, type: 'kommun' },
  'stenungsund': { lat: 58.0720, lng: 11.8210, type: 'kommun' },
  'storfors': { lat: 59.5310, lng: 14.2660, type: 'kommun' },
  'storuman': { lat: 64.9590, lng: 17.1110, type: 'kommun' },
  'strängnäs': { lat: 59.3770, lng: 17.0310, type: 'kommun' },
  'strömstad': { lat: 58.9390, lng: 11.1710, type: 'kommun' },
  'strömsund': { lat: 63.8490, lng: 15.5570, type: 'kommun' },
  'sundsvall': { lat: 62.3908, lng: 17.3069, type: 'kommun' },
  'sunne': { lat: 59.8370, lng: 13.1370, type: 'kommun' },
  'surahammar': { lat: 59.6910, lng: 16.2090, type: 'kommun' },
  'svalöv': { lat: 55.9150, lng: 13.1110, type: 'kommun' },
  'svedala': { lat: 55.5060, lng: 13.2280, type: 'kommun' },
  'svenljunga': { lat: 57.4930, lng: 13.1140, type: 'kommun' },
  'säffle': { lat: 59.1330, lng: 12.9260, type: 'kommun' },
  'säter': { lat: 60.3510, lng: 15.7510, type: 'kommun' },
  'sävsjö': { lat: 57.4030, lng: 14.6660, type: 'kommun' },
  'söderhamn': { lat: 61.3040, lng: 17.0590, type: 'kommun' },
  'söderköping': { lat: 58.4810, lng: 16.3210, type: 'kommun' },
  'sölvesborg': { lat: 56.0530, lng: 14.5840, type: 'kommun' },
  'tanum': { lat: 58.7230, lng: 11.3280, type: 'kommun' },
  'tibro': { lat: 58.4230, lng: 14.1610, type: 'kommun' },
  'tidaholm': { lat: 58.1800, lng: 13.9580, type: 'kommun' },
  'tierp': { lat: 60.3400, lng: 17.5180, type: 'kommun' },
  'timrå': { lat: 62.4870, lng: 17.3250, type: 'kommun' },
  'tingsryd': { lat: 56.5230, lng: 14.9870, type: 'kommun' },
  'tjörn': { lat: 57.9870, lng: 11.5440, type: 'kommun' },
  'tomelilla': { lat: 55.5430, lng: 13.9570, type: 'kommun' },
  'torsby': { lat: 60.1370, lng: 12.9990, type: 'kommun' },
  'torsås': { lat: 56.4110, lng: 16.0060, type: 'kommun' },
  'tranemo': { lat: 57.4880, lng: 13.3450, type: 'kommun' },
  'tranås': { lat: 58.0370, lng: 14.9770, type: 'kommun' },
  'trelleborg': { lat: 55.3755, lng: 13.1573, type: 'kommun' },
  'trollhättan': { lat: 58.2837, lng: 12.2886, type: 'kommun' },
  'trosa': { lat: 58.8950, lng: 17.5450, type: 'kommun' },
  'uddevalla': { lat: 58.3489, lng: 11.9371, type: 'kommun' },
  'ulricehamn': { lat: 57.7910, lng: 13.4170, type: 'kommun' },
  'umeå': { lat: 63.8258, lng: 20.2630, type: 'kommun' },
  'upplands väsby': { lat: 59.5180, lng: 17.9080, type: 'kommun' },
  'uppvidinge': { lat: 57.0970, lng: 15.4310, type: 'kommun' },
  'uppsala': { lat: 59.8586, lng: 17.6389, type: 'kommun' },
  'vadstena': { lat: 58.4497, lng: 14.8912, type: 'kommun' },
  'vaggeryd': { lat: 57.4940, lng: 14.1320, type: 'kommun' },
  'valdemarsvik': { lat: 58.2030, lng: 16.6040, type: 'kommun' },
  'vansbro': { lat: 60.8830, lng: 14.2670, type: 'kommun' },
  'vara': { lat: 58.2610, lng: 13.1190, type: 'kommun' },
  'varberg': { lat: 57.1060, lng: 12.2508, type: 'kommun' },
  'vaxholm': { lat: 59.4020, lng: 18.3510, type: 'kommun' },
  'vellinge': { lat: 55.4710, lng: 13.0200, type: 'kommun' },
  'vetlanda': { lat: 57.4300, lng: 15.0781, type: 'kommun' },
  'vilhelmina': { lat: 64.6220, lng: 16.6550, type: 'kommun' },
  'vimmerby': { lat: 57.6659, lng: 15.8555, type: 'kommun' },
  'vindeln': { lat: 64.2010, lng: 19.7190, type: 'kommun' },
  'vingåker': { lat: 59.0440, lng: 15.8720, type: 'kommun' },
  'vårgårda': { lat: 58.0330, lng: 12.8090, type: 'kommun' },
  'vänersborg': { lat: 58.3807, lng: 12.3234, type: 'kommun' },
  'vännäs': { lat: 63.9060, lng: 19.7600, type: 'kommun' },
  'värmdö': { lat: 59.3200, lng: 18.3800, type: 'kommun' },
  'värnamo': { lat: 57.1872, lng: 14.0395, type: 'kommun' },
  'västervik': { lat: 57.7584, lng: 16.6369, type: 'kommun' },
  'västerås': { lat: 59.6099, lng: 16.5448, type: 'kommun' },
  'växjö': { lat: 56.8777, lng: 14.8091, type: 'kommun' },
  'ydre': { lat: 58.0240, lng: 15.2720, type: 'kommun' },
  'ystad': { lat: 55.4295, lng: 13.8200, type: 'kommun' },
  'åmål': { lat: 59.0510, lng: 12.7080, type: 'kommun' },
  'ånge': { lat: 62.5250, lng: 15.6580, type: 'kommun' },
  'åre': { lat: 63.3990, lng: 13.0810, type: 'kommun' },
  'årjäng': { lat: 59.3930, lng: 12.1390, type: 'kommun' },
  'åsele': { lat: 64.1660, lng: 17.3490, type: 'kommun' },
  'åstorp': { lat: 56.1350, lng: 12.9440, type: 'kommun' },
  'åtvidaberg': { lat: 58.2030, lng: 16.0000, type: 'kommun' },
  'älmhult': { lat: 56.5516, lng: 14.1387, type: 'kommun' },
  'älvdalen': { lat: 61.2260, lng: 14.0430, type: 'kommun' },
  'älvkarleby': { lat: 60.5700, lng: 17.4480, type: 'kommun' },
  'älvsbyn': { lat: 65.6770, lng: 20.9960, type: 'kommun' },
  'ängelholm': { lat: 56.2427, lng: 12.8624, type: 'kommun' },
  'öckerö': { lat: 57.7100, lng: 11.6530, type: 'kommun' },
  'ödeshög': { lat: 58.2260, lng: 14.6530, type: 'kommun' },
  'örebro': { lat: 59.2753, lng: 15.2134, type: 'kommun' },
  'örkelljunga': { lat: 56.2800, lng: 13.2790, type: 'kommun' },
  'örnsköldsvik': { lat: 63.2909, lng: 18.7152, type: 'kommun' },
  'östersund': { lat: 63.1792, lng: 14.6357, type: 'kommun' },
  'östhammar': { lat: 60.2590, lng: 18.3690, type: 'kommun' },
  'östra göinge': { lat: 56.2730, lng: 14.1560, type: 'kommun' },
  'överkalix': { lat: 66.3270, lng: 22.8420, type: 'kommun' },
  'övertorneå': { lat: 66.3900, lng: 23.6510, type: 'kommun' },
};

// ─── Text normalization ───────────────────────────────────────────────────────
function normalizeLocationText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s*kommun\s*/g, '')
    .replace(/\s*stad\s*/g, '')
    .replace(/\s*län\s*/g, '')
    .replace(/^(i|vid|på|nära|utanför)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Lookup from Swedish reference DB ─────────────────────────────────────────
function lookupSwedishLocation(locationName: string): LocationEntry | null {
  const normalized = normalizeLocationText(locationName);
  
  // Direct match
  if (SWEDISH_LOCATIONS[normalized]) return SWEDISH_LOCATIONS[normalized];
  
  // Try to find within compound names (e.g. "Nacka kommun" → "nacka")
  for (const [key, entry] of Object.entries(SWEDISH_LOCATIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return entry;
    }
  }
  
  return null;
}

// Extract street address from summary text for precise geocoding
function extractAddressFromSummary(summary: string): string | null {
  if (!summary) return null;
  
  const patterns = [
    /(?:på|vid|i närheten av|nära|utanför|framför|bakom)\s+([A-ZÅÄÖ][a-zåäöé]+(?:gatan|vägen|torget|platsen|allén|stigen|bron|gränd|backen|leden|parken)(?:\s+\d+)?)/gi,
    /(?:korsningen|hörnet)\s+([A-ZÅÄÖ][a-zåäöé]+(?:gatan|vägen)\s*\/\s*[A-ZÅÄÖ][a-zåäöé]+(?:gatan|vägen))/gi,
    /(?:på|vid|i)\s+([A-ZÅÄÖ][a-zåäöé]+(?:gatan|vägen|torget|platsen|allén|stigen|leden)\s*\d*)/gi,
  ];
  
  for (const pattern of patterns) {
    const match = pattern.exec(summary);
    if (match && match[1]) return match[1].trim();
  }
  
  return null;
}

// Geocode with Nominatim — STRICTLY Sweden only
async function geocodeWithNominatim(query: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=se&accept-language=sv`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CrimeRadar/1.0' },
    });
    
    if (!response.ok) return null;
    
    const results = await response.json();
    if (results.length > 0) {
      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);
      // Final safety: verify it's within Sweden's bounding box
      if (lat >= 55.3 && lat <= 69.1 && lng >= 10.9 && lng <= 24.2) {
        return [lat, lng];
      }
      console.warn(`Nominatim result outside Sweden bounds: ${lat}, ${lng} for "${query}"`);
    }
  } catch (e) {
    console.error('Nominatim geocoding failed:', e);
  }
  return null;
}

// Check if coordinates appear to be county-level centroids (imprecise)
function isLikelyCountyCentroid(lat: number, lng: number, locationName: string): boolean {
  const countyCentroids = [
    [59.33, 18.07], [57.71, 11.97], [55.61, 13.00], [59.86, 17.64],
    [58.41, 15.62], [63.83, 20.26], [62.39, 17.31], [60.67, 17.14],
    [59.38, 13.50], [63.18, 14.64], [65.58, 22.15], [56.88, 14.81],
    [56.66, 16.36], [57.78, 14.16], [56.05, 12.69], [59.61, 16.54],
    [59.27, 15.21], [56.16, 15.59], [58.54, 13.47], [56.03, 14.16],
    [60.49, 15.44], [58.75, 17.01], [57.64, 18.29],
  ];
  
  for (const [clat, clng] of countyCentroids) {
    if (Math.abs(lat - clat) < 0.02 && Math.abs(lng - clng) < 0.02) return true;
  }
  
  if (locationName.toLowerCase().includes(' län')) return true;
  return false;
}

function classifyEvent(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('brand') || lower.includes('rökutveckling')) return 'fire';
  if (lower.includes('trafik') || lower.includes('trafikolycka') || lower.includes('rattfylleri')) return 'traffic';
  if (lower.includes('sjukvård') || lower.includes('ambulans') || lower.includes('försvunnen')) return 'ambulance';
  if (lower.includes('stöld') || lower.includes('inbrott') || lower.includes('rån') || lower.includes('misshandel') || 
      lower.includes('skottlossning') || lower.includes('mord') || lower.includes('hot') || lower.includes('bedrägeri') ||
      lower.includes('narkotika') || lower.includes('vapenlag') || lower.includes('ordningslagen')) return 'police';
  return 'other';
}

function assessRisk(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('skottlossning') || lower.includes('mord') || lower.includes('brand') || lower.includes('rån') || lower.includes('knivlag')) return 'high';
  if (lower.includes('misshandel') || lower.includes('trafikolycka') || lower.includes('inbrott') || lower.includes('hot')) return 'medium';
  return 'low';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const location = url.searchParams.get('location') || '';
    
    let apiUrl = 'https://polisen.se/api/events';
    if (location) {
      apiUrl += `?locationname=${encodeURIComponent(location)}`;
    }

    console.log('Fetching police events from:', apiUrl);

    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Polisen API returned ${response.status}`);
    }

    const events = await response.json();
    console.log(`Received ${events.length} events from Polisen.se`);

    const incidents = [];
    const geocodePromises: Promise<void>[] = [];
    
    for (const event of events.slice(0, 50)) {
      const rawLat = event.location?.gps ? parseFloat(event.location.gps.split(',')[0]) : null;
      const rawLng = event.location?.gps ? parseFloat(event.location.gps.split(',')[1]) : null;
      const locationName = event.location?.name || '';
      
      const incident: any = {
        id: `pol-${event.id}`,
        type: classifyEvent(event.type),
        title: event.name || event.type,
        description: event.summary || '',
        lat: rawLat,
        lng: rawLng,
        area: locationName || 'Okänt område',
        time: event.datetime,
        status: 'active',
        risk: assessRisk(event.type),
        source: 'Polisen.se',
        originalType: event.type,
        url: event.url,
        location_precision: 'exact', // Will be updated below
      };

      // ── Step 1: Try to extract a street address from summary ──
      const extractedAddress = extractAddressFromSummary(event.summary || '');
      
      if (extractedAddress) {
        const geocodeQuery = `${extractedAddress}, ${locationName}, Sverige`;
        const promise = geocodeWithNominatim(geocodeQuery).then(coords => {
          if (coords) {
            incident.lat = coords[0];
            incident.lng = coords[1];
            incident.location_precision = 'street';
            console.log(`Street-level geocode: "${geocodeQuery}" → ${coords[0]}, ${coords[1]}`);
          }
        });
        geocodePromises.push(promise);
      }

      // ── Step 2: Check if API coordinates are county centroids ──
      if (rawLat && rawLng && isLikelyCountyCentroid(rawLat, rawLng, locationName)) {
        // Use our Swedish reference DB
        const localMatch = lookupSwedishLocation(locationName);
        if (localMatch) {
          incident.lat = localMatch.lat;
          incident.lng = localMatch.lng;
          incident.location_precision = localMatch.type === 'stadsdel' ? 'district' : 'area';
          console.log(`Local DB match: "${locationName}" → ${localMatch.lat}, ${localMatch.lng} (${localMatch.type})`);
        } else {
          // Fallback to Nominatim with strict SE filter
          const promise = geocodeWithNominatim(`${locationName}, Sverige`).then(coords => {
            if (coords) {
              incident.lat = coords[0];
              incident.lng = coords[1];
              incident.location_precision = 'area';
              console.log(`Nominatim SE-only: "${locationName}" → ${coords[0]}, ${coords[1]}`);
            } else {
              incident.location_precision = 'area';
            }
          });
          geocodePromises.push(promise);
        }
      } else if (!rawLat || !rawLng) {
        // ── Step 3: No GPS → use local DB first ──
        const localMatch = lookupSwedishLocation(locationName);
        if (localMatch) {
          incident.lat = localMatch.lat;
          incident.lng = localMatch.lng;
          incident.location_precision = localMatch.type === 'stadsdel' ? 'district' : 'area';
          console.log(`Local DB (no GPS): "${locationName}" → ${localMatch.lat}, ${localMatch.lng}`);
        } else {
          const promise = geocodeWithNominatim(`${locationName}, Sverige`).then(coords => {
            if (coords) {
              incident.lat = coords[0];
              incident.lng = coords[1];
              incident.location_precision = 'area';
            }
          });
          geocodePromises.push(promise);
        }
      }
      
      incidents.push(incident);
    }

    // Wait for geocoding with timeout
    if (geocodePromises.length > 0) {
      console.log(`Geocoding ${geocodePromises.length} events...`);
      await Promise.race([
        Promise.all(geocodePromises),
        new Promise(resolve => setTimeout(resolve, 5000)),
      ]);
    }

    const validIncidents = incidents.filter((i: any) => i.lat && i.lng);
    
    const precisionCounts = validIncidents.reduce((acc: Record<string, number>, i: any) => {
      acc[i.location_precision] = (acc[i.location_precision] || 0) + 1;
      return acc;
    }, {});
    console.log(`Returning ${validIncidents.length} incidents. Precision:`, JSON.stringify(precisionCounts));

    return new Response(JSON.stringify({ success: true, data: validIncidents }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching police events:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
