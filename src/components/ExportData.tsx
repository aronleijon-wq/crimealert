import { useState } from 'react';
import { Download, FileText, Table2, Calendar, Loader2 } from 'lucide-react';
import { Incident } from '@/data/mockIncidents';
import { useIsPremium } from '@/hooks/useIsPremium';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useArchiveEvents } from '@/hooks/useArchiveEvents';
import { useToast } from '@/hooks/use-toast';

const RISK_LABELS: Record<string, string> = { low: 'Låg', medium: 'Medel', high: 'Hög' };
const TYPE_LABELS: Record<string, string> = {
  police: 'Polis', fire: 'Brand', ambulance: 'Ambulans', traffic: 'Trafik', other: 'Övrigt',
};

function formatTime(iso: string) {
  try {
    const d = new Date(iso.replace(/\s(?=\+|-)/, 'T').replace(' ', 'T'));
    return d.toLocaleString('sv-SE');
  } catch { return iso; }
}

function generateCSV(incidents: Incident[]): string {
  const header = ['Tid', 'Typ', 'Titel', 'Område', 'Beskrivning', 'Risk', 'Status', 'Lat', 'Lng', 'Källa'];
  const rows = incidents.map(i => [
    formatTime(i.time),
    TYPE_LABELS[i.type] || i.type,
    `"${(i.title || '').replace(/"/g, '""')}"`,
    `"${(i.area || '').replace(/"/g, '""')}"`,
    `"${(i.description || '').replace(/"/g, '""')}"`,
    RISK_LABELS[i.risk] || i.risk,
    i.status === 'active' ? 'Aktiv' : 'Avslutad',
    i.lat, i.lng,
    i.source || '',
  ]);
  return [header.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function generatePDFHtml(incidents: Incident[], range: string): string {
  const now = new Date().toLocaleString('sv-SE');
  const rows = incidents.map(i => `
    <tr>
      <td>${formatTime(i.time)}</td>
      <td>${TYPE_LABELS[i.type] || i.type}</td>
      <td>${i.title}</td>
      <td>${i.area || '—'}</td>
      <td>${RISK_LABELS[i.risk] || i.risk}</td>
      <td>${i.status === 'active' ? 'Aktiv' : 'Avslutad'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:Arial,sans-serif;margin:24px;color:#1a1a1a;font-size:11px}
  h1{font-size:18px;margin-bottom:4px}
  .meta{color:#666;font-size:10px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border:1px solid #ddd;padding:5px 7px;text-align:left}
  th{background:#f4f4f4;font-weight:600;font-size:10px;text-transform:uppercase}
  tr:nth-child(even){background:#fafafa}
</style></head><body>
  <h1>CrimeAlert — Händelserapport</h1>
  <div class="meta">${range} · Exporterad ${now} · ${incidents.length} händelser</div>
  <table><thead><tr><th>Tid</th><th>Typ</th><th>Titel</th><th>Område</th><th>Risk</th><th>Status</th></tr></thead>
  <tbody>${rows}</tbody></table>
</body></html>`;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPDF(incidents: Incident[], range: string) {
  const html = generatePDFHtml(incidents, range);
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.print(); }, 400);
  return true;
}

type Range = '24h' | '7d' | '30d';

const ExportData = () => {
  const { isPremium } = useIsPremium();
  const { incidents: liveIncidents } = usePoliceEvents();
  const [range, setRange] = useState<Range>('24h');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const needsArchive = range === '7d' || range === '30d';
  const archiveDays = range === '30d' ? 30 : 7;
  const { incidents: archiveIncidents, loading: archiveLoading } = useArchiveEvents(archiveDays, needsArchive && isPremium);

  // Filter live incidents to last 24h only
  const filtered24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return liveIncidents.filter(i => {
      const t = new Date(i.time.replace(/\s(?=\+|-)/, 'T').replace(' ', 'T')).getTime();
      return !isNaN(t) && t >= cutoff;
    });
  }, [liveIncidents]);

  const sourceIncidents = needsArchive ? archiveIncidents : filtered24h;
  const rangeLabel = range === '24h' ? 'Senaste 24h' : range === '7d' ? 'Senaste 7 dagar' : 'Senaste 30 dagar';

  const handleExport = (format: 'csv' | 'pdf') => {
    if (!isPremium) return;
    if (sourceIncidents.length === 0) {
      toast({ title: 'Inga händelser', description: 'Det finns inga händelser att exportera för vald period.', variant: 'destructive' });
      return;
    }

    setExporting(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      if (format === 'csv') {
        downloadFile(generateCSV(sourceIncidents), `crimealert-${range}-${dateStr}.csv`, 'text/csv;charset=utf-8');
        toast({ title: 'CSV exporterad', description: `${sourceIncidents.length} händelser nedladdade.` });
      } else {
        const ok = downloadPDF(sourceIncidents, rangeLabel);
        if (!ok) toast({ title: 'Popup blockerad', description: 'Tillåt popups för att skriva ut PDF.', variant: 'destructive' });
        else toast({ title: 'PDF redo', description: 'Använd utskriftsdialogen för att spara som PDF.' });
      }
    } finally {
      setExporting(false);
    }
  };

  if (!isPremium) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Download className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-foreground">Exportera händelsedata</span>
      </div>

      {/* Range picker */}
      <div className="flex gap-1 mb-3">
        {([['24h', 'Senaste 24h'], ['7d', '7 dagar'], ['30d', '30 dagar']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setRange(val)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium transition ${
              range === val ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground bg-muted'
            }`}
          >
            <Calendar className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-[10px] text-muted-foreground mb-3">
        {archiveLoading ? 'Hämtar data...' : `${sourceIncidents.length} händelser tillgängliga`}
      </p>

      {/* Export buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleExport('csv')}
          disabled={exporting || archiveLoading}
          className="flex items-center gap-1.5 px-3 py-2 bg-muted text-foreground rounded-md text-xs font-semibold hover:bg-muted/80 transition disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Table2 className="w-3.5 h-3.5" />}
          CSV
        </button>
        <button
          onClick={() => handleExport('pdf')}
          disabled={exporting || archiveLoading}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          PDF
        </button>
      </div>
    </div>
  );
};

export default ExportData;
