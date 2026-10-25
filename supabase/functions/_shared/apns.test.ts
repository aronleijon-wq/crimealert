import { describe, it, expect, vi, afterEach } from 'vitest';
import { apnsJwt, apnsMessage, parseApnsEndpoint, sendApns } from './apns';

const TOKEN = 'ab'.repeat(32);

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString());

async function p8Key() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64');
  const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----`;
  return { pem, publicKey: pair.publicKey };
}

afterEach(() => vi.unstubAllGlobals());

describe('APNs', () => {
  it('knows the app’s device tokens among the web push subscriptions', () => {
    expect(parseApnsEndpoint(`apns:production:${TOKEN}`)).toEqual({ environment: 'production', token: TOKEN });
    expect(parseApnsEndpoint(`apns:sandbox:${TOKEN.toUpperCase()}`)).toEqual({ environment: 'sandbox', token: TOKEN });
    expect(parseApnsEndpoint('https://web.push.apple.com/abc')).toBeNull();
    expect(parseApnsEndpoint('apns:production:not-hex')).toBeNull();
  });

  it('turns the web push message into Apple’s', () => {
    const { body, collapseId } = apnsMessage(JSON.stringify({ title: 'Rån i Malmö', body: 'Polisen är på plats', tag: 'ca-1', data: { url: '/handelse/1' } }));
    expect(JSON.parse(body)).toEqual({ aps: { alert: { title: 'Rån i Malmö', body: 'Polisen är på plats' }, sound: 'default', 'thread-id': 'ca-1' }, url: '/handelse/1' });
    expect(collapseId).toBe('ca-1');
    expect(JSON.parse(apnsMessage(JSON.stringify({ title: 'Hej' })).body).url).toBe('/karta');
  });

  it('reads the key however it was pasted, and says so when it can’t', async () => {
    const { pem } = await p8Key();
    const pastes = [
      `"${pem}"`,
      pem.replace(/-----/g, '–––––'),
      `APNS_PRIVATE_KEY=${pem.replace(/\n/g, ' ')}`,
      pem.replace(/-----[^-]+-----/g, '').replace(/\n/g, '\r\n'),
    ];
    for (const privateKey of pastes) {
      await expect(apnsJwt({ keyId: 'KEY123', teamId: 'TEAM45', privateKey }, Date.now())).resolves.toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    }
    await expect(apnsJwt({ keyId: 'KEY123', teamId: 'TEAM45', privateKey: '-----BEGIN PRIVATE KEY----- ... (hela' }, Date.now())).rejects.toThrow(/\.p8\) gick inte att läsa/);
  });

  it('signs a token Apple can check, with the same issue time all half hour', async () => {
    const { pem, publicKey } = await p8Key();
    const at = Date.UTC(2026, 9, 20, 12, 10);
    const jwt = await apnsJwt({ keyId: 'KEY123', teamId: 'TEAM45', privateKey: pem.replace(/\n/g, '\\n') }, at);
    const [header, claims, signature] = jwt.split('.');
    expect(decode(header)).toEqual({ alg: 'ES256', kid: 'KEY123' });
    expect(decode(claims)).toEqual({ iss: 'TEAM45', iat: Date.UTC(2026, 9, 20, 12, 0) / 1000 });
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, Buffer.from(signature, 'base64url'), new TextEncoder().encode(`${header}.${claims}`));
    expect(valid).toBe(true);
    const later = await apnsJwt({ keyId: 'KEY123', teamId: 'TEAM45', privateKey: pem }, at + 15 * 60 * 1000);
    expect(decode(later.split('.')[1]).iat).toBe(decode(claims).iat);
  });

  it('sends to the right server, and drops tokens Apple no longer knows', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const payload = JSON.stringify({ title: 'T', body: 'B', tag: 'x' });
    expect(await sendApns({ environment: 'sandbox', token: TOKEN }, payload, 'jwt', 'se.crimealert.app', 0)).toEqual({ ok: true, status: 200, expired: false });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.sandbox.push.apple.com/3/device/${TOKEN}`);
    expect(init.headers).toMatchObject({ authorization: 'bearer jwt', 'apns-topic': 'se.crimealert.app', 'apns-push-type': 'alert', 'apns-collapse-id': 'x' });

    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ reason: 'Unregistered' }), { status: 410 }));
    expect((await sendApns({ environment: 'production', token: TOKEN }, payload, 'jwt', 'se.crimealert.app', 0)).expired).toBe(true);
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ reason: 'BadDeviceToken' }), { status: 400 }));
    expect((await sendApns({ environment: 'production', token: TOKEN }, payload, 'jwt', 'se.crimealert.app', 0)).expired).toBe(true);
    // A key problem is ours to fix; the phone's token is kept
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ reason: 'InvalidProviderToken' }), { status: 403 }));
    expect(await sendApns({ environment: 'production', token: TOKEN }, payload, 'jwt', 'se.crimealert.app', 0)).toEqual({ ok: false, status: 403, expired: false, error: 'InvalidProviderToken' });
    expect(fetch.mock.calls[1][0]).toBe(`https://api.push.apple.com/3/device/${TOKEN}`);
  });
});
