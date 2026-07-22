import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

type EventRow = {
  id: string;
  title: string;
  area: string | null;
  type: string;
  risk: string | null;
  time: string;
  original_type: string | null;
};

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

    const expired = response.status === 404 || response.status === 410;
    const responseText = await response.text();

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
  sharedSecret: Uint8Array,
  authSecret: Uint8Array,
  localPublicKey: Uint8Array,
  subscriberPublicKey: Uint8Array
): Promise<Uint8Array> {
  const keyInfo = concatBuffers(
    new TextEncoder().encode('WebPush: info\0'),
    subscriberPublicKey,
    localPublicKey
  );

  const prk = await hmacSha256(authSecret, sharedSecret);
  const result = await hmacSha256(prk, concatBuffers(keyInfo, new Uint8Array([1])));
  return result.slice(0, 32);
}

async function deriveKey(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: string,
  length: number
): Promise<Uint8Array> {
  const prk = await hmacSha256(salt, ikm);
  const infoBytes = new TextEncoder().encode(info);
  const result = await hmacSha256(prk, concatBuffers(infoBytes, new Uint8Array([1])));
  return result.slice(0, length);
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(sig);
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
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

function base64urlToUint8Array(base64url: string): Uint8Array {
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
    const mode = body.mode === 'test' ? 'test' : 'live';
    const token = getBearerToken(req);
    const isInternalCall = token === serviceRoleKey;

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
        title: 'CrimeAlert testnotis',
        body: 'Push-flödet fungerar — denna notis skickades via backend, VAPID och service worker.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'crimealert-test',
        data: { url: '/debug-push' },
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

    // Live mode: only internal service-role callers may trigger mass broadcasts
    if (!isInternalCall) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentEvents, error: eventsError } = await supabase
      .from('police_events_archive')
      .select('id, title, area, type, risk, time, original_type')
      .gte('created_at', thirtyMinAgo)
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
      userKommuner[pref.user_id].push(pref.kommun.toLowerCase());
    }

    const userNotifications: Record<string, EventRow[]> = {};
    for (const event of recentEvents as EventRow[]) {
      const eventArea = (event.area || '').toLowerCase();
      for (const [userId, kommuner] of Object.entries(userKommuner)) {
        if (kommuner.some((kommun) => eventArea.includes(kommun))) {
          if (!userNotifications[userId]) userNotifications[userId] = [];
          userNotifications[userId].push(event);
        }
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

      const firstEvent = events[0];
      const title = events.length === 1 ? `${firstEvent.type} — ${firstEvent.area}` : `${events.length} nya händelser i dina bevakade kommuner`;
      const body = events.length === 1 ? firstEvent.title : events.slice(0, 3).map((event) => `${event.type}: ${event.area}`).join('\n');
      const targetUrl = events.length === 1 ? `/?incident=${encodeURIComponent(firstEvent.id)}` : '/';
      const payload = JSON.stringify({
        title,
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: `crimealert-incident-${firstEvent.id}`,
        data: { url: targetUrl, incidentId: events.length === 1 ? firstEvent.id : null },
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
