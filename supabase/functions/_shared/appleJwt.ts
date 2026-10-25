// Tokens Apple's servers take in place of a password: a JWT signed (ES256) with a .p8 key from
// the developer account. APNs (apns.ts) and the App Store Server API (appStore.ts) both use them.

const base64url = (bytes: Uint8Array) => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * A .p8 file's contents, as pasted into a secret: with or without its header lines, line breaks
 * (also as "\n"), quotes around it, or dashes a text editor turned into long ones.
 */
async function importP8(privateKey: string): Promise<CryptoKey> {
  let body = privateKey.replace(/\\n/g, '\n');
  const begin = body.search(/BEGIN [A-Z ]*KEY/);
  if (begin >= 0) body = body.slice(begin).replace(/^BEGIN [A-Z ]*KEY/, '');
  const end = body.search(/END [A-Z ]*KEY/);
  if (end >= 0) body = body.slice(0, end);
  body = body.replace(/[^A-Za-z0-9+/=]/g, '');
  try {
    const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    return await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  } catch {
    throw new Error('Nyckeln från Apple (.p8) gick inte att läsa. Klistra in hela .p8-filen igen.');
  }
}

export async function signAppleJwt(header: Record<string, unknown>, claims: Record<string, unknown>, privateKey: string): Promise<string> {
  const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const unsigned = `${encode({ alg: 'ES256', ...header })}.${encode(claims)}`;
  // WebCrypto signs in the raw r|s form JWT uses
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await importP8(privateKey), new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

/** The claims of a JWS from Apple, unchecked: only for data fetched from Apple itself, or to find what to fetch */
export function decodeJws<T>(jws: string): T {
  const part = jws.split('.')[1] ?? '';
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))) as T;
}
