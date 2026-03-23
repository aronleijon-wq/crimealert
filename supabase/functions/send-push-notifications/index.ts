import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Web Push crypto utilities for Deno
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<boolean> {
  // Use the web-push approach via fetch to the push endpoint
  // For simplicity, we'll use a direct fetch with VAPID JWT
  try {
    const vapidJwt = await createVapidJwt(subscription.endpoint, vapidPublicKey, vapidPrivateKey, vapidSubject);
    
    // Import the keys
    const p256dhBytes = base64urlToUint8Array(subscription.p256dh);
    const authBytes = base64urlToUint8Array(subscription.auth);
    
    // Generate local ECDH key pair
    const localKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );
    
    const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);
    
    // Import subscriber public key
    const subscriberPublicKey = await crypto.subtle.importKey(
      "raw",
      p256dhBytes,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );
    
    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveBits(
      { name: "ECDH", public: subscriberPublicKey },
      localKeyPair.privateKey,
      256
    );
    
    // Generate salt
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    // Derive encryption key using HKDF
    const ikm = await deriveIKM(new Uint8Array(sharedSecret), authBytes, new Uint8Array(localPublicKeyRaw), p256dhBytes);
    const contentEncryptionKey = await deriveKey(ikm, salt, new Uint8Array(localPublicKeyRaw), p256dhBytes, "Content-Encoding: aes128gcm\0", 16);
    const nonce = await deriveKey(ikm, salt, new Uint8Array(localPublicKeyRaw), p256dhBytes, "Content-Encoding: nonce\0", 12);
    
    // Encrypt payload
    const payloadBytes = new TextEncoder().encode(payload);
    const paddedPayload = new Uint8Array(payloadBytes.length + 2);
    paddedPayload.set(payloadBytes);
    paddedPayload[payloadBytes.length] = 2; // delimiter
    // rest is zeros (padding)
    
    const encryptionKey = await crypto.subtle.importKey(
      "raw",
      contentEncryptionKey,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );
    
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      encryptionKey,
      paddedPayload
    );
    
    // Build the aes128gcm content coding header
    const recordSize = new Uint8Array(4);
    new DataView(recordSize.buffer).setUint32(0, encrypted.byteLength + 86);
    
    const localPubKeyArray = new Uint8Array(localPublicKeyRaw);
    const header = new Uint8Array(86 + encrypted.byteLength);
    header.set(salt, 0); // 16 bytes salt
    header.set(recordSize, 16); // 4 bytes record size
    header[20] = 65; // key length
    header.set(localPubKeyArray, 21); // 65 bytes public key
    header.set(new Uint8Array(encrypted), 86);
    
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
        Authorization: `vapid t=${vapidJwt}, k=${vapidPublicKey}`,
      },
      body: header,
    });
    
    if (response.status === 410 || response.status === 404) {
      // Subscription expired, should be removed
      return false;
    }
    
    return response.ok;
  } catch (e) {
    console.error("Push send error:", e);
    return false;
  }
}

async function deriveIKM(
  sharedSecret: Uint8Array,
  authSecret: Uint8Array,
  localPublicKey: Uint8Array,
  subscriberPublicKey: Uint8Array
): Promise<Uint8Array> {
  const keyInfo = concatBuffers(
    new TextEncoder().encode("WebPush: info\0"),
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
  localPublicKey: Uint8Array,
  subscriberPublicKey: Uint8Array,
  info: string,
  length: number
): Promise<Uint8Array> {
  const prk = await hmacSha256(salt, ikm);
  const infoBytes = new TextEncoder().encode(info);
  const result = await hmacSha256(prk, concatBuffers(infoBytes, new Uint8Array([1])));
  return result.slice(0, length);
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
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

async function createVapidJwt(
  endpoint: string,
  publicKey: string,
  privateKey: string,
  subject: string
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600;
  
  const header = base64urlEncode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = base64urlEncode(
    JSON.stringify({ aud: audience, exp: expiry, sub: subject })
  );
  
  const unsignedToken = `${header}.${payload}`;
  
  // Import private key
  const privateKeyBytes = base64urlToUint8Array(privateKey);
  const publicKeyBytes = base64urlToUint8Array(publicKey);
  
  // Create JWK from raw key
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: uint8ArrayToBase64url(publicKeyBytes.slice(1, 33)),
    y: uint8ArrayToBase64url(publicKeyBytes.slice(33, 65)),
    d: uint8ArrayToBase64url(privateKeyBytes),
  };
  
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );
  
  // Convert DER signature to raw r||s format if needed
  const sigBytes = new Uint8Array(signature);
  const rawSig = sigBytes.length === 64 ? sigBytes : derToRaw(sigBytes);
  
  return `${unsignedToken}.${uint8ArrayToBase64url(rawSig)}`;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // Already raw format
  if (der.length === 64) return der;
  
  // Parse DER
  const raw = new Uint8Array(64);
  let offset = 2; // skip 0x30, length
  
  // r
  if (der[offset] !== 0x02) return der;
  offset++;
  let rLen = der[offset++];
  let rStart = offset;
  if (rLen === 33 && der[rStart] === 0) { rStart++; rLen--; }
  raw.set(der.slice(rStart, rStart + Math.min(rLen, 32)), 32 - Math.min(rLen, 32));
  offset = rStart + (rLen === 32 ? rLen : rLen);
  if (der[rStart - 1 - 1] === 33) offset = rStart + 32;
  
  // s
  offset = 2 + 2 + der[3]; // skip to s
  if (der[offset] !== 0x02) return der;
  offset++;
  let sLen = der[offset++];
  let sStart = offset;
  if (sLen === 33 && der[sStart] === 0) { sStart++; sLen--; }
  raw.set(der.slice(sStart, sStart + Math.min(sLen, 32)), 64 - Math.min(sLen, 32));
  
  return raw;
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find events from the last 30 minutes (wider window to avoid missing events)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: recentEvents, error: eventsError } = await supabase
      .from("police_events_archive")
      .select("id, title, area, type, risk, time, original_type")
      .gte("created_at", thirtyMinAgo)
      .not("original_type", "ilike", "%sammanfattning%");

    if (eventsError) throw eventsError;
    if (!recentEvents || recentEvents.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_new_events" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("user_id, kommun");

    if (!prefs || prefs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_watchers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build user->kommuner map
    const userKommuner: Record<string, string[]> = {};
    for (const p of prefs) {
      if (!userKommuner[p.user_id]) userKommuner[p.user_id] = [];
      userKommuner[p.user_id].push(p.kommun.toLowerCase());
    }

    // Match events to users
    const userNotifications: Record<string, typeof recentEvents> = {};
    for (const event of recentEvents) {
      const eventArea = (event.area || "").toLowerCase();
      for (const [userId, kommuner] of Object.entries(userKommuner)) {
        if (kommuner.some((k) => eventArea.includes(k))) {
          if (!userNotifications[userId]) userNotifications[userId] = [];
          userNotifications[userId].push(event);
        }
      }
    }

    const userIds = Object.keys(userNotifications);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_matches" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out already-sent notifications
    const allEventIds = recentEvents.map((e) => e.id);
    const { data: alreadySent } = await supabase
      .from("sent_push_log")
      .select("event_id, user_id")
      .in("event_id", allEventIds)
      .in("user_id", userIds);

    const sentSet = new Set(
      (alreadySent || []).map((s) => `${s.event_id}:${s.user_id}`)
    );

    // Remove already-sent events per user
    for (const [userId, events] of Object.entries(userNotifications)) {
      userNotifications[userId] = events.filter(
        (e) => !sentSet.has(`${e.id}:${userId}`)
      );
    }

    // Remove users with no new events
    for (const userId of Object.keys(userNotifications)) {
      if (userNotifications[userId].length === 0) {
        delete userNotifications[userId];
      }
    }

    const filteredUserIds = Object.keys(userNotifications);
    if (filteredUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get push subscriptions for matched users
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", filteredUserIds);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_push_subs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      const events = userNotifications[sub.user_id];
      if (!events || events.length === 0) continue;

      // Send one notification per user with summary
      const firstEvent = events[0];
      const title = events.length === 1
        ? `${firstEvent.type} — ${firstEvent.area}`
        : `${events.length} nya händelser i dina bevakade kommuner`;
      const body = events.length === 1
        ? firstEvent.title
        : events.slice(0, 3).map((e) => `${e.type}: ${e.area}`).join("\n");

      const payload = JSON.stringify({
        title,
        body,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        tag: "crimealert-incident",
        data: { url: "/" },
      });

      const success = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        vapidPublicKey,
        vapidPrivateKey,
        "mailto:alvejon.staff@gmail.com"
      );

      if (success) {
        sentCount++;
        // Log sent notification to avoid re-sending
        const logEntries = events.map((e) => ({
          event_id: e.id,
          user_id: sub.user_id,
        }));
        await supabase.from("sent_push_log").insert(logEntries);
      } else {
        expiredEndpoints.push(sub.endpoint);
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    return new Response(
      JSON.stringify({ sent: sentCount, expired_cleaned: expiredEndpoints.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Push notification error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
