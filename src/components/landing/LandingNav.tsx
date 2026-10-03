import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const links = [
  { to: '/karta', label: 'Karta' },
  { to: '/flode', label: 'Flöde' },
  { to: '/analysis', label: 'Analys' },
  { to: '/alerts', label: 'Notiser' },
  { to: '/kommun', label: 'Kommuner' },
];

const LandingNav = () => {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'ca-bar bg-[hsl(var(--ca-base))]/85 backdrop-blur-xl border-b border-[hsl(var(--ca-line))]'
          : 'bg-transparent border-b border-transparent'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-[1400px] mx-auto px-5 md:px-10 h-14 md:h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <img
            src="/lovable-uploads/c2e577a8-2adc-46ca-b331-79142ec40f70.png"
            alt="CrimeAlert"
            width={30}
            height={30}
            className="w-[30px] h-[30px] rounded-md object-cover"
            fetchPriority="high"
            decoding="async"
          />
          <span className="ca-display text-[15px] md:text-base tracking-[0.02em]">
            CRIME<span className="text-[hsl(var(--ca-red))]">ALERT</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="px-3.5 py-2 text-[13px] text-[hsl(var(--ca-text-2))] hover:text-[hsl(var(--ca-text))] transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <Link
            to="/karta"
            className="hidden sm:grid place-items-center w-9 h-9 rounded-md border border-[hsl(var(--ca-line))] text-[hsl(var(--ca-text-2))] hover:text-[hsl(var(--ca-text))] hover:border-[hsl(var(--ca-line-strong))] transition"
            aria-label="Sök kommun"
          >
            <Search className="w-4 h-4" />
          </Link>
          <Link
            to="/account"
            className="hidden md:inline-flex px-3.5 py-2 text-[13px] text-[hsl(var(--ca-text-2))] hover:text-[hsl(var(--ca-text))] transition-colors"
          >
            {user ? 'Konto' : 'Prisplan'}
          </Link>
          {user ? (
            <Link
              to="/account"
              className="hidden md:inline-flex items-center px-4 py-2 text-[13px] font-medium rounded-md bg-[hsl(var(--ca-red))] text-white hover:brightness-110 transition"
            >
              Min profil
            </Link>
          ) : (
            <Link
              to="/auth?mode=signup"
              className="hidden md:inline-flex items-center px-4 py-2 text-[13px] font-medium rounded-md bg-[hsl(var(--ca-red))] text-white hover:brightness-110 transition"
            >
              Skapa konto
            </Link>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden grid place-items-center w-9 h-9 rounded-md border border-[hsl(var(--ca-line))] text-[hsl(var(--ca-text-2))]"
            aria-label="Meny"
          >
            {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-base))]/95 backdrop-blur-xl px-5 py-4 flex flex-col gap-1">
          {[...links, { to: '/account', label: 'Prisplan' }].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="py-2.5 text-sm text-[hsl(var(--ca-text-2))]"
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <Link
              to="/account"
              onClick={() => setOpen(false)}
              className="mt-2 text-center py-2.5 rounded-md bg-[hsl(var(--ca-red))] text-white text-sm font-medium"
            >
              Min profil
            </Link>
          ) : (
            <Link
              to="/auth?mode=signup"
              onClick={() => setOpen(false)}
              className="mt-2 text-center py-2.5 rounded-md bg-[hsl(var(--ca-red))] text-white text-sm font-medium"
            >
              Skapa konto
            </Link>
          )}
        </div>
      )}
    </header>
  );
};

export default LandingNav;
