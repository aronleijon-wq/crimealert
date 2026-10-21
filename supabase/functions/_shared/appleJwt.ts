// Tokens Apple's servers take in place of a password: a JWT signed (ES256) with a .p8 key from
// the developer account. APNs (apns.ts) and the App Store Server API (appStore.ts) both use them.

const base64url = (bytes: Uint8Array) => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** A .p8 file's contents, with or without its header lines and line breaks (also as "\n") */
async function importP8(privateKey: string): Promise<CryptoKey> {
  const pem = privateKey.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
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
