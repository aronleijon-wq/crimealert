// The guides under /guider: plain-language help on following what happens where you live. Links in
// the text are written [like this](/karta); internal ones open in the app.

export interface GuideSection {
  heading: string;
  text?: string[];
  list?: string[];
}

export interface Guide {
  slug: string;
  title: string;
  /** For search results and the guide list */
  description: string;
  intro: string;
  sections: GuideSection[];
  updated: string;
}

export const GUIDES: Guide[] = [
  {
    slug: 'se-vad-som-hant-i-ditt-omrade',
    title: 'Så ser du vad som har hänt i ditt område',
    description: 'Steg för steg: så hittar du Polisens händelser där du bor, på kartan, per kommun och som notiser i mobilen eller datorn.',
    intro:
      'Har du hört sirener, sett blåljus eller vill du bara veta vad som händer där du bor? Polisen berättar om många av sina insatser i korta händelsenotiser. Så här hittar du dem snabbt.',
    sections: [
      {
        heading: '1. Öppna kartan',
        text: ['På [kartan](/karta) visas Polisens senaste händelser i hela Sverige. Zooma in där du bor och tryck på en händelse för att läsa vad Polisen har skrivit. Kartan är gratis och kräver inget konto.'],
      },
      {
        heading: '2. Gå till din kommuns sida',
        text: [
          'Varje kommun har en egen sida med det som rapporterats det senaste dygnet och den senaste veckan, till exempel [Stockholm](/kommun/stockholm), [Göteborg](/kommun/goteborg) och [Malmö](/kommun/malmo). Hitta din bland [alla 290 kommuner](/kommun).',
          'På kommunens sida finns också månadsrapporter som visar hur många händelser det var under en månad och vilka som var vanligast.',
        ],
      },
      {
        heading: '3. Få en notis när något händer',
        text: ['Under [Notiser](/alerts) väljer du de kommuner du vill bevaka och slår på notiser i mobilen eller datorn. Med ett gratiskonto kommer notisen 15 minuter efter att Polisen publicerat händelsen, med Pro direkt.'],
      },
      {
        heading: '4. Läs hela notisen hos Polisen',
        text: ['Varje händelse har en länk till Polisens egen sida, där notisen kan ha uppdaterats med mer information.'],
      },
      {
        heading: 'Bra att veta',
        list: [
          'Polisens notiser är ett urval av insatserna, inte all brottslighet.',
          'Notiserna publiceras oftast inom några timmar efter händelsen, men det kan variera.',
          'Platsen anges ofta bara som kommun eller stadsdel, så markeringen på kartan är ungefärlig.',
          'Pågår ett brott eller är någon i fara: ring 112. Vill du anmäla något som redan har hänt eller lämna tips: ring 114 14 eller gå till polisen.se.',
        ],
      },
    ],
    updated: '2026-10-06',
  },
  {
    slug: 'polisens-handelsenotiser',
    title: 'Vad är Polisens händelsenotiser?',
    description: 'Vad Polisens händelsenotiser är, hur snabbt de publiceras, vad de visar och inte visar, och hur du läser dem rätt.',
    intro:
      'Polisen publicerar korta notiser om händelser som de har varit inblandade i, till exempel stölder, trafikolyckor och bränder. Det är de notiserna som CrimeAlert visar på kartan.',
    sections: [
      {
        heading: 'Vad står i en notis?',
        text: ['En notis har en tid, en typ av händelse och en plats, till exempel "6 oktober 02.14, Brand, Stockholm", och en kort sammanfattning. Ofta finns en längre text på polisen.se som uppdateras när Polisen vet mer.'],
      },
      {
        heading: 'Hur snabbt publiceras de?',
        text: ['Enligt Polisen publiceras notiserna oftast inom de närmaste timmarna efter att händelsen inträffat, men det varierar. Uppgifterna bygger på den första informationen och kan ändras senare.'],
      },
      {
        heading: 'Vad visar de inte?',
        text: [
          'Notiserna är ett urval. Polisen skriver inte om alla brott och inte om allt de gör, och många brott anmäls först i efterhand. Därför går det inte att använda notiserna som brottsstatistik.',
          'Statistik över alla anmälda brott, per kommun och år, publiceras av Brottsförebyggande rådet (Brå) på [bra.se](https://bra.se).',
        ],
      },
      {
        heading: 'Sammanfattningar',
        text: ['Ibland publicerar Polisen en sammanfattning av natten eller helgen i ett län. CrimeAlert visar dem, men räknar dem inte som egna händelser i statistiken.'],
      },
      {
        heading: 'Var kommer uppgifterna ifrån?',
        text: ['Polisen publicerar notiserna som öppna data, som vem som helst får använda om Polisen anges som källa. CrimeAlert hämtar dem löpande, placerar dem på [kartan](/karta) och sparar dem, så att du kan se utvecklingen över tid i månadsrapporterna på varje [kommunsida](/kommun).'],
      },
    ],
    updated: '2026-10-06',
  },
  {
    slug: 'skydda-hemmet-mot-inbrott',
    title: 'Så skyddar du hemmet mot inbrott',
    description: 'Enkla och beprövade sätt att göra det svårare för tjuven: lås, belysning, grannar, märkta värdesaker och vad du gör om något har hänt.',
    intro:
      'De flesta inbrott sker när ingen är hemma, och tjuven väljer gärna det som ser enkelt ut. Det mesta du kan göra handlar om att det ska se bebott ut och ta tid att ta sig in.',
    sections: [
      {
        heading: 'Lås och dörrar',
        list: [
          'Lås dörrar och fönster även när du bara går ut en kort stund.',
          'Ett bra lås och en säkerhetsdörr gör det svårare och tar längre tid. Kolla vad ditt försäkringsbolag kräver.',
          'Lämna inga nycklar under dörrmattan, i krukan eller i brevlådan.',
          'Ta in stegar, verktyg och trädgårdsmöbler som kan användas för att ta sig in.',
        ],
      },
      {
        heading: 'Låt det se bebott ut',
        list: [
          'Använd timer på några lampor när du är borta.',
          'Be en granne tömma brevlådan, ta in reklamen eller ställa bilen på din uppfart.',
          'Berätta inte i sociala medier att du är bortrest. Lägg hellre upp bilderna när du är hemma igen.',
        ],
      },
      {
        heading: 'Grannar och värdesaker',
        list: [
          'Grannsamverkan gör att fler håller utkik. Kontakta Polisen eller kommunen om du vill starta det där du bor.',
          'Märk värdesaker och spara serienummer och kvitton. Det gör det lättare att få tillbaka det som stulits och att få ersättning.',
          'Ett larm kan avskräcka, och vissa försäkringsbolag ger rabatt för det.',
        ],
      },
      {
        heading: 'Håll koll på området',
        text: ['Med CrimeAlert kan du [bevaka din kommun](/alerts) och få en notis när Polisen rapporterar inbrott eller andra händelser i närheten. Då vet du när det är extra viktigt att vara uppmärksam.'],
      },
      {
        heading: 'Om det har hänt',
        list: [
          'Pågår inbrottet: ring 112.',
          'Rör inget i onödan, så att Polisen kan säkra spår.',
          'Anmäl inbrottet till Polisen på polisen.se eller på 114 14.',
          'Kontakta ditt försäkringsbolag med polisanmälan och en lista över det som saknas.',
        ],
      },
    ],
    updated: '2026-10-06',
  },
  {
    slug: 'kolla-omradet-innan-du-flyttar',
    title: 'Så kollar du ett område innan du flyttar',
    description: 'Fem sätt att få en bild av tryggheten i ett område innan du köper eller hyr: Polisens händelser, Brå:s statistik, ett kvällsbesök och grannarna.',
    intro:
      'Läget är det svåraste att ändra efter en flytt. Så här skaffar du dig en egen bild av ett område, utan att lita på rykten.',
    sections: [
      {
        heading: '1. Se vad Polisen har rapporterat',
        text: [
          'Kommunens sida på CrimeAlert visar det senaste dygnet och den senaste veckan, och månadsrapporterna visar hur en hel månad har sett ut. Hitta kommunen bland [alla kommuner](/kommun).',
          'Med [Pro](/prisplan) kan du spola tillbaka 60 dagar på kartan, se var det händer mest som värmekarta och få statistik per kommun.',
        ],
      },
      {
        heading: '2. Jämför med Brå:s statistik',
        text: ['Brottsförebyggande rådet (Brå) publicerar antalet anmälda brott per kommun. I Nationella trygghetsundersökningen (NTU) berättar Brå också hur trygga människor känner sig och hur många som säger att de har utsatts för brott. Båda finns på [bra.se](https://bra.se).'],
      },
      {
        heading: '3. Tänk på hur många som rör sig där',
        text: ['En stadskärna med butiker, krogar och resenärer får fler händelser än ett bostadsområde, utan att det behöver vara otryggare att bo där. Jämför därför liknande områden med varandra och titta på vilka slags händelser det handlar om.'],
      },
      {
        heading: '4. Besök området på kvällen',
        text: ['Gå runt en vardagskväll och en helgkväll. Hur ser det ut vid busshållplatsen, i trappuppgången och på vägen hem från stationen?'],
      },
      {
        heading: '5. Fråga dem som bor där',
        text: ['Grannar, bostadsrättsföreningen och lokala grupper i sociala medier vet ofta mer än statistiken. Fråga också om det finns grannsamverkan.'],
      },
    ],
    updated: '2026-10-06',
  },
  {
    slug: 'polisens-handelsetyper',
    title: 'Polisens händelsetyper – vad betyder de?',
    description: 'Ofredande, olaga hot, rån eller rattfylleri? Så betyder de vanligaste rubrikerna i Polisens händelsenotiser, förklarade med vanliga ord.',
    intro:
      'Varje händelsenotis från Polisen börjar med en rubrik som talar om vilken sorts händelse det gäller. Många av rubrikerna är juridiska begrepp som inte är självklara. Här förklarar vi de vanligaste med vardagliga ord.',
    sections: [
      {
        heading: 'Brott mot en person',
        list: [
          'Misshandel: någon har orsakat en annan person kroppsskada, sjukdom eller smärta, till exempel med slag eller sparkar.',
          'Olaga hot: någon har hotat en annan med ett brott på ett sätt som kan få den hotade att allvarligt frukta för sin eller någon annans säkerhet.',
          'Ofredande: någon har antastat en annan fysiskt, eller stört någon genom hänsynslöst beteende, till exempel genom att knuffa, ringa gång på gång eller skicka obehagliga meddelanden.',
          'Rån: en stöld där gärningspersonen använder våld eller hotar med våld, till exempel när någon tvingas lämna ifrån sig sin telefon eller plånbok.',
          'Mord/dråp och försök till mord/dråp: Polisen utreder om någon har dödats eller om någon har försökt döda en annan. Rubriken är Polisens första bedömning, inte en dom.',
        ],
      },
      {
        heading: 'Stölder, inbrott och skadegörelse',
        list: [
          'Stöld: någon har tagit något som tillhör någon annan, till exempel i en butik, ur en bil eller en cykel som stått utanför.',
          'Inbrott: någon har tagit sig in i en bostad, ett förråd, en bil eller en lokal för att stjäla. Står det "försök" kom gärningspersonen inte in eller fick inte med sig något.',
          'Skadegörelse: någon har förstört eller skadat något som tillhör någon annan, till exempel krossade rutor, klotter eller sönderslagna bilar.',
          'Bedrägeri: någon har lurats att lämna ifrån sig pengar, varor eller uppgifter, ofta via telefon, sms eller nätet. Läs mer i guiden om [hur du skyddar dig mot bedrägerier](/guider/skydda-dig-mot-bedragerier).',
        ],
      },
      {
        heading: 'Trafik',
        list: [
          'Trafikolycka: en olycka på väg eller gata. Tillägg som "personskada", "singel" eller "vilt" berättar att någon har skadats, att bara ett fordon var inblandat eller att ett djur blev påkört.',
          'Rattfylleri: någon har kört med minst 0,2 promille alkohol i blodet, eller med narkotika i kroppen. Med 1,0 promille eller mer, eller om föraren är avsevärt påverkad, räknas det som grovt rattfylleri.',
          'Trafikkontroll: Polisen har kontrollerat förare, till exempel deras nykterhet eller hastighet. Notisen berättar ofta hur många som kontrollerades och hur många som misstänks för brott.',
        ],
      },
      {
        heading: 'Bränder, larm och insatser',
        list: [
          'Brand: Polisen har varit på plats vid en brand, ofta tillsammans med räddningstjänsten. Det kan vara allt från en brinnande container till en husbrand.',
          'Skottlossning och explosion: Polisen har fått larm om skott eller en detonation. I början vet Polisen sällan om någon har skadats, så notisen uppdateras ofta när mer är känt.',
          'Försvunnen person: Polisen söker efter någon. Ibland ber Polisen allmänheten om tips.',
          'Polisinsats/kommendering: en planerad insats, till exempel vid en fotbollsmatch, en demonstration eller ett större evenemang.',
          'Sammanfattning: en översikt över flera händelser i ett län under en natt, en kväll eller en helg. CrimeAlert visar sammanfattningarna men räknar dem inte som egna händelser.',
        ],
      },
      {
        heading: 'Vad rubriken inte säger',
        text: [
          'Rubriken är Polisens första bedömning av vad som har hänt. En notis med rubriken "Misshandel" betyder inte att någon har dömts för misshandel, och en händelse kan bedömas annorlunda när Polisen vet mer.',
          'Läs därför hela notisen hos Polisen, där texten ofta uppdateras. Vill du veta mer om hur notiserna fungerar finns guiden [Vad är Polisens händelsenotiser?](/guider/polisens-handelsenotiser). Alla händelser i hela landet hittar du på [kartan](/karta).',
        ],
      },
    ],
    updated: '2026-10-12',
  },
  {
    slug: 'skydda-dig-mot-bedragerier',
    title: 'Så skyddar du dig mot bedrägerier',
    description: 'Falska poliser, bankbedragare och sms med länkar: så känner du igen de vanligaste bedrägerierna och så gör du om du har blivit lurad.',
    intro:
      'Bedragare ringer, sms:ar och mejlar och utger sig ofta för att vara banken, Polisen eller ett känt företag. Gemensamt för nästan alla upplägg är att du ska stressas att göra något direkt. Det bästa skyddet är att känna igen knepen och att aldrig låta dig skyndas.',
    sections: [
      {
        heading: 'Det här gör banken och Polisen aldrig',
        list: [
          'Ber dig legitimera dig eller skriva under med BankID för att "stoppa" en betalning eller "skydda" ditt konto.',
          'Frågar efter dina koder, lösenord eller kortuppgifter i telefon, sms eller mejl.',
          'Ber dig flytta pengar till ett "säkert konto".',
          'Skickar någon hem till dig för att hämta kort, kontanter eller smycken.',
        ],
      },
      {
        heading: 'Vanliga upplägg',
        list: [
          'Falska samtal från banken eller Polisen: någon påstår att ditt konto är i fara och ber dig öppna BankID. I själva verket loggar bedragaren in på ditt konto.',
          'Sms och mejl med länkar: ett paket väntar, en räkning är obetald eller ett konto ska spärras. Länken leder till en falsk sida som samlar in dina uppgifter.',
          '"Hej mamma" eller "hej pappa": någon skriver att de är ditt barn med ett nytt nummer och behöver pengar snabbt.',
          'Köp och sälj: motparten vill att du betalar eller tar emot pengar via en länk de skickar, eller visar en falsk betalningsbekräftelse.',
          'Investeringar: annonser där kända personer sägs ha blivit rika snabbt, och som lovar hög avkastning utan risk.',
        ],
      },
      {
        heading: 'Så skyddar du dig',
        list: [
          'Lägg på om du blir osäker. Ring sedan upp banken själv på numret som står på bankens webbplats eller på ditt kort.',
          'Klicka inte på länkar i oväntade sms och mejl. Gå in på tjänsten själv i stället, i appen eller genom att skriva adressen.',
          'Läs alltid vad som står i BankID-appen innan du legitimerar dig eller skriver under. Öppna aldrig BankID för att någon i telefon ber dig om det.',
          'Prata med äldre släktingar och grannar om de vanligaste knepen. Bedragare ringer ofta till äldre.',
        ],
      },
      {
        heading: 'Om du har blivit lurad',
        list: [
          'Ring din bank direkt och be dem spärra kort, konton och BankID. Bankerna har spärrtjänster som är öppna dygnet runt.',
          'Pågår bedrägeriet just nu, till exempel om någon är på väg hem till dig för att hämta saker: ring 112.',
          'Polisanmäl på polisen.se eller på 114 14. Spara sms, mejl, telefonnummer och kontonummer som bedragaren använde. Läs mer i guiden [Så polisanmäler du ett brott](/guider/sa-polisanmaler-du-ett-brott).',
          'Skäms inte. Bedragarna är skickliga och vem som helst kan bli lurad. Ju snabbare du berättar, desto större chans att stoppa pengarna.',
        ],
      },
      {
        heading: 'Håll koll i ditt område',
        text: ['Polisen skriver ibland om bedrägeriförsök i ett område, till exempel när falska poliser har ringt runt till äldre. Med CrimeAlert kan du [bevaka din kommun](/alerts) och se sådana notiser på [kartan](/karta).'],
      },
    ],
    updated: '2026-10-12',
  },
  {
    slug: 'vma-och-hesa-fredrik',
    title: 'VMA och Hesa Fredrik – så fungerar varningarna',
    description: 'Vad ett VMA är, hur signalerna från Hesa Fredrik låter, när de testas och vad du ska göra när du hör varningen.',
    intro:
      'VMA, Viktigt meddelande till allmänheten, används när många människor snabbt behöver varnas, till exempel vid en brand med giftig rök, ett gasutsläpp eller förorenat dricksvatten. Varningen kan komma via radio och tv, på krisinformation.se och genom utomhussignalen som kallas Hesa Fredrik.',
    sections: [
      {
        heading: 'Så låter signalerna',
        list: [
          'Viktigt meddelande: 7 sekunder ljud och 14 sekunder tystnad, om och om igen i minst 2 minuter.',
          'Faran över: en sammanhängande signal i 30 sekunder.',
          'Beredskapslarm: 30 sekunder ljud och 15 sekunder tystnad i minst 5 minuter. Signalen används om Sverige hamnar i höjd beredskap.',
        ],
      },
      {
        heading: 'Testerna fyra gånger om året',
        text: ['Signalen Viktigt meddelande testas klockan 15.00 den första helgfria måndagen i mars, juni, september och december. Hör du signalen då är det ett test och du behöver inte göra något.'],
      },
      {
        heading: 'Det här gör du när du hör signalen',
        list: [
          'Gå inomhus.',
          'Stäng dörrar, fönster och ventilation.',
          'Lyssna på Sveriges Radio P4 eller gå in på krisinformation.se för att få veta vad som har hänt och hur du ska göra.',
          'Ring inte 112 för att fråga om varningen. Numret behövs till dem som är i nöd. Vill du ha information om en olycka eller kris kan du ringa 113 13.',
        ],
      },
      {
        heading: 'VMA på CrimeAlert',
        text: ['När ett VMA är aktivt visas det överst i [flödet](/flode) och på [kartan](/karta), tillsammans med Polisens händelser i området. Följ alltid myndigheternas instruktioner i själva meddelandet.'],
      },
    ],
    updated: '2026-10-12',
  },
  {
    slug: 'ringa-112-eller-114-14',
    title: 'När ska du ringa 112 och när 114 14?',
    description: 'Skillnaden mellan 112, 114 14, 1177 och 113 13, och vad du ska säga när du ringer larmnumret.',
    intro:
      'I Sverige finns ett nummer för nödsituationer och flera för allt annat. Att ringa rätt gör att hjälpen kommer snabbare, både till dig och till andra som behöver den.',
    sections: [
      {
        heading: 'Ring 112 när det är bråttom',
        text: ['112 är numret när det är fara för liv, hälsa, egendom eller miljö: ett brott pågår just nu, någon är allvarligt skadad eller sjuk, det brinner eller du har sett en allvarlig olycka. Samtalet är gratis.'],
      },
      {
        heading: 'Ring 114 14 när det inte är akut',
        text: ['114 14 är Polisens nummer för allt som inte är akut: att anmäla ett brott som redan har hänt, lämna tips eller ställa en fråga. Ringer du från utlandet är numret +46 77 114 14 00.'],
      },
      {
        heading: 'Andra bra nummer',
        list: [
          '1177: råd om vård och var du ska vända dig när det inte är akut.',
          '113 13: information om olyckor och kriser, till exempel vid ett VMA. Läs mer i guiden om [VMA och Hesa Fredrik](/guider/vma-och-hesa-fredrik).',
        ],
      },
      {
        heading: 'Det här ska du berätta när du ringer 112',
        list: [
          'Vad som har hänt.',
          'Var det har hänt: adress, ort eller något som syns i närheten om du inte vet adressen.',
          'Hur många som är skadade eller i fara.',
          'Ditt namn och det nummer du ringer från.',
          'Följ operatörens frågor och instruktioner, och lägg inte på förrän du blir ombedd.',
        ],
      },
      {
        heading: 'Om du inte kan prata',
        text: ['Har du en hörsel- eller talnedsättning kan du registrera dig för att kunna skicka sms till 112. Det måste göras i förväg, så gör det redan nu om det gäller dig eller någon i din närhet.'],
      },
      {
        heading: 'Efteråt',
        text: ['Har du sett eller varit med om ett brott kan du följa vad Polisen rapporterar i området på [kartan](/karta). Ibland ber Polisen om tips i sina notiser, och då är 114 14 rätt nummer.'],
      },
    ],
    updated: '2026-10-12',
  },
  {
    slug: 'sa-polisanmaler-du-ett-brott',
    title: 'Så polisanmäler du ett brott',
    description: 'Var du anmäler, vad du ska ha med dig och vad som händer sedan, för stöld, skadegörelse, bedrägeri och andra brott.',
    intro:
      'En polisanmälan behövs för att Polisen ska kunna utreda ett brott, och för att du ska få ersättning från försäkringen. Den gör också att Polisen ser var och när brott sker. Så här går det till.',
    sections: [
      {
        heading: 'Tre sätt att anmäla',
        list: [
          'På polisen.se: många vanliga brott, till exempel stöld, skadegörelse och vissa bedrägerier, kan anmälas direkt på nätet.',
          'Per telefon på 114 14.',
          'På en polisstation med öppen reception.',
          'Pågår brottet, eller är någon i fara: ring 112 i stället.',
        ],
      },
      {
        heading: 'Det här är bra att ha till hands',
        list: [
          'När och var brottet hände, så noga du kan.',
          'Vad som hände, med dina egna ord.',
          'Hur gärningspersonen såg ut, om du såg någon: längd, kläder, fordon eller registreringsnummer.',
          'Vad som har stulits eller skadats, gärna med serienummer, kvitton och bilder.',
          'Namn och kontaktuppgifter till vittnen.',
        ],
      },
      {
        heading: 'Vad händer sedan?',
        text: [
          'Du får ett kvitto på anmälan med ett diarienummer. Spara det, eftersom försäkringsbolaget ofta vill ha numret.',
          'Polisen bedömer sedan om det finns förutsättningar att utreda brottet. Saknas spår, vittnen eller bilder läggs många ärenden ner. Anmälan är ändå viktig: den behövs för försäkringen och om nya uppgifter kommer fram senare.',
        ],
      },
      {
        heading: 'Stöd om du har utsatts',
        text: ['Att utsättas för brott kan kännas jobbigt även när det gäller saker. Brottsofferjouren ger kostnadsfritt stöd och nås på 116 006.'],
      },
      {
        heading: 'Förebygg nästa gång',
        text: ['Har det varit inbrott eller stölder i ditt område kan du [bevaka din kommun](/alerts) på CrimeAlert och få en notis när Polisen rapporterar något nytt. Tips om hur du gör det svårare för tjuven finns i guiden [Så skyddar du hemmet mot inbrott](/guider/skydda-hemmet-mot-inbrott).'],
      },
    ],
    updated: '2026-10-12',
  },
];

export const guideBySlug = (slug: string | undefined) => GUIDES.find((g) => g.slug === slug) ?? null;

export type TextPart = string | { label: string; href: string };

/** "Se [kartan](/karta)." → ['Se ', { label: 'kartan', href: '/karta' }, '.'] */
export function parseLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ label: m[1], href: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** The text without link markup, for search engines and descriptions. */
export const plainText = (text: string) => parseLinks(text).map((p) => (typeof p === 'string' ? p : p.label)).join('');

/** A guide as a schema.org Article with breadcrumbs. */
export function guideJsonLd(guide: Guide): string {
  const url = `https://crimealert.se/guider/${guide.slug}`;
  return JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Guider', item: 'https://crimealert.se/guider' },
        { '@type': 'ListItem', position: 2, name: guide.title, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: guide.title,
      description: guide.description,
      inLanguage: 'sv-SE',
      datePublished: guide.updated,
      dateModified: guide.updated,
      author: { '@type': 'Organization', name: 'CrimeAlert', url: 'https://crimealert.se' },
      publisher: { '@type': 'Organization', name: 'CrimeAlert', logo: { '@type': 'ImageObject', url: 'https://crimealert.se/pwa-512x512.png' } },
      mainEntityOfPage: url,
    },
  ]);
}
