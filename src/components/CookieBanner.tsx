import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { isNativeApp } from "@/lib/native";
import { isConsentRequiredRegion, loadGoogleAds, saveChoice, storedChoice, CONSENT_EVENT } from "@/lib/googleAds";

export const OPEN_COOKIE_SETTINGS = "ca-open-cookie-settings";

const CookieBanner = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isNativeApp()) return;
    void loadGoogleAds();
    if (storedChoice() === null) {
      void isConsentRequiredRegion().then((req) => { if (req && storedChoice() === null) setOpen(true); });
    }
    const openIt = () => setOpen(true);
    const onStorage = (e: StorageEvent) => { if (e.key === "cookie_consent" && e.newValue) saveChoice(e.newValue as "granted" | "denied"); };
    window.addEventListener(OPEN_COOKIE_SETTINGS, openIt);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(OPEN_COOKIE_SETTINGS, openIt); window.removeEventListener("storage", onStorage); };
  }, []);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener(CONSENT_EVENT, close);
    return () => window.removeEventListener(CONSENT_EVENT, close);
  }, []);

  if (!open) return null;
  return (
    <div role="dialog" aria-label="Cookie-inställningar" className="fixed inset-x-3 bottom-3 z-[2000] mx-auto max-w-lg rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      <p className="text-sm font-semibold">Cookies för annonsmätning</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Vi vill använda Google Ads-cookies för att mäta om våra annonser leder till nya konton och Pro-köp. Inget skickas utan ditt godkännande. Du kan ändra dig när som helst under "Cookie settings" i sidfoten. <Link to="/cookies" className="underline">Läs mer</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => saveChoice("denied")}>Neka</Button>
        <Button size="sm" className="flex-1" onClick={() => saveChoice("granted")}>Godkänn</Button>
      </div>
    </div>
  );
};

export default CookieBanner;
