// Fråga AI: ask about crime where you live, answered from Polisen's events (ask-crimealert). A tab
// of its own in the app, and a page on the website. Three questions a day without Pro, as many as
// you like with Pro. The conversation lives only on this screen; nothing of it is stored.
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useSEO } from '@/hooks/useSEO';
import { supabase } from '@/integrations/supabase/client';
import { canSellPro, isNativeApp } from '@/lib/native';
import LogoMark from '@/native/LogoMark';
import '@/native/chat.css';

const MUTED = 'text-[rgba(235,235,245,0.6)]';
const FREE_PER_DAY = 3;

interface Turn { role: 'user' | 'assistant'; content: string }

const suggestionsFor = (kommun: string | null) => [
  `Vad har hänt i ${kommun ?? 'Stockholm'} den senaste veckan?`,
  'Var i Sverige har det varit flest inbrott den senaste månaden?',
  `Har det varit några skjutningar i ${kommun ?? 'Malmö'} i månaden?`,
  'Vilka kommuner har flest trafikolyckor just nu?',
];

/** The three dots while the answer is written */
const Typing = () => (
  <div className="flex items-center gap-1 py-2" aria-label="Skriver svar">
    {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-[rgba(235,235,245,0.45)]" style={{ animationDelay: `${i * 0.15}s` }} />)}
  </div>
);

const Fraga = () => {
  useSEO({ title: 'Fråga AI | CrimeAlert', description: 'Fråga om brotten där du bor. Svar utifrån Polisens händelser.' });
  const app = isNativeApp();
  const { user, loading: authLoading } = useAuth();
  const [params] = useSearchParams();
  const kommun = params.get('kommun');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null | undefined>(undefined);
  const [pro, setPro] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  // How many questions are left today, before the first one
  useEffect(() => {
    if (!user) return;
    supabase.functions.invoke<{ left: number | null; pro: boolean }>('ask-crimealert', { body: { quota: true } })
      .then(({ data }) => { if (data) { setLeft(data.left); setPro(data.pro); } })
      .catch(() => {});
  }, [user]);

  // The newest message in view; the empty screen stays at its top
  useEffect(() => {
    if (turns.length || busy) list.current?.scrollTo?.({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy || left === 0) return;
    const next: Turn[] = [...turns, { role: 'user', content: q.slice(0, 500) }];
    setTurns(next);
    setText('');
    setError(null);
    setBusy(true);
    if (input.current) input.current.style.height = '';
    const { data, error: failed } = await supabase.functions.invoke<{ answer?: string; left: number | null; pro: boolean; error?: string }>('ask-crimealert', { body: { messages: next } })
      .catch((e) => ({ data: null, error: e }));
    setBusy(false);
    if (data?.answer) {
      setTurns([...next, { role: 'assistant', content: data.answer }]);
      setLeft(data.left);
      setPro(data.pro);
      return;
    }
    // Not answered: the question goes back in the field
    setTurns(turns);
    setText(q);
    const status = (failed as { context?: { status?: number } } | null)?.context?.status;
    if (status === 429 && data?.error !== undefined && /många frågar/i.test(data.error)) { setError(data.error); return; }
    if (status === 429) { setLeft(0); return; }
    setError(data?.error ?? 'Kunde inte svara just nu. Försök igen om en stund.');
  };

  const out = left === 0;
  const empty = turns.length === 0;

  const body = (
    <div className={`flex min-h-0 flex-1 flex-col ${app ? '' : 'mx-auto w-full max-w-2xl'}`}>
      <div ref={list} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {empty ? (
          <div className="flex flex-col items-center pt-6 text-center">
            <LogoMark size={76} lit />
            <h2 className="mt-5 text-[24px] font-bold leading-tight tracking-[-0.01em] text-white">Fråga om brotten där du bor</h2>
            <p className={`mx-auto mt-2 max-w-[320px] text-[15px] leading-snug ${MUTED}`}>Svaren bygger på Polisens publicerade händelser sedan 28 september. AI kan ha fel, så kolla gärna händelserna själv.</p>
            {user && (
              <div className="mt-6 w-full space-y-2 text-left">
                {suggestionsFor(kommun).map((s) => (
                  <button key={s} type="button" disabled={out || busy} onClick={() => ask(s)}
                    className="block w-full rounded-[14px] bg-[#1c1c1e] px-4 py-3 text-left text-[15px] leading-snug text-white transition active:opacity-60 disabled:opacity-40">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-3">
            {turns.map((t, i) => t.role === 'user' ? (
              <div key={i} className="ca-msg-in flex justify-end">
                <p className="max-w-[80%] whitespace-pre-wrap break-words rounded-[20px] bg-[#0a84ff] px-3.5 py-2 text-[16px] leading-[21px] text-white">{t.content}</p>
              </div>
            ) : (
              <div key={i} className="ca-msg-in flex gap-2.5">
                <LogoMark size={28} className="mt-0.5 shrink-0" />
                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[16px] leading-[23px] text-white">{t.content}</p>
              </div>
            ))}
            {busy && <div className="flex gap-2.5"><LogoMark size={28} lit className="mt-0.5 shrink-0" /><Typing /></div>}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.08] px-3 pb-2 pt-2">
        {!user ? (
          authLoading ? null : (
            <div className="px-1 py-2 text-center">
              <p className={`text-[15px] ${MUTED}`}>Logga in för att ställa frågor. Det är gratis.</p>
              <Link to="/auth" className="mt-2.5 flex h-[50px] items-center justify-center rounded-[14px] bg-[#ff453a] text-[17px] font-semibold text-white">Logga in eller skapa konto</Link>
            </div>
          )
        ) : out ? (
          <div className="px-1 py-2 text-center">
            <p className="text-[15px] text-white">{pro ? 'Du har ställt många frågor idag.' : `Du har använt dagens ${FREE_PER_DAY} frågor.`}</p>
            <p className={`mt-0.5 text-[13px] ${MUTED}`}>Nya frågor i morgon.{pro ? '' : ' Med Pro frågar du så mycket du vill.'}</p>
            {!pro && canSellPro() && (
              <Link to="/prisplan" className="mt-2.5 flex h-[50px] items-center justify-center rounded-[14px] bg-[#ff453a] text-[17px] font-semibold text-white">Fråga obegränsat med Pro</Link>
            )}
          </div>
        ) : (
          <>
            {error && <p role="alert" className="mb-2 px-1 text-[13px] text-[#ff6961]">{error}</p>}
            <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="flex items-end gap-2">
              <div className="flex min-w-0 flex-1 items-end rounded-[20px] border border-white/[0.14] bg-[#1c1c1e] py-[3px] pl-4 pr-[3px]">
                <textarea
                  ref={input}
                  value={text}
                  rows={1}
                  onChange={(e) => { setText(e.target.value.slice(0, 500)); const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text); } }}
                  placeholder={kommun ? `Fråga om ${kommun}…` : 'Fråga om brotten där du bor…'}
                  aria-label="Din fråga"
                  className="max-h-[120px] min-h-[30px] min-w-0 flex-1 resize-none bg-transparent py-[5px] text-[16px] leading-[20px] text-white outline-none placeholder:text-[rgba(235,235,245,0.4)]"
                />
                <button type="submit" disabled={!text.trim() || busy} aria-label="Skicka"
                  className={`ml-2 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#ff453a] text-white transition duration-200 ${text.trim() && !busy ? 'scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0'}`}>
                  <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.8} aria-hidden />
                </button>
              </div>
            </form>
            <p className={`mt-1.5 px-1 text-center text-[12px] ${MUTED}`}>
              {left === undefined || left === null ? 'Svar utifrån Polisens händelser. AI kan ha fel.' : `${left} ${left === 1 ? 'fråga' : 'frågor'} kvar idag${pro ? '' : ' · obegränsat med Pro'}`}
            </p>
          </>
        )}
      </div>
    </div>
  );

  if (app) {
    return (
      <div className="ios flex h-full flex-col bg-black text-white">
        <h1 className="ios-large-title shrink-0 px-5 pb-1 pt-3">Fråga AI</h1>
        {body}
      </div>
    );
  }
  return (
    <div className="ca-dark flex h-[100dvh] flex-col bg-black text-white">
      <Header />
      <div className="mx-auto w-full max-w-2xl shrink-0 px-4 pt-6">
        <p className="ca-eyebrow">Ny</p>
        <h1 className="ca-display mt-2 text-4xl uppercase text-foreground">Fråga AI</h1>
      </div>
      {body}
    </div>
  );
};

export default Fraga;
