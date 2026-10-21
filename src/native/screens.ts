// What the iPhone app's own top bar and tab bar show for each page (AppShell). The website
// itself has none of this; it only exists in the app.
import { BarChart3, Bell, Map, Newspaper, UserRound, type LucideIcon } from 'lucide-react';

export interface AppTab {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const TABS: AppTab[] = [
  { to: '/karta', label: 'Karta', icon: Map },
  { to: '/flode', label: 'Flöde', icon: Newspaper },
  { to: '/analysis', label: 'Statistik', icon: BarChart3 },
  { to: '/alerts', label: 'Notiser', icon: Bell },
  { to: '/installningar', label: 'Profil', icon: UserRound },
];

export interface AppScreen {
  title: string;
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
];

const WITHOUT_TABS = /^\/(prisplan|account|auth|reset-password)$/;

export function screenFor(pathname: string): AppScreen {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  const tab = TABS.find((t) => t.to === path);
  if (tab) return { title: tab.to === '/karta' ? 'CrimeAlert' : tab.label, tab: true, tabBar: true };
  const title = TITLES.find(([pattern]) => pattern.test(path))?.[1] ?? 'CrimeAlert';
  return { title, tab: false, tabBar: !WITHOUT_TABS.test(path) };
}

export const WELCOME_DONE_KEY = 'ca-app-welcomed';

/** Whether the app's welcome (Welcome) has been shown on this phone */
export function welcomed(): boolean {
  try { return localStorage.getItem(WELCOME_DONE_KEY) === '1'; } catch { return true; }
}
