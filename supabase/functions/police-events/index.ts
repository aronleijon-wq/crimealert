import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { keepBackfilledSummaries, needsDetailScrape, planArchiveWrites } from '../_shared/archiveDiff.ts';
import { isFresh, lookupProUntil, proUntilActive, readProStatus, rememberProStatus } from '../_shared/premium.ts';
import { FREE_DELAY_MS, reachedFreeWithin } from '../_shared/notifications.ts';
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DELAY_MS = FREE_DELAY_MS; // 15 minutes

// An incident as served to the client and stored in police_events_archive
interface PoliceIncident {
  id: string;
  type: string;
  title: string;
  description: string;
  lat: number | null;
  lng: number | null;
  area: string;
  time: string;
  status: string;
  risk: string;
  source: string;
  originalType?: string | null;
  original_type?: string | null;
  url?: string | null;
  location_precision: string;
}

// Row shape of the police_events_archive table
interface ArchiveRow extends Omit<PoliceIncident, 'originalType' | 'original_type'> {
  original_type: string | null;
}

// ─── In-memory caches (persist within isolate lifecycle) ───────────────────────
// Cache the full incidents array so multiple users share the same data
let cachedIncidents: PoliceIncident[] | null = null;
let cachedIncidentsTs = 0;
const INCIDENTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// When Polisen's API last answered: kept here, and in ingest_state for other instances, the
// app's "not updated since" notice and the admin alert
let lastPolisenFetchAt: number | null = null;
let polisenRetryAt = 0;
const POLISEN_RETRY_MS = 60 * 1000;

function markPolisenFetched() {
  lastPolisenFetchAt = Date.now();
  supabase
    .from('ingest_state')
    .upsert({ key: 'police', last_run_at: new Date(lastPolisenFetchAt).toISOString() }, { onConflict: 'key' })
    .then(({ error }: { error: { message: string } | null }) => { if (error) console.warn('Could not store fetch time:', error.message); });
}

/** When Polisen last answered, as an ISO time, or null if never seen. */
async function polisenFetchedAt(): Promise<string | null> {
  if (lastPolisenFetchAt) return new Date(lastPolisenFetchAt).toISOString();
  const { data } = await supabase.from('ingest_state').select('last_run_at').eq('key', 'police').maybeSingle();
  if (data?.last_run_at) lastPolisenFetchAt = Date.parse(data.last_run_at);
  return data?.last_run_at ?? null;
}

// Cache the archive read (up to 2000 rows) the same way
let cachedArchive: PoliceIncident[] | null = null;
let cachedArchiveTs = 0;

// Summary pages scraped without getting longer text are retried at most once per cache TTL
const summaryScrapeAttempts = new Map<string, number>();

// Cache premium status per token (short-lived)
const premiumCache = new Map<string, { isPremium: boolean; ts: number }>();
const PREMIUM_CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Whether the request comes from a Pro account. Uses the answer check-subscription last stored
 * in pro_status (the app checks on load and every 30 minutes), and asks Stripe only when there
 * is no recent answer, with the same rules as check-subscription (so trials and cancelled
 * subscriptions keep Pro until their period ends, as the app shows).
 */
async function checkPremiumStatus(req: Request): Promise<boolean> {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return false;
    const token = authHeader.replace('Bearer ', '');

    // Skip anon key — it's not a user token
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (token === anonKey) return false;

    const now = Date.now();
    const cached = premiumCache.get(token);
    if (cached && now - cached.ts < PREMIUM_CACHE_TTL) return cached.isPremium;
    // Forget old entries so the map stays small
    if (premiumCache.size > 200) {
      for (const [k, v] of premiumCache) {
        if (now - v.ts > PREMIUM_CACHE_TTL) premiumCache.delete(k);
      }
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.email) {
      premiumCache.set(token, { isPremium: false, ts: now });
      return false;
    }

    const userId = data.user.id;
    const stored = (await readProStatus(supabase, [userId])).get(userId);
    let proUntil: string | null;
    if (stored && isFresh(stored, now)) {
      proUntil = stored.pro_until;
    } else {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' }) : null;
      proUntil = await lookupProUntil(stripe, data.user.email, now);
      await rememberProStatus(supabase, userId, proUntil);
    }

    const result = proUntilActive(proUntil, now);
    premiumCache.set(token, { isPremium: result, ts: now });
    return result;
  } catch (e) {
    console.warn('Premium check failed, defaulting to free:', e);
  }
  return false;
}

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
  'uppvidinge': { lat: 57.0970, lng: 15.4310, type: 'kommun' },
  'uppsala': { lat: 59.8586, lng: 17.6389, type: 'kommun' },
  'vadstena': { lat: 58.4497, lng: 14.8912, type: 'kommun' },
  'vaggeryd': { lat: 57.4940, lng: 14.1320, type: 'kommun' },
  'valdemarsvik': { lat: 58.2030, lng: 16.6040, type: 'kommun' },
  'vansbro': { lat: 60.8830, lng: 14.2670, type: 'kommun' },
  'vara': { lat: 58.2610, lng: 13.1190, type: 'kommun' },
  'varberg': { lat: 57.1060, lng: 12.2508, type: 'kommun' },
  'vellinge': { lat: 55.4710, lng: 13.0200, type: 'kommun' },
  'vetlanda': { lat: 57.4300, lng: 15.0781, type: 'kommun' },
  'vilhelmina': { lat: 64.6220, lng: 16.6550, type: 'kommun' },
  'vimmerby': { lat: 57.6659, lng: 15.8555, type: 'kommun' },
  'vindeln': { lat: 64.2010, lng: 19.7190, type: 'kommun' },
  'vingåker': { lat: 59.0440, lng: 15.8720, type: 'kommun' },
  'vårgårda': { lat: 58.0330, lng: 12.8090, type: 'kommun' },
  'vänersborg': { lat: 58.3807, lng: 12.3234, type: 'kommun' },
  'vännäs': { lat: 63.9060, lng: 19.7600, type: 'kommun' },
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

  // ── Tätorter & förorter (mindre orter som ofta förekommer i polishändelser) ──
  // Stockholm-regionen
  'älta': { lat: 59.2580, lng: 18.1810, type: 'ort' },
  'tumba': { lat: 59.2000, lng: 17.8330, type: 'ort' },
  'flemingsberg': { lat: 59.2200, lng: 17.9450, type: 'ort' },
  'skogås': { lat: 59.2220, lng: 18.1550, type: 'ort' },
  'trångsund': { lat: 59.2330, lng: 18.1400, type: 'ort' },
  'handen': { lat: 59.1660, lng: 18.1390, type: 'ort' },
  'vendelsö': { lat: 59.2100, lng: 18.1800, type: 'ort' },
  'jordbro': { lat: 59.1510, lng: 18.1310, type: 'ort' },
  'brandbergen': { lat: 59.1640, lng: 18.1700, type: 'ort' },
  'norsborg': { lat: 59.2440, lng: 17.8140, type: 'ort' },
  'hallunda': { lat: 59.2430, lng: 17.8260, type: 'ort' },
  'alby': { lat: 59.2380, lng: 17.8450, type: 'ort' },
  'fittja': { lat: 59.2490, lng: 17.8600, type: 'ort' },
  'tullinge': { lat: 59.2050, lng: 17.8930, type: 'ort' },
  'segeltorp': { lat: 59.2760, lng: 17.9340, type: 'ort' },
  'stuvsta': { lat: 59.2660, lng: 17.9680, type: 'ort' },
  'trappan': { lat: 59.2440, lng: 17.8500, type: 'ort' },
  'vårby': { lat: 59.2730, lng: 17.8800, type: 'ort' },
  'vårberg': { lat: 59.2750, lng: 17.8850, type: 'stadsdel' },
  'bredäng': { lat: 59.2940, lng: 17.9310, type: 'stadsdel' },
  'sätra': { lat: 59.2870, lng: 17.9130, type: 'stadsdel' },
  'skärmarbrink': { lat: 59.3020, lng: 18.0880, type: 'ort' },
  'hjorthagen': { lat: 59.3510, lng: 18.1060, type: 'stadsdel' },
  'gärdet': { lat: 59.3470, lng: 18.1000, type: 'stadsdel' },
  'djurgården': { lat: 59.3270, lng: 18.1100, type: 'stadsdel' },
  'reimersholme': { lat: 59.3180, lng: 18.0340, type: 'ort' },
  'tanto': { lat: 59.3110, lng: 18.0530, type: 'ort' },
  'årsta': { lat: 59.2960, lng: 18.0510, type: 'stadsdel' },
  'lövholmen': { lat: 59.3120, lng: 18.0200, type: 'ort' },
  'axelsberg': { lat: 59.3030, lng: 17.9690, type: 'ort' },
  'mariehäll': { lat: 59.3460, lng: 17.9370, type: 'ort' },
  'abrahamsberg': { lat: 59.3370, lng: 17.9190, type: 'ort' },
  'beckomberga': { lat: 59.3570, lng: 17.9200, type: 'ort' },
  'blackeberg': { lat: 59.3490, lng: 17.8860, type: 'ort' },
  'råcksta': { lat: 59.3530, lng: 17.8730, type: 'ort' },
  'grimsta': { lat: 59.3540, lng: 17.8490, type: 'ort' },
  'vinsta': { lat: 59.3570, lng: 17.8590, type: 'ort' },
  'hässelby gård': { lat: 59.3680, lng: 17.8160, type: 'ort' },
  'hässelby strand': { lat: 59.3640, lng: 17.7910, type: 'ort' },
  'råsunda': { lat: 59.3660, lng: 18.0040, type: 'ort' },
  'bergshamra': { lat: 59.3840, lng: 18.0350, type: 'ort' },
  'ulriksdal': { lat: 59.3830, lng: 18.0190, type: 'ort' },
  'huvudsta': { lat: 59.3490, lng: 17.9720, type: 'ort' },
  'ursvik': { lat: 59.3780, lng: 17.9530, type: 'ort' },
  'hallonbergen': { lat: 59.3770, lng: 17.9670, type: 'ort' },
  'rissne': { lat: 59.3760, lng: 17.9360, type: 'ort' },
  'barkarby': { lat: 59.4060, lng: 17.8620, type: 'ort' },
  'jakobsberg': { lat: 59.4230, lng: 17.8340, type: 'ort' },
  'viksjö': { lat: 59.4330, lng: 17.8020, type: 'ort' },
  'kallhäll': { lat: 59.4480, lng: 17.8130, type: 'ort' },
  'stäket': { lat: 59.4660, lng: 17.7700, type: 'ort' },
  'bro': { lat: 59.5100, lng: 17.6350, type: 'ort' },
  'kungsängen': { lat: 59.4920, lng: 17.7480, type: 'ort' },
  'märsta': { lat: 59.6230, lng: 17.8540, type: 'ort' },
  'arlanda': { lat: 59.6500, lng: 17.9400, type: 'ort' },
  'rosersberg': { lat: 59.5830, lng: 17.8730, type: 'ort' },
  'rotebro': { lat: 59.4830, lng: 17.9380, type: 'ort' },
  'tureberg': { lat: 59.4340, lng: 17.9600, type: 'ort' },
  'häggvik': { lat: 59.4540, lng: 17.9450, type: 'ort' },
  'arninge': { lat: 59.4610, lng: 18.1070, type: 'ort' },
  'gribbylund': { lat: 59.4490, lng: 18.0900, type: 'ort' },
  'åkersberga': { lat: 59.4790, lng: 18.3000, type: 'ort' },
  'gustavsberg': { lat: 59.3270, lng: 18.3900, type: 'ort' },
  'fisksätra': { lat: 59.2980, lng: 18.2350, type: 'ort' },
  'saltsjöbaden': { lat: 59.2840, lng: 18.2960, type: 'ort' },
  'orminge': { lat: 59.3220, lng: 18.2590, type: 'ort' },
  'boo': { lat: 59.3180, lng: 18.2800, type: 'ort' },
  'sickla': { lat: 59.3050, lng: 18.1240, type: 'ort' },
  'ektorp': { lat: 59.3060, lng: 18.1590, type: 'ort' },
  'henriksdal': { lat: 59.3090, lng: 18.1100, type: 'ort' },
  'skuru': { lat: 59.3370, lng: 18.2310, type: 'ort' },
  'bollmora': { lat: 59.2330, lng: 18.2380, type: 'ort' },
  'tyresö centrum': { lat: 59.2440, lng: 18.2270, type: 'ort' },
  'ösmo': { lat: 59.0170, lng: 17.8800, type: 'ort' },

  // Göteborgs-regionen
  'mölnlycke': { lat: 57.6590, lng: 12.1180, type: 'ort' },
  'lindome': { lat: 57.5720, lng: 12.0810, type: 'ort' },
  'askim': { lat: 57.6310, lng: 11.9400, type: 'stadsdel' },
  'torslanda': { lat: 57.7190, lng: 11.7750, type: 'stadsdel' },
  'backa': { lat: 57.7490, lng: 11.9500, type: 'stadsdel' },
  'kärra': { lat: 57.7510, lng: 11.9260, type: 'ort' },
  'tuve': { lat: 57.7490, lng: 11.9000, type: 'ort' },
  'säve': { lat: 57.7720, lng: 11.8870, type: 'ort' },
  'surte': { lat: 57.8340, lng: 12.0130, type: 'ort' },
  'nödinge': { lat: 57.8650, lng: 12.0620, type: 'ort' },
  'bohus': { lat: 57.8530, lng: 12.0100, type: 'ort' },
  'olskroken': { lat: 57.7140, lng: 11.9950, type: 'ort' },
  'gårdsten': { lat: 57.7960, lng: 12.0180, type: 'stadsdel' },
  'hjällbo': { lat: 57.7770, lng: 12.0220, type: 'stadsdel' },
  'hammarkullen': { lat: 57.7850, lng: 12.0370, type: 'stadsdel' },
  'lövgärdet': { lat: 57.7970, lng: 12.0430, type: 'stadsdel' },
  'eriksberg': { lat: 57.7040, lng: 11.9100, type: 'ort' },
  'sisjön': { lat: 57.6370, lng: 11.9800, type: 'ort' },
  'högsbo': { lat: 57.6740, lng: 11.9370, type: 'stadsdel' },
  'järnbrott': { lat: 57.6580, lng: 11.9210, type: 'ort' },
  'tynnered': { lat: 57.6470, lng: 11.8830, type: 'stadsdel' },
  'västra frölunda': { lat: 57.6510, lng: 11.9080, type: 'stadsdel' },
  'örgryte': { lat: 57.6930, lng: 12.0060, type: 'stadsdel' },
  'härlanda': { lat: 57.7100, lng: 12.0250, type: 'stadsdel' },
  'kållered': { lat: 57.6110, lng: 12.0470, type: 'ort' },
  'sävedalen': { lat: 57.7330, lng: 12.0890, type: 'ort' },
  'jonsered': { lat: 57.7540, lng: 12.1640, type: 'ort' },
  'floda': { lat: 57.8020, lng: 12.3490, type: 'ort' },
  'nol': { lat: 57.9150, lng: 12.0820, type: 'ort' },
  'älvängen': { lat: 57.9580, lng: 12.1110, type: 'ort' },
  'kinna': { lat: 57.5100, lng: 12.6940, type: 'ort' },
  'skene': { lat: 57.4900, lng: 12.6480, type: 'ort' },

  // Malmö-regionen
  'arlöv': { lat: 55.6310, lng: 13.0730, type: 'ort' },
  'åkarp': { lat: 55.6370, lng: 13.1210, type: 'ort' },
  'bjärred': { lat: 55.7200, lng: 13.0230, type: 'ort' },
  'bunkeflostrand': { lat: 55.5660, lng: 12.9280, type: 'ort' },
  'bunkeflo': { lat: 55.5570, lng: 12.9380, type: 'ort' },
  'skanör': { lat: 55.4090, lng: 12.8390, type: 'ort' },
  'falsterbo': { lat: 55.3860, lng: 12.8480, type: 'ort' },
  'höllviken': { lat: 55.4150, lng: 12.9520, type: 'ort' },
  'dalby': { lat: 55.6680, lng: 13.3410, type: 'ort' },
  'södra sandby': { lat: 55.7120, lng: 13.3520, type: 'ort' },

  // Övriga tätorter i Sverige
  'mariefred': { lat: 59.2600, lng: 17.2240, type: 'ort' },
  'bålsta': { lat: 59.5680, lng: 17.5270, type: 'ort' },
  'skutskär': { lat: 60.6370, lng: 17.4060, type: 'ort' },
  'storvik': { lat: 60.5790, lng: 16.5450, type: 'ort' },
  'edsbyn': { lat: 61.3800, lng: 15.8170, type: 'ort' },
  'sveg': { lat: 62.0350, lng: 14.3520, type: 'ort' },
  'funäsdalen': { lat: 62.5510, lng: 12.8540, type: 'ort' },
  'malå': { lat: 65.1830, lng: 18.7320, type: 'ort' },
  'malmberget': { lat: 67.1760, lng: 20.6560, type: 'ort' },
  'porjus': { lat: 66.9590, lng: 19.8140, type: 'ort' },
  'råneå': { lat: 65.8470, lng: 22.2820, type: 'ort' },
  'gammelstad': { lat: 65.6370, lng: 22.0120, type: 'ort' },
  'tanumshede': { lat: 58.7230, lng: 11.3280, type: 'ort' },
  'malung': { lat: 60.6830, lng: 13.7150, type: 'ort' },
  'sälen': { lat: 61.1530, lng: 13.2630, type: 'ort' },

  // ── Svenska län (counties) — explicit entries to avoid substring bugs ──
  'stockholms län': { lat: 59.3293, lng: 18.0686, type: 'kommun' },
  'västra götalands län': { lat: 57.7089, lng: 11.9746, type: 'kommun' },
  'skåne län': { lat: 55.6050, lng: 13.0038, type: 'kommun' },
  'uppsala län': { lat: 59.8586, lng: 17.6389, type: 'kommun' },
  'östergötlands län': { lat: 58.4108, lng: 15.6214, type: 'kommun' },
  'jönköpings län': { lat: 57.7826, lng: 14.1618, type: 'kommun' },
  'kronobergs län': { lat: 56.8777, lng: 14.8091, type: 'kommun' },
  'kalmar län': { lat: 56.6634, lng: 16.3566, type: 'kommun' },
  'gotlands län': { lat: 57.6348, lng: 18.2948, type: 'kommun' },
  'blekinge län': { lat: 56.1612, lng: 15.5869, type: 'kommun' },
  'hallands län': { lat: 56.6745, lng: 12.8578, type: 'kommun' },
  'värmlands län': { lat: 59.3793, lng: 13.5036, type: 'kommun' },
  'örebro län': { lat: 59.2753, lng: 15.2134, type: 'kommun' },
  'västmanlands län': { lat: 59.6099, lng: 16.5448, type: 'kommun' },
  'dalarnas län': { lat: 60.4858, lng: 15.4364, type: 'kommun' },
  'gävleborgs län': { lat: 60.6749, lng: 17.1413, type: 'kommun' },
  'västernorrlands län': { lat: 62.3908, lng: 17.3069, type: 'kommun' },
  'jämtlands län': { lat: 63.1792, lng: 14.6357, type: 'kommun' },
  'västerbottens län': { lat: 63.8258, lng: 20.2630, type: 'kommun' },
  'norrbottens län': { lat: 65.5848, lng: 22.1547, type: 'kommun' },
  'södermanlands län': { lat: 59.3666, lng: 16.5077, type: 'kommun' },
};

// ─── Text normalization ───────────────────────────────────────────────────────
function normalizeLocationText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s*kommun$/g, '')
    .replace(/\s*stad$/g, '')
    .replace(/^(i|vid|på|nära|utanför)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Lookup from Swedish reference DB ─────────────────────────────────────────
function lookupSwedishLocation(locationName: string): LocationEntry | null {
  const lower = locationName.toLowerCase().trim();
  
  // 1. Try exact match with original text (important for "Kronobergs län" etc.)
  if (SWEDISH_LOCATIONS[lower]) return SWEDISH_LOCATIONS[lower];
  
  // 2. Try normalized (strips "kommun", "stad", prepositions — but NOT "län")
  const normalized = normalizeLocationText(locationName);
  if (SWEDISH_LOCATIONS[normalized]) return SWEDISH_LOCATIONS[normalized];
  
  // 3. Try adding "s län" suffix for county names (e.g. "Kronoberg" → "kronobergs län")
  const asLan = normalized + 's län';
  if (SWEDISH_LOCATIONS[asLan]) return SWEDISH_LOCATIONS[asLan];
  
  // 4. Only do exact word boundary matching — NO substring matching
  // This prevents "berg" from matching "kronoberg"
  return null;
}

// Extract street address from summary text for precise geocoding
function extractAddressFromSummary(summary: string): string | null {
  if (!summary) return null;
  
  // ── Swedish street/road suffixes ──
  const streetSuffixes = '(?:gatan|vägen|torget|platsen|allén|stigen|bron|gränd|backen|leden|parken|gärdet|ängen|berget|höjden|dalen|ringen|slingan|promenaden|kajen|hamnen|stranden|udden|kullen|åsen|sluttningen|tvärgatan|esplanaden|boulevarden|gata|väg|stig|plan|torg|led)';

  // Common false positives
  const skipWords = new Set([
    'polisen', 'polisens', 'sjukhus', 'sjukhuset', 'ambulans', 'ambulansen',
    'räddningstjänsten', 'brandkåren', 'föraren', 'chauffören',
    'den', 'det', 'ett', 'en', 'personen', 'fordonet', 'bilen', 'mannen', 'kvinnan',
    'platsen', 'området', 'centrum', 'bostad', 'boende', 'lägenhet', 'lägenheten',
    'flerfamiljshus', 'fritidshus', 'personbil', 'personbilar', 'bilar',
    'samband', 'trafiken', 'resultat', 'anledning',
    'man', 'kvinna', 'person', 'misstänkt', 'gripen', 'greps',
    'anmälan', 'ärende', 'händelse', 'fall', 'insats',
    'närheten', 'riktning', 'höjd', 'dag', 'natt', 'kväll', 'morgon',
    'norr', 'söder', 'öster', 'väster', 'dörren', 'huset', 'byggnaden',
    'skolan', 'butiken', 'affären', 'restaurangen', 'baren',
    'helgen', 'veckan', 'fredagen', 'lördagen', 'söndagen',
    'måndagen', 'tisdagen', 'onsdagen', 'torsdagen',
    'januari', 'februari', 'mars', 'april', 'maj', 'juni',
    'juli', 'augusti', 'september', 'oktober', 'november', 'december',
  ]);

  const isSkipWord = (w: string) => skipWords.has(w.toLowerCase());

  const patterns: Array<{ re: RegExp; group: number; priority: number }> = [
    // 1. Intersections: "korsningen Storgatan/Kungsgatan", "i korsningen X och Y"
    { re: new RegExp(`(?:korsningen|hörnet|korsning)\\s+([A-ZÅÄÖ][a-zåäöé]+${streetSuffixes}\\s*(?:/|och)\\s*[A-ZÅÄÖ][a-zåäöé]+${streetSuffixes})`, 'gi'), group: 1, priority: 1 },

    // 2. Street with number: "Storgatan 15", "Nobelvägen 3B"
    { re: new RegExp(`([A-ZÅÄÖ][a-zåäöé]+${streetSuffixes}\\s+\\d+\\s*[A-Za-z]?)`, 'gi'), group: 1, priority: 2 },

    // 3. Preposition + street name: "på Storgatan", "vid Nobelvägen 5"
    { re: new RegExp(`(?:på|vid|i\\s+närheten\\s+av|nära|utanför|framför|bakom|längs|mot|över|intill|bredvid|mittemot)\\s+([A-ZÅÄÖ][a-zåäöé]+${streetSuffixes}(?:\\s+\\d+[-–]?\\d*\\s*[A-Za-z]?)?)`, 'gi'), group: 1, priority: 3 },

    // 4. Compound street: "Kung Oscars väg 12", "Carl Johans gata"
    { re: new RegExp(`(?:på|vid|i)\\s+((?:[A-ZÅÄÖ][a-zåäöé]+\\s+){1,3}${streetSuffixes}(?:\\s+\\d+)?)`, 'gi'), group: 1, priority: 4 },

    // 5. "mellan X och Y" (between two streets/places)
    { re: new RegExp(`mellan\\s+([A-ZÅÄÖ][a-zåäöé]+${streetSuffixes})\\s+och\\s+([A-ZÅÄÖ][a-zåäöé]+${streetSuffixes})`, 'gi'), group: 1, priority: 5 },

    // 6. E-roads / riksvägar: "på E4", "riksväg 40", "E10 vid Birsta"
    { re: /(?:på|längs|vid|mot)?\s*((?:E|Rv|riksväg|länsväg)\s*\d+)/gi, group: 1, priority: 6 },

    // 7. Trafikplats / rondell / bro: "vid trafikplats Nacksta", "i Hjulstabron"
    { re: /(?:trafikplats|rondellen?|cirkulationsplats)\s+([A-ZÅÄÖ][a-zåäöé]{2,})/gi, group: 1, priority: 7 },

    // 8. "i/på/vid" + specific place name (capitalized, min 3 chars)
    { re: /(?:i|på|vid)\s+([A-ZÅÄÖ][a-zåäöé]{2,}(?:\s+[A-ZÅÄÖ][a-zåäöé]{2,})?)/g, group: 1, priority: 8 },
  ];

  const candidates: { text: string; priority: number }[] = [];
  
  for (const { re, group, priority } of patterns) {
    let match: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((match = re.exec(summary)) !== null) {
      const candidate = match[group]?.trim();
      if (!candidate) continue;
      if (isSkipWord(candidate)) continue;
      if (candidate.length < 3 || /^\d+$/.test(candidate)) continue;
      // Skip candidates that are just months or weekdays
      if (/^(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)/i.test(candidate)) continue;
      candidates.push({ text: candidate, priority });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by priority (lower = better), return best
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0].text;
}
// DB-based rate limiting for Nominatim (works across edge function isolates)
const NOMINATIM_RATE_LIMIT_KEY = '__nominatim_last_request__';

async function acquireNominatimSlot(): Promise<boolean> {
  // Use geocode_cache with a special key to store last request timestamp
  // This ensures cross-isolate rate limiting via the database
  try {
    const { data: row } = await supabase
      .from('geocode_cache')
      .select('lat')
      .eq('query', NOMINATIM_RATE_LIMIT_KEY)
      .maybeSingle();

    const lastTs = row ? row.lat : 0; // abuse lat field to store timestamp
    const now = Date.now();
    if (now - lastTs < 1100) {
      // Another isolate made a request less than ~1s ago — wait
      const wait = 1100 - (now - lastTs);
      await new Promise(r => setTimeout(r, wait));
    }

    // Update the timestamp (upsert)
    await supabase.from('geocode_cache').upsert({
      query: NOMINATIM_RATE_LIMIT_KEY,
      lat: Date.now(),
      lng: 0,
      precision: 'rate_limit',
    }, { onConflict: 'query' });

    return true;
  } catch (e) {
    console.warn('Rate limit check failed, proceeding cautiously:', e);
    // If DB check fails, add a safety delay
    await new Promise(r => setTimeout(r, 1200));
    return true;
  }
}

// Geocode with cache + Nominatim fallback — STRICTLY Sweden only
async function geocodeWithNominatim(query: string): Promise<[number, number] | null> {
  const normalizedQuery = query.toLowerCase().trim();

  // 1. Check cache first
  try {
    const { data: cached } = await supabase
      .from('geocode_cache')
      .select('lat, lng')
      .eq('query', normalizedQuery)
      .maybeSingle();

    if (cached) {
      console.log(`Cache hit: "${query}" → ${cached.lat}, ${cached.lng}`);
      return [cached.lat, cached.lng];
    }
  } catch (e) {
    console.warn('Cache lookup failed:', e);
  }

  // 2. Nominatim lookup with DB-based rate limiting (cross-isolate safe)
  try {
    await acquireNominatimSlot();

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
        // 3. Store in cache (fire and forget)
        supabase.from('geocode_cache').upsert({
          query: normalizedQuery,
          lat,
          lng,
          precision: 'nominatim',
        }, { onConflict: 'query' }).then(() => {
          console.log(`Cached: "${normalizedQuery}" → ${lat}, ${lng}`);
        });

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

// ── Scrape detail page for full description with updates ──
async function scrapeEventDetail(eventUrl: string): Promise<string | null> {
  try {
    const fullUrl = eventUrl.startsWith('http') ? eventUrl : `https://polisen.se${eventUrl}`;
    const resp = await fetch(fullUrl, {
      headers: { 'Accept': 'text/html', 'User-Agent': 'CrimeAlert/1.0' },
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    // Extract content from <div class="text-body editorial-html">...</div>
    const match = html.match(/<div\s+class="text-body\s+editorial-html"[^>]*>([\s\S]*?)<\/div>/i);
    if (!match) return null;

    // Strip HTML tags and decode entities
    const text = match[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&auml;/gi, 'ä')
      .replace(/&ouml;/gi, 'ö')
      .replace(/&aring;/gi, 'å')
      .replace(/&Auml;/gi, 'Ä')
      .replace(/&Ouml;/gi, 'Ö')
      .replace(/&Aring;/gi, 'Å')
      .replace(/&eacute;/gi, 'é')
      .replace(/&uuml;/gi, 'ü')
      .replace(/&#\d+;/g, (m) => {
        const code = parseInt(m.replace(/&#|;/g, ''));
        return String.fromCharCode(code);
      })
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return text || null;
  } catch (e) {
    console.warn(`Failed to scrape detail page: ${eventUrl}`, e);
    return null;
  }
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

// Helper: fetch and process all incidents (expensive — cached)
// When this instance last fetched each event's page on polisen.se
const detailScrapedAt = new Map<string, number>();

/** `archived` is what the archive holds now; its full texts save fetching unchanged pages again. */
async function fetchAndProcessIncidents(locationParam: string, archived: PoliceIncident[] = []): Promise<PoliceIncident[]> {
  let apiUrl = 'https://polisen.se/api/events';
  if (locationParam) {
    apiUrl += `?locationname=${encodeURIComponent(locationParam)}`;
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

    const incidents: PoliceIncident[] = [];
    const geocodePromises: Promise<void>[] = [];

    for (const event of events) {
      const rawLat = event.location?.gps ? parseFloat(event.location.gps.split(',')[0]) : null;
      const rawLng = event.location?.gps ? parseFloat(event.location.gps.split(',')[1]) : null;
      const locationName = event.location?.name || '';
      
      const incident: PoliceIncident = {
        id: `pol-${event.id}`,
        type: classifyEvent(event.type),
        title: event.name || event.type,
        description: event.summary || '',
        lat: rawLat,
        lng: rawLng,
        area: locationName || 'Okänt område',
        time: event.datetime,
        status: (() => {
          try {
            const eventTime = new Date(event.datetime).getTime();
            return (Date.now() - eventTime) > 3 * 60 * 60 * 1000 ? 'resolved' : 'active';
          } catch { return 'active'; }
        })(),
        risk: assessRisk(event.type),
        source: 'Polisen.se',
        originalType: event.type,
        url: event.url,
        location_precision: 'exact', // Will be updated below
      };

      // ── Extract city name from title (e.g. "18 feb 20.08, Narkotikabrott, Umeå") ──
      const titleParts = (event.name || '').split(',');
      const cityFromTitle = titleParts.length >= 3 ? titleParts[titleParts.length - 1].trim() : null;

      // ── Determine if API GPS is a county centroid (imprecise) ──
      const apiGpsIsCountyCentroid = rawLat && rawLng && isLikelyCountyCentroid(rawLat, rawLng, locationName);
      const hasValidApiGps = rawLat && rawLng && !apiGpsIsCountyCentroid;

      // ── Step 1: ALWAYS try to extract street/address from summary (highest precision) ──
      const extractedAddress = extractAddressFromSummary(event.summary || '');
      
      if (extractedAddress) {
        // Build geocode query: address + city context
        const cityContext = cityFromTitle || locationName.replace(/\s*län\s*/i, '');
        const geocodeQuery = `${extractedAddress}, ${cityContext}, Sverige`;
        
        // Also try a simpler query as fallback
        const simpleQuery = `${extractedAddress}, Sverige`;

        // Resolve expected city coords for sanity checking street geocode results
        const expectedCity = cityFromTitle ? lookupSwedishLocation(cityFromTitle) : null;
        
        const promise = geocodeWithNominatim(geocodeQuery).then(async coords => {
          let result = coords;
          if (!result) {
            // Try simpler query
            result = await geocodeWithNominatim(simpleQuery);
          }
          
          if (result) {
            // Sanity check: verify the geocoded street is within ~50km of the expected city
            // This prevents "Storgatan" in Malmö being used for a Luleå incident
            if (expectedCity) {
              const dLat = Math.abs(result[0] - expectedCity.lat);
              const dLng = Math.abs(result[1] - expectedCity.lng);
              const approxDistKm = Math.sqrt(dLat * dLat + (dLng * 0.55) * (dLng * 0.55)) * 111;
              if (approxDistKm > 50) {
                console.log(`Street geocode REJECTED: "${geocodeQuery}" → ${result[0]},${result[1]} is ${Math.round(approxDistKm)}km from ${cityFromTitle} (${expectedCity.lat},${expectedCity.lng})`);
                return; // discard this result, keep existing coords
              }
            }
            
            incident.lat = result[0];
            incident.lng = result[1];
            incident.location_precision = 'street';
            console.log(`Street geocode: "${geocodeQuery}" → ${result[0]}, ${result[1]}`);
          }
        });
        geocodePromises.push(promise);
      }

      // ── Step 2: If API GPS is valid (not county centroid), keep it as baseline ──
      if (hasValidApiGps) {
        // API coords are decent — use as-is if no street-level upgrade arrives
        incident.location_precision = 'api';
        
        // Sanity check: if cityFromTitle resolves to a known location,
        // verify that API coords are reasonably close (<100km). If not,
        // the API GPS is likely wrong and we should use the city coords instead.
        if (cityFromTitle) {
          const cityCheck = lookupSwedishLocation(cityFromTitle);
          if (cityCheck) {
            const dLat = Math.abs(rawLat! - cityCheck.lat);
            const dLng = Math.abs(rawLng! - cityCheck.lng);
            // ~1 degree lat ≈ 111km, check if >50km away
            const approxDistKm = Math.sqrt(dLat * dLat + (dLng * 0.55) * (dLng * 0.55)) * 111;
            if (approxDistKm > 50) {
              console.log(`API GPS sanity fail: "${cityFromTitle}" expected ~${cityCheck.lat},${cityCheck.lng} but API gave ${rawLat},${rawLng} (${Math.round(approxDistKm)}km off) → overriding`);
              incident.lat = cityCheck.lat;
              incident.lng = cityCheck.lng;
              incident.location_precision = cityCheck.type === 'stadsdel' ? 'district' : 'area';
            }
          }
        }
      }
      // ── Step 3: If API GPS is county centroid or missing, resolve from city/location name ──
      else {
        // Try city from title first
        let resolved = false;
        if (cityFromTitle) {
          const cityMatch = lookupSwedishLocation(cityFromTitle);
          if (cityMatch) {
            incident.lat = cityMatch.lat;
            incident.lng = cityMatch.lng;
            incident.location_precision = cityMatch.type === 'stadsdel' ? 'district' : 'area';
            resolved = true;
            console.log(`City from title: "${cityFromTitle}" → ${cityMatch.lat}, ${cityMatch.lng}`);
          }
        }
        
        if (!resolved) {
          // Try location name from API
          const localMatch = lookupSwedishLocation(locationName);
          if (localMatch) {
            incident.lat = localMatch.lat;
            incident.lng = localMatch.lng;
            incident.location_precision = localMatch.type === 'stadsdel' ? 'district' : 'area';
            resolved = true;
            console.log(`Local DB: "${locationName}" → ${localMatch.lat}, ${localMatch.lng}`);
          }
        }
        
        if (!resolved) {
          // Fallback: Nominatim with city or location name
          const fallbackQuery = `${cityFromTitle || locationName}, Sverige`;
          const promise = geocodeWithNominatim(fallbackQuery).then(coords => {
            if (coords) {
              incident.lat = coords[0];
              incident.lng = coords[1];
              incident.location_precision = 'area';
              console.log(`Nominatim fallback: "${fallbackQuery}" → ${coords[0]}, ${coords[1]}`);
            }
          });
          geocodePromises.push(promise);
        }
      }

      // ── Step 4: Try to extract additional location context from title ──
      // e.g. "07 mars 14.21, Rattfylleri, Karlskrona" — extract "Karlskrona" for area
      if (cityFromTitle && !incident.area?.includes(cityFromTitle)) {
        incident.area = cityFromTitle;
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

    // ── Post-geocoding: scan description + title for known stadsdelar/orter ──
    // If current precision is NOT street-level, check if description mentions a
    // more specific location (stadsdel) than what we resolved to.
    for (const inc of incidents) {
      if (inc.location_precision === 'street') continue; // already precise
      
      const textToScan = `${inc.title || ''} ${inc.description || ''}`.toLowerCase();
      let bestMatch: { key: string; entry: LocationEntry } | null = null;
      
      // Search for stadsdelar first (most specific), then orter
      for (const [key, entry] of Object.entries(SWEDISH_LOCATIONS)) {
        if (entry.type !== 'stadsdel') continue;
        // Require word boundary match to avoid false positives
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(?:^|[\\s,.:;!?()/"'])${escaped}(?:[\\s,.:;!?()/"']|$)`, 'i');
        if (re.test(textToScan)) {
          // Verify the stadsdel is in the same city as the incident
          // (e.g. don't match "Tensta" if incident is in Malmö)
          const cityFromTitle = (inc.title || '').split(',').pop()?.trim().toLowerCase() || '';
          const isStockholmDistrict = ['stockholm', 'stockholms län'].includes(cityFromTitle) || 
            inc.area?.toLowerCase().includes('stockholm');
          const isGbgDistrict = ['göteborg', 'göteborgs'].some(g => cityFromTitle.includes(g) || (inc.area || '').toLowerCase().includes(g));
          const isMalmoDistrict = ['malmö'].some(m => cityFromTitle.includes(m) || (inc.area || '').toLowerCase().includes(m));
          
          // Check district belongs to the right city
          const stockholmDistricts = ['södermalm','norrmalm','kungsholmen','östermalm','gamla stan','vasastan','bromma','hägersten','liljeholmen','älvsjö','enskede','farsta','skärholmen','hässelby','vällingby','rinkeby','tensta','spånga','kista','hjulsta','akalla','husby','skarpnäck','hammarbyhöjden','hammarby sjöstad','gullmarsplan','hornstull','fruängen','bandhagen','bagarmossen','rågsved','hagsätra','högdalen','gubbängen','stureby','svedmyra','aspudden','midsommarkransen','telefonplan','globen'];
          const gbgDistricts = ['majorna','linné','hisingen','angered','bergsjön','biskopsgården','centrum göteborg','frölunda','gamlestaden','kortedala','lundby'];
          const malmoDistricts = ['rosengård','fosie','limhamn','husie','oxie','kirseberg','västra hamnen','hyllie'];
          
          const districtBelongs = 
            (isStockholmDistrict && stockholmDistricts.includes(key)) ||
            (isGbgDistrict && gbgDistricts.includes(key)) ||
            (isMalmoDistrict && malmoDistricts.includes(key)) ||
            (!isStockholmDistrict && !isGbgDistrict && !isMalmoDistrict); // unknown city, accept any
          
          if (districtBelongs) {
            bestMatch = { key, entry };
            break; // first stadsdel match is good enough
          }
        }
      }
      
      if (bestMatch) {
        console.log(`Description location upgrade: "${bestMatch.key}" for "${inc.title}" (was ${inc.location_precision} → district)`);
        inc.lat = bestMatch.entry.lat;
        inc.lng = bestMatch.entry.lng;
        inc.location_precision = 'district';
      }
    }

    // ── Scrape detail pages for full descriptions with updates ──
    // Events from the last 6 hours every time; older ones (up to 3 days) every 30 minutes or
    // every 2 hours, with the archived full text in between (see needsDetailScrape)
    const now = Date.now();
    const archivedText = new Map(archived.map((a) => [a.id, a.description ?? '']));
    const scrapeTargets = incidents.filter((i) =>
      needsDetailScrape(i, archivedText.get(i.id), detailScrapedAt.get(i.id), now)
    );
    // A new instance counts archived full texts as fetched now, so it refreshes them on schedule
    const targetIds = new Set(scrapeTargets.map((i) => i.id));
    for (const i of incidents) {
      const kept = archivedText.get(i.id);
      if (!targetIds.has(i.id) && !detailScrapedAt.has(i.id) && kept && kept.length > (i.description || '').length) {
        detailScrapedAt.set(i.id, now);
      }
    }

    // Scrape in batches of 10 to avoid overwhelming polisen.se
    const BATCH_SIZE = 10;
    const scrapeResults = new Map<string, string>();
    
    for (let b = 0; b < scrapeTargets.length; b += BATCH_SIZE) {
      const batch = scrapeTargets.slice(b, b + BATCH_SIZE);
      const batchPromises = batch.map(async (inc) => {
        if (!inc.url) return;
        detailScrapedAt.set(inc.id, now);
        const detail = await scrapeEventDetail(inc.url);
        if (detail && detail.length > (inc.description || '').length) {
          scrapeResults.set(inc.id, detail);
        }
      });
      await Promise.race([
        Promise.all(batchPromises),
        new Promise(resolve => setTimeout(resolve, 4000)),
      ]);
    }

    // Apply scraped descriptions, or the full text archived earlier for pages not fetched now
    for (const inc of incidents) {
      const scraped = scrapeResults.get(inc.id);
      const kept = archivedText.get(inc.id);
      if (scraped) {
        inc.description = scraped;
      } else if (!targetIds.has(inc.id) && kept && kept.length > (inc.description || '').length) {
        inc.description = kept;
      }
    }
    // Forget events that are past the 3-day window
    for (const [id, at] of detailScrapedAt) {
      if (now - at > 4 * 24 * 60 * 60 * 1000) detailScrapedAt.delete(id);
    }
    console.log(`Scraped ${scrapeResults.size} detail pages with updates out of ${scrapeTargets.length} targets (${incidents.length - scrapeTargets.length} skipped)`);

    const validIncidents = incidents.filter((i) => i.lat && i.lng);
    
    const precisionCounts = validIncidents.reduce((acc: Record<string, number>, i) => {
      acc[i.location_precision] = (acc[i.location_precision] || 0) + 1;
      return acc;
    }, {});
    console.log(`Processed ${validIncidents.length} incidents. Precision:`, JSON.stringify(precisionCounts));

    return validIncidents;
}

// ─── Archive helpers ──────────────────────────────────────────────────────────
/**
 * Writes new and changed events to the archive and leaves unchanged ones alone (rewriting
 * all ~500 every few minutes only churned the database). `archived` is what it holds now.
 */
async function archiveIncidents(incidents: PoliceIncident[], archived: PoliceIncident[]) {
  if (!incidents.length) return;
  const { inserts, updates } = planArchiveWrites(incidents, archived);
  if (!inserts.length && !updates.length) {
    console.log(`Archive up to date (${incidents.length} unchanged)`);
    return;
  }
  const toRow = (i: PoliceIncident) => ({
      id: i.id,
      type: i.type,
      title: i.title,
      description: i.description || '',
      lat: i.lat,
      lng: i.lng,
      area: i.area,
      time: i.time,
      status: i.status,
      risk: i.risk,
      source: i.source || 'Polisen.se',
      original_type: i.originalType || null,
      url: i.url || null,
      location_precision: i.location_precision || 'area',
  });
  try {
    // New events: insert, and do nothing if another instance archived them first
    for (let b = 0; b < inserts.length; b += 50) {
      const { error } = await supabase
        .from('police_events_archive')
        .upsert(inserts.slice(b, b + 50).map(toRow), { onConflict: 'id', ignoreDuplicates: true });
      if (error) console.warn('Archive insert error:', error.message);
    }
    for (let b = 0; b < updates.length; b += 50) {
      const { error } = await supabase
        .from('police_events_archive')
        .upsert(updates.slice(b, b + 50).map(toRow), { onConflict: 'id', ignoreDuplicates: false });
      if (error) console.warn('Archive update error:', error.message);
    }
    console.log(`Archive: ${inserts.length} new, ${updates.length} changed, ${incidents.length - inserts.length - updates.length} unchanged`);

    // Keep the in-memory archive in step, so the next fetch compares against what is stored
    if (cachedArchive) {
      const written = new Map([...inserts, ...updates].map((i) => [i.id, i]));
      cachedArchive = [
        ...cachedArchive.map((a) => written.get(a.id) ?? a),
        ...inserts.filter((i) => !cachedArchive!.some((a) => a.id === i.id)),
      ];
    }

    // Push runs when there are new events (Pro accounts hear at once), and when events have just
    // passed the free delay (free accounts hear then, as the events appear on their map). The
    // window spans more than one fetch cycle; the push log stops anything being sent twice.
    const now = Date.now();
    const freeDue = incidents.some((i) => reachedFreeWithin(i.time, now, 12 * 60 * 1000));
    if (!inserts.length && !freeDue) return;
    try {
      const pushUrl = `${supabaseUrl}/functions/v1/send-push-notifications`;
      const pushRes = await fetch(pushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const pushResult = await pushRes.json();
      console.log('Push notifications triggered:', JSON.stringify(pushResult));
    } catch (pushErr) {
      console.warn('Push notification trigger failed:', pushErr);
    }
  } catch (e) {
    console.warn('Archive failed:', e);
  }
}

async function fetchArchivedIncidents(cutoffDays: number = 30): Promise<PoliceIncident[] | null> {
  try {
    const cutoff = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('police_events_archive')
      .select('*')
      .gte('time', cutoff)
      .order('time', { ascending: false })
      .limit(2000);
    if (error) {
      console.warn('Archive fetch error:', error.message);
      return null;
    }
    // Map DB rows back to incident format
    return (data || []).map((r: ArchiveRow) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      lat: r.lat,
      lng: r.lng,
      area: r.area,
      time: r.time,
      status: r.status,
      risk: r.risk,
      source: r.source,
      originalType: r.original_type,
      url: r.url,
      location_precision: r.location_precision,
    }));
  } catch (e) {
    console.warn('Archive fetch failed:', e);
    return null;
  }
}

// Read the 30-day archive at most once per cache TTL, like the fresh incidents.
// A failed read is not cached, so the next request tries again.
async function getArchivedIncidents(): Promise<PoliceIncident[]> {
  if (cachedArchive && Date.now() - cachedArchiveTs < INCIDENTS_CACHE_TTL) return cachedArchive;
  const archived = await fetchArchivedIncidents(30);
  if (!archived) return [];
  cachedArchive = archived;
  cachedArchiveTs = Date.now();
  return archived;
}

function parseIncidentTimestamp(time: string | null | undefined): number {
  if (!time) return 0;
  const parsed = new Date(time).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isWithinLastDays(time: string | null | undefined, days: number): boolean {
  const timestamp = parseIncidentTimestamp(time);
  if (!timestamp) return false;
  const diff = Date.now() - timestamp;
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function hasSummaryPlaceholderDescription(description: string | null | undefined): boolean {
  const normalized = (description || '').trim().toLowerCase();
  return normalized.startsWith('ett urval av nattens polisverksamhet');
}

async function persistBackfilledSummaryDescriptions(summaryScrapeResults: Map<string, string>) {
  if (summaryScrapeResults.size === 0) return;

  const entries = [...summaryScrapeResults.entries()];
  const BATCH_SIZE = 20;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const updates = await Promise.all(
      batch.map(async ([id, description]) => {
        const { error } = await supabase
          .from('police_events_archive')
          .update({ description })
          .eq('id', id);

        return error ? { id, error: error.message } : null;
      })
    );

    const failed = updates.filter(Boolean);
    if (failed.length > 0) {
      console.warn('Failed to persist some summary descriptions:', failed);
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Server-side premium check (cached per token)
    const isPremium = await checkPremiumStatus(req);
    console.log(`User premium status: ${isPremium}`);

    const url = new URL(req.url);
    const location = url.searchParams.get('location') || '';

    // Use cached incidents if still fresh (avoids re-scraping polisen.se for every user)
    let freshIncidents: PoliceIncident[];
    // Set when Polisen's API couldn't be reached: the last known events are served instead
    let stale = false;
    const now = Date.now();
    if (cachedIncidents && (now - cachedIncidentsTs) < INCIDENTS_CACHE_TTL && !location) {
      console.log(`Serving ${cachedIncidents.length} incidents from cache (age: ${Math.round((now - cachedIncidentsTs) / 1000)}s)`);
      freshIncidents = cachedIncidents;
    } else if (!location && now < polisenRetryAt) {
      // Polisen failed a moment ago; don't make every visitor wait for it again
      stale = true;
      freshIncidents = cachedIncidents ?? [];
    } else {
      console.log('Cache miss or expired, fetching fresh data...');
      // What the archive holds now: saves fetching unchanged pages, summaries keep their
      // scraped full text, and only new or changed events are written
      const archivedNow = await getArchivedIncidents();
      try {
        freshIncidents = await fetchAndProcessIncidents(location, archivedNow);
      } catch (fetchError) {
        if (location) throw fetchError;
        // Polisen's API is down or slow: the map keeps the last known events (from this
        // instance, or the archive below) and says they are not being updated
        console.warn('Polisen fetch failed, serving last known events:', fetchError);
        stale = true;
        polisenRetryAt = now + POLISEN_RETRY_MS;
        freshIncidents = cachedIncidents ?? [];
      }
      // Only cache default (no location filter) requests
      if (!location && !stale) {
        markPolisenFetched();
        freshIncidents = keepBackfilledSummaries(freshIncidents, archivedNow);
        cachedIncidents = freshIncidents;
        cachedIncidentsTs = Date.now();
        // Archive fresh incidents to DB (fire and forget)
        archiveIncidents(freshIncidents, archivedNow);
      }
    }

    // Merge fresh data with archived data (archived fills the 10-30 day gap)
    const freshIds = new Set(freshIncidents.map((i) => i.id));
    const archived = await getArchivedIncidents();
    const olderArchived = archived.filter((a) => !freshIds.has(a.id));
    let allIncidents = [...freshIncidents, ...olderArchived];
    console.log(`Combined: ${freshIncidents.length} fresh + ${olderArchived.length} archived = ${allIncidents.length} total`);

    const isSummaryIncident = (incident: PoliceIncident) => {
      const haystack = `${incident.originalType || incident.original_type || ''} ${incident.title || ''}`.toLowerCase();
      return haystack.includes('sammanfattning');
    };

    const summaryScrapeTargets = allIncidents
      .filter((i) => isSummaryIncident(i) && i.url && isWithinLastDays(i.time, 7))
      .filter((i) => hasSummaryPlaceholderDescription(i.description) || !i.description || i.description.length < 180)
      .filter((i) => Date.now() - (summaryScrapeAttempts.get(i.id) ?? 0) >= INCIDENTS_CACHE_TTL)
      .sort((a, b) => {
        const placeholderPriority = Number(hasSummaryPlaceholderDescription(b.description)) - Number(hasSummaryPlaceholderDescription(a.description));
        if (placeholderPriority !== 0) return placeholderPriority;
        return parseIncidentTimestamp(b.time) - parseIncidentTimestamp(a.time);
      });

    // polisen.se is not answering when stale; the summaries are fetched once it is back
    if (!stale && summaryScrapeTargets.length > 0) {
      const summaryScrapeResults = new Map<string, string>();
      const SUMMARY_BATCH_SIZE = 8;

      for (let b = 0; b < summaryScrapeTargets.length; b += SUMMARY_BATCH_SIZE) {
        const batch = summaryScrapeTargets.slice(b, b + SUMMARY_BATCH_SIZE);
        const batchPromises = batch.map(async (incident) => {
          if (!incident.url) return;
          summaryScrapeAttempts.set(incident.id, Date.now());
          const detail = await scrapeEventDetail(incident.url);
          if (detail && detail.length > (incident.description || '').length) {
            summaryScrapeResults.set(incident.id, detail);
          }
        });
        await Promise.all(batchPromises);
      }

      if (summaryScrapeResults.size > 0) {
        allIncidents = allIncidents.map((incident) => ({
          ...incident,
          description: summaryScrapeResults.get(incident.id) || incident.description,
        }));

        // Keep the backfilled text in the caches too, so it isn't scraped again on the next request
        for (const cached of [cachedIncidents, cachedArchive]) {
          cached?.forEach((incident) => {
            const description = summaryScrapeResults.get(incident.id);
            if (description) incident.description = description;
          });
        }

        await persistBackfilledSummaryDescriptions(summaryScrapeResults);
      }

      // Forget old attempts so the map stays small
      if (summaryScrapeAttempts.size > 500) {
        for (const [id, at] of summaryScrapeAttempts) {
          if (Date.now() - at >= INCIDENTS_CACHE_TTL) summaryScrapeAttempts.delete(id);
        }
      }

      console.log(`Backfilled ${summaryScrapeResults.size} summary descriptions`);
    }

    // Apply premium filtering per-user
    let resultIncidents = allIncidents;
    if (!isPremium) {
      const delayCutoff = Date.now() - DELAY_MS;
      resultIncidents = allIncidents
        .filter((i) => {
          try {
            const t = new Date(i.time).getTime();
            return !isNaN(t) && t <= delayCutoff;
          } catch { return false; }
        })
        .map((i) => ({
          ...i,
          description: isSummaryIncident(i) ? (i.description || '') : '',
        }));
      console.log(`Premium filter applied: ${resultIncidents.length} incidents after 15min delay`);
    }

    return new Response(JSON.stringify({ success: true, data: resultIncidents, premium: isPremium, fetchedAt: await polisenFetchedAt(), stale }), {
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
