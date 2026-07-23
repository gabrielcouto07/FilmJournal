import Foundation
import Kit
import CoordinatorKit

/// Tela compartilhada por praticamente todo fluxo (Diário, Coleção, Busca, Descobrir, Roleta).
///
/// Particularidade da API: não existe um `GET /api/movies/:id`. Quando chegamos aqui só com um
/// `tmdbId` (ex. resultado de busca) e o filme já existe no catálogo local, `GET /api/tmdb?id=`
/// devolve `existing` com apenas `{id, watchlist, favoriteRank}` — sem `rating`/`watched`. Para
/// ter o estado completo do usuário nesse caso, buscamos por título em `GET /api/movies?q=` e
/// casamos pelo `id` local. É um contorno legítimo dado o que a API expõe hoje, não um bug.
@MainActor
final class FilmDetailViewModel: ObservableObject {
    @Published private(set) var movie: Movie?
    @Published private(set) var tmdbDetails: TmdbMovieDetails?
    @Published private(set) var recentLogs: [LogEntry] = []
    @Published private(set) var isLoading = false
    @Published private(set) var isMutating = false
    @Published var errorMessage: String?

    private var tmdbId: Int?

    var displayTitle: String { movie?.title ?? tmdbDetails?.title ?? "Filme" }

    func load(target: FilmDetailTarget, api: FilmJournalAPI) async {
        isLoading = true
        defer { isLoading = false }
        errorMessage = nil

        if case .local(let movie) = target {
            self.movie = movie
        }
        tmdbId = target.tmdbId
        guard let tmdbId else { return }

        do {
            let response = try await api.tmdb.details(tmdbId: tmdbId)
            tmdbDetails = response.movie
            if movie == nil, let existing = response.existing {
                let matches = try await api.movies.list(query: response.movie.title, limit: 10)
                movie = matches.first { $0.id == existing.id }
            }
            if let movieId = movie?.id {
                recentLogs = try await loadLogs(movieId: movieId, api: api)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadLogs(movieId: String, api: FilmJournalAPI) async throws -> [LogEntry] {
        try await api.logs.list(limit: 200).filter { $0.movieId == movieId }
    }

    /// Garante que o filme existe no catálogo local antes de qualquer mutação — necessário
    /// porque `PATCH /api/movies` opera sobre um `movieId` local, não sobre o `tmdbId`.
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

    func logSession(rating: Double?, review: String?, watchedAt: Date?, api: FilmJournalAPI) async {
        isMutating = true
        defer { isMutating = false }
        do {
            let current = try await ensureLocalMovie(api: api)
            let response = try await api.logs.create(CreateLogRequest(movieId: current.id, watchedAt: watchedAt, rating: rating, review: review))
            movie = response.movie
            recentLogs.insert(response.log, at: 0)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
