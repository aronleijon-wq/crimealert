export type IncidentType = 'police' | 'fire' | 'ambulance' | 'traffic' | 'other';
export type RiskLevel = 'low' | 'medium' | 'high';
export type IncidentStatus = 'active' | 'resolved';

export interface Incident {
  id: string;
  type: IncidentType;
  title: string;
  description: string;
  lat: number;
  lng: number;
  area: string;
  time: string;
  status: IncidentStatus;
  risk: RiskLevel;
  source: string;
  approximate?: boolean;
}

const now = new Date();
const h = (hoursAgo: number) => {
  const d = new Date(now.getTime() - hoursAgo * 3600000);
  return d.toISOString();
};

export const mockIncidents: Incident[] = [
  {
    id: '1', type: 'police', title: 'Misstänkt inbrott',
    description: 'Polis utreder misstänkt inbrott i butikslokal. Avspärrning på plats.',
    lat: 59.3326, lng: 18.0649, area: 'Södermalm, Stockholm',
    time: h(0.5), status: 'active', risk: 'medium', source: 'Polisen.se'
  },
  {
    id: '2', type: 'fire', title: 'Brandlarm – kontorsbyggnad',
    description: 'Räddningstjänst utryckt efter brandlarm i kontorsbyggnad. Evakuering pågår.',
    lat: 59.3425, lng: 18.0500, area: 'Norrmalm, Stockholm',
    time: h(1), status: 'active', risk: 'high', source: 'SOS Alarm'
  },
  {
    id: '3', type: 'traffic', title: 'Trafikolycka E4',
    description: 'Kollision mellan två fordon. Ett körfält blockerat.',
    lat: 59.3600, lng: 18.0200, area: 'Solna',
    time: h(2), status: 'active', risk: 'medium', source: 'Trafikverket'
  },
  {
    id: '4', type: 'ambulance', title: 'Medicinsk nödsituation',
    description: 'Ambulans utryckt till plats. Inga ytterligare detaljer.',
    lat: 59.3150, lng: 18.0900, area: 'Hammarby Sjöstad',
    time: h(3), status: 'resolved', risk: 'low', source: 'SOS Alarm'
  },
  {
    id: '5', type: 'police', title: 'Stöld från fordon',
    description: 'Anmälan om stöld från parkerat fordon. Patrull på plats.',
    lat: 59.3450, lng: 18.0300, area: 'Kungsholmen, Stockholm',
    time: h(4), status: 'resolved', risk: 'low', source: 'Polisen.se'
  },
  {
    id: '6', type: 'fire', title: 'Containerbrand',
    description: 'Brand i avfallscontainer. Räddningstjänst släcker.',
    lat: 59.3080, lng: 18.1050, area: 'Sickla',
    time: h(5), status: 'resolved', risk: 'low', source: 'SOS Alarm'
  },
  {
    id: '7', type: 'traffic', title: 'Singelolycka',
    description: 'Fordon kört av vägen. Inga allvarliga skador rapporterade.',
    lat: 59.3700, lng: 18.0050, area: 'Sundbyberg',
    time: h(6), status: 'resolved', risk: 'low', source: 'Trafikverket'
  },
  {
    id: '8', type: 'police', title: 'Ordningsstörning',
    description: 'Polis tillkallad efter ordningsstörning utanför restaurang.',
    lat: 59.3370, lng: 18.0720, area: 'Gamla Stan, Stockholm',
    time: h(0.2), status: 'active', risk: 'medium', source: 'Polisen.se'
  },
  {
    id: '9', type: 'other', title: 'Farligt föremål',
    description: 'Misstänkt farligt föremål påträffat. Polis och bombgrupp på plats.',
    lat: 59.3300, lng: 18.0550, area: 'Medborgarplatsen, Stockholm',
    time: h(1.5), status: 'active', risk: 'high', source: 'Polisen.se'
  },
  {
    id: '10', type: 'ambulance', title: 'Fallolycka',
    description: 'Person skadad efter fall. Ambulans på plats.',
    lat: 59.3500, lng: 18.0800, area: 'Östermalm, Stockholm',
    time: h(7), status: 'resolved', risk: 'low', source: 'SOS Alarm'
  },
  {
    id: '11', type: 'police', title: 'Rån mot butik',
    description: 'Misstänkt rån mot livsmedelsbutik. Polispatrull söker gärningsman.',
    lat: 59.3550, lng: 18.0100, area: 'Bromma',
    time: h(0.8), status: 'active', risk: 'high', source: 'Polisen.se'
  },
  {
    id: '12', type: 'traffic', title: 'Vägarbete – begränsad framkomlighet',
    description: 'Planerat vägarbete orsakar köbildning.',
    lat: 59.3200, lng: 18.0400, area: 'Liljeholmen, Stockholm',
    time: h(10), status: 'active', risk: 'low', source: 'Trafikverket'
  },
];

export const incidentTypeConfig: Record<IncidentType, { label: string; color: string; icon: string }> = {
  police: { label: 'Polisinsats', color: 'hsl(210, 100%, 56%)', icon: '🔵' },
  fire: { label: 'Brand', color: 'hsl(0, 100%, 62%)', icon: '🔴' },
  ambulance: { label: 'Ambulans', color: 'hsl(142, 70%, 45%)', icon: '🟢' },
  traffic: { label: 'Trafikolycka', color: 'hsl(25, 100%, 63%)', icon: '🟠' },
  other: { label: 'Övrigt', color: 'hsl(215, 15%, 55%)', icon: '⚪' },
};

export const riskConfig: Record<RiskLevel, { label: string; colorClass: string }> = {
  low: { label: 'Låg', colorClass: 'text-cr-green' },
  medium: { label: 'Medel', colorClass: 'text-cr-orange' },
  high: { label: 'Hög', colorClass: 'text-cr-red' },
};
