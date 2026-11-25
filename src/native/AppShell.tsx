import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BlackWeekBanner from '@/components/BlackWeekBanner';
import PoliceStaleNotice from '@/components/PoliceStaleNotice';
import { useBlackWeekBanner } from '@/hooks/useBlackWeekBanner';
import { hasAppDesign13 } from '@/lib/native';
import { recordMoment, recordUse } from './review';
import { screenFor, welcomed } from './screens';
import TabBar from './TabBar';
import TopBar from './TopBar';
import Welcome from './Welcome';
import './app.css';

/**
 * The iPhone app's frame around the site's pages: a title bar, tabs along the bottom and a
 * welcome the first time. Only the app loads it (App.tsx); the website looks as before.
 */
const AppShell = ({ children }: { children: ReactNode }) => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const screen = screenFor(pathname);
  const [showWelcome, setShowWelcome] = useState(() => !welcomed());
  const pageRef = useRef<HTMLDivElement>(null);
  // From 1.3 the map reaches up under the status bar, with its own search on top (MapChrome)
  const fullBleed = hasAppDesign13() && pathname === '/karta';
  // Black Week, under the title bar (the map reaches up under the status bar, so not there)
  const blackWeek = useBlackWeekBanner();

  // From 1.3 a kommun's discussion opens as a chat room, also from a reply notification
  // ("/kommun/nacka?chatt=1")
  useEffect(() => {
    const kommun = /^\/kommun\/([^/]+)$/.exec(pathname);
    if (kommun && hasAppDesign13() && new URLSearchParams(search).has('chatt')) navigate(`/chatt/${kommun[1]}`, { replace: true });
  }, [pathname, search, navigate]);

  // A new page starts at the top
  useEffect(() => { pageRef.current?.scrollTo(0, 0); }, [pathname]);

  // For asking for a rating at a good moment (review.ts): the days the app is used, and the
  // events and kommuner opened (also from a notification)
  useEffect(() => { recordUse(); }, []);
  useEffect(() => {
    if (!showWelcome && /^\/(handelse|kommun)\/./.test(pathname)) recordMoment();
  }, [pathname, showWelcome]);

  // The tab you are on, tapped again: back to the top of everything that scrolls
  useEffect(() => {
    const top = () => {
      const root = pageRef.current;
      if (!root) return;
      [root, ...root.querySelectorAll<HTMLElement>('*')].forEach((el) => { if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior: 'smooth' }); });
    };
    window.addEventListener('ca-tab-top', top);
    return () => window.removeEventListener('ca-tab-top', top);
  }, []);

  // An app doesn't zoom when you pinch or tap twice
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    meta?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  }, []);

  return (
    <div className="ca-dark ca-app fixed inset-0 flex flex-col bg-[hsl(var(--ca-base))] text-foreground">
      {!fullBleed && <TopBar screen={screen} home={pathname === '/karta'} />}
      {!fullBleed && blackWeek.visible && pathname !== '/prisplan' && <BlackWeekBanner banner={blackWeek} />}
      {!fullBleed && <PoliceStaleNotice />}
      <div ref={pageRef} className="ca-app-page relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {/* Pages opened from a tab slide in from the right */}
        {/* The intro is shown alone on the first start: the map loading behind it (MapKit, the
            events) kept the phone busy, and "Fortsätt" answered only after a few seconds */}
        <div key={pathname} className={`h-full ${screen.tab ? '' : 'ca-app-push'}`}>{showWelcome ? null : children}</div>
      </div>
      {screen.tabBar && <TabBar />}
      {showWelcome && <Welcome onDone={() => setShowWelcome(false)} />}
    </div>
  );
};

export default AppShell;
