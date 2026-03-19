import Header from '@/components/Header';
import { Bell, MapPin, Clock, Plus, X, Search } from 'lucide-react';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { incidentTypeConfig } from '@/data/mockIncidents';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const SWEDISH_KOMMUNER = [
'Ale', 'Alingsås', 'Alvesta', 'Aneby', 'Arboga', 'Arjeplog', 'Arvidsjaur', 'Arvika', 'Askersund', 'Avesta',
'Bengtsfors', 'Berg', 'Bjurholm', 'Bjuv', 'Boden', 'Bollebygd', 'Bollnäs', 'Borgholm', 'Borlänge', 'Borås',
'Botkyrka', 'Boxholm', 'Bromölla', 'Bräcke', 'Burlöv', 'Båstad', 'Dals-Ed', 'Danderyd', 'Degerfors',
'Dorotea', 'Eda', 'Ekerö', 'Eksjö', 'Emmaboda', 'Enköping', 'Eskilstuna', 'Eslöv', 'Essunga',
'Fagersta', 'Falkenberg', 'Falköping', 'Falun', 'Filipstad', 'Finspång', 'Flen', 'Forshaga',
'Färgelanda', 'Gagnef', 'Gislaved', 'Gnesta', 'Gnosjö', 'Gotland', 'Grums', 'Grästorp',
'Gullspång', 'Gällivare', 'Gävle', 'Göteborg', 'Götene', 'Habo', 'Hagfors', 'Hallsberg',
'Hallstahammar', 'Halmstad', 'Hammarö', 'Haninge', 'Haparanda', 'Heby', 'Hedemora',
'Helsingborg', 'Herrljunga', 'Hjo', 'Hofors', 'Huddinge', 'Hudiksvall', 'Hultsfred',
'Hylte', 'Håbo', 'Hällefors', 'Härjedalen', 'Härnösand', 'Härryda', 'Hässleholm',
'Höganäs', 'Högsby', 'Hörby', 'Höör', 'Jokkmokk', 'Järfälla', 'Jönköping',
'Kalix', 'Kalmar', 'Karlsborg', 'Karlshamn', 'Karlskoga', 'Karlskrona', 'Karlstad',
'Katrineholm', 'Kil', 'Kinda', 'Kiruna', 'Klippan', 'Knivsta', 'Kramfors', 'Kristianstad',
'Kristinehamn', 'Krokom', 'Kumla', 'Kungsbacka', 'Kungsör', 'Kungälv', 'Kävlinge', 'Köping',
'Laholm', 'Landskrona', 'Laxå', 'Lekeberg', 'Leksand', 'Lerum', 'Lessebo', 'Lidingö',
'Lidköping', 'Lilla Edet', 'Lindesberg', 'Linköping', 'Ljungby', 'Ljusdal', 'Ljusnarsberg',
'Lomma', 'Ludvika', 'Luleå', 'Lund', 'Lycksele', 'Lysekil', 'Malmö', 'Malung-Sälen',
'Malå', 'Mariestad', 'Mark', 'Markaryd', 'Mellerud', 'Mjölby', 'Mora', 'Motala',
'Mullsjö', 'Munkedal', 'Munkfors', 'Mölndal', 'Mönsterås', 'Mörbylånga',
'Nacka', 'Nora', 'Norberg', 'Nordanstig', 'Nordmaling', 'Norrköping', 'Norrtälje',
'Norsjö', 'Nybro', 'Nykvarn', 'Nyköping', 'Nynäshamn', 'Nässjö', 'Ockelbo',
'Olofström', 'Orsa', 'Orust', 'Osby', 'Oskarshamn', 'Ovanåker', 'Oxelösund',
'Pajala', 'Partille', 'Perstorp', 'Piteå', 'Ragunda', 'Robertsfors', 'Ronneby',
'Rättvik', 'Sala', 'Salem', 'Sandviken', 'Sigtuna', 'Simrishamn', 'Sjöbo',
'Skara', 'Skellefteå', 'Skinnskatteberg', 'Skurup', 'Skövde', 'Smedjebacken',
'Sollefteå', 'Sollentuna', 'Solna', 'Sorsele', 'Sotenäs', 'Staffanstorp',
'Stenungsund', 'Stockholm', 'Storfors', 'Storuman', 'Strängnäs', 'Strömstad',
'Strömsund', 'Sundbyberg', 'Sundsvall', 'Sunne', 'Surahammar', 'Svalöv',
'Svedala', 'Svenljunga', 'Säffle', 'Säter', 'Sävsjö', 'Söderhamn', 'Söderköping',
'Södertälje', 'Sölvesborg', 'Tanum', 'Tibro', 'Tidaholm', 'Tierp', 'Timrå',
'Tingsryd', 'Tjörn', 'Tomelilla', 'Torsby', 'Torsås', 'Tranemo', 'Tranås',
'Trelleborg', 'Trollhättan', 'Trosa', 'Tyresö', 'Täby', 'Töreboda', 'Uddevalla',
'Ulricehamn', 'Umeå', 'Upplands Väsby', 'Upplands-Bro', 'Uppsala', 'Uppvidinge',
'Vadstena', 'Vaggeryd', 'Valdemarsvik', 'Vallentuna', 'Vansbro', 'Vara', 'Varberg',
'Vaxholm', 'Vellinge', 'Vetlanda', 'Vilhelmina', 'Vimmerby', 'Vindeln', 'Vingåker',
'Vårgårda', 'Vänersborg', 'Vännäs', 'Värmdö', 'Värnamo', 'Västervik', 'Västerås',
'Växjö', 'Ydre', 'Ystad', 'Åmål', 'Ånge', 'Åre', 'Årjäng', 'Åsele',
'Åstorp', 'Åtvidaberg', 'Älmhult', 'Älvdalen', 'Älvkarleby', 'Älvsbyn',
'Ängelholm', 'Öckerö', 'Ödeshög', 'Örebro', 'Örkelljunga', 'Örnsköldsvik',
'Östersund', 'Österåker', 'Östhammar', 'Östra Göinge', 'Överkalix', 'Övertorneå'];


const getTimeAgo = (time: string): string => {
  try {
    const diff = Date.now() - new Date(time).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min sedan`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h sedan`;
    return `${Math.floor(hours / 24)}d sedan`;
  } catch {return '';}
};

const Alerts = () => {
  const { incidents } = usePoliceEvents();
  const { isPremium, isLoggedIn } = useIsPremium();
  const { kommuner, loading, addKommun, removeKommun } = useNotificationPreferences();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const filteredKommuner = search.length >= 1 ?
  SWEDISH_KOMMUNER.filter((k) => k.toLowerCase().startsWith(search.toLowerCase())).slice(0, 8) :
  [];

  const handleAdd = async (kommun: string) => {
    if (kommuner.includes(kommun)) {
      toast({ title: 'Redan bevakad', description: `${kommun} finns redan i din lista.` });
      return;
    }
    const error = await addKommun(kommun);
    if (error) {
      toast({ title: 'Fel', description: 'Kunde inte lägga till kommun.', variant: 'destructive' });
    } else {
      toast({ title: 'Kommun tillagd', description: `Du bevakar nu ${kommun}.` });
    }
    setSearch('');
    setShowSearch(false);
  };

  const handleRemove = async (kommun: string) => {
    await removeKommun(kommun);
    toast({ title: 'Borttagen', description: `${kommun} borttagen från bevakning.` });
  };

  // Filter incidents that match watched kommuner
  const watchedIncidents = kommuner.length > 0 ?
  incidents.filter((inc) => kommuner.some((k) => inc.area.toLowerCase().includes(k.toLowerCase()))) :
  [];

  // Sort: watched kommun incidents first, then by time
  const sorted = [...incidents].sort((a, b) => {
    const aWatched = kommuner.some((k) => a.area.toLowerCase().includes(k.toLowerCase()));
    const bWatched = kommuner.some((k) => b.area.toLowerCase().includes(k.toLowerCase()));
    if (aWatched && !bWatched) return -1;
    if (!aWatched && bWatched) return 1;
    return new Date(b.time).getTime() - new Date(a.time).getTime();
  });
  const latest = sorted.slice(0, 12);

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-y-auto p-6 grid-overlay">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Notiser</h1>
            <p className="text-xs text-muted-foreground">Hantera dina bevakningsområden och notifikationer</p>
          </div>

          {/* Pro kommun notification section */}
          {isLoggedIn ?
          <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Bevakade kommuner</h2>
                    <p className="text-[10px] text-muted-foreground">Få notiser för händelser i valda kommuner</p>
                  </div>
                </div>
                <button
                onClick={() => setShowSearch(!showSearch)}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition">
                
                  <Plus className="w-3 h-3" /> Lägg till
                </button>
              </div>

              {/* Search input */}
              {showSearch &&
            <div className="relative mb-4">
                  <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
                    <Search className="w-3.5 h-3.5 text-muted-foreground" />
                    <input
                  type="text"
                  placeholder="Sök kommun..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
                  autoFocus />
                
                    <button onClick={() => {setShowSearch(false);setSearch('');}} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {filteredKommuner.length > 0 &&
              <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {filteredKommuner.map((k) =>
                <button
                  key={k}
                  onClick={() => handleAdd(k)}
                  className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted transition flex items-center justify-between">
                  
                          <span>{k}</span>
                          {kommuner.includes(k) && <span className="text-[10px] text-cr-green font-medium">Bevakad</span>}
                        </button>
                )}
                    </div>
              }
                  {search.length >= 1 && filteredKommuner.length === 0 &&
              <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-card border border-border rounded-md shadow-lg p-3">
                      <p className="text-xs text-muted-foreground text-center">Ingen kommun hittad</p>
                    </div>
              }
                </div>
            }

              {/* Active kommun list */}
              {kommuner.length > 0 ?
            <div className="flex flex-wrap gap-2">
                  {kommuner.map((k) =>
              <div
                key={k}
                className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5">
                
                      <MapPin className="w-3 h-3 text-primary" />
                      <span className="text-xs font-medium text-foreground">{k}</span>
                      <button
                  onClick={() => handleRemove(k)}
                  className="text-muted-foreground hover:text-cr-red transition ml-0.5">
                  
                        <X className="w-3 h-3" />
                      </button>
                    </div>
              )}
                </div> :

            <p className="text-xs text-muted-foreground text-center py-3">
                  Du bevakar inga kommuner ännu. Klicka "Lägg till" för att komma igång.
                </p>
            }

              {/* Incidents matching watched kommuner */}
              {watchedIncidents.length > 0 &&
            <div className="mt-4 pt-4 border-t border-border space-y-2">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    Händelser i bevakade kommuner
                  </span>
                  {watchedIncidents.slice(0, 10).map((inc) => {
                const typeConf = incidentTypeConfig[inc.type];
                return (
                  <div key={inc.id} className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${inc.risk === 'high' ? 'bg-cr-red' : inc.risk === 'medium' ? 'bg-cr-orange' : 'bg-cr-green'}`} />
                        <span className="text-sm">{typeConf.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-foreground block truncate">{inc.title.replace(/^\d+\s\w+\s[\d.]+,\s*/, '')}</span>
                          <span className="text-[10px] text-muted-foreground">{inc.area}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{getTimeAgo(inc.time)}</span>
                      </div>);

              })}
                </div>
            }
            </div> : (

          /* Free user CTA */
          <div className="bg-card border border-primary/20 rounded-lg p-5 text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-sm font-bold text-foreground mb-1">Bevaka ditt område</h2>
              <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
                Logga in för att bevaka kommuner och få notiser vid händelser i ditt område.
              </p>

              <button
              onClick={() => navigate('/auth?mode=login')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition">
              
                ​Skapa Konto 
              </button>
            </div>)
          }

          {/* Latest incidents */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Senaste händelser</span>
            {latest.map((inc) => {
              const typeConf = incidentTypeConfig[inc.type];
              const isWatched = kommuner.some((k) => inc.area.toLowerCase().includes(k.toLowerCase()));
              return (
                <div key={inc.id} className={`flex items-center gap-3 rounded-lg p-3 ${isWatched ? 'bg-primary/5 border border-primary/20' : 'bg-card border border-border'}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${inc.risk === 'high' ? 'bg-cr-red' : inc.risk === 'medium' ? 'bg-cr-orange' : 'bg-cr-green'}`} />
                  <span className="text-sm">{typeConf.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-foreground block truncate">{inc.title.replace(/^\d+\s\w+\s[\d.]+,\s*/, '')}</span>
                    <span className="text-[10px] text-muted-foreground">{inc.area}</span>
                  </div>
                  {isWatched && <MapPin className="w-3 h-3 text-primary shrink-0" />}
                  <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{getTimeAgo(inc.time)}</span>
                </div>);

            })}
          </div>
        </div>
      </div>
    </div>);

};

export default Alerts;