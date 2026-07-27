import Foundation
import Kit
import CoordinatorKit

@MainActor
final class FilmDetailViewModel: ObservableObject {
    @Published private(set) var movie: Movie?
    @Published private(set) var tmdbDetails: TmdbMovieDetails?
    @Published private(set) var recentLogs: [LogEntry] = []
    @Published private(set) var isLoading = false
    @Published private(set) var isMutating = false
    @Published var errorMessage: String?
    @Published var editingLog: LogEntry?

    private var tmdbId: Int?

    var displayTitle: String { movie?.title ?? tmdbDetails?.title ?? "Filme" }

    func load(target: FilmDetailTarget, api: FilmJournalAPI) async {
        isLoading = true
        defer { isLoading = false }
        errorMessage = nil

        var resolvedId: String?
        switch target {
        case .local(let movie):
            self.movie = movie
            resolvedId = movie.id
            tmdbId = movie.tmdbId
        case .movieId(let id):
            resolvedId = id
        case .tmdb(let id):
            tmdbId = id
        }

        do {
            if let resolvedId {
                try await loadMovieDetail(id: resolvedId, api: api)
            }
            if let tmdbId {
                let response = try await api.tmdb.details(tmdbId: tmdbId)
                tmdbDetails = response.movie
                if movie == nil, let existing = response.existing {
                    try await loadMovieDetail(id: existing.id, api: api)
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadMovieDetail(id: String, api: FilmJournalAPI) async throws {
        let response = try await api.movies.detail(id: id)
        movie = response.movie
        recentLogs = response.logs
        tmdbId = response.movie.tmdbId ?? tmdbId
    }

    // Toda mutação precisa de `movieId` local; o `tmdbId` não serve.
    private func ensureLocalMovie(api: FilmJournalAPI) async throws -> Movie {
        if let movie { return movie }
        guard let tmdbId else { throw APIError.invalidResponse }
        let response = try await api.movies.add(tmdbId: tmdbId)
        movie = response.movie
        return response.movie
    }

    func toggleWatchlist(api: FilmJournalAPI) async {
        await mutate(api: api) { movie in .watchlist(!movie.watchlist) }
    }

    func toggleFavorite(api: FilmJournalAPI) async {
        await mutate(api: api) { movie in .favorite(!movie.favorite) }
    }

    func toggleTop10(api: FilmJournalAPI) async {
        await mutate(api: api) { movie in .top10(movie.favoriteRank == nil) }
    }

    func setRating(_ rating: Double?, api: FilmJournalAPI) async {
        await mutate(api: api) { _ in .rating(rating) }
    }

    // Backend rejeita se não for `OWNER`; a UI já esconde o botão.
    func setPoster(path: String, api: FilmJournalAPI) async {
        await mutate(api: api) { _ in .poster(path) }
    }

    func setBackdrop(path: String, api: FilmJournalAPI) async {
        await mutate(api: api) { _ in .backdrop(path) }
    }

    private func mutate(api: FilmJournalAPI, action: (Movie) -> MovieCollectionAction) async {
        isMutating = true
        defer { isMutating = false }
        do {
            let current = try await ensureLocalMovie(api: api)
            let response = try await api.movies.mutate(movieId: current.id, action: action(current))
            movie = response.movie
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func logSession(_ result: LogEditorResult, api: FilmJournalAPI) async {
        isMutating = true
        defer { isMutating = false }
        do {
            let current = try await ensureLocalMovie(api: api)
            let response = try await api.logs.create(CreateLogRequest(
                movieId: current.id,
                watchedAt: result.watchedAt,
                rating: result.rating,
                review: result.review,
                rewatch: result.rewatch,
                tags: result.tags
            ))
            movie = response.movie
            recentLogs.insert(response.log, at: 0)
            // `favorite` é estado do filme, não da sessão, então precisa de uma segunda chamada.
            if response.movie.favorite != result.favorite {
                await toggleFavoriteExplicit(result.favorite, api: api)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteLog(_ log: LogEntry, api: FilmJournalAPI) async {
        do {
            try await api.logs.delete(id: log.id)
            recentLogs.removeAll { $0.id == log.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func saveLogEdit(_ result: LogEditorResult, api: FilmJournalAPI) async {
        guard let log = editingLog else { return }
        isMutating = true
        defer { isMutating = false }
        do {
            var request = UpdateLogRequest(id: log.id)
            request.rating = .some(result.rating)
            request.review = .some(result.review)
            request.watchedAt = .some(DayString.string(from: result.watchedAt))
            request.rewatch = result.rewatch
            request.tags = .some(result.tags)
            request.favorite = result.favorite
            let updated = try await api.logs.update(request)
            if let index = recentLogs.firstIndex(where: { $0.id == log.id }) {
                recentLogs[index] = updated
            }
            if movie?.favorite != result.favorite {
                await toggleFavoriteExplicit(result.favorite, api: api)
            }
            editingLog = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func toggleFavoriteExplicit(_ value: Bool, api: FilmJournalAPI) async {
        await mutate(api: api) { _ in .favorite(value) }
    }
}
