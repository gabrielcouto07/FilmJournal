import Foundation
import Kit

/// Espelha os filtros/ordenação de `web/src/components/DiaryExplorer.tsx` — tudo client-side,
/// já que `GET /diary` não aceita nenhum parâmetro de busca/filtro (ver `DashboardService`).
@MainActor
final class DiaryViewModel: ObservableObject {
    enum SortMode: String, CaseIterable, Identifiable {
        case newest, oldest, rating, title
        var id: String { rawValue }
        var label: String {
            switch self {
            case .newest: return "Mais recentes"
            case .oldest: return "Mais antigas"
            case .rating: return "Nota"
            case .title: return "Título"
            }
        }
    }

    enum ViewMode: String, CaseIterable, Identifiable {
        case list, posters, calendar
        var id: String { rawValue }
        var label: String {
            switch self {
            case .list: return "Lista"
            case .posters: return "Pôsteres"
            case .calendar: return "Calendário"
            }
        }
        var systemImage: String {
            switch self {
            case .list: return "list.bullet"
            case .posters: return "square.grid.3x3"
            case .calendar: return "calendar"
            }
        }
    }

    enum TriState: String, CaseIterable, Identifiable {
        case any, yes, no
        var id: String { rawValue }
    }

    struct MonthGroup: Identifiable {
        let key: String
        let label: String
        let entries: [DiaryEntry]
        var id: String { key }
    }

    @Published private(set) var entries: [DiaryEntry] = []
    @Published private(set) var reviewsCount = 0
    @Published private(set) var rewatchesCount = 0
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    @Published var searchText = ""
    @Published var yearFilter: Int?
    @Published var minRating: Double = 0
    @Published var maxRating: Double = 5
    @Published var reviewedFilter: TriState = .any
    @Published var rewatchFilter: TriState = .any
    @Published var favoriteOnly = false
    @Published var genreFilter: String?
    @Published var sortMode: SortMode = .newest
    @Published var viewMode: ViewMode = .list

    @Published var editingEntry: DiaryEntry?
    @Published private(set) var isMutating = false

    private static let utcCalendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    private static let monthLabelFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "LLLL 'de' yyyy"
        return formatter
    }()

    func load(api: FilmJournalAPI) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let data = try await api.dashboard.diary()
            entries = data.entries
            reviewsCount = data.reviews
            rewatchesCount = data.rewatches
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    var availableYears: [Int] {
        Set(entries.compactMap { entry in
            entry.watchedAt.map { Self.utcCalendar.component(.year, from: $0) }
        }).sorted(by: >)
    }

    var availableGenres: [String] {
        Set(entries.flatMap(\.movie.genreList)).sorted()
    }

    private func matches(_ entry: DiaryEntry) -> Bool {
        if !searchText.trimmingCharacters(in: .whitespaces).isEmpty {
            let needle = searchText.lowercased()
            let haystack = [entry.movie.title, entry.review ?? "", entry.tags ?? ""].joined(separator: " ").lowercased()
            if !haystack.contains(needle) { return false }
        }
        if let yearFilter, let watchedAt = entry.watchedAt {
            if Self.utcCalendar.component(.year, from: watchedAt) != yearFilter { return false }
        } else if yearFilter != nil {
            return false
        }
        if let rating = entry.rating {
            if rating < minRating || rating > maxRating { return false }
        } else if minRating > 0 {
            return false
        }
        let hasReview = !(entry.review ?? "").trimmingCharacters(in: .whitespaces).isEmpty
        switch reviewedFilter {
        case .yes where !hasReview: return false
        case .no where hasReview: return false
        default: break
        }
        switch rewatchFilter {
        case .yes where !entry.rewatch: return false
        case .no where entry.rewatch: return false
        default: break
        }
        if favoriteOnly && !entry.movie.favorite { return false }
        if let genreFilter, !entry.movie.genreList.contains(genreFilter) { return false }
        return true
    }

    var filteredEntries: [DiaryEntry] {
        let filtered = entries.filter(matches)
        switch sortMode {
        case .newest:
            return filtered
        case .oldest:
            return filtered.reversed()
        case .rating:
            return filtered.sorted { ($0.rating ?? -1) > ($1.rating ?? -1) }
        case .title:
            return filtered.sorted { $0.movie.title.localizedCaseInsensitiveCompare($1.movie.title) == .orderedAscending }
        }
    }

    /// Usado pelas views `list`/`calendar` — a ordem de sessões dentro de cada mês respeita
    /// `sortMode`, igual ao web.
    var groupedByMonth: [MonthGroup] {
        var groups: [String: [DiaryEntry]] = [:]
        var order: [String] = []
        for entry in filteredEntries {
            guard let watchedAt = entry.watchedAt else { continue }
            let components = Self.utcCalendar.dateComponents([.year, .month], from: watchedAt)
            let key = String(format: "%04d-%02d", components.year ?? 0, components.month ?? 0)
            if groups[key] == nil {
                groups[key] = []
                order.append(key)
            }
            groups[key]?.append(entry)
        }
        return order.map { key in
            let parts = key.split(separator: "-")
            var dateComponents = DateComponents()
            dateComponents.year = Int(parts[0])
            dateComponents.month = Int(parts[1])
            dateComponents.day = 1
            let date = Self.utcCalendar.date(from: dateComponents) ?? Date()
            let label = Self.monthLabelFormatter.string(from: date).capitalized
            return MonthGroup(key: key, label: label, entries: groups[key] ?? [])
        }
    }

    func delete(_ entry: DiaryEntry, api: FilmJournalAPI) async {
        do {
            try await api.logs.delete(id: entry.id)
            entries.removeAll { $0.id == entry.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func saveEdit(_ result: LogEditorResult, api: FilmJournalAPI) async {
        guard let entry = editingEntry else { return }
        isMutating = true
        defer { isMutating = false }
        do {
            var request = UpdateLogRequest(id: entry.id)
            request.rating = .some(result.rating)
            request.review = .some(result.review)
            request.watchedAt = .some(DayString.string(from: result.watchedAt))
            request.rewatch = result.rewatch
            request.tags = .some(result.tags)
            request.favorite = result.favorite
            let updatedLog = try await api.logs.update(request)

            if let index = entries.firstIndex(where: { $0.id == entry.id }) {
                let updatedMovie = DiaryEntryMovie(
                    id: entry.movie.id,
                    title: entry.movie.title,
                    year: entry.movie.year,
                    genres: entry.movie.genres,
                    posterPath: entry.movie.posterPath,
                    preferredPosterPath: entry.movie.preferredPosterPath,
                    favorite: result.favorite
                )
                entries[index] = DiaryEntry(
                    id: updatedLog.id,
                    watchedAt: updatedLog.watchedAt,
                    loggedAt: updatedLog.loggedAt,
                    rating: updatedLog.rating,
                    review: updatedLog.review,
                    rewatch: updatedLog.rewatch,
                    tags: updatedLog.tags,
                    movie: updatedMovie
                )
            }
            editingEntry = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
