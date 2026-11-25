// More CrimeAlert widgets, each for hela Sverige or a kommun you choose:
// - Senaste händelser: the latest events, with what, where and when.
// - Lägesbild: the week in a kommun in a few sentences (situation_reports), as in the app.
// - Dagens vanligaste: what has happened most today, and how many events there have been.
// The events come from police-events, as on the website for those not signed in (15 minutes
// behind); the Lägesbild from situation-report, as in the app.
import AppIntents
import SwiftUI
import WidgetKit

let ORANGE = Color(red: 1.0, green: 0.62, blue: 0.04)
let YELLOW = Color(red: 1.0, green: 0.84, blue: 0.04)
let GREY = Color(white: 0.6)
let WHOLE_SWEDEN = "Hela Sverige"

// MARK: - Choosing the area: all of Sweden or one kommun

struct AreaEntity: AppEntity {
    let id: String

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Område"
    static let defaultQuery = AreaQuery()

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(id)") }
}

struct AreaQuery: EntityStringQuery {
    private var all: [String] { [WHOLE_SWEDEN] + KOMMUNER }

    func entities(for identifiers: [String]) async throws -> [AreaEntity] {
        identifiers.filter { all.contains($0) }.map { AreaEntity(id: $0) }
    }

    func entities(matching string: String) async throws -> [AreaEntity] {
        all.filter { $0.localizedCaseInsensitiveContains(string) }.map { AreaEntity(id: $0) }
    }

    func suggestedEntities() async throws -> [AreaEntity] {
        all.map { AreaEntity(id: $0) }
    }
}

struct SelectAreaIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Område"
    static let description = IntentDescription("Hela Sverige eller en kommun.")

    @Parameter(title: "Område")
    var area: AreaEntity?

    var areaName: String { area?.id ?? WHOLE_SWEDEN }
}

// MARK: - Polisen's events

struct WidgetEvent: Identifiable {
    let id: String
    let kind: String
    let place: String
    let type: String
    let date: Date?

    var color: Color {
        switch type {
        case "police": return RED
        case "fire": return ORANGE
        case "traffic": return YELLOW
        case "ambulance": return BLUE
        default: return GREY
        }
    }
}

private struct EventRow: Decodable {
    let id: String
    let type: String?
    let title: String?
    let area: String?
    let time: String?
    let originalType: String?
}

private struct EventsResponse: Decodable {
    let success: Bool?
    let data: [EventRow]?
}

/** Polisen's time, "2026-11-25 20:10:00 +01:00", or a plain ISO time */
func parseEventTime(_ value: String?) -> Date? {
    guard let value = value?.trimmingCharacters(in: .whitespaces), !value.isEmpty else { return nil }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    for format in ["yyyy-MM-dd H:mm:ss xxx", "yyyy-MM-dd HH:mm:ss xxx", "yyyy-MM-dd'T'HH:mm:ssXXXXX", "yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX"] {
        formatter.dateFormat = format
        if let date = formatter.date(from: value) { return date }
    }
    return nil
}

/** Whether an event's place is in the kommun ("Nacka", "Nacka kommun", "Stockholms län" for Stockholm) */
func inKommun(_ area: String, _ kommun: String) -> Bool {
    let a = area.lowercased(), k = kommun.lowercased()
    guard let range = a.range(of: k) else { return false }
    let before = range.lowerBound == a.startIndex ? nil : a[a.index(before: range.lowerBound)]
    let after = range.upperBound == a.endIndex ? nil : a[range.upperBound]
    let isLetter: (Character?) -> Bool = { $0?.isLetter ?? false }
    return !isLetter(before) && (!isLetter(after) || (after == "s" && !k.hasSuffix("s")))
}

func loadEvents(area: String) async -> [WidgetEvent]? {
    guard let url = URL(string: "\(SUPABASE_URL)/functions/v1/police-events") else { return nil }
    var request = URLRequest(url: url, timeoutInterval: 20)
    request.setValue("Bearer \(SUPABASE_KEY)", forHTTPHeaderField: "Authorization")
    request.setValue(SUPABASE_KEY, forHTTPHeaderField: "apikey")
    do {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
        let rows = try JSONDecoder().decode(EventsResponse.self, from: data).data ?? []
        return rows
            // Polisen's summaries are not events of their own
            .filter { !($0.originalType ?? "").lowercased().contains("sammanfattning") }
            .filter { area == WHOLE_SWEDEN || inKommun($0.area ?? "", area) }
            .map { row in
                let parts = (row.title ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
                let kind = row.originalType ?? (parts.count >= 2 ? parts[1] : "Händelse")
                return WidgetEvent(id: row.id, kind: kind, place: row.area ?? "", type: row.type ?? "other", date: parseEventTime(row.time))
            }
            .sorted { ($0.date ?? .distantPast) > ($1.date ?? .distantPast) }
    } catch {
        return nil
    }
}

private func ago(_ date: Date?, now: Date = Date()) -> String {
    guard let date = date else { return "" }
    let minutes = max(0, Int(now.timeIntervalSince(date) / 60))
    if minutes < 60 { return "\(minutes) min" }
    if minutes < 24 * 60 { return "\(minutes / 60) tim" }
    return "\(minutes / (24 * 60)) d"
}

private struct Header: View {
    let title: String
    let area: String
    var body: some View {
        HStack(spacing: 6) {
            Brand()
            Text(title.uppercased()).font(.system(size: 10, weight: .semibold)).foregroundStyle(.white.opacity(0.55))
            Spacer(minLength: 4)
            Text(area).font(.system(size: 11, weight: .semibold)).foregroundStyle(.white.opacity(0.8)).lineLimit(1)
        }
    }
}

// MARK: - Senaste händelser

struct EventsEntry: TimelineEntry {
    let date: Date
    let area: String
    let events: [WidgetEvent]?
}

struct EventsProvider: AppIntentTimelineProvider {
    static let sample = [
        WidgetEvent(id: "1", kind: "Brand", place: "Uppsala", type: "fire", date: Date().addingTimeInterval(-18 * 60)),
        WidgetEvent(id: "2", kind: "Trafikolycka", place: "Södertälje", type: "traffic", date: Date().addingTimeInterval(-26 * 60)),
        WidgetEvent(id: "3", kind: "Inbrott", place: "Lund", type: "police", date: Date().addingTimeInterval(-41 * 60)),
        WidgetEvent(id: "4", kind: "Rån", place: "Malmö", type: "police", date: Date().addingTimeInterval(-57 * 60)),
        WidgetEvent(id: "5", kind: "Misshandel", place: "Göteborg", type: "police", date: Date().addingTimeInterval(-73 * 60)),
        WidgetEvent(id: "6", kind: "Stöld", place: "Västerås", type: "police", date: Date().addingTimeInterval(-95 * 60)),
    ]

    func placeholder(in context: Context) -> EventsEntry {
        EventsEntry(date: Date(), area: WHOLE_SWEDEN, events: Self.sample)
    }

    func snapshot(for configuration: SelectAreaIntent, in context: Context) async -> EventsEntry {
        if context.isPreview { return EventsEntry(date: Date(), area: configuration.areaName, events: Self.sample) }
        return EventsEntry(date: Date(), area: configuration.areaName, events: await loadEvents(area: configuration.areaName))
    }

    func timeline(for configuration: SelectAreaIntent, in context: Context) async -> Timeline<EventsEntry> {
        let events = await loadEvents(area: configuration.areaName)
        let entry = EventsEntry(date: Date(), area: configuration.areaName, events: events)
        // Every quarter of an hour; sooner again when the fetch failed
        return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(events == nil ? 10 * 60 : 15 * 60)))
    }
}

struct LatestEventsView: View {
    @Environment(\.widgetFamily) private var family
    let entry: EventsEntry

    private var rows: Int { family == .systemLarge ? 7 : 3 }

    var body: some View {
        switch family {
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                if let first = entry.events?.first {
                    Text(first.kind).font(.headline).lineLimit(1)
                    Text(first.place).font(.subheadline).lineLimit(1)
                    Text("\(ago(first.date)) sedan").font(.caption).foregroundStyle(.secondary)
                } else {
                    Text(entry.area).font(.headline)
                    Text(entry.events == nil ? "Kunde inte hämta" : "Inget nytt").font(.caption)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .containerBackground(.clear, for: .widget)
        default:
            VStack(alignment: .leading, spacing: 8) {
                Header(title: "Senaste", area: entry.area)
                if let events = entry.events {
                    if events.isEmpty {
                        Spacer()
                        Text("Inget har hänt här idag än.").font(.system(size: 14)).foregroundStyle(.white.opacity(0.6))
                        Spacer()
                    } else {
                        ForEach(events.prefix(rows)) { event in
                            HStack(spacing: 10) {
                                Circle().fill(event.color).frame(width: 8, height: 8)
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(event.kind).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                                    Text(event.place).font(.system(size: 12)).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
                                }
                                Spacer(minLength: 4)
                                Text(ago(event.date)).font(.system(size: 12, weight: .medium)).foregroundStyle(.white.opacity(0.55)).monospacedDigit()
                            }
                        }
                        Spacer(minLength: 0)
                    }
                } else {
                    Spacer()
                    Text("Kunde inte hämta händelserna.").font(.system(size: 14)).foregroundStyle(.white.opacity(0.6))
                    Spacer()
                }
            }
            .containerBackground(BACKGROUND, for: .widget)
        }
    }
}

struct LatestEventsWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "CrimeAlertLatest", intent: SelectAreaIntent.self, provider: EventsProvider()) { entry in
            LatestEventsView(entry: entry)
        }
        .configurationDisplayName("Senaste händelser")
        .description("Polisens senaste händelser i hela Sverige eller i en kommun.")
        .supportedFamilies([.systemMedium, .systemLarge, .accessoryRectangular])
    }
}

// MARK: - Dagens vanligaste

struct TopTodayEntry: TimelineEntry {
    let date: Date
    let area: String
    let total: Int
    let top: [(String, Int)]
    let failed: Bool
}

func topToday(_ events: [WidgetEvent], now: Date = Date()) -> (Int, [(String, Int)]) {
    let today = dayString(now)
    let todays = events.filter { $0.date.map(dayString) == today }
    var kinds: [String: Int] = [:]
    for event in todays { kinds[event.kind, default: 0] += 1 }
    let top = kinds.sorted { $0.value > $1.value || ($0.value == $1.value && $0.key < $1.key) }.prefix(3).map { ($0.key, $0.value) }
    return (todays.count, top)
}

struct TopTodayProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> TopTodayEntry {
        TopTodayEntry(date: Date(), area: WHOLE_SWEDEN, total: 214, top: [("Trafikolycka", 38), ("Stöld", 21), ("Misshandel", 17)], failed: false)
    }

    func snapshot(for configuration: SelectAreaIntent, in context: Context) async -> TopTodayEntry {
        if context.isPreview { return placeholder(in: context) }
        return await entry(configuration.areaName)
    }

    func timeline(for configuration: SelectAreaIntent, in context: Context) async -> Timeline<TopTodayEntry> {
        let e = await entry(configuration.areaName)
        return Timeline(entries: [e], policy: .after(Date().addingTimeInterval(e.failed ? 10 * 60 : 30 * 60)))
    }

    private func entry(_ area: String) async -> TopTodayEntry {
        guard let events = await loadEvents(area: area) else {
            return TopTodayEntry(date: Date(), area: area, total: 0, top: [], failed: true)
        }
        let (total, top) = topToday(events)
        return TopTodayEntry(date: Date(), area: area, total: total, top: top, failed: false)
    }
}

struct TopTodayView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TopTodayEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            Text(entry.top.first.map { "Vanligast idag: \($0.0) (\($0.1))" } ?? "\(entry.area): inget idag")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text("Vanligast idag").font(.caption).foregroundStyle(.secondary)
                Text(entry.top.first?.0 ?? "–").font(.headline).lineLimit(1)
                Text("\(entry.total) händelser · \(entry.area)").font(.caption).lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .containerBackground(.clear, for: .widget)
        case .systemMedium:
            HStack(alignment: .top, spacing: 16) {
                small
                VStack(alignment: .leading, spacing: 6) {
                    Text("Topp idag").font(.system(size: 11, weight: .semibold)).foregroundStyle(.white.opacity(0.6))
                    ForEach(entry.top, id: \.0) { item in
                        HStack {
                            Text(item.0).font(.system(size: 13, weight: .medium)).foregroundStyle(.white).lineLimit(1)
                            Spacer(minLength: 4)
                            Text("\(item.1)").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.7))
                        }
                    }
                    Spacer(minLength: 0)
                    Text("\(entry.total) händelser idag").font(.system(size: 11)).foregroundStyle(.white.opacity(0.5))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .containerBackground(BACKGROUND, for: .widget)
        default:
            small.containerBackground(BACKGROUND, for: .widget)
        }
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 2) {
            Brand()
            Spacer(minLength: 4)
            Text("VANLIGAST IDAG").font(.system(size: 10, weight: .semibold)).foregroundStyle(RED)
            Text(entry.failed ? "–" : (entry.top.first?.0 ?? "Inget än"))
                .font(.system(size: 20, weight: .bold)).foregroundStyle(.white)
                .lineLimit(2).minimumScaleFactor(0.6)
            if let first = entry.top.first {
                Text("\(first.1) av \(entry.total) händelser").font(.system(size: 12)).foregroundStyle(.white.opacity(0.6))
            }
            Text(entry.area).font(.system(size: 11, weight: .semibold)).foregroundStyle(.white.opacity(0.5)).lineLimit(1).padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct TopTodayWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "CrimeAlertTopToday", intent: SelectAreaIntent.self, provider: TopTodayProvider()) { entry in
            TopTodayView(entry: entry)
        }
        .configurationDisplayName("Dagens vanligaste")
        .description("Det som hänt flest gånger idag, och hur många händelser det varit.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

// MARK: - Lägesbild

struct Situation {
    let kommun: String
    let summary: String
    let thisWeek: Int
    let lastWeek: Int
    let failed: Bool
}

private struct SituationRow: Decodable {
    let summary: String?
    let thisWeek: Int?
    let lastWeek: Int?
}

/** The kommun's Lägesbild from situation-report: the kept one, or a new one when it is over twelve hours old */
func loadSituation(_ kommun: String) async -> Situation {
    do {
        guard let url = URL(string: "\(SUPABASE_URL)/functions/v1/situation-report") else { throw URLError(.badURL) }
        var request = URLRequest(url: url, timeoutInterval: 30)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(SUPABASE_KEY)", forHTTPHeaderField: "Authorization")
        request.setValue(SUPABASE_KEY, forHTTPHeaderField: "apikey")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["kommun": kommun])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { throw URLError(.badServerResponse) }
        let row = try JSONDecoder().decode(SituationRow.self, from: data)
        guard let summary = row.summary else { throw URLError(.cannotParseResponse) }
        return Situation(kommun: kommun, summary: summary, thisWeek: row.thisWeek ?? 0, lastWeek: row.lastWeek ?? 0, failed: false)
    } catch {
        return Situation(kommun: kommun, summary: "", thisWeek: 0, lastWeek: 0, failed: true)
    }
}

struct SituationEntry: TimelineEntry {
    let date: Date
    let situation: Situation
}

struct SituationProvider: AppIntentTimelineProvider {
    static func sample(_ kommun: String) -> Situation {
        Situation(kommun: kommun, summary: "Polisen har rapporterat 38 händelser den senaste veckan, något fler än veckan innan. Trafikolyckorna dominerar, flera på E4. Det har också varit tre inbrott i villor under helgen.", thisWeek: 38, lastWeek: 31, failed: false)
    }

    func placeholder(in context: Context) -> SituationEntry {
        SituationEntry(date: Date(), situation: Self.sample("Uppsala"))
    }

    func snapshot(for configuration: SelectKommunIntent, in context: Context) async -> SituationEntry {
        if context.isPreview { return SituationEntry(date: Date(), situation: Self.sample(configuration.kommunName)) }
        return SituationEntry(date: Date(), situation: await loadSituation(configuration.kommunName))
    }

    func timeline(for configuration: SelectKommunIntent, in context: Context) async -> Timeline<SituationEntry> {
        let entry = SituationEntry(date: Date(), situation: await loadSituation(configuration.kommunName))
        // The text changes at most twice a day
        return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(entry.situation.failed ? 15 * 60 : 3 * 3600)))
    }
}

struct SituationView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SituationEntry

    var body: some View {
        let s = entry.situation
        VStack(alignment: .leading, spacing: 8) {
            Header(title: "Lägesbild", area: s.kommun)
            if s.failed {
                Spacer()
                Text("Kunde inte hämta lägesbilden.").font(.system(size: 14)).foregroundStyle(.white.opacity(0.6))
                Spacer()
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\(s.thisWeek)").font(.system(size: 26, weight: .bold)).foregroundStyle(.white)
                    Text("händelser senaste veckan").font(.system(size: 12)).foregroundStyle(.white.opacity(0.6))
                    Spacer(minLength: 0)
                    let diff = s.thisWeek - s.lastWeek
                    Text(diff == 0 ? "som förra" : diff > 0 ? "+\(diff)" : "\(diff)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(diff > 0 ? RED : GREEN)
                }
                Text(s.summary)
                    .font(.system(size: family == .systemLarge ? 15 : 13))
                    .foregroundStyle(.white.opacity(0.88))
                    .lineLimit(family == .systemLarge ? 12 : 4)
                Spacer(minLength: 0)
            }
        }
        .containerBackground(BACKGROUND, for: .widget)
    }
}

struct SituationWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "CrimeAlertSituation", intent: SelectKommunIntent.self, provider: SituationProvider()) { entry in
            SituationView(entry: entry)
        }
        .configurationDisplayName("Lägesbild")
        .description("Veckan i en kommun du väljer, i några meningar.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}
