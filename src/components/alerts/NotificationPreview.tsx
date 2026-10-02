import { useMemo } from 'react';
import type { Incident } from '@/data/mockIncidents';
import { parseIncidentTime } from '@/lib/incidentTime';
import { buildPushMessage } from '../../../supabase/functions/_shared/notifications';

interface NotificationPreviewProps {
  /** The newest event in the user's areas, shown as it would arrive; else an example. */
  incident?: Incident | null;
  area?: string;
  className?: string;
}

/** A phone-style notification banner showing what a push from CrimeAlert looks like. */
const NotificationPreview = ({ incident, area = 'Uppsala', className = '' }: NotificationPreviewProps) => {
  const message = useMemo(() => {
    const time = (incident && parseIncidentTime(incident.time)) || new Date();
    return buildPushMessage([{
      id: incident?.id ?? 'exempel',
      title: incident?.title ?? '',
      area: incident?.area ?? area,
      type: incident?.type ?? 'fire',
      risk: incident?.risk ?? 'high',
      time: time.toISOString(),
      original_type: incident ? incident.originalType ?? null : 'Brand',
    }]);
  }, [incident, area]);

  return (
    <div
      className={`flex gap-3 rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-panel-2)/0.92)] p-3 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl ${className}`}
      aria-label="Exempel på en notis"
      role="img"
    >
      <img src="/pwa-192x192.png" alt="" className="h-9 w-9 shrink-0 rounded-[10px]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--ca-text-2))]">CrimeAlert</span>
          <span className="text-[11px] text-muted-foreground">nu</span>
        </div>
        <p className="truncate text-[13px] font-semibold text-foreground">{message.title}</p>
        <p className="line-clamp-2 text-[12px] leading-snug text-[hsl(var(--ca-text-2))]">{message.body}</p>
      </div>
    </div>
  );
};

export default NotificationPreview;
