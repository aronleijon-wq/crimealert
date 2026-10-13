import { describe, it, expect } from 'vitest';
import { apiError, cameraQuery, compassDirection, parseCameras, trafikverketImageUrl } from '../../supabase/functions/_shared/sources/trafikverketCameras';

const camera = (over: Record<string, unknown> = {}) => ({
  Id: 'SE_STA_CAMERA_Orion_39627873',
  Name: 'E4 Hallunda',
  Active: true,
  Deleted: false,
  PhotoUrl: 'https://api.trafikinfo.trafikverket.se/v2/Images/TrafficFlowCamera_39627873.Jpeg',
  HasFullSizePhoto: true,
  Type: 'Trafikflödeskamera',
  Direction: '45',
  Geometry: { WGS84: 'POINT (17.8231234 59.2412345)' },
  ...over,
});
const response = (...cameras: unknown[]) => ({ RESPONSE: { RESULT: [{ Camera: cameras }] } });

describe('Trafikverket cameras', () => {
  it('asks for active cameras, with or without a namespace', () => {
    expect(cameraQuery('k')).toContain('<QUERY objecttype="Camera" namespace="road.infrastructure" schemaversion="1"');
    expect(cameraQuery('k', null)).toContain('<QUERY objecttype="Camera" schemaversion="1"');
    expect(cameraQuery('k')).toContain('<EQ name="Active" value="true" />');
  });

  it('turns the response into map points with their images', () => {
    expect(parseCameras(response(camera()))).toEqual([{
      id: 'SE_STA_CAMERA_Orion_39627873',
      name: 'E4 Hallunda',
      lat: 59.24123,
      lng: 17.82312,
      photoUrl: 'https://api.trafikinfo.trafikverket.se/v2/Images/TrafficFlowCamera_39627873.Jpeg',
      fullSizeUrl: 'https://api.trafikinfo.trafikverket.se/v2/Images/TrafficFlowCamera_39627873.Jpeg?type=fullsize',
      type: 'Trafikflödeskamera',
      direction: 'nordost',
    }]);
  });

  it('leaves out inactive, duplicate, misplaced and imageless cameras', () => {
    const cams = parseCameras(response(
      camera(),
      camera(), // same id
      camera({ Id: 'b', Active: false }),
      camera({ Id: 'c', Deleted: true }),
      camera({ Id: 'd', Geometry: { WGS84: 'POINT (2.35 48.85)' } }), // Paris
      camera({ Id: 'e', PhotoUrl: 'https://example.com/x.jpg' }),
      camera({ Id: 'f', PhotoUrl: null }),
    ));
    expect(cams.map((c) => c.id)).toEqual(['SE_STA_CAMERA_Orion_39627873']);
  });

  it('only trusts images on Trafikverket, over https', () => {
    expect(trafikverketImageUrl('http://api.trafikinfo.trafikverket.se/v2/Images/a.Jpeg')).toBe('https://api.trafikinfo.trafikverket.se/v2/Images/a.Jpeg');
    expect(trafikverketImageUrl('https://trafikverket.se.evil.com/a.jpg')).toBeNull();
    expect(trafikverketImageUrl('javascript:alert(1)')).toBeNull();
  });

  it('names the direction', () => {
    expect([0, 90, 180, 270, 359, 'x'].map(compassDirection)).toEqual(['norr', 'öster', 'söder', 'väster', 'norr', null]);
  });

  it('reads the API error message', () => {
    expect(apiError({ RESPONSE: { RESULT: [{ ERROR: { SOURCE: 'Request', MESSAGE: 'Invalid namespace' } }] } })).toBe('Invalid namespace');
    expect(apiError(response(camera()))).toBeNull();
  });
});

describe('loading cameras in the app', () => {
  it('keeps the list for half an hour', async () => {
    const { vi } = await import('vitest');
    const invoke = vi.fn().mockResolvedValue({ data: { success: true, data: [{ id: 'a' }] }, error: null });
    vi.doMock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
    const { loadCameras } = await import('./trafficCameras');
    localStorage.clear();
    const now = Date.parse('2026-10-13T10:00:00Z');
    expect(await loadCameras(now)).toEqual([{ id: 'a' }]);
    expect(await loadCameras(now + 29 * 60 * 1000)).toEqual([{ id: 'a' }]);
    expect(invoke).toHaveBeenCalledTimes(1);
    await loadCameras(now + 31 * 60 * 1000);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenCalledWith('trafikverket-cameras');
  });
});
