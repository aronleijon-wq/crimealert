Plan: Håll Lovable Cloud-instansen på Mini och bevaka så den räcker

Rekommendation
- Behåll Mini just nu. Belastningen är låg (25/60 anslutningar, 50 % minne, 2 % disk) och du har bara 18,30 credits kvar av perioden som går till 21 sep.
- Mini är den minsta betalda compute-storleken och kostar betydligt mindre än Small.

När vi ska agera
- Om db_health visar >45/60 anslutningar eller minne över 80 % vid flera kontroller i rad → skala upp till Small igen.
- Om map-laddning blir långsam eller edge-funktioner börjar ge 5xx-fel → skala upp till Small.
- Om trafiken över tid stabiliseras kring 30–50 besökare/dag med samtidiga användare → överväg Small.

Kostnadsbevakning
- Du har 5 credits/dag kvar i daglig grant och 13,30 credits kvar i billing-grant.
- Mini bör inte vara den stora kostnaden nu; byggen och edge-anrop är större faktorer att hålla öga på.
- Kolla credits igen om 3–5 dagar för att se trenden.

Inga kodändringar krävs.
