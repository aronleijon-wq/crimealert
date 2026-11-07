// CrimeAlert's widget: today's events in a kommun you choose, against an ordinary day, on the
// home screen and the lock screen. It asks the database for the kommun's counts itself
// (kommun_month_counts, open to everyone), so it needs nothing from the app.
import AppIntents
import SwiftUI
import WidgetKit

private let SUPABASE_URL = "https://pqoiwiiydtikouzjrllx.supabase.co"
// The public key the website uses too; it only gives what anyone may read
private let SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxb2l3aWl5ZHRpa291empybGx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzQzMTEsImV4cCI6MjA4NzAxMDMxMX0._hZ5CWcDEpWPgk6hSUBHbsbA1ymu7LYfXkFUxgACohk"
private let RED = Color(red: 1.0, green: 0.27, blue: 0.23)
private let GREEN = Color(red: 0.19, green: 0.82, blue: 0.35)
private let BLUE = Color(red: 0.04, green: 0.52, blue: 1.0)
private let BACKGROUND = Color(red: 0.02, green: 0.03, blue: 0.04)

// MARK: - Choosing the kommun

// A kommun to pick from a searchable list, in the way widgets do it from iOS 17
struct KommunEntity: AppEntity {
    let id: String

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Kommun"
    static let defaultQuery = KommunQuery()

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(id)") }
}

struct KommunQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [KommunEntity] {
        identifiers.filter { KOMMUNER.contains($0) }.map { KommunEntity(id: $0) }
    }

    func entities(matching string: String) async throws -> [KommunEntity] {
        KOMMUNER.filter { $0.localizedCaseInsensitiveContains(string) }.map { KommunEntity(id: $0) }
    }

    func suggestedEntities() async throws -> [KommunEntity] {
        KOMMUNER.map { KommunEntity(id: $0) }
    }
}

struct SelectKommunIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Kommun"
    static let description = IntentDescription("Välj kommunen widgeten visar.")

    @Parameter(title: "Kommun")
    var kommun: KommunEntity?

    /** Stockholm until a kommun has been chosen */
    var kommunName: String { kommun?.id ?? "Stockholm" }
}

// MARK: - The numbers

enum Level {
    case calm, normal, busy

    var label: String {
        switch self {
        case .calm: return "Lugnare än vanligt"
        case .normal: return "Som vanligt"
        case .busy: return "Mer än vanligt"
        }
    }

    var color: Color {
        switch self {
        case .calm: return GREEN
        case .normal: return BLUE
        case .busy: return RED
        }
    }
}

struct KommunToday {
    let kommun: String
    let today: Int
    /** Events on an ordinary day, over the two weeks before today */
    let perDay: Double
    /** Today's most common kinds, Polisen's own words */
    let top: [(String, Int)]
    let failed: Bool

    var level: Level {
        if perDay <= 0 { return today > 0 ? .busy : .normal }
        let ratio = Double(today) / perDay
        return ratio < 0.75 ? .calm : ratio > 1.3 ? .busy : .normal
    }

    static func placeholder(_ kommun: String) -> KommunToday {
        KommunToday(kommun: kommun, today: 12, perDay: 15, top: [("Trafikolycka", 3), ("Stöld", 2), ("Inbrott", 2)], failed: false)
    }
}

private struct CountRow: Decodable {
    let day: String
    let events: Int
    let original_type: String?
}

private let stockholm = TimeZone(identifier: "Europe/Stockholm") ?? .current

private func dayString(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.timeZone = stockholm
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
}

private func monthStart(_ date: Date) -> String {
    String(dayString(date).prefix(7)) + "-01"
}

private func fetchMonth(_ kommun: String, _ month: String) async throws -> [CountRow] {
    guard let url = URL(string: "\(SUPABASE_URL)/rest/v1/rpc/kommun_month_counts") else { return [] }
    var request = URLRequest(url: url, timeoutInterval: 15)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(SUPABASE_KEY, forHTTPHeaderField: "apikey")
    request.setValue("Bearer \(SUPABASE_KEY)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONSerialization.data(withJSONObject: ["_kommun": kommun, "_month": month])
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { throw URLError(.badServerResponse) }
    return try JSONDecoder().decode([CountRow].self, from: data)
}

func loadKommun(_ kommun: String, now: Date = Date()) async -> KommunToday {
    do {
        let twoWeeksAgo = now.addingTimeInterval(-15 * 24 * 3600)
        var months = [monthStart(now)]
        if monthStart(twoWeeksAgo) != months[0] { months.append(monthStart(twoWeeksAgo)) }
        var rows: [CountRow] = []
        for month in months { rows += try await fetchMonth(kommun, month) }
        // Polisen's summaries are not events of their own
        rows = rows.filter { !($0.original_type ?? "").lowercased().contains("sammanfattning") }

        let today = dayString(now)
        var before: Set<String> = []
        for back in 1...14 { before.insert(dayString(now.addingTimeInterval(Double(-back) * 24 * 3600))) }
        let todayRows = rows.filter { $0.day == today }
        let earlier = rows.filter { before.contains($0.day) }.reduce(0) { $0 + $1.events }

        var kinds: [String: Int] = [:]
        for row in todayRows { kinds[row.original_type ?? "Övrigt", default: 0] += row.events }
        let top = kinds.sorted { $0.value > $1.value || ($0.value == $1.value && $0.key < $1.key) }.prefix(3).map { ($0.key, $0.value) }
        return KommunToday(kommun: kommun, today: todayRows.reduce(0) { $0 + $1.events }, perDay: Double(earlier) / 14, top: top, failed: false)
    } catch {
        return KommunToday(kommun: kommun, today: 0, perDay: 0, top: [], failed: true)
    }
}

// MARK: - Timeline

struct KommunEntry: TimelineEntry {
    let date: Date
    let data: KommunToday
}

struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> KommunEntry {
        KommunEntry(date: Date(), data: .placeholder("Stockholm"))
    }

    func snapshot(for configuration: SelectKommunIntent, in context: Context) async -> KommunEntry {
        if context.isPreview { return KommunEntry(date: Date(), data: .placeholder(configuration.kommunName)) }
        return KommunEntry(date: Date(), data: await loadKommun(configuration.kommunName))
    }

    func timeline(for configuration: SelectKommunIntent, in context: Context) async -> Timeline<KommunEntry> {
        let entry = KommunEntry(date: Date(), data: await loadKommun(configuration.kommunName))
        // Every half hour; sooner again when the fetch failed
        let next = Date().addingTimeInterval(entry.data.failed ? 10 * 60 : 30 * 60)
        return Timeline(entries: [entry], policy: .after(next))
    }
}

// MARK: - Views

private struct Brand: View {
    var body: some View {
        HStack(spacing: 0) {
            Text("CRIME").foregroundStyle(.white)
            Text("ALERT").foregroundStyle(RED)
        }
        .font(.system(size: 11, weight: .heavy))
    }
}

private struct LevelPill: View {
    let level: Level
    var body: some View {
        Text(level.label)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(level.color)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(level.color.opacity(0.18), in: Capsule())
            .lineLimit(1)
            .minimumScaleFactor(0.8)
    }
}

private struct Summary: View {
    let data: KommunToday
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Brand()
            Spacer(minLength: 4)
            Text(data.kommun)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if data.failed {
                Text("–").font(.system(size: 40, weight: .bold)).foregroundStyle(.white)
                Text("Kunde inte hämta").font(.system(size: 12)).foregroundStyle(.white.opacity(0.6))
            } else {
                Text("\(data.today)")
                    .font(.system(size: 40, weight: .bold))
                    .foregroundStyle(.white)
                    .contentTransition(.numericText())
                Text("händelser idag").font(.system(size: 12)).foregroundStyle(.white.opacity(0.6))
                LevelPill(level: data.level).padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct CrimeAlertWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: KommunEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            Text(entry.data.failed ? "\(entry.data.kommun): –" : "\(entry.data.kommun): \(entry.data.today) händelser idag")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text(entry.data.kommun).font(.headline).lineLimit(1)
                Text(entry.data.failed ? "–" : "\(entry.data.today) händelser idag").font(.subheadline)
                Text(entry.data.failed ? "" : entry.data.level.label).font(.caption).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .containerBackground(.clear, for: .widget)
        case .systemMedium:
            HStack(alignment: .top, spacing: 16) {
                Summary(data: entry.data)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Vanligast idag").font(.system(size: 11, weight: .semibold)).foregroundStyle(.white.opacity(0.6))
                    if entry.data.top.isEmpty {
                        Text(entry.data.failed ? "" : "Inget rapporterat än").font(.system(size: 13)).foregroundStyle(.white.opacity(0.6))
                    }
                    ForEach(entry.data.top, id: \.0) { item in
                        HStack {
                            Text(item.0).font(.system(size: 13, weight: .medium)).foregroundStyle(.white).lineLimit(1)
                            Spacer(minLength: 4)
                            Text("\(item.1)").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.7))
                        }
                    }
                    Spacer(minLength: 0)
                    Text("Ett vanligt dygn: \(Int(entry.data.perDay.rounded()))").font(.system(size: 11)).foregroundStyle(.white.opacity(0.5))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .containerBackground(BACKGROUND, for: .widget)
        default:
            Summary(data: entry.data)
                .containerBackground(BACKGROUND, for: .widget)
        }
    }
}

struct CrimeAlertWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "CrimeAlertKommun", intent: SelectKommunIntent.self, provider: Provider()) { entry in
            CrimeAlertWidgetView(entry: entry)
        }
        .configurationDisplayName("Läget i din kommun")
        .description("Polisens händelser idag i en kommun du väljer, jämfört med ett vanligt dygn.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

@main
struct CrimeAlertWidgetBundle: WidgetBundle {
    var body: some Widget {
        CrimeAlertWidget()
    }
}
