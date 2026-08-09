import { useState, useMemo } from 'react';
import { Download, FileText, Table2, Calendar, Loader2 } from 'lucide-react';
import { Incident } from '@/data/mockIncidents';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useArchiveEvents } from '@/hooks/useArchiveEvents';
import { useToast } from '@/hooks/use-toast';

interface ExportDataProps {
  liveIncidents: Incident[];
  selectedArea?: string | null;
}

const RISK_LABELS: Record<string, string> = { low: 'Låg', medium: 'Medel', high: 'Hög' };
const TYPE_LABELS: Record<string, string> = {
  police: 'Polis',
  fire: 'Brand',
  ambulance: 'Ambulans',
  traffic: 'Trafik',
  other: 'Övrigt',
};

function parseIncidentTimestamp(value: string) {
  const trimmed = value.trim();

  if (trimmed.includes('T')) {
    return new Date(trimmed).getTime();
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 3) {
    const paddedTime = parts[1].split(':').map((part) => part.padStart(2, '0')).join(':');
    return new Date(`${parts[0]}T${paddedTime}${parts[2]}`).getTime();
  }

  return new Date(trimmed).getTime();
}

function formatTime(value: string) {
  const timestamp = parseIncidentTimestamp(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toLocaleString('sv-SE');
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Neutralize spreadsheet formula injection (=, +, -, @, tab, CR)
function csvCell(value: unknown): string {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return `"${str.replace(/"/g, '""')}"`;
}

function generateCSV(incidents: Incident[]): string {
  const header = ['Tid', 'Typ', 'Titel', 'Område', 'Beskrivning', 'Risk', 'Status', 'Lat', 'Lng', 'Källa'];
  const rows = incidents.map((incident) => [
    csvCell(formatTime(incident.time)),
    csvCell(TYPE_LABELS[incident.type] || incident.type),
    csvCell(incident.title || ''),
    csvCell(incident.area || ''),
    csvCell(incident.description || ''),
    csvCell(RISK_LABELS[incident.risk] || incident.risk),
    csvCell(incident.status === 'active' ? 'Aktiv' : 'Avslutad'),
    csvCell(incident.lat),
    csvCell(incident.lng),
    csvCell(incident.source || ''),
  ]);

  return [header.map(csvCell).join(','), ...rows.map((row) => row.join(','))].join('\n');
}

function generatePDFHtml(incidents: Incident[], range: string): string {
  const now = new Date().toLocaleString('sv-SE');
  const rows = incidents
    .map(
      (incident) => `
    <tr>
      <td>${escapeHtml(formatTime(incident.time))}</td>
      <td>${escapeHtml(TYPE_LABELS[incident.type] || incident.type)}</td>
      <td>${escapeHtml(incident.title)}</td>
      <td>${escapeHtml(incident.area || '—')}</td>
      <td>${escapeHtml(RISK_LABELS[incident.risk] || incident.risk)}</td>
      <td>${escapeHtml(incident.status === 'active' ? 'Aktiv' : 'Avslutad')}</td>
    </tr>`
    )
    .join('');

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
  <div class="meta">${escapeHtml(range)} · Exporterad ${escapeHtml(now)} · ${incidents.length} händelser</div>
  <table><thead><tr><th>Tid</th><th>Typ</th><th>Titel</th><th>Område</th><th>Risk</th><th>Status</th></tr></thead>
  <tbody>${rows}</tbody></table>
</body></html>`;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadPDF(incidents: Incident[], range: string) {
  const html = generatePDFHtml(incidents, range);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 400);
  return true;
}

type Range = '24h' | '7d' | '30d';

const ExportData = ({ liveIncidents, selectedArea }: ExportDataProps) => {
  const { isPremium } = useIsPremium();
  const [range, setRange] = useState<Range>('24h');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const needsArchive = range === '7d' || range === '30d';
  const archiveDays = range === '30d' ? 30 : 7;
  const { incidents: archiveIncidents, loading: archiveLoading } = useArchiveEvents(archiveDays, needsArchive && isPremium);

  const filtered24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return liveIncidents.filter((incident) => {
      const timestamp = parseIncidentTimestamp(incident.time);
      return !Number.isNaN(timestamp) && timestamp >= cutoff;
    });
  }, [liveIncidents]);

  const timeFiltered = needsArchive ? archiveIncidents : filtered24h;
  const sourceIncidents = useMemo(() => {
    if (!selectedArea) return timeFiltered;
    return timeFiltered.filter((i) => i.area === selectedArea);
  }, [timeFiltered, selectedArea]);
  const rangeLabel = range === '24h' ? 'Senaste 24h' : range === '7d' ? 'Senaste 7 dagar' : 'Senaste 30 dagar';

  const handleExport = (format: 'csv' | 'pdf') => {
    if (!isPremium) return;
    if (sourceIncidents.length === 0) {
      toast({
        title: 'Inga händelser',
        description: 'Det finns inga händelser att exportera för vald period.',
        variant: 'destructive',
      });
      return;
    }

    setExporting(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      if (format === 'csv') {
        downloadFile(generateCSV(sourceIncidents), `crimealert-${range}-${dateStr}.csv`, 'text/csv;charset=utf-8');
        toast({ title: 'CSV exporterad', description: `${sourceIncidents.length} händelser nedladdade.` });
        return;
      }

      const ok = downloadPDF(sourceIncidents, rangeLabel);
      if (!ok) {
        toast({ title: 'Popup blockerad', description: 'Tillåt popups för att skriva ut PDF.', variant: 'destructive' });
      } else {
        toast({ title: 'PDF redo', description: 'Använd utskriftsdialogen för att spara som PDF.' });
      }
    } finally {
      setExporting(false);
    }
  };

  if (!isPremium) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold text-foreground">Exportera händelsedata</span>
      </div>

      <div className="flex gap-1 mb-3">
        {([
          ['24h', 'Senaste 24h'],
          ['7d', '7 dagar'],
          ['30d', '30 dagar'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setRange(value)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium transition ${
              range === value ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground bg-muted'
            }`}
          >
            <Calendar className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground mb-3">
        {needsArchive && archiveLoading ? 'Hämtar data...' : `${sourceIncidents.length} händelser tillgängliga${selectedArea ? ` i ${selectedArea}` : ''}`}
      </p>

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
