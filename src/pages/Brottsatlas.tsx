// /brottsatlas on the website: the same crime atlas as Statistik → Atlas in the app, in a column
// under the site's header. In the app the address opens that tab instead.
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSEO } from '@/hooks/useSEO';
import CrimeAtlas from '@/native/CrimeAtlas';

const Brottsatlas = () => {
  useSEO({
    title: 'Brottsatlas: vanligaste brotten i din kommun | CrimeAlert',
    description: 'Sök en kommun och se vilka brott Polisen rapporterar mest där jämfört med Sverige, eller välj ett brott och se var det är vanligast per invånare.',
    canonical: 'https://crimealert.se/brottsatlas',
  });
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <Header />
      <main className="ca-dark flex flex-1 justify-center bg-black text-white">
        <div className="w-full max-w-2xl pb-10 pt-6 sm:border-x sm:border-white/[0.08]">
          <h1 className="px-5 text-[30px] font-bold tracking-tight">Brottsatlas</h1>
          <p className="mt-1 px-5 text-[15px] leading-snug text-[rgba(235,235,245,0.6)]">
            Vad som är vanligast i din kommun jämfört med Sverige, och var ett brott är vanligast per invånare.
          </p>
          <CrimeAtlas />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Brottsatlas;
