import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Check, CheckCircle2, Loader2, LocateFixed, MapPin, Megaphone, Phone, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ModerationMenu from '@/components/ModerationMenu';
import { blockReportAuthor, reportContent, type ReportReason } from '@/lib/moderation';
import {
  draftProblem, MAX_IMAGE_BYTES, placeName, readEventPrefill, REPORT_CATEGORIES, reportCategory, searchPlaces, submitReport,
  type PlaceResult, type PublicReport, type ReportCategory, type ReportDraft,
} from '@/lib/communityReports';
import { formatTimeAgo } from '@/lib/timeAgo';

type Report = PublicReport & { isOwn?: boolean };

const EMPTY: ReportDraft = { category: '', title: '', description: '', area: '', lat: null, lng: null };
const NOW_CATEGORIES = REPORT_CATEGORIES.filter((c) => c.now);
const AREA_CATEGORIES = REPORT_CATEGORIES.filter((c) => !c.now);

/** "12 min sedan" for the last week, then the date: "15 mars" */
const when = (iso: string, now = Date.now()) => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  if (now - t < 7 * 86_400_000) return formatTimeAgo(iso, now);
  return new Date(t).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', ...(new Date(t).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}) });
};

const card = 'rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card';
const input = 'h-12 w-full rounded-xl border border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-base-3))] px-4 text-base text-foreground outline-none transition placeholder:text-[hsl(var(--ca-text-3))] focus:border-primary/60';

/** A numbered step of the form, with its heading */
const Step = ({ n, title, hint, done, children }: { n: number; title: string; hint?: string; done?: boolean; children: React.ReactNode }) => (
  <section className="pt-6 first:pt-0" aria-label={title}>
    <h3 className="flex items-center gap-3 text-lg font-bold text-foreground">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-[hsl(var(--cr-green))] text-black' : 'bg-primary/15 text-primary'}`} aria-hidden>
        {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
      </span>
      {title}
    </h3>
    {hint && <p className="ml-11 mt-0.5 text-sm text-[hsl(var(--ca-text-2))]">{hint}</p>}
    <div className="mt-3 sm:ml-11">{children}</div>
  </section>
);

/** One big tile per category: an icon in its colour, the name, and what belongs there */
const Tile = ({ c, picked, onPick }: { c: ReportCategory; picked: boolean; onPick: () => void }) => {
  const Icon = c.icon;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={picked}
      className={`flex min-h-[76px] items-center gap-3 rounded-xl border p-3 text-left transition active:scale-[0.98] ${
        picked ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-base-3))] hover:border-primary/40'
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `${c.color}26`, color: c.color }} aria-hidden>
        <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold leading-tight text-foreground">{c.label}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-[hsl(var(--ca-text-2))]">{c.hint}</span>
      </span>
    </button>
  );
};

/**
 * Medborgarrapporter on the website (/rapportera): what you see, where, and a few words if you
 * like, in three clear steps with big buttons, then what others have reported. Free for everyone
 * signed in (submit-community-report). Opened from a police event ("Är du på plats?") it comes
 * with the event's place, and the report shows at the event.
 */
export default function CommunityReports() {
  const { user } = useAuth();
  const [fromEvent] = useState(() => (typeof window === 'undefined' ? null : readEventPrefill(window.location.search)));
  const [draft, setDraft] = useState<ReportDraft>(() => (fromEvent
    ? { ...EMPTY, area: fromEvent.area, lat: fromEvent.lat, lng: fromEvent.lng, eventId: fromEvent.eventId }
    : EMPTY));
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ imageFailed: boolean } | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [bigImage, setBigImage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const formRef = useRef<HTMLDivElement>(null);

  const fetchReports = useCallback(async () => {
    const { data } = await supabase.from('community_reports_public').select('*').order('created_at', { ascending: false }).limit(30);
    let own: string[] = [];
    if (user) {
      const { data: mine } = await supabase.from('community_reports').select('id').eq('user_id', user.id);
      own = (mine ?? []).map((r) => r.id);
    }
    setReports(((data ?? []) as PublicReport[]).map((r) => ({ ...r, isOwn: own.includes(r.id) })));
  }, [user]);

  useEffect(() => { void fetchReports(); }, [fetchReports]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const set = (patch: Partial<ReportDraft>) => { setDraft((d) => ({ ...d, ...patch })); setError(null); };

  const useMyPosition = () => {
    if (!navigator.geolocation) { setError('Din webbläsare kan inte ge din position. Sök på en adress i stället.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        set({ lat: coords.latitude, lng: coords.longitude, area: '' });
        setQuery('');
        setResults([]);
        const name = await placeName(coords.latitude, coords.longitude);
        setDraft((d) => ({ ...d, area: name ?? 'Din position' }));
        setLocating(false);
      },
      () => { setLocating(false); setError('Kunde inte hämta din position. Tillåt platsen i webbläsaren, eller sök på en adress.'); },
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
    set({ lat: place.lat, lng: place.lng, area: place.name.split(',').slice(0, 2).map((s) => s.trim()).join(', ') });
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
    if (problem) { setError(problem); return; }
    setSending(true);
    const result = await submitReport(user.id, draft, image);
    setSending(false);
    if ('error' in result) { setError(result.error); return; }
    setSent({ imageFailed: result.imageFailed });
    setDraft(EMPTY);
    removeImage();
    if (fromEvent) window.history.replaceState(window.history.state, '', '/rapportera');
    void fetchReports();
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const remove = async (id: string) => {
    await supabase.from('community_reports').delete().eq('id', id);
    setReports((all) => all?.filter((r) => r.id !== id) ?? null);
    setDeleting(null);
  };
  // A reported report, or one whose author is blocked, disappears for the user at once
  const flag = async (id: string, reason: ReportReason) => {
    if (!user) return;
    await reportContent(user.id, 'community_report', id, reason);
    setReports((all) => all?.filter((r) => r.id !== id) ?? null);
    toast.success('Tack. Vi granskar rapporten inom 24 timmar.');
  };
  const block = async (id: string) => {
    await blockReportAuthor(id);
    void fetchReports();
    toast.success('Skribenten är blockerad.');
  };

  const category = draft.category ? reportCategory(draft.category) : null;
  const placed = draft.lat !== null && draft.lng !== null;
  const ready = !draftProblem(draft);

  return (
    <>
      <div ref={formRef} className={`${card} scroll-mt-24 p-5 sm:p-7`}>
        {sent ? (
          <div className="flex flex-col items-center py-6 text-center" role="status">
            <CheckCircle2 className="h-16 w-16 text-[hsl(var(--cr-green))]" aria-hidden />
            <p className="mt-4 text-2xl font-bold text-foreground">Tack för din rapport</p>
            <p className="mt-2 max-w-sm text-base leading-relaxed text-[hsl(var(--ca-text-2))]">
              {sent.imageFailed ? 'Rapporten är skickad, men bilden kom inte med.' : 'Nu syns den på kartan och i flödet för alla i närheten.'}
            </p>
            <div className="mt-6 flex w-full max-w-sm flex-col gap-2 sm:flex-row">
              <Link to="/karta" className="flex h-12 flex-1 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground transition hover:bg-primary/90">Till kartan</Link>
              <button type="button" onClick={() => setSent(null)} className="h-12 flex-1 rounded-xl border border-[hsl(var(--ca-line-strong))] text-base font-semibold text-foreground transition hover:border-primary/50">Rapportera mer</button>
            </div>
          </div>
        ) : (
          <>
            {fromEvent && (
              <p className="mb-5 rounded-xl bg-primary/10 px-4 py-3 text-[15px] leading-snug text-foreground">
                Om händelsen <b className="font-semibold">{fromEvent.title || fromEvent.area}</b>. Din rapport syns vid händelsen och på kartan.
              </p>
            )}

            <Step n={1} title="Välj vad det gäller" done={!!category}>
              {category && user ? (
                // Picked: the choice alone, so the next steps are close at hand
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1"><Tile c={category} picked onPick={() => set({ category: '' })} /></div>
                  <button type="button" onClick={() => set({ category: '' })} className="shrink-0 px-2 text-[15px] font-semibold text-primary hover:underline">Ändra</button>
                </div>
              ) : (
                <>
                  <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ca-text-3))]">Händer just nu</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {NOW_CATEGORIES.map((c) => <Tile key={c.value} c={c} picked={draft.category === c.value} onPick={() => set({ category: c.value })} />)}
                  </div>
                  <p className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ca-text-3))]">I mitt område</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {AREA_CATEGORIES.map((c) => <Tile key={c.value} c={c} picked={draft.category === c.value} onPick={() => set({ category: c.value })} />)}
                  </div>
                </>
              )}
            </Step>

            {!user ? (
              <div className="mt-6 rounded-xl bg-[hsl(var(--ca-base-3))] p-5 text-center">
                <p className="text-lg font-bold text-foreground">Skapa ett gratis konto för att rapportera</p>
                <p className="mx-auto mt-1 max-w-sm text-[15px] leading-snug text-[hsl(var(--ca-text-2))]">Det tar en minut. Sedan kan du rapportera och se vad andra i närheten har sett.</p>
                <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                  <Link to="/auth?mode=signup" className="flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground transition hover:bg-primary/90">Skapa konto gratis</Link>
                  <Link to="/auth?mode=login" className="flex h-12 items-center justify-center rounded-xl border border-[hsl(var(--ca-line-strong))] px-6 text-base font-semibold text-foreground transition hover:border-primary/50">Logga in</Link>
                </div>
              </div>
            ) : category && (
              <>
                <Step n={2} title="Var?" done={placed}>
                  {placed ? (
                    <div className="flex items-center gap-3 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3">
                      <MapPin className="h-5 w-5 shrink-0 text-[hsl(var(--cr-green))]" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-base font-medium text-foreground">{draft.area || 'Platsen är vald'}</span>
                      <button type="button" onClick={() => set({ lat: null, lng: null, area: '' })} className="shrink-0 text-[15px] font-semibold text-primary hover:underline">Ändra</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={useMyPosition}
                        disabled={locating}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/50 bg-primary/10 text-base font-semibold text-foreground transition hover:bg-primary/15 disabled:opacity-60"
                      >
                        {locating ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <LocateFixed className="h-5 w-5 text-primary" aria-hidden />}
                        {locating ? 'Hämtar din position…' : 'Använd min position'}
                      </button>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[hsl(var(--ca-text-3))]" aria-hidden />
                        <input value={query} onChange={(e) => search(e.target.value.slice(0, 80))} placeholder="Eller skriv en adress eller plats" aria-label="Sök en adress" className={`${input} pl-12`} />
                        {searching && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[hsl(var(--ca-text-3))]" aria-hidden />}
                      </div>
                      {results.length > 0 && (
                        <ul className="overflow-hidden rounded-xl border border-[hsl(var(--ca-line-strong))]">
                          {results.map((place) => (
                            <li key={`${place.lat},${place.lng}`}>
                              <button type="button" onClick={() => pickPlace(place)} className="flex w-full items-center gap-3 border-b border-[hsl(var(--ca-line))] px-4 py-3 text-left text-[15px] text-foreground last:border-0 hover:bg-[hsl(var(--ca-panel-2))]">
                                <MapPin className="h-4 w-4 shrink-0 text-[hsl(var(--ca-text-3))]" aria-hidden />
                                <span className="min-w-0 truncate">{place.name}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </Step>

                <Step n={3} title="Berätta mer" hint="Valfritt. Det räcker med vad och var.">
                  <div className="space-y-2">
                    <input value={draft.title} onChange={(e) => set({ title: e.target.value.slice(0, 120) })} placeholder={`Rubrik, t.ex. ${category.now ? 'Polisbilar vid torget' : 'Mörk gångtunnel'}`} aria-label="Rubrik" className={input} />
                    <textarea
                      value={draft.description}
                      onChange={(e) => set({ description: e.target.value.slice(0, 1000) })}
                      placeholder="Vad ser du, och hur länge har det pågått?"
                      aria-label="Beskrivning"
                      rows={3}
                      className={`${input} h-auto resize-none py-3 leading-relaxed`}
                    />
                    {preview ? (
                      <div className="relative inline-block">
                        <img src={preview} alt="Bilden till rapporten" className="h-32 w-auto rounded-xl border border-[hsl(var(--ca-line-strong))] object-cover" />
                        <button type="button" onClick={removeImage} aria-label="Ta bort bilden" className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black text-white shadow">
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileRef.current?.click()} className="flex h-12 items-center gap-2 rounded-xl border border-dashed border-[hsl(var(--ca-line-strong))] px-4 text-[15px] font-medium text-[hsl(var(--ca-text-2))] transition hover:border-primary/50 hover:text-foreground">
                        <Camera className="h-5 w-5" aria-hidden /> Lägg till en bild
                      </button>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} aria-hidden tabIndex={-1} />
                  </div>
                </Step>

                <div className="mt-7 sm:ml-11">
                  {error && <p role="alert" className="mb-3 rounded-xl bg-primary/10 px-4 py-3 text-[15px] text-[hsl(var(--ca-red))]">{error}</p>}
                  <button
                    type="button"
                    onClick={send}
                    disabled={sending}
                    className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl text-lg font-semibold text-primary-foreground transition active:scale-[0.99] ${ready ? 'bg-primary shadow-[0_0_28px_-8px_hsl(var(--ca-red))] hover:bg-primary/90' : 'bg-primary/40'}`}
                  >
                    {sending ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Skickar…</> : 'Skicka rapport'}
                  </button>
                  <p className="mt-3 text-sm leading-snug text-[hsl(var(--ca-text-3))]">Skriv inga namn och lägg inte upp bilder där personer känns igen.</p>
                </div>
              </>
            )}
            {!user && error && <p role="alert" className="mt-3 text-[15px] text-[hsl(var(--ca-red))]">{error}</p>}
          </>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[hsl(var(--ca-line-strong))] px-5 py-4">
        <Phone className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <p className="text-[15px] leading-snug text-[hsl(var(--ca-text-2))]">
          <b className="font-semibold text-foreground">Akut fara? Ring 112.</b> Tips till polisen: 114 14.
        </p>
      </div>

      <section className="mt-10" aria-labelledby="senaste-rapporterna">
        <h2 id="senaste-rapporterna" className="font-['Archivo',Inter,sans-serif] text-2xl font-extrabold text-foreground">Senaste rapporterna</h2>
        <p className="mt-1 text-[15px] text-[hsl(var(--ca-text-2))]">Vad andra har sett. De syns också på kartan.</p>
        {reports === null ? (
          <div className="mt-4 space-y-2" aria-hidden>
            {[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-[hsl(var(--ca-panel-3))]" />)}
          </div>
        ) : !user ? (
          <p className={`${card} mt-4 px-5 py-6 text-center text-[15px] text-[hsl(var(--ca-text-2))]`}>
            <Link to="/auth?mode=login" className="font-semibold text-primary hover:underline">Logga in</Link> för att se vad andra har rapporterat.
          </p>
        ) : reports.length === 0 ? (
          <div className={`${card} mt-4 flex flex-col items-center px-5 py-8 text-center`}>
            <Megaphone className="h-8 w-8 text-primary" aria-hidden />
            <p className="mt-3 text-lg font-bold text-foreground">Inga rapporter än</p>
            <p className="mt-1 text-[15px] text-[hsl(var(--ca-text-2))]">Bli först med att berätta vad som händer där du är.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {reports.map((r) => {
              const c = reportCategory(r.category);
              const Icon = c.icon;
              return (
                <li key={r.id} className={`${card} flex gap-4 p-4 sm:p-5`}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `${c.color}26`, color: c.color }} aria-hidden>
                    <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* A report sent with no words of its own is titled by its category: said once */}
                    {r.title !== c.label && <p className="text-[13px] font-semibold" style={{ color: c.color }}>{c.label}</p>}
                    <p className="mt-0.5 text-base font-semibold leading-snug text-foreground">{r.title}</p>
                    {r.description && <p className="mt-1 text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">{r.description}</p>}
                    {r.image_url && (
                      <button type="button" onClick={() => setBigImage(r.image_url)} className="mt-3 block" aria-label="Visa bilden större">
                        <img src={r.image_url} alt="Bild från rapporten" loading="lazy" className="max-h-48 w-auto rounded-xl border border-[hsl(var(--ca-line-strong))] object-cover transition hover:opacity-90" />
                      </button>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[hsl(var(--ca-text-3))]">
                      {r.area && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{r.area}</span>}
                      <span>{when(r.created_at)}</span>
                      {r.isOwn ? (
                        deleting === r.id ? (
                          <span className="flex items-center gap-2">
                            <button type="button" onClick={() => remove(r.id)} className="font-semibold text-[hsl(var(--ca-red))] hover:underline">Ta bort</button>
                            <button type="button" onClick={() => setDeleting(null)} className="hover:underline">Avbryt</button>
                          </span>
                        ) : (
                          <button type="button" onClick={() => setDeleting(r.id)} className="flex items-center gap-1 hover:text-foreground">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Ta bort min rapport
                          </button>
                        )
                      ) : (
                        <ModerationMenu what="rapporten" author="skribenten" onReport={(reason) => flag(r.id, reason)} onBlock={() => block(r.id)} />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {bigImage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4" onClick={() => setBigImage(null)} role="dialog" aria-modal="true" aria-label="Bilden">
          <button type="button" aria-label="Stäng" className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white" onClick={() => setBigImage(null)}>
            <X className="h-5 w-5" aria-hidden />
          </button>
          <img src={bigImage} alt="Bild från rapporten" className="max-h-[85vh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
