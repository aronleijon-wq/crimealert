// Names Polisen uses for places in the big cities that the gazetteer (places.ts, from
// OpenStreetMap) lacks or has under another name: squares, stations and what people call a
// district ("Vasastan", not "Vasastaden"). Same shape as places.ts: [name, lat, lng, kind],
// kind q for a square or station, s for a district. Looked up before the gazetteer.

export const LANDMARKS: Record<string, [string, number, number, string][]> = {
  Stockholm: [
    ['Vasastan', 59.3430, 18.0480, 's'],
    ['Odenplan', 59.3430, 18.0496, 'q'],
    ['Sankt Eriksplan', 59.3395, 18.0370, 'q'],
    ['Fridhemsplan', 59.3323, 18.0294, 'q'],
    ['Medborgarplatsen', 59.3143, 18.0736, 'q'],
    ['Mariatorget', 59.3170, 18.0635, 'q'],
    ['Slussen', 59.3197, 18.0717, 'q'],
    ['Skanstull', 59.3077, 18.0762, 'q'],
    ['Zinkensdamm', 59.3177, 18.0500, 'q'],
    ['Gullmarsplan', 59.2990, 18.0807, 'q'],
    ['T-Centralen', 59.3313, 18.0598, 'q'],
    // "T-Centralen" is read as "Centralen"
    ['Centralen', 59.3313, 18.0598, 'q'],
    ['Centralstationen', 59.3303, 18.0581, 'q'],
    ['Cityterminalen', 59.3318, 18.0560, 'q'],
    ['Hötorget', 59.3348, 18.0634, 'q'],
    ['Sergels torg', 59.3326, 18.0649, 'q'],
    ['Kungsträdgården', 59.3310, 18.0713, 'q'],
    ['Norrmalmstorg', 59.3335, 18.0743, 'q'],
    ['Östermalmstorg', 59.3350, 18.0780, 'q'],
    ['Karlaplan', 59.3385, 18.0906, 'q'],
    ['Gärdet', 59.3460, 18.1010, 's'],
    ['Hammarby sjöstad', 59.3040, 18.1040, 's'],
    ['Hammarby', 59.3040, 18.1040, 's'],
    ['Globen', 59.2936, 18.0833, 'q'],
    ['Telefonplan', 59.2984, 17.9970, 'q'],
    ['Thorildsplan', 59.3318, 18.0153, 'q'],
    ['Spånga', 59.3800, 17.9000, 's'],
    ['Hammarbyhamnen', 59.3035, 18.0900, 's'],
    ['Norra Hammarbyhamnen', 59.3065, 18.0910, 's'],
  ],
  Göteborg: [
    ['Avenyn', 57.6995, 11.9750, 'q'],
    ['Järntorget', 57.6997, 11.9530, 'q'],
    ['Brunnsparken', 57.7069, 11.9680, 'q'],
    ['Nordstan', 57.7080, 11.9680, 'q'],
    ['Centralstationen', 57.7090, 11.9730, 'q'],
    ['Centralen', 57.7090, 11.9730, 'q'],
    ['Heden', 57.7010, 11.9800, 'q'],
    ['Korsvägen', 57.6966, 11.9870, 'q'],
    ['Frölunda torg', 57.6530, 11.9110, 'q'],
    ['Hjalmar Brantingsplatsen', 57.7206, 11.9510, 'q'],
    ['Vasaplatsen', 57.6990, 11.9690, 'q'],
    ['Linnéplatsen', 57.6926, 11.9520, 'q'],
    ['Frölunda', 57.6530, 11.9110, 's'],
    ['Långedrag', 57.6720, 11.8550, 's'],
  ],
  Botkyrka: [
    ['Hallundaplan', 59.2440, 17.8250, 'q'],
  ],
  Sundsvall: [
    ['Stenstan', 62.3910, 17.3060, 's'],
    ['Njurunda', 62.2700, 17.3700, 's'],
  ],
  Luleå: [
    ['Skutviken', 65.5950, 22.1370, 's'],
  ],
  Västerås: [
    ['Lögarängen', 59.6040, 16.5420, 's'],
  ],
  Örebro: [
    // Örebro's own Södermalm, not the hamlet of the name 37 km north
    ['Södermalm', 59.2660, 15.2150, 's'],
  ],
  Malmö: [
    ['Triangeln', 55.5940, 13.0000, 'q'],
    ['Gustav Adolfs torg', 55.6035, 13.0000, 'q'],
    ['Stortorget', 55.6059, 12.9999, 'q'],
    ['Lilla torg', 55.6045, 12.9990, 'q'],
    ['Möllevångstorget', 55.5910, 13.0090, 'q'],
    ['Möllan', 55.5910, 13.0090, 's'],
    ['Centralstationen', 55.6090, 13.0000, 'q'],
    ['Centralen', 55.6090, 13.0000, 'q'],
    ['Värnhemstorget', 55.6040, 13.0170, 'q'],
  ],
  Uppsala: [
    ['Stora torget', 59.8586, 17.6389, 'q'],
    ['Centralstationen', 59.8580, 17.6460, 'q'],
  ],
};
