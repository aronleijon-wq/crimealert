import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@18.5.0';
import { isFresh, lookupProUntil, proUntilActive, readProStatus, rememberProStatus, type ServiceClient } from '../_shared/premium.ts';
import { buildWeeklyMessage, inSummaryWindow, summarizeKommun, weekKey, type SummaryEvent } from '../_shared/weeklySummary.ts';
import {
  buildPushMessage,
  freeMayNotify,
  safeAppPath,
  settingsFromRow,
  wantsEvent,
  watchedKommunFor,
  type NotifySettings,
  type PushEvent,
} from '../_shared/notifications.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type EventRow = PushEvent;

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ ok: boolean; status: number | null; expired: boolean; error?: string }> {
  try {
    const vapidJwt = await createVapidJwt(subscription.endpoint, vapidPublicKey, vapidPrivateKey, vapidSubject);
    const p256dhBytes = base64urlToUint8Array(subscription.p256dh);
    const authBytes = base64urlToUint8Array(subscription.auth);

    const localKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );

    const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);

    const subscriberPublicKey = await crypto.subtle.importKey(
      'raw',
      p256dhBytes,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    const sharedSecret = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: subscriberPublicKey },
      localKeyPair.privateKey,
      256
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const ikm = await deriveIKM(new Uint8Array(sharedSecret), authBytes, new Uint8Array(localPublicKeyRaw), p256dhBytes);
    const contentEncryptionKey = await deriveKey(ikm, salt, 'Content-Encoding: aes128gcm\0', 16);
    const nonce = await deriveKey(ikm, salt, 'Content-Encoding: nonce\0', 12);

    const payloadBytes = new TextEncoder().encode(payload);
    const paddedPayload = new Uint8Array(payloadBytes.length + 2);
    paddedPayload.set(payloadBytes);
    paddedPayload[payloadBytes.length] = 2;

    const encryptionKey = await crypto.subtle.importKey('raw', contentEncryptionKey, { name: 'AES-GCM' }, false, ['encrypt']);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      encryptionKey,
      paddedPayload
    );

    const recordSize = new Uint8Array(4);
    new DataView(recordSize.buffer).setUint32(0, encrypted.byteLength + 86);

    const localPubKeyArray = new Uint8Array(localPublicKeyRaw);
    const header = new Uint8Array(86 + encrypted.byteLength);
    header.set(salt, 0);
    header.set(recordSize, 16);
    header[20] = 65;
    header.set(localPubKeyArray, 21);
    header.set(new Uint8Array(encrypted), 86);

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        TTL: '86400',
        Authorization: `vapid t=${vapidJwt}, k=${vapidPublicKey}`,
      },
      body: header,
    });

    const responseText = await response.text();
    // 404/410 = gone. Apple returns 400 with VapidPkHashMismatch/BadJwtToken when the
    // subscription was created with an older VAPID key — also unrecoverable, so prune it.
    const invalidKey =
      response.status === 400 && /VapidPkHashMismatch|BadJwtToken|InvalidJwt/i.test(responseText);
    const expired = response.status === 404 || response.status === 410 || invalidKey;

    if (!response.ok) {
      console.warn('Push provider returned non-OK status', { endpoint: subscription.endpoint, status: response.status, expired, responseText });
    }

    return {
      ok: response.ok,
      status: response.status,
      expired,
      error: response.ok ? undefined : responseText || `HTTP ${response.status}`,
    };
  } catch (error) {
    console.error('Push send error:', error);
    return {
      ok: false,
      status: null,
      expired: false,
      error: error instanceof Error ? error.message : 'Unknown push error',
    };
  }
}

async function deriveIKM(
  sharedSecret: Uint8Array<ArrayBuffer>,
  authSecret: Uint8Array<ArrayBuffer>,
  localPublicKey: Uint8Array<ArrayBuffer>,
  subscriberPublicKey: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const keyInfo = concatBuffers(
    new TextEncoder().encode('WebPush: info\0'),
    subscriberPublicKey,
    localPublicKey
  );

  const prk = await hmacSha256(authSecret, sharedSecret);
  const result = await hmacSha256(prk, concatBuffers(keyInfo, new Uint8Array([1])));
  return new Uint8Array(result.slice(0, 32));
}

async function deriveKey(
  ikm: Uint8Array<ArrayBuffer>,
  salt: Uint8Array<ArrayBuffer>,
  info: string,
  length: number
): Promise<Uint8Array<ArrayBuffer>> {
  const prk = await hmacSha256(salt, ikm);
  const infoBytes = new TextEncoder().encode(info);
  const result = await hmacSha256(prk, concatBuffers(infoBytes, new Uint8Array([1])));
  return new Uint8Array(result.slice(0, length));
}

async function hmacSha256(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(sig);
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }

  return result;
}

async function createVapidJwt(endpoint: string, publicKey: string, privateKey: string, subject: string): Promise<string> {
  const audience = new URL(endpoint).origin;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600;
  const header = base64urlEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = base64urlEncode(JSON.stringify({ aud: audience, exp: expiry, sub: subject }));
  const unsignedToken = `${header}.${payload}`;

  const privateKeyBytes = base64urlToUint8Array(privateKey);
  const publicKeyBytes = base64urlToUint8Array(publicKey);

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: uint8ArrayToBase64url(publicKeyBytes.slice(1, 33)),
    y: uint8ArrayToBase64url(publicKeyBytes.slice(33, 65)),
    d: uint8ArrayToBase64url(privateKeyBytes),
  };

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsignedToken));
  const sigBytes = new Uint8Array(signature);
  const rawSig = sigBytes.length === 64 ? sigBytes : derToRaw(sigBytes);

  return `${unsignedToken}.${uint8ArrayToBase64url(rawSig)}`;
}

function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length === 64) return der;

  const raw = new Uint8Array(64);
  let offset = 2;
  if (der[offset] !== 0x02) return der;

  offset++;
  let rLen = der[offset++];
  let rStart = offset;
  if (rLen === 33 && der[rStart] === 0) {
    rStart++;
    rLen--;
  }
  raw.set(der.slice(rStart, rStart + Math.min(rLen, 32)), 32 - Math.min(rLen, 32));

  offset = 2 + 2 + der[3];
  if (der[offset] !== 0x02) return der;
  offset++;
  let sLen = der[offset++];
  let sStart = offset;
  if (sLen === 33 && der[sStart] === 0) {
    sStart++;
    sLen--;
  }
  raw.set(der.slice(sStart, sStart + Math.min(sLen, 32)), 64 - Math.min(sLen, 32));

  return raw;
}

function base64urlToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '');
}

type AdminClient = ServiceClient & {
  auth: { admin: { getUserById(id: string): Promise<{ data: { user: { email?: string } | null }; error: unknown }> } };
};

// Stripe lookups per run for accounts without a recent stored answer; the rest wait for the next run
const MAX_STRIPE_LOOKUPS = 20;

/** Which of these users have Pro now. */
async function findProUsers(supabase: AdminClient, userIds: string[], now: number): Promise<Set<string>> {
  const pro = new Set<string>();
  if (!userIds.length) return pro;
  const stored = await readProStatus(supabase, userIds);
  const stale: string[] = [];
  for (const userId of userIds) {
    const row = stored.get(userId);
    if (row && isFresh(row, now)) {
      if (proUntilActive(row.pro_until, now)) pro.add(userId);
    } else {
      // Until Stripe has been asked, an older stored answer is better than none
      if (row && proUntilActive(row.pro_until, now)) pro.add(userId);
      stale.push(userId);
    }
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' }) : null;
  for (const userId of stale.slice(0, MAX_STRIPE_LOOKUPS)) {
    try {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error || !data.user?.email) continue;
      const proUntil = await lookupProUntil(stripe, data.user.email, now);
      await rememberProStatus(supabase, userId, proUntil);
      if (proUntilActive(proUntil, now)) pro.add(userId);
      else pro.delete(userId);
    } catch (error) {
      console.warn('Pro lookup failed for', userId, error);
    }
  }
  return pro;
}

/** Reads every row of a query, a thousand at a time. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

/** The Sunday evening summary of the last week in each user's kommuner. */
async function sendWeeklySummaries(supabase: ServiceClient, vapidPublicKey: string, vapidPrivateKey: string, now: number) {
  if (!inSummaryWindow(now)) return { sent: 0, reason: 'outside_window' };
  const week = weekKey(now);

  const subscriptions = await readAll<PushSubscriptionRow>((from, to) => supabase.from('push_subscriptions').select('*').range(from, to));
  const withPush = [...new Set(subscriptions.map((s) => s.user_id))];
  if (!withPush.length) return { sent: 0, reason: 'no_push_subs' };

  // Both need this feature's migration; without it nothing can be sent safely
  const { data: settingsRows, error: settingsError } = await supabase
    .from('notification_settings')
    .select('user_id, weekly_summary')
    .in('user_id', withPush);
  const { data: sentRows, error: logError } = await supabase.from('weekly_summary_log').select('user_id').eq('week', week);
  if (settingsError || logError) {
    console.warn('Weekly summary not ready', settingsError?.message, logError?.message);
    return { sent: 0, reason: 'not_ready' };
  }
  const optedOut = new Set((settingsRows ?? []).filter((r: { weekly_summary: boolean }) => r.weekly_summary === false).map((r: { user_id: string }) => r.user_id));
  const alreadySent = new Set((sentRows ?? []).map((r: { user_id: string }) => r.user_id));

  const prefs = await readAll<{ user_id: string; kommun: string }>((from, to) =>
    supabase.from('notification_preferences').select('user_id, kommun').in('user_id', withPush).range(from, to));
  const kommunerOf = new Map<string, string[]>();
  for (const pref of prefs) {
    if (optedOut.has(pref.user_id) || alreadySent.has(pref.user_id)) continue;
    kommunerOf.set(pref.user_id, [...(kommunerOf.get(pref.user_id) ?? []), pref.kommun]);
  }
  if (!kommunerOf.size) return { sent: 0, reason: 'nothing_due', week };

  // Claim the users first, so a second run at the same time can't send them a summary too
  const { data: claimed, error: claimError } = await supabase
    .from('weekly_summary_log')
    .upsert([...kommunerOf.keys()].map((user_id) => ({ user_id, week })), { onConflict: 'user_id,week', ignoreDuplicates: true })
    .select('user_id');
  if (claimError) throw claimError;
  const claimedUsers = new Set((claimed ?? []).map((r: { user_id: string }) => r.user_id));

  const since = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const events = await readAll<SummaryEvent>((from, to) =>
    supabase.from('police_events_archive').select('area, original_type, time').gte('time', since).order('time', { ascending: false }).range(from, to));

  let sent = 0;
  const expiredEndpoints: string[] = [];
  for (const [userId, kommuner] of kommunerOf) {
    if (!claimedUsers.has(userId)) continue;
    const message = buildWeeklyMessage([...new Set(kommuner)].map((k) => summarizeKommun(events, k, now)));
    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: message.tag,
      data: { url: message.url },
      requireInteraction: false,
    });
    for (const sub of subscriptions.filter((s) => s.user_id === userId)) {
      const result = await sendWebPush(sub, payload, vapidPublicKey, vapidPrivateKey, 'mailto:push@crimealert.se');
      if (result.ok) sent++;
      else if (result.expired) expiredEndpoints.push(sub.endpoint);
    }
  }
  if (expiredEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
  }
  console.log('Weekly summary', JSON.stringify({ week, users: claimedUsers.size, sent }));
  return { sent, users: claimedUsers.size, week, expired_cleaned: expiredEndpoints.length };
}

async function getRequestBody(req: Request) {
  const raw = await req.text();
  if (!raw) return {} as Record<string, unknown>;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('Request body måste vara giltig JSON.');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
      throw new Error('Saknade miljövariabler för push-flödet.');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await getRequestBody(req);
    const mode = body.mode === 'test' ? 'test' : body.mode === 'weekly' ? 'weekly' : 'live';
    const token = getBearerToken(req);
    const isInternalCall = token === serviceRoleKey;

    // The weekly summary is started by the Sunday schedule with the public key. Anyone could call
    // it, but it only sends on Sunday evenings and to each user once a week.
    if (mode === 'weekly') {
      const result = await sendWeeklySummaries(supabase, vapidPublicKey, vapidPrivateKey, Date.now());
      return new Response(JSON.stringify(result), {
        status: result.reason === 'not_ready' ? 503 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let requestUserId: string | null = null;
    if (!isInternalCall && token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        return new Response(JSON.stringify({ error: 'Ogiltig användarsession.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      requestUserId = data.user.id;
    }

    // Live broadcasts may only be triggered internally (service role key).
    if (mode !== 'test' && !isInternalCall) {
      return new Response(JSON.stringify({ error: 'Ej behörig.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (mode === 'test') {
      if (!requestUserId) {
        return new Response(JSON.stringify({ error: 'Du måste vara inloggad för att skicka testnotis.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', requestUserId);

      if (subscriptionsError) throw subscriptionsError;
      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ sent: 0, subscriptionCount: 0, results: [], error: 'Ingen sparad push subscription hittades.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const payload = JSON.stringify({
        title: '✅ Notiser fungerar',
        body: 'Så här ser det ut när något händer i dina bevakade områden.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'crimealert-test',
        data: { url: safeAppPath(body.url) },
        requireInteraction: true,
      });

      const results = [];
      const expiredEndpoints: string[] = [];

      for (const sub of subscriptions as PushSubscriptionRow[]) {
        const result = await sendWebPush(sub, payload, vapidPublicKey, vapidPrivateKey, 'mailto:push@crimealert.se');
        results.push({ endpoint: sub.endpoint, ...result });
        if (result.expired) expiredEndpoints.push(sub.endpoint);
      }

      if (expiredEndpoints.length > 0) {
        await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
      }

      const sent = results.filter((result) => result.ok).length;
      console.log('Push test result', JSON.stringify({ requestUserId, sent, subscriptionCount: subscriptions.length, results }));

      return new Response(JSON.stringify({ sent, subscriptionCount: subscriptions.length, expired_cleaned: expiredEndpoints.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Events archived in the last hour: new ones for Pro, and ones free accounts get after the delay
    const now = Date.now();
    const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const { data: recentEvents, error: eventsError } = await supabase
      .from('police_events_archive')
      .select('id, title, area, type, risk, time, original_type')
      .gte('created_at', hourAgo)
      .not('original_type', 'ilike', '%sammanfattning%');

    if (eventsError) throw eventsError;
    if (!recentEvents || recentEvents.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_new_events' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('user_id, kommun');

    if (prefsError) throw prefsError;
    if (!prefs || prefs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_watchers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userKommuner: Record<string, string[]> = {};
    for (const pref of prefs) {
      if (!userKommuner[pref.user_id]) userKommuner[pref.user_id] = [];
      userKommuner[pref.user_id].push(pref.kommun);
    }

    // What each user wants to hear about. No row means everything; if the table can't be read
    // (e.g. before its migration has run), everyone keeps getting everything.
    const userSettings: Record<string, NotifySettings> = {};
    const { data: settingsRows, error: settingsError } = await supabase
      .from('notification_settings')
      .select('user_id, types, min_risk');
    if (settingsError) {
      console.warn('Could not read notification settings, using defaults', settingsError.message);
    }
    for (const row of settingsRows ?? []) userSettings[row.user_id] = settingsFromRow(row);

    const userNotifications: Record<string, EventRow[]> = {};
    for (const event of recentEvents as EventRow[]) {
      for (const [userId, kommuner] of Object.entries(userKommuner)) {
        if (!watchedKommunFor(event.area, kommuner)) continue;
        if (!wantsEvent(userSettings[userId] ?? settingsFromRow(null), event)) continue;
        if (!userNotifications[userId]) userNotifications[userId] = [];
        userNotifications[userId].push(event);
      }
    }

    const userIds = Object.keys(userNotifications);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_matches' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allEventIds = (recentEvents as EventRow[]).map((event) => event.id);
    const { data: alreadySent } = await supabase
      .from('sent_push_log')
      .select('event_id, user_id')
      .in('event_id', allEventIds)
      .in('user_id', userIds);

    const sentSet = new Set((alreadySent || []).map((row) => `${row.event_id}:${row.user_id}`));

    for (const [userId, events] of Object.entries(userNotifications)) {
      userNotifications[userId] = events.filter((event) => !sentSet.has(`${event.id}:${userId}`));
    }

    // Free accounts hear about an event when it reaches their map, 15 minutes after it happened;
    // Pro at once. Pro status comes from what check-subscription stored, or Stripe if that is old.
    const waitingUsers = Object.entries(userNotifications)
      .filter(([, events]) => events.some((event) => !freeMayNotify(event.time, now)))
      .map(([userId]) => userId);
    const proUsers = await findProUsers(supabase, waitingUsers, now);
    for (const userId of waitingUsers) {
      if (!proUsers.has(userId)) {
        userNotifications[userId] = userNotifications[userId].filter((event) => freeMayNotify(event.time, now));
      }
    }

    for (const userId of Object.keys(userNotifications)) {
      if (userNotifications[userId].length === 0) {
        delete userNotifications[userId];
      }
    }

    const filteredUserIds = Object.keys(userNotifications);
    if (filteredUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'already_sent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', filteredUserIds);

    if (subsError) throw subsError;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_push_subs' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sentCount = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions as PushSubscriptionRow[]) {
      const events = userNotifications[sub.user_id];
      if (!events?.length) continue;

      const message = buildPushMessage(events);
      const payload = JSON.stringify({
        title: message.title,
        body: message.body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: message.tag,
        data: { url: message.url, incidentId: message.incidentId },
        requireInteraction: true,
      });

      const result = await sendWebPush(sub, payload, vapidPublicKey, vapidPrivateKey, 'mailto:push@crimealert.se');
      console.log('Push live result', JSON.stringify({ userId: sub.user_id, endpoint: sub.endpoint, eventCount: events.length, result }));

      if (result.ok) {
        sentCount++;
        const logEntries = events.map((event) => ({ event_id: event.id, user_id: sub.user_id }));
        await supabase.from('sent_push_log').insert(logEntries);
      } else if (result.expired) {
        expiredEndpoints.push(sub.endpoint);
      }
    }

    if (expiredEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
    }

    return new Response(JSON.stringify({ sent: sentCount, expired_cleaned: expiredEndpoints.length, subscriptionCount: subscriptions.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
