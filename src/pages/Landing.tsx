import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import MapPreview from '@/components/landing/MapPreview';
import Categories from '@/components/landing/Categories';
import LocalMonitoring from '@/components/landing/LocalMonitoring';
import PlatformGrid from '@/components/landing/PlatformGrid';
import FinalCTA from '@/components/landing/FinalCTA';
import LandingFooter from '@/components/landing/LandingFooter';
import StoryStatic from '@/components/landing/StoryStatic';
import { useLandingLive } from '@/components/landing/useLandingLive';

// Below the fold and the only user of framer-motion, so keep it out of the initial bundle
const StickyStory = lazy(() => import('@/components/landing/StickyStory'));

// Keeps the Hero's #hur-det-fungerar link working while StickyStory loads
const StickyStoryPlaceholder = () => (
  <section id="hur-det-fungerar" className="relative min-h-[100svh] border-t border-[hsl(var(--ca-line))]" />
);

const Landing = () => {
  useSEO({
    title: 'CrimeAlert — Livekarta över polishändelser i Sverige',
    description:
      'Följ aktuella polisärenden, olyckor och samhällshändelser i realtid på en interaktiv karta. Sök kommun, filtrera kategori och få notiser.',
    canonical: 'https://crimealert.se/',
  });

  const location = useLocation();
  // Phones and tablets get the story as a plain list: scroll-driven animation of a large map
  // stutters there, and they skip downloading the animation library
  const [touch] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia?.('(max-width: 767px), (pointer: coarse)').matches ?? false),
  );
  // One source of live events for the hero and the map preview
  const live = useLandingLive();
  const incident = new URLSearchParams(location.search).get('incident');

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = '';
    };
  }, []);

  if (incident) return <Navigate to={`/karta${location.search}`} replace />;

  return (
    <div className="ca-dark min-h-screen antialiased">
      <LandingNav />
      <main>
        <Hero live={live} />
        {touch ? (
          <StoryStatic />
        ) : (
          <Suspense fallback={<StickyStoryPlaceholder />}>
            <StickyStory />
          </Suspense>
        )}
        <MapPreview live={live} />
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
