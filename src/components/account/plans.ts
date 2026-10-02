import { BarChart3, EyeOff, FileDown, FileText, ListChecks, Users, Zap, type LucideIcon } from 'lucide-react';

export const PRICES = {
  monthly: { price: '19 kr', period: '/mån', note: null },
  yearly: { price: '119 kr', period: '/år', note: 'Spara 109 kr jämfört med månadsvis' },
} as const;
export type BillingCycle = keyof typeof PRICES;

/** What Pro adds, as the code gates it (police-events, IncidentDetail, Analysis, ExportData, CommunityReports, ads). */
export const PRO_FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: Zap, text: 'Polisens händelser direkt, utan 15 minuters fördröjning' },
  { icon: FileText, text: 'Hela beskrivningen av varje händelse' },
  { icon: ListChecks, text: 'Risknivå, status, Polisens kategori och platsens precision' },
  { icon: BarChart3, text: 'Analys och statistik per kommun, upp till 30 dagar bakåt' },
  { icon: FileDown, text: 'Export till PDF och CSV' },
  { icon: Users, text: 'Medborgarrapporter: se andras och skicka egna' },
  { icon: EyeOff, text: 'Ingen reklam' },
];
