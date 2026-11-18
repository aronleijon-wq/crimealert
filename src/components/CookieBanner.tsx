import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isNativeApp } from "@/lib/native";
import {
  COOKIE_SETTINGS_EVENT, GOOGLE_ADS_ENABLED, isConsentRequiredRegion, loadGoogleAds, saveChoice, storedChoice,
} from "@/lib/googleAds";

/**
 * CrimeAlert's own cookie box, for Google Ads measurement. Shown only when Google Ads is on
 * (lib/googleAds), in a region that needs consent, until the visitor has chosen. Both choices are
 * one click; the cookie page opens it again. Without Google Ads there is nothing to ask about.
 */
const CookieBanner = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!GOOGLE_ADS_ENABLED || isNativeApp()) return;
    void loadGoogleAds(); // outside the EU, or with an earlier yes
    let alive = true;
    if (storedChoice() === null) void isConsentRequiredRegion().then((required) => { if (alive && required) setOpen(true); });
    const reopen = () => setOpen(true);
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);
    return () => { alive = false; window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen); };
  }, []);

  if (!open) return null;
  const choose = (decision: "granted" | "denied") => { saveChoice(decision); setOpen(false); };

  return (
    <div className="ca-dark fixed inset-x-3 bottom-3 z-[70] sm:inset-x-auto sm:left-4 sm:bottom-4 sm:max-w-[380px]">
      <section
        role="dialog"
        aria-labelledby="cookie-rubrik"
        className="rounded-xl border border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-panel))] p-4 text-[hsl(var(--ca-text))] shadow-2xl"
      >
        <h2 id="cookie-rubrik" className="text-sm font-semibold">Cookies</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))]">
          Vi vill använda cookies från Google Ads för att se om våra annonser leder till nya konton. Det är frivilligt,
          och CrimeAlert fungerar likadant oavsett vad du väljer.{" "}
          <Link to="/cookies" className="text-[hsl(var(--ca-text))] underline underline-offset-4">Läs mer</Link>
        </p>
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="h-10 rounded-lg border border-[hsl(var(--ca-line-strong))] text-[13px] font-medium transition hover:bg-[hsl(var(--ca-panel-2))]"
          >
            Endast nödvändiga
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="h-10 rounded-lg border border-[hsl(var(--ca-line-strong))] text-[13px] font-medium transition hover:bg-[hsl(var(--ca-panel-2))]"
          >
            Godkänn
          </button>
        </div>
      </section>
    </div>
  );
};
export default CookieBanner;
