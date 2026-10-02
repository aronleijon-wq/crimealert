import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import {
  MessageSquarePlus, MapPin, Send, Trash2, ChevronDown, ChevronUp,
  Clock, CheckCircle2, AlertTriangle, Loader2, Navigation, X,
  Search, ImagePlus, Camera
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';


type Report = {
  id: string;
  category: string;
  title: string;
  description: string;
  area: string | null;
  status: string;
  created_at: string;
  image_url?: string | null;
  isOwn?: boolean;
};

const CATEGORIES = [
  { value: 'broken_lighting', label: 'Trasig belysning', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', dot: 'bg-amber-500' },
  { value: 'vandalism', label: 'Skadegörelse', color: 'bg-red-500/10 text-red-500 border-red-500/20', dot: 'bg-red-500' },
  { value: 'unsafe_area', label: 'Otrygg plats', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', dot: 'bg-orange-500' },
  { value: 'suspicious_activity', label: 'Misstänkt aktivitet', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20', dot: 'bg-purple-500' },
  { value: 'other', label: 'Övrigt', color: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
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

type AddressSuggestion = { display_name: string; lat: string; lon: string };

export default function CommunityReports() {
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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
  const [locMode, setLocMode] = useState<'gps' | 'address'>('gps');

  // Address search state
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const addressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getMyLocation = () => {
    if (!navigator.geolocation) { setGeoError('Geolokalisering stöds inte'); return; }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setGeoLoading(false); setSelectedAddress(null); },
      () => { setGeoError('Kunde inte hämta position'); setGeoLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Address search with debounce
  const searchAddress = (query: string) => {
    setAddressQuery(query);
    setSelectedAddress(null);
    if (addressTimeout.current) clearTimeout(addressTimeout.current);
    if (query.length < 3) { setAddressResults([]); return; }

    addressTimeout.current = setTimeout(async () => {
      setAddressLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=se&limit=5&q=${encodeURIComponent(query)}`,
          { headers: { 'Accept-Language': 'sv' } }
        );
        const data: AddressSuggestion[] = await res.json();
        setAddressResults(data);
      } catch {
        setAddressResults([]);
      }
      setAddressLoading(false);
    }, 400);
  };

  const selectAddress = (addr: AddressSuggestion) => {
    setLat(parseFloat(addr.lat));
    setLng(parseFloat(addr.lon));
    setSelectedAddress(addr.display_name);
    setAddressQuery(addr.display_name);
    setAddressResults([]);
    // Auto-fill area from address
    const parts = addr.display_name.split(',');
    if (parts.length >= 2 && !area) {
      setArea(parts.slice(0, 2).map(s => s.trim()).join(', '));
    }
  };

  // Image handling
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setGeoError('Bilden får vara max 5 MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setGeoError('Endast bildfiler tillåtna');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;
    const ext = imageFile.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('community-reports')
      .upload(path, imageFile, { contentType: imageFile.type });
    if (error) return null;
    const { data: urlData } = supabase.storage
      .from('community-reports')
      .getPublicUrl(path);
    return urlData.publicUrl;
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
      ownIds = (ownData ?? []).map((r) => r.id);
    }

    setReports((publicData as Report[])?.map((r) => ({ ...r, isOwn: ownIds.includes(r.id) })) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const resetForm = () => {
    setCategory(''); setTitle(''); setDescription(''); setArea('');
    setLat(null); setLng(null); setGeoError(null);
    setAddressQuery(''); setAddressResults([]); setSelectedAddress(null);
    removeImage();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !category || !title.trim() || !description.trim()) return;
    setSubmitting(true);

    let image_url: string | null = null;
    let imageFailed = false;
    if (imageFile) {
      image_url = await uploadImage();
      imageFailed = !image_url;
    }

    // Server-side function validates auth + Pro status before inserting.
    const { data, error } = await supabase.functions.invoke<{ id?: string; error?: string }>('submit-community-report', {
      body: {
        category,
        title: stripHtml(title).slice(0, 200),
        description: stripHtml(description).slice(0, 1000),
        area: stripHtml(area).slice(0, 200) || null,
        lat, lng,
        image_url,
      },
    });

    const serverError = data?.error;

    if (!error && !serverError) {
      resetForm();
      setShowForm(false);
      fetchReports();
      if (imageFailed) {
        toast.warning('Rapporten skickades, men bilden kunde inte laddas upp.');
      } else {
        toast.success('Rapporten är skickad.');
      }
    } else {
      let message = serverError ?? 'Kunde inte skicka rapporten. Försök igen.';
      const ctx = error?.context;
      if (!serverError && ctx?.json) {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch { /* keep fallback */ }
      }
      setGeoError(message);
      toast.error(message);
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
    <>
      <Card className="overflow-hidden border-border bg-card">
        {/* Header */}
        <CardHeader className="p-4 pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle className="text-sm font-bold tracking-tight">Medborgarrapporter</CardTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Lokal information från boende i området
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
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium border transition-all ${
                      activeFilter === c.value
                        ? c.color
                        : 'border-border text-muted-foreground hover:border-primary/20 hover:text-foreground'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {c.label} {count > 0 && <span className="opacity-60">{count}</span>}
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
                  className="w-full h-9 border-dashed border hover:border-primary/40 hover:bg-primary/5 group text-xs"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5 mr-2 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-muted-foreground group-hover:text-primary transition-colors">
                    Ny observation
                  </span>
                </Button>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-md border border-primary/20 bg-primary/[0.02]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-foreground tracking-tight">Ny observation</h3>
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
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-[11px] font-medium border transition-all ${
                            category === c.value
                              ? `${c.color} ring-1 ring-current/20`
                              : 'border-border text-muted-foreground hover:border-primary/30 hover:bg-muted/50'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
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

                  {/* Location - GPS or Address */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Plats
                    </label>

                    {/* Mode toggle */}
                    <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setLocMode('gps')}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition ${
                          locMode === 'gps'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Navigation className="w-3 h-3" /> GPS-position
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocMode('address')}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition ${
                          locMode === 'address'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Search className="w-3 h-3" /> Sök adress
                      </button>
                    </div>

                    {locMode === 'gps' ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={getMyLocation}
                          disabled={geoLoading}
                          className={`text-[11px] h-8 ${lat !== null && !selectedAddress ? 'border-green-500/30 bg-green-500/5 text-green-600' : ''}`}
                        >
                          {geoLoading ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Navigation className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          {lat !== null && !selectedAddress ? `${lat.toFixed(4)}, ${lng!.toFixed(4)}` : 'Använd min position'}
                        </Button>
                        {lat !== null && !selectedAddress && (
                          <button
                            type="button"
                            onClick={() => { setLat(null); setLng(null); }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input
                            value={addressQuery}
                            onChange={(e) => searchAddress(e.target.value)}
                            placeholder="Sök gata, plats eller adress..."
                            className="text-xs h-9 pl-8"
                          />
                          {addressLoading && (
                            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
                          )}
                        </div>

                        {/* Address results dropdown */}
                        {addressResults.length > 0 && !selectedAddress && (
                          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                            {addressResults.map((addr, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => selectAddress(addr)}
                                className="w-full text-left px-3 py-2.5 text-[11px] text-foreground hover:bg-muted/50 transition border-b border-border last:border-0 flex items-start gap-2"
                              >
                                <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{addr.display_name}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Selected address confirmation */}
                        {selectedAddress && (
                          <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            <span className="text-[10px] text-green-700 dark:text-green-400 line-clamp-1 flex-1">{selectedAddress}</span>
                            <button
                              type="button"
                              onClick={() => { setLat(null); setLng(null); setSelectedAddress(null); setAddressQuery(''); }}
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

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

                  {/* Image upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Bild <span className="text-muted-foreground/50 normal-case">(valfritt, max 5 MB)</span>
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageSelect}
                      className="hidden"
                    />

                    {!imagePreview ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] h-8"
                        >
                          <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                          Välj bild
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.removeAttribute('capture');
                              fileInputRef.current.click();
                              // Re-add capture for next time
                              setTimeout(() => fileInputRef.current?.setAttribute('capture', 'environment'), 100);
                            }
                          }}
                          className="text-[11px] h-8 sm:hidden"
                        >
                          <Camera className="w-3.5 h-3.5 mr-1.5" />
                          Ta foto
                        </Button>
                      </div>
                    ) : (
                      <div className="relative inline-block">
                        <img
                          src={imagePreview}
                          alt="Förhandsgranskning"
                          className="h-24 w-auto rounded-lg border border-border object-cover"
                        />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
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
                  {activeFilter ? 'Inga rapporter i vald kategori' : 'Inga rapporter ännu'}
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
                      className="group relative flex items-start gap-3 p-3 rounded-md border border-border hover:border-primary/20 hover:bg-muted/10 transition-all"
                    >
                      {/* Category marker */}
                      <div className={`w-1 h-10 rounded-full shrink-0 mt-0.5 ${cat?.dot ?? 'bg-muted-foreground'}`} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 justify-between">
                          <span className="text-xs font-semibold text-foreground leading-tight">
                            {r.title}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
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

                        {/* Report image thumbnail */}
                        {r.image_url && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(r.image_url!)}
                            className="mt-2 block"
                          >
                            <img
                              src={r.image_url}
                              alt="Rapportbild"
                              className="h-16 w-auto rounded-md border border-border object-cover hover:opacity-80 transition"
                              loading="lazy"
                            />
                          </button>
                        )}

                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/70">
                          {r.area && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" />{r.area}
                            </span>
                          )}
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />{timeAgo(r.created_at)}
                          </span>
                          <span className="hidden sm:inline">·</span>
                          <span className="hidden sm:inline text-[9px] uppercase tracking-wide">{cat?.label ?? r.category}</span>
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

      {/* Image lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
            onClick={() => setPreviewImage(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={previewImage}
            alt="Rapportbild"
            className="max-w-full max-h-[85vh] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
