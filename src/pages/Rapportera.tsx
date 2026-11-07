import CommunityReports from '@/components/CommunityReports';
import Header from '@/components/Header';
import { useSEO } from '@/hooks/useSEO';

/** Citizen reports on a page of their own on the website (/rapportera); the app has NativeReport */
const Rapportera = () => {
  useSEO({
    title: 'Rapportera händelse | CrimeAlert',
    description: 'Berätta för dina grannar om trasig belysning, otrygga platser, skadegörelse eller något misstänkt.',
    canonical: 'https://crimealert.se/rapportera',
  });
  return (
    <div className="ca-dark flex min-h-[100dvh] flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-20 pt-8">
        <h1 className="font-['Archivo',Inter,sans-serif] text-3xl font-extrabold text-foreground">Rapportera händelse</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[hsl(var(--ca-text-2))]">
          Har du sett något i ditt område? Berätta för dina grannar. Vid akut fara, ring 112. Tips till Polisen: 114 14.
        </p>
        <div className="mt-6">
          <CommunityReports />
        </div>
      </main>
    </div>
  );
};

export default Rapportera;
