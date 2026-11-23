import CommunityReports from '@/components/CommunityReports';
import Header from '@/components/Header';
import { useSEO } from '@/hooks/useSEO';

/** Citizen reports on a page of their own on the website (/rapportera); the app has NativeReport */
const Rapportera = () => {
  useSEO({
    title: 'Rapportera händelse | CrimeAlert',
    description: 'Berätta för dina grannar vad du ser: polis på plats, rök, smällar, en avspärrning eller en otrygg plats. Gratis med konto.',
    canonical: 'https://crimealert.se/rapportera',
  });
  return (
    <div className="ca-dark flex min-h-[100dvh] flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-10">
        <p className="ca-eyebrow">Medborgarrapporter</p>
        <h1 className="mt-3 font-['Archivo',Inter,sans-serif] text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">Vad ser du?</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-[hsl(var(--ca-text-2))]">
          Berätta för dina grannar vad som händer där du är. Det tar några sekunder och är gratis.
        </p>
        <div className="mt-8">
          <CommunityReports />
        </div>
      </main>
    </div>
  );
};

export default Rapportera;
