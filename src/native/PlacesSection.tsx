// Mina platser on Notiser in the app: home, work, the school, each with its own distance. A free
// account is notified about its first place, Pro about five (send-push-notifications).
import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import PlaceEditor from '@/components/alerts/PlaceEditor';
import type { useWatchPlaces } from '@/hooks/useWatchPlaces';
import { canSellPro } from '@/lib/native';
import { PLACE_ICONS } from '@/lib/placeIcons';
import { FREE_PLACES, PRO_PLACES, placeKind, radiusLabel, type PlaceKind, type WatchPlace } from '../../supabase/functions/_shared/notifications';
import { Row, Section } from './ui';

const SUGGESTED: PlaceKind[] = ['home', 'work', 'school'];

type Places = ReturnType<typeof useWatchPlaces>;

const PlacesSection = ({ isPremium, watch }: { isPremium: boolean; watch: Places }) => {
  const { places, savePlace, removePlace } = watch;
  const [editing, setEditing] = useState<{ place: WatchPlace | null; kind?: PlaceKind } | null>(null);
  const limit = isPremium ? PRO_PLACES : FREE_PLACES;
  const full = places.length >= limit;
  const unused = new Set(places.slice(limit).map((p) => p.id));

  const footer = !isPremium && full
    ? `Med gratiskonto får du notiser för ${FREE_PLACES === 1 ? 'en plats' : `${FREE_PLACES} platser`}. Med Pro upp till ${PRO_PLACES}, till exempel hem, jobbet och skolan.`
    : 'Det som händer nära dina platser, utöver kommunerna. Notisen säger vilken plats det gäller.';

  return (
    <>
      <Section header="Mina platser" footer={footer}>
        {places.map((p) => (
          <Row
            key={p.id}
            icon={PLACE_ICONS[p.kind]}
            label={p.label}
            detail={unused.has(p.id) ? 'Pausad, ingår i Pro' : `Notiser inom ${radiusLabel(p.radiusKm)}`}
            onClick={() => setEditing({ place: p })}
            accessory={<ChevronRight className="h-[18px] w-[18px] shrink-0 text-[rgba(235,235,245,0.3)]" strokeWidth={2.5} aria-hidden />}
          />
        ))}
        {!full && places.length === 0 && SUGGESTED.slice(0, limit === FREE_PLACES ? 1 : SUGGESTED.length).map((kind) => (
          <Row key={kind} icon={PLACE_ICONS[kind]} label={`Lägg till ${placeKind(kind).label.toLowerCase()}`} tint onClick={() => setEditing({ place: null, kind })} />
        ))}
        {!full && places.length > 0 && <Row icon={Plus} label="Lägg till plats" tint onClick={() => setEditing({ place: null, kind: 'other' })} />}
        {full && !isPremium && canSellPro() && <Row icon={Plus} label="Fler platser med Pro" tint to="/prisplan" />}
      </Section>

      {editing && (
        <PlaceEditor
          place={editing.place}
          kind={editing.kind}
          onSave={async (draft) => {
            const problem = await savePlace(draft, editing.place?.id);
            if (!problem) setEditing(null);
            return problem;
          }}
          onRemove={editing.place ? () => { removePlace(editing.place!.id); setEditing(null); } : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
};

export default PlacesSection;
