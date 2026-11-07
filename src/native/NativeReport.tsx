import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Check, CheckCircle2, Loader2, LocateFixed, MapPin, Megaphone, Search, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useSEO } from '@/hooks/useSEO';
import {
  draftProblem, latestReports, MAX_IMAGE_BYTES, placeName, REPORT_CATEGORIES, reportCategory, searchPlaces, submitReport,
  type PlaceResult, type PublicReport, type ReportDraft,
} from '@/lib/communityReports';
import { canSellPro } from '@/lib/native';
import { formatTimeAgo } from '@/lib/timeAgo';
import { haptics } from './haptics';
import { Row, Screen, Section } from './ui';

const EMPTY: ReportDraft = { category: '', title: '', description: '', area: '', lat: null, lng: null };
const field = 'w-full bg-transparent text-[17px] text-white outline-none placeholder:text-[rgba(235,235,245,0.3)]';

/** What others have reported lately, for everyone */
const Latest = ({ reports }: { reports: PublicReport[] | null }) => {
  if (reports === null) return null;
  return (
    <Section header="Senaste rapporterna" footer={reports.length ? 'Med Pro syns de också på kartan och i flödet.' : undefined}>
      {reports.length === 0 ? (
        <p className="px-4 py-3 text-[15px] text-[rgba(235,235,245,0.6)]">Inga rapporter än. Bli först i ditt område.</p>
      ) : (
        reports.slice(0, 8).map((r) => {
          const c = reportCategory(r.category);
          return (
            <Row
              key={r.id}
              icon={c.icon}
              iconBg={c.color}
              label={<span className="block truncate">{r.title}</span>}
              detail={<span className="block truncate">{[c.label, r.area, formatTimeAgo(r.created_at)].filter(Boolean).join(' · ')}</span>}
            />
          );
        })
      )}
    </Section>
  );
};

/**
 * Rapportera, a tab of its own in the app from 1.3: what you saw, where, and a picture if you
 * like, in a few taps. Sending needs Pro (submit-community-report); reading is for everyone.
 */
const NativeReport = () => {
  useSEO({ title: 'Rapportera | CrimeAlert', description: 'Berätta för dina grannar vad du har sett.', noindex: true });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const [draft, setDraft] = useState<ReportDraft>(EMPTY);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ imageFailed: boolean } | null>(null);
  const [reports, setReports] = useState<PublicReport[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { latestReports(10).then(setReports).catch(() => setReports([])); }, [sent]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const set = (patch: Partial<ReportDraft>) => { setDraft((d) => ({ ...d, ...patch })); setError(null); };

  const useMyPosition = () => {
    if (!navigator.geolocation) { setError('Telefonen kan inte ge din position.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        set({ lat: coords.latitude, lng: coords.longitude });
        setQuery('');
        setResults([]);
        const name = await placeName(coords.latitude, coords.longitude);
        setDraft((d) => ({ ...d, area: name ?? d.area }));
        setLocating(false);
        haptics.success();
      },
      () => { setLocating(false); setError('Kunde inte hämta din position. Tillåt plats för CrimeAlert i Inställningar, eller sök på en adress.'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const search = (text: string) => {
    setQuery(text);
    clearTimeout(searchTimer.current);
    if (text.trim().length < 3) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      setResults(await searchPlaces(text));
      setSearching(false);
    }, 400);
  };

  const pickPlace = (place: PlaceResult) => {
    haptics.selection();
    const short = place.name.split(',').slice(0, 2).map((s) => s.trim()).join(', ');
    set({ lat: place.lat, lng: place.lng, area: short });
    setQuery('');
    setResults([]);
  };

  const pickImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Bara bilder går att bifoga.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setError('Bilden får vara högst 5 MB.'); return; }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };
  const removeImage = () => {
    setImage(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const send = async () => {
    if (!user) return;
    const problem = draftProblem(draft);
    if (problem) { setError(problem); haptics.warning(); return; }
    setSending(true);
    const result = await submitReport(user.id, draft, image);
    setSending(false);
    if ('error' in result) { setError(result.error); haptics.error(); return; }
    haptics.success();
    setSent({ imageFailed: result.imageFailed });
    setDraft(EMPTY);
    removeImage();
  };

  const intro = (
    <p className="mx-5 -mt-1 text-[15px] leading-snug text-[rgba(235,235,245,0.6)]">
      Har du sett något i ditt område? Berätta för dina grannar.
    </p>
  );
  const safety = 'Skriv inga namn och lägg inte upp bilder där personer känns igen. Vid akut fara, ring 112. Tips till Polisen: 114 14.';

  if (sent) {
    return (
      <Screen title="Rapportera">
        <div className="mx-4 mt-6 flex flex-col items-center rounded-[20px] bg-[#1c1c1e] px-6 py-8 text-center">
          <CheckCircle2 className="h-14 w-14 text-[#30d158]" aria-hidden />
          <p className="mt-4 text-[22px] font-bold">Tack för din rapport</p>
          <p className="mt-1.5 text-[15px] leading-snug text-[rgba(235,235,245,0.6)]">
            {sent.imageFailed ? 'Rapporten är skickad, men bilden kom inte med.' : 'Nu syns den för dina grannar, på kartan och i flödet.'}
          </p>
          <button type="button" onClick={() => navigate('/karta')} className="mt-6 h-[50px] w-full rounded-[14px] bg-[#ff453a] text-[17px] font-semibold text-white active:scale-[0.98]">
            Till kartan
          </button>
          <button type="button" onClick={() => setSent(null)} className="mt-2 h-11 w-full text-[17px] text-[#ff453a]">Rapportera något mer</button>
        </div>
        <Latest reports={reports} />
      </Screen>
    );
  }

  if (!user || !isPremium) {
    return (
      <Screen title="Rapportera">
        {intro}
        <div className="mx-4 mt-5 rounded-[20px] bg-gradient-to-br from-[#3a1a05] via-[#1c1c1e] to-[#1c1c1e] p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#ff9f0a]">
            <Megaphone className="h-6 w-6 text-white" aria-hidden />
          </span>
          <p className="mt-4 text-[20px] font-bold leading-tight">Var grannarnas ögon</p>
          <p className="mt-1.5 text-[15px] leading-snug text-[rgba(235,235,245,0.6)]">
            Trasig belysning, en otrygg plats eller något misstänkt: rapportera det med en bild, så syns det på kartan för alla med Pro i närheten.
          </p>
          {!user ? (
            <Link to="/auth" className="mt-5 flex h-[50px] items-center justify-center rounded-[14px] bg-[#ff453a] text-[17px] font-semibold text-white">Logga in eller skapa konto</Link>
          ) : canSellPro() ? (
            <Link to="/prisplan" className="mt-5 flex h-[50px] items-center justify-center rounded-[14px] bg-[#ff453a] text-[17px] font-semibold text-white">Rapportera med Pro</Link>
          ) : (
            <p className="mt-5 text-[15px] text-[rgba(235,235,245,0.6)]">Att rapportera ingår i Pro.</p>
          )}
        </div>
        <Latest reports={reports} />
      </Screen>
    );
  }

  const ready = !draftProblem(draft);

  return (
    <Screen title="Rapportera">
      {intro}

      <Section header="Vad gäller det?">
        {REPORT_CATEGORIES.map((c) => (
          <Row
            key={c.value}
            icon={c.icon}
            iconBg={c.color}
            label={c.label}
            detail={c.hint}
            onClick={() => { haptics.selection(); set({ category: c.value }); }}
            accessory={draft.category === c.value ? <Check className="h-5 w-5 shrink-0 text-[#ff453a]" strokeWidth={2.5} aria-label="Vald" /> : <span className="w-5" />}
          />
        ))}
      </Section>

      <Section header="Var?" footer={draft.lat !== null ? undefined : 'Din position används bara för att placera rapporten på kartan.'}>
        <Row
          icon={draft.lat !== null ? MapPin : LocateFixed}
          iconBg={draft.lat !== null ? '#30d158' : '#0a84ff'}
          label={draft.lat !== null ? draft.area || 'Platsen är vald' : 'Använd min position'}
          detail={draft.lat !== null ? 'Tryck för att använda din position igen' : undefined}
          onClick={useMyPosition}
          accessory={locating ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[rgba(235,235,245,0.6)]" aria-label="Hämtar position" /> : <span />}
        />
        <div className="ios-row flex items-center gap-3 pl-4">
          <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] bg-[#636366]">
            <Search className="h-[17px] w-[17px] text-white" aria-hidden />
          </span>
          <span className="ios-row-body flex min-h-[44px] flex-1 items-center gap-2 py-2 pr-4">
            <input value={query} onChange={(e) => search(e.target.value.slice(0, 80))} placeholder="Eller sök en adress" aria-label="Sök en adress" enterKeyHint="search" className={field} />
            {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[rgba(235,235,245,0.6)]" aria-hidden />}
          </span>
        </div>
        {results.map((place) => (
          <Row key={`${place.lat},${place.lng}`} label={<span className="block truncate text-[15px]">{place.name}</span>} onClick={() => pickPlace(place)} />
        ))}
      </Section>

      <Section header="Berätta">
        <div className="ios-row pl-4">
          <div className="ios-row-body py-2.5 pr-4">
            <input value={draft.title} onChange={(e) => set({ title: e.target.value.slice(0, 120) })} placeholder="Rubrik, t.ex. Mörk gångtunnel" aria-label="Rubrik" className={field} />
          </div>
        </div>
        <div className="ios-row pl-4">
          <div className="ios-row-body py-2.5 pr-4">
            <textarea value={draft.description} onChange={(e) => set({ description: e.target.value.slice(0, 1000) })} placeholder="Vad såg du, och när?" aria-label="Beskrivning" rows={4} className={`${field} resize-none leading-[22px]`} />
          </div>
        </div>
      </Section>

      <Section header="Bild" footer="Valfritt. Högst 5 MB.">
        {preview ? (
          <div className="relative">
            <img src={preview} alt="Bilden till rapporten" className="max-h-64 w-full object-cover" />
            <button type="button" onClick={removeImage} aria-label="Ta bort bilden" className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur">
              <X className="h-4 w-4 text-white" aria-hidden />
            </button>
          </div>
        ) : (
          <Row icon={Camera} iconBg="#5e5ce6" label="Lägg till bild" onClick={() => fileRef.current?.click()} />
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} aria-hidden tabIndex={-1} />
      </Section>

      <div className="mx-4 mt-7">
        {error && <p role="alert" className="mb-3 rounded-xl bg-[rgba(255,69,58,0.14)] px-4 py-3 text-[15px] text-[#ff6961]">{error}</p>}
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-[17px] font-semibold text-white transition active:scale-[0.98] ${ready ? 'bg-[#ff453a]' : 'bg-[#ff453a]/40'}`}
        >
          {sending ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Skickar…</> : 'Skicka rapport'}
        </button>
        <p className="mt-3 px-2 text-[13px] leading-snug text-[rgba(235,235,245,0.6)]">{safety}</p>
      </div>

      <Latest reports={reports} />
    </Screen>
  );
};

export default NativeReport;
