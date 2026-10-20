import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import PoliceStaleNotice from '@/components/PoliceStaleNotice';
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
  const { pathname } = useLocation();
  const screen = screenFor(pathname);
  const [showWelcome, setShowWelcome] = useState(() => !welcomed());
  const pageRef = useRef<HTMLDivElement>(null);

  // A new page starts at the top
  useEffect(() => { pageRef.current?.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="ca-dark ca-app fixed inset-0 flex flex-col bg-[hsl(var(--ca-base))] text-foreground">
      <TopBar screen={screen} home={pathname === '/karta'} />
      <PoliceStaleNotice />
      <div ref={pageRef} className="ca-app-page relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {children}
      </div>
      {screen.tabBar && <TabBar />}
      {showWelcome && <Welcome onDone={() => setShowWelcome(false)} />}
    </div>
  );
};

export default AppShell;
