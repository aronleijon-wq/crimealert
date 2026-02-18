import { useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import StatsBar from '@/components/StatsBar';
import MapView from '@/components/MapView';
import IncidentCard from '@/components/IncidentCard';
import IncidentDetail from '@/components/IncidentDetail';
import { mockIncidents, IncidentType } from '@/data/mockIncidents';

const Index = () => {
  const [activeFilters, setActiveFilters] = useState<IncidentType[]>([
    'police', 'fire', 'ambulance', 'traffic', 'other',
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toggleFilter = useCallback((type: IncidentType) => {
    setActiveFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  const filtered = useMemo(
    () => mockIncidents.filter((i) => activeFilters.includes(i.type)),
    [activeFilters]
  );

  const activeCount = filtered.filter((i) => i.status === 'active').length;
  const selectedIncident = filtered.find((i) => i.id === selectedId) || null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <StatsBar incidents={filtered} />
      <FilterBar
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        incidentCount={filtered.length}
        activeCount={activeCount}
      />
      <div className="flex-1 flex overflow-hidden relative">
        {/* Incident sidebar */}
        <div className="w-80 border-r border-border bg-card overflow-y-auto flex-shrink-0 hidden md:block">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Senaste händelser — Stockholm
            </span>
          </div>
          {filtered.map((inc) => (
            <IncidentCard
              key={inc.id}
              incident={inc}
              selected={selectedId === inc.id}
              onClick={() => setSelectedId(selectedId === inc.id ? null : inc.id)}
            />
          ))}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapView
            incidents={filtered}
            selectedId={selectedId}
            onSelectIncident={(id) => setSelectedId(id)}
          />

          {/* Incident detail overlay */}
          {selectedIncident && (
            <div className="absolute bottom-4 left-4 z-[1000]">
              <IncidentDetail incident={selectedIncident} onClose={() => setSelectedId(null)} />
            </div>
          )}

          {/* Map overlay info */}
          <div className="absolute top-3 left-3 z-[1000] bg-card/90 backdrop-blur border border-border rounded-md px-3 py-1.5">
            <span className="text-[10px] font-mono text-muted-foreground">
              STOCKHOLM • {filtered.length} HÄNDELSER • <span className="text-cr-red">{activeCount} AKTIVA</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
