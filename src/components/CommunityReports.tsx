import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import {
  MessageSquarePlus, MapPin, Send, Trash2, ChevronDown, ChevronUp,
  Clock, CheckCircle2, AlertTriangle, Loader2, Navigation, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

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
  { value: 'broken_lighting', label: 'Trasig belysning', icon: '💡', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  { value: 'vandalism', label: 'Skadegörelse', icon: '🔨', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  { value: 'unsafe_area', label: 'Otrygg plats', icon: '⚠️', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  { value: 'suspicious_activity', label: 'Misstänkt aktivitet', icon: '👁️', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  { value: 'other', label: 'Övrigt', icon: '📋', color: 'bg-muted text-muted-foreground border-border' },
] as const;

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

const stripHtml = (str: string) => str.replace(/<[^>]*>/g, '').trim();

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just nu';
  if (mins < 60) return `${mins} min sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h sedan`;
  return `${Math.floor(hours / 24)}d sedan`;
};

export default function CommunityReports() {
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Form state
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const getMyLocation = () => {
    if (!navigator.geolocation) { setGeoError('Geolokalisering stöds inte'); return; }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setGeoLoading(false); },
      () => { setGeoError('Kunde inte hämta position'); setGeoLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data: publicData } = await supabase
      .from('community_reports_public')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    let ownIds: string[] = [];
    if (user) {
      const { data: ownData } = await supabase
        .from('community_reports')
        .select('id')
        .eq('user_id', user.id);
      ownIds = (ownData ?? []).map((r: any) => r.id);
    }

    setReports((publicData as Report[])?.map((r) => ({ ...r, isOwn: ownIds.includes(r.id) })) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const resetForm = () => {
    setCategory(''); setTitle(''); setDescription(''); setArea('');
    setLat(null); setLng(null); setGeoError(null);
  };

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
      lat, lng,
      status: 'open'
    });
    if (!error) {
      resetForm();
      setShowForm(false);
      fetchReports();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('community_reports').delete().eq('id', id);
    setReports((prev) => prev.filter((r) => r.id !== id));
    setDeleteConfirm(null);
  };

  const filteredReports = activeFilter
    ? reports.filter((r) => r.category === activeFilter)
    : reports;

  const openCount = reports.filter((r) => r.status === 'open').length;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <CardHeader className="p-4 pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquarePlus className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">Medborgarrapporter</CardTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Rapportera otrygghet och händelser i ditt område
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {openCount > 0 && (
              <Badge variant="secondary" className="text-[9px] font-mono bg-destructive/10 text-destructive border-0">
                {openCount} öppna
              </Badge>
            )}
            <Badge variant="secondary" className="text-[9px] font-mono border-0">
              {reports.length} totalt
            </Badge>
            {expanded
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />
            }
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="p-4 pt-0 space-y-4">
          {/* Category filter chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveFilter(null)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
                !activeFilter
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'border-border text-muted-foreground hover:border-primary/20 hover:text-foreground'
              }`}
            >
              Alla
            </button>
            {CATEGORIES.map((c) => {
              const count = reports.filter((r) => r.category === c.value).length;
              return (
                <button
                  key={c.value}
                  onClick={() => setActiveFilter(activeFilter === c.value ? null : c.value)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
                    activeFilter === c.value
                      ? c.color
                      : 'border-border text-muted-foreground hover:border-primary/20 hover:text-foreground'
                  }`}
                >
                  {c.icon} {c.label} {count > 0 && <span className="opacity-60">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* New report CTA / form */}
          {user && isPremium ? (
            !showForm ? (
              <Button
                variant="outline"
                onClick={() => setShowForm(true)}
                className="w-full border-dashed border-2 hover:border-primary/40 hover:bg-primary/5 group"
              >
                <MessageSquarePlus className="w-4 h-4 mr-2 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  Skicka en ny rapport
                </span>
              </Button>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-xl border border-primary/20 bg-primary/[0.02]">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground">Ny rapport</h3>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); resetForm(); }}
                    className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Category selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Kategori
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategory(c.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-[11px] font-medium border transition-all ${
                          category === c.value
                            ? `${c.color} ring-1 ring-current/20`
                            : 'border-border text-muted-foreground hover:border-primary/30 hover:bg-muted/50'
                        }`}
                      >
                        <span className="text-sm">{c.icon}</span>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Rubrik
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    placeholder="Kort beskrivning av händelsen..."
                    required
                    className="text-xs h-9"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Beskrivning
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Beskriv vad du observerat..."
                    required
                    className="text-xs resize-none"
                  />
                  <p className="text-[9px] text-muted-foreground/60 text-right">{description.length}/1000</p>
                </div>

                {/* Location */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Plats
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={getMyLocation}
                      disabled={geoLoading}
                      className={`text-[11px] h-8 ${lat !== null ? 'border-green-500/30 bg-green-500/5 text-green-600' : ''}`}
                    >
                      {geoLoading ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Navigation className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {lat !== null ? `${lat.toFixed(4)}, ${lng!.toFixed(4)}` : 'Använd min position'}
                    </Button>
                    {lat !== null && (
                      <button
                        type="button"
                        onClick={() => { setLat(null); setLng(null); }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {geoError && (
                    <p className="text-[10px] text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {geoError}
                    </p>
                  )}
                </div>

                {/* Area */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Område <span className="text-muted-foreground/50 normal-case">(valfritt)</span>
                  </label>
                  <Input
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    maxLength={200}
                    placeholder="T.ex. Södermalm, Stockholm"
                    className="text-xs h-9"
                  />
                </div>

                {/* Submit */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting || !category || !title.trim() || !description.trim()}
                    className="text-xs"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {submitting ? 'Skickar...' : 'Skicka rapport'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowForm(false); resetForm(); }}
                    className="text-xs"
                  >
                    Avbryt
                  </Button>
                </div>
              </form>
            )
          ) : user && !isPremium ? (
            <div className="text-center py-4 px-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground">
                <a href="/account" className="text-primary hover:underline font-semibold">Uppgradera till Pro</a> för att skicka rapporter
              </p>
            </div>
          ) : (
            <div className="text-center py-4 px-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground">
                <a href="/auth" className="text-primary hover:underline font-semibold">Logga in</a> för att skicka rapporter
              </p>
            </div>
          )}

          {/* Reports list */}
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Laddar rapporter...</span>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                <MessageSquarePlus className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-xs text-muted-foreground">
                {activeFilter ? 'Inga rapporter i denna kategori' : 'Inga rapporter ännu — bli först!'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredReports.map((r) => {
                const cat = CATEGORY_MAP[r.category];
                const isOpen = r.status === 'open';
                return (
                  <div
                    key={r.id}
                    className="group relative flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/15 hover:bg-muted/20 transition-all"
                  >
                    {/* Category icon */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base ${cat?.color ?? 'bg-muted text-muted-foreground'}`}>
                      {cat?.icon ?? '📋'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground leading-tight">
                          {r.title}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                          isOpen
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-green-500/10 text-green-600'
                        }`}>
                          {isOpen
                            ? <><Clock className="w-2.5 h-2.5" /> Öppen</>
                            : <><CheckCircle2 className="w-2.5 h-2.5" /> Åtgärdad</>
                          }
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {r.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/70">
                        <Badge variant="outline" className="text-[9px] py-0 h-4 border-border">
                          {cat?.label ?? r.category}
                        </Badge>
                        {r.area && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />{r.area}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />{timeAgo(r.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Delete button for own reports */}
                    {r.isOwn && (
                      deleteConfirm === r.id ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => handleDelete(r.id)}
                          >
                            Ta bort
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Avbryt
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(r.id)}
                          className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
                          title="Ta bort"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
