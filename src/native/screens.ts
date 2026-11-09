// What the iPhone app's own top bar and tab bar show for each page (AppShell). The website
// itself has none of this; it only exists in the app.
import { BarChart3, Bell, Map, Megaphone, Newspaper, UserRound, type LucideIcon } from 'lucide-react';
import { hasAppDesign13 } from '@/lib/native';

export interface AppTab {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Drawn larger, in the middle, as the tab for doing something rather than looking */
  prominent?: boolean;
}

export const TABS: AppTab[] = [
  { to: '/karta', label: 'Karta', icon: Map },
  { to: '/flode', label: 'Flöde', icon: Newspaper },
  { to: '/analysis', label: 'Statistik', icon: BarChart3 },
  { to: '/alerts', label: 'Notiser', icon: Bell },
  { to: '/installningar', label: 'Profil', icon: UserRound },
];

/**
 * The tabs from app version 1.3: Rapportera gets a tab of its own in the middle, and Notiser
 * (which kommuner to watch, set up once) moves under Profil.
 */
export const TABS_13: AppTab[] = [
  { to: '/karta', label: 'Karta', icon: Map },
  { to: '/flode', label: 'Flöde', icon: Newspaper },
  { to: '/rapportera', label: 'Rapportera', icon: Megaphone, prominent: true },
  { to: '/analysis', label: 'Statistik', icon: BarChart3 },
  { to: '/installningar', label: 'Profil', icon: UserRound },
];

/** The tabs this app version has */
export const appTabs = (): AppTab[] => (hasAppDesign13() ? TABS_13 : TABS);

export interface AppScreen {
  title: string;
  /** The screen shows its own large title, so the bar above stays empty (as iOS does) */
  largeTitle?: boolean;
  /** One of the tabs: no back button */
  tab: boolean;
  /** The tab bar shows (not while signing in or buying Pro) */
  tabBar: boolean;
}

const TITLES: [RegExp, string][] = [
  [/^\/(prisplan|account)$/, 'CrimeAlert Pro'],
  [/^\/auth$/, 'Konto'],
  [/^\/reset-password$/, 'Nytt lösenord'],
  [/^\/handelse\//, 'Händelse'],
  [/^\/kommun\/[^/]+\/[^/]+/, 'Månadsrapport'],
  [/^\/kommun\/[^/]+/, 'Kommun'],
  [/^\/kommun$/, 'Kommuner'],
  [/^\/guider\/.+/, 'Guide'],
  [/^\/guider$/, 'Guider'],
  [/^\/statistik$/, 'Sverige i siffror'],
  [/^\/om-oss$/, 'Om CrimeAlert'],
  [/^\/villkor$/, 'Användarvillkor'],
  [/^\/(sekretesspolicy|privacy)$/, 'Sekretesspolicy'],
  [/^\/cookies$/, 'Cookies'],
  [/^\/admin$/, 'Admin'],
  [/^\/inbjudan\//, 'Inbjudan'],
  [/^\/chatt\//, 'Chatt'],
];

// The app's own screens (NativeFeed, NativeStats, NativeAlerts, NativeProfile) with iOS large titles
const LARGE_TITLES = ['/flode', '/analysis', '/alerts', '/installningar', '/rapportera'];
// Pages under a tab that show their own large title
const OWN_LARGE_TITLES = ['/bjud-in', '/chattar'];

// The chat room needs the whole screen for its messages and the keyboard
const WITHOUT_TABS = /^\/(prisplan|account|auth|reset-password)$|^\/chatt\//;

export function screenFor(pathname: string, tabs: AppTab[] = appTabs()): AppScreen {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  const tab = tabs.find((t) => t.to === path);
  if (tab) return { title: tab.to === '/karta' ? 'CrimeAlert' : tab.label, tab: true, tabBar: true, ...(LARGE_TITLES.includes(tab.to) ? { largeTitle: true } : {}) };
  const title = TITLES.find(([pattern]) => pattern.test(path))?.[1] ?? 'CrimeAlert';
  return { title, tab: false, tabBar: !WITHOUT_TABS.test(path), ...(OWN_LARGE_TITLES.includes(path) || LARGE_TITLES.includes(path) || path.startsWith('/chatt/') ? { largeTitle: true } : {}) };
}

export const WELCOME_DONE_KEY = 'ca-app-welcomed';

/** Whether the app's welcome (Welcome) has been shown on this phone */
export function welcomed(): boolean {
  try { return localStorage.getItem(WELCOME_DONE_KEY) === '1'; } catch { return true; }
}
