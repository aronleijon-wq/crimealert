import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, MapPin, Map as MapIcon } from "lucide-react";
import Header from "@/components/Header";
import { useSEO } from "@/hooks/useSEO";
import { recoverFromStaleBuild } from "@/lib/staleBuild";

const primaryButton = 'inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_-8px_hsl(var(--ca-red))] transition hover:bg-primary/90';
const secondaryButton = 'inline-flex h-11 items-center gap-2 rounded-xl border border-[hsl(var(--ca-line-strong))] px-5 text-sm font-medium text-foreground transition hover:border-primary/50';

/**
 * Links that no longer lead anywhere: kept out of search results, with the way back to the map.
 * A browser that keeps the site offline may still run an older version, one without a page that
 * was added since (a link in an e-mail to a new page, say). So before saying the page is gone,
 * the site is loaded fresh once (lib/staleBuild, at most once a minute): if the page exists in the
 * new version it opens, and if not this shows again.
 */
const NotFound = () => {
  const location = useLocation();
  useSEO({ title: 'Sidan finns inte | CrimeAlert', description: 'Sidan du letar efter finns inte på CrimeAlert.', noindex: true });
  const [checking, setChecking] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.serviceWorker?.controller));

  useEffect(() => {
    if (!(navigator.serviceWorker?.controller && recoverFromStaleBuild())) setChecking(false);
  }, []);

  useEffect(() => {
    if (!checking) console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [checking, location.pathname]);

  if (checking) {
    return (
      <div className="ca-dark h-screen flex items-center justify-center bg-background">
        <p className="text-[15px] text-muted-foreground">Hämtar den senaste versionen av CrimeAlert…</p>
      </div>
    );
  }

  return (
    <div className="ca-dark h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <p className="ca-eyebrow">// 404</p>
          <h1 className="ca-display mt-2 text-3xl sm:text-4xl text-foreground">Sidan finns inte</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Länken kan vara gammal eller felstavad. Polisens senaste händelser hittar du på kartan, och varje kommun har
            en egen sida.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <Link to="/karta" className={primaryButton}>
              <MapIcon className="h-4 w-4" /> Till kartan
            </Link>
            <Link to="/kommun" className={secondaryButton}>
              <MapPin className="h-4 w-4" /> Alla kommuner
            </Link>
            <Link to="/" className={secondaryButton}>
              <Home className="h-4 w-4" /> Startsidan
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
