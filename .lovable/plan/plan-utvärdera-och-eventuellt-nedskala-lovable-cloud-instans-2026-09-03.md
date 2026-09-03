Plan: Utvärdera och eventuellt nedskala Lovable Cloud-instansen

Rekommendation: Minska från Small till Mini nu, men med tydlig bevakning av trafik och svarstider.

Varför det är rimligt just nu
- Nuvarande instans: Small.
- Aktuell belastning är låg: 35/90 databasanslutningar, 38 % minnesanvändning, 2 % disk.
- Backenden svarar normalt (auth ~14 ms, databas ~17 ms).
- Kreditläget är åtstramat: 29,93 credits kvar av perioden (löper till 21 sep) och 5 credits/dag kvar i daglig grant. Small bränner uppskattningsvis 30–45 credits/månad bara i compute, vilket lätt äter upp det som finns kvar om övriga kostnader (byggen, edge-anrop) fortsätter.

Risker att beakta
- Du sa tidigare att du vill klara 30–50 besökare per dag. Mini klarar lägre samtidighet än Small.
- Om trafiken plötsligt sticker iväg eller edge-funktionerna får tunga jobb kan du behöva skala upp igen.

Steg vi tar
1. Nedskala Lovable Cloud-instansen från Small till Mini.
2. Vänta på att status blir ACTIVE_HEALTHY.
3. Köra en snabb hälsokontroll (anslutningar, minne, edge-funktioner).
4. Sätta upp en enkel bevakning: vi kollar credits och db-health igen om 48 timmar.
5. Om hälsan är god och trafiken känns snabb i preview/publicerad app, låter vi den ligga på Mini. Annars skalar vi tillbaka till Small.

Teknisk detalj
- Mini är den minsta betalda compute-storleken. Den passar låg till måttlig trafik och små databaser (nu ~84 MB).
- Vi ändrar inte diskstorlek, endast CPU/RAM/pooler.
- Ingen kodändring krävs; endast backend-resize.
