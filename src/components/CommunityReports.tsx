import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquarePlus, AlertCircle, Lightbulb, Eye, MapPin, Send, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

type Report = {
  id: string;
  category: string;
  title: string;
  description: string;
  area: string | null;
  status: string;
  created_at: string;
  isOwn?: boolean;
};

const CATEGORIES = [
{ value: 'broken_lighting', label: 'Trasig gatubelysning', icon: '💡' },
{ value: 'vandalism', label: 'Skadegörelse', icon: '🔨' },
{ value: 'unsafe_area', label: 'Otrygg plats', icon: '⚠️' },
{ value: 'suspicious_activity', label: 'Misstänkt aktivitet', icon: '👁️' },
{ value: 'other', label: 'Övrigt', icon: '📋' }];


const CATEGORY_MAP: Record<string, typeof CATEGORIES[0]> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

const stripHtml = (str: string) => str.replace(/<[^>]*>/g, '').trim();

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} tim sedan`;
  return `${Math.floor(hours / 24)} dagar sedan`;
};

export default function CommunityReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const getMyLocation = () => {
    if (!navigator.geolocation) {setGeoError('Geolokalisering stöds inte');return;}
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {setLat(pos.coords.latitude);setLng(pos.coords.longitude);setGeoLoading(false);},
      () => {setGeoError('Kunde inte hämta position');setGeoLoading(false);},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data: publicData } = await supabase.
    from('community_reports_public').
    select('*').
    order('created_at', { ascending: false }).
    limit(20);

    // If logged in, fetch own report IDs for delete access
    let ownIds: string[] = [];
    if (user) {
      const { data: ownData } = await supabase.
      from('community_reports').
      select('id').
      eq('user_id', user.id);
      ownIds = (ownData ?? []).map((r: any) => r.id);
    }

    setReports((publicData as Report[])?.map((r) => ({ ...r, isOwn: ownIds.includes(r.id) })) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {fetchReports();}, [fetchReports]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !category || !title.trim() || !description.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('community_reports').insert({
      user_id: user.id,
      category,
      title: stripHtml(title).slice(0, 200),
      description: stripHtml(description).slice(0, 1000),
      area: stripHtml(area).slice(0, 200) || null,
      lat,
      lng,
      status: 'open'
    });
    if (!error) {
      setCategory('');setTitle('');setDescription('');setArea('');
      setLat(null);setLng(null);
      setShowForm(false);
      fetchReports();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('community_reports').delete().eq('id', id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between">
        
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Medborgarrapporter</h2>
          <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-mono">{reports.length}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <p className="text-[10px] text-muted-foreground mt-1">Rapportera otrygghet, trasig belysning eller annat brott som inte är med        </p>

      {expanded &&
      <div className="mt-4 space-y-4">
          {/* New report button / form */}
          {user ?
        !showForm ?
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary transition text-xs font-medium">
          
                <MessageSquarePlus className="w-4 h-4" />
                Skicka en rapport
              </button> :

        <form onSubmit={handleSubmit} className="space-y-3 p-3 rounded-lg border border-border bg-background">
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Kategori</label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {CATEGORIES.map((c) =>
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition ${
                category === c.value ?
                'border-primary bg-primary/10 text-primary' :
                'border-border text-muted-foreground hover:border-primary/30'}`
                }>
                
                        {c.icon} {c.label}
                      </button>
              )}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Rubrik</label>
                  <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Kort beskrivning..."
              className="w-full mt-1 px-3 py-2 bg-muted border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              required />
            
                </div>
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Beskrivning</label>
                  <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Beskriv vad du observerat..."
              className="w-full mt-1 px-3 py-2 bg-muted border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              required />
            
                </div>
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Plats</label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                type="button"
                onClick={getMyLocation}
                disabled={geoLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-medium border transition ${
                lat !== null ?
                'border-cr-green bg-cr-green/10 text-cr-green' :
                'border-border text-muted-foreground hover:border-primary/30'}`
                }>
                
                      <MapPin className="w-3.5 h-3.5" />
                      {geoLoading ? 'Hämtar...' : lat !== null ? `📍 ${lat.toFixed(4)}, ${lng!.toFixed(4)}` : 'Använd min position'}
                    </button>
                    {lat !== null &&
              <button type="button" onClick={() => {setLat(null);setLng(null);}} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
              }
                  </div>
                  {geoError && <p className="text-[10px] text-destructive mt-1">{geoError}</p>}
                </div>
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Område (valfritt)</label>
                  <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              maxLength={200}
              placeholder="T.ex. Södermalm, Stockholm"
              className="w-full mt-1 px-3 py-2 bg-muted border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
              type="submit"
              disabled={submitting || !category || !title.trim() || !description.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition disabled:opacity-50">
              
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? 'Skickar...' : 'Skicka'}
                  </button>
                  <button
              type="button"
              onClick={() => {setShowForm(false);setCategory('');setTitle('');setDescription('');setArea('');setLat(null);setLng(null);}}
              className="px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition">
              
                    Avbryt
                  </button>
                </div>
              </form> :


        <div className="text-center py-3 px-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">
                <a href="/auth" className="text-primary hover:underline font-medium">Logga in</a> för att skicka rapporter
              </p>
            </div>
        }

          {/* Reports list */}
          {loading ?
        <p className="text-xs text-muted-foreground text-center py-4">Laddar rapporter...</p> :
        reports.length === 0 ?
        <p className="text-xs text-muted-foreground text-center py-4">Inga rapporter ännu – bli först att rapportera!</p> :

        <div className="space-y-2">
              {reports.map((r) => {
            const cat = CATEGORY_MAP[r.category];
            return (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition">
                    <span className="text-lg mt-0.5">{cat?.icon ?? '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">{r.title}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${
                    r.status === 'open' ? 'bg-cr-orange/15 text-cr-orange' : 'bg-cr-green/15 text-cr-green'}`
                    }>
                          {r.status === 'open' ? 'Öppen' : 'Åtgärdad'}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                        <span>{cat?.label ?? r.category}</span>
                        {r.area && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{r.area}</span>}
                        <span>{timeAgo(r.created_at)}</span>
                      </div>
                    </div>
                    {r.isOwn &&
                <button
                  onClick={() => handleDelete(r.id)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                  title="Ta bort">
                  
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                }
                  </div>);

          })}
            </div>
        }
        </div>
      }
    </div>);

}