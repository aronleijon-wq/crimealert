// The wider notification choices on the Notiser page, besides Polisen's events in your own areas:
// every event in Sweden, new posts in your kommuner's discussions, and reports from people on the
// spot near you. Likes and other small things are never sent. send-push-notifications reads them.
import { REPORT_CATEGORY_LABELS } from './reportCategories.ts';

export interface NotifyExtras {
  /** Polisen's events in all of Sweden, not only in your kommuner and places */
  allSweden: boolean;
  /** New posts in the discussions ("kommun:nacka") of the kommuner you watch */
  kommunChat: boolean;
  /** Reports from people on the spot in your kommuner, your places or your circle */
  reports: boolean;
}

/** For those who never changed them: reports on, the busier two off */
export const DEFAULT_EXTRAS: NotifyExtras = { allSweden: false, kommunChat: false, reports: true };

export interface ExtrasRow {
  all_sweden?: boolean | null;
  kommun_chat?: boolean | null;
  nearby_reports?: boolean | null;
}

export function extrasFromRow(row?: ExtrasRow | null): NotifyExtras {
  return {
    allSweden: typeof row?.all_sweden === 'boolean' ? row.all_sweden : DEFAULT_EXTRAS.allSweden,
    kommunChat: typeof row?.kommun_chat === 'boolean' ? row.kommun_chat : DEFAULT_EXTRAS.kommunChat,
    reports: typeof row?.nearby_reports === 'boolean' ? row.nearby_reports : DEFAULT_EXTRAS.reports,
  };
}

export function extrasToRow(e: NotifyExtras): Required<ExtrasRow> {
  return { all_sweden: e.allSweden, kommun_chat: e.kommunChat, nearby_reports: e.reports };
}

/** Everything on: the "Allt" choice */
export const ALL_EXTRAS: NotifyExtras = { allSweden: true, kommunChat: true, reports: true };
export const allOn = (e: NotifyExtras) => e.allSweden && e.kommunChat && e.reports;

/**
 * A busy discussion buzzes each phone at most once per ten minutes: the key in sent_push_log for
 * one user, one discussion and one ten-minute window.
 */
export const CHAT_GAP_MS = 10 * 60 * 1000;
export const chatLogKey = (threadId: string, now: number) => `chat:${threadId}:${Math.floor(now / CHAT_GAP_MS)}`;

const short = (text: string, max: number) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

export function chatMessage({ author, text, kommun }: { author: string; text: string; kommun: string }) {
  return { title: `Nytt i chatten för ${kommun}`, body: `${author || 'Någon'}: ${short(text, 120)}` };
}

/** The report's own words are not sent, only what kind it is and where */
export function reportMessage({ category, area }: { category: string; area: string | null }) {
  const label = (REPORT_CATEGORY_LABELS as Record<string, string>)[category] ?? 'Något';
  const place = area?.split(',').map((p) => p.trim()).filter(Boolean).pop();
  return {
    title: `På plats: ${label}`,
    body: place ? `Någon i ${place} rapporterar just nu. Tryck för att se.` : 'Någon nära dig rapporterar just nu. Tryck för att se.',
  };
}

/** Where a report notification opens: the police event it belongs to, or the feed */
export const reportPath = (eventId: string | null) => (eventId ? `/handelse/${encodeURIComponent(eventId)}` : '/flode');

/** The choices as the Notiser pages show them (app and website) */
export const EXTRA_CHOICES: { key: keyof NotifyExtras; label: string; detail: string }[] = [
  { key: 'allSweden', label: 'Polisens händelser i hela Sverige', detail: 'Inte bara i dina kommuner och platser' },
  { key: 'kommunChat', label: 'Nya inlägg i kommunchatten', detail: 'När någon skriver i chatten för dina kommuner' },
  { key: 'reports', label: 'Rapporter från folk på plats', detail: 'När någon rapporterar nära dina kommuner och platser' },
];

export const EXTRAS_FOOTER = 'Gillningar och andra små saker får du aldrig notiser om. Svar på dina kommentarer kommer alltid.';
export const ALL_SWEDEN_HINT = 'Hela Sverige blir många notiser. Välj gärna bara allvarliga händelser under "Hur allvarligt".';
