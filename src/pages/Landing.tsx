import { useEffect } from 'react';
import { useSEO } from '@/hooks/useSEO';
import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import StickyStory from '@/components/landing/StickyStory';
import MapPreview from '@/components/landing/MapPreview';
import Categories from '@/components/landing/Categories';
import LocalMonitoring from '@/components/landing/LocalMonitoring';
import PlatformGrid from '@/components/landing/PlatformGrid';
import FinalCTA from '@/components/landing/FinalCTA';
import LandingFooter from '@/components/landing/LandingFooter';

const Landing = () => {
  useSEO({
    title: 'CrimeAlert — Livekarta för polisärenden och olyckor i Sverige',
    description:
      'Följ aktuella polisärenden, olyckor och samhällshändelser i realtid på en interaktiv karta. Sök kommun, filtrera kategori och få notiser.',
    canonical: 'https://crimealert.se/',
  });

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = '';
    };
  }, []);

  return (
    <div className="ca-dark min-h-screen antialiased">
      <LandingNav />
      <main>
        <Hero />
        <StickyStory />
        <MapPreview />
        <Categories />
        <LocalMonitoring />
        <PlatformGrid />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
};

export default Landing;
