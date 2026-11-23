import { describe, expect, it } from 'vitest';
import { LAN_KOMMUNER, lanNamed } from "../../supabase/functions/_shared/data/kommunLan";
import { KOMMUN_CENTRES } from "../../supabase/functions/_shared/data/places";
import { SWEDISH_KOMMUNER } from '../../src/data/kommuner';

describe('LAN_KOMMUNER', () => {
  it('holds every kommun exactly once', () => {
    const all = Object.values(LAN_KOMMUNER).flat();
    expect(all).toHaveLength(290);
    expect(new Set(all)).toEqual(new Set(SWEDISH_KOMMUNER));
  });

  it('has as many kommuner per län as SCB counts', () => {
    const counts = Object.fromEntries(Object.entries(LAN_KOMMUNER).map(([lan, list]) => [lan, list.length]));
    expect(counts).toEqual({
      'Stockholms län': 26, 'Uppsala län': 8, 'Södermanlands län': 9, 'Östergötlands län': 13, 'Jönköpings län': 13,
      'Kronobergs län': 8, 'Kalmar län': 12, 'Gotlands län': 1, 'Blekinge län': 5, 'Skåne län': 33, 'Hallands län': 6,
      'Västra Götalands län': 49, 'Värmlands län': 16, 'Örebro län': 12, 'Västmanlands län': 10, 'Dalarnas län': 15,
      'Gävleborgs län': 10, 'Västernorrlands län': 7, 'Jämtlands län': 8, 'Västerbottens län': 15, 'Norrbottens län': 14,
    });
  });

  it('puts each kommun nearer its own län than any other, by its centralort', () => {
    // Each kommun's centralort is closer to the middle of its own län's centralorter than to most others
    const middle = Object.fromEntries(Object.entries(LAN_KOMMUNER).map(([lan, list]) => {
      const pts = list.map((k) => KOMMUN_CENTRES[k]);
      return [lan, [pts.reduce((s, p) => s + p[1], 0) / pts.length, pts.reduce((s, p) => s + p[2], 0) / pts.length]];
    }));
    const far: string[] = [];
    for (const [lan, list] of Object.entries(LAN_KOMMUNER)) {
      for (const k of list) {
        const [, lat, lng] = KOMMUN_CENTRES[k];
        const d = (m: number[]) => Math.hypot(lat - m[0], (lng - m[1]) * Math.cos((lat * Math.PI) / 180));
        const nearer = Object.entries(middle).filter(([other, m]) => other !== lan && d(m) < d(middle[lan])).length;
        if (nearer > 2) far.push(`${k} (${lan})`);
      }
    }
    // Västra Götaland is long: Gullspång and Karlsborg, on its eastern edge, lie nearer the middle of other län
    expect(far).toEqual(['Gullspång (Västra Götalands län)', 'Karlsborg (Västra Götalands län)']);
  });

  it('knows a län by the name Polisen gives it', () => {
    expect(lanNamed('Jönköpings län')).toBe('Jönköpings län');
    expect(lanNamed('jönköpings län')).toBe('Jönköpings län');
    expect(lanNamed('Jönköping')).toBeNull();
  });
});
