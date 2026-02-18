import { useState, useEffect } from 'react';
import { Incident, IncidentType, RiskLevel } from '@/data/mockIncidents';
import { useToast } from '@/hooks/use-toast';

export function usePoliceEvents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/police-events`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data?.success && data.data) {
        const mapped: Incident[] = data.data.map((e: any) => ({
          id: e.id,
          type: e.type as IncidentType,
          title: e.title,
          description: e.description,
          lat: e.lat,
          lng: e.lng,
          area: e.area,
          time: e.time,
          status: (e.status || 'active') as 'active' | 'resolved',
          risk: (e.risk || 'low') as RiskLevel,
          source: e.source,
          approximate: e.approximate || false,
        }));
        setIncidents(mapped);
      } else {
        throw new Error(data?.error || 'Failed to fetch events');
      }
    } catch (err: any) {
      console.error('Error fetching police events:', err);
      setError(err.message);
      toast({
        title: 'Kunde inte hämta data',
        description: 'Använder demo-data. Försök igen senare.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // Refresh every 5 minutes
    const interval = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { incidents, loading, error, refetch: fetchEvents };
}
